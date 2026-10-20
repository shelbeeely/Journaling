// Notes, flash cards and stimming (BUILD-PLAN section 24, slice B1): the geometry of the blocks that are WRITTEN IN or TRACED by hand.
// Nothing here handles data: no upload, no storage, no sensor. A block is ruled paper, a few frames and tick boxes, drawn as plain HTML and
// vector SVG. This file holds the numbers only (widths a block needs, row heights, the fit rules and their plain-words reasons, the
// tracing patterns); daypage.mjs draws the HTML and holds the options (TYPES).
// It imports from photo.mjs the page widths (cellWidth, zoomOf ...). The editor inlines both files in front of daypage.mjs
// (editor/build.mjs), so every top-level name here is unique in that script.
//
// UNITS. CSS inches as render.mjs lays the page out (the 8.5x11 page is laid out at 6.57 in wide and zoomed x1.294, exactly as photo.mjs says).
// A row of the page grid is 0.22 CSS in. Every height below is in CSS inches and is drawn as a fixed-height row, so a block's height is
// known before it is drawn: the minimum span of a block is its plan, and a test measures the drawing against it.
import { cellWidth, zoomOf, trimName, fmtIn, pageContentWidth, GRID_COLS, GRID_ROW_IN } from './photo.mjs';

export const NOTE_TYPES = ['cornell', 'notearea', 'conceptmap', 'questions', 'summarybox', 'flashstrip', 'reviewtracker', 'stimlog', 'stimmenu', 'stimtrace'];
export const isNote = (b) => !!b && NOTE_TYPES.includes(b.type);
// What a block type is called in the palette's groups (daypage.mjs TYPES reads these).
export const NOTE_GROUP = 'Notes and study', REG_GROUP = 'Regulation';

// ---- the vocabulary of rows ----
export const NOTE_PITCH = { 5.6: 0.22, 6.6: 0.26, 8.5: 0.335 }; // the same table as daypage.mjs PITCH_IN (a test keeps them equal)
export const NOTE_OVER = 0.06; // a block's own top rule and padding (.xb: 1px + 3px) and a little slack
export const NOTE_HDR = 0.22; // the label row
const NB_SMALL = 0.2; // a caption row (the "stimming is self-regulation" line, a summary label)
const nbRow = (b) => NOTE_PITCH[b.pitch] || 0.22;
const nbRows = (h) => Math.max(1, Math.ceil((h + 0.02) / GRID_ROW_IN)); // inches of content (+ a little slack) -> whole rows (daypage.mjs rowsIn)
const nbHdr = (b) => (b.title !== undefined && b.title !== '' ? NOTE_HDR : 0);

// ---- flash cards: fold-over strips ----
// A row is [number][term line][ticks] | fold | [answer line]. The fold line sits at `split` percent of the strip's width, the same x on every row,
// so one fold of the paper along it hides every answer. The ticks are on the term side, so they stay in view while the answers are folded away.
export const FLASH_G = { num: 0.14, box: 0.104, boxGap: 0.034, icon: 0.1, pad: 0.05, minTerm: 0.5, minAnswer: 0.7, gap: 0.04 };
export function flashParts(b) {
  const ticks = b.reviews > 0 ? b.reviews * FLASH_G.box + (b.reviews - 1) * FLASH_G.boxGap : 0;
  const pair = b.gotit ? 2 * (FLASH_G.icon + 0.02 + FLASH_G.box) + 0.07 : 0;
  const groups = [b.num, ticks, pair].filter(Boolean).length;
  const fixed = (b.num ? FLASH_G.num : 0) + ticks + pair + groups * FLASH_G.gap + FLASH_G.pad; // everything on the term side that is not the term line
  return { ticks, pair, fixed, term: fixed + FLASH_G.minTerm, answer: FLASH_G.minAnswer + FLASH_G.pad };
}
export const flashNeed = (b) => { const f = flashParts(b), s = b.split / 100; return Math.max(f.term / s, f.answer / (1 - s)); };
export const flashRowH = (b) => nbRow(b);
export const flashH = (b) => NOTE_OVER + NOTE_HDR + b.n * flashRowH(b);

