// The library: several books and series in one project. Pure (no fs, no browser), so the builds, the editor and the studio share it.
//
//   { version: 1,
//     books:   [{ id, title, subtitle?, spineTitle?, slug?, edition?, start?, bookId?, seriesId?,
//                 plan?: { scope, custom, undated, keeper, closing }, layoutRef?, dayLayout?,
//                 modules?: { <module>: true|false }, cover?: { style }, show?: ['cover','titlepage'] }],
//     series:  [{ id, title, subtitle?, order: [book ids], show?: [...],
//                 defaults?: { dayLayout?, cover?: { style }, modules?: {}, plan?: { scope, keeper, closing, undated, edition } } }],
//     layouts: [{ id, name, book?, day? }],      // content/book.json and content/daypage.json shapes; "default" is the project's own
//     defaultBook?: <book id> }                  // the book a build uses when none is named
//
// A book belongs to at most one series (book.seriesId, and series.order lists exactly its members, in order).
// Nothing personal lives here: names, place, coordinates, calendars and packs stay in content/profile.json, which the library
// never reads. A book without a plan is a monthly book (today's default). content/library.json is optional: without it the
// library is the profile's own single book (libraryFromProfile), so today's builds do not change.
//
// Resolution (resolveBook), the one place that decides what a book is:
//   own value of the book  >  its series' defaults  >  the profile / built-in default.
// Title, subtitle, spine title, slug, book id, start month and page structure are the book's own. Inherited from the series unless the
// book says otherwise: day layout, cover style, module switches (per module), plan (scope, keeper, closing, undated counts, edition).
// `from` says where each inherited value came from ('book' | 'series' | 'default'), so an editor can show "from the series".
import { planProblems, BOOK_ID_RE, SCOPES } from './plan.mjs';
import { MODULES } from './modules.mjs';

export const LIBRARY_VERSION = 1;
export const COVER_STYLES = ['night']; // the one cover there is today; a series can name a style once more exist
export const SHOW = ['cover', 'titlepage'];
export const DEFAULT_LAYOUT = 'default';
export const ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const LIMITS = { books: 200, series: 60, layouts: 60, title: 120, subtitle: 200, spine: 40, seriesBooks: 60 };
const PLAN_KEYS = ['scope', 'custom', 'undated', 'keeper', 'closing'];
const SERIES_PLAN_KEYS = ['scope', 'keeper', 'closing', 'undated', 'edition'];

const isObj = (x) => x && typeof x === 'object' && !Array.isArray(x);
const str = (v, max = 1000) => typeof v === 'string' && v.trim() !== '' && v.length <= max;
export const slugify = (s) => String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
const clone = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));

