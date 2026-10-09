// Photo journaling, the glue-in half (BUILD-PLAN section 23, slice PH1): frames for photos PASTED ON THE PAPER.
// Nothing here touches an image: no upload, no camera, no storage. A block is a true-size window (corner marks the pasted print
// hides), a keep-clear glue margin, and caption lines. This file holds the geometry only (sizes, the plan of a block's frames, the fit
// rules and their plain-words reasons, the gutter keep-out); daypage.mjs draws the HTML from a plan and holds the block options.
// No imports: the editor inlines this file in front of daypage.mjs (editor/build.mjs), so every top-level name is unique in that script.
//
// UNITS. Everything below is in CSS inches as render.mjs lays the page out. The 8.5x11 page is laid out at 8.5/ZOOM wide and zoomed
// x1.294, so a print of W physical inches is drawn W / zoom CSS inches wide: it measures W on the paper, in both trims. A print size
// is physical ("3 x 4 in"); a row of the page grid is 0.22 CSS in (0.22 in on 5.5x8.5, 0.285 in on 8.5x11).

export const PHOTO_TYPES = ['photoframe', 'photostrip', 'photodaily', 'contactsheet'];
export const isPhoto = (b) => !!b && PHOTO_TYPES.includes(b.type);

// ---- the page, as render.mjs builds it (a test measures these in Chromium; test-photoblocks.mjs) ----
export const PHOTO_ZOOM = 11 / 8.5; // render.mjs ZOOM for SIZE=letter
export const zoomOf = (size) => (size === 'letter' ? PHOTO_ZOOM : 1);
const PAGE_W = { small: 5.5, letter: +(8.5 / PHOTO_ZOOM).toFixed(4) }; // CSS inches (render.mjs W_IN)
export const PAGE_CHROME_IN = 0.5 + 0.3 + 2 * (9 / 72 + 0.5); // inside + outside margin, and the 9 pt frame plus its 0.5 in quiet zone on both sides
export const GRID_GAP_IN = 8 / 96; // GRIDS.day.gapPx
export const GRID_COLS = 4;
export const GRID_ROW_IN = 0.22; // GRIDS.day.rowIn
export const trimName = (size) => (size === 'letter' ? '8.5×11' : '5.5×8.5');
// Width of `cols` grid columns (and the gaps between them), CSS inches.
export function cellWidth(cols, size = 'small') {
  const content = PAGE_W[size === 'letter' ? 'letter' : 'small'] - PAGE_CHROME_IN, col = (content - (GRID_COLS - 1) * GRID_GAP_IN) / GRID_COLS;
  return cols * col + (cols - 1) * GRID_GAP_IN;
}
export const pageContentWidth = (size) => cellWidth(GRID_COLS, size);

// ---- print sizes (physical inches, width x height as the print is usually held, tall side second) ----
// Only photo-lab and instant-film sizes plus a limited custom size. No passport or ID sizes: those have legal rules; this is a journal.
export const PHOTO_SIZES = {
  '0.5x0.5': [0.5, 0.5], '0.75x0.75': [0.75, 0.75], '1x1': [1, 1], '1x1.5': [1, 1.5], '1.5x1.5': [1.5, 1.5], '1.5x2': [1.5, 2], '2x2': [2, 2],
  '2x3': [2, 3], '3x3': [3, 3], '3x4': [3, 4], '4x6': [4, 6],
  'instax-mini': [2.1, 3.4], 'instax-square': [2.4, 2.4], 'instax-wide': [3.4, 2.1], polaroid: [3.1, 3.1],
};
export const SIZE_NAMES = {
  '0.5x0.5': '0.5 × 0.5 in', '0.75x0.75': '0.75 × 0.75 in', '1x1': '1 × 1 in', '1x1.5': '1 × 1.5 in', '1.5x1.5': '1.5 × 1.5 in', '1.5x2': '1.5 × 2 in', '2x2': '2 × 2 in',
  '2x3': '2 × 3 in', '3x3': '3 × 3 in', '3x4': '3 × 4 in', '4x6': '4 × 6 in',
  'instax-mini': 'Instax mini 2.1 × 3.4', 'instax-square': 'Instax square 2.4 × 2.4', 'instax-wide': 'Instax wide 3.4 × 2.1', polaroid: 'Polaroid picture 3.1 × 3.1', custom: 'Custom',
};
const choices = (ids) => ids.map((id) => [id, SIZE_NAMES[id]]);
export const FRAME_SIZES = choices(['2x3', '3x3', '3x4', '4x6', 'instax-mini', 'instax-square', 'instax-wide', 'polaroid', 'custom']);
export const STRIP_SIZES = choices(['1x1', '1x1.5', '1.5x1.5', '1.5x2', '2x2', '2x3', 'instax-mini']);
export const SHEET_SIZES = choices(['0.75x0.75', '1x1', '1x1.5', '1.5x1.5']);
export const DAILY_SIZES = choices(['0.5x0.5', '0.75x0.75']);
export const CUSTOM_MIN = 10, CUSTOM_MAX = 60; // tenths of an inch: 1.0 to 6.0 in a side

