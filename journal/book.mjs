// The book: which pages a monthly book has and in what order. Pure (no fs), shared by render.mjs and the page editor.
// DEFAULT_BOOK reproduces the original fixed sequence exactly (content/book.json will override it in a later step).
//   { version: 1,
//     default: [ {id, type, on, options}, ... ],           // the order, front to back
//     months: { "2027-02": { pages: [ ... ] } } }          // optional whole-list override for one month's book
// One entry is one page type (pages.mjs PAGE_TYPES). `weeks` is the one group: for every week it lists the week's pages
// (`week`), and before a month's first week the month's pages (`month`). What is never listed, because it is never hand-set:
//   recto/verso alignment (Notes pages appear where a spread needs one), the even page count (>= 24, hardcover >= 76),
//   {{P_x}} page references, scan codes and the Keeper's handoff page number.
import { PAGE_TYPES, notesPage, fillRefs } from './pages.mjs';

const e = (type, options = {}) => ({ id: type, type, on: true, options });
export const DEFAULT_BOOK = {
  version: 1,
  default: [
    e('title'), e('blank'), e('anatomy'), e('key'), e('key_2'), e('care_plan'), e('contacts'), e('theme'),
    { id: 'weeks', type: 'weeks', on: true, options: {
      month: [e('month_cal'), e('month_sky'), e('month_tracker'), e('month_moon')],
      week: [e('week_left'), e('week_right'), e('days'), e('week_review'), e('week_exchange')] } },
    e('month_review'), e('closing'), e('support'), e('trans_support'), e('safety'), e('bus'), e('lineage'),
  ],
  months: {},
};

// Lay the entries out into pages. Returns { pages, refs }: pages in print order, padding included, every page's html finished.
//   opts.hardcover: pad to >= 76 pages (KDP hardcover needs 75+); otherwise >= 24 (KDP paperback minimum). Always an even count.
// A page's `section` and date span (front / month / week / back) ride along into layout.json.
export function assemble(ctx, entries, opts = {}) {
  const pages = [], refs = (ctx.refs = {});
  let sec = 'front', span = null, notesN = 0;
  const push = (s) => pages.push({ cls: '', date: '', shared: false, label: '', ...s, section: sec, from: span ? span[0] : null, to: span ? span[1] : null });
  const addNotes = () => { notesN++; const t = `Notes ${notesN}`; push({ cls: 'notes', type: 'notes', id: `notes.${notesN}`, label: t, html: () => notesPage(t) }); };
  const alignToVerso = () => { if ((pages.length + 1) % 2 === 1) addNotes(); }; // the next page must be a left-hand (even) page
  const emit = (entry, at = {}) => {
    if (entry.on === false) return;
    const T = PAGE_TYPES[entry.type];
    const specs = T.build(ctx, { ...at, entry });
    if (!specs.length) return;
    if (T.align === 'verso') alignToVerso();
    if (T.ref && refs[T.ref] === undefined) refs[T.ref] = pages.length + 1;
    specs.forEach(push);
  };
  const monthStartWeek = (M) => ctx.D.weeks.find((W) => W.days.some((d) => d.m === M.m && d.y === M.y));
  for (const entry of entries) {
    if (entry.type !== 'weeks') { emit(entry); continue; }
    const o = entry.options || {};
    for (const W of ctx.D.weeks) {
      const M = ctx.D.months.find((M) => monthStartWeek(M) === W);
      if (M) { sec = 'month'; span = [M.days[0].date, M.days[M.days.length - 1].date]; for (const s of o.month || []) emit(s, { M }); }
      sec = 'week'; span = [W.days[0].date, W.days[W.days.length - 1].date];
      const endsHere = W.days[W.days.length - 1].weekday === 0 || (W === ctx.D.weeks[ctx.D.weeks.length - 1] && W.gi === 52);
      for (const s of o.week || []) { if (PAGE_TYPES[s.type].when === 'weekEnd' && !endsHere) continue; emit(s, { W }); }
    }
    sec = 'back'; span = null;
  }
  const min = opts.hardcover ? 76 : 24;
  while (pages.length < min || pages.length % 2) addNotes();
  for (const p of pages) {
    const raw = p.html();
    const miss = [...raw.matchAll(/\{\{P_(\w+)\}\}/g)].map((m) => m[1].toLowerCase()).filter((k) => refs[k] === undefined);
    if (miss.length) throw new Error(`Page "${p.label || p.id}" points to page "${miss[0]}", which this book doesn't have. Put that page back or remove the pointer.`);
    p.html = fillRefs(raw, refs);
  }
  return { pages, refs };
}
