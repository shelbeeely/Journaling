// Spread days test (S1, BUILD-PLAN section 12): a day can cover one page (today) or a whole two-page spread.
// Proves (1) the default book and the default day layout are untouched, (2) the rules (format, weekdays, dates) say what is wrong in plain words,
// (3) the spread canvas: 8 x 24, the fold after column 4, nothing crosses it, the layout of each page is a day page's own grid,
// (4) a spread day opens on a left page, its pages keep their own header, strip and code, page counts follow, flowBook (the editor) equals
// assemble (the print build), the KDP limits count the extra pages, and (5) books with spread days really build, in both trims, hardcover and as
// a quarter: check.mjs "[] 0", check-pages, check-codes, check-spreads, no Type 3 fonts, every page's scan zones.
//   node test-spreaddays.mjs        (a few minutes: one month in two trims and hardcover, a quarter; into out/spread-test/)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { DEFAULT_BOOK, validateBook, assemble } from './book.mjs';
import { flowBook, setDayFormat, dayFormatOf, kdpNote, bookJson, listFor, addEntry } from './bookedit.mjs';
import { dayFormat, dayOptionProblems, DAY_FORMATS } from './bookrules.mjs';
import { catalog, fresh } from './editor/samples.mjs';
import { libraryFromProfile } from './library.mjs';
import { PROFILE } from './profile.mjs';
import { newBlock, normalize, defaultSpread, isDefaultSpread, spreadHalf, spreadProblems, spreadPage, gridProblems, findFree, placeBlock, GRIDS, PAGE_KINDS, allowedIn, DEFAULT_LAYOUT } from './daypage.mjs';

let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; console.log('ok   ' + m); };
const MONTH = '2026-10';
const cat = await catalog(MONTH, DEFAULT_BOOK);
const must = (r) => { assert.ok(r.book, r.err); return r.book; };
const B = (t, o = {}, uid = t) => newBlock(t, o, uid);
const withDays = (opts, book = DEFAULT_BOOK) => { const b = structuredClone(book); b.default.find((e) => e.type === 'weeks').options.week.find((e) => e.type === 'days').options = opts; return b; };

// ---- 1. nothing drifts ----
{
  const plain = await fresh(MONTH), a = assemble(plain, DEFAULT_BOOK.default), b = assemble(await fresh(MONTH), withDays({ format: 'page' }).default);
  ok(a.pages.length === b.pages.length && a.pages.every((p, i) => p.html === b.pages[i].html && p.id === b.pages[i].id), 'a days entry that says "page" prints the very same book as one that says nothing');
  ok(JSON.stringify(normalize(null)) === JSON.stringify(normalize({ v: 2, spread: defaultSpread() })), 'a day layout that carries the starting spread is the default layout (nothing to save)');
  ok(!('spread' in normalize(null)) && !('spread' in normalize(JSON.parse(JSON.stringify(normalize(null))))), 'the default day layout has no spread key');
  ok(a.pages.every((p) => !p.spread), 'no page of the default book is a spread day page');
  ok(a.pages.filter((p) => p.type === 'dayp').length === 31, 'the default book has one page a day (31)');
}

