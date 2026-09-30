#!/usr/bin/env node
// Makes every picture on the product site from GENERIC sample data only (profile.example.json + journal/test.ics):
//   sample pages (pdftoppm of generic builds), editor screenshots (Playwright on the demo build), X4 screens (x4/host).
// Output: site/img/shots/*.webp plus site/img/shots/manifest.json (sizes for the width/height attributes).
//
//   node site/tools/make-screens.mjs                 # everything
//   node site/tools/make-screens.mjs --only=pages,x4 # some groups: pages, x4, editor, versions
//
// Needs: journal/node_modules (npm ci), pdftoppm (poppler-utils), g++ and python3+Pillow for the X4 host build, Chromium
// (CHROMIUM_PATH, or journal/browser.mjs finds the sandbox copy). In the offline sandbox also set SORTABLE_JS=/path/Sortable.min.js
// (the editor loads its drag library from a CDN; CI has the network). Nothing here is ever committed except the images.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const J = path.join(ROOT, 'journal'), X4 = path.join(ROOT, 'x4/host');
const IMG = path.join(ROOT, 'site/img/shots');
const TMP = path.join(os.tmpdir(), 'jw-shots');
const RELOUT = 'out-shots'; // under journal/ (render.mjs wants a relative KW_OUT); git-ignored
const only = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const want = (g) => !only.length || only.includes(g);
fs.mkdirSync(IMG, { recursive: true }); fs.mkdirSync(TMP, { recursive: true });
const MAN = path.join(IMG, 'manifest.json');
const manifest = fs.existsSync(MAN) ? JSON.parse(fs.readFileSync(MAN, 'utf8')) : {};
const saveManifest = () => fs.writeFileSync(MAN, JSON.stringify(manifest, null, 1) + '\n');
const sh = (cmd, args, opt = {}) => execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'inherit'], ...opt });

const { launch } = await import(path.join(J, 'browser.mjs'));
const browser = await launch();
const conv = await browser.newPage(); // a blank page that turns PNGs into WebP (Chromium encodes it; no extra tools needed)
await conv.goto('about:blank');

// png bytes -> webp file. q=1 is lossless (line art, e-ink), less is lossy (screenshots).
async function save(name, png, q = 0.82, maxW = 0) {
  const b64 = png.toString('base64');
  const r = await conv.evaluate(async ({ b64, q, maxW }) => {
    const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode();
    const k = maxW && im.naturalWidth > maxW ? maxW / im.naturalWidth : 1, w = Math.round(im.naturalWidth * k), h = Math.round(im.naturalHeight * k);
    const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(im, 0, 0, w, h);
    const blob = await new Promise((ok) => c.toBlob(ok, 'image/webp', q));
    const buf = new Uint8Array(await blob.arrayBuffer()); let s = ''; for (let i = 0; i < buf.length; i += 8192) s += String.fromCharCode(...buf.subarray(i, i + 8192));
    return { w, h, data: btoa(s) };
  }, { b64, q, maxW });
  const file = path.join(IMG, name + '.webp'); fs.writeFileSync(file, Buffer.from(r.data, 'base64'));
  manifest[name] = { w: r.w, h: r.h, kb: Math.round(fs.statSync(file).size / 1024) };
  console.log(`  ${name}.webp ${r.w}x${r.h} ${manifest[name].kb} KB`);
}
const readPng = (p) => fs.readFileSync(p);

// ---------- generic profiles (the real profile is never touched; render.mjs writes a book id into the profile it reads, so these are copies) ----------
const base = JSON.parse(fs.readFileSync(path.join(J, 'content/profile.example.json'), 'utf8'));
function profile(name, book) {
  const p = structuredClone(base); Object.assign(p.book, book);
  const f = path.join(TMP, name + '.json'); fs.writeFileSync(f, JSON.stringify(p)); return f;
}
const genv = (prof, out) => ({ ...process.env, KW_PROFILE: prof, KW_OUT: out, SIZE: 'small' });
const rm = (p) => fs.rmSync(p, { recursive: true, force: true });

