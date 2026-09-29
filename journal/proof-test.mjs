// KDP proof test sheet: one recto + one verso per trim size, made at build time and NOT part of the monthly books.
//   node proof-test.mjs          -> out/proof/<slug>-proof-test-5.5x8.5.pdf and ...-8.5x11.pdf
// Order it with the first proof (see KDP.md section 8). Generic sample content only; no calendar data.
// Every ruling is drawn by drawRulings() from rulings.mjs, the same code and SPECS the monthly books use, so this sheet
// always shows the real weights. The 8.5x11 sheet uses the same 1.294x page zoom as the book.
import fs from 'node:fs';
import { launch } from './browser.mjs';
import bwipjs from 'bwip-js';
import { drawRulings } from './rulings.mjs';
import { PROFILE } from './profile.mjs';

const OUT = 'out/proof';
const H_IN = 8.5, TOP = 0.3, BOTTOM = 0.3, INSIDE = 0.5, OUTSIDE = 0.3; // keep in sync with render.mjs
const BORDER_PT = 9, QUIET = 0.5, STRIP = 0.42, FRAME_PAD = BORDER_PT / 72 + QUIET;
const pt = (v) => v / 0.75; // pt -> CSS px

// Ladders are plain vector rects, so their weights are exact.
const LINE_PTS = [0.25, 0.5, 0.75, 1, 1.5], GREYS = ['#d6d6d6', '#c8c8c8', '#a0a0a0', '#808080', '#606060'];
const pct = (hex) => Math.round(100 - (parseInt(hex.slice(1, 3), 16) / 255) * 100);
const lineLadder = () => {
  let y = 4, d = '', t = '';
  for (const w of LINE_PTS) {
    d += `<rect x="30" y="${y}" width="100" height="${pt(w)}" fill="#a0a0a0"/><rect x="136" y="${y}" width="100" height="${pt(w)}" fill="#000"/>`;
    t += `<text x="0" y="${y + 3}" class="s">${w} pt</text>`;
    y += 12;
  }
  return `<svg width="240" height="${y + 2}" viewBox="0 0 240 ${y + 2}">${d}${t}</svg>`;
};
const toneLadder = () => GREYS.map((c) => `<span class="chip"><i style="background:${c}"></i>${pct(c)}%</span>`).join('');
const dotLadder = () => {
  const mm = 96 / 25.4, sizes = [0.4, 0.6, 0.8, 1.0];
  let d = '', t = '', x = 12;
  for (const s of sizes) { d += `<circle cx="${x}" cy="9" r="${(s / 2) * mm}" fill="#808080"/>`; t += `<text x="${x - 9}" y="27" class="s">${s} mm</text>`; x += 36; }
  x += 6;
  for (const c of ['#c8c8c8', '#a0a0a0', '#808080', '#606060']) { d += `<circle cx="${x}" cy="9" r="${0.375 * mm}" fill="${c}"/>`; t += `<text x="${x - 8}" y="27" class="s">${pct(c)}%</text>`; x += 30; }
  return `<svg width="${x}" height="32" viewBox="0 0 ${x} 32">${d}${t}</svg>`;
};
const gridLadder = () => {
  const mm = 96 / 25.4; let s = '';
  for (const [w, c, lab] of [[0.5, '#c8c8c8', '0.5 pt 22%'], [0.75, '#c8c8c8', '0.75 pt 22% (used)'], [1, '#c8c8c8', '1 pt 22%'], [0.75, '#d6d6d6', '0.75 pt 16%'], [0.75, '#b4b4b4', '0.75 pt 29%']]) {
    let d = '';
    for (let i = 0; i < 4; i++) d += `M0 ${(pt(w) / 2 + i * 4 * mm).toFixed(2)}H${(16 * mm).toFixed(2)}`;
    s += `<div class="gl"><svg width="${(16 * mm).toFixed(1)}" height="${(12 * mm).toFixed(1)}"><path d="${d}" stroke="${c}" stroke-width="${pt(w)}" stroke-dasharray="${(0.6 * mm).toFixed(2)} ${(0.4 * mm).toFixed(2)}" fill="none"/></svg><span class="s">${lab}</span></div>`;
  }
  return s;
};
const ruler = () => {
  const mm = 96 / 25.4; let d = '', t = '';
  for (let i = 0; i <= 50; i++) { const h = i % 10 === 0 ? 10 : i % 5 === 0 ? 7 : 4; d += `M${(i * mm).toFixed(2)} 0v${h}`; if (i % 10 === 0) t += `<text x="${(i * mm - 1).toFixed(1)}" y="20" class="s">${i / 10}</text>`; }
  let e = '';
  for (let i = 0; i <= 16; i++) { const h = i % 16 === 0 ? 10 : i % 8 === 0 ? 8 : i % 4 === 0 ? 6 : i % 2 === 0 ? 4 : 2.5; e += `M${i * 6} 30v${h}`; }
  return `<svg style="display:block;overflow:visible" width="${(50 * mm).toFixed(1)}" height="26" viewBox="0 0 ${(50 * mm).toFixed(1)} 26"><path d="${d}" stroke="#000" stroke-width="0.75" fill="none"/>${t}<text x="${(50 * mm - 16).toFixed(1)}" y="20" class="s">cm</text></svg>
  <svg style="display:block;overflow:visible;margin-top:4px" width="100" height="36" viewBox="0 0 100 36"><path d="M0 30H96${e}" stroke="#000" stroke-width="0.75" fill="none"/><text x="0" y="16" class="s">1 inch, 1/16 ticks</text></svg>`;
};

