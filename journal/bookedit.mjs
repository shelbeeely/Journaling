// The page organiser's brain (Book view, edit mode): lay a book out live, and change it with the rules of book.mjs. Pure and
// import-light (only bookrules.mjs), so the editor inlines it and a Node test runs the very same code.
//   flowBook(entries, cat, opts)   the pages a list of entries makes, in order: the same alignment and padding as book.mjs assemble()
//                                  (test-organiser.mjs proves they agree), from a catalog of the sample book's pages
//   moveEntry / setOn / addEntry / removeEntry / duplicateEntry / setTitle / resetMonth   one change each: { book } or { err }
// `cat` is what editor/samples.mjs puts in pages-sample.json:
//   { meta: typeMeta(PAGE_TYPES), occ: { type: [ [spec, ...], ... ] }, weeks: [{ month: n | -1 }], notes: html with a title marker,
//     defaultBook, builtIn: [ids of the default book] }
// A spec is one page: { id, type, cls, label, shared, html } with {{P_x}} markers still in the html. occ[type][k] is what the page type
// makes for the k-th month (month pages), the k-th week (week pages) or once (the rest); [] where it makes nothing.
// Never hand-set, only shown: recto/verso alignment, padding to an even count (>= 24, hardcover >= 76), page numbers, {{P_x}} refs.
import { validateBookWith, BLOCK_PAGES, REPEATS, dayFormat, WEEKDAY_KEYS, WEEKDAY_NAMES } from './bookrules.mjs';
import { kindPage, isDefaultLayout } from './daypage.mjs';

