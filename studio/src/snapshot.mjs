// The forkable publication source: what a project snapshot may contain, how it is built (an allowlist serializer) and how it is
// checked (a scanner that rejects anything private). Pure: no database, no disk.
//
//   snapshot = { meta, print, book, day, assets, components }
//     meta        title, subtitle, slug, description                 (the book's public identity)
//                 packs?    the public content packs the book uses, by reference only: [{id, kind, version, sha256}] (see serializePackRefs).
//                           Additive like library: a snapshot without it is unchanged. Personal packs (support, trans, clinic, region) never appear.
//                 library?  books and series (journal/library.mjs): the whole library, see serializeLibrary. Additive (L1a): a snapshot
//                           without it is a library of one book (libraryOf), so old commits, hashes and exports are unchanged.
//     print       trim, edition, start, day_start_hour, hardcover, modules   (print settings)
//     book        content/book.json  (page structure; stable page ids)
//     day         content/daypage.json (block layout; stable block uids)
//     assets      [{name, hash, mime, size}]  (bytes live in the assets table, addressed by hash)
//     components  [{id, name, version, page}] (reusable pages; reserved for G3, empty in G1)
//
// NEVER in a snapshot: private pages, filled-in personal data (day entries, answers, mood logs), account settings, profile secrets
// (person, location, crisis lines, paths), calendars (.ics, ICS_URLS), support/trans/clinic packs (a pack is never in a snapshot: only
// a public pack's id, version and hash, in meta.packs; a personal pack is refused even as a reference), passwords, tokens, recovery codes.
// Two layers keep it that way: the serializer only copies allowlisted fields, and the scanner refuses a snapshot (or a raw
// submission) that carries a forbidden key, path or value anywhere in it, however deeply nested.
import { normalize, TYPES, PLACE, newBlock } from '../../journal/daypage.mjs';
import { validateBook, DEFAULT_BOOK } from '../../journal/book.mjs';
import { PAGE_TYPES } from '../../journal/pages.mjs';
import { MODULES } from '../../journal/modules.mjs';
import { kindNames, KINDS } from '../../journal/packs/kinds.mjs';
import { ID_RE, isSemver } from '../../journal/packs/pack.mjs';
import { validateLibrary, libraryFromProfile, LIBRARY_VERSION, DEFAULT_LAYOUT } from '../../journal/library.mjs';
import { StudioError } from './db.mjs';
import { canonical, objectHash } from './canon.mjs';

export const FORMAT = 1;
export const PARTS = ['meta', 'print', 'book', 'day', 'assets', 'components'];
export const ASSET_MIMES = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'image/svg+xml': 'svg', 'font/woff2': 'woff2' };

// ---------- the scanner ----------
// Keys compare lowercased with punctuation removed, so ICS_URLS, ics-urls and icsUrls are one key.
const FORBIDDEN_KEYS = new Set(`password passwd passphrase pwd token accesstoken refreshtoken sessiontoken apikey secret secrets authorization cookie cookies credentials
  ics icsurls calendar calendars events recoverycode recoverycodes recovery
  person location lat lon lng latitude longitude email phone address home
  crisis paths transit profile account accounts settings accountsettings usersettings session sessions
  private privatepages privatenotes support trans clinic packs pack supportpack clinicpack
  entries journalentries filled filledin answers responses moodlog
  log logs checkin checkins devicelog devicelogs device devices devicetoken devicetokens kwlog`.split(/\s+/).filter(Boolean));
