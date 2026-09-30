// The library (L1a): books and series in a project snapshot. Sample data only.
//   serializer and privacy, old projects as a library of one book, history and diff by id, export back to the print pipeline
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { serializeSnapshot, emptySnapshot, libraryOf, scanForbidden, toObjects } from '../src/snapshot.mjs';
import { journalFiles, exportJournal, snapshotFromJournal, readJournal } from '../src/pipeline.mjs';
import { diffSnapshots } from '../src/diff.mjs';
import { StudioError } from '../src/db.mjs';
import { fresh, project, JOURNAL, sampleJournalDir } from './helpers.mjs';
import { validateLibrary, resolveBook, libraryFromProfile } from '../../journal/library.mjs';
import { DEFAULT_BOOK } from '../../journal/book.mjs';
import { normalize } from '../../journal/daypage.mjs';

const run = promisify(execFile);
const clone = (x) => JSON.parse(JSON.stringify(x));
const rejects = (fn, code) => assert.throws(fn, (e) => e instanceof StudioError && e.status === 422 && (!code || e.code === code), `expected ${code || '422'}`);
const base = () => emptySnapshot('Sample');

// a series of two books, a standalone undated journal, one extra layout
const LIB = () => ({
  version: 1,
  books: [
    { id: 'ocean-notes', title: 'Ocean Notes', subtitle: 'Tides and moods', spineTitle: 'OCEAN', start: '2026-10', edition: 1, seriesId: 'moods', layoutRef: 'lean' },
    { id: 'harbor-log', title: 'Harbor Log', start: '2026-10', edition: 2, seriesId: 'moods', plan: { scope: 'undated', undated: { days: 21 } } },
    { id: 'solo-days', title: 'Solo Days', start: '2026-10', plan: { scope: 'undated', undated: { days: 14 } } },
  ],
  series: [{ id: 'moods', title: 'Moods of the Sea', order: ['ocean-notes', 'harbor-log'], show: ['cover'], defaults: { modules: { therapy: false }, cover: { style: 'night' }, plan: { keeper: 'none' } } }],
  layouts: [{ id: 'lean', name: 'Lean pages', book: { ...clone(DEFAULT_BOOK), default: clone(DEFAULT_BOOK).default.filter((x) => x.type !== 'trans_support') }, day: { ...normalize(null), blocks: normalize(null).blocks.filter((b) => b.type !== 'sky') } }],
  defaultBook: 'ocean-notes',
});
const withLib = (lib = LIB()) => serializeSnapshot({ meta: { ...base().meta, library: lib } }, base());

test('a library rides in the snapshot: the serializer keeps the allowlisted fields and nothing else', () => {
  const s = withLib();
  assert.deepEqual(scanForbidden(s), []);
  const lib = s.meta.library;
  assert.equal(lib.books.length, 3);
  assert.equal(lib.series[0].order.join(), 'ocean-notes,harbor-log');
  assert.equal(lib.books[0].spineTitle, 'OCEAN');
  assert.equal(lib.layouts[0].book.default.some((x) => x.type === 'trans_support'), false);
  assert.equal(lib.layouts[0].day.blocks.some((b) => b.type === 'sky'), false);
  assert.deepEqual(validateLibrary(lib), []);
  // nested fields the library does not declare are dropped (plan.undated only keeps its own counts)
  const l = LIB(); l.books[1].plan.undated.junk = 'x';
  assert.equal('junk' in withLib(l).meta.library.books[1].plan.undated, false);
});

test('a library never carries the person, the place, coordinates, calendars, packs or paths', () => {
  for (const [where, key] of [['book', 'location'], ['book', 'person'], ['book', 'lat'], ['book', 'ics'], ['book', 'paths'], ['series', 'account'], ['book', 'crisis'], ['book', 'support'], ['book', 'password'], ['series', 'settings']]) {
    const l = LIB(); (where === 'book' ? l.books[0] : l.series[0])[key] = 'x';
    rejects(() => withLib(l), 'forbidden_content');
  }
  for (const v of ['https://example.com/mine.ics', 'private/notes.txt', 'sam@example.com', 'content/support.json']) {
    const l = LIB(); l.books[0].subtitle = v;
    rejects(() => withLib(l), 'forbidden_content');
  }
  const l = LIB(); l.books[0].nickname = 'x';
  rejects(() => withLib(l), 'invalid_snapshot'); // not forbidden, just not a field
  const bad = LIB(); bad.series[0].order = ['ghost'];
  rejects(() => withLib(bad), 'invalid_snapshot');
  const layout = LIB(); layout.layouts[0].book.default = layout.layouts[0].book.default.filter((x) => x.type !== 'closing');
  rejects(() => withLib(layout), 'invalid_snapshot'); // a layout's page structure is checked like book.json
});

