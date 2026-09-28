// KDP cover, full wrap: back + spine + front. White paper, B&W interior.
// Usage: node cover.mjs month <YYYY-MM> | keeper   (SIZE=letter; HARDCOVER=1 for months -> …-hardcover-cover.pdf)
// Paperback: 0.125" bleed, spine = pages x 0.002252". Hardcover (case laminate), per https://kdp.amazon.com/cover-calculator,
// https://kdp.amazon.com/en_US/help/topic/GDTKFJPNQCBTMRV6 and https://kdp.amazon.com/en_US/help/topic/GVBQ3CMEQW3W2VL6:
// 0.591" (15 mm) wrap round the boards; boards 0.197" (5 mm) wider, 0.236" (6 mm) taller than the trim; 0.394" (10 mm) hinge beside
// the spine; 0.125" margin inside the board edge; spine = pages x 0.002252" + 0.189"; 76-550 pages; no 8.5x11 trim.
import fs from 'node:fs';
import { launch } from './browser.mjs';

const KEEPER = process.argv[2] === 'keeper';
if (!KEEPER && !(process.argv[2] === 'month' && /^\d{4}-\d{2}$/.test(process.argv[3] || ''))) { console.error('usage: node cover.mjs month <YYYY-MM> | keeper'); process.exit(1); }
const LETTER = !KEEPER && process.env.SIZE === 'letter';
const HC = !KEEPER && process.env.HARDCOVER === '1'; // the Keeper is always a paperback
let VN, VOL, OUT;
if (KEEPER) { VN = 0; VOL = { label: 'Oct 2026 – Sep 2027', short: 'Keeper' }; OUT = 'out/keeper'; }
else {
  const [y, m] = process.argv[3].split('-').map(Number);
  const name = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' });
  VN = (y - 2026) * 12 + m - 9; VOL = { label: `${name} ${y}`, short: `${name.slice(0, 3)} ${y}` }; OUT = `out/m${process.argv[3]}${LETTER ? '-letter' : ''}`;
}
if (HC && LETTER) { console.error('KDP hardcover trims are 5.5x8.5, 6x9, 6.14x9.21, 7x10 and 8.25x11 (not 8.5x11): build the hardcover without SIZE=letter.'); process.exit(1); }
// render.mjs writes pages.txt for the paperback interior and pages-hardcover.txt for the hardcover one.
const PAGES_TXT = `${OUT}/pages${HC ? '-hardcover' : ''}.txt`;
const PAGES = fs.existsSync(PAGES_TXT) ? +fs.readFileSync(PAGES_TXT, 'utf8') : 0;
if (!HC && !PAGES) { console.error(`No ${PAGES_TXT}: build the interior first (node render.mjs month ${process.argv[3]} <ics>).`); process.exit(1); }
if (HC && PAGES < 76) { console.error(`KDP hardcover needs 76+ pages, ${PAGES_TXT} says ${PAGES}: rebuild the interior with HARDCOVER=1 node render.mjs month ${process.argv[3]} <ics>.`); process.exit(1); }
const TRIM_W = LETTER ? 8.5 : 5.5, TRIM_H = LETTER ? 11 : 8.5;
// EDGE: bleed or wrap outside the trim/board. BW/BH: visible front (trim or board). IN_B/IN_F: spine-side padding, clear of the hinge.
const MM = 1 / 25.4, BLEED = 0.125, EDGE = HC ? 15 * MM : BLEED, HINGE = 10 * MM, BW = HC ? TRIM_W + 5 * MM : TRIM_W, BH = HC ? TRIM_H + 6 * MM : TRIM_H;
const SPINE = HC ? +(PAGES * 0.002252 + 0.189).toFixed(3) : +(PAGES * 0.002252).toFixed(4); // KDP white paper, black ink
const W = HC ? +(EDGE * 2 + BW * 2 + SPINE).toFixed(3) : BLEED * 2 + TRIM_W * 2 + SPINE, H = HC ? +(BH + EDGE * 2).toFixed(3) : TRIM_H + BLEED * 2;
const IN_B = HC ? HINGE + 0.3 : 0.7, IN_F = HC ? HINGE + 0.25 : 0.6;

function moon(deg, size) {
  const r = size / 2 - 1, c = size / 2, f = Math.cos((deg * Math.PI) / 180), waxing = deg < 180, rx = Math.abs(f) * r;
  const so = waxing ? 1 : 0, big = f < 0, si = waxing ? (big ? 1 : 0) : (big ? 0 : 1);
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${c}" cy="${c}" r="${r}" fill="#1d2a44" stroke="#e9dfc6" stroke-width="1"/><path d="M ${c} ${c - r} A ${r} ${r} 0 0 ${so} ${c} ${c + r} A ${rx} ${r} 0 0 ${si} ${c} ${c - r} Z" fill="#e9dfc6"/></svg>`;
}
const phases = [0, 45, 90, 135, 180, 225, 270, 315].map((d) => moon(d, 34)).join('');

