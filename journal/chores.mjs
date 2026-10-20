// Chores (BUILD-PLAN section 25, slice CH1): a tickable list of today's chores, rotation grids for a week or a month, and the
// energy-aware wording (a small version and a good-enough version of each chore). For one person, or an optional shared household.
//
// WHERE THE CHORES COME FROM. The profile's optional `chores` section (content/profile.json; `profile.example.json` shows the shape):
//   { "household": ["Alex", "Sam"],               optional, up to 4 names: turns on the person boxes and the rotation of who
//     "items": [ { "id", "name", "every", ... } ],
//     "swaps": [ { "chore": "bathroom", "date": "2026-10-23", "to": "Sam" } ] }   optional: trade one turn of a rotating chore (see chProblems)
// With no section the blocks use CH_SAMPLE below (generic, invented). Nothing about a person's home lives in code or in a Studio snapshot:
// a block's options say how to draw (how many lines, which groups, tiers, people on or off), never what the chores are.
//
// RECURRENCE IS COMPUTED FROM THE DATE, never stored and never counted. A chore has a due date for each occurrence and is LISTED from
// `lead` days before it, so a page printed in advance already knows what belongs on it:
//   every "day"     daily; `days` (mon..sun) limits it to some weekdays
//   every "week"    `day` (mon..sun) is the due weekday, listed `lead` days before it (default 3); no `day` = any day in the week, due Sunday, listed all week
//   every "month"   `day` (1..28 or "last") is the due day of the month, listed `lead` days before it (default 5)
//   every "season"  `months` (default 3, 6, 9, 12) with `day` (default 1), listed `lead` days before it (default 7)
// OVERDUE TONE. Paper cannot know what was done, so nothing here can be "overdue": no count, no streak, no red, no shame words. The only
// marker is a neutral "due soon" (a small open diamond, grey) on the due day and the day before, for a chore that is not daily.
// ENERGY. Each chore may carry `min` (a small version) and `ok` (a good-enough version). Either, any one, counts as done.
//
// No imports: the editor inlines this file in front of daypage.mjs (editor/build.mjs), so every top-level name starts with ch or CH_ and
// every CSS class with chx. Pure: no fs, no DOM.

export const CH_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
export const CH_EVERY = ['day', 'week', 'month', 'season'];
export const CH_GROUPS = { day: 'Daily', week: 'Weekly', month: 'Monthly', season: 'Seasonal' };
export const CH_MAX_PEOPLE = 4, CH_MAX_ITEMS = 40, CH_MAX_SWAPS = 60;
export const CH_LEVELS = ['none', 'small', 'enough', 'full']; // what a tick can mean (X4 and paper): 0 nothing, 1 the small version, 2 good enough, 3 the whole chore
export const CH_DEFAULT_MONTHS = [3, 6, 9, 12];
const CH_LEAD = { day: 0, week: 3, weekAny: 6, month: 5, season: 7 }, CH_LEAD_MAX = { day: 0, week: 6, month: 27, season: 60 };

// A generic sample (invented; nothing personal). Used when the profile has no `chores` section, and by the editor's public demo.
export const CH_SAMPLE = {
  household: ['Alex', 'Sam'],
  items: [
    { id: 'dishes', name: 'Dishes', every: 'day', min: 'Rinse what is in the sink', ok: 'Everything in the dishwasher or drying' },
    { id: 'counters', name: 'Wipe the counters', every: 'day', min: 'Clear one counter', ok: 'The kitchen counters wiped' },
    { id: 'floor-things', name: 'Things off the floor', every: 'day', min: 'Put away what is in the way', ok: 'One room clear' },
    { id: 'rubbish', name: 'Rubbish and recycling', every: 'week', day: 'tue', lead: 1, who: 'rotate', min: 'Take out the full bin', ok: 'Bins out for collection' },
    { id: 'laundry', name: 'Laundry', every: 'week', min: 'One load in the machine', ok: 'Washed and dried, folded later' },
    { id: 'bathroom', name: 'Bathroom', every: 'week', day: 'fri', who: 'rotate', min: 'Wipe the sink', ok: 'Sink, toilet and mirror' },
    { id: 'floors', name: 'Floors', every: 'week', day: 'sat', min: 'Sweep the kitchen', ok: 'Vacuum the main rooms' },
    { id: 'bed-linen', name: 'Bed linen', every: 'week', day: 'sun', lead: 2, min: 'New pillowcase', ok: 'Sheets changed' },
    { id: 'fridge', name: 'Fridge clear-out', every: 'month', day: 1, min: 'Bin what is clearly finished', ok: 'Shelves wiped' },
    { id: 'smoke-alarm', name: 'Test the smoke alarms', every: 'month', day: 15, min: 'Test one', ok: 'All tested' },
    { id: 'oven', name: 'Clean the oven', every: 'month', day: 'last', who: 'rotate', min: 'Wipe the door', ok: 'The inside wiped' },
    { id: 'windows', name: 'Wash the windows', every: 'season', months: [4, 10], day: 10, lead: 10, min: 'The kitchen window', ok: 'The windows you can reach' },
    { id: 'wardrobe', name: 'Swap the wardrobe', every: 'season', months: [3, 9], day: 5, lead: 10, min: 'One bag out', ok: 'The season you need now' },
  ],
};