test('a snapshot without a library is unchanged: no library key, same hashes; an old project is a library of one book', () => {
  const s = serializeSnapshot({}, base());
  assert.equal('library' in s.meta, false);
  assert.equal(toObjects(s).tree, toObjects(base()).tree);
  const lib = libraryOf(s);
  assert.equal(lib.books.length, 1);
  assert.equal(lib.books[0].id, 'sample');
  assert.equal(lib.books[0].title, 'Sample');
  assert.equal(lib.books[0].seriesId, undefined);
  assert.deepEqual(validateLibrary(lib), []);
  assert.deepEqual(libraryOf(withLib()).books.map((b) => b.id), ['ocean-notes', 'harbor-log', 'solo-days']);
});

test('saving a meta without a library keeps the stored one; library: null drops it', () => {
  const s = withLib();
  const kept = serializeSnapshot({ meta: { ...base().meta, title: 'Renamed' } }, s);
  assert.equal(kept.meta.title, 'Renamed');
  assert.equal(kept.meta.library.books.length, 3);
  const dropped = serializeSnapshot({ meta: { ...base().meta, library: null } }, s);
  assert.equal('library' in dropped.meta, false);
});

test('history holds the whole library: commit, read back, diff by id, restore', () => {
  const { studio, user } = fresh(), u = user('shelley');
  const p = project(studio, u);
  let head = studio.head(u, p.id).commit.id;
  const c1 = studio.commit(u, p.id, { expectedHead: head, message: 'Add the library', snapshot: { meta: { ...base().meta, title: 'Sample Journal', library: LIB() } } });
  assert.equal(c1.unchanged, false);
  const snap1 = studio.getCommit(u, p.id, c1.commit.id).snapshot;
  assert.deepEqual(snap1.meta.library.books.map((b) => b.id), ['ocean-notes', 'harbor-log', 'solo-days']);
  // edit: reorder the series, rename one book, add a book
  const l2 = LIB(); l2.series[0].order = ['harbor-log', 'ocean-notes']; l2.books[2].title = 'Solo Days (2027)'; l2.books.push({ id: 'new-one', title: 'New One', start: '2029-10' });
  const c2 = studio.commit(u, p.id, { expectedHead: c1.commit.id, message: 'Reorder', snapshot: { meta: { ...snap1.meta, library: l2 } } });
  const snap2 = studio.getCommit(u, p.id, c2.commit.id).snapshot;
  const d = diffSnapshots(snap1, snap2);
  assert.deepEqual(d.library.books.added.map((x) => x.id), ['new-one']);
  assert.deepEqual(d.library.books.changed.map((x) => [x.id, x.fields.map((f) => f.key)]), [['solo-days', ['title']]]);
  assert.deepEqual(d.library.series.changed.map((x) => [x.id, x.fields.map((f) => f.key)]), [['moods', ['order']]]);
  assert.equal(d.summary.library, 3);
  assert.deepEqual(d.meta, []); // the library is reported on its own, not as a wall of meta.library text
  assert.equal(diffSnapshots(snap1, snap1).library, undefined);
  const r = studio.restore(u, p.id, { commit: c1.commit.id, branch: 'main', expectedHead: c2.commit.id });
  assert.deepEqual(studio.getCommit(u, p.id, r.commit.id).snapshot.meta.library, snap1.meta.library);
  // the library is part of the verified content: tampering is detected like any other part
  assert.ok(studio.verify(u, p.id, r.commit.id).ok);
});

