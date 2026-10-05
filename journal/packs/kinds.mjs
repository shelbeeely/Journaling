// The pack kind registry. A kind is one entry here; adding a kind means adding one entry (and a template folder in _template/<kind>/).
// An entry says, for its kind:
//   title        what the book calls it in messages
//   privacy      'public' (may be shared, forked, and referenced by id + hash in a Studio snapshot) or
//                'personal' (personal contacts and support numbers: never in a snapshot or a fork, see studio/src/snapshot.mjs)
//   file         the data file, relative to the pack folder (a region bundle lists the parts it may hold instead)
//   schema       the data format in one paragraph (PACKS.md shows it in full)
//   validate     (data, ctx) -> { errors, warnings }   the kind's own data check (the common checks live in pack.mjs)
//   gate         (data, ctx) -> { refuse, warn }        optional: the rule that refuses to print (crisis and support kinds: verification)
//   consume      (data, ctx) -> value                   what the build reads (the shape the page builders already take)
//   consumedBy   how the build uses it, in words
//   print        print rules for this kind
//   limits       { maxFileBytes, maxTotalBytes }
// Pure: no profile, no engine, so the CLI, the Studio scanner and the loader can all import it.
import fs from 'node:fs';
import path from 'node:path';

const isObj = (x) => x && typeof x === 'object' && !Array.isArray(x);
const str = (v) => typeof v === 'string' && v.trim() !== '';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const isVerification = (v) => isObj(v) && str(v.who) && typeof v.date === 'string' && DATE_RE.test(v.date) && !Number.isNaN(Date.parse(v.date + 'T00:00:00Z')) && str(v.source);
export const CHIPS = ['TEXT', 'CALL', 'CHAT', 'EMAIL', 'VISIT', 'ONLINE'];
const ok = () => ({ errors: [], warnings: [] });

// ---- support items (support, trans-support, clinic): the verification rule ----
// An item prints when it has a verification note {who, date, source}, or is a placeholder (the page says "add your local numbers here"),
// or is explicitly marked verified:false with checkBeforePrinting:true (the owner's own call: the build warns and lists them).
// Anything else stops the build before a wrong number reaches paper.
export function itemCheck(item, kindName, manifest) {
  if (item.placeholder === true) return 'ok';
  if (isVerification(item.verified)) return 'ok';
  if (item.verified === false && item.checkBeforePrinting === true) return 'warn';
  if (item.verified === undefined && Array.isArray(manifest && manifest.verified) && manifest.verified.some((v) => isVerification(v) && (v.item === item.id || v.kind === kindName))) return 'ok';
  return item.verified !== undefined && item.verified !== false ? 'incomplete' : 'missing';
}
function checkItems(items, kindName, manifest) {
  const refuse = [], warn = [];
  for (const { where, item } of items) {
    const r = itemCheck(item, kindName, manifest);
    if (r === 'warn') warn.push(`${where}${item.check ? ` (${item.check})` : ''}`);
    else if (r === 'incomplete') refuse.push(`${where}: its "verified" note needs who, date (YYYY-MM-DD) and source`);
    else if (r === 'missing') refuse.push(`${where}: no "verified" note${item.verified === false ? ' (verified:false needs checkBeforePrinting:true too)' : ''}`);
  }
  return { refuse, warn };
}
function itemErrors(item, at, errors) {
  if (!isObj(item)) { errors.push(`${at}: must be an object {id, name, text, chips}`); return; }
  if (!(str(item.id) && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(item.id))) errors.push(`${at}.id: is required, lowercase with dashes`);
  if (!str(item.name)) errors.push(`${at}.name: is required`);
  if (!(typeof item.text === 'string' && (str(item.text) || item.placeholder === true))) errors.push(`${at}.text: is required (what the page says; a little HTML such as <b> is allowed)`);
  if (item.chips !== undefined && !(typeof item.chips === 'string' && item.chips.split(/\s+/).filter(Boolean).every((c) => CHIPS.includes(c)))) errors.push(`${at}.chips: optional; words from ${CHIPS.join(' ')}`);
  if (item.verified !== undefined && item.verified !== false && !isVerification(item.verified)) errors.push(`${at}.verified: must be {who, date (YYYY-MM-DD), source}, or false`);
  for (const k of ['placeholder', 'checkBeforePrinting']) if (item[k] !== undefined && typeof item[k] !== 'boolean') errors.push(`${at}.${k}: must be true or false`);
  if (item.check !== undefined && !str(item.check)) errors.push(`${at}.check: optional; what to check, e.g. "hours"`);
}
const PLACEHOLDER_TEXT = 'Add your local numbers here.';
const itemRow = (i) => [i.name, i.placeholder === true && !str(i.text) ? PLACEHOLDER_TEXT : i.text, i.chips || ''];