// ---- the configuration ----
let CH_CFG = null; // the profile's section; null = the sample
export const chUse = (cfg) => { CH_CFG = cfg && typeof cfg === 'object' && Array.isArray(cfg.items) ? cfg : null; };
export const chConfig = () => chNorm(CH_CFG || CH_SAMPLE);
const chText = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const chInt = (v, lo, hi) => (Number.isInteger(v) && v >= lo && v <= hi ? v : null);

// What is wrong with a `chores` section, in words ([] = fine). Profile validation and `node test-chores.mjs` use it.
export function chProblems(c) {
  const out = [], bad = (w, m) => out.push(`chores${w}: ${m}`);
  if (c === undefined) return out;
  if (!c || typeof c !== 'object' || Array.isArray(c)) return ['chores: optional; must be an object like {"household": [...], "items": [...]}'];
  if (c.household !== undefined && !(Array.isArray(c.household) && c.household.length <= CH_MAX_PEOPLE && c.household.every((n) => typeof n === 'string' && n.trim() && n.trim().length <= 14)))
    bad('.household', `optional; a list of up to ${CH_MAX_PEOPLE} names, each 1 to 14 characters`);
  if (!Array.isArray(c.items) || !c.items.length || c.items.length > CH_MAX_ITEMS) { bad('.items', `must be a list of 1 to ${CH_MAX_ITEMS} chores`); return out; }
  const ids = new Set(), people = Array.isArray(c.household) ? c.household.map((n) => String(n).trim()) : [];
  c.items.forEach((it, i) => {
    const at = `.items[${i}]`;
    if (!it || typeof it !== 'object' || Array.isArray(it)) { bad(at, 'must be an object'); return; }
    if (!(typeof it.id === 'string' && /^[a-z0-9][a-z0-9-]{0,23}$/.test(it.id))) bad(`${at}.id`, 'is required: lowercase letters, digits and dashes, up to 24 (it names the chore on the X4)');
    else if (ids.has(it.id)) bad(`${at}.id`, `"${it.id}" is used twice`); else ids.add(it.id);
    if (!chText(it.name, 40) || it.name.trim().length > 28) bad(`${at}.name`, 'is required: 1 to 28 characters');
    if (!CH_EVERY.includes(it.every)) { bad(`${at}.every`, `must be one of ${CH_EVERY.join(', ')}`); return; }
    if (it.every === 'day' && it.days !== undefined && !(Array.isArray(it.days) && it.days.length && it.days.every((d) => CH_DAYS.includes(d)))) bad(`${at}.days`, `optional; weekdays from ${CH_DAYS.join(', ')}`);
    if (it.every === 'week' && it.day !== undefined && !CH_DAYS.includes(it.day)) bad(`${at}.day`, `optional for a weekly chore; one of ${CH_DAYS.join(', ')}`);
    if ((it.every === 'month' || it.every === 'season') && it.day !== undefined && !(it.day === 'last' || chInt(it.day, 1, 28))) bad(`${at}.day`, 'optional; 1 to 28, or "last"');
    if (it.every === 'season' && it.months !== undefined && !(Array.isArray(it.months) && it.months.length && it.months.length <= 6 && it.months.every((m) => chInt(m, 1, 12)) && new Set(it.months).size === it.months.length)) bad(`${at}.months`, 'optional; up to 6 different months, 1 to 12');
    if (it.lead !== undefined && !chInt(it.lead, 0, CH_LEAD_MAX[it.every])) bad(`${at}.lead`, `optional; days before the due date to start listing it, 0 to ${CH_LEAD_MAX[it.every]}`);
    for (const k of ['min', 'ok']) if (it[k] !== undefined && !(typeof it[k] === 'string' && it[k].trim() && it[k].trim().length <= 60)) bad(`${at}.${k}`, 'optional; 1 to 60 characters (the small version, the good-enough version)');
    if (it.who !== undefined && !(it.who === 'rotate' ? people.length >= 2 : people.includes(it.who))) bad(`${at}.who`, '"rotate" (needs two or more names in household) or one of the household names');
    if (it.x4 !== undefined && typeof it.x4 !== 'boolean') bad(`${at}.x4`, 'optional; false keeps the chore off the X4 list');
  });
  if (c.swaps !== undefined) chSwapProblems(c, people, out.length === 0, bad);
  return out;
}
// Trading a turn ("swaps"). A rotating chore goes round the household by itself; a swap hands ONE turn to someone else and the rotation carries on as
// before. Each swap names the chore, the day it is due and who takes that turn. The messages say what to change, in plain words.
function chSwapProblems(c, people, itemsOk, bad) {
  const list = c.swaps;
  if (!Array.isArray(list) || list.length > CH_MAX_SWAPS) return bad('.swaps', `optional; a list of up to ${CH_MAX_SWAPS} trades like {"chore": "bathroom", "date": "2026-10-23", "to": "Sam"}: the chore, the day it is due, and who takes that turn`);
  if (list.length && people.length < 2) return bad('.swaps', 'trading a turn needs a household with two or more names, and a chore that has "who": "rotate"');
  const cfg = itemsOk ? chNorm(c) : null, seen = new Set(), ids = (c.items || []).map((i) => i && i.id).filter(Boolean).join(', ');
  list.forEach((w, i) => {
    const at = `.swaps[${i}]`;
    if (!w || typeof w !== 'object' || Array.isArray(w)) return bad(at, 'must look like {"chore": "bathroom", "date": "2026-10-23", "to": "Sam"}');
    for (const k of Object.keys(w)) if (!['chore', 'date', 'to'].includes(k)) bad(`${at}.${k}`, 'is not part of a trade; use chore, date and to');
    const it = (c.items || []).find((x) => x && x.id === w.chore);
    if (!it) return bad(`${at}.chore`, `"${w.chore}" is not one of your chores (the ids are ${ids})`);
    if (it.who !== 'rotate') return bad(`${at}.chore`, `${it.name || it.id} does not rotate, so it has no turn to trade. Give it "who": "rotate" first`);
    const n = chParse(w.date);
    if (n === null) return bad(`${at}.date`, 'use the day the chore is due, written like 2026-10-23');
    if (!people.includes(w.to)) return bad(`${at}.to`, `"${w.to}" is not in your household (${people.join(', ')})`);
    const key = `${w.chore}|${w.date}`;
    if (seen.has(key)) return bad(at, `${it.name} on ${w.date} is traded twice; keep one`);
    seen.add(key);
    if (!cfg) return;
    const ni = cfg.items.find((x) => x.id === w.chore), o = ni && chOcc(ni, n);
    if (!o || o.due !== n) {
      let next = null;
      for (let d = n + 1; d <= n + 400 && next === null; d++) { const x = chOcc(ni, d); if (x && x.due === d) next = d; }
      return bad(`${at}.date`, `${it.name} is not due on ${w.date}${next === null ? '' : `. Its next due day after that is ${chIso(next)}`}. A trade uses the day the chore is due`);
    }
    if (chWho(ni, cfg.people, o.k) === w.to) bad(`${at}.to`, `${w.to} already has that turn on ${w.date}, so there is nothing to trade`);
  });
}

