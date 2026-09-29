// Commits, history, immutability, concurrency, restore, branches, drafts, diff. Straight against the core (no HTTP).
import test from 'node:test';
import assert from 'node:assert/strict';
import { fresh, project, withBlock } from './helpers.mjs';
import { Studio } from '../src/repo.mjs';
import { StudioError } from '../src/db.mjs';
import { hashOf } from '../src/canon.mjs';
import { autoPlace } from '../../journal/daypage.mjs';
import { journalFiles } from '../src/pipeline.mjs';

const code = (fn) => { try { fn(); } catch (e) { assert.ok(e instanceof StudioError, String(e)); return { status: e.status, code: e.code, details: e.details }; } assert.fail('expected an error'); };
function setup() {
  const t = fresh();
  const sam = t.user('sam');
  const p = project(t.studio, sam);
  const head = () => t.studio.head(sam, p.id).commit;
  const save = (message, snapshot, extra = {}) => t.studio.commit(sam, p.id, { branch: 'main', expectedHead: head().id, message, snapshot, ...extra });
  return { ...t, sam, p, head, save };
}

test('a project starts with one commit on main, no parents, and the default book and layout', () => {
  const { studio, sam, p } = setup();
  const { commit, snapshot } = studio.head(sam, p.id);
  assert.deepEqual(commit.parents, []);
  assert.equal(commit.author.name, 'Sam');
  assert.equal(snapshot.book.default[0].id, 'title');
  assert.equal(snapshot.day.blocks[0].uid, 'sky');
  assert.deepEqual(studio.listBranches(sam, p.id).map((b) => b.name), ['main']);
});

test('commit ancestry and hashing: id = hash of tree + parents + author + message + time; parents chain back to the first commit', () => {
  const { studio, sam, p, head, save } = setup();
  const first = head();
  const c2 = save('Add habits', { day: withBlock(studio.head(sam, p.id).snapshot.day, 'checks', { title: 'Habits' }) }).commit;
  const c3 = save('Rename', { meta: { ...studio.head(sam, p.id).snapshot.meta, title: 'Renamed' } }).commit;
  assert.deepEqual(c2.parents, [first.id]);
  assert.deepEqual(c3.parents, [c2.id]);
  for (const c of [first, c2, c3]) {
    assert.equal(c.id, hashOf({ v: 1, tree: c.tree, parents: c.parents, author: { id: c.author.id, name: c.author.name }, message: c.message, timestamp: c.createdAt }));
    assert.ok(studio.verify(sam, p.id, c.id).ok);
  }
  const log = studio.log(sam, p.id, {});
  assert.deepEqual(log.commits.map((c) => c.message), ['Rename', 'Add habits', 'Start the project']);
  assert.equal(log.total, 3);
  assert.notEqual(c2.tree, first.tree);
  // a prefix of the id finds the commit
  assert.equal(studio.getCommit(sam, p.id, c2.id.slice(0, 8)).commit.id, c2.id);
});

test('an identical snapshot makes no new commit', () => {
  const { studio, sam, p, head, save } = setup();
  const r = save('Nothing changed', studio.head(sam, p.id).snapshot);
  assert.equal(r.unchanged, true);
  assert.equal(studio.log(sam, p.id, {}).total, 1);
  assert.equal(head().message, 'Start the project');
});

test('immutability: commits and objects cannot be updated or deleted, even by SQL', () => {
  const { db, head, save } = setup();
  const c = save('Second', { meta: { title: 'Second', subtitle: '', slug: 'second', description: '' } }).commit;
  for (const sql of ["UPDATE commits SET message = 'edited'", 'DELETE FROM commits', "UPDATE objects SET body = '{}'", 'DELETE FROM objects']) {
    assert.throws(() => db.exec(sql), /immutable/, sql);
  }
  assert.equal(head().id, c.id);
});

test('tampering with stored content is detected', () => {
  const { db, studio, sam, p } = setup();
  db.exec('DROP TRIGGER objects_no_update');
  db.exec("UPDATE objects SET body = '{\"title\":\"forged\"}' WHERE kind = 'meta'");
  assert.equal(code(() => studio.head(sam, p.id)).code, 'corrupt_object');
});

