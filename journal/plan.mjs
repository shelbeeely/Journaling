// The book plan: what one build covers and how it is cut into volumes. Pure (no fs, no browser): the profile's `book` section
// says the scope, this file turns it into a span of days and, when the span is longer than a printable book, into volumes.
//   content/profile.json  book.scope   month (default) | quarter | season | half-year | year | custom | undated
//                         book.custom  {start, end}                       for scope custom (YYYY-MM-DD, both days included)
//                         book.undated {days, weeks, months, extras, fillins}  for scope undated
//                         book.id      8 characters (0-9 A-Z without I L O U), the book's own scan-code id; made once, written back
//                         book.keeper  twelve-book (default) | per-book | none
//                         book.closing month (default) | end              one Closing page per month, or once at the end of each volume
// Volumes (Shelbee's rule): paperback is 24-110 pages, hardcover 76-110. A span whose pages go past 110 is cut into the fewest
// volumes that each fit, as evenly as it can be done, on month boundaries where that works, else on week boundaries.
// splitVolumes() is the whole rule; the caller says how many pages any run of days makes (render.mjs counts with the real page
// builders), so the split is always the one the printed book has. Deterministic: the same span gives the same volumes.

export const SCOPES = ['month', 'quarter', 'season', 'half-year', 'year', 'custom', 'undated'];
export const KEEPERS = ['twelve-book', 'per-book', 'none'];
export const CLOSINGS = ['month', 'end'];
export const MAX_PAGES = 110, PAPERBACK_MIN = 24, HARDCOVER_MIN = 76;
export const UNDATED_EXTRAS = { theme: 'the season theme page', tracker: 'a blank month tracker after each month grid', notes: 'two Notes pages at the back' };
export const UNDATED_DEFAULT = { days: 90, extras: ['theme', 'tracker'] };
export const MAX_VOLUMES = 35; // one base-36 character in the scan code (1-9, A-Z)

