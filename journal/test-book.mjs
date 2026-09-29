// Book layout test (no browser): DEFAULT_BOOK and content/book.json validate; bad files get clear messages; the renderer's page
// sequence follows the book (hide, move, per-month override) while alignment, padding and page references stay automatic.
//   node test-book.mjs
import fs from 'node:fs';
import { loadContext } from './context.mjs';
import { DEFAULT_BOOK, validateBook, assemble, entriesFor } from './book.mjs';

const fails = [], ok = (c, m) => { if (!c) fails.push(m); console.log((c ? 'ok   ' : 'FAIL ') + m); };
const clone = (x) => JSON.parse(JSON.stringify(x));
const errsOf = (mut) => { const b = clone(DEFAULT_BOOK); mut(b); return validateBook(b); };
const has = (errs, re) => errs.some((e) => re.test(e));
const top = (b, type) => b.default.find((e) => e.type === type);

ok(validateBook(DEFAULT_BOOK).length === 0, 'DEFAULT_BOOK is valid');
if (fs.existsSync('content/book.json')) ok(validateBook(JSON.parse(fs.readFileSync('content/book.json', 'utf8'))).length === 0, 'content/book.json is valid');

// clear messages
let e;
e = errsOf((b) => { top(b, 'safety').on = false; });
ok(has(e, /My safety plan can be moved but not hidden/), 'safety plan cannot be hidden: ' + e[0]);
e = errsOf((b) => { top(b, 'support').on = false; }); ok(has(e, /Support can be moved but not hidden/), 'support cannot be hidden');
e = errsOf((b) => { top(b, 'closing').on = false; }); ok(has(e, /Closing the month can be moved but not hidden/), 'closing cannot be hidden');
e = errsOf((b) => { b.default = b.default.filter((x) => x.type !== 'closing'); }); ok(has(e, /Closing the month must stay in every book/), 'closing cannot be removed');
e = errsOf((b) => { b.default.push({ id: 'theme2', type: 'theme', on: true }); }); ok(has(e, /Season theme is listed twice/), 'a page type cannot repeat (except Notes)');
e = errsOf((b) => { b.default.push({ id: 'n1', type: 'notes' }, { id: 'n2', type: 'notes', options: { title: 'Ideas' } }); }); ok(e.length === 0, 'Notes pages can repeat and take a title');
e = errsOf((b) => { b.default.push({ id: 'title', type: 'notes' }); }); ok(has(e, /id "title" is used twice/), 'duplicate ids are named');
e = errsOf((b) => { b.default.push({ id: 'notes.3', type: 'notes' }); }); ok(has(e, /reserved for automatic padding/), 'padding ids are reserved');
e = errsOf((b) => { b.default.push({ id: 'x', type: 'nope' }); }); ok(has(e, /unknown page type "nope"/), 'unknown type');
e = errsOf((b) => { top(b, 'weeks').options.week.push({ id: 'x', type: 'theme' }); }); ok(has(e, /Season theme is a book-level page/), 'a book page cannot go in the week list');
e = errsOf((b) => { b.default.push({ id: 'x', type: 'days' }); }); ok(has(e, /Day pages is a week-level page/), 'a week page cannot sit at the top');
e = errsOf((b) => { b.default = b.default.filter((x) => x.type !== 'weeks'); }); ok(has(e, /needs one "weeks" group/), 'the weeks group is required');
e = errsOf((b) => { top(b, 'weeks').on = false; }); ok(has(e, /cannot be hidden/), 'the weeks group cannot be hidden');
e = errsOf((b) => { b.default.push({ id: 'n', type: 'notes', options: { colour: 'red' } }); }); ok(has(e, /unknown option "colour"/), 'unknown option');
e = errsOf((b) => { b.default.push({ id: 'n', type: 'notes', on: 'yes' }); }); ok(has(e, /"on" must be true or false/), '"on" must be boolean');
e = errsOf((b) => { b.version = 2; }); ok(has(e, /version: must be 1/), 'version');
e = errsOf((b) => { b.months = { '2027-2': { pages: [] } }; }); ok(has(e, /month keys look like 2027-02/), 'month key format');
e = errsOf((b) => { b.months = { '2027-02': { pages: [{ id: 'title', type: 'title' }] } }; }); ok(has(e, /months\.2027-02\.pages: needs one "weeks" group/) && has(e, /must stay in every book/), 'a month override is checked the same way');
ok(validateBook(null)[0].includes('must be an object') && validateBook([]).length > 0, 'not an object');

