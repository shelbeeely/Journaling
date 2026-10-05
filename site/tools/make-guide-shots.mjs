#!/usr/bin/env node
// Makes the guide's pictures from the editor itself, generic data only (profile.example.json + journal/test.ics).
// Each shot in site/tools/guide-content.mjs names the controls it is about by CSS selector. For every shot this script:
//   builds and serves the editor, opens the view, runs the setup clicks, finds each selector, draws a numbered ring on it,
//   crops around the rings (or takes the whole viewport) and writes site/img/guide/<id>[-dark].webp + manifest.json.
// A selector that matches nothing visible FAILS the run (exit 1) and says which shot and which control. CI runs it with --check.
//
//   node site/tools/make-guide-shots.mjs                 # regenerate every image (commit them)
//   node site/tools/make-guide-shots.mjs --check         # CI: drive every shot, write nothing, fail if a selector is gone or an image is missing
//   node site/tools/make-guide-shots.mjs --only=trim,day-edit
//
// Needs the same as make-screens.mjs: journal/node_modules (npm ci) and Chromium (CHROMIUM_PATH, the sandbox copy, or Playwright's).
// Offline sandbox: set SORTABLE_JS=/path/Sortable.min.js (the editor loads its drag library from a CDN; CI has the network).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { SHOTS } from './guide-content.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const J = path.join(ROOT, 'journal');
const IMG = path.join(ROOT, 'site/img/guide');
const CHECK = process.argv.includes('--check');
const only = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const ids = Object.keys(SHOTS).filter((k) => !only.length || only.includes(k));
if (only.length && ids.length !== only.length) { console.error('unknown shot id in --only: ' + only.filter((o) => !SHOTS[o]).join(', ')); process.exit(2); }
const MAN = path.join(IMG, 'manifest.json');
const manifest = !only.length ? {} : (fs.existsSync(MAN) ? JSON.parse(fs.readFileSync(MAN, 'utf8')) : {});
const failures = [];
const fail = (id, msg) => { failures.push(`GUIDE SHOT BROKEN: "${id}": ${msg}`); console.error('  ' + failures[failures.length - 1]); };
const sh = (cmd, args, opt = {}) => execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'inherit'], ...opt });
if (!CHECK) fs.mkdirSync(IMG, { recursive: true });

// ---- build the editor exactly as site/build.sh does (generic profile, test.ics), then serve the demo and the working build ----
const env = { ...process.env, KW_PROFILE: 'content/profile.example.json', KW_OUT: 'out-shots/guide', EDITOR_DIST: 'editor/dist-guide/' };
console.log('building the editor from the generic profile');
sh('node', ['render.mjs', 'month', '2026-10', 'test.ics'], { cwd: J, env });
sh('node', ['editor/build.mjs'], { cwd: J, env });
function serve(dir) {
  const types = { '.html': 'text/html', '.json': 'application/json' };
  const srv = http.createServer((q, r) => {
    const f = path.join(dir, decodeURIComponent(q.url.split('?')[0]).replace(/\/$/, '/index.html'));
    fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); r.end(d); } });
  }).listen(0);
  return { url: `http://127.0.0.1:${srv.address().port}/`, close: () => srv.close() };
}
const servers = { demo: serve(path.join(J, 'editor/dist-guide/demo')), app: serve(path.join(J, 'editor/dist-guide/site')) };

const { launch } = await import(path.join(J, 'browser.mjs'));
const browser = await launch();
const conv = await browser.newPage(); await conv.goto('about:blank'); // turns PNG into WebP (Chromium encodes it)
async function toWebp(png, q, maxW) {
  const r = await conv.evaluate(async ({ b64, q, maxW }) => {
    const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode();
    const k = maxW && im.naturalWidth > maxW ? maxW / im.naturalWidth : 1, w = Math.round(im.naturalWidth * k), h = Math.round(im.naturalHeight * k);
    const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(im, 0, 0, w, h);
    const blob = await new Promise((ok) => c.toBlob(ok, 'image/webp', q));
    const buf = new Uint8Array(await blob.arrayBuffer()); let s = ''; for (let i = 0; i < buf.length; i += 8192) s += String.fromCharCode(...buf.subarray(i, i + 8192));
    return { w, h, data: btoa(s) };
  }, { b64: png.toString('base64'), q, maxW });
  return { w: r.w, h: r.h, buf: Buffer.from(r.data, 'base64') };
}

