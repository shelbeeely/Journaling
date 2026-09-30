// Phase G2: forks, change proposals and merges. These are Studio methods (installed on Studio.prototype by repo.mjs), so they share
// its rules: every method takes the acting user (or null), checks access itself, and every write is one transaction.
//
// Who may do what (see the matrix in studio/README.md):
//   fork          any signed-in user who can read the project, and only when its creator set allowReuse
//   propose       an owner or editor of the fork (or of the project itself, branch to branch)
//   comment       members of the target project, and the proposal's author
//   review        owners and editors of the target project (never approving their own proposal)
//   merge/accept  owners and editors of the target project
//   read          anyone who can read the target project (public: guests too)
import crypto from 'node:crypto';
import { fail, tx } from './db.mjs';
import { short } from './canon.mjs';
import { serializeSnapshot, toObjects, scanForbidden, slugify } from './snapshot.mjs';
import { mergeSnapshots, mergeBases, isAncestor, ancestors, listChanges, applyChanges } from './merge.mjs';
import { diffSnapshots } from './diff.mjs';

const MAX_HISTORY = 5000;
const OPEN = ['open', 'changes_requested', 'approved'];
const text = (v, max, code, what, { req = true } = {}) => {
  if (v === undefined || v === null || v === '') { if (req) fail(422, code, `${what} is required.`); return ''; }
  if (typeof v !== 'string' || v.length > max) fail(422, code, `${what}: text up to ${max} characters.`);
  const found = scanForbidden(v);
  if (found.length) fail(422, 'forbidden_content', `${what} ${found[0].rule}.`, found);
  return v.trim();
};
// Raw keys a snapshot carries that the allowlist serializer would drop: unknown fields never cross a fork.
function extraKeys(raw, ser, at, out) {
  if (Array.isArray(raw)) { raw.forEach((x, i) => extraKeys(x, Array.isArray(ser) ? ser[i] : undefined, `${at}[${i}]`, out)); return; }
  if (raw && typeof raw === 'object') for (const k of Object.keys(raw)) { if (!ser || typeof ser !== 'object' || !(k in ser)) out.push(`${at}.${k}`); else extraKeys(raw[k], ser[k], `${at}.${k}`, out); }
}
// A snapshot may be shared (forked, proposed) only if it is exactly what the allowlist serializer would produce: no forbidden key,
// path or value at any depth, no unknown fields.
export function assertPublishable(snap, where) {
  const found = scanForbidden(snap);
  if (found.length) fail(422, 'not_forkable', `${where} contains private or forbidden content (${found.slice(0, 2).map((f) => `${f.path}: ${f.rule}`).join('; ')}). Nothing was shared.`, found);
  let ser;
  try { ser = serializeSnapshot(snap, snap); } catch (e) { fail(422, 'not_forkable', `${where} is not a valid publication source (${e.message}). Nothing was shared.`); }
  const extra = []; extraKeys(snap, ser, '', extra);
  if (extra.length) fail(422, 'not_forkable', `${where} has fields outside the publication source (${extra.slice(0, 3).join(', ')}). Nothing was shared.`, extra);
}

