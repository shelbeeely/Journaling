// Book plan checks (CI: books.yml): every scope builds, a book over 110 pages splits into volumes that each pass every gate,
// volume boundaries are continuous, an undated book prints no dates, and every scan code is unique and decodes across
// several books (two undated journals and a two-plus-volume year).
//   node test-scopes.mjs          (builds into out/scopes-test/, a few minutes)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { bookPlan, splitVolumes, planProblems, newBookId, kw3Code, parseKw3, rangeLabel } from './plan.mjs';

let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'kw-scopes-'));
process.on('exit', () => fs.rmSync(TMP, { recursive: true, force: true }));
const ROOT = 'out/scopes-test';
fs.rmSync(ROOT, { recursive: true, force: true });
const SHELBEE = JSON.parse(fs.readFileSync('content/profile.json', 'utf8'));

// ---- pure: spans, split rule, ids ----
{
  const b = { start: '2026-10' };
  const span = (scope, extra = {}) => { const p = bookPlan({ ...b, scope, ...extra }); return [p.start, p.end, p.days]; };
  ok(JSON.stringify(span('quarter')) === '["2026-10-01","2026-12-31",92]', 'quarter Oct-Dec');
  ok(span('season')[1] === '2026-12-20', 'season runs to the day before the solstice');
  ok(span('half-year')[1] === '2027-03-31' && span('year')[1] === '2027-09-30' && span('year')[2] === 365, 'half-year and year');
  ok(span('custom', { custom: { start: '2026-10-05', end: '2027-01-20' } })[2] === 108, 'custom span');
  ok(bookPlan({ ...b, scope: 'undated' }).undated.weeks === 13 && bookPlan({ ...b, scope: 'undated' }).undated.months === 3, 'undated defaults: 90 days, 13 weeks, 3 months');
  ok(planProblems({ scope: 'custom', custom: { start: '2027-02-01', end: '2027-01-01' } }).length === 1, 'custom end before start is refused');
  ok(planProblems({ scope: 'weekly' }).length === 1 && planProblems({ scope: 'undated', undated: { days: 100, weeks: 5 } }).length === 1, 'bad scope and impossible undated counts are refused');
  ok(planProblems({ keeper: 'twelve-book', closing: 'end', id: 'K7M2QX9A' }).length === 0 && planProblems({ id: 'ILOU0000' }).length === 1, 'keeper, closing and id checks');
  // split rule on a synthetic book: 20 pages fixed + 1.5 per day; cuts on month starts (every 30 days) and weeks (every 7)
  const cuts = []; for (let i = 7; i < 360; i += 7) cuts.push({ i, kind: i % 30 === 0 ? 'month' : 'week' }); for (let i = 30; i < 360; i += 30) cuts.push({ i, kind: 'month' });
  const pages = (a, z) => 20 + Math.ceil((z - a) * 1.5);
  const r = splitVolumes(360, cuts, pages, 110);
  ok(r.volumes.length === Math.ceil(pages(0, 360) / 110) || r.volumes.length === 6, `fewest volumes (${r.volumes.length})`);
  ok(r.volumes.every((v) => v.pages <= 110) && r.volumes[0].a === 0 && r.volumes.at(-1).b === 360 && r.volumes.every((v, i) => i === 0 || v.a === r.volumes[i - 1].b), 'every volume fits and the volumes are continuous');
  ok(JSON.stringify(splitVolumes(360, cuts, pages, 110).volumes) === JSON.stringify(r.volumes), 'deterministic');
  ok(splitVolumes(60, cuts, pages, 110).volumes.length === 1, 'a book that fits stays one book');
  const id = newBookId([1, 2, 3, 4, 5]);
  ok(/^[0-9A-HJKMNP-TV-Z]{8}$/.test(id) && kw3Code(id, 1, 'S', 17).length === 16 && parseKw3(kw3Code(id, 12, 'L', 110)).vol === 12, 'KW3 code is 16 characters and round-trips');
  ok(rangeLabel('2026-11-01', '2026-11-30') === 'Nov 2026' && rangeLabel('2026-11-09', '2026-12-20') === 'Nov 9 – Dec 20, 2026', 'range labels');
}

