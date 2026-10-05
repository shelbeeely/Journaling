// Pack checks (CI: books.yml): the manifest schema, file hashes, the kind registry (unknown kinds fail clearly, every kind has a template
// that passes), the verification rule for support pages, the generic pack builds a clean book, and the personal Spokane pack reproduces
// the committed books byte for byte.
//   node test-packs.mjs          (builds two sample months into out/packs-test/, a few seconds each)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { validateManifest, loadPack, readPart, checkPack, sealPack, satisfies, assertSellable, packHash, listPacks, usedPacks } from './packs/pack.mjs';
import { KINDS, kindNames, kindOf, itemCheck } from './packs/kinds.mjs';
import { withObservances, holidays } from './holidays.mjs';
import { validateProfile } from './profile.mjs';

let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };
const read = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'kw-packs-'));
process.on('exit', () => fs.rmSync(TMP, { recursive: true, force: true }));
process.env.KW_PACKS = TMP; // temp packs are found by id here
const throwsWith = (fn, re, msg) => { try { fn(); } catch (e) { ok(re.test(e.message), `${msg}: got "${e.message.slice(0, 200)}"`); return; } ok(false, `${msg}: did not throw`); };
const cp = (from, id) => { const d = path.join(TMP, id); fs.cpSync(from, d, { recursive: true }); const m = read(path.join(d, 'pack.json')); m.id = id; fs.writeFileSync(path.join(d, 'pack.json'), JSON.stringify(m)); return d; };
const mkPack = (id, kind, files, extra = {}) => {
  const d = path.join(TMP, id); fs.mkdirSync(d, { recursive: true });
  for (const [f, v] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(d, f)), { recursive: true }); fs.writeFileSync(path.join(d, f), JSON.stringify(v)); }
  fs.writeFileSync(path.join(d, 'pack.json'), JSON.stringify({ schema: 1, id, title: id, version: '1.0.0', kind, author: { name: 'T' }, license: { spdx: 'CC0-1.0', attribution: '', commercialPrintOk: true }, engine: '>=1.0.0 <2.0.0', region: null, languages: ['en'], verified: [], files: [], ...extra }));
  sealPack(d); return d;
};
const item = (o) => ({ id: 'x', name: 'X', text: 'Call <b>1</b>', chips: 'CALL', ...o });
const V = { who: 'Sam', date: '2026-09-28', source: 'https://example.org/' };

// K1: the manifest schema names every problem at once.
{
  const good = read('packs/generic/pack.json');
  ok(validateManifest(good).length === 0, 'the generic manifest is valid: ' + validateManifest(good));
  const bad = { schema: 2, id: 'Bad Id', title: '', version: '1.0', kind: '', author: {}, license: { spdx: '', commercialPrintOk: 'yes' }, engine: 'whatever', verified: [{ item: 'a' }], files: [{ path: '../x', sha256: 'abc' }] };
  const errs = validateManifest(bad).join('\n');
  for (const want of ['schema:', 'id:', 'title:', 'version:', 'kind:', 'author.name:', 'license.spdx:', 'license.attribution:', 'license.commercialPrintOk:', 'engine:', 'verified[0]:', 'files[0].path:', 'files[0].sha256:']) ok(errs.includes(want), `manifest errors name "${want}"; got\n${errs}`);
  ok(validateManifest({ ...good, license: undefined }).some((e) => e.startsWith('license:')), 'a pack with no licence is refused');
  ok(satisfies('>=1.0.0 <2.0.0', '1.0.0') && !satisfies('>=1.0.0 <2.0.0', '2.0.0') && satisfies('^1.2.0', '1.9.9') && !satisfies('^1.2.0', '1.1.0') && satisfies('~1.2.0', '1.2.9') && !satisfies('~1.2.0', '1.3.0'), 'engine ranges compare');
  const newer = mkPack('needs-newer', 'holidays', { 'holidays.json': { observances: [] } }, { engine: '>=2.0.0' });
  throwsWith(() => loadPack('needs-newer'), /needs engine >=2\.0\.0/, 'a pack for a newer engine is refused');
  void newer;
}