// A configuration made safe to use (a bad value falls back; the build refuses a bad profile before it gets here).
export function chNorm(c) {
  const people = (Array.isArray(c.household) ? c.household : []).map((n) => chText(n, 14)).filter(Boolean).slice(0, CH_MAX_PEOPLE);
  const items = [], seen = new Set();
  for (const it of (c.items || []).slice(0, CH_MAX_ITEMS)) {
    if (!it || !CH_EVERY.includes(it.every) || seen.has(it.id)) continue;
    seen.add(it.id);
    const o = { id: String(it.id), name: chText(it.name, 28) || String(it.id), every: it.every };
    if (it.every === 'day' && Array.isArray(it.days)) { const d = CH_DAYS.map((x, i) => (it.days.includes(x) ? i : -1)).filter((i) => i >= 0); if (d.length && d.length < 7) o.days = d; }
    if (it.every === 'week') o.day = CH_DAYS.indexOf(it.day) >= 0 ? CH_DAYS.indexOf(it.day) : undefined;
    if (it.every === 'month' || it.every === 'season') o.day = it.day === 'last' ? 'last' : chInt(it.day, 1, 28) || 1;
    if (it.every === 'season') o.months = (Array.isArray(it.months) && it.months.every((m) => chInt(m, 1, 12)) && it.months.length ? [...it.months] : CH_DEFAULT_MONTHS).sort((a, b) => a - b);
    o.lead = chInt(it.lead, 0, CH_LEAD_MAX[it.every]);
    if (o.lead === null) o.lead = it.every === 'week' ? (o.day === undefined ? CH_LEAD.weekAny : CH_LEAD.week) : CH_LEAD[it.every];
    const min = chText(it.min, 60), ok = chText(it.ok, 60); if (min) o.min = min; if (ok) o.ok = ok;
    if (it.who === 'rotate' && people.length >= 2) o.who = 'rotate'; else if (people.includes(it.who)) o.who = it.who;
    o.x4 = it.x4 !== false;
    items.push(o);
  }
  const swaps = {}; // 'chore id|due date' -> the person who takes that one turn (a swap of a turn; the rotation carries on as before)
  for (const w of (Array.isArray(c.swaps) ? c.swaps : []).slice(0, CH_MAX_SWAPS)) {
    const it = w && items.find((x) => x.id === w.chore);
    if (it && it.who === 'rotate' && chParse(w.date) !== null && people.includes(w.to)) swaps[`${it.id}|${w.date}`] = w.to;
  }
  return { people, items, swaps };
}
export const chPeople = (cfg) => (cfg.people.length ? cfg.people : ['', '']); // household mode with no names: two write-in columns
// One letter for a person's column; two when two names start alike.
export function chInitials(people) {
  const used = {}; return people.map((p) => { if (!p) return ''; const a = p[0].toUpperCase(); used[a] = (used[a] || 0) + 1; return a; }).map((a, i, all) => (a && all.filter((x) => x === a).length > 1 ? people[i].slice(0, 2).replace(/^./, (c) => c.toUpperCase()) : a));
}