// ---- the numbered ring: a fixed overlay on top of the page, drawn from the measured boxes ----
const drawMarks = (pg, marks) => pg.evaluate((marks) => {
  document.querySelectorAll('.__gm').forEach((e) => e.remove());
  for (const m of marks) {
    const g = 3, r = document.createElement('div'); r.className = '__gm';
    r.style.cssText = `position:fixed;left:${m.x - g}px;top:${m.y - g}px;width:${m.w + 2 * g}px;height:${m.h + 2 * g}px;border:3px solid #d9480f;border-radius:10px;box-shadow:0 0 0 2px #fff,inset 0 0 0 2px #fff;pointer-events:none;z-index:2147483646;box-sizing:border-box`;
    const b = document.createElement('div'); b.className = '__gm'; b.textContent = String(m.n);
    const at = m.at || 'tl', cx = at.includes('r') ? m.x + m.w + g : at.includes('l') ? m.x - g : m.x + m.w / 2, cy = at.includes('b') ? m.y + m.h + g : at.includes('t') ? m.y - g : m.y + m.h / 2;
    const bx = Math.min(Math.max(cx, 15), innerWidth - 15), by = Math.min(Math.max(cy, 15), innerHeight - 15);
    b.style.cssText = `position:fixed;left:${bx - 14}px;top:${by - 14}px;width:28px;height:28px;border-radius:50%;background:#d9480f;color:#fff;font:700 15px/28px system-ui,sans-serif;text-align:center;box-shadow:0 0 0 2px #fff;pointer-events:none;z-index:2147483647`;
    document.body.append(r, b);
  }
}, marks);