if (want('pages')) {
  console.log('sample pages');
  const prof = profile('month', {});
  const env = genv(prof, RELOUT + '/month'); rm(path.join(J, RELOUT, 'month'));
  sh('node', ['render.mjs', 'month', '2026-10', 'test.ics'], { cwd: J, env });
  sh('node', ['cover.mjs', 'month', '2026-10'], { cwd: J, env });
  const dir = path.join(J, RELOUT, 'month/m2026-10'), man = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  const pdf = fs.readdirSync(dir).find((f) => /interior-5\.5x8\.5\.pdf$/.test(f));
  const pageOf = (id) => { const p = man.pages.find((x) => x.id === id); if (!p) throw new Error('no page ' + id + ' in the sample book'); return p.page; };
  const shot = async (name, pdfPath, n, alt, dpi = 110) => {
    const o = path.join(TMP, name); sh('pdftoppm', ['-r', String(dpi), '-png', '-f', String(n), '-l', String(n), '-singlefile', pdfPath, o]);
    await save(name, readPng(o + '.png'), 0.9); manifest[name].alt = alt;
  };
  const ids = man.pages.map((p) => p.id);
  console.log('  page ids:', ids.filter((_, i) => i % 6 === 0).join(' '));
  const pick = (re) => ids.find((i) => re.test(i));
  await shot('page-month', path.join(dir, pdf), pageOf(pick(/^month\.2026-10\.calendar$/) || pick(/^month/)), 'A monthly calendar page: a seven-column grid for October with moon phases and a few events.');
  await shot('page-week', path.join(dir, pdf), pageOf(pick(/^week\.02\.left$/) || pick(/^week\..*left$/)), 'A weekly page: Monday to Sunday in rows, each with the moon, sunrise and sunset, and ruled space.');
  await shot('page-day', path.join(dir, pdf), pageOf('day.2026-10-14'), 'A day page built from blocks: date, title and tags, care check-ins, a dotted writing area, action items and the scan strip.');
  await shot('page-tracker', path.join(dir, pdf), pageOf(pick(/tracker/)), 'A monthly tracker: a grid of daily boxes for habits.');
  await shot('page-notes', path.join(dir, pdf), pageOf(pick(/^notes/)), 'A notes page with a title box and a dotted grid for free writing.');
  await shot('page-title', path.join(dir, pdf), 1, 'The title page of the sample book Northlight.');
  // undated book: no date anywhere, "Day 17" instead
  const uprof = profile('undated', { scope: 'undated', undated: { days: 30 } });
  rm(path.join(J, RELOUT, 'undated'));
  const uenv = genv(uprof, RELOUT + '/undated'); sh('node', ['render.mjs', 'book', 'test.ics'], { cwd: J, env: uenv });
  const ud = path.join(J, RELOUT, 'undated'), uv = fs.readdirSync(ud).find((d) => /^b-undated/.test(d)), uvd = path.join(ud, uv);
  const uman = JSON.parse(fs.readFileSync(path.join(uvd, 'manifest.json'), 'utf8')), updf = fs.readdirSync(uvd).find((f) => /interior.*\.pdf$/.test(f));
  const up = uman.pages.find((p) => /^day\.0*3$/.test(p.id)) || uman.pages.find((p) => /^day\./.test(p.id));
  await shot('page-undated', path.join(uvd, updf), up.page, 'An undated day page: the date box is blank and the page says Day 3, so the book can start on any day.');
  // a book that is over the paperback page limit splits itself into volumes: build a quarter and take volume 1 and 2 covers
  const qprof = profile('quarter', { scope: 'quarter' });
  rm(path.join(J, RELOUT, 'quarter'));
  const qenv = genv(qprof, RELOUT + '/quarter'); sh('node', ['render.mjs', 'book', 'test.ics'], { cwd: J, env: qenv });
  const qd = path.join(J, RELOUT, 'quarter'), vols = fs.readdirSync(qd).filter((d) => /^b-quarter/.test(d)).sort();
  manifest._volumes = vols.length;
  for (const [i, v] of vols.slice(0, 2).entries()) {
    sh('node', ['cover.mjs', 'book', v.replace(/^b-/, '')], { cwd: J, env: qenv });
    const cov = fs.readdirSync(path.join(qd, v)).find((f) => /cover.*\.pdf$/.test(f));
    await shot('volume-' + (i + 1) + '-cover', path.join(qd, v, cov), 1, `The wrap-around cover of volume ${i + 1} of ${vols.length} of a quarter book, with its own title block and date range.`, 70);
  }
  const cover = path.join(J, RELOUT, 'month/m2026-10', fs.readdirSync(dir).find((f) => /cover\.pdf$/.test(f)));
  await shot('cover-month', cover, 1, 'A wrap-around cover for the sample book Northlight, deep blue with a row of moon phases and the title in cream.', 70);
  saveManifest();
}

