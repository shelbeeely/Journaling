// Mazes: square, seeded, PERFECT (every cell reachable and exactly one way between any two cells, so one path from start to finish).
//   generateMaze({ size, style, seed }) -> { n, east, south, start, finish, path, style }
//   east[i] = 1 when the wall between cell i and the cell to its right is open; south[i] likewise for the cell below. Cells count row by row.
//   style "winding" = recursive backtracker (long corridors, few branches); "branchy" = Wilson's algorithm (an unbiased spanning tree: many short dead ends).
// The way in is the left wall of the top-left cell, the way out is the right wall of the bottom-right cell. `path` is the one solution (cell indexes).
// Pure: no fs, no DOM. Names start with pz.
import { pzRng, pzInt, pzShuffle } from './rng.mjs';

export const PZ_MZ_MIN = 8, PZ_MZ_MAX = 20;
export const PZ_MZ_STYLES = ['winding', 'branchy'];
const pzMzNbrs = (n, i) => { const x = i % n, y = Math.floor(i / n), o = []; if (y > 0) o.push(i - n); if (x < n - 1) o.push(i + 1); if (y < n - 1) o.push(i + n); if (x > 0) o.push(i - 1); return o; };
// The cells a cell opens onto (for walking the maze).
export function pzMzOpen(m, i) {
  const n = m.n, o = [];
  if (i >= n && m.south[i - n]) o.push(i - n);
  if (i % n < n - 1 && m.east[i]) o.push(i + 1);
  if (i < n * (n - 1) && m.south[i]) o.push(i + n);
  if (i % n > 0 && m.east[i - 1]) o.push(i - 1);
  return o;
}
export function pzMzSolve(m) { // the path from start to finish (breadth first: the shortest, which in a perfect maze is the only one)
  const prev = new Map([[m.start, -1]]), q = [m.start];
  for (let h = 0; h < q.length; h++) for (const j of pzMzOpen(m, q[h])) if (!prev.has(j)) { prev.set(j, q[h]); q.push(j); }
  const path = []; for (let c = m.finish; c !== -1 && prev.has(c); c = prev.get(c)) path.push(c);
  return path.reverse();
}
export function generateMaze({ size = 12, style = 'winding', seed = '' } = {}) {
  const n = Math.max(PZ_MZ_MIN, Math.min(PZ_MZ_MAX, Math.round(+size) || 12)), st = PZ_MZ_STYLES.includes(style) ? style : 'winding', r = pzRng(`maze|${n}|${st}|${seed}`);
  const east = new Array(n * n).fill(0), south = new Array(n * n).fill(0);
  const join = (a, b) => { if (b === a + 1) east[a] = 1; else if (b === a - 1) east[b] = 1; else if (b === a + n) south[a] = 1; else south[b] = 1; };
  if (st === 'winding') {
    const seen = new Array(n * n).fill(false), stack = [pzInt(r, n * n)];
    seen[stack[0]] = true;
    while (stack.length) {
      const c = stack[stack.length - 1], free = pzShuffle(r, pzMzNbrs(n, c)).filter((j) => !seen[j]);
      if (!free.length) { stack.pop(); continue; }
      seen[free[0]] = true; join(c, free[0]); stack.push(free[0]);
    }
  } else { // Wilson: loop-erased random walks until they hit the tree
    const inTree = new Array(n * n).fill(false), next = new Array(n * n).fill(-1);
    inTree[pzInt(r, n * n)] = true;
    for (const s of pzShuffle(r, Array.from({ length: n * n }, (_, k) => k))) {
      let u = s;
      while (!inTree[u]) { const o = pzMzNbrs(n, u); next[u] = o[pzInt(r, o.length)]; u = next[u]; }
      u = s;
      while (!inTree[u]) { inTree[u] = true; join(u, next[u]); u = next[u]; }
    }
  }
  const m = { n, style: st, east, south, start: 0, finish: n * n - 1, path: [] };
  m.path = pzMzSolve(m);
  return m;
}
// Every wall of the maze, as drawn: [x1, y1, x2, y2] in cell units. The way in and out are left open.
export function pzMzWalls(m) {
  const n = m.n, w = [];
  for (let y = 0; y <= n; y++) for (let x = 0; x < n; x++) {   // horizontal: the top edge of row y
    const open = y > 0 && y < n && m.south[(y - 1) * n + x];
    if (!open) w.push([x, y, x + 1, y]);
  }
  for (let x = 0; x <= n; x++) for (let y = 0; y < n; y++) {   // vertical: the left edge of column x
    const open = (x > 0 && x < n && m.east[y * n + x - 1]) || (x === 0 && y * n === m.start) || (x === n && y * n + n - 1 === m.finish);
    if (!open) w.push([x, y, x, y + 1]);
  }
  return w;
}
// Words for the path: "right 3, down 2, ..." for the text alternative.
export function pzMzRoute(m) {
  const n = m.n, out = [];
  for (let k = 1; k < m.path.length; k++) {
    const d = m.path[k] - m.path[k - 1], dir = d === 1 ? 'right' : d === -1 ? 'left' : d === n ? 'down' : 'up';
    if (out.length && out[out.length - 1][0] === dir) out[out.length - 1][1]++; else out.push([dir, 1]);
  }
  return out.map(([d, c]) => `${d} ${c}`).join(', ');
}