// K2: file hashes. An edited file stops the build until the pack is resealed; check says so too.
{
  const d = cp('packs/generic', 'hash-test');
  ok(loadPack('hash-test').hash === packHash(read(path.join(d, 'pack.json'))), 'a pack loads and has a hash');
  const before = loadPack('hash-test').hash;
  fs.appendFileSync(path.join(d, 'support.json'), ' '); // the loader caches by folder; a fresh process sees the edit, and checkPack reads the disk every time
  const r = checkPack('hash-test');
  ok(r.errors.some((e) => /support\.json: changed since it was sealed/.test(e)), 'check reports a changed file: ' + r.errors);
  sealPack('hash-test');
  ok(checkPack('hash-test').errors.length === 0 && loadPack('hash-test').hash !== before, 'after seal the pack is clean and its hash changed');
  fs.writeFileSync(path.join(d, 'stray.json'), '{}');
  ok(checkPack('hash-test').warnings.some((w) => /stray\.json is in the folder but not in pack\.json/.test(w)), 'a file the manifest does not list is a warning');
  const tooBig = mkPack('too-big', 'holidays', { 'holidays.json': { observances: [], pad: 'x'.repeat(150_000) } });
  ok(checkPack(tooBig).errors.some((e) => /size: holidays\.json/.test(e)), 'size limits per kind are checked');
  // a fresh process refuses an unsealed edit
  const d2 = cp('packs/generic', 'hash-test2'); fs.appendFileSync(path.join(d2, 'support.json'), ' ');
  let msg = ''; try { execFileSync('node', ['-e', "import('./packs/pack.mjs').then(m => m.loadPack('hash-test2'))"], { env: { ...process.env, KW_PACKS: TMP }, stdio: 'pipe' }); } catch (e) { msg = String(e.stderr); }
  ok(/does not match its pack\.json/.test(msg) && /seal hash-test2/.test(msg), 'the loader refuses a pack whose file changed and says how to reseal: ' + msg.slice(0, 160));
}

// K3: the kind registry. Unknown kinds fail clearly; every kind is complete and has a template that passes its own check.
{
  throwsWith(() => kindOf('glitter'), /Unknown pack kind "glitter"\. Installed kinds: support, trans-support, clinic, transit, holidays, seasons-history, puzzles, region\./, 'an unknown kind lists the installed ones');
  mkPack('weird', 'glitter', {});
  throwsWith(() => loadPack('weird'), /Unknown pack kind "glitter"\. Installed kinds:/, 'a pack of an unknown kind is refused with the list');
  ok(checkPack('weird').errors.some((e) => /Unknown pack kind/.test(e)), 'check reports an unknown kind');
  for (const k of kindNames()) {
    const d = KINDS[k];
    ok(['public', 'personal'].includes(d.privacy) && typeof d.title === 'string' && d.schema && d.consumedBy && d.print && d.limits && typeof d.validate === 'function' && typeof d.consume === 'function', `kind ${k} declares its privacy class, schema, use, print rules, limits, validator and consumer`);
    const t = `packs/_template/${k}`;
    ok(fs.existsSync(`${t}/pack.json`), `kind ${k} has a template folder`);
    const c = checkPack(t);
    ok(c.errors.length === 0, `template ${k} passes its own check: ${c.errors}`);
  }
  ok(KINDS.support.privacy === 'personal' && KINDS['trans-support'].privacy === 'personal' && KINDS.clinic.privacy === 'personal' && KINDS.transit.privacy === 'public', 'support, trans and clinic are personal; transit is public');
  // `packs-cli new` makes a pack that checks clean
  const dest = path.join(TMP, 'cli-new');
  execFileSync('node', ['packs-cli.mjs', 'new', 'holidays', 'cli-new', '--dir', dest], { stdio: 'pipe' });
  ok(checkPack(dest).errors.length === 0, 'packs-cli new <kind> makes a pack that passes check');
  ok(/^kinds: /.test(execFileSync('node', ['packs-cli.mjs', 'list']).toString()) && listPacks().some((p) => p.id === 'spokane-wa'), 'packs-cli list shows the installed packs');
}