// ---- 2. the rules ----
{
  ok(DAY_FORMATS.join() === 'page,spread', 'a day is a page or a spread');
  ok(dayFormat(undefined, { date: '2026-10-03', weekday: 6 }) === 'page' && dayFormat({}, {}) === 'page', 'no options: one page');
  const o = { format: 'page', weekdays: { sat: 'spread' }, dates: { '2026-10-10': 'page', '2026-10-14': 'spread' } };
  ok(dayFormat(o, { date: '2026-10-03', weekday: 6 }) === 'spread', 'a weekday setting beats the default (Saturday)');
  ok(dayFormat(o, { date: '2026-10-10', weekday: 6 }) === 'page', 'a date setting beats the weekday (this Saturday is one page)');
  ok(dayFormat(o, { date: '2026-10-14', weekday: 3 }) === 'spread' && dayFormat(o, { date: '2026-10-15', weekday: 4 }) === 'page', 'a date can be a spread on its own; the other days follow the default');
  ok(dayFormat({ format: 'spread', weekdays: { sun: 'page' } }, { weekday: 0 }) === 'page' && dayFormat({ format: 'spread' }, { weekday: 3 }) === 'spread', 'the book default is the floor');
  ok(dayOptionProblems({ format: 'page', weekdays: { sat: 'spread' }, dates: { '2026-10-03': 'spread' } }).length === 0, 'good options have no problems');
  const bad = (x) => dayOptionProblems(x).join(' | ');
  ok(/must be one of page, spread/.test(bad({ format: 'double' })), 'a wrong format says what the formats are: ' + bad({ format: 'double' }));
  ok(/weekdays are sun, mon/.test(bad({ weekdays: { funday: 'spread' } })) && /dates look like/.test(bad({ dates: { tomorrow: 'spread' } })) && /unknown option/.test(bad({ cols: 3 })), 'wrong weekdays, dates and options are refused in plain words');
  ok(validateBook(withDays({ weekdays: { sat: 'spread', sun: 'spread' } })).length === 0, 'a book with weekend spreads validates');
  ok(/weekdays\.sat must be one of/.test(validateBook(withDays({ weekdays: { sat: 'huge' } })).join(' | ')), 'a bad entry in book.json is reported where it is: ' + validateBook(withDays({ weekdays: { sat: 'huge' } }))[0]);
  const m = structuredClone(DEFAULT_BOOK); m.months = { '2026-11': { pages: structuredClone(withDays({ format: 'spread' }).default) } };
  ok(validateBook(m).length === 0, 'a month can have its own page list with its own day format (the per-month override)');
}

// ---- 3. the spread canvas ----
{
  const S = defaultSpread();
  ok(PAGE_KINDS.spread && PAGE_KINDS.half && GRIDS.spread.cols === 8 && GRIDS.spread.fold === 4 && GRIDS.half.cols === 4 && GRIDS.day.cols === 4, 'a spread is 8 columns (two pages of the day grid) with the fold after column 4');
  ok(GRIDS.spread.rows.small === 24 && GRIDS.spread.rows.letter === 24 && GRIDS.half.rows.small === GRIDS.day.rows.small, 'the rows are the day page\'s: 24 on both trims');
  ok(spreadProblems(S).length === 0 && isDefaultSpread(S), 'the starting spread is valid');
  const L = spreadHalf(normalize(S, 'small', 'spread'), 'L'), R = spreadHalf(normalize(S, 'small', 'spread'), 'R');
  ok(gridProblems(L, 'small').length === 0 && gridProblems(R, 'small').length === 0, 'each page of the starting spread is a valid day-page grid by itself');
  ok(L.blocks.length + R.blocks.length === S.blocks.length && R.blocks.every((b) => b.col >= 1 && b.col + b.colSpan - 1 <= 4), 'the right page is the canvas\'s columns 5 to 8, moved to columns 1 to 4');
  const cross = normalize({ ...S, blocks: S.blocks.map((b) => (b.type === 'lines' ? { ...b, col: 4, colSpan: 2 } : b)) }, 'small', 'spread');
  const probs = gridProblems(cross, 'small');
  ok(probs.some((p) => p.code === 'fold' && /crosses the fold/.test(p.msg)), 'a block across the fold is refused, with the reason: ' + (probs.find((p) => p.code === 'fold') || {}).msg);
  ok(spreadProblems({ ...S, blocks: S.blocks.map((b) => (b.type === 'lines' ? { ...b, col: 4, colSpan: 2 } : b)) }).some((m) => /crosses the fold/.test(m)), 'spreadProblems says so too (book and daypage validation)');
  ok(spreadProblems({ v: 2, kind: 'spread', blocks: [B('sendto')] }).some((m) => /SEND TO/.test(m)) && !allowedIn('spread', 'sendto') && allowedIn('spread', 'sky') && allowedIn('half', 'events'), 'a spread holds the day\'s blocks but not Send-to: each page keeps its own SEND TO strip');
  ok(spreadProblems({ v: 2, kind: 'spread', blocks: [{ ...B('checks'), col: 1, row: 1, colSpan: 9, rowSpan: 1 }, B('body')] }).some((m) => /sticks out of the page/.test(m)), 'a block wider than the spread is refused');
  // free-spot search never straddles the fold, on either page
  const lay = normalize({ v: 2, kind: 'spread', grid: true, blocks: [{ ...B('body'), col: 1, row: 1, colSpan: 4, rowSpan: 20 }] }, 'small', 'spread');
  let all = true; for (const w of [1, 2, 3, 4]) for (let c = 0; c < 8; c++) { const f = findFree(lay, w, 2, 'small'); if (f && Math.ceil(f.col / 4) !== Math.ceil((f.col + f.colSpan - 1) / 4)) all = false; }
  ok(all, 'a free spot is never found across the fold');
  const pl = placeBlock(lay, B('checks'), 'small');
  ok(pl && pl.col + pl.colSpan - 1 <= 8 && Math.ceil(pl.col / 4) === Math.ceil((pl.col + pl.colSpan - 1) / 4), 'a new block is placed wholly on one page');
  ok(normalize({ v: 2, kind: 'spread', blocks: [B('checks')] }, 'small', 'spread').blocks.some((b) => b.type === 'body'), 'a spread keeps a Writing space (one, on one page)');
  // a day layout with a custom spread keeps it, and the spread is cleaned
  const custom = { ...S, blocks: S.blocks.map((b) => (b.type === 'lines' ? { ...b, title: 'My page' } : b)) };
  const day = normalize({ ...normalize(null), spread: custom });
  ok(day.spread && day.spread.kind === 'spread' && day.spread.blocks.find((b) => b.type === 'lines').title === 'My page', 'a custom spread rides in the day layout (daypage.json "spread")');
  ok(JSON.stringify(normalize(day)) === JSON.stringify(day), 'normalizing a day layout with a spread twice changes nothing');
  // pages
  const parts = { header: '<div class="hz">H</div>', headerR: '<div class="hz">HR</div>', sky: '', notes: '', events: '', fact: '', routines: [], day: { date: '2026-10-31', rise: '7:26a', set: '5:58p' } };
  const left = spreadPage(parts, S, 'L', { size: 'small' }), right = spreadPage(parts, S, 'R', { size: 'small' });
  ok(left.includes('>H</div>') && right.includes('>HR</div>') && left.includes('class="gg"') && right.includes('class="gg"'), 'each page prints its own header and its own grid');
  ok(/data-zone="body"/.test(left) && !/data-zone="body"/.test(right) && /data-zone="lines"/.test(right), 'blocks land on the page their columns say');
  let threw = false; try { spreadPage(parts, { ...S, blocks: S.blocks.map((b) => (b.type === 'lines' ? { ...b, col: 4, colSpan: 2 } : b)) }, 'L', { size: 'small' }); } catch (e) { threw = /crosses the fold/.test(e.message); }
  ok(threw, 'a spread that breaks a rule cannot print: the build stops and says why');
}

