// G3: releases (named, immutable, public-safe snapshots) and reusable pages (a user's library, inserted by copy with attribution).
// Sample data only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { StudioError } from '../src/db.mjs';
import { toObjects } from '../src/snapshot.mjs';
import { fresh, project, serve, withBlock } from './helpers.mjs';

const code = (fn, status, c) => assert.throws(fn, (e) => e instanceof StudioError && e.status === status && (!c || e.code === c), `expected ${status} ${c || ''}`);
const head = (s, u, id, branch) => s.head(u, id, branch).commit.id;

// Write a commit whose snapshot carries forbidden content straight into the store, as a bug or a tampered database would.
function plant(t, p, u, mutate) {
  const hc = t.db.prepare('SELECT head_commit_id AS h FROM branches WHERE project_id = ? AND name = ?').get(p.id, 'main').h;
  const snap = t.studio.readSnapshot(t.db.prepare('SELECT tree FROM commits WHERE id = ?').get(hc).tree);
  mutate(snap);
  const { objects, tree } = toObjects(snap);
  t.studio._storeObjects(objects);
  const row = t.db.prepare('SELECT id, display_name FROM users WHERE id = ?').get(u.id);
  const cid = t.studio._insertCommit(p, { tree, parents: [hc], u: row, message: 'Planted' });
  t.db.prepare('UPDATE branches SET head_commit_id = ? WHERE project_id = ? AND name = ?').run(cid, p.id, 'main');
  return cid;
}

test('releases: create, list, get, export; numbered, named, with notes and a manifest that matches the commit', () => {
  const t = fresh(), sam = t.user('sam'), pr = project(t.studio, sam, { visibility: 'public' });
  const h1 = head(t.studio, sam, pr.id);
  const r1 = t.studio.createRelease(sam, pr.id, { name: 'v1.0', notes: 'First print run.' });
  assert.equal(r1.number, 1); assert.equal(r1.commit.id, h1); assert.equal(r1.notes, 'First print run.');
  assert.equal(r1.manifest.commit, h1); assert.equal(r1.manifest.print.trim, 'small');
  assert.ok(r1.manifest.files['content/book.json'] && r1.manifest.files['content/daypage.json']);
  // later edits never touch it
  const day = withBlock(t.studio.head(sam, pr.id).snapshot.day, 'checks', { title: 'Habits', labels: ['Stretch'] });
  const c2 = t.studio.commit(sam, pr.id, { expectedHead: h1, message: 'Add habits', snapshot: { day } }).commit.id;
  const r2 = t.studio.createRelease(sam, pr.id, { name: 'v1.1', commit: c2 });
  assert.equal(r2.number, 2);
  assert.deepEqual(t.studio.listReleases(null, pr.id).map((r) => r.name), ['v1.1', 'v1.0']);
  const g1 = t.studio.getRelease(null, pr.id, 'v1.0');
  assert.equal(g1.commit.id, h1); assert.ok(g1.verified.ok); assert.equal(t.studio.getRelease(null, pr.id, '1').name, 'v1.0'); // by number too
  const ex = t.studio.exportRelease(null, pr.id, 'v1.0');
  assert.equal(ex.snapshot.day.blocks.some((b) => b.type === 'checks'), false, 'the release is the old version');
  assert.equal(t.studio.exportRelease(null, pr.id, 'v1.1').snapshot.day.blocks.some((b) => b.type === 'checks'), true);
  assert.deepEqual(Object.keys(ex.files).sort(), ['content/book.json', 'content/daypage.json']);
  assert.equal(ex.manifest.snapshotHash, g1.manifest.snapshotHash);
  // the same name, an invalid name, a number as a name, a missing commit
  code(() => t.studio.createRelease(sam, pr.id, { name: 'v1.0' }), 409, 'release_exists');
  code(() => t.studio.createRelease(sam, pr.id, { name: 'V1.0' }), 409, 'release_exists'); // names are case-insensitive
  for (const bad of ['', '12', 'has space', '../x', 'x'.repeat(41), undefined, 5]) code(() => t.studio.createRelease(sam, pr.id, { name: bad }), 422, 'invalid_release_name');
  code(() => t.studio.createRelease(sam, pr.id, { name: 'v9', commit: 'abcdef1234' }), 404);
  code(() => t.studio.getRelease(sam, pr.id, 'nope'), 404);
});