export const repeatTypes = REPEATS; // the page types a book can hold more than once (Notes, Collection)
export const NOTES_MARK = '\u0001TITLE\u0001';
export const MAX_PAGES = 110;
export const typeMeta = (types) => Object.fromEntries(Object.entries(types).map(([k, t]) => [k, { name: t.name, scope: t.scope, protected: !!t.protected, align: t.align || null, ref: t.ref || null, when: t.when || null, module: t.module || null, options: t.options || {} }]));
const clone = (x) => JSON.parse(JSON.stringify(x));
const escT = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const notesHtml = (cat, title) => cat.notes.split(NOTES_MARK).join(escT(title));
export const fillRefs = (html, refs) => html.replace(/\{\{P_(\w+)\}\}/g, (_, k) => refs[k.toLowerCase()] ?? '?');
export const checkBook = (book, cat) => validateBookWith(book, cat.meta);
export const bookJson = (book) => JSON.stringify(book, null, 1) + '\n'; // the layout content/book.json is written in
export const sameBook = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ---------- laying out ----------
export function flowBook(entries, cat, opts = {}) {
  const meta = cat.meta, pages = [], refs = {}, hidden = [], dayStart = opts.dayStart !== undefined ? opts.dayStart : cat.dayStart; // the profile's day start, for the photo-a-day block's line
  let sec = 'front', notesN = 0;
  const push = (s, entry, auto) => pages.push({ cls: '', date: '', shared: false, label: '', ...s, section: sec, eid: auto ? '' : entry.id, etype: auto ? 'notes' : entry.type, auto: !!auto });
  const addNotes = () => { notesN++; const t = `Notes ${notesN}`; push({ cls: 'notes', type: 'notes', id: `notes.${notesN}`, label: t, html: notesHtml(cat, t) }, null, true); };
  const alignToVerso = () => { if ((pages.length + 1) % 2 === 1) addNotes(); }; // the next page must be a left-hand (even) page
  const specsOf = (entry, k) => {
    if (REPEATS.includes(entry.type)) { // Notes and Collection pages: the layout of blocks the entry carries (none: the starting page)
      const base = entry.type === 'notes' ? 'Notes' : 'Collection', t = (entry.options && entry.options.title) || base;
      const html = entry.layout ? kindPage(entry.type, t, entry.layout, opts.size, { pageId: entry.id, dayStart }) : entry.type === 'notes' ? notesHtml(cat, t) : kindPage('collection', t, null, opts.size, { dayStart });
      return [{ cls: 'notes', type: entry.type, id: entry.id, label: t, html }];
    }
    if (entry.type === 'blank' && entry.layout) return [{ cls: '', type: 'blank', id: 'blank', label: '', shared: false, html: kindPage('blank', '', entry.layout, opts.size, { pageId: entry.id, dayStart }) }];
    if (entry.type === 'days') return daySpecs(entry, k);
    return ((cat.occ || {})[entry.type] || [])[k] || [];
  };
  // The week's day pages: one page a day, or a spread (two pages) for the days the entry's options say (bookrules.mjs dayFormat). The catalog has both.
  const daySpecs = (entry, k) => {
    const singles = ((cat.occ || {}).days || [])[k] || [], pairs = (cat.spreadDays || [])[k], wd = ((cat.weeks || [])[k] || {}).days;
    if (!singles.length || !pairs || !wd || !Object.keys(entry.options || {}).length) return singles;
    return wd.flatMap((d, i) => (dayFormat(entry.options, d) === 'spread' ? pairs[i] : [singles[i]]));
  };
  const emit = (entry, k) => {
    if (entry.on === false) return;
    const specs = specsOf(entry, k);
    if (!specs.length) return;
    const T = meta[entry.type];
    if (T.align === 'verso') alignToVerso();
    if (T.ref && refs[T.ref] === undefined) refs[T.ref] = pages.length + 1;
    specs.forEach(({ align, ...s }) => { if (align === 'verso') alignToVerso(); push(s, entry); }); // (a spread day asks for a left-hand page of its own)
  };
  for (const entry of entries) {
    if (entry.type !== 'weeks') { emit(entry, 0); continue; }
    const o = entry.options || {};
    (cat.weeks || []).forEach((w, wi) => {
      if (w.month >= 0) { sec = 'month'; for (const s of o.month || []) emit(s, w.month); }
      sec = 'week'; for (const s of o.week || []) emit(s, wi);
    });
    sec = 'back';
  }
  const min = opts.hardcover ? 76 : 24;
  while (pages.length < min || pages.length % 2) addNotes();
  // pages the book leaves out: one card per switched-off entry (the first page it would make)
  const seen = (list) => { for (const e of list) { if (e.type === 'weeks') { seen((e.options && e.options.month) || []); seen((e.options && e.options.week) || []); continue; } if (e.on !== false) continue; const s = specsOf(e, 0).length ? specsOf(e, 0)[0] : ((cat.occ || {})[e.type] || []).flat()[0]; if (s) hidden.push({ cls: '', date: '', shared: false, label: '', ...s, section: '', eid: e.id, etype: e.type, auto: false, hidden: true }); } };
  seen(entries);
  // {{P_x}} pointers: filled where the page exists, listed where it does not (the build refuses those)
  const miss = new Map();
  const htmlOf = (p) => { const h = p.variants ? p.variants[p.refKeys.reduce((m, k, i) => m | (refs[k] !== undefined ? 1 << i : 0), 0)] : p.html; delete p.variants; delete p.refKeys; return h; };
  pages.forEach((p, i) => {
    p.html = htmlOf(p);
    for (const m of p.html.matchAll(/\{\{P_(\w+)\}\}/g)) {
      const k = m[1].toLowerCase();
      if (refs[k] !== undefined) continue;
      const tt = Object.entries(meta).find(([, t]) => t.ref === k);
      const g = miss.get(k) || { ref: k, target: tt ? tt[1].name : k, targetType: tt ? tt[0] : k, from: [] };
      const who = (meta[p.etype] || {}).name || p.label || p.id; if (!g.from.includes(who)) g.from.push(who); miss.set(k, g);
    }
    p.html = fillRefs(p.html, refs); p.n = i + 1;
  });
  hidden.forEach((p) => { p.html = fillRefs(htmlOf(p), refs); p.n = 0; });
  return { pages, refs, hidden, missing: [...miss.values()], autoNotes: pages.filter((p) => p.auto).length };
}

// What KDP says about a page count, and what the plan does about it.
export function kdpNote(count, hardcover = false) {
  const lo = hardcover ? 76 : 24;
  if (count > MAX_PAGES) { const v = Math.ceil(count / MAX_PAGES); return { ok: false, volumes: v, text: `${count} pages is over the ${MAX_PAGES}-page limit for one printed book. The plan would split it into about ${v} volumes; take pages out or hide some to keep one book.` }; }
  if (count < lo) return { ok: false, volumes: 1, text: `${count} pages is under the ${lo}-page minimum for ${hardcover ? 'a hardcover' : 'a paperback'}.` };
  return { ok: true, volumes: 1, text: `${count} pages: inside the KDP range (${lo} to ${MAX_PAGES}, ${hardcover ? 'hardcover' : 'paperback'}).` };
}

