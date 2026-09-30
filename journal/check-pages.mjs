// Page-identity gate. Run after render.mjs (build-all.sh and CI do):
//   node check-pages.mjs [out/mYYYY-MM ...]        default: every out/m*/ that has a layout.json and journal.html
// Every page must be recognisable on its own (without scanning its code) and every id must be stable:
//   - each page has an `id` (unique in its book) that is also on the page's HTML as data-page-id, and a printed `label`
//   - no two pages in a book share (label + date)
//   - a page's label really is printed on that page (heading text)
//   - no two pages in a book print identically (apart from page number and code)
//   - pages marked `shared` (front/back matter meant to repeat) are byte-identical, apart from page number, code and
//     recto/verso, in every book and both sizes; `shared` must agree everywhere the id appears
// Prints a short report: what is shared and why, and which unshared pages happen to match across books (information only).
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const args = process.argv.slice(2);
const dirs = args.length ? args : bookDirs();
const errors = [];
const fail = (dir, msg) => errors.push(`${dir}: ${msg}`);

// The page as it prints, minus the things that are meant to differ per position: page number, scan code, recto/verso.
const normalize = (h) => h
  .replace(/<span class="pno">\d+<\/span>/, '')
  .replace(/<span class="qr"[^>]*>[\s\S]*?<\/svg>\s*<\/span>/, '')
  .replace(/^(?:recto|verso)/, '')
  .replace(/ data-page-id="[^"]*"/, '');
const hash = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 12);
const ent = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&nbsp;': ' ', '&quot;': '"', '&#39;': "'" };
const alnum = (s) => s.replace(/&\w+;|&#\d+;/g, (e) => ent[e] ?? e).replace(/[^\p{L}\p{N}]/gu, '').toLowerCase();
const textOf = (h) => alnum(h.replace(/<svg[\s\S]*?<\/svg>/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ''));

function readBook(dir) {
  const lf = path.join(dir, 'layout.json'), hf = path.join(dir, 'journal.html');
  if (!fs.existsSync(lf) || !fs.existsSync(hf)) return null;
  const L = JSON.parse(fs.readFileSync(lf, 'utf8'));
  const body = fs.readFileSync(hf, 'utf8').split('<body>')[1].split('<script>')[0];
  const parts = body.split(/<div class="page /).slice(1);
  return { L, parts };
}

const shared = new Map(); // id -> { hash, dir, size } of the first book that has it
const sharedIds = new Map(); // id -> { label, books }
const matches = new Map(); // hash -> { id, dirs:Set } for unshared pages that repeat across books
let nPages = 0;

for (const dir of dirs) {
  const b = readBook(dir);
  if (!b) { fail(dir, 'no layout.json / journal.html'); continue; }
  const { L, parts } = b;
  if (parts.length !== L.pages.length) { fail(dir, `journal.html has ${parts.length} pages, layout.json has ${L.pages.length} (stale build?)`); continue; }
  const ids = new Map(), labels = new Map(), hashes = new Map();
  L.pages.forEach((p, i) => {
    const at = `p.${i + 1}`;
    nPages++;
    const m = /data-page-id="([^"]*)"/.exec(parts[i].slice(0, 200));
    if (!p.id || typeof p.id !== 'string') { fail(dir, `${at} (${p.type}): no page id`); return; }
    if (!/^[a-z0-9_]+(\.[a-z0-9_-]+)*$/.test(p.id)) fail(dir, `${at}: id "${p.id}" isn't lowercase words joined by dots`);
    if (!m || m[1] !== p.id) fail(dir, `${at}: layout.json id "${p.id}" but the page says data-page-id "${m ? m[1] : 'none'}"`);
    if (ids.has(p.id)) fail(dir, `${at}: id "${p.id}" is also p.${ids.get(p.id)}`); else ids.set(p.id, i + 1);
    if (p.label) {
      const k = `${p.label}|${p.date || ''}`;
      if (labels.has(k)) fail(dir, `${at}: printed label "${p.label}"${p.date ? ` on ${p.date}` : ''} is also p.${labels.get(k)}`); else labels.set(k, i + 1);
      if (!textOf(parts[i]).includes(alnum(p.label))) fail(dir, `${at} (${p.id}): label "${p.label}" isn't printed on the page`);
    } else if (!p.shared) fail(dir, `${at} (${p.id}): no printed label`);
    const h = hash(normalize(parts[i]));
    if (!hashes.has(h)) hashes.set(h, []); hashes.get(h).push(i + 1);
    if (p.shared) {
      const s = shared.get(p.id);
      if (!s) shared.set(p.id, { hash: h, dir, page: i + 1 });
      else if (s.hash !== h) fail(dir, `${at} (${p.id}): shared page differs from ${s.dir} p.${s.page} (shared pages must print identically in every book)`);
      const si = sharedIds.get(p.id) || sharedIds.set(p.id, { label: p.label, books: 0 }).get(p.id); si.books++;
    } else {
      const mm = matches.get(h) || matches.set(h, { id: p.id, dirs: new Set() }).get(h); mm.dirs.add(dir);
    }
  });
  for (const g of hashes.values()) if (g.length > 1) fail(dir, `pages ${g.join(', ')} print identically (${g.map((n) => L.pages[n - 1].id).join(', ')}): give each its own label`);
}
// `shared` must be declared in every book that has the id, or in none
for (const [id, s] of sharedIds) {
  const total = dirs.filter((d) => { const b = readBook(d); return b && b.L.pages.some((p) => p.id === id); }).length;
  if (s.books !== total) errors.push(`shared page "${id}" is marked shared in ${s.books} of ${total} books`);
}

console.log(`check-pages: ${dirs.length} book(s), ${nPages} pages, every id and printed label unique, no page repeats inside a book`);
if (sharedIds.size) console.log(`  shared (identical in every book, ignoring page number and code): ${[...sharedIds.entries()].map(([id, s]) => `${id} x${s.books}`).join(', ')}`);
const same = [...matches.values()].filter((m) => new Set([...m.dirs].map((d) => d.replace(/-letter$/, ""))).size > 1 && !/^(day|week|month|notes)\b/.test(m.id) && !m.id.startsWith('bus'));
if (same.length) { const by = new Map(); for (const m of same) by.set(m.id, (by.get(m.id) || 0) + 1); console.log(`  same in several books but not declared shared (info; page numbers, dates or the month differ): ${[...by.keys()].join(', ')}`); }
if (errors.length) { console.error(`check-pages: ${errors.length} problem(s)`); for (const e of errors.slice(0, 40)) console.error('  ' + e); process.exit(1); }
