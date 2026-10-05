// Word search generator: seeded and deterministic (the same words, size, difficulty and seed give the same grid), pure (no fs, no DOM).
//   generateWordSearch({ words, size, difficulty, seed }) -> { size, grid: ['ABC...', ...], words: [{ word, row, col, dir }], unplaced: [], ambiguous }
// difficulty: easy = across and down; medium = and diagonals; hard = and backwards. Every word in `words` of the result is placed
// exactly where `row`, `col` and `dir` say, and (after the filler letters) appears nowhere else in the grid.
import { pzRng, pzInt, pzShuffle, pzWord } from './rng.mjs';

export const PZ_DIRS = { E: [0, 1], S: [1, 0], SE: [1, 1], NE: [-1, 1], W: [0, -1], N: [-1, 0], NW: [-1, -1], SW: [1, -1] };
export const PZ_LEVELS = { easy: ['E', 'S'], medium: ['E', 'S', 'SE', 'NE'], hard: ['E', 'S', 'SE', 'NE', 'W', 'N', 'NW', 'SW'] };
export const PZ_WS_MIN = 8, PZ_WS_MAX = 15, PZ_WORD_MAX = 10;
export const pzWordCount = (size) => Math.round(size * 0.8);
const PZ_ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

// How many times `word` can be read in the grid (any of the 8 directions, from any cell).
export function pzCount(grid, word) {
  const n = grid.length; let c = 0;
  for (let r = 0; r < n; r++) for (let q = 0; q < n; q++) for (const [dr, dc] of Object.values(PZ_DIRS)) {
    let i = 0; for (; i < word.length; i++) { const y = r + dr * i, x = q + dc * i; if (y < 0 || x < 0 || y >= n || x >= n || grid[y][x] !== word[i]) break; }
    if (i === word.length) c++;
  }
  return c;
}
// The cells a placed word covers, in reading order.
export const pzCells = (p) => Array.from({ length: p.word.length }, (_, i) => [p.row + PZ_DIRS[p.dir][0] * i, p.col + PZ_DIRS[p.dir][1] * i]);

export function generateWordSearch({ words = [], size = 10, difficulty = 'easy', seed = '', count } = {}) {
  size = Math.min(PZ_WS_MAX, Math.max(PZ_WS_MIN, Math.round(+size) || 10));
  if (!PZ_LEVELS[difficulty]) difficulty = 'easy';
  const dirs = PZ_LEVELS[difficulty], pool = [...new Set(words.map(pzWord))].filter((w) => w.length >= 3 && w.length <= Math.min(size, PZ_WORD_MAX));
  const want = Math.min(pool.length, count || pzWordCount(size)), base = `ws|${seed}|${size}|${difficulty}`;
  let best = null;
  for (let attempt = 0; attempt < 80; attempt++) {
    const r = pzRng(`${base}|${attempt}`), bias = difficulty === 'hard' ? 1 : difficulty === 'easy' ? -1 : 0;
    const chosen = pool.map((w) => ({ w, k: w.length * bias + r() * 5 })).sort((a, b) => b.k - a.k || (a.w < b.w ? -1 : 1)).slice(0, want).map((x) => x.w);
    const order = pzShuffle(r, chosen).sort((a, b) => b.length - a.length);
    const cells = Array.from({ length: size }, () => Array(size).fill('')), placed = [], unplaced = [];
    for (const word of order) {
      const options = [];
      for (const d of dirs) {
        const [dr, dc] = PZ_DIRS[d];
        for (let row = 0; row < size; row++) for (let col = 0; col < size; col++) {
          const er = row + dr * (word.length - 1), ec = col + dc * (word.length - 1);
          if (er < 0 || ec < 0 || er >= size || ec >= size) continue;
          let ok = true, cross = 0;
          for (let i = 0; i < word.length && ok; i++) { const v = cells[row + dr * i][col + dc * i]; if (v && v !== word[i]) ok = false; else if (v) cross++; }
          if (ok && cross < word.length) options.push({ row, col, dir: d });
        }
      }
      if (!options.length) { unplaced.push(word); continue; }
      const o = options[pzInt(r, options.length)], [dr, dc] = PZ_DIRS[o.dir];
      for (let i = 0; i < word.length; i++) cells[o.row + dr * i][o.col + dc * i] = word[i];
      placed.push({ word, ...o });
    }
    if (!best || unplaced.length < best.unplaced.length) best = { cells, placed, unplaced };
    if (!unplaced.length) break;
  }
  // filler letters: half from the letters of the words (so the filler is not obviously different), then check no word appears twice
  const letters = best.placed.map((p) => p.word).join('') || PZ_ALPHA;
  const planted = best.cells.map((row) => row.map((v) => v || '.').join(''));
  const expect = best.placed.map((p) => pzCount(planted, p.word));
  let grid = null, ambiguous = true;
  for (let t = 0; t < 40 && ambiguous; t++) {
    const r = pzRng(`${base}|fill|${t}`);
    grid = best.cells.map((row) => row.map((v) => v || (r() < 0.5 ? letters[pzInt(r, letters.length)] : PZ_ALPHA[pzInt(r, 26)])).join(''));
    ambiguous = best.placed.some((p, i) => pzCount(grid, p.word) !== expect[i]);
  }
  const placed = best.placed.sort((a, b) => (a.word < b.word ? -1 : 1));
  return { size, grid, words: placed, unplaced: best.unplaced, ambiguous, difficulty, seed: String(seed) };
}