test('releases are immutable: no update, no delete (SQL), no API route; only deleting the whole project removes them', async () => {
  const t = await serve();
  try {
    const sam = await t.signup('sam');
    const pr = (await t.call('POST', '/api/projects', { token: sam, body: { name: 'Book', visibility: 'public' } })).body.project;
    const url = `/api/projects/${pr.id}/releases`;
    const mk = await t.call('POST', url, { token: sam, body: { name: 'v1', notes: 'Final.' } });
    assert.equal(mk.status, 201);
    assert.throws(() => t.db.prepare("UPDATE releases SET notes = 'changed'").run(), /immutable/);
    assert.throws(() => t.db.prepare('DELETE FROM releases').run(), /immutable/);
    for (const m of ['PATCH', 'PUT', 'DELETE']) assert.equal((await t.call(m, `${url}/v1`, { token: sam, body: { notes: 'x' } })).status, 404, `${m} has no route`);
    assert.equal((await t.call('DELETE', url, { token: sam })).status, 404);
    assert.equal((await t.call('GET', `${url}/v1`)).body.release.notes, 'Final.');
    assert.equal((await t.call('DELETE', `/api/projects/${pr.id}`, { token: sam })).status, 200); // the cascade is allowed
    assert.equal(t.db.prepare('SELECT COUNT(*) AS n FROM releases').get().n, 0);
  } finally { await t.close(); }
});

test('releases only freeze public-safe snapshots: a version with forbidden content cannot be released or exported', () => {
  const t = fresh(), sam = t.user('sam'), pr = project(t.studio, sam);
  const good = t.studio.createRelease(sam, pr.id, { name: 'v1' });
  for (const [label, mutate] of [
    ['a calendar link', (s) => { s.meta.description = 'Sync: webcal://example.com/me.ics'; }],
    ['an email address', (s) => { s.meta.subtitle = 'write to me@example.com'; }],
    ['a profile secret key', (s) => { s.print.location = { lat: 1, lon: 2 }; }],
    ['a private page', (s) => { s.book.default[0].options.private = 'my notes'; }],
    ['a personal pack reference', (s) => { s.meta.packs = [{ id: 'my-support', kind: 'support', version: '1.0.0', sha256: 'a'.repeat(64) }]; }],
    ['filled-in entries', (s) => { s.day.entries = [{ text: 'dear diary' }]; }],
  ]) {
    const t2 = fresh(), o = t2.user('olu'), p2 = project(t2.studio, o);
    plant(t2, p2, o, mutate);
    code(() => t2.studio.createRelease(o, p2.id, { name: 'bad' }), 422, undefined);
    assert.equal(t2.studio.listReleases(o, p2.id).length, 0, `${label}: nothing was written`);
  }
  // a release made before the content went bad is refused on export (nothing leaves)
  const bad = plant(t, pr, sam, (s) => { s.meta.description = 'me@example.com'; });
  t.db.exec('DROP TRIGGER releases_no_update');
  t.db.prepare('UPDATE releases SET commit_id = ?, tree = (SELECT tree FROM commits WHERE id = ?) WHERE id = ?').run(bad, bad, good.id);
  assert.throws(() => t.studio.exportRelease(sam, pr.id, 'v1'), (e) => e instanceof StudioError && ['not_forkable', 'release_corrupt'].includes(e.code));
  // notes and a commit message are scanned too
  const t3 = fresh(), a = t3.user('ann'), p3 = project(t3.studio, a);
  code(() => t3.studio.createRelease(a, p3.id, { name: 'v1', notes: 'Ask me at ann@example.com' }), 422, 'forbidden_content');
  code(() => t3.studio.createRelease(a, p3.id, { name: 'v1', notes: 'x'.repeat(2001) }), 422, 'invalid_notes');
});