if (want('x4')) {
  console.log('x4 screens (generic card)');
  // A generic copy of the sample card: the host sample is the author's own pack, so every place word is swapped for the generic profile's
  const card = path.join(TMP, 'sd'); rm(card);
  fs.cpSync(path.join(X4, 'sample'), card, { recursive: true });
  const swap = (f, pairs) => { let t = fs.readFileSync(f, 'utf8'); for (const [a, b] of pairs) t = t.replaceAll(a, b); fs.writeFileSync(f, t); };
  for (const f of fs.readdirSync(path.join(card, 'kw')).filter((x) => x.endsWith('.txt'))) swap(path.join(card, 'kw', f), [['Spokane', 'Lakemont'], ['Keeping Watch', 'Northlight'], ['keeping-watch', 'northlight']]);
  fs.writeFileSync(path.join(card, 'kw/me.txt'), '# Your safety plan\n#Signs a hard time is starting\nSkipping meals two days in a row\n#Things I can do on my own\nA warm shower; headphones and a playlist; a walk to the mailbox\n#People I can text\nA friend; a sibling\n');
  fs.writeFileSync(path.join(card, 'kw/support.txt'), '# Support\n#Right now, any hour\n988 Suicide & Crisis Lifeline|Call or text 988. 24/7, free.|TEXT CALL\nCrisis Text Line|Text HOME to 741741. 24/7.|TEXT\n');
  sh('make', ['-s'], { cwd: X4, stdio: 'inherit' });
  const NOW = '2026-10-14 13:10', outBase = path.join(TMP, 'x4out'); rm(outBase);
  const run = (name, settings, keys, extra = {}) => {
    const sd = path.join(TMP, 'sd-run'); rm(sd); fs.cpSync(card, sd, { recursive: true });
    fs.writeFileSync(path.join(sd, 'kw/settings.txt'), settings);
    const out = path.join(outBase, name); fs.mkdirSync(out, { recursive: true });
    sh(path.join(X4, 'kw_host'), [], { cwd: X4, env: { ...process.env, KW_SD: sd, KW_OUT: out, KW_NOW: NOW, KW_KEYS: keys, ...extra } });
    return out;
  };
  const LG = 'text=large\ncontrast=bold\nbuttons=standard\n', NR = 'text=normal\ncontrast=normal\nbuttons=standard\n';
  const D = 'down ', scr = {
    'x4-checkin': ['confirm left left left down confirm right down right right down confirm', {}],
    'x4-scales': ['confirm ' + D.repeat(16) + 'confirm right right down confirm left left down right right down right right right', {}],
    'x4-settings': ['back ' + D.repeat(8) + 'confirm', {}], 'x4-wifi': ['back ' + D.repeat(5) + 'confirm', { KW_WIFI: 'HomeNet=hunter22:-48;Neighbor=secretpw1:-71' }],
    'x4-focus': ['back ' + D.repeat(7) + 'confirm down down down confirm', {}],
  };
  for (const [name, [keys, extra]] of Object.entries(scr)) for (const [suffix, set] of [['', NR], ['-large', LG]]) run(name + suffix, set, keys.trim(), extra);
  sh('python3', [path.join(X4, 'topng.py'), outBase]);
  for (const d of fs.readdirSync(outBase)) {
    const pngs = fs.readdirSync(path.join(outBase, d)).filter((f) => f.endsWith('.png')).sort();
    if (!pngs.length) { console.log('  (no frames for ' + d + ')'); continue; }
    await save(d, readPng(path.join(outBase, d, pngs[pngs.length - 1])), 1);
  }
  saveManifest();
}

