// Accessibility checks for the editor (Day, Grid, Book, Versions drawer, dialogs, demo, Artifact) and the product site.
// CI runs it after the editor build (editor.yml). It FAILS on any finding that is not in KNOWN below, so what is fixed stays fixed;
// KNOWN is the documented allowlist of open findings (ids match docs/review/accessibility-audit.md). Later units delete entries as they fix them.
//   node render.mjs month 2026-10 test.ics && node editor/build.mjs && node editor/test-a11y.mjs [--report]
// Needs axe-core (devDependency) and Chromium. SORTABLE_JS=/path/Sortable.min.js serves the drag library offline (sandbox only).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { launch } from '../browser.mjs';
import { SAMPLE_LIBRARY } from './sample-library.mjs';

const REPORT = process.argv.includes('--report');
const DIST = new URL('./dist/', import.meta.url).pathname, PRODUCT = new URL('../../site/', import.meta.url).pathname;
const AXE = fs.readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');

// ---------- known open findings (the allowlist) ----------
// rule: the check that reports it. match: a regex on "where: message". id: the audit finding. unit: who closes it.
const KNOWN = [
  { rule: 'tabs-pattern', id: 'A11Y-16', match: /tab/i, why: 'the Blocks / + Add / Preview tabs have no aria-controls, no tabpanel and no arrow-key movement', unit: 'C4a navigation rewrite' },
  { rule: 'announce', id: 'A11Y-11', match: /grid move/i, why: 'a block moved in Grid mode by keyboard is not announced', unit: 'grid follow-up' },
  { rule: 'targets', id: 'A11Y-20', match: /grid box/i, why: 'one-row blocks in Grid mode are 21 px tall (the grid cell is the layout); keyboard and stepper alternatives exist', unit: 'grid follow-up' },
];

// ---------- server ----------
const T = { html: 'text/html', css: 'text/css', js: 'text/javascript', png: 'image/png', svg: 'image/svg+xml', json: 'application/json' };
const ROUTES = [['/site/', DIST + 'site/'], ['/demo/', DIST + 'demo/'], ['/product/', PRODUCT]];
const srv = http.createServer((q, r) => {
  const u = decodeURIComponent(q.url.split('?')[0]);
  let f = null;
  if (u === '/artifact/') f = DIST + 'artifact.html';
  for (const [pre, dir] of ROUTES) if (!f && u.startsWith(pre)) f = path.join(dir, u.slice(pre.length).replace(/\/$/, '/index.html') || 'index.html');
  if (!f) { r.writeHead(404); return r.end(); }
  fs.readFile(f.endsWith('/') ? f + 'index.html' : f, (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'Content-Type': T[f.split('.').pop()] || 'text/plain' }); r.end(d); } });
}).listen(0);
const ORIGIN = `http://127.0.0.1:${srv.address().port}`;
const b = await launch();

// ---------- findings ----------
const found = [];
const add = (rule, where, msg) => found.push({ rule, where, msg, key: `${where}: ${msg}` });

async function open(target, { hash = "", w = 1400, h = 900, scheme = 'light', reduce = false, forced = false, contrast = null, wait = 350, lib = false } = {}) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, colorScheme: scheme, reducedMotion: reduce ? 'reduce' : 'no-preference', forcedColors: forced ? 'active' : 'none' });
  const p = await ctx.newPage();
  await p.route(/fonts\.(googleapis|gstatic)/, (r) => r.abort());
  if (process.env.SORTABLE_JS) await p.route(/cdnjs\.cloudflare\.com/, (r) => r.fulfill({ path: process.env.SORTABLE_JS, contentType: 'text/javascript' }));
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  if (lib) await p.addInitScript((l) => { try { localStorage.setItem('kw-library', JSON.stringify(l)); } catch {} }, SAMPLE_LIBRARY); // the generic sample library (L1b): a library with two series and a standalone book
  await p.goto(`${ORIGIN}/${target}/${hash}`, { waitUntil: 'load' });
  if (contrast) await p.emulateMedia({ contrast });
  if (hash.startsWith("#day")) await p.waitForFunction((ed) => document.documentElement.dataset.view === "day" && (ed ? document.querySelectorAll("#list > li").length > 3 : document.querySelectorAll("#pv [data-b]").length >= 3), hash.endsWith("/edit"), { timeout: 15000 }); // (viewing has no block list)
  if (/^#(library|series)/.test(hash)) await p.waitForFunction(() => document.documentElement.dataset.view === 'shelf' && document.querySelectorAll('#sh-list .sh-item').length > 0, null, { timeout: 15000 });
  await p.waitForTimeout(wait);
  p.errs = errs; p.ctx = ctx;
  return p;
}
const close = (p) => p.ctx.close();

