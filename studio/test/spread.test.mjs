// Spread days (S1): the day's spread layout (daypage.json `spread`) and the days entry's options (book.json) travel through the allowlist
// serializer, a commit's objects, the structured diff, the three-way merge and the export back to the files the renderer reads.
import test from 'node:test';
import assert from 'node:assert/strict';
import { serializeSnapshot, emptySnapshot, toObjects, scanForbidden } from '../src/snapshot.mjs';
import { diffSnapshots } from '../src/diff.mjs';
import { mergeSnapshots, listChanges, applyChanges } from '../src/merge.mjs';
import { journalFiles, snapshotFromJournal } from '../src/pipeline.mjs';
import { StudioError } from '../src/db.mjs';
import { defaultSpread, normalize, spreadProblems } from '../../journal/daypage.mjs';
import { validateBook } from '../../journal/book.mjs';

const rejects = (fn, code) => assert.throws(fn, (e) => e instanceof StudioError && e.status === 422 && (!code || e.code === code));
const base = () => emptySnapshot('Spread sample');
const customSpread = (title = 'My page') => { const S = defaultSpread(); S.blocks = S.blocks.map((b) => (b.type === 'lines' ? { ...b, title } : b)); return S; };
const withSpread = (snap, S) => serializeSnapshot({ day: { ...snap.day, spread: S } }, snap);
const withDays = (snap, opts) => { const book = structuredClone(snap.book); book.default.find((e) => e.type === 'weeks').options.week.find((e) => e.type === 'days').options = opts; return serializeSnapshot({ book }, snap); };

test('the default snapshot has no spread, and the starting spread is not stored', () => {
  const s = serializeSnapshot({}, base());
  assert.equal('spread' in s.day, false);
  assert.equal('spread' in withSpread(s, defaultSpread()).day, false, 'a day layout that carries the starting spread is the default layout');
});

test('a custom spread layout is kept by the allowlist, block by block, with its places', () => {
  const s = withSpread(base(), customSpread('Ideas'));
  assert.equal(s.day.spread.kind, 'spread');
  assert.equal(s.day.spread.grid, true);
  const lines = s.day.spread.blocks.find((b) => b.type === 'lines');
  assert.equal(lines.title, 'Ideas');
  assert.deepEqual([lines.col, lines.row, lines.colSpan, lines.rowSpan], [5, 1, 4, 24]);
  assert.deepEqual(scanForbidden(s), []);
  assert.deepEqual(Object.keys(s.day.spread.blocks[0]).filter((k) => !['uid', 'type', 'on', 'col', 'row', 'colSpan', 'rowSpan'].includes(k)), []);
  assert.equal(JSON.stringify(serializeSnapshot({ day: s.day }, base()).day), JSON.stringify(s.day), 'serializing it again changes nothing');
});

test('a spread that breaks a rule is refused with the reason; unknown block fields are dropped', () => {
  const S = customSpread();
  S.blocks = S.blocks.map((b) => (b.type === 'lines' ? { ...b, col: 4, colSpan: 2 } : b));
  assert.match(spreadProblems(S).join(' '), /crosses the fold/);
  assert.throws(() => serializeSnapshot({ day: { ...base().day, spread: S } }, base()), (e) => e instanceof StudioError && e.code === 'invalid_snapshot' && /crosses the fold/.test(e.message));
  const T = customSpread(); T.blocks[0].secretNote = 'x';
  assert.equal('secretNote' in withSpread(base(), T).day.spread.blocks[0], false);
});

test('forbidden content is refused inside a spread layout too', () => {
  const S = customSpread(); S.blocks[0].token = 'x';
  rejects(() => serializeSnapshot({ day: { ...base().day, spread: S } }, base()), 'forbidden_content');
  const U = customSpread('see sam@example.com');
  rejects(() => serializeSnapshot({ day: { ...base().day, spread: U } }, base()), 'forbidden_content');
});

test('the days entry options (format, weekdays, dates) travel with the book and are validated', () => {
  const s = withDays(base(), { weekdays: { sat: 'spread', sun: 'spread' }, dates: { '2026-10-14': 'spread' } });
  const days = s.book.default.find((e) => e.type === 'weeks').options.week.find((e) => e.type === 'days');
  assert.deepEqual(days.options, { weekdays: { sat: 'spread', sun: 'spread' }, dates: { '2026-10-14': 'spread' } });
  assert.deepEqual(validateBook(s.book), []);
  assert.throws(() => withDays(base(), { weekdays: { sat: 'huge' } }), (e) => e instanceof StudioError && /weekdays\.sat must be one of/.test(e.message));
});