// ---- dates (days since 1970-01-01, a Thursday; weekday 0 = Monday) ----
export const chParse = (s) => { const m = /^(\d{4})-(\d\d)-(\d\d)$/.exec(s || ''); if (!m) return null; const t = Date.UTC(+m[1], +m[2] - 1, +m[3]); return Number.isFinite(t) && new Date(t).getUTCMonth() === +m[2] - 1 ? Math.floor(t / 864e5) : null; };
export const chIso = (n) => new Date(n * 864e5).toISOString().slice(0, 10);
export const chDow = (n) => (((n + 3) % 7) + 7) % 7;
const chYMD = (n) => { const d = new Date(n * 864e5); return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() }; };
const chLast = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const chOn = (y, m, day) => Math.floor(Date.UTC(y, m - 1, day === 'last' ? chLast(y, m) : Math.min(day, chLast(y, m))) / 864e5); // m may run past 12 or below 1: Date.UTC rolls the year

// The occurrence of a chore that day n belongs to, or null when the chore is not listed that day: { due, k, soon }.
// `k` numbers the occurrences (it decides whose turn it is when a chore rotates). `soon`: due today or tomorrow, not daily.
export function chOcc(it, n) {
  const dow = chDow(n);
  if (it.every === 'day') return !it.days || it.days.includes(dow) ? { due: n, k: n, soon: false } : null;
  const c = [];
  if (it.every === 'week') { const mon = n - dow, w = it.day === undefined ? 6 : it.day; for (const o of [0, 7]) c.push({ due: mon + w + o, k: Math.floor((mon + w + o + 3) / 7) }); }
  else if (it.every === 'month') { const { y, m } = chYMD(n); for (const o of [0, 1]) c.push({ due: chOn(y, m + o, it.day), k: y * 12 + m + o }); }
  else { const { y } = chYMD(n); for (const yy of [y, y + 1]) it.months.forEach((mm, i) => c.push({ due: chOn(yy, mm, it.day), k: yy * it.months.length + i })); }
  const hit = c.filter((x) => x.due >= n && x.due - it.lead <= n).sort((a, b) => a.due - b.due)[0];
  return hit ? { ...hit, soon: hit.due - n <= 1 } : null;
}
// Whose turn it is (a name), or '' for a shared chore.
// `swapTo` is the person a swap gave this one turn to (cfg.swaps), if any; only a rotating chore can be swapped.
export const chWho = (it, people, k, swapTo = '') => (it.who === 'rotate' && people.length ? (swapTo && people.includes(swapTo) ? swapTo : people[((k % people.length) + people.length) % people.length]) : it.who || '');
// The person a swap gave the turn due on day n (a day number) to, or ''.
export const chSwapOf = (cfg, it, due) => (cfg.swaps && cfg.swaps[`${it.id}|${chIso(due)}`]) || '';

const chGroupOn = (groups, it) => !groups || groups[it.every] !== false;
// What is on the day list for date n (a day number; null = no date: the daily chores only), in the order they print:
// the ones due soon first, then the daily ones, then the rest, each in the order the profile lists them. [{ it, soon, who }]
export function chToday(cfg, n, groups) {
  const out = [];
  for (const it of cfg.items) {
    if (!chGroupOn(groups, it)) continue;
    if (n === null && it.every !== 'day') continue;
    const o = n === null ? { due: 0, k: 0, soon: false } : chOcc(it, n);
    if (o) out.push({ it, soon: o.soon, who: n === null ? '' : chWho(it, cfg.people, o.k, chSwapOf(cfg, it, o.due)) }); // an undated page cannot know whose turn it is
  }
  const rank = (e) => (e.soon ? 0 : e.it.every === 'day' ? 1 : 2);
  return out.map((e, i) => ({ e, i })).sort((a, b) => rank(a.e) - rank(b.e) || a.i - b.i).map((x) => x.e);
}

