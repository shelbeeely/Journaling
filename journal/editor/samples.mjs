// Sample pages for the editor: every page type of the book, built by the same pages.mjs the print build uses, from the
// generic sample calendar (test.ics), never a private one. The editor's page canvas draws these; the smoke test checks them.
import { loadContext, loadBook } from '../context.mjs';
import { assemble, DEFAULT_BOOK } from '../book.mjs';
import { PAGE_TYPES, notesPage } from '../pages.mjs';
import { typeMeta, NOTES_MARK, flatIds } from '../bookedit.mjs';
import { firstMonthId } from '../profile.mjs';

export const fresh = async (month) => {
  const ctx = await loadContext({ month, ics: 'test.ics', size: 'small', quiet: true });
  ctx.CLINIC = null; // a real clinic's details do not belong in a public editor
  ctx.keeperPage = undefined; // the Keeper's page numbers are per person
  ctx.lenient = true; // the editor's sample pages are drawn at 5.5x8.5 even for a photo frame that only fits 8.5x11 (the print build says no; the editor only shows it)
  return ctx;
};
const allOn = (list) => list.map((e) => ({ ...e, on: true, ...(e.options && e.type === 'weeks' ? { options: { month: allOn(e.options.month || []), week: allOn(e.options.week || []) } } : {}) }));


// The catalog the page organiser lays the book out from in the browser (bookedit.mjs flowBook): what each page type makes for the
// sample month and its weeks, before {{P_x}} pointers are filled. Same builders, same sample calendar, so what the organiser
// shows is what assemble() prints.
export async function catalog(month, book) {
  const ctx = await fresh(month); ctx.refs = {};
  const D = ctx.D, occ = {}, last = D.weeks[D.weeks.length - 1];
  const monthStartWeek = (M) => D.weeks.find((W) => W.days.some((d) => d.m === M.m && d.y === M.y));
  // Some pages phrase themselves by whether the book has another page ("Pick a theme (page 8)"): they read ctx.refs while their html is
  // made. Each is built once for every combination of the pages it looks at, and the organiser picks the one the book it lays out needs.
  const REFKEYS = new Set(Object.values(PAGE_TYPES).map((t) => t.ref).filter(Boolean));
  const pack = (specs) => specs.map((s) => {
    const read = new Set();
    const build = (present) => { ctx.refs = new Proxy({}, { get: (_, k) => (typeof k === 'string' && REFKEYS.has(k) ? (read.add(k), present.has(k) ? 1 : undefined) : undefined) }); return s.html(); };
    const all = build(REFKEYS), keys = [...read];
    if (!keys.length) return { ...s, html: all };
    const variants = []; for (let m = 0; m < 1 << keys.length; m++) variants.push(build(new Set(keys.filter((_, i) => (m >> i) & 1))));
    return { ...s, html: null, refKeys: keys, variants };
  });
  for (const [key, T] of Object.entries(PAGE_TYPES)) {
    if (key === 'notes' || key === 'collection') continue; // made from the entry (its title, its layout), not per month or week
    const entry = { id: key, type: key, on: true, options: {} };
    if (T.module && ctx.PROFILE && ctx.PROFILE.modules[T.module] === false) { occ[key] = T.scope === 'book' ? [[]] : T.scope === 'month' ? D.months.map(() => []) : D.weeks.map(() => []); continue; }
    if (T.scope === 'book') occ[key] = [pack(T.build(ctx, { entry }))];
    else if (T.scope === 'month') occ[key] = D.months.map((M) => pack(T.build(ctx, { M, entry })));
    else occ[key] = D.weeks.map((W) => {
      const endsHere = W.days[W.days.length - 1].weekday === 0 || (W === last && W.gi === 52);
      return T.when === 'weekEnd' && !endsHere ? [] : pack(T.build(ctx, { W, entry }));
    });
  }
  // Spread days (S1): every day of the sample month as a spread (left page, right page), so the organiser can lay out whichever days a book makes spreads.
  const spreadDays = (PAGE_TYPES.days ? D.weeks.map((W) => { const all = PAGE_TYPES.days.build(ctx, { W, entry: { id: 'days', type: 'days', on: true, options: { format: 'spread' } } }); return pack(all).reduce((a, x, i) => (i % 2 ? (a[a.length - 1].push(x), a) : [...a, [x]]), []); }) : []);
  const months = []; { let [y, m] = month.split('-').map(Number); for (let i = 0; i < 12; i++) { months.push(`${y}-${String(m).padStart(2, '0')}`); if (++m > 12) { m = 1; y++; } } }
  return { meta: typeMeta(PAGE_TYPES), occ, weeks: D.weeks.map((W) => ({ month: D.months.findIndex((M) => monthStartWeek(M) === W), days: W.days.map((d) => ({ date: d.date, weekday: d.weekday })) })), spreadDays, notes: notesPage(NOTES_MARK), dayStart: ctx.PROFILE.day_start_hour, defaultBook: DEFAULT_BOOK, builtIn: flatIds(DEFAULT_BOOK.default), book, months };
}

// The sample book follows content/book.json (else DEFAULT_BOOK). Pages the book hides are listed apart in `hidden` (one per
// hidden entry, the first page it would make), so the canvas can show them dimmed.
export async function samplePages(month = firstMonthId(), bookIn = null) {
  const book = bookIn || loadBook() || DEFAULT_BOOK;
  const { pages, refs } = assemble(await fresh(month), book.default);
  const shown = new Set(pages.map((p) => p.id));
  const full = assemble(await fresh(month), allOn(book.default)).pages;
  const seenType = new Set(), hiddenPages = [];
  for (const p of full) if (!shown.has(p.id) && !p.id.startsWith('notes.') && !seenType.has(p.type)) { seenType.add(p.type); hiddenPages.push(p); }
  const shape = (p, i) => ({ n: i + 1, id: p.id, type: p.type, label: p.label, shared: p.shared, section: p.section, cls: p.cls, protected: !!(PAGE_TYPES[p.type] || {}).protected, html: p.html });
  return { month, refs, catalog: await catalog(month, book), types: Object.entries(PAGE_TYPES).map(([k, t]) => ({ key: k, name: t.name, scope: t.scope, protected: !!t.protected })), pages: pages.map(shape), hidden: hiddenPages.map((p) => ({ ...shape(p, 0), n: 0, hidden: true })) };
}
