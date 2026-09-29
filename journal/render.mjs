// Renders one monthly book's KDP interior (5.5x8.5, or 8.5x11 with SIZE=letter) as HTML (one fixed-size div per page)
// and prints it to PDF with Chromium.
// Usage: node render.mjs month <YYYY-MM> [a.ics,b.ics]      (SIZE=letter for 8.5x11, HARDCOVER=1 to pad to 76+ pages)
// The pages themselves are built by pages.mjs (shared with the page editor) and laid out in the order content/book.json
// says (book.mjs; the default reproduces the original sequence). This file adds the frame, scan markers and page codes.
import fs from 'node:fs';
import { launch } from './browser.mjs';
import bwipjs from 'bwip-js';
import { drawRulings } from './rulings.mjs';
import { EDITION } from './content/edition.mjs';
import { PROFILE } from './profile.mjs';
import { DAYPAGE_CSS } from './daypage.mjs';
import { loadContext, loadBook } from './context.mjs';
import { assemble, assertBook, entriesFor, normalizeBook } from './book.mjs';
if (process.argv[2] !== 'month' || !/^\d{4}-\d{2}$/.test(process.argv[3] || '')) {
  console.error('Usage: node render.mjs month <YYYY-MM> [a.ics,b.ics]   (SIZE=letter, HARDCOVER=1)');
  process.exit(1);
}
// Trim: SIZE=small|letter, else the profile's default trim (content/profile.json, trim).
const LETTER = (process.env.SIZE || PROFILE.trim) === 'letter', HARDCOVER = process.env.HARDCOVER === '1';
const ctx = await loadContext({ month: process.argv[3], ics: process.argv[4], size: LETTER ? 'letter' : 'small' });
const { D, VOL } = ctx;
const OUT = `${process.env.KW_OUT || 'out'}/m${VOL.id}${LETTER ? '-letter' : ''}`; // KW_OUT: another output folder (test-profile.mjs)
// Which pages, in what order: content/book.json (from the editor), checked here so a bad file says what is wrong.
const fileBook = loadBook();
if (fileBook && Object.keys(fileBook).length) try { assertBook(fileBook); } catch (e) { console.error(e.message); process.exit(1); }
const book = normalizeBook(fileBook);
// Page sequence (mirror margins by parity), padding and page references: book.mjs. Every page has an `id` (unique in the book,
// derived from what the page is, never from its position: title, key, week.03.reply, day.2026-10-14 ...), a printed `label`
// and `shared` (front/back matter meant to print byte-identically in every book); see pages.mjs and check-pages.mjs.
// Only padding pages are numbered by order (notes.1, notes.2 ...): they exist because of position.
const { pages } = assemble(ctx, entriesFor(book, VOL.id), { hardcover: HARDCOVER });

// ---------- HTML ----------
// 5.5 x 8.5 in: a KDP.com size for both paperback and hardcover (A5 is only offered on KDP Japan)
// SIZE=letter: 8.5 x 11 in. The page is laid out at 6.57 x 8.5 (same height as the small book) and zoomed x1.294,
// so everything, type included, scales up evenly and the wider page gets a little more room across.
const ZOOM = LETTER ? 11 / 8.5 : 1;
const W_IN = LETTER ? +(8.5 / ZOOM).toFixed(4) : 5.5, H_IN = 8.5;
const TRIM_W = +(W_IN * ZOOM).toFixed(3), TRIM_H = +(H_IN * ZOOM).toFixed(3), SIZE_TAG = LETTER ? '8.5x11' : '5.5x8.5';
const INSIDE = 0.5, OUTSIDE = 0.3, TOP = 0.3, BOTTOM = 0.3;
const BORDER_PT = 9, BORDER = BORDER_PT / 72, QUIET = 0.5, STRIP = 0.42; // 9pt anchor border, 0.5in quiet zone, marker strip height
const FRAME_PAD = BORDER + QUIET;