// ---------- reading a book ----------
export const listFor = (book, mon) => (mon && book.months && book.months[mon] ? book.months[mon].pages : book.default);
export const overridden = (book) => Object.keys(book.months || {}).sort();
const SCOPE_WORDS = { book: 'front and back pages', month: 'month pages (calendar, sky, tracker, moon)', week: 'week pages' };
export function locate(list, id) {
  const at = (arr, scope) => { const i = arr.findIndex((e) => e.id === id); return i < 0 ? null : { arr, i, scope, entry: arr[i] }; };
  let r = at(list, 'book'); if (r) return r;
  for (const w of list) if (w.type === 'weeks') { r = at((w.options && w.options.month) || [], 'month') || at((w.options && w.options.week) || [], 'week'); if (r) return r; }
  return null;
}
const scopeArr = (list, scope) => { if (scope === 'book') return list; const w = list.find((e) => e.type === 'weeks'); if (!w) return null; w.options = w.options || {}; return (w.options[scope] = w.options[scope] || []); };
export const flatIds = (list) => list.flatMap((e) => (e.type === 'weeks' ? [e.id, ...((e.options && e.options.month) || []).map((x) => x.id), ...((e.options && e.options.week) || []).map((x) => x.id)] : [e.id]));
const nameOf = (cat, e) => { if (REPEATS.includes(e.type)) { const w = e.type === 'notes' ? 'Notes' : 'Collection'; return (e.options && e.options.title) || (new RegExp(`^${e.type}_(\\d+)$`).test(e.id) ? `${w} ${e.id.split('_')[1]}` : w); } return e.type === 'weeks' ? 'The weeks' : (cat.meta[e.type] || {}).name || e.type; };
export const entryName = nameOf;
export const PROTECT_WHY = {
  safety: 'My safety plan can move but never be hidden or removed. It must be in every printed book so it is always within reach.',
  support: 'Support can move but never be hidden or removed. Its numbers must be in every printed book.',
  closing: 'Closing the month can move but never be hidden or removed. It is where each month is wrapped up and handed on.',
};
export const protectWhy = (cat, e) => PROTECT_WHY[e.type] || `${nameOf(cat, e)} can move but never be hidden or removed.`;

// ---------- changing a book ----------
function prep(book, mon) { const b = clone(book); if (mon) { b.months = b.months || {}; if (!b.months[mon]) b.months[mon] = { pages: clone(b.default) }; } return { b, list: mon ? b.months[mon].pages : b.default }; }
function tidy(b) { for (const k of Object.keys(b.months || {})) if (sameBook(b.months[k].pages, b.default)) delete b.months[k]; return b; } // an override that says the same as the default is no override
// Every page prints its own title, and the page checks refuse two pages with the same one (check-pages.mjs). Notes pages are the only
// pages whose title a person can set, so a change that leaves two the same (or the same as an automatic "Notes 3") is refused.
export function labelClash(entries, cat) {
  for (const hardcover of [false, true]) {
    const seen = new Map();
    for (const p of flowBook(entries, cat, { hardcover }).pages) { if (!p.label) continue; const k = `${p.label}|${p.date || ''}`; if (seen.has(k)) return { label: p.label, first: seen.get(k), second: p.n }; seen.set(k, p.n); }
  }
  return null;
}
const done = (b, cat, msg, extra = {}, mon = null) => {
  const errs = validateBookWith(b, cat.meta);
  if (errs.length) return { err: `That change would break the book: ${errs[0]}` };
  const c = labelClash(listFor(b, mon), cat);
  if (c) return { err: `That would leave two pages titled "${c.label}" (pages ${c.first} and ${c.second}). Every page needs its own title so it can be told apart and scanned; give one a different title.` };
  return { book: tidy(b), msg, ...extra };
};
const wrongList = (cat, e, scope, tgt, side) => {
  const n = nameOf(cat, e), tn = nameOf(cat, tgt.entry);
  if (e.type === 'weeks') return `The weeks group can only sit at the top level of the book: it can't go ${side} ${tn}, which is inside it.`;
  if (scope === 'book' && (tgt.scope === 'month' || tgt.scope === 'week')) return `${n} can't go ${side} ${tn}: that page is inside the weeks, and only ${SCOPE_WORDS[tgt.scope]} live there. Drop it before the weeks start or after they end.`;
  if (tgt.scope === 'book') return `${n} is one of the ${SCOPE_WORDS[scope]}, so it can only be placed among them, not ${side} ${tn}.`;
  return `${n} is one of the ${SCOPE_WORDS[scope]}. It can only be placed among them, not ${side} ${tn}, which is one of the ${SCOPE_WORDS[tgt.scope]}.`;
};