const pad2 = (n) => String(n).padStart(2, '0');
export const isoOf = (t) => new Date(t).toISOString().slice(0, 10);
export const msOf = (iso) => Date.parse(iso + 'T00:00:00Z');
export const addDays = (iso, n) => isoOf(msOf(iso) + n * 864e5);
export const daysBetween = (a, b) => Math.round((msOf(b) - msOf(a)) / 864e5) + 1; // both days included
const eom = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const addMonths = (id, n) => { const d = new Date(Date.UTC(+id.slice(0, 4), +id.slice(5) - 1 + n, 1)); return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}`; };
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// The usual solstice/equinox dates; the exact minute is on the day page. A season book runs from the first of the start month
// to the day before the first of these that is at least 60 days later (Oct 1 -> Dec 20; Jan 1 -> Mar 19).
const SEASON_DAYS = [[3, 20], [6, 21], [9, 22], [12, 21]];

// The plan from the profile's book section. Everything optional has its default here.
export function bookPlan(book) {
  const scope = book.scope || 'month';
  const plan = { scope, keeper: book.keeper || 'twelve-book', closing: book.closing || 'month', start: null, end: null, days: 0, undated: null };
  const s1 = `${book.start}-01`, [y, m] = book.start.split('-').map(Number);
  if (scope === 'month') return plan;
  if (scope === 'undated') {
    const u = { ...UNDATED_DEFAULT, ...(book.undated || {}) };
    u.weeks = u.weeks || Math.ceil(u.days / 7);
    u.months = u.months || Math.max(1, Math.round(u.weeks / 4.33));
    u.extras = [...(u.extras || [])];
    plan.undated = u; plan.days = u.days; plan.closing = 'end'; // no months to close: one Closing page at the end of each volume
    return plan;
  }
  plan.start = s1;
  if (scope === 'quarter') plan.end = addDays(`${addMonths(book.start, 3)}-01`, -1);
  else if (scope === 'half-year') plan.end = addDays(`${addMonths(book.start, 6)}-01`, -1);
  else if (scope === 'year') plan.end = addDays(`${addMonths(book.start, 12)}-01`, -1);
  else if (scope === 'season') {
    const min = addDays(s1, 60);
    let cut = null;
    for (let yy = y; !cut; yy++) for (const [mm, dd] of SEASON_DAYS) { const c = `${yy}-${pad2(mm)}-${pad2(dd)}`; if (!cut && c >= min) cut = c; }
    plan.end = addDays(cut, -1);
  } else if (scope === 'custom') { plan.start = book.custom.start; plan.end = book.custom.end; }
  plan.days = daysBetween(plan.start, plan.end);
  return plan;
}

// Problems with the plan fields of a profile's book section, as plain sentences (profile.mjs adds them to its own list).
export function planProblems(b) {
  const errs = [];
  const bad = (w, m) => errs.push(`book.${w}: ${m}`);
  if (b.scope !== undefined && !SCOPES.includes(b.scope)) bad('scope', `must be one of ${SCOPES.join(', ')}, got ${JSON.stringify(b.scope)}`);
  if (b.keeper !== undefined && !KEEPERS.includes(b.keeper)) bad('keeper', `must be one of ${KEEPERS.join(', ')}, got ${JSON.stringify(b.keeper)}`);
  if (b.id !== undefined && !BOOK_ID_RE.test(b.id)) bad('id', `must be 8 characters, digits and capital letters without I L O U (like K7M2QX9A); leave it out and the build makes one, got ${JSON.stringify(b.id)}`);
  if (b.closing !== undefined && !CLOSINGS.includes(b.closing)) bad('closing', `must be "month" (a Closing page after each month) or "end" (one at the end of each volume), got ${JSON.stringify(b.closing)}`);
  const iso = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && isoOf(msOf(s)) === s;
  if (b.scope === 'custom') {
    const c = b.custom;
    if (!c || typeof c !== 'object') bad('custom', 'is required when scope is "custom": {"start": "2026-10-05", "end": "2027-01-20"}');
    else {
      if (!iso(c.start)) bad('custom.start', `must be a date like 2026-10-05, got ${JSON.stringify(c.start)}`);
      if (!iso(c.end)) bad('custom.end', `must be a date like 2027-01-20, got ${JSON.stringify(c.end)}`);
      if (iso(c.start) && iso(c.end)) {
        if (c.end < c.start) bad('custom', 'end is before start');
        else if (daysBetween(c.start, c.end) > 1100) bad('custom', `spans ${daysBetween(c.start, c.end)} days; three years (1100 days) is the most one plan covers`);
      }
    }
  } else if (b.custom !== undefined) bad('custom', 'only used when scope is "custom"');
  if (b.scope === 'undated') {
    const u = { ...UNDATED_DEFAULT, ...(b.undated || {}) };
    if (b.undated !== undefined && (typeof b.undated !== 'object' || Array.isArray(b.undated))) bad('undated', 'must be an object like {"days": 90, "weeks": 13, "months": 3, "extras": ["theme", "tracker"]}');
    else {
      const int = (k, lo, hi) => u[k] !== undefined && !(Number.isInteger(u[k]) && u[k] >= lo && u[k] <= hi) && bad(`undated.${k}`, `must be a whole number ${lo} to ${hi}, got ${JSON.stringify(u[k])}`);
      int('days', 7, 1100); int('weeks', 1, 160); int('months', 1, 36); if (u.fillins !== undefined && typeof u.fillins !== 'boolean') bad('undated.fillins', 'must be true or false (sky, moon and "on this day" lines left as fill-ins)');
      if (Number.isInteger(u.days) && Number.isInteger(u.weeks || Math.ceil(u.days / 7)) && u.days > 7 * (u.weeks || Math.ceil(u.days / 7))) bad('undated', `${u.days} day pages need at least ${Math.ceil(u.days / 7)} weeks (7 days a week), got ${u.weeks}`);
      if (Number.isInteger(u.weeks) && Number.isInteger(u.months) && u.months > u.weeks) bad('undated', `${u.months} months can't fit in ${u.weeks} weeks`);
      if (u.extras !== undefined && !(Array.isArray(u.extras) && u.extras.every((x) => UNDATED_EXTRAS[x]))) bad('undated.extras', `must be a list of ${Object.keys(UNDATED_EXTRAS).join(', ')}`);
    }
  } else if (b.undated !== undefined) bad('undated', 'only used when scope is "undated"');
  return errs;
}