const html = `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="file://${process.cwd()}/node_modules/@fontsource/lora/400.css"><link rel="stylesheet" href="file://${process.cwd()}/node_modules/@fontsource/lora/600.css"><link rel="stylesheet" href="file://${process.cwd()}/node_modules/@fontsource/lora/700.css"><link rel="stylesheet" href="file://${process.cwd()}/node_modules/@fontsource/lora/400-italic.css"><link rel="stylesheet" href="file://${process.cwd()}/node_modules/@fontsource/noto-serif-jp/400.css"><link rel="stylesheet" href="file://${process.cwd()}/node_modules/@fontsource/noto-serif-jp/600.css"><link rel="stylesheet" href="file://${process.cwd()}/node_modules/@fontsource/noto-sans-jp/400.css"><link rel="stylesheet" href="file://${process.cwd()}/node_modules/@fontsource/dejavu-sans/400.css"><style>
@page { size: ${W}in ${H}in; margin: 0; }
* { box-sizing: border-box; } html, body { margin: 0; }
body { width: ${W}in; height: ${H}in; background: #121c30; color: #e9dfc6; font-family: 'Lora', 'Noto Serif JP', serif; position: relative; overflow: hidden; -webkit-print-color-adjust: exact; }
.panel { position: absolute; top: 0; height: ${H}in; }
.back { left: 0; width: ${EDGE + BW}in; padding: ${EDGE + 0.6}in ${IN_B}in 0 ${EDGE + 0.6}in; }
.spine { left: ${EDGE + BW}in; width: ${SPINE}in; display: flex; align-items: center; justify-content: center; }
.spine span { writing-mode: vertical-rl; font-size: 8pt; letter-spacing: 1.5px; white-space: nowrap; }
.front { left: ${EDGE + BW + SPINE}in; width: ${BW + EDGE}in; padding: ${EDGE + 1.3}in ${EDGE + 0.6}in 0 ${IN_F}in; text-align: center; }
h1 { font-size: 40pt; font-weight: 600; margin: 0.35in 0 0.05in; }
.sub { font-style: italic; font-size: 13pt; margin: 0; } .jp { font-size: 17pt; margin: 0.2in 0; letter-spacing: 3px; }
.range { text-transform: uppercase; letter-spacing: 3px; font-size: 11pt; margin-top: 0.3in; }
.row { display: flex; justify-content: center; gap: 6px; }
.stars { position: absolute; inset: 0; }
.back p { font-size: 10pt; line-height: 1.55; max-width: 4.4in; }
.back h2 { font-size: 15pt; font-weight: 600; margin: 0 0 0.12in; }
.back ul { font-size: 9.5pt; line-height: 1.6; padding-left: 16px; }
.foot { position: absolute; bottom: ${EDGE + 0.4}in; left: ${EDGE + BW + SPINE + IN_F}in; right: ${EDGE + 0.6}in; text-align: center; font-size: 8pt; opacity: 0.8; }
</style></head><body>
<svg class="stars" width="${W}in" height="${H}in">${Array.from({ length: 140 }, (_, i) => { const x = ((i * 7919) % 1000) / 10, y = ((i * 104729) % 1000) / 10, r = (i % 5 === 0) ? 1.3 : 0.6; return `<circle cx="${x}%" cy="${y}%" r="${r}" fill="#e9dfc6" opacity="${0.25 + (i % 4) * 0.12}"/>`; }).join('')}</svg>
<div class="panel back">
${KEEPER ? `<h2>The book that stays home.</h2>
  <p>The companion to the Keeping Watch monthly journals: the people, numbers and accounts worth keeping close, on paper and offline.</p>
  <ul><li>Important info, health and home</li><li>Contacts and birthdays</li><li>Account hints (never passwords) and 2FA recovery codes</li><li>Devices and Wi-Fi</li><li>Support and trans support numbers</li></ul>
  <p style="font-size:8pt;opacity:.75">Keeper · ${VOL.label} · Private: do not scan</p>` : `
  <h2>Keep watch over the sky, the season and yourself.</h2>
  <p>Babylonian astronomers wrote the night sky next to the price of barley. Seneca reviewed each day by lamplight. Old calendars named the seasons in five-day steps. This journal borrows from all of them.</p>
  <ul><li>Full-page days with sunrise, sunset, moon phase and sign for Spokane, WA</li><li>72 micro-seasons and the planetary week</li><li>Mood, sleep and spoons check-ins</li><li>Weekly spreads, monthly calendars and trackers</li><li>Exchange pages to share with someone</li></ul>
  <p style="font-size:8pt;opacity:.75">Book ${VN} of 12 · ${VOL.label} · Test edition</p>`}
</div>
<div class="panel spine">${SPINE >= 0.25 ? `<span>KEEPING WATCH · ${KEEPER ? 'THE KEEPER' : 'BOOK ' + VN + ' · ' + VOL.short.toUpperCase()}</span>` : ''}</div>
<div class="panel front">
  <div class="row">${phases}</div>
  <h1>Keeping Watch</h1>
  <p class="sub">${KEEPER ? 'The Keeper' : 'A sky, season &amp; self journal'}</p>
  <p class="range">${KEEPER ? 'Contacts · accounts · important info' : `Book ${VN} of 12`} · ${VOL.label}</p>
</div>
<div class="foot">${KEEPER ? "Private · keep at home" : "Sky data for Spokane, Washington"}</div>
</body></html>`;

const NAME = HC ? 'hardcover-cover' : 'cover';
fs.writeFileSync(`${OUT}/${NAME}.html`, html);
const b = await launch();
const p = await b.newPage();
await p.goto('file://' + process.cwd() + `/${OUT}/${NAME}.html`, { waitUntil: 'networkidle' }); await p.evaluate(() => document.fonts.ready);
await p.pdf({ path: `${OUT}/keeping-watch-${KEEPER ? 'keeper' : process.argv[3] + (LETTER ? '-8.5x11' : '')}-${NAME}.pdf`, width: `${W}in`, height: `${H}in`, printBackground: true, preferCSSPageSize: true });
await b.close();
console.log(`${KEEPER ? 'keeper' : process.argv[3] + (LETTER ? ' 8.5x11' : '')} ${HC ? 'hardcover' : 'paperback'} cover ${W.toFixed(3)} x ${H} in, spine ${SPINE} in`);