const keyId = (k) => String(k).toLowerCase().replace(/[^a-z0-9]/g, '');
const FORBIDDEN_PATH = [
  [/(^|[\\/])private([\\/]|$)/i, 'a private/ path'],
  [/\.ics(\b|$)/i, 'a calendar (.ics) file or link'],
  [/webcal:\/\//i, 'a calendar (webcal) link'],
  [/(^|[\\/])\.env(\.|$)/i, 'an .env file'],
  [/(^|[\\/])profile(\.example)?\.json\b/i, 'the profile file'],
  [/(^|[\\/])(support|support\.generic|trans|clinic)\.json\b/i, 'a support, trans or clinic pack'],
  [/(^|[\\/])packs[\\/]/i, 'a pack folder (packs travel as id and hash only)'],
  [/(^|[\\/])pack\.json\b/i, 'a pack manifest (packs travel as id and hash only)'],
  [/\.(pem|p12|pfx|7z)$/i, 'a key or encrypted archive'],
  [/(^|[\\/])kw[\\/](log|sync|net)\b|(^|[\\/])sync\.txt$/i, "the X4's check-in log or its sync and Wi-Fi files"],
  [/(^|[\\/])\d{4}-\d{2}\.csv$/i, 'a check-in log file'],
];
const FORBIDDEN_VALUE = [
  [/BEGIN:V(CALENDAR|EVENT)/, 'calendar data'],
  [/\bkwd_[0-9a-f]{12}_[A-Za-z0-9_-]{20,}/, 'a device token'],
  [/(^|\n)\d{4}-\d{2}-\d{2}T?\d{2}:\d{2},[a-z][a-z0-9_]*,[^\n]*(\n|$)/, 'check-in log lines'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'a private key'],
  [/\b(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}/, 'a GitHub token'],
  [/github_pat_[A-Za-z0-9_]{20,}/, 'a GitHub token'],
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[A-Za-z0-9.-]+/, 'an email address'],
];

// A pack reference is {id, kind, version, sha256} and nothing else: a pack's files never travel. A personal pack (support numbers,
// personal contacts: the kind's privacy class in journal/packs/kinds.mjs) is refused even as a reference, since its name alone says where someone lives.
const PACK_REF_KEYS = ['id', 'kind', 'version', 'sha256'];
function packRefProblems(list, at) {
  if (list === null) return []; // packs: null drops the references
  if (!Array.isArray(list)) return [{ path: at, rule: 'must be a list of pack references {id, kind, version, sha256}' }];
  const out = [];
  list.forEach((r, i) => {
    const p = `${at}[${i}]`;
    if (!r || typeof r !== 'object' || Array.isArray(r)) { out.push({ path: p, rule: 'must be a pack reference {id, kind, version, sha256}' }); return; }
    for (const k of Object.keys(r)) if (!PACK_REF_KEYS.includes(k)) out.push({ path: `${p}.${k}`, rule: `"${k}" is not part of a pack reference (packs travel as id, kind, version and hash only, never their contents)` });
    if (typeof r.kind === 'string' && Object.prototype.hasOwnProperty.call(KINDS, r.kind) && KINDS[r.kind].privacy !== 'public') out.push({ path: p, rule: `"${r.id}" is a personal ${r.kind} pack: personal packs never travel in a snapshot or a fork` });
  });
  return out;
}