// ---- 4. the book: flow, alignment, counts, limits ----
const weekends = withDays({ weekdays: { sat: 'spread', sun: 'spread' }, dates: { '2026-10-14': 'spread' } });
{
  const want = assemble(await fresh(MONTH), weekends.default).pages, got = flowBook(listFor(weekends, null), cat);
  const days = want.filter((p) => p.type === 'dayp');
  ok(days.length === 31 + 10, `10 spread days (5 Saturdays, 4 Sundays, one Wednesday) make ${days.length} day pages, 31 + 10`);
  ok(days.filter((p) => p.spread === 'L').length === 10 && days.filter((p) => p.spread === 'R').length === 10, 'ten left pages and ten right pages');
  ok(want.every((p, i) => !p.spread || (p.spread === 'L' ? (i + 1) % 2 === 0 && want[i + 1].spread === 'R' && want[i + 1].id === `${p.id}.cont` && want[i + 1].date === p.date : (i + 1) % 2 === 1)), 'a spread day always starts on a left page, and its right page faces it');
  ok(new Set(want.map((p) => p.id)).size === want.length && new Set(want.map((p) => `${p.label}|${p.date}`)).size === want.length, 'every page has its own id and printed label ("2026-10-03" and "2026-10-03 cont.")');
  ok(want.length % 2 === 0 && want.length >= 24, `the book still has an even page count (${want.length})`);
  ok(got.missing.length === 0 && got.pages.length === want.length && got.pages.every((p, i) => p.id === want[i].id && p.html === want[i].html && (p.spread || '') === (want[i].spread || '')), `flowBook (the editor) and assemble (the print build) make the same ${want.length} pages`);
  const defn = assemble(await fresh(MONTH), DEFAULT_BOOK.default).pages.length;
  ok(want.length > defn, `the extra pages are counted: ${defn} pages a month became ${want.length}`);
  const pads = want.filter((p) => p.id.startsWith('notes.')).length - assemble(await fresh(MONTH), DEFAULT_BOOK.default).pages.filter((p) => p.id.startsWith('notes.')).length;
  ok(pads > 0, `Notes pages are added where a spread day would start on a right-hand page (${pads} more than before)`);
  // everything spread: the limits
  const all = withDays({ format: 'spread' }), allPages = assemble(await fresh(MONTH), all.default, { count: true }).pages.length;
  ok(allPages > 110 && !kdpNote(allPages).ok && /110-page limit/.test(kdpNote(allPages).text), `a month of spreads (${allPages} pages) is over the 110-page limit and the organiser says so`);
  ok(kdpNote(want.length).ok, 'a month with weekend spreads is inside the KDP range');
  ok(flowBook(listFor(all, null), cat).pages.length === allPages, 'flowBook and assemble agree on the count of a book of spreads');
  const hc = assemble(await fresh(MONTH), weekends.default, { hardcover: true }).pages.length, hf = flowBook(listFor(weekends, null), cat, { hardcover: true }).pages.length;
  ok(hc === hf && hc >= 76 && hc % 2 === 0, `hardcover padding follows (${hc} pages)`);
  // the hidden day pages: switching Day pages off removes spreads too
  const off = structuredClone(weekends); off.default.find((e) => e.type === 'weeks').options.week.find((e) => e.type === 'days').on = false;
  ok(assemble(await fresh(MONTH), off.default).pages.every((p) => p.type !== 'dayp'), 'hidden day pages leave no spread pages behind');
  // a month with its own list
  const mo = structuredClone(DEFAULT_BOOK); mo.months = { [MONTH]: { pages: structuredClone(weekends.default) } };
  ok(assemble(await fresh(MONTH), listFor(mo, MONTH)).pages.length === want.length, 'a per-month override takes effect for that month');
}