// ---------- helpers run inside the page ----------
const INTERACTIVE = 'button, a[href], input:not([type=hidden]), select, textarea, summary, [role=button], [role=switch], [role=tab], [tabindex]:not([tabindex="-1"])';
const EXEMPT = '#pv, #pv *, #bk-world, #bk-world *, .sr, input[type=checkbox], input[type=file], .demo a';
async function smallTargets(p, label, { min = 44, skipInline = false } = {}) {
  const bad = await p.evaluate(({ INTERACTIVE, EXEMPT, min, skipInline }) => {
    const out = {};
    for (const el of document.querySelectorAll(INTERACTIVE)) {
      if (el.matches(EXEMPT) || el.closest('[hidden]')) continue;
      const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
      if (skipInline && el.tagName === 'A' && el.closest('p, li:not(.nav *)') && getComputedStyle(el).display === 'inline') continue; // inline links in a sentence are exempt (WCAG 2.5.8)
      if (r.width < min - 0.5 || r.height < min - 0.5) {
        const name = el.classList.contains('gb') ? 'grid box' : (el.id ? '#' + el.id : el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/)[0] : ''));
        const k = `${name} ${Math.round(r.width)}x${Math.round(r.height)}`; out[k] = (out[k] || 0) + 1;
      }
    }
    return out;
  }, { INTERACTIVE, EXEMPT, min, skipInline });
  for (const [k, n] of Object.entries(bad)) add('targets', label, `${k} is under ${min} px (${n})`);
}
async function reflow(p, label) {
  const r = await p.evaluate(() => {
    const iw = document.documentElement.clientWidth, wide = [];
    for (const e of document.querySelectorAll('body *')) {
      if (e.closest('#pv, #bk-world, .paper, #ov, .gallery, .table-wrap, .code, nav, .sr, .skip')) continue;
      const cs = getComputedStyle(e), r = e.getBoundingClientRect();
      if (cs.position === 'fixed' || !r.width || cs.visibility === 'hidden') continue;
      if (r.right > iw + 1 || r.left < -1) wide.push(`${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''}${typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\s+/)[0] : ''} ${Math.round(r.left)}..${Math.round(r.right)}`);
    }
    return { sw: document.documentElement.scrollWidth, iw, wide: wide.slice(0, 3) };
  });
  if (r.sw > r.iw + 1) add('reflow', label, `page scrolls sideways (${r.sw} > ${r.iw})`);
  if (r.wide.length) add('reflow', label, `content past the edge: ${r.wide.join('; ')}`);
}
const AXE_LAND = new Set(['landmark-one-main', 'region', 'page-has-heading-one', 'document-title', 'landmark-unique', 'landmark-no-duplicate-main', 'landmark-main-is-top-level', 'html-has-lang', 'html-lang-valid', 'scrollable-region-focusable', 'bypass', 'skip-link', 'heading-order', 'landmark-banner-is-top-level', 'landmark-complementary-is-top-level']);
async function axeRun(p, label) {
  await p.evaluate(AXE);
  const res = await p.evaluate(() => axe.run({ runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] }));
  for (const v of res.violations) {
    const rule = v.id === 'color-contrast' ? 'contrast-axe' : AXE_LAND.has(v.id) ? 'landmarks' : 'names';
    add(rule, label, `${v.id} (${v.nodes.length}): ${v.nodes[0].target.join(' ')} ${(v.nodes[0].any[0] || v.nodes[0].all[0] || v.nodes[0].none[0] || {}).message || ''}`.slice(0, 220));
  }
}
async function focusRing(p, label, stops) {
  for (let i = 0; i < stops; i++) {
    await p.keyboard.press('Tab'); await p.waitForTimeout(450); // let smooth scrolling settle
    const r = await p.evaluate(() => {
      const el = document.activeElement; if (!el || el === document.body) return null;
      const cs = getComputedStyle(el), rect = el.getBoundingClientRect();
      const ring = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2 && cs.outlineColor !== 'rgba(0, 0, 0, 0)') || (cs.boxShadow !== 'none' && /\d/.test(cs.boxShadow));
      const cx = Math.min(innerWidth - 1, Math.max(0, rect.left + rect.width / 2)), cy = Math.min(innerHeight - 1, Math.max(0, rect.top + Math.min(rect.height / 2, 20))), top = document.elementFromPoint(cx, cy);
      const name = (el.id ? '#' + el.id : el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/)[0] : ''));
      return { name, ring, hidden: !!top && !el.contains(top) && !top.contains(el) };
    });
    if (!r) continue;
    if (!r.ring) add('focus', label, `${r.name} shows no focus indicator`);
    if (r.hidden) add('focus', label, `${r.name} is covered by other content when focused`);
  }
}
async function motionCheck(p, label) {
  const bad = await p.evaluate(() => {
    const out = new Set(), dur = (s) => s.split(',').some((x) => parseFloat(x) > 0);
    for (const e of document.querySelectorAll('*')) for (const ps of [null, '::before', '::after']) {
      const cs = getComputedStyle(e, ps); if (dur(cs.transitionDuration) && cs.transitionProperty !== 'none') out.add(`transition on ${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''}${typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\s+/)[0] : ''}`);
      if (cs.animationName !== 'none' && dur(cs.animationDuration)) out.add(`animation on ${e.tagName.toLowerCase()}${e.className ? '.' + String(e.className).split(' ')[0] : ''}`);
    }
    if (getComputedStyle(document.documentElement).scrollBehavior === 'smooth') out.add('smooth scrolling on the page');
    if (typeof ANIM !== 'undefined' && ANIM !== 0) out.add('Sortable slide animation (ANIM)');
    return [...out].slice(0, 4);
  });
  for (const m of bad) add('motion', label, `${m} with reduced motion on`);
}

