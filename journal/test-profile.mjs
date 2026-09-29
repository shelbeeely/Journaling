// Profile checks (CI: books.yml). The engine holds nothing personal: a generic person in a made-up city builds a whole book that
// passes the overflow gate, module switches remove their pages without leaving a dangling reference, and a profile with a
// missing field stops the build with a message that says which field.
//   node test-profile.mjs          (builds into out/profile-test/, a few seconds per book)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { validateProfile, MODULES } from './profile.mjs';

let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };
const read = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'kw-profile-'));
process.on('exit', () => fs.rmSync(TMP, { recursive: true, force: true }));
const OUTROOT = 'out/profile-test';
fs.rmSync(OUTROOT, { recursive: true, force: true });

const SHELBEE = read('content/profile.json'), EXAMPLE = read('content/profile.example.json');

// P1: both committed profiles are valid, and the firmware's day start is the profile's (the firmware keeps its own constant; they must agree).
{
  ok(validateProfile(SHELBEE).length === 0, 'content/profile.json is valid: ' + validateProfile(SHELBEE));
  ok(validateProfile(EXAMPLE).length === 0, 'content/profile.example.json is valid: ' + validateProfile(EXAMPLE));
  const fw = /DAY_STARTS_HOUR\s*=\s*(\d+)/.exec(fs.readFileSync('../x4/src/core/data.h', 'utf8'));
  ok(fw && +fw[1] === SHELBEE.day_start_hour, `firmware DAY_STARTS_HOUR (${fw && fw[1]}) matches profile day_start_hour (${SHELBEE.day_start_hour})`);
}

// P2: a missing or wrong field is named, all at once, and the build stops.
{
  const bad = structuredClone(EXAMPLE);
  delete bad.location.lat; delete bad.book.title; bad.trim = 'a4'; delete bad.day_start_hour; delete bad.modules.spoons; bad.modules.bogus = true; delete bad.paths.support;
  const errs = validateProfile(bad).join('\n');
  for (const want of ['location.lat: is required', 'book.title: is required', 'trim: is required', 'day_start_hour: is required', 'modules.spoons: is required', 'modules.bogus: not a module', 'paths.support: is required']) ok(errs.includes(want), `error names "${want}"; got:\n${errs}`);
  const busNoTransit = structuredClone(EXAMPLE); busNoTransit.modules.bus = true;
  ok(validateProfile(busNoTransit).some((e) => e.startsWith('transit:')), 'bus on without a transit section is an error');
  const f = path.join(TMP, 'broken.json'); fs.writeFileSync(f, JSON.stringify(bad));
  let msg = '';
  try { execFileSync('node', ['render.mjs', 'month', '2026-10', 'test.ics'], { env: { ...process.env, KW_PROFILE: f, KW_OUT: OUTROOT }, stdio: 'pipe' }); } catch (e) { msg = String(e.stderr); }
  ok(/is not a valid profile/.test(msg) && /location\.lat/.test(msg), 'render.mjs refuses a broken profile and says why: ' + msg.slice(0, 200));
}

const run = (script, args, profile, extra = {}) => execFileSync(script.endsWith('.py') ? 'python3' : 'node', [script, ...args], { env: { ...process.env, KW_PROFILE: profile, KW_OUT: OUTROOT, SIZE: 'small', ...extra }, stdio: 'pipe' }).toString();
const withProfile = (name, edit) => { const p = structuredClone(EXAMPLE); edit(p); const f = path.join(TMP, name + '.json'); fs.writeFileSync(f, JSON.stringify(p)); return f; };
// The words that would mean Shelbee's content leaked into someone else's book.
const PERSONAL = /Spokane|Keeping Watch|Frontier|Trans Lifeline|Unify|Trans-Wa|Shelbee|spokanetransit|\bSTA\b|Pacific|Carl.s Jr|Washington|Eastern Washington|Inland Northwest/i;
const bookText = (dir) => fs.readFileSync(`${OUTROOT}/${dir}/journal.html`, 'utf8');
const bodyOf = (html) => html.split('<body>')[1] || html; // the printed pages, not the font paths in <head>

