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
const URL0 = `http://127.0.0.1:${srv.address().port}/`, DAY = URL0 + '#day/2026-10-14/edit'; // the editor opens on the Book; the day-page tests open the day level directly
const atDay = (pg) => pg.waitForFunction(() => document.documentElement.dataset.view === 'day' && document.querySelectorAll('#pv [data-b]').length >= 3);
const fails = [], ok = (c, m) => { if (!c) fails.push(m); console.log((c ? 'ok   ' : 'FAIL ') + m); };
const b = await launch(), errs = [];
const p = await b.newPage({ viewport: { width: 1400, height: 950 } });
p.on('pageerror', (e) => errs.push(e.message));
await p.goto(DAY, { waitUntil: 'networkidle' }); await atDay(p);
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
// Tier 2 blocks (BUILD-PLAN section 5): each is in the palette, prints on the default day without overflowing, has its data-zone,
// and shows "also on X4" only when it exports (Focus rounds: a count, Energy types: scales). The others are paper only.
const T2 = [['tl24', 'Time line 24 h', false], ['dump', 'Brain dump', false], ['later', 'Later', false], ['done', 'Done list', false], ['wall', 'Wall of Awful', false],
  ['stamps', 'Time stamps', false], ['rounds', 'Focus rounds', true], ['energy', 'Energy types', true], ['accounts', 'Energy accounts', false], ['weekstrip', 'Week at a glance', false],
  ['keep', 'Keep', false], ['lookback', 'A month ago today', false], ['prompt', 'Rotating prompt', false], ['pixel', 'Day pixel', false], ['range', 'Low and high', false]];
for (const size0 of ['small', 'letter']) {
  await p.evaluate((z) => { size = z; document.querySelector(z === 'small' ? '#sz-s' : '#sz-l').click(); }, size0);
  for (const [t, name, x4] of T2) {
    await p.evaluate(() => { layout = normalize(null); drawList(); drawPalette(); drawPreview(); });
    ok(await p.locator(`#pal [data-add="t:${t}"]`).count() === 1, `${name}: in the palette`);
    await p.locator(`#pal [data-add="t:${t}"]`).click();
    const r = await p.evaluate((ty) => ({ z: document.querySelectorAll(`#pv [data-zone="${ty}"]`).length, x4: document.querySelectorAll('#list .x4').length, meter: document.querySelector('#meter').textContent, ico: !!document.querySelector(`#pal [data-add="t:${ty}"]`).closest('li').querySelector('svg path, svg rect, svg circle'), bw: [...document.querySelectorAll(`#pv [data-zone="${ty}"], #pv [data-zone="${ty}"] *`)].filter((e) => { if (e.closest('svg') || e.classList.contains('hl')) return false; const c = getComputedStyle(e); return [c.backgroundColor, c.borderTopColor, c.borderBottomColor].some((v) => { const m = v.match(/[\d.]+/g); return m && !(m[0] === m[1] && m[1] === m[2]); }); }).length }), t);
    ok(r.z === 1 && r.ico && r.bw === 0, `${size0} ${name}: prints once with a data-zone, an icon, black and white only`);
    ok(r.x4 === (x4 ? 1 : 0), `${name}: ${x4 ? 'has' : 'has no'} "also on X4" mark`);
    ok(!r.meter.includes('Too full'), `${size0} ${name}: fits the default day (${r.meter.trim()})`);
    if (size0 === 'small') await p.locator('.paper').screenshot({ path: `${OUT}/t2-${t}.png` });
  }
}
await p.evaluate(() => { document.querySelector('#sz-s').click(); });
// Every Tier 2 block at once: the meter must say so (they cannot all fit one page), each still prints, and both sizes render.
await p.evaluate((ts) => { layout = normalize({ v: 2, blocks: [{ type: 'sky' }, ...ts.map((t) => ({ type: t })), { type: 'body', uid: 'body' }, { type: 'actions' }] }); drawList(); drawPreview(); }, T2.map((x) => x[0]));
ok((await p.evaluate(() => document.querySelectorAll('#pv [data-b]').length)) === T2.length + 3, 'all Tier 2 blocks print together');
// Night shading follows the day's sunrise and sunset (sample day 2026-10-31); a night-shift start hour re-orders the hours.
await p.evaluate(() => { layout = normalize({ v: 2, blocks: [{ type: 'sky' }, { type: 'tl24', uid: 'tl', start: 0 }, { type: 'body', uid: 'body' }, { type: 'actions' }] }); drawList(); drawPreview(); });
const night = () => p.evaluate(() => [...document.querySelectorAll('#pv [data-zone="tl24"] .tlr')][1].querySelectorAll('i.nt').length);
ok((await night()) > 8 && (await night()) < 16, 'time line: some hours shaded as night, some not');
await p.evaluate(() => { layout = normalize({ v: 2, blocks: [{ type: 'sky' }, { type: 'tl24', uid: 'tl', start: 18, shade: false }, { type: 'body', uid: 'body' }, { type: 'actions' }] }); drawList(); drawPreview(); });
ok((await night()) === 0 && (await p.evaluate(() => document.querySelectorAll('#pv [data-zone="tl24"] .th span')[1].textContent)) === '6p', 'time line: shade off, and a shift starting at 6 p reads 6p first');
ok(await p.evaluate(() => lookBack('2026-10-31', 'month') === 'Sep 30' && lookBack('2027-03-31', 'month') === 'Feb 28' && lookBack('2026-10-31', 'year') === 'Oct 31, 2025'), 'a month ago today: clamps to the last day of the month');
ok(await p.evaluate(() => promptFor('2026-10-31', 'day')[1] === promptFor('2026-10-31', 'day')[1] && promptFor('2026-10-26', 'week')[1] === promptFor('2026-11-01', 'week')[1] && promptFor('2026-10-26', 'week')[1] !== promptFor('2026-11-02', 'week')[1]), 'rotating prompt: same on a reprint; a weekly prompt holds Monday to Sunday');
await p.evaluate(() => { layout = normalize({ v: 2, blocks: [{ type: 'sky' }, { type: 'weekstrip' }, { type: 'body', uid: 'body' }, { type: 'actions' }] }); drawList(); drawPreview(); });
ok(await p.evaluate(() => document.querySelectorAll('#pv [data-zone="weekstrip"] .wsc').length === 7 && document.querySelectorAll('#pv [data-zone="weekstrip"] .wsc.td').length === 1 && document.querySelector('#pv .wsc.td i').textContent === '31'), 'week strip: 7 days, today ringed');
await p.evaluate(() => { layout = normalize({ v: 2, blocks: [{ type: 'sky' }, { type: 'tl24' }, { type: 'rounds' }, { type: 'rounds' }, { type: 'body', uid: 'body' }, { type: 'actions' }] }); drawList(); drawPreview(); });
ok(await p.evaluate(() => [...document.querySelectorAll('#pv [data-zone]')].map((e) => e.dataset.zone).filter((z) => z.startsWith('rounds')).join() === 'rounds,rounds_2'), 'repeated blocks get rounds, rounds_2 zones');
// Size options (Shelbee: "give blocks a size option"): every block that had a fixed height gets a control. Each starts at today's size
// (proved byte for byte against the old library, see README), each bigger setting makes the block taller, and the meter follows.
const SIZE_OPTS = [
  ['top', 'pitch', 8.5, { n: 3 }], ['good', 'pitch', 0.335, {}], ['review', 'h', 4, {}], ['timeline', 'pitch', 8.5, {}], ['bullets', 'pitch', 8.5, {}], ['actions', 'h', 0.36, {}],
  ['dump', 'pitch', 8.5, { n: 2 }], ['later', 'pitch', 8.5, { n: 3 }], ['done', 'pitch', 8.5, { n: 3 }], ['wall', 'n', 3, {}], ['tl24', 'h', 0.3, {}], ['stamps', 'pitch', 8.5, { n: 3 }],
  ['keep', 'pitch', 8.5, { n: 3 }], ['prompt', 'pitch', 8.5, { n: 3 }], ['lookback', 'pitch', 8.5, { n: 2 }], ['rounds', 'pitch', 8.5, { n: 2 }],
  ...['checks', 'habits', 'scale', 'fields', 'words', 'sensory', 'sleeptimes', 'weather', 'bus', 'money', 'reach', 'shift', 'energy', 'accounts', 'pixel', 'range', 'wall'].map((t) => [t, 'roomy', true, {}]),
];
const ws = (m) => { const x = /Writing space ([\d.]+) in/.exec(m); return x ? +x[1] : 0; };
for (const [t, k, big, base] of SIZE_OPTS) {
  const r = await p.evaluate(([t, k, big, base]) => {
    const run = (o) => { layout = normalize({ v: 2, blocks: [{ type: 'sky' }, { type: t, uid: 'zz', ...base, ...o }, { type: 'body', uid: 'body' }, ...(t === 'actions' ? [] : [{ type: 'actions' }])] }); drawList(); drawPreview();
      const el = document.querySelector('#pv [data-b="zz"]'); if (!el) throw new Error('no block for ' + t); return { h: el.getBoundingClientRect().height, m: document.querySelector('#meter').textContent, has: !!TYPES[t].opts.find((x) => x.k === k), def: layout.blocks.find((b) => b.type === t)[k] }; };
    const a = run({}), b = run({ [k]: big }); return { a, b, zones: document.querySelectorAll(`#pv [data-zone="${t === 'actions' ? 'action_items' : t}"]`).length };
  }, [t, k, big, base]);
  ok(r.a.has && r.zones >= 1, `${t}: has a size control (${k}) and keeps its data-zone`);
  ok(r.b.h > r.a.h + 1, `${t}: ${k} ${big} is taller than the default (${r.a.h.toFixed(0)} -> ${r.b.h.toFixed(0)} px)`);
  ok(r.b.m.includes('Too full') || ws(r.b.m) < ws(r.a.m) + 0.001, `${t}: the meter follows the new height (${ws(r.a.m)} -> ${ws(r.b.m) || 'overflow'} in)`);
}
await p.evaluate(() => { layout = normalize({ v: 2, blocks: [{ type: 'sky' }, { type: 'top', n: 6, pitch: 8.5 }, { type: 'good', n: 8, pitch: 0.335 }, { type: 'body', uid: 'body' }, { type: 'actions', count: 8, h: 0.36 }, { type: 'review', h: 5 }] }); drawList(); drawPreview(); });
ok((await p.textContent('#meter')).includes('Too full'), 'big sizes overflow: the meter says so');
await p.evaluate(() => { layout = normalize({ v: 2, blocks: [{ type: 'sky' }, { type: 'top', n: 3, pitch: 8.5 }, { type: 'checks', roomy: true }, { type: 'dump', n: 3, pitch: 6.6 }, { type: 'body', uid: 'body' }, { type: 'actions' }] }); drawList(); drawPreview(); });
await p.locator('.paper').screenshot({ path: `${OUT}/sizes.png` });
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
// Tier 2 care blocks: therapy pack (feelings, skills, urge, thought record) and body (injection sites, body signals, overload, special interest).
const heads = await p.evaluate(() => [...document.querySelectorAll('#pal h3')].map((h) => h.textContent));
ok(heads.includes('Therapy') && heads.includes('Body') && heads.indexOf('Therapy') < heads.indexOf('Body'), 'palette has Therapy and Body headings');
ok(await p.evaluate(() => document.querySelector('#pal').textContent.includes('Use with a therapist')), 'the Therapy heading says to use it with a therapist');
const inGroup = await p.evaluate(() => Object.fromEntries(['Therapy', 'Body'].map((g) => [g, paletteItems().filter((i) => i.group === g).map((i) => i.name)])));
ok(['Feelings 0–5', 'Skills 0–7', 'Urge + acted', 'Thought record'].every((n) => inGroup.Therapy.includes(n)), 'Therapy group: ' + inGroup.Therapy.join(', '));
ok(['Injection site rotation', 'Body signals', 'Overload', 'Special interest'].every((n) => inGroup.Body.includes(n)), 'Body group: ' + inGroup.Body.join(', '));
const cnt = (sel) => p.evaluate((q) => document.querySelectorAll('#pv ' + q).length, sel);
const use = (blocks) => p.evaluate((bl) => { layout = normalize({ v: 2, blocks: [{ type: 'sky' }, ...bl, { type: 'body', uid: 'body' }, ...(bl.some((x) => x.type === 'actions') ? [] : [{ type: 'actions' }])] }); drawList(); drawPalette(); drawPreview(); }, blocks);
const fits = async (m) => { const r = await p.evaluate(() => document.querySelector('#meter').textContent); ok(!r.includes('Too full') && !r.includes('overflows'), `${m}: fits`); };
for (const t of ['feelings', 'skills', 'urge', 'thought']) {
  await use([{ type: t, uid: t }]);
  ok((await cnt(`[data-zone="${t}"]`)) === 1 && (await cnt('.tn')) === 1, `${t}: one zone and a therapist note`);
  const note = await p.evaluate(() => document.querySelector('#pv .tn').textContent);
  ok(/therapist/.test(note) && note.includes('988') && note.includes('Trans Lifeline (877) 565-8860'), `${t}: note has 988 and the Trans Lifeline number`);
  ok((await p.locator('#list .x4').count()) === 0, `${t}: not on X4 until turned on`);
  await fits(t);
}
await use([{ type: 'feelings', uid: 'f' }]);
ok((await cnt('.fr')) === 5 && (await p.evaluate(() => [...document.querySelectorAll('#pv .fr')[0].querySelectorAll('.bub i')].map((e) => e.textContent).join(' '))) === '0 1 2 3 4 5' && (await p.evaluate(() => document.querySelectorAll('#pv .fr .bub').length)) === 30, 'feelings: 5 rows of 6 bubbles (0 to 5)');
await use([{ type: 'skills', uid: 's' }]);
ok((await cnt('.bub')) === 8 && (await p.evaluate(() => [...document.querySelectorAll('#pv .bub i')].map((e) => e.textContent).join(''))) === '01234567', 'skills: 8 bubbles numbered 0 to 7');
ok((await cnt('.skey')) === 1, 'skills: meaning of 0–7 printed');
await use([{ type: 'skills', uid: 's', key: false }]);
ok((await cnt('.skey')) === 0, 'skills: key can be switched off');
await use([{ type: 'urge', uid: 'u', labels: ['Urge A', 'Urge B'] }]);
ok((await cnt('.xrow.ur')) === 2 && (await cnt('.xrow.ur .ck')) === 2 && (await cnt('.xrow.ur .bub')) === 12, 'urge: each row has 0–5 bubbles and an acted box');
for (const [c, n] of [[3, 3], [5, 5], [7, 7]]) {
  await use([{ type: 'thought', uid: 'th', cols: c, n: c === 7 ? 2 : 1 }]);
  ok((await cnt('.thr > div')) === n && (await cnt('.thr')) === (c === 3 ? 1 : 2), `thought record: ${c} boxes`);
  await fits(`thought record ${c}`);
  await p.locator('.paper').screenshot({ path: `${OUT}/tier2-thought-${c}.png` });
}
// X4: injection sites always export (a choice); the therapy blocks only with "Also on X4"; the mark follows.
await use([{ type: 'sites', uid: 'st' }, { type: 'feelings', uid: 'fe' }, { type: 'skills', uid: 'sk', x4: true }, { type: 'urge', uid: 'ur', x4: true }]);
ok((await p.locator('#list > li[data-uid="st"] .x4').count()) === 1 && (await p.locator('#list > li[data-uid="fe"] .x4').count()) === 0 && (await p.locator('#list > li[data-uid="sk"] .x4').count()) === 1 && (await p.locator('#list > li[data-uid="ur"] .x4').count()) === 1, 'also-on-X4 mark: sites, and skills/urge with x4 on; feelings without');
ok(await p.evaluate(() => x4Items(find('st')) === 1 && x4Items(find('fe')) === 0 && x4Items(find('sk')) === 1 && x4Items(find('ur')) === 2), 'X4 item counts: sites 1, skills 1, urge 2');
ok((await cnt('[data-zone="sites"] .w')) === 4, 'sites: four sites to circle by default');
await use([{ type: 'sites', uid: 'st', labels: ['solo'] }]);
ok((await p.locator('#list .x4').count()) === 0, 'a single site is not a choice, so no X4 mark');
await use([{ type: 'bodysig', uid: 'bs' }]);
ok((await cnt('[data-zone="bodysig"] .xrow')) === 2 && (await cnt('[data-zone="bodysig"] .ck')) === 10 && (await p.locator('#list .x4').count()) === 0, 'body signals: paper only, 2 rows of 5 boxes');
await fits('body signals');
// The 16-item cap: the editor says so before the export drops anything.
await use([{ type: 'checks', uid: 'c1', labels: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] }, { type: 'habits', uid: 'c2', labels: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] }, { type: 'urge', uid: 'ur', x4: true }]);
ok((await p.textContent('#meter')).includes('X4 holds 16 custom items; you have 18'), 'over 16 X4 items: the editor warns');
// Everything at once: all the new blocks on one page (with the writing space, without the moon line and action items) fit at both sizes; check.mjs agrees on a real build.
const ALL = [{ type: 'feelings', uid: 'a1' }, { type: 'skills', uid: 'a2' }, { type: 'urge', uid: 'a3' }, { type: 'thought', uid: 'a4', cols: 3 }, { type: 'sites', uid: 'a5', time: true }, { type: 'bodysig', uid: 'a6', n: 1 },
  { type: 'habits', uid: 'a7', title: 'Overload', labels: ['Overload'] }, { type: 'lines', uid: 'a8', title: 'Into today', n: 1 }];