// ---------- validation ----------
// Returns plain sentences (empty = valid). Unknown fields are refused, so a typo never silently does nothing.
export function validateLibrary(lib, { layoutsAllowed = true } = {}) {
  const errs = [];
  const bad = (where, msg) => errs.push(`${where}: ${msg}`);
  if (!isObj(lib)) return ['library: must be an object like {"version":1,"books":[...],"series":[...]}'];
  for (const k of Object.keys(lib)) if (!['version', 'books', 'series', 'layouts', 'defaultBook'].includes(k)) bad(k, 'not a library field (use version, books, series, layouts, defaultBook)');
  if (lib.version !== LIBRARY_VERSION) bad('version', `must be ${LIBRARY_VERSION}, got ${JSON.stringify(lib.version)}`);
  const list = (k, max) => { if (lib[k] === undefined) return []; if (!Array.isArray(lib[k])) { bad(k, 'must be a list'); return []; } if (lib[k].length > max) bad(k, `at most ${max}`); return lib[k]; };
  const books = list('books', LIMITS.books), series = list('series', LIMITS.series), layouts = list('layouts', LIMITS.layouts);
  if (!books.length) bad('books', 'a library needs at least one book');

  const layoutIds = new Set([DEFAULT_LAYOUT]);
  layouts.forEach((l, i) => {
    const at = `layouts[${i}]`;
    if (!isObj(l)) return bad(at, 'must be an object {id, name, book?, day?}');
    for (const k of Object.keys(l)) if (!['id', 'name', 'book', 'day'].includes(k)) bad(`${at}.${k}`, 'not a layout field (use id, name, book, day)');
    if (!(str(l.id, 40) && ID_RE.test(l.id))) bad(`${at}.id`, 'lowercase letters, digits and dashes');
    else if (l.id === DEFAULT_LAYOUT) bad(`${at}.id`, `"${DEFAULT_LAYOUT}" is the project's own layout and cannot be redefined`);
    else if (layoutIds.has(l.id)) bad(`${at}.id`, `"${l.id}" is used twice`);
    else layoutIds.add(l.id);
    if (!str(l.name, 80)) bad(`${at}.name`, 'must be text up to 80 characters');
    for (const k of ['book', 'day']) if (l[k] !== undefined && !isObj(l[k])) bad(`${at}.${k}`, 'must be an object (the shape of content/book.json or content/daypage.json)');
  });
  if (!layoutsAllowed && layouts.length) bad('layouts', 'not allowed here');

  const bookIds = new Set(), seriesIds = new Set(), bookIdCodes = new Map();
  const styleOk = (v, at) => { if (v !== undefined && !(isObj(v) && Object.keys(v).every((k) => k === 'style') && (v.style === undefined || COVER_STYLES.includes(v.style)))) bad(at, `must be {"style": ${COVER_STYLES.map((s) => `"${s}"`).join(' | ')}}`); };
  const modulesOk = (v, at) => { if (v === undefined) return; if (!isObj(v)) return bad(at, 'must be an object of module switches'); for (const [k, x] of Object.entries(v)) { if (!MODULES[k]) bad(`${at}.${k}`, `not a module (use ${Object.keys(MODULES).join(', ')})`); else if (typeof x !== 'boolean') bad(`${at}.${k}`, 'must be true or false'); } };
  const showOk = (v, at) => { if (v !== undefined && !(Array.isArray(v) && v.every((s) => SHOW.includes(s)))) bad(at, `must be a list of ${SHOW.join(', ')}`); };
  const layoutOk = (v, at) => { if (v !== undefined && !layoutIds.has(v)) bad(at, `no layout "${v}" (use ${[...layoutIds].join(', ')})`); };
  const editionOk = (v, at) => { if (v !== undefined && !(Number.isInteger(v) && v >= 1 && v <= 9)) bad(at, 'must be a whole number 1 to 9'); };

  books.forEach((b, i) => {
    const at = `books[${i}]`;
    if (!isObj(b)) return bad(at, 'must be an object');
    for (const k of Object.keys(b)) if (!['id', 'title', 'subtitle', 'spineTitle', 'slug', 'edition', 'start', 'bookId', 'seriesId', 'plan', 'layoutRef', 'dayLayout', 'modules', 'cover', 'show'].includes(k)) bad(`${at}.${k}`, 'not a book field (use id, title, subtitle, spineTitle, slug, edition, start, bookId, seriesId, plan, layoutRef, dayLayout, modules, cover, show)');
    if (!(str(b.id, 40) && ID_RE.test(b.id))) bad(`${at}.id`, 'required: lowercase letters, digits and dashes, e.g. "keeping-watch"');
    else if (bookIds.has(b.id)) bad(`${at}.id`, `"${b.id}" is used twice`);
    else bookIds.add(b.id);
    if (!str(b.title, LIMITS.title)) bad(`${at}.title`, `required: the title printed on the cover and title page (up to ${LIMITS.title} characters)`);
    if (b.subtitle !== undefined && !(typeof b.subtitle === 'string' && b.subtitle.length <= LIMITS.subtitle)) bad(`${at}.subtitle`, `must be text up to ${LIMITS.subtitle} characters`);
    if (b.spineTitle !== undefined && !str(b.spineTitle, LIMITS.spine)) bad(`${at}.spineTitle`, `must be short text up to ${LIMITS.spine} characters (printed on the spine)`);
    if (b.slug !== undefined && !(str(b.slug, 60) && ID_RE.test(b.slug))) bad(`${at}.slug`, 'lowercase letters, digits and dashes (the file-name stem; default: made from the title)');
    if (b.slug === undefined && str(b.title) && !slugify(b.title)) bad(`${at}.slug`, 'the title has no letters or digits to make a file name from: give a slug');
    editionOk(b.edition, `${at}.edition`);
    if (b.start !== undefined && !(typeof b.start === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(b.start))) bad(`${at}.start`, `must look like 2026-10, got ${JSON.stringify(b.start)}`);
    if (b.bookId !== undefined) { if (!BOOK_ID_RE.test(b.bookId || '')) bad(`${at}.bookId`, 'must be 8 characters, digits and capital letters without I L O U; leave it out and the build makes one'); else if (bookIdCodes.has(b.bookId)) bad(`${at}.bookId`, `${b.bookId} is already the scan-code id of "${bookIdCodes.get(b.bookId)}": codes would collide`); else bookIdCodes.set(b.bookId, b.id); }
    if (b.seriesId !== undefined && !str(b.seriesId, 40)) bad(`${at}.seriesId`, 'must be a series id');
    if (b.plan !== undefined) {
      if (!isObj(b.plan)) bad(`${at}.plan`, 'must be an object {scope, custom, undated, keeper, closing}');
      else {
        for (const k of Object.keys(b.plan)) if (!PLAN_KEYS.includes(k)) bad(`${at}.plan.${k}`, `not a plan field (use ${PLAN_KEYS.join(', ')})`);
        errs.push(...planProblems({ ...b.plan, start: b.start }).map((m) => `${at}.plan.${m.replace(/^book\./, '')}`));
      }
    }
    layoutOk(b.layoutRef, `${at}.layoutRef`); layoutOk(b.dayLayout, `${at}.dayLayout`);
    modulesOk(b.modules, `${at}.modules`); styleOk(b.cover, `${at}.cover`); showOk(b.show, `${at}.show`);
  });

  series.forEach((s, i) => {
    const at = `series[${i}]`;
    if (!isObj(s)) return bad(at, 'must be an object');
    for (const k of Object.keys(s)) if (!['id', 'title', 'subtitle', 'order', 'defaults', 'show'].includes(k)) bad(`${at}.${k}`, 'not a series field (use id, title, subtitle, order, defaults, show)');
    if (!(str(s.id, 40) && ID_RE.test(s.id))) bad(`${at}.id`, 'required: lowercase letters, digits and dashes');
    else if (seriesIds.has(s.id)) bad(`${at}.id`, `"${s.id}" is used twice`);
    else seriesIds.add(s.id);
    if (!str(s.title, LIMITS.title)) bad(`${at}.title`, `required: the series title, e.g. "Monthly books" (up to ${LIMITS.title} characters)`);
    if (s.subtitle !== undefined && !(typeof s.subtitle === 'string' && s.subtitle.length <= LIMITS.subtitle)) bad(`${at}.subtitle`, `must be text up to ${LIMITS.subtitle} characters`);
    if (!Array.isArray(s.order) || !s.order.every((x) => typeof x === 'string')) bad(`${at}.order`, 'required: the list of book ids, in order');
    else if (s.order.length > LIMITS.seriesBooks) bad(`${at}.order`, `at most ${LIMITS.seriesBooks} books`);
    showOk(s.show, `${at}.show`);
    if (s.defaults !== undefined) {
      const d = s.defaults, dat = `${at}.defaults`;
      if (!isObj(d)) bad(dat, 'must be an object {dayLayout, cover, modules, plan}');
      else {
        for (const k of Object.keys(d)) if (!['dayLayout', 'cover', 'modules', 'plan'].includes(k)) bad(`${dat}.${k}`, 'not a series default (use dayLayout, cover, modules, plan)');
        layoutOk(d.dayLayout, `${dat}.dayLayout`); styleOk(d.cover, `${dat}.cover`); modulesOk(d.modules, `${dat}.modules`);
        if (d.plan !== undefined) {
          if (!isObj(d.plan)) bad(`${dat}.plan`, 'must be an object');
          else {
            for (const k of Object.keys(d.plan)) if (!SERIES_PLAN_KEYS.includes(k)) bad(`${dat}.plan.${k}`, `not a plan default (use ${SERIES_PLAN_KEYS.join(', ')})`);
            editionOk(d.plan.edition, `${dat}.plan.edition`);
            const { edition, ...p } = d.plan;
            if (p.scope === 'custom') bad(`${dat}.plan.scope`, 'a custom span belongs to one book, not to a series default');
            else errs.push(...planProblems({ ...p, start: '2026-10' }).map((m) => `${dat}.plan.${m.replace(/^book\./, '')}`));
          }
        }
      }
    }
  });

  // membership: a book is in at most one series, and series.order lists exactly the books that say so
  const owner = new Map();
  series.forEach((s, i) => {
    if (!isObj(s) || !Array.isArray(s.order)) return;
    const seen = new Set();
    s.order.forEach((id) => {
      if (seen.has(id)) bad(`series[${i}].order`, `"${id}" is listed twice`); seen.add(id);
      if (!bookIds.has(id)) bad(`series[${i}].order`, `no book "${id}"`);
      else if (owner.has(id) && owner.get(id) !== s.id) bad(`series[${i}].order`, `"${id}" is already in series "${owner.get(id)}": a book belongs to at most one series`);
      else owner.set(id, s.id);
    });
  });
  books.forEach((b, i) => {
    if (!isObj(b)) return;
    if (b.seriesId !== undefined) {
      if (!seriesIds.has(b.seriesId)) bad(`books[${i}].seriesId`, `no series "${b.seriesId}"`);
      else if (owner.get(b.id) !== b.seriesId) bad(`books[${i}].seriesId`, `"${b.seriesId}" does not list "${b.id}" in its order`);
    } else if (owner.has(b.id)) bad(`books[${i}].seriesId`, `series "${owner.get(b.id)}" lists "${b.id}", so the book must say seriesId "${owner.get(b.id)}"`);
  });
  if (lib.defaultBook !== undefined && !bookIds.has(lib.defaultBook)) bad('defaultBook', `no book "${lib.defaultBook}"`);

  // Two monthly books that cover the same months with the same edition print the same scan codes (KW2|edition|yymm|...).
  const monthly = books.filter((b) => isObj(b) && b.start && ((b.plan && b.plan.scope) || seriesScope(series, b) || 'month') === 'month');
  const spans = monthly.map((b) => ({ b, ed: b.edition ?? 1, first: monthIndex(b.start) }));
  for (let x = 0; x < spans.length; x++) for (let y = x + 1; y < spans.length; y++) {
    if (spans[x].ed === spans[y].ed && Math.abs(spans[x].first - spans[y].first) < 12) bad('books', `"${spans[x].b.id}" and "${spans[y].b.id}" are both monthly books of edition ${spans[x].ed} over overlapping months, so their scan codes would repeat: give one a different edition or start 12 months apart`);
  }
  return errs;
}
const monthIndex = (s) => +s.slice(0, 4) * 12 + +s.slice(5) - 1;
const seriesScope = (series, b) => { const s = series.find((x) => isObj(x) && x.id === b.seriesId); return s && s.defaults && s.defaults.plan && s.defaults.plan.scope; };
export function assertLibrary(lib, from = 'content/library.json') {
  const errs = validateLibrary(lib);
  if (errs.length) throw new Error(`${from} is not a valid library:\n  - ${errs.join('\n  - ')}`);
  return lib;
}