const sample = (cls, label, style = '') => `<div class="smp"><div class="${cls}" style="${style}"></div><span class="s">${label}</span></div>`;

const css = (W_IN, ZOOM) => `
@page { size: ${(W_IN * ZOOM).toFixed(3)}in ${(H_IN * ZOOM).toFixed(3)}in; margin: 0; }
* { box-sizing: border-box; } html, body { margin: 0; padding: 0; }
body { font-family: 'Inter', sans-serif; font-size: 7pt; color: #111; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.page { width: ${W_IN}in; height: ${H_IN}in; zoom: ${ZOOM}; position: relative; overflow: hidden; break-after: page; padding: ${TOP}in ${OUTSIDE}in ${BOTTOM}in ${INSIDE}in; }
.page.verso { padding-left: ${OUTSIDE}in; padding-right: ${INSIDE}in; }
.frame { position: absolute; top: ${TOP}in; bottom: ${BOTTOM}in; border: ${BORDER_PT}pt solid #000; }
.recto .frame { left: ${INSIDE}in; right: ${OUTSIDE}in; } .verso .frame { left: ${OUTSIDE}in; right: ${INSIDE}in; }
.in { position: absolute; top: ${TOP + FRAME_PAD}in; bottom: ${BOTTOM + FRAME_PAD + STRIP + 0.06}in; overflow: hidden; }
.recto .in { left: ${INSIDE + FRAME_PAD}in; right: ${OUTSIDE + FRAME_PAD}in; } .verso .in { left: ${OUTSIDE + FRAME_PAD}in; right: ${INSIDE + FRAME_PAD}in; }
.strip { position: absolute; bottom: ${BOTTOM + FRAME_PAD}in; height: ${STRIP}in; display: flex; align-items: flex-end; gap: 0.1in; }
.recto .strip { left: ${INSIDE + FRAME_PAD}in; right: ${OUTSIDE + FRAME_PAD}in; } .verso .strip { left: ${OUTSIDE + FRAME_PAD}in; right: ${INSIDE + FRAME_PAD}in; }
.strip .qr { margin-left: auto; width: ${STRIP}in; height: ${STRIP}in; } .strip .qr svg { width: 100%; height: 100%; display: block; }
.strip .t { font: 700 7pt Inter, sans-serif; letter-spacing: 0.5px; }
.guide { position: absolute; border: 0.75pt dashed #000; pointer-events: none; }
.recto .guide.min { top: ${0.25 / ZOOM}in; bottom: ${0.25 / ZOOM}in; left: ${0.375 / ZOOM}in; right: ${0.25 / ZOOM}in; } .verso .guide.min { top: ${0.25 / ZOOM}in; bottom: ${0.25 / ZOOM}in; left: ${0.25 / ZOOM}in; right: ${0.375 / ZOOM}in; }
.tick { position: absolute; width: 0.12in; height: 0.12in; }
h1 { font: 700 8.5pt Inter, sans-serif; margin: 0 0 3px; } .s { font: 500 5.6pt Inter, sans-serif; color: #333; } svg text.s { fill: #333; }
h2 { font: 700 6.4pt Inter, sans-serif; text-transform: uppercase; letter-spacing: 0.5px; margin: 7px 0 3px; }
.two { display: grid; grid-template-columns: 1fr 1fr; gap: 5px 0.12in; } .smp > div { height: 0.5in; } .smp .s { display: block; margin-top: 1px; }
.chip { display: inline-flex; flex-direction: column; align-items: center; margin-right: 6px; font: 500 5.6pt Inter, sans-serif; } .chip i { width: 0.36in; height: 0.2in; border: 0.5px solid #777; }
.grids { display: flex; gap: 6px; } .gl { display: flex; flex-direction: column; gap: 1px; } .gl .s { width: 0.62in; font-size: 5pt; }
.pen { margin-bottom: 4px; } .pen > div { height: 0.56in; border: 1px solid #a0a0a0; position: relative; } .pen .s { display: block; }
.note { font: 500 6pt Inter, sans-serif; line-height: 1.35; margin: 3px 0; }
.sq { display: inline-block; vertical-align: bottom; border: 0.75pt solid #000; margin-right: 8px; }
.row { display: flex; align-items: flex-start; gap: 14px; }
`;


