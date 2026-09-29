// The merge core (pure): the commit graph, independent merges, every conflict kind, resolutions, and accepting selected changes.
// Sample data only: the default book and layout.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeSnapshots, mergeBases, isAncestor, ancestors, listChanges, applyChanges, CONFLICT_KINDS } from '../src/merge.mjs';
import { emptySnapshot, serializeSnapshot } from '../src/snapshot.mjs';
import { StudioError } from '../src/db.mjs';
import { newBlock, normalize, autoPlace, gridProblems } from '../../journal/daypage.mjs';

const base = () => emptySnapshot('Sample');
const cp = (s, fn) => { const c = structuredClone(s); fn(c); return c; };
const blk = (s, uid) => s.day.blocks.find((b) => b.uid === uid);
const uids = (s) => s.day.blocks.map((b) => b.uid);
const addAfter = (s, uid, block) => s.day.blocks.splice(s.day.blocks.findIndex((b) => b.uid === uid) + 1, 0, block);
const checks = (uid, title, labels = ['A']) => newBlock('checks', { title, labels }, uid);
const page = (s, id, list = 'default') => (list === 'default' ? s.book.default : list.split('>').reduce((x, k) => x, null)) && s.book.default.find((p) => p.id === id);
const weekPages = (s) => s.book.default.find((p) => p.type === 'weeks').options.week;
const conflictOf = (r, id) => r.conflicts.find((c) => c.id === id);
const throws = (fn, code) => { try { fn(); } catch (e) { assert.ok(e instanceof StudioError, String(e)); assert.equal(e.code, code); return e; } assert.fail(`expected ${code}`); };
const valid = (b, r) => serializeSnapshot(r.snapshot, b); // whatever merged must be a valid publication source

// ---------- the commit graph ----------
// history:  a - b - c - f          g = merge(f, e)
//                \\     /
//                 d - e
const G = { a: [], b: ['a'], c: ['b'], d: ['b'], e: ['d'], f: ['c'], g: ['f', 'e'], h: ['g'], x: [], y: ['x'] };
const po = (id) => G[id];
test('ancestry: ancestors, isAncestor and the merge base on branchy histories', () => {
  assert.deepEqual([...ancestors(po, 'g')].sort(), ['a', 'b', 'c', 'd', 'e', 'f', 'g']);
  assert.ok(isAncestor(po, 'b', 'g') && isAncestor(po, 'e', 'g') && isAncestor(po, 'g', 'g'));
  assert.ok(!isAncestor(po, 'g', 'b') && !isAncestor(po, 'c', 'e'));
  assert.deepEqual(mergeBases(po, 'f', 'e'), ['b'], 'two branches from b');
  assert.deepEqual(mergeBases(po, 'c', 'f'), ['c'], 'a commit and its descendant: the older one');
  assert.deepEqual(mergeBases(po, 'h', 'e'), ['e'], 'after a merge, the merged-in tip is the base');
  assert.deepEqual(mergeBases(po, 'h', 'd'), ['d']);
  assert.deepEqual(mergeBases(po, 'e', 'e'), ['e']);
  assert.deepEqual(mergeBases(po, 'x', 'a'), [], 'unrelated histories have no base');
  assert.deepEqual(mergeBases(po, 'y', 'h'), []);
});
test('ancestry: a criss-cross history has two best bases; a merge into a long chain finds the fork point', () => {
  // a - b - c1 - m1 (merges c2)     m2 (merges c1) - both descend from c1 and c2
  const g = { a: [], c1: ['a'], c2: ['a'], m1: ['c1', 'c2'], m2: ['c2', 'c1'], o: ['m1'], t: ['m2'] };
  assert.deepEqual(mergeBases((id) => g[id], 'o', 't'), ['c1', 'c2'], 'both c1 and c2 are best common ancestors');
  const chain = {}; let prev = null; for (let i = 0; i < 300; i++) { chain[`n${i}`] = prev ? [prev] : []; prev = `n${i}`; }
  chain.fork = ['n100']; chain.tip = ['n299'];
  assert.deepEqual(mergeBases((id) => chain[id], 'fork', 'tip'), ['n100']);
});