// ---------- reading ----------
export const bookOf = (lib, id) => lib.books.find((b) => b.id === id) || null;
export const seriesOf = (lib, id) => (lib.series || []).find((s) => s.id === id) || null;
export const seriesOfBook = (lib, id) => { const b = bookOf(lib, id); return b && b.seriesId ? seriesOf(lib, b.seriesId) : null; };
export const layoutOf = (lib, id) => (id && id !== DEFAULT_LAYOUT ? (lib.layouts || []).find((l) => l.id === id) || null : null);
// The order to show: standalone books and series as the shelf reads them (the order the library lists them; a series sits where its first book is).
export function shelf(lib) {
  const out = [], done = new Set();
  for (const b of lib.books) {
    if (b.seriesId) { if (!done.has(b.seriesId)) { done.add(b.seriesId); out.push({ kind: 'series', series: seriesOf(lib, b.seriesId), books: seriesOf(lib, b.seriesId).order.map((id) => bookOf(lib, id)) }); } }
    else out.push({ kind: 'book', book: b });
  }
  // series with no books yet still show on the shelf
  for (const s of lib.series || []) if (!done.has(s.id)) out.push({ kind: 'series', series: s, books: [] });
  return out;
}

// "Book 3 of 12 in Monthly books" (null for a standalone book)
export function seriesLine(lib, bookId) {
  const s = seriesOfBook(lib, bookId);
  if (!s) return null;
  const n = s.order.indexOf(bookId) + 1;
  return { id: s.id, title: s.title, n, of: s.order.length, line: `Book ${n} of ${s.order.length} in ${s.title}` };
}