// ---- spaced review: topic lines and one tick per review ----
export const REVIEW_DAYS = { d1: 1, d3: 3, d7: 7, d14: 14, d21: 21, d30: 30 };
export const REVIEW_G = { col: 0.3, date: 0.5, minTopic: 0.7, gap: 0.04 };
export const reviewSteps = (b) => Object.keys(REVIEW_DAYS).filter((k) => b.every && b.every[k]);
export const reviewNeed = (b) => REVIEW_G.minTopic + (b.date ? REVIEW_G.date + REVIEW_G.gap : 0) + reviewSteps(b).length * REVIEW_G.col + REVIEW_G.gap;
export const reviewH = (b) => NOTE_OVER + NOTE_HDR + b.n * nbRow(b);

// ---- Cornell notes ----
export const cornellH = (b) => NOTE_OVER + nbHdr(b) + (b.head ? NOTE_HDR : 0) + NB_SMALL + b.n * nbRow(b) + 0.04 + NB_SMALL + b.s * nbRow(b); // label, topic line, column heads, rows, the summary strip
export const cornellNeed = (b) => (b.head ? 2.0 : 1.5); // the topic and date line: two labels, a line of 0.4 in and the date rule of 0.8 in
// ---- a note area: header lines, then paper that takes the rest of its cell ----
export const noteHead = (b) => (b.title !== '' || b.topic || b.date ? 1 : 0) + (b.source ? 1 : 0);
export const noteareaH = (b) => NOTE_OVER + noteHead(b) * NOTE_HDR + b.n * nbRow(b);
export const noteareaNeed = (b) => (b.topic && b.date ? 1.7 : b.topic || b.date ? 1.3 : 1.0);
// ---- questions to answer ----
export const questionsH = (b) => NOTE_OVER + nbHdr(b) + b.n * nbRow(b) * (b.answers ? 2 : 1) + (b.answers ? 0.02 * b.n : 0);
export const questionsNeed = () => 1.2;
// ---- summary box ----
export const summaryH = (b) => NOTE_OVER + 0.06 + NOTE_HDR + b.n * nbRow(b);
export const summaryNeed = () => 1.0;

// ---- concept map: a centre bubble and branches ----
export const mapH = (b) => NOTE_OVER + nbHdr(b) + b.h / 10;
export const mapNeed = (b) => 1.4 + 0.2 * b.branches;
// The bubbles of a map in a box W x H (CSS inches): the centre, and `n` branch bubbles round it. The bubbles shrink until none touches another,
// the centre or the box edge. Returns also the connector from the centre's edge to each branch's edge. Pure and deterministic.
export function mapPlan(n, W, H) {
  const m = 0.04, gap = 0.04;
  const cx = W / 2, cy = H / 2, crx = Math.min(0.55, W * 0.16), cry = Math.min(0.3, H * 0.13);
  const edge = (e, tx, ty) => { const dx = tx - e.cx, dy = ty - e.cy, t = 1 / Math.hypot(dx / e.rx, dy / e.ry); return [e.cx + dx * t, e.cy + dy * t]; };
  let bx = Math.min(0.55, W * 0.16), by = Math.min(0.28, H * 0.13), nodes = [], ok = false;
  for (let k = 0; k < 60 && !ok; k++) {
    const ax = W / 2 - bx - m, ay = H / 2 - by - m;
    nodes = Array.from({ length: n }, (_, i) => { const a = -Math.PI / 2 + (2 * Math.PI * i) / n; return { cx: cx + ax * Math.cos(a), cy: cy + ay * Math.sin(a), rx: bx, ry: by }; });
    const box = (e) => [e.cx - e.rx, e.cy - e.ry, e.cx + e.rx, e.cy + e.ry];
    const hit = (p, q) => { const a = box(p), c = box(q); return a[0] < c[2] + gap && c[0] < a[2] + gap && a[1] < c[3] + gap && c[1] < a[3] + gap; };
    const centre = { cx, cy, rx: crx, ry: cry };
    ok = ax > 0 && ay > 0 && nodes.every((p, i) => !hit(p, centre) && nodes.every((q, j) => j <= i || !hit(p, q)));
    if (!ok) { bx *= 0.95; by *= 0.95; }
  }
  const centre = { cx, cy, rx: crx, ry: cry };
  const links = nodes.map((p) => { const [x1, y1] = edge(centre, p.cx, p.cy), [x2, y2] = edge(p, cx, cy); return { x1, y1, x2, y2 }; });
  return { centre, nodes, links, ok, W, H };
}

