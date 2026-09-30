// Library checks (CI: books.yml): books and series in one project, custom titles, series defaults with per-book override, the migration of
// today's single-book profile, and builds that read a chosen book. Sample data only (test.ics, the committed profile as the "person").
//   node test-library.mjs          (pure checks, then a few builds into out/library-test/, about a minute)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  validateLibrary, resolveBook, effectiveProfile, libraryFromProfile, seriesLine, shelf, layoutsFor, slugify, addBook, addSeries, removeBook, removeSeries,
  moveBookToSeries, reorderSeries, duplicateBook, DEFAULT_LAYOUT,
} from './library.mjs';
import { validateProfile } from './profile.mjs';
import { DEFAULT_BOOK } from './book.mjs';
import { normalize } from './daypage.mjs';

let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; console.log('ok   ' + m); };
const clone = (x) => JSON.parse(JSON.stringify(x));
const read = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'kw-library-'));
process.on('exit', () => fs.rmSync(TMP, { recursive: true, force: true }));
const ROOT = 'out/library-test';
fs.rmSync(ROOT, { recursive: true, force: true });
const SHELBEE = read('content/profile.json'), EXAMPLE = read('content/profile.example.json');

// a generic library: a series of two books, a standalone undated journal, one extra layout
const LIB = () => ({
  version: 1,
  books: [
    { id: 'ocean-notes', title: 'Ocean Notes', subtitle: 'Tides and moods', spineTitle: 'OCEAN', start: '2026-10', edition: 1, seriesId: 'moods', layoutRef: 'lean' },
    { id: 'harbor-log', title: 'Harbor Log', start: '2026-10', edition: 2, seriesId: 'moods', plan: { scope: 'undated', undated: { days: 21 } }, modules: { therapy: true } },
    { id: 'solo-days', title: 'Solo Days', subtitle: 'Nothing dated', plan: { scope: 'undated', undated: { days: 14 } }, start: '2026-10' },
  ],
  series: [{ id: 'moods', title: 'Moods of the Sea', order: ['ocean-notes', 'harbor-log'], show: ['cover', 'titlepage'], defaults: { modules: { therapy: false, spoons: false }, cover: { style: 'night' }, plan: { keeper: 'none', closing: 'end' }, dayLayout: 'lean' } }],
  layouts: [{ id: 'lean', name: 'Lean pages', book: { ...clone(DEFAULT_BOOK), default: clone(DEFAULT_BOOK).default.filter((x) => x.type !== 'trans_support') }, day: { ...normalize(null), blocks: normalize(null).blocks.filter((b) => b.type !== 'sky') } }],
  defaultBook: 'ocean-notes',
});
const errs = (mut) => { const l = LIB(); mut(l); return validateLibrary(l); };
const has = (e, re) => e.some((x) => re.test(x));

