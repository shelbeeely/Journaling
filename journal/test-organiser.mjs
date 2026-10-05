// Page organiser test (no browser): the editor lays a book out with bookedit.mjs flowBook() and changes it with the same rules as
// book.mjs. This proves (1) flowBook agrees with assemble() page for page, (2) each change is allowed or refused with a plain
// reason, (3) what the editor would save validates and really builds: render.mjs, check.mjs, check-pages, check-codes.
//   node test-organiser.mjs        (about a minute: one book build and its checks, into out/organiser-test/)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { DEFAULT_BOOK, validateBook, assemble, entriesFor } from './book.mjs';
import { flowBook, setOn, moveEntry, addEntry, removeEntry, duplicateEntry, setTitle, resetMonth, kdpNote, bookJson, listFor } from './bookedit.mjs';
import { catalog, fresh } from './editor/samples.mjs';
import { libraryFromProfile } from './library.mjs';
import { PROFILE } from './profile.mjs';

let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; console.log('ok   ' + m); };
const MONTH = '2026-10';
const cat = await catalog(MONTH, DEFAULT_BOOK);
const must = (r) => { assert.ok(r.book, r.err); return r.book; };
const e = (r) => r.err || '';

// ---- 1. flowBook = assemble ----
async function same(name, book, mon = null, opts = {}) {
  const entries = listFor(book, mon);
  let want, err = null;
  try { want = assemble(await fresh(MONTH), entries, opts); } catch (x) { err = x; }
  const got = flowBook(entries, cat, opts);
  if (err) { ok(got.missing.length > 0, `${name}: the build refuses it and the organiser lists it as dangling (${got.missing.map((m) => m.ref)})`); return; }
  ok(got.missing.length === 0, `${name}: nothing dangling`);
  ok(got.pages.length === want.pages.length && got.pages.every((p, i) => p.id === want.pages[i].id && p.type === want.pages[i].type && p.section === want.pages[i].section), `${name}: the same ${want.pages.length} pages in the same order, ids, types and sections`);
  ok(got.pages.every((p, i) => p.html === want.pages[i].html) && JSON.stringify(got.refs) === JSON.stringify(want.refs), `${name}: the same html (page pointers filled) and the same references`);
}
await same('default book', DEFAULT_BOOK);
await same('default book, hardcover', DEFAULT_BOOK, null, { hardcover: true });
{
  let b = must(setOn(DEFAULT_BOOK, cat, null, 'key_2', false)); b = must(setOn(b, cat, null, 'lineage', false)); b = must(setOn(b, cat, null, 'week_review', false));
  await same('key continued, lineage and week reviews hidden', b);
  b = must(moveEntry(b, cat, null, 'bus', { before: 'support' })); b = must(moveEntry(b, cat, null, 'month_tracker', { before: 'month_cal' })); b = must(moveEntry(b, cat, null, 'days', { step: -1 }));
  await same('bus before support, tracker first among month pages, days before week right', b);
  b = must(addEntry(b, cat, null, 'notes', { before: 'theme' }, { title: 'Ideas' })); b = must(addEntry(b, cat, null, 'notes', {})); b = must(duplicateEntry(b, cat, null, 'notes_1'));
  await same('three Notes pages added (front, back, a copy)', b); await same('...and hardcover padding', b, null, { hardcover: true });
  ok(validateBook(b).length === 0, 'the result validates');
  const m = must(moveEntry(DEFAULT_BOOK, cat, '2026-11', 'bus', { step: -1 }));
  ok(Object.keys(m.months).join() === '2026-11' && JSON.stringify(m.default) === JSON.stringify(DEFAULT_BOOK.default) && validateBook(m).length === 0, 'a change for one month writes months.2026-11 and leaves the default alone');
  await same('one month with its own pages', m, '2026-11');
  ok(JSON.stringify(entriesFor(m, '2026-10')) === JSON.stringify(DEFAULT_BOOK.default), 'other months keep following the default');
  ok(!resetMonth(m, cat, '2026-11').book.months['2026-11'] && resetMonth(m, cat, '2026-10').err, 'a month goes back to the default (and one that never left says so)');
  const back = must(moveEntry(m, cat, '2026-11', 'bus', { step: 1 }));
  ok(!back.months || !back.months['2026-11'], 'a month override that ends up equal to the default is dropped');
}
for (const t of ['month_tracker', 'theme', 'bus', 'lineage', 'support_x']) { const r = setOn(DEFAULT_BOOK, cat, null, t, false); if (r.book) await same(`hide ${t}`, r.book); }