test('concurrency: a stale expectedHead gets 409 and nothing is written', () => {
  const { studio, sam, p, head, save } = setup();
  const seen = head().id;
  save('Someone saves first', { meta: { title: 'A', subtitle: '', slug: 'a', description: '' } });
  const e = code(() => studio.commit(sam, p.id, { branch: 'main', expectedHead: seen, message: 'Late save', snapshot: { meta: { title: 'B', subtitle: '', slug: 'b', description: '' } } }));
  assert.equal(e.status, 409);
  assert.equal(e.code, 'head_moved');
  assert.equal(e.details.head, head().id);
  assert.equal(studio.head(sam, p.id).snapshot.meta.title, 'A');
  assert.equal(studio.log(sam, p.id, {}).total, 2);
  assert.equal(code(() => studio.commit(sam, p.id, { branch: 'main', message: 'x', snapshot: {} })).code, 'expected_head_required');
  assert.equal(code(() => save('   ', {})).code, 'message_required');
});

test('a failed commit is rolled back completely (no orphan objects, head unchanged)', () => {
  const { db, studio, sam, p, head } = setup();
  const before = db.prepare('SELECT COUNT(*) n FROM objects').get().n, h = head().id;
  const missing = { assets: [{ name: 'logo.png', hash: 'b'.repeat(64), mime: 'image/png', size: 4 }] };
  assert.equal(code(() => studio.commit(sam, p.id, { branch: 'main', expectedHead: h, message: 'with asset', snapshot: missing })).code, 'missing_asset');
  assert.equal(db.prepare('SELECT COUNT(*) n FROM objects').get().n, before);
  assert.equal(head().id, h);
});

test('restore makes a NEW commit with the old content; history is never rewritten', () => {
  const { studio, sam, p, head, save } = setup();
  const v1 = head();
  const day2 = withBlock(studio.head(sam, p.id).snapshot.day, 'checks', { title: 'Habits' });
  const v2 = save('Add habits', { day: day2 }).commit;
  const r = studio.restore(sam, p.id, { commit: v1.id, branch: 'main', expectedHead: v2.id });
  assert.equal(r.unchanged, false);
  assert.notEqual(r.commit.id, v1.id);
  assert.deepEqual(r.commit.parents, [v2.id]);
  assert.equal(r.commit.tree, v1.tree);
  assert.match(r.commit.message, /^Restore version/);
  assert.deepEqual(studio.log(sam, p.id, {}).commits.map((c) => c.id), [r.commit.id, v2.id, v1.id]);
  assert.equal(studio.getCommit(sam, p.id, v2.id).commit.tree, v2.tree); // the old commits are untouched
  assert.equal(studio.head(sam, p.id).snapshot.day.blocks.some((b) => b.uid === 'checks-t1'), false);
  // restoring the state we are already at does nothing; a stale head is a conflict
  assert.equal(studio.restore(sam, p.id, { commit: v1.id, branch: 'main', expectedHead: r.commit.id }).unchanged, true);
  assert.equal(code(() => studio.restore(sam, p.id, { commit: v1.id, branch: 'main', expectedHead: v2.id })).status, 409);
});

test('branches: create from head or from a commit, edit independently, switch = read that head, no duplicates or bad names', () => {
  const { studio, sam, p, head, save } = setup();
  const first = head();
  const main2 = save('Main change', { meta: { title: 'Main', subtitle: '', slug: 'main', description: '' } }).commit;
  studio.createBranch(sam, p.id, { name: 'try-purple', from: 'main' });
  studio.createBranch(sam, p.id, { name: 'old', from: first.id });
  const onBranch = studio.commit(sam, p.id, { branch: 'try-purple', expectedHead: main2.id, message: 'Try', snapshot: { day: withBlock(studio.head(sam, p.id).snapshot.day, 'scale', {}) } }).commit;
  assert.equal(studio.head(sam, p.id, 'main').commit.id, main2.id); // main did not move
  assert.equal(studio.head(sam, p.id, 'try-purple').commit.id, onBranch.id);
  assert.equal(studio.head(sam, p.id, 'old').commit.id, first.id);
  assert.deepEqual(studio.listBranches(sam, p.id).map((b) => b.name), ['main', 'old', 'try-purple']);
  assert.equal(code(() => studio.createBranch(sam, p.id, { name: 'old' })).status, 409);
  for (const bad of ['', 'a b', '../x', '.hidden', 'x..y', 'x/', 'x.lock']) assert.equal(code(() => studio.createBranch(sam, p.id, { name: bad })).code, 'invalid_branch_name', bad);
  assert.equal(code(() => studio.head(sam, p.id, 'nope')).status, 404);
  assert.equal(code(() => studio.deleteBranch(sam, p.id, 'main')).status, 409);
  studio.deleteBranch(sam, p.id, 'old');
  assert.equal(studio.getCommit(sam, p.id, first.id).commit.id, first.id); // its commits are still there
  // the branch log follows the branch
  assert.equal(studio.log(sam, p.id, { branch: 'try-purple' }).total, 3);
  assert.equal(studio.log(sam, p.id, { branch: 'main' }).total, 2);
});