// ---------- independent edits merge automatically ----------
const B = base();
const independent = [
  ['different blocks edited', (s) => { blk(s, 'actions').count = 5; }, (s) => { blk(s, 'review').h = 4; }, (m) => { assert.equal(blk(m, 'actions').count, 5); assert.equal(blk(m, 'review').h, 4); }],
  ['different fields of one block', (s) => { blk(s, 'actions').count = 6; }, (s) => { blk(s, 'actions').routines = false; }, (m) => { assert.equal(blk(m, 'actions').count, 6); assert.equal(blk(m, 'actions').routines, false); }],
  ['the same field set to the same value', (s) => { blk(s, 'actions').count = 4; }, (s) => { blk(s, 'actions').count = 4; }, (m) => assert.equal(blk(m, 'actions').count, 4)],
  ['only ours changed', (s) => { blk(s, 'body').style = 'lines'; }, () => {}, (m) => assert.equal(blk(m, 'body').style, 'lines')],
  ['only theirs changed', () => {}, (s) => { blk(s, 'body').style = 'grid'; }, (m) => assert.equal(blk(m, 'body').style, 'grid')],
  ['a switch flag inside one option (flags merge by key)', (s) => { blk(s, 'review').items.well = false; }, (s) => { blk(s, 'review').items.hard = false; }, (m) => { assert.equal(blk(m, 'review').items.well, false); assert.equal(blk(m, 'review').items.hard, false); assert.equal(blk(m, 'review').items.next, true); }],
  ['title on one side, print trim on the other', (s) => { s.meta.title = 'Renamed'; }, (s) => { s.print.trim = 'letter'; }, (m) => { assert.equal(m.meta.title, 'Renamed'); assert.equal(m.print.trim, 'letter'); }],
  ['different module switches', (s) => { s.print.modules = { ...(s.print.modules || {}), sky: false }; }, (s) => { s.print.modules = { ...(s.print.modules || {}), bus: false }; }, (m) => { assert.equal(m.print.modules.sky, false); assert.equal(m.print.modules.bus, false); }],
  ['a block added on each side, in different places', (s) => addAfter(s, 'sky', checks('mine', 'Mine')), (s) => addAfter(s, 'care', checks('theirs', 'Theirs')), (m) => { assert.deepEqual(uids(m).filter((u) => ['mine', 'theirs'].includes(u)), ['mine', 'theirs']); assert.ok(uids(m).indexOf('mine') < uids(m).indexOf('care') && uids(m).indexOf('theirs') > uids(m).indexOf('care')); }],
  ['both add after the same neighbour: ours first, order kept', (s) => addAfter(s, 'sky', checks('mine', 'Mine')), (s) => addAfter(s, 'sky', checks('theirs', 'Theirs')), (m) => assert.deepEqual(uids(m).slice(0, 4), ['sky', 'mine', 'theirs', 'notes'])],
  ['one side reorders, the other edits blocks', (s) => { s.day.blocks.reverse(); }, (s) => { blk(s, 'actions').count = 2; }, (m) => { assert.equal(uids(m)[0], 'fact'); assert.equal(blk(m, 'actions').count, 2); }],
  ['one side reorders, the other adds a block', (s) => { const [x] = s.day.blocks.splice(9, 1); s.day.blocks.unshift(x); }, (s) => addAfter(s, 'events', checks('new', 'New')), (m) => { assert.equal(uids(m)[0], 'fact'); assert.ok(uids(m).includes('new')); assert.ok(uids(m).indexOf('new') === uids(m).indexOf('events') + 1); }],
  ['one deletes a block, the other edits another', (s) => { s.day.blocks = s.day.blocks.filter((b) => b.uid !== 'fact'); }, (s) => { blk(s, 'actions').count = 7; }, (m) => { assert.ok(!uids(m).includes('fact')); assert.equal(blk(m, 'actions').count, 7); }],
  ['both delete the same block', (s) => { s.day.blocks = s.day.blocks.filter((b) => b.uid !== 'fact'); }, (s) => { s.day.blocks = s.day.blocks.filter((b) => b.uid !== 'fact'); }, (m) => assert.ok(!uids(m).includes('fact'))],
  ['a deleted block that the other side did not touch is deleted', (s) => { s.day.blocks = s.day.blocks.filter((b) => b.uid !== 'review'); }, () => {}, (m) => assert.ok(!uids(m).includes('review'))],
  ['care rows: different rows, and a row order change', (s) => { blk(s, 'care').rows.find((r) => r.id === 'meals').on = false; }, (s) => { const c = blk(s, 'care'); c.rows.push(c.rows.shift()); }, (m) => { const c = blk(m, 'care'); assert.equal(c.rows.find((r) => r.id === 'meals').on, false); assert.notEqual(c.rows[0].id, blk(B, 'care').rows[0].id); }],
  ['pages: different pages hidden and edited', (s) => { s.book.default.find((p) => p.id === 'lineage').on = false; }, (s) => { s.book.default.find((p) => p.id === 'bus').on = false; }, (m) => { assert.equal(m.book.default.find((p) => p.id === 'lineage').on, false); assert.equal(m.book.default.find((p) => p.id === 'bus').on, false); }],
  ['pages: a Notes page added by each side, and a week page hidden', (s) => { s.book.default.splice(3, 0, { id: 'trip', type: 'notes', on: true, options: { title: 'Trip' } }); }, (s) => { s.book.default.splice(6, 0, { id: 'ideas', type: 'notes', on: true, options: { title: 'Ideas' } }); weekPages(s).find((p) => p.id === 'week_review').on = false; }, (m) => { const ids = m.book.default.map((p) => p.id); assert.ok(ids.includes('trip') && ids.includes('ideas')); assert.equal(weekPages(m).find((p) => p.id === 'week_review').on, false); }],
  ['pages: one side reorders the book, the other edits a Notes title', (s) => { const [x] = s.book.default.splice(1, 1); s.book.default.push(x); }, (s) => { s.book.default.find((p) => p.id === 'lineage').on = false; }, (m) => { assert.equal(m.book.default[m.book.default.length - 1].id, 'blank'); assert.equal(m.book.default.find((p) => p.id === 'lineage').on, false); }],
  ['a month gets its own page list on one side', (s) => { s.book.months['2026-10'] = { pages: structuredClone(s.book.default) }; s.book.months['2026-10'].pages.find((p) => p.id === 'lineage').on = false; }, (s) => { s.meta.subtitle = 'Autumn'; }, (m) => { assert.equal(m.book.months['2026-10'].pages.find((p) => p.id === 'lineage').on, false); assert.equal(m.meta.subtitle, 'Autumn'); }],
  ['different reusable components edited, and one added', (s) => { s.components = [{ id: 'a', name: 'A', version: 2, page: { type: 'blank', options: {} } }, { id: 'b', name: 'B', version: 1, page: { type: 'blank', options: {} } }]; }, (s) => { s.components = [{ id: 'a', name: 'A', version: 1, page: { type: 'blank', options: {} } }, { id: 'b', name: 'B', version: 2, page: { type: 'blank', options: {} } }, { id: 'c', name: 'C', version: 1, page: { type: 'blank', options: {} } }]; }, (m) => { assert.deepEqual(m.components.map((c) => [c.id, c.version]), [['a', 1], ['b', 1], ['c', 1]]); }],
];
// the components case above starts from an empty list on both sides: a real independent case needs a shared start
const withComponents = () => cp(B, (s) => { s.components = [{ id: 'a', name: 'A', version: 1, page: { type: 'blank', options: {} } }, { id: 'b', name: 'B', version: 1, page: { type: 'blank', options: {} } }]; });
for (const [name, ours, theirs, check] of independent.slice(0, -1)) {
  test(`independent merge: ${name}`, () => {
    const o = cp(B, ours), t = cp(B, theirs);
    const r = mergeSnapshots(B, o, t), r2 = mergeSnapshots(B, t, o);
    assert.equal(r.clean, true, JSON.stringify(r.conflicts.map((c) => c.id)));
    assert.deepEqual(r.conflicts, []);
    const m = valid(B, r); check(m);
    // the other way round merges too, with the same content (only the tie-break order of two adds at one spot may differ)
    assert.equal(r2.clean, true);
    assert.deepEqual(new Set(valid(B, r2).day.blocks.map((b) => b.uid)), new Set(m.day.blocks.map((b) => b.uid)));
  });
}
test('independent merge: two different components edited, and one added', () => {
  const base2 = withComponents(), o = cp(base2, (s) => { s.components.find((c) => c.id === 'a').version = 2; }), t = cp(base2, (s) => { s.components.find((c) => c.id === 'b').name = 'B2'; s.components.push({ id: 'c', name: 'C', version: 1, page: { type: 'blank', options: {} } }); });
  const r = mergeSnapshots(base2, o, t);
  assert.equal(r.clean, true);
  assert.deepEqual(r.snapshot.components.map((c) => [c.id, c.version, c.name]), [['a', 2, 'A'], ['b', 1, 'B2'], ['c', 1, 'C']]);
});
test('independent merge: nothing changed, one side changed, and a merge with itself', () => {
  assert.deepEqual(mergeSnapshots(B, B, B).snapshot, B);
  const o = cp(B, (s) => { s.meta.description = 'x'; });
  assert.deepEqual(mergeSnapshots(B, o, B).snapshot, o);
  assert.deepEqual(mergeSnapshots(B, B, o).snapshot, o);
  assert.deepEqual(mergeSnapshots(B, o, o).snapshot, o);
});
test('independent merge: many random edits on different blocks always merge and stay valid', () => {
  let seed = 7; const rnd = (n) => { seed = (seed * 48271) % 2147483647; return seed % n; };
  const tweakable = ['actions', 'review', 'body', 'care'];
  for (let round = 0; round < 40; round++) {
    const o = cp(B, (s) => { blk(s, 'actions').count = 1 + rnd(8); if (rnd(2)) addAfter(s, 'sky', checks(`o${round}`, 'O')); if (rnd(2)) s.meta.title = `T${round}`; });
    const t = cp(B, (s) => { blk(s, 'review').h = 1 + rnd(5); if (rnd(2)) addAfter(s, 'notes', checks(`t${round}`, 'T')); if (rnd(2)) s.print.edition = 1 + rnd(9); if (rnd(3) === 0) s.day.blocks.reverse(); });
    const r = mergeSnapshots(B, o, t);
    assert.ok(r.clean, `round ${round}: ${r.conflicts.map((c) => c.id)}`);
    const m = valid(B, r);
    assert.equal(blk(m, 'actions').count, blk(o, 'actions').count); assert.equal(blk(m, 'review').h, blk(t, 'review').h);
    for (const b of [...o.day.blocks, ...t.day.blocks]) assert.ok(uids(m).includes(b.uid), 'no block lost');
  }
  assert.ok(tweakable.length);
});