// Scan markers: thick border + 7 send-to bubbles + a Data Matrix page code.
// Payload: see pageCode below (KW2|<edition>|<yymm>|<size><page>). Read by the owner's own scanning app, not the Rocketbook app.
const SYMBOLS = [ // fire (solid △), water (open ▽), air (three winds), earth (⊕), crescent (solid), full moon (solid disc), pentacle
  // Chosen so no two look alike after a blurry phone photo (tested: worst pair correlation 0.63; the old set had 0.90).
  '<path d="M7 1.5 L12.5 12 H1.5 Z" fill="#000"/>',
  '<path d="M7 12.5 L12.5 2 H1.5 Z"/>',
  '<path d="M1.5 4.5 Q4 2.5 6.5 4.5 T11.5 4.5 M1.5 7.5 Q4 5.5 6.5 7.5 T11.5 7.5 M1.5 10.5 Q4 8.5 6.5 10.5 T11.5 10.5"/>',
  '<circle cx="7" cy="7" r="5.5"/><path d="M7 1.5 V12.5 M1.5 7 H12.5"/>',
  '<path d="M9.5 1.8 A5.5 5.5 0 1 0 12.2 9.6 A4.3 4.3 0 1 1 9.5 1.8 Z" fill="#000"/>',
  '<circle cx="7" cy="7" r="5.5" fill="#000"/>',
  '<circle cx="7" cy="7" r="6"/><path d="M 7.00 1.70 L 10.12 11.29 L 1.96 5.36 L 12.04 5.36 L 3.88 11.29 Z"/>',
];
const SYMBOL_NAMES = ['fire', 'water', 'air', 'earth', 'crescent_moon', 'full_moon', 'pentacle'];
const symbolRow = SYMBOLS.map((s, i) => `<span class="sym" data-zone="send_to_${SYMBOL_NAMES[i]}"><i></i><svg width="17" height="17" viewBox="0 0 14 14" fill="none" stroke="#000" stroke-width="1.1">${s}</svg></span>`).join('');
// Hardcover (HARDCOVER=1) pads to an even count >= 76 (KDP needs 75+), paperback to >= 24: assemble() in book.mjs.
// Page code: Data Matrix, payload "KW2|<edition>|<yymm>|<size><page>", e.g. KW2|1|2610|S026 (15 chars = 16x16 modules, the
// same symbol size as the old KW1|2610|026, so modules stay 0.42in / 16 = 0.66 mm). Size: S 5.5x8.5, L 8.5x11, H 5.5x8.5
// hardcover. Size and edition are in the code because zone positions differ by size and layout.json is per book variant.
// Built from `pages` as it stands here (after all padding), so a page's code always names its real position; check-codes.mjs
// re-verifies that on every build. Page type and date come from layout.json.
const SIZE_CODE = HARDCOVER ? 'H' : LETTER ? 'L' : 'S';
const pageCode = (i) => `KW2|${EDITION}|${VOL.id.slice(2).replace('-', '')}|${SIZE_CODE}${String(i + 1).padStart(3, '0')}`;
// Rulings for print: drawRulings() (rulings.mjs) redraws every ruled line, dot grid and 4 mm grid as vector SVG; keep its SPECS in sync with the CSS below and in daypage.mjs.