// ---- builds ----
const prof = (name, edit) => { const p = structuredClone(SHELBEE); edit(p.book); const f = path.join(TMP, `${name}.json`); fs.writeFileSync(f, JSON.stringify(p, null, 1)); return f; };
const run = (script, args, profile, extra = {}) => execFileSync('node', [script, ...args], { env: { ...process.env, KW_PROFILE: profile, KW_OUT: ROOT, ...extra }, stdio: 'pipe' }).toString();
const plans = {
  quarter: prof('quarter', (b) => { b.scope = 'quarter'; }),
  season: prof('season', (b) => { b.scope = 'season'; }),
  'half-year': prof('half', (b) => { b.scope = 'half-year'; b.closing = 'end'; }),
  year: prof('year', (b) => { b.scope = 'year'; }),
  custom: prof('custom', (b) => { b.scope = 'custom'; b.custom = { start: '2026-10-05', end: '2027-01-20' }; b.keeper = 'none'; }),
  undated1: prof('undated1', (b) => { b.scope = 'undated'; b.undated = { days: 90, extras: ['theme', 'tracker', 'notes'] }; }),
  undated2: prof('undated2', (b) => { b.scope = 'undated'; b.undated = { days: 60, weeks: 9, months: 2 }; }),
};
const built = {}; // plan name -> [volume dirs]
for (const [name, f] of Object.entries(plans)) {
  const out = run('render.mjs', ['book', 'test.ics'], f);
  const dirs = [...out.matchAll(/^volume (\S+):/gm)].map((m) => `b-${m[1]}`);
  ok(dirs.length >= 1, `${name} builds`);
  built[name] = dirs;
  ok(JSON.parse(fs.readFileSync(f, 'utf8')).book.id, `${name}: the book id is made once and written back`);
}
const all = Object.values(built).flat();
ok(built.year.length > 1, `a year is over 110 pages and splits (${built.year.length} volumes)`);
ok(built.undated1.length === 2, 'the 90-day undated book splits into 2 volumes');
const L = (d) => JSON.parse(fs.readFileSync(`${ROOT}/${d}/layout.json`, 'utf8'));
const M = (d) => JSON.parse(fs.readFileSync(`${ROOT}/${d}/manifest.json`, 'utf8'));

// each volume passes the overflow gate, every page is 24-110, no Type 3 fonts
for (const d of all) {
  execFileSync('node', ['check.mjs', d], { env: { ...process.env, KW_OUT: ROOT }, stdio: 'pipe' });
  const pages = L(d).pages.length;
  ok(pages >= 24 && pages <= 110 && pages % 2 === 0, `${d}: ${pages} pages`);
  const pdf = fs.readdirSync(`${ROOT}/${d}`).find((f) => /interior.*\.pdf$/.test(f));
  ok(!/Type 3/.test(execFileSync('pdffonts', [`${ROOT}/${d}/${pdf}`]).toString()), `${d}: no Type 3 fonts`);
}
n += 0;
// spreads, page identity, and codes over every book together (KW3 codes are unique across all seven books)
const dd = all.map((d) => `${ROOT}/${d}`);
execFileSync('node', ['check-spreads.mjs', ...dd], { stdio: 'pipe' }); n++;
execFileSync('node', ['check-pages.mjs', ...dd], { stdio: 'pipe' }); n++;
const codes = execFileSync('node', ['check-codes.mjs', ...dd], { env: { ...process.env, DECODE: 'sample' }, stdio: 'pipe' }).toString();
ok(/check-codes: ok/.test(codes), 'codes unique and decodable across all books');
{
  const seen = new Set(); let total = 0;
  for (const d of all) for (const p of L(d).pages) { ok(!seen.has(p.code) && p.code.startsWith('KW3') && p.code.length === 16, `${d} p.${p.page}: ${p.code}`); seen.add(p.code); total++; }
  const ids = Object.values(built).map((v) => L(v[0]).book_id);
  ok(new Set(ids).size === ids.length, 'every book has its own id');
  ok(L(built.undated1[0]).book_id !== L(built.undated2[0]).book_id, 'two undated journals have different ids');
  console.log(`  ${total} codes, ${ids.length} books`);
}