// K4: the verification rule.
{
  const M = {};
  ok(itemCheck(item({ verified: V }), 'support', M) === 'ok', 'an item with who, date and source is verified');
  ok(itemCheck(item({ placeholder: true }), 'support', M) === 'ok', 'a placeholder needs no note');
  ok(itemCheck(item({ verified: false, checkBeforePrinting: true }), 'support', M) === 'warn', 'verified:false plus checkBeforePrinting is the owner\'s call: a warning');
  ok(itemCheck(item({}), 'support', M) === 'missing', 'no note at all is refused');
  ok(itemCheck(item({ verified: false }), 'support', M) === 'missing', 'verified:false alone is refused');
  ok(itemCheck(item({ verified: { who: 'Sam', date: 'yesterday', source: 'x' } }), 'support', M) === 'incomplete', 'a note with a bad date is refused');
  ok(itemCheck(item({}), 'support', { verified: [{ kind: 'support', ...V }] }) === 'ok', 'a manifest record for the whole kind covers items with no note of their own');
  ok(itemCheck(item({ id: 'a' }), 'support', { verified: [{ item: 'a', ...V }] }) === 'ok' && itemCheck(item({ id: 'b' }), 'support', { verified: [{ item: 'a', ...V }] }) === 'missing', 'a manifest record for one item covers only that item');
  const sup = (items) => ({ 'support.json': { sections: [{ title: 'Now', items }] } });
  mkPack('noted', 'support', sup([item({ verified: V })]));
  ok(readPart('noted', 'support')[0][1][0][0] === 'X', 'a verified pack reads (the legacy page shape: [title, [[name, text, chips]]])');
  mkPack('unnoted', 'support', sup([item({ id: 'a', name: 'Crisis line' }), item({ id: 'b', verified: V })]));
  throwsWith(() => readPart('unnoted', 'support'), /Not printing the support pages of pack "unnoted": 1 item has no verification note[\s\S]*Now: Crisis line/, 'the build refuses support pages with an unverified item and names it');
  ok(checkPack('unnoted').errors.some((e) => /no verification note/.test(e)), 'check reports it as an error');
  mkPack('placed', 'support', sup([item({ placeholder: true, text: '' })]));
  ok(/Add your local numbers here/.test(readPart('placed', 'support')[0][1][0][1]), 'a placeholder with no text prints the "add your local numbers here" line');
  mkPack('flagged', 'support', sup([item({ verified: false, checkBeforePrinting: true, check: 'hours' })]));
  const warns = []; const w0 = console.warn; console.warn = (m) => warns.push(m);
  const rows = readPart('flagged', 'support'); console.warn = w0;
  ok(rows[0][1].length === 1 && warns.length === 1 && /checkBeforePrinting/.test(warns[0]) && /Now: X \(hours\)/.test(warns[0]), 'flagged items print with one warning that lists them: ' + warns);
  mkPack('clin-bad', 'clinic', { 'clinic.json': { name: 'C', address: 'A', lines: [item({ id: 'p' })] } });
  throwsWith(() => readPart('clin-bad', 'clinic'), /Not printing the clinic pages/, 'the clinic card follows the same rule');
  ok(read('packs/generic/support.json').sections.flatMap((s) => s.items).every((i) => i.placeholder === true || (i.verified && i.verified.source)), 'every item of the generic pack is verified or a placeholder');
  ok(!fs.existsSync('packs/generic/clinic.json') && !fs.existsSync('packs/generic/gtfs'), 'the generic pack has no clinic and no transit');
  throwsWith(() => readPart('noted', 'clinic'), /is a support pack: it does not provide clinic/, 'a single-kind pack provides only its own kind');
  // Shelbee's own pack: the items the review marked unverified say so, everything else carries a dated source
  const sp = ['support', 'trans', 'clinic'].flatMap((f) => { const d = read(`packs/spokane-wa/${f}.json`); return d.sections ? d.sections.flatMap((s) => s.items) : d.lines; });
  const flagged = sp.filter((i) => i.verified === false);
  ok(flagged.length === 7 && flagged.every((i) => i.checkBeforePrinting === true), `the 7 unverified items in the review are flagged checkBeforePrinting (${flagged.map((i) => i.name)})`);
  ok(sp.filter((i) => i.verified).every((i) => i.verified.date === '2026-09-28' && /^https?:/.test(i.verified.source)), 'the verified items carry the review date and a source');
}

// K5: licences. A book marked for sale refuses a pack that forbids commercial print.
{
  mkPack('no-print', 'holidays', { 'holidays.json': { observances: [] } }, { license: { spdx: 'CC-BY-NC-4.0', attribution: 'By T', commercialPrintOk: false } });
  loadPack('no-print'); readPart('no-print', 'holidays');
  throwsWith(() => assertSellable(usedPacks()), /marked for sale[\s\S]*"no-print" \(CC-BY-NC-4\.0\)/, 'for_sale refuses a pack that forbids commercial print');
  ok(checkPack('no-print').warnings.some((w) => /commercialPrintOk is false/.test(w)), 'check warns about it');
  const p = read('content/profile.example.json'); p.book.for_sale = 'yes';
  ok(validateProfile(p).some((e) => e.startsWith('book.for_sale')), 'book.for_sale must be true or false');
}