// ---------- resolution: one place ----------
// `base` is the profile's own book section (title, slug, edition, start ...): the last fallback, so a partial library still builds.
export function resolveBook(lib, id, base = {}) {
  const b = bookOf(lib, id);
  if (!b) throw new Error(`No book "${id}" in the library (books: ${lib.books.map((x) => x.id).join(', ')}).`);
  const s = seriesOfBook(lib, id), sd = (s && s.defaults) || {};
  const from = {};
  const pick = (name, own, inherited, fallback) => {
    if (own !== undefined) { from[name] = 'book'; return own; }
    if (inherited !== undefined) { from[name] = 'series'; return inherited; }
    from[name] = 'default'; return fallback;
  };
  const bp = b.plan || {}, sp = sd.plan || {};
  const plan = {};
  for (const k of ['scope', 'keeper', 'closing']) { const v = pick(`plan.${k}`, bp[k], sp[k], base[k]); if (v !== undefined) plan[k] = v; }
  const undated = pick('plan.undated', bp.undated, sp.undated, base.undated); if (undated !== undefined) plan.undated = clone(undated);
  const custom = bp.custom !== undefined ? bp.custom : base.custom; if (custom !== undefined && plan.scope === 'custom') plan.custom = clone(custom);
  const modules = {};
  for (const k of Object.keys(MODULES)) { const v = pick(`modules.${k}`, b.modules && b.modules[k], sd.modules && sd.modules[k], undefined); if (v !== undefined) modules[k] = v; else delete from[`modules.${k}`]; }
  const show = pick('show', b.show, s ? s.show : undefined, []);
  const title = b.title;
  const layoutRef = b.layoutRef || DEFAULT_LAYOUT;
  const dayRef = pick('dayLayout', b.dayLayout, sd.dayLayout, layoutRef);
  const r = {
    id: b.id, title, subtitle: b.subtitle !== undefined ? b.subtitle : base.subtitle ?? '', spineTitle: b.spineTitle || null,
    slug: b.slug || slugify(title) || base.slug,
    edition: pick('edition', b.edition, sp.edition, base.edition ?? 1), start: b.start !== undefined ? b.start : base.start,
    bookId: b.bookId || null, plan, modules, show: [...show],
    cover: { style: pick('cover.style', b.cover && b.cover.style, sd.cover && sd.cover.style, COVER_STYLES[0]) },
    layout: { book: layoutRef, day: dayRef },
    series: seriesLine(lib, id), from,
  };
  return r;
}

