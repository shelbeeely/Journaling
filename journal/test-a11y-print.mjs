// Print accessibility options check (CI: books.yml): the large-print layout and the high-contrast ink option (a11yprint.mjs, A11Y-40/41).
//   - off (absent, or both false) is the default book, byte for byte: the same pages, the same layout.json, no override CSS;
//   - on, every page passes check.mjs "[] 0" in both trims (and hardcover), there is no Type 3 font, the page count does not change, and the scan
//     zones (DATE / TITLE / TAGS header, 9 pt frame, SEND TO strip, page code) sit exactly where they did;
//   - large print really is bigger (type, rows, write-in lines, rules), high contrast leaves no grey text or rule;
//   - a plan book with the options on still splits into volumes within the KDP page limits, the same volumes as without them;
//   - the options come from profile.json, and the day layout's own `print` setting (the editor's Settings panel) wins.
//   node test-a11y-print.mjs          (builds into out/a11y-print-test/, a few minutes)
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { printProblems, cleanPrint, printOptions, printOn, printCss, largeCss, contrastCss, largeLayout, LARGE_STEPS, LARGE_FLOOR } from './a11yprint.mjs';
import { normalize, DEFAULT_LAYOUT, dayBlocks } from './daypage.mjs';
import { launch } from './browser.mjs';

let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };
const read = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'kw-a11yprint-'));
process.on('exit', () => fs.rmSync(TMP, { recursive: true, force: true }));
const ROOT = 'out/a11y-print-test';
fs.rmSync(ROOT, { recursive: true, force: true });
const EXAMPLE = read('content/profile.example.json');

