// Scan-code gate. Run after render.mjs (build-all.sh and CI do):
//   node check-codes.mjs [out/mYYYY-MM ...]        default: every out/m*/ that has a layout.json
//   DECODE=none|sample|all node check-codes.mjs    default sample (first, last and every 7th page); all = every page
// Two code formats. A monthly book: KW2|<edition>|<yymm>|<S/L/H><NNN>. Every other book (a volume of a book plan): KW3 + its
// 8-character book id + volume (1 character) + <S/L/H> + <NNN>, see plan.mjs. Both must be a 16x16 Data Matrix.
// Fails (exit 1) when, in any book: two pages share a code; a code isn't the right format for its own page number, book, volume,
// size and edition; a page has no data-zone map or a duplicate zone name; a page lacks type/section; the code needs more than
// a 16x16 Data Matrix; a code doesn't decode from the rendered PDF at 200 dpi; manifest.json (code -> page id) disagrees with
// layout.json, or a decoded code doesn't map to that page's id. Across books: any code shared by two books, and any book id used by
// two different book plans. That check covers every book present in out/ (or KW_OUT, and the folders in KW_REGISTRY, comma
// separated), not only the ones being decoded, so books built on different days still can't collide.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import bwipjs from 'bwip-js';
import { EDITION } from './content/edition.mjs';
import { LIBRARY, PROFILE_BOOK } from './profile.mjs';
import { resolveBook } from './library.mjs';
import { bookDirs } from './bookdirs.mjs';
import { parseKw3, BOOK_ID_RE } from './plan.mjs';

const args = process.argv.slice(2);
const dirs = args.length ? args : bookDirs();
const MODE = process.env.DECODE || 'sample';
const errors = [];
const fail = (dir, msg) => { errors.push(`${dir}: ${msg}`); };
const owner = new Map(); // code -> "dir p.N"
const stats = [];
const ids = new Map(); // book id -> { sig, dir } of the first book plan that has it

// Registry: every other book present in out/ (or KW_OUT / KW_REGISTRY) counts for uniqueness, decoded or not
const rootOf = (d) => path.dirname(d);
for (const root of new Set([process.env.KW_OUT || 'out', ...(process.env.KW_REGISTRY || '').split(',').filter(Boolean)])) {
  for (const d of bookDirs(root)) {
    if (dirs.some((x) => path.resolve(x) === path.resolve(d))) continue;
    const mf = path.join(d, 'manifest.json');
    if (!fs.existsSync(mf)) continue;
    const M = JSON.parse(fs.readFileSync(mf, 'utf8'));
    for (const pg of M.pages) if (!owner.has(pg.code)) owner.set(pg.code, `${d} p.${pg.page} (registry)`);
    if (M.book_id && M.plan && !ids.has(M.book_id)) ids.set(M.book_id, { sig: JSON.stringify(M.plan), dir: d });
  }
}

let readBarcodes = null;
if (MODE !== 'none') {
  const z = await import('zxing-wasm/reader');
  const wasm = path.resolve('node_modules/zxing-wasm/dist/reader/zxing_reader.wasm');
  await z.prepareZXingModule({ overrides: { wasmBinary: fs.readFileSync(wasm) }, fireImmediately: true });
  readBarcodes = z.readBarcodes;
}