// the shape shared by support and trans-support: { sections: [{ title, items: [...] }] }
const sectionKind = ({ title, file, kindName, privacy, schema, consumedBy, print }) => ({
  title, privacy, file, schema, consumedBy, print, limits: { maxFileBytes: 200_000, maxTotalBytes: 400_000 }, needsVerification: true,
  validate(data) {
    const errors = [];
    if (!isObj(data) || !Array.isArray(data.sections) || !data.sections.length) return { errors: ['must be {"sections": [{"title", "items": [...]}]} with at least one section'], warnings: [] };
    const ids = new Set();
    data.sections.forEach((s, si) => {
      if (!isObj(s) || !str(s.title) || !Array.isArray(s.items) || !s.items.length) { errors.push(`sections[${si}]: needs a title and a list of items`); return; }
      s.items.forEach((it, ii) => { itemErrors(it, `sections[${si}].items[${ii}]`, errors); if (isObj(it) && it.id) { if (ids.has(it.id)) errors.push(`sections[${si}].items[${ii}].id: "${it.id}" is used twice`); ids.add(it.id); } });
    });
    return { errors, warnings: [] };
  },
  gate(data, ctx) { return checkItems(data.sections.flatMap((s) => s.items.map((item) => ({ where: `${s.title}: ${item.name}`, item }))), kindName, ctx.pack); },
  consume: (data) => data.sections.map((s) => [s.title, s.items.map(itemRow)]),
});