// spec: { step: -1 | 1 } or { before: id } or { after: id }. Only inside its own list: month pages among month pages, week pages among week pages.
export function moveEntry(book, cat, mon, id, spec) {
  const { b, list } = prep(book, mon), from = locate(list, id);
  if (!from) return { err: 'That page is not in this book.' };
  const e = from.entry, n = nameOf(cat, e);
  let to = -1, arr = from.arr;
  if (spec.step) {
    to = from.i + spec.step;
    if (to < 0 || to >= arr.length) {
      const where = from.scope === 'book' ? `${spec.step < 0 ? 'first' : 'last'} in the book` : `${spec.step < 0 ? 'first' : 'last'} of the ${SCOPE_WORDS[from.scope]}`;
      return { err: from.scope === 'book' ? `${n} is already ${where}.` : `${n} is already ${where}. It stays among them: ${SCOPE_WORDS[from.scope]} can't go past the ends of their own list.` };
    }
  } else {
    const tid = spec.before || spec.after, tgt = locate(list, tid);
    if (!tgt) return { err: 'That page is not in this book.' };
    if (tid === id) return { err: `${n} is already there.` };
    if (tgt.arr !== from.arr) return { err: wrongList(cat, e, from.scope, tgt, spec.before ? 'before' : 'after') };
    to = tgt.i + (spec.after ? 1 : 0); if (to > from.i) to--;
    if (to === from.i) return { err: `${n} is already there.` };
  }
  const [x] = arr.splice(from.i, 1); arr.splice(to, 0, x);
  return done(b, cat, from.scope === 'book' ? '' : `every ${from.scope}`, { id, scope: from.scope }, mon);
}

export function setOn(book, cat, mon, id, on) {
  const { b, list } = prep(book, mon), at = locate(list, id);
  if (!at) return { err: 'That page is not in this book.' };
  const e = at.entry, n = nameOf(cat, e);
  if (!on && e.type === 'weeks') return { err: 'The weeks are the journal itself, so they cannot be hidden.' };
  if (!on && (cat.meta[e.type] || {}).protected) return { err: protectWhy(cat, e), protected: true };
  if ((e.on !== false) === on) return { err: `${n} is already ${on ? 'shown' : 'hidden'}.` };
  e.on = on;
  return done(b, cat, `${on ? 'Showing' : 'Hiding'} ${n}`, { id }, mon);
}

