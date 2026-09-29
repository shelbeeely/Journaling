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
ok((await types()).join(' ') === 'sky notes events care spoons good body actions review fact', 'loads the default layout (same blocks)');
// The care split (paper and X4 as one system): the default page keeps meds, meals, work shift, mood and water on paper;
// spoons, sleep, anxiety and the self-care ticks are X4-only, so they start switched off but stay switchable.
ok(await p.evaluate(() => { const c = layout.blocks.find((x) => x.type === 'care'), r = (id) => c.rows.find((x) => x.id === id);
  return ['meds', 'meals', 'work', 'checkin', 'water'].every((id) => r(id).on) && !r('self_care').on && !r('anxiety').on && !r('work').sleep && !r('meals').snack && r('checkin').steps === 7
    && !layout.blocks.find((x) => x.type === 'spoons').on; }), 'default care split: paper rows on, X4-only rows and spoons off');
ok(await p.evaluate(() => { const t = document.querySelector('#pv [data-zone="x4_note"]'); return !!t && t.textContent.includes('X4: spoons · sleep · anxiety · care ticks'); }), 'the page prints the X4 line under the care block');
ok(await p.evaluate(() => document.querySelectorAll('#pv [data-zone="checkin"] .bub.nb').length === 7 && document.querySelectorAll('#pv [data-zone="checkin"] .bub.mid').length === 1 && document.querySelector('#pv [data-zone="checkin"] .bub.mid').textContent === '0'), 'mood prints -3..+3 with the middle marked');
ok(await p.evaluate(() => document.querySelectorAll('#pv [data-zone="spoons"]').length === 0 && document.querySelectorAll('#pv [data-zone="self_care"], #pv [data-zone="anxiety"]').length === 0), 'no spoons, self-care or anxiety rows on the default page');
// Switching an X4 row back on is still possible, and the X4 line stops naming it.
ok(await p.evaluate(() => { const save = JSON.stringify(layout); layout.blocks.find((x) => x.type === 'care').rows.find((x) => x.id === 'anxiety').on = true; layout = normalize(layout); drawList(); drawPreview();
  const t = document.querySelector('#pv [data-zone="x4_note"]').textContent, has = !!document.querySelector('#pv [data-zone="anxiety"]'); layout = normalize(JSON.parse(save)); drawList(); drawPreview(); return has && !t.includes('anxiety') && t.includes('spoons'); }), 'anxiety row can be switched back on; the X4 line drops it');
ok(await p.evaluate(() => { const save = JSON.stringify(layout); layout = normalize({ v: 2, blocks: [{ type: 'care' }, { type: 'body', uid: 'body' }, { type: 'spoons' }] }); drawList(); drawPreview();
  const t = document.querySelector('#pv [data-zone="x4_note"]').textContent, has = !!document.querySelector('#pv [data-zone="spoons"]'); layout = normalize(JSON.parse(save)); drawList(); drawPreview(); return has && !t.includes('spoons') && t.includes('sleep'); }), 'a spoons block anywhere on the page: the X4 line stops naming spoons');