// ---- the registry ----
const dateNum = /^\d{8}$/;
export const KINDS = {
  support: sectionKind({
    title: 'support', file: 'support.json', kindName: 'support', privacy: 'personal',
    schema: '{ sections: [{ title, items: [{ id, name, text, chips, verified: {who, date, source} | false, checkBeforePrinting, placeholder, check }] }] }',
    consumedBy: 'The Support page (paper, Keeper, EPUB, X4 support list). profile paths.support',
    print: 'Crisis and support numbers: every item needs a verification note, or is a placeholder, or is flagged checkBeforePrinting. Never auto-filled for someone else.',
  }),
  'trans-support': sectionKind({
    title: 'trans support', file: 'trans.json', kindName: 'trans-support', privacy: 'personal',
    schema: 'same as support: { sections: [{ title, items: [...] }] }',
    consumedBy: 'The Trans support page (module trans_support). profile paths.trans',
    print: 'Same verification rule as support.',
  }),
  clinic: {
    title: 'clinic', file: 'clinic.json', privacy: 'personal', needsVerification: true, limits: { maxFileBytes: 100_000, maxTotalBytes: 200_000 },
    schema: '{ name, address, checked, lines: [{ id, name, text, chips, verified | placeholder | checkBeforePrinting }] }',
    consumedBy: 'The "My clinic" card on the Support page, the Keeper and the EPUB. profile paths.clinic',
    print: 'Personal contact data. Same verification rule as support.',
    validate(data) {
      const errors = [];
      if (!isObj(data)) return { errors: ['must be an object {name, address, lines}'], warnings: [] };
      for (const k of ['name', 'address']) if (!str(data[k])) errors.push(`${k}: is required`);
      if (data.checked !== undefined && !str(data.checked)) errors.push('checked: optional; text such as "Sep 2026"');
      if (!Array.isArray(data.lines) || !data.lines.length) errors.push('lines: is required (a list of lines)');
      else data.lines.forEach((l, i) => itemErrors(l, `lines[${i}]`, errors));
      return { errors, warnings: [] };
    },
    gate: (data, ctx) => checkItems(data.lines.map((item) => ({ where: `${data.name}: ${item.name}`, item })), 'clinic', ctx.pack),
    consume: (data) => ({ name: data.name, address: data.address, lines: data.lines.map(itemRow), ...(data.checked ? { checked: data.checked } : {}) }),
  },
  transit: {
    title: 'transit', file: 'gtfs/network.json', privacy: 'public', limits: { maxFileBytes: 8_000_000, maxTotalBytes: 16_000_000 },
    schema: 'gtfs/network.json { feed_version, valid_from: "YYYYMMDD", valid_to, months: { "YYYY-MM": {samples, summary, ...} }, routes }, optional gtfs/route6.json (one route, same valid_from / valid_to); gtfs/build.py and network.py rebuild them from the agency feed',
    consumedBy: 'The bus schedule pages, the day page bus line and the EPUB. profile paths.transit and the profile transit section (agency, site, app)',
    print: 'Schedules print only inside valid_from..valid_to; months outside it get no schedule, a month that straddles the end says so on the page.',
    validate(data, ctx) {
      const errors = [], warnings = [];
      if (!isObj(data)) return { errors: ['must be the network object'], warnings };
      if (!str(data.feed_version)) errors.push('feed_version: is required');
      for (const k of ['valid_from', 'valid_to']) if (!(typeof data[k] === 'string' && dateNum.test(data[k]))) errors.push(`${k}: is required, YYYYMMDD`);
      if (!isObj(data.months)) errors.push('months: is required');
      if (!isObj(data.routes)) errors.push('routes: is required');
      if (typeof data.valid_to === 'string' && dateNum.test(data.valid_to)) {
        const t = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        if (data.valid_to < t) warnings.push(`the feed ended ${data.valid_to}: refresh it before printing`);
      }
      const r6 = ctx && ctx.dir ? path.join(ctx.dir, 'gtfs/route6.json') : null;
      if (r6 && fs.existsSync(r6)) {
        try { const r = JSON.parse(fs.readFileSync(r6, 'utf8')); for (const k of ['valid_from', 'valid_to']) if (!(typeof r[k] === 'string' && dateNum.test(r[k]))) errors.push(`route6.json ${k}: is required, YYYYMMDD`); } catch (e) { errors.push(`route6.json: ${e.message}`); }
      }
      return { errors, warnings };
    },
    consume: (data) => ({ feed_version: data.feed_version, valid_from: data.valid_from, valid_to: data.valid_to }),
  },
  holidays: {
    title: 'holidays', file: 'holidays.json', privacy: 'public', limits: { maxFileBytes: 100_000, maxTotalBytes: 200_000 },
    schema: '{ observances: [{ month, day, name, federal? } | { month, nth: {weekday 0-6 (Sun=0), n 1-5 or -1 for last}, name, federal? }] }',
    consumedBy: 'Holidays and observances on the day, week and month pages, added to the built-in US list. profile paths.holidays',
    print: 'Names print as written; keep them short (they sit in a small cell).',
    validate(data) {
      const errors = [];
      if (!isObj(data) || !Array.isArray(data.observances)) return { errors: ['must be {"observances": [...]}'], warnings: [] };
      data.observances.forEach((o, i) => {
        const at = `observances[${i}]`;
        if (!isObj(o)) { errors.push(`${at}: must be an object`); return; }
        if (!(Number.isInteger(o.month) && o.month >= 1 && o.month <= 12)) errors.push(`${at}.month: 1 to 12`);
        if (!str(o.name) || o.name.length > 60) errors.push(`${at}.name: required, up to 60 characters`);
        if (o.nth !== undefined) { if (!(isObj(o.nth) && Number.isInteger(o.nth.weekday) && o.nth.weekday >= 0 && o.nth.weekday <= 6 && Number.isInteger(o.nth.n) && (o.nth.n === -1 || (o.nth.n >= 1 && o.nth.n <= 5)))) errors.push(`${at}.nth: {weekday 0-6, n 1-5 or -1}`); }
        else if (!(Number.isInteger(o.day) && o.day >= 1 && o.day <= 31)) errors.push(`${at}: needs "day" (1-31) or "nth"`);
        if (o.federal !== undefined && typeof o.federal !== 'boolean') errors.push(`${at}.federal: true or false`);
      });
      return { errors, warnings: [] };
    },
    consume: (data) => data.observances,
  },
  'seasons-history': {
    title: 'seasons and history', file: 'seasons.json', privacy: 'public', limits: { maxFileBytes: 300_000, maxTotalBytes: 1_500_000 },
    schema: 'seasons.json { seasons: { "1".."72": [name, note] }, history?: "research/<file>.json" } ; the optional history file is { seasons: [{ n, start, name, note, source_url, evidence, confidence }] }, the research behind the table',
    consumedBy: 'The 72 micro-seasons (name and note on the day page, the sky list and the seasons lines). profile paths.seasons. Without a pack the book uses the English names of the 72 Japanese seasons and no notes',
    print: 'Every note is original or cited: a source_url is required in the history file.',
    validate(data, ctx) {
      const errors = [], warnings = [];
      if (!isObj(data) || !isObj(data.seasons)) return { errors: ['must be {"seasons": {"1": [name, note], ... "72": [...]}}'], warnings };
      for (let n = 1; n <= 72; n++) { const e = data.seasons[String(n)]; if (!(Array.isArray(e) && e.length === 2 && str(e[0]) && typeof e[1] === 'string')) errors.push(`seasons["${n}"]: must be [name, note]`); }
      if (data.history !== undefined) {
        const f = ctx && ctx.dir ? path.join(ctx.dir, String(data.history)) : null;
        if (!str(data.history) || /^\/|\.\./.test(data.history)) errors.push('history: must be a path inside the pack');
        else if (f && !fs.existsSync(f)) errors.push(`history: ${data.history} does not exist`);
        else if (f) {
          try {
            const h = JSON.parse(fs.readFileSync(f, 'utf8'));
            if (!Array.isArray(h.seasons)) errors.push('history: needs a "seasons" list');
            else { const miss = h.seasons.filter((s) => !(str(s.source_url) && /^https?:\/\//.test(s.source_url))).length; if (miss) errors.push(`history: ${miss} season${miss > 1 ? 's have' : ' has'} no source_url`); }
          } catch (e) { errors.push(`history: ${e.message}`); }
        }
      }
      return { errors, warnings };
    },
    consume: (data) => data.seasons,
  },
  puzzles: {
    title: 'puzzles', file: 'puzzles.json', privacy: 'public', limits: { maxFileBytes: 200_000, maxTotalBytes: 400_000 },
    schema: '{ lists: [{ id, title, entries: [{ word: "LETTERS", clue: "an original clue" }] }] } ; words are 3 to 12 letters A-Z, clues up to 40 characters and never contain their answer',
    consumedBy: 'The word search and crossword blocks (day and Notes pages), when a block\'s "Words from" is "My puzzles pack". The block\'s "List name" picks a list by id. profile paths.puzzles',
    print: 'Clues must be original or openly licensed (the manifest needs an author and a licence, and the build credits the pack): never copied from a published crossword.',
    validate(data) {
      const errors = [], warnings = [];
      if (!isObj(data) || !Array.isArray(data.lists) || !data.lists.length) return { errors: ['must be {"lists": [{"id", "title", "entries": [{"word", "clue"}]}]} with at least one list'], warnings };
      const ids = new Set();
      data.lists.forEach((l, li) => {
        const at = `lists[${li}]`;
        if (!isObj(l)) { errors.push(`${at}: must be an object {id, title, entries}`); return; }
        if (!(str(l.id) && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(l.id))) errors.push(`${at}.id: is required, lowercase with dashes`);
        else if (ids.has(l.id)) errors.push(`${at}.id: "${l.id}" is used twice`); else ids.add(l.id);
        if (!str(l.title) || l.title.length > 30) errors.push(`${at}.title: is required, up to 30 characters`);
        if (!Array.isArray(l.entries) || !l.entries.length) { errors.push(`${at}.entries: is required (a list of {word, clue})`); return; }
        if (l.entries.length < 12) warnings.push(`${at}: ${l.entries.length} entries; 12 or more gives a crossword and a word search room to choose`);
        const words = new Set();
        l.entries.forEach((e, ei) => {
          const ea = `${at}.entries[${ei}]`;
          if (!isObj(e)) { errors.push(`${ea}: must be {word, clue}`); return; }
          if (!(typeof e.word === 'string' && /^[A-Za-z]{3,12}$/.test(e.word))) { errors.push(`${ea}.word: 3 to 12 letters, A to Z only`); return; }
          const w = e.word.toUpperCase();
          if (words.has(w)) errors.push(`${ea}.word: "${w}" is in this list twice`); words.add(w);
          if (!str(e.clue) || e.clue.length > 40) errors.push(`${ea}.clue: is required, up to 40 characters (it prints in a narrow column)`);
          else if (e.clue.toUpperCase().includes(w)) errors.push(`${ea}.clue: gives away its answer "${w}"`);
        });
      });
      return { errors, warnings };
    },
    consume: (data) => ({ lists: Object.fromEntries(data.lists.map((l) => [l.id, { title: l.title, entries: l.entries.map((e) => ({ word: e.word.toUpperCase(), clue: e.clue })) }])) }),
  },
  // A bundle: one pack that provides several of the kinds above for a region (files by the conventions above). Each part is checked by
  // its own kind, and the pack is personal when any part is. Packs of a single kind work the same way.
  region: {
    title: 'region', bundle: ['support', 'clinic', 'trans-support', 'transit', 'holidays', 'seasons-history'], privacy: 'personal', limits: { maxFileBytes: 8_000_000, maxTotalBytes: 16_000_000 },
    schema: 'a folder holding any of support.json, clinic.json, trans.json, gtfs/network.json, holidays.json, seasons.json (formats of those kinds)',
    consumedBy: 'Every profile paths.* key that names this pack reads the part of its own kind',
    print: 'Each part follows its own kind\'s rules.',
    validate: ok, consume: () => null,
  },
};
export const kindNames = () => Object.keys(KINDS);
export function kindOf(name) {
  if (!Object.prototype.hasOwnProperty.call(KINDS, name)) throw new Error(`Unknown pack kind "${name}". Installed kinds: ${kindNames().join(', ')}. (To add a kind, add one entry to journal/packs/kinds.mjs: see journal/PACKS.md, "Add a pack kind".)`);
  return KINDS[name];
}
export const partKinds = () => KINDS.region.bundle;
export const privacyOf = (kind) => kindOf(kind).privacy;
export const partFile = (kind) => kindOf(kind).file;
// profile.paths keys -> the kind each one reads
export const PROFILE_KEYS = { support: 'support', trans: 'trans-support', clinic: 'clinic', transit: 'transit', seasons: 'seasons-history', holidays: 'holidays', puzzles: 'puzzles' };
