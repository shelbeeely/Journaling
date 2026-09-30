#!/usr/bin/env node
// Start your own journal: asks a few questions, writes content/profile.json, builds a sample book from test.ics and says what to do next.
// No dependencies beyond Node. Run it from journal/:   npm run init      (or: node init.mjs)
// Every question has a flag, so it also runs without a keyboard (CI, a scratch folder):
//   npm run init -- --yes --name Sam --title "Northlight" --city seattle --modules sky,spoons --scope month --start 2026-10
//
//   --name --title --subtitle --slug          who and what (slug: file-name stem, default from the title)
//   --city <key>                              a built-in city (seattle, chicago, london ...; `--city list` shows them), or give --place --short
//   --place "Lakemont, MN" --short Lakemont --region Minnesota --lat 46.79 --lon -92.1 --elevation 200 --tz America/Chicago --tz-name "Central Time"
//   --day-start 5                             the hour your paper day starts (0-8)
//   --trim small|letter                       5.5x8.5 or 8.5x11
//   --modules sky,spoons,therapy,bus,trans_support   which modules are on (none to switch all off)
//   --pack generic|<id>|<folder>              the content pack for Support pages (a pack id, or a folder holding a pack.json)
//   --scope month|quarter|season|half-year|year|custom|undated  --start 2026-10  [--custom-start 2026-10-01 --custom-end 2027-01-15]  [--days 90]
//   --profile <file>                          where to write the profile (default content/profile.json)
//   --force                                   overwrite an existing profile without asking
//   --no-build                                skip the sample book
//   --yes                                     take the default for anything not given; never ask
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import readline from 'node:readline';
import { spawnSync } from 'node:child_process';
import { MODULES } from './modules.mjs';
import { newBookId, SCOPES } from './plan.mjs';
import { checkPack, resolveDir } from './packs/pack.mjs';
import { partFile, partKinds } from './packs/kinds.mjs';

const HERE = path.dirname(new URL(import.meta.url).pathname);
// profile.mjs reads a profile when it loads: point it at the generic example so this works even with no profile yet (or a broken one)
process.env.KW_PROFILE = path.join(HERE, 'content/profile.example.json');
const { validateProfile } = await import('./profile.mjs');
const BOOLEAN_FLAGS = new Set(['yes', 'force', 'no-build', 'help']);
const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (!a.startsWith('--')) { console.error(`Unexpected "${a}". Flags start with --; run node init.mjs --help.`); process.exit(2); }
  const [k, v] = a.slice(2).split(/=(.*)/s);
  if (BOOLEAN_FLAGS.has(k)) args[k] = true;
  else if (v !== undefined) args[k] = v;
  else { args[k] = process.argv[++i]; if (args[k] === undefined) { console.error(`--${k} needs a value`); process.exit(2); } }
}
if (args.help) { console.log(fs.readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(1, 22).map((l) => l.replace(/^\/\/ ?/, '')).join('\n')); process.exit(0); }

// A few places to start from (approximate centres; type your own for anywhere else). Nothing here is sent anywhere.
const CITIES = {
  seattle: { place: 'Seattle, WA', city: 'Seattle', region: 'Washington', lat: 47.61, lon: -122.33, elevation: 50, timezone: 'America/Los_Angeles', timezone_name: 'Pacific Time' },
  'los-angeles': { place: 'Los Angeles, CA', city: 'Los Angeles', region: 'California', lat: 34.05, lon: -118.24, elevation: 90, timezone: 'America/Los_Angeles', timezone_name: 'Pacific Time' },
  denver: { place: 'Denver, CO', city: 'Denver', region: 'Colorado', lat: 39.74, lon: -104.99, elevation: 1600, timezone: 'America/Denver', timezone_name: 'Mountain Time' },
  chicago: { place: 'Chicago, IL', city: 'Chicago', region: 'Illinois', lat: 41.88, lon: -87.63, elevation: 180, timezone: 'America/Chicago', timezone_name: 'Central Time' },
  'new-york': { place: 'New York, NY', city: 'New York', region: 'New York', lat: 40.71, lon: -74.01, elevation: 10, timezone: 'America/New_York', timezone_name: 'Eastern Time' },
  toronto: { place: 'Toronto, ON', city: 'Toronto', region: 'Ontario', lat: 43.65, lon: -79.38, elevation: 76, timezone: 'America/Toronto', timezone_name: 'Eastern Time' },
  'mexico-city': { place: 'Mexico City', city: 'Mexico City', region: 'Mexico', lat: 19.43, lon: -99.13, elevation: 2240, timezone: 'America/Mexico_City', timezone_name: 'Central Time' },
  london: { place: 'London', city: 'London', region: 'England', lat: 51.51, lon: -0.13, elevation: 11, timezone: 'Europe/London', timezone_name: 'UK Time' },
  berlin: { place: 'Berlin', city: 'Berlin', region: 'Germany', lat: 52.52, lon: 13.4, elevation: 34, timezone: 'Europe/Berlin', timezone_name: 'Central European Time' },
  'cape-town': { place: 'Cape Town', city: 'Cape Town', region: 'South Africa', lat: -33.92, lon: 18.42, elevation: 25, timezone: 'Africa/Johannesburg', timezone_name: 'South Africa Time' },
  tokyo: { place: 'Tokyo', city: 'Tokyo', region: 'Japan', lat: 35.68, lon: 139.69, elevation: 40, timezone: 'Asia/Tokyo', timezone_name: 'Japan Time' },
  sydney: { place: 'Sydney, NSW', city: 'Sydney', region: 'New South Wales', lat: -33.87, lon: 151.21, elevation: 58, timezone: 'Australia/Sydney', timezone_name: 'Eastern Australia Time' },
  auckland: { place: 'Auckland', city: 'Auckland', region: 'New Zealand', lat: -36.85, lon: 174.76, elevation: 20, timezone: 'Pacific/Auckland', timezone_name: 'New Zealand Time' },
};
if (args.city === 'list') { for (const [k, c] of Object.entries(CITIES)) console.log(`${k.padEnd(12)} ${c.place}  (${c.lat}, ${c.lon}, ${c.timezone})`); process.exit(0); }

