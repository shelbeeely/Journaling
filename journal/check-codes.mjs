// Scan-code gate. Run after render.mjs (build-all.sh and CI do):
//   node check-codes.mjs [out/mYYYY-MM ...]        default: every out/m*/ that has a layout.json
//   DECODE=none|sample|all node check-codes.mjs    default sample (first, last and every 7th page); all = every page
// Two code formats. A monthly book: KW2|<edition>|<yymm>|<S/L/H><NNN>. Every other book (a volume of a book plan): KW3 + its
// 8-character book id + volume (1 character) + <S/L/H> + <NNN>, see plan.mjs. The default is a 16x16 Data Matrix.
// A page can choose (scan.mjs): no code, QR instead of Data Matrix, another corner or size, or content `id` (KWI|<edition>|<book key>|<size>|<PAGE ID>,
// longer, so a bigger symbol). Every configured code is decoded at its own size and position (a crop of layout.json's code_at_mm), and no
// module may print under 0.5 mm.
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
import { symbolOpts, modulesOf, KWI_RE, MIN_MODULE_MM, DEFAULT_SIZE_MM, CODE_POSITIONS } from './scan.mjs';
const V36 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

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
  const idOf = new Map((M ? M.pages : []).filter((p) => p.code).map((p) => [p.code, p.id])); // code -> page id, as a printed book is read back
  if (M && JSON.stringify(M.pages_without_code || []) !== JSON.stringify(L.pages.filter((p) => !p.code).map((p) => p.id))) fail(dir, 'manifest.json pages_without_code disagrees with layout.json');
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
  const Z = letter ? 11 / 8.5 : 1; // the 8.5x11 page is laid out at 5.5x8.5 and zoomed, so its code prints 1.294 times the size in layout.json
  L.pages.forEach((p, i) => {
    const at = `${dir} p.${i + 1}`;
    if (p.page !== i + 1) fail(dir, `page ${i + 1} is numbered ${p.page}`);
    const sc = p.scan || { frame: true, crop: true, send_to: true, code: true };
    if (!p.code) { // a page with no code: known by its printed number and label only; the manifest lists it
      if (sc.code) fail(dir, `p.${i + 1}: no code, but scan.code says the page has one`);
      if ((p.zones || []).some((z) => z.zone === 'page_code') || p.code_at_mm) fail(dir, `p.${i + 1}: no code, but a page_code zone is mapped`);
    } else {
      const fmt = p.code_format, content = p.code_content || 'book';
      if (!['data_matrix', 'qr'].includes(fmt)) fail(dir, `p.${i + 1}: code format ${JSON.stringify(fmt)} is not data_matrix or qr`);
      if (content === 'id') {
        const k = KWI_RE.exec(p.code);
        if (!k) { fail(dir, `p.${i + 1}: bad code "${p.code}" (content id is KWI|<edition>|<book key>|<size>|<PAGE ID>)`); return; }
        const key = scoped ? L.book_id + V36[V.n] : yymm;
        if (+k[1] !== ED) fail(dir, `p.${i + 1}: code ${p.code} names edition ${k[1]}`);
        if (k[2] !== key) fail(dir, `p.${i + 1}: code ${p.code} names book ${k[2]}, not ${key}`);
        if (k[3] !== L.size) fail(dir, `p.${i + 1}: code ${p.code} names size ${k[3]}, book is ${L.size}`);
        if (k[4].toLowerCase() !== p.id) fail(dir, `p.${i + 1}: code ${p.code} names page id ${k[4].toLowerCase()}, not ${p.id}`);
      } else if (scoped) {
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
      if (!/^[\x20-\x7e]+$/.test(p.code)) fail(dir, `p.${i + 1}: code ${JSON.stringify(p.code)} is not plain ASCII`);
      if (M && idOf.get(p.code) !== p.id) fail(dir, `p.${i + 1}: manifest maps ${p.code} to "${idOf.get(p.code)}", layout.json says "${p.id}"`);
      if (seen.has(p.code)) fail(dir, `p.${i + 1}: code ${p.code} repeats inside the book`);
      seen.add(p.code);
      if (owner.has(p.code)) fail(dir, `p.${i + 1}: code ${p.code} is also ${owner.get(p.code)}`);
      else owner.set(p.code, at);
      const svg = bwipjs.toSVG(symbolOpts(fmt === 'qr' ? 'qr' : 'data_matrix', p.code)), mods = modulesOf(svg);
      if (fmt !== 'qr' && content !== 'id' && !/viewBox="0 0 64 64"/.test(svg)) fail(dir, `p.${i + 1}: ${p.code} needs more than 16x16 modules`);
      if (p.code_modules !== mods) fail(dir, `p.${i + 1}: layout.json says ${p.code_modules} modules, ${p.code} makes ${mods}`);
      if (!p.type || !p.section || !('date' in p)) fail(dir, `p.${i + 1}: meta incomplete (${JSON.stringify({ type: p.type, section: p.section, format: p.code_format })})`);
      const pc = (p.zones || []).find((z) => z.zone === 'page_code');
      // the size the page says, the size the zone measures, and the smallest module that prints and scans
      if (!pc || Math.abs(pc.w - pc.h) > 0.2 || Math.abs(pc.w - p.code_size_mm * Z) > 0.3 * Z) fail(dir, `p.${i + 1}: page_code zone isn't the ${p.code_size_mm} mm symbol (${JSON.stringify(pc)})`);
      if (p.code_size_mm / mods < MIN_MODULE_MM - 0.005) fail(dir, `p.${i + 1}: modules print at ${(p.code_size_mm / mods).toFixed(2)} mm, under the ${MIN_MODULE_MM} mm minimum`);
      if (pc && (pc.w < 8 * Z - 0.1 || pc.w > 14.5 * Z)) fail(dir, `p.${i + 1}: code is ${pc.w} mm wide; safe sizes are 8 to 14 mm`);
      // quiet zone: the code lies inside the frame, at least 0.3 in from its edge (the frame's own margin is 0.5 in; the strip keeps the rest)
      if (pc && p.frame_inner_mm && (pc.x < 7.5 || pc.x + pc.w > p.frame_inner_mm.w - 7.5)) fail(dir, `p.${i + 1}: code is too close to the frame edge (quiet zone)`);
      if (!p.code_at_mm) fail(dir, `p.${i + 1}: layout.json has no code_at_mm for the decoder`);
    }
    const names = (p.zones || []).map((z) => z.zone), content = names.filter((n) => n !== 'page_code' && n !== 'send_to' && !n.startsWith('send_to_'));
    if (!content.length) fail(dir, `p.${i + 1} (${p.type}): no data-zone map`);
    if (new Set(names).size !== names.length) fail(dir, `p.${i + 1} (${p.type}): duplicate zone names`);
    // scan options: what layout.json promises scan tooling must match what is mapped
    if (!sc.frame && names.some((n) => n === 'send_to' || n.startsWith('send_to_'))) fail(dir, `p.${i + 1}: the border is off, but a send_to zone is mapped (no Send-to without the border)`);
    if (!sc.frame && (sc.send_to || sc.crop)) fail(dir, `p.${i + 1}: the border is off, but scan says send_to or crop work`);
    if (sc.frame && !names.some((n) => n === 'send_to' || n.startsWith('send_to_'))) fail(dir, `p.${i + 1}: the border is on, but there is no send_to zone`);
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
  const custom = (p) => p.code && (p.code_format !== 'data_matrix' || p.code_content !== 'book' || p.code_position !== 'right' || Math.abs(p.code_size_mm - DEFAULT_SIZE_MM) > 0.05);
  const firstOf = new Map(); // the first page of each distinct code setup is always decoded, sampled or not
  L.pages.forEach((p, k) => { if (custom(p)) { const key = [p.code_format, p.code_content, p.code_position, p.code_size_mm].join('|'); if (!firstOf.has(key)) firstOf.set(key, k); } });
  const mustDecode = new Set(firstOf.values());
  for (let i = 0; i < files.length; i++) {
    const pg = L.pages[+/(\d+)\.pgm$/.exec(files[i])[1] - 1];
    if (!pg.code) continue; // no code on this page: nothing to decode
    if (MODE === 'sample' && !(i === 0 || i === files.length - 1 || i % 7 === 0 || mustDecode.has(i))) continue;
    tried++;
    const buf = fs.readFileSync(path.join(tmp, files[i]));
    const hdr = /^P5\s+(\d+)\s+(\d+)\s+255\s/.exec(buf.subarray(0, 40).toString('latin1'));
    const w = +hdr[1], h = +hdr[2], off = hdr[0].length;
    // the default code: the whole page (it must be findable wherever a page puts its strip). A configured code: its own box on the page,
    // 4 mm of white round it, at 200 dpi: what a phone camera would be given
    let x0 = 0, y0 = 0, cw = w, ch = h;
    if (custom(pg) && pg.code_at_mm) { const px = (mm) => Math.round((mm / 25.4) * 200), c = pg.code_at_mm; x0 = Math.max(0, px(c.x - 4)); y0 = Math.max(0, px(c.y - 4)); cw = Math.min(w - x0, px(c.w + 8)); ch = Math.min(h - y0, px(c.h + 8)); }
    const data = new Uint8ClampedArray(cw * ch * 4);
    for (let r = 0; r < ch; r++) for (let c = 0; c < cw; c++) { const v = buf[off + (y0 + r) * w + x0 + c], k = 4 * (r * cw + c); data[k] = data[k + 1] = data[k + 2] = v; data[k + 3] = 255; }
    const res = await readBarcodes({ data, width: cw, height: ch, colorSpace: 'srgb' }, { formats: [pg.code_format === 'qr' ? 'QRCode' : 'DataMatrix'], maxNumberOfSymbols: 4, tryHarder: true });
    const want = pg.code;
    const got = res.filter((r) => r.isValid).map((r) => r.text);
    const wantId = pg.id;
    if (got.length === 1 && got[0] === want && idOf.get(got[0]) === wantId) ok++;
    else if (got.length === 1 && got[0] === want) fail(dir, `p.${i + 1}: code ${want} decodes but the manifest gives page id "${idOf.get(got[0])}", not "${wantId}"`);
    else fail(dir, `p.${i + 1}: expected ${want}, decoded ${JSON.stringify(got)}`);
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  stats.push(`${dir}: ${L.pages.filter((p) => p.code).length} codes unique and well-formed, decoded ${ok}/${tried} (${MODE === 'all' ? 'every page' : 'sample'})${L.pages.some((p) => !p.code) ? `, ${L.pages.filter((p) => !p.code).length} page(s) without a code (listed in the manifest)` : ''} at 200 dpi from ${path.basename(pdf)}`);
}

for (const s of stats) console.log(s);
if (errors.length) { console.error(`check-codes: ${errors.length} problem(s)`); for (const e of errors.slice(0, 40)) console.error('  ' + e); process.exit(1); }
console.log(`check-codes: ok (${dirs.length} book(s), ${owner.size} distinct codes)`);