test('releases: tamper detection (a changed manifest or tree is reported)', () => {
  const t = fresh(), sam = t.user('sam'), pr = project(t.studio, sam), r = t.studio.createRelease(sam, pr.id, { name: 'v1' });
  assert.ok(t.studio.getRelease(sam, pr.id, 'v1').verified.ok);
  t.db.exec('DROP TRIGGER releases_no_update');
  t.db.prepare("UPDATE releases SET manifest = replace(manifest, '\"edition\":1', '\"edition\":2') WHERE id = ?").run(r.id);
  const v = t.studio.getRelease(sam, pr.id, 'v1').verified;
  assert.equal(v.ok, false); assert.equal(v.manifestOk, false);
  assert.throws(() => t.studio.exportRelease(sam, pr.id, 'v1'), (e) => e.code === 'release_corrupt');
});

test('releases: auth matches projects. Guests read public projects and never write; a private project is 404; only the owner releases', async () => {
  const t = await serve();
  try {
    const sam = await t.signup('sam'), eve = await t.signup('eve'), ed = await t.signup('edd');
    const pub = (await t.call('POST', '/api/projects', { token: sam, body: { name: 'Public Book', visibility: 'public' } })).body.project;
    const priv = (await t.call('POST', '/api/projects', { token: sam, body: { name: 'Private Book' } })).body.project;
    await t.call('PUT', `/api/projects/${pub.id}/members/edd`, { token: sam, body: { role: 'editor' } });
    for (const p of [pub, priv]) assert.equal((await t.call('POST', `/api/projects/${p.id}/releases`, { token: sam, body: { name: 'v1', notes: 'n' } })).status, 201);
    const u = (p, s) => `/api/projects/${p.id}/releases${s}`;
    // guest and stranger: reads work on the public one
    for (const token of [undefined, eve]) {
      assert.equal((await t.call('GET', u(pub, ''), { token })).body.releases.length, 1);
      assert.equal((await t.call('GET', u(pub, '/v1'), { token })).body.release.verified.ok, true);
      assert.equal((await t.call('GET', u(pub, '/v1/export'), { token })).status, 200);
    }
    // writes: guest 401, stranger 403, editor 403, owner 201
    assert.equal((await t.call('POST', u(pub, ''), { body: { name: 'v2' } })).status, 401);
    assert.equal((await t.call('POST', u(pub, ''), { token: eve, body: { name: 'v2' } })).status, 403);
    assert.equal((await t.call('POST', u(pub, ''), { token: ed, body: { name: 'v2' } })).status, 403);
    assert.equal((await t.call('POST', u(pub, ''), { token: sam, body: { name: 'v2' } })).status, 201);
    // the private project does not exist for anyone else
    for (const token of [undefined, eve]) for (const s of ['', '/v1', '/v1/export']) assert.equal((await t.call('GET', u(priv, s), { token })).status, 404, `private ${s}`);
    assert.equal((await t.call('POST', u(priv, ''), { token: eve, body: { name: 'v2' } })).status, 404);
    assert.equal((await t.call('GET', u(priv, ''), { token: sam })).body.releases.length, 1);
    // going private later hides them again
    await t.call('PATCH', `/api/projects/${pub.id}`, { token: sam, body: { visibility: 'private' } });
    assert.equal((await t.call('GET', u(pub, '/v1')).then((r) => r.status)), 404);
  } finally { await t.close(); }
});

// ---------- reusable pages ----------
const PAGE = { type: 'collection', options: { title: 'Books to read' } };
const BLOCKS = { blocks: [{ uid: 'habits', type: 'checks', on: true, title: 'Habits', labels: ['Stretch', 'Water'] }] };

