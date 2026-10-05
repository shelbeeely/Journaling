// Print accessibility options (BUILD-PLAN section 15, A11Y-40 and A11Y-41): a large-print layout and a high-contrast ink option.
// Both are OFF by default and then change nothing: the default books stay byte-identical (check-identical.mjs).
//   profile.json   "print": { "large_print": false, "high_contrast": false }      (see profile.example.json)
//   daypage.json   "print": { "large": true, "contrast": true }                    (the editor's Settings panel writes this; it wins over the profile)
// This file is shared with the editor (build.mjs inlines it: no imports, and every top-level name is unique in the editor's script).
//
// How it works. The page CSS stays as it is. When an option is on, `printCss()` READS that CSS and writes an override block that goes
// after it: every rule that sets a point size gets the same selector again with a bigger size, every grey ink gets a darker one.
// So the options can never drift from the real page rules, and the editor preview (which holds the same CSS) can switch them live.
// What never changes: the DATE / TITLE / TAGS header, the 9 pt frame, the SEND TO strip, the folio and the page code (scan zones).
export const PRINT_DEFAULT = Object.freeze({ large: false, contrast: false });
export const LARGE_SCALE = 1.4;     // small type (9 pt and under) grows by this; headings grow by less, page titles not at all
export const LARGE_FLOOR = 8.5;     // pt: nothing small prints under this in large print (the smallest labels were 5.6 pt)
export const LARGE_STEPS = [1.4, 1.35, 1.3, 1.25, 1.2, 1.15, 1.1, 1.05, 1]; // a dense reference page that cannot hold the full scale steps down (fitSteps)
export const LARGE_PITCH_MM = 8.5;  // write-in line spacing: the widest the block library offers (daypage.mjs PITCH)
export const PRINT_TRIMS = ['small', 'letter']; // 5.5 x 8.5 and 8.5 x 11: the only trims large print is built and checked for

const isObj = (x) => x && typeof x === 'object' && !Array.isArray(x);

// What the profile may say: print.large_print and print.high_contrast, both true or false (absent = off).
export function printProblems(p) {
  if (p === undefined) return [];
  if (!isObj(p)) return ['print: must be an object like {"large_print": false, "high_contrast": false}'];
  const errs = [];
  for (const k of Object.keys(p)) {
    if (!['large_print', 'high_contrast'].includes(k)) errs.push(`print.${k}: not a print option (use large_print, high_contrast)`);
    else if (typeof p[k] !== 'boolean') errs.push(`print.${k}: must be true or false`);
  }
  return errs;
}
// The layout's own settings (daypage.json "print"): only what is on, so an untouched layout carries nothing.
export function cleanPrint(s) {
  if (!isObj(s)) return undefined;
  const o = {};
  if (s.large === true) o.large = true;
  if (s.contrast === true) o.contrast = true;
  return Object.keys(o).length ? o : undefined;
}
// The options in force: the day layout's print settings win over the profile's.
export function printOptions(profilePrint, layoutPrint) {
  const p = isObj(profilePrint) ? profilePrint : {}, l = cleanPrint(layoutPrint) || {};
  return { large: l.large || p.large_print === true, contrast: l.contrast || p.high_contrast === true };
}
export const printOn = (o) => !!(o && (o.large || o.contrast));

// ---------- the CSS reader ----------
// The page CSS is flat rules (no nesting), so one pattern reads it. Comments go first; @page and other at-rules are skipped.
const FLAT = /([^{}]+)\{([^{}]*)\}/g;
const rulesOf = (css) => { const out = []; for (const m of css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(FLAT)) { const sel = m[1].trim(); if (sel && !sel.startsWith('@')) out.push([sel, m[2]]); } return out; };
// Scan zones: these selectors never change (the header boxes, the frame, the SEND TO strip and block, the folio, the page code).
const FIXED = /\.hz\b|\.zbox\b|\.zdate\b|\.ztitle\b|\.ztags\b|\.strip\b|\.frame\b|\.folio\b|\.sendblk\b|\.sym\b|\.qr\b|\.pno\b/;
const splitSel = (sel) => sel.split(',').map((s) => s.trim()).filter(Boolean);
const emit = (sels, decls) => (sels.length && decls.length ? `${sels.join(', ')} { ${decls.join('; ')} }\n` : '');
const num = (s) => parseFloat(s);
// A point size in a declaration, grown. Small type by the full factor, headings by less, page titles (over 16 pt) not at all.
// `--ls` is the page's own factor (the page rule sets it; a dense page can take a smaller one), so one block serves every page.
function grow(x) {
  const k = x <= 9 ? 1 : x <= 16 ? 0.5 : 0;
  if (k === 0) return null;
  const e = `calc(${x}pt * (1 + (var(--ls) - 1) * ${k}))`;
  return x < LARGE_FLOOR ? `max(calc(${LARGE_FLOOR}pt * (var(--ls) - 1) / ${+(LARGE_SCALE - 1).toFixed(2)}), ${e})` : e; // the floor eases to nothing as a page steps down to 1
}
const sized = (decl) => {
  const m = /^(\s*)(font-size|font)\s*:(.*)$/is.exec(decl);
  if (!m) return null;
  const v = m[3].replace(/(^|\s)(\d*\.?\d+)pt(?=[\s/;]|$)/, (all, sp, n) => { const g = grow(num(n)); return g ? `${sp}${g}` : all; });
  return v === m[3] ? null : `${m[2]}: ${v.trim()}`;
};