// ---- validation ----
ok(validateLibrary(LIB()).length === 0, 'a library with a series, a standalone book and a layout is valid: ' + validateLibrary(LIB()));
ok(validateLibrary(libraryFromProfile(SHELBEE)).length === 0 && validateLibrary(libraryFromProfile(EXAMPLE)).length === 0, 'the profiles migrate to valid libraries');
let e = errs((l) => { l.books.push({ id: 'ocean-notes', title: 'Twice' }); });
ok(has(e, /"ocean-notes" is used twice/), 'a repeated book id is named');
e = errs((l) => { l.books[0].title = ''; }); ok(has(e, /books\[0\]\.title: required/), 'a book needs a title');
e = errs((l) => { l.books[0].colour = 'red'; }); ok(has(e, /books\[0\]\.colour: not a book field/), 'an unknown book field is refused, not ignored');
e = errs((l) => { l.books[2].bookId = 'K7M2QX9A'; l.books[1].bookId = 'K7M2QX9A'; }); ok(has(e, /already the scan-code id/), 'two books cannot share a scan-code id');
e = errs((l) => { l.books[2].bookId = 'ILOU0000'; }); ok(has(e, /bookId: must be 8 characters/), 'a bad book id is refused');
e = errs((l) => { l.series.push({ id: 'again', title: 'Again', order: ['ocean-notes'] }); }); ok(has(e, /at most one series/), 'a book belongs to at most one series');
e = errs((l) => { l.series[0].order = ['ocean-notes']; }); ok(has(e, /lists "harbor-log"|does not list "harbor-log"|must say seriesId|does not list/), 'series order and book seriesId must agree: ' + e[0]);
e = errs((l) => { l.books[2].seriesId = 'moods'; }); ok(has(e, /does not list "solo-days"/), 'a book that says seriesId must be in that series order');
e = errs((l) => { l.series[0].order.push('ghost'); }); ok(has(e, /no book "ghost"/), 'series order names only real books');
e = errs((l) => { l.books[0].seriesId = 'nope'; }); ok(has(e, /no series "nope"/), 'seriesId names a real series');
e = errs((l) => { l.books[0].layoutRef = 'missing'; }); ok(has(e, /no layout "missing"/), 'layoutRef names a real layout');
e = errs((l) => { l.books[0].modules = { sky: 'yes', flying: true }; }); ok(has(e, /modules\.sky: must be true or false/) && has(e, /not a module/), 'module overrides are checked');
e = errs((l) => { l.books[0].plan = { scope: 'weekly' }; }); ok(has(e, /plan\.scope: must be one of/), 'plan fields use the plan rules');
e = errs((l) => { l.series[0].defaults.plan = { scope: 'custom' }; }); ok(has(e, /custom span belongs to one book/), 'a custom span cannot be a series default');
e = errs((l) => { l.series[0].defaults.cover = { style: 'neon' }; }); ok(has(e, /cover: must be/), 'cover style is one of the known styles');
e = errs((l) => { l.books.push({ id: 'twin', title: 'Twin', start: '2027-03', edition: 1 }); l.books[0].edition = 1; }); ok(has(e, /scan codes would repeat/), 'two monthly books over the same months and edition are refused (their KW2 codes would repeat)');
e = errs((l) => { l.books.push({ id: 'twin', title: 'Twin', start: '2028-10', edition: 1 }); }); ok(e.length === 0, 'monthly books 12+ months apart may share an edition');
e = errs((l) => { l.books = []; l.series = []; }); ok(has(e, /needs at least one book/), 'an empty library is refused');
e = errs((l) => { l.books[0].title = 'The <b>Sea</b> & "Sky" ' + 'x'.repeat(200); }); ok(has(e, /up to 120 characters/), 'titles have a length limit');
ok(validateLibrary(null)[0].includes('must be an object'), 'not an object');
ok(slugify('Ocean Notes: Year 2!') === 'ocean-notes-year-2' && slugify('Café Ünïcode') === 'cafe-unicode' && slugify('!!!') === '', 'slugs from titles');
e = errs((l) => { l.books[0].title = '!!!'; }); ok(has(e, /no letters or digits to make a file name from/), 'a title with no letters needs an explicit slug');

// ---- resolution: book > series > default, in one place ----
{
  const l = LIB();
  const a = resolveBook(l, 'ocean-notes', SHELBEE.book), b = resolveBook(l, 'harbor-log', SHELBEE.book), s = resolveBook(l, 'solo-days', SHELBEE.book);
  ok(a.title === 'Ocean Notes' && a.subtitle === 'Tides and moods' && a.spineTitle === 'OCEAN' && a.slug === 'ocean-notes', 'custom title, subtitle, spine title, and a file-name slug made from the title');
  ok(s.spineTitle === null && s.slug === 'solo-days' && s.series === null, 'a book without a spine title uses its title; a standalone book has no series');
  ok(a.modules.therapy === false && a.from['modules.therapy'] === 'series', 'a series default flows to its book (modules), and says so');
  ok(b.modules.therapy === true && b.from['modules.therapy'] === 'book' && b.modules.spoons === false && b.from['modules.spoons'] === 'series', 'a book overrides one module and inherits the others');
  ok(a.plan.keeper === 'none' && a.plan.closing === 'end' && a.from['plan.keeper'] === 'series', 'plan defaults come from the series');
  ok(b.plan.scope === 'undated' && b.from['plan.scope'] === 'book' && b.plan.keeper === 'none', 'a book keeps its own scope and inherits the rest of the plan');
  ok(a.layout.book === 'lean' && a.layout.day === 'lean' && a.from.dayLayout === 'series', 'the series day layout applies unless the book sets its own');
  const l2 = LIB(); l2.books[0].dayLayout = DEFAULT_LAYOUT;
  const a2 = resolveBook(l2, 'ocean-notes', SHELBEE.book);
  ok(a2.layout.day === DEFAULT_LAYOUT && a2.layout.book === 'lean' && a2.from.dayLayout === 'book', 'a book can override the series day layout back to the default');
  ok(b.edition === 2 && a.edition === 1 && s.edition === SHELBEE.book.edition, 'edition: the book, else the profile');
  const l3 = LIB(); l3.series[0].defaults.plan.edition = 5; delete l3.books[1].edition;
  ok(resolveBook(l3, 'harbor-log', SHELBEE.book).edition === 5, 'a series can default the edition');
  ok(a.series.line === 'Book 1 of 2 in Moods of the Sea' && b.series.line === 'Book 2 of 2 in Moods of the Sea' && seriesLine(l, 'solo-days') === null, 'series numbering: Book N of M in <series>');
  ok(a.show.join() === 'cover,titlepage' && a.from.show === 'series', 'the series says where its line is printed');
  ok(layoutsFor(l, a).book.default.length === DEFAULT_BOOK.default.length - 1 && layoutsFor(l, s).book === null && layoutsFor(l, s).day === null, 'layouts: the book layout comes from the library, the default one from the project files');
  const sh = shelf(l);
  ok(sh.length === 2 && sh[0].kind === 'series' && sh[0].books.length === 2 && sh[1].kind === 'book', 'the shelf: the series stacked, then the standalone book');
  let msg = ''; try { resolveBook(l, 'nope'); } catch (x) { msg = x.message; }
  ok(/No book "nope"/.test(msg), 'an unknown book is named');
}