test('library: save a page and a block layout, version them, insert by copy with attribution and a version link', () => {
  const t = fresh(), amy = t.user('amy'), ben = t.user('ben');
  const page = t.studio.createLibraryItem(amy, { kind: 'page', name: 'Reading list', visibility: 'public', license: 'CC BY 4.0', credit: 'Amy', content: PAGE });
  assert.equal(page.latest, 1); assert.equal(page.owner.name, 'Amy');
  const blocks = t.studio.createLibraryItem(amy, { kind: 'blocks', name: 'Habit boxes', visibility: 'public', content: BLOCKS });
  assert.equal(blocks.versions.length, 1);
  const pr = project(t.studio, ben), h = head(t.studio, ben, pr.id);
  // page: copied in with a fresh id
  const ins = t.studio.insertFromLibrary(ben, pr.id, { item: page.id, expectedHead: h });
  assert.equal(ins.unchanged, false);
  const book = t.studio.head(ben, pr.id).snapshot.book.default;
  const copy = book.find((e) => e.id === ins.inserted.pageId);
  assert.ok(copy); assert.equal(copy.type, 'collection'); assert.equal(copy.options.title, 'Books to read');
  assert.match(ins.inserted.pageId, /^collection\.lib-[0-9a-f]{6}$/);
  // blocks: copied in with fresh uids, before the closing blocks
  const ins2 = t.studio.insertFromLibrary(ben, pr.id, { item: blocks.id, expectedHead: ins.commit.id });
  const day = t.studio.head(ben, pr.id).snapshot.day.blocks;
  assert.deepEqual(ins2.inserted.uids.length, 1); assert.notEqual(ins2.inserted.uids[0], 'habits');
  const b = day.find((x) => x.uid === ins2.inserted.uids[0]);
  assert.deepEqual(b.labels, ['Stretch', 'Water']); assert.ok(day.findIndex((x) => x.uid === b.uid) < day.findIndex((x) => x.type === 'actions'));
  // attribution and version links
  let reuse = t.studio.listReuse(ben, pr.id);
  assert.equal(reuse.length, 2);
  assert.deepEqual([reuse[0].source.name, reuse[0].source.owner, reuse[0].source.version, reuse[0].source.license, reuse[0].source.credit], ['Reading list', 'Amy', 1, 'CC BY 4.0', 'Amy']);
  assert.equal(reuse[0].updateAvailable, false); assert.equal(reuse[0].commit, ins.commit.id);
  assert.match(t.studio.log(ben, pr.id).commits[1].message, /Reading list.*Amy.*version 1/);
  // a new version: the book is untouched, the link says an update exists, the old version stays readable and immutable
  const v2 = t.studio.addLibraryVersion(amy, page.id, { content: { type: 'collection', options: { title: 'Books, 2027' } }, note: 'New title' });
  assert.equal(v2.latest, 2); assert.equal(v2.versions.length, 2);
  assert.equal(t.studio.head(ben, pr.id).snapshot.book.default.find((e) => e.id === ins.inserted.pageId).options.title, 'Books to read');
  reuse = t.studio.listReuse(ben, pr.id);
  assert.equal(reuse[0].updateAvailable, true); assert.equal(reuse[0].latestVersion, 2);
  assert.equal(t.studio.getLibraryVersion(null, page.id, 1).content.options.title, 'Books to read');
  assert.throws(() => t.db.prepare("UPDATE library_versions SET content = '{}'").run(), /immutable/);
  assert.throws(() => t.db.prepare('DELETE FROM library_versions').run(), /immutable/);
  // inserting version 1 explicitly, after a given page, into a month's own list
  const i3 = t.studio.insertFromLibrary(ben, pr.id, { item: page.id, version: 1, expectedHead: head(t.studio, ben, pr.id), scope: '2026-11', after: 'title' });
  assert.equal(t.studio.head(ben, pr.id).snapshot.book.months['2026-11'].pages[1].id, i3.inserted.pageId);
  // the source owner deleting the item leaves the copies and the credit
  t.studio.deleteLibraryItem(amy, page.id);
  const left = t.studio.listReuse(ben, pr.id).filter((l) => l.kind === 'page');
  assert.equal(left.length, 2); assert.equal(left[0].source.owner, 'Amy'); assert.equal(left[0].source.itemId, null);
  assert.ok(t.studio.head(ben, pr.id).snapshot.book.default.some((e) => e.id === ins.inserted.pageId));
});

