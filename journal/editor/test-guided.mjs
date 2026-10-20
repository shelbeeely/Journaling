// Fewer decisions (BUILD-PLAN section 26), in the browser: the Basic view, "back to recommended", the guided start (five questions and four ready-made
// books), what is remembered (this browser, the Studio when signed in, nothing in the demo), a phone, the dark theme and the pseudo-locales.
//   node render.mjs month 2026-10 test.ics && node editor/build.mjs && node editor/test-guided.mjs     (screens -> editor/dist/test/guided-*.png)
// Offline sandbox: SORTABLE_JS=/path/Sortable.min.js serves the drag library locally (CI has the network).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { launchEditor as launch } from '../browser.mjs';
import { launchEditor as launchPlain } from '../browser.mjs'; // the same function, asked for the real first run: nothing is seeded (see browser.mjs)
import { serve as studioServe } from '../../studio/test/helpers.mjs';
import { BASIC_TYPES, ROOM_BUDGET, TRACK_IDS, STARTER_IDS, STARTERS, PAGES_PER_MONTH, PAGES_PER_MONTH_CALM } from '../presets.mjs';

const DIST = new URL('./dist/', import.meta.url).pathname, OUT = DIST + 'test/';
fs.mkdirSync(OUT, { recursive: true });
const T = { html: 'text/html', json: 'application/json', css: 'text/css', js: 'text/javascript' };
const srv = http.createServer((q, r) => {
  const f = path.join(DIST, decodeURIComponent(q.url.split('?')[0]).replace(/\/$/, '/index.html'));
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'Content-Type': T[f.split('.').pop()] || 'text/plain' }); r.end(d); } });
}).listen(0);
const ORIGIN = `http://127.0.0.1:${srv.address().port}`;
const fails = [], ok = (c, m) => { if (!c) fails.push(m); console.log((c ? 'ok   ' : 'FAIL ') + m); };
const b = await launch(), errs = [];
async function page({ w = 1400, h = 950, scheme = 'light', url = '/site/', hash = '', storage = null, ctx = null } = {}) {
  const c = ctx || await b.newContext({ viewport: { width: w, height: h }, colorScheme: scheme });
  const p = await c.newPage();
  await p.route(/fonts\.(googleapis|gstatic)/, (r) => r.abort());
  if (process.env.SORTABLE_JS) await p.route(/cdnjs\.cloudflare\.com/, (r) => r.fulfill({ path: process.env.SORTABLE_JS, contentType: 'text/javascript' }));
  p.on('pageerror', (e) => errs.push(e.message));
  if (storage) await p.addInitScript((kv) => { try { for (const [k, v] of Object.entries(kv)) if (!localStorage.getItem('__seeded')) localStorage.setItem(k, v); localStorage.setItem('__seeded', '1'); } catch {} }, storage);
  p.c = c;
  await p.goto((url.startsWith('http') ? url : ORIGIN + url) + hash, { waitUntil: 'networkidle' });
  return p;
}
const atDay = (p) => p.waitForFunction(() => document.documentElement.dataset.view === 'day' && document.querySelectorAll('#list > li').length > 3);
const atShelf = async (p) => { await p.evaluate(() => { location.hash = '#library'; }); await p.waitForFunction(() => document.documentElement.dataset.view === 'shelf' && document.querySelectorAll('#sh-list .sh-item').length > 0); if (!(await p.locator('#sh-guided').isVisible())) await p.locator('#edit').click(); await p.waitForSelector('#sh-guided', { state: 'visible' }); };
const openGuided = async (p) => { await p.locator('#sh-guided').click(); await p.waitForSelector('#guided[open] [data-gd="questions"]'); };
const types = (p) => p.evaluate(() => layout.blocks.map((x) => x.type).join(' '));
const stored = (p, k) => p.evaluate((key) => { try { return localStorage.getItem(key); } catch { return null; } }, k);
const bodyIn = (p) => p.evaluate(() => { const e = document.querySelector('#pv [data-zone="body"]'); return e ? e.offsetHeight / 96 : 0; });
const meterOk = (p) => p.evaluate(() => !/Too full|overflows/.test(document.querySelector('#meter').textContent));

