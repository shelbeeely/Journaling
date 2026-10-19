// Kakuro ("sum grid"): fill the white squares with 1 to 9 so every run adds up to the number in its clue square and no digit repeats in a run.
// Seeded, and each one has exactly ONE solution (a solver that counts solutions, stopping at 2, is run on the finished puzzle).
//   generateKakuro({ size, seed }) -> { n, cells: ['#.....', ...] (# = clue/black square, . = white), solution: ['#......', ...] digits,
//                                                    clues: [{ y, x, across: sum|0, down: sum|0 }], runs: [...], level }
// size = the grid's width and height counting the clue row and column: 5 (a 4 x 4 fill) or 6 (5 x 5). Runs are 2 to 4 squares long. Bigger grids were tried and pruned: a unique puzzle was not found reliably.
// How: a random pattern of squares (every white square sits in a run of 2+ across and 2+ down, all whites joined), a random valid fill,
// the sums read off the fill, and the fill kept only if it is the sole solution. Pure: no fs, no DOM. Names start with pz.
import { pzRng, pzInt, pzShuffle } from './rng.mjs';

export const PZ_KK_MIN = 5, PZ_KK_MAX = 6, PZ_KK_RUNMAX = 4;

// The runs of a pattern: [{ cells: [[y,x],...], dir: 'across'|'down', at: [y,x] (the clue square before it) }]
export function pzKkRuns(cells) {
  const n = cells.length, runs = [], white = (y, x) => y >= 0 && x >= 0 && y < n && x < n && cells[y][x] === '.';
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    if (white(y, x - 1) || !white(y, x)) continue;
    const c = []; for (let k = x; white(y, k); k++) c.push([y, k]);
    runs.push({ cells: c, dir: 'across', at: [y, x - 1] });
  }
  for (let x = 0; x < n; x++) for (let y = 0; y < n; y++) {
    if (white(y - 1, x) || !white(y, x)) continue;
    const c = []; for (let k = y; white(k, x); k++) c.push([k, x]);
    runs.push({ cells: c, dir: 'down', at: [y - 1, x] });
  }
  return runs;
}
export function pzKkValid(cells, maxRun, minFrac = 0.6) {
  const n = cells.length, runs = pzKkRuns(cells), seen = new Set();
  for (const r of runs) { if (r.cells.length < 2 || r.cells.length > maxRun) return false; for (const [y, x] of r.cells) { const k = y * n + x; seen.add(k + (r.dir === 'across' ? 0 : 1e6)); } }
  const whites = []; for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (cells[y][x] === '.') whites.push(y * n + x);
  if (whites.length < Math.ceil((n - 1) * (n - 1) * minFrac)) return false;
  for (const w of whites) if (!seen.has(w) || !seen.has(w + 1e6)) return false; // in a run across AND a run down
  const reach = new Set([whites[0]]), q = [whites[0]];
  for (let h = 0; h < q.length; h++) for (const d of [1, -1, n, -n]) { const j = q[h] + d, jx = j % n; if (j >= 0 && j < n * n && Math.abs(jx - (q[h] % n)) <= 1 && cells[Math.floor(j / n)][jx] === '.' && !reach.has(j)) { reach.add(j); q.push(j); } }
  return reach.size === whites.length;
}
// A random pattern: all white, then squares go black where a run is too long, and any white left alone in a run (a run of 1) goes black too.
export function pzKkPattern(n, maxRun, r) {
  const g = Array.from({ length: n }, (_, y) => Array.from({ length: n }, (_, x) => (y === 0 || x === 0 || r() < 0.2 ? '#' : '.')));
  const bad = () => { // runs of one or too long, and how many pieces the white squares fall into
    const cells = g.map((row) => row.join('')), runs = pzKkRuns(cells);
    let s = 0; for (const u of runs) s += u.cells.length === 1 ? 2 : Math.max(0, u.cells.length - maxRun);
    return { cells, runs, s };
  };
  for (let step = 0; step < 300; step++) {
    const cur = bad();
    if (cur.s === 0) return cur.cells;
    const viol = cur.runs.filter((u) => u.cells.length === 1 || u.cells.length > maxRun), u = viol[pzInt(r, viol.length)];
    const [y, x] = u.cells[pzInt(r, u.cells.length)];
    const flips = u.cells.length === 1 ? [[y, x], [y + 1, x], [y - 1, x], [y, x + 1], [y, x - 1]] : [[y, x]]; // alone: black it out or open a neighbour
    const [fy, fx] = flips[pzInt(r, flips.length)];
    if (fy < 1 || fx < 1 || fy >= n || fx >= n) continue;
    const was = g[fy][fx]; g[fy][fx] = was === '#' ? '.' : '#';
    if (bad().s > cur.s && r() < 0.8) g[fy][fx] = was;
  }
  return null;
}
// Solutions of the puzzle given only its sums, up to `limit`. runs: [{ cells, sum }]. Returns the solution grids (arrays of digits per white square).
export function pzKkSolve(n, runs, limit = 2) {
  const idx = (y, x) => y * n + x, whites = new Map(), runsOf = new Map();
  for (const r of runs) for (const [y, x] of r.cells) { whites.set(idx(y, x), 0); (runsOf.get(idx(y, x)) || runsOf.set(idx(y, x), []).get(idx(y, x))).push(r); }
  const st = runs.map(() => ({ used: 0, left: 0, sum: 0 }));
  runs.forEach((r, i) => { st[i].left = r.cells.length; st[i].sum = r.sum; r.i = i; });
  const feasible = (s) => {
    if (s.left === 0) return s.sum === 0;
    const av = []; for (let d = 1; d <= 9; d++) if (!(s.used & (1 << d))) av.push(d);
    if (av.length < s.left) return false;
    let lo = 0, hi = 0; for (let k = 0; k < s.left; k++) { lo += av[k]; hi += av[av.length - 1 - k]; }
    return s.sum >= lo && s.sum <= hi;
  };
  const sols = [], cellsList = [...whites.keys()];
  const rec = () => {
    let best = -1, bc = null;
    for (const c of cellsList) {
      if (whites.get(c)) continue;
      const rs = runsOf.get(c), cand = [];
      for (let d = 1; d <= 9; d++) {
        if (rs.some((r) => st[r.i].used & (1 << d))) continue;
        if (rs.some((r) => d > st[r.i].sum)) continue;
        cand.push(d);
      }
      if (!cand.length) return;
      if (!bc || cand.length < bc.length) { best = c; bc = cand; if (cand.length === 1) break; }
    }
    if (best < 0) { sols.push(new Map(whites)); return; }
    const rs = runsOf.get(best);
    for (const d of bc) {
      for (const r of rs) { const s = st[r.i]; s.used |= 1 << d; s.left--; s.sum -= d; }
      whites.set(best, d);
      if (rs.every((r) => feasible(st[r.i]))) rec();
      whites.set(best, 0);
      for (const r of rs) { const s = st[r.i]; s.used &= ~(1 << d); s.left++; s.sum += d; }
      if (sols.length >= limit) return;
    }
  };
  rec();
  return sols;
}
export const pzKkCount = (n, runs, limit = 2) => pzKkSolve(n, runs, limit).length;