// ---- 2. the rules, in plain words ----
{
  ok(/My safety plan can move but never be hidden/.test(e(setOn(DEFAULT_BOOK, cat, null, 'safety', false))), 'a protected page cannot be hidden, and says why');
  ok(/Support can move but never be hidden/.test(e(setOn(DEFAULT_BOOK, cat, null, 'support', false))) && /Closing the month can move/.test(e(setOn(DEFAULT_BOOK, cat, null, 'closing', false))), 'Support and Closing the month too');
  ok(/journal itself/.test(e(setOn(DEFAULT_BOOK, cat, null, 'weeks', false))), 'the weeks cannot be hidden');
  ok(/hidden but not deleted/.test(e(removeEntry(DEFAULT_BOOK, cat, null, 'bus'))) && /My safety plan can move/.test(e(removeEntry(DEFAULT_BOOK, cat, null, 'safety'))), 'a built-in page can be hidden, not deleted');
  const m1 = e(moveEntry(DEFAULT_BOOK, cat, null, 'bus', { before: 'month_cal' }));
  ok(/can't go before Month calendar.*inside the weeks.*after they end/.test(m1), 'a book page cannot go among the month pages: ' + m1);
  const m2 = e(moveEntry(DEFAULT_BOOK, cat, null, 'month_moon', { after: 'bus' }));
  ok(/month pages.*only be placed among them, not after Bus times/.test(m2), 'a month page cannot leave the month list: ' + m2);
  const m3 = e(moveEntry(DEFAULT_BOOK, cat, null, 'days', { before: 'month_cal' }));
  ok(/week pages.*not before Month calendar.*month pages/.test(m3), 'a week page cannot go among the month pages: ' + m3);
  ok(/already first in the book/.test(e(moveEntry(DEFAULT_BOOK, cat, null, 'title', { step: -1 }))) && /already last of the week pages/.test(e(moveEntry(DEFAULT_BOOK, cat, null, 'week_exchange', { step: 1 }))), 'the ends of a list are explained');
  ok(/already in this book.*Only Notes pages can be added more than once/.test(e(addEntry(DEFAULT_BOOK, cat, null, 'blank'))), 'a page type that is already there cannot be added twice');
  ok(/hidden: switch it back on/.test(e(addEntry(must(setOn(DEFAULT_BOOK, cat, null, 'blank', false)), cat, null, 'blank'))), 'a hidden one says to switch it back on');
  ok(/Only Notes pages can be duplicated/.test(e(duplicateEntry(DEFAULT_BOOK, cat, null, 'key'))), 'only Notes duplicate');
  ok(/can't go/.test(e(addEntry(DEFAULT_BOOK, cat, null, 'notes', { before: 'week_left' }))), 'a Notes page cannot go inside the weeks');
  ok(/40 characters/.test(e(setTitle(must(addEntry(DEFAULT_BOOK, cat, null, 'notes')), cat, null, 'notes_1', 'x'.repeat(41)))), 'a Notes title has a limit');
  { const two = must(duplicateEntry(must(addEntry(DEFAULT_BOOK, cat, null, 'notes')), cat, null, 'notes_1')), t = (id) => two.default.find((x) => x.id === id).options.title;
    ok(t('notes_1') === 'Notes page' && t('notes_2') === 'Notes page 2', 'added and duplicated Notes pages get their own titles (Notes page, Notes page 2)');
    ok(/two pages titled "Notes page 2"/.test(e(setTitle(two, cat, null, 'notes_1', 'Notes page 2'))) && /two pages titled "Notes 1"/.test(e(setTitle(two, cat, null, 'notes_1', 'Notes 1'))), 'a title another page already prints (even an automatic "Notes 1") is refused'); }
  const nb2 = must(addEntry(must(addEntry(DEFAULT_BOOK, cat, null, 'notes')), cat, null, 'notes'));
  ok(nb2.default.filter((x) => x.type === 'notes').map((x) => x.id).join() === 'notes_1,notes_2' && !!removeEntry(nb2, cat, null, 'notes_1').book, 'an added Notes page gets its own id and can be deleted');
  ok(validateBook(DEFAULT_BOOK).length === 0 && JSON.stringify(DEFAULT_BOOK) === JSON.stringify(JSON.parse(bookJson(DEFAULT_BOOK))) && bookJson(DEFAULT_BOOK).endsWith('\n'), 'nothing changed the default book object; bookJson round-trips');
  ok(kdpNote(80).ok && !kdpNote(112).ok && kdpNote(112).volumes === 2 && !kdpNote(22).ok && !kdpNote(60, true).ok && /24 to 110/.test(kdpNote(80).text), 'KDP notes: 24 to 110 paperback, 76 hardcover, volumes when over');
  let big = DEFAULT_BOOK; for (let i = 0; i < 31; i++) big = must(addEntry(big, cat, null, 'notes'));
  ok(flowBook(big.default, cat).pages.length === 112 && !kdpNote(112).ok, 'thirty-one Notes pages push the sample to 112 pages, over the limit');
  const w = flowBook(DEFAULT_BOOK.default, cat);
  ok(w.pages.find((p) => p.id === 'month.calendar').n % 2 === 0 && w.autoNotes === 3 && w.pages.filter((p) => p.auto).every((p) => p.id.startsWith('notes.')), 'automatic Notes pages are marked (3 in the default book) and the month calendar opens on a left page');
}

// ---- 3. what the editor saves builds ----
{
  let b = must(setOn(DEFAULT_BOOK, cat, null, 'key_2', false));
  b = must(moveEntry(b, cat, null, 'bus', { before: 'support' })); b = must(moveEntry(b, cat, null, 'week_review', { before: 'week_right' }));
  b = must(addEntry(b, cat, null, 'notes', { before: 'theme' }, { title: 'Ideas' })); b = must(duplicateEntry(b, cat, null, 'notes_1'));
  b = must(moveEntry(b, cat, MONTH, 'month_moon', { before: 'month_sky' }));
  const saved = JSON.parse(bookJson(b)); // through the file, as content/book.json
  ok(validateBook(saved).length === 0, 'the book the editor saves validates (validateBook)');
  { const { serializeSnapshot } = await import('../studio/src/snapshot.mjs'), { diffSnapshots } = await import('../studio/src/diff.mjs');
    const snap = serializeSnapshot({ book: saved }), base = serializeSnapshot({});
    ok(JSON.stringify(snap.book.default.map((x) => x.id)) === JSON.stringify(saved.default.map((x) => x.id)) && Object.keys(snap.book.months).join() === Object.keys(saved.months || {}).join(), 'the Studio takes the book as a snapshot part and keeps the order');
    const d = diffSnapshots(base, snap).book;
    ok(d.added.some((x) => x.id === 'notes_1') && d.moved.some((x) => x.id === 'bus') && d.changed.some((x) => x.id === 'key_2'), 'the Studio diff names the change by page id: added Notes, Bus moved, Key continued hidden'); }
  const want = flowBook(entriesFor(saved, MONTH), cat);
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'kw-organiser-')); process.on('exit', () => fs.rmSync(TMP, { recursive: true, force: true }));
  const lib = libraryFromProfile(PROFILE); lib.layouts = [{ id: 'mine', name: 'Organised', book: saved }]; lib.books[0].layoutRef = 'mine';
  const file = path.join(TMP, 'library.json'); fs.writeFileSync(file, JSON.stringify(lib));
  const OUT = 'out/organiser-test', env = { ...process.env, KW_OUT: OUT, KW_LIBRARY: file };
  fs.rmSync(OUT, { recursive: true, force: true });
  const run = (s, a, x = {}) => execFileSync('node', [s, ...a], { env: { ...env, ...x }, stdio: 'pipe' }).toString();
  run('render.mjs', ['month', MONTH, 'test.ics']);
  const dir = `${OUT}/m${MONTH}`, lay = JSON.parse(fs.readFileSync(`${dir}/layout.json`, 'utf8'));
  ok(lay.pages.length === want.pages.length && lay.pages.every((p, i) => p.id === want.pages[i].id), `render.mjs builds the organised book: ${lay.pages.length} pages, in the order the organiser showed`);
  const at = (id) => lay.pages.findIndex((p) => p.id === id) + 1;
  ok(at('bus.net.1') < at('support') && !lay.pages.some((p) => p.id === 'key.2') && at('week.01.review') < at('week.01.right'), 'Bus before Support, Key continued gone, the review before the week plan');
  ok(at('notes_1') > 0 && at('notes_2') === at('notes_1') + 1 && at('theme') === at('notes_2') + 1, 'the added Notes pages sit before the Season theme');
  ok(at('month.moon') < at('month.sky'), 'the moon pages come before the sky page');
  ok(/\[\] 0/.test(run('check.mjs', [`m${MONTH}`])), 'check.mjs: every page fits ("[] 0")');
  ok(/ok/i.test(run('check-pages.mjs', [dir])), 'check-pages: page identity holds');
  ok(/ok/.test(run('check-codes.mjs', [dir], { DECODE: 'sample' })), 'check-codes: codes are unique and decode');
  fs.writeFileSync(`${OUT}/organised-book.json`, bookJson(saved));
}
console.log(`test-organiser: ${n} checks passed`);