test('drafts: separate from commits, per user and branch, promoted to a commit or discarded', () => {
  const { studio, sam, p, head, user } = setup();
  const kim = user('kim'); studio.setMember(sam, p.id, 'kim', 'editor');
  const h0 = head().id;
  assert.equal(studio.getDraft(sam, p.id, 'main').draft, null);
  const d1 = studio.saveDraft(sam, p.id, 'main', { snapshot: { day: withBlock(studio.head(sam, p.id).snapshot.day, 'checks', { title: 'Habits' }) } });
  assert.equal(d1.rev, 1); assert.equal(d1.base, h0); assert.equal(d1.behind, false);
  assert.equal(studio.log(sam, p.id, {}).total, 1); // autosave is not a version
  assert.equal(head().id, h0);
  assert.ok(studio.getDraft(sam, p.id, 'main').draft.snapshot.day.blocks.some((b) => b.uid === 'checks-t1'));
  assert.equal(studio.getDraft(kim, p.id, 'main').draft, null); // another user's draft is their own
  // concurrency on the draft itself
  const d2 = studio.saveDraft(sam, p.id, 'main', { rev: 1, base: h0, snapshot: { meta: { title: 'Draft title', subtitle: '', slug: 'd', description: '' } } });
  assert.equal(d2.rev, 2);
  assert.equal(code(() => studio.saveDraft(sam, p.id, 'main', { rev: 1, snapshot: {} })).code, 'draft_conflict');
  assert.equal(code(() => studio.saveDraft(sam, p.id, 'main', { rev: 2, base: 'f'.repeat(64), snapshot: {} })).code, 'draft_base_mismatch');
  // partial saves merge onto the draft: the habits block is still there
  assert.ok(studio.getDraft(sam, p.id, 'main').draft.snapshot.day.blocks.some((b) => b.uid === 'checks-t1'));
  // promote
  const r = studio.promoteDraft(sam, p.id, 'main', { message: 'Habits and a title' });
  assert.equal(r.commit.message, 'Habits and a title');
  assert.deepEqual(r.commit.parents, [h0]);
  assert.equal(studio.getDraft(sam, p.id, 'main').draft, null);
  assert.equal(studio.head(sam, p.id).snapshot.meta.title, 'Draft title');
  assert.equal(code(() => studio.promoteDraft(sam, p.id, 'main', { message: 'again' })).code, 'no_draft');
  // discard
  studio.saveDraft(sam, p.id, 'main', { snapshot: { meta: { title: 'x', subtitle: '', slug: 'x', description: '' } } });
  assert.equal(studio.discardDraft(sam, p.id, 'main').discarded, true);
  assert.equal(studio.getDraft(sam, p.id, 'main').draft, null);
  assert.equal(studio.discardDraft(sam, p.id, 'main').discarded, false);
});