const findType = (list, type) => { for (const arr of [list, ...list.filter((e) => e.type === 'weeks').flatMap((e) => [(e.options || {}).month || [], (e.options || {}).week || []])]) { const h = arr.find((e) => e.type === type); if (h) return h; } return null; };
const BASE = { notes: 'Notes', collection: 'Collection' };
const repTitle = (e) => (e.options && e.options.title) || BASE[e.type];
const flatEntries = (list) => list.flatMap((e) => (e.type === 'weeks' ? [...((e.options || {}).month || []), ...((e.options || {}).week || [])] : [e]));
const repTitles = (list) => new Set(flatEntries(list).filter((e) => REPEATS.includes(e.type)).map(repTitle));
const freshTitle = (list, base) => { const used = repTitles(list); if (!used.has(base) && base !== 'Notes' && base !== 'Collection') return base; let i = 2; while (used.has(`${base} ${i}`)) i++; return `${base} ${i}`; };
const nextRepeatId = (list, type) => { const ids = new Set(flatIds(list)); let i = 1; while (ids.has(`${type}_${i}`)) i++; return `${type}_${i}`; };
// Add a page of `type`. where: { before: id } | { after: id } | {} (the end of its list). Only Notes and Collection pages can be added more than once.
export function addEntry(book, cat, mon, type, where = {}, options = {}) {
  const T = cat.meta[type];
  if (!T || type === 'weeks') return { err: 'That is not a page type you can add.' };
  const { b, list } = prep(book, mon), arr = scopeArr(list, T.scope);
  if (!arr) return { err: 'This book has no weeks group to put that page in.' };
  const have = !REPEATS.includes(type) ? findType(list, type) : null;
  if (have) return { err: `${T.name} is already in this book${have.on === false ? ' (hidden: switch it back on with the eye)' : ''}. Only Notes and Collection pages can be added more than once.` };
  const e = { id: REPEATS.includes(type) ? nextRepeatId(list, type) : type, type, on: true, options: REPEATS.includes(type) ? { title: String(options.title || freshTitle(list, type === 'notes' ? 'Notes page' : 'Collection page')).slice(0, 40) } : {} };
  let at = arr.length;
  const tid = where.before || where.after;
  if (tid) {
    const tgt = locate(list, tid);
    if (!tgt) return { err: 'That page is not in this book.' };
    if (tgt.arr !== arr) return { err: wrongList(cat, e, T.scope, tgt, where.before ? 'before' : 'after') };
    at = tgt.i + (where.after ? 1 : 0);
  }
  arr.splice(at, 0, e);
  return done(b, cat, `Added ${nameOf(cat, e)}`, { id: e.id }, mon);
}

// A page the person added can be deleted; a built-in page (one the default book has) can only be hidden.
export function removeEntry(book, cat, mon, id) {
  const { b, list } = prep(book, mon), at = locate(list, id);
  if (!at) return { err: 'That page is not in this book.' };
  const e = at.entry, n = nameOf(cat, e);
  if ((cat.builtIn || []).includes(id) || e.type === 'weeks') return { err: `${n} is part of the book, so it can be hidden but not deleted. Use the eye to hide it.${(cat.meta[e.type] || {}).protected ? ' ' + protectWhy(cat, e) : ''}` };
  at.arr.splice(at.i, 1);
  return done(b, cat, `Removed ${n}`, { id }, mon);
}

export function duplicateEntry(book, cat, mon, id) {
  const { b, list } = prep(book, mon), at = locate(list, id);
  if (!at) return { err: 'That page is not in this book.' };
  const e = at.entry;
  if (!REPEATS.includes(e.type)) return { err: `Only Notes and Collection pages can be duplicated. ${nameOf(cat, e)} can appear once in a book.` };
  const base = ((e.options && e.options.title) || (e.type === 'notes' ? 'Notes page' : 'Collection page')).replace(/ \d+$/, ''), c = { ...clone(e), id: nextRepeatId(list, e.type), options: { ...(e.options || {}), title: freshTitle(list, base) } };
  at.arr.splice(at.i + 1, 0, c);
  return done(b, cat, `Duplicated ${nameOf(cat, e)}`, { id: c.id }, mon);
}

export function setTitle(book, cat, mon, id, title) {
  const { b, list } = prep(book, mon), at = locate(list, id);
  if (!at || !REPEATS.includes(at.entry.type)) return { err: 'Only Notes and Collection pages have a title you can change.' };
  const t = String(title).trim();
  if (t.length > 40) return { err: 'A title can be up to 40 characters.' };
  at.entry.options = t ? { ...(at.entry.options || {}), title: t } : Object.fromEntries(Object.entries(at.entry.options || {}).filter(([k]) => k !== 'title'));
  return done(b, cat, 'Renamed the page', { id }, mon);
}

export function resetMonth(book, cat, mon) {
  if (!book.months || !book.months[mon]) return { err: 'That month already follows the default.' };
  const b = clone(book); delete b.months[mon];
  return done(b, cat, `${mon} follows the default again`, {}, null);
}

// Set (or clear) the block layout of a Notes, Collection or Blank page (C5a). A layout that says what the page's starting layout says is no layout:
// the entry goes back to carrying none, so the book.json of an untouched page is the one it was.
export function setLayout(book, cat, mon, id, layout) {
  const { b, list } = prep(book, mon), at = locate(list, id);
  if (!at || !BLOCK_PAGES.includes(at.entry.type)) return { err: 'That page is not one with blocks you can edit.' };
  const e = at.entry;
  if (isDefaultLayout(layout, e.type)) delete e.layout; else e.layout = clone(layout);
  return done(b, cat, 'Changed the page', { id }, mon);
}