test('export: a project without a library writes book.json and daypage.json exactly as before; with a library it also writes library.json', () => {
  const plain = journalFiles(base());
  assert.deepEqual(Object.keys(plain), ['content/book.json', 'content/daypage.json']);
  assert.throws(() => journalFiles(base(), { book: 'x' }), /one book/);
  const s = withLib();
  const f = journalFiles(s, { book: 'harbor-log' });
  assert.deepEqual(Object.keys(f).sort(), ['content/book.json', 'content/daypage.json', 'content/library.json']);
  const lib = JSON.parse(f['content/library.json']);
  assert.equal(lib.defaultBook, 'harbor-log');
  assert.deepEqual(validateLibrary(lib), []);
  assert.equal(lib.layouts[0].day.blocks.some((b) => b.type === 'sky'), false);
  assert.equal(JSON.parse(f['content/book.json']).default.some((x) => x.type === 'trans_support'), true); // the project's own layout
  assert.equal(JSON.parse(journalFiles(s)['content/library.json']).defaultBook, 'ocean-notes'); // no book named: the library's own default
  assert.throws(() => journalFiles(s, { book: 'ghost' }), /No book "ghost"/);
  const r = resolveBook(lib, 'harbor-log', {});
  assert.equal(r.series.line, 'Book 2 of 2 in Moods of the Sea');
  assert.equal(r.modules.therapy, false); // series default
});

test('import reads content/library.json from a journal folder; nothing else personal comes along', () => {
  const dir = sampleJournalDir({ 'content/library.json': JSON.stringify(LIB()) });
  const j = readJournal(dir);
  assert.equal(j.meta.library.books.length, 3);
  const snap = snapshotFromJournal(dir);
  assert.equal(snap.meta.library.series[0].title, 'Moods of the Sea');
  const profile = JSON.parse(fs.readFileSync(path.join(dir, 'content/profile.json'), 'utf8'));
  assert.equal(JSON.stringify(snap).includes(profile.person.name), false);
  assert.deepEqual(scanForbidden(snap), []);
});

test('migration: the profile of a single book is a library of one book that gives the same book back', () => {
  const profile = JSON.parse(fs.readFileSync(path.join(JOURNAL, 'content/profile.example.json'), 'utf8'));
  const lib = libraryFromProfile(profile);
  const s = serializeSnapshot({ meta: { ...base().meta, library: lib } }, base());
  assert.equal(s.meta.library.books[0].title, profile.book.title);
  assert.equal(s.meta.library.books[0].bookId, profile.book.id);
});

const haveDeps = fs.existsSync(path.join(JOURNAL, 'node_modules/bwip-js')) && fs.existsSync(path.join(JOURNAL, 'node_modules/playwright-core'));
test('editor to print: an exported library builds the chosen book with its own title, series line and layout', { skip: haveDeps ? false : 'run "npm ci" in journal/ first (and Chromium)' }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-library-'));
  fs.cpSync(JOURNAL, dir, { recursive: true, filter: (src) => { const r = path.relative(JOURNAL, src); return !/^(node_modules|out|private|editor\/dist|gtfs\/.*\.zip)(\/|$)/.test(r) || r === 'out' || r === 'out/keeper' || r.startsWith('out/keeper/'); } });
  fs.rmSync(path.join(dir, 'content/daypage.json'), { force: true });
  fs.rmSync(path.join(dir, 'content/library.json'), { force: true });
  fs.symlinkSync(path.join(JOURNAL, 'node_modules'), path.join(dir, 'node_modules'));
  const snap = withLib();
  const written = exportJournal(snap, dir, { book: 'ocean-notes' }).map((f) => path.relative(dir, f)).sort();
  assert.deepEqual(written, ['content/book.json', 'content/daypage.json', 'content/library.json']);
  await run('node', ['keeper.mjs'], { cwd: dir });
  await run('node', ['render.mjs', 'month', '2026-10', 'test.ics'], { cwd: dir });
  const out = path.join(dir, 'out/m2026-10');
  const man = JSON.parse(fs.readFileSync(path.join(out, 'manifest.json'), 'utf8'));
  assert.equal(man.title, 'Ocean Notes');
  assert.equal(man.library_book, 'ocean-notes');
  assert.equal(man.series.of, 2);
  const layout = JSON.parse(fs.readFileSync(path.join(out, 'layout.json'), 'utf8'));
  assert.equal(layout.pages.some((p) => p.id === 'trans_support'), false); // the book's own (lean) layout
  const g = await run('node', ['check.mjs', 'm2026-10'], { cwd: dir });
  assert.match(g.stdout, /\[\] 0/);
  assert.ok(fs.readdirSync(out).some((x) => x.startsWith('ocean-notes-2026-10-interior')));
});
