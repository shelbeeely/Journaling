// Sudoku: 4x4 (2x2 boxes), 6x6 (boxes 2 rows by 3 columns) and 9x9 (3x3 boxes), seeded, always with exactly ONE solution.
//   generateSudoku({ size, difficulty, seed }) -> { size, boxRows, boxCols, puzzle: ['53..7....', ...], solution: [...], givens, level }
// How: a full grid is built by randomised backtracking, then cells are taken away in a seeded order and a cell stays empty only if a
// solver that counts solutions (it stops at 2) still finds exactly one. Difficulty is the number of givens AND the technique needed:
//   level 1 = every step is a naked single (a cell with one candidate left)      easy:   level 1, many givens
//   level 2 = naked singles and hidden singles (a digit with one place in a unit) medium: level 2 or less, fewer givens
//   level 3 = something harder than singles is needed                              hard:   as few givens as the size allows, level 3 where it exists
// A 4x4 or 6x6 grid is too small for level 3 to exist very often; its "hard" is just the fewest givens. Pure: no fs, no DOM. Names start with pz.
import { pzRng, pzShuffle } from './rng.mjs';

export const PZ_SD_BOX = { 4: [2, 2], 6: [2, 3], 9: [3, 3] }; // [box rows, box columns]
export const PZ_SD_SIZES = [4, 6, 9];
export const PZ_SD_GIVENS = { 4: { easy: 10, medium: 8, hard: 6 }, 6: { easy: 21, medium: 16, hard: 12 }, 9: { easy: 38, medium: 32, hard: 25 } };
export const PZ_SD_MAXLEVEL = { easy: 1, medium: 2, hard: 3 };
const pzSdGeo = {};
function pzSdGeom(n) {
  if (pzSdGeo[n]) return pzSdGeo[n];
  const [br, bc] = PZ_SD_BOX[n], row = [], col = [], box = [], units = [];
  for (let i = 0; i < n * n; i++) { row.push(Math.floor(i / n)); col.push(i % n); box.push(Math.floor(i / n / br) * (n / bc) + Math.floor((i % n) / bc)); }
  for (let k = 0; k < n; k++) {
    units.push(Array.from({ length: n }, (_, j) => k * n + j), Array.from({ length: n }, (_, j) => j * n + k));
    units.push(Array.from({ length: n * n }, (_, i) => i).filter((i) => box[i] === k));
  }
  return (pzSdGeo[n] = { n, br, bc, row, col, box, units, all: (1 << n) - 1 });
}
const pzSdBits = (m) => { const o = []; for (let d = 0; m; d++, m >>= 1) if (m & 1) o.push(d + 1); return o; };

// Up to `limit` solutions of the grid g0 (flat, 0 = empty), as flat arrays. With `r`, digits are tried in a seeded random order.
export function pzSdSearch(g0, n, limit = 2, r = null) {
  const G = pzSdGeom(n), g = g0.slice(), rowU = new Array(n).fill(0), colU = new Array(n).fill(0), boxU = new Array(n).fill(0), sols = [];
  for (let i = 0; i < n * n; i++) if (g[i]) { const b = 1 << (g[i] - 1); if ((rowU[G.row[i]] | colU[G.col[i]] | boxU[G.box[i]]) & b) return []; rowU[G.row[i]] |= b; colU[G.col[i]] |= b; boxU[G.box[i]] |= b; }
  const rec = () => {
    let best = -1, bm = 0, bn = 99;
    for (let i = 0; i < n * n; i++) {
      if (g[i]) continue;
      const m = G.all & ~(rowU[G.row[i]] | colU[G.col[i]] | boxU[G.box[i]]);
      let c = 0; for (let t = m; t; t &= t - 1) c++;
      if (c === 0) return;
      if (c < bn) { best = i; bm = m; bn = c; if (c === 1) break; }
    }
    if (best < 0) { sols.push(g.slice()); return; }
    let ds = pzSdBits(bm); if (r) ds = pzShuffle(r, ds);
    for (const d of ds) {
      const b = 1 << (d - 1);
      g[best] = d; rowU[G.row[best]] |= b; colU[G.col[best]] |= b; boxU[G.box[best]] |= b;
      rec();
      g[best] = 0; rowU[G.row[best]] &= ~b; colU[G.col[best]] &= ~b; boxU[G.box[best]] &= ~b;
      if (sols.length >= limit) return;
    }
  };
  rec();
  return sols;
}
export const pzSdCount = (g, n, limit = 2) => pzSdSearch(g, n, limit).length;

