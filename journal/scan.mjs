// Scan options (docs/journaling/BUILD-PLAN.md section 13): the send-to symbols, the scanning border (frame) and the page code.
// Pure (no fs, no process): shared by render.mjs (print), the day page block library (daypage.mjs, the `sendto` block), the
// checks (check-codes.mjs, check.mjs) and the editor (build.mjs inlines this file first).
//
// The default book prints exactly as before: every option below is opt-in, and marksHtml() with default options writes the
// same bytes the renderer always wrote (check-identical.mjs guards that).
//
//   scan = { frame: 'on' | 'off',
//            code: { on, position, size, format, content, label } }
//
// A scan setting is a PARTIAL object: only what differs from the defaults is stored, so a book that never touched it has no
// `scan` key at all. Layers, most specific first:
//   an entry's `scan` in content/book.json  >  the day page layout's `scan` (content/daypage.json, day pages only)
//   >  the book's `scan` (top level of content/book.json)  >  DEFAULT_SCAN.

// ---- the send-to symbols (one strip, or the `sendto` block) ----
// fire (solid triangle), water (open triangle), air (three winds), earth (circled cross), crescent (solid), full moon (solid disc),
// pentacle. The plan lists six (moon counted once); the printed strip has always had seven, so all seven can be picked.
// Chosen so no two look alike after a blurry phone photo (tested: worst pair correlation 0.63; the old set had 0.90).
export const SEND_SYMBOLS = [
  ['fire', 'Fire', '<path d="M7 1.5 L12.5 12 H1.5 Z" fill="#000"/>'],
  ['water', 'Water', '<path d="M7 12.5 L12.5 2 H1.5 Z"/>'],
  ['air', 'Air', '<path d="M1.5 4.5 Q4 2.5 6.5 4.5 T11.5 4.5 M1.5 7.5 Q4 5.5 6.5 7.5 T11.5 7.5 M1.5 10.5 Q4 8.5 6.5 10.5 T11.5 10.5"/>'],
  ['earth', 'Earth', '<circle cx="7" cy="7" r="5.5"/><path d="M7 1.5 V12.5 M1.5 7 H12.5"/>'],
  ['crescent_moon', 'Crescent moon', '<path d="M9.5 1.8 A5.5 5.5 0 1 0 12.2 9.6 A4.3 4.3 0 1 1 9.5 1.8 Z" fill="#000"/>'],
  ['full_moon', 'Full moon', '<circle cx="7" cy="7" r="5.5" fill="#000"/>'],
  ['pentacle', 'Pentacle', '<circle cx="7" cy="7" r="6"/><path d="M 7.00 1.70 L 10.12 11.29 L 1.96 5.36 L 12.04 5.36 L 3.88 11.29 Z"/>'],
];
export const SEND_KEYS = SEND_SYMBOLS.map((s) => s[0]);
export const SEND_LABELS = Object.fromEntries(SEND_SYMBOLS.map((s) => [s[0], s[1]]));
// Symbol sizes for the `sendto` block: the svg edge in px and the dashed bubble above it. 'm' is the printed strip's own size.
export const SEND_SIZES = { s: { px: 13, bubble: 9 }, m: { px: 17, bubble: 12 }, l: { px: 22, bubble: 16 } };
export const sendRowHtml = (keys = SEND_KEYS, px = 17) => SEND_SYMBOLS.filter((s) => keys.includes(s[0])).map(([k, , p]) => `<span class="sym" data-zone="send_to_${k}"><i></i><svg width="${px}" height="${px}" viewBox="0 0 14 14" fill="none" stroke="#000" stroke-width="1.1">${p}</svg></span>`).join('');
// The `sendto` block (daypage.mjs TYPES.sendto). Its own data-zone is `send_to` (repeats get _2, _3).
export function sendBlockHtml(b) {
  const keys = SEND_KEYS.filter((k) => b.symbols && b.symbols[k]), z = SEND_SIZES[b.size] || SEND_SIZES.m;
  return `<div class="xb sendblk sb-${b.style || 'rule'}" data-zone="send_to" style="--sb:${z.bubble}px">${b.label ? '<span class="sl">SEND TO</span>' : ''}${sendRowHtml(keys.length ? keys : SEND_KEYS, z.px)}</div>`;
}