// ---------- the editor demo: build it exactly as site/build.sh does, serve it, drive it ----------
function serve(dir) {
  const types = { '.html': 'text/html', '.json': 'application/json' };
  const srv = http.createServer((q, r) => {
    const f = path.join(dir, decodeURIComponent(q.url.split('?')[0]).replace(/\/$/, '/index.html'));
    fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); r.end(d); } });
  }).listen(0);
  return { url: `http://127.0.0.1:${srv.address().port}/`, close: () => srv.close() };
}
async function editorPage(url, vp) {
  const pg = await browser.newPage({ viewport: vp, deviceScaleFactor: 1 });
  await pg.route(/fonts\.(googleapis|gstatic)/, (r) => r.abort());
  if (process.env.SORTABLE_JS) await pg.route(/cdnjs\.cloudflare\.com/, (r) => r.fulfill({ path: process.env.SORTABLE_JS, contentType: 'text/javascript' }));
  pg.on('pageerror', (e) => console.log('  PAGE ERROR', e.message));
  return pg;
}
const ALT = {};
async function snap(pg, name, alt, o = {}) {
  await pg.waitForTimeout(o.wait ?? 900);
  await pg.evaluate(() => { const t = document.getElementById('toast'); if (t) t.style.visibility = 'hidden'; });
  const png = o.el ? await pg.locator(o.el).first().screenshot() : await pg.screenshot({ clip: o.clip });
  await save(name, png, 0.8, o.maxW || 1200); manifest[name].alt = alt;
}
const go = async (pg, base, hash, wait = 1400) => { await pg.goto(base + hash); await pg.waitForTimeout(wait); };

