// Phase G3: releases and reusable pages. Studio methods (installed on Studio.prototype by repo.mjs), so they share its rules: every
// method takes the acting user (or null), checks access itself, and every write is one transaction.
//
// Who may do what (matrix in studio/README.md):
//   release   create: a project owner (the publisher). Read, list, export: anyone who can read the project (public: guests too).
//             A release is never edited or deleted (database triggers); only deleting the whole project removes them.
//   library   your own library: any signed-in user. A public item can be read by anyone (guests too) and copied into a project by any
//             editor of that project; a private item is invisible (404) to everyone but its owner. Guests never write.
//   insert    an editor or owner of the target project (same as committing).
//
// Forbidden content (private pages, calendars, profile secrets, personal packs, answers and entries...) is refused three times: in what
// is submitted (scanner), in what the allowlist serializer keeps, and in the snapshot a release freezes (assertPublishable).
import crypto from 'node:crypto';
import { fail, tx } from './db.mjs';
import { canonical, hashOf, sha256, short } from './canon.mjs';
import { serializeSnapshot, serializeDay, scanForbidden, assertClean } from './snapshot.mjs';
import { journalFiles } from './pipeline.mjs';
import { assertPublishable } from './collab.mjs';
import { PAGE_TYPES } from '../../journal/pages.mjs';
import { TYPES, PLACE } from '../../journal/daypage.mjs';

const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$/;
const isObj = (x) => x && typeof x === 'object' && !Array.isArray(x);
const text = (v, max, code, what, { req = false } = {}) => {
  if (v === undefined || v === null || v === '') { if (req) fail(422, code, `${what} is required.`); return ''; }
  if (typeof v !== 'string' || v.length > max) fail(422, code, `${what}: text up to ${max} characters.`);
  const found = scanForbidden(v);
  if (found.length) fail(422, 'forbidden_content', `${what} ${found[0].rule}.`, found);
  return v.trim();
};
const REPEAT_ID = /^[a-z0-9_]+(\.[a-z0-9_-]+)*$/;

// What a library page may hold: one book-level page type with its options. Never the weeks group, a protected page (Safety plan,
// Support, Closing) or a page that is built from a person's data. Returns the clean content or fails with the reason.
export function cleanPageContent(c) {
  if (!isObj(c)) fail(422, 'invalid_content', 'A reusable page is {type, options}.');
  assertClean(c);
  for (const k of Object.keys(c)) if (!['type', 'options'].includes(k)) fail(422, 'invalid_content', `A reusable page is {type, options}; "${k}" is not part of it.`);
  const T = typeof c.type === 'string' && Object.prototype.hasOwnProperty.call(PAGE_TYPES, c.type) ? PAGE_TYPES[c.type] : null;
  if (!T) fail(422, 'invalid_content', `Unknown page type "${c.type}". Known: ${Object.keys(PAGE_TYPES).join(', ')}.`);
  if (T.scope !== 'book') fail(422, 'not_reusable', `${T.name} is a ${T.scope}-level page; only book-level pages can be saved to the library.`);
  if (T.protected) fail(422, 'not_reusable', `${T.name} is a protected page and is not reusable.`);
  if (T.module) fail(422, 'not_reusable', `${T.name} belongs to a module (${T.module}) that can hold personal content, so it is not reusable.`);
  const spec = T.options || {}, options = {};
  if (c.options !== undefined && !isObj(c.options)) fail(422, 'invalid_content', 'options must be an object.');
  for (const [k, v] of Object.entries(c.options || {})) {
    if (!spec[k]) fail(422, 'invalid_content', `Unknown option "${k}"${Object.keys(spec).length ? ` (this page has: ${Object.keys(spec).join(', ')})` : ' (this page has no options)'}.`);
    if (spec[k].kind === 'text' && (typeof v !== 'string' || v.length > (spec[k].max || 80))) fail(422, 'invalid_content', `Option "${k}" must be text up to ${spec[k].max || 80} characters.`);
    options[k] = v;
  }
  return { type: c.type, options };
}

