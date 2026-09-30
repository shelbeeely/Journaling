// The profile: everything about WHO the journal is for and WHERE, in one file (content/profile.json), so the engine holds nothing
// personal. Synchronous (fs only to read the file), so any module can `import { PROFILE }` at load time.
//   content/profile.json          the committed profile (Shelbee's; today's books are built from it, byte for byte)
//   content/profile.example.json  a generic person in a made-up city: copy it to start your own
//   KW_PROFILE=path node render.mjs ...   build with another profile (test-profile.mjs does; nothing else needs it)
//   content/library.json          optional: several books and series (library.mjs). KW_BOOK=<id> builds one of them; KW_LIBRARY=path
//                                 uses another file. The library only lays a book's own fields (title, plan, ...) over this profile's
//                                 `book` section; the person, place and packs stay here. Without it the library is this profile's one book.
// A missing or wrong field stops the build with one message that lists every problem (assertProfile).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { planProblems, newBookId } from './plan.mjs';
import { assertLibrary, effectiveProfile, libraryFromProfile } from './library.mjs';

const HERE = path.dirname(new URL(import.meta.url).pathname);
export const PROFILE_FILE = process.env.KW_PROFILE ? path.resolve(process.env.KW_PROFILE) : path.join(HERE, 'content/profile.json');

import { MODULES, MODULE_BLOCKS } from './modules.mjs';
export { MODULES, MODULE_BLOCKS };
// Page types each module owns are declared on the page types themselves (pages.mjs PAGE_TYPES, `module`).

const isObj = (x) => x && typeof x === 'object' && !Array.isArray(x);
const str = (v) => typeof v === 'string' && v.trim() !== '';

export function validateProfile(p) {
  const errs = [];
  const bad = (where, msg) => errs.push(`${where}: ${msg}`);
  if (!isObj(p)) return ['profile: must be an object (copy content/profile.example.json to start)'];
  if (p.version !== 1) bad('version', `must be 1, got ${JSON.stringify(p.version)}`);
  const sect = (k, fields) => {
    if (!isObj(p[k])) { bad(k, 'is required (an object)'); return false; }
    for (const [f, kind, hint] of fields) {
      const v = p[k][f];
      if (v === undefined || v === null) { bad(`${k}.${f}`, `is required (${hint})`); continue; }
      if (kind === 'text' && !str(v)) bad(`${k}.${f}`, `must be text (${hint})`);
      if (kind === 'num' && !(typeof v === 'number' && Number.isFinite(v))) bad(`${k}.${f}`, `must be a number (${hint})`);
    }
    return true;
  };
  sect('person', [['name', 'text', 'your first name, e.g. "Sam"']]);
  if (sect('book', [['title', 'text', 'printed on the cover and title page, e.g. "Keeping Watch"'], ['subtitle', 'text', 'e.g. "A sky, season & self journal"'], ['slug', 'text', 'lowercase file-name stem, e.g. "keeping-watch"'], ['edition', 'num', 'a single digit 1-9'], ['start', 'text', 'first month of the 12-month year, e.g. "2026-10"']])) {
    const b = p.book;
    if (typeof b.edition === 'number' && !(Number.isInteger(b.edition) && b.edition >= 1 && b.edition <= 9)) bad('book.edition', 'must be a whole number 1 to 9 (a longer number pushes the page code past 16x16 modules)');
    if (str(b.start) && !/^\d{4}-(0[1-9]|1[0-2])$/.test(b.start)) bad('book.start', `must look like 2026-10, got ${JSON.stringify(b.start)}`);
    if (str(b.slug) && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(b.slug)) bad('book.slug', 'lowercase letters, digits and dashes only');
    errs.push(...planProblems(b));
    if (b.epoch !== undefined && !(str(b.epoch) && /^\d{4}-\d{2}-\d{2}$/.test(b.epoch) && new Date(b.epoch + 'T00:00:00Z').getUTCDay() === 1)) bad('book.epoch', 'optional; must be a Monday like 2026-09-28 (default: the Monday on or before the 1st of book.start)');
  }
  if (sect('location', [['place', 'text', 'as printed, e.g. "Spokane, WA"'], ['city', 'text', 'short name used in sentences, e.g. "Spokane"'], ['region', 'text', 'e.g. "Washington"'], ['lat', 'num', 'degrees, north positive'], ['lon', 'num', 'degrees, east positive (west is negative)'], ['timezone', 'text', 'IANA name, e.g. "America/Los_Angeles"'], ['timezone_name', 'text', 'as printed, e.g. "Pacific Time"']])) {
    const l = p.location;
    if (typeof l.lat === 'number' && Math.abs(l.lat) > 90) bad('location.lat', 'must be between -90 and 90');
    if (typeof l.lon === 'number' && Math.abs(l.lon) > 180) bad('location.lon', 'must be between -180 and 180');
    if (l.elevation !== undefined && typeof l.elevation !== 'number') bad('location.elevation', 'optional; metres above sea level, a number');
    if (str(l.timezone)) { try { new Intl.DateTimeFormat('en-US', { timeZone: l.timezone }); } catch { bad('location.timezone', `${JSON.stringify(l.timezone)} is not a time zone name`); } }
  }
  if (!(Number.isInteger(p.day_start_hour) && p.day_start_hour >= 0 && p.day_start_hour <= 8)) bad('day_start_hour', `is required: the hour the paper day starts, a whole number 0 to 8 (Shelbee's is 4); got ${JSON.stringify(p.day_start_hour)}`);
  if (!['small', 'letter'].includes(p.trim)) bad('trim', `is required: "small" (5.5x8.5) or "letter" (8.5x11), got ${JSON.stringify(p.trim)}`);
  if (!isObj(p.modules)) bad('modules', `is required: switch each of ${Object.keys(MODULES).join(', ')} on or off`);
  else {
    for (const k of Object.keys(MODULES)) if (typeof p.modules[k] !== 'boolean') bad(`modules.${k}`, `is required, true or false (${MODULES[k]})`);
    for (const k of Object.keys(p.modules)) if (!MODULES[k]) bad(`modules.${k}`, `not a module (use ${Object.keys(MODULES).join(', ')})`);
    if (p.modules.bus === true) {
      if (!isObj(p.transit)) bad('transit', 'is required when modules.bus is true: {agency, site, app}');
      else for (const f of ['agency', 'site', 'app']) if (!str(p.transit[f])) bad(`transit.${f}`, 'is required when modules.bus is true (e.g. "STA", "spokanetransit.com", "STA app")');
    }
  }
  if (p.crisis !== undefined && !(isObj(p.crisis) && Array.isArray(p.crisis.lines) && p.crisis.lines.every(str))) bad('crisis.lines', 'optional; must be a list of text, printed on the safety plan after "my prescriber;"');
  if (p.paths !== undefined) {
    if (!isObj(p.paths)) bad('paths', 'must be an object');
    else for (const [k, v] of Object.entries(p.paths)) {
      if (!['support', 'trans', 'clinic', 'transit', 'seasons'].includes(k)) bad(`paths.${k}`, 'unknown path (use support, trans, clinic, transit, seasons)');
      else if (v !== null && !str(v)) bad(`paths.${k}`, 'must be a file path relative to journal/, or null for none');
    }
  }
  if (!(isObj(p.paths) && str(p.paths.support))) bad('paths.support', 'is required: the Support page list (a JSON file relative to journal/, e.g. "content/support.generic.json")');
  if (p.modules && p.modules.trans_support === true && !(isObj(p.paths) && str(p.paths.trans))) bad('paths.trans', 'is required when modules.trans_support is true');
  return errs;
}
export function assertProfile(p, from = 'content/profile.json') {
  const errs = validateProfile(p);
  if (errs.length) throw new Error(`${from} is not a valid profile:\n  - ${errs.join('\n  - ')}\n(see content/profile.example.json and the Profile section of journal/README.md)`);
  return p;
}