test('drafts: promoting after the branch moved is a 409, and nothing is overwritten', () => {
  const { studio, sam, p, head, save, user } = setup();
  const kim = user('kim'); studio.setMember(sam, p.id, 'kim', 'editor');
  const h0 = head().id;
  studio.saveDraft(kim, p.id, 'main', { snapshot: { meta: { title: 'Kim draft', subtitle: '', slug: 'k', description: '' } } });
  const moved = save('Sam saves', { meta: { title: 'Sam version', subtitle: '', slug: 's', description: '' } }).commit;
  const view = studio.getDraft(kim, p.id, 'main');
  assert.equal(view.draft.behind, true); assert.equal(view.draft.base, h0); assert.equal(view.head, moved.id);
  const e = code(() => studio.promoteDraft(kim, p.id, 'main', { message: 'Kim saves' }));
  assert.equal(e.status, 409); assert.equal(e.code, 'head_moved'); assert.equal(e.details.head, moved.id);
  assert.equal(head().id, moved.id);
  assert.equal(studio.getDraft(kim, p.id, 'main').draft.snapshot.meta.title, 'Kim draft'); // the draft survives the conflict
  // drafts on different branches do not collide
  studio.createBranch(sam, p.id, { name: 'side' });
  assert.equal(studio.getDraft(kim, p.id, 'side').draft, null);
});

test('drafts and commits refuse forbidden content', () => {
  const { studio, sam, p, head } = setup();
  const bad = { meta: { title: 'x', subtitle: '', slug: 'x', description: 'see private/main.ics' } };
  assert.equal(code(() => studio.saveDraft(sam, p.id, 'main', { snapshot: bad })).code, 'forbidden_content');
  assert.equal(code(() => studio.commit(sam, p.id, { branch: 'main', expectedHead: head().id, message: 'x', snapshot: bad })).code, 'forbidden_content');
  assert.equal(code(() => studio.commit(sam, p.id, { branch: 'main', expectedHead: head().id, message: 'mail me@home.org', snapshot: {} })).code, 'forbidden_content');
  assert.equal(code(() => studio.createProject(sam, { name: 'Leaky', snapshot: { print: { trim: 'small', edition: 1, ics: 'x' } } })).code, 'forbidden_content');
});

test('diff: page-level (book entries by id) and block-level (day blocks by uid), with moves found', () => {
  const { studio, sam, p, head, save } = setup();
  const v1 = head();
  const s = structuredClone(studio.head(sam, p.id).snapshot);
  // page level: hide "theme", move "lineage" to just after "title", add a Notes page, change Notes options
  const d = s.book.default;
  d.find((e) => e.id === 'theme').on = false;
  const [lin] = d.splice(d.findIndex((e) => e.id === 'lineage'), 1); d.splice(1, 0, lin);
  d.splice(3, 0, { id: 'extra_notes', type: 'notes', on: true, options: { title: 'Scratch' } });
  // block level: turn off the fact block, move review to the top, add a checks block, change a care option
  const b = s.day.blocks;
  b.find((x) => x.type === 'fact').on = false;
  const [rev] = b.splice(b.findIndex((x) => x.type === 'review'), 1); b.unshift(rev);
  b.splice(3, 0, { uid: 'habits', type: 'checks', on: true, title: 'Habits', labels: ['Walk'] });
  const care = b.find((x) => x.type === 'care'); care.rows.find((r) => r.id === 'meds').on = false;
  const v2 = save('Restructure', s).commit;
  const df = studio.diff(sam, p.id, v1.id, v2.id);
  assert.deepEqual(df.book.added.map((x) => x.id), ['extra_notes']);
  assert.deepEqual(df.book.moved.map((x) => x.id), ['lineage']);
  assert.deepEqual(df.book.changed.map((x) => [x.id, x.fields.map((f) => f.key).join()]), [['theme', 'on']]);
  assert.deepEqual(df.book.removed, []);
  assert.deepEqual(df.day.added.map((x) => x.id), ['habits']);
  assert.deepEqual(df.day.moved.map((x) => x.id), ['review']);
  assert.deepEqual(df.day.changed.map((x) => x.id).sort(), ['care', 'fact']);
  assert.ok(df.day.changed.find((x) => x.id === 'care').fields.some((f) => f.key === 'rows.meds.on' && f.before === true && f.after === false));
  assert.equal(df.meta.length, 0);
  assert.equal(df.summary.total, df.summary.book + df.summary.day);
  // and back again the other way: added <-> removed
  const back = studio.diff(sam, p.id, v2.id, v1.id);
  assert.deepEqual(back.book.removed.map((x) => x.id), ['extra_notes']);
  assert.deepEqual(back.day.removed.map((x) => x.id), ['habits']);
  // the same commit against itself: empty
  assert.equal(studio.diff(sam, p.id, v2.id, v2.id).summary.total, 0);
});