// The layout files a resolved book builds from: null means "the project's own file" (content/book.json, content/daypage.json).
export function layoutsFor(lib, resolved) {
  const book = layoutOf(lib, resolved.layout.book), day = layoutOf(lib, resolved.layout.day);
  return { book: (book && book.book) || null, day: (day && day.day) || null };
}

// The profile a build sees for one book: the person's profile with the library book laid over its `book` section, modules and the extras.
// Only the book's own fields change; the person, place, packs and paths are never touched.
export function effectiveProfile(profile, lib, bookId) {
  const r = resolveBook(lib, bookId, profile.book);
  const book = { ...profile.book, title: r.title, subtitle: r.subtitle, slug: r.slug, edition: r.edition };
  if (r.start !== undefined) book.start = r.start;
  for (const k of ['scope', 'keeper', 'closing', 'custom', 'undated']) { if (r.plan[k] !== undefined) book[k] = r.plan[k]; else delete book[k]; }
  if (r.bookId) book.id = r.bookId; else delete book.id;
  const out = { ...profile, book, modules: { ...profile.modules, ...r.modules } };
  const lay = layoutsFor(lib, r);
  return { profile: out, library: { book: r.id, spineTitle: r.spineTitle, series: r.series, show: r.show, cover: r.cover, layouts: lay } };
}

// ---------- migration ----------
// A single-book profile (today's) as a library of one standalone book: same title, slug, edition, start, scope and book id, so every
// build is the same one. `modules` are not copied: they stay in the profile until a book or series overrides them.
export function libraryFromProfile(profile, { id } = {}) {
  const b = profile.book || {};
  const bookId = id || (str(b.slug) && ID_RE.test(b.slug) ? b.slug : slugify(b.title || 'book') || 'book');
  const book = { id: bookId, title: b.title, ...(b.subtitle !== undefined ? { subtitle: b.subtitle } : {}), slug: b.slug, edition: b.edition, start: b.start };
  const plan = {};
  for (const k of PLAN_KEYS) if (b[k] !== undefined) plan[k] = clone(b[k]);
  if (Object.keys(plan).length) book.plan = plan;
  if (b.id) book.bookId = b.id;
  for (const k of Object.keys(book)) if (book[k] === undefined) delete book[k];
  return { version: LIBRARY_VERSION, books: [book], series: [], layouts: [], defaultBook: bookId };
}