// A block layout: the blocks only (flow, no grid placement), each cut down to the options its type declares. The locked Writing space
// stays with the page it is on, so it is not part of a reusable layout.
export function cleanBlocksContent(c) {
  if (!isObj(c) || !Array.isArray(c.blocks)) fail(422, 'invalid_content', 'A reusable block layout is {blocks: [...]}.');
  for (const k of Object.keys(c)) if (!['blocks', 'v', 'grid'].includes(k)) fail(422, 'invalid_content', `A reusable block layout is {blocks}; "${k}" is not part of it.`);
  assertClean(c);
  const errs = [];
  const day = serializeDay({ v: 2, blocks: c.blocks }, errs);
  if (errs.length) fail(422, 'invalid_content', errs.slice(0, 3).join('; '));
  const blocks = day.blocks.filter((b) => !TYPES[b.type].locked).map((b) => { const o = { ...b }; for (const k of PLACE) delete o[k]; return o; });
  if (!blocks.length) fail(422, 'invalid_content', 'There is no reusable block in that layout (the Writing space stays with its page).');
  if (c.blocks.some((b) => !isObj(b) || !TYPES[b.type])) fail(422, 'invalid_content', 'Every block needs a known type.');
  return { blocks };
}
const cleanContent = (kind, c) => (kind === 'page' ? cleanPageContent(c) : cleanBlocksContent(c));

const newUid = (type, taken) => { let u; do u = `${type}-${crypto.randomBytes(3).toString('hex')}`; while (taken.has(u)); taken.add(u); return u; };