// ---------- 1. the Basic view ----------
{
  const p = await page({ hash: '#day/2026-10-14/edit' }); await atDay(p);
  ok(await p.locator('#vm-b').getAttribute('aria-pressed') === 'true' && await p.locator('#vm-a').getAttribute('aria-pressed') === 'false', 'Basic is the view you start in');
  const keys = await p.evaluate(() => [...document.querySelectorAll('#pal li.pi')].map((li) => li.dataset.key));
  ok(keys.join() === BASIC_TYPES.map((t) => 't:' + t).join(), `Basic offers exactly ${BASIC_TYPES.length} blocks, in order: ${keys.join(' ')}`);
  ok(await p.locator('#pal h3').count() === 1 && await p.locator('#pal [data-vm="advanced"]').isVisible(), 'in one plain list, with a way to show everything');
  ok((await p.locator('#list > li').count()) === 10, 'blocks already on the page all stay in the list, Basic or not (nothing is hidden or removed)');
  await p.locator('#pal [data-add="t:checks"]').click();
  const li = '#list > li[data-uid^="checks"]';
  await p.waitForSelector(li);
  const shown = await p.locator(`${li} .opts > .opt`).count();
  ok(shown === 4 && await p.locator(`${li} [data-more]`).count() === 1, 'a block with four options shows three and "1 more option" in Basic');
  ok((await p.locator(`${li} [data-more]`).textContent()).trim() === '1 more option', 'the button says how many are left');
  await p.locator(`${li} [data-more]`).click();
  ok(await p.locator(`${li} .opts > .opt`).count() === 5 && await p.locator(`${li} [data-more]`).getAttribute('aria-expanded') === 'true' && (await p.locator(`${li} [data-more]`).textContent()).trim() === 'Fewer options', 'pressing it shows all four, and the button becomes "Fewer options"');
  await p.locator(`${li} [data-more]`).click();
  // an option you changed is never hidden, and offers its recommended value
  await p.locator(`${li} input[data-text$="/title"]`).fill('My habits'); await p.locator(`${li} input[data-text$="/title"]`).blur();
  ok(await p.locator(`${li} .rec-b`).count() === 1, 'a changed option offers "Back to recommended"');
  ok(await p.locator(`${li} [data-rec$="/*"]`).count() === 1, 'and the block offers "Use all recommended settings"');
  const hit = await p.locator(`${li} .rec-b`).evaluate((e) => { const r = e.getBoundingClientRect(); return [r.width, r.height]; });
  ok(hit[0] >= 44 && hit[1] >= 44, `the recommended button is a 44 px target (${hit.map(Math.round).join(' x ')})`);
  await p.locator(`${li} .rec-b`).click();
  ok(await p.locator(`${li} input[data-text$="/title"]`).inputValue() === 'Habits' && await p.locator(`${li} .rec-b`).count() === 0, 'it puts the recommended value back (Habits) and the button goes away');
  await p.evaluate(() => { const b = layout.blocks.find((x) => x.type === 'checks'); b.omr = true; b.roomy = true; b.title = 'X'; drawList(); });
  await p.locator(`${li} [data-rec$="/*"]`).click();
  ok(await p.evaluate(() => { const b = layout.blocks.find((x) => x.type === 'checks'); return b.omr === false && b.roomy === false && b.title === 'Habits' && b.labels.join() === 'Stretch,Outside,Read'; }), '"Use all recommended settings" resets every option of that block');
  await p.screenshot({ path: OUT + 'guided-basic.png' });
  // Advanced: everything, and it is remembered
  await p.locator('#vm-a').click();
  const adv = await p.evaluate(() => ({ n: document.querySelectorAll('#pal li.pi').length, groups: document.querySelectorAll('#pal h3').length, care: !!document.querySelector('#pal [data-key="t:care"]'), preset: !!document.querySelector('#pal [data-key="p:0"]') }));
  ok(adv.n > 80 && adv.groups >= 8 && adv.care && adv.preset, `Advanced shows every block and preset (${adv.n} tiles in ${adv.groups} groups)`);
  ok(await p.locator(`${li} [data-more]`).count() === 0 && await p.locator(`${li} .opts > .opt`).count() >= 4, 'and every option of every block');
  ok(await stored(p, 'kw-view') === 'advanced', 'the choice is kept in this browser');
  await p.reload({ waitUntil: 'networkidle' }); await atDay(p);
  ok(await p.locator('#vm-a').getAttribute('aria-pressed') === 'true' && await p.locator('#pal li.pi').count() > 80, 'and is still there after a reload');
  await p.locator('#vm-b').click();
  ok(await stored(p, 'kw-view') === 'basic' && await p.locator('#pal li.pi').count() === 8, 'Basic is one tap back');
  // the print does not change: the default page is the same blocks and the same HTML in either view
  ok((await types(p)).startsWith('sky notes events care'), 'the day layout is the layout (the view never changes it)');
  await p.c.close();
}
// storage blocked: the editor still starts, in Basic
{
  const c = await b.newContext({ viewport: { width: 1400, height: 950 } });
  await c.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } }); });
  const p = await page({ ctx: c, hash: '#day/2026-10-14/edit' }); await atDay(p);
  ok(await p.locator('#pal li.pi').count() === 8 && await p.locator('#vm-b').getAttribute('aria-pressed') === 'true', 'with browser storage blocked the editor starts in Basic');
  await p.locator('#vm-a').click();
  ok(await p.locator('#pal li.pi').count() > 80, 'and Advanced still works for this visit');
  await c.close();
}