// continuity: the year's volumes cover every day once, in order; week numbers and volume numbers carry across
{
  const days = built.year.flatMap((d) => L(d).pages.filter((p) => p.type === 'dayp').map((p) => p.date));
  const want = []; for (let t = Date.parse('2026-10-01'); t <= Date.parse('2027-09-30'); t += 864e5) want.push(new Date(t).toISOString().slice(0, 10));
  ok(JSON.stringify(days) === JSON.stringify(want), 'the year volumes hold every day once, in order');
  built.year.forEach((d, i) => { const m = M(d); ok(m.volume.n === i + 1 && m.volume.of === built.year.length, `${d} is volume ${i + 1} of ${built.year.length}`); });
  const weeks = built.year.flatMap((d) => [...new Set(L(d).pages.map((p) => /^week\.(\d+)\./.exec(p.id)).filter(Boolean).map((m) => +m[1]))]);
  const uniq = [...new Set(weeks)];
  ok(uniq.every((w, i) => i === 0 || w === uniq[i - 1] + 1) && uniq[0] === 1, 'week numbers run 1, 2, 3 ... across the volumes with no gap');
  const nDays = built.undated1.flatMap((d) => L(d).pages.filter((p) => p.type === 'dayp').map((p) => p.id));
  ok(nDays.length === 90 && nDays.every((id, i) => id === `day.${String(i + 1).padStart(3, '0')}`), 'undated days are numbered 001 to 090 across both volumes');
  ok(L(built.undated1[0]).pages.every((p) => !p.date && !p.from), 'undated layout.json has no dates');
}
// an undated book prints no dates
for (const name of ['undated1', 'undated2']) for (const d of built[name]) {
  const pdf = fs.readdirSync(`${ROOT}/${d}`).find((f) => /interior.*\.pdf$/.test(f));
  const pages = execFileSync('pdftotext', ['-layout', `${ROOT}/${d}/${pdf}`, '-']).toString().split('\f');
  const lay = L(d).pages;
  const MON = /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.? \d{1,2}\b/, WD = /\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*day,? \d/;
  lay.forEach((p, i) => {
    const t = pages[i] || '';
    if (p.shared) return; // shared directories are the same in every book (they say when they were checked)
    ok(!/\b\d{4}-\d{2}-\d{2}\b/.test(t) && !/\b202[6-9]\b/.test(t) && !MON.test(t) && !WD.test(t), `${d} p.${p.page} (${p.id}) prints a date: ${(t.match(/.*(202[6-9]|\d{4}-\d\d).*/) || [''])[0].trim()}`);
  });
  ok(!L(d).pages.some((p) => p.type === 'month_sky' || p.type === 'month_moon'), `${d}: no sky pages`);
}
// covers say Volume N of M
{
  const d = built.year[1], id = d.slice(2);
  execFileSync('node', ['cover.mjs', 'book', id], { env: { ...process.env, KW_OUT: ROOT }, stdio: 'pipe' });
  const cov = fs.readdirSync(`${ROOT}/${d}`).find((f) => /cover\.pdf$/.test(f));
  ok(new RegExp(`Volume 2 of ${built.year.length}`).test(execFileSync('pdftotext', [`${ROOT}/${d}/${cov}`, '-']).toString()), 'the volume cover says Volume 2 of N');
}
console.log(`test-scopes: ${n} checks passed`);