function read(file) {
  if (!fs.existsSync(file)) throw new Error(`No profile at ${file}. Copy content/profile.example.json to content/profile.json and fill it in (journal/README.md, "Profile").`);
  let raw;
  try { raw = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { throw new Error(`${file} is not valid JSON: ${e.message}`); }
  return assertProfile(raw, path.relative(process.cwd(), file) || file);
}
const DEFAULT_CRISIS = ['988 (call or text)', 'text HOME to 741741'];
const raw0 = read(PROFILE_FILE);
// The library: content/library.json when there is one (a KW_PROFILE build uses a library only through KW_LIBRARY), else the profile's own book.
export const LIBRARY_FILE = process.env.KW_LIBRARY ? path.resolve(process.env.KW_LIBRARY) : !process.env.KW_PROFILE && fs.existsSync(path.join(HERE, 'content/library.json')) ? path.join(HERE, 'content/library.json') : null;
const relName = (f) => path.relative(process.cwd(), f) || f;
export const LIBRARY = LIBRARY_FILE
  ? assertLibrary((() => { try { return JSON.parse(fs.readFileSync(LIBRARY_FILE, 'utf8')); } catch (e) { throw new Error(`${LIBRARY_FILE} is not valid JSON: ${e.message}`); } })(), relName(LIBRARY_FILE))
  : libraryFromProfile(raw0);
export const BOOK_KEY = process.env.KW_BOOK || LIBRARY.defaultBook || LIBRARY.books[0].id; // which library book this build is
if (!LIBRARY.books.some((b) => b.id === BOOK_KEY)) throw new Error(`KW_BOOK "${BOOK_KEY}" is not a book in the library (books: ${LIBRARY.books.map((b) => b.id).join(', ')}).`);
let raw = raw0, EXTRA = null;
if (LIBRARY_FILE || process.env.KW_BOOK) {
  const eff = effectiveProfile(raw0, LIBRARY, BOOK_KEY);
  raw = assertProfile(eff.profile, `${relName(LIBRARY_FILE || PROFILE_FILE)} (book "${BOOK_KEY}" over the profile)`);
  EXTRA = eff.library;
}
export const PROFILE_BOOK = raw0.book; // the profile's own book section, before a library book is laid over it
export const PROFILE = Object.freeze({
  ...raw,
  location: { elevation: 0, ...raw.location },
  crisis: { lines: DEFAULT_CRISIS, ...(raw.crisis || {}) },
  paths: { support: null, trans: null, clinic: null, transit: 'gtfs', seasons: null, ...(raw.paths || {}) },
  transit: raw.transit || null,
  // this book within its library: series line, spine title, cover style, and page layouts from the library (null: the content/*.json files)
  library: EXTRA || { book: BOOK_KEY, spineTitle: null, series: null, show: [], cover: { style: 'night' }, layouts: { book: null, day: null } },
});

// The book's own id for scan codes (every book except the monthly ones has one: see plan.mjs, "scan-code space"). It is made once, the
// first time such a book is built, and written into the profile file as book.id, so the same book always has the same id.
export function ensureBookId() {
  if (PROFILE.book.id) return PROFILE.book.id;
  const id = newBookId(crypto.randomBytes(5));
  if (LIBRARY_FILE) { // a library book keeps its id in its own library entry
    const lib = JSON.parse(fs.readFileSync(LIBRARY_FILE, 'utf8'));
    lib.books.find((b) => b.id === BOOK_KEY).bookId = id;
    fs.writeFileSync(LIBRARY_FILE, JSON.stringify(lib, null, 1) + '\n');
    PROFILE.book.id = id;
    return id;
  }
  const text = fs.readFileSync(PROFILE_FILE, 'utf8');
  const m = /("book"\s*:\s*\{)(\s*)/.exec(text); // the id goes first in the book section, with the section's own indentation
  if (!m) throw new Error(`Cannot add book.id to ${PROFILE_FILE}: no "book" section found. Add "id": "${id}" to it by hand.`);
  const out = text.slice(0, m.index) + `${m[1]}${m[2] || ' '}"id": "${id}",${m[2] || ' '}` + text.slice(m.index + m[0].length);
  try { JSON.parse(out); } catch { throw new Error(`Cannot add book.id to ${PROFILE_FILE} automatically. Add "id": "${id}" to its "book" section by hand.`); }
  fs.writeFileSync(PROFILE_FILE, out);
  PROFILE.book.id = id;
  return id;
}

// ---- derived values, one definition each ----
const pad2 = (n) => String(n).padStart(2, '0');
const [SY, SM] = PROFILE.book.start.split('-').map(Number);
// Book number of a month: the first month is book 1 ... the twelfth is book 12.
export const bookNo = (yr, mo) => (yr - SY) * 12 + mo - SM + 1;
// The month id of book n (1..12), e.g. "2026-10".
export const monthOf = (n) => { const d = new Date(Date.UTC(SY, SM - 1 + n - 1, 1)); return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}`; };
export const monthIds = () => Array.from({ length: 12 }, (_, i) => monthOf(i + 1));
// Week 0's Monday (UTC ms): book.epoch, else the Monday on or before the 1st of the first month. Every week's `gi` counts from it.
export const epochMs = () => {
  if (PROFILE.book.epoch) return Date.parse(PROFILE.book.epoch + 'T00:00:00Z');
  const first = Date.UTC(SY, SM - 1, 1);
  return first - ((new Date(first).getUTCDay() + 6) % 7) * 864e5;
};
const MON = (id) => new Date(Date.UTC(+id.slice(0, 4), +id.slice(5) - 1, 1)).toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
// "Oct 2026 – Sep 2027"
export const yearLabel = () => { const a = monthOf(1), b = monthOf(12); return `${MON(a)} ${a.slice(0, 4)} – ${MON(b)} ${b.slice(0, 4)}`; };
export const firstMonthId = () => monthOf(1);
export const lastMonthId = () => monthOf(12);
export const moduleOn = (name) => !!PROFILE.modules[name];
export const profilePath = (rel) => (rel ? path.join(HERE, rel) : null); // a profile path, absolute
// JSON at a profile path key: null when the path is null; an error naming the profile key when the file is missing.
export const readContent = (key) => {
  const rel = PROFILE.paths[key];
  if (!rel) return null;
  const f = profilePath(rel);
  if (!fs.existsSync(f)) throw new Error(`profile paths.${key} points to ${rel}, which does not exist`);
  return JSON.parse(fs.readFileSync(f, 'utf8'));
};
// "47.66° N, 117.43° W"
export const coordText = () => { const { lat, lon } = PROFILE.location; return `${Math.abs(lat).toFixed(2)}° ${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lon).toFixed(2)}° ${lon < 0 ? 'W' : 'E'}`; };