// ---------- 2. the guided start: five questions ----------
{
  const p = await page({ hash: '#library' });
  await p.waitForFunction(() => document.documentElement.dataset.view === 'shelf');
  await atShelf(p);
  const before = await p.evaluate(() => LB.lib.books.length), layoutBefore = await types(p);
  await openGuided(p);
  ok(await p.locator('#guided [data-starter]').count() === 4 && await p.locator('#guided [data-gd="last"]').count() === 0, 'it opens on five questions or four ready-made books (no "last book" yet)');
  await p.screenshot({ path: OUT + 'guided-home.png' });
  await p.locator('[data-gd="questions"]').click();
  const seen = [];
  for (let i = 0; i < 5; i++) {
    const q = await p.evaluate(() => ({ legend: document.querySelector('#gd-body legend').textContent, checked: [...document.querySelectorAll('#gd-body input:checked')].map((x) => x.value), step: document.querySelector('#gd-step').textContent, rec: document.querySelectorAll('#gd-body .gd-rec').length }));
    seen.push(q);
    if (i === 2) await p.screenshot({ path: OUT + 'guided-question.png' });
    await p.locator('#gd-next').click();
  }
  ok(seen.map((s) => s.step).join('|') === 'Question 1 of 5|Question 2 of 5|Question 3 of 5|Question 4 of 5|Question 5 of 5', 'five questions, each says where you are');
  ok(seen.every((s) => s.checked.length >= 1 && s.rec >= 1), 'each has its recommended answer already chosen and marked');
  ok(seen[0].checked.join() === 'small' && seen[1].checked.join() === 'month' && seen[2].checked.join() === 'tasks,mood,good' && seen[3].checked.join() === 'balanced' && seen[4].checked.join() === 'some', 'the recommended answers: 5.5 x 8.5, one month, tasks + mood + small good things, balanced, some room');
  ok(await p.locator('#gd-title').inputValue() === 'My journal' && /^\d{4}-\d{2}$/.test(await p.locator('#gd-start').inputValue()) && await p.locator('#gd-body iframe').count() === 1, 'then a finished book: a title, a first month and a preview of the page');
  ok((await p.locator('#gd-body iframe').getAttribute('srcdoc')).includes('data-zone="top"') || (await p.locator('#gd-body iframe').getAttribute('srcdoc')).includes('Top 3'), 'the preview is the real page');
  ok((await p.locator('.gd-facts').first().textContent()).includes('One month: about 80 pages.'), 'it says how long the book is in plain words');
  await p.screenshot({ path: OUT + 'guided-review.png' });
  await p.locator('#gd-title').fill('Spring pages'); await p.locator('#gd-next').click();
  await p.waitForFunction(() => !document.querySelector('#guided').open);
  const after = await p.evaluate(() => ({ n: LB.lib.books.length, last: LB.lib.books[LB.lib.books.length - 1], view: document.documentElement.dataset.view }));
  ok(after.n === before + 1 && after.last.title === 'Spring pages' && after.last.plan.scope === 'month' && /^\d{4}-\d{2}$/.test(after.last.start), 'Make this book adds it to the Library with its length and first month');
  ok(await types(p) === 'top scale words good body', `and sets the day page: ${await types(p)}`);
  ok(layoutBefore !== await types(p) && await meterOk(p), 'the page fits');
  const saved = JSON.parse(await stored(p, 'kw-library')); ok(saved.books.some((x) => x.title === 'Spring pages'), 'the library is saved in this browser');
  const last = JSON.parse(await stored(p, 'kw-last-book'));
  ok(last && last.v === 1 && last.answers.track.join() === 'tasks,mood,good' && !JSON.stringify(last).includes('Spring'), 'what it remembers is choices only: not the title');
  await p.evaluate(() => document.querySelector('#undo').click()); // the day editor's Undo (it shows on a day page)
  ok(await types(p) === layoutBefore, 'Undo takes the day page back');
  await p.c.close();
}

