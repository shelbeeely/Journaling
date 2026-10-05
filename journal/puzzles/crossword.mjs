// Crossword generator: seeded and deterministic, pure. Free-form grid (no symmetry) built from a list of { word, clue }.
//   generateCrossword({ entries, size, difficulty, seed }) -> { rows, cols, cells: ['AB.C', ...] ('.' = block), across: [{n, word, clue, row, col}], down: [...] }
// Rules the result keeps (pzCheckCrossword verifies them from the grid alone): every run of 2+ letters, across or down, is exactly one entry;
// every letter belongs to an entry; every entry crosses at least one other (one connected grid, no dead ends); cells are numbered in reading order.
// difficulty: easy = fewer, shorter words; medium = more; hard = more and longer words.
import { pzRng, pzInt, pzShuffle, pzWord } from './rng.mjs';

export const PZ_CW_MIN = 7, PZ_CW_MAX = 11, PZ_CLUE_MAX = 40;
export const pzClueCount = (size, difficulty) => Math.min(14, Math.max(5, Math.round(size * { easy: 0.7, medium: 0.9, hard: 1.1 }[difficulty] || 0.9)));

// pool: [{ word, clue }] -> cleaned, unique, 3..max letters, with a clue
export function pzEntries(list, max) {
  const seen = new Set(), out = [];
  for (const e of list || []) {
    const word = pzWord(e && e.word), clue = String((e && e.clue) || '').replace(/\s+/g, ' ').trim().slice(0, PZ_CLUE_MAX);
    if (word.length >= 3 && word.length <= max && clue && !seen.has(word)) { seen.add(word); out.push({ word, clue }); }
  }
  return out;
}

function pzAttempt(words, size, r) {
  const at = (g, y, x) => (y < 0 || x < 0 || y >= size || x >= size ? '' : g.c[y][x]);
  const g = { c: Array.from({ length: size }, () => Array(size).fill('')), own: Array.from({ length: size }, () => Array(size).fill(0)), placed: [] }; // own: bit 1 across, bit 2 down
  const put = (word, row, col, down) => {
    for (let i = 0; i < word.length; i++) { const y = row + (down ? i : 0), x = col + (down ? 0 : i); g.c[y][x] = word[i]; g.own[y][x] |= down ? 2 : 1; }
    g.placed.push({ word, row, col, down });
  };
  const fits = (word, row, col, down) => {
    const dy = down ? 1 : 0, dx = down ? 0 : 1, ey = row + dy * word.length, ex = col + dx * word.length;
    if (row < 0 || col < 0 || ey - dy >= size || ex - dx >= size) return -1;
    if (at(g, row - dy, col - dx) || at(g, ey, ex)) return -1; // the word is bounded by empty cells (or the edge)
    let cross = 0;
    for (let i = 0; i < word.length; i++) {
      const y = row + dy * i, x = col + dx * i, v = g.c[y][x];
      if (v) { if (v !== word[i] || g.own[y][x] & (down ? 2 : 1)) return -1; cross++; }
      else if (at(g, y + dx, x + dy) || at(g, y - dx, x - dy)) return -1; // a new letter may not touch a neighbour sideways
    }
    return cross;
  };
  const [first, ...rest] = words;
  const fd = r() < 0.5, fr = fd ? Math.floor((size - first.length) / 2) : Math.floor(size / 2), fc = fd ? Math.floor(size / 2) : Math.floor((size - first.length) / 2);
  put(first, fr, fc, fd);
  for (const word of rest) {
    let top = null;
    for (const down of [false, true]) for (let row = 0; row < size; row++) for (let col = 0; col < size; col++) {
      const cross = fits(word, row, col, down);
      if (cross < 1) continue;
      const k = cross * 10 + r() * 3;
      if (!top || k > top.k) top = { row, col, down, k };
    }
    if (top) put(word, top.row, top.col, top.down); // a word that cannot cross anything is skipped
  }
  return g;
}