// The week grid: for each chore the seven weekdays (Monday first) it is listed on, and which one is the due day. Dated (n = a day in the
// week): every group. Undated: daily and weekly chores only (a monthly or seasonal chore needs a date to know which week it is).
// [{ it, cells: [{ on, due }...7], who }]
export function chWeek(cfg, n, groups) {
  const out = [];
  for (const it of cfg.items) {
    if (!chGroupOn(groups, it)) continue;
    let cells;
    if (n !== null) {
      const mon = n - chDow(n); cells = Array.from({ length: 7 }, (_, i) => { const o = chOcc(it, mon + i); return { on: !!o, due: !!o && it.every !== 'day' && o.due === mon + i }; });
      if (!cells.some((c) => c.on)) continue;
    } else if (it.every === 'day') cells = Array.from({ length: 7 }, (_, i) => ({ on: !it.days || it.days.includes(i), due: false }));
    else if (it.every === 'week') { const w = it.day === undefined ? 6 : it.day; cells = Array.from({ length: 7 }, (_, i) => ({ on: ((w - i + 7) % 7) <= it.lead, due: i === w })); }
    else continue;
    const first = n === null ? -1 : cells.findIndex((c) => c.on), o = first < 0 ? null : chOcc(it, n - chDow(n) + first);
    out.push({ it, cells, who: n === null || !o ? '' : chWho(it, cfg.people, o.k, chSwapOf(cfg, it, o.due)) });
  }
  return out;
}

// The month grid. DATED (a date in the month): the columns are the month's real calendar weeks, Monday to Sunday. Week 1 is the week the 1st falls in
// (it may start in the month before), the last week is the one the last day falls in, so a month has 4 to 6 of them. A chore gets a box in the week its
// DUE day falls in (a weekly chore in each week it is due in this month; a monthly one in the week of its day; a seasonal one only in its months).
// UNDATED (a template): no calendar to count from, so the columns stay W1 to W5 = days 1-7, 8-14, 15-21, 22-28 and 29 on, and the page says so.
// Daily chores are not boxed: they print as one line.
// { weeks: 4..6, ranges: [[first day, last day] of each week] | null (undated), daily: [chore...], rows: [{ it, cells: [bool x weeks], who, hint }] }
export function chMonth(cfg, n, groups) {
  const ym = n === null ? null : chYMD(n), len = ym ? chLast(ym.y, ym.m) : 31, first = ym ? chOn(ym.y, ym.m, 1) : 0, lead = ym ? chDow(first) : 0;
  const weeks = ym ? Math.ceil((lead + len) / 7) : 5, wk = (day) => (ym ? Math.floor((lead + day - 1) / 7) : Math.min(weeks, Math.ceil(day / 7)) - 1); // week index of a day of the month
  const ranges = ym ? Array.from({ length: weeks }, (_, w) => [Math.max(1, w * 7 - lead + 1), Math.min(len, w * 7 - lead + 7)]) : null;
  const rows = [], daily = [];
  for (const it of cfg.items) {
    if (!chGroupOn(groups, it)) continue;
    if (it.every === 'day') { daily.push(it); continue; }
    const cells = Array(weeks).fill(false);
    let who = '', hint = '';
    if (ym) {
      const dues = new Map(); // day of the month -> the occurrence due that day
      for (let d = 1; d <= len; d++) { const o = chOcc(it, first + d - 1); if (o && o.due >= first && o.due < first + len) dues.set(o.due - first + 1, o); }
      if (!dues.size) continue; // a seasonal chore outside its months
      for (const day of dues.keys()) cells[wk(day)] = true;
      if (it.every !== 'week') { const o = [...dues.values()][0]; who = chWho(it, cfg.people, o.k, chSwapOf(cfg, it, o.due)); } // a weekly chore changes hands every week: no one name for the row
    } else {
      if (it.every === 'week') cells.fill(true);
      else cells[wk(it.day === 'last' ? 31 : Math.min(it.day, 31))] = true;
      if (it.every === 'season') hint = it.months.map((m) => CH_MON[m - 1]).join(' ');
    }
    rows.push({ it, cells, who, hint });
  }
  return { weeks, ranges, daily, rows };
}

// ---- the X4 check-in (data model only: the firmware slice CH3 reads it, BUILD-PLAN section 25.6) ----
// What the pack export would put on the SD card for a run of days: the day's chores with their labels and the two versions. The X4 sends back
// ticks as { date, ticks: { <chore id>: 0..3 } } (CH_LEVELS) over the user-started sync, never in the background. Nothing here counts anything.
export function chX4Pack(cfg, from, days) {
  const n0 = chParse(from), out = {};
  if (n0 === null) return out;
  for (let i = 0; i < Math.max(0, Math.min(days, 62)); i++) {
    const rows = chToday(cfg, n0 + i).filter((e) => e.it.x4);
    out[chIso(n0 + i)] = rows.map((e) => ({ id: e.it.id, label: e.it.name, ...(e.it.min ? { min: e.it.min } : {}), ...(e.it.ok ? { ok: e.it.ok } : {}), ...(e.who ? { who: e.who } : {}), ...(e.soon ? { soon: true } : {}) }));
  }
  return out;
}
// A tick report from the device, checked: only known chore ids, only 0..3. Anything else is dropped (the Studio never stores a field it did not ask for).
export function chTicks(raw, cfg) {
  const ids = new Set(cfg.items.map((i) => i.id)), out = {};
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) for (const [k, v] of Object.entries(raw)) if (ids.has(k) && Number.isInteger(v) && v >= 1 && v <= 3) out[k] = v; // 0 (nothing) is simply absent
  return out;
}