// ---- migration: today's profile is a library of one, and builds the same book ----
for (const [name, prof] of [['Shelbee\'s profile', SHELBEE], ['the generic profile', EXAMPLE]]) {
  const lib = libraryFromProfile(prof);
  const eff = effectiveProfile(prof, lib, lib.defaultBook);
  ok(JSON.stringify(sortKeys(eff.profile)) === JSON.stringify(sortKeys(prof)), `${name}: the migrated library gives back exactly the same profile`);
  ok(lib.books.length === 1 && !lib.books[0].seriesId && lib.series.length === 0, `${name}: one standalone book`);
  ok(lib.books[0].title === prof.book.title && lib.books[0].edition === prof.book.edition && lib.books[0].start === prof.book.start, `${name}: title, edition and start carry over`);
  ok(validateProfile(eff.profile).length === 0, `${name}: the effective profile validates`);
}
{
  const withId = clone(SHELBEE); withId.book.id = 'K7M2QX9A'; withId.book.scope = 'year'; withId.book.keeper = 'per-book';
  const lib = libraryFromProfile(withId);
  ok(lib.books[0].bookId === 'K7M2QX9A' && lib.books[0].plan.scope === 'year' && lib.books[0].plan.keeper === 'per-book', 'a profile with a book id, scope and keeper keeps them (the book id never changes)');
  ok(JSON.stringify(sortKeys(effectiveProfile(withId, lib, lib.defaultBook).profile)) === JSON.stringify(sortKeys(withId)), 'and gives back the same profile');
}
function sortKeys(x) { return Array.isArray(x) ? x.map(sortKeys) : x && typeof x === 'object' ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, sortKeys(x[k])])) : x; }

// ---- the effective profile for a series book: only the book's own fields move ----
{
  const l = LIB(), eff = effectiveProfile(SHELBEE, l, 'harbor-log');
  ok(eff.profile.person.name === SHELBEE.person.name && JSON.stringify(eff.profile.location) === JSON.stringify(SHELBEE.location) && JSON.stringify(eff.profile.paths) === JSON.stringify(SHELBEE.paths), 'the person, place and paths are never touched by the library');
  ok(eff.profile.book.title === 'Harbor Log' && eff.profile.book.scope === 'undated' && eff.profile.book.undated.days === 21 && eff.profile.book.keeper === 'none', 'title, scope and inherited keeper land in the profile book section');
  ok(eff.profile.modules.therapy === true && eff.profile.modules.spoons === false && eff.profile.modules.bus === SHELBEE.modules.bus, 'module overrides layer over the profile');
  ok(!('custom' in eff.profile.book) && validateProfile(eff.profile).length === 0, 'the result is a valid profile');
  ok(eff.library.series.line === 'Book 2 of 2 in Moods of the Sea' && eff.library.cover.style === 'night', 'series line and cover style travel with it');
}