const interactive = !args.yes && process.stdin.isTTY;
const rl = interactive ? readline.createInterface({ input: process.stdin, output: process.stdout, terminal: false }) : null;
const lines = rl ? rl[Symbol.asyncIterator]() : null;
async function ask(question, def = '') {
  if (!interactive) return def;
  process.stdout.write(`${question}${def !== '' ? ` [${def}]` : ''} `);
  const { value, done } = await lines.next();
  return done || value.trim() === '' ? String(def) : value.trim();
}
const yes = (s) => /^(y|yes)$/i.test(String(s).trim());
const fail = (m) => { console.error(`\n${m}`); process.exit(1); };
const slugify = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'my-journal';
const given = (k) => args[k] !== undefined;
// an answer: the flag when given, else ask (interactive) or the default
async function get(flag, question, def) { return given(flag) ? String(args[flag]) : ask(question, def); }
const num = (v, what) => { const x = Number(v); if (!Number.isFinite(x)) fail(`${what} must be a number, got "${v}"`); return x; };
const tzLong = (tz) => { try { return new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'long' }).formatToParts(new Date(Date.UTC(2026, 0, 15))).find((p) => p.type === 'timeZoneName').value.replace(' Standard', ''); } catch { return ''; } };
const nextMonth = () => { const d = new Date(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + 1); return d.toISOString().slice(0, 7); };

console.log('Journalwright Studio: make your own journal.\nPress Enter to take the answer in [brackets]. Nothing leaves this computer.\n');

// ---- who and what ----
const name = await get('name', 'Your first name:', 'Sam');
const title = await get('title', 'Book title:', 'My Journal');
const subtitle = await get('subtitle', 'Subtitle:', 'A sky and season journal');
const slug = given('slug') ? args.slug : slugify(title);

// ---- where ----
let loc;
if (given('city') && CITIES[args.city]) loc = { ...CITIES[args.city] };
else if (given('city')) fail(`No built-in city "${args.city}". Run node init.mjs --city list, or give --place --lat --lon --tz.`);
else if (given('place') || given('lat')) loc = {};
else if (interactive) {
  const keys = Object.keys(CITIES);
  console.log('\nWhere are you? Pick a city (it sets sunrise, sunset, the moon and your time zone), or 0 to type your own:');
  keys.forEach((k, i) => console.log(`  ${String(i + 1).padStart(2)}. ${CITIES[k].place}`));
  const pick = Number(await ask('Number:', '0'));
  loc = pick >= 1 && pick <= keys.length ? { ...CITIES[keys[pick - 1]] } : {};
} else loc = { ...CITIES.chicago };
const fromList = !!loc.place; // a built-in city answers every detail below; a flag still overrides one
const detail = (flag, q, def) => (given(flag) ? String(args[flag]) : fromList ? String(def) : get(flag, q, def));
loc.place = await detail('place', 'Place as printed (for example "Lakemont, MN"):', loc.place || 'My Town');
loc.city = await detail('short', 'Short name for sentences ("Lakemont"):', loc.city || loc.place.split(',')[0].trim());
loc.region = await detail('region', 'State or region:', loc.region || loc.place.split(',').slice(1).join(',').trim() || 'My Region');
loc.lat = num(await detail('lat', 'Latitude (degrees, north is positive):', loc.lat ?? 45), 'latitude');
loc.lon = num(await detail('lon', 'Longitude (degrees, west is negative):', loc.lon ?? -90), 'longitude');
loc.elevation = num(await detail('elevation', 'Elevation in metres (0 is fine):', loc.elevation ?? 0), 'elevation');
loc.timezone = await detail('tz', 'Time zone (IANA name, e.g. America/Chicago):', loc.timezone || 'America/Chicago');
try { new Intl.DateTimeFormat('en-US', { timeZone: loc.timezone }); } catch { fail(`"${loc.timezone}" is not a time zone name (examples: America/Chicago, Europe/London, Asia/Tokyo).`); }
loc.timezone_name = await detail('tz-name', 'Time zone as printed:', loc.timezone_name || tzLong(loc.timezone) || loc.timezone);