// ---------- editing helpers (used by the editor and the studio; all return a new library) ----------
export function uniqueId(taken, wanted) {
  const base = slugify(wanted) || 'book';
  if (!taken.includes(base)) return base;
  for (let i = 2; ; i++) if (!taken.includes(`${base}-${i}`)) return `${base}-${i}`;
}
export function addBook(lib, { title = 'Untitled book', seriesId, at, ...rest } = {}) {
  const l = clone(lib), taken = [...l.books.map((b) => b.id), ...(l.series || []).map((s) => s.id)];
  const id = uniqueId(taken, title);
  const b = { id, title, ...rest };
  if (seriesId) b.seriesId = seriesId;
  l.books.push(b);
  if (seriesId) { const s = seriesOf(l, seriesId); s.order.splice(at === undefined ? s.order.length : at, 0, id); }
  return { library: l, id };
}
export function addSeries(lib, { title = 'New series', ...rest } = {}) {
  const l = clone(lib), taken = [...l.books.map((b) => b.id), ...(l.series || []).map((s) => s.id)];
  const id = uniqueId(taken, title);
  (l.series = l.series || []).push({ id, title, order: [], ...rest });
  return { library: l, id };
}
export function removeBook(lib, id) {
  const l = clone(lib);
  l.books = l.books.filter((b) => b.id !== id);
  for (const s of l.series || []) s.order = s.order.filter((x) => x !== id);
  if (l.defaultBook === id) l.defaultBook = l.books[0] && l.books[0].id;
  if (!l.books.length) delete l.defaultBook;
  return l;
}
export function removeSeries(lib, id, { withBooks = false } = {}) { // books go to the shelf as standalone books, or go with it
  const l = clone(lib), s = seriesOf(l, id);
  if (!s) return l;
  if (withBooks) return removeSeries(s.order.reduce((acc, b) => removeBook(acc, b), l), id);
  for (const b of l.books) if (b.seriesId === id) delete b.seriesId;
  l.series = l.series.filter((x) => x.id !== id);
  return l;
}
export function moveBookToSeries(lib, bookId, seriesId, at) { // seriesId null: standalone
  const l = clone(lib), b = bookOf(l, bookId);
  for (const s of l.series || []) s.order = s.order.filter((x) => x !== bookId);
  if (seriesId) { const s = seriesOf(l, seriesId); s.order.splice(at === undefined ? s.order.length : at, 0, bookId); b.seriesId = seriesId; } else delete b.seriesId;
  return l;
}
export function reorderSeries(lib, seriesId, from, to) {
  const l = clone(lib), s = seriesOf(l, seriesId);
  const [x] = s.order.splice(from, 1); s.order.splice(Math.max(0, Math.min(s.order.length, to)), 0, x);
  return l;
}
export function duplicateBook(lib, id) {
  const l = clone(lib), b = bookOf(l, id);
  const taken = [...l.books.map((x) => x.id), ...(l.series || []).map((s) => s.id)];
  const copy = clone(b); copy.id = uniqueId(taken, `${b.id}-copy`); copy.title = `${b.title} (copy)`;
  delete copy.bookId; // every book has its own scan-code id (the build makes one)
  delete copy.slug;
  if (b.plan && b.plan.scope && b.plan.scope !== 'month') { /* a new book id is made at the first build */ } else if (copy.start && (b.edition ?? 1) < 9) copy.edition = (b.edition ?? 1) + 1; // monthly codes hold the edition: a copy takes the next one
  l.books.splice(l.books.findIndex((x) => x.id === id) + 1, 0, copy);
  if (b.seriesId) { const s = seriesOf(l, b.seriesId); s.order.splice(s.order.indexOf(id) + 1, 0, copy.id); }
  return { library: l, id: copy.id };
}

// Scope names for the shelf and sheets
export const SCOPE_NAMES = { month: 'Monthly books', quarter: 'Quarter', season: 'Season', 'half-year': 'Half year', year: 'Year', custom: 'Custom dates', undated: 'Undated' };
export { SCOPES };