const front = () => `
<h1>Proof test: rulings and weights</h1>
<div class="note">Look at the real print. Every mark should be even, unbroken and quiet. Weights are stamped under each sample.</div>
<div class="two">
${sample('ruled log', 'Body lines: 1 pt, 37% grey, 6.6 mm', 'height:0.5in')}
${sample('ru', 'Block lines: 1 pt, 37% grey, 5.6 mm')}
${sample('ru pd', 'Dot grid: 0.71 mm dot, 50% grey, 5.6 mm')}
${sample('ru pg', '4 mm grid: 0.75 pt dashes, 22% grey')}
<div class="smp"><div class="m"><div class="dots" style="height:0.5in"></div></div><span class="s">Month dots: 0.8 mm dot, 22% grey, 5 mm</span></div>
${sample('dots', 'Small dots: 0.7 mm dot, 62% grey, 4.3 mm')}
<div class="smp"><div class="genko" style="display:grid;grid-template-columns:repeat(4,0.26in);grid-auto-rows:0.26in"><span style="border:1px solid #999"></span><span style="border:1px solid #999"></span><span style="border:1px solid #999"></span><span style="border:1px solid #999"></span></div><span class="s">Genko cells: 0.75 pt box, 1 px cross guide</span></div>
</div>
<h2>Line weight ladder (grey #a0a0a0 and black)</h2>${lineLadder()}
<div class="note">KDP minimum is 0.75 pt. 0.25 and 0.5 pt are below it: they show what breaks first.</div>
<h2>Grey tones (KDP fill minimum 10%)</h2><div>${toneLadder()}</div>
<h2>Dot size and tone</h2>${dotLadder()}
<h2>4 mm grid weight and tone</h2><div class="grids">${gridLadder()}</div>`;