export const fmtIn = (v) => String(+(+v).toFixed(2));
// One print, physical inches: portrait puts the long side upright, landscape lays it down (a square is both).
export function printDims(b) {
  let w, h;
  if (b.size === 'custom') { w = (+b.cw || 30) / 10; h = (+b.ch || 40) / 10; } else [w, h] = PHOTO_SIZES[b.size] || PHOTO_SIZES['2x3'];
  const lo = Math.min(w, h), hi = Math.max(w, h);
  return b.turn === 'landscape' ? { w: hi, h: lo } : { w: lo, h: hi };
}
export const sizeText = (b) => { const d = printDims(b); return `${fmtIn(d.w)} × ${fmtIn(d.h)} in`; };

// ---- the drawn parts (physical inches) ----
export const GLUE_IN = { photoframe: 0.08, photostrip: 0.08, contactsheet: 0.06, photodaily: 0.06 }; // keep-clear margin round a print (and round the block)
export const GAP_IN = { photostrip: 0.12, contactsheet: 0.08, photodaily: 0.06 }; // between frames
export const MARK_INSET_IN = 0.04; // the corner marks are drawn this far INSIDE the print's edge, so a print cut to size covers them and no edge peeks out
export const markArm = (w, h) => +Math.min(0.14, 0.25 * Math.min(w, h)).toFixed(4);
export const TICK_GAP_IN = 0.015; // cut guide: tick marks start this far outside the print, in the glue margin
// Gutter keep-out: a glued print must start at least this far from the spine edge of the page. A bound book's page curves for about half an
// inch next to the spine, and a print bridging the curve lifts. The 9 pt scan frame and its quiet zone put every cell 0.925 in (outer side)
// or 1.125 in (spine side) in from the trim edge before the zoom, so the grid already keeps clear; this is the rule that says so, and the
// test that breaks if page geometry ever changes.
export const GUTTER_KEEP_IN = 0.625;
const FRAME_PAD_IN = 9 / 72 + 0.5; // the 9 pt scan frame and its quiet zone (render.mjs FRAME_PAD)
// How far the nearest cell edge is from the trim edge on the page's spine side, physical inches. A page's side is not known when a layout is
// made (a day page can be left or right), so the worse of the two is used: the outside margin (0.3 in) plus the frame, not the inside one (0.5 in).
export const gutterClearance = (size = 'small') => +((0.3 + FRAME_PAD_IN) * zoomOf(size)).toFixed(4);
export const gutterProblem = (size = 'small', keep = GUTTER_KEEP_IN) => {
  const c = gutterClearance(size);
  return c >= keep - 1e-9 ? null : `A glued print needs to start ${fmtIn(keep)} in from the spine edge, and this page's cells start ${fmtIn(c)} in from it.`;
};

// ---- the rows of a block ----
const ROW = GRID_ROW_IN, LABEL = ROW, CAP = 0.19, CAP_DAY = 0.15; // CSS inches: the label row, a date or number line under a frame
const rowsOf = (h) => Math.max(1, Math.ceil((h + 0.02) / ROW));
export const linesCount = (b) => (b.lines === 'three' ? 3 : b.lines === 'one' ? 1 : 0) + (b.type === 'photoframe' && b.who ? 1 : 0);
export function monthDays(date) {
  const m = /^(\d{4})-(\d\d)-\d\d$/.exec(date || '');
  return m ? new Date(Date.UTC(+m[1], +m[2], 0)).getUTCDate() : 0;
}
// What a photo-a-day block counts: its `days` option, else the days of the page's month (a day page), else 31.
export const dailyDays = (b, date) => (b.days === 'auto' || !b.days ? monthDays(date) || 31 : +b.days);

