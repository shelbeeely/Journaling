// Block pages test (C5a): Notes, Collection and Blank pages are made of the same blocks as the day page, on a fixed grid of their own.
// Proves (1) a page with no layout, or with the starting layout, prints byte for byte what it always did, (2) the rules in book.json
// say what is wrong in plain words, (3) flowBook agrees with assemble() for pages with layouts, and (4) a book with edited pages
// really builds: render.mjs, check.mjs (every page fits, "[] 0"), the scan zones every block carries, check-pages and check-codes.
//   node test-blockpages.mjs        (about a minute: one book build and its checks, into out/blockpages-test/)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { DEFAULT_BOOK, validateBook, assemble } from './book.mjs';
import { flowBook, addEntry, setLayout, duplicateEntry, setTitle, bookJson, listFor } from './bookedit.mjs';
import { catalog, fresh } from './editor/samples.mjs';
import { libraryFromProfile } from './library.mjs';
import { PROFILE } from './profile.mjs';
import { notesPage } from './pages.mjs';
import { newBlock, normalize, defaultLayout, kindPage, isDefaultLayout, pageLayoutProblems, autoPlace, gridProblems, gridRows, GRIDS, PAGE_KINDS, allowedIn, TYPES } from './daypage.mjs';

let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; console.log('ok   ' + m); };
const MONTH = '2026-10';
const cat = await catalog(MONTH, DEFAULT_BOOK);
const must = (r) => { assert.ok(r.book, r.err); return r.book; };
const B = (t, o = {}, uid = t) => newBlock(t, o, uid);

// ---- 1. nothing drifts ----
ok(kindPage('notes', 'Notes', null) === notesPage('Notes'), 'a Notes page with no layout prints the original Notes page');
ok(kindPage('notes', 'Ideas', defaultLayout('notes')) === notesPage('Ideas'), 'a Notes page with the starting layout prints the original too');
ok(kindPage('blank', '', null) === '<div class="blankpage"></div>' && kindPage('blank', '', { v: 2, blocks: [] }) === '<div class="blankpage"></div>', 'a blank page with no blocks prints the original empty box');
ok(isDefaultLayout(defaultLayout('notes'), 'notes') && isDefaultLayout(null, 'collection') && !isDefaultLayout({ v: 2, blocks: [B('body'), B('lines')] }, 'notes'), 'the starting layout is told from an edited one');

// ---- 2. the kinds ----
ok(Object.keys(PAGE_KINDS).join() === 'day,notes,collection,blank,spread,half', 'page kinds: day, notes, collection, blank, and the two of a spread day (S1)');
ok(gridRows('small', 'blank') === 27 && gridRows('letter', 'blank') === 27 && gridRows('small', 'notes') === 24 && gridRows('small', 'collection') === 24 && gridRows('small') === 24, 'each kind has its own fixed number of rows (blank has no header, so three more)');
ok(Object.entries(GRIDS).every(([k, g]) => g.cols === (k === 'spread' ? 8 : 4)), 'every page has four columns (a spread is two pages of them), so a layout carries across kinds and sizes');
ok(!allowedIn('notes', 'sky') && !allowedIn('blank', 'events') && !allowedIn('collection', 'sendto') && allowedIn('notes', 'checks') && allowedIn('blank', 'sketch'), 'blocks that read a day (or the scan strip) stay on the day page');
{
  const L = normalize({ v: 2, blocks: [B('sky'), B('checks'), B('sendto')] }, 'small', 'notes');
  ok(L.kind === 'notes' && !L.blocks.some((b) => b.type === 'sky' || b.type === 'sendto') && L.blocks.some((b) => b.type === 'body'), 'normalize drops day-only blocks and keeps the Writing space on a Notes page');
  const K = normalize({ v: 2, blocks: [B('checks')] }, 'small', 'blank');
  ok(!K.blocks.some((b) => b.type === 'body'), 'a blank page does not need a Writing space');
  ok(!normalize({ v: 2, blocks: [{ ...B('body'), on: false }] }, 'small', 'notes').blocks.find((b) => b.type === 'body').on === false, 'a Notes page keeps its Writing space on');
  ok(normalize(null, 'small') && !normalize(null).kind, 'a day layout has no kind');
}
for (const kind of ['notes', 'collection', 'blank']) {
  const L = normalize({ v: 2, kind, grid: true, blocks: [B('checks'), B('lines'), B('sketch'), ...(kind === 'blank' ? [] : [B('body')])] }, 'small', kind);
  const dropped = autoPlace(L, 'small');
  ok(L.grid && gridProblems(L, 'small').length === 0 && dropped.length >= 0, `${kind}: a grid layout places every block inside ${gridRows('small', kind)} rows with no problem`);
}