const back = (code) => `
<h1>Proof test: pens, scan and scale</h1>
<h2>Pen test: write over the rulings</h2>
<div class="pen"><div><div class="ruled log" style="position:absolute;inset:0"></div></div><span class="s">Fine liner (0.3-0.5 mm), on body lines</span></div>
<div class="pen"><div><div class="ru pd" style="position:absolute;inset:0"></div></div><span class="s">Medium ballpoint, on the dot grid</span></div>
<div class="pen"><div><div class="ru pg" style="position:absolute;inset:0"></div></div><span class="s">Gel pen, on the 4 mm grid</span></div>
<div class="pen"><div><div class="ru" style="position:absolute;inset:0"></div></div><span class="s">Pencil (HB), on block lines. Then rub it out.</span></div>
<h2>Scale: measure with a real ruler</h2>
<div class="row"><div>${ruler()}<div style="margin-top:6px"><span class="sq" style="width:${(5 * 96 / 25.4).toFixed(2)}px;height:${(5 * 96 / 25.4).toFixed(2)}px"></span><span class="s">5 mm square</span></div></div><div><span class="sq" style="width:96px;height:96px;margin:0"></span><span class="s" style="display:block">1 in square</span></div></div>
<div class="note">Small book: 1 in should measure 25.4 mm. 8.5x11: this sheet is zoomed 1.294x, so a 0.75 pt line prints as 0.97 pt and the 1 in square measures 1.294 in (32.9 mm).</div>`;

const notes = `<div class="note">Scan code, real size (0.42 in, 10.7 mm), bottom right. Scan it with your journal app: it should read <b>${'KW2|T|TEST|S001'}</b>. Dashed line: KDP's minimum margin (0.25 in; 0.375 in inside). The black frame and code strip sit where they do in the books.</div>`;

const pageHtml = (kind, body, qr, n) => `<section class="page ${kind}"><div class="guide min"></div><div class="frame"></div><div class="in">${body}</div><div class="strip"><span class="t">${n} PROOF TEST · SCAN ME</span><span class="qr">${qr}</span></div></section>`;

const qr = bwipjs.toSVG({ bcid: 'datamatrix', text: 'KW2|T|TEST|S001' });
fs.mkdirSync(OUT, { recursive: true });
const browser = await launch();
for (const [tag, W_IN, ZOOM] of [['5.5x8.5', 5.5, 1], ['8.5x11', +(8.5 / (11 / 8.5)).toFixed(4), 11 / 8.5]]) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${PROFILE.book.title} proof test ${tag}</title>
<link rel="stylesheet" href="file://${process.cwd()}/node_modules/@fontsource/inter/500.css"><link rel="stylesheet" href="file://${process.cwd()}/node_modules/@fontsource/inter/700.css">
<style>${css(W_IN, ZOOM)}</style></head><body>
${pageHtml('recto', front(), qr, 1)}${pageHtml('verso', back() + notes, qr, 2)}
<script>${drawRulings.toString()}\ndocument.fonts.ready.then(drawRulings);</script></body></html>`;
  fs.writeFileSync(`${OUT}/proof-test-${tag}.html`, html);
  const page = await browser.newPage();
  await page.goto('file://' + process.cwd() + `/${OUT}/proof-test-${tag}.html`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => drawRulings());
  // fail if any content spills out of its box
  const over = await page.evaluate(() => [...document.querySelectorAll('.in')].map((e) => e.scrollHeight > e.clientHeight + 1 || e.scrollWidth > e.clientWidth + 1));
  if (over.some(Boolean)) { console.error(`proof test ${tag}: content overflows its page`, over); process.exitCode = 1; }
  await page.pdf({ width: `${(W_IN * ZOOM).toFixed(3)}in`, height: `${(H_IN * ZOOM).toFixed(3)}in`, path: `${OUT}/${PROFILE.book.slug}-proof-test-${tag}.pdf`, printBackground: true, preferCSSPageSize: true });
  await page.close();
  console.log(`proof test ${tag}: ${OUT}/${PROFILE.book.slug}-proof-test-${tag}.pdf`);
}
await browser.close();