export const releases = {
  // ======================= releases =======================
  _releaseRow(p, ref) {
    const r = typeof ref === 'string' && ref ? (/^\d+$/.test(ref)
      ? this.db.prepare('SELECT * FROM releases WHERE project_id = ? AND number = ?').get(p.id, Number(ref))
      : this.db.prepare('SELECT * FROM releases WHERE project_id = ? AND name = ?').get(p.id, ref)) : null;
    if (!r) fail(404, 'not_found', 'No such release.');
    return r;
  },
  _releaseView(r) {
    return { id: r.id, number: r.number, name: r.name, notes: r.notes, commit: { id: r.commit_id, short: short(r.commit_id) }, tree: r.tree, manifestHash: r.manifest_hash, createdBy: r.created_by_name, createdAt: r.created_at };
  },
  // The manifest: what a later print build needs to prove it is building exactly this release. No PDFs are stored here: the books
  // are built by the print pipeline from the exported files, and `files` carries their hashes so the build can be checked against it.
  _manifest(p, name, number, c, snap) {
    const files = Object.fromEntries(Object.entries(journalFiles(snap)).map(([k, v]) => [k, sha256(v)]));
    const m = {
      format: 1, release: { name, number }, project: { slug: p.slug, name: p.name }, commit: c.id, tree: c.tree, snapshotHash: hashOf(snap),
      title: snap.meta.title, print: snap.print, assets: snap.assets.map((a) => ({ name: a.name, hash: a.hash })), packRefs: (snap.meta.packs || []), files,
    };
    assertClean(m);
    return m;
  },
  createRelease(user, id, { name, commit, branch, notes = '' } = {}) {
    const { p } = this._access(id, user, 'owner');
    const u = this._userRow(user);
    if (typeof name !== 'string' || !NAME_RE.test(name) || /^\d+$/.test(name)) fail(422, 'invalid_release_name', 'Name the release with 1 to 40 letters, digits, dots or dashes (like v1.0 or 2027-edition). It cannot be only digits.');
    const note = text(notes, 2000, 'invalid_notes', 'The release notes');
    return tx(this.db, () => {
      const c = this._commitRow(p.id, this._resolve(p, commit || branch || p.default_branch));
      const found = scanForbidden(c.message);
      if (found.length) fail(422, 'not_publishable', `That version's message ${found[0].rule}, so it cannot be released.`, found);
      const snap = this.readSnapshot(c.tree);
      assertPublishable(snap, `Version ${short(c.id)}`);
      if (this.db.prepare('SELECT 1 FROM releases WHERE project_id = ? AND name = ?').get(p.id, name)) fail(409, 'release_exists', `A release named "${name}" already exists. Releases are never changed: pick a new name.`);
      const number = (this.db.prepare('SELECT MAX(number) AS n FROM releases WHERE project_id = ?').get(p.id).n || 0) + 1;
      const manifest = this._manifest(p, name, number, c, snap);
      const rid = crypto.randomUUID();
      this.db.prepare('INSERT INTO releases (id, project_id, number, name, notes, commit_id, tree, manifest, manifest_hash, created_by, created_by_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(rid, p.id, number, name, note, c.id, c.tree, canonical(manifest), hashOf(manifest), u.id, u.display_name, this.now());
      return { ...this._releaseView(this.db.prepare('SELECT * FROM releases WHERE id = ?').get(rid)), manifest };
    });
  },
  listReleases(user, id) {
    const { p } = this._access(id, user);
    return this.db.prepare('SELECT * FROM releases WHERE project_id = ? ORDER BY number DESC').all(p.id).map((r) => this._releaseView(r));
  },
  // The release plus a check that nothing it points at has changed: the manifest still hashes to its recorded hash, the commit still
  // hashes to its id, and the snapshot still matches the manifest.
  _releaseCheck(p, r) {
    let manifestOk = false, commitOk = false, contentOk = false;
    try { manifestOk = hashOf(JSON.parse(r.manifest)) === r.manifest_hash; } catch { /* stays false */ }
    try {
      const c = this.db.prepare('SELECT * FROM commits WHERE id = ?').get(r.commit_id);
      commitOk = this.constructor.commitId({ tree: c.tree, parents: JSON.parse(c.parents), authorId: c.author_id, authorName: c.author_name, message: c.message, createdAt: c.created_at }) === c.id && c.tree === r.tree;
      contentOk = hashOf(this.readSnapshot(c.tree)) === JSON.parse(r.manifest).snapshotHash;
    } catch { /* stays false */ }
    return { manifestOk, commitOk, contentOk, ok: manifestOk && commitOk && contentOk };
  },
  getRelease(user, id, ref) {
    const { p } = this._access(id, user);
    const r = this._releaseRow(p, ref);
    return { ...this._releaseView(r), manifest: JSON.parse(r.manifest), verified: this._releaseCheck(p, r) };
  },
  // Everything needed to build the books again: the frozen snapshot, the two content files the renderer reads, the manifest.
  // Checked for forbidden content again on the way out. Asset bytes are not inlined: they are listed by hash and name.
  exportRelease(user, id, ref) {
    const { p } = this._access(id, user);
    const r = this._releaseRow(p, ref), snap = this.readSnapshot(r.tree);
    assertPublishable(snap, `Release ${r.name}`);
    const verified = this._releaseCheck(p, r);
    if (!verified.ok) fail(500, 'release_corrupt', 'This release no longer matches its recorded hashes, so it is not exported.', verified);
    return { release: this._releaseView(r), manifest: JSON.parse(r.manifest), snapshot: snap, files: journalFiles(snap), verified };
  },

  // ======================= reusable pages (the user's library) =======================
  _itemView(it, { versions = false, viewer = null } = {}) {
    const owner = this.db.prepare('SELECT id, display_name FROM users WHERE id = ?').get(it.owner_id);
    const latest = this.db.prepare('SELECT MAX(version) AS v FROM library_versions WHERE item_id = ?').get(it.id).v;
    const o = { id: it.id, kind: it.kind, name: it.name, description: it.description, visibility: it.visibility, license: it.license, credit: it.credit, owner: { id: owner.id, name: owner.display_name }, mine: !!viewer && viewer.id === it.owner_id, latest, createdAt: it.created_at, updatedAt: it.updated_at };
    if (versions) o.versions = this.db.prepare('SELECT version, content_hash AS hash, note, created_at AS createdAt FROM library_versions WHERE item_id = ? ORDER BY version DESC').all(it.id).map((v) => ({ ...v }));
    return o;
  },
  // A private item does not exist for anyone but its owner. Writes need the owner (guests: 401).
  _item(user, itemId, write = false) {
    const it = typeof itemId === 'string' ? this.db.prepare('SELECT * FROM library_items WHERE id = ?').get(itemId) : null;
    const mine = !!user && !!it && it.owner_id === user.id;
    if (!it || (!mine && it.visibility !== 'public')) fail(404, 'not_found', 'No such library item.');
    if (write && !mine) fail(user ? 403 : 401, user ? 'forbidden' : 'login_required', user ? 'Only the owner can change a library item.' : 'Sign in first.');
    return it;
  },
  listLibrary(user, { publicOnly = false } = {}) {
    const rows = publicOnly || !user
      ? this.db.prepare("SELECT * FROM library_items WHERE visibility = 'public' ORDER BY updated_at DESC").all()
      : this.db.prepare('SELECT * FROM library_items WHERE owner_id = ? ORDER BY updated_at DESC').all(user.id);
    return rows.map((it) => this._itemView(it, { viewer: user }));
  },
  getLibraryItem(user, itemId) { return this._itemView(this._item(user, itemId), { versions: true, viewer: user }); },
  getLibraryVersion(user, itemId, version) {
    const it = this._item(user, itemId);
    const v = /^\d+$/.test(String(version)) ? this.db.prepare('SELECT * FROM library_versions WHERE item_id = ? AND version = ?').get(it.id, Number(version)) : null;
    if (!v) fail(404, 'not_found', 'No such version.');
    return { item: this._itemView(it, { viewer: user }), version: v.version, hash: v.content_hash, note: v.note, source: v.source ? JSON.parse(v.source) : null, createdAt: v.created_at, content: JSON.parse(v.content) };
  },
  // Content comes from the request body, or is copied out of a project the caller can read: {project, ref, page: <page id>} or
  // {project, ref, blocks: true | [uids]}. From someone else's project it needs the creator's consent (allowReuse), like a fork.
  _libraryContent(user, kind, { content, from }) {
    if (from !== undefined && content !== undefined) fail(422, 'invalid_content', 'Send content or from, not both.');
    if (from === undefined) return { content: cleanContent(kind, content), source: null };
    if (!isObj(from)) fail(422, 'invalid_content', 'from is {project, ref, page} or {project, ref, blocks}.');
    const { p, role } = this._access(from.project, user, 'viewer');
    if (role === 'public' && !p.allow_reuse) fail(403, 'reuse_not_allowed', 'The creator has not allowed reuse of this project, so nothing can be copied out of it.');
    const c = this._commitRow(p.id, this._resolve(p, from.ref || p.default_branch)), snap = this.readSnapshot(c.tree);
    assertPublishable(snap, `Version ${short(c.id)}`);
    let raw;
    if (kind === 'page') {
      const all = [...snap.book.default, ...Object.values(snap.book.months).flatMap((m) => m.pages)];
      const e = all.find((x) => x.id === from.page);
      if (!e) fail(404, 'not_found', `No page "${from.page}" at that version.`);
      raw = { type: e.type, options: e.options };
    } else {
      const want = Array.isArray(from.blocks) ? new Set(from.blocks) : null;
      if (from.blocks !== true && !want) fail(422, 'invalid_content', 'from.blocks is true (every block) or a list of block uids.');
      raw = { blocks: snap.day.blocks.filter((b) => !want || want.has(b.uid)) };
    }
    return { content: cleanContent(kind, raw), source: { project: p.id, projectName: p.name, commit: c.id } };
  },
  createLibraryItem(user, { kind, name, description = '', visibility = 'private', license = '', credit = '', content, from, note = '' } = {}) {
    const u = this._userRow(user);
    if (!['page', 'blocks'].includes(kind)) fail(422, 'invalid_kind', 'kind is "page" or "blocks".');
    const nm = text(name, 120, 'invalid_name', 'The name', { req: true }), desc = text(description, 1000, 'invalid_description', 'The description');
    if (!['private', 'public'].includes(visibility)) fail(422, 'invalid_visibility', 'Visibility is "private" or "public".');
    const terms = this._terms(typeof license === 'string' ? license : 1, typeof credit === 'string' ? credit : 1);
    const n = text(note, 500, 'invalid_note', 'The note');
    const { content: clean, source } = this._libraryContent(user, kind, { content, from });
    return tx(this.db, () => {
      const id = crypto.randomUUID(), now = this.now();
      this.db.prepare('INSERT INTO library_items (id, owner_id, kind, name, description, visibility, license, credit, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(id, u.id, kind, nm, desc, visibility, terms.license, terms.credit, now, now);
      this._addVersion(id, u, clean, source, n || 'First version');
      return this._itemView(this.db.prepare('SELECT * FROM library_items WHERE id = ?').get(id), { versions: true, viewer: u });
    });
  },
  _addVersion(itemId, u, clean, source, note) {
    const v = (this.db.prepare('SELECT MAX(version) AS v FROM library_versions WHERE item_id = ?').get(itemId).v || 0) + 1;
    this.db.prepare('INSERT INTO library_versions (item_id, version, content, content_hash, note, source, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(itemId, v, canonical(clean), hashOf(clean), note, source ? canonical(source) : null, u.id, this.now());
    return v;
  },
  addLibraryVersion(user, itemId, { content, from, note = '' } = {}) {
    const it = this._item(user, itemId, true), u = this._userRow(user);
    const n = text(note, 500, 'invalid_note', 'The note');
    const { content: clean, source } = this._libraryContent(user, it.kind, { content, from });
    return tx(this.db, () => {
      this._addVersion(it.id, u, clean, source, n);
      this.db.prepare('UPDATE library_items SET updated_at = ? WHERE id = ?').run(this.now(), it.id);
      return this._itemView(this.db.prepare('SELECT * FROM library_items WHERE id = ?').get(it.id), { versions: true, viewer: u });
    });
  },
  updateLibraryItem(user, itemId, patch = {}) {
    const it = this._item(user, itemId, true), set = {};
    if (patch.name !== undefined) set.name = text(patch.name, 120, 'invalid_name', 'The name', { req: true });
    if (patch.description !== undefined) set.description = text(patch.description, 1000, 'invalid_description', 'The description');
    if (patch.visibility !== undefined) { if (!['private', 'public'].includes(patch.visibility)) fail(422, 'invalid_visibility', 'Visibility is "private" or "public".'); set.visibility = patch.visibility; }
    if (patch.license !== undefined || patch.credit !== undefined) { const t = this._terms(patch.license ?? it.license, patch.credit ?? it.credit); set.license = t.license; set.credit = t.credit; }
    const keys = Object.keys(set);
    if (keys.length) this.db.prepare(`UPDATE library_items SET ${keys.map((k) => `${k} = ?`).join(', ')}, updated_at = ? WHERE id = ?`).run(...keys.map((k) => set[k]), this.now(), it.id);
    return this._itemView(this.db.prepare('SELECT * FROM library_items WHERE id = ?').get(it.id), { versions: true, viewer: user });
  },
  // Deleting an item never touches the books it was copied into: the copy is theirs, and the attribution link keeps its own credit.
  deleteLibraryItem(user, itemId) {
    const it = this._item(user, itemId, true);
    this.db.prepare('DELETE FROM library_items WHERE id = ?').run(it.id);
    return { deleted: true };
  },

  // ======================= inserting by copy =======================
  // Copies one library version into a project as a NEW commit on a branch: a page gets a fresh id, blocks get fresh uids. The copy is
  // plain book content (it belongs to the book from then on); the link to its source (item, version, credit) is recorded apart, so the
  // book shows where it came from and which newer version exists, and nothing changes in the book unless its owner inserts again.
  insertFromLibrary(user, id, { item, version, branch, expectedHead, message, scope = 'default', after } = {}) {
    const { p } = this._access(id, user, 'editor');
    const u = this._userRow(user);
    if (typeof expectedHead !== 'string' || !expectedHead) fail(422, 'expected_head_required', 'Send expectedHead: the commit you last saw at the tip of the branch.');
    const it = this._item(user, item);
    const vnum = version === undefined ? this.db.prepare('SELECT MAX(version) AS v FROM library_versions WHERE item_id = ?').get(it.id).v : version;
    const v = Number.isInteger(vnum) ? this.db.prepare('SELECT * FROM library_versions WHERE item_id = ? AND version = ?').get(it.id, vnum) : null;
    if (!v) fail(404, 'not_found', 'No such version.');
    const content = JSON.parse(v.content);
    if (hashOf(content) !== v.content_hash) fail(500, 'corrupt_object', 'A stored library version does not match its hash.');
    const clean = cleanContent(it.kind, content); // forbidden content is never reusable, even if it somehow got stored
    if (scope !== 'default' && !(typeof scope === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(scope))) fail(422, 'invalid_scope', 'scope is "default" or a month like 2027-02.');
    const owner = this.db.prepare('SELECT display_name FROM users WHERE id = ?').get(it.owner_id);
    return tx(this.db, () => {
      const br = this._headRow(p, branch || p.default_branch);
      this._checkHead(br, expectedHead);
      const headC = this.db.prepare('SELECT * FROM commits WHERE id = ?').get(br.head_commit_id);
      const snap = this.readSnapshot(headC.tree), next = structuredClone(snap);
      let target;
      if (it.kind === 'page') {
        const list = scope === 'default' ? next.book.default : (next.book.months[scope] ||= { pages: structuredClone(next.book.default) }).pages;
        const taken = new Set(list.flatMap((e) => [e.id, ...(e.type === 'weeks' ? [...(e.options.month || []), ...(e.options.week || [])].map((x) => x.id) : [])]));
        let pid; do pid = `${clean.type}.lib-${crypto.randomBytes(3).toString('hex')}`; while (taken.has(pid) || !REPEAT_ID.test(pid));
        const at = after === undefined ? list.length : list.findIndex((e) => e.id === after) + 1;
        if (after !== undefined && at === 0) fail(404, 'not_found', `No page "${after}" in that list.`);
        list.splice(at, 0, { id: pid, type: clean.type, on: true, options: structuredClone(clean.options) });
        target = { scope, pageId: pid };
      } else {
        if (next.day.grid) fail(422, 'grid_layout', 'This book\'s day page uses the Grid layout; switch it to the flow layout before inserting a block layout.');
        const taken = new Set(next.day.blocks.map((b) => b.uid)), uids = [];
        const blocks = clean.blocks.map((b) => { const o = structuredClone(b); o.uid = newUid(o.type, taken); uids.push(o.uid); return o; });
        const dupe = blocks.find((b) => TYPES[b.type].single && next.day.blocks.some((x) => x.type === b.type));
        if (dupe) fail(422, 'cannot_insert', `The page already has a ${TYPES[dupe.type].name} block, and it can only be there once.`);
        const i = next.day.blocks.findIndex((b) => b.type === 'actions'); // before the day's own closing blocks, like the editor's "add block"
        next.day.blocks.splice(i < 0 ? next.day.blocks.length : i, 0, ...blocks);
        target = { uids };
      }
      let ser;
      try { ser = serializeSnapshot(next, snap); } catch (e) { fail(422, 'cannot_insert', `That cannot go into this book: ${e.message}`, e.details); }
      if (it.kind === 'blocks' && target.uids.some((x) => !ser.day.blocks.some((b) => b.uid === x))) fail(422, 'cannot_insert', 'That layout does not fit this page.');
      const msg = this._message(message || `Add ${it.kind === 'page' ? 'page' : 'blocks'} "${it.name}" from ${owner.display_name}'s library (version ${v.version})`);
      const r = this._writeCommit(p, u, br, headC, ser, msg);
      const lid = crypto.randomUUID();
      this.db.prepare('INSERT INTO reuse_links (id, project_id, item_id, version, content_hash, kind, item_name, owner_name, license, credit, target, commit_id, inserted_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(lid, p.id, it.id, v.version, v.content_hash, it.kind, it.name, owner.display_name, it.license, it.credit, canonical(target), r.commit.id, u.id, this.now());
      return { ...r, inserted: target, link: this._linkView(this.db.prepare('SELECT * FROM reuse_links WHERE id = ?').get(lid), user) };
    });
  },
  _linkView(l, user) {
    const it = this.db.prepare('SELECT * FROM library_items WHERE id = ?').get(l.item_id);
    const visible = it && (it.visibility === 'public' || (user && it.owner_id === user.id)); // never reveal a private item's existence
    const latest = visible ? this.db.prepare('SELECT MAX(version) AS v FROM library_versions WHERE item_id = ?').get(it.id).v : null;
    return {
      id: l.id, kind: l.kind, target: JSON.parse(l.target), commit: l.commit_id,
      source: { itemId: visible ? l.item_id : null, name: l.item_name, owner: l.owner_name, license: l.license, credit: l.credit, version: l.version, hash: l.content_hash },
      latestVersion: latest, updateAvailable: latest !== null && latest > l.version, createdAt: l.created_at,
    };
  },
  // Where a book's reused pages came from: the attribution a book should show (credit lines) and which have a newer version.
  listReuse(user, id) {
    const { p } = this._access(id, user);
    return this.db.prepare('SELECT * FROM reuse_links WHERE project_id = ? ORDER BY created_at, rowid').all(p.id).map((l) => this._linkView(l, user));
  },
};