// ---------- conflict kinds ----------
test('edit/edit: the same field changed differently is a conflict that carries base, ours and theirs; other fields still merge', () => {
  const o = cp(B, (s) => { blk(s, 'actions').count = 5; blk(s, 'actions').routines = false; }), t = cp(B, (s) => { blk(s, 'actions').count = 2; blk(s, 'review').h = 4; });
  const r = mergeSnapshots(B, o, t);
  assert.equal(r.clean, false);
  assert.equal(r.conflicts.length, 1);
  const c = conflictOf(r, 'block:actions');
  assert.equal(c.kind, 'edit_edit'); assert.equal(c.part, 'day'); assert.match(c.label, /Action items/);
  assert.deepEqual(c.fields.map((f) => [f.path, f.base, f.ours, f.theirs]), [['count', 3, 5, 2]]);
  assert.equal(c.base.count, 3); assert.equal(c.ours.count, 5); assert.equal(c.theirs.count, 2);
  assert.equal(c.ifOurs.count, 5); assert.equal(c.ifOurs.routines, false); assert.equal(c.ifTheirs.count, 2); assert.equal(c.ifTheirs.routines, false, 'the parts nobody fought over still merge');
  assert.equal(blk(r.snapshot, 'review').h, 4, 'other items merged');
  assert.ok(CONFLICT_KINDS.includes(c.kind));
});
test('edit/edit: a setting (title) and a page option conflict at the field, not the whole part', () => {
  const o = cp(B, (s) => { s.meta.title = 'Ours'; s.book.default.splice(3, 0, { id: 'trip', type: 'notes', on: true, options: { title: 'Ours' } }); });
  const t = cp(B, (s) => { s.meta.title = 'Theirs'; s.meta.subtitle = 'kept'; s.book.default.splice(3, 0, { id: 'trip', type: 'notes', on: true, options: { title: 'Theirs' } }); });
  const r = mergeSnapshots(B, o, t);
  assert.deepEqual(r.conflicts.map((c) => [c.id, c.kind]).sort(), [['meta.title', 'edit_edit'], ['page:default/trip', 'add_add']]);
  assert.equal(r.snapshot.meta.subtitle, 'kept');
  const both = cp(B, (s) => { s.book.default.find((p) => p.id === 'lineage').on = false; }), b2 = cp(B, (s) => { s.book.default.find((p) => p.id === 'lineage').on = true; s.book.default.find((p) => p.id === 'lineage').options = {}; });
  assert.equal(mergeSnapshots(B, both, b2).clean, true, 'hidden on one side, untouched on the other');
});
test('add/add: the same id added with different content; two different blocks of a one-per-page type', () => {
  const o = cp(B, (s) => addAfter(s, 'sky', checks('same', 'Ours'))), t = cp(B, (s) => addAfter(s, 'sky', checks('same', 'Theirs')));
  const r = mergeSnapshots(B, o, t);
  assert.equal(r.conflicts.length, 1); assert.equal(r.conflicts[0].kind, 'add_add'); assert.equal(r.conflicts[0].base, null);
  assert.equal(r.conflicts[0].ours.title, 'Ours'); assert.equal(r.conflicts[0].theirs.title, 'Theirs');
  assert.equal(mergeSnapshots(B, o, cp(B, (s) => addAfter(s, 'sky', checks('same', 'Ours')))).clean, true, 'the same block added twice is fine');
  // spoons already exists (off): a second 'events' block would be dropped by the page rules, so it is surfaced
  const a = cp(B, (s) => { s.day.blocks = s.day.blocks.filter((x) => x.uid !== 'sky'); addAfter(s, 'events', newBlock('sky', {}, 'sky-a')); });
  const b = cp(B, (s) => { s.day.blocks = s.day.blocks.filter((x) => x.uid !== 'sky'); addAfter(s, 'care', newBlock('sky', {}, 'sky-b')); });
  const r2 = mergeSnapshots(B, a, b);
  const c = conflictOf(r2, 'single:sky');
  assert.ok(c, JSON.stringify(r2.conflicts.map((x) => x.id)));
  assert.equal(c.kind, 'add_add'); assert.equal(c.ifOurs.uid, 'sky-a'); assert.equal(c.ifTheirs.uid, 'sky-b');
  const fixed = mergeSnapshots(B, a, b, { 'single:sky': { choose: 'theirs' } });
  assert.ok(fixed.clean); assert.deepEqual(uids(valid(B, fixed)).filter((u) => u.startsWith('sky')), ['sky-b']);
});
test('edit/delete: deleted on one side and changed on the other, both ways round; deleted and untouched is a plain delete', () => {
  const del = cp(B, (s) => { s.day.blocks = s.day.blocks.filter((b) => b.uid !== 'review'); }), edit = cp(B, (s) => { blk(s, 'review').h = 4; });
  for (const [o, t, by] of [[del, edit, 'ours'], [edit, del, 'theirs']]) {
    const r = mergeSnapshots(B, o, t), c = conflictOf(r, 'block:review');
    assert.equal(c.kind, 'delete_edit'); assert.equal(c.deletedBy, by);
    assert.equal(c.base.h, 2);
    assert.equal(by === 'ours' ? c.ours : c.theirs, null); assert.equal((by === 'ours' ? c.theirs : c.ours).h, 4);
    assert.ok(uids(r.snapshot).includes('review'), 'nothing is lost while it is unresolved: the edited block stays');
    assert.equal(c.provisional.h, 4);
    const kept = mergeSnapshots(B, o, t, { 'block:review': { choose: by === 'ours' ? 'theirs' : 'ours' } }), gone = mergeSnapshots(B, o, t, { 'block:review': { choose: by } });
    assert.ok(kept.clean && uids(kept.snapshot).includes('review') && blk(kept.snapshot, 'review').h === 4);
    assert.ok(gone.clean && !uids(gone.snapshot).includes('review'));
    const manual = mergeSnapshots(B, o, t, { 'block:review': { choose: 'manual', value: { ...edit.day.blocks.find((b) => b.uid === 'review'), h: 5 } } });
    assert.equal(blk(manual.snapshot, 'review').h, 5);
    assert.equal(mergeSnapshots(B, o, t, { 'block:review': { choose: 'manual', value: null } }).snapshot.day.blocks.some((b) => b.uid === 'review'), false, 'a manual delete');
  }
  const p1 = cp(B, (s) => { s.book.default = s.book.default.filter((x) => x.id !== 'lineage'); }), p2 = cp(B, (s) => { s.book.default.find((x) => x.id === 'lineage').on = false; });
  assert.equal(conflictOf(mergeSnapshots(B, p1, p2), 'page:default/lineage').kind, 'delete_edit', 'a page removed on one side, hidden on the other');
});
test('reorder/reorder: both sides reorder the same list differently; the same reorder is fine; each choice gives a full order', () => {
  const o = cp(B, (s) => { const [x] = s.day.blocks.splice(0, 1); s.day.blocks.push(x); }), t = cp(B, (s) => { s.day.blocks.reverse(); });
  const r = mergeSnapshots(B, o, t), c = conflictOf(r, 'order:blocks');
  assert.equal(r.conflicts.length, 1); assert.equal(c.kind, 'reorder');
  assert.deepEqual(c.base, uids(B)); assert.deepEqual(c.ours, uids(o)); assert.deepEqual(c.theirs, uids(t));
  assert.equal(c.names.sky, 'Moon, sun & season');
  assert.deepEqual(uids(mergeSnapshots(B, o, t, { 'order:blocks': { choose: 'ours' } }).snapshot), uids(o));
  assert.deepEqual(uids(mergeSnapshots(B, o, t, { 'order:blocks': { choose: 'theirs' } }).snapshot), uids(t));
  const custom = ['body', ...uids(B).filter((u) => u !== 'body')];
  assert.deepEqual(uids(valid(B, mergeSnapshots(B, o, t, { 'order:blocks': { choose: 'manual', value: custom } }))), custom);
  throws(() => mergeSnapshots(B, o, t, { 'order:blocks': { choose: 'manual', value: ['sky'] } }), 'invalid_resolution');
  assert.equal(mergeSnapshots(B, t, cp(B, (s) => { s.day.blocks.reverse(); })).clean, true, 'the same reorder on both sides');
  // pages too
  const po1 = cp(B, (s) => { s.book.default.reverse(); }), po2 = cp(B, (s) => { const [x] = s.book.default.splice(0, 1); s.book.default.push(x); });
  assert.equal(conflictOf(mergeSnapshots(B, po1, po2), 'order:default').kind, 'reorder');
  // and a reorder plus an add on the other side that also reorders keeps the added block in the resolved order
  const o3 = cp(o, (s) => addAfter(s, 'sky', checks('mine', 'Mine')));
  const r3 = mergeSnapshots(B, o3, t, { 'order:blocks': { choose: 'ours' } });
  assert.ok(uids(r3.snapshot).includes('mine'));
});
// A small valid grid page to move things on: Moon & sun (rows 1-2), Action items (3-6), Writing space (7-18); rows 19-24 are free.
function gridPage() {
  const s = base(), L = normalize({ ...s.day, grid: true });
  for (const b of L.blocks) b.on = ['sky', 'actions', 'body'].includes(b.uid);
  const at = (uid, row, rowSpan) => Object.assign(L.blocks.find((b) => b.uid === uid), { col: 1, colSpan: 4, row, rowSpan });
  at('sky', 1, 2); at('actions', 3, 4); at('body', 7, 12); at('spoons', 19, 2); at('gratitude', 19, 4);
  s.day = serializeSnapshot({ ...s, day: L }, s).day;
  assert.deepEqual(gridProblems(normalize(s.day)), []);
  return s;
}
test('move/edit: a grid block moved on one side and given more content on the other no longer fits: move/edit; two moves that collide: layout; each offers a whole layout or a manual one', () => {
  const g = gridPage(), put = (s, uid, patch) => Object.assign(blk(s, uid), patch);
  // two independent moves into the same free rows
  const o = cp(g, (s) => put(s, 'spoons', { on: true })), t = cp(g, (s) => put(s, 'gratitude', { on: true }));
  const r = mergeSnapshots(g, o, t), c = conflictOf(r, 'layout:day');
  assert.ok(c, JSON.stringify(r.conflicts.map((x) => x.id)));
  assert.equal(c.kind, 'layout'); assert.ok(c.problems.some((p) => /overlap/.test(p)), c.problems.join('|'));
  assert.deepEqual(c.ifOurs, o.day); assert.deepEqual(c.ifTheirs, t.day); assert.deepEqual(c.base, g.day);
  assert.ok(mergeSnapshots(g, o, t, { 'layout:day': { choose: 'ours' } }).clean);
  assert.equal(blk(mergeSnapshots(g, o, t, { 'layout:day': { choose: 'theirs' } }).snapshot, 'gratitude').on, true);
  assert.equal(blk(mergeSnapshots(g, o, t, { 'layout:day': { choose: 'ours' } }).snapshot, 'gratitude').on, false);
  const fixed = cp(o, (s) => put(s, 'gratitude', { on: true, row: 21, rowSpan: 4 }));
  assert.ok(mergeSnapshots(g, o, t, { 'layout:day': { choose: 'manual', value: fixed.day } }).clean);
  throws(() => mergeSnapshots(g, o, t, { 'layout:day': { choose: 'manual', value: 'nope' } }), 'invalid_resolution');
  // move/edit: ours moves Action items to the bottom; theirs gives it more lines and room (and takes the room from the Writing space)
  const need = 6; // 6 lines need 8 rows
  const o2 = cp(g, (s) => put(s, 'actions', { row: 21 })), t2 = cp(g, (s) => { put(s, 'actions', { count: need, rowSpan: 8 }); put(s, 'body', { row: 11, rowSpan: 8 }); });
  assert.deepEqual([gridProblems(normalize(o2.day)), gridProblems(normalize(t2.day))], [[], []], 'each side is a valid page on its own');
  const r2 = mergeSnapshots(g, o2, t2), c2 = conflictOf(r2, 'layout:day');
  assert.ok(c2, JSON.stringify(r2.conflicts.map((x) => x.id)));
  assert.equal(c2.kind, 'move_edit'); assert.match(c2.problems.join(' '), /runs off the bottom|overlap/);
  assert.ok(mergeSnapshots(g, o2, t2, { 'layout:day': { choose: 'theirs' } }).clean);
  // a move and an edit that fit together merge with no conflict
  assert.ok(mergeSnapshots(g, cp(g, (s) => put(s, 'actions', { row: 15, rowSpan: 4 })), cp(g, (s) => put(s, 'actions', { count: 4 }))).clean);
  // pre-existing problems are not blamed on the merge
  const broken = cp(g, (s) => put(s, 'actions', { rowSpan: 1 }));
  assert.ok(mergeSnapshots(g, broken, cp(g, (s) => { s.meta.title = 'x'; })).clean);
});
test('component change: both sides changed a component; the resolved component is newer than both', () => {
  const b2 = cp(B, (s) => { s.components = [{ id: 'weekly', name: 'Weekly check', version: 3, page: { type: 'blank', options: {} } }]; });
  const o = cp(b2, (s) => { s.components[0].version = 4; s.components[0].page = { type: 'notes', options: { title: 'Ours' } }; }), t = cp(b2, (s) => { s.components[0].version = 5; s.components[0].name = 'Weekly'; });
  const r = mergeSnapshots(b2, o, t), c = conflictOf(r, 'component:weekly');
  assert.equal(c.kind, 'component'); assert.equal(c.minVersion, 6);
  assert.equal(c.ifOurs.version, 6); assert.equal(c.ifOurs.page.options.title, 'Ours'); assert.equal(c.ifTheirs.version, 6); assert.equal(c.ifTheirs.name, 'Weekly');
  assert.equal(c.base.version, 3); assert.equal(c.ours.version, 4); assert.equal(c.theirs.version, 5);
  const ours = mergeSnapshots(b2, o, t, { 'component:weekly': { choose: 'ours' } });
  assert.equal(ours.snapshot.components[0].version, 6); assert.equal(ours.snapshot.components[0].page.type, 'notes');
  const hand = mergeSnapshots(b2, o, t, { 'component:weekly': { choose: 'manual', value: { id: 'weekly', name: 'Mine', version: 1, page: { type: 'blank', options: {} } } } });
  assert.equal(hand.snapshot.components[0].version, 6, 'a hand-made component still gets a version above both');
  assert.equal(hand.snapshot.components[0].name, 'Mine');
  // added on both sides with different content
  const a1 = cp(B, (s) => { s.components = [{ id: 'new', name: 'N1', version: 1, page: { type: 'blank', options: {} } }]; }), a2 = cp(B, (s) => { s.components = [{ id: 'new', name: 'N2', version: 1, page: { type: 'blank', options: {} } }]; });
  assert.equal(conflictOf(mergeSnapshots(B, a1, a2), 'component:new').kind, 'component');
  // deleted on one side, changed on the other
  const d = cp(b2, (s) => { s.components = []; });
  assert.equal(conflictOf(mergeSnapshots(b2, d, cp(b2, (s) => { s.components[0].version = 4; })), 'component:weekly').kind, 'delete_edit');
});
test('edit/edit on care rows: the same row option changed differently is one conflict on the Care block, naming the row field', () => {
  const row = (s, id) => blk(s, 'care').rows.find((r) => r.id === id);
  const o = cp(B, (s) => { row(s, 'water').count = 6; row(s, 'meals').on = false; }), t = cp(B, (s) => { row(s, 'water').count = 9; });
  const r = mergeSnapshots(B, o, t), c = conflictOf(r, 'block:care');
  assert.equal(c.kind, 'edit_edit'); assert.deepEqual(c.fields.map((f) => [f.path, f.ours, f.theirs]), [['rows.water.count', 6, 9]]);
  assert.equal(c.ifOurs.rows.find((r) => r.id === 'meals').on, false, 'the row nobody fought over still merges');
  assert.equal(row(mergeSnapshots(B, o, t, { 'block:care': { choose: 'theirs' } }).snapshot, 'water').count, 9);
  // both sides reorder the rows differently: the order is a field conflict too
  const a = cp(B, (s) => { const c = blk(s, 'care'); c.rows.push(c.rows.shift()); }), b = cp(B, (s) => { const c = blk(s, 'care'); c.rows.reverse(); });
  assert.deepEqual(conflictOf(mergeSnapshots(B, a, b), 'block:care').fields.map((f) => f.path), ['rows.order']);
});