async function runShot(id, theme) {
  const s = SHOTS[id], name = id + (theme === 'dark' ? '-dark' : '');
  const [w, h] = s.vp, scale = s.scale || 1;
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: scale, colorScheme: theme });
  const pg = await ctx.newPage();
  await pg.route(/fonts\.(googleapis|gstatic)/, (r) => r.abort());
  if (process.env.SORTABLE_JS) await pg.route(/cdnjs\.cloudflare\.com/, (r) => r.fulfill({ path: process.env.SORTABLE_JS, contentType: 'text/javascript' }));
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  const need = async (sel, what) => {
    const loc = pg.locator(sel).first();
    try { await loc.waitFor({ state: 'visible', timeout: 6000 }); } catch { throw new Error(`${what} ${JSON.stringify(sel)} matches nothing visible (the editor changed?)`); }
    return loc;
  };
  try {
    await pg.goto(servers[s.build].url + s.hash); await pg.waitForTimeout(1500);
    for (const [op, a, b] of s.setup || []) {
      if (op === 'wait') await pg.waitForTimeout(a);
      else if (op === 'eval') await pg.evaluate(a);
      else if (op === 'click') await (await need(a, 'setup click')).click({ timeout: 5000 });
      else if (op === 'fill') await (await need(a, 'setup field')).fill(b, { timeout: 5000 });
      else if (op === 'hide') await pg.evaluate((q) => document.querySelectorAll(q).forEach((e) => (e.style.visibility = 'hidden')), a);
      else if (op === 'key') await pg.keyboard.press(a);
      else throw new Error('unknown setup op ' + op);
    }
    await pg.evaluate(() => { const t = document.getElementById('toast'); if (t) t.style.visibility = 'hidden'; });
    const boxes = [];
    for (const [i, c] of s.callouts.entries()) {
      const loc = await need(c.sel, `callout ${i + 1} (${c.name})`);
      const r0 = await loc.boundingBox(); // scroll only when it is entirely off screen: a tall block (the block list) already shows its top
      if (!r0 || r0.y + r0.height <= 0 || r0.y >= h || r0.x + r0.width <= 0 || r0.x >= w) { await loc.scrollIntoViewIfNeeded(); await pg.waitForTimeout(60); }
    }
    for (const [i, c] of s.callouts.entries()) {
      const bb = await (await need(c.sel, `callout ${i + 1} (${c.name})`)).boundingBox();
      if (!bb || bb.width < 4 || bb.height < 4) throw new Error(`callout ${i + 1} (${c.name}) ${JSON.stringify(c.sel)} has no size`);
      const x = Math.max(bb.x, 4), y = Math.max(bb.y, 4); // a ring is drawn only over the part that is on screen
      boxes.push({ ...c, n: i + 1, x, y, w: Math.min(bb.x + bb.width, w - 4) - x, h: Math.min(bb.y + bb.height, h - 4) - y });
    }
    await drawMarks(pg, boxes);
    let clip;
    if (s.crop) {
      const extra = [];
      for (const q of s.crop.sels || []) { const bb = await (await need(q, 'crop area')).boundingBox(); extra.push({ x: bb.x, y: bb.y, w: bb.width, h: bb.height }); }
      const all = [...boxes, ...extra], pad = Math.max(s.crop.pad ?? 24, 18); // 18 px at least: the number badge sits half outside its ring
      const x0 = Math.max(0, Math.min(...all.map((b) => b.x)) - pad), y0 = Math.max(0, Math.min(...all.map((b) => b.y)) - pad);
      const x1 = Math.min(w, Math.max(...all.map((b) => b.x + b.w)) + pad), y1 = Math.min(h, Math.max(...all.map((b) => b.y + b.h)) + pad);
      clip = { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
    }
    const png = await pg.screenshot(clip ? { clip } : {});
    if (errs.length) console.log('  (page errors: ' + errs.slice(0, 2).join(' | ') + ')');
    const out = await toWebp(png, s.crop ? 0.9 : 0.82, s.maxW || (s.crop ? 1000 : 1200));
    manifest[name] = { w: out.w, h: out.h, kb: Math.round(out.buf.length / 1024) };
    if (!CHECK) fs.writeFileSync(path.join(IMG, name + '.webp'), out.buf);
    console.log(`  ${name} ${out.w}x${out.h} ${manifest[name].kb} KB (${boxes.length} mark${boxes.length > 1 ? 's' : ''})`);
  } catch (e) { fail(id, e.message.split('\n')[0]); }
  await ctx.close();
}

for (const id of ids) {
  const s = SHOTS[id];
  if (!s.callouts?.length) { fail(id, 'a shot needs at least one callout'); continue; }
  for (const theme of s.themes || ['light']) await runShot(id, theme);
}
await browser.close(); Object.values(servers).forEach((v) => v.close());

// ---- every shot must have its committed image(s), and nothing in the folder may be unused ----
if (CHECK) {
  for (const id of Object.keys(SHOTS)) for (const t of SHOTS[id].themes || ['light']) {
    const f = path.join(IMG, id + (t === 'dark' ? '-dark' : '') + '.webp');
    if (!fs.existsSync(f)) fail(id, `image ${path.relative(ROOT, f)} is missing: run node site/tools/make-guide-shots.mjs and commit it`);
  }
  const known = new Set(Object.keys(SHOTS).flatMap((id) => (SHOTS[id].themes || ['light']).map((t) => id + (t === 'dark' ? '-dark' : '') + '.webp')));
  if (fs.existsSync(IMG)) for (const f of fs.readdirSync(IMG)) if (f.endsWith('.webp') && !known.has(f)) fail(f, 'image is not used by any shot: delete it');
}
if (failures.length) { console.error(`\n${failures.length} guide shot problem(s):\n` + failures.map((f) => '  ' + f).join('\n')); process.exit(1); }
if (!CHECK) {
  const out = {}; for (const k of Object.keys(manifest).sort()) out[k] = manifest[k];
  fs.writeFileSync(MAN, JSON.stringify(out, null, 1) + '\n');
}
console.log(CHECK ? `guide shots ok: every selector found in ${ids.length} shots` : `wrote ${Object.keys(manifest).length} images to site/img/guide/`);