test('library: concurrency, rules of the book, and nothing half-written', () => {
  const t = fresh(), amy = t.user('amy'), pr = project(t.studio, amy);
  const page = t.studio.createLibraryItem(amy, { kind: 'page', name: 'Reading list', content: PAGE });
  const h = head(t.studio, amy, pr.id);
  t.studio.insertFromLibrary(amy, pr.id, { item: page.id, expectedHead: h });
  code(() => t.studio.insertFromLibrary(amy, pr.id, { item: page.id, expectedHead: h }), 409, 'head_moved'); // stale head
  code(() => t.studio.insertFromLibrary(amy, pr.id, { item: page.id }), 422, 'expected_head_required');
  const cur = head(t.studio, amy, pr.id);
  code(() => t.studio.insertFromLibrary(amy, pr.id, { item: page.id, expectedHead: cur, version: 9 }), 404);
  code(() => t.studio.insertFromLibrary(amy, pr.id, { item: page.id, expectedHead: cur, scope: 'next-year' }), 422, 'invalid_scope');
  code(() => t.studio.insertFromLibrary(amy, pr.id, { item: page.id, expectedHead: cur, after: 'nope' }), 404);
  // a single-instance block cannot be added twice, and a grid layout is refused, both without writing
  const single = t.studio.createLibraryItem(amy, { kind: 'blocks', name: 'Care', content: { blocks: [{ uid: 'c', type: 'spoons', on: true }] } });
  code(() => t.studio.insertFromLibrary(amy, pr.id, { item: single.id, expectedHead: cur }), 422, 'cannot_insert');
  assert.equal(head(t.studio, amy, pr.id), cur);
  // a singleton page the book already has
  const theme = t.studio.createLibraryItem(amy, { kind: 'page', name: 'Theme', content: { type: 'theme' } });
  code(() => t.studio.insertFromLibrary(amy, pr.id, { item: theme.id, expectedHead: cur }), 422, 'cannot_insert');
  assert.equal(head(t.studio, amy, pr.id), cur);
});