// ---- the scan settings ----
export const CODE_POSITIONS = [
  ['right', 'Bottom right', 'the bottom corner on the right (today)'],
  ['left', 'Bottom left', 'the bottom corner on the left'],
  ['outer', 'Bottom, outer edge', 'the bottom corner away from the spine (right on a right-hand page, left on a left-hand page)'],
  ['inner', 'Bottom, by the spine', 'the bottom corner nearest the spine'],
];
export const CODE_SIZES = [[9, 'Small', '9 mm'], [10.7, 'Standard', '10.7 mm (today)'], [12, 'Large', '12 mm'], [14, 'Largest', '14 mm']];
export const CODE_FORMATS = [['data_matrix', 'Data Matrix'], ['qr', 'QR code']];
export const CODE_CONTENTS = [['book', 'Page, edition and book (today)'], ['id', 'Page id and book']];
export const MIN_MODULE_MM = 0.5; // the smallest printed module: 6 dots at 300 dpi, still 4 pixels at the 200 dpi the check decodes
export const MAX_CODE_MM = 14; // the tallest strip the day page grid (24 rows, 0.19 in spare) can give up
export const DEFAULT_SIZE_MM = 10.7; // = the strip's 0.42 in
export const QUIET_MODULES = 4; // QR needs 4 modules of white round it (Data Matrix 1: the strip's own gaps cover both)
export const DEFAULT_SCAN = { frame: 'on', code: { on: true, position: 'right', size: DEFAULT_SIZE_MM, format: 'data_matrix', content: 'book', label: false } };

const isObj = (x) => x && typeof x === 'object' && !Array.isArray(x);
const inList = (list, v) => list.some((x) => x[0] === v);
// Every problem in a partial scan object, in plain words ([] = fine). `where` names it in the message.
export function scanProblems(s, where = 'scan') {
  const out = [];
  if (s === undefined) return out;
  if (!isObj(s)) return [`${where}: must be an object like {"frame":"off"}`];
  for (const k of Object.keys(s)) if (!['frame', 'code'].includes(k)) out.push(`${where}.${k}: not a scan setting (use frame and code)`);
  if (s.frame !== undefined && !['on', 'off'].includes(s.frame)) out.push(`${where}.frame: must be "on" or "off", got ${JSON.stringify(s.frame)}`);
  if (s.code !== undefined) {
    if (!isObj(s.code)) { out.push(`${where}.code: must be an object like {"position":"left"}`); return out; }
    const c = s.code;
    for (const k of Object.keys(c)) if (!['on', 'position', 'size', 'format', 'content', 'label'].includes(k)) out.push(`${where}.code.${k}: not a code setting (use on, position, size, format, content, label)`);
    if (c.on !== undefined && typeof c.on !== 'boolean') out.push(`${where}.code.on: must be true or false`);
    if (c.label !== undefined && typeof c.label !== 'boolean') out.push(`${where}.code.label: must be true or false`);
    if (c.position !== undefined && !inList(CODE_POSITIONS, c.position)) out.push(`${where}.code.position: must be one of ${CODE_POSITIONS.map((p) => p[0]).join(', ')}, got ${JSON.stringify(c.position)}`);
    if (c.size !== undefined && !inList(CODE_SIZES, c.size)) out.push(`${where}.code.size: must be one of ${CODE_SIZES.map((p) => p[0]).join(', ')} (millimetres), got ${JSON.stringify(c.size)}`);
    if (c.format !== undefined && !inList(CODE_FORMATS, c.format)) out.push(`${where}.code.format: must be data_matrix or qr, got ${JSON.stringify(c.format)}`);
    if (c.content !== undefined && !inList(CODE_CONTENTS, c.content)) out.push(`${where}.code.content: must be book or id, got ${JSON.stringify(c.content)}`);
  }
  return out;
}
// A partial scan object with only valid settings that differ from the default; undefined when nothing differs.
export function cleanScan(s) {
  if (!isObj(s)) return undefined;
  const out = {};
  if (s.frame === 'off') out.frame = 'off';
  if (isObj(s.code)) {
    const c = {}, d = DEFAULT_SCAN.code;
    if (s.code.on === false) c.on = false;
    if (inList(CODE_POSITIONS, s.code.position) && s.code.position !== d.position) c.position = s.code.position;
    if (inList(CODE_SIZES, +s.code.size) && +s.code.size !== d.size) c.size = +s.code.size;
    if (inList(CODE_FORMATS, s.code.format) && s.code.format !== d.format) c.format = s.code.format;
    if (inList(CODE_CONTENTS, s.code.content) && s.code.content !== d.content) c.content = s.code.content;
    if (s.code.label === true) c.label = true;
    if (Object.keys(c).length) out.code = c;
  }
  return Object.keys(out).length ? out : undefined;
}
// Layers over the defaults (lowest first, later layers win) -> a complete scan object. Bad values are ignored, never thrown.
export function resolveScan(...layers) {
  const m = layers.reduce((acc, l) => mergeScan(acc, l), undefined) || {}, c = isObj(m.code) ? m.code : {}, r = { frame: DEFAULT_SCAN.frame, code: { ...DEFAULT_SCAN.code } };
  if (m.frame === 'on' || m.frame === 'off') r.frame = m.frame;
  for (const k of ['on', 'label']) if (typeof c[k] === 'boolean') r.code[k] = c[k];
  for (const [k, list] of [['position', CODE_POSITIONS], ['format', CODE_FORMATS], ['content', CODE_CONTENTS]]) if (inList(list, c[k])) r.code[k] = c[k];
  if (inList(CODE_SIZES, +c.size)) r.code.size = +c.size;
  return r;
}
// Two partial scan objects into one (b over a); undefined when both are empty.
export const mergeScan = (a, b) => {
  if (!isObj(a) && !isObj(b)) return undefined;
  const out = { ...(isObj(a) ? a : {}), ...(isObj(b) ? b : {}) };
  if (isObj(a) && isObj(a.code) && isObj(b) && isObj(b.code)) out.code = { ...a.code, ...b.code };
  return out;
};
// The code is on the left of the bottom strip? (outer/inner depend on which side of the spread the page is)
export const codeOnLeft = (position, side) => position === 'left' || (position === 'outer' && side === 'verso') || (position === 'inner' && side === 'recto');