// ---- editing helpers ----
{
  let l = LIB();
  let r = addBook(l, { title: 'Ocean Notes' }); ok(r.id === 'ocean-notes-2' && validateLibrary(r.library).length === 0, 'a new book gets a unique id from its title');
  r = addBook(l, { title: 'Third', seriesId: 'moods', at: 1, start: '2029-01' }); ok(r.library.series[0].order.join() === 'ocean-notes,third,harbor-log' && validateLibrary(r.library).length === 0, 'a book added to a series lands at the position');
  const s = addSeries(l, { title: 'Season Journals' }); ok(s.id === 'season-journals' && validateLibrary(s.library).length === 0, 'a new empty series is valid');
  ok(removeBook(l, 'ocean-notes').series[0].order.join() === 'harbor-log' && validateLibrary(removeBook(l, 'ocean-notes')).length === 0, 'removing a book takes it out of its series');
  const rs = removeSeries(l, 'moods'); ok(rs.series.length === 0 && rs.books.length === 3 && rs.books.every((b) => !b.seriesId) && validateLibrary(rs).length === 0, 'removing a series keeps its books as standalone books');
  ok(removeSeries(l, 'moods', { withBooks: true }).books.map((b) => b.id).join() === 'solo-days', 'or removes them with it');
  const mv = moveBookToSeries(l, 'solo-days', 'moods', 0); ok(mv.series[0].order[0] === 'solo-days' && mv.books.find((b) => b.id === 'solo-days').seriesId === 'moods' && validateLibrary(mv).length === 0, 'a standalone book moves into a series');
  const out = moveBookToSeries(mv, 'harbor-log', null); ok(!out.books.find((b) => b.id === 'harbor-log').seriesId && !out.series[0].order.includes('harbor-log') && validateLibrary(out).length === 0, 'and a book moves out to stand alone');
  const ro = reorderSeries(l, 'moods', 0, 1); ok(ro.series[0].order.join() === 'harbor-log,ocean-notes' && seriesLine(ro, 'harbor-log').n === 1, 'reordering changes the numbering');
  const d = duplicateBook(l, 'ocean-notes'); const dup = d.library.books.find((b) => b.id === d.id);
  ok(dup.title === 'Ocean Notes (copy)' && dup.edition === 2 && !dup.bookId && d.library.series[0].order.join() === 'ocean-notes,ocean-notes-copy,harbor-log' && validateLibrary(d.library).length === 0, 'a copy sits next to its original, takes the next edition (monthly codes), and never copies a book id');
  ok(JSON.stringify(l) === JSON.stringify(LIB()), 'editing helpers never change the library they were given');
}