// ---------- resolutions ----------
test('resolutions: ours, theirs, manual per conflict; a resolution for nothing, a bad choice or a bad manual value is refused; all-or-nothing', () => {
  const o = cp(B, (s) => { blk(s, 'actions').count = 5; s.meta.title = 'Ours'; }), t = cp(B, (s) => { blk(s, 'actions').count = 2; s.meta.title = 'Theirs'; });
  const r = mergeSnapshots(B, o, t);
  assert.deepEqual(r.conflicts.map((c) => c.id).sort(), ['block:actions', 'meta.title']);
  const half = mergeSnapshots(B, o, t, { 'meta.title': { choose: 'theirs' } });
  assert.equal(half.clean, false); assert.deepEqual(half.conflicts.map((c) => c.id), ['block:actions']); assert.equal(half.snapshot.meta.title, 'Theirs');
  const all = mergeSnapshots(B, o, t, { 'meta.title': { choose: 'manual', value: 'Both' }, 'block:actions': { choose: 'manual', value: { ...blk(o, 'actions'), count: 4 } } });
  assert.ok(all.clean); assert.equal(all.snapshot.meta.title, 'Both'); assert.equal(blk(all.snapshot, 'actions').count, 4);
  assert.deepEqual(all.resolved.map((x) => [x.id, x.choose]).sort(), [['block:actions', 'manual'], ['meta.title', 'manual']]);
  throws(() => mergeSnapshots(B, o, t, { 'nope:1': { choose: 'ours' } }), 'unknown_resolution');
  throws(() => mergeSnapshots(B, o, t, { 'meta.title': { choose: 'sideways' } }), 'invalid_resolution');
  throws(() => mergeSnapshots(B, o, t, { 'meta.title': { choose: 'manual' } }), 'invalid_resolution');
  throws(() => mergeSnapshots(B, o, t, { 'block:actions': { choose: 'manual', value: { uid: 'other', type: 'actions' } } }), 'invalid_resolution');
  throws(() => mergeSnapshots(B, o, t, { 'meta.title': 'ours' }), 'invalid_resolution');
  // an invalid manual value is caught by the same validation every commit goes through
  const bad = mergeSnapshots(B, o, t, { 'meta.title': { choose: 'manual', value: 'x'.repeat(500) }, 'block:actions': { choose: 'ours' } });
  throws(() => serializeSnapshot(bad.snapshot, B), 'invalid_snapshot');
  // and a manual value with a forbidden field never gets through
  const evil = mergeSnapshots(B, o, t, { 'meta.title': { choose: 'ours' }, 'block:actions': { choose: 'manual', value: { ...blk(o, 'actions'), email: 'x@example.com' } } });
  throws(() => serializeSnapshot(evil.snapshot, B), 'forbidden_content');
});