// K6: what the profile may name. A pack id or folder, not a file.
{
  const p = read('content/profile.example.json'); p.paths.support = 'content/support.json';
  ok(validateProfile(p).some((e) => /paths\.support: "content\/support\.json" is a file: content now comes from packs/.test(e)), 'a file path in paths is refused with a pointer to packs');
  p.paths.support = 'generic'; p.paths.holidays = 'some-pack';
  ok(validateProfile(p).length === 0, 'paths.holidays is a known key');
  throwsWith(() => loadPack('no-such-pack'), /No pack "no-such-pack"[\s\S]*Installed packs:/, 'a missing pack lists the installed ones');
  // holidays: fixed dates and nth weekdays are added to the built-in list
  const H = withObservances(holidays(2027), 2027, [{ month: 11, day: 20, name: 'Day A' }, { month: 11, nth: { weekday: 1, n: 2 }, name: 'Day B' }, { month: 11, nth: { weekday: 1, n: -1 }, name: 'Day C' }]);
  ok(H['11-20'].some((x) => x.name === 'Day A') && H['11-08'].some((x) => x.name === 'Day B') && H['11-29'].some((x) => x.name === 'Day C'), 'holiday observances land on their dates (2nd and last Monday of Nov 2027)');
  mkPack('hol-bad', 'holidays', { 'holidays.json': { observances: [{ month: 13, day: 1, name: '' }] } });
  ok(checkPack('hol-bad').errors.length >= 2, 'a bad holidays file is refused by the kind validator');
  mkPack('seas-bad', 'seasons-history', { 'seasons.json': { seasons: { 1: ['a', 'b'] } } });
  ok(checkPack('seas-bad').errors.some((e) => /seasons\["72"\]/.test(e)), 'a seasons table needs all 72 entries');
}

// B1: the generic pack builds a clean book of its own: the placeholder line, no clinic, no transit, none of Shelbee's words.
const OUTROOT = 'out/packs-test';
fs.rmSync(OUTROOT, { recursive: true, force: true });
{
  const env = { ...process.env, KW_PACKS: '', KW_PROFILE: 'content/profile.example.json', KW_OUT: OUTROOT, SIZE: 'small' };
  execFileSync('node', ['render.mjs', 'month', '2026-10', 'test.ics'], { env, stdio: 'pipe' });
  const html = fs.readFileSync(`${OUTROOT}/m2026-10/journal.html`, 'utf8').split('<body>')[1];
  ok(/Add your local numbers here/.test(html), 'the generic Support page says to add local numbers');
  ok(!/My clinic/.test(html) && !/class="bus/.test(html), 'no clinic card, no bus pages');
  const hit = html.match(/Spokane|Keeping Watch|Shelbee|Frontier|Unify|Trans Lifeline|STA\b/);
  ok(!hit, `no personal words in the generic book (${hit && hit[0]})`);
  const res = execFileSync('node', ['check.mjs', 'm2026-10'], { env, stdio: 'pipe' }).toString().trim();
  ok(/^\[\] 0$/.test(res), 'check.mjs on the generic book: ' + res);
  const mf = read(`${OUTROOT}/m2026-10/manifest.json`);
  ok(mf.packs.length === 1 && mf.packs[0].id === 'generic' && mf.packs[0].version === '1.0.0' && /^[0-9a-f]{64}$/.test(mf.packs[0].hash) && mf.packs[0].license === 'CC0-1.0', 'the book manifest lists the pack, its version, hash and licence');
}

// B2: Shelbee's books come out byte for byte the same with her pack (the committed fingerprints), with a warning listing the unverified items.
{
  const env = { ...process.env, KW_PACKS: '', KW_OUT: OUTROOT, SIZE: 'small' }; delete env.KW_PROFILE;
  const { spawnSync } = await import('node:child_process');
  const r1 = spawnSync('node', ['render.mjs', 'month', '2026-10', 'test.ics'], { env, encoding: 'utf8' });
  ok(r1.status === 0, 'her book builds: ' + r1.stderr.slice(0, 300));
  ok(/pack spokane-wa \(support\): 1 item is not verified/.test(r1.stderr) && /trans support\): 3 items/.test(r1.stderr) && /clinic\): 3 items/.test(r1.stderr) && /Walk in/.test(r1.stderr), 'the build warns and lists the 7 unverified items (her decision): ' + r1.stderr.slice(0, 200));
  execFileSync('node', ['render.mjs', 'month', '2026-11', 'test.ics'], { env, stdio: 'pipe' });
  const res = execFileSync('node', ['check-identical.mjs', `${OUTROOT}/m2026-10`, `${OUTROOT}/m2026-11`], { env, stdio: 'pipe' }).toString().trim();
  ok(/match the committed fingerprints|skipped/.test(res), 'the spokane-wa pack reproduces the committed books: ' + res);
  const mf = read(`${OUTROOT}/m2026-10/manifest.json`);
  ok(mf.packs.some((p) => p.id === 'spokane-wa' && p.privacy === 'personal' && p.parts.includes('transit') && p.parts.includes('support')), 'her manifest lists her pack as personal, with the parts it used');
}
console.log(`pack checks passed (${n})`);
