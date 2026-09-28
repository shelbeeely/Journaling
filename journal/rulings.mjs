// Vector rulings for print, shared by render.mjs (monthly books) and proof-test.mjs (the KDP proof test page).
// drawRulings() runs inside the page (it is serialised with toString()), so it must not use anything from this file.
// Rulings for print: every ruled line, dot grid and 4 mm grid is redrawn as one plain inline SVG per area, same
// geometry as its CSS background. Chromium turns CSS gradients and tiled SVG backgrounds into PDF shadings and image
// patterns that renderers disagree on (poppler: stray/doubled lines, cairo: nothing, mupdf: grey bars), and KDP
// rasterises with its own pipeline. The CSS backgrounds stay for the editor preview; this runs in the page (after
// fonts load, and again from render.mjs before the PDF) and switches them off. Keep the table in sync with the CSS.
// Idempotent. Everything is clipped to the area, so no drawn box pokes past it (check.mjs stays at [] 0).
export function drawRulings() {
  const IN = 96, MM = 96 / 25.4;
  const SPECS = [ // first match wins; lines: 1px band at the bottom of each pitch; dots: centres ox + i·pitch, oy + j·pitch
    // Print weights (KDP: lines >= 0.75 pt, grey fills >= 10%; see KDP.md section 8): rules 1 pt (1.333 px), grid 0.75 pt, dots 0.7-0.8 mm across.
    ['.ru.pd.p26', { dots: 0.26 * IN, ox: 0.13 * IN, oy: 0.2364 * IN, r: 0.014 * IN, c: '#808080' }], // line spacing: standard 6.6 mm and wide 8.5 mm (dots at 0.909 x the pitch down)
    ['.ru.pd.p33', { dots: 0.335 * IN, ox: 0.1675 * IN, oy: 0.3045 * IN, r: 0.014 * IN, c: '#808080' }],
    ['.ru.pd', { dots: 0.22 * IN, ox: 0.11 * IN, oy: 0.2 * IN, r: 0.014 * IN, c: '#808080' }],
    ['.grid.g37.log', { grid: 3.7 * MM, w: 1, dash: [0.555 * MM, 0.37 * MM], c: '#c8c8c8' }], // Hobonichi 3.7 mm grid, 4 dashes per cell
    ['.ru.pg, .grid.log', { grid: 4 * MM, w: 1, dash: [0.6 * MM, 0.4 * MM], c: '#c8c8c8' }],
    ['.ruled.log.bold', { lines: 0.5625 * IN, w: 2, c: '#000' }], // bold-line (large print): 1.5 pt black at 9/16 in
    ['.ruled.log', { lines: 0.26 * IN, w: 4 / 3, c: '#a0a0a0' }],
    ['.ru.p26', { lines: 0.26 * IN, w: 4 / 3, c: '#a0a0a0' }],
    ['.ru.p33', { lines: 0.335 * IN, w: 4 / 3, c: '#a0a0a0' }],
    ['.ru', { lines: 0.22 * IN, w: 4 / 3, c: '#a0a0a0' }],
    ['.m .dots', { dots: 5 * MM, ox: 0, oy: 0, r: 0.4 * MM, c: '#c8c8c8' }],
    ['.dots', { dots: 0.17 * IN, ox: 0, oy: 0, r: 0.014 * IN, c: '#606060' }],
    // border rules: Chromium snaps a CSS border to whole device px (1pt prints as 0.75 pt), so the border turns transparent and a 1 pt band is drawn in its place
    ['.m .rule, .cb span', { edge: 1, w: 4 / 3, c: '#c8c8c8' }], // the quieter month-page and action-item rules
    ['.rule, .three li, .prio li, .xbul .bl span', { edge: 1, w: 4 / 3, c: '#a0a0a0' }],
    ['.genko span', { cross: 1, c: '#ccc' }],
  ];
  const f = (v) => +v.toFixed(3);
  const NS = 'http://www.w3.org/2000/svg';
  document.querySelectorAll('svg.vrule').forEach((s) => s.remove());
  const rect = (x0, y0, x1, y1) => `M${f(x0)} ${f(y0)}H${f(x1)}V${f(y1)}H${f(x0)}Z`;
  // A dot as a Bézier circle; one cut by the edge becomes a clipped 32-gon, so the path never leaves the area.
  const dot = (cx, cy, r, W, H) => {
    if (cx - r >= 0 && cy - r >= 0 && cx + r <= W && cy + r <= H) return `M${f(cx - r)} ${f(cy)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0Z`;
    let P = Array.from({ length: 32 }, (_, k) => [cx + r * Math.cos(k * Math.PI / 16), cy + r * Math.sin(k * Math.PI / 16)]);
    for (const [ax, lim, keepLE] of [[0, 0, false], [0, W, true], [1, 0, false], [1, H, true]]) {
      const inside = (p) => (keepLE ? p[ax] <= lim : p[ax] >= lim), out = [];
      P.forEach((p, i) => {
        const q = P[(i + 1) % P.length];
        if (inside(p)) out.push(p);
        if (inside(p) !== inside(q)) { const t = (lim - p[ax]) / (q[ax] - p[ax]); out.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]); }
      });
      P = out;
      if (P.length < 3) return '';
    }
    return 'M' + P.map((p) => `${f(p[0])} ${f(p[1])}`).join('L') + 'Z';
  };
  document.querySelectorAll('.page').forEach((pg) => { const z = parseFloat(getComputedStyle(pg).zoom) || 1; SPECS.forEach(([sel, s]) => pg.querySelectorAll(sel).forEach((el) => {
    if (el.dataset.vrule) return; // already taken by an earlier (more specific) spec
    el.dataset.vrule = '1';
    const cs = getComputedStyle(el), b = el.getBoundingClientRect();
    // the letter book zooms each page; measure in the page's own CSS px, where the backgrounds tile
    const W = b.width / z - parseFloat(cs.borderLeftWidth) - parseFloat(cs.borderRightWidth), H = b.height / z - parseFloat(cs.borderTopWidth) - parseFloat(cs.borderBottomWidth);
    let d = '', attrs = { fill: s.c };
    if (s.lines) for (let y = s.lines; y - s.w < H; y += s.lines) d += rect(0, y - s.w, W, Math.min(y, H));
    if (s.edge) { d += rect(0, H - s.w, W, H); el.style.borderBottomColor = 'transparent'; }
    if (s.cross) d += rect(0, (H - s.cross) / 2, W, (H + s.cross) / 2) + rect((W - s.cross) / 2, 0, (W + s.cross) / 2, H);
    if (s.dots) for (let y = s.oy + Math.ceil((-s.r - s.oy) / s.dots) * s.dots; y - s.r < H; y += s.dots) for (let x = s.ox + Math.ceil((-s.r - s.ox) / s.dots) * s.dots; x - s.r < W; x += s.dots) d += dot(x, y, s.r, W, H);
    if (s.grid) { // dashes restart at every 4 mm tile edge, and 4 mm is a whole number of dash periods, so one line per row/column matches
      const o = s.w / 2;
      for (let y = o; y < H; y += s.grid) d += `M0 ${f(y)}H${f(W)}`;
      for (let x = o; x < W; x += s.grid) d += `M${f(x)} 0V${f(H)}`;
      attrs = { fill: 'none', stroke: s.c, 'stroke-width': f(s.w), 'stroke-dasharray': s.dash.map(f).join(' ') };
    }
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'vrule'); svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('width', f(W)); svg.setAttribute('height', f(H)); svg.setAttribute('viewBox', `0 0 ${f(W)} ${f(H)}`);
    svg.style.cssText = 'position:absolute;left:0;top:0;overflow:hidden;pointer-events:none';
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', d); for (const [k, v] of Object.entries(attrs)) path.setAttribute(k, v);
    svg.appendChild(path);
    if (cs.position === 'static') el.style.position = 'relative';
    el.style.backgroundImage = 'none';
    el.appendChild(svg);
  })); });
  document.querySelectorAll('[data-vrule]').forEach((el) => delete el.dataset.vrule);
}