// P3: the generic profile builds a book of its own: its title, its city, its time zone, none of Shelbee's; the overflow gate passes.
{
  run('render.mjs', ['month', '2026-10', 'test.ics'], 'content/profile.example.json');
  const html = bookText('m2026-10'), body = bodyOf(html);
  ok(/<h1>Northlight<\/h1>/.test(body) && /A sky and season journal/.test(body), 'title page carries the profile title and subtitle');
  ok(/Sky data for Lakemont, MN · 46\.79° N, 92\.10° W · Central Time/.test(body), 'title page place line comes from the profile');
  const hit = body.match(PERSONAL);
  ok(!hit, `the generic book contains "${hit && hit[0]}" (Shelbee's content leaked)`);
  const L = read(`${OUTROOT}/m2026-10/layout.json`);
  ok(L.pages.some((p) => p.id === 'title' && p.label === 'Northlight'), 'layout.json labels the title page with the profile title');
  ok(!L.pages.some((p) => /^bus\.|^trans_support$/.test(p.id)), 'no bus or trans pages: those modules are off');
  ok(fs.existsSync(`${OUTROOT}/m2026-10/northlight-2026-10-interior-5.5x8.5.pdf`), 'PDF is named from the profile slug');
  const res = execFileSync('node', ['check.mjs', 'm2026-10'], { env: { ...process.env, KW_OUT: OUTROOT }, stdio: 'pipe' }).toString().trim();
  ok(/^\[\] 0$/.test(res), `check.mjs on the generic book: ${res}`);
  const wanted = read(`${OUTROOT}/m2026-10/data.json`).config;
  ok(wanted.place === 'Lakemont, MN' && wanted.tz === 'America/Chicago', 'data.json config follows the profile');
  // sunrise for another place and time zone: Lakemont is west of the Central meridian, so the sun is up by 7:30a in October and down by 6:30p
  const d = read(`${OUTROOT}/m2026-10/data.json`).days.find((x) => x.date === '2026-10-14');
  ok(/^7:\d\da$/.test(d.sun.rise) && /^6:\d\dp$/.test(d.sun.set), `sun times are local to the profile's place: ${d.sun.rise} / ${d.sun.set}`);
}

// P4: the cover and the EPUB follow the profile too.
{
  run('cover.mjs', ['month', '2026-10'], 'content/profile.example.json');
  ok(fs.existsSync(`${OUTROOT}/m2026-10/northlight-2026-10-cover.pdf`), 'cover PDF named from the profile slug');
  const cover = fs.readFileSync(`${OUTROOT}/m2026-10/cover.html`, 'utf8');
  ok(/<h1>Northlight<\/h1>/.test(cover) && /Lakemont, MN/.test(cover) && !PERSONAL.test(bodyOf(cover)), 'cover carries the profile, none of Shelbee\'s');
  run('epub.py', ['m2026-10'], 'content/profile.example.json');
  const epub = `${OUTROOT}/m2026-10/northlight-2026-10-x4.epub`;
  ok(fs.existsSync(epub), 'EPUB named from the profile slug');
  const txt = execFileSync('python3', ['-c', 'import zipfile,sys;z=zipfile.ZipFile(sys.argv[1]);print("\\n".join(z.read(n).decode("utf8","ignore") for n in z.namelist() if n.endswith((".xhtml",".opf",".ncx"))))', epub], { maxBuffer: 1 << 26 }).toString();
  ok(/Northlight/.test(txt) && /<dc:creator>Sam<\/dc:creator>/.test(txt), 'EPUB carries the profile title and name');
  const leak = txt.match(PERSONAL);
  ok(!leak, `the generic EPUB contains "${leak && leak[0]}"`);
}