test('library: forbidden content is never reusable (saving, copying out of a project, inserting)', () => {
  const t = fresh(), amy = t.user('amy');
  for (const [label, content] of [
    ['a calendar link', { type: 'notes', options: { title: 'webcal://x.example/me.ics' } }],
    ['an email address', { type: 'notes', options: { title: 'me@example.com' } }],
    ['a protected page', { type: 'safety', options: {} }],
    ['a protected page (Support)', { type: 'support' }],
    ['a module page (Trans support)', { type: 'trans_support' }],
    ['the weeks group', { type: 'weeks', options: {} }],
    ['a month-level page', { type: 'month_cal' }],
    ['an unknown page', { type: 'nope' }],
    ['an unknown field', { type: 'notes', options: {}, entries: ['dear diary'] }],
    ['a private key', { type: 'notes', options: { person: 'Me' } }],
    ['an unknown option', { type: 'notes', options: { secret: 'x' } }],
    ['a too long title', { type: 'notes', options: { title: 'x'.repeat(41) } }],
  ]) code(() => t.studio.createLibraryItem(amy, { kind: 'page', name: 'X', content }), 422, undefined);
  for (const content of [
    { blocks: [{ uid: 'a', type: 'checks', on: true, title: 'ics: https://x.example/c.ics' }] },
    { blocks: [{ uid: 'a', type: 'checks', on: true, title: 'Mail me@example.com' }] },
    { blocks: [{ uid: 'a', type: 'nope' }] },
    { blocks: [{ uid: 'a', type: 'body' }] }, // the locked Writing space is not reusable
    { blocks: [] },
    { blocks: [{ uid: 'a', type: 'checks', on: true }], answers: [1] },
    { blocks: [{ uid: 'a', type: 'checks', on: true, entries: ['x'] }] },
  ]) code(() => t.studio.createLibraryItem(amy, { kind: 'blocks', name: 'X', content }), 422, undefined);
  for (const bad of [{ name: 'a@b.example' }, { description: 'webcal://x' }, { credit: 'x@y.example' }, { license: 'x'.repeat(501) }, { kind: 'poem' }, { visibility: 'world' }, { name: '' }]) {
    code(() => t.studio.createLibraryItem(amy, { kind: 'page', name: 'Ok', content: PAGE, ...bad }), 422, undefined);
  }
  assert.equal(t.studio.listLibrary(amy).length, 0, 'nothing was saved');
  // copying out of a project: a published version holding forbidden content is refused; the allowlist keeps a clean one clean
  const pr = project(t.studio, amy);
  const planted = plant(t, pr, amy, (s) => { s.book.default[0].options.private = 'x'; });
  code(() => t.studio.createLibraryItem(amy, { kind: 'page', name: 'Title', from: { project: pr.id, ref: planted, page: 'title' } }), 422, 'not_forkable');
  assert.equal(t.studio.listLibrary(amy).length, 0);
  // a stored version that went bad is refused at insert
  const ok = t.studio.createLibraryItem(amy, { kind: 'page', name: 'Reading list', content: PAGE });
  t.db.exec('DROP TRIGGER library_versions_no_update');
  const evil = { type: 'notes', options: { title: 'me@example.com' } };
  t.db.prepare('UPDATE library_versions SET content = ?, content_hash = ?').run(JSON.stringify(evil), 'x'.repeat(64));
  const pr2 = project(t.studio, amy);
  assert.throws(() => t.studio.insertFromLibrary(amy, pr2.id, { item: ok.id, expectedHead: head(t.studio, amy, pr2.id) }), (e) => e instanceof StudioError && e.status >= 422);
  assert.equal(t.studio.head(amy, pr2.id).snapshot.book.default.length, 16);
});