// ---- labels ----
const pretty = (iso) => { const [y, m, d] = iso.split('-').map(Number); return { y, m, d, mon: MON[m - 1] }; };
// "Nov 2026", "Nov 2026 – Jan 2027" (whole months), else "Nov 16 – Nov 30, 2026" / "Nov 16, 2026 – Jan 20, 2027"
export function rangeLabel(first, last) {
  const a = pretty(first), b = pretty(last);
  const wholeA = a.d === 1, wholeB = b.d === eom(b.y, b.m);
  if (wholeA && wholeB) return a.y === b.y && a.m === b.m ? `${a.mon} ${a.y}` : `${a.mon} ${a.y} – ${b.mon} ${b.y}`;
  if (a.y === b.y) return `${a.mon} ${a.d} – ${b.mon} ${b.d}, ${a.y}`;
  return `${a.mon} ${a.d}, ${a.y} – ${b.mon} ${b.d}, ${b.y}`;
}

// ---- scan-code space ----
// Monthly books keep the code they have always had: KW2|<edition>|<yymm>|<S/L/H><page> (15 characters, a 16x16 Data Matrix).
// Every other book (quarter, season, half-year, year, custom, undated) has its own book id, so any number of books, including
// several undated journals, can never share a code: KW3 + <book id: 8 characters> + <volume: 1 character> + <S/L/H> + <page: 3 digits>,
// 16 characters, no separators, still a 16x16 Data Matrix (measured: 16 capital letters and digits fit 16x16). Volume is base 36
// (1-9 then A-Z, 35 volumes at most). The book id is 40 random bits in Crockford base 32 (no I, L, O, U), made once and kept in
// content/profile.json (book.id); a project or account can hand ids out later. Nothing in a KW3 code is a date: an undated book's
// pages are named by their order. The edition is not in the code (there is no room); it is in the manifest with the book id.
export const BOOK_ID_RE = /^[0-9A-HJKMNP-TV-Z]{8}$/;
const B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export function newBookId(bytes) { // 5 random bytes (40 bits) -> 8 characters
  let n = 0n; for (const b of bytes) n = (n << 8n) | BigInt(b);
  let out = ''; for (let i = 0; i < 8; i++) { out = B32[Number(n & 31n)] + out; n >>= 5n; }
  return out;
}
const V36 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
export function kw3Code(bookId, vol, size, page) {
  if (!BOOK_ID_RE.test(bookId || '')) throw new Error(`book id ${JSON.stringify(bookId)} is not 8 characters of 0-9 A-Z without I L O U`);
  if (!(vol >= 1 && vol <= MAX_VOLUMES)) throw new Error(`a plan can have at most ${MAX_VOLUMES} volumes (the scan code has room for that many); this one has ${vol}`);
  if (!(page >= 1 && page <= 999)) throw new Error(`page ${page} does not fit three digits`);
  return `KW3${bookId}${V36[vol]}${size}${String(page).padStart(3, '0')}`;
}
export function parseKw3(code) {
  const m = /^KW3([0-9A-HJKMNP-TV-Z]{8})([1-9A-Z])([SLH])(\d{3})$/.exec(code || '');
  return m ? { bookId: m[1], vol: V36.indexOf(m[2]), size: m[3], page: +m[4] } : null;
}

