// Regression gate for the book canvas: the default books must not change. Compares the built default books (from test.ics)
// with the committed fingerprints in identical.json: the exact HTML of every page (so any byte of any page, its page number and
// its scan code) and the page order, ids, types and sections from layout.json. Zone positions are measured by Chromium and may
// differ a hair between machines, so they are left to the before/after diff done when the renderer changes.
//   node check-identical.mjs                 # every out/m*/ (run after build-all.sh; CI does)
//   node check-identical.mjs out/m2026-10    # some books
//   node check-identical.mjs --update        # rewrite identical.json from the books in out/ (only for an intended change to the default books)
// Skipped, with a notice, when content/daypage.json or a non-default content/book.json is present (they change the books on purpose).
// A daypage.json that says exactly the default layout (e.g. one exported from a Studio project that never changed it) is not a change.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DEFAULT_BOOK } from './book.mjs';
import { normalize } from './daypage.mjs';

const FILE = new URL('./identical.json', import.meta.url);
const args = process.argv.slice(2), update = args.includes('--update');
const dirs = args.filter((a) => !a.startsWith('--'));
const all = fs.existsSync('out') ? fs.readdirSync('out').filter((d) => /^m\d{4}-\d{2}(-letter)?$/.test(d)).sort().map((d) => `out/${d}`) : [];
const use = dirs.length ? dirs : all;
const h = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 10);
// The date the book was built is printed on the title page; it is the only thing in the HTML that legitimately changes.
const norm = (s) => s.replace(/Built \d{4}-\d{2}-\d{2}/, 'Built DATE');

const custom = [];
try {
  if (fs.existsSync('content/daypage.json')) {
    const d = JSON.parse(fs.readFileSync('content/daypage.json', 'utf8'));
    if (JSON.stringify(normalize(d)) !== JSON.stringify(normalize(null))) custom.push('content/daypage.json');
  }
} catch { custom.push('content/daypage.json'); }
try { const b = JSON.parse(fs.readFileSync('content/book.json', 'utf8')); if (JSON.stringify(b) !== JSON.stringify(DEFAULT_BOOK)) custom.push('content/book.json'); } catch { /* none */ }
if (custom.length && !update) { console.log(`check-identical: skipped, ${custom.join(' and ')} change${custom.length > 1 ? '' : 's'} the books on purpose (the fingerprints are for the default layout).`); process.exit(0); }
if (custom.length) { console.error(`Refusing to --update with ${custom.join(' and ')} present: the fingerprints must come from the default layout.`); process.exit(1); }

function fingerprint(dir) {
  const L = JSON.parse(fs.readFileSync(path.join(dir, 'layout.json'), 'utf8'));
  const html = fs.readFileSync(path.join(dir, 'journal.html'), 'utf8');
  const parts = html.split('<body>')[1].split('<script>')[0].split(/<div class="page /).slice(1).map((p) => h(norm(p)));
  const structure = h(JSON.stringify({ size: L.size, edition: L.edition, trim: L.trim_in, pages: L.pages.map((p) => [p.page, p.id, p.label, p.type, p.date, p.section, p.from || null, p.to || null, !!p.shared, p.code]) }));
  return { pages: parts.length, structure, html: parts };
}

if (!use.length) { console.error('check-identical: no built books in out/ (run build-all.sh first)'); process.exit(1); }
const now = {};
for (const d of use) { try { now[path.basename(d)] = fingerprint(d); } catch (e) { console.error(`${d}: ${e.message}`); process.exit(1); } }
if (update) {
  const prev = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : {};
  fs.writeFileSync(FILE, JSON.stringify({ ...prev, ...now }, null, 1) + '\n');
  console.log(`check-identical: wrote ${Object.keys(now).length} books to identical.json`);
  process.exit(0);
}
const want = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const errs = [];
for (const [name, f] of Object.entries(now)) {
  const w = want[name];
  if (!w) { errs.push(`${name}: no committed fingerprint (run --update if this book is new)`); continue; }
  if (f.pages !== w.pages) errs.push(`${name}: ${f.pages} pages, expected ${w.pages}`);
  if (f.structure !== w.structure) errs.push(`${name}: page order, ids, labels, sections or scan codes changed`);
  const bad = f.html.map((x, i) => (x !== w.html[i] ? i + 1 : 0)).filter(Boolean);
  if (bad.length) errs.push(`${name}: page HTML changed on p. ${bad.slice(0, 12).join(', ')}${bad.length > 12 ? ` (+${bad.length - 12} more)` : ''}`);
}
if (errs.length) { console.error(`check-identical: the default books changed:\n  ${errs.join('\n  ')}\nIf that is intended, run "node check-identical.mjs --update" over a full default build and commit identical.json.`); process.exit(1); }
console.log(`check-identical: ${Object.keys(now).length} books match the committed fingerprints`);