// P5: the X4 pack carries the profile's day start, and only the lists the profile names (no trans list with the module off).
{
  const sd = path.join(TMP, 'sd');
  execFileSync('python3', ['../x4/tools/export_pack.py', '.', sd, '2026-10'], { env: { ...process.env, KW_PROFILE: 'content/profile.example.json', KW_OUT: OUTROOT, KW_NO_LIBRARY: '1' }, stdio: 'pipe', cwd: process.cwd() });
  ok(fs.existsSync(`${sd}/kw-update/checkins.txt`), 'pack written');
  const ck = fs.readFileSync(`${sd}/kw-update/checkins.txt`, 'utf8').split('\n');
  ok(/ · built \d{4}-\d{2}-\d{2} · profile day_start=5 tz=America\/Chicago$/.test(ck[0]), `checkins.txt first line carries the build stamp, then the profile: ${ck[0]}`);
  const sup = fs.readFileSync(`${sd}/kw-update/support.txt`, 'utf8');
  ok(/988/.test(sup) && !PERSONAL.test(sup) && !/#My clinic/.test(sup), 'support.txt is the profile\'s list, no clinic, no trans list');
  const day = fs.readFileSync(`${sd}/kw-update/2026-10.txt`, 'utf8');
  ok(/^# Northlight day pack 2026-10/.test(day), 'day pack is headed with the profile title');
}

// P6: every module switched off, one at a time and all together, removes its pages and leaves no dangling reference.
{
  const pagesOf = (dir) => read(`${OUTROOT}/${dir}/layout.json`).pages.map((p) => p.id);
  const cases = [
    ['sky off', (p) => { p.modules.sky = false; }, (ids, body) => { ok(!ids.some((i) => /^month\.(sky|moon)$/.test(i)), 'sky off: no sky & seasons or moon pages'); ok(!/Sky data for/.test(body) && !/class="sky1"/.test(body), 'sky off: no place line and no sky line on the day pages'); }],
    ['spoons off', (p) => { p.modules.spoons = false; }, (ids, body) => { ok(!/Good-spoon/i.test(body) && !/Spoons<\/th>|Spoon theory|spoon theory/.test(body), 'spoons off: no spoon box or spoon notes'); }],
    ['all off, Shelbee\'s own profile', null, (ids, body) => {
      ok(!ids.some((i) => /^bus\.|^trans_support$|^month\.(sky|moon)$/.test(i)), 'every module off: their pages are gone');
      ok(!/p\. \?|page \?/.test(body), 'no unresolved page reference');
      ok(ids.includes('support') && ids.includes('safety') && ids.includes('closing'), 'the protected pages stay');
    }],
  ];
  for (const [name, edit, verify] of cases) {
    const f = edit ? withProfile('mod-' + name.replace(/\W+/g, '-'), edit) : (() => {
      const p = structuredClone(SHELBEE); for (const k of Object.keys(p.modules)) p.modules[k] = false;
      const g = path.join(TMP, 'shelbee-all-off.json'); fs.writeFileSync(g, JSON.stringify(p)); return g;
    })();
    fs.rmSync(`${OUTROOT}/m2026-11`, { recursive: true, force: true });
    run('render.mjs', ['month', '2026-11', 'test.ics'], f);
    const body = bodyOf(bookText('m2026-11'));
    verify(pagesOf('m2026-11'), body);
    const res = execFileSync('node', ['check.mjs', 'm2026-11'], { env: { ...process.env, KW_OUT: OUTROOT }, stdio: 'pipe' }).toString().trim();
    ok(/^\[\] 0$/.test(res), `${name}: check.mjs ${res}`);
    // the book still comes out even and long enough, with its facing pages intact
    const pc = +fs.readFileSync(`${OUTROOT}/m2026-11/pages.txt`, 'utf8');
    ok(pc % 2 === 0 && pc >= 24, `${name}: ${pc} pages (even, at least 24)`);
    execFileSync('node', ['check-spreads.mjs', `${OUTROOT}/m2026-11`], { stdio: 'pipe' });
    n++;
  }
}
console.log(`profile checks passed (${n})`);