// The sequence follows the book
const ctx = await loadContext({ month: '2026-10', ics: 'test.ics', quiet: true });
const ids = (r) => r.pages.map((p) => p.id);
const base = assemble(ctx, DEFAULT_BOOK.default);
const spread = (r, id) => { const i = ids(r).indexOf(id); return i < 0 ? 0 : i + 1; };
const evenRecto = (r) => r.pages.every((p, i) => (p.type !== 'exchange_l' || (i + 1) % 2 === 0) && (p.type !== 'exchange_r' || (i + 1) % 2 === 1) && (p.type !== 'week_left' || (i + 1) % 2 === 0) && (p.type !== 'month_cal' || (i + 1) % 2 === 0));
ok(base.pages.length % 2 === 0 && evenRecto(base), 'default: even count, spreads face');
const alt = clone(DEFAULT_BOOK);
top(alt, 'trans_support').on = false; top(alt, 'bus').on = false; top(alt, 'theme').on = false;
const wk = top(alt, 'weeks'); wk.options.month = wk.options.month.filter((x) => x.type !== 'month_moon'); wk.options.week = wk.options.week.filter((x) => x.type !== 'week_review');
alt.default.splice(alt.default.findIndex((x) => x.type === 'lineage'), 0, { id: 'extra', type: 'notes', on: true, options: { title: 'Ideas' } });
const r = assemble(ctx, alt.default);
ok(!ids(r).includes('trans_support') && !ids(r).some((x) => x.startsWith('bus.')) && !ids(r).includes('theme') && !ids(r).includes('month.moon') && !ids(r).some((x) => x.endsWith('.review')), 'hidden pages are not built');
ok(ids(r).includes('extra') && r.pages.find((p) => p.id === 'extra').label === 'Ideas', 'an added Notes page appears with its title');
ok(r.pages.length % 2 === 0 && evenRecto(r), 'still an even count with spreads facing');
ok(r.refs.theme === undefined && !r.pages.find((p) => p.id === 'anatomy').html.includes('(page '), 'hidden theme page: the How to use it page drops the pointer');
ok(!r.pages.find((p) => p.id === 'anatomy').html.includes('Bus times p.') && r.pages.find((p) => p.id === 'anatomy').html.includes('Where each piece comes from p. ' + r.refs.lineage), 'hidden bus pages: pointer dropped, lineage pointer resolved');
ok(r.pages.every((p) => !/\{\{P_/.test(p.html)), 'no unresolved page references');
// move the tracker to the very back: the Closing page follows it
const mv = clone(DEFAULT_BOOK); const mw = top(mv, 'weeks'); const [trk] = mw.options.month.splice(mw.options.month.findIndex((x) => x.type === 'month_tracker'), 1);
mv.default.splice(mv.default.findIndex((x) => x.type === 'closing'), 0, { ...trk, scope: undefined });
ok(validateBook(mv).some((m) => /Month tracker is a month-level page/.test(m)), 'a month page moved to the book list is refused with a hint');
// per-month override
const ov = clone(DEFAULT_BOOK); ov.months['2026-11'] = { pages: clone(DEFAULT_BOOK.default).filter((x) => x.type !== 'trans_support') };
ok(validateBook(ov).length === 0, 'per-month override validates');
ok(entriesFor(ov, '2026-11').every((x) => x.type !== 'trans_support') && entriesFor(ov, '2026-10').some((x) => x.type === 'trans_support'), 'override applies to its month only');
// hardcover padding
const hc = assemble(ctx, DEFAULT_BOOK.default, { hardcover: true });
ok(hc.pages.length >= 76 && hc.pages.length % 2 === 0, `hardcover pads to >= 76 (${hc.pages.length})`);
const tiny = assemble(ctx, [DEFAULT_BOOK.default.find((x) => x.type === 'title'), { id: 'weeks', type: 'weeks', on: true, options: { month: [], week: [] } }]);
ok(tiny.pages.length === 24, 'paperback pads to >= 24');
// a page pointing at a page that is not there is an error, not a "?" in print
const dangling = [{ id: 'care_plan', type: 'care_plan', on: true }, { id: 'weeks', type: 'weeks', on: true, options: { month: [], week: [] } }];
let msg = ''; try { assemble(ctx, dangling); } catch (x) { msg = x.message; }
ok(/points to page "support"/.test(msg), 'a dangling page reference is an error: ' + msg);
if (fails.length) { console.log(`\n${fails.length} failed`); process.exit(1); }