// ---- 3. the rules of book.json ----
{
  const lay = { v: 2, kind: 'notes', blocks: [B('checks'), B('body')] };
  let b = must(addEntry(DEFAULT_BOOK, cat, null, 'notes', { before: 'theme' }, { title: 'Ideas' }));
  b = must(setLayout(b, cat, null, 'notes_1', lay));
  ok(validateBook(b).length === 0 && b.default.find((e) => e.id === 'notes_1').layout.blocks.length === 2, 'a Notes entry with a layout validates');
  ok(!must(setLayout(b, cat, null, 'notes_1', defaultLayout('notes'))).default.find((e) => e.id === 'notes_1').layout, 'setting the starting layout takes the layout off the entry again');
  const bad = (layout, type = 'notes') => { const x = JSON.parse(JSON.stringify(b)); const e = x.default.find((y) => y.id === 'notes_1'); e.type = type; e.layout = layout; return validateBook(x).join(' | '); };
  ok(/Day-only|belongs on a day page/.test(bad({ v: 2, blocks: [B('sky')] })), 'a day-only block on a Notes page is refused, and says why: ' + bad({ v: 2, blocks: [B('sky')] }));
  ok(/unknown block type/.test(bad({ v: 2, blocks: [{ type: 'nope', uid: 'x' }] })), 'an unknown block is refused');
  ok(/"kind" is "day"/.test(bad({ v: 2, kind: 'day', blocks: [] })), 'a layout for another kind is refused');
  ok(/overlap|needs at least|runs off/.test(bad({ v: 2, grid: true, blocks: [{ ...B('checks'), col: 1, row: 1, colSpan: 4, rowSpan: 1 }, { ...B('lines'), col: 1, row: 1, colSpan: 4, rowSpan: 3 }] })), 'a grid that breaks a rule is refused with the rule');
  const t = JSON.parse(JSON.stringify(DEFAULT_BOOK)); t.default[0].layout = { v: 2, blocks: [] };
  ok(/only .*pages have a layout of blocks/.test(validateBook(t).join(' | ')), 'a layout on a page that is not a block page is refused');
  const c = must(addEntry(must(addEntry(DEFAULT_BOOK, cat, null, 'collection', {}, { title: 'Books to read' })), cat, null, 'collection', {}));
  ok(validateBook(c).length === 0 && c.default.filter((e) => e.type === 'collection').length === 2, 'Collection pages can repeat, like Notes pages');
  ok(must(duplicateEntry(c, cat, null, 'collection_1')).default.filter((e) => e.type === 'collection').length === 3 && must(setTitle(c, cat, null, 'collection_1', 'Places')).default.find((e) => e.id === 'collection_1').options.title === 'Places', 'a Collection page duplicates and retitles');
  ok(pageLayoutProblems(lay, 'notes').length === 0 && pageLayoutProblems([], 'notes').length === 1, 'pageLayoutProblems says what is wrong');
}