// The technique level a person needs (1 naked singles only, 2 plus hidden singles, 3 more than that). 0 for a grid with no solution.
export function pzSdLevel(g0, n) {
  const G = pzSdGeom(n), g = g0.slice();
  const cands = (i) => { let used = 0; for (const u of G.units) if (u.includes(i)) for (const j of u) if (g[j]) used |= 1 << (g[j] - 1); return G.all & ~used; };
  let hidden = false;
  for (;;) {
    const empty = []; for (let i = 0; i < n * n; i++) if (!g[i]) empty.push(i);
    if (!empty.length) return hidden ? 2 : 1;
    const cm = new Map(empty.map((i) => [i, cands(i)]));
    let moved = false;
    for (const [i, m] of cm) { if (m === 0) return 0; if ((m & (m - 1)) === 0) { g[i] = Math.log2(m) + 1; moved = true; break; } }
    if (moved) continue;
    outer: for (const u of G.units) for (let d = 1; d <= n; d++) {
      if (u.some((j) => g[j] === d)) continue;
      const where = u.filter((j) => !g[j] && cm.get(j) & (1 << (d - 1)));
      if (where.length === 1) { g[where[0]] = d; hidden = true; moved = true; break outer; }
    }
    if (!moved) return 3;
  }
}

const pzSdRows = (g, n) => Array.from({ length: n }, (_, y) => g.slice(y * n, y * n + n).map((d) => (d ? String(d) : '.')).join(''));
export function generateSudoku({ size = 9, difficulty = 'easy', seed = '' } = {}) {
  const n = PZ_SD_BOX[size] ? +size : 9, diff = PZ_SD_MAXLEVEL[difficulty] ? difficulty : 'easy', maxLevel = PZ_SD_MAXLEVEL[diff];
  const r = pzRng(`sudoku|${n}|${diff}|${seed}`), want = PZ_SD_GIVENS[n][diff];
  const solution = pzSdSearch(new Array(n * n).fill(0), n, 1, r)[0];
  const wantLevel = diff === 'easy' ? 1 : diff === 'medium' ? 2 : 3; // the level to aim for; the best of a few tries is used if it is not reached
  let best = null;
  for (let attempt = 0; attempt < 14; attempt++) {
    const g = solution.slice();
    let givens = n * n;
    for (const i of pzShuffle(r, Array.from({ length: n * n }, (_, k) => k))) {
      if (givens <= want) break;
      const v = g[i]; g[i] = 0;
      if (pzSdCount(g, n) === 1 && pzSdLevel(g, n) <= maxLevel) givens--; else g[i] = v;
    }
    const level = pzSdLevel(g, n), c = { g, givens, level };
    if (!best || (level === wantLevel ? 1 : 0) > (best.level === wantLevel ? 1 : 0) || ((level === wantLevel) === (best.level === wantLevel) && givens < best.givens)) best = c;
    if (best.level === wantLevel && best.givens <= want + 2) break;
    if (n < 9 && attempt >= 3 && best.givens <= want + 1) break; // a small grid rarely has the higher level: do not spin
  }
  return { size: n, boxRows: PZ_SD_BOX[n][0], boxCols: PZ_SD_BOX[n][1], difficulty: diff, puzzle: pzSdRows(best.g, n), solution: pzSdRows(solution, n), givens: best.givens, level: best.level };
}