// ---- 5. changing it (the editor's operations) ----
{
  let b = must(setDayFormat(DEFAULT_BOOK, cat, null, { date: '2026-10-14' }, 'spread'));
  ok(JSON.stringify(b.default.find((e) => e.type === 'weeks').options.week.find((e) => e.type === 'days').options) === '{"dates":{"2026-10-14":"spread"}}', 'one day as a spread writes just that date');
  ok(dayFormatOf(b, null, '2026-10-14').format === 'spread' && dayFormatOf(b, null, '2026-10-14').source === 'date' && dayFormatOf(b, null, '2026-10-15').format === 'page', 'dayFormatOf says what a day gets and where it comes from');
  ok(flowBook(listFor(b, null), cat).pages.filter((p) => p.type === 'dayp').length === 32, 'the page organiser lays out the new spread at once (32 day pages)');
  b = must(setDayFormat(b, cat, null, { weekday: 'sat' }, 'spread'));
  ok(dayFormatOf(b, null, '2026-10-03').source === 'weekday' && dayFormatOf(b, null, '2026-10-03').weekdayName === 'Saturday', 'every Saturday can be a spread');
  b = must(setDayFormat(b, cat, null, { date: '2026-10-10' }, 'page'));
  ok(dayFormatOf(b, null, '2026-10-10').format === 'page' && dayFormatOf(b, null, '2026-10-10').source === 'date', 'one Saturday can still be a single page');
  b = must(setDayFormat(b, cat, null, { date: '2026-10-10' }, 'spread'));
  ok(!JSON.stringify(b).includes('2026-10-10'), 'a date setting that repeats its weekday is dropped (nothing to save)');
  b = must(setDayFormat(b, cat, null, { weekday: 'sat' }, null)); b = must(setDayFormat(b, cat, null, { date: '2026-10-14' }, null));
  ok(JSON.stringify(b) === JSON.stringify(DEFAULT_BOOK), 'clearing every setting gives back the original book.json, byte for byte');
  ok(must(setDayFormat(DEFAULT_BOOK, cat, null, { all: true }, 'page')) && JSON.stringify(must(setDayFormat(DEFAULT_BOOK, cat, null, { all: true }, 'page'))) === JSON.stringify(DEFAULT_BOOK), 'saying "one page" on a book that already is one changes nothing');
  ok(/spread or|one page or a spread/i.test(setDayFormat(DEFAULT_BOOK, cat, null, { all: true }, 'huge').err) && /weekday/.test(setDayFormat(DEFAULT_BOOK, cat, null, { weekday: 'funday' }, 'spread').err), 'a wrong format or weekday is refused with a reason');
  const m = must(setDayFormat(DEFAULT_BOOK, cat, MONTH, { all: true }, 'spread'));
  ok(Object.keys(m.months).join() === MONTH && JSON.stringify(m.default) === JSON.stringify(DEFAULT_BOOK.default), 'in one month only: that month gets its own page list, the default is untouched');
  ok(bookJson(b).endsWith('\n') && validateBook(must(setDayFormat(DEFAULT_BOOK, cat, null, { weekday: 'sun' }, 'spread'))).length === 0, 'what it saves validates');
}