// ---- the drawing ----
// Marks are SVG, never font glyphs (no Type 3 fonts). A tick can be one box, or three round marks: a quarter (the small version), a half (good enough), all of it.
const chMark = (level) => {
  const f = { 1: '<path d="M4.5 4.5V.8a3.7 3.7 0 0 1 3.7 3.7Z" fill="currentColor" stroke="none"/>', 2: '<path d="M4.5 .8a3.7 3.7 0 0 1 0 7.4Z" fill="currentColor" stroke="none"/>', 3: '<circle cx="4.5" cy="4.5" r="3.7" fill="currentColor" stroke="none"/>' }[level];
  return `<svg class="chxq" width="10" height="10" viewBox="0 0 9 9" fill="none" stroke="currentColor" stroke-width="1" aria-hidden="true"><circle cx="4.5" cy="4.5" r="3.7"/>${f}</svg>`;
};
const chSoon = '<svg class="chxs" width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round" aria-hidden="true"><path d="M6 1.6 10.4 6 6 10.4 1.6 6Z"/></svg>';
export const CH_WORDS = { soon: 'soon', small: 'small', enough: 'good enough', full: 'all of it', more: 'and more', weeksUndated: 'W1 to W5: days 1 to 7, 8 to 14, 15 to 21, 22 to 28, 29 on' }; // the printed words, in one place
const chBox = (cls = '') => `<i class="chxb${cls}"></i>`;