// ---- how the day and the book work ----
const dayStart = num(await get('day-start', 'Hour your paper day starts (0-8; 5 means the night belongs to the day before):', 5), 'day start');
const trim = await get('trim', 'Trim size: small (5.5x8.5) or letter (8.5x11):', 'small');

// ---- the content pack ----
const packRef = await get('pack', 'Content pack for Support pages: generic, a pack id, or a folder with a pack.json:', 'generic');
let packDir;
try { packDir = resolveDir(packRef); } catch (e) { fail(e.message); }
const pc = checkPack(packRef);
if (pc.errors.length) fail(`The pack "${packRef}" has problems:\n  - ${pc.errors.join('\n  - ')}\nFix them (node packs-cli.mjs check ${packRef}) or use --pack generic.`);
for (const w of pc.warnings) console.log(`  pack warning: ${w}`);
const man = JSON.parse(fs.readFileSync(path.join(packDir, 'pack.json'), 'utf8'));
const provides = new Set((man.kind === 'region' ? partKinds() : [man.kind]).filter((k) => fs.existsSync(path.join(packDir, partFile(k)))));
const ref = /^[a-z0-9]+(-[a-z0-9]+)*$/.test(packRef) ? packRef : (path.relative(HERE, packDir).startsWith('..') ? packDir : path.relative(HERE, packDir));

// ---- modules ----
const switches = {
  sky: 'the moon, the sun and the seasons (month sky pages, the sky line on each day)',
  spoons: 'spoon counting blocks (energy as a budget)',
  therapy: 'therapy blocks (feelings, skills, urges, thought record)',
  trans_support: provides.has('trans-support') ? 'the trans support page (your pack has one)' : null,
  bus: provides.has('transit') ? 'bus schedule pages (your pack has a transit feed)' : null,
};
const defaults = { sky: true, spoons: false, therapy: false, trans_support: false, bus: false };
let on;
if (given('modules')) { on = new Set(String(args.modules).split(/[,\s]+/).filter((x) => x && x !== 'none')); for (const k of on) if (!MODULES[k]) fail(`"${k}" is not a module (use ${Object.keys(MODULES).join(', ')}).`); }
else {
  on = new Set();
  for (const [k, what] of Object.entries(switches)) {
    if (!what) continue;
    const a = interactive ? await ask(`Turn on ${what}? (y/n)`, defaults[k] ? 'y' : 'n') : defaults[k] ? 'y' : 'n';
    if (yes(a)) on.add(k);
  }
}
for (const k of ['trans_support', 'bus']) if (on.has(k) && !provides.has(k === 'bus' ? 'transit' : 'trans-support')) fail(`--modules ${k} needs a pack that provides ${k === 'bus' ? 'a transit feed' : 'trans support'}; "${man.id}" does not.`);
if (on.has('pay_periods')) fail('pay_periods is one employer\'s pay sheet (payperiods.mjs); leave it off.');
let transit = null;
if (on.has('bus')) {
  transit = { agency: await get('agency', 'Transit agency short name (for example STA):', 'Transit'), site: await get('transit-site', 'Its website:', 'example.org'), app: await get('transit-app', 'Its app:', 'the agency app') };
}

// ---- the book ----
const scope = await get('scope', `What does one book cover? ${SCOPES.join(' | ')}:`, 'month');
if (!SCOPES.includes(scope)) fail(`"${scope}" is not a scope (use ${SCOPES.join(', ')}).`);
const start = await get('start', 'First month of the book (YYYY-MM):', nextMonth());
if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(start)) fail(`start must look like 2026-10, got "${start}"`);
const book = { id: newBookId(crypto.randomBytes(5)), title, subtitle, slug, edition: 1, start };
if (scope !== 'month') book.scope = scope;
if (scope === 'custom') book.custom = { start: await get('custom-start', 'First day (YYYY-MM-DD):', `${start}-01`), end: await get('custom-end', 'Last day (YYYY-MM-DD):', `${start}-28`) };
if (scope === 'undated') book.undated = { days: num(await get('days', 'How many days? (undated books have no dates and never need a new edition):', 90), 'days') };

