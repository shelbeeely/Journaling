// The book: which pages a monthly book has and in what order. Pure (no fs), shared by render.mjs and the page editor.
// content/book.json (from the editor) overrides DEFAULT_BOOK; DEFAULT_BOOK reproduces the original fixed sequence exactly.
//   { version: 1,
//     default: [ {id, type, on, options}, ... ],           // the order, front to back
//     months: { "2027-02": { pages: [ ... ] } } }          // optional whole-list override for one month's book
// One entry is one page type (pages.mjs PAGE_TYPES). `weeks` is the one group: for every week it lists the week's pages
// (`week`), and before a month's first week the month's pages (`month`). What is never listed, because it is never hand-set:
//   recto/verso alignment (Notes pages appear where a spread needs one), the even page count (>= 24, hardcover >= 76),
//   {{P_x}} page references, scan codes and the Keeper's handoff page number.
// Protected pages (Safety plan, Support, Closing the month) can be moved but never hidden or removed.
import { PAGE_TYPES, notesPage, fillRefs } from './pages.mjs';
import { mergeScan, cleanScan } from './scan.mjs';
import { validateBookWith } from './bookrules.mjs';

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

export const validateBook = (book) => validateBookWith(book, PAGE_TYPES);
export function assertBook(book, from = 'content/book.json') {
  const errs = validateBook(book);
  if (errs.length) throw new Error(`${from} is not a valid book:\n  - ${errs.join('\n  - ')}`);
  return book;
}
// Fill gaps with the default (only the version is required to be explicit); a file that is missing or empty means the default book.
export const normalizeBook = (b) => (b && Object.keys(b).length ? b : DEFAULT_BOOK);
// The entries for one month's book (YYYY-MM): its override if it has one, else the default.
export const entriesFor = (book, volId) => (book.months && book.months[volId] ? book.months[volId].pages : book.default);