export function generateCrossword({ entries = [], size = 9, difficulty = 'medium', seed = '' } = {}) {
  size = Math.min(PZ_CW_MAX, Math.max(PZ_CW_MIN, Math.round(+size) || 9));
  if (!['easy', 'medium', 'hard'].includes(difficulty)) difficulty = 'medium';
  const pool = pzEntries(entries, size), want = Math.min(pool.length, pzClueCount(size, difficulty)), base = `cw|${seed}|${size}|${difficulty}`;
  let best = null;
  for (let attempt = 0; attempt < 60; attempt++) {
    const r = pzRng(`${base}|${attempt}`), bias = difficulty === 'hard' ? 1 : difficulty === 'easy' ? -1 : 0;
    // the pool is chosen with a bias for short (easy) or long (hard) words, a little more than we need so the ones that do not cross can be dropped
    const chosen = pool.map((e) => ({ e, k: e.word.length * bias * 1.5 + r() * 6 })).sort((a, b) => b.k - a.k || (a.e.word < b.e.word ? -1 : 1)).slice(0, Math.min(pool.length, want + 3)).map((x) => x.e.word);
    const longest = chosen.reduce((a, w) => (w.length > a.length ? w : a), '');
    const words = [longest, ...pzShuffle(r, chosen.filter((w) => w !== longest)).map((w) => ({ w, k: w.length + r() * 2.5 })).sort((a, b) => b.k - a.k).map((x) => x.w)];
    const g = pzAttempt(words, size, r), score = Math.min(g.placed.length, want) * 100 - g.c.flat().filter(Boolean).length * 0.1; // most words first, then the tightest grid
    if (!best || score > best.score) best = { g, score };
  }
  // words placed after the target count was reached are dropped, so a puzzle is never longer than asked (each word crosses an earlier one: the rest stay connected)
  const g = best.g, keep = g.placed.slice(0, want);
  const letters = Array.from({ length: size }, () => Array(size).fill(''));
  for (const p of keep) for (let i = 0; i < p.word.length; i++) letters[p.row + (p.down ? i : 0)][p.col + (p.down ? 0 : i)] = p.word[i];
  let y0 = size, y1 = -1, x0 = size, x1 = -1;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (letters[y][x]) { y0 = Math.min(y0, y); y1 = Math.max(y1, y); x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
  const rows = y1 - y0 + 1, cols = x1 - x0 + 1, cells = [];
  for (let y = y0; y <= y1; y++) cells.push(letters[y].slice(x0, x1 + 1).map((v) => v || '.').join(''));
  const clueOf = Object.fromEntries(pool.map((e) => [e.word, e.clue]));
  const filled = (y, x) => y >= 0 && x >= 0 && y < rows && x < cols && cells[y][x] !== '.';
  const across = [], down = [];
  let n = 0;
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    if (!filled(y, x)) continue;
    const a = !filled(y, x - 1) && filled(y, x + 1), d = !filled(y - 1, x) && filled(y + 1, x);
    if (!a && !d) continue;
    n++;
    const run = (dy, dx) => { let w = '', i = 0; while (filled(y + dy * i, x + dx * i)) { w += cells[y + dy * i][x + dx * i]; i++; } return w; };
    if (a) { const word = run(0, 1); across.push({ n, word, clue: clueOf[word] || '', row: y, col: x }); }
    if (d) { const word = run(1, 0); down.push({ n, word, clue: clueOf[word] || '', row: y, col: x }); }
  }
  return { rows, cols, cells, across, down, size, difficulty, seed: String(seed) };
}

// An independent check of a crossword, from its grid alone. Returns the problems found ([] = a valid crossword).
export function pzCheckCrossword(cw) {
  const out = [], { cells, rows, cols } = cw, filled = (y, x) => y >= 0 && x >= 0 && y < rows && x < cols && cells[y][x] !== '.';
  if (cells.length !== rows || cells.some((r) => r.length !== cols)) return ['the grid is not rows x cols'];
  const entries = [...cw.across.map((e) => ({ ...e, down: false })), ...cw.down.map((e) => ({ ...e, down: true }))];
  const covered = Array.from({ length: rows }, () => Array(cols).fill(0)), crossings = new Map(entries.map((e) => [e, 0]));
  for (const e of entries) {
    const dy = e.down ? 1 : 0, dx = e.down ? 0 : 1;
    if (!e.clue) out.push(`${e.n}${e.down ? ' down' : ' across'} (${e.word}) has no clue`);
    for (let i = 0; i < e.word.length; i++) if (!filled(e.row + dy * i, e.col + dx * i) || cells[e.row + dy * i][e.col + dx * i] !== e.word[i]) out.push(`${e.n} ${e.down ? 'down' : 'across'}: the grid does not spell ${e.word}`);
    if (filled(e.row - dy, e.col - dx) || filled(e.row + dy * e.word.length, e.col + dx * e.word.length)) out.push(`${e.n} ${e.down ? 'down' : 'across'}: ${e.word} is not a whole run (letters touch its ends)`);
    for (let i = 0; i < e.word.length; i++) covered[e.row + dy * i][e.col + dx * i] |= e.down ? 2 : 1;
  }
  // every run of 2+ letters is an entry, and every letter is in some entry
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    if (!filled(y, x)) continue;
    if (!covered[y][x]) out.push(`the letter at row ${y + 1}, column ${x + 1} belongs to no word`);
    if (filled(y, x + 1) && !(covered[y][x] & 1)) out.push(`an across run at row ${y + 1}, column ${x + 1} is not an entry`);
    if (filled(y + 1, x) && !(covered[y][x] & 2)) out.push(`a down run at row ${y + 1}, column ${x + 1} is not an entry`);
    if (covered[y][x] === 3) for (const e of entries) { const dy = e.down ? 1 : 0, dx = e.down ? 0 : 1; if (y >= e.row && x >= e.col && y <= e.row + dy * (e.word.length - 1) && x <= e.col + dx * (e.word.length - 1)) crossings.set(e, crossings.get(e) + 1); }
  }
  for (const [e, c] of crossings) if (c < 1) out.push(`${e.n} ${e.down ? 'down' : 'across'} (${e.word}) crosses no other word`);
  // numbering: reading order, one number per starting cell, shared by an across and a down entry that start in the same cell
  let n = 0; const num = new Map();
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) if (filled(y, x) && ((!filled(y, x - 1) && filled(y, x + 1)) || (!filled(y - 1, x) && filled(y + 1, x)))) num.set(`${y},${x}`, ++n);
  for (const e of entries) if (num.get(`${e.row},${e.col}`) !== e.n) out.push(`${e.n} ${e.down ? 'down' : 'across'} (${e.word}) is numbered wrongly (should be ${num.get(`${e.row},${e.col}`)})`);
  if (entries.length !== cw.across.length + cw.down.length || new Set(entries.map((e) => e.word + e.row + e.col + e.down)).size !== entries.length) out.push('duplicate entries');
  return out;
}