ok(await p.evaluate(() => { const l = normalize({ v: 2, blocks: [{ type: 'care', rows: [{ id: 'self_care', on: true }, { id: 'meds', on: true }] }, { type: 'body' }] }); const c = l.blocks[0]; return c.rows[0].id === 'self_care' && c.rows.find((x) => x.id === 'water').on && c.rows.find((x) => x.id === 'self_care').on; }), 'a saved care layout keeps its own order and choices');
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
// Tier 1 presets: all are in the palette, and each one adds a block that renders (and X4 ones carry the X4 mark).
const presets = await p.evaluate(() => PRESETS.map((x, i) => ({ key: 'p:' + i, name: x.name, type: x.type, group: x.group })));
ok(presets.length >= 31, `${presets.length} presets in the palette`);
const T1 = ['Rituals', "Today's 3", 'Supports', 'Masking', 'Overload', 'Felt like me', 'Voice minutes', 'Cycle & dose', 'Deposits done', 'Sharpen the saw', 'One Q2 thing', 'Inbox cleared', 'Weekly review', 'Shutdown', 'Deep blocks', 'Places', 'Something new', 'Made something', 'Good today', 'Device-free hour', 'Outside & light', 'Focus rounds count', 'One small good thing'];
ok(T1.every((n) => presets.some((x) => x.name === n)), 'every Tier 1 preset is there');
for (const x of presets.filter((q) => T1.includes(q.name))) {
  await p.evaluate(() => { layout = normalize({ v: 2, blocks: [{ type: 'sky' }, { type: 'body', uid: 'body' }, { type: 'actions' }] }); drawList(); drawPalette(); drawPreview(); });
  await p.locator(`#pal [data-add="${x.key}"]`).click();
  const r = await p.evaluate((t) => ({ n: document.querySelectorAll(`#pv [data-zone="${t}"]`).length, x4: document.querySelectorAll('#list .x4').length, meter: document.querySelector('#meter').textContent }), x.type);
  ok(r.n === 1 && r.x4 === 1 && !r.meter.includes('Too full'), `preset ${x.name}: renders, marked for X4, fits`);
}
// Tier 1 options: each renders in the preview and has its control in the list; none makes the default day overflow.
const OPTS = [
  ['top: guess/took + carried', 'top', { n: 6, bubbles: 2, est: true, carried: true }, '.te.th .tc', 'data-bool="top/est"'],
  ['time blocks: actual + re-plan', 'timeline', { from: 8, to: 18, actual: true, replan: 1 }, '.xtc .xth', 'data-bool="timeline/actual"'],
  ['lined notes: wide', 'lines', { pitch: 8.5 }, '.ru.p33', 'data-choice="lines/pitch"'],
  ['lined notes: grid + wide', 'lines', { paper: 'grid', pitch: 8.5 }, '.ru.pg.p33', 'data-choice="lines/pitch"'],
  ['two columns: standard', 'split', { pitch: 6.6 }, '.ru.p26', 'data-choice="split/pitch"'],
  ['writing space: bold + secret line', 'body', { style: 'bold', secretLine: true }, '.ruled.bold.sl', 'data-bool="body/secretLine"'],
  ['writing space: 3.7 mm grid', 'body', { style: 'grid37' }, '.grid.g37', 'data-choice="body/style"'],
  ['good things: because + label', 'good', { because: true, label: 'Three good things' }, '.grat .gb', 'data-bool="good/because"'],
  ['sensory: temperature + movement', 'sensory', { items: { sound: true, light: false, crowd: false, touch: false, smell: false, social: false, temp: true, move: true } }, '.sn', 'data-flag="sensory/items" data-k="temp"'],
  ['habit dots: tiny legend', 'habits', { tiny: true }, '.mkey', 'data-bool="habits/tiny"'],
  ['sketch: tape marks + caption', 'sketch', { corners: true, caption: 'colour of today' }, '.sk-box .tm.a', 'data-bool="sketch/corners"'],
  ['divider: sun', 'divider', { icon: 'sun' }, '.xdi', 'data-choice="divider/icon"'],
  ['divider: moon', 'divider', { icon: 'moon' }, '.xdi', 'data-choice="divider/icon"'],
  ['checkboxes: scan-ready', 'checks', { omr: true }, '.xb.omr .ck', 'data-bool="checks/omr"'],
  ['scale: scan-ready', 'scale', { omr: true }, '.xb.omr .bub', 'data-bool="scale/omr"'],
];
for (const [name, type, o, sel, ctl] of OPTS) {
  await p.evaluate(([t, oo]) => { layout = normalize({ v: 2, blocks: [{ type: 'sky' }, { type: t, uid: t, ...oo }, ...(t === 'body' ? [] : [{ type: 'body', uid: 'body' }]), { type: 'actions' }] }); drawList(); drawPalette(); drawPreview(); }, [type, o]);
  await p.evaluate((t) => { openIds.add(t); drawList(); }, type === 'body' ? 'body' : type);
  const r = await p.evaluate(([s, c, t]) => ({ hit: document.querySelectorAll('#pv ' + s).length, ctl: document.querySelectorAll(`#list [${c.split(' ')[0]}]`).length, txt: document.querySelector('#pv').textContent, meter: document.querySelector('#meter').textContent, sw: document.documentElement.scrollWidth <= innerWidth }), [sel, ctl, type]);
  const opt = ctl.match(/data-(?:bool|choice|flag)="([^"]+)"/)[1].split('/');
  ok(r.hit > 0, `option ${name}: renders in the preview`);
  if (sel === '.ru.pg.p33') ok((await p.evaluate(() => getComputedStyle(document.querySelector('#pv .ru.pg.p33')).backgroundImage)).includes('svg'), 'grid paper keeps its grid at any line spacing');
  ok((await p.locator(`#list [${ctl.split(' ').join('][')}]`).count()) > 0, `option ${name}: has a control (${opt.join('.')})`);
  ok(!r.meter.includes('Too full'), `option ${name}: the default day still fits`);
  await p.locator('.paper').screenshot({ path: `${OUT}/opt-${name.replace(/[^a-z0-9]+/gi, '-')}.png` });
}
await p.evaluate(() => { layout = normalize(null); drawList(); drawPreview(); });
await p.click('#pal [data-add="t:lines"]');
const inp = p.locator('#list li[data-uid^="lines"] input[data-text]').first();
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
ok((await p.locator('#list > li[data-uid="ts-habits"] .x4').count()) === 1 && (await p.locator('#list > li[data-uid="body"] .x4, #list > li[data-uid="ts-where"] .x4').count()) === 0, 'also-on-X4 mark on exported blocks only');
// Bridge v2: scale numbering (zero / signed), words -> X4 choice, fields max. Each option prints, and the X4 mark follows what exports.
await p.evaluate(() => { layout = normalize({ v: 2, blocks: [{ type: 'sky' }, { type: 'body', uid: 'body' }, { type: 'actions' },
  { type: 'scale', uid: 'plain' }, { type: 'scale', uid: 'pain', title: 'Pain', steps: 11, zero: true }, { type: 'scale', uid: 'mood', title: 'Mood', steps: 7, signed: true },
  { type: 'words', uid: 'wd', title: 'Kind of day', words: ['foggy', 'clear', 'stormy'] }, { type: 'words', uid: 'wx', title: 'Sky', words: ['sun', 'rain'], x4: true },
  { type: 'fields', uid: 'fl', labels: ['Rounds'], max: 10 }] }); drawList(); drawPreview(); });