test('library: copy a page and blocks out of a project (consent required from other people\'s projects)', () => {
  const t = fresh(), amy = t.user('amy'), ben = t.user('ben');
  const mine = project(t.studio, amy, { visibility: 'public', allowReuse: true });
  const withPage = t.studio.commit(amy, mine.id, { expectedHead: head(t.studio, amy, mine.id), message: 'Add a collection and habits', snapshot: {
    book: (() => { const b = structuredClone(t.studio.head(amy, mine.id).snapshot.book); b.default.splice(2, 0, { id: 'collection.reads', type: 'collection', on: true, options: { title: 'Reads' } }); return b; })(),
    day: withBlock(t.studio.head(amy, mine.id).snapshot.day, 'checks', { title: 'Habits', labels: ['Stretch'] }) } });
  const page = t.studio.createLibraryItem(ben, { kind: 'page', name: 'Reads', from: { project: mine.id, ref: withPage.commit.id, page: 'collection.reads' } });
  assert.equal(t.studio.getLibraryVersion(ben, page.id, 1).content.options.title, 'Reads');
  assert.equal(t.studio.getLibraryVersion(ben, page.id, 1).source.project, mine.id);
  const bl = t.studio.createLibraryItem(ben, { kind: 'blocks', name: 'Habits', from: { project: mine.id, ref: 'main', blocks: ['checks-t1'] } });
  assert.deepEqual(t.studio.getLibraryVersion(ben, bl.id, 1).content.blocks.map((b) => b.type), ['checks']);
  assert.equal(t.studio.getLibraryVersion(ben, bl.id, 1).content.blocks[0].col, undefined);
  code(() => t.studio.createLibraryItem(ben, { kind: 'page', name: 'x', from: { project: mine.id, ref: 'main', page: 'nope' } }), 404);
  code(() => t.studio.createLibraryItem(ben, { kind: 'page', name: 'x', content: PAGE, from: { project: mine.id, page: 'title' } }), 422);
  // reuse switched off: ben (a stranger) cannot copy out; amy still can
  t.studio.updateProject(amy, mine.id, { allowReuse: false });
  code(() => t.studio.createLibraryItem(ben, { kind: 'page', name: 'x', from: { project: mine.id, ref: 'main', page: 'title' } }), 403, 'reuse_not_allowed');
  assert.ok(t.studio.createLibraryItem(amy, { kind: 'page', name: 'Mine', from: { project: mine.id, ref: 'main', page: 'collection.reads' } }));
  // a private project of someone else is simply not there
  const priv = project(t.studio, amy);
  code(() => t.studio.createLibraryItem(ben, { kind: 'page', name: 'x', from: { project: priv.id, ref: 'main', page: 'title' } }), 404);
});