const lum = (hex) => { const h = hex.length === 4 ? [...hex.slice(1)].map((c) => c + c).join('') : hex.slice(1); const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); return r === g && g === b ? r : -1; };
// Light and mid greys become black ink in high contrast; the faintest hairlines (over 0xdd) become a dark grey, still a line you can see; white (white text on black) stays white.
// Fills (backgrounds) are left alone: they carry no content.
const hc = (v) => v.replace(/#[0-9a-f]{3}(?![0-9a-f])|#[0-9a-f]{6}(?![0-9a-f])/gi, (h) => { const l = lum(h); return l < 0x22 || l >= 0xf6 ? h : l >= 0xdd ? '#595959' : '#000'; });

// ---------- large print: the override block ----------
export function largeCss(css) {
  let out = '';
  for (const [sel, body] of rulesOf(css)) {
    const sels = splitSel(sel).filter((s) => !FIXED.test(s));
    const decls = body.split(';').map(sized).filter(Boolean);
    out += emit(sels, decls);
  }
  return out;
}
// Hand-written large-print rules: the scale for every page (`--ls`), bigger write-in rows and marks, heavier rules. Selectors are
// the real ones from render.mjs and daypage.mjs; the scan zones are not in here.
// Sizes that follow the page's factor: `lp(a, b, unit)` is `a` at --ls 1 (today's page) and `b` at the full scale, so a page that steps
// down gets today's sizes back, not a mix.
const lp = (a, b, u) => `calc(${a}${u} + (var(--ls) - 1) * ${+((b - a) / (LARGE_SCALE - 1)).toFixed(4)}${u})`;
export const LARGE_RULES = `
:root { --ls: ${LARGE_SCALE}; }
.hz, .strip, .folio { line-height: normal; } .hz .zl { font-size: 7pt; } /* the scan zones keep today's type */
.page { --ls: ${LARGE_SCALE}; font-size: calc(8.4pt * var(--ls)); line-height: ${lp(1.28, 1.38, '')}; }
${LARGE_STEPS.map((s) => `.page[data-ls="${s}"] { --ls: ${s}; }`).join('\n')}
.page.title { --ls: 1; font-size: 8.4pt; line-height: normal; } /* the title page is sized by its content, and so is its frame: it keeps today's type */
.ruled.log { background: repeating-linear-gradient(to bottom, transparent 0 calc(0.335in - 1.5pt), #666 calc(0.335in - 1.5pt) 0.335in); } /* the writing space, ruled at 8.5 mm */
.rule, .three li, .prio li, .cb span { border-bottom-width: 2px; border-bottom-color: #666; }
.m .rule { border-bottom-color: #777; }
.cb { height: ${lp(0.24, 0.32, 'in')}; gap: 8px; } .cb i { width: ${lp(10, 14, 'px')}; height: ${lp(10, 14, 'px')}; border-width: 1.6px; }
.cr { height: ${lp(0.215, 0.3, 'in')}; } .care .cr { height: ${lp(0.23, 0.3, 'in')}; } .ck i { width: ${lp(9, 12, 'px')}; height: ${lp(9, 12, 'px')}; border-width: 1.6px; }
.bub i { width: ${lp(9, 13, 'px')}; height: ${lp(9, 13, 'px')}; border-width: 1.5px; }
.bub.nb i { width: ${lp(15, 18, 'px')}; height: ${lp(15, 18, 'px')}; border-width: 1.5px; } .bub.nb.mid i { border-width: 2.2px; }
.care .cr > .ic:first-child { width: ${lp(12, 15, 'px')}; height: ${lp(12, 15, 'px')}; } .care .ck .ic { width: ${lp(11, 13, 'px')}; height: ${lp(11, 13, 'px')}; } .care .cr { gap: 4px; }
.blank { border-bottom-width: 2px; } .blank.xs { width: ${lp(0.24, 0.32, 'in')}; }
.work { height: ${lp(0.22, 0.3, 'in')}; } .rev span { height: ${lp(0.42, 0.5, 'in')}; } .day.full .rev span { height: ${lp(0.44, 0.56, 'in')}; }
.x4n { grid-column: 1 / -1; height: ${lp(0.23, 0.3, 'in')}; } /* the X4 line spans the box: its type no longer fits one column */
.dev { max-height: calc(3 * 1.3em + 4px); }
.lin td, .lin tr th { border-bottom: 2px solid #666; } .trk td, .hab td, .carep td { border-bottom-width: 2px; border-bottom-color: #666; }
.cal td { border-width: 1.5px; border-color: #555; } .cal th, .net th, .trk th, .sh { border-bottom-width: 2px; }
.mline td.hl, .hab td.hl { border-bottom-width: 2px; }
`;

// ---------- high-contrast ink: the override block ----------
export function contrastCss(css) {
  let out = '';
  for (const [sel, body] of rulesOf(css)) {
    const sels = splitSel(sel).filter((s) => !FIXED.test(s));
    const decls = [];
    for (const d of body.split(';')) {
      const m = /^\s*([a-z-]+)\s*:(.*)$/is.exec(d);
      if (!m) continue;
      const [, prop, val] = m;
      if (prop !== 'color' && prop !== 'border-color' && !/^border/.test(prop) && prop !== 'background-image') continue;
      const nv = prop === 'background-image' ? val.replace(/%23([0-9a-f]{6})/gi, (all, h) => (lum('#' + h) >= 0x22 ? '%23000' : all)) : hc(val);
      if (nv !== val) decls.push(`${prop}: ${nv.trim()}`);
    }
    out += emit(sels, decls);
  }
  return out;
}
export const CONTRAST_RULES = `
.dim, .small, .end, .evs, .dev .more, .sky1 .season, .sky2l, .wk-shift, .care .u, .fact, .src, rt, .place, .built, .owner { color: #000; }
.rule, .three li, .prio li, .cb span, .m .rule { border-bottom-width: 2px; border-bottom-color: #000; }
`;

// Puts a prefix in front of every selector of a block of rules (the editor's preview is scoped to #pv; the print build is not scoped).
export const scopeCss = (css, prefix) => (prefix ? css.replace(/\/\*[\s\S]*?\*\//g, '').replace(FLAT, (all, sel, body) => (sel.trim().startsWith('@') ? all : `${splitSel(sel).map((x) => prefix + x).join(', ')} {${body}}`)) : css);
// The whole override block for the options in force ('' when none is on, so the default CSS is untouched). `prefix` scopes the hand-written
// rules the way the base CSS is scoped (the editor passes '#pv ').
export function printCss(css, opt, prefix = '') {
  if (!printOn(opt)) return '';
  return `\n/* print accessibility options */\n${opt.large ? largeCss(css) + scopeCss(LARGE_RULES, prefix) : ''}${opt.contrast ? contrastCss(css) + scopeCss(CONTRAST_RULES, prefix) : ''}`;
}
// The ink drawRulings() uses when the options are on: it reads <html data-a11y="large contrast"> (rulings.mjs).
export const printAttr = (opt) => [opt && opt.large && 'large', opt && opt.contrast && 'contrast'].filter(Boolean).join(' ');

// ---------- the day layout, adjusted for large print (fewer rows, wider lines) ----------
// Bigger marks and type do not fit as many rows: the care box keeps fewer boxes and a 5-step mood scale, and the writing lines go to
// the widest spacing. Only what the layout would otherwise print at a smaller size changes; nothing is clipped. Flow layouts only
// (a Grid layout is placed by hand: check.mjs says which block does not fit).
export function largeLayout(L) {
  if (!L || L.grid) return L;
  const out = structuredClone(L);
  for (const b of out.blocks) {
    if (b.pitch !== undefined && b.pitch < LARGE_PITCH_MM) b.pitch = LARGE_PITCH_MM;
    if (b.type === 'body' && (b.style === undefined || b.style === 'dots')) b.style = 'lines'; // ruled lines are easier to follow than dots
    if (b.type === 'actions' && b.count > 2) b.count = 2; // two action lines, each one taller
    if (b.type === 'fact' || b.type === 'lookback') b.on = false; // optional lines of small type: their room goes to the writing space
    if (b.type === 'care' && Array.isArray(b.rows)) for (const r of b.rows) {
      if (r.id === 'water' && r.count > 6) r.count = 6;
      if (r.id === 'checkin' && r.steps > 5) r.steps = 5;
      if (r.id === 'meals' && r.meals > 3) r.meals = 3;
    }
  }
  return out;
}