// ---------- token contrast ----------
const full = (h) => (/^#[0-9a-f]{3}$/i.test(h) ? "#" + [...h.slice(1)].map((x) => x + x).join("") : h);
const DAY = '#day/2026-10-14/edit'; // the editor UI exists only while editing (E1); the view-mode checks are near the end
async function go(p, hash) { await p.evaluate((h) => { location.hash = h; }, hash); const v = hash.startsWith("#day") ? "day" : hash.startsWith("#page") ? "page" : /^#(library|series)/.test(hash) ? "shelf" : "book"; await p.waitForFunction((v) => document.documentElement.dataset.view === v, v, { timeout: 15000 }); await p.waitForTimeout(700); }
const lum = (h) => { h = full(h); const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const ratio = (a, c) => { const [x, y] = [lum(a), lum(c)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
const PAIRS = [['ink', 'bg', 4.5], ['ink', 'panel', 4.5], ['muted', 'bg', 4.5], ['muted', 'panel', 4.5], ['muted', 'soft', 4.5], ['accent-ink', 'accent', 4.5], ['warn', 'warn-bg', 4.5], ['warn', 'bg', 4.5], ['ok', 'bg', 4.5], ['danger', 'bg', 4.5],
  ['focus', 'bg', 3], ['focus', 'panel', 3], ['ctl', 'bg', 3], ['ctl', 'panel', 3], ['accent', 'bg', 3], ['accent', 'panel', 3]];
async function tokens() {
  const seen = {};
  for (const [name, scheme, contrast] of [['light', 'light', null], ['dark', 'dark', null], ['high-contrast light', 'light', 'more'], ['high-contrast dark', 'dark', 'more']]) {
    const p = await open('site', { hash: DAY, scheme, contrast, wait: 100 });
    const t = await p.evaluate(() => { const s = getComputedStyle(document.documentElement); return Object.fromEntries(['bg', 'panel', 'ink', 'muted', 'soft', 'accent', 'accent-ink', 'warn', 'warn-bg', 'ok', 'danger', 'focus', 'ctl'].map((k) => [k, s.getPropertyValue('--' + k).trim()])); });
    seen[name] = t;
    if (contrast && t.ctl === seen[scheme].ctl) add('tokens', name, 'prefers-contrast: more changes nothing (no high-contrast tokens)');
    for (const [f, g, min] of PAIRS) { if (!/^#[0-9a-f]{3,6}$/i.test(t[f]) || !/^#[0-9a-f]{3,6}$/i.test(t[g])) { add('tokens', name, `--${f} or --${g} is not a hex colour (${t[f]}, ${t[g]})`); continue; } const r = ratio(t[f], t[g]); if (r < min) add('tokens', name, `--${f} on --${g} is ${r.toFixed(2)}:1, needs ${min}:1`); }
    await close(p);
  }
}

// ---------- the walk ----------
const openAllOptions = (p) => p.evaluate(() => { openIds = new Set(layout.blocks.map((x) => x.uid).concat(layout.blocks.filter((x) => x.rows).flatMap((x) => x.rows.map((r) => 'r:' + r.id)))); drawList(); });

// 1) the Day editor on the working editor (pages mode): axe, targets, tokens, landmarks
{
  const p = await open('site', { hash: DAY });
  await axeRun(p, 'Day (desktop, light)');
  await openAllOptions(p); await smallTargets(p, 'Day desktop, every option open');
  const n = await p.evaluate(() => [...document.querySelectorAll('main, [role=main]')].filter((e) => e.offsetParent !== null).length);
  if (n !== 1) add('landmarks', 'Day', `${n} visible main landmarks (needs 1)`);
  const h1 = await p.evaluate(() => document.querySelectorAll('h1').length), lang = await p.evaluate(() => document.documentElement.lang);
  if (h1 !== 1) add('landmarks', 'Day', `${h1} h1 headings`);
  if (!lang) add('landmarks', 'Day', 'no lang on <html>');
  await focusRing(p, 'Day desktop', 34);
  // menu: Enter opens and lands on the first item, Escape closes and returns to the button
  await p.focus('#menubtn'); await p.keyboard.press('Enter');
  const inMenu = await p.evaluate(() => document.activeElement.getAttribute('role') === 'menuitem');
  if (!inMenu) add('keyboard', 'More menu', 'opening it from the keyboard does not move focus to the first item');
  await p.keyboard.press('ArrowDown');
  await p.keyboard.press('Escape');
  const back = await p.evaluate(() => document.activeElement.id === 'menubtn' && !document.querySelector('#menu.open'));
  if (!back) add('keyboard', 'More menu', 'Escape does not close it and return focus to the More button');
  await axeRun(p, 'Day (menu open)').catch(() => {});
  await close(p);
}
{
  const p = await open('site', { hash: DAY, scheme: 'dark' });
  await axeRun(p, 'Day (dark)');
  await close(p);
}
// 2) keyboard-only tasks: skip link, add a block, reorder, change an option, save a version
{
  const p = await open('site', { hash: DAY });
  if (!(await p.evaluate(() => { const first = document.querySelector('header a[href], header button, main button, [tabindex="0"]'); return first && first.classList.contains('skip'); }))) add('keyboard', 'Day', 'the first Tab stop is not a skip link');
  await p.focus('.skip-day'); await p.keyboard.press('Enter');
  if (!(await p.evaluate(() => document.activeElement.id === 'list' || !!document.activeElement.closest('#list')))) add('keyboard', 'Day', 'the skip link does not move focus to the block list');
  const types = () => p.evaluate(() => layout.blocks.map((x) => x.type));
  // add a block: Tab to a "+" button, Enter
  await p.focus('#pal [data-add="t:checks"]'); await p.keyboard.press('Enter');
  if (!(await types()).includes('checks')) add('keyboard', 'Add a block', 'Enter on a + button does not add the block');
  // reorder: focus a block's handle, ArrowDown
  const before = await types();
  await p.focus('#list > li:first-child .grip'); await p.keyboard.press('ArrowDown');
  const after = await types();
  if (after[1] !== before[0] || after[0] !== before[1]) add('keyboard', 'Reorder', 'ArrowDown on a block handle does not move the block down one place');
  if (!(await p.evaluate(() => document.activeElement.classList.contains('grip')))) add('keyboard', 'Reorder', 'focus is lost from the handle after a move');
  await p.waitForTimeout(150);
  if (!/moved to position 2 of/.test(await p.evaluate(() => (document.querySelector('#live') || {}).textContent || ''))) add('announce', 'Reorder', 'a keyboard move is not announced in the live region');
  // change an option: open a block's options, Space on a switch and Enter on a chip
  await p.focus('#list > li[data-uid="care"] .sw'); await p.keyboard.press('Space');
  if ((await p.getAttribute('#list > li[data-uid="care"] .sw', 'aria-checked')) !== 'false') add('keyboard', 'Option', 'Space on the show/hide switch does not toggle it');
  const ex0 = await p.getAttribute('#list > li[data-uid="care"] .more', 'aria-expanded');
  await p.focus('#list > li[data-uid="care"] .more'); await p.keyboard.press('Enter');
  if ((await p.getAttribute('#list > li[data-uid="care"] .more', 'aria-expanded')) === ex0) add('keyboard', 'Option', 'Enter on the options chevron does not open or close the options');
  // overflow warning is announced: fill the page
  await p.evaluate(() => { layout = normalize({ v: 2, blocks: [{ type: 'sky' }, { type: 'care' }, { type: 'habits' }, { type: 'checks' }, { type: 'scale' }, { type: 'energy' }, { type: 'body', uid: 'body' }, { type: 'actions' }] }); drawList(); drawPreview(); });
  await p.waitForTimeout(200);
  const warn = await p.evaluate(() => document.querySelector('#meter .warn') ? ((document.querySelector('#live') || {}).textContent || '') : 'no-warning');
  if (warn === '') add('announce', 'Overflow warning', 'the too-full warning is not announced');
  await close(p);
}
{ // versions: keyboard save, focus stays in the drawer, Escape returns focus
  const p = await open('site', { hash: DAY });
  await p.focus('#v-ver'); await p.keyboard.press('Enter'); await p.waitForTimeout(300);
  if (!(await p.evaluate(() => !!document.activeElement.closest('#versions')))) add('keyboard', 'Versions drawer', 'opening it does not move focus inside');
  await axeRun(p, 'Versions drawer');
  await smallTargets(p, 'Versions drawer');
    await p.fill('#vs-msg', 'Checked with the keyboard'); await p.keyboard.press('Enter'); await p.waitForTimeout(600);
  const saved = await p.evaluate(() => document.querySelector('#vs-log').innerText.includes('Checked with the keyboard'));
  if (!saved) add('keyboard', 'Versions drawer', 'typing a message and pressing Enter does not save a version');
  for (let i = 0; i < 25; i++) await p.keyboard.press('Tab');
  if (!(await p.evaluate(() => !!document.activeElement.closest('#versions') || document.activeElement === document.body))) add('keyboard', 'Versions drawer', 'Tab leaves the open drawer (focus is not contained)');
  await p.focus('#vs-msg'); await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  if ((await p.evaluate(() => document.activeElement.id)) !== 'v-ver') add('keyboard', 'Versions drawer', 'Escape does not return focus to the Versions button');
  await close(p);
}
// 3) Grid mode
{
  const p = await open('site', { hash: DAY });
  await p.click('#lay-g'); await p.waitForTimeout(200);
  await axeRun(p, 'Grid'); await smallTargets(p, 'Grid');
  await p.evaluate(() => change((L) => { L.blocks = L.blocks.filter((x) => x.type !== 'care'); })); await p.waitForTimeout(150); // frees rows above the writing space
  await p.focus('#ov .gb[data-uid="body"]');
  const say = () => p.evaluate(() => ((document.querySelector('#live') || {}).textContent || '') + '|' + document.querySelector('#toast').textContent), lab = () => p.evaluate(() => document.activeElement.getAttribute('aria-label') || '');
  let moved = false;
  for (const k of ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp']) { // find an arrow that really moves the block, then see whether anything says so
    const l0 = await lab(), s0 = await say(); await p.keyboard.press(k); await p.waitForTimeout(150);
    if ((await lab()) !== l0) { moved = true; if ((await say()) === s0) add('announce', 'Grid', `grid move is not announced (${l0.slice(0, 30)}…)`); break; }
  }
  if (!moved) add('keyboard', 'Grid', 'no arrow key moved the focused block');
  await close(p);
}
// 3b) Scan settings (scan.mjs): the sheet open with the border and the code changed, on a desktop and a phone; switches and chips named, 44px, keyboard operable, warnings announced
for (const w of [1400, 390]) {
  const p = await open('site', { hash: DAY, w, h: 900 });
  await p.click('#scan-t'); await p.waitForTimeout(150);
  await p.click('[data-sc="frame"]'); await p.waitForTimeout(150);
  await axeRun(p, `Scan settings (${w}px)`); await smallTargets(p, `Scan settings (${w}px)`); await reflow(p, `Scan settings ${w}px`);
  const names = await p.evaluate(() => [...document.querySelectorAll('#scan [role=switch], #scan .chip, #scan .scan-t')].filter((x) => !(x.getAttribute('aria-label') || x.textContent.trim() || (x.getAttribute('aria-labelledby') && document.getElementById(x.getAttribute('aria-labelledby')).textContent.trim()))).length);
  if (names) add('names', `Scan settings ${w}px`, `${names} control(s) have no accessible name`);
  const live = await p.evaluate(() => { const n = document.getElementById('scan-notes'); return n && n.getAttribute('aria-live') === 'polite' && /scanning border is off/.test(n.textContent); });
  if (!live) add('announce', `Scan settings ${w}px`, 'switching the border off is not stated in a live region');
  // keyboard: a switch works with Space and keeps the focus
  await p.focus('#scan [data-sc="frame"]'); await p.keyboard.press('Space'); await p.waitForTimeout(150);
  const back = await p.evaluate(() => !layout.scan && document.activeElement && document.activeElement.dataset.sc === 'frame');
  if (!back) add('keyboard', `Scan settings ${w}px`, 'Space on the border switch does not toggle it and keep the focus');
  await close(p);
}
// 4) Book view
{
  const p = await open('site', { wait: 1500 }); // the editor opens on the Book
  await axeRun(p, 'Book view'); await smallTargets(p, 'Book view'); await focusRing(p, 'Book view', 8);
  const main = await p.evaluate(() => [...document.querySelectorAll('main, [role=main]')].filter((e) => e.offsetParent !== null).length);
  if (main !== 1) add('landmarks', 'Book view', `${main} visible main landmarks (needs 1)`);
  await p.focus('#bk-view');
  const live = () => p.evaluate(() => [...document.querySelectorAll('[aria-live]:not([aria-live=off]), [role=status]')].map((e) => e.textContent).join('|'));
  const l0 = await live(); await p.keyboard.press('1'); await p.waitForTimeout(500); const l1 = await live(); await p.keyboard.press('2'); await p.waitForTimeout(500); const l2 = await live();
  if (l0 === l1 && l1 === l2) add('announce', 'Book view', 'book level changes (keys 0, 1, 2) are not announced');
  await p.keyboard.press(']'); await p.waitForTimeout(300);
  if (!/Page \d/.test(await p.textContent('#bk-info'))) add('keyboard', 'Book view', 'the ] key does not select a page and report it');
  await go(p, '#page/safety'); await axeRun(p, 'Page view'); await smallTargets(p, 'Page view');
  const pm = await p.evaluate(() => [...document.querySelectorAll('main, [role=main]')].filter((e) => e.offsetParent !== null).length); if (pm !== 1) add('landmarks', 'Page view', `${pm} visible main landmarks (needs 1)`);
  await close(p);
}
// 4b) Library and Series (L1b): the shelves, the level above the book, and the settings sheets
for (const [w, scheme] of [[1400, 'light'], [1400, 'dark'], [390, 'light'], [390, 'dark']]) {
  for (const hash of ['#library', '#series/seasons']) {
    const lv = hash.slice(1).split('/')[0], tag = `${lv === 'library' ? 'Library' : 'Series'} (${w}px ${scheme})`;
    const p = await open('site', { hash, w, h: 900, scheme, lib: true });
    await axeRun(p, tag); await reflow(p, tag); await smallTargets(p, tag);
    const main = await p.evaluate(() => [...document.querySelectorAll('main, [role=main]')].filter((e) => e.offsetParent !== null).length);
    if (main !== 1) add('landmarks', tag, `${main} visible main landmarks (needs 1)`);
    if (w === 1400 && scheme === 'light') {
      // the level is announced, Enter goes in, Escape comes out and puts focus back on the cover it came from
      const say = () => p.evaluate(() => document.querySelector('#nav-live').textContent);
      if (!/^Now at: Library/.test(await say())) add('announce', tag, 'the level is not announced ("Now at: Library ...")');
      const first = await p.evaluate(() => document.activeElement && document.activeElement.classList.contains('sh-open'));
      if (!first) add('keyboard', tag, 'focus does not land on a cover when the level opens');
      const key = await p.evaluate(() => document.activeElement.closest('.sh-item') && document.activeElement.closest('.sh-item').dataset.key);
      await p.keyboard.press('Enter'); await p.waitForTimeout(900);
      if ((await p.evaluate(() => NAV.level)) === lv) add('keyboard', tag, 'Enter on a cover does not go in one level');
      await p.keyboard.press('Escape'); await p.waitForTimeout(900);
      if ((await p.evaluate(() => NAV.level)) !== lv) add('keyboard', tag, 'Escape does not go back out one level');
      if ((await p.evaluate(() => { const c = document.activeElement.closest('.sh-item'); return c ? c.dataset.key : ''; })) !== key) add('keyboard', tag, 'coming back out does not put focus on the cover it left');
      // skip link and arrow keys
      await p.focus('.skip-shelf'); await p.keyboard.press('Enter');
      if (!(await p.evaluate(() => !!document.activeElement.closest('#sh-list')))) add('skip-link', tag, 'the skip link does not move focus to the shelf');
      const a0 = await p.evaluate(() => document.activeElement.getAttribute('aria-label')); await p.keyboard.press('ArrowRight');
      if (a0 === (await p.evaluate(() => document.activeElement.getAttribute('aria-label')))) add('keyboard', tag, 'ArrowRight does not move to the next cover');
      await close(p);
      const q = await open('site', { hash, w, h: 900, scheme, lib: true }); await focusRing(q, tag, 10); await close(q);
      continue;
    }
    await close(p);
  }
}
{ // edit mode: the settings sheets, the delete question, undo; keyboard order
  const p = await open('site', { hash: '#library/edit', lib: true });
  await axeRun(p, 'Library, editing'); await smallTargets(p, 'Library, editing');
  await p.click('#sh-list .sh-item[data-id="seasons"] [data-act="settings"]'); await p.waitForTimeout(250);
  if (!(await p.evaluate(() => document.querySelector('#lib-sheet').open && !!document.activeElement.closest('#lib-sheet')))) add('keyboard', 'Series settings sheet', 'opening it does not move focus inside');
  await axeRun(p, 'Series settings sheet'); await smallTargets(p, 'Series settings sheet');
  await p.focus('#ss-order li:first-child [data-mv="1"]'); await p.keyboard.press('Enter'); await p.waitForTimeout(150);
  if (!/Autumn is now book 2 of 3/.test(await p.evaluate(() => document.querySelector('#live').textContent))) add('announce', 'Series order', 'moving a book with the arrow buttons is not announced');
  if (!(await p.evaluate(() => !!document.activeElement.closest('#ss-order')))) add('keyboard', 'Series order', 'focus is lost after moving a book');
  await p.keyboard.press('Escape'); await p.waitForTimeout(250);
  if (!(await p.evaluate(() => !document.querySelector('#lib-sheet').open && !!document.activeElement.closest('#sh-list')))) add('keyboard', 'Series settings sheet', 'Escape does not close the sheet and return focus to the shelf');
  await p.click('#sh-list .sh-item[data-id="northlight"] [data-act="settings"]'); await p.waitForTimeout(250);
  await axeRun(p, 'Book settings sheet'); await smallTargets(p, 'Book settings sheet');
  await p.fill('#bs-title', ''); await p.click('#ls-save'); await p.waitForTimeout(150);
  if (!(await p.evaluate(() => { const e = document.querySelector('#ls-errs'); return !e.hidden && e.getAttribute('role') === 'alert' && /title/i.test(e.textContent); }))) add('announce', 'Book settings sheet', 'a problem with the title is not shown in an alert');
  await p.click('#bs-del'); await p.waitForTimeout(250);
  await axeRun(p, 'Delete question'); await smallTargets(p, 'Delete question');
  await p.keyboard.press('Escape'); await p.waitForTimeout(150);
  await p.click('#ls-cancel'); await p.waitForTimeout(150);
  await close(p);
  const q = await open('site', { hash: '#library/edit', w: 390, h: 844, lib: true });
  await q.click('#sh-list .sh-item[data-id="seasons"] [data-act="settings"]'); await q.waitForTimeout(250);
  await reflow(q, 'Series settings sheet 390px'); await smallTargets(q, 'Series settings sheet 390px');
  await close(q);
  const r = await open('site', { hash: '#book/northlight/edit', lib: true, wait: 900 });
  await axeRun(r, 'Book, editing'); await smallTargets(r, 'Book, editing');
  await close(r);
  const m = await open('site', { hash: '#library', lib: true, reduce: true });
  await motionCheck(m, 'Library'); await go(m, '#series/seasons'); await motionCheck(m, 'Series');
  await close(m);
}
// 4c) Page organiser (C4): the Book in edit mode: panel, selected-page toolbar, Move to, the pointer warning. Desktop and phone, light and dark.
for (const [w, scheme, h] of [[1400, 'light', 900], [1400, 'dark', 900], [390, 'light', 844], [390, 'dark', 844]]) {
  const p = await open('site', { hash: '#book/edit', w, h, scheme, wait: 1200 });
  await p.waitForFunction(() => typeof ORG !== 'undefined' && ORG.on);
  const L = `Page organiser ${w}px ${scheme}`;
  await p.evaluate(() => bkSelect(BK.pages.findIndex((x) => x.id === 'bus.net.1') + 1));
  await axeRun(p, L + ', toolbar'); await smallTargets(p, L + ', toolbar'); await reflow(p, L + ', toolbar');
  if (w === 390) { await p.evaluate(() => document.querySelector('#og-toggle').click()); await p.waitForTimeout(250); }
  await axeRun(p, L); await smallTargets(p, L); await reflow(p, L);
  if (w === 1400 && scheme === 'light') {
    await focusRing(p, L, 12);
    // a move by keyboard is announced, and focus stays where the person is
    await p.focus('#bk-view'); const before = await p.textContent('#org-live'); await p.keyboard.press('Alt+ArrowLeft'); await p.waitForTimeout(250);
    const after = await p.textContent('#org-live');
    if (before === after || !/Moved .* to page \d+/.test(after)) add('announce', L, 'moving a page with Alt+Left is not announced ("Moved … to page N")');
    if (!(await p.evaluate(() => document.activeElement.id === 'bk-view'))) add('keyboard', L, 'focus is lost from the canvas after a keyboard move');
    // a move from the list keeps focus on the same button
    await p.focus('#og-list [data-fk="up:lineage"]'); await p.keyboard.press('Enter'); await p.waitForTimeout(250);
    if (!(await p.evaluate(() => document.activeElement.dataset.fk === 'up:lineage'))) add('keyboard', L, 'focus is lost from the row button after a move in the list');
    // a locked page explains itself to a screen reader (aria-describedby) and a refused action is announced
    await p.focus('#og-list [data-fk="eye:safety"]');
    if (!(await p.evaluate(() => { const b = document.activeElement, d = document.getElementById(b.getAttribute('aria-describedby') || '-'); return b.getAttribute('aria-disabled') === 'true' && !!d && /never be hidden/.test(d.textContent); }))) add('names', L, 'the lock on a protected page has no reason for a screen reader');
    await p.keyboard.press('Enter'); await p.waitForTimeout(250);
    if (!/never be hidden/.test(await p.textContent('#org-live'))) add('announce', L, 'pressing the lock does not announce why the page cannot be hidden');
    // the Move to… dialog
    await p.evaluate(() => bkSelect(BK.pages.findIndex((x) => x.id === 'bus.net.1') + 1)); await p.click('#os-moveto'); await p.waitForTimeout(250);
    await axeRun(p, L + ', Move to dialog'); await smallTargets(p, L + ', Move to dialog');
    if (!(await p.evaluate(() => document.querySelector('#org-move').contains(document.activeElement)))) add('focus', L, 'the Move to… dialog does not take focus');
    await p.keyboard.press('Escape'); await p.waitForTimeout(200);
    if (!(await p.evaluate(() => document.activeElement.id === 'os-moveto'))) add('focus', L, 'closing Move to… does not return focus to its button');
    // the warning about a pointer with nowhere to go
    await p.evaluate(() => { ORG.cat.occ.week_left.forEach((o) => o.forEach((s) => { if (s.html) s.html += '{{P_BUS}}'; else s.variants = s.variants.map((x) => x + '{{P_BUS}}'); })); orgRender(null); bkSelect(BK.pages.findIndex((x) => x.id === 'bus.net.1') + 1); });
    await p.click('#os-eye'); await p.waitForSelector('#org-warn[open]'); await axeRun(p, L + ', pointer warning'); await smallTargets(p, L + ', pointer warning');
    if (!(await p.evaluate(() => document.querySelector('#org-warn').contains(document.activeElement)))) add('focus', L, 'the pointer warning does not take focus');
    await p.click('#ow-go'); await p.waitForTimeout(250);
    await axeRun(p, L + ', pointer warning shown in the panel');
    if (!(await p.evaluate(() => document.querySelector('#og-missing')?.getAttribute('role') === 'alert'))) add('announce', L, 'the list of pointers with nowhere to go is not an alert');
  }
  await close(p);
}
{
  const p = await open('site', { hash: '#book/edit', reduce: true, wait: 1000 }); await p.waitForFunction(() => ORG.on);
  await p.evaluate(() => bkSelect(20)); await motionCheck(p, 'Page organiser'); await close(p);
}
// 5) mobile: tabs, dialogs, reflow, targets
for (const w of [320, 390]) {
  const p = await open('site', { hash: DAY, w, h: 800 });
  for (const t of ['edit', 'add', 'preview']) {
    await p.evaluate((t) => tab(t), t); await p.waitForTimeout(120);
    await reflow(p, `Day ${w}px, ${t} tab`);
    if (w === 390) await smallTargets(p, `Day ${w}px, ${t} tab`);
  }
  if (w === 390) {
    await axeRun(p, 'Day (390px)');
    const tabsOk = await p.evaluate(() => [...document.querySelectorAll('.tabs [role=tab]')].every((x) => x.getAttribute('aria-controls')));
    if (!tabsOk) add('tabs-pattern', 'Day 390px', 'tab buttons have no aria-controls / tabpanel');
    await p.focus('.tabs [role=tab][aria-selected=true]'); await p.keyboard.press('ArrowRight');
    if ((await p.evaluate(() => document.querySelector('.tabs [aria-selected=true]').dataset.tab)) === 'edit') add('tabs-pattern', 'Day 390px', 'ArrowRight does not move to the next tab');
  }
  await p.evaluate(() => { tab('edit'); openAllOptions_(); function openAllOptions_() { openIds = new Set(layout.blocks.map((x) => x.uid)); drawList(); } });
  await reflow(p, `Day ${w}px, every option open`);
  await go(p, '#book'); await reflow(p, `Book ${w}px`);
  if (w === 390) await smallTargets(p, 'Book 390px');
  await go(p, DAY);
  await p.click('#v-ver'); await p.waitForTimeout(300); await reflow(p, `Versions drawer ${w}px`);
  if (w === 390) await smallTargets(p, 'Versions drawer 390px');
  await close(p);
}
{ // dialogs, the demo and the Artifact build
  const p = await open('site', { hash: DAY });
  await p.evaluate(() => document.querySelector('#gh').showModal()); await axeRun(p, 'Save to GitHub dialog'); await smallTargets(p, 'Save to GitHub dialog', {});
  await close(p);
  const q = await open('site', { hash: DAY });
  await q.click('#menubtn'); await q.click('#m-method'); await q.waitForTimeout(200); await axeRun(q, 'Methods dialog'); await smallTargets(q, 'Methods dialog');
  await close(q);
  const d = await open('demo');
  await axeRun(d, 'Demo'); await smallTargets(d, 'Demo');
  const dl = await d.evaluate(() => document.documentElement.lang); if (!dl) add('landmarks', 'Demo', 'no lang on <html>');
  await close(d);
  const a = await open('artifact');
  await axeRun(a, 'Artifact build (Day)');
  if (!(await a.evaluate(() => document.documentElement.lang))) add('landmarks', 'Artifact build', 'no lang on <html>');
  await close(a);
}
// 6) reduced motion, forced colors, high contrast
{
  const p = await open('site', { hash: DAY, reduce: true });
  await motionCheck(p, 'Day');
  await go(p, '#book'); await p.focus('#bk-view'); await p.keyboard.press('2'); await p.waitForTimeout(150);
  await motionCheck(p, 'Book view');
  await go(p, DAY); await p.click('#v-ver'); await p.waitForTimeout(300);
  await motionCheck(p, 'Versions drawer');
  await close(p);
  const f = await open('site', { hash: DAY, forced: true });
  const st = await f.evaluate(() => { const on = document.querySelector('.sw[aria-checked=true]'), off = document.querySelector('.sw[aria-checked=false]'); const bg = (e) => getComputedStyle(e, '::before').backgroundColor + '|' + getComputedStyle(e, '::after').backgroundColor; const pr = document.querySelector('.seg button[aria-pressed=true]'), np = document.querySelector('.seg button[aria-pressed=false]');
    return { sw: on && off ? bg(on) !== bg(off) : null, seg: pr && np ? getComputedStyle(pr).backgroundColor !== getComputedStyle(np).backgroundColor : null }; });
  if (st.sw === false) add('forced-colors', 'Day', 'switch on and off look the same in forced-colors mode');
  if (st.seg === false) add('forced-colors', 'Day', 'pressed and unpressed buttons look the same in forced-colors mode');
  await close(f);
}
// 6b) view mode (E1): the day for viewing has the same rules; nothing editable is in the page
for (const [w, scheme] of [[1400, 'light'], [1400, 'dark'], [390, 'light'], [390, 'dark']]) {
  const p = await open('site', { hash: '#day/2026-10-14', w, h: 900, scheme });
  await p.waitForFunction(() => document.documentElement.dataset.mode === 'view' && document.querySelectorAll('#pv [data-b]').length >= 3);
  await axeRun(p, `Day, viewing (${w}px ${scheme})`); await reflow(p, `Day, viewing ${w}px`); await smallTargets(p, `Day, viewing ${w}px`);
  if (w === 1400 && scheme === 'light') {
    await focusRing(p, 'Day, viewing', 8);
    await p.focus('.skip-view'); await p.keyboard.press('Enter');
    if (!(await p.evaluate(() => document.activeElement && document.activeElement.id === 'paper'))) add('skip-link', 'Day, viewing', 'the skip link does not move focus to the page');
    if (await p.evaluate(() => document.querySelector('.skip-day').offsetParent !== null || getComputedStyle(document.querySelector('.skip-day')).display !== 'none')) add('skip-link', 'Day, viewing', 'the blocks skip link shows while viewing');
  }
  await close(p);
}
await tokens();
// 7) the product site (site/): axe, reflow, targets, focus, reduced motion
for (const [w, scheme] of [[1280, 'light'], [390, 'light'], [320, 'dark']]) {
  const p = await open('product', { w, h: 900, scheme });
  await axeRun(p, `Product site ${w}px ${scheme}`); await reflow(p, `Product site ${w}px`); await smallTargets(p, `Product site ${w}px`, { skipInline: true });
  if (w === 1280) await focusRing(p, 'Product site', 14);
  await close(p);
}
{
  const p = await open('product', { reduce: true }); await motionCheck(p, 'Product site'); await close(p);
}
await b.close(); srv.close();

// ---------- verdict ----------
const used = new Set(), fails = [], known = [];
for (const f of found) {
  const k = KNOWN.find((x) => x.rule === f.rule && x.match.test(f.key));
  if (k) { used.add(k); known.push({ ...f, id: k.id }); } else fails.push(f);
}
const stale = KNOWN.filter((k) => !used.has(k));
const uniq = (a) => [...new Map(a.map((x) => [x.rule + x.key, x])).values()];
console.log(`a11y: ${fails.length} new finding(s), ${known.length} known (allowlisted), ${stale.length} stale allowlist entr${stale.length === 1 ? 'y' : 'ies'}`);
for (const f of uniq(fails)) console.log(`FAIL [${f.rule}] ${f.key}`);
if (REPORT || fails.length) for (const f of uniq(known)) console.log(`known ${f.id} [${f.rule}] ${f.key}`);
for (const k of stale) console.log(`note: allowlist entry ${k.id} (${k.rule}) no longer occurs: fixed? delete it from KNOWN`);
if (fails.length) process.exit(1);
console.log('ok   accessibility checks: nothing new');