test('library over HTTP: guests read public items and never write; private items are 404; only the owner changes an item; inserting needs the editor role', async () => {
  const t = await serve();
  try {
    const amy = await t.signup('amy'), ben = await t.signup('ben'), eve = await t.signup('eve');
    const pub = (await t.call('POST', '/api/library', { token: amy, body: { kind: 'page', name: 'Reading list', visibility: 'public', content: PAGE } })).body.item;
    const priv = (await t.call('POST', '/api/library', { token: amy, body: { kind: 'blocks', name: 'Private blocks', content: BLOCKS } })).body.item;
    assert.equal((await t.call('POST', '/api/library', { body: { kind: 'page', name: 'x', content: PAGE } })).status, 401);
    // listing: guests and ?public=1 see only the public one; the owner's own listing has both
    assert.deepEqual((await t.call('GET', '/api/library')).body.items.map((i) => i.name), ['Reading list']);
    assert.deepEqual((await t.call('GET', '/api/library?public=1', { token: amy })).body.items.map((i) => i.name), ['Reading list']);
    assert.equal((await t.call('GET', '/api/library', { token: amy })).body.items.length, 2);
    assert.equal((await t.call('GET', '/api/library', { token: ben })).body.items.length, 0);
    // reading
    for (const token of [undefined, ben]) {
      assert.equal((await t.call('GET', `/api/library/${pub.id}`, { token })).body.item.versions.length, 1);
      assert.equal((await t.call('GET', `/api/library/${pub.id}/versions/1`, { token })).body.content.type, 'collection');
      assert.equal((await t.call('GET', `/api/library/${priv.id}`, { token })).status, 404);
      assert.equal((await t.call('GET', `/api/library/${priv.id}/versions/1`, { token })).status, 404);
    }
    // writes
    for (const [m, s, body] of [['PATCH', '', { name: 'x' }], ['DELETE', ''], ['POST', '/versions', { content: PAGE }]]) {
      assert.equal((await t.call(m, `/api/library/${pub.id}${s}`, { body })).status, 401, `guest ${m}`);
      assert.equal((await t.call(m, `/api/library/${pub.id}${s}`, { token: ben, body })).status, 403, `stranger ${m}`);
      assert.equal((await t.call(m, `/api/library/${priv.id}${s}`, { token: ben, body })).status, 404, `private ${m}`);
    }
    assert.equal((await t.call('POST', `/api/library/${pub.id}/versions`, { token: amy, body: { content: { type: 'collection', options: { title: 'v2' } } } })).status, 201);
    assert.equal((await t.call('PATCH', `/api/library/${pub.id}`, { token: amy, body: { credit: 'Amy' } })).body.item.credit, 'Amy');
    assert.equal((await t.call('POST', '/api/library', { token: amy, body: { kind: 'page', name: 'Bad', content: { type: 'safety' } } })).status, 422);
    // inserting: guests 401, a viewer 403, a stranger on a public project 403, an editor 201; a private item cannot be inserted by others
    const bp = (await t.call('POST', '/api/projects', { token: ben, body: { name: 'Ben Book', visibility: 'public' } })).body.project;
    await t.call('PUT', `/api/projects/${bp.id}/members/eve`, { token: ben, body: { role: 'viewer' } });
    const h = (await t.call('GET', `/api/projects/${bp.id}/head`, { token: ben })).body.commit.id;
    const ins = `/api/projects/${bp.id}/insert`;
    assert.equal((await t.call('POST', ins, { body: { item: pub.id, expectedHead: h } })).status, 401);
    assert.equal((await t.call('POST', ins, { token: eve, body: { item: pub.id, expectedHead: h } })).status, 403);
    assert.equal((await t.call('POST', ins, { token: ben, body: { item: priv.id, expectedHead: h } })).status, 404);
    const ok = await t.call('POST', ins, { token: ben, body: { item: pub.id, expectedHead: h, version: 1 } });
    assert.equal(ok.status, 201); assert.equal(ok.body.link.source.owner, 'amy'); assert.equal(ok.body.link.updateAvailable, true);
    assert.equal((await t.call('POST', ins, { token: ben, body: { item: pub.id, expectedHead: h } })).status, 409);
    // the attribution is readable by guests on a public project; making the item private hides the item but not the credit
    let reuse = (await t.call('GET', `/api/projects/${bp.id}/reuse`)).body.reuse;
    assert.equal(reuse[0].source.name, 'Reading list'); assert.equal(reuse[0].source.itemId, pub.id);
    await t.call('PATCH', `/api/library/${pub.id}`, { token: amy, body: { visibility: 'private' } });
    reuse = (await t.call('GET', `/api/projects/${bp.id}/reuse`)).body.reuse;
    assert.equal(reuse[0].source.itemId, null); assert.equal(reuse[0].source.owner, 'amy'); assert.equal(reuse[0].latestVersion, null);
    assert.equal((await t.call('GET', `/api/library/${pub.id}`, { token: ben })).status, 404);
    // a private project's reuse list is 404 to others
    const pp = (await t.call('POST', '/api/projects', { token: ben, body: { name: 'Ben Private' } })).body.project;
    assert.equal((await t.call('GET', `/api/projects/${pp.id}/reuse`)).status, 404);
    assert.equal((await t.call('DELETE', `/api/library/${pub.id}`, { token: amy })).status, 200);
  } finally { await t.close(); }
});

test('releases and the library never carry private data into a snapshot: the existing allowlist is still enforced end to end', () => {
  const t = fresh(), amy = t.user('amy'), pr = project(t.studio, amy);
  const page = t.studio.createLibraryItem(amy, { kind: 'page', name: 'Reading list', content: PAGE });
  t.studio.insertFromLibrary(amy, pr.id, { item: page.id, expectedHead: head(t.studio, amy, pr.id) });
  const rel = t.studio.createRelease(amy, pr.id, { name: 'v1' });
  const ex = t.studio.exportRelease(amy, pr.id, 'v1');
  const text = JSON.stringify(ex);
  for (const word of ['@', '.ics', 'webcal', 'ICS_URLS', 'password', 'recovery']) assert.equal(text.includes(word), false, `the export has no "${word}"`);
  assert.equal(ex.snapshot.book.default.some((e) => e.type === 'collection'), true);
  assert.equal(rel.manifest.files['content/book.json'], ex.manifest.files['content/book.json']);
});