// ---- what stops working, in plain words (the editor shows these every time an option is switched) ----
export function scanNotes(sc, { sendto = false } = {}) {
  const notes = [];
  if (sc.frame === 'off') {
    notes.push('The scanning border is off. The scanner can no longer straighten or crop this page, so the Send-to symbols and the writing-area crops do not work on it. The page code still identifies the page.');
    if (sendto) notes.push('A Send-to block is on this page. It will not print while the border is off.');
  }
  if (!sc.code.on) notes.push('The page code is off. Scanning cannot tell which page this is: the page is known only by its printed number and label.');
  if (sc.frame === 'off' && !sc.code.on) notes.push('Border and code are both off: this page cannot be scanned at all.');
  if (sc.code.on && sc.code.format === 'qr') notes.push('A QR code is bigger than a Data Matrix for the same text, so the code may print larger.');
  if (sc.code.on && sc.code.content === 'id') notes.push('A code with the page id is longer, so it needs a bigger symbol and may print larger. It keeps working if pages are moved.');
  if (sc.code.on && sc.code.size > DEFAULT_SIZE_MM) notes.push('A larger code takes a little room from the writing area.');
  return notes;
}

// ---- code text and symbol size ----
// content 'book' = today's code, passed in as `standard` (KW2|edition|yymm|size+page, or KW3 for a book plan).
// content 'id'   = KWI|<edition>|<book key>|<size>|<PAGE ID>: the stable page id (upper case: it stays in the small alphanumeric
//                  set, and ids are lower case, so nothing is lost) plus the book; still unique across every book and both trims.
// Never private data: ASCII only, nothing but ids the manifest already publishes.
export function codeText(content, { standard, edition, bookKey, size, pageId }) {
  if (content !== 'id') return standard;
  const t = `KWI|${edition}|${bookKey}|${size}|${String(pageId).toUpperCase()}`;
  if (!/^[\x20-\x7e]+$/.test(t)) throw new Error(`code text for page ${pageId} is not plain ASCII`);
  return t;
}
export const KWI_RE = /^KWI\|(\d)\|([0-9A-Z]+)\|([SLH])\|([0-9A-Z][0-9A-Z._-]*)$/;
// The symbol: bwip-js options for a format, and its module count from the SVG it draws (4 svg units per module).
export const symbolOpts = (format, text) => (format === 'qr' ? { bcid: 'qrcode', text, eclevel: 'M' } : { bcid: 'datamatrix', text });
export const modulesOf = (svg) => Math.round(+/viewBox="0 0 (\d+) /.exec(svg)[1] / 4);
// The printed size of a symbol: the chosen size, raised when its modules would be under MIN_MODULE_MM. Returns { mm, raised } or
// { error } when even the largest strip cannot hold it.
export function fitSize(modules, wantMm) {
  const need = Math.ceil(modules * MIN_MODULE_MM * 10) / 10;
  if (need > MAX_CODE_MM) return { error: `a symbol of ${modules}x${modules} modules needs ${need} mm at ${MIN_MODULE_MM} mm per module, and the largest code is ${MAX_CODE_MM} mm; use Data Matrix, or the shorter content` };
  return need > wantMm ? { mm: need, raised: true } : { mm: wantMm, raised: false };
}

// ---- the marks on a page: frame, strip (page number, SEND TO, symbols) and page code ----
// o: { n (page number), sc (a complete scan object, resolveScan), side ('recto'|'verso'), sendBlock (a sendto block sits in the
//      grid: the strip drops its symbols), svg (the code's SVG, when the code is on), mm (its printed size), label (text for the
//      tiny printed label, '' for none), quiet (QR: extra white on the symbol's sides, inches) }
// Default options return exactly today's markup.
export function marksHtml(o) {
  const { sc } = o, code = sc.code.on && o.svg;
  const inStrip = sc.frame === 'on' && !o.sendBlock; // the symbols live in the strip unless a block has them, or the border is off
  const left = codeOnLeft(sc.code.position, o.side), big = o.mm && Math.abs(o.mm - DEFAULT_SIZE_MM) > 0.05, inch = o.mm ? (o.mm / 25.4).toFixed(3) : '';
  const st = big ? ` style="height:${inch}in"` : '';
  const qs = [big ? `width:${inch}in;height:${inch}in` : '', o.quiet ? `${left ? 'margin-right' : 'margin-left'}:${o.quiet.toFixed(3)}in` : '', code && o.label ? 'position:relative' : ''].filter(Boolean).join(';');
  const lab = code && o.label ? `<span class="qrl">${o.label}</span>` : '';
  return `<div class="frame${sc.frame === 'off' ? ' off' : ''}"></div><div class="${left ? 'strip cl' : 'strip'}"${st}><span class="pno">${o.n}</span>${inStrip ? `<span class="send">SEND TO</span>${sendRowHtml()}` : ''}${code ? `<span class="qr"${qs ? ` style="${qs}"` : ''}>${lab}${o.svg}</span>` : ''}</div>`;
}
// CSS for the variants (frame off, code on the left, label, block style). The default strip needs none of it.
export const SCAN_CSS = `
.frame.off { visibility: hidden; }
.strip.cl .qr { order: -1; margin-left: 0; } .strip.cl .pno { margin-left: auto; }
.strip .qr .qrl { position: absolute; bottom: 100%; right: 0; margin-bottom: 0.01in; font: 500 5pt/1 'Inter', sans-serif; color: #444; letter-spacing: 0.3px; white-space: nowrap; } .strip.cl .qr .qrl { right: auto; left: 0; }
.page[data-scan-frame="off"] .sendblk { visibility: hidden; }
.sendblk { display: flex; align-items: flex-end; gap: 0.1in; } .sendblk .sl { font: 700 7pt 'Inter', sans-serif; color: #333; letter-spacing: 0.5px; }
.sendblk .sym i { width: var(--sb, 12px); height: var(--sb, 12px); }
.sendblk.sb-none { border-top: 0; } .sendblk.sb-box { border: 1px solid #333; border-radius: 3px; padding: 3px 6px; }
`;