// ---- stimming ----
export const STIM_SENSES = { touch: 'Touch', move: 'Movement', sound: 'Sound', sight: 'Sight', chew: 'Taste and chew', press: 'Deep pressure' };
// A few examples per sense, written for this project, printed in light italics on the first lines of a sense when the menu's "examples" option is on.
// Boxes stay blank: they are for the person to tick. Short (about 20 characters at most) so each fits half a column; none asks anyone to stop.
export const STIM_EXAMPLES = {
  touch: ['smooth stone', 'soft fabric', 'fidget ring', 'warm mug'],
  move: ['rocking', 'bouncing', 'pacing', 'hand flapping'],
  sound: ['humming', 'a song on repeat', 'tapping a rhythm', 'soft rain sounds'],
  sight: ['lava lamp', 'sunlit leaves', 'a spinning top', 'sorting colours'],
  chew: ['chewy sweets', 'crunchy snacks', 'a chew necklace', 'ice chips'],
  press: ['a heavy blanket', 'a tight hug', 'pressing palms', 'a weighted lap pad'],
};
export const stimSenses = (b) => Object.keys(STIM_SENSES).filter((k) => b.senses && b.senses[k]);
const NB_NOTE_LINE = NB_SMALL; // the affirming caption row
export const stimlogRows = (b) => 1 + (b.where || b.ba ? 1 : 0);
export const stimlogH = (b) => NOTE_OVER + nbHdr(b) + (b.note ? NB_NOTE_LINE : 0) + b.n * (stimlogRows(b) * nbRow(b) + 0.04);
// row 1: when, felt good, (how much); row 2: where it helped, (before and after). The widths are the labels, the bubbles and a line of at least 0.6 in.
export const stimlogNeed = (b) => Math.max(1.85 + (b.size ? 0.6 : 0), (b.where ? 1.2 : 0) + (b.ba ? 1.75 : 0));
export const stimmenuRows = (b) => Math.ceil(stimSenses(b).length / 2);
export const stimmenuH = (b) => NOTE_OVER + nbHdr(b) + (b.note ? NB_NOTE_LINE : 0) + stimmenuRows(b) * (NB_SMALL + b.rows * nbRow(b) + 0.05) + (b.ideas ? 0.03 + b.ideas * nbRow(b) : 0);
export const stimmenuNeed = (b) => (b.examples ? 2.45 : 2.15); // examples need a little more width to read in
export const traceH = (b) => NOTE_OVER + NOTE_HDR + b.h / 10; // the label row always carries the "trace slowly" hint
export const traceNeed = () => 1.2;