// ---------- 3. remembered: a new book starts the way the last one did; ready-made books; replace asks first ----------
{
  const p = await page({ hash: '#library' }); await atShelf(p);
  await openGuided(p);
  // pick a quarter, gentle, 8.5 x 11, and habits as well
  await p.locator('[data-gd="questions"]').click();
  await p.locator('input[name="gd-trim"][value="letter"]').check({ force: true }); await p.locator('#gd-next').click();
  await p.locator('input[name="gd-length"][value="quarter"]').check({ force: true }); await p.locator('#gd-next').click();
  await p.locator('input[name="gd-track"][value="habits"]').check({ force: true }); await p.locator('#gd-next').click();
  await p.locator('input[name="gd-tone"][value="gentle"]').check({ force: true }); await p.locator('#gd-next').click();
  await p.locator('#gd-next').click();
  ok((await p.locator('.gd-facts').first().textContent()).includes('3 months: about 210 pages, as 3 volumes'), 'three months of the gentle feel says about 210 pages (70 a month with the calm page set it brings), as 3 volumes');
  ok(await p.locator('#gd-body .ls-h').first().textContent().then((t) => t.includes('not on it yet')), 'a calm page says what it left off, and how to add it back');
  await p.locator('#gd-tweak').click();
  await p.waitForFunction(() => /^#day\/.*\/edit$/.test(location.hash) && document.documentElement.dataset.view === 'day');
  ok(await p.evaluate(() => size) === 'letter', '"Make it and change things" opens the day page, at the size you picked');
  ok((await types(p)).split(' ').length <= 4, `with the gentle page: ${await types(p)}`);
  ok(await p.evaluate(() => document.querySelector('#vm-b').getAttribute('aria-pressed')) === 'true', 'in Basic, where the few things are easy to see');
  await atShelfFromDay(p);
  await p.locator('#sh-new-book').click();
  await p.waitForSelector('#lib-sheet[open]');
  const nb = await p.evaluate(() => LB.lib.books[LB.lib.books.length - 1]);
  ok(nb.plan && nb.plan.scope === 'quarter' && nb.title === 'Untitled book', 'a new book starts the way the last one did (three months), with its own title');
  await p.locator('#ls-cancel').click();
  // the "last book" card
  await openGuided(p);
  ok(await p.locator('#guided [data-gd="last"]').isVisible(), 'the guided start now offers "Start from my last book"');
  await p.locator('#guided [data-gd="last"]').click();
  ok(await p.locator('#gd-body iframe').count() === 1 && (await p.locator('.gd-facts').first().textContent()).includes('3 months'), 'which opens the review with the same choices');
  await p.locator('#gd-back').click();
  // a ready-made book replaces a page that was changed: it asks first
  await p.locator('[data-starter="mood-log"]').click();
  await p.locator('#gd-title').fill('Mood notes');
  const n0 = await p.evaluate(() => LB.lib.books.length), t0 = await types(p);
  await p.locator('#gd-next').click();
  await p.waitForSelector('#lib-confirm[open]');
  ok((await p.locator('#lc-h').textContent()).includes('Replace your day page?'), 'a ready-made book asks before it replaces a page you changed');
  await p.locator('#lc-acts .btn:not(.primary)').first().click();
  ok(await p.evaluate(() => LB.lib.books.length) === n0 && await types(p) === t0 && await p.locator('#guided').evaluate((e) => e.open), 'Cancel changes nothing and leaves the sheet open');
  await p.locator('#gd-next').click(); await p.waitForSelector('#lib-confirm[open]');
  await p.locator('#lc-acts .btn.primary').click();
  await p.waitForFunction(() => !document.querySelector('#guided').open);
  ok(await types(p) === 'scale words sleeptimes checks good body' && await p.evaluate(() => LB.lib.books.length) === n0 + 1, 'Replace makes the mood log');
  await p.c.close();
}
async function atShelfFromDay(p) { await p.evaluate(() => { location.hash = '#library'; }); await p.waitForFunction(() => document.documentElement.dataset.view === 'shelf'); if (!(await p.locator('#sh-new-book').isVisible())) await p.locator('#edit').click(); await p.waitForSelector('#sh-new-book', { state: 'visible' }); }

// ---------- 4. every ready-made book, every kind of answer: the page fits at both sizes ----------
{
  const p = await page({ hash: '#day/2026-10-14/edit' }); await atDay(p);
  for (const sz of ['small', 'letter']) {
    await p.evaluate((s) => setSize(s), sz);
    for (const id of STARTER_IDS) {
      const r = await p.evaluate((id) => { layout = normalize(starterBook(id).layout, size); drawList(); drawPreview(); return { types: layout.blocks.map((x) => x.type).join(' '), over: /Too full|overflows/.test(document.querySelector('#meter').textContent), body: document.querySelector('#pv [data-zone="body"]').offsetHeight / 96 }; }, id);
      ok(!r.over && r.body >= 2.2, `${sz} ${id}: fits, ${r.body.toFixed(1)} in left to write in`);
      if (sz === 'small') await p.locator('.paper').screenshot({ path: `${OUT}guided-starter-${id}.png` });
    }
    let bad = [], n = 0;
    for (const tone of ['gentle', 'balanced', 'full']) for (const room of ['lots', 'some', 'compact']) for (const track of [TRACK_IDS, ['tasks', 'mood', 'good'], ['making'], ['time', 'calendar'], []]) {
      const r = await p.evaluate(([tone, room, track]) => { const g = guidedBook({ tone, room, track }); layout = normalize(g.layout, size); drawPreview(); return { used: g.used, over: /Too full|overflows/.test(document.querySelector('#meter').textContent), body: document.querySelector('#pv [data-zone="body"]').offsetHeight / 96 }; }, [tone, room, track]);
      n++; if (r.over || r.body < 5.4 - ROOM_BUDGET[room] - 0.3) bad.push(`${tone}/${room}/${track.join('+') || 'none'}: ${r.body.toFixed(2)} in${r.over ? ' too full' : ''}`);
    }
    ok(!bad.length, `${sz}: ${n} guided pages all fit, and keep the room they promise` + (bad.length ? ': ' + bad.slice(0, 3).join(' | ') : ''));
  }
  await p.c.close();
}

// ---------- 5. the demo remembers nothing ----------
{
  const p = await page({ url: '/demo/', hash: '#library' });
  await p.waitForFunction(() => document.documentElement.dataset.view === 'shelf' && document.querySelectorAll('#sh-list .sh-item').length > 0);
  if (!(await p.locator('#sh-guided').isVisible())) await p.locator('#edit').click();
  await openGuided(p);
  await p.locator('[data-starter="art-practice"]').click(); await p.locator('#gd-next').click();
  await p.waitForFunction(() => !document.querySelector('#guided').open);
  ok(await p.evaluate(() => layout.blocks.map((x) => x.type).join(' ')) === 'sketch checks lines body', 'the demo makes the book in memory');
  const keys = await p.evaluate(() => { try { return Object.keys(localStorage); } catch { return ['blocked']; } });
  ok(!keys.some((k) => ['kw-last-book', 'kw-library', 'kw-daypage', 'kw-view'].includes(k)) && keys.every((k) => k === 'kw-guided-skip'), `and saves nothing: no last book, library, layout or view in browser storage, only the flag that the guide was skipped (${keys.join(', ') || 'none'})`);
  await p.c.close();
}

// ---------- 6. signed in: the Studio keeps it ----------
{
  const t = await studioServe({ staticDir: DIST + 'site' });
  try {
    const token = await t.signup('sam');
    const seed = { 'kw-st-token': token };
    const p = await page({ url: t.base + '/', hash: '#library', storage: seed });
    await p.waitForFunction(() => typeof ST !== 'undefined' && !!ST.user, null, { timeout: 15000 });
    await atShelf(p); await openGuided(p);
    await p.locator('[data-starter="daily-planner"]').click(); await p.locator('#gd-next').click();
    await p.waitForFunction(() => !document.querySelector('#guided').open || document.querySelector('#lib-confirm').open);
    if (await p.locator('#lib-confirm').evaluate((e) => e.open)) await p.locator('#lc-acts .btn.primary').click();
    await p.waitForFunction(() => !document.querySelector('#guided').open);
    await p.waitForTimeout(600);
    const got = (await t.call('GET', '/api/me/prefs/startFrom', { token })).body.value;
    ok(got && got.starter === 'daily-planner' && got.v === 1 && !JSON.stringify(got).includes('My journal') && !JSON.stringify(got).includes('Daily planner'), 'signed in, the Studio is told the choices (and not the title)');
    // another browser, same account, nothing stored here: the Studio's copy is what it offers
    const p2 = await page({ url: t.base + '/', hash: '#library', storage: seed, ctx: await b.newContext({ viewport: { width: 1400, height: 950 } }) });
    await p2.waitForFunction(() => typeof ST !== 'undefined' && !!ST.user, null, { timeout: 15000 });
    ok(await stored(p2, 'kw-last-book') === null, 'a second browser has nothing of its own');
    await atShelf(p2); await openGuided(p2);
    await p2.waitForSelector('#guided [data-gd="last"]', { timeout: 8000 });
    ok(true, 'but it offers "Start from my last book", from the account');
    await p.c.close(); await p2.c.close();
  } finally { await t.close(); }
}


// ---------- 8. the first run: a brand-new editor opens on the guided start, with a Skip (BUILD-PLAN 26.7, decision 3) ----------
{
  const bf = await launchPlain({ firstRun: true });
  const fresh = async ({ url = '/site/', hash = '', init = null, ctx = null, w = 1400, h = 950 } = {}) => {
    const c = ctx || await bf.newContext({ viewport: { width: w, height: h } });
    const p = await c.newPage();
    await p.route(/fonts\.(googleapis|gstatic)/, (r) => r.abort());
    if (process.env.SORTABLE_JS) await p.route(/cdnjs\.cloudflare\.com/, (r) => r.fulfill({ path: process.env.SORTABLE_JS, contentType: 'text/javascript' }));
    p.on('pageerror', (e) => errs.push(e.message));
    if (init) await p.addInitScript(init);
    p.c = c; await p.goto(ORIGIN + url + hash, { waitUntil: 'networkidle' });
    return p;
  };
  const isOpen = (p) => p.evaluate(() => document.querySelector('#guided').open);
  const flag = (p) => p.evaluate(() => { try { return localStorage.getItem('kw-guided-skip'); } catch { return 'blocked'; } });
  const settle = (p) => p.waitForTimeout(1500);
  {
    const p = await fresh(); await p.waitForSelector('#guided[open] [data-gd="questions"]', { timeout: 15000 });
    ok(await isOpen(p) && await p.locator('#gd-h').textContent() === 'Start a book' && await p.locator('.gd-first').isVisible(), 'a brand-new working editor opens on the guided start by itself, and says why');
    const later = p.locator('#gd-later'), bb = await later.boundingBox();
    ok(await later.isVisible() && (await later.textContent()).trim() === 'Skip' && bb.height >= 44 && bb.width >= 44, 'with a visible Skip button on the first step (a 44 px target)');
    ok(await flag(p) === null, 'nothing is stored until the person decides');
    await later.click(); await p.waitForFunction(() => !document.querySelector('#guided').open);
    ok(await flag(p) === '1', 'Skip closes it and remembers that, in browser storage');
    await p.reload({ waitUntil: 'networkidle' }); await settle(p);
    ok(!(await isOpen(p)), 'and the guide does not open by itself again');
    await atShelf(p); await openGuided(p); ok(await isOpen(p) && await p.locator('.gd-first').count() === 0, 'it is still there when asked for (Guided start), without the first-run note');
    await p.c.close();
  }
  for (const how of ['close', 'escape']) {
    const p = await fresh(); await p.waitForSelector('#guided[open]');
    if (how === 'close') await p.locator('#gd-x').click(); else await p.keyboard.press('Escape');
    await p.waitForFunction(() => !document.querySelector('#guided').open);
    ok(await flag(p) === '1', `the ${how === 'close' ? 'close button' : 'Escape key'} counts as skipping too`);
    await p.c.close();
  }
  {
    const p = await fresh({ hash: '#day/2026-10-14/edit' }); await atDay(p); await settle(p);
    ok(!(await isOpen(p)) && await flag(p) === null, 'a link to a day (or a page, or the Versions panel) is left alone: the guide does not jump in');
    await p.c.close();
  }
  {
    const p = await fresh({ init: () => { try { localStorage.setItem('kw-daypage', JSON.stringify({ v: 2, blocks: [{ type: 'body', uid: 'body', on: true }] })); } catch {} } }); await settle(p);
    ok(!(await isOpen(p)), 'an editor that already has its own day page does not open on the guide');
    await p.c.close();
  }
  {
    const p = await fresh({ init: () => { try { localStorage.setItem('kw-last-book', JSON.stringify({ v: 1, answers: {} })); } catch {} } }); await settle(p);
    ok(!(await isOpen(p)), 'an editor that has made a book before does not open on the guide');
    await p.c.close();
  }
  {
    const p = await fresh(); await p.waitForSelector('#guided[open] [data-starter="art-practice"]');
    await p.locator('[data-starter="art-practice"]').click(); await p.locator('#gd-next').click();
    await p.waitForFunction(() => !document.querySelector('#guided').open);
    await p.reload({ waitUntil: 'networkidle' }); await settle(p);
    ok(!(await isOpen(p)), 'after the first book is made the guide does not come back by itself');
    await p.c.close();
  }
  {
    const p = await fresh({ url: '/demo/' }); await p.waitForSelector('#guided[open] [data-gd="questions"]', { timeout: 15000 });
    ok(await p.locator('#gd-later').isVisible(), 'the public demo opens on the same first run, with the same Skip');
    await p.locator('#gd-later').click(); await p.waitForFunction(() => !document.querySelector('#guided').open);
    const keys = await p.evaluate(() => { try { return Object.keys(localStorage); } catch { return ['blocked']; } });
    ok(keys.join() === 'kw-guided-skip', `the demo remembers the skip and nothing else (${keys.join(', ')})`);
    await p.reload({ waitUntil: 'networkidle' }); await settle(p);
    ok(!(await isOpen(p)), 'and does not open it again');
    await p.c.close();
  }
  {
    const p = await fresh({ init: () => { Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } }); } }); await settle(p);
    ok(!(await isOpen(p)) && await p.locator('#edit').count() === 1, 'with browser storage blocked (a private window, a sandboxed frame) the editor starts and the guide does not jump in, because a Skip could not be remembered; it stays in the Library and in More');
    await p.c.close();
  }
  {
    const p = await fresh({ w: 390, h: 800 }); await p.waitForSelector('#guided[open]');
    const r = await p.evaluate(() => { const d = document.querySelector('#guided'); const small = [...d.querySelectorAll('button')].filter((e) => { const r = e.getBoundingClientRect(); return r.width && (r.height < 43.5 || r.width < 43.5); }).map((e) => e.id || e.textContent.trim()); return { sw: document.documentElement.scrollWidth, small, vis: !!d.querySelector('#gd-later').offsetParent }; });
    ok(r.sw <= 390 && !r.small.length && r.vis, 'on a phone the first run has no sideways scroll, a visible Skip and 44 px buttons' + (r.small.length ? ': ' + r.small.join(', ') : ''));
    await p.screenshot({ path: `${OUT}guided-first-run-phone.png` });
    await p.c.close();
  }
  {
    const p = await fresh(); await p.waitForSelector('#guided[open]'); await p.screenshot({ path: `${OUT}guided-first-run.png` }); await p.c.close();
  }
  await bf.close();
}

