// Nonograms (picture logic): fill squares so each row and column has the runs its clue gives. Seeded, and each one has exactly ONE solution.
//   generateNonogram({ size, difficulty, seed }) -> { n, rows: ['#.#..', ...] (the picture, # = filled), rowClues: [[1,1],...], colClues, level }
// The picture starts as a random bitmap. A line solver (try every way a line could be laid out, keep what is true in all of them) works the
// clues like a person does. easy and medium only keep a picture the line solver finishes alone ("no guessing"); hard may also keep one that needs
// a guess, but only after a search that counts solutions has found exactly one. level 1 = line logic only, 2 = needs a guess.
// Pure: no fs, no DOM. Names start with pz.
import { pzRng, pzInt } from './rng.mjs';

export const PZ_NN_MIN = 5, PZ_NN_MAX = 15;
export const PZ_NN_DENSITY = { easy: 0.62, medium: 0.54, hard: 0.48 };
export const pzNnClue = (line) => { const o = []; let run = 0; for (const c of line) { if (c === 1) run++; else if (run) { o.push(run); run = 0; } } if (run) o.push(run); return o.length ? o : [0]; };

// Solve one line. cur: -1 unknown, 0 empty, 1 filled. Returns the line with everything certain filled in, or null if the clue cannot be met.
export function pzNnLine(clue, cur) {
  const L = cur.length, blocks = clue[0] === 0 ? [] : clue, k = blocks.length, canB = new Array(L).fill(false), canW = new Array(L).fill(false), dead = new Set();
  const arr = new Array(L).fill(0);
  let any = false;
  const need = new Array(k + 1).fill(0); // least cells blocks j.. need (with gaps)
  for (let j = k - 1; j >= 0; j--) need[j] = blocks[j] + (j < k - 1 ? 1 + need[j + 1] : 0);
  const rec = (i, j) => {
    const key = i * (k + 1) + j;
    if (dead.has(key)) return false;
    let ok = false;
    if (j === k) {
      for (let x = i; x < L; x++) if (cur[x] === 1) { dead.add(key); return false; }
      for (let x = i; x < L; x++) arr[x] = 0;
      for (let x = 0; x < L; x++) (arr[x] ? canB : canW)[x] = true;
      any = true;
      return true;
    }
    for (let s = i; s + need[j] <= L; s++) {
      let good = true;
      for (let x = i; x < s; x++) if (cur[x] === 1) { good = false; break; } // a filled cell skipped over
      if (!good) break;
      for (let x = s; x < s + blocks[j]; x++) if (cur[x] === 0) { good = false; break; }
      if (good && s + blocks[j] < L && cur[s + blocks[j]] === 1) good = false; // the block would touch another filled cell
      if (!good) continue;
      for (let x = i; x < s; x++) arr[x] = 0;
      for (let x = s; x < s + blocks[j]; x++) arr[x] = 1;
      if (s + blocks[j] < L) arr[s + blocks[j]] = 0;
      if (rec(Math.min(L, s + blocks[j] + 1), j + 1)) ok = true;
    }
    if (!ok) dead.add(key);
    return ok;
  };
  rec(0, 0);
  if (!any) return null;
  return cur.map((v, x) => (canB[x] && !canW[x] ? 1 : canW[x] && !canB[x] ? 0 : -1));
}
// Line logic over the whole grid. Returns { grid, solved, bad }.
export function pzNnPropagate(rowClues, colClues, grid0) {
  const n = rowClues.length, m = colClues.length, grid = grid0.map((r) => r.slice());
  let changed = true;
  while (changed) {
    changed = false;
    for (let y = 0; y < n; y++) {
      const out = pzNnLine(rowClues[y], grid[y]);
      if (!out) return { grid, solved: false, bad: true };
      out.forEach((v, x) => { if (v !== grid[y][x]) { grid[y][x] = v; changed = true; } });
    }
    for (let x = 0; x < m; x++) {
      const out = pzNnLine(colClues[x], grid.map((r) => r[x]));
      if (!out) return { grid, solved: false, bad: true };
      out.forEach((v, y) => { if (v !== grid[y][x]) { grid[y][x] = v; changed = true; } });
    }
  }
  return { grid, solved: grid.every((r) => r.every((v) => v !== -1)), bad: false };
}
// How many pictures meet the clues (stops at `limit`; budget = most nodes to try, 0 if the search ran out: then the answer is "unknown").
export function pzNnCount(rowClues, colClues, limit = 2, budget = 4000) {
  let nodes = 0, found = 0, out = false;
  const rec = (g) => {
    if (out || found >= limit) return;
    if (++nodes > budget) { out = true; return; }
    const p = pzNnPropagate(rowClues, colClues, g);
    if (p.bad) return;
    if (p.solved) { found++; return; }
    let at = null;
    for (let y = 0; y < p.grid.length && !at; y++) for (let x = 0; x < p.grid[y].length; x++) if (p.grid[y][x] === -1) { at = [y, x]; break; }
    for (const v of [1, 0]) { const h = p.grid.map((r) => r.slice()); h[at[0]][at[1]] = v; rec(h); }
  };
  rec(rowClues.map(() => new Array(colClues.length).fill(-1)));
  return out ? -1 : found;
}

export function generateNonogram({ size = 10, difficulty = 'medium', seed = '' } = {}) {
  const n = Math.max(PZ_NN_MIN, Math.min(PZ_NN_MAX, Math.round(+size) || 10)), diff = PZ_NN_DENSITY[difficulty] ? difficulty : 'medium', r = pzRng(`nonogram|${n}|${diff}|${seed}`);
  let fallback = null;
  for (let attempt = 0; attempt < 400; attempt++) {
    const dens = PZ_NN_DENSITY[diff] + (r() - 0.5) * 0.1;
    let bmp = Array.from({ length: n }, () => Array.from({ length: n }, () => (r() < dens ? 1 : 0)));
    for (let fix = 0; fix < 6; fix++) {
      const rowClues = bmp.map(pzNnClue), colClues = Array.from({ length: n }, (_, x) => pzNnClue(bmp.map((row) => row[x])));
      if (bmp.some((row) => !row.includes(1)) || bmp[0].some((_, x) => bmp.every((row) => !row[x]))) { // no empty line: a clue of 0 gives it away
        const y = bmp.findIndex((row) => !row.includes(1)); if (y >= 0) bmp[y][pzInt(r, n)] = 1; else { const x = bmp[0].findIndex((_, c) => bmp.every((row) => !row[c])); bmp[pzInt(r, n)][x] = 1; }
        continue;
      }
      const p = pzNnPropagate(rowClues, colClues, bmp.map((row) => row.map(() => -1)));
      const res = (level) => ({ n, difficulty: diff, rows: bmp.map((row) => row.map((v) => (v ? '#' : '.')).join('')), rowClues, colClues, level });
      if (p.solved) {
        if (diff !== 'hard' || attempt >= (n > 12 ? 25 : 120)) return res(1);
        fallback = fallback || res(1);
        break;
      }
      if (diff === 'hard' && pzNnCount(rowClues, colClues, 2, 160) === 1) return res(2); // needs a guess, and the search proved it unique
      // stuck: flip one cell that line logic could not decide and try again
      const open = []; p.grid.forEach((row, y) => row.forEach((v, x) => { if (v === -1) open.push([y, x]); }));
      if (!open.length) break;
      const [y, x] = open[pzInt(r, open.length)]; bmp[y][x] = bmp[y][x] ? 0 : 1;
    }
  }
  if (fallback) return fallback;
  throw new Error(`nonogram: no unique picture found for size ${n} ${diff}`);
}