// ---- the plan of a block at a trim: how wide it must be, how tall, how many columns and rows that is ----
const NB_NEED = { cornell: cornellNeed, notearea: noteareaNeed, conceptmap: mapNeed, questions: questionsNeed, summarybox: summaryNeed, flashstrip: flashNeed, reviewtracker: reviewNeed, stimlog: stimlogNeed, stimmenu: stimmenuNeed, stimtrace: traceNeed };
const NB_HEIGHT = { cornell: cornellH, notearea: noteareaH, conceptmap: mapH, questions: questionsH, summarybox: summaryH, flashstrip: flashH, reviewtracker: reviewH, stimlog: stimlogH, stimmenu: stimmenuH, stimtrace: traceH };
export function notePlan(b, size = 'small', colSpan = GRID_COLS) {
  const need = NB_NEED[b.type](b), h = NB_HEIGHT[b.type](b), avail = cellWidth(colSpan, size);
  let cols = 0;
  for (let c = 1; c <= GRID_COLS; c++) if (cellWidth(c, size) >= need - 1e-9) { cols = c; break; }
  return { need, h, avail, cols: cols || GRID_COLS, fitsWidth: avail >= need - 1e-9, fitsPage: cols > 0, rowsNeeded: nbRows(h), z: zoomOf(size) };
}
// [minimum columns, height in inches] for daypage.mjs MINSPAN
export const noteMin = (b, size = 'small') => { const p = notePlan(b, size); return [p.cols, p.h]; };

// What the person can do about a block that is too wide, in words, per type.
const NB_WAYS = {
  flashstrip: 'Use fewer review ticks, turn off "got it / again" or the numbers, or give the term side more of the strip.',
  reviewtracker: 'Turn off the learned-on date or some of the review times.',
  stimlog: 'Turn off "before and after" or "where and what helped".',
  conceptmap: 'Use fewer branches.',
};
// Every reason a note block cannot sit in colSpan x rowSpan cells at this trim, in plain words. null = it fits. rowSpan may be omitted (a flow layout).
export function noteFit(b, colSpan, rowSpan, size = 'small', name = b.type) {
  const p = notePlan(b, size, colSpan), z = p.z, s = (n) => (n === 1 ? '' : 's'), phys = (v) => fmtIn(v * z);
  if (!p.fitsWidth) {
    const whole = pageContentWidth(size), page = phys(whole);
    if (!p.fitsPage) return { code: 'notewidth', msg: `${name} does not fit the ${trimName(size)} page: it needs ${phys(p.need)} in across and the whole page is ${page} in wide. ${NB_WAYS[b.type] || 'Make it smaller.'}${size === 'small' ? ' Or build the 8.5×11 trim.' : ''}` };
    return { code: 'notewidth', msg: `${name} does not fit: it needs ${phys(p.need)} in across, and ${colSpan} column${s(colSpan)} of the ${trimName(size)} page ${colSpan === 1 ? 'is' : 'are'} ${phys(p.avail)} in wide (the whole page is ${page} in). Give it ${p.cols} column${s(p.cols)} or more.` };
  }
  if (rowSpan !== undefined && rowSpan !== null && rowSpan < p.rowsNeeded) {
    return { code: 'noterows', msg: `${name} does not fit: it needs ${p.rowsNeeded} rows (${phys(p.h)} in tall on the ${trimName(size)} page); it has ${rowSpan}.` };
  }
  return null;
}