// ---------- 9. the calm page set (BUILD-PLAN 26.7, decision 4) and the new name (decision 5) ----------
{
  const p = await page({ hash: '#library' }); await atShelf(p); await openGuided(p);
  const names = await p.locator('[data-starter] b').allTextContents();
  ok(names.includes('Low-energy days') && !names.some((n) => /Low-energy week/.test(n)) && names.length === 4, 'the ready-made book is called "Low-energy days"');
  await p.locator('[data-gd="questions"]').click(); await p.locator('#gd-next').click(); await p.locator('#gd-next').click(); await p.locator('#gd-next').click();
  await p.locator('input[name="gd-tone"][value="gentle"]').check({ force: true });
  await p.locator('#gd-skip').click(); await p.waitForSelector('#gd-calm');
  ok(await p.locator('#gd-calm').isChecked() && /about 70 pages/.test(await p.locator('#gd-facts').textContent()), `the gentle feel turns the calm page set on by itself, and the review says a month is about ${PAGES_PER_MONTH_CALM} pages`);
  const lab = await p.locator('label.gd-pages').textContent();
  ok(/moon and sky pages/.test(lab) && /bus times/.test(lab) && /about 70 pages a month instead of 80/i.test(lab), 'and says what it leaves out and what it saves: ' + lab.trim().replace(/\s+/g, ' ').slice(0, 120));
  const cb = await p.locator('#gd-calm').boundingBox(), lb = await p.locator('label.gd-pages').boundingBox();
  ok(cb.width >= 22 && lb.height >= 44, 'the choice is a labelled checkbox in a 44 px row');
  await p.locator('#gd-calm').uncheck({ force: true });
  ok(/about 80 pages/.test(await p.locator('#gd-facts').textContent()), 'turning it off puts the full count back');
  await p.locator('#gd-calm').check({ force: true });
  await p.waitForFunction(() => typeof ORG !== 'undefined' && !!ORG.base, null, { timeout: 15000 }).catch(() => {});
  await p.locator('#gd-next').click(); await p.waitForFunction(() => !document.querySelector('#guided').open || document.querySelector('#lib-confirm').open);
  if (await p.locator('#lib-confirm').evaluate((e) => e.open)) await p.locator('#lc-acts .btn.primary').click();
  await p.waitForFunction(() => !document.querySelector('#guided').open);
  const made = await p.evaluate(() => { const x = LB.lib.books.find((b) => b.title === 'My journal'); return { book: x, layouts: (LB.lib.layouts || []).map((l) => ({ id: l.id, hidden: JSON.stringify(l.book).includes('"type":"lineage","on":false') })), errs: LM.validateLibrary(LB.lib) }; });
  ok(made.book && made.book.modules && made.book.modules.sky === false && made.book.modules.bus === false && made.book.layoutRef === 'calm-pages' && made.layouts.some((l) => l.id === 'calm-pages' && l.hidden) && !made.errs.length, 'making it turns the sky and bus modules off on the book and points it at a "calm-pages" layout that hides the "where each piece comes from" page; the library stays valid');
  const last = JSON.parse(await stored(p, 'kw-last-book'));
  ok(last.answers.pages === 'calm' && last.modules.sky === false, 'and what is remembered says so');
  await p.c.close();
}
{
  const p = await page({ hash: '#library' }); await atShelf(p); await openGuided(p);
  await p.locator('[data-gd="questions"]').click(); await p.locator('#gd-skip').click(); await p.waitForSelector('#gd-calm');
  ok(!(await p.locator('#gd-calm').isChecked()) && new RegExp(`about ${PAGES_PER_MONTH} pages`).test(await p.locator('#gd-facts').textContent()), 'the recommended answers (balanced) are the full page set, about 80 pages a month');
  await p.locator('#gd-back').click(); await p.locator('#gd-back').click(); // back to the tone question
  await p.locator('input[name="gd-tone"][value="gentle"]').check({ force: true }); await p.locator('#gd-skip').click(); await p.waitForSelector('#gd-calm');
  ok(await p.locator('#gd-calm').isChecked(), 'going back and choosing gentle makes the page set follow the tone again');
 
  await p.c.close();
}
{
  const p = await page({ hash: '#library' }); await atShelf(p); await openGuided(p);
  await p.locator('[data-starter="low-energy"]').click(); await p.waitForSelector('#gd-calm');
  ok(!(await p.locator('#gd-calm').isChecked()), 'a ready-made book is the full page set until the person asks for calm');
  await p.locator('#gd-calm').check({ force: true }); await p.waitForFunction(() => typeof ORG !== 'undefined' && !!ORG.base, null, { timeout: 15000 }).catch(() => {});
  await p.locator('#gd-next').click(); await p.waitForFunction(() => !document.querySelector('#guided').open || document.querySelector('#lib-confirm').open);
  if (await p.locator('#lib-confirm').evaluate((e) => e.open)) await p.locator('#lc-acts .btn.primary').click();
  await p.waitForFunction(() => !document.querySelector('#guided').open);
  const m = await p.evaluate(() => LB.lib.books.find((b) => b.title === 'Low-energy days').modules);
  ok(m && m.spoons === true && m.sky === false, 'a ready-made book keeps its own modules (spoons) when calm is added, and is named "Low-energy days"');
  await p.c.close();
}