// ---------- spread days (S1) ----------
// What a day gets: 'page' or 'spread', and where that comes from ('date', 'weekday', 'all' or 'default'). The weekday of a date is its UTC weekday.
const weekdayOf = (date) => new Date(`${date}T12:00:00Z`).getUTCDay();
export function dayFormatOf(book, mon, date) {
  const at = locate(listFor(book, mon), 'days'), o = (at && at.entry.options) || {}, wd = weekdayOf(date), key = WEEKDAY_KEYS[wd];
  const fmt = dayFormat(o, { date, weekday: wd });
  const src = o.dates && o.dates[date] ? 'date' : o.weekdays && o.weekdays[key] ? 'weekday' : o.format ? 'all' : 'default';
  return { format: fmt, source: src, weekday: key, weekdayName: WEEKDAY_NAMES[key], entry: !!at };
}
// One line for the organiser's row of the day pages: which days are spreads ("Sat, Sun spreads · 1 spread day"), '' when none.
export function daySummary(options) {
  const o = options || {}, parts = [];
  if (o.format === 'spread') parts.push('every day a spread');
  const w = WEEKDAY_KEYS.filter((k) => (o.weekdays || {})[k] === 'spread').map((k) => WEEKDAY_NAMES[k].slice(0, 3));
  if (w.length) parts.push(`${w.join(', ')} ${w.length > 1 ? 'are spreads' : 'is a spread'}`);
  const d = Object.values(o.dates || {}).filter((v) => v === 'spread').length;
  if (d) parts.push(`${d} spread ${d > 1 ? 'days' : 'day'} by date`);
  return parts.join(' · ');
}
// Set (or clear, fmt = null) how much room days get. scope: { date } one day, { weekday: 'sat' } every Saturday, { all: true } every day.
// A setting that says what the less specific one already says is dropped, so an untouched book's book.json stays the one it was.
export function setDayFormat(book, cat, mon, scope, fmt) {
  const { b, list } = prep(book, mon), at = locate(list, 'days');
  if (!at) return { err: 'This book has no day pages to change.' };
  const e = at.entry, o = { ...clone(e.options || {}) };
  if (fmt !== null && fmt !== 'page' && fmt !== 'spread') return { err: 'A day is one page or a spread.' };
  const who = scope.date ? 'that day' : scope.weekday ? `every ${WEEKDAY_NAMES[scope.weekday]}` : 'every day';
  if (scope.date) { o.dates = { ...(o.dates || {}) }; if (fmt === null) delete o.dates[scope.date]; else o.dates[scope.date] = fmt; }
  else if (scope.weekday) { if (!WEEKDAY_KEYS.includes(scope.weekday)) return { err: 'That is not a weekday.' }; o.weekdays = { ...(o.weekdays || {}) }; if (fmt === null) delete o.weekdays[scope.weekday]; else o.weekdays[scope.weekday] = fmt; }
  else if (scope.all) { if (fmt === null) delete o.format; else o.format = fmt; }
  else return { err: 'Say which days: one date, a weekday, or all.' };
  // tidy: no setting that repeats the one below it
  if (o.format === 'page') delete o.format;
  for (const k of Object.keys(o.weekdays || {})) if (o.weekdays[k] === (o.format || 'page')) delete o.weekdays[k];
  for (const k of Object.keys(o.dates || {})) if (o.dates[k] === dayFormat({ format: o.format, weekdays: o.weekdays }, { weekday: weekdayOf(k) })) delete o.dates[k];
  for (const k of ['weekdays', 'dates']) if (o[k] && !Object.keys(o[k]).length) delete o[k];
  e.options = o;
  return done(b, cat, `${fmt === 'spread' ? 'Spread' : 'One page'}: ${who}`, {}, mon);
}

// Where the dangling pointers are new: the pointers a change would leave dangling that were not dangling before.
export const newlyMissing = (before, after) => after.filter((m) => !before.some((x) => x.ref === m.ref));