// ---- tracing patterns: vector paths to follow with a pen or a finger ----
export const TRACE_PATTERNS = [['waves', 'Waves'], ['zigzag', 'Zigzags'], ['loops', 'Loops'], ['spiral', 'Spirals'], ['grid', 'Grid lines']];
export const TRACE_SIZES = [['s', 'Small'], ['m', 'Medium'], ['l', 'Large']];
export const TRACE_UNIT = { s: 0.2, m: 0.32, l: 0.48 }; // the pattern's module, CSS inches
export const TRACE_MARGIN = 0.1; // the pattern stays this far inside its box
const nbF2 = (v) => +v.toFixed(2);
const NB_PX = 96;
// The pattern drawn in a box W x H (CSS inches) as a list of SVG path strings in px (96 to the inch). Pure: the same inputs, the same paths.
// No path has a stroke of its own: the SVG gives them one (1.6 px, mid grey), and every point lies inside the box with the margin kept.
export function tracePaths(pattern, sizeKey, W, H) {
  const u = TRACE_UNIT[sizeKey] || TRACE_UNIT.m, m = TRACE_MARGIN, x0 = m, x1 = W - m, y0 = m, y1 = H - m, out = [];
  const poly = (pts) => 'M' + pts.map(([x, y]) => `${nbF2(x * NB_PX)} ${nbF2(y * NB_PX)}`).join('L');
  if (pattern === 'waves' || pattern === 'zigzag') {
    const a = u * 0.42, lam = u * 2.4, gapY = 2 * a + u * 0.55, rows = Math.max(1, Math.floor((y1 - y0 - 2 * a) / gapY) + 1);
    const used = 2 * a + (rows - 1) * gapY, top = y0 + (y1 - y0 - used) / 2 + a;
    for (let r = 0; r < rows; r++) {
      const cy = top + r * gapY, pts = [];
      if (pattern === 'waves') for (let x = x0; x <= x1 + 1e-9; x += 0.03) pts.push([Math.min(x, x1), cy + a * Math.sin((2 * Math.PI * (x - x0)) / lam)]);
      else { let up = 0; for (let x = x0; x < x1; x += lam / 2) { pts.push([x, cy + (up++ % 2 ? a : -a)]); } const xl = pts[pts.length - 1][0] + lam / 2; if (xl <= x1) pts.push([xl, cy + (up % 2 ? a : -a)]); }
      out.push(poly(pts));
    }
  } else if (pattern === 'loops') {
    const c = u * 0.34, a = c * 1.7, gapY = 2 * a + u * 0.35, rows = Math.max(1, Math.floor((y1 - y0 - 2 * a) / gapY) + 1);
    const used = 2 * a + (rows - 1) * gapY, top = y0 + (y1 - y0 - used) / 2 + a;
    for (let r = 0; r < rows; r++) {
      const cy = top + r * gapY, pts = [];
      for (let t = 0; t < 400; t += 0.1) { const x = c * t - a * Math.sin(t), y = cy - a * Math.cos(t); pts.push([x, y]); if (c * t > x1 - x0 + a) break; }
      const shift = x0 - Math.min(...pts.map((p) => p[0])), kept = [];
      for (const [x, y] of pts) { if (x + shift > x1) break; kept.push([x + shift, y]); }
      out.push(poly(kept));
    }
  } else if (pattern === 'spiral') {
    const R0 = u * 1.1, turn = u * 0.3, wBox = x1 - x0, hBox = y1 - y0;
    const nx = Math.max(1, Math.floor(wBox / (2 * R0 + u * 0.2))), ny = Math.max(1, Math.floor(hBox / (2 * R0 + u * 0.2)));
    const R = Math.min(R0, wBox / (2 * nx) - 0.01, hBox / (2 * ny) - 0.01);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const cx = x0 + (wBox / nx) * (i + 0.5), cy = y0 + (hBox / ny) * (j + 0.5), pts = [], k = turn / (2 * Math.PI), dir = (i + j) % 2 ? -1 : 1;
      for (let th = 0; k * th <= R; th += 0.16) pts.push([cx + dir * k * th * Math.cos(th), cy + k * th * Math.sin(th)]);
      out.push(poly(pts));
    }
  } else { // grid: crossing lines every module, inside the margin
    const nx = Math.max(1, Math.floor((x1 - x0) / u)), ny = Math.max(1, Math.floor((y1 - y0) / u)), sx = (x1 - x0) / nx, sy = (y1 - y0) / ny;
    for (let i = 0; i <= nx; i++) out.push(`M${nbF2((x0 + i * sx) * NB_PX)} ${nbF2(y0 * NB_PX)}V${nbF2(y1 * NB_PX)}`);
    for (let j = 0; j <= ny; j++) out.push(`M${nbF2(x0 * NB_PX)} ${nbF2((y0 + j * sy) * NB_PX)}H${nbF2(x1 * NB_PX)}`);
  }
  return out;
}