const nums = (u) => p.evaluate((uid) => [...document.querySelectorAll(`#pv [data-b="${uid}"] .bub em`)].map((e) => e.textContent).join(' '), u);
ok((await nums('plain')) === '' && (await nums('pain')) === '0 1 2 3 4 5 6 7 8 9 10', 'zero scale prints 0..10 under the bubbles; the plain scale prints none');
ok((await nums('mood')) === '\u22123 \u22122 \u22121 0 +1 +2 +3', 'signed scale prints \u22123..+3');
ok((await p.locator('#pv [data-b="plain"] .bub').count()) === 5, 'plain scale is unchanged: 5 bubbles');
ok((await p.locator('#list > li[data-uid="wx"] .x4').count()) === 1 && (await p.locator('#list > li[data-uid="wd"] .x4').count()) === 0, 'words show "also on X4" only when x4 is on');
ok((await p.locator('#pv [data-b="wx"] .w').count()) === 2 && (await p.locator('#pv [data-b="wd"] .w').count()) === 3, 'words print the same either way');
await p.locator('#list > li[data-uid="pain"] button[data-open]').click();
ok((await p.locator('#list > li[data-uid="pain"] [data-bool$="zero"]').count()) === 1 && (await p.locator('#list > li[data-uid="pain"] [data-bool$="signed"]').count()) === 1, 'scale has Number from 0 and Signed options');
await p.locator('.paper').screenshot({ path: `${OUT}/bridge-v2.png` });
await p.evaluate(() => { layout = normalize(METHOD_LAYOUTS.find((x) => x.id === 'theme').layout); drawList(); drawPreview(); });
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
// Any page type renders from sample data (pages.mjs, shared with print): each type of the default book, drawn with the page CSS.
{
  const S = JSON.parse(fs.readFileSync(new URL('./dist/site/pages-sample.json', import.meta.url)));
  const { PAGE_TYPES } = await import('../pages.mjs');
  const typesMade = new Set(S.pages.map((x) => x.type));
  ok(S.types.length === Object.keys(PAGE_TYPES).length, `sample data lists every page type (${S.types.length})`);
  ok(S.pages.length >= 24 && S.pages.length % 2 === 0, `sample book has an even page count (${S.pages.length})`);
  ok(S.pages.every((x) => !/\{\{P_|undefined|NaN|\[object/.test(x.html)), 'no unresolved page references or undefined text in any sample page');
  ok(!S.pages.some((x) => /Unify|120 W Mission/.test(x.html)), 'sample pages carry no clinic details');
  const want = ['title', 'blank', 'anatomy', 'key', 'care', 'contacts', 'theme', 'month_cal', 'month_sky', 'month_tracker', 'month_moon', 'week_left', 'week_right', 'dayp', 'week_review', 'exchange_l', 'exchange_r', 'month_review', 'closing', 'support', 'trans', 'safety', 'bus', 'bus_grid', 'lineage', 'notes'];
  ok(want.every((t) => typesMade.has(t)), 'every page type is rendered from sample data' + want.filter((t) => !typesMade.has(t)).map((t) => ' (missing ' + t + ')').join(''));
  const pg = await b.newPage({ viewport: { width: 1200, height: 900 } });
  const seenT = new Set(), picks = [];
  for (const x of S.pages) if (!seenT.has(x.type)) { seenT.add(x.type); picks.push(x); }
  await pg.setContent(`<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#888;display:flex;flex-wrap:wrap;gap:12px;padding:12px;font-family:Lora,serif}${S.css}#pv .page{flex:none;background:#fff}</style><div id="pv" style="display:contents">${picks.map((x) => `<div class="page ${x.n % 2 ? 'recto' : 'verso'} ${x.cls} m" data-type="${x.type}" style="width:5.5in;height:8.5in;zoom:.6">${x.html}<div class="frame"></div></div>`).join('')}</div>`);
  await pg.waitForTimeout(300);
  ok(await pg.evaluate(() => [...document.querySelectorAll('#pv .page')].every((e) => e.querySelector(':scope > *') && e.scrollHeight <= e.clientHeight + 2)), 'every sample page fits its page');
  await pg.screenshot({ path: `${OUT}/pages-sample.png`, fullPage: true });
  await pg.close();
}
await b.close(); srv.close();
if (fails.length) { console.log(`\n${fails.length} failed`); process.exit(1); }