test('diff by stable ids: renaming the title changes meta only, reordering is not a rewrite', () => {
  const { studio, sam, p, head, save } = setup();
  const v1 = head();
  const v2 = save('Rename', { meta: { title: 'New title', subtitle: '', slug: 'new-title', description: '' } }).commit;
  const df = studio.diff(sam, p.id, v1.id, v2.id);
  assert.deepEqual(df.meta.map((f) => f.key).sort(), ['slug', 'title']);
  assert.equal(df.summary.book + df.summary.day, 0);
});

test('assets are content-addressed and must exist in the project before a commit lists them', () => {
  const { studio, sam, p, head } = setup();
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.from('sample')]);
  const a = studio.putAsset(sam, p.id, { name: 'logo.png', mime: 'image/png', bytes: png });
  assert.equal(a.hash.length, 64);
  assert.deepEqual(studio.putAsset(sam, p.id, { name: 'logo.png', mime: 'image/png', bytes: png }), a); // same bytes, same address
  const r = studio.commit(sam, p.id, { branch: 'main', expectedHead: head().id, message: 'Add logo', snapshot: { assets: [a] } });
  assert.deepEqual(studio.head(sam, p.id).snapshot.assets, [a]);
  assert.equal(studio.getAsset(sam, p.id, a.hash).bytes.equals(png), true);
  assert.equal(code(() => studio.putAsset(sam, p.id, { name: 'x.png', mime: 'image/png', bytes: Buffer.from('not a png') })).code, 'asset_mismatch');
  assert.equal(code(() => studio.putAsset(sam, p.id, { name: 'a.svg', mime: 'image/svg+xml', bytes: Buffer.from('<svg><script>alert(1)</script></svg>') })).code, 'unsafe_svg');
  assert.equal(code(() => studio.putAsset(sam, p.id, { name: 'cal.ics', mime: 'text/calendar', bytes: Buffer.from('BEGIN:VCALENDAR') })).status, 415);
  assert.equal(r.commit.parents.length, 1);
});

test('reserved for G2/G3: parents is an array, source columns and component tables exist', () => {
  const { db } = setup();
  const cols = (t) => db.prepare(`PRAGMA table_info(${t})`).all().map((c) => c.name);
  assert.ok(cols('projects').includes('source_project_id') && cols('projects').includes('source_commit_id'));
  assert.ok(cols('commits').includes('source_commit_id') && cols('commits').includes('parents'));
  assert.ok(cols('component_versions').includes('version'));
  assert.equal(Studio.commitId.length, 1);
});

test('grid layouts (the Grid switch) survive a commit: placements are kept, the switch shows in the diff, export writes them back', () => {
  const { studio, sam, p, head, save } = setup();
  const v1 = head();
  const day = structuredClone(studio.head(sam, p.id).snapshot.day); day.grid = true; autoPlace(day, 'small');
  const v2 = save('Use the grid', { day }).commit;
  const stored = studio.getCommit(sam, p.id, v2.id).snapshot.day;
  assert.equal(stored.grid, true);
  assert.deepEqual(stored.blocks.map((b) => [b.uid, b.col, b.row, b.colSpan, b.rowSpan]), day.blocks.map((b) => [b.uid, b.col, b.row, b.colSpan, b.rowSpan]));
  const df = studio.diff(sam, p.id, v1.id, v2.id);
  assert.deepEqual(df.day.grid, { before: false, after: true });
  assert.ok(df.summary.day >= 1);
  assert.equal(studio.diff(sam, p.id, v2.id, v2.id).day.grid, null);
  const file = JSON.parse(journalFiles(studio.getCommit(sam, p.id, v2.id).snapshot)['content/daypage.json']);
  assert.equal(file.grid, true);
  assert.equal(file.blocks[0].colSpan, day.blocks[0].colSpan);
});
