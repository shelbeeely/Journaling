// The rules of a book, pure so the print build, the studio and the page organiser in the editor all check with the very same code.
// book.mjs binds them to pages.mjs' PAGE_TYPES; the editor passes the page-type table that rides in its sample data.
// Every problem comes back as a plain sentence that says where. (scan.mjs is pure too: the editor inlines it.)
import { scanProblems } from './scan.mjs';
import { pageLayoutProblems, PAGE_KINDS } from './daypage.mjs';
// Pages that are made of blocks (C5a): an entry of one of these types may carry a `layout` (daypage.mjs). Notes and Collection pages can repeat.
export const BLOCK_PAGES = ['notes', 'collection', 'blank'].filter((k) => PAGE_KINDS[k]);
export const REPEATS = ['notes', 'collection'];
export const ID_RE = /^[a-z0-9_]+(\.[a-z0-9_-]+)*$/;
const protectedOf = (types) => Object.entries(types).filter(([, t]) => t.protected).map(([k]) => k);
const nameOf = (types, type) => (type === 'weeks' ? 'Weeks' : types[type] ? types[type].name : type);
export const isObj = (x) => x && typeof x === 'object' && !Array.isArray(x);

// ---- spread days (S1, BUILD-PLAN section 12) ----
// The `days` entry (the week's day pages) says how much room each day gets: `format` for every day (default `page`), `weekdays` ({sat: 'spread'}: a
// weekday's own), `dates` ({"2026-10-14": "spread"}: one day's own). The most specific wins. A month with its own page list (`months`) has its own
// `days` entry, so a per-month override is just that. An entry with no options is today's book: one page a day. Pure: shared by the print build,
// the page organiser and the studio.
export const DAY_FORMATS = ['page', 'spread'];
export const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']; // Date.getUTCDay() order (the day data's `weekday`)
export const WEEKDAY_NAMES = { sun: 'Sunday', mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday' };
// day: { date: 'YYYY-MM-DD' (none in an undated book), weekday: 0 (Sunday) to 6 }
export function dayFormat(options, day = {}) {
  const o = isObj(options) ? options : {};
  const pick = (v) => (DAY_FORMATS.includes(v) ? v : null);
  return (day.date && isObj(o.dates) && pick(o.dates[day.date])) || (day.weekday !== undefined && isObj(o.weekdays) && pick(o.weekdays[WEEKDAY_KEYS[day.weekday]])) || pick(o.format) || 'page';
}
export function dayOptionProblems(o, at = 'days') {
  const out = [], bad = (m) => out.push(`${at}: ${m}`);
  if (o === undefined) return out;
  if (!isObj(o)) return [`${at}: "options" must be an object`];
  for (const k of Object.keys(o)) if (!['format', 'weekdays', 'dates'].includes(k)) bad(`unknown option "${k}" (the day pages have format, weekdays and dates)`);
  if (o.format !== undefined && !DAY_FORMATS.includes(o.format)) bad(`"format" must be one of ${DAY_FORMATS.join(', ')}, got ${JSON.stringify(o.format)}`);
  if (o.weekdays !== undefined) {
    if (!isObj(o.weekdays)) bad('"weekdays" must be an object like {"sat": "spread", "sun": "spread"}');
    else for (const [k, v] of Object.entries(o.weekdays)) { if (!WEEKDAY_KEYS.includes(k)) bad(`weekdays.${k}: weekdays are ${WEEKDAY_KEYS.join(', ')}`); else if (!DAY_FORMATS.includes(v)) bad(`weekdays.${k} must be one of ${DAY_FORMATS.join(', ')}, got ${JSON.stringify(v)}`); }
  }
  if (o.dates !== undefined) {
    if (!isObj(o.dates)) bad('"dates" must be an object like {"2026-10-14": "spread"}');
    else for (const [k, v] of Object.entries(o.dates)) { if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) bad(`dates.${k}: dates look like 2026-10-14`); else if (!DAY_FORMATS.includes(v)) bad(`dates.${k} must be one of ${DAY_FORMATS.join(', ')}, got ${JSON.stringify(v)}`); }
  }
  return out;
}

// Every problem in one pass, as plain sentences that say where. Returns [] when the book is fine.
export function validateBookWith(book, PAGE_TYPES) {
  const errs = [];
  const bad = (where, msg) => errs.push(`${where}: ${msg}`);
  if (!isObj(book)) return ['book.json: must be an object like {"version":1,"default":[...]}'];
  if (book.version !== 1) bad('version', `must be 1 (this build reads version 1), got ${JSON.stringify(book.version)}`);
  for (const k of Object.keys(book)) if (!['version', 'default', 'months', 'scan'].includes(k)) bad(k, 'not a book.json key (use version, default, months, scan)');
  errs.push(...scanProblems(book.scan, 'scan'));
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
    checkList(where, list, errs, PAGE_TYPES);
  }
  return errs;
}

function checkList(where, list, errs, PAGE_TYPES) {
  const nameOf_ = (t) => nameOf(PAGE_TYPES, t), PROTECTED = protectedOf(PAGE_TYPES);
  const bad = (w, msg) => errs.push(`${w}: ${msg}`);
  const ids = new Map(), types = new Map();
  let weeks = 0;
  const walk = (w, items, scope) => {
    if (!Array.isArray(items)) { bad(w, 'must be a list'); return; }
    items.forEach((it, i) => {
      const at = `${w}[${i}]`;
      if (!isObj(it)) { bad(at, 'each page must be an object {id, type, on, options}'); return; }
      const label = `${at}${it.type ? ` (${nameOf_(it.type)})` : ''}`;
      if (typeof it.id !== 'string' || !ID_RE.test(it.id)) bad(label, `id must be lowercase words joined by dots, got ${JSON.stringify(it.id)}`);
      else if (/^notes\.\d+$/.test(it.id)) bad(label, `id "${it.id}" is reserved for automatic padding pages`);
      else if (ids.has(it.id)) bad(label, `id "${it.id}" is used twice (also ${ids.get(it.id)}); every page needs its own id`);
      else ids.set(it.id, at);
      for (const k of Object.keys(it)) if (!['id', 'type', 'on', 'options', 'scan', 'layout'].includes(k)) bad(label, `unknown key "${k}" (a page has id, type, on, options, scan, layout)`);
      if (it.layout !== undefined) {
        if (!BLOCK_PAGES.includes(it.type)) bad(label, `only ${BLOCK_PAGES.map((t) => nameOf_(t)).join(', ')} pages have a layout of blocks`);
        else for (const m of pageLayoutProblems(it.layout, it.type)) bad(`${label} layout`, m);
      }
      errs.push(...scanProblems(it.scan, `${label} scan`));
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
      if (!REPEATS.includes(it.type)) { if (types.has(it.type)) bad(label, `${T.name} is listed twice (also ${types.get(it.type)}); only Notes and Collection pages can repeat`); else types.set(it.type, at); }
      if (it.type === 'days') { errs.push(...dayOptionProblems(it.options, label)); return; } // the day pages' own options (spread days)
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
  for (const t of PROTECTED) if (!types.has(t)) bad(where, `${nameOf_(t)} must stay in every book (it can be moved, not removed)`);
}

