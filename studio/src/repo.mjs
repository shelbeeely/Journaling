// The Studio core: every rule lives here, the HTTP layer only translates. Each method takes the acting user (or null for an
// anonymous reader) and checks access itself, so no route can forget to. Writes run in one transaction.
//
// Access: a private project does not exist for non-members (404). A public project is readable by anyone; writes still need a role
// (403). Roles: owner (settings, members, delete) > editor (commit, branch, draft, assets) > viewer (read).
import crypto from 'node:crypto';
import { StudioError, fail, tx } from './db.mjs';
import { Auth } from './auth.mjs';
import { canonical, hashOf, objectHash, sha256, short } from './canon.mjs';
import { serializeSnapshot, emptySnapshot, toObjects, slugify, scanForbidden, PARTS, ASSET_MIMES } from './snapshot.mjs';
import { diffSnapshots } from './diff.mjs';
import { collab } from './collab.mjs';
import { releases } from './releases.mjs';

const RANK = { viewer: 1, editor: 2, owner: 3 };
const BRANCH_RE = /^[A-Za-z0-9][A-Za-z0-9._\/-]{0,63}$/;
const MAX_ASSET = 5 * 1024 * 1024;
const isBranchName = (n) => typeof n === 'string' && BRANCH_RE.test(n) && !n.includes('..') && !n.endsWith('/') && !n.endsWith('.lock') && !/[/.]$/.test(n);

export class Studio {
  constructor(db, { now = () => new Date().toISOString() } = {}) { this.db = db; this.now = now; this.auth = new Auth(db, now); }