const profile = {
  version: 1, person: { name }, book, location: loc, day_start_hour: dayStart, trim,
  modules: Object.fromEntries(Object.keys(MODULES).map((k) => [k, on.has(k)])),
  crisis: { lines: ['988 (call or text)', 'text HOME to 741741'] },
  ...(transit ? { transit } : {}),
  paths: {
    support: provides.has('support') ? ref : 'generic', trans: provides.has('trans-support') && on.has('trans_support') ? ref : null, clinic: provides.has('clinic') ? ref : null,
    ...(provides.has('transit') && on.has('bus') ? { transit: ref } : {}), seasons: provides.has('seasons-history') ? ref : null, ...(provides.has('holidays') ? { holidays: ref } : {}),
  },
};
const errs = validateProfile(profile);
if (errs.length) fail(`That does not make a valid profile:\n  - ${errs.join('\n  - ')}`);

// ---- write it (never over an existing file without asking) ----
const file = path.resolve(args.profile || path.join(HERE, 'content/profile.json'));
if (fs.existsSync(file) && !args.force) {
  const a = interactive ? await ask(`\n${path.relative(process.cwd(), file) || file} already exists. Overwrite it? (y/n)`, 'n') : 'n';
  if (!yes(a)) fail(`Not overwriting ${path.relative(process.cwd(), file) || file}. Use --profile <another file> to write a new one beside it, or --force to replace it. Nothing was written.`);
}
fs.mkdirSync(path.dirname(file), { recursive: true });
fs.writeFileSync(file, JSON.stringify(profile, null, 1) + '\n');
console.log(`\nWrote ${path.relative(process.cwd(), file) || file} (book id ${book.id}: it keeps your scan codes apart from every other book's).`);
const tracked = spawnSync('git', ['ls-files', '--error-unmatch', file], { cwd: path.dirname(file), stdio: 'pipe' }).status === 0;
console.log(`It holds your name and place. If this folder is a public repository, keep it private: add "${path.relative(HERE, file).replace(/\\/g, '/')}" to .gitignore${tracked ? ' (git already tracks this file, so also run: git rm --cached it)' : ''}. Calendars in private/ are already ignored.`);

// ---- a sample book, so you see it work ----
let built = null;
if (!args['no-build']) {
  const out = 'out-sample';
  const env = { ...process.env, KW_PROFILE: file, KW_OUT: out, SIZE: trim };
  delete env.KW_LIBRARY; delete env.KW_BOOK;
  console.log('\nBuilding a sample book from test.ics (about a minute)...');
  const mode = scope === 'month' ? ['month', start] : ['book'];
  const r = spawnSync('node', ['render.mjs', ...mode, 'test.ics'], { cwd: HERE, env, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' });
  if (r.status !== 0) fail(`The sample build failed:\n${(r.stderr || r.stdout).trim().split('\n').slice(-12).join('\n')}`);
  process.stdout.write(r.stdout);
  const dirs = fs.readdirSync(path.join(HERE, out)).filter((d) => fs.existsSync(path.join(HERE, out, d, 'journal.html'))).map((d) => ({ d, t: fs.statSync(path.join(HERE, out, d, 'journal.html')).mtimeMs })).sort((a, b) => b.t - a.t);
  const d = dirs[0] && dirs[0].d;
  if (d) {
    const c = spawnSync('node', ['check.mjs', d], { cwd: HERE, env, encoding: 'utf8' });
    const pdf = fs.readdirSync(path.join(HERE, out, d)).find((f) => /interior.*\.pdf$/.test(f));
    built = { dir: `${out}/${d}`, pdf: pdf && `${out}/${d}/${pdf}`, check: (c.stdout || '').trim() };
    console.log(`Overflow check: ${built.check} (every page fits)`);
    if (built.pdf) console.log(`Sample book: ${built.pdf} (in this folder)`);
  }
}

console.log(`
Next:
  1. Open the sample PDF. Every page is the same shape as your real one.
  2. Put your calendar in private/ (an .ics file; it is git-ignored and never uploaded), then:
       node render.mjs month ${start} private/your.ics          one month
       ./build-all.sh                                             the whole book, covers and checks (ICS=private/your.ics)
  3. Change the pages in the editor: node editor/build.mjs, then open editor/dist/site/index.html.
  4. Support pages: yours say "Add your local numbers here" until you make a pack of numbers you have checked yourself
     (node packs-cli.mjs new support mine). Numbers are never filled in for you.
  5. Read GUIDE.md: customizing, KDP notes, and what to do each year.`);
if (rl) rl.close();
