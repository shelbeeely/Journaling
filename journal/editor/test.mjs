// Editor smoke test (CI runs it before publishing): serves editor/dist/site, then checks drag from the palette
// to the list and to the page, every block renders, text options, the overflow meter, 8.5x11, and the phone layout.
//   node render.mjs month 2026-10 test.ics && node editor/build.mjs && node editor/test.mjs   (screens -> editor/dist/test/)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { launch } from '../browser.mjs';
const SITE = new URL('./dist/site/', import.meta.url).pathname, OUT = new URL('./dist/test/', import.meta.url).pathname;
fs.mkdirSync(OUT, { recursive: true });
const srv = http.createServer((q, r) => {
  const f = path.join(SITE, decodeURIComponent(q.url.split('?')[0]).replace(/\/$/, '/index.html'));
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'Content-Type': f.endsWith('.html') ? 'text/html' : 'application/json' }); r.end(d); } });
}).listen(0);
const URL0 = `http://127.0.0.1:${srv.address().port}/`;
const fails = [], ok = (c, m) => { if (!c) fails.push(m); console.log((c ? 'ok   ' : 'FAIL ') + m); };
const b = await launch(), errs = [];
const p = await b.newPage({ viewport: { width: 1400, height: 950 } });
p.on('pageerror', (e) => errs.push(e.message));
await p.goto(URL0, { waitUntil: 'networkidle' });
const types = () => p.evaluate(() => layout.blocks.map((x) => x.type));
ok((await types()).join(' ') === 'sky notes events care spoons good body actions review fact', 'loads the original layout');
await p.locator('#pal li.pi[data-key="t:checks"]').dragTo(p.locator('#list > li[data-uid="body"]'));
ok((await types()).includes('checks'), 'drag from palette to the list');
await p.locator('#pal li.pi[data-key="t:scale"]').dragTo(p.locator('#pv [data-b="actions"]'));
ok((await types()).includes('scale'), 'drag from palette onto the page');
await p.click('#undo');
ok(!(await types()).includes('scale'), 'undo');
const keys = await p.evaluate(() => paletteItems().map((i) => i.key));
for (let i = 0; i < keys.length; i += 5) {
  await p.evaluate(() => { layout = normalize({ v: 2, blocks: [{ type: 'sky' }, { type: 'body', uid: 'body' }, { type: 'actions' }] }); drawList(); drawPalette(); drawPreview(); });
  for (const k of keys.slice(i, i + 5)) { const btn = p.locator(`#pal [data-add="${k}"]`); if (await btn.isVisible()) await btn.click(); }
  const n = await p.evaluate(() => document.querySelectorAll('#pv [data-b]').length);
  ok(n >= 3, `group ${i / 5}: ${keys.slice(i, i + 5).join(', ')} render`);
  await p.locator('.paper').screenshot({ path: `${OUT}/group-${i / 5}.png` });
}
await p.evaluate(() => { layout = normalize(null); drawList(); drawPreview(); });
await p.click('#pal [data-add="t:lines"]');
const inp = p.locator('#list input[data-text]').first();
await inp.fill('Things I noticed'); await inp.blur();
ok(await p.evaluate(() => layout.blocks.find((x) => x.type === 'lines').title === 'Things I noticed'), 'text option');
ok(await p.evaluate(() => !!localStorage.getItem('kw-daypage')), 'saves in the browser');
// Method layouts: apply each from More > Start from a method, check blocks + preview, undo restores.
await p.evaluate(() => { layout = normalize(null); history = []; drawList(); drawPalette(); drawPreview(); });
const methods = await p.evaluate(() => METHOD_LAYOUTS.map((m) => ({ id: m.id, types: m.layout.blocks.map((x) => x.type).join(' ') })));
ok(methods.length === 5, 'five method layouts');
for (const [i, m] of methods.entries()) {
  const before = await p.evaluate(() => JSON.stringify(layout));
  await p.click('#menubtn'); await p.click('#m-method');
  if (i === 1) await p.locator('#methods').screenshot({ path: `${OUT}/methods.png` });
  await p.click(`#methods [data-method="${m.id}"]`);
  const asked = await p.isVisible('#methods-confirm');
  ok(asked === (i > 1), `${m.id}: ${i > 1 ? 'asks before replacing a changed page' : 'no question on the original page'}`);
  if (asked) await p.click('#methods-go');
  ok((await types()).join(' ') === m.types, `${m.id}: blocks match`);
  const pv = await p.evaluate(() => ({ n: document.querySelectorAll('#pv [data-b]').length, m: document.querySelector('#meter').textContent }));
  ok(pv.n >= 1 && !pv.m.includes('overflows'), `${m.id}: preview renders and fits (${pv.m.trim()})`);
  await p.locator('.paper').screenshot({ path: `${OUT}/method-${m.id}.png` });
  await p.click('#undo');
  ok((await p.evaluate(() => JSON.stringify(layout))) === before, `${m.id}: undo restores`);
  await p.evaluate((id) => { layout = normalize(METHOD_LAYOUTS.find((x) => x.id === id).layout); drawList(); drawPreview(); }, m.id);
}
ok((await p.locator('#list > li[data-uid="ts-habits"] .x4').count()) === 1 && (await p.locator('#list > li[data-uid="body"] .x4').count()) === 0, 'also-on-X4 mark on exported blocks only');
await p.screenshot({ path: `${OUT}/desktop-method.png` });
await p.evaluate(() => { layout = normalize({ v: 2, blocks: ['sky', 'notes', 'events', 'care', 'spoons', 'timeline', 'sketch', 'body', 'actions', 'review', 'fact'].map((type) => ({ type })) }); drawList(); drawPreview(); });
ok((await p.textContent('#meter')).includes('Too full'), 'overflow meter warns on a crowded page');
await p.click('#sz-l');
ok(await p.evaluate(() => size === 'letter'), '8.5x11 preview');
await p.screenshot({ path: `${OUT}/desktop.png` });
const m = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
m.on('pageerror', (e) => errs.push('phone: ' + e.message));
await m.goto(URL0, { waitUntil: 'networkidle' });
for (const t of ['edit', 'add', 'preview']) { await m.click(`.tabs [data-tab="${t}"]`); await m.screenshot({ path: `${OUT}/phone-${t}.png` }); }
ok(await m.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no sideways scroll on a phone');
await m.click('.tabs [data-tab="edit"]'); await m.click('#menubtn'); await m.click('#m-method');
await m.screenshot({ path: `${OUT}/phone-methods.png` });
const small = await m.evaluate(() => [...document.querySelectorAll('#methods button')].filter((x) => x.offsetParent && x.getBoundingClientRect().height < 44).length);
ok(small === 0, 'method dialog: 44px targets on a phone');
await m.click('#methods [data-method="theme"]');
ok(await m.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no sideways scroll with a method layout');
await m.screenshot({ path: `${OUT}/phone-theme.png` });
ok(!errs.length, 'no page errors ' + errs.join(' | '));
await b.close(); srv.close();
if (fails.length) { console.log(`\n${fails.length} failed`); process.exit(1); }