  // ---------- access ----------
  _role(projectId, user) {
    if (!user) return null;
    const r = this.db.prepare('SELECT role FROM memberships WHERE project_id = ? AND user_id = ?').get(projectId, user.id);
    return r ? r.role : null;
  }
  // Loads a project and checks the caller may do `need` on it. Returns {p, role}.
  _access(projectId, user, need = 'viewer') {
    const p = typeof projectId === 'string' ? this.db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId) : null;
    if (!p) fail(404, 'not_found', 'No such project.');
    const role = this._role(p.id, user);
    if (!role && p.visibility !== 'public') fail(404, 'not_found', 'No such project.'); // private: its existence is not revealed
    const eff = role || 'viewer';
    if (RANK[eff] < RANK[need]) fail(user ? 403 : 401, user ? 'forbidden' : 'login_required', user ? `That needs the ${need} role.` : 'Sign in first.');
    return { p, role: role || 'public' };
  }
  _projectView(p, role) {
    return { id: p.id, slug: p.slug, name: p.name, description: p.description, visibility: p.visibility, allowReuse: !!p.allow_reuse, defaultBranch: p.default_branch, role, createdAt: p.created_at, updatedAt: p.updated_at, license: p.license || '', credit: p.credit || '', source: p.source_project_id ? { project: p.source_project_id, commit: p.source_commit_id } : null, attribution: p.attribution ? JSON.parse(p.attribution) : null };
  }
  _commitView(c) { return { id: c.id, short: short(c.id), tree: c.tree, parents: JSON.parse(c.parents), author: { id: c.author_id, name: c.author_name }, message: c.message, createdAt: c.created_at }; }
  _userRow(user) { const u = user && this.db.prepare('SELECT id, display_name FROM users WHERE id = ?').get(user.id); if (!u) fail(401, 'login_required', 'Sign in first.'); return u; }

  // ---------- objects and commits ----------
  _storeObjects(objects) {
    const ins = this.db.prepare('INSERT OR IGNORE INTO objects (hash, kind, body, size) VALUES (?, ?, ?, ?)');
    for (const o of objects) ins.run(o.hash, o.kind, o.body, o.body.length);
  }
  // Rebuilds a snapshot from its tree, checking every object still hashes to its name.
  readSnapshot(treeHash) {
    const t = this.db.prepare("SELECT body FROM objects WHERE hash = ? AND kind = 'tree'").get(treeHash);
    if (!t) fail(500, 'missing_object', 'A stored snapshot is missing.');
    const tree = JSON.parse(t.body);
    if (objectHash('tree', tree) !== treeHash) fail(500, 'corrupt_object', 'A stored snapshot does not match its hash.');
    const snap = {};
    for (const k of PARTS) {
      const o = this.db.prepare('SELECT body FROM objects WHERE hash = ? AND kind = ?').get(tree.parts[k], k);
      if (!o) fail(500, 'missing_object', `A stored ${k} is missing.`);
      const v = JSON.parse(o.body);
      if (objectHash(k, v) !== tree.parts[k]) fail(500, 'corrupt_object', `A stored ${k} does not match its hash.`);
      snap[k] = v;
    }
    return snap;
  }
  _commitRow(projectId, id) {
    const c = typeof id === 'string' ? this.db.prepare('SELECT c.* FROM commits c JOIN project_commits pc ON pc.commit_id = c.id WHERE pc.project_id = ? AND c.id = ?').get(projectId, id) : null;
    if (!c) fail(404, 'not_found', 'No such commit in this project.');
    return c;
  }
  _headRow(p, branch) {
    const b = this.db.prepare('SELECT * FROM branches WHERE project_id = ? AND name = ?').get(p.id, branch);
    if (!b) fail(404, 'no_such_branch', `No branch "${branch}".`);
    return b;
  }
  // The commit id is the hash of everything that makes the commit: tree, parents, author, message, time.
  static commitId({ tree, parents, authorId, authorName, message, createdAt }) {
    return hashOf({ v: 1, tree, parents, author: { id: authorId, name: authorName }, message, timestamp: createdAt });
  }
  _insertCommit(p, { tree, parents, u, message, source = null }) {
    const createdAt = this.now();
    const row = { tree, parents, authorId: u.id, authorName: u.display_name, message, createdAt };
    const id = Studio.commitId(row);
    this.db.prepare('INSERT INTO commits (id, tree, parents, author_id, author_name, message, created_at, source_project_id, source_commit_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(id, tree, canonical(parents), u.id, u.display_name, message, createdAt, source && source.project, source && source.commit);
    this.db.prepare('INSERT OR IGNORE INTO project_commits (project_id, commit_id) VALUES (?, ?)').run(p.id, id);
    return id;
  }
  _checkAssets(p, snap) {
    const missing = snap.assets.filter((a) => !this.db.prepare('SELECT 1 FROM assets WHERE project_id = ? AND hash = ?').get(p.id, a.hash));
    if (missing.length) fail(422, 'missing_asset', `Upload the asset first: ${missing.map((a) => a.name).join(', ')}.`, missing);
  }
  _message(m) {
    if (typeof m !== 'string' || !m.trim()) fail(422, 'message_required', 'Add a short message that says what changed.');
    if (m.length > 500) fail(422, 'message_too_long', 'Keep the message under 500 characters.');
    const found = scanForbidden(m);
    if (found.length) fail(422, 'forbidden_content', `The message ${found[0].rule}.`, found);
    return m.trim();
  }
  static validBranch(n) { return isBranchName(n); }

  // ---------- accounts ----------
  register(b) { return this.auth.register(b || {}); }
  login(b) { return this.auth.login(b || {}); }
  logout(token) { this.auth.logout(token); }
  userFor(token) { return this.auth.userFor(token); }

  // ---------- projects ----------
  createProject(user, { name, description = '', visibility = 'private', allowReuse = false, license = '', credit = '', snapshot = null, message = 'Start the project' } = {}) {
    const u = this._userRow(user);
    if (typeof name !== 'string' || !name.trim() || name.length > 120) fail(422, 'invalid_name', 'Give the project a name (up to 120 characters).');
    if (!['private', 'public'].includes(visibility)) fail(422, 'invalid_visibility', 'Visibility is "private" or "public".');
    if (typeof allowReuse !== 'boolean') fail(422, 'invalid_allow_reuse', 'allowReuse is true or false.');
    if (typeof description !== 'string' || description.length > 1000) fail(422, 'invalid_description', 'Description: up to 1000 characters.');
    const first = this._message(message);
    const terms = this._terms(license, credit);
    const base = emptySnapshot(name.trim());
    const snap = serializeSnapshot(snapshot || {}, base);
    return tx(this.db, () => {
      const id = crypto.randomUUID(), now = this.now();
      let slug = slugify(name), n = 1;
      while (this.db.prepare('SELECT 1 FROM projects WHERE slug = ?').get(slug)) slug = `${slugify(name)}-${++n}`;
      this.db.prepare('INSERT INTO projects (id, slug, name, description, visibility, allow_reuse, default_branch, license, credit, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(id, slug, name.trim(), description, visibility, allowReuse ? 1 : 0, 'main', terms.license, terms.credit, u.id, now, now);
      this.db.prepare('INSERT INTO memberships (project_id, user_id, role, created_at) VALUES (?, ?, ?, ?)').run(id, u.id, 'owner', now);
      const p = this.db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
      if (snap.assets.length) fail(422, 'missing_asset', 'Create the project first, then upload assets and commit them.');
      const { objects, tree } = toObjects(snap);
      this._storeObjects(objects);
      const cid = this._insertCommit(p, { tree, parents: [], u, message: first });
      this.db.prepare('INSERT INTO branches (project_id, name, head_commit_id, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(id, 'main', cid, u.id, now, now);
      return { ...this._projectView(p, 'owner'), head: cid };
    });
  }
  listProjects(user, { publicOnly = false } = {}) {
    const rows = publicOnly || !user
      ? this.db.prepare("SELECT p.*, NULL AS role FROM projects p WHERE p.visibility = 'public' ORDER BY p.updated_at DESC").all()
      : this.db.prepare('SELECT p.*, m.role AS role FROM projects p JOIN memberships m ON m.project_id = p.id WHERE m.user_id = ? ORDER BY p.updated_at DESC').all(user.id);
    return rows.map((p) => this._projectView(p, p.role || (user ? this._role(p.id, user) : null) || 'public'));
  }
  getProject(user, id) { const { p, role } = this._access(id, user); return this._projectView(p, role); }
  updateProject(user, id, patch = {}) {
    const { p } = this._access(id, user, 'owner');
    const set = {};
    if (patch.name !== undefined) { if (typeof patch.name !== 'string' || !patch.name.trim() || patch.name.length > 120) fail(422, 'invalid_name', 'Give the project a name (up to 120 characters).'); set.name = patch.name.trim(); }
    if (patch.description !== undefined) { if (typeof patch.description !== 'string' || patch.description.length > 1000) fail(422, 'invalid_description', 'Description: up to 1000 characters.'); set.description = patch.description; }
    if (patch.visibility !== undefined) { if (!['private', 'public'].includes(patch.visibility)) fail(422, 'invalid_visibility', 'Visibility is "private" or "public".'); set.visibility = patch.visibility; }
    if (patch.allowReuse !== undefined) { if (typeof patch.allowReuse !== 'boolean') fail(422, 'invalid_allow_reuse', 'allowReuse is true or false.'); set.allow_reuse = patch.allowReuse ? 1 : 0; }
    if (patch.license !== undefined || patch.credit !== undefined) { const t = this._terms(patch.license ?? p.license, patch.credit ?? p.credit); set.license = t.license; set.credit = t.credit; }
    const keys = Object.keys(set);
    if (keys.length) this.db.prepare(`UPDATE projects SET ${keys.map((k) => `${k} = ?`).join(', ')}, updated_at = ? WHERE id = ?`).run(...keys.map((k) => set[k]), this.now(), p.id);
    return this.getProject(user, id);
  }
  // The reuse terms an owner offers: plain text, carried into every fork's attribution.
  _terms(license, credit) {
    for (const [v, what] of [[license, 'license'], [credit, 'credit']]) {
      if (typeof v !== 'string' || v.length > 500) fail(422, `invalid_${what}`, `The ${what} text: up to 500 characters.`);
      const found = scanForbidden(v); if (found.length) fail(422, 'forbidden_content', `The ${what} text ${found[0].rule}.`, found);
    }
    return { license: license.trim(), credit: credit.trim() };
  }
  deleteProject(user, id) {
    const { p } = this._access(id, user, 'owner');
    tx(this.db, () => { this.db.prepare("UPDATE proposals SET status = 'closed' WHERE source_project_id = ? AND status IN ('open', 'changes_requested', 'approved')").run(p.id); this.db.prepare('UPDATE projects SET source_project_id = NULL WHERE source_project_id = ?').run(p.id); this.db.prepare('DELETE FROM projects WHERE id = ?').run(p.id); }); // forks keep their attribution (stored in the fork); commits and objects are immutable and stay (unreferenced) until a future garbage collection
    return { deleted: true };
  }

  // ---------- members ----------
  listMembers(user, id) {
    const { p } = this._access(id, user, 'viewer');
    return this.db.prepare('SELECT u.id, u.username, u.display_name AS displayName, m.role FROM memberships m JOIN users u ON u.id = m.user_id WHERE m.project_id = ? ORDER BY m.created_at').all(p.id).map((r) => ({ ...r }));
  }
  setMember(user, id, username, role) {
    const { p } = this._access(id, user, 'owner');
    if (!RANK[role]) fail(422, 'invalid_role', 'Role is owner, editor or viewer.');
    const t = this.db.prepare('SELECT id FROM users WHERE username = ?').get(String(username));
    if (!t) fail(404, 'no_such_user', 'No such user.');
    return tx(this.db, () => {
      const cur = this.db.prepare('SELECT role FROM memberships WHERE project_id = ? AND user_id = ?').get(p.id, t.id);
      if (cur && cur.role === 'owner' && role !== 'owner' && this.db.prepare("SELECT COUNT(*) n FROM memberships WHERE project_id = ? AND role = 'owner'").get(p.id).n < 2) fail(409, 'last_owner', 'A project needs at least one owner.');
      this.db.prepare('INSERT INTO memberships (project_id, user_id, role, created_at) VALUES (?, ?, ?, ?) ON CONFLICT (project_id, user_id) DO UPDATE SET role = excluded.role').run(p.id, t.id, role, this.now());
      return this.listMembers(user, id);
    });
  }
  removeMember(user, id, username) {
    const { p } = this._access(id, user, 'owner');
    const t = this.db.prepare('SELECT id FROM users WHERE username = ?').get(String(username));
    const cur = t && this.db.prepare('SELECT role FROM memberships WHERE project_id = ? AND user_id = ?').get(p.id, t.id);
    if (!cur) fail(404, 'no_such_member', 'That user is not a member.');
    if (cur.role === 'owner' && this.db.prepare("SELECT COUNT(*) n FROM memberships WHERE project_id = ? AND role = 'owner'").get(p.id).n < 2) fail(409, 'last_owner', 'A project needs at least one owner.');
    this.db.prepare('DELETE FROM memberships WHERE project_id = ? AND user_id = ?').run(p.id, t.id);
    this.db.prepare('DELETE FROM drafts WHERE project_id = ? AND user_id = ?').run(p.id, t.id);
    return this.listMembers(user, id);
  }

  // ---------- reading ----------
  // ref = a branch name or a commit id (full, or a unique prefix of 7+ characters)
  _resolve(p, ref) {
    if (typeof ref !== 'string' || !ref) fail(422, 'ref_required', 'Say which branch or commit.');
    const b = this.db.prepare('SELECT head_commit_id FROM branches WHERE project_id = ? AND name = ?').get(p.id, ref);
    if (b) return b.head_commit_id;
    if (/^[0-9a-f]{7,64}$/.test(ref)) {
      const hits = this.db.prepare('SELECT commit_id FROM project_commits WHERE project_id = ? AND commit_id LIKE ? LIMIT 2').all(p.id, ref + '%');
      if (hits.length === 1) return hits[0].commit_id;
      if (hits.length > 1) fail(422, 'ambiguous_ref', 'That commit prefix matches more than one commit.');
    }
    fail(404, 'not_found', `No branch or commit "${ref}".`);
  }
  getCommit(user, id, ref) {
    const { p } = this._access(id, user);
    const c = this._commitRow(p.id, this._resolve(p, ref));
    return { commit: this._commitView(c), snapshot: this.readSnapshot(c.tree) };
  }
  head(user, id, branch) { const { p } = this._access(id, user); return this.getCommit(user, id, branch || p.default_branch); }
  log(user, id, { branch, limit = 50 } = {}) {
    const { p } = this._access(id, user);
    const start = this._headRow(p, branch || p.default_branch).head_commit_id;
    const seen = new Map(), stack = [start];
    while (stack.length && seen.size < 2000) {
      const cid = stack.pop();
      if (seen.has(cid)) continue;
      const c = this.db.prepare('SELECT rowid AS rid, * FROM commits WHERE id = ?').get(cid);
      seen.set(cid, c);
      stack.push(...JSON.parse(c.parents));
    }
    const lim = Math.min(200, Math.max(1, Number(limit) || 50));
    const all = [...seen.values()].sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : b.rid - a.rid));
    return { branch: branch || p.default_branch, head: start, total: all.length, commits: all.slice(0, lim).map((c) => this._commitView(c)) };
  }
  diff(user, id, from, to) {
    const { p } = this._access(id, user);
    const a = this._commitRow(p.id, this._resolve(p, from)), b = this._commitRow(p.id, this._resolve(p, to));
    return { from: this._commitView(a), to: this._commitView(b), ...diffSnapshots(this.readSnapshot(a.tree), this.readSnapshot(b.tree)) };
  }
  // Recomputes a commit's id from its stored fields and its tree from its objects: proof nothing was altered.
  verify(user, id, ref) {
    const { p } = this._access(id, user);
    const c = this._commitRow(p.id, this._resolve(p, ref));
    const idOk = Studio.commitId({ tree: c.tree, parents: JSON.parse(c.parents), authorId: c.author_id, authorName: c.author_name, message: c.message, createdAt: c.created_at }) === c.id;
    let treeOk = true; try { this.readSnapshot(c.tree); } catch { treeOk = false; }
    return { id: c.id, idOk, treeOk, ok: idOk && treeOk };
  }

  // ---------- commits ----------
  // Saves a named commit on a branch. expectedHead is the commit the caller last saw at the tip of the branch: if the branch has
  // moved since, nothing is written (409) and the reply names the new head, so nobody's work is silently overwritten.
  commit(user, id, { branch, expectedHead, message, snapshot } = {}) {
    const { p } = this._access(id, user, 'editor');
    const u = this._userRow(user);
    const msg = this._message(message);
    if (typeof expectedHead !== 'string' || !expectedHead) fail(422, 'expected_head_required', 'Send expectedHead: the commit you last saw at the tip of the branch.');
    return tx(this.db, () => {
      const br = this._headRow(p, branch || p.default_branch);
      this._checkHead(br, expectedHead);
      const headC = this.db.prepare('SELECT * FROM commits WHERE id = ?').get(br.head_commit_id);
      const snap = serializeSnapshot(snapshot || {}, this.readSnapshot(headC.tree));
      return this._writeCommit(p, u, br, headC, snap, msg);
    });
  }
  _checkHead(br, expectedHead) {
    if (br.head_commit_id !== expectedHead) fail(409, 'head_moved', 'Someone saved to this branch since you last looked. Nothing was overwritten: review the new version, then save again.', { branch: br.name, head: br.head_commit_id, expectedHead });
  }
  _writeCommit(p, u, br, headC, snap, msg) {
    this._checkAssets(p, snap);
    const { objects, tree } = toObjects(snap);
    if (tree === headC.tree) return { unchanged: true, commit: this._commitView(headC) };
    this._storeObjects(objects);
    const cid = this._insertCommit(p, { tree, parents: [headC.id], u, message: msg });
    this.db.prepare('UPDATE branches SET head_commit_id = ?, updated_at = ? WHERE project_id = ? AND name = ?').run(cid, this.now(), p.id, br.name);
    this.db.prepare('UPDATE projects SET updated_at = ? WHERE id = ?').run(this.now(), p.id);
    return { unchanged: false, commit: this._commitView(this.db.prepare('SELECT * FROM commits WHERE id = ?').get(cid)) };
  }
  // Restore = a NEW commit on the branch whose content is an older commit's. History is never rewritten.
  restore(user, id, { commit, branch, expectedHead, message } = {}) {
    const { p } = this._access(id, user, 'editor');
    const u = this._userRow(user);
    if (typeof expectedHead !== 'string' || !expectedHead) fail(422, 'expected_head_required', 'Send expectedHead: the commit you last saw at the tip of the branch.');
    return tx(this.db, () => {
      const target = this._commitRow(p.id, this._resolve(p, commit));
      const br = this._headRow(p, branch || p.default_branch);
      this._checkHead(br, expectedHead);
      const headC = this.db.prepare('SELECT * FROM commits WHERE id = ?').get(br.head_commit_id);
      const msg = this._message(message || `Restore version ${short(target.id)}`);
      return this._writeCommit(p, u, br, headC, this.readSnapshot(target.tree), msg);
    });
  }

  // ---------- branches ----------
  listBranches(user, id) {
    const { p } = this._access(id, user);
    return this.db.prepare('SELECT b.name, b.head_commit_id AS head, b.updated_at AS updatedAt, u.display_name AS createdBy FROM branches b JOIN users u ON u.id = b.created_by WHERE b.project_id = ? ORDER BY b.name').all(p.id)
      .map((b) => ({ ...b, isDefault: b.name === p.default_branch }));
  }
  createBranch(user, id, { name, from } = {}) {
    const { p } = this._access(id, user, 'editor');
    const u = this._userRow(user);
    if (!isBranchName(name)) fail(422, 'invalid_branch_name', 'Branch names: letters, digits, dots, dashes and slashes, up to 64 characters.');
    return tx(this.db, () => {
      if (this.db.prepare('SELECT 1 FROM branches WHERE project_id = ? AND name = ?').get(p.id, name)) fail(409, 'branch_exists', `There is already a branch "${name}".`);
      const head = this._commitRow(p.id, this._resolve(p, from || p.default_branch)).id;
      const now = this.now();
      this.db.prepare('INSERT INTO branches (project_id, name, head_commit_id, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(p.id, name, head, u.id, now, now);
      return { name, head };
    });
  }
  deleteBranch(user, id, name) {
    const { p } = this._access(id, user, 'editor');
    if (name === p.default_branch) fail(409, 'default_branch', 'The default branch cannot be deleted.');
    this._headRow(p, name);
    tx(this.db, () => { this.db.prepare('DELETE FROM branches WHERE project_id = ? AND name = ?').run(p.id, name); this.db.prepare('DELETE FROM drafts WHERE project_id = ? AND branch = ?').run(p.id, name); });
    return { deleted: true }; // the commits stay: history is never rewritten
  }

  // ---------- drafts (autosave) ----------
  // One per user and branch. `base` is the commit the draft started from; `rev` counts saves. Saving needs the rev you last saw
  // (409 if another tab or device saved since), and promoting to a commit needs the branch still to be at `base` (409 if it moved).
  _draftView(d, head) { return { branch: d.branch, base: d.base_commit_id, rev: d.rev, updatedAt: d.updated_at, behind: d.base_commit_id !== head, snapshot: JSON.parse(d.snapshot) }; }
  getDraft(user, id, branch) {
    const { p } = this._access(id, user, 'editor');
    const br = this._headRow(p, branch || p.default_branch);
    const d = this.db.prepare('SELECT * FROM drafts WHERE project_id = ? AND user_id = ? AND branch = ?').get(p.id, user.id, br.name);
    return { head: br.head_commit_id, draft: d ? this._draftView(d, br.head_commit_id) : null };
  }
  saveDraft(user, id, branch, { base, rev, snapshot } = {}) {
    const { p } = this._access(id, user, 'editor');
    return tx(this.db, () => {
      const br = this._headRow(p, branch || p.default_branch);
      const d = this.db.prepare('SELECT * FROM drafts WHERE project_id = ? AND user_id = ? AND branch = ?').get(p.id, user.id, br.name);
      const now = this.now();
      if (!d) {
        const b = this._commitRow(p.id, base || br.head_commit_id);
        if (rev !== undefined && rev !== null && rev !== 0) fail(409, 'draft_gone', 'That draft no longer exists (it was discarded or turned into a version).', { rev: 0 });
        const snap = serializeSnapshot(snapshot || {}, this.readSnapshot(b.tree));
        this._checkAssets(p, snap);
        this.db.prepare('INSERT INTO drafts (project_id, user_id, branch, base_commit_id, snapshot, rev, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?)').run(p.id, user.id, br.name, b.id, canonical(snap), now);
        return { base: b.id, rev: 1, updatedAt: now, behind: b.id !== br.head_commit_id, head: br.head_commit_id };
      }
      if (rev !== d.rev) fail(409, 'draft_conflict', 'This draft was saved from somewhere else since you loaded it. Reload it before saving.', { rev: d.rev, base: d.base_commit_id });
      if (base !== undefined && base !== d.base_commit_id) fail(409, 'draft_base_mismatch', 'This draft started from a different version. Discard it to start again from the branch.', { base: d.base_commit_id });
      const snap = serializeSnapshot(snapshot || {}, JSON.parse(d.snapshot));
      this._checkAssets(p, snap);
      this.db.prepare('UPDATE drafts SET snapshot = ?, rev = rev + 1, updated_at = ? WHERE project_id = ? AND user_id = ? AND branch = ?').run(canonical(snap), now, p.id, user.id, br.name);
      return { base: d.base_commit_id, rev: d.rev + 1, updatedAt: now, behind: d.base_commit_id !== br.head_commit_id, head: br.head_commit_id };
    });
  }
  discardDraft(user, id, branch) {
    const { p } = this._access(id, user, 'editor');
    const r = this.db.prepare('DELETE FROM drafts WHERE project_id = ? AND user_id = ? AND branch = ?').run(p.id, user.id, branch || p.default_branch);
    return { discarded: Number(r.changes) > 0 };
  }
  promoteDraft(user, id, branch, { message, expectedHead } = {}) {
    const { p } = this._access(id, user, 'editor');
    const u = this._userRow(user);
    const msg = this._message(message);
    return tx(this.db, () => {
      const br = this._headRow(p, branch || p.default_branch);
      const d = this.db.prepare('SELECT * FROM drafts WHERE project_id = ? AND user_id = ? AND branch = ?').get(p.id, user.id, br.name);
      if (!d) fail(404, 'no_draft', 'There is no draft to save as a version.');
      this._checkHead(br, expectedHead || d.base_commit_id);
      if (br.head_commit_id !== d.base_commit_id) fail(409, 'head_moved', 'The branch moved since this draft started. Nothing was overwritten: compare, then save again.', { branch: br.name, head: br.head_commit_id, base: d.base_commit_id });
      const headC = this.db.prepare('SELECT * FROM commits WHERE id = ?').get(br.head_commit_id);
      const res = this._writeCommit(p, u, br, headC, JSON.parse(d.snapshot), msg);
      this.db.prepare('DELETE FROM drafts WHERE project_id = ? AND user_id = ? AND branch = ?').run(p.id, user.id, br.name);
      return res;
    });
  }

  // ---------- assets ----------
  putAsset(user, id, { name, mime, bytes } = {}) {
    const { p } = this._access(id, user, 'editor');
    const u = this._userRow(user);
    if (typeof name !== 'string' || !/^[A-Za-z0-9][\w .()\-]{0,99}$/.test(name)) fail(422, 'invalid_asset_name', 'Asset names are plain file names.');
    if (!ASSET_MIMES[mime]) fail(415, 'unsupported_asset_type', `Assets can be ${Object.keys(ASSET_MIMES).join(', ')}.`);
    if (!Buffer.isBuffer(bytes) || !bytes.length) fail(422, 'empty_asset', 'The file is empty.');
    if (bytes.length > MAX_ASSET) fail(413, 'asset_too_large', 'Assets can be up to 5 MB.');
    const sig = { 'image/png': (b) => b.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])), 'image/jpeg': (b) => b[0] === 0xff && b[1] === 0xd8, 'image/gif': (b) => b.subarray(0, 3).toString() === 'GIF', 'image/webp': (b) => b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP', 'font/woff2': (b) => b.subarray(0, 4).toString() === 'wOF2' };
    if (sig[mime] && !sig[mime](bytes)) fail(422, 'asset_mismatch', 'The file is not what its type says.');
    if (mime === 'image/svg+xml') {
      const t = bytes.toString('utf8');
      if (/<script|javascript:|\son\w+\s*=|<foreignObject|<!ENTITY/i.test(t)) fail(422, 'unsafe_svg', 'SVGs with scripts or embedded content are not accepted.');
      if (scanForbidden(t).length) fail(422, 'forbidden_content', 'The file contains private or forbidden content.');
    }
    if (scanForbidden(name).length) fail(422, 'forbidden_content', 'That file name looks like private data.');
    const hash = sha256(bytes);
    this.db.prepare('INSERT OR IGNORE INTO assets (project_id, hash, name, mime, size, data, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(p.id, hash, name, mime, bytes.length, bytes, u.id, this.now());
    return { name, hash, mime, size: bytes.length };
  }
  getAsset(user, id, hash) {
    const { p } = this._access(id, user);
    const a = typeof hash === 'string' && /^[0-9a-f]{64}$/.test(hash) ? this.db.prepare('SELECT name, mime, size, data FROM assets WHERE project_id = ? AND hash = ?').get(p.id, hash) : null;
    if (!a) fail(404, 'not_found', 'No such asset.');
    return { name: a.name, mime: a.mime, size: a.size, bytes: Buffer.from(a.data) };
  }
  listAssets(user, id) {
    const { p } = this._access(id, user);
    return this.db.prepare('SELECT hash, name, mime, size FROM assets WHERE project_id = ? ORDER BY name').all(p.id).map((r) => ({ ...r }));
  }
}
Object.assign(Studio.prototype, collab); // G2: forks, proposals, merges (collab.mjs)
Object.assign(Studio.prototype, releases); // G3: releases and reusable pages (releases.mjs)
export { StudioError };