// ---- 6. it builds ----
{
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'kw-spread-')); process.on('exit', () => fs.rmSync(TMP, { recursive: true, force: true }));
  // a spread of its own: sky, events, care and the Writing space on the left; checks, a sketch box and lines on the right, one block on the fold's edge
  const place = (b, col, row, colSpan, rowSpan) => ({ ...b, col, row, colSpan, rowSpan });
  const mine = normalize({ v: 2, kind: 'spread', grid: true, blocks: [
    place(B('sky'), 1, 1, 4, 2), place(B('events'), 1, 3, 4, 2), place(B('care'), 1, 5, 4, 4), place(B('body', { style: 'lines' }), 1, 9, 4, 12), place(B('actions'), 1, 21, 4, 4),
    place(B('checks', { title: 'Habits' }), 5, 1, 4, 2), place(B('sketch', { h: 15 }), 5, 3, 4, 8), place(B('lines', { title: 'Ideas', n: 4 }), 5, 11, 4, 14)] }, 'small', 'spread');
  ok(spreadProblems(mine).length === 0, 'the spread the build uses is valid: ' + spreadProblems(mine).join('; '));
  const dayFile = { ...normalize(null), spread: mine };
  const lib = libraryFromProfile(PROFILE); lib.layouts = [{ id: 'mine', name: 'Spread days', book: weekends, day: dayFile }]; lib.books[0].layoutRef = 'mine';
  const file = path.join(TMP, 'library.json'); fs.writeFileSync(file, JSON.stringify(lib));
  const ROOT = 'out/spread-test'; fs.rmSync(ROOT, { recursive: true, force: true });
  const run = (s, a, env = {}) => execFileSync('node', [s, ...a], { env: { ...process.env, KW_OUT: ROOT, KW_LIBRARY: file, ...env }, stdio: 'pipe' }).toString();
  const dirOf = (size, hc) => `${ROOT}/m${MONTH}${size === 'letter' ? '-letter' : ''}`;
  for (const [size, hc] of [['small', false], ['letter', false], ['small', true]]) {
    const env = { ...(size === 'letter' ? { SIZE: 'letter' } : {}), ...(hc ? { HARDCOVER: '1' } : {}) }, tag = `${size === 'letter' ? '8.5x11' : '5.5x8.5'}${hc ? ' hardcover' : ''}`;
    if (hc) fs.rmSync(dirOf(size), { recursive: true, force: true });
    run('render.mjs', ['month', MONTH, 'test.ics'], env);
    const dir = dirOf(size), lay = JSON.parse(fs.readFileSync(`${dir}/layout.json`, 'utf8')), P = lay.pages;
    ok(/\[\] 0/.test(run('check.mjs', [`m${MONTH}${size === 'letter' ? '-letter' : ''}`], env)), `${tag}: check.mjs: every page of the spread book fits ("[] 0")`);
    const sp = P.filter((p) => p.spread);
    ok(sp.length === 20 && sp.filter((p) => p.spread === 'L').every((p) => p.page % 2 === 0), `${tag}: ten spread days, twenty pages, each left page on a verso`);
    ok(sp.every((p) => ['date', 'title', 'tags', 'page_code'].every((z) => p.zones.some((q) => q.zone === z)) && p.zones.some((q) => q.zone === 'send_to') && p.frame_inner_mm.w > 0), `${tag}: every page of a spread keeps its own DATE, TITLE, TAGS, SEND TO strip and page code zones`);
    ok(new Set(sp.map((p) => p.code)).size === sp.length && sp.every((p) => /^KW2\|1\|2610\|[SLH]\d{3}$/.test(p.code)), `${tag}: every spread page has its own unique page code`);
    const html = fs.readFileSync(`${dir}/journal.html`, 'utf8');
    const pageHtml = (id) => html.split(/<div class="page /).slice(1).find((x) => x.includes(`data-page-id="${id}"`));
    ok(/cont\./.test(pageHtml('day.2026-10-03.cont')) && !/cont\./.test(pageHtml('day.2026-10-03').split('class="hz"')[1].split('TAGS')[0]), `${tag}: the right page's DATE says "cont."; the left page's does not`);
    const zn = (id, z) => P.find((p) => p.id === id).zones.filter((q) => q.zone === z);
    ok(zn('day.2026-10-03', 'care').length === 1 && zn('day.2026-10-03.cont', 'care').length === 0 && zn('day.2026-10-03.cont', 'checks').length === 1 && zn('day.2026-10-03', 'checks').length === 0, `${tag}: each block's zone is on the page it sits on`);
    ok(zn('day.2026-10-03.cont', 'lines')[0].x >= 0 && zn('day.2026-10-03.cont', 'lines')[0].x + zn('day.2026-10-03.cont', 'lines')[0].w <= lay.pages[0].frame_inner_mm.w + 0.5, `${tag}: nothing leaves its page's frame (the gutter stays clear)`);
    ok(/ok/.test(run('check-pages.mjs', [dir], env)), `${tag}: check-pages: ids and printed labels unique, no page repeats`);
    ok(/ok/.test(run('check-codes.mjs', [dir], { ...env, DECODE: 'all' })), `${tag}: check-codes: codes unique and every page decodes`);
    ok(/ok/.test(run('check-spreads.mjs', [dir], env)), `${tag}: check-spreads: spread days face each other`);
    const pdf = fs.readdirSync(dir).find((f) => f.endsWith('.pdf'));
    ok(!/Type 3/.test(execFileSync('pdffonts', [`${dir}/${pdf}`]).toString()), `${tag}: no Type 3 fonts`);
    if (!hc && size === 'small') fs.copyFileSync(`${dir}/layout.json`, `${ROOT}/layout-small.json`);
  }
  // the default layout builds unchanged when the book has no spread days (the book above has a custom day layout with a spread, but no spread days used)
  const plainLib = libraryFromProfile(PROFILE); plainLib.layouts = [{ id: 'mine', name: 'Spread layout only', day: dayFile }]; plainLib.books[0].layoutRef = 'mine';
  const f2 = path.join(TMP, 'library2.json'); fs.writeFileSync(f2, JSON.stringify(plainLib));
  run('render.mjs', ['month', MONTH, 'test.ics'], { KW_LIBRARY: f2, KW_OUT: `${ROOT}/plain` });
  const plainPages = JSON.parse(fs.readFileSync(`${ROOT}/plain/m${MONTH}/layout.json`, 'utf8')).pages;
  ok(plainPages.length === 80 && plainPages.every((p) => !p.spread), 'a spread layout in daypage.json changes nothing until a day is a spread (80 pages, no spread days)');
  // a quarter: the extra pages count toward the 110-page limit, so the volumes follow
  const prof = structuredClone(JSON.parse(fs.readFileSync('content/profile.json', 'utf8'))); prof.book.scope = 'quarter';
  const pf = path.join(TMP, 'quarter.json'); fs.writeFileSync(pf, JSON.stringify(prof));
  const QOUT = `${ROOT}/quarter`, bf = path.join(TMP, 'book.json'); fs.writeFileSync(bf, JSON.stringify(weekends));
  const planOf = (book) => { if (book) fs.writeFileSync(bf, JSON.stringify(book)); const out = execFileSync('node', ['render.mjs', 'plan', 'test.ics', '--json'], { env: { ...process.env, KW_PROFILE: pf, KW_OUT: QOUT, ...(book ? { KW_BOOKFILE: bf } : {}) }, stdio: 'pipe' }).toString(); return JSON.parse(out.slice(out.indexOf('{'))); };
  const flat = planOf(null), spreadPlan = planOf(weekends);
  const volPages = (p) => p.volumes.map((v) => v.pages);
  ok(spreadPlan.volumes.length >= flat.volumes.length && spreadPlan.pages_as_one_book > flat.pages_as_one_book && volPages(spreadPlan).every((x) => x <= 110), `a quarter with weekend spreads has more pages (${volPages(flat).join('+')} became ${volPages(spreadPlan).join('+')}) and every volume stays within 110`);
}
console.log(`test-spreaddays: ${n} checks passed`);