for (const sz of ['small', 'letter']) {
  await p.evaluate((z) => setSize(z), sz);
  await p.evaluate((bl) => { layout = normalize({ v: 2, blocks: [...bl, { type: 'body', uid: 'body' }] }); drawList(); drawPalette(); drawPreview(); }, ALL); // no sky, no action items: the small page is 8.5 in tall
  ok(!(await p.evaluate(() => document.querySelector('#meter').textContent)).includes('page overflows'), `all Tier 2 care blocks at once (${sz}): the page does not overflow`);
  await p.locator('.paper').screenshot({ path: `${OUT}/tier2-all-${sz}.png` });
}
await p.evaluate(() => setSize('small'));
await p.evaluate(() => { layout = normalize(METHOD_LAYOUTS.find((x) => x.id === 'theme').layout); drawList(); drawPreview(); });
await p.screenshot({ path: `${OUT}/desktop-method.png` });
await p.evaluate(() => { layout = normalize({ v: 2, blocks: ['sky', 'notes', 'events', 'care', 'spoons', 'timeline', 'sketch', 'body', 'actions', 'review', 'fact'].map((type) => ({ type })) }); drawList(); drawPreview(); });
ok((await p.textContent('#meter')).includes('Too full'), 'overflow meter warns on a crowded page');
await p.click('#sz-l');
ok(await p.evaluate(() => size === 'letter'), '8.5x11 preview');
await p.screenshot({ path: `${OUT}/desktop.png` });
const m = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
m.on('pageerror', (e) => errs.push('phone: ' + e.message));
await m.goto(DAY, { waitUntil: 'networkidle' }); await atDay(m);
for (const t of ['edit', 'add']) { await m.click(`.tabs [data-tab="${t}"]`); await m.screenshot({ path: `${OUT}/phone-${t}.png` }); }
ok(await m.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no sideways scroll on a phone');
await m.click('.tabs [data-tab="edit"]'); await m.click('#menubtn'); await m.click('#m-method');
await m.screenshot({ path: `${OUT}/phone-methods.png` });
const small = await m.evaluate(() => [...document.querySelectorAll('#methods button')].filter((x) => x.offsetParent && x.getBoundingClientRect().height < 44).length);
ok(small === 0, 'method dialog: 44px targets on a phone');
await m.click('#methods [data-method="theme"]');
ok(await m.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no sideways scroll with a method layout');
await m.screenshot({ path: `${OUT}/phone-theme.png` });
ok(!errs.length, 'no page errors ' + errs.join(' | '));
// ---------- page grid (the Grid layout switch, BUILD-PLAN C4b) ----------
{
  const DP = await import('../daypage.mjs');
  const parts = { header: '<div class="hz">H</div>', sky: '<div class="sky1" data-zone="sky">S</div>', notes: '', events: '', fact: '', routines: [], day: DP.SAMPLE_DAY };
  // the default layout is the flow layout, and grid placements never touch a flow layout
  const flowHtml = DP.dayBlocks(parts, null), placedBlocks = DP.DEFAULT_LAYOUT.blocks.map((x, i) => ({ ...structuredClone(x), col: 2, row: i + 1, colSpan: 3, rowSpan: 2 }));
  ok(JSON.stringify(DP.normalize(null)) === JSON.stringify({ v: 2, blocks: DP.DEFAULT_LAYOUT.blocks }) && !('grid' in DP.normalize(null)), 'grid: the default layout is still plain v2 flow (no grid)');
  ok(DP.dayBlocks(parts, { v: 2, blocks: placedBlocks }) === flowHtml && !flowHtml.includes('class="gc'), 'grid: placements on a flow layout change nothing (same HTML as the default)');
  ok(DP.GRIDS.day.cols === 4 && DP.gridRows('small') === DP.gridRows('letter') && DP.gridRows('small') === 24, 'grid: day page is 4 columns x 24 rows on both trims');
  // X4 export: check-in blocks export the same wherever they sit (and in a grid layout)
  {
    const { spawnSync } = await import('node:child_process'), os = await import('node:os');
    const py = spawnSync('python3', ['--version']);
    if (py.status !== 0) ok(true, 'grid: X4 export check skipped (no python3)');
    else {
      const exp = (L) => {
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kwgrid-')), content = path.join(tmp, 'j', 'content'); fs.mkdirSync(content, { recursive: true });
        for (const f of ['clinic.json', 'support.json', 'trans.json', 'profile.json']) fs.symlinkSync(new URL('../content/' + f, import.meta.url).pathname, path.join(content, f));
        fs.writeFileSync(path.join(content, 'daypage.json'), JSON.stringify(L));
        const r = spawnSync('python3', [new URL('../../x4/tools/export_pack.py', import.meta.url).pathname, path.join(tmp, 'j'), path.join(tmp, 'sd')], { env: { ...process.env, KW_NO_LIBRARY: '1' }, encoding: 'utf8' });
        const t = r.status === 0 ? fs.readFileSync(path.join(tmp, 'sd', 'kw-update', 'checkins.txt'), 'utf8').split('\n').slice(1).join('\n') : 'FAILED ' + r.stderr;
        fs.rmSync(tmp, { recursive: true, force: true }); return t;
      };
      const flow = { v: 2, blocks: [{ type: 'scale', uid: 's1', title: 'Energy' }, { type: 'checks', uid: 'c1', title: 'Wins', labels: ['Bed', 'Water'] }, { type: 'habits', uid: 'h1', labels: ['Stretch'] }, { type: 'body', uid: 'body' }] };
      const gl = DP.normalize(flow); gl.grid = true; DP.autoPlace(gl); const grid = { v: 2, grid: true, blocks: gl.blocks.map((x, i) => ({ ...x, col: 1 + (i % 2) * 2, row: 1 + i * 3, colSpan: 2, rowSpan: 3 })) };
      const a = exp(flow), c = exp(grid);
      ok(a.includes('c_s1|Energy|scale') && a === c, 'grid: X4 check-ins export identically for a flow layout and a grid layout with the same blocks');
    }
  }
  // the editor: switch to Grid, place, span, refuse rule-breaking moves
  const st = () => p.evaluate(() => ({ grid: !!layout.grid, probs: gridProblems(layout, size).map((x) => x.msg), b: Object.fromEntries(layout.blocks.map((x) => [x.uid, { on: x.on, col: x.col, row: x.row, cs: x.colSpan, rs: x.rowSpan }])) }));
  await p.evaluate(() => { setSize('small'); layout = normalize(null); history = []; selected = null; drawList(); drawPalette(); drawPreview(); });
  ok(await p.evaluate(() => !layout.grid && !document.querySelector('#pv .gc') && document.querySelector('#ov').hidden), 'grid: Flow is the default: no grid cells, overlay hidden');
  await p.click('#lay-g');
  let S = await st();
  ok(S.grid && S.probs.length === 0 && ['sky', 'notes', 'events', 'care', 'body', 'actions', 'review'].every((u) => S.b[u].on && S.b[u].col === 1 && S.b[u].cs === 4), 'grid: turning Grid on stacks the blocks full width, no problems');
  ok(S.b.body.rs >= 8 && S.b.fact.on === false, 'grid: the Writing space keeps its 8 rows; "On this day" was switched off to make room');
  ok((await p.textContent('#toast')).includes('On this day'), 'grid: the toast says which block was switched off');
  ok(await p.evaluate(() => getComputedStyle(pv.querySelector('.gg')).gridTemplateRows.split(' ').length === 24 && getComputedStyle(pv.querySelector('.gg')).gridTemplateColumns.split(' ').length === 4), 'grid: 24 rows and 4 columns in the preview');
  ok(await p.evaluate(() => [...pv.querySelectorAll('.gc')].every((c) => c.dataset.zone && c.dataset.b) && new Set([...pv.querySelectorAll('.gc')].map((c) => c.dataset.zone)).size === pv.querySelectorAll('.gc').length), 'grid: one zone per block cell, each with a name');
  const rowPx = 0.22 * 96;
  ok(await p.evaluate((rp) => { const g = pv.querySelector('.gg').getBoundingClientRect(), z = g.width / pv.querySelector('.gg').offsetWidth; return [...pv.querySelectorAll('.gc')].every((c) => { const r = c.getBoundingClientRect(), n = (r.top - g.top) / z / rp, h = r.height / z / rp; return Math.abs(n - Math.round(n)) < 0.03 && Math.abs(h - Math.round(h)) < 0.03; }); }, rowPx), 'grid: every block cell starts and ends on a whole row (5.6 mm)');
  const same = () => p.evaluate(() => [...document.querySelectorAll('#ov .gb')].every((g) => { const c = pv.querySelector(`.gc[data-b="${g.dataset.uid}"]`); if (!c) return true; const a = g.getBoundingClientRect(), r = c.getBoundingClientRect(); return [a.left - r.left, a.top - r.top, a.width - r.width, a.height - r.height].every((d) => Math.abs(d) < 1.5); }));
  ok(await same(), 'grid: the overlay boxes sit exactly on the block cells (small)');
  ok(await p.evaluate(() => document.querySelectorAll('#ov .gb').length >= 7 && document.querySelectorAll('#ov .lk').length === 2), 'grid: a box per block, and the header and scan strip are marked as fixed');
  // placement and spans
  ok(await p.evaluate(() => applyPlace('events', { colSpan: 2 })) && await p.evaluate(() => applyPlace('events', { col: 3 })), 'grid: a block can span fewer columns and move to another column');
  S = await st();
  ok(S.b.events.col === 3 && S.b.events.cs === 2 && S.probs.length === 0, 'grid: events now sits in columns 3-4');
  ok(await p.evaluate(() => /grid-column:\s*3\s*\/\s*span 2/.test(pv.querySelector('.gc[data-b="events"]').getAttribute('style'))), 'grid: the cell spans columns 3-4');
  ok(await p.evaluate(() => applyPlace('notes', { colSpan: 2, rowSpan: 3 })) && (await st()).b.notes.rs === 3 && await p.evaluate(() => Math.abs(pv.querySelector('.gc[data-b="notes"]').offsetHeight - 3 * 0.22 * 96) < 1.5), 'grid: a block can span several rows and columns (notes, 2 wide and 3 tall)');
  ok(await same(), 'grid: overlay still matches after moves and spans');
  // rules, with the message
  const refuse = async (uid, patch, want, label) => {
    const before = JSON.stringify((await st()).b[uid]);
    const r = await p.evaluate(([u, pa]) => { const ok2 = applyPlace(u, pa); return { ok2, t: document.querySelector('#toast').textContent }; }, [uid, patch]);
    ok(!r.ok2 && r.t.includes(want) && JSON.stringify((await st()).b[uid]) === before, `grid rule (${label}): refused with "${r.t.slice(0, 70)}" and nothing moved`);
  };
  await refuse('notes', { colSpan: 3 }, 'overlap', 'no overlap');
  await refuse('care', { colSpan: 2 }, 'needs at least 4 columns', 'minimum columns');
  await refuse('actions', { rowSpan: 1 }, 'needs at least', 'minimum rows');
  await refuse('body', { rowSpan: 6 }, 'Writing space stays at least 8 rows', 'Writing space minimum');
  await refuse('body', { colSpan: 1 }, 'Writing space stays', 'Writing space minimum width');
  await refuse('review', { row: 23 }, 'runs off the bottom', 'inside the page');
  await refuse('events', { col: 4 }, 'sticks out of the page', 'inside the columns');
  await refuse('sky', { col: 0 }, 'left edge', 'edge of the page');
  await refuse('sky', { row: 0 }, 'date, title and tags', 'header is locked');
  // an imported layout that breaks the rules is shown, not printed
  await p.evaluate(() => { const L = structuredClone(layout); L.blocks.find((x) => x.uid === 'notes').row = 4; L.blocks.find((x) => x.uid === 'notes').colSpan = 4; L.blocks.find((x) => x.uid === 'notes').rowSpan = 1; layout = normalize(L, size); drawList(); drawPalette(); drawPreview(); });
  ok(await p.evaluate(() => !document.querySelector('#problems').hidden && document.querySelector('#problems').textContent.includes('overlap') && document.querySelector('#list li.prob') && document.querySelectorAll('#ov .gb.bad').length >= 1), 'grid: a layout with an overlap lists the problem, marks the block and its box');
  const printErr = await p.evaluate(() => { try { dayBlocks(KIT, layout, { size }); return ''; } catch (e) { return e.message; } });
  ok(printErr.includes('cannot be printed') && printErr.includes('overlap'), 'grid: print refuses a layout that breaks a rule, and says why');
  await p.evaluate(() => { history = []; layout = normalize(null); drawList(); drawPalette(); drawPreview(); });
  await p.click('#lay-g');
  // keyboard: arrows move, Shift + arrows span, undo
  await p.evaluate(() => { applyPlace('events', { colSpan: 2 }); applyPlace('events', { col: 3 }); applyPlace('notes', { colSpan: 2, rowSpan: 3 }); focusUid = 'notes'; drawOverlay(); });
  await p.focus('#ov .gb[data-uid="notes"]');
  await p.keyboard.press('ArrowUp');
  ok((await st()).b.notes.row === 3 && (await p.textContent('#toast')).includes('overlap'), 'grid keys: a move into another block is refused');
  await p.keyboard.press('Shift+ArrowUp');
  ok((await st()).b.notes.rs === 2, 'grid keys: Shift + Up makes it one row shorter');
  await p.keyboard.press('ArrowDown');
  ok((await st()).b.notes.row === 4 && (await p.evaluate(() => document.activeElement.dataset.uid)) === 'notes', 'grid keys: Down moves it one row, and the focus stays on the block');
  await p.keyboard.press('ArrowRight');
  ok((await st()).b.notes.col === 1 && (await p.textContent('#toast')).includes('overlap'), 'grid keys: Right into the events block is refused with a message');
  await p.keyboard.press('ArrowLeft');
  ok((await p.textContent('#toast')).includes('left edge'), 'grid keys: it stops at the left edge with a message');
  await p.click('#undo'); await p.click('#undo');
  ok((await st()).b.notes.row === 3 && (await st()).b.notes.rs === 3, 'grid: undo steps back through moves and spans');
  // mouse: drag to move, drag the corner to resize (snaps to cells)
  await p.evaluate(() => { history = []; layout = normalize(null); drawList(); drawPreview(); });
  await p.click('#lay-g');
  await p.evaluate(() => { applyPlace('events', { colSpan: 2 }); });
  const cell = await p.evaluate(() => ({ dx: M.cw + M.gap, dy: M.rh }));
  const box = async (uid) => p.evaluate((u) => { const r = document.querySelector(`#ov .gb[data-uid="${u}"]`).getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; }, uid);
  let bx = await box('events');
  await p.mouse.move(bx.x + bx.w / 2, bx.y + bx.h / 2); await p.mouse.down(); await p.mouse.move(bx.x + bx.w / 2 + cell.dx * 2 + 4, bx.y + bx.h / 2, { steps: 6 }); await p.mouse.up();
  ok((await st()).b.events.col === 3, 'grid mouse: dragging a block two columns right snaps it to column 3');
  bx = await box('actions');
  await p.mouse.move(bx.x + bx.w, bx.y + bx.h); await p.mouse.down(); await p.mouse.move(bx.x + bx.w - cell.dx - 3, bx.y + bx.h, { steps: 6 }); await p.mouse.up();
  ok((await st()).b.actions.cs === 3, 'grid mouse: dragging the corner handle one column left makes the block 3 wide');
  bx = await box('notes');
  await p.mouse.move(bx.x + 30, bx.y + bx.h / 2); await p.mouse.down(); await p.mouse.move(bx.x + 30, bx.y + bx.h / 2 + cell.dy * 3, { steps: 6 }); await p.mouse.up();
  ok((await st()).b.notes.row === 3 && (await p.textContent('#toast')).includes('overlap'), 'grid mouse: dropping a block on another is refused (it snaps back)');
  ok(await same(), 'grid: after refused drags the overlay still matches the cells');
  // targets and steppers
  ok(await p.evaluate(() => { const h = document.querySelector('#ov .gb .rh').getBoundingClientRect(); return h.width >= 44 && h.height >= 44 && document.querySelector('#lay-g').getBoundingClientRect().height >= 44; }), 'grid: resize handle and layout switch are 44px targets');
  await p.evaluate(() => { openIds.add('care'); drawList(); });
  ok(await p.evaluate(() => [...document.querySelectorAll('#list [data-place]')].filter((x) => x.offsetParent).every((x) => x.getBoundingClientRect().height >= 44 && x.getBoundingClientRect().width >= 44)), 'grid: placement steppers are 44px targets');
  await p.click('#list li[data-uid="care"] [data-place="care/row"][data-d="1"]');
  ok((await st()).b.care.row === 6 && (await p.textContent('#toast')).includes('overlap'), 'grid: the steppers follow the same rules (care cannot move down onto the writing space)');
  // adding and switching on
  await p.evaluate(() => { history = []; layout = normalize(null); drawList(); drawPalette(); drawPreview(); });
  await p.click('#lay-g');
  await p.locator('#pal [data-add="t:checks"]').click();
  ok((await p.textContent('#toast')).includes('No room') && (await st()).b[(await p.evaluate(() => layout.blocks.find((x) => x.type === 'checks').uid))].on === false, 'grid: adding to a full page adds the block switched off and says so');
  await p.click('#lay-f');
  ok(await p.evaluate(() => !layout.grid && !document.querySelector('#pv .gc')), 'grid: Flow switches back');
  await p.click('#undo');
  ok(await p.evaluate(() => layout.grid && !!document.querySelector('#pv .gc')), 'grid: undo brings the grid back');
  // a busy layout of spans on both trims
  const SPANS = () => { const P = (type, uid, o, col, row, colSpan, rowSpan) => ({ ...newBlock(type, o, uid), col, row, colSpan, rowSpan });
    return { v: 2, grid: true, blocks: [P('sky', 'sky', {}, 1, 1, 4, 2), P('notes', 'notes', {}, 1, 3, 4, 1), P('events', 'events', {}, 1, 4, 4, 2), P('care', 'care', {}, 1, 6, 4, 4), P('spoons', 'spoons', { count: 8 }, 1, 10, 2, 2), P('fact', 'fact', {}, 3, 10, 2, 3), P('scale', 'scale', { title: 'Energy' }, 1, 12, 2, 1),
      P('actions', 'actions', {}, 1, 13, 2, 4), P('lines', 'lines', { title: 'Notes', n: 3 }, 3, 13, 2, 4), P('body', 'body', {}, 1, 17, 4, 8)] }; };
  for (const sz of ['small', 'letter']) {
    await p.evaluate((z) => setSize(z), sz);
    await p.evaluate((src) => { layout = normalize(eval('(' + src + ')')(), size); drawList(); drawPalette(); drawPreview(); }, SPANS.toString());
    ok((await st()).probs.length === 0 && await p.evaluate(() => !document.querySelector('#problems') || document.querySelector('#problems').hidden), `grid (${sz}): a layout of spans has no problems`);
    ok(await same(), `grid (${sz}): overlay boxes match the block cells`);
    ok(await p.evaluate(() => { const g = pv.querySelector('.gg'); return [...pv.querySelectorAll('.gc')].every((c) => c.scrollHeight <= c.clientHeight + 1 && c.scrollWidth <= c.clientWidth + 1) && g.scrollHeight <= g.clientHeight + 1; }), `grid (${sz}): every block fits its cell`);
    await p.evaluate(() => select('lines')); await p.waitForTimeout(100);
    await p.locator('.paper').screenshot({ path: `${OUT}/grid-spans-${sz}.png` });
  }
  await p.evaluate(() => setSize('small'));
  // every block type, and every option that changes its size, fits inside its own minimum span (both trims): the minimums are a floor the content fits in
  {
    const cases = JSON.parse(fs.readFileSync(new URL('./grid-cases.json', import.meta.url)));
    for (const sz of ['small', 'letter']) {
      await p.evaluate((z) => setSize(z), sz);
      const bad = await p.evaluate((extra) => {
        const items = paletteItems().map((i) => ({ name: i.name, type: i.type, opts: i.preset ? i.preset.opts : {} })).concat(extra), out = [];
        for (const it of items) {
          const b = newBlock(it.type, it.opts, 'zz'), c0 = minSpan(b).cols; if (minSpan(b, c0).rows > 20) continue; // taller than the page: nothing to place
          for (const w of [...new Set([c0, GRIDS.day.cols])]) {
            const m = minSpan(b, w), rows = Math.max(1, m.rows);
            layout = normalize({ v: 2, grid: true, blocks: [{ ...b, col: 1, row: 1, colSpan: w, rowSpan: rows }, { type: 'body', uid: 'body', col: 1, row: 20, colSpan: 4, rowSpan: 5 }] }, size);
            drawPreview();
            const g = pv.querySelector('.gc[data-b="zz"]'); if (!g) { if (!['notes', 'events', 'fact'].includes(it.type)) out.push(`${it.name}: not drawn`); continue; }
            if (g.scrollHeight > g.clientHeight + 1 || (g.scrollWidth > g.clientWidth + 1 && it.type !== 'feelings')) out.push(`${it.name} at ${w} cols x ${rows} rows: needs ${(g.scrollHeight / 96 / 0.22).toFixed(2)} rows, ${Math.ceil(g.scrollWidth)}px wide in ${Math.floor(g.clientWidth)}px`);
          }
        }
        return out;
      }, cases);
      ok(bad.length === 0, `grid (${sz}): every block type and option variant fits its minimum span` + (bad.length ? ': ' + bad.slice(0, 12).join(' | ') : ''));
    }
    await p.evaluate(() => setSize('small'));
  }
  // phone: the grid preview and steppers, no sideways scroll, 44px targets
  {
    const ph = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    ph.on('pageerror', (e) => errs.push('phone grid: ' + e.message));
    await ph.goto(DAY, { waitUntil: 'networkidle' }); await atDay(ph);
    await ph.click('#lay-g');
    ok(await ph.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'grid phone: no sideways scroll (Blocks tab)');
    await ph.waitForTimeout(150); // the page is always in view above the sheet
    ok(await ph.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.querySelectorAll('#ov .gb').length >= 7 && M && M.cw > 20), 'grid phone: the preview shows the grid and boxes, no sideways scroll');
    ok(await ph.evaluate(() => { const r = document.querySelector('#ov .gb .rh').getBoundingClientRect(); return r.width >= 44 && r.height >= 44; }), 'grid phone: the resize handle is a 44px target');
    await ph.screenshot({ path: `${OUT}/grid-phone-preview.png` });
    await ph.click('.tabs [data-tab="edit"]');
    await ph.evaluate(() => { openIds.add('events'); drawList(); });
    ok(await ph.evaluate(() => document.documentElement.scrollWidth <= innerWidth && [...document.querySelectorAll('#list [data-place]')].filter((x) => x.offsetParent).every((x) => x.getBoundingClientRect().height >= 44)), 'grid phone: placement steppers fit at 390px with 44px buttons');
    await ph.screenshot({ path: `${OUT}/grid-phone-edit.png` });
    await ph.close();
  }
  await p.locator('.paper').screenshot({ path: `${OUT}/grid-last.png` });
  await p.screenshot({ path: `${OUT}/grid-desktop.png` });
  await p.evaluate(() => { history = []; layout = normalize(null); drawList(); drawPalette(); drawPreview(); });
}
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

// ---------- Book view: the canvas (whole book and spread levels) ----------
{
  const S = JSON.parse(fs.readFileSync(new URL('./dist/site/pages-sample.json', import.meta.url)));
  const N = S.pages.length, bp = await b.newPage({ viewport: { width: 1400, height: 900 } });
  bp.on('pageerror', (e) => errs.push('book: ' + e.message));
  const t0 = Date.now(); await bp.goto(URL0, { waitUntil: 'networkidle' });
  ok(await bp.evaluate(() => document.documentElement.dataset.view === 'book' && NAV.level === 'book' && location.hash === '#book' && !!document.querySelector('#main') && getComputedStyle(document.querySelector('#main')).display === 'none'), 'the editor opens on the Book view (#book), not the day editor');
  await bp.waitForFunction(() => BK.ready && BK.painted.size >= 60 && BK.queue.size === 0, null, { timeout: 15000 }); const paintMs = Date.now() - t0; await bp.waitForTimeout(300);
  ok(paintMs < 8000, `the whole book (${N} thumbnails) is drawn in ${paintMs} ms`);
  ok(await bp.evaluate(() => getComputedStyle(document.querySelector('#main')).display === 'none' && getComputedStyle(document.querySelector('#book')).display !== 'none'), 'the Book view shows the canvas and hides the day editor');
  ok((await bp.locator('#bk-world .bpg[data-n]').count()) === N, `renders all ${N} pages of the sample book as slots`);
  ok(await bp.evaluate(() => [...document.querySelectorAll('#bk-world .bpg[data-n]')].every((e) => e.querySelector('.cap b').textContent === e.dataset.n && e.dataset.id && e.querySelector('.cid').textContent === e.dataset.id)), 'every page shows its number and id');
  // spreads as the book opens: title alone on the right, then verso|recto, the last even page alone on the left
  const sp = await bp.evaluate(() => [...document.querySelectorAll('#bk-world .sp[data-spread]')].map((e) => [+e.dataset.left, +e.dataset.right]));
  ok(sp.length === N / 2 + 1 && sp[0][0] === 0 && sp[0][1] === 1, 'the first spread is page 1 alone, on the right');
  ok(sp.slice(1, -1).every(([l, r]) => l % 2 === 0 && r === l + 1), 'every inner spread pairs an even left page with the odd page after it');
  ok(sp[sp.length - 1][0] === N && sp[sp.length - 1][1] === 0, 'the last (even) page is alone on the left');
  ok(await bp.evaluate(() => [...document.querySelectorAll('#bk-world .sp[data-spread]')].every((s) => { const l = s.querySelector('.bpg.l'), r = s.querySelector('.bpg.r'); return (!l || +l.dataset.n % 2 === 0) && (!r || +r.dataset.n % 2 === 1); })), 'left slots hold even pages, right slots hold odd pages');
  ok(await bp.evaluate(() => { const r = document.querySelector('.bpg[data-n="2"]').getBoundingClientRect(), q = document.querySelector('.bpg[data-n="3"]').getBoundingClientRect(); return Math.abs(r.right - q.left) < 1 && Math.abs(r.top - q.top) < 1; }), 'a spread\'s two pages touch at the spine');
  // page thumbnails are the real pages
  await bp.waitForFunction(() => BK.painted.size > 0 && BK.queue.size === 0);
  ok(await bp.evaluate(() => document.querySelectorAll('.bpg[data-n="1"] .page.recto .title h1').length === 1 && document.querySelector('.bpg[data-n="2"] .page').classList.contains('verso')), 'thumbnails are drawn from the shared page functions (title page, verso/recto classes)');
  ok(await bp.evaluate(() => document.querySelector('.bpg[data-n="1"]').getBoundingClientRect().height > 40), 'whole book fits the view');
  await bp.screenshot({ path: `${OUT}/book-whole.png` });
  // zoom levels
  const z = () => bp.evaluate(() => BK.z), lvl = () => bp.evaluate(() => BK.level);
  ok((await lvl()) === 'book', 'opens at the whole book');
  const zb = await z();
  await bp.click('[data-nav-level="spread"]'); await bp.waitForTimeout(500); const zs = await z();
  ok((await bp.getAttribute('[data-nav-level="spread"]', 'aria-pressed')) === 'true' && (await bp.getAttribute('[data-nav-level="book"]', 'aria-pressed')) === 'false', 'the level buttons say which level is open');
  await bp.evaluate(() => bkLevel('page', false)); await bp.waitForTimeout(300); const zp = await z();
  ok(zb < zs && zs <= zp && (await lvl()) === 'page', `three zoom stops: whole book ${zb.toFixed(2)} < spread ${zs.toFixed(2)} <= one page ${zp.toFixed(2)}`);
  await bp.waitForTimeout(400);
  ok(await bp.evaluate(() => { const r = document.querySelector('#bk-view').getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, q = [...document.querySelectorAll('.bpg[data-n]')].map((e) => e.getBoundingClientRect()).find((e) => e.left <= cx && e.right >= cx && e.top <= cy && e.bottom >= cy); return !!q && q.left >= r.left - 2 && q.right <= r.right + 2 && q.top >= r.top - 2 && q.bottom <= r.bottom + 2 && q.height > r.height * 0.7; }), 'page level: one whole page fills the view');
  // virtualised: at page level far pages hold no DOM
  const pc = await bp.evaluate(() => ({ painted: BK.painted.size, real: document.querySelectorAll('#bk-world .bpg .page').length }));
  ok(pc.real === pc.painted && pc.painted < N / 2, `lazy: only ${pc.painted} of ${N} pages hold thumbnails at page level`);
  await bp.click('#bk-out'); await bp.waitForTimeout(400); const zo = await z();
  await bp.click('#bk-in'); await bp.waitForTimeout(400); const zi = await z();
  ok(zo < zp && zi > zo, 'zoom buttons');
  await bp.click('[data-nav-level="book"]'); await bp.waitForTimeout(500);
  await bp.evaluate(() => document.querySelector('#bk-view').focus());
  const z0 = await z(); await bp.keyboard.press('+'); await bp.waitForTimeout(400); const z1 = await z(); await bp.keyboard.press('-'); await bp.keyboard.press('-'); await bp.waitForTimeout(400); const z2 = await z();
  ok(z1 > z0 && z2 < z1, 'keyboard: + and - zoom');
  await bp.keyboard.press('1'); await bp.waitForTimeout(500); const k1 = await bp.evaluate(() => NAV.level); await bp.keyboard.press('0'); await bp.waitForTimeout(500);
  ok(k1 === 'spread' && (await lvl()) === 'book' && (await bp.evaluate(() => NAV.level)) === 'book', 'keyboard: 1 spread, 0 whole book');
  await bp.keyboard.press('+'); await bp.waitForTimeout(400); const px0 = await bp.evaluate(() => BK.x); await bp.keyboard.press('ArrowLeft'); const px1 = await bp.evaluate(() => BK.x);
  ok(px1 > px0, 'keyboard: arrows pan');
  await bp.click('[data-nav-level="book"]'); await bp.waitForTimeout(500);
  const w0 = await z(); await bp.mouse.move(700, 500); await bp.mouse.wheel(0, -300); await bp.waitForTimeout(150); const w1 = await z(); await bp.mouse.wheel(0, 300); await bp.waitForTimeout(150);
  ok(w1 > w0, 'mouse wheel zooms at the pointer');
  await bp.click('[data-nav-level="spread"]'); await bp.waitForTimeout(500);
  const d0 = await bp.evaluate(() => [BK.x, BK.y]); await bp.mouse.move(700, 500); await bp.mouse.down(); await bp.mouse.move(730, 520, { steps: 4 }); await bp.mouse.up(); const d1 = await bp.evaluate(() => [BK.x, BK.y]);
  ok(d1[0] > d0[0] && d1[1] > d0[1], 'dragging pans');
  ok(await bp.evaluate(() => { const c = document.querySelector('#bk-view'), mk = (t, id, x, y) => c.dispatchEvent(new PointerEvent(t, { pointerId: id, clientX: x, clientY: y, bubbles: true, pointerType: 'touch' })); bkLevel('book', false); const z0 = BK.z;
    mk('pointerdown', 11, 500, 400); mk('pointerdown', 12, 600, 400); mk('pointermove', 12, 700, 400); mk('pointermove', 11, 450, 400); mk('pointerup', 11, 450, 400); mk('pointerup', 12, 700, 400); return BK.z > z0 * 1.5; }), 'pinch zooms');
  await bp.click('[data-nav-level="book"]'); await bp.waitForTimeout(500);
  // select + jump
  const jump = async (q) => { await bp.fill('#bk-go', q); await bp.press('#bk-go', 'Enter'); await bp.waitForTimeout(700); return bp.evaluate(() => ({ sel: BK.sel, msg: document.querySelector('#bk-msg').textContent, bad: document.querySelector('#bk-msg').className === 'bad' })); };
  const inView = () => bp.evaluate(() => { const r = document.querySelector('#bk-view').getBoundingClientRect(), q = document.querySelector('.bpg.sel').getBoundingClientRect(); return q.left >= r.left - 2 && q.right <= r.right + 2 && q.top >= r.top - 2 && q.bottom <= r.bottom + 2 && q.width > 40; });
  let j = await jump('30'); ok(j.sel === 30 && (await inView()), 'jump by number brings the page into view and selects it');
  ok(await bp.evaluate(() => document.querySelector('#bk-info').textContent.includes('Page 30') && document.querySelector('#bk-info').textContent.includes(BK.pages[29].id)), 'the info line shows the selected page number and id');
  const idOf = (id) => S.pages.find((x) => x.id === id).n;
  j = await jump('safety'); ok(j.sel === idOf('safety') && (await inView()), 'jump by id (safety)');
  j = await jump('week.03.review'); ok(j.sel === idOf('week.03.review'), 'jump by id (week.03.review)');
  j = await jump('2026-10-05'); ok(j.sel === idOf('day.2026-10-05'), 'jump by date');
  j = await jump('p12'); ok(j.sel === 12, 'jump by p12');
  const before = j.sel; j = await jump('999'); ok(j.sel === before && j.bad && /no page 999/i.test(j.msg), 'a page that does not exist gets a clear message');
  j = await jump('zzz'); ok(j.bad && j.sel === before, 'an id that matches nothing gets a clear message');
  await bp.evaluate(() => document.querySelector('#bk-view').focus()); await bp.keyboard.press('Home'); await bp.keyboard.press(']'); await bp.waitForTimeout(400);
  ok((await bp.evaluate(() => BK.sel)) === 2, 'keyboard: ] goes to the next page');
  // protected pages
  ok(await bp.evaluate(() => ['closing', 'support', 'safety'].every((id) => document.querySelector(`.bpg[data-id="${id}"] .cap svg`)) && document.querySelectorAll('.bpg[data-n] .cap svg').length === 3), 'protected pages (closing, support, safety) carry the lock, and only they do');
  await bp.click('#bk-leg'); ok(await bp.evaluate(() => !document.querySelector('#bk-legend').hidden && document.querySelector('#bk-legend').textContent.includes('Protected page') && document.querySelector('#bk-legend').textContent.includes('Hidden page')), 'legend explains protected and hidden pages');
  await bp.click('#bk-leg');
  // sizes
  const w5 = await bp.evaluate(() => document.querySelector('.bpg[data-n="4"]').offsetWidth); await bp.click('#sz-l'); await bp.waitForTimeout(500);
  const w8 = await bp.evaluate(() => document.querySelector('.bpg[data-n="4"]').offsetWidth);
  ok(w8 > w5 && (await bp.locator('#bk-world .bpg[data-n]').count()) === N && (await bp.evaluate(() => BK.sel)) === 2, `8.5x11 reflows the same ${N} pages wider (${w5} to ${w8})`);
  await bp.screenshot({ path: `${OUT}/book-letter.png` }); await bp.click('#sz-s'); await bp.waitForTimeout(300);
  // hidden pages show dimmed
  const hidden = await bp.evaluate(() => { BK.hidden = [{ ...BK.pages[20], id: 'lineage' }, { ...BK.pages[3], id: 'key' }]; BK.cols = bkPickCols(); bkBuild(); bkLevel('book', false); return document.querySelectorAll('.bpg.hid').length; });
  await bp.waitForTimeout(500);
  ok(hidden === 2 && (await bp.evaluate(() => +getComputedStyle(document.querySelector('.bpg.hid .ph')).opacity < 0.6 && !!document.querySelector('.bpg.hid .cap svg') && document.querySelectorAll('.bpg[data-n]').length === BK.pages.length)), 'hidden pages are shown dimmed in their own row, with the eye-off mark');
  await bp.screenshot({ path: `${OUT}/book-hidden.png` });
  await bp.close();
  // hidden pages come from book.json: the sample builder lists pages a book turns off
  const { samplePages } = await import('./samples.mjs'), { DEFAULT_BOOK } = await import('../book.mjs');
  const bk2 = structuredClone(DEFAULT_BOOK); bk2.default.find((e) => e.id === 'lineage').on = false; bk2.default.find((e) => e.id === 'weeks').options.week.find((e) => e.id === 'week_review').on = false;
  const S2 = await samplePages('2026-10', bk2);
  ok(S2.hidden.map((x) => x.id).sort().join() === 'lineage,week.01.review' && !S2.pages.some((x) => x.id === 'lineage') && S2.pages.length % 2 === 0, 'a book that hides pages lists them apart (lineage, a week review); the rest still spreads evenly');
  ok(S.hidden.length === 0, 'the default book hides nothing');
  // ---------- book-first navigation (C4a): book -> spread -> day is one continuous zoom ----------
  {
    const nP = await b.newPage({ viewport: { width: 1400, height: 900 } });
    nP.on('pageerror', (e) => errs.push('nav: ' + e.message));
    const goHash = async (h) => { await nP.goto('about:blank'); await nP.goto(URL0 + h, { waitUntil: 'networkidle' }); await nP.waitForFunction(() => window.KW && (BK.loaded || document.documentElement.dataset.view === 'day')); await nP.waitForTimeout(600); };
    const st = () => nP.evaluate(() => ({ level: NAV.level, view: document.documentElement.dataset.view, hash: location.hash, crumbs: [...document.querySelectorAll('#crumb-list li')].map((x) => x.textContent.trim()).join(' > '), main: getComputedStyle(document.querySelector('#main')).display, pv: getComputedStyle(document.querySelector('#pageview')).display, back: document.querySelector('#nv-back').disabled }));
    const waitView = (v) => nP.waitForFunction((x) => document.documentElement.dataset.view === x && !NAV.busy(), v, { timeout: 8000 });
    const dayN = S.pages.find((x) => x.id === 'day.2026-10-14').n, safeN = S.pages.find((x) => x.id === 'safety').n, sp = (n) => Math.floor(n / 2) + 1;
    await goHash('');
    let r = await st();
    ok(r.view === 'book' && r.level === 'book' && r.hash === '#book' && r.crumbs === 'Book' && r.back && r.main === 'none', 'default view: the Book, #book in the URL, breadcrumb "Book", Back disabled');
    ok(await nP.evaluate(() => !document.querySelector('#v-day') && !document.querySelector('[aria-label="View"]') && ![...document.querySelectorAll('.top button')].some((x) => x.textContent.trim() === 'Day' && x.closest('.seg'))), 'the Day tab is gone as a top-level tab');
    ok(await nP.evaluate(() => !!document.querySelector('.top #v-ver') && typeof KW.on === 'function' && typeof KW.go === 'function'), 'the Versions button sits in the header, and KW.on / KW.go are the hooks for panels');
    await nP.screenshot({ path: `${OUT}/nav-desktop-1-book.png` });
    // tap: book -> spread -> day
    await nP.click(`.bpg[data-n="${dayN}"]`); await nP.waitForFunction(() => NAV.level === 'spread' && BK.level !== 'book'); await nP.waitForTimeout(1000);
    r = await st();
    ok(r.level === 'spread' && r.hash === `#spread/${sp(dayN)}` && r.crumbs === `Book > Spread ${sp(dayN)}` && !r.back, `tap a page: zooms to its spread (${r.hash}, "${r.crumbs}")`);
    ok(await nP.evaluate((n) => { const q = document.querySelector(`.bpg[data-n="${n}"]`).getBoundingClientRect(), v = document.querySelector('#bk-view').getBoundingClientRect(); window.__d = [q.left, q.right, q.width, v.left, v.right, BK.z]; return q.width > 200 && q.left >= v.left - 2 && q.right <= v.right + 2; }, dayN), 'the spread level shows the two pages large enough to read, live thumbnails ' + JSON.stringify(await nP.evaluate(() => window.__d)));
    ok(await nP.evaluate(() => document.querySelector('[data-nav-level="spread"]').getAttribute('aria-pressed') === 'true'), 'the Spread level button is pressed');
    await nP.screenshot({ path: `${OUT}/nav-desktop-2-spread.png` });
    await nP.click(`.bpg[data-n="${dayN}"]`); await waitView('day'); await nP.waitForTimeout(400);
    r = await st();
    ok(r.level === 'day' && r.hash === '#day/2026-10-14' && r.crumbs === `Book > Spread ${sp(dayN)} > Day Oct 14` && r.main !== 'none' && r.pv === 'none', `tap again: the day-page editor (${r.hash}, "${r.crumbs}")`);
    ok(await nP.evaluate(() => document.querySelectorAll('#pv [data-b]').length >= 3 && document.querySelectorAll('#pv .lines .rule').length > 0 && document.documentElement.dataset.mode === 'view' && document.querySelectorAll('#pal li, #list > li').length === 0), 'the day level opens for viewing: the page with its rules, no palette or block list');
    await nP.screenshot({ path: `${OUT}/nav-desktop-3-day.png` });
    await nP.click('#edit'); await nP.waitForFunction(() => document.documentElement.dataset.mode === 'edit'); await nP.waitForTimeout(200);
    ok(await nP.evaluate(() => location.hash === '#day/2026-10-14/edit' && document.querySelectorAll('#pal li.pi').length > 20 && document.querySelectorAll('#list > li').length >= 5 && !document.querySelector('#meter').textContent.includes('Too full')), 'Edit opens the full editor: palette, block list, meter (#day/2026-10-14/edit)');
    // the editor still edits from here, and the change survives leaving edit mode and going up and coming back
    await nP.evaluate(() => { history = []; }); await nP.locator('#pal [data-add="t:checks"]').click();
    ok(await nP.evaluate(() => layout.blocks.some((x) => x.type === 'checks')), 'the day level edits (add a block)');
    await nP.click('#done'); await nP.waitForFunction(() => document.documentElement.dataset.mode === 'view'); await nP.waitForTimeout(200);
    ok(await nP.evaluate(() => location.hash === '#day/2026-10-14' && !!document.querySelector('#pv [data-zone="checks"]')), 'Done returns to viewing with the edit kept in the page');
    // Back / forward
    await nP.click('#nv-back'); await waitView('book'); await nP.waitForTimeout(600);
    r = await st(); ok(r.level === 'spread' && r.hash === `#spread/${sp(dayN)}` && r.crumbs === `Book > Spread ${sp(dayN)}`, 'Back from the day returns to the spread');
    ok(await nP.evaluate((n) => BK.sel === n && BK.level !== 'book', dayN), 'coming back keeps the page selected and the spread zoomed');
    await nP.goForward(); await waitView('day'); r = await st(); ok(r.level === 'day' && r.hash === '#day/2026-10-14', 'browser forward goes back into the day');
    ok(await nP.evaluate(() => layout.blocks.some((x) => x.type === 'checks')), 'the day editor kept its unsaved change while you moved around the book');
    await nP.goBack(); await waitView('book'); await nP.waitForTimeout(500);
    await nP.click('#nv-back'); await nP.waitForFunction(() => NAV.level === 'book'); await nP.waitForTimeout(500);
    r = await st(); ok(r.level === 'book' && r.hash === '#book' && r.back, 'Back again returns to the whole book (and Back is then disabled)');
    // breadcrumb
    await nP.evaluate((n) => KW.go({ level: 'day', n }), dayN); await waitView('day');
    await nP.click('#crumb-list [data-crumb="1"]'); await waitView('book'); await nP.waitForTimeout(500);
    r = await st(); ok(r.level === 'spread' && r.hash === `#spread/${sp(dayN)}`, 'breadcrumb: the Spread crumb goes up one level');
    await nP.click('#crumb-list [data-crumb="0"]'); await nP.waitForFunction(() => NAV.level === 'book'); await nP.waitForTimeout(500);
    r = await st(); ok(r.level === 'book' && r.crumbs === 'Book', 'breadcrumb: the Book crumb goes to the whole book');
    ok(await nP.evaluate(() => [...document.querySelectorAll('#crumb-list button')].every((x) => x.getBoundingClientRect().height >= 43.5) && document.querySelector('#nv-back').getBoundingClientRect().height >= 43.5), 'breadcrumb and Back are 44px targets');
    // level buttons
    await nP.click('[data-nav-level="spread"]'); await nP.waitForFunction(() => NAV.level === 'spread'); await nP.click('[data-nav-level="day"]'); await waitView('day');
    ok((await st()).level === 'day', 'level buttons: Spread then Day');
    await nP.click('[data-nav-level="book"]'); await nP.waitForFunction(() => NAV.level === 'book' && document.documentElement.dataset.view === 'book'); ok((await st()).hash === '#book', 'level button: Book');
    // keyboard
    await nP.evaluate(() => document.querySelector('#bk-view').focus()); await nP.keyboard.press('Enter'); await nP.waitForFunction(() => NAV.level === 'spread');
    await nP.keyboard.press('Enter'); await waitView('day'); r = await st(); ok(r.level === 'day', 'keyboard: Enter goes in a level (book, spread, day)');
    await nP.keyboard.press('Escape'); await waitView('book'); await nP.waitForTimeout(400); r = await st(); ok(r.level === 'spread', 'keyboard: Escape from the day goes out to the spread');
    await nP.keyboard.press('Escape'); await nP.waitForFunction(() => NAV.level === 'book'); ok(true, 'keyboard: Escape from the spread goes out to the book');
    await nP.keyboard.press('2'); await waitView('day'); await nP.keyboard.press('Alt+ArrowUp'); await waitView('book'); await nP.waitForTimeout(400);
    ok((await st()).level === 'spread', 'keyboard: 2 opens the day; Alt+Up goes out');
    await nP.keyboard.press('Alt+ArrowDown'); await waitView('day'); ok((await st()).level === 'day', 'keyboard: Alt+Down goes in');
    await nP.evaluate(() => { const i = document.createElement('input'); i.id = 'tmp-in'; document.body.appendChild(i); i.focus(); }); await nP.keyboard.press('Escape'); await nP.waitForTimeout(500);
    ok((await st()).level === 'day', 'Escape in a text field does not navigate'); await nP.evaluate(() => document.querySelector('#tmp-in').remove());
    // wheel: zoom in past a page opens the day; ctrl+wheel out over the page goes back up
    await goHash('#spread/' + sp(dayN)); await nP.evaluate((n) => bkSelect(n), dayN);
    await nP.mouse.move(700, 450); for (let i = 0; i < 6 && (await nP.evaluate(() => document.documentElement.dataset.view)) === 'book'; i++) { await nP.mouse.wheel(0, -400); await nP.waitForTimeout(120); }
    await waitView('day'); r = await st(); ok(r.level === 'day', 'wheel: zooming in past one page opens the day');
    await nP.waitForTimeout(700);
    await nP.evaluate(() => document.querySelector('#paper').dispatchEvent(new WheelEvent('wheel', { ctrlKey: true, deltaY: 120, bubbles: true, cancelable: true }))); await waitView('book'); await nP.waitForTimeout(500);
    r = await st(); ok(r.level === 'spread', 'ctrl/cmd + wheel (a trackpad pinch) over the page zooms out to the spread');
    // pinch out on a phone-style touch over the day page
    await nP.evaluate((n) => KW.go({ level: 'day', n }), dayN); await waitView('day'); await nP.waitForTimeout(700);
    await nP.evaluate(() => { const el = document.querySelector('#paper'), mk = (t, id, x, y) => el.dispatchEvent(new PointerEvent(t, { pointerId: id, clientX: x, clientY: y, bubbles: true, pointerType: 'touch' })); mk('pointerdown', 21, 1000, 400); mk('pointerdown', 22, 1200, 400); mk('pointermove', 22, 1090, 400); mk('pointermove', 21, 1060, 400); });
    await waitView('book'); await nP.waitForTimeout(400); ok((await st()).level === 'spread', 'pinching in over the day page zooms out to the spread');
    // continuous zoom updates the URL
    await nP.click('[data-nav-level="book"]'); await nP.waitForFunction(() => NAV.level === 'book'); await nP.waitForTimeout(500);
    const h0 = await nP.evaluate(() => [location.hash, window.history.length]);
    await nP.mouse.move(700, 450); for (let i = 0; i < 3; i++) { await nP.mouse.wheel(0, -350); await nP.waitForTimeout(80); } await nP.waitForTimeout(700);
    const h1 = await nP.evaluate(() => [location.hash, window.history.length, NAV.level]);
    ok(h0[0] === '#book' && /^#spread\/\d+$/.test(h1[0]) && h1[2] === 'spread' && h1[1] === h0[1] + 1, `pinch or wheel between levels updates the URL (${h0[0]} -> ${h1[0]}) and adds one history entry`);
    // double tap: all the way in
    await nP.click('[data-nav-level="book"]'); await nP.waitForFunction(() => NAV.level === 'book'); await nP.waitForTimeout(600);
    const box = await nP.locator(`.bpg[data-n="${dayN}"]`).boundingBox();
    await nP.mouse.click(box.x + box.width / 2, box.y + box.height / 2); await nP.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await waitView('day'); r = await st(); ok(r.level === 'day' && r.hash === '#day/2026-10-14', 'double-tap on a page goes straight to its day');
    // reload / deep links restore the level
    await goHash('#day/2026-10-14'); r = await st(); ok(r.level === 'day' && r.view === 'day' && r.crumbs === `Book > Spread ${sp(dayN)} > Day Oct 14` && r.main !== 'none', 'reload on #day/2026-10-14 restores the day (with its breadcrumb)');
    await goHash(`#spread/${sp(dayN)}`); r = await st();
    ok(r.level === 'spread' && r.view === 'book' && (await nP.evaluate((n) => { const q = document.querySelector(`.bpg[data-n="${n}"]`).getBoundingClientRect(), v = document.querySelector('#bk-view').getBoundingClientRect(); return q.left >= v.left - 2 && q.right <= v.right + 2 && q.width > 200; }, dayN)), `reload on #spread/${sp(dayN)} restores that spread, zoomed`);
    await goHash('#book'); r = await st(); ok(r.level === 'book' && r.view === 'book', 'reload on #book restores the whole book');
    await goHash('#spread/999'); r = await st(); ok(r.level === 'book' && r.hash === '#book', 'a spread that does not exist falls back to the book');
    await goHash('#nonsense'); r = await st(); ok(r.level === 'book', 'an unknown hash opens the book');
    // a typed hash and browser history move the level too
    await nP.evaluate(() => { location.hash = '#day/2026-10-20'; }); await waitView('day'); r = await st(); ok(r.level === 'day' && r.crumbs.endsWith('Day Oct 20'), 'editing the hash by hand changes the level');
    // a day outside the sample month still opens the editor
    await goHash('#day/2027-03-05'); r = await st(); ok(r.level === 'day' && r.view === 'day' && r.crumbs === 'Book > Day Mar 5', 'a day that is not in the sample book still opens the day editor');
    // non-day pages: read-only page view with the note
    await goHash(`#page/safety`); r = await st();
    ok(r.level === 'day' && r.view === 'page' && r.main === 'none' && r.pv !== 'none' && r.crumbs === `Book > Spread ${sp(safeN)} > My safety plan`, `a page that is not a day page opens its page view (${r.hash}, "${r.crumbs}")`);
    ok(await nP.evaluate(() => /read-only for now/.test(document.querySelector('.pgv-note').textContent) && /later step/.test(document.querySelector('.pgv-note').textContent) && document.querySelectorAll('#pgv .page').length === 1 && /safety plan/i.test(document.querySelector('#pgv').textContent)), 'the page view says editing arrives in a later step and shows the real page');
    ok(await nP.evaluate(() => document.querySelector('#pgv .page').getBoundingClientRect().width > 300 && document.querySelector('#laygrp').offsetParent === null && document.querySelector('#undo').offsetParent === null), 'the page view hides the day editor controls');
    await nP.screenshot({ path: `${OUT}/nav-desktop-4-page.png` });
    await nP.click('#nv-back'); await nP.waitForTimeout(300);
    // from the book: tap a non-day page twice
    await goHash(''); await nP.click(`.bpg[data-n="${safeN}"]`); await nP.waitForFunction(() => NAV.level === 'spread'); await nP.waitForTimeout(600); await nP.click(`.bpg[data-n="${safeN}"]`); await waitView('page');
    r = await st(); ok(r.hash === '#page/safety', 'tapping a non-day page twice opens its page view (#page/safety)');
    await nP.keyboard.press('Escape'); await waitView('book'); ok((await st()).level === 'spread', 'Escape leaves the page view');
    // Versions mount is reachable from every level
    const vers = [];
    for (const h of ['#book', `#spread/${sp(dayN)}`, '#day/2026-10-14', '#page/safety']) {
      await goHash(h);
      await nP.click('#v-ver'); await nP.waitForSelector('#versions[open]'); vers.push(await nP.evaluate(() => ({ level: KW.level }))); await nP.click('#vs-close'); await nP.waitForFunction(() => !document.querySelector('#versions[open]'));
    }
    ok(vers.map((v) => v.level).join() === 'book,spread,day,day', 'Versions opens and closes at every level (book, spread, day, page view); KW reports the level');
    ok(await nP.evaluate(async () => { const got = []; KW.on((d) => got.push(d.level)); await KW.go({ level: 'book' }, { push: false, anim: false }); return got.includes('book'); }), 'KW.on hears level changes');
    // accessibility: live region, focus, keyboard reach, reduced motion
    await goHash('#book');
    await nP.evaluate((n) => KW.go({ level: 'day', n }), dayN); await waitView('day');
    ok(await nP.evaluate(() => /Now at: Book, Spread \d+, Day Oct 14\. Day page, viewing/.test(document.querySelector('#nav-live').textContent) && document.querySelector('#nav-live').getAttribute('aria-live') === 'polite'), 'a live region announces the current level');
    ok(await nP.evaluate(() => !!(document.activeElement && document.activeElement.closest('#crumbs') && document.querySelector('nav#crumbs').getAttribute('aria-label') === 'Breadcrumb' && document.querySelector('#crumb-list [aria-current="page"]'))), 'focus lands on the current crumb; the breadcrumb is a labelled nav with aria-current');
    await nP.keyboard.press('Shift+Tab');
    ok(await nP.evaluate(() => { const e = document.activeElement; return !!e && e.matches('button') && getComputedStyle(e).outlineStyle !== 'none'; }), 'keyboard focus is visible on the navigation controls');
    ok(await nP.evaluate(() => [...document.querySelectorAll('.top [data-nav-level], #nv-back, #crumb-list button')].every((x) => x.tagName === 'BUTTON' && (x.getAttribute('aria-label') || x.textContent.trim()))), 'every navigation control is a labelled button');
    const rm = await b.newPage({ viewport: { width: 1200, height: 800 }, reducedMotion: 'reduce' });
    await rm.goto(URL0, { waitUntil: 'networkidle' }); await rm.waitForFunction(() => BK.ready); await rm.waitForTimeout(400);
    await rm.evaluate((n) => KW.go({ level: 'spread', n }), dayN); await rm.waitForTimeout(50);
    ok(await rm.evaluate(() => !document.querySelector('#bk-view').classList.contains('anim') && BK.level !== 'book'), 'reduced motion: the zoom between levels is instant');
    const t1 = Date.now(); await rm.evaluate((n) => KW.go({ level: 'day', n }), dayN); await rm.waitForFunction(() => document.documentElement.dataset.view === 'day'); ok(Date.now() - t1 < 200, 'reduced motion: the day opens with no zoom animation');
    await rm.close();
    ok(await nP.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no sideways scroll on desktop');
    await nP.close();
  }
  // phone: every level, no sideways scroll, 44px targets, a header that leaves room for the page
  const dayN = S.pages.find((x) => x.id === 'day.2026-10-14').n, spN = (n) => Math.floor(n / 2) + 1;
  const ph = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  ph.on('pageerror', (e) => errs.push('book phone: ' + e.message));
  const noScroll = () => ph.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.body.scrollWidth <= innerWidth);
  const tiny = () => ph.evaluate(() => [...document.querySelectorAll('.top button, #book button, #book input, #pageview button')].filter((x) => x.offsetParent && (x.getBoundingClientRect().height < 43.5 || x.getBoundingClientRect().width < 43.5)).map((x) => x.id || x.dataset.navLevel || x.dataset.tab || x.textContent.trim().slice(0, 12) || x.tagName));
  const fitCrumbs = () => ph.evaluate(() => { const c = document.querySelector('#crumbs').getBoundingClientRect(), l = document.querySelector('#crumb-list'); return l.scrollWidth <= c.width + 1 && c.right <= innerWidth; });
  await ph.goto(URL0, { waitUntil: 'networkidle' }); await ph.waitForFunction(() => BK.ready); await ph.waitForTimeout(700);
  ok(await noScroll(), 'Book level: no sideways scroll at 390px');
  ok((await tiny()).length === 0, 'Book level: 44px targets on a phone ' + (await tiny()).join(','));
  await ph.screenshot({ path: `${OUT}/book-phone-whole.png` });
  await ph.fill('#bk-go', '15'); await ph.press('#bk-go', 'Enter'); await ph.waitForTimeout(700);
  await ph.screenshot({ path: `${OUT}/book-phone-jump.png` });
  await ph.click('#bk-leg'); await ph.screenshot({ path: `${OUT}/book-phone-legend.png` }); await ph.click('#bk-leg');
  await ph.evaluate(() => KW.go({ level: 'book' }, { anim: false })); await ph.waitForTimeout(500);
  await ph.tap(`.bpg[data-id="day.2026-10-14"]`); await ph.waitForFunction(() => NAV.level === 'spread'); await ph.waitForTimeout(700);
  ok(await noScroll() && (await fitCrumbs()) && (await tiny()).length === 0, 'Spread level: no sideways scroll, breadcrumb fits, 44px targets');
  ok((await ph.evaluate(() => location.hash)) === `#spread/${spN(dayN)}`, 'a tap on a phone zooms to the spread');
  await ph.screenshot({ path: `${OUT}/nav-phone-2-spread.png` });
  await ph.tap(`.bpg[data-id="day.2026-10-14"]`); await ph.waitForFunction(() => document.documentElement.dataset.view === 'day'); await ph.waitForTimeout(500);
  ok(await noScroll() && (await fitCrumbs()) && (await tiny()).length === 0, 'Day level: no sideways scroll, breadcrumb fits, 44px targets ' + (await tiny()).join(','));
  const hh = await ph.evaluate(() => document.querySelector('.top').getBoundingClientRect().height); ok(hh < 270, `Day level: the header leaves room to work (${hh.toFixed(0)} of 844 px)`);
  await ph.screenshot({ path: `${OUT}/nav-phone-3-day-view.png` });
  await ph.click('#edit'); await ph.waitForFunction(() => document.documentElement.dataset.mode === 'edit'); await ph.waitForTimeout(300);
  ok(await noScroll() && (await fitCrumbs()) && (await tiny()).length === 0, 'Day level, editing: no sideways scroll, 44px targets ' + (await tiny()).join(','));
  await ph.screenshot({ path: `${OUT}/nav-phone-3-day.png` });
  await ph.click('.tabs [data-tab="add"]'); await ph.screenshot({ path: `${OUT}/nav-phone-3-day-add.png` });
  ok(await noScroll(), 'Day level tabs: no sideways scroll');
  await ph.click('#done'); await ph.waitForFunction(() => document.documentElement.dataset.mode === 'view'); await ph.waitForTimeout(200);
  await ph.click('#nv-back'); await ph.waitForFunction(() => document.documentElement.dataset.view === 'book'); await ph.waitForTimeout(600);
  ok((await ph.evaluate(() => NAV.level)) === 'spread', 'Back on a phone returns to the spread');
  await ph.click('#crumb-list [data-crumb="0"]'); await ph.waitForFunction(() => NAV.level === 'book'); await ph.waitForTimeout(400);
  await ph.evaluate(() => KW.go({ level: 'day', id: 'safety' })); await ph.waitForFunction(() => document.documentElement.dataset.view === 'page'); await ph.waitForTimeout(400);
  ok(await noScroll() && (await fitCrumbs()) && (await tiny()).length === 0, 'Page view: no sideways scroll, breadcrumb fits, 44px targets');
  await ph.screenshot({ path: `${OUT}/nav-phone-4-page.png` });
  await ph.close();
  // dark mode: every level
  const dk = await b.newPage({ viewport: { width: 1200, height: 800 }, colorScheme: 'dark' });
  await dk.goto(URL0, { waitUntil: 'networkidle' }); await dk.waitForFunction(() => BK.ready); await dk.waitForTimeout(500);
  await dk.screenshot({ path: `${OUT}/book-dark-whole.png` });
  await dk.click('[data-nav-level="spread"]'); await dk.waitForTimeout(700); await dk.screenshot({ path: `${OUT}/book-dark.png` });
  await dk.evaluate(() => KW.go({ level: 'day', date: '2026-10-14' })); await dk.waitForFunction(() => document.documentElement.dataset.view === 'day'); await dk.waitForTimeout(500); await dk.screenshot({ path: `${OUT}/nav-dark-day.png` });
  await dk.evaluate(() => KW.go({ level: 'day', id: 'safety' })); await dk.waitForFunction(() => document.documentElement.dataset.view === 'page'); await dk.waitForTimeout(400); await dk.screenshot({ path: `${OUT}/nav-dark-page.png` });
  ok(await dk.evaluate(() => getComputedStyle(document.body).backgroundColor !== 'rgb(244, 241, 234)'), 'dark mode follows the system at every level'); await dk.close();
  // the Artifact build carries the sample book inside the page (no fetch) and opens on the Book too
  const art = fs.readFileSync(new URL('./dist/artifact.html', import.meta.url), 'utf8');
  const ap = await b.newPage({ viewport: { width: 1200, height: 800 } });
  ap.on('pageerror', (e) => errs.push('artifact: ' + e.message));
  await ap.setContent('<!doctype html><html lang="en"><head><meta charset="utf-8">' + art + '</html>', { waitUntil: 'load' });
  await ap.waitForFunction(() => typeof BK !== 'undefined' && BK.ready, null, { timeout: 8000 }).catch(() => {});
  ok(await ap.evaluate(() => typeof BK !== 'undefined' && BK.ready && document.documentElement.dataset.view === 'book' && document.querySelectorAll('#bk-world .bpg[data-n]').length === BK.pages.length && BK.pages.length >= 24), `Artifact build: opens on the Book from the embedded sample book (${(art.length / 1024).toFixed(0)} KB file)`);
  await ap.click('#v-ver');
  ok(await ap.locator('#versions[open] #vs-guest').isVisible() && await ap.locator('#vs-save').isVisible(), 'Artifact build: the Versions drawer opens and keeps versions in the browser (a Studio server is optional)');
  await ap.click('#vs-close');
  await ap.evaluate(() => KW.go({ level: 'spread', s: 7 })); await ap.waitForFunction(() => NAV.level === 'spread' && BK.level !== 'book'); await ap.waitForTimeout(400);
  await ap.evaluate(() => KW.go({ level: 'day', date: '2026-10-14', edit: true })); await ap.waitForFunction(() => document.documentElement.dataset.view === 'day' && !NAV.busy());
  ok(await ap.evaluate(() => document.querySelectorAll('#pv [data-b]').length >= 3 && document.querySelectorAll('#pal li.pi').length > 20 && /Day Oct 14/.test(document.querySelector('#crumbs').textContent)), 'Artifact build: the day level is the editor, with its breadcrumb');
  await ap.click('#nv-back'); await ap.waitForFunction(() => document.documentElement.dataset.view === 'book'); ok(true, 'Artifact build: Back works without history support');
  await ap.close();
}
ok(!errs.length, 'no page errors after the Book view ' + errs.join(' | '));
// View versus edit (E1, BUILD-PLAN section 16): the day is viewed first; the editor UI exists only while editing.
{
  const VIEW = URL0 + '#day/2026-10-14', e1 = [];
  const inMode = (pg, m) => pg.waitForFunction((x) => document.documentElement.dataset.view === 'day' && document.documentElement.dataset.mode === x && document.querySelectorAll('#pv [data-b]').length >= 3, m);
  const vis = (pg, sel) => pg.evaluate((q) => [...document.querySelectorAll(q)].some((el) => el.offsetParent !== null || (getComputedStyle(el).position === 'fixed' && getComputedStyle(el).display !== 'none')), sel);
  const v = await b.newPage({ viewport: { width: 1400, height: 900 } });
  v.on('pageerror', (e) => e1.push(e.message));
  await v.goto(VIEW, { waitUntil: 'networkidle' }); await inMode(v, 'view');
  // viewing: clean and read-only
  ok(await v.evaluate(() => document.querySelectorAll('#pal *, #list *, #ov *, #problems > *').length === 0 && !document.querySelector('[data-add], .grip, .sw, [data-bool], [data-num], [data-place]')), 'view: the palette, block list, options and grid overlay are not in the DOM');
  ok(!(await vis(v, '#panels, #undo, #laygrp, #done, #edit-pill, #meter, #dragtip, .tabs, #m-method, #m-import, #m-reset, #m-ghload')), 'view: no palette panel, undo, Flow/Grid, Done, Editing pill, meter or layout menu items');
  ok((await v.locator('#edit').isVisible()) && (await v.locator('#v-ver').isVisible()) && (await v.locator('#menubtn').isVisible()), 'view: Edit, Versions and More stay reachable');
  ok(await v.evaluate(() => { const r = document.querySelector('#paper').getBoundingClientRect(); return r.width > 440 && r.left > 0 && r.right < innerWidth && Math.abs((r.left + r.right) / 2 - innerWidth / 2) < 4; }), 'view: the page is larger than the editing preview and centered');
  const snap = await v.locator('body').ariaSnapshot();
  ok(/Edit/.test(snap) && !/Undo|Flow|Grid|Add blocks|On the page|Remove |Drag to reorder/i.test(snap), 'view: the accessibility tree has Edit and no editing controls');
  ok(/Day page, viewing/.test(await v.textContent('#nav-live')), 'view: the live region says the day is being viewed');
  const before = await v.evaluate(() => JSON.stringify(layout));
  await v.mouse.click(700, 300); await v.keyboard.press('Control+z');
  ok((await v.evaluate(() => JSON.stringify(layout))) === before && await v.evaluate(() => !document.querySelector('#pv .hl')), 'view: clicking the page and Ctrl+Z change nothing');
  ok(await v.evaluate(() => getComputedStyle(document.querySelector('#pv [data-b]')).cursor !== 'grab'), 'view: blocks are not draggable (no grab cursor)');
  await v.screenshot({ path: `${OUT}/e1-view-desktop.png` });
  // the menu in view mode: only exports
  await v.click('#menubtn');
  ok(await v.evaluate(() => { const on = [...document.querySelectorAll('#menu [role=menuitem]')].filter((x) => x.offsetParent).map((x) => x.id); return on.includes('m-dl') && on.includes('m-copy') && !on.some((x) => ['m-method', 'm-import', 'm-reset', 'm-ghload'].includes(x)); }), 'view: the More menu offers exports only (no methods, import, reset or load)');
  await v.evaluate(() => document.body.click());
  // Versions works from view
  await v.click('#v-ver'); await v.waitForSelector('#versions[open]'); ok(await v.locator('#vs-close').isVisible(), 'view: the Versions drawer opens'); await v.click('#vs-close');
  // Edit by keyboard: E, then focus is on the first editing control
  await v.evaluate(() => document.activeElement && document.activeElement.blur()); await v.keyboard.press('e'); await inMode(v, 'edit');
  ok(await v.evaluate(() => location.hash === '#day/2026-10-14/edit' && !!document.querySelector('#pal li.pi') && document.querySelectorAll('#list > li').length >= 5 && !document.querySelector('#undo').hidden && !document.querySelector('#laygrp').hidden), 'E enters edit mode: palette, options list, Flow/Grid and Undo appear; the hash records it');
  ok(await v.evaluate(() => document.activeElement && document.activeElement.closest('#laygrp') !== null), 'edit: focus moves to the first editing control (the Flow/Grid switch)');
  ok(await v.evaluate(() => document.querySelector('#edit-pill').textContent.trim() === 'Editing' && !document.querySelector('#edit-pill').hidden && document.querySelector('#edit').hidden && !document.querySelector('#done').hidden), 'edit: a clear "Editing" indicator and a Done button show');
  ok(/Day page editor, editing/.test(await v.textContent('#nav-live')), 'edit: the live region announces editing');
  ok(await v.evaluate(() => [...document.querySelectorAll('#edit-pill, #done, #undo, #laygrp button, #sz-s, #sz-l')].every((el) => el.getBoundingClientRect().height >= 43.5)), 'edit: header controls are 44px targets');
  await v.screenshot({ path: `${OUT}/e1-edit-desktop.png` });
  // an edit, then Escape leaves edit mode
  await v.locator('#pal [data-add="t:checks"]').click();
  ok(await v.evaluate(() => layout.blocks.some((x) => x.type === 'checks') && !document.querySelector('#undo').disabled), 'edit: adding a block works and enables Undo');
  await v.evaluate(() => document.activeElement.blur()); await v.keyboard.press('Escape'); await inMode(v, 'view');
  ok(await v.evaluate(() => location.hash === '#day/2026-10-14' && document.activeElement && document.activeElement.id === 'edit' && document.querySelectorAll('#pal *, #list *').length === 0), 'Escape is Done: back to viewing, focus returns to the Edit button, the panels leave the DOM');
  ok(await v.evaluate(() => layout.blocks.some((x) => x.type === 'checks') && !!document.querySelector('#pv [data-zone="checks"]')), 'the edit is kept as the draft after Done (it shows in the viewed page)');
  ok(/Day page, viewing/.test(await v.textContent('#nav-live')), 'Done: the live region announces viewing again');
  // Enter also edits; re-entering keeps the draft and its Undo history
  await v.evaluate(() => document.activeElement.blur()); await v.keyboard.press('Enter'); await inMode(v, 'edit');
  ok(await v.evaluate(() => !document.querySelector('#undo').disabled && layout.blocks.some((x) => x.type === 'checks')), 'Enter enters edit mode; the draft and Undo are still there');
  // hash routing: history keeps view and edit apart
  await v.goBack(); await inMode(v, 'view'); ok((await v.evaluate(() => location.hash)) === '#day/2026-10-14', 'browser Back from edit returns to viewing');
  await v.goForward(); await inMode(v, 'edit'); ok((await v.evaluate(() => location.hash)) === '#day/2026-10-14/edit', 'browser Forward returns to editing');
  await v.reload({ waitUntil: 'networkidle' }); await inMode(v, 'edit'); ok(await v.evaluate(() => !!document.querySelector('#pal li.pi')), 'reload on #day/.../edit restores edit mode');
  await v.click('#done'); await inMode(v, 'view'); ok(await v.evaluate(() => document.activeElement.id === 'edit' && location.hash === '#day/2026-10-14'), 'Done after a reload: replaces the hash, keeps focus sensible');
  await v.reload({ waitUntil: 'networkidle' }); await inMode(v, 'view'); ok(await v.evaluate(() => !NAV.edit), 'reload on #day/... restores viewing');
  // Escape from viewing goes up one level (the spread)
  await v.evaluate(() => document.activeElement && document.activeElement.blur()); await v.keyboard.press('Escape'); await v.waitForFunction(() => NAV.level === 'spread');
  ok(true, 'Escape while viewing goes up to the spread');
  await v.waitForTimeout(500);
  ok(await v.evaluate(() => document.querySelector('#edit').offsetParent === null && document.querySelector('#undo').offsetParent === null), 'spread level: pages are for viewing, no Edit or Undo');
  await v.evaluate(() => KW.go({ level: 'day', date: '2026-10-14', edit: true })); await inMode(v, 'edit');
  await v.evaluate(() => { location.hash = '#day/2026-10-15'; }); await inMode(v, 'view'); ok(await v.evaluate(() => NAV.date === '2026-10-15' && !NAV.edit), 'a typed hash without /edit opens the day for viewing');
  // a page that is not a day page: view only, with its note; /edit is ignored
  await v.evaluate(() => { location.hash = '#page/safety/edit'; }); await v.waitForFunction(() => document.documentElement.dataset.view === 'page'); await v.waitForTimeout(200);
  ok(await v.evaluate(() => location.hash === '#page/safety' && document.querySelector('#edit').offsetParent === null && document.querySelector('#pageview .pgv-note') !== null && document.documentElement.dataset.mode === 'view'), 'a non-day page stays view-only with its note; #page/…/edit falls back to viewing');
  await v.evaluate(() => document.activeElement.blur()); await v.keyboard.press('e'); ok(!(await v.evaluate(() => NAV.edit)), 'E on a non-day page does not edit');
  ok(!e1.length, 'no page errors in view/edit ' + e1.join(' | '));
  await v.close();

  // phone: viewing is just the page; editing is a bottom sheet under the page
  const ph = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  ph.on('pageerror', (e) => e1.push('phone: ' + e.message));
  await ph.goto(VIEW, { waitUntil: 'networkidle' }); await inMode(ph, 'view');
  ok(await ph.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.querySelector('#paper').getBoundingClientRect().width > 300 && !document.querySelector('#panels').offsetParent), 'phone view: full-width page, no panels, no sideways scroll');
  ok(await ph.evaluate(() => [...document.querySelectorAll('.top button, .top .btn, .top input')].filter((x) => x.offsetParent).every((x) => x.getBoundingClientRect().height >= 43.5 && x.getBoundingClientRect().width >= 43.5)), 'phone view: 44px targets in the header');
  await ph.screenshot({ path: `${OUT}/e1-view-phone.png` });
  await ph.click('#edit'); await inMode(ph, 'edit'); await ph.waitForTimeout(250);
  const g = await ph.evaluate(() => { const s = document.querySelector('#panels').getBoundingClientRect(), pp = document.querySelector('#paper').getBoundingClientRect(); return { fixed: getComputedStyle(document.querySelector('#panels')).position, top: s.top, bottom: s.bottom, vh: innerHeight, pTop: pp.top, pBottom: pp.bottom, w: document.documentElement.scrollWidth <= innerWidth }; });
  ok(g.fixed === 'fixed' && Math.abs(g.bottom - g.vh) < 2 && g.top > g.vh * 0.4 && g.pTop < g.top - 100 && g.w, `phone edit: the panels are a bottom sheet (${Math.round(g.top)}-${Math.round(g.bottom)} of ${g.vh}); the page is visible above it`);
  ok(await ph.evaluate(() => [...document.querySelectorAll('.top button, .panels [role=tab], .panels .sheet-t')].filter((x) => x.offsetParent).every((x) => x.getBoundingClientRect().height >= 43.5)), 'phone edit: header and sheet controls are 44px');
  await ph.screenshot({ path: `${OUT}/e1-edit-phone.png` });
  await ph.click('#sheet-t'); await ph.waitForTimeout(200);
  ok(await ph.evaluate(() => document.documentElement.dataset.sheet === 'min' && document.querySelector('#panels').getBoundingClientRect().height < 90 && !document.querySelector('#list').offsetParent && document.querySelector('#sheet-t').getAttribute('aria-expanded') === 'false'), 'phone edit: the sheet folds away to its tab bar and says so');
  await ph.screenshot({ path: `${OUT}/e1-edit-phone-folded.png` });
  await ph.click('#sheet-t');
  await ph.click('.tabs [data-tab="add"]'); await ph.screenshot({ path: `${OUT}/e1-edit-phone-add.png` });
  await ph.click('#done'); await inMode(ph, 'view'); ok(await ph.evaluate(() => !document.querySelector('#panels').offsetParent && document.documentElement.scrollWidth <= innerWidth), 'phone: Done clears the sheet');
  await ph.close();

  // dark mode: view and edit
  const dk = await b.newPage({ viewport: { width: 1200, height: 800 }, colorScheme: 'dark' });
  await dk.goto(VIEW, { waitUntil: 'networkidle' }); await inMode(dk, 'view'); await dk.screenshot({ path: `${OUT}/e1-view-dark.png` });
  ok(await dk.evaluate(() => getComputedStyle(document.body).backgroundColor !== 'rgb(244, 241, 234)'), 'dark: view mode follows the system');
  await dk.click('#edit'); await inMode(dk, 'edit'); await dk.screenshot({ path: `${OUT}/e1-edit-dark.png` });
  ok(await dk.evaluate(() => getComputedStyle(document.querySelector('#edit-pill')).color !== 'rgb(63, 95, 90)'), 'dark: the Editing pill uses the dark accent');
  await dk.close();
  const dkp = await b.newPage({ viewport: { width: 390, height: 844 }, colorScheme: 'dark', deviceScaleFactor: 2 });
  await dkp.goto(VIEW + '/edit', { waitUntil: 'networkidle' }); await inMode(dkp, 'edit'); await dkp.screenshot({ path: `${OUT}/e1-edit-phone-dark.png` });
  await dkp.evaluate(() => document.querySelector('#done').click()); await inMode(dkp, 'view'); await dkp.screenshot({ path: `${OUT}/e1-view-phone-dark.png` }); await dkp.close();

  // reduced motion: no transition or animation in the mode switch, and it still works
  const rm = await b.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  await rm.goto(VIEW, { waitUntil: 'networkidle' }); await inMode(rm, 'view');
  const t0 = Date.now(); await rm.click('#edit'); await inMode(rm, 'edit');
  ok(await rm.evaluate(() => getComputedStyle(document.querySelector('#main')).animationName === 'none' && getComputedStyle(document.querySelector('#sheet-t svg')).transitionDuration === '0s') && Date.now() - t0 < 1500, 'reduced motion: entering edit mode has no animation or transition');
  await rm.close();

  // the Artifact build: the same modes
  const art = fs.readFileSync(new URL('./dist/artifact.html', import.meta.url), 'utf8');
  const ap = await b.newPage({ viewport: { width: 1200, height: 800 } });
  ap.on('pageerror', (e) => e1.push('artifact: ' + e.message));
  await ap.setContent('<!doctype html><html lang="en"><head><meta charset="utf-8">' + art + '</html>', { waitUntil: 'load' });
  await ap.waitForFunction(() => typeof BK !== 'undefined' && BK.ready, null, { timeout: 8000 }).catch(() => {});
  await ap.evaluate(() => KW.go({ level: 'day', date: '2026-10-14' })); await inMode(ap, 'view');
  ok(await ap.evaluate(() => document.querySelectorAll('#pal *, #list *').length === 0 && !!document.querySelector('#edit').offsetParent), 'Artifact build: the day opens for viewing');
  await ap.click('#edit'); await inMode(ap, 'edit');
  ok(await ap.evaluate(() => document.querySelectorAll('#pal li.pi').length > 20 && !!document.querySelector('#done').offsetParent), 'Artifact build: Edit shows the editor, Done is there');
  await ap.click('#done'); await inMode(ap, 'view'); await ap.close();
  ok(!e1.length, 'no page errors on the phone, dark, reduced-motion or Artifact runs ' + e1.join(' | '));
}
// Versions drawer (Journalwright Studio) with no server configured: versions are kept in this browser, and the editor is untouched
{
  const vp = await b.newPage({ viewport: { width: 390, height: 844 } }), api = [], verrs = [];
  vp.on('pageerror', (e) => verrs.push(e.message)); vp.on('request', (r) => { if (r.url().includes('/api/') && !r.url().endsWith('/api/health')) api.push(r.url()); });
  await vp.goto(URL0, { waitUntil: 'networkidle' }); await vp.waitForFunction(() => BK.ready);
  const before = await vp.evaluate(() => JSON.stringify(layout));
  ok(await vp.locator('#v-ver').isVisible(), 'the Versions button is in the header of the Book view too'); await vp.evaluate(() => KW.go({ level: 'day', date: '2026-10-14', edit: true })); await atDay(vp);
  await vp.click('#v-ver'); await vp.waitForSelector('#versions[open]');
  ok(/Sign in to save versions/.test(await vp.textContent('#vs-guest')) && await vp.locator('#vs-save').isVisible(), 'Versions drawer without a server: "Sign in to save versions", and a guest can still save versions here');
  ok(await vp.evaluate(() => document.getElementById('versions').scrollWidth <= innerWidth + 1 && document.documentElement.scrollWidth <= innerWidth + 1), 'Versions drawer: no sideways scroll at 390px');
  ok(await vp.evaluate(() => [...document.querySelectorAll('#versions button, #versions input, #versions select')].filter((el) => el.offsetParent && (el.getBoundingClientRect().height < 43.5 || el.getBoundingClientRect().width < 43.5)).length === 0), 'Versions drawer: 44px targets on a phone');
  await vp.fill('#vs-msg', 'First version'); await vp.click('#vs-savebtn');
  ok(await vp.locator('#vs-log .vs-c').count() === 1 && /First version/.test(await vp.textContent('#vs-log')), 'a version saved in this browser shows in the history');
  ok(JSON.stringify(await vp.evaluate(() => JSON.parse(localStorage.getItem('kw-st-local')).versions.length)) === '1', 'it is kept in this browser only');
  await vp.fill('#vs-url', 'http://127.0.0.1:9'); await vp.fill('#vs-user', 'sample'); await vp.fill('#vs-pass', 'not a real password');
  await vp.click('#vs-conn button[type=submit]'); await vp.waitForFunction(() => document.querySelector('#vs-err').textContent.length > 0);
  ok(/reach the Studio server/.test(await vp.textContent('#vs-err')), 'an unreachable server says so in plain words');
  await vp.screenshot({ path: `${OUT}/versions-no-server.png` });
  await vp.click('#vs-close'); api.length = 0;
  await vp.click('.tabs [data-tab="add"]'); await vp.locator('#pal [data-add="t:checks"]').click();
  ok(await vp.evaluate(() => layout.blocks.some((x) => x.type === 'checks')) && (await vp.evaluate(() => JSON.stringify(layout))) !== before, 'the day editor still edits');
  await vp.waitForTimeout(1500); // longer than the draft autosave delay
  ok(!api.length, 'editing without a Studio server makes no Studio requests ' + api.join(','));
  ok(!verrs.length, 'no page errors in the Versions drawer ' + verrs.join(' | '));
  await vp.close();
}
await b.close(); srv.close();
if (fails.length) { console.log(`\n${fails.length} failed`); process.exit(1); }