// ---------- accepting selected changes ----------
test('selected changes: the change list has a key per page, block, order and setting; accepting some applies only those', () => {
  const theirs = cp(B, (s) => {
    blk(s, 'actions').count = 6; blk(s, 'review').h = 4; addAfter(s, 'sky', checks('habits', 'Habits')); s.day.blocks = s.day.blocks.filter((b) => b.uid !== 'fact');
    s.meta.title = 'New title'; s.book.default.find((p) => p.id === 'lineage').on = false; s.book.default.splice(3, 0, { id: 'trip', type: 'notes', on: true, options: { title: 'Trip' } });
  });
  const ch = listChanges(B, theirs), keys = ch.map((c) => c.key).sort();
  assert.deepEqual(keys, ['block:actions', 'block:fact', 'block:habits', 'block:review', 'meta:title', 'page:default/lineage', 'page:default/trip'].sort());
  assert.deepEqual(Object.fromEntries(ch.map((c) => [c.key, c.kind])), { 'block:actions': 'changed', 'block:review': 'changed', 'block:habits': 'added', 'block:fact': 'removed', 'meta:title': 'changed', 'page:default/lineage': 'changed', 'page:default/trip': 'added' });
  const some = applyChanges(B, theirs, ['block:actions', 'block:habits', 'page:default/trip']);
  assert.equal(blk(some, 'actions').count, 6); assert.equal(blk(some, 'review').h, 2, 'not selected: untouched');
  assert.ok(uids(some).includes('habits') && uids(some).includes('fact'), 'the removal was not selected');
  assert.equal(some.meta.title, 'Sample');
  assert.ok(some.book.default.some((p) => p.id === 'trip')); assert.equal(some.book.default.find((p) => p.id === 'lineage').on, true);
  assert.equal(uids(some)[uids(some).indexOf('sky') + 1], 'habits', 'the new block lands after the neighbour it had');
  assert.equal(serializeSnapshot(some, B) && true, true);
  // then merge it into ours (which moved on) with no conflict
  const ours = cp(B, (s) => { blk(s, 'body').style = 'lines'; });
  const r = mergeSnapshots(B, ours, some);
  assert.ok(r.clean); assert.equal(blk(r.snapshot, 'body').style, 'lines'); assert.equal(blk(r.snapshot, 'actions').count, 6);
  // accepting the rest later: what was accepted is not a conflict
  const later = mergeSnapshots(B, r.snapshot, theirs);
  assert.ok(later.clean); assert.equal(later.snapshot.meta.title, 'New title'); assert.ok(!uids(later.snapshot).includes('fact'));
  // removal and reorder keys
  const rev = cp(B, (s) => { s.day.blocks.reverse(); }), oc = listChanges(B, rev);
  assert.deepEqual(oc.map((c) => c.key), ['order:blocks']); assert.equal(oc[0].kind, 'moved');
  assert.deepEqual(uids(applyChanges(B, rev, ['order:blocks'])), uids(rev));
  assert.deepEqual(uids(applyChanges(B, theirs, ['block:fact'])), uids(B).filter((u) => u !== 'fact'));
});
test('selected changes: accepting a block whose other side changed differently is a conflict like any merge', () => {
  const theirs = cp(B, (s) => { blk(s, 'actions').count = 6; }), ours = cp(B, (s) => { blk(s, 'actions').count = 2; });
  const r = mergeSnapshots(B, ours, applyChanges(B, theirs, ['block:actions']));
  assert.equal(r.conflicts[0].kind, 'edit_edit');
});