test('a commit stores the spread as part of the day object: only it changes the day hash', () => {
  const a = toObjects(serializeSnapshot({}, base())), b = toObjects(withSpread(base(), customSpread()));
  const part = (o, k) => o.objects.find((x) => x.kind === k).hash;
  assert.notEqual(part(a, 'day'), part(b, 'day'));
  for (const k of ['meta', 'print', 'book', 'assets', 'components']) assert.equal(part(a, k), part(b, k));
});

test('the structured diff names the spread blocks that changed', () => {
  const a = serializeSnapshot({}, base()), b = withSpread(base(), customSpread('Ideas'));
  const d = diffSnapshots(a, b);
  assert.ok(d.spread, 'a spread section');
  assert.ok(d.spread.added.length > 0, 'the spread blocks are new');
  assert.ok(d.summary.spread > 0 && d.summary.total >= d.summary.spread);
  assert.deepEqual(d.day.added, []);
  const c = diffSnapshots(b, withSpread(b, customSpread('Plans')));
  assert.equal(c.spread.changed.length, 1);
  assert.equal(c.spread.changed[0].type, 'lines');
  assert.equal('spread' in diffSnapshots(a, a), false, 'no spread section when nothing about it changed');
  const days = diffSnapshots(a, withDays(base(), { weekdays: { sat: 'spread' } }));
  assert.ok(days.book.changed.some((x) => x.id === 'days' || x.type === 'days'), 'the days entry shows in the book diff');
});

test('three-way merge: a spread edited on one side is kept, and both sides can edit different parts', () => {
  const B = serializeSnapshot({}, base()), ours = withDays(B, { weekdays: { sat: 'spread' } }), theirs = withSpread(B, customSpread('Ideas'));
  const r = mergeSnapshots(B, ours, theirs), r2 = mergeSnapshots(B, theirs, ours);
  assert.deepEqual(r.conflicts || [], []);
  assert.equal(r.snapshot.day.spread.blocks.find((b) => b.type === 'lines').title, 'Ideas');
  assert.deepEqual(r.snapshot.book.default.find((e) => e.type === 'weeks').options.week.find((e) => e.type === 'days').options, { weekdays: { sat: 'spread' } });
  assert.equal(JSON.stringify(r.snapshot), JSON.stringify(r2.snapshot), 'the order of the two sides does not matter');
  assert.equal(JSON.stringify(mergeSnapshots(B, B, B).snapshot), JSON.stringify(B));
  assert.equal(JSON.stringify(mergeSnapshots(B, theirs, B).snapshot), JSON.stringify(theirs), 'one side only: that side');
});

test('listChanges and applyChanges carry the spread', () => {
  const B = serializeSnapshot({}, base()), T = withSpread(B, customSpread('Ideas'));
  const ch = listChanges(B, T), sp = ch.find((c) => c.key === 'day:spread');
  assert.ok(sp && sp.label === 'Spread day layout');
  const took = applyChanges(B, T, ['day:spread']);
  assert.equal(took.day.spread.blocks.find((b) => b.type === 'lines').title, 'Ideas');
  assert.equal('spread' in applyChanges(B, T, []).day, false, 'not taken when not chosen');
});

test('export writes the spread in daypage.json (readable order) and book.json keeps the days options; import reads them back', () => {
  const s = withDays(withSpread(base(), customSpread('Ideas')), { weekdays: { sat: 'spread' }, dates: { '2026-10-14': 'spread' } });
  const files = journalFiles(s);
  const day = JSON.parse(files['content/daypage.json']), book = JSON.parse(files['content/book.json']);
  assert.equal(day.spread.kind, 'spread');
  assert.deepEqual(Object.keys(day.spread.blocks[0]).slice(0, 3), ['uid', 'type', 'on']);
  assert.deepEqual(book.default.find((e) => e.type === 'weeks').options.week.find((e) => e.type === 'days').options, { weekdays: { sat: 'spread' }, dates: { '2026-10-14': 'spread' } });
  assert.deepEqual(spreadProblems(day.spread), []);
  const back = snapshotFromJournal({ meta: s.meta, print: s.print, book, day });
  assert.equal(JSON.stringify(back.day), JSON.stringify(s.day), 'what the renderer reads is what the project holds');
  assert.equal(JSON.stringify(normalize(day).spread), JSON.stringify(normalize(s.day).spread));
  const plain = journalFiles(serializeSnapshot({}, base()));
  assert.equal('spread' in JSON.parse(plain['content/daypage.json']), false, 'a project that never used spreads exports the same files as before');
});