const qrSvgs = pages.map((p, i) => bwipjs.toSVG({ bcid: 'datamatrix', text: pageCode(i) }));
const html = `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="file://${process.cwd()}/node_modules/@fontsource/lora/400.css"><link rel="stylesheet" href="file://${process.cwd()}/node_modules/@fontsource/lora/600.css"><link rel="stylesheet" href="file://${process.cwd()}/node_modules/@fontsource/lora/700.css"><link rel="stylesheet" href="file://${process.cwd()}/node_modules/@fontsource/lora/400-italic.css"><link rel="stylesheet" href="file://${process.cwd()}/node_modules/@fontsource/noto-serif-jp/400.css"><link rel="stylesheet" href="file://${process.cwd()}/node_modules/@fontsource/noto-serif-jp/600.css"><link rel="stylesheet" href="file://${process.cwd()}/node_modules/@fontsource/noto-sans-jp/400.css"><link rel="stylesheet" href="file://${process.cwd()}/node_modules/@fontsource/dejavu-sans/400.css"><link rel="stylesheet" href="file://${process.cwd()}/node_modules/@fontsource/inter/500.css"><link rel="stylesheet" href="file://${process.cwd()}/node_modules/@fontsource/inter/700.css"><style>
@page { size: ${TRIM_W}in ${TRIM_H}in; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body { font-family: 'Lora', 'Noto Serif JP', serif; font-size: 8.4pt; color: #111; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.jp, .kj, ruby, .sk, .jp-title, .wk-k { font-family: 'Noto Serif JP', 'Noto Sans JP', serif; }
rt { font-size: 7pt; font-family: 'Noto Serif JP', serif; color: #444; }
.gl { font-family: 'DejaVu Sans', sans-serif; font-size: 0.95em; }
.page { width: ${W_IN}in; height: ${H_IN}in; zoom: ${ZOOM}; position: relative; overflow: hidden; page-break-after: always; break-after: page; padding: ${TOP}in ${OUTSIDE}in ${BOTTOM}in ${INSIDE}in; display: flex; flex-direction: column; }
.page.verso { padding-left: ${OUTSIDE}in; padding-right: ${INSIDE}in; }
.folio { position: absolute; bottom: 0.3in; font-size: 7pt; color: #555; }
.recto .folio { right: ${OUTSIDE}in; } .verso .folio { left: ${OUTSIDE}in; }
h1 { font-size: 34pt; font-weight: 600; margin: 0.2in 0 0.05in; letter-spacing: 0.5px; }
h2.pt { font-size: 14pt; font-weight: 600; margin: 0 0 0.08in; }
h2.month { font-size: 22pt; margin: 0; font-weight: 600; }
h3 { font-size: 9pt; font-weight: 700; margin: 0.12in 0 0.04in; text-transform: uppercase; letter-spacing: 0.6px; }
h4 { margin: 0 0 2px; font-size: 8.5pt; }
.dim { color: #555; } .small { font-size: 7.2pt; color: #333; line-height: 1.35; }
.lead { font-size: 8.8pt; line-height: 1.45; margin: 0 0 0.1in; }
.title { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; height: 100%; }
.tmoon { display: flex; gap: 14px; margin-bottom: 0.2in; }
.sub { font-style: italic; font-size: 12pt; margin: 0; } .jp-title { font-size: 16pt; margin: 0.12in 0; } .range { font-size: 11pt; letter-spacing: 2px; text-transform: uppercase; margin: 0.1in 0; }
.place { font-size: 7.5pt; color: #444; } .built { font-size: 6pt; line-height: 9pt; margin: 0; color: #666; } .owner { margin-top: calc(0.6in - 9pt); font-size: 8pt; color: #444; } .owner .line { display: inline-block; width: 3in; border-bottom: 1px solid #333; height: 0.3in; }
table { border-collapse: collapse; }
.lin th { text-align: left; vertical-align: top; padding: 4px 8px 4px 0; width: 1.45in; font-size: 8pt; }
.lin td { padding: 4px 0; font-size: 8pt; border-bottom: 1px solid #bbb; line-height: 1.35; }
.lin tr th { border-bottom: 1px solid #bbb; }
.steps { display: grid; grid-template-columns: 1fr 1fr; gap: 0.12in; } .steps p { margin: 0; line-height: 1.4; } .steps h3 { margin-top: 0.05in; }
.h3b { margin-top: 0.25in; }
.anat { border: 1px solid #333; padding: 6px; display: grid; gap: 5px; } .anat div { border: 1px dashed #777; padding: 5px 6px; font-size: 8pt; } .anat .a3 { height: 1in; } .anat .a1 { height: 0.45in; }
.keycols { display: grid; grid-template-columns: 1fr 1fr; gap: 0.15in; }
.bul { list-style: none; padding: 0; margin: 0; columns: 2; } .bul li { padding: 1px 0; } .bul b { display: inline-block; width: 12px; }
.phases { display: grid; grid-template-columns: 1fr 1fr; gap: 3px 6px; font-size: 7.4pt; } .phases span, .gl-list span { display: flex; align-items: center; gap: 4px; }
.gl-list { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 6px; font-size: 7.6pt; }
.wk td { padding: 2px 10px 2px 0; font-size: 8pt; border-bottom: 1px solid #ccc; } .wk .kj { font-size: 13pt; }
.boxline { border-bottom: 1px solid #333; font-size: 8pt; font-weight: 700; padding: 0.14in 0 2px; margin-bottom: 2px; }
.boxline.big { height: 0.6in; font-size: 9pt; }
.lines { overflow: hidden; } .rule { border-bottom: 1px solid #a0a0a0; }
.lines.l2 { height: 0.52in; } .lines.l3 { height: 0.78in; } .lines.l4 { height: 1.04in; } .lines.l6 { height: 1.56in; } .lines.l7 { height: 1.82in; }
.fill { flex: 1; min-height: 0.5in; }
/* .dots, .m .dots and .genko backgrounds: print redraws them as vectors in drawRulings() (rulings.mjs); keep its SPECS in sync */
.dots { background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='17' height='17' viewBox='0 0 17 17'%3E%3Ccircle cx='8.5' cy='8.5' r='1.344' fill='%23606060'/%3E%3C/svg%3E"); background-size: 0.17in 0.17in; background-position: -0.085in -0.085in; }
.three { margin: 4px 0 0 16px; padding: 0; } .three li { height: 0.34in; border-bottom: 1px solid #a0a0a0; }
.minis { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.12in; margin-bottom: 0.05in; }
.mini table { width: 100%; font-size: 7pt; text-align: center; } .mini th { font-weight: 700; color: #444; } .mini td { padding: 1.5px 0; position: relative; } .mini td.q { font-weight: 700; } .mq { position: absolute; top: 0; right: -1px; }
.sky2 td, .sky td { padding: 2.5px 8px 2.5px 0; font-size: 7.8pt; border-bottom: 1px solid #ccc; vertical-align: middle; } .sky2 td:first-child, .sky td:first-child { white-space: nowrap; font-weight: 600; width: 0.6in; }
.sky2 { width: 100%; columns: 2; }
.mhead { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 4px; } .jp.big { font-size: 16pt; }
.cal { width: 100%; flex: 1; table-layout: fixed; } .cal th { font-size: 7pt; font-weight: 700; padding: 3px 0; text-align: left; border-bottom: 1px solid #333; }
.cal td { border: 1px solid #888; vertical-align: top; padding: 2px 3px; font-size: 7pt; overflow: hidden; overflow-wrap: anywhere; }
.cal .hol, .cal .ev, .cal .pay { font-size: 5.8pt; overflow-wrap: anywhere; } .cal .ev { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; overflow: hidden; } .cal .pay { letter-spacing: 0.1px; } .cal.rows6 .ev { -webkit-line-clamp: 2; }
.cal.rows4 td { height: 1.62in; } .cal.rows5 td { height: 1.3in; } .cal.rows6 td { height: 1.08in; } .cal td.out { background: #dedede; }
.cd { display: flex; justify-content: space-between; align-items: center; } .cd .n { font-size: 10pt; font-weight: 600; } .mk { display: flex; gap: 2px; align-items: center; } .sk { font-size: 7pt; border: 1px solid #555; padding: 0 1px; }
.ev { font-size: 7pt; line-height: 1.2; } .evs { font-size: 7pt; color: #444; font-style: italic; }
.daylen { display: flex; align-items: center; gap: 10px; border: 1px solid #333; padding: 6px 8px; margin-bottom: 8px; font-size: 8.4pt; } .daylen .arrow { font-size: 12pt; } .daylen .chg { margin-left: auto; font-weight: 700; }
.sky { width: 100%; }
.trk { width: 100%; font-size: 7pt; } .trk th { font-size: 7pt; font-weight: 700; text-align: left; padding: 2px; border-bottom: 1px solid #333; }
.trk td { border-bottom: 1px solid #bbb; padding: 0 2px; height: 0.2in; } .trk .dn { width: 0.2in; font-weight: 700; text-align: right; } .trk .kj { width: 0.18in; color: #444; } .trk .mc { width: 0.14in; }
.trk i { display: inline-block; width: 7px; height: 7px; border: 1px solid #444; border-radius: 50%; margin: 0 2px; vertical-align: middle; }
.trk .mood i:nth-child(4) { border-width: 1.6px; } .trk .bx { width: 0.42in; border-left: 1px solid #bbb; } .trk .nt { border-left: 1px solid #bbb; }
.mp { margin-top: 0.1in; } .mph { display: flex; gap: 8px; align-items: center; } .mph h3 { margin: 0; } .mph p { margin: 0; font-size: 7.6pt; }
.whead { display: flex; justify-content: space-between; align-items: baseline; }
.wrow { flex: 1; display: grid; grid-template-columns: 0.62in 0.9in 1fr; border-top: 1px solid #333; padding-top: 3px; min-height: 0; }
.wev { padding-left: 4px; overflow: hidden; position: relative; } .wev .rules { position: absolute; inset: 0 0 0 4px; } .wev .ev, .wev .evs { position: relative; background: #fff; display: inline-block; max-width: 100%; box-sizing: border-box; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; vertical-align: top; margin-right: 9px; } .wev .evs { font-size: 6.4pt; }
.wd .kj { font-size: 14pt; display: block; line-height: 1.1; } .wd .dt { font-size: 7.6pt; font-weight: 700; }
.wsky { font-size: 7pt; display: flex; flex-direction: column; gap: 1px; } .wsky .ms { display: flex; align-items: center; gap: 3px; }
.wr-top { display: grid; grid-template-columns: 1.25fr 1fr; gap: 0.15in; } .word .wk-k { font-size: 20pt; line-height: 1.2; }
.genko { display: grid; grid-template-columns: repeat(6, 0.26in); gap: 0; margin-top: 4px; } .genko span { width: 0.26in; height: 0.26in; border: 1px solid #999; background: linear-gradient(#ccc, #ccc) center/100% 1px no-repeat, linear-gradient(#ccc, #ccc) center/1px 100% no-repeat; }
.word p { margin: 2px 0 0; font-size: 7pt; } .prio ol { margin: 0; padding-left: 14px; } .prio li { height: 0.36in; border-bottom: 1px solid #a0a0a0; }
.hab, .mline { width: 100%; table-layout: fixed; } .hab th { font-family: 'Noto Serif JP', serif; font-size: 8pt; } .hab td { border: 1px solid #999; height: 0.24in; } .hab td.hl, .mline td.hl { width: 0.75in; border: none; border-bottom: 1px solid #999; font-size: 7pt; color: #444; }
.mline td { height: 0.16in; text-align: center; } .mline i { display: inline-block; width: 4px; height: 4px; border-radius: 50%; background: #888; } .mline td.hl { border: none; text-align: right; padding-right: 6px; } .mline tr.zero td { border-top: 1px solid #999; border-bottom: 1px solid #999; } .mline td.dl { font-family: 'Noto Serif JP', serif; font-size: 7pt; }
.halves { gap: 0; } .day { flex: 1; display: flex; flex-direction: column; min-height: 0; } .cut { height: 0; border-top: 1px dashed #999; margin: 0.08in 0; }
.dh { display: grid; grid-template-columns: 0.52in 1.55in 1fr; align-items: center; border-bottom: 1px solid #111; padding-bottom: 3px; }
.dnum { font-size: 26pt; font-weight: 600; line-height: 1; } .dname { font-size: 9.5pt; font-weight: 700; } .djp { font-size: 7pt; } .djp .kj { font-size: 12pt; }
.dsky { display: flex; gap: 5px; align-items: center; font-size: 7pt; line-height: 1.35; justify-content: flex-end; text-align: right; } .dsky svg { order: 2; }
.dko { font-size: 7pt; padding: 3px 0 2px; border-bottom: 1px solid #999; } .dko .jp { font-size: 8pt; } .dn2 { font-style: italic; } .rt { float: right; }
.dev { font-size: 7pt; padding: 2px 0; border-bottom: 1px solid #999; max-height: calc(3 * 1.2em + 4px); overflow: hidden; } .dev .more { color: #444; }
.sky1 .pay-mk { display: inline-flex; margin-left: 4px; color: #555; } .sky1 .pay-mk .ic { width: 11px; height: 11px; }
.chk, .spn { display: flex; align-items: center; gap: 3px; font-size: 7pt; padding: 3px 0 1px; } .lbl { font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; font-size: 7pt; margin: 0 2px 0 5px; } .lbl:first-child { margin-left: 0; }
.bub { display: inline-flex; } .bub i { width: 9px; height: 9px; border: 1px solid #333; border-radius: 50%; } .bub:nth-child(5) i { border-width: 1.6px; }
.bub.nb i { border-width: 1px; box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center; width: 15px; height: 15px; font: 500 5.6pt Inter, sans-serif; font-style: normal; line-height: 1; color: #222; } .bub.nb.mid i { border-width: 1.7px; font-weight: 700; } .end { font-size: 7pt; color: #444; }
.blank { display: inline-block; width: 0.35in; border-bottom: 1px solid #333; height: 9px; } .blank.long { flex: 1; } .spoon { margin: 0 0.5px; } .sp2 { margin-left: 8px; }
.log { flex: 1; min-height: 0.8in; margin-top: 3px; }
.rev { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px; border-top: 1px solid #333; padding-top: 2px; } .rev div { font-size: 7pt; display: flex; flex-direction: column; } .rev b { text-transform: uppercase; letter-spacing: 0.5px; font-size: 7pt; } .rev span { height: 0.42in; overflow: hidden; }
.fact { font-size: 8pt; line-height: 1.25; padding-top: 3px; margin-top: 2px; border-top: 1px dotted #777; font-style: italic; color: #222; } .fact b { font-style: normal; text-transform: uppercase; letter-spacing: 0.5px; margin-right: 3px; }
.pio { border: 1px solid #333; padding: 5px 7px; margin-top: 0.1in; font-size: 7.4pt; line-height: 1.32; } .pio p { margin: 2px 0 0; } .pio-h { display: flex; align-items: baseline; gap: 5px; } .pio-h b { font-size: 9.5pt; } .pio-k { font-size: 7pt; text-transform: uppercase; letter-spacing: 0.6px; font-weight: 700; margin-right: 3px; } .pio-f { font-style: italic; } .pio-f b { font-style: normal; font-size: 7pt; text-transform: uppercase; letter-spacing: 0.5px; margin-right: 3px; }

.page.m { padding: ${TOP + FRAME_PAD}in ${OUTSIDE + FRAME_PAD}in ${BOTTOM + FRAME_PAD + STRIP + 0.08}in ${INSIDE + FRAME_PAD}in; }
.page.m.verso { padding-left: ${OUTSIDE + FRAME_PAD}in; padding-right: ${INSIDE + FRAME_PAD}in; }
.frame { position: absolute; top: ${TOP}in; bottom: ${BOTTOM}in; border: ${BORDER_PT}pt solid #000; pointer-events: none; }
.recto .frame { left: ${INSIDE}in; right: ${OUTSIDE}in; } .verso .frame { left: ${OUTSIDE}in; right: ${INSIDE}in; }
.strip { position: absolute; bottom: ${BOTTOM + FRAME_PAD}in; height: ${STRIP}in; display: flex; align-items: flex-end; gap: 0.1in; }
.recto .strip { left: ${INSIDE + FRAME_PAD}in; right: ${OUTSIDE + FRAME_PAD}in; } .verso .strip { left: ${OUTSIDE + FRAME_PAD}in; right: ${INSIDE + FRAME_PAD}in; }
.strip .pno { font: 500 7pt 'Inter', sans-serif; color: #333; width: 0.2in; } .strip .send { font: 700 7pt 'Inter', sans-serif; color: #333; letter-spacing: 0.5px; }
.sym { display: flex; flex-direction: column; align-items: center; gap: 2px; } .sym i { width: 12px; height: 12px; border: 1px dashed #333; border-radius: 50%; }
.strip .qr { margin-left: auto; width: ${STRIP}in; height: ${STRIP}in; } .strip .qr svg { width: 100%; height: 100%; display: block; }
.m .dots { background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='5mm' height='5mm' viewBox='0 0 50 50'%3E%3Ccircle cx='25' cy='25' r='4' fill='%23C8C8C8'/%3E%3C/svg%3E"); background-size: 5mm 5mm; background-position: -2.5mm -2.5mm; }
.m .rule { border-bottom-color: #c8c8c8; }
.zl { font-family: 'Inter', sans-serif; font-weight: 700; font-size: 7pt; letter-spacing: 0.6px; text-transform: uppercase; color: #111; }
.hz { display: grid; grid-template-columns: 1.35fr 1fr; gap: 4px; margin-bottom: 4px; }
.zbox { border: 1px solid #9a9a9a; background: #e6e6e6; padding: 3px 5px; min-height: 0.3in; display: flex; gap: 5px; align-items: baseline; }
.zbox .zv { font: 500 7.5pt 'Inter', sans-serif; } .blank.sm { width: 0.25in; margin-right: 4px; }
.care { border-top: 1px solid #9a9a9a; border-bottom: 1px solid #9a9a9a; padding: 4px 0; margin: 3px 0; }
.cr { display: flex; align-items: center; gap: 4px; font-size: 7pt; height: 0.215in; white-space: nowrap; } .cr .sp { margin-left: 14px; } .cr > .zl:first-child { width: 0.52in; flex: none; }
.ck { display: inline-flex; align-items: center; gap: 2px; margin-right: 4px; } .ck i { width: 9px; height: 9px; border: 1.1px solid #000; display: inline-block; } .ck span { font: 500 7pt 'Inter', sans-serif; }
.work { display: flex; align-items: center; gap: 3px; font-size: 7pt; height: 0.22in; } .work .blank { width: 0.42in; }
.pay { font: 700 7pt 'Inter', sans-serif; letter-spacing: 0.3px; } .hol { font-size: 7pt; line-height: 1.1; font-weight: 700; } .hol.fed { text-decoration: underline; }
.wk-shift { font-size: 7pt; color: #333; margin-top: 2px; }
.sh { font: 600 7.5pt Inter, sans-serif; text-transform: uppercase; margin: 5px 0 1px; border-bottom: 1px solid #000; }
.sup { padding: 1px 0; border-bottom: 1px solid #e3e3e3; font-size: 7.2pt; line-height: 1.2; } .sup .sn { display: flex; align-items: center; gap: 3px; } .sup .sn b { margin-right: auto; }
.chip { font: 600 7pt Inter, sans-serif; border: 1px solid #000; padding: 0 2px; line-height: 1.2; } .chip.tx { background: #000; color: #fff; }
.clinic { border: 1px solid #000; padding: 4px 6px; font-size: 7.2pt; line-height: 1.2; } .clinic .sup:last-of-type { border-bottom: none; } .cf { display: flex; gap: 4px; align-items: flex-end; margin-top: 4px; font: 600 7pt Inter, sans-serif; text-transform: uppercase; } .cf i { flex: 1; border-bottom: 1px solid #000; height: 0.16in; }
.qc { padding: 3px 0 5px; border-bottom: 1px solid #e3e3e3; } .qg { display: grid; grid-template-columns: 1fr 1fr; column-gap: 12px; } .qr { display: flex; gap: 6px; align-items: flex-end; }
.qf { display: flex; gap: 4px; align-items: flex-end; flex: 1; min-height: 0.25in; } .qf span { font: 500 7pt Inter, sans-serif; text-transform: uppercase; color: #333; } .qf i { flex: 1; border-bottom: 1px solid #777; height: 0.17in; }
.qt { font: 600 7pt Inter, sans-serif; display: flex; gap: 2px; align-items: center; padding-bottom: 1px; } .qt i { width: 9px; height: 9px; border: 1px solid #000; display: inline-block; }
.cbl2 { display: flex; align-items: center; gap: 6px; font-size: 7.8pt; padding: 3px 0; border-bottom: 1px solid #e3e3e3; } .cbl2 i { width: 10px; height: 10px; border: 1.2px solid #000; flex: none; } .qf .u { text-transform: none; color: #666; }
.ic { flex: none; vertical-align: -2px; color: var(--ink, #000); }
.cg2 { display: grid; grid-template-columns: 1fr 1fr; column-gap: 12px; } .care .cr { gap: 5px; height: 0.23in; } .care .cr > .ic:first-child { width: 12px; height: 12px; margin-right: 3px; }
.care .ck { gap: 2px; } .care .ck .ic { width: 11px; height: 11px; } .care .gap { width: 6px; } .care .u { font-size: 7pt; color: #555; } .care .off { font: 500 7pt Inter, sans-serif; text-transform: uppercase; }
.blank.xs { width: 0.24in; } .care [data-zone="work"] { gap: 3px; } .care .cr.sp { margin-top: 1px; }
.rev .zl .ic { width: 12px; height: 12px; }
.trk th .ic { width: 10px; height: 10px; } .trn .ic { width: 10px; height: 10px; vertical-align: -2px; margin-right: 3px; } .src { font-size: 7pt; margin: 8px 0 1px; color: #333; } .lives { margin-top: 1px; margin-bottom: 0; }
.ikey { display: grid; grid-template-columns: 1fr 1fr; gap: 3px 12px; font-size: 7.5pt; margin-bottom: 6px; } .ikey span { display: flex; align-items: center; gap: 5px; } .ikey .ic { width: 11px; height: 11px; }
.sq { margin-top: 3px; } .sph { display: flex; align-items: flex-end; gap: 10px; } .sph .pt { flex: none; } .sph .qf { max-width: 2.1in; } .pn { display: flex; gap: 8px; align-items: flex-end; } .pn .qf:first-child { flex: 1.2; } .sq .lines.l2 { height: 0.36in; } .sq + .sq { margin-top: 5px; } .sq b { font-size: 7.5pt; } .script { margin-top: 3px; border: 1px solid #000; padding: 5px 7px; font-size: 7.5pt; line-height: 1.35; }
.carep { width: 100%; } .carep th { text-align: left; font-size: 7.5pt; border-bottom: 1px solid #333; } .carep td { height: 0.26in; border-bottom: 1px solid #bbb; } .wd .wdn { font-size: 11pt; font-weight: 600; display: block; line-height: 1.1; } .cal .sk { font-size: 7pt; font-style: italic; color: #333; line-height: 1.1; border: none; padding: 0; }
.ztags { grid-column: 1 / -1; }
.sky1 { display: flex; flex-wrap: wrap; gap: 0 4px; align-items: center; font-size: 8pt; line-height: 1.25; margin: 2px 0; } .sky1 > span:not(.season) { white-space: nowrap; } .sky1 .season { margin-left: auto; font-style: italic; color: #333; text-align: right; } .sky2l { font-size: 8pt; color: #333; margin: 1px 0 3px; }
.net { width: 100%; table-layout: fixed; border-collapse: collapse; font-size: 7pt; font-variant-numeric: tabular-nums; margin-top: 4px; }
.net th { font: 600 7pt Inter, sans-serif; text-align: left; border-bottom: 1px solid #000; padding: 1px 3px; }
.net td { padding: 1.6px 1.5px; overflow: hidden; letter-spacing: -0.015em; border-bottom: 1px solid #e3e3e3; white-space: nowrap; } .net .rn { font: 700 7.5pt Inter, sans-serif; text-align: right; padding-right: 4px; } .net col.c1 { width: 0.3in; } .net col.c2 { width: 0.66in; }
.net .rname { text-overflow: ellipsis; }
.hg { width: 100%; border-collapse: collapse; font-size: 7pt; font-variant-numeric: tabular-nums; margin-top: 4px; table-layout: fixed; }
.hg th { font: 600 7pt Inter, sans-serif; padding: 1px 2px; text-align: left; } .hg th.gh { border-bottom: 1px solid #000; line-height: 1.15; vertical-align: bottom; } .hg th.gh .dim { font-weight: 400; }
.hg tr.rng td { background: #f1f1f1; } .hg td { padding: 0.4px 2px; line-height: 1.1; border-bottom: 1px solid #e3e3e3; overflow: hidden; letter-spacing: -0.02em; } .hg td.hl { white-space: nowrap; font: 600 7pt Inter, sans-serif; text-align: right; padding-right: 5px; } .hg td.hl.pm { font-weight: 800; }
.busvalid { font: 600 7pt Inter, sans-serif; margin: 3px 0 0; border: 1px solid #000; padding: 2px 5px; display: inline-block; } .busbox { margin-top: 8px; border: 1px solid #000; padding: 4px 7px; font-size: 8pt; }
.rt { font: 600 7.5pt Inter, sans-serif; text-transform: uppercase; margin: 6px 0 0; } .hg .gs { border-left: 1px solid #9a9a9a; padding-left: 4px; }
.az { margin-top: 4px; } .cb { display: flex; align-items: center; gap: 6px; height: 0.24in; } .cb i { width: 10px; height: 10px; border: 1.2px solid #000; flex: none; } .cb span { flex: 1; border-bottom: 1px solid #c8c8c8; height: 100%; display: flex; align-items: flex-end; font-size: 7.5pt; padding-bottom: 1px; }
.m .chk .zl, .m .spn .zl { margin-right: 3px; }
.m .lin th, .m .lin td { font-size: 7pt; padding: 2px 6px 2px 0; } .m .lin th { width: 1.1in; } .m .lead { font-size: 7.5pt; } .m .small { font-size: 7pt; }
.m .steps { gap: 0.06in; } .m .steps p { font-size: 7.4pt; } .m .anat .a3 { height: 0.45in; } .m .anat div { font-size: 7pt; padding: 3px 5px; }
.m .cal.rows5 td { height: 0.8in; } .m .cal.rows6 td { height: 0.67in; } .m .trk td { height: 0.14in; } .m .trk th { white-space: nowrap; } .m .trk { font-size: 7pt; } .m .trk .mood i, .m .trk .en i { width: 6px; height: 6px; margin: 0 0.5px; } .m .trk .mood { white-space: nowrap; } .m .trk .bx { width: 0.34in; }
.m .keycols { gap: 0.08in; } .m .phases, .m .gl-list { font-size: 7pt; }
.m .cal + .small { display: none; } .trk .un th { font: 500 5.6pt Inter, sans-serif; color: #444; padding: 0 1px 1px; text-align: left; } .m .mline td { height: 0.12in; } .m .hab td { height: 0.2in; } .m .fill { min-height: 0.25in; } .m .genko { grid-template-columns: repeat(6, 0.22in); } .m .genko span { width: 0.22in; height: 0.22in; } .m .pio { margin-top: 0.06in; }
.m .wrow.other { flex: 0 0 0.22in; } .m .wrow.other .wev { background: none; }
.day.full .log { min-height: 1.6in; } /* writing space is never below 40 mm (1.6 in = 40.6 mm) */ .day.full .rev { margin-top: 4px; } .day.full .rev span { height: 0.44in; }
.wrow.other { color: #777; }
.m .cal.rows4 td { height: 1.26in; } .m .cal.rows5 td { height: 1.0in; } .m .cal.rows6 td { height: 0.84in; } .m .trk td { height: 0.16in; } .m .cal { flex: 0 0 auto; }
.review .rvh { margin-top: 0.02in; font-size: 10pt; text-transform: none; letter-spacing: 0; } .rq { margin-top: 4px; font-size: 7.6pt; }
.xh { display: flex; justify-content: space-between; align-items: baseline; } .xft { display: flex; gap: 5px; align-items: flex-end; font-size: 7.4pt; margin: 4px 0; } .xft i { flex: 1; border-bottom: 1px solid #333; height: 12px; }
.xp { font-size: 8pt; margin: 4px 0 6px; }
.lines.fill { flex: 1; }
.blankpage { flex: 1; }
${DAYPAGE_CSS}
</style></head><body>
${pages.map((p, i) => { const n = i + 1; const side = n % 2 ? 'recto' : 'verso'; const marks = `<div class="frame"></div><div class="strip"><span class="pno">${n}</span><span class="send">SEND TO</span>${symbolRow}<span class="qr">${qrSvgs[i]}</span></div>`; return `<div class="page ${side} ${p.cls} m" data-page-id="${p.id}">${p.html}${marks}</div>`; }).join('\n')}
<script>
document.querySelectorAll('.lines').forEach((el) => {
  const pitch = parseFloat(el.dataset.pitch || '0.26') * 96;
  const n = Math.floor((el.clientHeight - 1) / pitch);
  for (let i = 0; i < n; i++) { const d = document.createElement('div'); d.className = 'rule'; d.style.height = pitch + 'px'; el.appendChild(d); }
});
${drawRulings.toString()}
document.fonts.ready.then(drawRulings);
</script></body></html>`;

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(`${OUT}/journal.html`, html);
fs.writeFileSync(`${OUT}/data.json`, JSON.stringify(D, null, 1));
const browser = await launch();
const page = await browser.newPage();
await page.goto('file://' + process.cwd() + `/${OUT}/journal.html`, { waitUntil: 'networkidle' }); await page.evaluate(() => document.fonts.ready);
await page.evaluate(() => drawRulings()); // vector rulings on the final layout (the page also does this on load)
// Zone map for the scanning app: every labelled zone in mm, relative to the inner edge of the black frame.
const layout = await page.evaluate(() => {
  const px2mm = 25.4 / 96;
  return [...document.querySelectorAll('.page')].map((pg, i) => {
    const f = pg.querySelector('.frame').getBoundingClientRect(), bw = parseFloat(getComputedStyle(pg.querySelector('.frame')).borderTopWidth);
    const ox = f.left + bw, oy = f.top + bw, fw = f.width - 2 * bw, fh = f.height - 2 * bw;
    const rect = (el) => { const e = el.getBoundingClientRect(); return { x: +((e.left - ox) * px2mm).toFixed(1), y: +((e.top - oy) * px2mm).toFixed(1), w: +(e.width * px2mm).toFixed(1), h: +(e.height * px2mm).toFixed(1) }; };
    // repeated zone names get _2, _3 ... (same rule as the day page blocks)
    const seen = {};
    const zones = [...pg.querySelectorAll('[data-zone]')].map((el) => { const n = el.dataset.zone; seen[n] = (seen[n] || 0) + 1; return { zone: seen[n] > 1 ? `${n}_${seen[n]}` : n, ...rect(el) }; });
    if (!zones.some((z) => !z.zone.startsWith('send_to_'))) { // a page with no labelled block (title, key, directories ...): one zone for everything inside the frame
      const kids = [...pg.children].filter((c) => !c.matches('.frame, .strip, .folio')).map((c) => c.getBoundingClientRect()).filter((r) => r.width && r.height);
      if (!kids.length) kids.push(pg.getBoundingClientRect()); // nothing measurable inside: fall back to the whole page
      const l = Math.min(...kids.map((r) => r.left)), t = Math.min(...kids.map((r) => r.top));
      zones.push({ zone: 'content', ...rect({ getBoundingClientRect: () => ({ left: l, top: t, width: Math.max(...kids.map((r) => r.right)) - l, height: Math.max(...kids.map((r) => r.bottom)) - t }) }) });
    }
    zones.push({ zone: 'page_code', ...rect(pg.querySelector('.strip .qr')) }, { zone: 'send_to', ...rect(pg.querySelector('.strip')) });
    return { page: i + 1, frame_inner_mm: { w: +(fw * px2mm).toFixed(1), h: +(fh * px2mm).toFixed(1) }, zones };
  });
});
const meta = pages.map((p, i) => ({ id: p.id, label: p.label, ...(p.shared ? { shared: true } : {}), type: p.type, date: p.date || null, ...(p.from && !p.date ? { from: p.from, to: p.to } : {}), section: p.section, code: pageCode(i), code_format: 'data_matrix' }));
const layoutJson = { book: VOL.id, edition: EDITION, size: SIZE_CODE, code_scheme: 'KW2|<edition>|<yymm>|<size><page>', trim_in: [TRIM_W, TRIM_H], border_pt: BORDER_PT, quiet_zone_in: QUIET, symbols: ['fire', 'water', 'air', 'earth', 'crescent_moon', 'full_moon', 'pentacle'], pages: layout.map((l, i) => ({ ...meta[i], ...l })) };
fs.writeFileSync(`${OUT}/layout.json`, JSON.stringify(layoutJson, null, 1));
// manifest.json: code -> page id -> section -> zones, plus what identifies this build. Keep it with every proof or print run: a printed
// page's code decodes through the manifest of the build it came from, even after the layout changes (see README "Page identity").
const manifest = { book: VOL.id, size: SIZE_CODE, edition: EDITION, hardcover: HARDCOVER, built: D.generated, commit: process.env.GITHUB_SHA || null, page_count: pages.length, code_scheme: layoutJson.code_scheme,
  pages: layoutJson.pages.map((p) => ({ code: p.code, page: p.page, id: p.id, label: p.label, section: p.section, type: p.type, date: p.date, ...(p.from ? { from: p.from, to: p.to } : {}), shared: !!p.shared, zones: p.zones })) };
fs.writeFileSync(`${OUT}/manifest.json`, JSON.stringify(manifest, null, 1));
await page.pdf({ width: `${TRIM_W}in`, height: `${TRIM_H}in`, path: `${OUT}/${PROFILE.book.slug}-${VOL.id}-interior-${HARDCOVER ? 'hardcover-' : ''}${SIZE_TAG}.pdf`, printBackground: true, preferCSSPageSize: true });
await browser.close();
fs.writeFileSync(`${OUT}/pages${HARDCOVER ? '-hardcover' : ''}.txt`, String(pages.length)); // separate counts, so each cover sizes its own spine
console.log(`book ${VOL.id}: ${D.days[0].date} → ${D.days[D.days.length - 1].date}, ${D.weeks.length} weeks, ${pages.length} pages`);
