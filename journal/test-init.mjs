// Onboarding check (CI: books.yml): `npm run init` in a scratch copy of journal/ with no profile writes a valid profile, never overwrites one
// without --force, refuses bad answers with a message, builds a sample book that passes the overflow gate, and that book holds none of
// the repository owner's words.
//   node test-init.mjs          (a few seconds to a minute; builds one sample month in a temp folder)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const HERE = path.dirname(new URL(import.meta.url).pathname);
let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'kw-init-'));
process.on('exit', () => fs.rmSync(TMP, { recursive: true, force: true }));
const S = path.join(TMP, 'journal');
fs.cpSync(HERE, S, { recursive: true, filter: (src) => !/^(node_modules|out|out-sample|out-demo|out\/|private|editor\/dist|editor\/dist-demo|packs\/spokane-wa)(\/|$)/.test(path.relative(HERE, src)) });
fs.symlinkSync(path.join(HERE, 'node_modules'), path.join(S, 'node_modules'));
fs.rmSync(path.join(S, 'content/profile.json'), { force: true }); // a fresh clone of someone else's fork: no profile yet
const init = (args, opts = {}) => spawnSync('node', ['init.mjs', ...args], { cwd: S, encoding: 'utf8', env: { ...process.env, KW_PROFILE: '', KW_OUT: '', KW_LIBRARY: '', KW_BOOK: '' }, ...opts });
const profile = () => JSON.parse(fs.readFileSync(path.join(S, 'content/profile.json'), 'utf8'));

// the flags reference: --help works with no profile
ok(/--modules/.test(init(['--help']).stdout), '--help lists the flags');

// a complete non-interactive run
const r = init(['--yes', '--name', 'Sam', '--title', 'Northlight', '--city', 'chicago', '--modules', 'sky,spoons', '--scope', 'month', '--start', '2026-10']);
ok(r.status === 0, 'init succeeds: ' + r.stderr + r.stdout.slice(-300));
const p = profile();
ok(p.person.name === 'Sam' && p.book.title === 'Northlight' && p.book.slug === 'northlight' && p.location.timezone === 'America/Chicago' && p.modules.sky && p.modules.spoons && !p.modules.bus && !p.modules.pay_periods, 'the profile says what was asked');
ok(/^[0-9A-HJKMNP-TV-Z]{8}$/.test(p.book.id), 'a book id was made: ' + p.book.id);
ok(p.paths.support === 'generic' && p.paths.trans === null && p.paths.clinic === null, 'the generic pack is used, with no clinic');
ok(/Overflow check: \[\] 0/.test(r.stdout) && /Sample book: out-sample\/m2026-10\/northlight-2026-10-interior-5\.5x8\.5\.pdf/.test(r.stdout), 'a sample book was built and passes the overflow gate');
ok(fs.existsSync(path.join(S, 'out-sample/m2026-10/northlight-2026-10-interior-5.5x8.5.pdf')), 'the PDF exists');
const html = fs.readFileSync(path.join(S, 'out-sample/m2026-10/journal.html'), 'utf8').split('<body>')[1];
ok(/Add your local numbers here/.test(html) && !/Spokane|Keeping Watch|Shelbee|Frontier/.test(html), 'the sample says to add local numbers and holds none of the owner\'s words');
ok(/\.gitignore/.test(r.stdout) && /Next:/.test(r.stdout), 'it prints the .gitignore note and next steps');

// never over an existing profile without --force
const before = fs.readFileSync(path.join(S, 'content/profile.json'), 'utf8');
const r2 = init(['--yes', '--name', 'Other', '--city', 'london', '--no-build']);
ok(r2.status === 1 && /Not overwriting/.test(r2.stderr) && fs.readFileSync(path.join(S, 'content/profile.json'), 'utf8') === before, 'an existing profile is never overwritten without --force');
const r3 = init(['--yes', '--force', '--name', 'Other', '--title', 'Second', '--city', 'sydney', '--no-build', '--profile', 'content/second.json']);
ok(r3.status === 0 && JSON.parse(fs.readFileSync(path.join(S, 'content/second.json'), 'utf8')).location.lat < 0 && fs.readFileSync(path.join(S, 'content/profile.json'), 'utf8') === before, '--profile writes a second profile beside it (a southern-hemisphere city works)');
const r4 = init(['--yes', '--force', '--no-build', '--city', 'london', '--name', 'Third', '--title', 'Third']);
ok(r4.status === 0 && profile().person.name === 'Third' && profile().book.id !== p.book.id, '--force replaces it, with a new book id');

// bad answers are refused with a message that says what to do
for (const [args, re] of [[['--tz', 'Mars/Olympus', '--city', 'chicago'], /not a time zone name/], [['--lat', 'north', '--place', 'X'], /latitude must be a number/], [['--scope', 'fortnight'], /not a scope/], [['--start', 'October'], /start must look like 2026-10/], [['--modules', 'bus'], /needs a pack that provides a transit feed/], [['--city', 'atlantis'], /No built-in city/], [['--pack', 'no-such-pack'], /No pack "no-such-pack"/], [['--modules', 'glitter'], /not a module/]]) {
  const x = init(['--yes', '--force', '--no-build', ...args]);
  ok(x.status === 1 && re.test(x.stderr), `${args.join(' ')}: ${x.stderr.trim().slice(0, 120)}`);
}

// other scopes and a pack folder of your own
const mine = path.join(TMP, 'mine');
ok(spawnSync('node', ['packs-cli.mjs', 'new', 'support', 'mine', '--dir', mine], { cwd: S, encoding: 'utf8' }).status === 0, 'packs-cli new makes a support pack');
const r5 = init(['--yes', '--force', '--name', 'Sam', '--title', 'Undated', '--city', 'berlin', '--scope', 'undated', '--days', '45', '--pack', mine, '--modules', 'none']);
ok(r5.status === 0 && profile().book.scope === 'undated' && profile().book.undated.days === 45 && profile().paths.support === mine && /Overflow check: \[\] 0/.test(r5.stdout), 'an undated book with a pack folder of your own builds and passes: ' + r5.stderr.slice(-200) + r5.stdout.slice(-200));
console.log(`onboarding checks passed (${n})`);