// The block's drawing. `H` carries daypage's helpers ({ esc, lbl }): this file imports nothing.
export function chHtml(b, parts, Z, H) {
  const dateS = parts.day && !parts.day.undated ? parts.day.date || '' : '', n = chParse(dateS);
  return b.type === 'chores' ? chListHtml(b, n, Z, H) : chRotaHtml(b, n, dateS, Z, H);
}
function chListHtml(b, n, Z, H) {
  const cfg = chConfig(), people = b.people ? chPeople(cfg) : [], P = people.length, ini = chInitials(people), list = chToday(cfg, n, b.groups);
  const ticks = b.tiers === 'ticks' && !P, text = b.tiers === 'text' || (b.tiers === 'ticks' && P > 0);
  const shown = list.length > b.n ? list.slice(0, b.n - 1) : list, more = list.length - shown.length;
  const tier = (it) => (text && (it.min || it.ok) ? `<div class="chxt">${it.min ? `<em>${CH_WORDS.small}</em> ${H.esc(it.min)}` : ''}${it.min && it.ok ? ' · ' : ''}${it.ok ? `<em>${CH_WORDS.enough}</em> ${H.esc(it.ok)}` : ''}</div>` : '');
  const marks = ticks ? `<span class="chxm chx3">${chMark(1)}${chMark(2)}${chMark(3)}</span>` : `<span class="chxm">${chBox()}</span>`;
  const row = (e) => {
    const soonI = b.soon && e.soon ? `<span class="chxd">${chSoon}${CH_WORDS.soon}</span>` : '';
    const nm = `<span class="chxn">${H.esc(e.it.name)}</span>${soonI}`;
    if (P) return `<div class="chxr chxh" style="--p:${P}"><span class="chxw">${nm}</span>${people.map((p) => chBox(e.who && e.who === p ? ' chxa' : '')).join('')}</div>${tier(e.it)}`;
    return `<div class="chxr">${marks}${nm}</div>${tier(e.it)}`;
  };
  const rows = shown.map(row);
  if (more > 0) rows.push(`<div class="chxr chxo"><span class="chxn">${CH_WORDS.more}</span></div>`);
  while (rows.length < b.n) rows.push(`<div class="chxr chxe${P ? ' chxh' : ''}"${P ? ` style="--p:${P}"` : ''}>${P ? `<span class="chxw"></span>${people.map(() => chBox()).join('')}` : `<span class="chxm">${chBox()}</span><span class="chxl"></span>`}</div>`);
  const legend = ticks ? `<div class="chxkl">${chMark(1)} ${CH_WORDS.small} · ${chMark(2)} ${CH_WORDS.enough} · ${chMark(3)} ${CH_WORDS.full}</div>` : chLegend(people, ini, H);
  const alt = `${b.title || 'Chores'}: ${shown.length ? shown.map((e) => e.it.name + (b.soon && e.soon ? ' (due soon)' : '')).join(', ') : 'no chores listed'}${more > 0 ? ', and more' : ''}. ${P ? 'A tick box for each person.' : ticks ? 'Each has three marks: the small version, good enough, or all of it.' : 'Each has a tick box.'}`;
  return `<div class="xb chxg" ${Z} role="group" aria-label="${H.esc(alt).replace(/"/g, '&quot;')}"><div class="chxhd">${H.lbl('chores', b.title || 'Chores')}</div>${legend}${rows.join('')}</div>`;
}
// The line that says which letter is which person (nothing when no names are set: the columns are then write-in).
const chLegend = (people, ini, H) => { const t = people.map((p, i) => (p ? `${ini[i]} ${H.esc(p)}` : '')).filter(Boolean).join(' · '); return t ? `<div class="chxkl">${t}</div>` : ''; };
const CH_MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function chRotaHtml(b, n, dateS, Z, H) {
  const cfg = chConfig(), people = b.people ? chPeople(cfg) : [], P = people.length, ini = chInitials(people), month = b.period === 'month';
  let cols, head, caption = '', body = [], overflow = 0, daily = [], weekKey = '';
  if (month) {
    const M = chMonth(cfg, n, b.groups); daily = M.daily; cols = M.weeks;
    weekKey = M.ranges ? M.ranges.map(([a, z], i) => `W${i + 1} ${a}${z > a ? '–' + z : ''}`).join(' · ') : CH_WORDS.weeksUndated; // the week columns, said in days of the month
    head = Array.from({ length: cols }, (_, i) => `<span class="chxc"><b>W${i + 1}</b></span>`);
    body = M.rows.map((r) => ({ it: r.it, cells: r.cells.map((on) => ({ on, due: false })), who: r.who, hint: r.hint }));
    if (n !== null) { const y = chIso(n).slice(0, 4), m = +chIso(n).slice(5, 7); caption = `${CH_MON[m - 1]} ${y}`; }
  } else {
    cols = 7; head = [...'MTWTFSS'].map((l) => `<span class="chxc"><b>${l}</b></span>`);
    body = chWeek(cfg, n, b.groups).map((r) => ({ ...r, hint: '' }));
    if (n !== null) { const a = n - chDow(n), A = chIso(a), chE = chIso(a + 6); caption = `${CH_MON[+A.slice(5, 7) - 1]} ${+A.slice(8)} – ${A.slice(5, 7) === chE.slice(5, 7) ? '' : CH_MON[+chE.slice(5, 7) - 1] + ' '}${+chE.slice(8)}`; }
  }
  const rank = { day: 0, week: 1, month: 2, season: 3 };
  body.sort((a, c) => rank[a.it.every] - rank[c.it.every]);
  if (body.length > b.n) { overflow = body.length - b.n; body = body.slice(0, b.n); }
  const tpl = `style="grid-template-columns:minmax(0,1fr) repeat(${cols},0.17in)${P ? ` 0.1in repeat(${P},0.2in)` : ''}"`, pc = people.map((p, i) => `<span class="chxc"><b title="${H.esc(p)}">${ini[i]}</b></span>`).join('');
  const rows = [`<div class="chxr chxy" ${tpl}><span class="chxw"></span>${head.join('')}${P ? '<span></span>' : ''}${pc}</div>`];
  let last = '';
  for (const r of body) {
    if (r.it.every !== last) { last = r.it.every; rows.push(`<div class="chxr chxz"><span class="chxn">${CH_GROUPS[last]}</span></div>`); }
    const cells = r.cells.map((c) => `<span class="chxc">${c.on ? chBox(c.due ? ' chxu' : '') : ''}</span>`).join('');
    const pb = (P ? '<span></span>' : '') + people.map((p) => `<span class="chxc">${chBox(r.who && r.who === p ? ' chxa' : '')}</span>`).join('');
    rows.push(`<div class="chxr chxy" ${tpl}><span class="chxw"><span class="chxn">${H.esc(r.it.name)}${r.hint ? ` <small>${r.hint}</small>` : ''}</span></span>${cells}${pb}</div>`);
    if (b.tiers && (r.it.min || r.it.ok)) rows.push(`<div class="chxt chxi">${r.it.min ? `<em>${CH_WORDS.small}</em> ${H.esc(r.it.min)}` : ''}${r.it.min && r.it.ok ? ' · ' : ''}${r.it.ok ? `<em>${CH_WORDS.enough}</em> ${H.esc(r.it.ok)}` : ''}</div>`);
  }
  if (overflow) rows.push(`<div class="chxr chxo"><span class="chxn">${CH_WORDS.more}</span></div>`);
  if (month && daily.length) rows.push(`<div class="chxr chxdl"><span class="chxn"><em>${CH_GROUPS.day}</em> ${daily.map((d) => H.esc(d.name)).join(' · ')}</span></div>`);
  const alt = `${b.title || 'Chore rotation'}: a ${month ? 'month' : 'week'} grid${caption ? ' for ' + caption : ''}${month ? (n === null ? `, in weeks of the month: ${weekKey}` : ', in calendar weeks that run Monday to Sunday') : ''}. ${body.length ? body.map((r) => r.it.name).join(', ') : 'No chores in these groups'}${overflow ? ', and more' : ''}. ${P ? 'A tick box for each person.' : ''}`;
  return `<div class="xb chxg" ${Z} role="group" aria-label="${H.esc(alt.trim()).replace(/"/g, '&quot;')}"><div class="chxhd">${H.lbl('chorerota', b.title || (month ? 'Chores this month' : 'Chores this week'))}${caption ? `<span class="chxk">${caption}</span>` : ''}</div>${weekKey ? `<div class="chxkl">${weekKey}</div>` : ''}${chLegend(people, ini, H)}${rows.join('')}</div>`;
}

