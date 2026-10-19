// Dot to dot: numbered dots, join them in order (and the last back to 1) to draw a picture. The pictures are ORIGINAL outlines made for this
// project as lists of points on a 100 x 100 square (y runs down); the star and heart are worked out from a formula.
//   generateDots({ shape, detail, seed }) -> { shape, name, detail, points: [[x, y], ...] (in order, closed), n }
// detail 1 = the corners only, 2 = a dot half way along the longer sides too, 3 = two more dots along the longest sides.
// Every dot is at least PZ_DD_GAP units from every other, so the numbers never crowd. Pure: no fs, no DOM. Names start with pz.
import { pzRng, pzInt } from './rng.mjs';

const pzDdPolar = (n, cx, cy, ro, ri) => Array.from({ length: n * 2 }, (_, i) => { const a = -Math.PI / 2 + (i * Math.PI) / n, r = i % 2 ? ri : ro; return [Math.round(cx + r * Math.cos(a)), Math.round(cy + r * Math.sin(a))]; });
const pzDdHeart = () => Array.from({ length: 14 }, (_, i) => { const t = (i / 14) * 2 * Math.PI; return [Math.round(50 + 3.0 * 16 * Math.pow(Math.sin(t), 3)), Math.round(44 - 2.8 * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)))]; });
export const PZ_DD_SHAPES = {
  star: { name: 'a star', points: pzDdPolar(5, 50, 53, 46, 19) },
  heart: { name: 'a heart', points: pzDdHeart() },
  house: { name: 'a house', points: [[50, 6], [92, 42], [80, 42], [80, 92], [58, 92], [58, 62], [42, 62], [42, 92], [20, 92], [20, 42], [8, 42]] },
  boat: { name: 'a sailboat', points: [[50, 6], [84, 66], [56, 66], [56, 76], [90, 76], [76, 94], [24, 94], [10, 76], [44, 76], [44, 66], [16, 66]] },
  fish: { name: 'a fish', points: [[6, 50], [22, 34], [44, 26], [66, 34], [80, 46], [94, 26], [94, 74], [80, 54], [66, 66], [44, 74], [22, 66]] },
  tree: { name: 'a pine tree', points: [[50, 4], [70, 30], [60, 30], [80, 56], [66, 56], [88, 82], [56, 82], [56, 96], [44, 96], [44, 82], [12, 82], [34, 56], [20, 56], [40, 30], [30, 30]] },
  moon: { name: 'a crescent moon', points: [[62, 6], [40, 10], [22, 24], [12, 42], [12, 60], [22, 78], [40, 92], [62, 96], [80, 90], [64, 84], [48, 72], [40, 56], [40, 42], [48, 28], [62, 16]] },
  mug: { name: 'a mug', points: [[12, 20], [68, 20], [68, 30], [90, 30], [90, 62], [68, 62], [68, 82], [12, 82]] },
};
export const PZ_DD_IDS = Object.keys(PZ_DD_SHAPES);
export const PZ_DD_GAP = 7; // units
const pzDdLen = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
export function pzDdDots(corners, detail) {
  const out = [];
  corners.forEach((p, i) => {
    const q = corners[(i + 1) % corners.length], L = pzDdLen(p, q);
    out.push(p);
    const k = detail >= 3 && L >= 36 ? 3 : detail >= 2 && L >= 24 ? 2 : 1;
    for (let j = 1; j < k; j++) out.push([Math.round(p[0] + ((q[0] - p[0]) * j) / k), Math.round(p[1] + ((q[1] - p[1]) * j) / k)]);
  });
  return out;
}
export function generateDots({ shape = 'auto', detail = 2, seed = '' } = {}) {
  const r = pzRng(`dots|${shape}|${detail}|${seed}`), id = PZ_DD_SHAPES[shape] ? shape : PZ_DD_IDS[pzInt(r, PZ_DD_IDS.length)], d = [1, 2, 3].includes(+detail) ? +detail : 2;
  let pts = pzDdDots(PZ_DD_SHAPES[id].points, d);
  const turn = pzInt(r, pts.length); // which dot is number 1
  pts = pts.slice(turn).concat(pts.slice(0, turn));
  return { shape: id, name: PZ_DD_SHAPES[id].name, detail: d, points: pts, n: pts.length };
}
// Where a dot's number goes: pushed out from the picture along the bisector of the two lines at that dot, `off` units away.
export function pzDdLabelAt(points, i, off) {
  const n = points.length, p = points[i], a = points[(i + n - 1) % n], b = points[(i + 1) % n];
  const u = [a[0] - p[0], a[1] - p[1]], v = [b[0] - p[0], b[1] - p[1]], lu = Math.hypot(...u) || 1, lv = Math.hypot(...v) || 1;
  let bx = u[0] / lu + v[0] / lv, by = u[1] / lu + v[1] / lv;
  if (Math.hypot(bx, by) < 0.2) { bx = -(v[1] / lv); by = v[0] / lv; } // a straight stretch: push sideways
  let m = Math.hypot(bx, by) || 1; bx /= m; by /= m;
  const inside = (x, y) => { let c = false; for (let k = 0, l = n - 1; k < n; l = k++) { const s = points[k], t = points[l]; if ((s[1] > y) !== (t[1] > y) && x < ((t[0] - s[0]) * (y - s[1])) / (t[1] - s[1]) + s[0]) c = !c; } return c; };
  const cx = points.reduce((q, z) => q + z[0], 0) / n, cy = points.reduce((q, z) => q + z[1], 0) / n;
  const plus = [p[0] + bx * off, p[1] + by * off], minus = [p[0] - bx * off, p[1] - by * off];
  const pIn = inside(...plus), mIn = inside(...minus);
  const far = (q) => Math.hypot(q[0] - cx, q[1] - cy);
  return pIn !== mIn ? (pIn ? minus : plus) : far(plus) >= far(minus) ? plus : minus;
}
// Where every number goes: the preferred spot (pzDdLabelAt), or the nearest of 24 directions at two distances that keeps the number off every line,
// off every other dot and off every other number. Returns [[x, y], ...] in the same order as the points.
export function pzDdLabels(points, off = 7.2) {
  const n = points.length, out = [];
  const segDist = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1))); return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy); };
  const slack = (c, i) => {
    let m = 1e9;
    for (let k = 0; k < n; k++) { m = Math.min(m, (segDist(c, points[k], points[(k + 1) % n]) - 3.4) / 3.4); if (k !== i) m = Math.min(m, (Math.hypot(c[0] - points[k][0], c[1] - points[k][1]) - 4.6) / 4.6); }
    for (const q of out) m = Math.min(m, (Math.hypot(c[0] - q[0], c[1] - q[1]) - 6.4) / 6.4);
    return m;
  };
  for (let i = 0; i < n; i++) {
    const pref = pzDdLabelAt(points, i, off), base = Math.atan2(pref[1] - points[i][1], pref[0] - points[i][0]), cands = [pref];
    for (let k = 1; k <= 12; k++) for (const sgn of [1, -1]) for (const r of [off, off + 2.6]) { const a = base + sgn * (k * Math.PI) / 12; cands.push([points[i][0] + r * Math.cos(a), points[i][1] + r * Math.sin(a)]); }
    let best = null, bs = -1e9;
    for (const c of cands) { const s = slack(c, i); if (s >= 0) { best = c; break; } if (s > bs) { bs = s; best = c; } }
    out.push(best);
  }
  return out;
}