// ---------- 7. a phone, the dark theme, and the pseudo-locales ----------
for (const [scheme, tag] of [['light', 'light'], ['dark', 'dark']]) {
  const p = await page({ w: 390, h: 800, scheme, hash: '#library' });
  await p.waitForFunction(() => document.documentElement.dataset.view === 'shelf'); await atShelf(p); await openGuided(p);
  const checkStep = async (name) => {
    const r = await p.evaluate(() => {
      const d = document.querySelector('#guided'), small = [];
      for (const el of d.querySelectorAll('button, input:not([type=hidden]), select, label.gd-opt')) { const r = el.getBoundingClientRect(), cs = getComputedStyle(el); if (!r.width || cs.visibility === 'hidden') continue; const tgt = el.matches('input[type=radio], input[type=checkbox]') ? el.closest('label').getBoundingClientRect() : r; if (tgt.height < 43.5 || tgt.width < 43.5) small.push(`${el.id || el.className || el.tagName} ${Math.round(tgt.width)}x${Math.round(tgt.height)}`); }
      const box = d.getBoundingClientRect();
      return { sw: document.documentElement.scrollWidth, dw: d.scrollWidth, cw: d.clientWidth, small, inView: box.left >= -1 && box.right <= innerWidth + 1 };
    });
    ok(r.sw <= 390 && r.dw <= r.cw + 1 && r.inView, `${tag} phone, ${name}: no sideways scroll`);
    ok(!r.small.length, `${tag} phone, ${name}: every control is a 44 px target` + (r.small.length ? ': ' + r.small.slice(0, 3).join(', ') : ''));
  };
  await checkStep('home'); await p.screenshot({ path: `${OUT}guided-phone-${tag}-home.png` });
  await p.locator('[data-gd="questions"]').click(); await checkStep('a question');
  await p.locator('#gd-next').click(); await p.locator('#gd-next').click(); await checkStep('the tracking question'); await p.screenshot({ path: `${OUT}guided-phone-${tag}-question.png` });
  await p.locator('#gd-skip').click(); await p.waitForSelector('#gd-title'); await p.waitForTimeout(700); await checkStep('the finished book'); await p.screenshot({ path: `${OUT}guided-phone-${tag}-review.png` });
  await p.c.close();
}
{
  for (const lang of ['en-XA', 'ar-XB']) {
    const p = await page({ hash: `?lang=${lang}#library` }); await atShelf(p); await openGuided(p);
    await p.locator('[data-gd="questions"]').click();
    for (let i = 0; i < 5; i++) await p.locator('#gd-next').click();
    await p.locator('#gd-back').click(); await p.locator('#gd-skip').click().catch(() => {});
    await p.evaluate(() => { vmSet('basic'); });
    const miss = await p.evaluate(() => window.KWI18N.missing());
    ok(!miss.length, `${lang}: every word of the guided start and the Basic view is in the catalog` + (miss.length ? ': ' + miss.slice(0, 4).join(', ') : ''));
    const txt = await p.evaluate(() => document.querySelector('#guided').textContent);
    ok(lang === 'ar-XB' ? await p.evaluate(() => document.documentElement.dir) === 'rtl' : /\[/.test(txt) || /[ÀàÉéÎîÖöÜü]/.test(txt), `${lang}: the sheet is translated`);
    if (lang === 'ar-XB') { const sw = await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth); ok(sw, 'ar-XB: no sideways scroll'); }
    await p.c.close();
  }
}

ok(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
await b.close(); srv.close();
console.log(fails.length ? `\n${fails.length} guided check(s) failed` : '\nguided: all checks passed');
process.exit(fails.length ? 1 : 0);