// ---- pure: validation, precedence, the layout rules ----
{
  ok(printProblems(undefined).length === 0 && printProblems({}).length === 0 && printProblems({ large_print: true, high_contrast: false }).length === 0, 'valid print sections');
  ok(printProblems({ large_print: 'yes' }).length === 1 && printProblems({ nope: true }).length === 1 && printProblems(true).length === 1, 'invalid print sections are named');
  ok(cleanPrint(undefined) === undefined && cleanPrint({ large: false, contrast: false }) === undefined && JSON.stringify(cleanPrint({ large: true, x: 1 })) === '{"large":true}', 'the layout setting keeps only what is on');
  ok(!printOn(printOptions(undefined, undefined)) && printOptions({ large_print: true }, undefined).large && printOptions(undefined, { contrast: true }).contrast && printOptions({ large_print: true }, { contrast: true }).large, 'options: the profile and the layout add up');
  ok(printCss('.a{font-size:7pt}', { large: false, contrast: false }) === '', 'no option, no CSS');
  const css = '.x { font-size: 7pt; color: #555 } .hz { font-size: 7pt } .y { font: 600 7.5pt Inter, sans-serif; border-bottom: 1px solid #a0a0a0 } h1 { font-size: 34pt } .z { font-size: 12pt }';
  const L = largeCss(css), C = contrastCss(css);
  ok(/\.x \{ font-size: max\(/.test(L) && /\.y \{ font: 600 max\(/.test(L), 'large print: point sizes are rewritten (font-size and the font shorthand)');
  ok(!/\.hz/.test(L) && !/h1 /.test(L), 'large print: the scan header is never touched and page titles keep their size');
  ok(/\.z \{ font-size: calc\(12pt \* \(1 \+ \(var\(--ls\) - 1\) \* 0\.5\)\)/.test(L), 'large print: headings grow by half as much');
  ok(/\.x \{ color: #000 \}/.test(C) && /\.y \{ border-bottom: 1px solid #000 \}/.test(C) && !/\.hz/.test(C), 'high contrast: grey text and rules become black');
  ok(LARGE_STEPS[0] > LARGE_STEPS.at(-1) && LARGE_STEPS.at(-1) === 1 && LARGE_FLOOR >= 8, 'the steps run down to the page as it is today');
  const L2 = largeLayout(normalize(null));
  ok(!L2.blocks.find((b) => b.type === 'fact').on && L2.blocks.find((b) => b.type === 'actions').count === 2 && L2.blocks.find((b) => b.type === 'body').style === 'lines', 'large layout: no "On this day", two action lines, a ruled writing space');
  const care = L2.blocks.find((b) => b.type === 'care'), row = (id) => care.rows.find((r) => r.id === id);
  ok(row('checkin').steps === 5 && row('water').count === 6, 'large layout: a 5-step mood scale and 6 water boxes');
  ok(JSON.stringify(normalize(null)) === JSON.stringify(normalize(DEFAULT_LAYOUT)) && !('print' in normalize(null)) && !('print' in normalize({ v: 2, print: { large: false } })), 'the default layout carries no print setting');
  ok(JSON.stringify(normalize({ v: 2, print: { large: true, contrast: true, junk: 1 } }).print) === '{"large":true,"contrast":true}', 'a layout keeps print.large and print.contrast, nothing else');
  const g = normalize({ v: 2, grid: true, blocks: DEFAULT_LAYOUT.blocks.map((b, i) => ({ ...b, col: 1, row: 1 + i, colSpan: 4, rowSpan: 1 })) });
  ok(largeLayout(g) === g, 'a Grid layout is left as it was placed');
  const flowHtml = (L) => dayBlocks({ header: '', routines: [] }, L, { size: 'small' });
  ok(flowHtml(normalize(null)) === flowHtml(DEFAULT_LAYOUT), 'the default layout renders as before');
}

// ---- builds ----
const prof = (name, edit) => { const p = structuredClone(EXAMPLE); edit(p); const f = path.join(TMP, `${name}.json`); fs.writeFileSync(f, JSON.stringify(p)); return f; };
const P = {
  base: path.resolve('content/profile.example.json'),
  off: prof('off', (p) => { p.print = { large_print: false, high_contrast: false }; }),
  large: prof('large', (p) => { p.print = { large_print: true, high_contrast: false }; }),
  contrast: prof('contrast', (p) => { p.print = { large_print: false, high_contrast: true }; }),
  both: prof('both', (p) => { p.print = { large_print: true, high_contrast: true }; }),
};
const build = (key, size, extra = {}, tag = key) => {
  const out = `${ROOT}/${tag}`;
  const log = execFileSync('node', ['render.mjs', 'month', '2026-10', 'test.ics'], { env: { ...process.env, KW_PROFILE: P[key] || key, KW_OUT: out, SIZE: size, ...extra }, stdio: 'pipe' }).toString();
  return { dir: `${out}/m2026-10${size === 'letter' ? '-letter' : ''}`, out, log };
};
const check = (b) => execFileSync('node', ['check.mjs', path.basename(b.dir)], { env: { ...process.env, KW_OUT: b.out }, stdio: 'pipe' }).toString().trim();
const html = (b) => fs.readFileSync(`${b.dir}/journal.html`, 'utf8');
const pagesOf = (h) => h.split('<body>')[1].split('<script>')[0].split(/<div class="page /).slice(1).map((x) => x.replace(/Built \d{4}-\d{2}-\d{2}/, 'Built DATE').replace(/ data-ls="[\d.]+"/, ''));
const hash = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 10);
const layoutOf = (b) => read(`${b.dir}/layout.json`);
const type3 = (b) => execFileSync('pdffonts', [fs.readdirSync(b.dir).map((f) => `${b.dir}/${f}`).find((f) => /interior.*\.pdf$/.test(f))], { stdio: 'pipe' }).toString().split('\n').filter((l) => / Type 3 /.test(l) || /\bType 3\b/.test(l)).length;
const pdfPages = (b, hard = false) => +fs.readFileSync(`${b.dir}/pages${hard ? '-hardcover' : ''}.txt`, 'utf8');

const built = {};
for (const size of ['small', 'letter']) {
  for (const key of ['base', 'off', 'large', 'contrast', 'both']) {
    if (size === 'letter' && !['base', 'large', 'both'].includes(key)) continue;
    built[`${key}/${size}`] = build(key, size);
  }
}

// P1: off is the default book, byte for byte.
for (const size of ['small', 'letter']) {
  const a = built[`base/${size}`], o = size === 'small' ? built[`off/${size}`] : null;
  const ha = html(a);
  ok(!/print-a11y|data-a11y/.test(ha.split('<script>')[0]), `${size}: a book with no print options has no override CSS and no data-a11y`);
  if (o) {
    const ho = html(o);
    ok(JSON.stringify(pagesOf(ha).map(hash)) === JSON.stringify(pagesOf(ho).map(hash)), `${size}: both options false builds exactly the same pages`);
    ok(fs.readFileSync(`${a.dir}/layout.json`, 'utf8') === fs.readFileSync(`${o.dir}/layout.json`, 'utf8'), `${size}: both options false gives a byte-identical layout.json`);
    ok(!/print-a11y|data-a11y/.test(ho.split('<script>')[0]), `${size}: and no override CSS`);
  }
}

// P2: every option combination passes the overflow gate, has no Type 3 font, keeps the page count and the structure.
const ZONES = new Set(['date', 'title', 'tags', 'page_code', 'send_to']);
const fixedParts = (L) => L.pages.map((p) => ({ frame: p.frame_inner_mm, code: p.code_at_mm, zones: p.zones.filter((z) => ZONES.has(z.zone) || z.zone.startsWith('send_to')) }));
for (const [key, b] of Object.entries(built)) {
  const [opt, size] = key.split('/');
  if (opt === 'base' || opt === 'off') continue;
  const res = check(b);
  ok(/^\[\] 0$/.test(res), `${key}: check.mjs "${res}"`);
  ok(type3(b) === 0, `${key}: no Type 3 fonts`);
  const base = built[`base/${size}`], L0 = layoutOf(base), L1 = layoutOf(b);
  ok(pdfPages(b) === pdfPages(base) && pdfPages(b) % 2 === 0 && pdfPages(b) >= 24 && pdfPages(b) <= 110, `${key}: ${pdfPages(b)} pages, as many as the default book, within KDP's 24 to 110`);
  ok(JSON.stringify(L1.pages.map((p) => [p.page, p.id, p.type, p.code])) === JSON.stringify(L0.pages.map((p) => [p.page, p.id, p.type, p.code])) && JSON.stringify(L1.trim_in) === JSON.stringify(L0.trim_in) && L1.border_pt === 9, `${key}: the same pages, ids and scan codes, trim and 9 pt frame`);
  ok(JSON.stringify(fixedParts(L1)) === JSON.stringify(fixedParts(L0)), `${key}: the DATE / TITLE / TAGS header, the SEND TO strip, the page code and the frame sit exactly where they did (every page)`);
  const nz = L1.pages.filter((p) => p.type === 'dayp').every((p) => ['date', 'title', 'tags', 'care', 'body', 'action_items', 'review'].every((z) => p.zones.some((x) => x.zone === z)));
  ok(nz, `${key}: every day page keeps a data-zone on its blocks (the layout.json zone map is whole)`);
}

// P3: what the options do to the printed page (measured in Chromium on the built HTML).
const browser = await launch();
async function measure(b, fn, arg) {
  const pg = await browser.newPage();
  await pg.goto('file://' + process.cwd() + `/${b.dir}/journal.html`, { waitUntil: 'networkidle' });
  await pg.evaluate(() => document.fonts.ready);
  const r = await pg.evaluate(fn, arg);
  await pg.close();
  return r;
}
const FIXED = '.hz, .hz *, .strip, .strip *, .folio, .frame';
const stats = () => {
  const px = (pg, sel) => [...pg.querySelectorAll(sel)];
  const day = document.querySelector('.page.dayp'), fixed = (el) => el.closest('.hz, .strip, .folio, .frame');
  const textEls = (pg) => [...pg.querySelectorAll('*')].filter((el) => !fixed(el) && !el.closest('svg') && [...el.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim()));
  const size = (el) => parseFloat(getComputedStyle(el).fontSize);
  const grey = (el) => { const m = getComputedStyle(el).color.match(/\d+/g).map(Number); const same = Math.abs(m[0] - m[1]) < 3 && Math.abs(m[1] - m[2]) < 3; return same && m[0] > 0x22 && m[0] < 0xee; };
  const full = [...document.querySelectorAll('.page')].filter((pg) => (pg.dataset.ls === '1.4' || pg.dataset.ls === undefined) && !pg.classList.contains('title')); // (the title page keeps today's type: its frame is sized by its content)
  const rules = [...document.querySelectorAll('svg.vrule path')].map((p) => p.getAttribute('fill') || p.getAttribute('stroke'));
  return {
    body: size(day), minDay: Math.min(...textEls(day).map(size)), dayLs: day.dataset.ls || null,
    care: day.querySelector('.care').getBoundingClientRect().height, hasFact: !!day.querySelector('.fact'), bodyCls: day.querySelector('[data-zone="body"]').className,
    cb: parseFloat(getComputedStyle(day.querySelector('.cb')).height),
    minFull: Math.min(...full.flatMap((pg) => textEls(pg).map(size))),
    greyText: [...document.querySelectorAll('.page')].flatMap((pg) => textEls(pg).filter(grey).map((el) => `${pg.dataset.pageId}:${el.className || el.tagName}`)).slice(0, 8),
    rules: [...new Set(rules)], steps: [...new Set([...document.querySelectorAll('.page')].map((pg) => pg.dataset.ls || ''))],
    hz: getComputedStyle(day.querySelector('.hz .zl')).fontSize,
  };
};
{
  const s0 = await measure(built['base/small'], stats), sL = await measure(built['large/small'], stats), sC = await measure(built['contrast/small'], stats), sB = await measure(built['both/small'], stats);
  ok(s0.hasFact && /dots/.test(s0.bodyCls) && s0.steps.join('') === '' && s0.rules.every((c) => ['#808080', '#a0a0a0', '#c8c8c8', '#606060', '#ccc', '#000'].includes(c.toLowerCase())), 'default: "On this day", dot grid, no steps, the usual grey rulings');
  ok(sL.body >= s0.body * 1.3 && sL.dayLs === '1.4', `large: day page type ${s0.body.toFixed(1)}px to ${sL.body.toFixed(1)}px (1.4x)`);
  ok(sL.minDay >= LARGE_FLOOR * 96 / 72 - 0.2, `large: nothing on the day page under ${LARGE_FLOOR} pt (smallest ${(sL.minDay * 72 / 96).toFixed(1)} pt; it was ${(s0.minDay * 72 / 96).toFixed(1)} pt)`);
  ok(sL.minFull >= LARGE_FLOOR * 96 / 72 - 0.2, `large: nothing under ${LARGE_FLOOR} pt on any page that keeps the full scale (smallest ${(sL.minFull * 72 / 96).toFixed(1)} pt)`);
  ok(sL.cb > s0.cb * 1.2 && sL.care > s0.care && !sL.hasFact && /ruled/.test(sL.bodyCls), `large: taller rows (${s0.cb.toFixed(0)}px to ${sL.cb.toFixed(0)}px), no "On this day", the writing space is ruled`);
  ok(sL.hz === s0.hz, `large: the header label keeps its size (${sL.hz})`);
  ok(sL.rules.every((c) => !['#a0a0a0', '#c8c8c8', '#ccc'].includes(c.toLowerCase())), `large: rulings are darker than the default greys (${sL.rules.join(' ')})`);
  ok(sC.greyText.length === 0, `contrast: no grey text outside the scan zones ${sC.greyText.join(', ')}`);
  ok(sC.rules.every((c) => ['#000', '#222', '#444', '#000000'].includes(c.toLowerCase())), `contrast: every ruling is black or near black (${sC.rules.join(' ')})`);
  ok(sC.body === s0.body && sC.hasFact, 'contrast alone does not change type size or content');
  ok(sB.body >= s0.body * 1.3 && sB.greyText.length === 0 && !sB.hasFact, 'both together: large type and no grey text');
  console.log(`  large print scale steps (per page type): ${sL.steps.join(' ')}`);
}
await browser.close();

// P4: hardcover, and the profile/layout precedence.
{
  const hc = build('large', 'small', { HARDCOVER: '1' }, 'large-hardcover');
  ok(/^\[\] 0$/.test(check(hc)) && type3(hc) === 0 && pdfPages(hc, true) >= 76 && pdfPages(hc, true) % 2 === 0, `hardcover with large print: ${pdfPages(hc, true)} pages (76 or more, even), check.mjs [] 0, no Type 3`);
  // the day layout's own print setting turns the options on for a profile that has them off (what the editor's Settings panel writes)...
  const lay = path.join(TMP, 'daypage-print.json'); fs.writeFileSync(lay, JSON.stringify({ v: 2, print: { large: true } }));
  const viaLayout = build('base', 'small', { KW_DAYFILE: lay }, 'layout-setting');
  ok(/print-a11y/.test(html(viaLayout)) && /data-a11y="large"/.test(html(viaLayout)) && /^\[\] 0$/.test(check(viaLayout)), 'daypage.json print.large turns large print on for a profile that has it off, and the book passes check.mjs');
  const viaBoth = build('large', 'small', { KW_DAYFILE: lay }, 'layout-setting-2');
  ok(/data-a11y="large"/.test(html(viaBoth)), 'the profile and the layout setting together are still just large print');
}

// P5: a plan book (a quarter) with both options on: the same volumes, each within KDP's limits and passing every gate.
{
  const q = (key, name) => { const p = structuredClone(EXAMPLE); p.book.scope = 'quarter'; p.book.id = 'K7M2QX9A'; p.print = key === 'both' ? { large_print: true, high_contrast: true } : { large_print: false, high_contrast: false }; const f = path.join(TMP, name + '.json'); fs.writeFileSync(f, JSON.stringify(p)); return f; };
  const run = (f, out) => { const log = execFileSync('node', ['render.mjs', 'book', 'test.ics'], { env: { ...process.env, KW_PROFILE: f, KW_OUT: out, SIZE: 'small' }, stdio: 'pipe' }).toString(); return [...log.matchAll(/^volume (\S+):.*?(\d+) pages/gm)].map((m) => ({ id: m[1], pages: +m[2] })); };
  const v0 = run(q('off', 'q-off'), `${ROOT}/q-off`), v1 = run(q('both', 'q-both'), `${ROOT}/q-both`);
  ok(v0.length >= 1 && JSON.stringify(v0) === JSON.stringify(v1), `quarter book: the same volumes with the options on (${v1.map((v) => v.id + ' ' + v.pages + 'p').join(', ')})`);
  ok(v1.every((v) => v.pages >= 24 && v.pages <= 110), 'quarter book: every volume is 24 to 110 pages');
  for (const v of v1) { const r = execFileSync('node', ['check.mjs', `b-${v.id}`], { env: { ...process.env, KW_OUT: `${ROOT}/q-both` }, stdio: 'pipe' }).toString().trim(); ok(/^\[\] 0$/.test(r), `quarter book volume ${v.id}: check.mjs ${r}`); }
}
console.log(`print accessibility checks passed (${n})`);