// ---- builds: the chosen book, titles everywhere ----
const env = (o = {}) => ({ ...process.env, KW_OUT: ROOT, ...o });
const node = (script, args, o) => execFileSync('node', [script, ...args], { env: env(o), stdio: 'pipe' }).toString();
const text = (pdf) => execFileSync('pdftotext', ['-layout', pdf, '-']).toString();
const norm = (s) => s.replace(/Built \d{4}-\d{2}-\d{2}/, 'Built DATE');
const file = path.join(TMP, 'library.json');
fs.writeFileSync(file, JSON.stringify(LIB(), null, 1));
const B = (id, o = {}) => ({ KW_LIBRARY: file, KW_BOOK: id, ...o });
node('keeper.mjs', []); // the Closing pages point to the Keeper of the profile
{
  // a: monthly, in a series, own layout (a lean book)
  node('render.mjs', ['month', '2026-10', 'test.ics'], B('ocean-notes', { KW_OUT: `${ROOT}/a` }));
  node('cover.mjs', ['month', '2026-10'], B('ocean-notes', { KW_OUT: `${ROOT}/a` }));
  const dir = `${ROOT}/a/m2026-10`, files = fs.readdirSync(dir);
  ok(files.includes('ocean-notes-2026-10-interior-5.5x8.5.pdf') && files.includes('ocean-notes-2026-10-cover.pdf'), 'file names come from the book title: ' + files.filter((f) => f.endsWith('.pdf')));
  const man = read(`${dir}/manifest.json`);
  ok(man.title === 'Ocean Notes' && man.subtitle === 'Tides and moods' && man.library_book === 'ocean-notes' && man.series.n === 1 && man.series.of === 2 && man.series.title === 'Moods of the Sea', 'the manifest carries the title, the library book and the series');
  const lay = read(`${dir}/layout.json`), html0 = fs.readFileSync(`${dir}/journal.html`, 'utf8');
  ok(lay.pages.some((p) => p.id === 'title') && !lay.pages.some((p) => p.id === 'trans_support') && !html0.includes('data-zone="sky"'), 'the book builds from its library layout (lean pages), not the project files');
  const html = fs.readFileSync(`${dir}/journal.html`, 'utf8');
  ok(html.includes('<h1>Ocean Notes</h1>') && html.includes('Tides and moods') && html.includes('Book 1 of 2 in Moods of the Sea'), 'the title page has the title, the subtitle and the series line');
  const cov = text(`${dir}/ocean-notes-2026-10-cover.pdf`);
  ok(/Ocean Notes/.test(cov) && /Tides and moods/.test(cov) && /Book 1 of 2 in Moods of the Sea/.test(cov), 'the cover has the title, subtitle and series line');
  ok(!/Keeping Watch/.test(cov + html), "Shelbee's book title appears nowhere in another book");
  ok(!/Keeping Watch/.test(files.join()), 'and not in its file names');
}
{
  // b: standalone undated, no series: no series line anywhere; volumes say "Undated"
  const out = node('render.mjs', ['book', 'test.ics'], B('solo-days', { KW_OUT: `${ROOT}/b` }));
  const vol = /^volume (\S+):/m.exec(out)[1], dir = `${ROOT}/b/b-${vol}`;
  node('cover.mjs', ['book', vol], B('solo-days', { KW_OUT: `${ROOT}/b` }));
  const cov = text(`${dir}/${fs.readdirSync(dir).find((f) => /cover\.pdf$/.test(f))}`);
  ok(/Solo Days/.test(cov) && /Nothing dated/.test(cov) && !/Book \d+ of \d+ in/.test(cov) && !/Moods of the Sea/.test(cov), 'a standalone book has its own title and no series line');
  ok(fs.readdirSync(dir).some((f) => f.startsWith('solo-days-')), 'file names use its slug');
  ok(read(`${dir}/manifest.json`).title === 'Solo Days' && !read(`${dir}/manifest.json`).series && read(`${dir}/manifest.json`).book_id === read(file).books[2].bookId, 'the manifest has its title, no series, and the book id made once and written into the library');
  ok(read(file).books[2].bookId && !read(file).books[0].bookId && read('content/profile.json').book.id === SHELBEE.book.id, 'the book id went to the library entry; the profile file was not touched');
}
{
  // c: two books of one series build side by side without touching each other: different codes
  node('render.mjs', ['book', 'test.ics'], B('harbor-log', { KW_OUT: `${ROOT}/c` }));
  const vol = fs.readdirSync(`${ROOT}/c`).find((d) => d.startsWith('b-'));
  const solo = fs.readdirSync(`${ROOT}/b`).find((d) => d.startsWith('b-'));
  const ids = [read(`${ROOT}/c/${vol}/manifest.json`).book_id, read(`${ROOT}/b/${solo}/manifest.json`).book_id];
  ok(ids[0] && ids[1] && ids[0] !== ids[1], 'every book in the library has its own scan-code id: ' + ids);
  const code = node('check-codes.mjs', [`${ROOT}/c/${vol}`, `${ROOT}/b/${solo}`], { DECODE: 'sample', KW_LIBRARY: file });
  ok(/check-codes: ok/.test(code), 'codes are unique across the books');
}
{
  // d: the migrated library builds today's book byte for byte (the page HTML), and its file names and title are unchanged
  const mig = path.join(TMP, 'migrated.json');
  fs.writeFileSync(mig, JSON.stringify(libraryFromProfile(SHELBEE), null, 1));
  node('render.mjs', ['month', '2026-10', 'test.ics'], { KW_OUT: `${ROOT}/plain` });
  node('render.mjs', ['month', '2026-10', 'test.ics'], { KW_OUT: `${ROOT}/mig`, KW_LIBRARY: mig });
  ok(norm(fs.readFileSync(`${ROOT}/plain/m2026-10/journal.html`, 'utf8')) === norm(fs.readFileSync(`${ROOT}/mig/m2026-10/journal.html`, 'utf8')), 'the migrated library builds the same pages as the profile alone');
  ok(JSON.stringify(read(`${ROOT}/plain/m2026-10/layout.json`)) === JSON.stringify(read(`${ROOT}/mig/m2026-10/layout.json`)), 'with the same layout.json (page ids, codes, zones)');
  ok(JSON.stringify(fs.readdirSync(`${ROOT}/plain/m2026-10`).sort()) === JSON.stringify(fs.readdirSync(`${ROOT}/mig/m2026-10`).sort()), 'and the same file names');
}
console.log(`test-library: ${n} checks passed`);