// The plan of a block at a trim and a width in columns: where every frame goes, how big the block is, and whether it fits that width.
// x = { days, note } (photo a day: how many days, and whether a line says when the day starts).
export function photoPlan(b, size = 'small', colSpan = GRID_COLS, x = {}) {
  const z = zoomOf(size), avail = cellWidth(colSpan, size), { w, h } = printDims(b);
  const g = GLUE_IN[b.type] / z, gap = (GAP_IN[b.type] || 0) / z, fw = w / z, fh = h / z;
  let n = 1, per = 1, cap = 0;
  if (b.type === 'photostrip') { n = b.n; cap = b.dates ? CAP : 0; per = b.dir === 'column' ? 1 : n; }
  if (b.type === 'contactsheet') { n = b.n; cap = CAP; }
  if (b.type === 'photodaily') { n = x.days || 31; cap = CAP_DAY; }
  if (b.type === 'contactsheet' || b.type === 'photodaily') { // as many to a row as fit, then balanced (7 frames: 4 + 3, not 6 + 1)
    const most = Math.max(1, Math.floor((avail - 2 * g + gap) / (fw + gap) + 1e-9)), rows = Math.ceil(n / most);
    per = Math.ceil(n / rows);
  }
  const rows = Math.ceil(n / per), unit = fh + cap;
  const areaW = 2 * g + per * fw + (per - 1) * gap, areaH = 2 * g + rows * unit + (rows - 1) * gap;
  const frames = Array.from({ length: n }, (_, i) => ({ n: i + 1, x: g + (i % per) * (fw + gap), y: g + Math.floor(i / per) * (unit + gap), w: fw, h: fh }));
  const extra = linesCount(b) + (x.note ? 1 : 0), total = LABEL + areaH + extra * ROW;
  return { z, g, gap, fw, fh, n, per, rows, unit, cap, areaW, areaH, frames, avail, total, extraRows: extra, rowsNeeded: rowsOf(total), print: { w, h }, fitsWidth: areaW <= avail + 1e-6 };
}

// The least room a block needs at `colSpan` columns: the smallest column count it fits across, and its height in inches (daypage.mjs MINSPAN).
export function photoMin(b, colSpan = GRID_COLS, size = 'small', x = {}) {
  let cols = GRID_COLS;
  for (let c = 1; c <= GRID_COLS; c++) {
    const p = photoPlan(b, size, c, x);
    // a frame, strip or column of prints: the first width the whole thing fits across. A sheet (contact, photo a day): the first width that fits in a page's rows.
    if (p.fitsWidth && (b.type === 'photoframe' || b.type === 'photostrip' || p.rowsNeeded <= 24)) { cols = c; break; }
  }
  return { cols, h: photoPlan(b, size, Math.max(colSpan, cols), x).total };
}

// Every reason a photo block cannot sit in colSpan x rowSpan cells at this trim, in plain words. null = it fits.
// rowSpan may be omitted (a flow layout stacks blocks, so only the width is known).
export function photoFit(b, colSpan, rowSpan, size = 'small', x = {}, name = 'Photo frame') {
  const z = zoomOf(size), p = photoPlan(b, size, colSpan, x), s = (n) => (n === 1 ? '' : 's');
  const phys = (v) => fmtIn(v * z);
  const what = b.type === 'photoframe' ? `a ${sizeText(b)} print` : b.type === 'photostrip' ? `${p.n} ${sizeText(b)} prints ${b.dir === 'column' ? 'in a column' : 'in a row'}` : `${sizeText(b)} frames`;
  if (!p.fitsWidth) {
    const whole = phys(pageContentWidth(size));
    return { code: 'photowidth', msg: `${name} does not fit: ${what} needs ${phys(p.areaW)} in across with its glue margin, and ${colSpan} column${s(colSpan)} of the ${trimName(size)} page ${colSpan === 1 ? 'is' : 'are'} ${phys(p.avail)} in wide (the whole page is ${whole} in). Pick a smaller print or turn it${colSpan < GRID_COLS ? ', give it more columns' : ''}${size === 'small' ? ', or build the 8.5×11 trim' : ''}.` };
  }
  if (rowSpan !== undefined && rowSpan !== null && rowSpan < p.rowsNeeded) {
    return { code: 'photorows', msg: `${name} does not fit: ${what} with its glue margin${linesCount(b) || x.note ? ' and lines' : ''} needs ${p.rowsNeeded} rows (${phys(p.total)} in tall on the ${trimName(size)} page); it has ${rowSpan}.` };
  }
  return null;
}