// A random valid fill of the white squares (digits 1-9, none twice in a run), extreme digits first: their sums have few ways. null if none was found.
function pzKkFill(n, cells, runs, r) {
  const digit = Array.from({ length: n }, () => new Array(n).fill(0)), order = [];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (cells[y][x] === '.') order.push([y, x]);
  const used = new Map(runs.map((u) => [u, new Set()])), of = new Map();
  for (const u of runs) for (const [y, x] of u.cells) { const k = y * n + x; (of.get(k) || of.set(k, []).get(k)).push(u); }
  let budget = 4000;
  const put = (i) => {
    if (i === order.length) return true;
    if (--budget < 0) return false;
    const [y, x] = order[i], us = of.get(y * n + x);
    for (const d of pzShuffle(r, [1, 2, 3, 4, 5, 6, 7, 8, 9]).sort((a, b) => Math.abs(b - 5) - Math.abs(a - 5) + (r() - 0.5) * 3)) {
      if (us.some((u) => used.get(u).has(d))) continue;
      digit[y][x] = d; us.forEach((u) => used.get(u).add(d));
      if (put(i + 1)) return true;
      digit[y][x] = 0; us.forEach((u) => used.get(u).delete(d));
    }
    return false;
  };
  return put(0) ? digit : null;
}
export function generateKakuro({ size = 6, seed = '' } = {}) {
  const n = Math.max(PZ_KK_MIN, Math.min(PZ_KK_MAX, Math.round(+size) || 6)), maxRun = PZ_KK_RUNMAX, r = pzRng(`kakuro|${n}|${seed}`);
  for (let attempt = 0; attempt < 3000; attempt++) {
    let cells = pzKkPattern(n, maxRun, r);
    if (!cells || !pzKkValid(cells, maxRun)) continue;
    const digit = pzKkFill(n, cells, pzKkRuns(cells), r);
    if (!digit) continue;
    // While the sums leave more than one solution, turn one of the squares the two solutions disagree on into a clue square (the fill stays a solution).
    for (let repair = 0; repair < 14; repair++) {
      const runs = pzKkRuns(cells).map((u) => ({ ...u, sum: u.cells.reduce((s, [y, x]) => s + digit[y][x], 0) }));
      const sols = pzKkSolve(n, runs, 2);
      if (sols.length === 1) {
        const clues = [];
        for (const u of runs) { let c = clues.find((q) => q.y === u.at[0] && q.x === u.at[1]); if (!c) clues.push((c = { y: u.at[0], x: u.at[1], across: 0, down: 0 })); c[u.dir] = u.sum; }
        clues.sort((a, b) => a.y - b.y || a.x - b.x);
        return { n, cells, solution: digit.map((row, y) => row.map((d, x) => (cells[y][x] === '.' ? String(d) : '#')).join('')), clues, runs: runs.map((u) => ({ dir: u.dir, at: u.at, sum: u.sum, len: u.cells.length })), level: 1 };
      }
      const diff = pzShuffle(r, [...sols[0].keys()].filter((k) => sols[0].get(k) !== sols[1].get(k)));
      let next = null;
      for (const k of diff) { const y = Math.floor(k / n), x = k % n, t = cells.map((row, yy) => (yy === y ? row.slice(0, x) + '#' + row.slice(x + 1) : row)); if (pzKkValid(t, maxRun, 0.45)) { next = t; digit[y][x] = 0; break; } }
      if (!next) break;
      cells = next;
    }
  }
  throw new Error(`kakuro: no unique puzzle found for size ${n}`);
}