for (const dir of dirs) {
  const lf = path.join(dir, 'layout.json');
  if (!fs.existsSync(lf)) { fail(dir, 'no layout.json'); continue; }
  const L = JSON.parse(fs.readFileSync(lf, 'utf8'));
  const letter = dir.endsWith('-letter');
  const scoped = !!L.book_id; // a volume of a book plan: KW3 codes
  const yymm = scoped ? null : L.book.slice(2).replace('-', '');
  const V = L.volume || {};
  if (scoped) {
    if (!BOOK_ID_RE.test(L.book_id)) fail(dir, `book id ${JSON.stringify(L.book_id)} is not 8 characters of 0-9 A-Z without I L O U`);
    if (!(V.n >= 1 && V.of >= V.n && V.of <= 35) || V.book_id !== L.book_id) fail(dir, `volume ${V.n} of ${V.of} (book id ${V.book_id}) doesn't fit layout.json (book id ${L.book_id})`);
  }
  const seen = new Set();
  const mf = path.join(dir, 'manifest.json');
  const M = fs.existsSync(mf) ? JSON.parse(fs.readFileSync(mf, 'utf8')) : null;
  if (!M) fail(dir, 'no manifest.json');
  const idOf = new Map((M ? M.pages : []).map((p) => [p.code, p.id])); // code -> page id, as a printed book is read back
  if (M && (M.pages.length !== L.pages.length || M.book !== L.book || M.size !== L.size || M.edition !== L.edition || M.book_id !== L.book_id)) fail(dir, 'manifest.json is for a different build than layout.json');
  if (scoped && M) { // one book id, one book plan: the same id on two different plans would let two books share codes
    const sig = JSON.stringify(M.plan), prev = ids.get(L.book_id);
    if (!M.plan || !M.volume || M.volume.n !== V.n) fail(dir, 'manifest.json has no plan or volume for this book id');
    if (prev && prev.sig !== sig) fail(dir, `book id ${L.book_id} is also used by a different book (${prev.dir}: ${prev.sig}); every book needs its own id (changed the plan? delete book.id from the profile so the build makes a new one, or remove the old folder)`);
    else if (!prev) ids.set(L.book_id, { sig, dir });
  }
  if (!['S', 'L', 'H'].includes(L.size) || (letter ? L.size !== 'L' : L.size === 'L')) fail(dir, `size ${L.size} doesn't fit the folder`);
  // a library book has its own edition (manifest.library_book); every other build is checked against the profile's
  const ED = M && M.library_book && LIBRARY.books.some((b) => b.id === M.library_book) ? resolveBook(LIBRARY, M.library_book, PROFILE_BOOK).edition : EDITION;
  if (L.edition !== ED) fail(dir, `edition ${L.edition} is not the current ${ED}`);
  L.pages.forEach((p, i) => {
    const at = `${dir} p.${i + 1}`;
    if (p.page !== i + 1) fail(dir, `page ${i + 1} is numbered ${p.page}`);
    if (scoped) {
      const k = parseKw3(p.code);
      if (!k) { fail(dir, `p.${i + 1}: bad code "${p.code}" (a book plan's codes are KW3 + 8-character book id + volume + size + page)`); return; }
      if (k.page !== i + 1) fail(dir, `p.${i + 1}: code ${p.code} names page ${k.page}`);
      if (k.bookId !== L.book_id) fail(dir, `p.${i + 1}: code ${p.code} names book ${k.bookId}, not ${L.book_id}`);
      if (k.vol !== V.n) fail(dir, `p.${i + 1}: code ${p.code} names volume ${k.vol}, this is volume ${V.n}`);
      if (k.size !== L.size) fail(dir, `p.${i + 1}: code ${p.code} names size ${k.size}, book is ${L.size}`);
    } else {
      const m = /^KW2\|(\d)\|(\d{4})\|([SLH])(\d{3})$/.exec(p.code || '');
      if (!m) { fail(dir, `p.${i + 1}: bad code "${p.code}"`); return; }
      if (+m[4] !== i + 1) fail(dir, `p.${i + 1}: code ${p.code} names page ${+m[4]}`);
      if (m[2] !== yymm) fail(dir, `p.${i + 1}: code ${p.code} names book ${m[2]}, not ${yymm}`);
      if (m[3] !== L.size) fail(dir, `p.${i + 1}: code ${p.code} names size ${m[3]}, book is ${L.size}`);
      if (+m[1] !== ED) fail(dir, `p.${i + 1}: code ${p.code} names edition ${m[1]}`);
    }
    if (M && idOf.get(p.code) !== p.id) fail(dir, `p.${i + 1}: manifest maps ${p.code} to "${idOf.get(p.code)}", layout.json says "${p.id}"`);
    if (seen.has(p.code)) fail(dir, `p.${i + 1}: code ${p.code} repeats inside the book`);
    seen.add(p.code);
    if (owner.has(p.code)) fail(dir, `p.${i + 1}: code ${p.code} is also ${owner.get(p.code)}`);
    else owner.set(p.code, at);
    const svg = bwipjs.toSVG({ bcid: 'datamatrix', text: p.code });
    if (!/viewBox="0 0 64 64"/.test(svg)) fail(dir, `p.${i + 1}: ${p.code} needs more than 16x16 modules`);
    if (p.code_format !== 'data_matrix' || !p.type || !p.section || !('date' in p)) fail(dir, `p.${i + 1}: meta incomplete (${JSON.stringify({ type: p.type, section: p.section, format: p.code_format })})`);
    const names = (p.zones || []).map((z) => z.zone), content = names.filter((n) => n !== 'page_code' && n !== 'send_to' && !n.startsWith('send_to_'));
    if (!content.length) fail(dir, `p.${i + 1} (${p.type}): no data-zone map`);
    if (new Set(names).size !== names.length) fail(dir, `p.${i + 1} (${p.type}): duplicate zone names`);
    const pc = (p.zones || []).find((z) => z.zone === 'page_code');
    if (!pc || Math.abs(pc.w - pc.h) > 0.2 || pc.w < 8 || pc.w > 16) fail(dir, `p.${i + 1}: page_code zone isn't the ${'~10.7 mm'} symbol (${JSON.stringify(pc)})`);
    if (p.zones && p.zones.some((z) => !(z.w > 0 && z.h > 0))) fail(dir, `p.${i + 1} (${p.type}): a zone has no size`);
  });

  // decode from the rendered PDF
  if (MODE === 'none') { stats.push(`${dir}: ${L.pages.length} codes unique, decode skipped`); continue; }
  const pdfs = fs.readdirSync(dir).filter((f) => /interior.*\.pdf$/.test(f) && (L.size === 'H') === f.includes('hardcover')).map((f) => path.join(dir, f));
  if (!pdfs.length) { fail(dir, `no ${L.size === 'H' ? 'hardcover ' : ''}interior PDF to decode`); continue; }
  const pdf = pdfs.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
  const n = +/Pages:\s+(\d+)/.exec(execFileSync('pdfinfo', [pdf]).toString())[1];
  if (n !== L.pages.length) { fail(dir, `${pdf} has ${n} pages, layout.json has ${L.pages.length} (stale build?)`); continue; }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kwcodes-'));
  execFileSync('pdftoppm', ['-r', '200', '-gray', pdf, path.join(tmp, 'p')]);
  const files = fs.readdirSync(tmp).filter((f) => f.endsWith('.pgm')).sort();
  let ok = 0, tried = 0;
  for (let i = 0; i < files.length; i++) {
    if (MODE === 'sample' && !(i === 0 || i === files.length - 1 || i % 7 === 0)) continue;
    tried++;
    const buf = fs.readFileSync(path.join(tmp, files[i]));
    const hdr = /^P5\s+(\d+)\s+(\d+)\s+255\s/.exec(buf.subarray(0, 40).toString('latin1'));
    const w = +hdr[1], h = +hdr[2], off = hdr[0].length;
    const rows = h, y0 = 0, data = new Uint8ClampedArray(w * rows * 4); // whole page: the code must be findable wherever a page puts its strip
    for (let k = 0; k < w * rows; k++) { const v = buf[off + y0 * w + k]; data[4 * k] = data[4 * k + 1] = data[4 * k + 2] = v; data[4 * k + 3] = 255; }
    const res = await readBarcodes({ data, width: w, height: rows, colorSpace: 'srgb' }, { formats: ['DataMatrix'], maxNumberOfSymbols: 4, tryHarder: true });
    const want = L.pages[+/(\d+)\.pgm$/.exec(files[i])[1] - 1].code;
    const got = res.filter((r) => r.isValid).map((r) => r.text);
    const wantId = L.pages[+/(\d+)\.pgm$/.exec(files[i])[1] - 1].id;
    if (got.length === 1 && got[0] === want && idOf.get(got[0]) === wantId) ok++;
    else if (got.length === 1 && got[0] === want) fail(dir, `p.${i + 1}: code ${want} decodes but the manifest gives page id "${idOf.get(got[0])}", not "${wantId}"`);
    else fail(dir, `p.${i + 1}: expected ${want}, decoded ${JSON.stringify(got)}`);
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  stats.push(`${dir}: ${L.pages.length} codes unique and well-formed, decoded ${ok}/${tried} (${MODE === 'all' ? 'every page' : 'sample'}) at 200 dpi from ${path.basename(pdf)}`);
}

for (const s of stats) console.log(s);
if (errors.length) { console.error(`check-codes: ${errors.length} problem(s)`); for (const e of errors.slice(0, 40)) console.error('  ' + e); process.exit(1); }
console.log(`check-codes: ok (${dirs.length} book(s), ${owner.size} distinct codes)`);