// ---- 4. flowBook = assemble, with layouts ----
const grid = (kind, blocks) => { const L = normalize({ v: 2, kind, grid: true, blocks }, 'small', kind); autoPlace(L, 'small'); return normalize(L, 'small', kind); };
let book = must(addEntry(DEFAULT_BOOK, cat, null, 'notes', { before: 'theme' }, { title: 'Ideas' }));
book = must(addEntry(book, cat, null, 'notes', { before: 'theme' }, { title: 'Planning' }));
book = must(addEntry(book, cat, null, 'collection', { before: 'theme' }, { title: 'Books to read' }));
book = must(addEntry(book, cat, null, 'collection', { before: 'theme' }, { title: 'Places' }));
book = must(setLayout(book, cat, null, 'notes_1', { v: 2, kind: 'notes', blocks: [B('checks', { title: 'Done' }), B('body', { style: 'lines' }), B('lines', { n: 3 })] }));
book = must(setLayout(book, cat, null, 'notes_2', grid('notes', [B('good'), B('split'), B('body', { style: 'grid' })])));
book = must(setLayout(book, cat, null, 'collection_2', grid('collection', [B('bullets'), B('body', { style: 'lines' })])));
book = must(setLayout(book, cat, null, 'blank', grid('blank', [B('sketch', { h: 30 }), B('lines', { n: 4 })])));
ok(validateBook(book).length === 0, 'a book with four edited block pages validates');
{
  const want = assemble(await fresh(MONTH), listFor(book, null)), got = flowBook(listFor(book, null), cat);
  ok(got.missing.length === 0 && got.pages.length === want.pages.length && got.pages.every((p, i) => p.id === want.pages[i].id && p.html === want.pages[i].html), `flowBook (the editor) and assemble (the print build) make the same ${want.pages.length} pages, html included, for edited block pages`);
  const html = (id) => want.pages.find((p) => p.id === id).html;
  ok(html('notes_1').includes('data-zone="title"') && html('notes_1').includes('data-zone="date"') && html('notes_1').includes('data-zone="tags"'), 'the DATE / TITLE / TAGS header is on the Notes page and stays fixed');
  ok(html('notes_2').includes('class="gg"') && /data-zone="good"/.test(html('notes_2')) && /data-zone="body"/.test(html('notes_2')), 'a grid Notes page carries a data-zone on every block');
  ok(!html('blank').includes('data-zone="date"') && html('blank').includes('class="gg"'), 'the blank page has no header and does have its grid');
  ok(html('collection_1').includes('class="log ruled') || html('collection_1').includes('ruled log'), 'a Collection page starts with ruled lines');
}

// ---- 5. it builds ----
{
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'kw-blockpages-')); process.on('exit', () => fs.rmSync(TMP, { recursive: true, force: true }));
  const lib = libraryFromProfile(PROFILE); lib.layouts = [{ id: 'mine', name: 'Block pages', book }]; lib.books[0].layoutRef = 'mine';
  const file = path.join(TMP, 'library.json'); fs.writeFileSync(file, JSON.stringify(lib));
  const OUT = 'out/blockpages-test', env = { ...process.env, KW_OUT: OUT, KW_LIBRARY: file };
  fs.rmSync(OUT, { recursive: true, force: true });
  const run = (s, a, x = {}) => execFileSync('node', [s, ...a], { env: { ...env, ...x }, stdio: 'pipe' }).toString();
  run('render.mjs', ['month', MONTH, 'test.ics']);
  const dir = `${OUT}/m${MONTH}`, lay = JSON.parse(fs.readFileSync(`${dir}/layout.json`, 'utf8'));
  const page = (id) => lay.pages.find((p) => p.id === id);
  for (const id of ['notes_1', 'notes_2', 'collection_1', 'collection_2', 'blank']) ok(page(id) && page(id).zones.length > 0, `${id} is in the book and has scan zones`);
  const names = (id) => page(id).zones.map((z) => z.zone);
  ok(['date', 'title', 'tags', 'body'].every((z) => names('notes_1').includes(z)) && names('notes_1').includes('checks'), 'notes_1 maps the header zones and each block (' + names('notes_1').join(', ') + ')');
  ok(names('notes_2').includes('good') && names('notes_2').includes('split') && names('notes_2').includes('body'), 'notes_2 (grid) maps each block to its cell rectangle');
  ok(!names('blank').includes('date') && names('blank').includes('sketch') && names('blank').includes('lines'), 'blank maps its blocks and has no header');
  ok(names('notes_1').includes('page_code') || names('notes_1').includes('send_to'), 'the scan strip and page code are still there on a block page');
  ok(/\[\] 0/.test(run('check.mjs', [`m${MONTH}`])), 'check.mjs: every block page fits ("[] 0")');
  ok(/ok/i.test(run('check-pages.mjs', [dir])), 'check-pages: page identity holds');
  ok(/ok/.test(run('check-codes.mjs', [dir], { DECODE: 'sample' })), 'check-codes: codes are unique and decode');
  fs.writeFileSync(`${OUT}/block-pages-book.json`, bookJson(book));
}
console.log(`test-blockpages: ${n} checks passed`);