// ---- the size a block needs (daypage.mjs MINSPAN; the editor test measures that a block fits it) ----
export const CH_ROW_IN = 0.2, CH_TIER_IN = 0.15, CH_HEAD_IN = 0.24, CH_GROUP_IN = 0.17;
export function chMin(b) {
  const P = b.people ? chPeople(chConfig()).length : 0;
  if (b.type === 'chores') return [P > 2 ? 3 : 2, CH_HEAD_IN + (b.tiers === 'ticks' || P ? CH_TIER_IN : 0) + b.n * CH_ROW_IN + (b.tiers === 'text' || (b.tiers === 'ticks' && P) ? b.n * CH_TIER_IN : 0) + 0.04];
  const g = Object.values(b.groups).filter(Boolean).length;
  return [P ? 4 : 3, CH_HEAD_IN + (P ? CH_TIER_IN : 0) + (b.period === 'month' ? CH_TIER_IN : 0) + CH_ROW_IN + g * CH_GROUP_IN + b.n * CH_ROW_IN + (b.tiers ? b.n * CH_TIER_IN : 0) + (b.period === 'month' ? CH_ROW_IN : 0) + 0.18];
}

export const CH_CSS = `
/* Chores (chores.mjs): the day list and the rotation grids. Every class starts with chx. Greys only: nothing here is a colour, and nothing is red. */
.chxg { font: 500 7pt Inter, sans-serif; color: #222; }
.chxhd { display: flex; align-items: center; gap: 6px; height: ${CH_HEAD_IN}in; overflow: hidden; white-space: nowrap; } .chxhd > .xl { flex: none; }
.chxk { flex: 0 1 auto; min-width: 0; margin-left: auto; overflow: hidden; text-overflow: ellipsis; display: block; font: italic 500 6.2pt Inter, sans-serif; color: #666; }
.chxkl { height: ${CH_TIER_IN}in; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: italic 500 6.2pt Inter, sans-serif; color: #666; } .chxq { color: #222; vertical-align: -1px; }
.chxr { display: flex; align-items: center; gap: 4px; height: ${CH_ROW_IN}in; min-width: 0; overflow: hidden; }
.chxm { display: inline-flex; align-items: center; gap: 2px; flex: none; } .chxm.chx3 { gap: 3px; }
.chxb { display: block; flex: none; width: 0.11in; height: 0.11in; border: 1.1px solid #000; box-sizing: border-box; } .chxb.chxu { border-width: 1.8px; } .chxb.chxa { border-width: 2.2px; }
.chxn { flex: 0 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .chxn small { font-size: 5.6pt; color: #666; }
.chxd { flex: none; display: inline-flex; align-items: center; gap: 2px; font: italic 500 6pt Inter, sans-serif; color: #555; } .chxs { flex: none; }
.chxl { flex: 1; min-width: 0.3in; align-self: flex-end; height: 0.12in; border-bottom: 1px solid #a0a0a0; }
.chxe .chxb { opacity: 1; }
.chxo { font: italic 500 6.5pt Inter, sans-serif; color: #666; }
.chxt { height: ${CH_TIER_IN}in; padding-left: 0.17in; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: 500 6pt Inter, sans-serif; color: #555; } .chxt em, .chxdl em { font-style: italic; color: #333; margin-right: 1px; } .chxt.chxi { padding-left: 0.04in; }
.chxr.chxh { display: grid; grid-template-columns: minmax(0, 1fr) repeat(var(--p), 0.24in); gap: 2px; justify-items: center; } .chxr.chxh > .chxw { justify-self: stretch; }
.chxw { display: flex; align-items: center; gap: 4px; min-width: 0; }
.chxr.chxy { display: grid; column-gap: 2px; height: ${CH_ROW_IN}in; }
.chxc { display: flex; align-items: center; justify-content: center; } .chxc b { font: 600 6pt Inter, sans-serif; color: #444; }
.chxr.chxz { height: ${CH_GROUP_IN}in; font: 600 5.8pt Inter, sans-serif; text-transform: uppercase; letter-spacing: 0.5px; color: #555; border-top: 1px solid #d0d0d0; margin-top: 1px; }
.chxdl { font: 500 6.5pt Inter, sans-serif; color: #444; }
`;