export const collab = {
  // ---------- small helpers ----------
  _parentsOf() {
    const cache = new Map(), q = this.db.prepare('SELECT parents FROM commits WHERE id = ?');
    return (id) => { if (!cache.has(id)) { const r = q.get(id); if (!r) fail(500, 'missing_commit', 'A commit in the history is missing.'); cache.set(id, JSON.parse(r.parents)); } return cache.get(id); };
  },
  _snapOf(commitId) { const c = this.db.prepare('SELECT tree FROM commits WHERE id = ?').get(commitId); if (!c) fail(404, 'not_found', 'No such commit.'); return this.readSnapshot(c.tree); },
  _isMember(p, user) { return !!this._role(p.id, user); },
  // The merge base as a snapshot: the one best common ancestor, or (criss-cross history) the virtual merge of several.
  _baseSnapshot(parentsOf, bases, depth = 0) {
    let snap = this._snapOf(bases[0]);
    for (let i = 1; i < bases.length; i++) {
      const sub = depth < 4 ? mergeBases(parentsOf, bases[0], bases[i]) : [], inner = sub.length ? this._baseSnapshot(parentsOf, sub, depth + 1) : snap;
      snap = mergeSnapshots(inner, snap, this._snapOf(bases[i])).snapshot;
    }
    return snap;
  },
  _mergeInputs(oursId, theirsId) {
    const parentsOf = this._parentsOf(), bases = mergeBases(parentsOf, oursId, theirsId);
    if (!bases.length) fail(422, 'no_common_ancestor', 'These two histories share no common version, so they cannot be merged.');
    return { parentsOf, bases, base: this._baseSnapshot(parentsOf, bases), ours: this._snapOf(oursId), theirs: this._snapOf(theirsId) };
  },
  // Makes a commit (and its ancestors) readable in another project: they must be publishable, and are linked, never copied.
  _linkAncestry(p, commitId) {
    const has = this.db.prepare('SELECT 1 FROM project_commits WHERE project_id = ? AND commit_id = ?'), ins = this.db.prepare('INSERT OR IGNORE INTO project_commits (project_id, commit_id) VALUES (?, ?)'), parentsOf = this._parentsOf();
    for (const id of ancestors(parentsOf, commitId)) {
      if (has.get(p.id, id)) continue;
      const c = this.db.prepare('SELECT tree, message FROM commits WHERE id = ?').get(id);
      const found = scanForbidden(c.message); if (found.length) fail(422, 'not_forkable', `Version ${short(id)} has a message that ${found[0].rule}. Nothing was shared.`);
      assertPublishable(this.readSnapshot(c.tree), `Version ${short(id)}`);
      ins.run(p.id, id);
    }
  },
  _copyAssets(fromId, toId, snap) {
    for (const a of snap.assets) {
      if (this.db.prepare('SELECT 1 FROM assets WHERE project_id = ? AND hash = ?').get(toId, a.hash)) continue;
      this.db.prepare('INSERT OR IGNORE INTO assets (project_id, hash, name, mime, size, data, created_by, created_at) SELECT ?, hash, name, mime, size, data, created_by, created_at FROM assets WHERE project_id = ? AND hash = ?').run(toId, fromId, a.hash);
    }
  },

  // ---------- forks ----------
  // A fork shares history with its source up to the forked version (commits are global; the fork links them) and then goes its own way:
  // its own branches, drafts, members and settings. Only the published line (the source's default branch) can be forked, every version
  // being forked is checked again for private content, and the source's drafts, members, tokens and settings are never touched.
  fork(user, id, { name, description = '', visibility = 'private', commit, allowReuse = false } = {}) {
    const { p } = this._access(id, user, 'viewer');
    const u = this._userRow(user);
    if (!p.allow_reuse) fail(403, 'reuse_not_allowed', 'The creator has not allowed reuse of this project, so it cannot be forked.');
    const nm = name === undefined || name === '' ? p.name : text(name, 120, 'invalid_name', 'The name');
    if (!['private', 'public'].includes(visibility)) fail(422, 'invalid_visibility', 'Visibility is "private" or "public".');
    if (typeof allowReuse !== 'boolean') fail(422, 'invalid_allow_reuse', 'allowReuse is true or false.');
    const desc = text(description, 1000, 'invalid_description', 'The description', { req: false });
    const parentsOf = this._parentsOf(), published = this._headRow(p, p.default_branch).head_commit_id;
    const at = commit ? this._commitRow(p.id, this._resolve(p, commit)).id : published;
    if (!isAncestor(parentsOf, at, published)) fail(403, 'not_published', `Only versions on the published line (“${p.default_branch}”) can be forked.`);
    const ids = [...ancestors(parentsOf, at)];
    if (ids.length > MAX_HISTORY) fail(422, 'history_too_long', 'That history is too long to fork.');
    const authors = new Map(), assets = new Map();
    for (const cid of ids) {
      const c = this.db.prepare('SELECT * FROM commits WHERE id = ?').get(cid), snap = this.readSnapshot(c.tree);
      const found = scanForbidden(c.message); if (found.length) fail(422, 'not_forkable', `Version ${short(cid)} has a message that ${found[0].rule}. Nothing was forked.`);
      assertPublishable(snap, `Version ${short(cid)}`);
      authors.set(c.author_id, c.author_name);
      for (const a of snap.assets) assets.set(a.hash, a);
    }
    const creator = this.db.prepare('SELECT id, display_name FROM users WHERE id = ?').get(p.created_by);
    const prior = p.attribution ? JSON.parse(p.attribution) : null;
    return tx(this.db, () => {
      const fid = crypto.randomUUID(), now = this.now();
      let slug = slugify(nm), n = 1;
      while (this.db.prepare('SELECT 1 FROM projects WHERE slug = ?').get(slug)) slug = `${slugify(nm)}-${++n}`;
      const attribution = {
        v: 1, source: { project: p.id, slug: p.slug, name: p.name }, commit: at, forkedAt: now,
        creator: { id: creator.id, name: creator.display_name }, license: p.license, credit: p.credit,
        authors: [...authors].map(([aid, aname]) => ({ id: aid, name: aname })).sort((a, b) => (a.name < b.name ? -1 : 1)),
        lineage: [...(prior ? [...prior.lineage, { name: prior.source.name, creator: prior.creator.name, license: prior.license }] : [])],
      };
      this.db.prepare('INSERT INTO projects (id, slug, name, description, visibility, allow_reuse, default_branch, source_project_id, source_commit_id, license, credit, attribution, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(fid, slug, nm, desc || p.description, visibility, allowReuse ? 1 : 0, p.default_branch, p.id, at, p.license, '', JSON.stringify(attribution), u.id, now, now);
      this.db.prepare('INSERT INTO memberships (project_id, user_id, role, created_at) VALUES (?, ?, ?, ?)').run(fid, u.id, 'owner', now);
      for (const cid of ids) this.db.prepare('INSERT INTO project_commits (project_id, commit_id) VALUES (?, ?)').run(fid, cid);
      for (const a of assets.values()) this.db.prepare('INSERT OR IGNORE INTO assets (project_id, hash, name, mime, size, data, created_by, created_at) SELECT ?, hash, name, mime, size, data, created_by, created_at FROM assets WHERE project_id = ? AND hash = ?').run(fid, p.id, a.hash);
      this.db.prepare('INSERT INTO branches (project_id, name, head_commit_id, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(fid, p.default_branch, at, u.id, now, now);
      const f = this.db.prepare('SELECT * FROM projects WHERE id = ?').get(fid);
      return { ...this._projectView(f, 'owner'), head: at };
    });
  },
  listForks(user, id) {
    const { p } = this._access(id, user);
    return this.db.prepare('SELECT * FROM projects WHERE source_project_id = ? ORDER BY created_at').all(p.id)
      .filter((f) => f.visibility === 'public' || this._isMember(f, user)).map((f) => this._projectView(f, this._role(f.id, user) || 'public'));
  },

  // ---------- proposals ----------
  _proposalRow(p, n) {
    const r = /^\d+$/.test(String(n)) ? this.db.prepare('SELECT * FROM proposals WHERE project_id = ? AND number = ?').get(p.id, Number(n)) : null;
    if (!r) fail(404, 'not_found', 'No such proposal.');
    return r;
  },
  _sourceHead(row) {
    if (!row.source_project_id) return null;
    const b = this.db.prepare('SELECT head_commit_id FROM branches WHERE project_id = ? AND name = ?').get(row.source_project_id, row.source_branch);
    return b ? b.head_commit_id : null;
  },
  _targetHead(p, row) { const b = this.db.prepare('SELECT head_commit_id FROM branches WHERE project_id = ? AND name = ?').get(p.id, row.target_branch); return b ? b.head_commit_id : null; },
  // A review belongs to the version the reviewer saw: if the source branch moved since, the proposal is back to "open".
  _status(row, sourceHead) { return ['approved', 'changes_requested'].includes(row.status) && row.reviewed_head !== sourceHead ? 'open' : row.status; },
  _proposalView(p, row, user) {
    const sh = this._sourceHead(row), th = this._targetHead(p, row), status = this._status(row, sh);
    const src = row.source_project_id ? this.db.prepare('SELECT id, name, slug, visibility FROM projects WHERE id = ?').get(row.source_project_id) : null;
    const author = this.db.prepare('SELECT id, display_name FROM users WHERE id = ?').get(row.created_by);
    const role = this._role(p.id, user), editor = role === 'owner' || role === 'editor', open = OPEN.includes(status);
    return {
      number: row.number, id: row.id, title: row.title, description: row.description, status, stale: status !== row.status,
      source: { project: src ? { id: src.id, name: src.name, slug: src.slug } : null, branch: row.source_branch, head: sh, gone: !sh },
      target: { project: { id: p.id, name: p.name, slug: p.slug }, branch: row.target_branch, head: th },
      author: { id: author.id, name: author.display_name }, createdAt: row.created_at, updatedAt: row.updated_at, mergedCommit: row.merged_commit_id,
      can: { comment: !!user && (!!role || row.created_by === user.id), review: !!user && editor && open, merge: !!user && editor && open && status !== 'changes_requested', close: !!user && open && (editor || row.created_by === user.id), reopen: !!user && status === 'closed' && (editor || row.created_by === user.id) },
    };
  },
  _events(row) {
    return this.db.prepare('SELECT e.id, e.kind, e.state, e.body, e.data, e.created_at AS createdAt, u.id AS uid, u.display_name AS uname FROM proposal_events e JOIN users u ON u.id = e.user_id WHERE e.proposal_id = ? ORDER BY e.id').all(row.id)
      .map((e) => ({ id: e.id, kind: e.kind, state: e.state, body: e.body, data: e.data ? JSON.parse(e.data) : null, createdAt: e.createdAt, user: { id: e.uid, name: e.uname } }));
  },
  _event(row, u, kind, { state = null, body = '', data = null } = {}) {
    this.db.prepare('INSERT INTO proposal_events (proposal_id, kind, user_id, state, body, data, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(row.id, kind, u.id, state, body, data ? JSON.stringify(data) : null, this.now());
    this.db.prepare('UPDATE proposals SET updated_at = ? WHERE id = ?').run(this.now(), row.id);
  },

  createProposal(user, id, { sourceProject, sourceBranch, targetBranch, title, description = '' } = {}) {
    const { p } = this._access(id, user, 'viewer');
    const u = this._userRow(user);
    const t = text(title, 120, 'invalid_title', 'The title'), d = text(description, 2000, 'invalid_description', 'The description', { req: false });
    const sameProject = !sourceProject || sourceProject === p.id;
    const src = sameProject ? this._access(p.id, user, 'editor').p : this._access(sourceProject, user, 'editor').p;
    if (!sameProject && src.source_project_id !== p.id) fail(422, 'not_a_fork', 'A proposal comes from a fork of this project, or from another branch of it.');
    const tb = targetBranch || p.default_branch;
    return tx(this.db, () => {
      const sb = this._headRow(src, sourceBranch || src.default_branch), tbr = this._headRow(p, tb);
      if (src.id === p.id && sb.name === tbr.name) fail(422, 'same_branch', 'Pick two different branches.');
      const parentsOf = this._parentsOf();
      if (isAncestor(parentsOf, sb.head_commit_id, tbr.head_commit_id)) fail(422, 'nothing_to_propose', 'Everything on that branch is already in the target branch.');
      if (!mergeBases(parentsOf, tbr.head_commit_id, sb.head_commit_id).length) fail(422, 'no_common_ancestor', 'These two histories share no common version.');
      assertPublishable(this.readSnapshot(this.db.prepare('SELECT tree FROM commits WHERE id = ?').get(sb.head_commit_id).tree), 'The proposed version');
      if (this.db.prepare(`SELECT 1 FROM proposals WHERE project_id = ? AND source_project_id = ? AND source_branch = ? AND target_branch = ? AND status IN ('open', 'changes_requested', 'approved')`).get(p.id, src.id, sb.name, tb)) fail(409, 'already_open', 'There is already an open proposal from that branch to that branch.');
      const n = (this.db.prepare('SELECT COALESCE(MAX(number), 0) AS n FROM proposals WHERE project_id = ?').get(p.id).n) + 1, pid = crypto.randomUUID(), now = this.now();
      this.db.prepare('INSERT INTO proposals (id, project_id, number, source_project_id, source_branch, target_branch, title, description, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(pid, p.id, n, src.id, sb.name, tb, t, d, u.id, now, now);
      return this._proposalView(p, this.db.prepare('SELECT * FROM proposals WHERE id = ?').get(pid), user);
    });
  },
  listProposals(user, id, { status } = {}) {
    const { p } = this._access(id, user);
    const rows = this.db.prepare('SELECT * FROM proposals WHERE project_id = ? ORDER BY number DESC').all(p.id);
    return rows.map((r) => this._proposalView(p, r, user)).filter((v) => !status || (status === 'open' ? OPEN.includes(v.status) : v.status === status));
  },
  getProposal(user, id, n) {
    const { p } = this._access(id, user);
    const row = this._proposalRow(p, n);
    return { ...this._proposalView(p, row, user), events: this._events(row), accepted: this.db.prepare('SELECT item_key AS key, commit_id AS commitId FROM proposal_accepts WHERE proposal_id = ?').all(row.id).map((r) => ({ ...r })) };
  },
  // What the proposal changes (base -> theirs, by page and block), what merging would do, and the snapshots to draw them with.
  compareProposal(user, id, n) {
    const { p } = this._access(id, user);
    const row = this._proposalRow(p, n);
    let sh = this._sourceHead(row), th = this._targetHead(p, row);
    if (row.status === 'merged' && row.merged_commit_id) { const ps = this._parentsOf()(row.merged_commit_id); if (ps.length === 2) [th, sh] = ps; } // a merged proposal shows what it changed when it was merged
    if (!sh || !th) fail(409, 'source_gone', 'The proposal’s source or target branch no longer exists.');
    return { proposal: this._proposalView(p, row, user), ...this._compare(th, sh), accepted: this.db.prepare('SELECT item_key AS key FROM proposal_accepts WHERE proposal_id = ?').all(row.id).map((r) => r.key) };
  },
  _compare(oursId, theirsId) {
    const inp = this._mergeInputs(oursId, theirsId), res = mergeSnapshots(inp.base, inp.ours, inp.theirs);
    const cv = (cid) => this._commitView(this.db.prepare('SELECT * FROM commits WHERE id = ?').get(cid));
    return {
      commits: { base: inp.bases.length === 1 ? cv(inp.bases[0]) : { virtual: true, of: inp.bases.map(short) }, ours: cv(oursId), theirs: cv(theirsId) },
      snapshots: { base: inp.base, ours: inp.ours, theirs: inp.theirs },
      changes: listChanges(inp.base, inp.theirs), diff: diffSnapshots(inp.base, inp.theirs),
      merge: { clean: res.clean, conflicts: res.conflicts, stats: res.stats, provisional: res.snapshot },
    };
  },
  commentProposal(user, id, n, { body } = {}) {
    const { p } = this._access(id, user);
    const u = this._userRow(user), row = this._proposalRow(p, n);
    if (!this._isMember(p, user) && row.created_by !== u.id) fail(403, 'forbidden', 'Only members of the project and the proposal’s author can comment.');
    const b = text(body, 4000, 'invalid_comment', 'The comment');
    return tx(this.db, () => { this._event(row, u, 'comment', { body: b }); return this.getProposal(user, id, n); });
  },
  reviewProposal(user, id, n, { state, body = '' } = {}) {
    const { p } = this._access(id, user, 'editor');
    const u = this._userRow(user), row = this._proposalRow(p, n);
    if (!['approved', 'changes_requested', 'comment'].includes(state)) fail(422, 'invalid_review', 'A review is "approved", "changes_requested" or "comment".');
    const b = text(body, 4000, 'invalid_comment', 'The review', { req: state === 'changes_requested' });
    if (state === 'approved' && row.created_by === u.id) fail(403, 'self_approval', 'You cannot approve your own proposal; ask another owner or editor.');
    return tx(this.db, () => {
      const cur = this.db.prepare('SELECT * FROM proposals WHERE id = ?').get(row.id);
      if (!OPEN.includes(cur.status)) fail(409, 'not_open', 'This proposal is closed or merged.');
      if (state !== 'comment') {
        const sh = this._sourceHead(cur);
        this.db.prepare('UPDATE proposals SET status = ?, reviewed_head = ? WHERE id = ?').run(state, sh, cur.id);
      }
      this._event(cur, u, 'review', { state, body: b });
      return this.getProposal(user, id, n);
    });
  },
  setProposalStatus(user, id, n, { status } = {}) {
    const { p } = this._access(id, user);
    const u = this._userRow(user), row = this._proposalRow(p, n), role = this._role(p.id, user), editor = role === 'owner' || role === 'editor';
    if (!['closed', 'open'].includes(status)) fail(422, 'invalid_status', 'Status is "closed" or "open".');
    if (!editor && row.created_by !== u.id) fail(403, 'forbidden', 'Only the author or an owner or editor can do that.');
    return tx(this.db, () => {
      const cur = this.db.prepare('SELECT * FROM proposals WHERE id = ?').get(row.id);
      if (cur.status === 'merged') fail(409, 'merged', 'A merged proposal cannot change.');
      if (status === 'closed') { if (cur.status === 'closed') fail(409, 'not_open', 'Already closed.'); }
      else { if (cur.status !== 'closed') fail(409, 'not_closed', 'Only a closed proposal can be reopened.'); if (!this._sourceHead(cur)) fail(409, 'source_gone', 'The source branch no longer exists.'); }
      this.db.prepare('UPDATE proposals SET status = ?, reviewed_head = NULL WHERE id = ?').run(status === 'closed' ? 'closed' : 'open', cur.id);
      this._event(cur, u, 'status', { state: status });
      return this.getProposal(user, id, n);
    });
  },

  // ---------- merging ----------
  // The one place a merge is written. Runs inside the caller's transaction. Nothing is written unless the whole merge is resolved.
  //   into    the target project row and branch name    from  {project row, ref: branch or commit}
  //   expected {ours, theirs}: the two heads the caller looked at (409 head_moved if either moved)
  //   only    null = merge everything (a two-parent merge commit); a list of change keys = accept just those (a one-parent commit)
  _performMerge(p, u, branch, from, { expected, resolutions, message, only = null }) {
    if (!expected || typeof expected.ours !== 'string' || typeof expected.theirs !== 'string') fail(422, 'expected_heads_required', 'Send expectedHeads: {ours, theirs}, the two versions you looked at.');
    const br = this._headRow(p, branch), theirsId = this._commitRow(from.project.id, this._resolve(from.project, from.ref)).id;
    if (br.head_commit_id !== expected.ours || theirsId !== expected.theirs) fail(409, 'head_moved', 'One of the branches changed since you looked. Nothing was merged: look again, then merge.', { ours: br.head_commit_id, theirs: theirsId, expected });
    const oursId = br.head_commit_id, parentsOf = this._parentsOf();
    if (!only && isAncestor(parentsOf, theirsId, oursId)) fail(409, 'already_merged', 'Nothing to merge: the target already has everything from the other branch.');
    const inp = this._mergeInputs(oursId, theirsId);
    let theirs = inp.theirs, keys = null;
    if (only) {
      keys = new Set(listChanges(inp.base, inp.theirs).map((c) => c.key));
      const bad = only.filter((k) => !keys.has(k));
      if (!only.length || bad.length) fail(422, 'unknown_change', only.length ? `No such change: ${bad.slice(0, 3).join(', ')}.` : 'Pick at least one change.');
      theirs = applyChanges(inp.base, inp.theirs, only);
    }
    const res = mergeSnapshots(inp.base, inp.ours, theirs, resolutions || {});
    if (!res.clean) fail(409, 'unresolved_conflicts', `${res.conflicts.length} ${res.conflicts.length === 1 ? 'thing is' : 'things are'} changed differently on both sides. Nothing was merged: choose what to keep for each.`, { conflicts: res.conflicts, stats: res.stats });
    let snap;
    try { snap = serializeSnapshot(res.snapshot, inp.ours); } catch (e) { if (e.status) throw Object.assign(e, { message: `The merged result is not valid: ${e.message}` }); throw e; }
    if (from.project.id !== p.id) { if (!only) this._linkAncestry(p, theirsId); this._copyAssets(from.project.id, p.id, snap); }
    this._checkAssets(p, snap);
    const { objects, tree } = toObjects(snap), oursC = this.db.prepare('SELECT * FROM commits WHERE id = ?').get(oursId);
    if (only && tree === oursC.tree) return { unchanged: true, commit: this._commitView(oursC), resolved: res.resolved, stats: res.stats };
    this._storeObjects(objects);
    const cid = this._insertCommit(p, { tree, parents: only ? [oursId] : [oursId, theirsId], u, message });
    this.db.prepare('UPDATE branches SET head_commit_id = ?, updated_at = ? WHERE project_id = ? AND name = ?').run(cid, this.now(), p.id, br.name);
    this.db.prepare('UPDATE projects SET updated_at = ? WHERE id = ?').run(this.now(), p.id);
    return { unchanged: false, merged: !only, commit: this._commitView(this.db.prepare('SELECT * FROM commits WHERE id = ?').get(cid)), resolved: res.resolved, stats: res.stats };
  },
  _mergeMessage(m, fallback) { return this._message(m === undefined || m === '' ? fallback : m); },

  mergeProposal(user, id, n, { expectedHeads, resolutions, message } = {}) {
    const { p } = this._access(id, user, 'editor');
    const u = this._userRow(user);
    return tx(this.db, () => {
      const row = this._proposalRow(p, n), sh = this._sourceHead(row), st = this._status(row, sh);
      if (!OPEN.includes(st)) fail(409, 'not_open', 'This proposal is closed or already merged.');
      if (st === 'changes_requested') fail(409, 'changes_requested', 'A reviewer asked for changes. Update the branch, or have a reviewer approve, before merging.');
      if (!sh) fail(409, 'source_gone', 'The source branch no longer exists.');
      const src = this.db.prepare('SELECT * FROM projects WHERE id = ?').get(row.source_project_id);
      const msg = this._mergeMessage(message, `Merge proposal #${row.number}: ${row.title}`);
      const r = this._performMerge(p, u, row.target_branch, { project: src, ref: row.source_branch }, { expected: expectedHeads, resolutions, message: msg });
      this.db.prepare("UPDATE proposals SET status = 'merged', merged_commit_id = ? WHERE id = ?").run(r.commit.id, row.id);
      this._event(row, u, 'merge', { body: msg, data: { commit: r.commit.id, resolved: r.resolved.length } });
      return { ...r, proposal: this.getProposal(user, id, n) };
    });
  },
  // Accept only some of a proposal's changes (by the keys of compareProposal().changes), as one new commit on the target branch.
  acceptChanges(user, id, n, { items, expectedHeads, resolutions, message } = {}) {
    const { p } = this._access(id, user, 'editor');
    const u = this._userRow(user);
    if (!Array.isArray(items) || items.some((k) => typeof k !== 'string')) fail(422, 'unknown_change', 'items is a list of change keys.');
    return tx(this.db, () => {
      const row = this._proposalRow(p, n), sh = this._sourceHead(row), st = this._status(row, sh);
      if (!OPEN.includes(st)) fail(409, 'not_open', 'This proposal is closed or already merged.');
      if (st === 'changes_requested') fail(409, 'changes_requested', 'A reviewer asked for changes. Update the branch, or have a reviewer approve, before accepting.');
      if (!sh) fail(409, 'source_gone', 'The source branch no longer exists.');
      const src = this.db.prepare('SELECT * FROM projects WHERE id = ?').get(row.source_project_id);
      const msg = this._mergeMessage(message, `Accept ${items.length} ${items.length === 1 ? 'change' : 'changes'} from proposal #${row.number}`);
      const r = this._performMerge(p, u, row.target_branch, { project: src, ref: row.source_branch }, { expected: expectedHeads, resolutions, message: msg, only: [...new Set(items)] });
      if (!r.unchanged) {
        for (const k of new Set(items)) this.db.prepare('INSERT OR REPLACE INTO proposal_accepts (proposal_id, item_key, commit_id, created_at) VALUES (?, ?, ?, ?)').run(row.id, k, r.commit.id, this.now());
        this._event(row, u, 'accept', { body: msg, data: { keys: [...new Set(items)], commit: r.commit.id } });
      }
      return { ...r, proposal: this.getProposal(user, id, n) };
    });
  },

  // Direct merges, no review: another branch of the same project, or the project this one was forked from ("sync from upstream").
  // Merging a fork INTO its source always goes through a proposal.
  _mergeSource(user, p, from) {
    const fp = from && from.project && from.project !== p.id ? this._access(from.project, user, 'viewer').p : p;
    if (fp.id !== p.id && p.source_project_id !== fp.id) fail(403, 'not_upstream', 'Direct merges come from another branch of this project or from the project it was forked from. To bring changes upstream, make a proposal.');
    return { project: fp, ref: (from && from.ref) || fp.default_branch };
  },
  mergePreview(user, id, { into, from } = {}) {
    const { p } = this._access(id, user, 'viewer');
    const src = this._mergeSource(user, p, from), br = this._headRow(p, into || p.default_branch);
    const theirsId = this._commitRow(src.project.id, this._resolve(src.project, src.ref)).id;
    return { branch: br.name, ...this._compare(br.head_commit_id, theirsId), alreadyMerged: isAncestor(this._parentsOf(), theirsId, br.head_commit_id) };
  },
  merge(user, id, { into, from, expectedHeads, resolutions, message } = {}) {
    const { p } = this._access(id, user, 'editor');
    const u = this._userRow(user), src = this._mergeSource(user, p, from);
    return tx(this.db, () => {
      const branch = into || p.default_branch, label = src.project.id === p.id ? `branch “${src.ref}”` : `“${src.project.name}”`;
      return this._performMerge(p, u, branch, src, { expected: expectedHeads, resolutions, message: this._mergeMessage(message, `Merge ${label} into “${branch}”`) });
    });
  },
};