if (want('editor')) {
  console.log('editor screenshots (demo build)');
  const demoEnv = { ...process.env, KW_PROFILE: 'content/profile.example.json', KW_OUT: RELOUT + '/demo', EDITOR_DIST: 'editor/dist-shots/' };
  sh('node', ['render.mjs', 'month', '2026-10', 'test.ics'], { cwd: J, env: demoEnv });
  sh('node', ['editor/build.mjs'], { cwd: J, env: demoEnv });
  const demo = serve(path.join(J, 'editor/dist-shots/demo')), U = demo.url;
  const W = { width: 1280, height: 800 };
  let pg = await editorPage(U, W);
  await go(pg, U, '#book');
  await snap(pg, 'ed-book', 'The Book view: all 72 pages of the sample book laid out in facing spreads, with a page-number box, a zoom control and a legend button.');
  await go(pg, U, '#spread/12');
  await snap(pg, 'ed-spread', 'The Spread view: two facing pages, an Exchange page and a Reply page, at reading size.');
  await pg.setViewportSize({ width: 1280, height: 1000 });
  await go(pg, U, '#day/2026-10-14');
  await snap(pg, 'ed-day-view', 'A day page in view mode: only the page, clean and read-only, with an Edit button at the top right.');
  await pg.setViewportSize({ width: 1600, height: 1000 });
  await go(pg, U, '#day/2026-10-14/edit');
  await snap(pg, 'ed-day-edit', 'The day page in edit mode: the palette of blocks on the left, the list of blocks on the page in the middle, and the live page preview on the right.');
  await pg.evaluate(() => document.querySelector('#scan-t') && document.querySelector('#scan-t').click());
  await snap(pg, 'ed-scan', 'The Scan settings sheet: switches for the send-to strip and the scanning border, and choices for the matrix code position, size and format.', { el: '#scan' });
  await pg.click('#lay-g'); await pg.waitForTimeout(4800);
  await snap(pg, 'ed-grid', 'The page grid: the preview with its rows and columns drawn over it. Blocks such as the moon and sky line span four columns and two rows.', { el: '#paper' });
  await pg.setViewportSize({ width: 1280, height: 800 });
  await go(pg, U, '#library');
  await snap(pg, 'ed-library', 'The Library: a shelf with the book Northlight, a series of season journals and a series of undated practice books, each with its own title.');
  await go(pg, U, '#series/seasons');
  await snap(pg, 'ed-series', 'A series shelf: three season journals that share defaults, shown as covers in order.');
  await go(pg, U, '#library/edit');
  await snap(pg, 'ed-library-edit', 'The Library in edit mode, with controls for titles, series and the books on the shelf.');
  await pg.close();
  // a phone
  pg = await editorPage(U, { width: 390, height: 844 });
  await go(pg, U, '#day/2026-10-14/edit');
  await snap(pg, 'ed-phone', 'The editor on a 390 pixel wide phone: the page preview with the block palette in a sheet at the bottom.', { maxW: 780 });
  await go(pg, U, '#book');
  await snap(pg, 'ed-phone-book', 'The Book view on a phone, with the page grid fitted to the width.', { maxW: 780 });
  await pg.close();
  demo.close();
  saveManifest();
}

// The Versions drawer is hidden in the public demo (it saves nothing), so it is shot on the working-editor build of the SAME generic data
// (guest mode: versions live in the browser, nothing is uploaded).
if (want('versions')) {
  console.log('versions drawer (generic working build, guest mode)');
  const env = { ...process.env, KW_PROFILE: 'content/profile.example.json', KW_OUT: RELOUT + '/demo', EDITOR_DIST: 'editor/dist-shots/' };
  sh('node', ['render.mjs', 'month', '2026-10', 'test.ics'], { cwd: J, env });
  sh('node', ['editor/build.mjs'], { cwd: J, env });
  const app = serve(path.join(J, 'editor/dist-shots/site')), U = app.url;
  const pg = await editorPage(U, { width: 1400, height: 900 });
  await go(pg, U, '#day/2026-10-14/edit');
  await pg.click('#v-ver'); await pg.waitForSelector('#versions[open]');
  await pg.fill('#vs-msg', 'The original page'); await pg.click('#vs-savebtn'); await pg.waitForTimeout(500);
  await pg.click('#vs-close'); await pg.waitForTimeout(300);
  await pg.click('#pal [data-add="t:checks"]'); await pg.waitForTimeout(400);
  await pg.evaluate(() => { const b = layout.blocks.find((x) => x.type === 'fact'); if (b) { b.on = false; layout = normalize(layout); drawList(); drawPreview(); } });
  await pg.click('#v-ver'); await pg.waitForSelector('#versions[open]');
  await pg.fill('#vs-msg', 'Added checkboxes, hid the fact line'); await pg.click('#vs-savebtn'); await pg.waitForTimeout(500);
  await pg.click('#vs-log [data-cmp]:not([data-cmp="draft"])'); await pg.waitForTimeout(1200);
  await snap(pg, 'ed-versions', 'The Versions drawer: a history of saved versions on one side, and a comparison on the other that lists what changed and marks the changed blocks on the page.', { el: '#versions' });
  await pg.close(); app.close(); saveManifest();
}

await browser.close();