// Returns [{path, rule}] for everything forbidden in a value (empty = clean). `path` is dotted/indexed, e.g. day.blocks[3].labels[0].
export function scanForbidden(value, base = '') {
  const out = [];
  const walk = (v, at) => {
    if (typeof v === 'string') {
      for (const [re, what] of FORBIDDEN_PATH) if (re.test(v)) { out.push({ path: at, rule: `contains ${what}` }); return; }
      for (const [re, what] of FORBIDDEN_VALUE) if (re.test(v)) { out.push({ path: at, rule: `contains ${what}` }); return; }
    } else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${at}[${i}]`));
    else if (v && typeof v === 'object') {
      for (const [k, x] of Object.entries(v)) {
        const p = at ? `${at}.${k}` : k;
        if (k === 'packs' && at === 'meta') out.push(...packRefProblems(x, p)); // the one place a pack may appear: a reference to a public pack
        else if (FORBIDDEN_KEYS.has(keyId(k))) out.push({ path: p, rule: `"${k}" is never part of a publication source` });
        walk(x, p);
      }
    }
  };
  walk(value, base);
  return out;
}
export function assertClean(value, base = '') {
  const found = scanForbidden(value, base);
  if (found.length) throw new StudioError(422, 'forbidden_content', `Not saved: the snapshot contains private or forbidden content (${found.slice(0, 3).map((f) => `${f.path}: ${f.rule}`).join('; ')}${found.length > 3 ? `; +${found.length - 3} more` : ''}).`, found);
  return value;
}

// ---------- the serializer (allowlist) ----------
const invalid = (errs) => { throw new StudioError(422, 'invalid_snapshot', `Not saved: ${errs.slice(0, 3).join('; ')}${errs.length > 3 ? `; +${errs.length - 3} more` : ''}.`, errs); };
const isObj = (x) => x && typeof x === 'object' && !Array.isArray(x);
const only = (o, allowed, where, errs) => { for (const k of Object.keys(o)) if (!allowed.includes(k)) errs.push(`${where}.${k} is not a field of the publication source`); };
const text = (o, k, max, where, errs, { req = false } = {}) => {
  if (o[k] === undefined) { if (req) errs.push(`${where}.${k} is required`); return undefined; }
  if (typeof o[k] !== 'string' || o[k].length > max) { errs.push(`${where}.${k} must be text up to ${max} characters`); return undefined; }
  return o[k];
};

export function serializeMeta(m, errs) {
  if (!isObj(m)) { errs.push('meta must be an object'); return {}; }
  only(m, ['title', 'subtitle', 'slug', 'description', 'library', 'packs'], 'meta', errs);
  const r = {};
  r.title = text(m, 'title', 120, 'meta', errs, { req: true });
  r.subtitle = text(m, 'subtitle', 200, 'meta', errs) ?? '';
  r.slug = text(m, 'slug', 60, 'meta', errs) ?? '';
  if (r.slug && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(r.slug)) errs.push('meta.slug must be lowercase letters, digits and dashes');
  r.description = text(m, 'description', 1000, 'meta', errs) ?? '';
  if (m.library !== undefined && m.library !== null) { const l = serializeLibrary(m.library, errs); if (l) r.library = l; }
  if (m.packs !== undefined && m.packs !== null) { const k = serializePackRefs(m.packs, errs); if (k.length) r.packs = k; }
  return r;
}

// The content packs a book uses, by reference: id, kind, version and the pack's hash (journal/packs/pack.mjs packHash), so a fork or a
// reprint finds the same pack. Only public kinds; a personal pack is refused (the scanner does too, by name).
export function serializePackRefs(list, errs) {
  if (!Array.isArray(list)) { errs.push('meta.packs must be a list of pack references'); return []; }
  if (list.length > 100) errs.push('meta.packs: at most 100 packs');
  const seen = new Set(), out = [];
  list.forEach((x, i) => {
    const at = `meta.packs[${i}]`;
    if (!isObj(x)) { errs.push(`${at} must be {id, kind, version, sha256}`); return; }
    only(x, PACK_REF_KEYS, at, errs);
    if (typeof x.id !== 'string' || !ID_RE.test(x.id) || x.id.length > 60) errs.push(`${at}.id must be a pack id (lowercase letters, digits and dashes)`);
    if (typeof x.kind !== 'string' || !KINDS[x.kind]) errs.push(`${at}.kind must be one of ${kindNames().join(', ')}`);
    else if (KINDS[x.kind].privacy !== 'public') errs.push(`${at}: "${x.id}" is a personal ${x.kind} pack and never travels in a snapshot`);
    if (!isSemver(x.version)) errs.push(`${at}.version must be a semantic version like 1.0.0`);
    if (typeof x.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(x.sha256)) errs.push(`${at}.sha256 must be a sha256 hex`);
    if (seen.has(x.id)) errs.push(`${at}.id "${x.id}" is used twice`);
    seen.add(x.id);
    out.push({ id: x.id, kind: x.kind, version: x.version, sha256: x.sha256 });
  });
  return out.sort((p, q) => (p.id < q.id ? -1 : 1));
}

// The library: books and series (journal/library.mjs). Nothing personal: the allowlist below is the whole of it (no person, place,
// coordinates, calendar, pack, path or account field exists in a library, and the scanner has already refused them by name).
// Layouts hold a page structure (checked as a book.json) and a day layout (cut down to declared block options), so a project can carry
// several books with their own pages. Keys are sorted by the canonical form; lists keep their order (series order is the numbering).
const pick = (o, keys) => Object.fromEntries(keys.filter((k) => o[k] !== undefined).map((k) => [k, structuredClone(o[k])]));
export function serializeLibrary(l, errs) {
  const bad = validateLibrary(l);
  if (bad.length) { errs.push(...bad.map((x) => `library: ${x}`)); return null; }
  const plan = (p) => { const o = pick(p, ['scope', 'keeper', 'closing', 'edition']); if (p.custom) o.custom = pick(p.custom, ['start', 'end']); if (p.undated) o.undated = pick(p.undated, ['days', 'weeks', 'months', 'extras', 'fillins']); return o; };
  const out = { version: LIBRARY_VERSION };
  out.books = l.books.map((b) => {
    const o = pick(b, ['id', 'title', 'subtitle', 'spineTitle', 'slug', 'edition', 'start', 'bookId', 'seriesId', 'layoutRef', 'dayLayout', 'modules', 'show']);
    if (b.plan) o.plan = plan(b.plan);
    if (b.cover) o.cover = pick(b.cover, ['style']);
    return o;
  });
  out.series = (l.series || []).map((s) => {
    const o = pick(s, ['id', 'title', 'subtitle', 'order', 'show']);
    if (s.defaults) { o.defaults = pick(s.defaults, ['dayLayout', 'modules']); if (s.defaults.cover) o.defaults.cover = pick(s.defaults.cover, ['style']); if (s.defaults.plan) o.defaults.plan = plan(s.defaults.plan); }
    return o;
  });
  out.layouts = (l.layouts || []).map((x, i) => {
    const o = { id: x.id, name: x.name };
    if (x.book !== undefined) o.book = serializeBook(x.book, errs) || undefined;
    if (x.day !== undefined) o.day = serializeDay(x.day, errs) || undefined;
    if (o.book === undefined) delete o.book; if (o.day === undefined) delete o.day;
    return o;
  });
  if (l.defaultBook !== undefined) out.defaultBook = l.defaultBook;
  return out;
}
// The library of a snapshot: its stored one, else the project's own single book (title, slug, edition, first month), using the project's
// own book.json and day layout ("default"). This is the migration of an existing project: nothing is written, nothing changes.
export function libraryOf(snap) {
  if (snap.meta && snap.meta.library) return snap.meta.library;
  const m = snap.meta || {}, p = snap.print || {};
  return libraryFromProfile({ book: { title: m.title, subtitle: m.subtitle, slug: m.slug || slugify(m.title || 'book'), edition: p.edition, start: p.start } }, { id: m.slug && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(m.slug) ? m.slug : slugify(m.title || 'book') });
}
export function serializePrint(p, errs) {
  if (!isObj(p)) { errs.push('print must be an object'); return {}; }
  only(p, ['trim', 'edition', 'start', 'day_start_hour', 'hardcover', 'modules'], 'print', errs);
  const r = {};
  if (!['small', 'letter'].includes(p.trim)) errs.push('print.trim must be "small" (5.5x8.5) or "letter" (8.5x11)'); else r.trim = p.trim;
  if (!(Number.isInteger(p.edition) && p.edition >= 1 && p.edition <= 9)) errs.push('print.edition must be a whole number 1 to 9'); else r.edition = p.edition;
  if (p.start !== undefined) { if (typeof p.start === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(p.start)) r.start = p.start; else errs.push('print.start must look like 2026-10'); }
  if (p.day_start_hour !== undefined) { if (Number.isInteger(p.day_start_hour) && p.day_start_hour >= 0 && p.day_start_hour <= 8) r.day_start_hour = p.day_start_hour; else errs.push('print.day_start_hour must be a whole number 0 to 8'); }
  if (p.hardcover !== undefined) { if (typeof p.hardcover === 'boolean') r.hardcover = p.hardcover; else errs.push('print.hardcover must be true or false'); }
  if (p.modules !== undefined) {
    if (!isObj(p.modules)) errs.push('print.modules must be an object of true/false switches');
    else {
      r.modules = {};
      for (const k of Object.keys(p.modules).sort()) { if (!MODULES[k]) errs.push(`print.modules.${k} is not a module`); else if (typeof p.modules[k] !== 'boolean') errs.push(`print.modules.${k} must be true or false`); else r.modules[k] = p.modules[k]; }
    }
  }
  return r;
}

const entryOut = (it) => {
  const o = { id: it.id, type: it.type, on: it.on !== false, options: {} };
  if (it.type === 'weeks') {
    const w = it.options || {};
    o.options = { month: (w.month || []).map(entryOut), week: (w.week || []).map(entryOut) };
  } else o.options = structuredClone(it.options || {});
  return o;
};
export function serializeBook(b, errs) {
  const bad = validateBook(b);
  if (bad.length) { errs.push(...bad.map((x) => `book: ${x}`)); return null; }
  const r = { version: 1, default: b.default.map(entryOut), months: {} };
  for (const k of Object.keys(b.months || {}).sort()) r.months[k] = { pages: b.months[k].pages.map(entryOut) };
  return r;
}

// Block fields: uid, type, on, and the options the block type declares (daypage.mjs TYPES), plus the care rows' own fields.
const CARE_ROW_KEYS = Object.fromEntries(newBlock('care').rows.map((r) => [r.id, Object.keys(r)]));
export function serializeDay(d, errs) {
  if (d !== null && d !== undefined && !isObj(d)) { errs.push('day must be an object like {"v":2,"blocks":[...]}'); return null; }
  if (isObj(d) && d.blocks !== undefined && !Array.isArray(d.blocks)) { errs.push('day.blocks must be a list'); return null; }
  const L = normalize(d && Object.keys(d).length ? d : null);
  return {
    v: 2,
    ...(L.grid ? { grid: true } : {}), // the Grid layout switch: blocks carry their placement (col, row, colSpan, rowSpan)
    blocks: L.blocks.map((b) => {
      const keys = ['uid', 'type', 'on', ...TYPES[b.type].opts.map((o) => o.k), ...(b.type === 'care' ? ['rows'] : []), ...PLACE];
      const o = {};
      for (const k of keys) if (b[k] !== undefined) o[k] = structuredClone(b[k]);
      if (o.rows) o.rows = o.rows.map((r) => Object.fromEntries((CARE_ROW_KEYS[r.id] || ['id', 'on']).filter((k) => r[k] !== undefined).map((k) => [k, structuredClone(r[k])])));
      return o;
    }),
  };
}

export function serializeAssets(a, errs) {
  if (!Array.isArray(a)) { errs.push('assets must be a list'); return []; }
  const seen = new Set(), out = [];
  a.forEach((x, i) => {
    const at = `assets[${i}]`;
    if (!isObj(x)) { errs.push(`${at} must be an object {name, hash, mime, size}`); return; }
    only(x, ['name', 'hash', 'mime', 'size'], at, errs);
    if (typeof x.name !== 'string' || !/^[A-Za-z0-9][\w .()\-]{0,99}$/.test(x.name)) errs.push(`${at}.name must be a plain file name`);
    if (typeof x.hash !== 'string' || !/^[0-9a-f]{64}$/.test(x.hash)) errs.push(`${at}.hash must be a sha256 hex`);
    if (!ASSET_MIMES[x.mime]) errs.push(`${at}.mime must be one of ${Object.keys(ASSET_MIMES).join(', ')}`);
    if (!(Number.isInteger(x.size) && x.size >= 0 && x.size <= 10_000_000)) errs.push(`${at}.size must be a whole number of bytes`);
    if (seen.has(x.name)) errs.push(`${at}.name "${x.name}" is used twice`);
    seen.add(x.name);
    out.push({ name: x.name, hash: x.hash, mime: x.mime, size: x.size });
  });
  return out.sort((p, q) => (p.name < q.name ? -1 : 1));
}
export function serializeComponents(c, errs) {
  if (!Array.isArray(c)) { errs.push('components must be a list'); return []; }
  const seen = new Set();
  return c.map((x, i) => {
    const at = `components[${i}]`;
    if (!isObj(x)) { errs.push(`${at} must be an object`); return null; }
    only(x, ['id', 'name', 'version', 'page'], at, errs);
    if (typeof x.id !== 'string' || !/^[a-z0-9_]+(\.[a-z0-9_-]+)*$/.test(x.id)) errs.push(`${at}.id must be lowercase words joined by dots`);
    if (seen.has(x.id)) errs.push(`${at}.id "${x.id}" is used twice`);
    seen.add(x.id);
    if (typeof x.name !== 'string' || !x.name || x.name.length > 80) errs.push(`${at}.name must be text up to 80 characters`);
    if (!(Number.isInteger(x.version) && x.version >= 1)) errs.push(`${at}.version must be a whole number from 1`);
    if (!isObj(x.page) || !PAGE_TYPES[x.page.type]) errs.push(`${at}.page must be {type, options} with a known page type`);
    return { id: x.id, name: x.name, version: x.version, page: { type: x.page && x.page.type, options: structuredClone((x.page && x.page.options) || {}) } };
  }).filter(Boolean).sort((p, q) => (p.id < q.id ? -1 : 1));
}

// The one way in. `input` may be partial: parts you leave out come from `base` (an existing snapshot) or the defaults.
// Order: reject forbidden content in what was submitted, copy only the allowlisted fields, scan the result once more.
export function serializeSnapshot(input, base = null) {
  if (!isObj(input)) invalid(['the snapshot must be an object']);
  assertClean(input);
  const errs = [];
  only(input, PARTS, 'snapshot', errs);
  const from = base || emptySnapshot('Untitled');
  // a meta sent without a library keeps the stored one (send library: null to drop it), so older clients never erase a library by saving
  const part = (k) => {
    if (k === 'meta' && isObj(input.meta) && from.meta) { // same for the pack references (send packs: null to drop them)
      const keep = {}; for (const f of ['library', 'packs']) if (input.meta[f] === undefined && from.meta[f]) keep[f] = from.meta[f];
      if (Object.keys(keep).length) return { ...input.meta, ...keep };
    }
    return input[k] !== undefined ? input[k] : from[k];
  };
  const snap = {
    meta: serializeMeta(part('meta'), errs), print: serializePrint(part('print'), errs), book: serializeBook(part('book'), errs),
    day: serializeDay(part('day'), errs), assets: serializeAssets(part('assets'), errs), components: serializeComponents(part('components'), errs),
  };
  if (errs.length) invalid(errs);
  assertClean(snap); // defense in depth: the output must be clean too
  return snap;
}

export const slugify = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'project';
export function emptySnapshot(title) {
  return {
    meta: { title, subtitle: '', slug: slugify(title), description: '' },
    print: { trim: 'small', edition: 1, hardcover: false },
    book: structuredClone(DEFAULT_BOOK),
    day: structuredClone(normalize(null)),
    assets: [], components: [],
  };
}

// ---------- tree: a snapshot as content-addressed objects ----------
// Each part is an object (hash = sha256 of its canonical JSON); the tree lists them. Two commits that differ only in the day layout
// share every other object. Returns the objects to store and the tree hash.
export function toObjects(snap) {
  const objs = [];
  const parts = {};
  for (const k of PARTS) { const body = canonical(snap[k]); const hash = objectHash(k, snap[k]); objs.push({ hash, kind: k, body }); parts[k] = hash; }
  const tree = { format: FORMAT, parts };
  const body = canonical(tree), hash = objectHash('tree', tree);
  objs.push({ hash, kind: 'tree', body });
  return { objects: objs, tree: hash };
}
export const treeHashOf = (snap) => toObjects(snap).tree;