// ---- volumes ----
// Cut a run of N days into volumes. `cuts` are the days a new volume may start on: [{ i, kind: 'month' | 'week' }] (0 < i < N).
// `pages(a, b)` is the printed page count of days [a, b). Every volume must stay within `limit`.
// Fewest volumes first; among those, cuts on month boundaries when a split that only uses them exists (else as few week cuts as
// possible); then the most even split (smallest biggest volume, then the least uneven). Ties go to the earlier cut.
export function splitVolumes(N, cuts, pages, limit = MAX_PAGES) {
  const memo = new Map();
  const f = (a, b) => { const k = a * 1e6 + b; if (!memo.has(k)) memo.set(k, pages(a, b)); return memo.get(k); };
  const total = f(0, N);
  if (total <= limit) return { volumes: [{ a: 0, b: N, pages: total, cutKind: null }], total, limit, reason: { total, fits: true } };
  const pts = [{ i: 0, kind: 'edge' }, ...cuts.filter((c) => c.i > 0 && c.i < N).sort((x, y) => x.i - y.i), { i: N, kind: 'edge' }];
  // reach[j] = the furthest point index a volume starting at pts[j] can end at within the limit
  const ok = (j, k) => f(pts[j].i, pts[k].i) <= limit;
  const attempt = (allowWeek) => {
    // best[v][k]: best way to cover days 0..pts[k] with v volumes: { w: week cuts, max, ss, from }
    let prev = new Map([[0, { w: 0, max: 0, ss: 0, from: -1, chain: [] }]]);
    for (let v = 1; v <= 200; v++) {
      const next = new Map();
      for (const [j, st] of prev) {
        for (let k = j + 1; k < pts.length; k++) {
          if (!ok(j, k)) break; // a longer run only gets bigger
          if (k < pts.length - 1 && pts[k].kind === 'week' && !allowWeek) continue;
          const p = f(pts[j].i, pts[k].i), cand = { w: st.w + (pts[k].kind === 'week' ? 1 : 0), max: Math.max(st.max, p), ss: st.ss + p * p, chain: [...st.chain, [pts[j].i, pts[k].i, p, pts[k].kind]] };
          const cur = next.get(k);
          if (!cur || cand.w < cur.w || (cand.w === cur.w && (cand.max < cur.max || (cand.max === cur.max && cand.ss < cur.ss)))) next.set(k, cand);
        }
      }
      if (next.has(pts.length - 1)) return { v, best: next.get(pts.length - 1) };
      if (!next.size) return null;
      prev = next;
    }
    return null;
  };
  const any = attempt(true);
  if (!any) throw new Error(`Cannot split the book into volumes of ${limit} pages or fewer: even the smallest run between two cut points is too long.`);
  const monthOnly = attempt(false);
  const useMonth = monthOnly && monthOnly.v === any.v;
  const pick = useMonth ? monthOnly : any;
  const volumes = pick.best.chain.map(([a, b, p, kind]) => ({ a, b, pages: p, cutKind: b === N ? null : kind }));
  return { volumes, total, limit, reason: { total, fits: false, fewest: any.v, monthOnlyFewest: monthOnly ? monthOnly.v : null, weekCuts: pick.best.w, useMonth } };
}

// Words for the build log and `render.mjs plan`.
export function explainSplit(res, hardcover) {
  const r = res.reason, n = res.volumes.length;
  if (r.fits) return `${r.total} pages fit in one book (limit ${res.limit}${hardcover ? `, hardcover needs ${HARDCOVER_MIN}+, padded with Notes pages` : ''}): no split.`;
  const parts = [`${r.total} pages in one book is over the ${res.limit}-page limit, so it is ${n} volumes: the fewest that each fit`];
  if (r.useMonth) parts.push('every cut is on a month boundary');
  else if (r.monthOnlyFewest) parts.push(`cutting on month boundaries alone would need ${r.monthOnlyFewest} volumes, so ${r.weekCuts} cut${r.weekCuts > 1 ? 's are' : ' is'} on a week boundary`);
  else parts.push(`month boundaries alone can't keep every volume within ${res.limit}, so ${r.weekCuts} cut${r.weekCuts > 1 ? 's are' : ' is'} on a week boundary`);
  return parts.join('; ') + '.';
}
