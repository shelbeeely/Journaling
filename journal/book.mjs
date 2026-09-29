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

const ID_RE = /^[a-z0-9_]+(\.[a-z0-9_-]+)*$/;
const PROTECTED = Object.entries(PAGE_TYPES).filter(([, t]) => t.protected).map(([k]) => k);
const nameOf = (type) => (type === 'weeks' ? 'Weeks' : PAGE_TYPES[type] ? PAGE_TYPES[type].name : type);
const isObj = (x) => x && typeof x === 'object' && !Array.isArray(x);

// Every problem in one pass, as plain sentences that say where. Returns [] when the book is fine.
export function validateBook(book) {
  const errs = [];
  const bad = (where, msg) => errs.push(`${where}: ${msg}`);
  if (!isObj(book)) return ['book.json: must be an object like {"version":1,"default":[...]}'];
  if (book.version !== 1) bad('version', `must be 1 (this build reads version 1), got ${JSON.stringify(book.version)}`);
  for (const k of Object.keys(book)) if (!['version', 'default', 'months'].includes(k)) bad(k, 'not a book.json key (use version, default, months)');
  const lists = [['default', book.default]];
  if (book.months !== undefined) {
    if (!isObj(book.months)) bad('months', 'must be an object keyed by month, like {"2027-02": {"pages": [...]}}');
    else for (const [k, v] of Object.entries(book.months)) {
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(k)) bad(`months.${k}`, 'month keys look like 2027-02');
      else if (!isObj(v) || !Array.isArray(v.pages)) bad(`months.${k}`, 'must be {"pages": [ ...entries ]}');
      else lists.push([`months.${k}.pages`, v.pages]);
    }
  }
  for (const [where, list] of lists) {
    if (!Array.isArray(list) || !list.length) { bad(where, 'must be a non-empty list of pages'); continue; }
    checkList(where, list, errs);
  }
  return errs;
}

function checkList(where, list, errs) {
  const bad = (w, msg) => errs.push(`${w}: ${msg}`);
  const ids = new Map(), types = new Map();
  let weeks = 0;
  const walk = (w, items, scope) => {
    if (!Array.isArray(items)) { bad(w, 'must be a list'); return; }
    items.forEach((it, i) => {
      const at = `${w}[${i}]`;
      if (!isObj(it)) { bad(at, 'each page must be an object {id, type, on, options}'); return; }
      const label = `${at}${it.type ? ` (${nameOf(it.type)})` : ''}`;
      if (typeof it.id !== 'string' || !ID_RE.test(it.id)) bad(label, `id must be lowercase words joined by dots, got ${JSON.stringify(it.id)}`);
      else if (/^notes\.\d+$/.test(it.id)) bad(label, `id "${it.id}" is reserved for automatic padding pages`);
      else if (ids.has(it.id)) bad(label, `id "${it.id}" is used twice (also ${ids.get(it.id)}); every page needs its own id`);
      else ids.set(it.id, at);
      for (const k of Object.keys(it)) if (!['id', 'type', 'on', 'options'].includes(k)) bad(label, `unknown key "${k}" (a page has id, type, on, options)`);
      if (it.on !== undefined && typeof it.on !== 'boolean') bad(label, '"on" must be true or false');
      if (it.options !== undefined && !isObj(it.options)) bad(label, '"options" must be an object');
      if (it.type === 'weeks') {
        weeks++;
        if (scope !== 'book') bad(label, 'the weeks group can only sit at the top level');
        if (it.on === false) bad(label, 'the weeks group (the journal itself) cannot be hidden');
        const o = isObj(it.options) ? it.options : {};
        for (const k of Object.keys(o)) if (!['month', 'week'].includes(k)) bad(label, `unknown weeks option "${k}" (use month and week)`);
        walk(`${at}.options.month`, o.month || [], 'month');
        walk(`${at}.options.week`, o.week || [], 'week');
        return;
      }
      const T = PAGE_TYPES[it.type];
      if (!T) { bad(label, `unknown page type "${it.type}". Known: ${Object.keys(PAGE_TYPES).join(', ')}`); return; }
      if (T.scope !== scope) bad(label, `${T.name} is a ${T.scope}-level page; it can't go in the ${scope === 'book' ? 'book' : scope} list${T.scope === 'book' ? '' : ` (put it under the weeks group's "${T.scope}" list)`}`);
      if (T.protected && it.on === false) bad(label, `${T.name} can be moved but not hidden`);
      if (it.type !== 'notes') { if (types.has(it.type)) bad(label, `${T.name} is listed twice (also ${types.get(it.type)}); only Notes pages can repeat`); else types.set(it.type, at); }
      const spec = T.options || {};
      for (const [k, v] of Object.entries(isObj(it.options) ? it.options : {})) {
        if (!spec[k]) bad(label, `unknown option "${k}"${Object.keys(spec).length ? ` (this page has: ${Object.keys(spec).join(', ')})` : ' (this page has no options yet)'}`);
        else if (spec[k].kind === 'text' && (typeof v !== 'string' || v.length > (spec[k].max || 80))) bad(label, `option "${k}" must be text up to ${spec[k].max || 80} characters`);
      }
    });
  };
  walk(where, list, 'book');
  if (!weeks) bad(where, 'needs one "weeks" group (the month pages, week pages and day pages)');
  if (weeks > 1) bad(where, 'has more than one "weeks" group');
  for (const t of PROTECTED) if (!types.has(t)) bad(where, `${nameOf(t)} must stay in every book (it can be moved, not removed)`);
}

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
  const pages = [], refs = (ctx.refs = {});
  let sec = 'front', span = null, notesN = 0;
  const push = (s) => pages.push({ cls: '', date: '', shared: false, label: '', ...s, section: sec, from: span ? span[0] : null, to: span ? span[1] : null });
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