// Lay the entries out into pages. Returns { pages, refs }: pages in print order, padding included, every page's html finished.
//   opts.hardcover: pad to >= 76 pages (KDP hardcover needs 75+); otherwise >= 24 (KDP paperback minimum). Always an even count.
// A page's `section` and date span (front / month / week / back) ride along into layout.json.
export function assemble(ctx, entries, opts = {}) {
  const pages = [], refs = (ctx.refs = {}), scoped = !!ctx.scoped;
  let sec = 'front', span = null, notesN = 0;
  let scanNow; // the scan settings of the entry being emitted (its own over its group's): rides along on each of its pages
  const push = (s) => pages.push({ cls: '', date: '', shared: false, label: '', ...(scanNow ? { scan: scanNow } : {}), ...s, section: sec, from: span ? span[0] : null, to: span ? span[1] : null });
  const addNotes = () => { notesN++; const t = `Notes ${notesN}`; push({ cls: 'notes', type: 'notes', id: `notes.${notesN}`, label: t, html: () => notesPage(t) }); };
  const alignToVerso = () => { if ((pages.length + 1) % 2 === 1) addNotes(); }; // the next page must be a left-hand (even) page
  const emit = (entry, at = {}) => {
    if (entry.on === false) return;
    const T = PAGE_TYPES[entry.type];
    if (T.module && ctx.PROFILE && ctx.PROFILE.modules[T.module] === false) return; // the profile's module switch: this page is not in this book
    const specs = T.build(ctx, { ...at, entry });
    if (!specs.length) return;
    if (T.align === 'verso') alignToVerso();
    if (T.ref && refs[T.ref] === undefined) refs[T.ref] = pages.length + 1;
    if (scoped && T.ref && at.M && refs[`${T.ref}_${at.M.key.replace('-', '')}`] === undefined) refs[`${T.ref}_${at.M.key.replace('-', '')}`] = pages.length + 1; // {{P_TRACKER_202610}}: that month's page
    scanNow = cleanScan(mergeScan(at.gscan, entry.scan));
    // a page spec can ask for a left-hand page of its own (a spread day, S1): a Notes page is added before it when the page before ended on the left
    specs.forEach(({ align, ...s }) => { if (align === 'verso') alignToVerso(); push(s); });
    scanNow = undefined;
  };
  const monthStartWeek = (M) => ctx.D.weeks.find((W) => W.days.some((d) => d.m === M.m && d.y === M.y));
  // ---- books longer than a month (ctx.scoped, see span.mjs) ----
  // A week belongs to the month its first day (in this volume) is in; a month's pages go before its first week, and its Closing page
  // (when the plan closes each month) after its last week, if the month ends inside this volume. Undated books have no months to
  // close: one Closing page goes where the book's Closing entry is. Only the last week of the last volume always gets a review and an
  // Exchange spread; a week cut by the end of a volume gets them in the volume that holds its Sunday.
  const eomOf = (M) => new Date(Date.UTC(M.y, M.m, 0)).getUTCDate();
  const extras = (ctx.plan && ctx.plan.undated && ctx.plan.undated.extras) || [];
  const skipUndated = (type) => ctx.undated && ((type === 'theme' && !extras.includes('theme')) || (type === 'month_tracker' && !extras.includes('tracker')));
  const lastDay = ctx.D.days[ctx.D.days.length - 1];
  const needsEnd = scoped && (ctx.undated || ctx.closingPolicy === 'end' || lastDay.d !== eomOf(lastDay));
  const closingEntry = entries.find((e) => e.type === 'closing');
  function scopedWeeks(o, gscan) {
    const weeks = ctx.D.weeks;
    let cur = null;
    const monthOf = (W) => (ctx.undated ? ctx.D.months.find((M) => M.startWeek === W.no - 1) : ctx.D.months.find((M) => M.y === W.days[0].y && M.m === W.days[0].m));
    const closeCurrent = () => {
      if (!cur || ctx.undated || ctx.closingPolicy !== 'month' || !closingEntry) return;
      const l = cur.days[cur.days.length - 1];
      if (l.d === eomOf(cur)) { sec = 'month'; span = [cur.days[0].date, l.date]; emit(closingEntry, { M: cur, kind: 'month' }); }
    };
    weeks.forEach((W, wi) => {
      const M = monthOf(W);
      if (M && (ctx.undated || M !== cur)) {
        if (!ctx.undated) closeCurrent();
        cur = M; sec = 'month'; span = ctx.undated ? null : [M.days[0].date, M.days[M.days.length - 1].date];
        for (const s of o.month || []) if (!skipUndated(s.type)) emit(s, { M, gscan });
      }
      sec = 'week'; span = ctx.undated ? null : [W.days[0].date, W.days[W.days.length - 1].date];
      const endsHere = ctx.undated || W.days[W.days.length - 1].weekday === 0 || (wi === weeks.length - 1 && ctx.VOL.isLast);
      for (const s of o.week || []) { if (PAGE_TYPES[s.type].when === 'weekEnd' && !endsHere) continue; emit(s, { W, gscan }); }
    });
    closeCurrent();
    sec = 'back'; span = null;
  }
  for (const entry of entries) {
    if (scoped && entry.type === 'closing') { if (needsEnd) emit(entry, { kind: 'end' }); continue; }
    if (scoped && skipUndated(entry.type)) continue;
    if (entry.type !== 'weeks') { emit(entry); continue; }
    const o = entry.options || {};
    const gscan = entry.scan;
    if (scoped) { scopedWeeks(o, gscan); continue; }
    for (const W of ctx.D.weeks) {
      const M = ctx.D.months.find((M) => monthStartWeek(M) === W);
      if (M) { sec = 'month'; span = [M.days[0].date, M.days[M.days.length - 1].date]; for (const s of o.month || []) emit(s, { M, gscan }); }
      sec = 'week'; span = [W.days[0].date, W.days[W.days.length - 1].date];
      const endsHere = W.days[W.days.length - 1].weekday === 0 || (W === ctx.D.weeks[ctx.D.weeks.length - 1] && W.gi === 52);
      for (const s of o.week || []) { if (PAGE_TYPES[s.type].when === 'weekEnd' && !endsHere) continue; emit(s, { W, gscan }); }
    }
    sec = 'back'; span = null;
  }
  if (ctx.undated && extras.includes('notes')) { addNotes(); addNotes(); }
  const min = opts.hardcover ? 76 : 24;
  while (pages.length < min || pages.length % 2) addNotes();
  if (opts.count) return { pages, refs };
  for (const p of pages) {
    const raw = p.html();
    const miss = [...raw.matchAll(/\{\{P_(\w+)\}\}/g)].map((m) => m[1].toLowerCase()).filter((k) => refs[k] === undefined);
    if (miss.length) throw new Error(`Page "${p.label || p.id}" points to page "${miss[0]}", which this book doesn't have. Put that page back or remove the pointer.`);
    p.html = fillRefs(raw, refs);
  }
  return { pages, refs };
}
