// Puzzles P2 check (CI: books.yml): sudoku, maze, cryptogram, word ladder, nonogram, kakuro and dot to dot (journal/puzzles/*.mjs, BUILD-PLAN section 20).
//   1. Determinism: the same seed gives the same puzzle in this process and in a fresh one; another seed gives another puzzle.
//   2. Sudoku: 4x4, 6x6 and 9x9 over hundreds of seeds: a valid solution, the givens are part of it, and exactly ONE solution (a second solver, written
//      here and independent of the generator's, counts them); easy needs singles only, medium singles and hidden singles.
//   3. Maze: every cell reachable, exactly one path (a tree), the way in and out open, corridors at least 3.5 mm.
//   4. Cryptogram: the cipher decodes back to the sentence, no letter stands for itself, marks stay; the built-in and pack quotes meet the rules.
//   5. Word ladder: every step changes one letter, every rung is in the dictionary, the length is the SHORTEST (checked by a second search here).
//   6. Nonogram: the clues are the picture's, one picture meets them (independent search), easy and medium need no guessing.
//   7. Kakuro: the sums are the fill's, no digit repeats in a run, exactly ONE solution (independent search).
//   8. Dot to dot: dots are apart, the outline does not cross itself, numbers do not sit on each other.
//   9. The blocks: declared options, zones, the grid minimum, plain refusals, vector-only print-safe SVG with a text alternative (the solution
//      only when answers are shown), every page kind, class names used nowhere else.
//  10. The pack kind: the sample pack's quotes and bad quotes refused with a reason.
//  11. Builds (small and letter): each block on a day page passes check.mjs ("[] 0") with no Type 3 fonts, also with large print and high contrast on,
//      and the big ones on blank, Notes and Collection pages.
//   node test-puzzles2.mjs        (a few minutes: the builds go into out/puzzles2-test/)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { generateSudoku, PZ_SD_BOX, PZ_SD_GIVENS } from './puzzles/sudoku.mjs';
import { generateMaze, pzMzOpen, pzMzWalls, PZ_MZ_STYLES } from './puzzles/maze.mjs';
import { generateCryptogram, pzCrDecode, pzCrClean, pzCrLetters, PZ_CR_MAX } from './puzzles/cipher.mjs';
import { generateLadder, pzLdDict, pzLdFrom, pzLdNeighbours } from './puzzles/ladder.mjs';
import { generateNonogram, pzNnClue, pzNnPropagate } from './puzzles/nonogram.mjs';
import { generateKakuro } from './puzzles/kakuro.mjs';
import { generateDots, pzDdLabels, PZ_DD_SHAPES, PZ_DD_GAP, PZ_DD_IDS } from './puzzles/dots.mjs';
import { PZ_SAMPLE_QUOTES, PZ_LD_WORDS } from './puzzles/samples2.mjs';
import { PZX_TYPES, pzxBlock, pzxMin } from './puzzles/render2.mjs';
import { usePuzzlePack } from './puzzles/render.mjs';
import { newBlock, normalize, dayBlocks, minSpan, kindPage, autoPlace, gridProblems, TYPES, allowedIn, GRIDS } from './daypage.mjs';
import { KINDS } from './packs/kinds.mjs';
import { checkPack, readPart } from './packs/pack.mjs';

let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };
const sha = (x) => crypto.createHash('sha1').update(JSON.stringify(x)).digest('hex');
const SEEDS = (k, p = 's') => Array.from({ length: k }, (_, i) => p + i);

// ---- 1. determinism ----
const probe = () => ({
  sd: [4, 6, 9].flatMap((size) => ['easy', 'medium', 'hard'].map((difficulty) => generateSudoku({ size, difficulty, seed: 'det' }))),
  mz: PZ_MZ_STYLES.flatMap((style) => [8, 13, 20].map((size) => generateMaze({ size, style, seed: 'det' }))),
  cr: [generateCryptogram({ text: 'Quiet is not empty; it is room.', seed: 'det' })],
  ld: [3, 4, 5].flatMap((length) => [2, 4, 6].map((steps) => generateLadder({ length, steps, seed: 'det' }))),
  nn: [5, 9, 12].flatMap((size) => ['easy', 'medium', 'hard'].map((difficulty) => generateNonogram({ size, difficulty, seed: 'det' }))),
  kk: [5, 6].map((size) => generateKakuro({ size, seed: 'det' })),
  dd: PZ_DD_IDS.map((shape) => generateDots({ shape, detail: 2, seed: 'det' })).concat([generateDots({ seed: 'det' })]),
});
const here = sha(probe());
ok(here === sha(probe()), 'the same seed gives the same puzzles twice in one process');
const child = execFileSync('node', ['--input-type=module', '-e', `
  import { generateSudoku } from './puzzles/sudoku.mjs'; import { generateMaze, PZ_MZ_STYLES } from './puzzles/maze.mjs'; import { generateCryptogram } from './puzzles/cipher.mjs';
  import { generateLadder } from './puzzles/ladder.mjs'; import { generateNonogram } from './puzzles/nonogram.mjs'; import { generateKakuro } from './puzzles/kakuro.mjs'; import { generateDots, PZ_DD_IDS } from './puzzles/dots.mjs'; import crypto from 'node:crypto';
  const probe = () => ({
    sd: [4, 6, 9].flatMap((size) => ['easy', 'medium', 'hard'].map((difficulty) => generateSudoku({ size, difficulty, seed: 'det' }))),
    mz: PZ_MZ_STYLES.flatMap((style) => [8, 13, 20].map((size) => generateMaze({ size, style, seed: 'det' }))),
    cr: [generateCryptogram({ text: 'Quiet is not empty; it is room.', seed: 'det' })],
    ld: [3, 4, 5].flatMap((length) => [2, 4, 6].map((steps) => generateLadder({ length, steps, seed: 'det' }))),
    nn: [5, 9, 12].flatMap((size) => ['easy', 'medium', 'hard'].map((difficulty) => generateNonogram({ size, difficulty, seed: 'det' }))),
    kk: [5, 6].map((size) => generateKakuro({ size, seed: 'det' })),
    dd: PZ_DD_IDS.map((shape) => generateDots({ shape, detail: 2, seed: 'det' })).concat([generateDots({ seed: 'det' })]),
  });
  process.stdout.write(crypto.createHash('sha1').update(JSON.stringify(probe())).digest('hex'));`]).toString();
ok(child === here, 'the same seed gives the same puzzles in a fresh process');
ok(generateSudoku({ size: 9, seed: 'a' }).puzzle.join() !== generateSudoku({ size: 9, seed: 'b' }).puzzle.join() && generateMaze({ size: 12, seed: 'a' }).east.join() !== generateMaze({ size: 12, seed: 'b' }).east.join()
  && generateNonogram({ size: 10, seed: 'a' }).rows.join() !== generateNonogram({ size: 10, seed: 'b' }).rows.join() && generateKakuro({ size: 6, seed: 'a' }).solution.join() !== generateKakuro({ size: 6, seed: 'b' }).solution.join()
  && generateCryptogram({ text: 'Quiet is not empty; it is room.', seed: 'a' }).cipher !== generateCryptogram({ text: 'Quiet is not empty; it is room.', seed: 'b' }).cipher, 'another seed gives another puzzle');
ok(new Set(SEEDS(31, '2026-10-').map((s) => generateSudoku({ size: 9, difficulty: 'easy', seed: s }).puzzle.join(''))).size === 31, 'a month of day pages gives 31 different sudokus');

// ---- 2. sudoku ----
// An independent solver: plain row-major backtracking with sets (no candidate counting, no bit tricks), so it shares nothing with the generator.
function slowCount(rows, size, limit = 2) {
  const [br, bc] = PZ_SD_BOX[size], g = rows.map((r) => [...r].map((c) => (c === '.' ? 0 : +c)));
  const okAt = (y, x, d) => { for (let k = 0; k < size; k++) { if (k !== x && g[y][k] === d) return false; if (k !== y && g[k][x] === d) return false; } const y0 = y - (y % br), x0 = x - (x % bc); for (let i = 0; i < br; i++) for (let j = 0; j < bc; j++) if ((y0 + i !== y || x0 + j !== x) && g[y0 + i][x0 + j] === d) return false; return true; };
  let found = 0;
  const go = (pos) => {
    if (found >= limit) return;
    while (pos < size * size && g[Math.floor(pos / size)][pos % size]) pos++;
    if (pos === size * size) { found++; return; }
    const y = Math.floor(pos / size), x = pos % size;
    for (let d = 1; d <= size; d++) if (okAt(y, x, d)) { g[y][x] = d; go(pos + 1); g[y][x] = 0; }
  };
  g.forEach((row, y) => row.forEach((d, x) => { if (d) { g[y][x] = 0; if (!okAt(y, x, d)) found = 99; g[y][x] = d; } })); // the givens must not clash
  go(0);
  return found;
}
const validSolution = (rows, size) => {
  const [br, bc] = PZ_SD_BOX[size], full = [...Array(size).keys()].map((i) => String(i + 1)).join(''), line = (cells) => cells.sort().join('') === full;
  for (let i = 0; i < size; i++) { if (!line([...rows[i]]) || !line(rows.map((r) => r[i]))) return false; }
  for (let y0 = 0; y0 < size; y0 += br) for (let x0 = 0; x0 < size; x0 += bc) { const c = []; for (let y = 0; y < br; y++) for (let x = 0; x < bc; x++) c.push(rows[y0 + y][x0 + x]); if (!line(c)) return false; }
  return true;
};
let sdCount = 0, sdHard3 = 0, sdHard = 0;
for (const size of [4, 6, 9]) for (const difficulty of ['easy', 'medium', 'hard']) {
  const seeds = SEEDS(size === 9 ? 70 : size === 6 ? 80 : 60, `${size}${difficulty}`);
  seeds.forEach((seed, k) => {
    const p = generateSudoku({ size, difficulty, seed });
    sdCount++;
    assert.equal(p.size, size); assert.ok(p.puzzle.length === size && p.puzzle.every((r) => r.length === size), `${size} ${difficulty} ${seed}: a square grid`);
    assert.ok(validSolution(p.solution, size), `${size} ${difficulty} ${seed}: the solution is a valid sudoku`);
    assert.ok(p.puzzle.every((r, y) => [...r].every((c, x) => c === '.' || c === p.solution[y][x])), `${size} ${difficulty} ${seed}: the givens belong to the solution`);
    assert.equal(p.puzzle.join('').replace(/\./g, '').length, p.givens, 'the givens count is right');
    assert.ok(p.givens <= PZ_SD_GIVENS[size][difficulty] + 3, `${size} ${difficulty} ${seed}: ${p.givens} givens is near the target ${PZ_SD_GIVENS[size][difficulty]}`);
    if (size < 9 || k < 12) assert.equal(slowCount(p.puzzle, size), 1, `${size} ${difficulty} ${seed}: exactly one solution (independent solver)`);
    if (difficulty === 'easy') assert.equal(p.level, 1, `${size} easy ${seed}: singles only`);
    if (difficulty === 'medium') assert.ok(p.level <= 2, `${size} medium ${seed}: no technique past hidden singles`);
    if (size === 9 && difficulty === 'hard') { sdHard++; if (p.level === 3) sdHard3++; }
  });
}
ok(sdCount === 3 * (70 + 80 + 60), `sudoku: ${sdCount} puzzles, each valid, each with exactly one solution`);
ok(sdHard3 / sdHard >= 0.9, `9x9 hard needs more than singles in ${sdHard3} of ${sdHard} puzzles`);
ok(['easy', 'medium', 'hard'].every((d) => [4, 6, 9].every((s) => { const g = SEEDS(10).map((x) => generateSudoku({ size: s, difficulty: d, seed: x }).givens); return g.every((v) => v >= 4); })), 'every sudoku keeps enough givens');
{ const avg = (size, d) => SEEDS(25).map((s) => generateSudoku({ size, difficulty: d, seed: s }).givens).reduce((a, b) => a + b, 0) / 25;
  ok([4, 6, 9].every((s) => avg(s, 'easy') > avg(s, 'medium') && avg(s, 'medium') > avg(s, 'hard')), 'harder means fewer givens at every size (' + [4, 6, 9].map((s) => ['easy', 'medium', 'hard'].map((d) => avg(s, d).toFixed(1)).join('/')).join(', ') + ')'); }

// ---- 3. mazes ----
let mzCount = 0;
for (const style of PZ_MZ_STYLES) for (let size = 8; size <= 20; size++) for (const seed of SEEDS(6, `${style}${size}`)) {
  const m = generateMaze({ size, style, seed }), N = size * size;
  mzCount++;
  const seen = new Set([0]), q = [0]; let edges = 0;
  for (let h = 0; h < q.length; h++) for (const j of pzMzOpen(m, q[h])) { edges++; if (!seen.has(j)) { seen.add(j); q.push(j); } }
  assert.equal(seen.size, N, `${style} ${size} ${seed}: every cell can be reached`);
  assert.equal(edges / 2, N - 1, `${style} ${size} ${seed}: N-1 passages and connected, so a tree: exactly one path between any two cells`);
  assert.ok(m.path[0] === m.start && m.path[m.path.length - 1] === m.finish && m.path.every((c, i) => !i || pzMzOpen(m, c).includes(m.path[i - 1])), `${style} ${size}: the solution walks open passages from start to finish`);
  assert.equal(new Set(m.path).size, m.path.length, 'the path never revisits a cell');
  assert.ok(m.path.length >= size, `${style} ${size} ${seed}: the way through is not a shortcut (${m.path.length} cells)`);
  const walls = pzMzWalls(m), horizontal = walls.filter((w) => w[1] === w[3]).length, vertical = walls.length - horizontal;
  assert.equal(horizontal + vertical, 2 * size * (size + 1) - (N - 1) - 2, `${style} ${size}: the wall count is every wall minus the passages and the two doors`);
  assert.ok(!walls.some(([x1, y1, x2, y2]) => x1 === 0 && x2 === 0 && y1 === 0), 'the way in (left of the top-left cell) is open');
  assert.ok(!walls.some(([x1, y1, x2, y2]) => x1 === size && x2 === size && y1 === size - 1), 'the way out (right of the bottom-right cell) is open');
}
ok(mzCount === 2 * 13 * 6, `maze: ${mzCount} mazes, each connected with exactly one way through`);
{ const mean = (style) => SEEDS(20).reduce((a, x) => a + generateMaze({ size: 20, style, seed: x }).path.length, 0) / 20; ok(mean('winding') > mean('branchy') && mean('branchy') > 20, `the styles differ: winding paths average ${mean('winding').toFixed(0)} cells, branchy ${mean('branchy').toFixed(0)}`); }
for (const size of [8, 12, 16, 20]) {
  const html = dayBlocks({ header: '', day: { date: '2026-10-05' } }, { v: 2, blocks: [newBlock('maze', { size }, 'm'), newBlock('body', {}, 'body')] }), w = +/<svg width="([\d.]+)"[^>]*role="img"/.exec(html)[1], cell = (w - 4) / size;
  ok((cell - 1.6) * 0.2646 >= 3.5 && /stroke-width="1.6"/.test(html), `maze ${size}: corridors are ${((cell - 1.6) * 0.2646).toFixed(1)} mm wide (3.5 mm or more) and walls are 1.6 px (1.2 pt)`);
}

// ---- 4. cryptogram ----
const allQuotes = Object.entries(PZ_SAMPLE_QUOTES).flatMap(([id, l]) => l.items.map((t) => [id, t]));
for (const [id, t] of allQuotes) {
  ok(pzCrClean(t) === t.toUpperCase() && pzCrLetters(pzCrClean(t)) >= 12 && t.length <= PZ_CR_MAX && /^[A-Za-z .,;:!?'-]+$/.test(t), `quote "${t}" (${id}) uses only letters and simple marks, 12+ letters, at most ${PZ_CR_MAX} characters`);
  for (const seed of SEEDS(12)) {
    const c = generateCryptogram({ text: t, seed });
    assert.equal(pzCrDecode(c.cipher, c.key), c.plain, 'decoding gives the sentence back');
    assert.ok(Object.entries(c.key).every(([p, k]) => p !== k) && new Set(Object.values(c.key)).size === 26, 'a substitution with no letter standing for itself');
    assert.ok([...c.plain].every((ch, i) => (/[A-Z]/.test(ch) ? c.cipher[i] !== ch : c.cipher[i] === ch)), 'every letter changes, every space and mark stays');
    assert.equal(c.cipher.length, c.plain.length);
    const freq = {}; for (const ch of c.plain.match(/[A-Z]/g)) freq[ch] = (freq[ch] || 0) + 1;
    assert.ok(freq[c.hint.plain] === Math.max(...Object.values(freq)) && c.key[c.hint.plain] === c.hint.cipher, 'the hint letter is the most frequent one');
  }
}
ok(allQuotes.length >= 36 && new Set(allQuotes.map((q) => q[1].toLowerCase())).size === allQuotes.length, `${allQuotes.length} original quotes, none twice (written for this project, never from a published source)`);
{ const c = generateCryptogram({ text: "It's fine, really! Don't worry.", seed: 'x' }); ok(/^[A-Z]+'[A-Z]+ [A-Z]+, [A-Z]+! [A-Z]+'[A-Z]+ [A-Z]+\.$/.test(c.cipher), 'apostrophes, commas, ! and . stay where they are'); }

// ---- 5. word ladder ----
const slowDist = (len, a, b, extra = []) => { // breadth first written out again, over the raw word lists
  const words = new Set(PZ_LD_WORDS[len].split(' ').concat(extra)), dist = new Map([[a, 0]]), q = [a];
  for (let h = 0; h < q.length; h++) for (const w of words) if (!dist.has(w) && [...w].filter((c, i) => c !== q[h][i]).length === 1) { dist.set(w, dist.get(q[h]) + 1); q.push(w); }
  return dist.get(b);
};
let ldCount = 0, ldExact = 0;
for (const length of [3, 4, 5]) for (let steps = 2; steps <= 8; steps++) for (const seed of SEEDS(5, `${length}${steps}`)) {
  const l = generateLadder({ length, steps, seed }), dict = pzLdDict(length);
  ldCount++; if (l.steps === steps) ldExact++;
  assert.equal(l.words.length, l.steps + 1); assert.ok(l.steps <= steps, 'never longer than asked');
  assert.ok(l.words.every((w) => w.length === length && dict.has(w)), `${length}/${steps}: every rung is in the dictionary`);
  assert.ok(l.words.every((w, i) => !i || [...w].filter((c, k) => c !== l.words[i - 1][k]).length === 1), `${l.words}: each step changes exactly one letter`);
  assert.equal(slowDist(length, l.words[0], l.words[l.words.length - 1]), l.steps, `${l.words}: ${l.steps} steps is the shortest ladder (second search)`);
  assert.equal(new Set(l.words).size, l.words.length, 'no word twice');
}
ok(ldExact / ldCount >= 0.95, `word ladder: ${ldCount} ladders, each valid and shortest; ${ldExact} have exactly the asked number of steps`);
{ const l = generateLadder({ start: 'cold', end: 'warm' }); ok(l.custom && l.words[0] === 'cold' && l.words.at(-1) === 'warm' && l.steps === slowDist(4, 'cold', 'warm'), 'my own pair: cold to warm in ' + l.steps + ' steps');
  const none = generateLadder({ start: 'zzzz', end: 'qqqq', steps: 3, seed: 'q' }); ok(!none.custom && none.steps >= 2, 'a pair with no ladder falls back to a built-in one'); }
{ // 4-letter, 3-letter and 5-letter dictionaries are plain everyday words and have no duplicates or blanks
  for (const k of [3, 4, 5]) { const ws = PZ_LD_WORDS[k].split(' '); ok(ws.every((w) => /^[a-z]+$/.test(w) && w.length === k) && new Set(ws).size === ws.length, `the ${k}-letter dictionary has ${ws.length} distinct words`); }
}

// ---- 6. nonograms ----
// An independent solver: rows are tried top to bottom from every way a row can be laid out; columns are checked as they grow.
function slowNono(rowClues, colClues, limit = 2) {
  const W = colClues.length, ways = (clue) => { const out = [], k = clue[0] === 0 ? [] : clue; const rec = (i, j, cur) => { if (j === k.length) { out.push(cur.concat(Array(W - cur.length).fill(0))); return; } for (let s = i; s + k[j] <= W; s++) rec(s + k[j] + 1, j + 1, cur.concat(Array(s - cur.length).fill(0), Array(k[j]).fill(1), s + k[j] < W ? [0] : [])); }; rec(0, 0, []); return out.map((r) => r.slice(0, W)); };
  const cand = rowClues.map(ways), cols = colClues.map((c) => (c[0] === 0 ? [] : c));
  const okCol = (x, picked, rowsLeft) => { const runs = []; let run = 0; for (const r of picked) { if (r[x]) run++; else if (run) { runs.push(run); run = 0; } } const open = run > 0; if (open) runs.push(run); const c = cols[x];
    if (runs.length > c.length) return false; for (let i = 0; i < runs.length; i++) if (open && i === runs.length - 1 ? runs[i] > c[i] : runs[i] !== c[i]) return false;
    const need = c.slice(runs.length - (open ? 1 : 0)).reduce((a, b) => a + b, 0) - (open ? runs[runs.length - 1] : 0); return need <= rowsLeft; };
  let found = 0;
  const go = (y, picked) => {
    if (found >= limit) return;
    if (y === rowClues.length) { if (cols.every((c, x) => { const col = picked.map((r) => r[x]); return JSON.stringify(pzNnClue(col)) === JSON.stringify(colClues[x]); })) found++; return; }
    for (const r of cand[y]) { const next = picked.concat([r]); if (colClues.every((_, x) => okCol(x, next, rowClues.length - y - 1))) go(y + 1, next); }
  };
  go(0, []);
  return found;
}
let nnCount = 0, nnLine = 0;
for (const size of [5, 6, 7, 8, 9, 10, 12, 15]) for (const difficulty of ['easy', 'medium', 'hard']) for (const seed of SEEDS(size >= 12 ? 3 : 8, `${size}${difficulty}`)) {
  const p = generateNonogram({ size, difficulty, seed }), bmp = p.rows.map((r) => [...r].map((c) => (c === '#' ? 1 : 0)));
  nnCount++;
  assert.deepEqual(p.rowClues, bmp.map(pzNnClue), 'row clues are the picture\'s'); assert.deepEqual(p.colClues, bmp[0].map((_, x) => pzNnClue(bmp.map((r) => r[x]))), 'column clues are the picture\'s');
  assert.ok(p.rows.length === size && p.rows.every((r) => r.length === size), 'square');
  if (size <= 10) assert.equal(slowNono(p.rowClues, p.colClues), 1, `${size} ${difficulty} ${seed}: exactly one picture meets the clues (independent search)`);
  const line = pzNnPropagate(p.rowClues, p.colClues, bmp.map((r) => r.map(() => -1))).solved;
  if (difficulty !== 'hard') assert.ok(line && p.level === 1, `${size} ${difficulty} ${seed}: solvable by line logic alone, no guessing`); else if (line) nnLine++;
}
ok(nnCount === 8 * 3 * 8 - 2 * 3 * 5, `nonogram: ${nnCount} puzzles, clues match, one solution each (independent search up to 10 x 10); ${nnLine} hard ones were line-solvable anyway`);

// ---- 7. kakuro ----
function slowKakuro(kk, limit = 2) { // independent: fill white squares in reading order, check each run when it fills
  const n = kk.n, whites = []; for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (kk.cells[y][x] === '.') whites.push([y, x]);
  const g = Array.from({ length: n }, () => Array(n).fill(0)), runs = kk.runs.map((r) => { const cells = []; let [y, x] = r.at; for (;;) { y += r.dir === 'down' ? 1 : 0; x += r.dir === 'across' ? 1 : 0; if (y >= n || x >= n || kk.cells[y][x] !== '.') break; cells.push([y, x]); } return { ...r, cells }; });
  let found = 0;
  const check = (y, x) => runs.every((r) => { if (!r.cells.some(([a, b]) => a === y && b === x)) return true; const v = r.cells.map(([a, b]) => g[a][b]).filter(Boolean); if (new Set(v).size !== v.length) return false; const s = v.reduce((a, b) => a + b, 0); return v.length === r.cells.length ? s === r.sum : s < r.sum; });
  const go = (i) => { if (found >= limit) return; if (i === whites.length) { found++; return; } const [y, x] = whites[i]; for (let d = 1; d <= 9; d++) { g[y][x] = d; if (check(y, x)) go(i + 1); g[y][x] = 0; } };
  go(0);
  return found;
}
let kkCount = 0;
for (const size of [5, 6]) for (const seed of SEEDS(size === 5 ? 40 : 25, `k${size}`)) {
  const kk = generateKakuro({ size, seed }), n = kk.n;
  kkCount++;
  assert.ok(kk.cells.every((r, y) => r.length === n && (y === 0 ? /^#+$/.test(r) : r[0] === '#')), 'the first row and column are clue squares');
  const digits = (y, x) => +kk.solution[y][x];
  for (const r of kk.runs) {
    const cells = []; let [y, x] = r.at; for (;;) { y += r.dir === 'down' ? 1 : 0; x += r.dir === 'across' ? 1 : 0; if (y >= n || x >= n || kk.cells[y][x] !== '.') break; cells.push(digits(y, x)); }
    assert.ok(cells.length === r.len && r.len >= 2 && r.len <= 4, `${size} ${seed}: runs are 2 to 4 long`);
    assert.equal(cells.reduce((a, b) => a + b, 0), r.sum, `${size} ${seed}: the clue is the run's sum`);
    assert.equal(new Set(cells).size, cells.length, `${size} ${seed}: no digit twice in a run`); assert.ok(cells.every((d) => d >= 1 && d <= 9));
  }
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (kk.cells[y][x] === '.') assert.ok(kk.runs.filter((r) => r.dir === 'across' && r.at[0] === y && r.at[1] < x && x <= r.at[1] + r.len).length === 1 && kk.runs.filter((r) => r.dir === 'down' && r.at[1] === x && r.at[0] < y && y <= r.at[0] + r.len).length === 1, 'every white square is in one run across and one down');
  assert.equal(slowKakuro(kk), 1, `${size} ${seed}: exactly one solution (independent search)`);
}
ok(kkCount === 65, `kakuro: ${kkCount} puzzles, sums right, no repeats, exactly one solution each`);

// ---- 8. dot to dot ----
const segX = (a, b, c, d) => { const o = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])); return o(a, b, c) !== o(a, b, d) && o(c, d, a) !== o(c, d, b); };
for (const id of PZ_DD_IDS) for (const detail of [1, 2, 3]) {
  const d = generateDots({ shape: id, detail, seed: 'x' }), P = d.points, N = P.length;
  ok(N >= 8 && N <= 60 && d.n === N, `${id} detail ${detail}: ${N} dots`);
  let gap = 1e9; for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) gap = Math.min(gap, Math.hypot(P[i][0] - P[j][0], P[i][1] - P[j][1]));
  ok(gap >= PZ_DD_GAP, `${id} detail ${detail}: dots are at least ${PZ_DD_GAP} units apart (closest ${gap.toFixed(1)})`);
  ok(P.every(([x, y]) => x >= 0 && x <= 100 && y >= 0 && y <= 100), `${id}: inside the square`);
  let cross = 0; for (let i = 0; i < N; i++) for (let j = i + 2; j < N; j++) { if (i === 0 && j === N - 1) continue; if (segX(P[i], P[(i + 1) % N], P[j], P[(j + 1) % N])) cross++; }
  ok(cross === 0, `${id} detail ${detail}: the outline does not cross itself`);
  const L = pzDdLabels(P, 7.2); let lg = 1e9; for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) lg = Math.min(lg, Math.hypot(L[i][0] - L[j][0], L[i][1] - L[j][1]));
  ok(lg >= 6, `${id} detail ${detail}: numbers stay clear of each other (closest ${lg.toFixed(1)} units)`);
}
ok(new Set(SEEDS(31, 'd').map((s) => generateDots({ seed: s }).shape)).size >= 6, 'a month of dot to dots shows many different pictures');
ok(Object.values(PZ_DD_SHAPES).every((s) => s.name.length > 3), 'every picture has a name');

// ---- 9. the blocks ----
const strokes = (svg) => [...svg.matchAll(/stroke-width="([\d.]+)"/g)].map((m) => +m[1]);
const day = { date: '2026-10-05' };
const mkb = (type, o = {}, uid = 'k') => newBlock(type, o, uid);
const html = (type, o = {}, d = day) => dayBlocks({ header: '', day: d }, { v: 2, blocks: [mkb(type, o), newBlock('body', {}, 'body')] });
const desc = (h) => /<desc[^>]*>([^<]*)/.exec(h)[1];
const OPTS = { sudoku: ['size', 'difficulty', 'seed', 'answers', 'big'], maze: ['size', 'style', 'seed', 'answers', 'big'], cryptogram: ['length', 'source', 'theme', 'words', 'seed', 'hint', 'freq', 'answers', 'big'], wordladder: ['length', 'steps', 'source', 'words', 'seed', 'hint', 'answers', 'big'], nonogram: ['size', 'difficulty', 'seed', 'answers', 'big'], kakuro: ['size', 'seed', 'answers', 'big'], dottodot: ['shape', 'detail', 'seed', 'answers', 'big'] };
ok(PZX_TYPES.join() === Object.keys(OPTS).join(), 'seven new blocks');
for (const type of PZX_TYPES) {
  ok(TYPES[type] && TYPES[type].group === 'Puzzles' && TYPES[type].icon && OPTS[type].every((k) => TYPES[type].opts.some((o) => o.k === k)), `${type}: in the Puzzles palette group with an icon, and declares ${OPTS[type].join(', ')}`);
  ok(allowedIn('day', type) && allowedIn('notes', type) && allowedIn('collection', type) && allowedIn('blank', type) && allowedIn('spread', type) && allowedIn('half', type), `${type}: allowed on day, Notes, Collection, blank and spread pages`);
  const b = mkb(type), h = html(type), svg = /<svg width.*?<\/svg>/s.exec(h)[0];
  ok(new RegExp(`data-zone="${type}"`).test(h), `${type}: the block has its data-zone`);
  ok((strokes(svg).length > 0 || type === "dottodot") && strokes(svg).every((w) => w >= 1 - 1e-9), `${type}: every stroke is 1 px (0.75 pt) or more`);
  ok(!/<image|<filter|<mask|filter=|<pattern|<foreignObject|<script|href=|src=/.test(svg), `${type}: plain vector, no raster, filter, mask or script`);
  ok(/role="img"/.test(svg) && /<title id="[^"]+">[^<]+<\/title>/.test(svg) && /<desc id="[^"]+">[^<]{25,}/.test(svg) && /aria-labelledby="(\S+) (\S+)"/.test(svg), `${type}: text alternative (role img, title, desc)`);
  ok([...svg.matchAll(/font-family="([^"]+)"/g)].every((m) => m[1] === 'Inter, sans-serif'), `${type}: any text is in Inter (a real font, never Type 3)`);
  const m = minSpan(b); ok(m.cols >= 1 && m.cols <= 4 && m.rows >= 6 && m.rows <= 22, `${type}: has a grid minimum (${JSON.stringify(m)})`);
  ok(html(type) === h, `${type}: the same page and seed print the same block`);
  ok(html(type, {}, { date: '2026-10-06' }) !== h, `${type}: another day gives another puzzle`);
  ok(html(type, { seed: 'again' }) !== h, `${type}: changing the seed gives another puzzle`);
  const two = dayBlocks({ header: '', day }, { v: 2, blocks: [mkb(type, {}, 'a'), mkb(type, {}, 'b')] });
  ok(new RegExp(`data-zone="${type}"`).test(two) && new RegExp(`data-zone="${type}_2"`).test(two), `${type}: a repeated block maps ${type} and ${type}_2`);
}
{ // answers: only in the description, only when asked
  const sd = generateSudoku({ size: 9, difficulty: 'easy', seed: '2026-10-05|k||' });
  ok(!/Solution/.test(desc(html('sudoku'))) && new RegExp('Solution\\. Row 1: ' + sd.solution[0].split('').join(' ')).test(desc(html('sudoku', { answers: true }))), 'sudoku: the solution is in the description only when shown');
  const m = generateMaze({ size: 12, style: 'winding', seed: '2026-10-05|k||' });
  ok(!/The way through/.test(desc(html('maze'))) && /The way through: /.test(desc(html('maze', { answers: true }))) && /<polyline/.test(html('maze', { answers: true })) && !/<polyline/.test(html('maze')) && m.path.length > 0, 'maze: the path is drawn and described only when shown');
  const cr = (o) => desc(html('cryptogram', o)), plain = cr({ answers: true }).split('Answer: ')[1];
  ok(plain && !/Answer:/.test(cr({})) && !cr({}).includes(plain) && /Hint: every/.test(cr({ hint: true })) && !/Answer:/.test(cr({ hint: true })), 'cryptogram: the answer is in the description only when shown (a hint gives one letter)');
  const ld = (o) => desc(html('wordladder', o));
  ok(!/One answer/.test(ld({})) && /One answer: [A-Z, ]+\. Other ladders may also be right\./.test(ld({ answers: true })), 'word ladder: one answer, said to be one of several, only when shown');
  ok(!/Solution rows/.test(desc(html('nonogram'))) && /Solution rows/.test(desc(html('nonogram', { answers: true }))) && /Row clues/.test(desc(html('nonogram'))), 'nonogram: the clues are described, the picture only when shown');
  ok(!/Solution rows/.test(desc(html('kakuro'))) && /Solution rows/.test(desc(html('kakuro', { answers: true }))) && /Clue squares/.test(desc(html('kakuro'))), 'kakuro: the clues are described, the fill only when shown');
  ok(!/picture is/.test(desc(html('dottodot'))) && /picture is /.test(desc(html('dottodot', { answers: true }))) && !/<polygon/.test(html('dottodot')) && /<polygon/.test(html('dottodot', { answers: true })), 'dot to dot: the picture is drawn and named only when shown');
  ok(pzxBlock(mkb('sudoku'), 'x', { answers: true }).body !== pzxBlock(mkb('sudoku'), 'x', { answers: false }).body, 'pzxBlock can draw an answer key for the same seed (for a key page)');
}
{ // sources
  const own = desc(html('cryptogram', { source: 'custom', words: ['Hello there, kind stranger.'], answers: true })); ok(/Answer: HELLO THERE, KIND STRANGER\.$/.test(own) && /coded sentence is: [A-Z]{5} [A-Z]{5}, [A-Z]{4} [A-Z]{8}\./.test(own) && !html('cryptogram', { source: 'custom', words: ['Hello there, kind stranger.'] }).includes('Answer: HELLO'), 'cryptogram: "My own sentences" uses the typed sentence');
  ok(/Gentle days/.test(html('cryptogram', {})) && /Small wisdom/.test(html('cryptogram', { theme: 'wise' })), 'cryptogram: the built-in list name picks the list');
  ok(/Gentle days/.test(html('cryptogram', { source: 'custom', words: ['too short'] }) + html('cryptogram', { theme: 'nonsense' })), 'cryptogram: too few usable sentences, or an unknown list, fall back to the first built-in list');
  usePuzzlePack(readPart('puzzles-sample', 'puzzles'));
  const pk = html('cryptogram', { source: 'pack', theme: 'evenings' }); ok(/Evenings/.test(pk), 'cryptogram: the "pack" source reads the puzzles pack\'s quotes');
  usePuzzlePack(null);
  ok(/Gentle days/.test(html('cryptogram', { source: 'pack', theme: 'evenings' })), 'cryptogram: no pack, the built-in list');
  const cl = html('wordladder', { source: 'custom', words: ['cold-warm'] }); ok(/COLD to WARM/.test(cl) && /<b>COLD<\/b> into <b>WARM<\/b>/.test(cl), 'word ladder: "My own pair" uses cold-warm');
  ok(/to /.test(html('wordladder', { source: 'custom', words: ['xxxx-yyyy'], steps: 3 })), 'word ladder: a pair with no ladder falls back to a built-in one');
}
{ // large print and the options are real changes
  for (const type of PZX_TYPES) ok(minSpan(mkb(type, { big: true })).rows >= minSpan(mkb(type)).rows, `${type}: large print never asks for less room`);
  ok(/class="xb pzx big"/.test(html('sudoku', { big: true })) && /class="xb pzx"/.test(html('sudoku')), 'large print marks the block');
  ok(minSpan(mkb('sudoku', { size: 4 })).cols < minSpan(mkb('sudoku', { size: 9 })).cols && minSpan(mkb('maze', { size: 8 })).cols < minSpan(mkb('maze', { size: 20 })).cols, 'smaller puzzles need fewer columns');
  ok(minSpan(mkb('wordladder', { steps: 8 })).rows > minSpan(mkb('wordladder', { steps: 3 })).rows, 'a longer ladder needs more rows');
}
{ // the grid: plain refusals, every page kind, the fold
  const cases = [['sudoku', { size: 9 }], ['maze', { size: 12 }], ['cryptogram', {}], ['wordladder', {}], ['nonogram', { size: 10 }], ['kakuro', {}], ['dottodot', {}]];
  for (const [type, o] of cases) {
    const b = mkb(type, o), m = minSpan(b);
    for (const kind of ['notes', 'collection', 'blank']) {
      const L = normalize({ v: 2, kind, grid: true, blocks: [mkb(type, o, 'p'), ...(kind === 'blank' ? [] : [newBlock('body', {}, 'body')])] }, 'small', kind), dropped = autoPlace(L, 'small'), placed = normalize(L, 'small', kind);
      if (dropped.length) continue; // does not fit that page with a Writing space: said below
      ok(gridProblems(placed, 'small').length === 0 && gridProblems(placed, 'letter').length === 0, `${type}: places on a ${kind} page at both trims`);
      const h = kindPage(kind, 'Puzzles', placed, 'small', { pageId: `${kind}.1` }); ok(new RegExp(`data-zone="${type}"`).test(h), `${type}: the ${kind} page prints its zone`);
    }
    const narrow = { ...b, col: 1, row: 1, colSpan: Math.max(1, m.cols - 1), rowSpan: m.rows, on: true }, short = { ...b, col: 1, row: 1, colSpan: m.cols, rowSpan: Math.max(1, m.rows - 2), on: true }, fit = { ...b, col: 1, row: 1, colSpan: m.cols, rowSpan: m.rows, on: true };
    const mk = (blk, kind = 'blank') => ({ v: 2, kind, grid: true, blocks: [blk] });
    if (m.cols > 1) { const p = gridProblems(mk(narrow), 'small'); ok(p.length === 1 && p[0].code === 'puzzle' && /needs at least \d columns so its squares stay big enough to write in; it has \d/.test(p[0].msg), `${type}: too few columns is refused in plain words: ${p[0] && p[0].msg}`); }
    { const p = gridProblems(mk(short), 'small'); ok(p.length === 1 && /needs at least \d+ rows at this width/.test(p[0].msg), `${type}: too few rows is refused in plain words: ${p[0] && p[0].msg}`); }
    ok(gridProblems(mk(fit), 'small').length === 0 && gridProblems(mk(fit), 'letter').length === 0, `${type}: exactly its minimum span fits, at both trims`);
  }
  const bigMaze = autoPlace(normalize({ v: 2, kind: 'notes', grid: true, blocks: [mkb('maze', { size: 20 }), newBlock('body', {}, 'body')] }, 'small', 'notes'), 'small');
  ok(bigMaze.length > 0, 'a 20 x 20 maze plus a Writing space does not fit a Notes page (it needs a blank page): autoPlace says so instead of squeezing it');
  const spreadL = normalize({ v: 2, kind: 'spread', grid: true, blocks: [{ ...mkb('sudoku', { size: 4 }), col: 3, row: 1, colSpan: 3, rowSpan: 12, on: true }, { ...newBlock('body', {}, 'body'), col: 5, row: 1, colSpan: 4, rowSpan: 10, on: true }] }, 'small', 'spread');
  ok(gridProblems(spreadL, 'small').some((p) => /crosses the fold/.test(p.msg)), 'a puzzle across the fold of a spread is refused ("crosses the fold")');
  const half = normalize({ v: 2, kind: 'spread', grid: true, blocks: [{ ...mkb('sudoku', { size: 4 }), col: 1, row: 1, colSpan: 3, rowSpan: 12, on: true }, { ...newBlock('body', {}, 'body'), col: 5, row: 1, colSpan: 4, rowSpan: 10, on: true }] }, 'small', 'spread');
  ok(!gridProblems(half, 'small').some((p) => /fold/.test(p.msg)), 'the same puzzle wholly on one page of a spread is fine');
}
{ // class names: each family has its own prefix and nothing else in the journal folder uses them (a past collision broke a page header while the HTML comparison stayed green)
  const prefixes = ['pzsd', 'pzmz', 'pzcr', 'pzld', 'pznn', 'pzkk', 'pzdd', 'pzx'];
  const mine = fs.readFileSync('puzzles/render2.mjs', 'utf8');
  const classes = new Set([...mine.matchAll(/\b(pz(?:sd|mz|cr|ld|nn|kk|dd|x)[a-z]*)\b/g)].map((m) => m[1]));
  ok(['pzsd', 'pzmz', 'pzcr', 'pzld', 'pznn', 'pzkk', 'pzdd'].every((p) => classes.has(p)) && [...classes].every((c) => prefixes.some((p) => c.startsWith(p))), `class names: ${[...classes].join(' ')}`);
  const files = []; const walk = (d) => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { if (['node_modules', 'out', 'dist', 'private', '.git'].includes(f.name)) continue; const p = path.join(d, f.name); if (f.isDirectory()) walk(p); else if (/\.(mjs|js|css|html|json|sh|py)$/.test(f.name)) files.push(p); } };
  walk('.'); walk('../site'); walk('../studio'); walk('../x4/host');
  const others = files.filter((f) => !/^(\.\/)?puzzles[\\/]render2\.mjs$/.test(f) && !/test-puzzles2\.mjs$/.test(f) && !/i18n[\\/]en\.json$/.test(f));
  const rx = new RegExp(`(?<![A-Za-z0-9_$])(?:${prefixes.join('|')})[a-z]*(?![A-Za-z0-9_$])`);
  const hits = others.filter((f) => rx.test(fs.readFileSync(f, 'utf8')) && !/(daypage\.mjs)$/.test(f));
  ok(hits.length === 0, 'the puzzle class names (pzsd pzmz pzcr pzld pznn pzkk pzdd pzx...) are used in no other file' + (hits.length ? ': ' + hits.join(', ') : ''));
  const dp = fs.readFileSync('daypage.mjs', 'utf8'); ok(!rx.test(dp.replace(/pzx[A-Z]\w*|PZX_\w+/g, '')), 'daypage.mjs holds no puzzle class names, only calls into puzzles/render2.mjs');
  const old = fs.readFileSync('puzzles/render.mjs', 'utf8'); ok(!rx.test(old), 'the word search and crossword code uses none of the new prefixes (pzg pzr pzw pzc pzcw stay theirs)');
  const html0 = dayBlocks({ header: '', routines: [] }, normalize({ v: 2 }), { size: 'small' }); ok(!/pzx|pzsd|data-zone="(sudoku|maze)"/.test(html0), 'the default day page has no puzzle markup (the default build is checked byte for byte by check-identical.mjs)');
}

// ---- 10. the pack kind ----
ok(KINDS.puzzles.validate({ quotes: [{ id: 'q', title: 'Q', items: [{ text: 'A quiet evening is a gift to yourself.' }] }] }).errors.length === 0, 'a pack with only quotes is valid');
for (const p of ['packs/puzzles-sample', 'packs/_template/puzzles']) { const c = checkPack(p); ok(c.errors.length === 0, `${p} passes its own check: ${c.errors}`); }
{
  const v = (items, extra = {}) => KINDS.puzzles.validate({ quotes: [{ id: 'a', title: 'A', items, ...extra }] }).errors.join(' | '), t = (text) => [{ text }];
  ok(/15 to 110 characters/.test(v(t('Too short'))) && /15 to 110 characters/.test(v(t('x'.repeat(111)))) && /15 to 110/.test(v([{}])), 'quotes: 15 to 110 characters');
  ok(/letters, spaces and/.test(v(t('Numbers like 42 are not allowed in boxes'))) && /letters, spaces and/.test(v(t('Emoji ☀ are not allowed either, sorry'))), 'quotes: only letters and simple marks');
  ok(/twice/.test(v([{ text: 'The same sentence appears here.' }, { text: 'the same sentence appears here.' }])) && /lowercase with dashes/.test(v(t('A fine sentence about quiet.'), { id: 'Bad Id' })), 'quotes: no sentence twice, list ids are slugs');
  const pk = readPart('puzzles-sample', 'puzzles'); ok(Object.keys(pk.quotes).join() === 'evenings' && pk.quotes.evenings.items.length >= 12 && Object.keys(pk.lists).join() === 'seasons,library', 'the sample pack reads as lists and quotes');
  const all = pk.quotes.evenings.items; ok(all.every((q) => pzCrLetters(pzCrClean(q)) >= 12 && q.length <= 110) && new Set([...all, ...allQuotes.map((x) => x[1])].map((x) => x.toLowerCase())).size === all.length + allQuotes.length, 'the pack quotes are original sentences and not the built-in ones');
}

if (process.env.PZ_QUICK) { console.log(`test-puzzles2 (quick, no builds): ${n} checks ok`); process.exit(0); }
// ---- 11. builds ----
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'kw-puzzles2-'));
process.on('exit', () => fs.rmSync(TMP, { recursive: true, force: true }));
const ROOT = 'out/puzzles2-test';
fs.rmSync(ROOT, { recursive: true, force: true });
const run = (s, a, env) => execFileSync('node', [s, ...a], { env, stdio: 'pipe' }).toString();
const pdfName = { small: 'keeping-watch-2026-10-interior-5.5x8.5.pdf', letter: 'keeping-watch-2026-10-interior-8.5x11.pdf' };
const buildDay = (tag, blocks, size, print) => {
  const L = normalize({ v: 2, ...(print ? { print } : {}), blocks: [...blocks.map(([t, o], i) => newBlock(t, o, t + i)), newBlock('body', {}, 'body')] }), f = path.join(TMP, `${tag}.json`);
  fs.writeFileSync(f, JSON.stringify(L));
  const out = `${ROOT}/${tag}`, env = { ...process.env, KW_OUT: out, KW_DAYFILE: f, SIZE: size }, dir = size === 'letter' ? 'm2026-10-letter' : 'm2026-10';
  run('render.mjs', ['month', '2026-10', 'test.ics'], env);
  const gate = run('check.mjs', [dir], env); ok(/\[\] 0/.test(gate), `${tag} (${size}): every page passes check.mjs ("[] 0")`);
  const fonts = execFileSync('pdffonts', [`${out}/${dir}/${pdfName[size]}`]).toString(); ok(!/Type 3/i.test(fonts) && /Inter/.test(fonts), `${tag} (${size}): no Type 3 fonts in the PDF`);
  const lay = JSON.parse(fs.readFileSync(`${out}/${dir}/layout.json`, 'utf8')), days = lay.pages.filter((p) => p.type === 'dayp');
  return { days, html: fs.readFileSync(`${out}/${dir}/journal.html`, 'utf8') };
};
const GROUPS = { sudoku: [['sudoku', { size: 9, difficulty: 'medium' }]], sudokuSmall: [['sudoku', { size: 6 }]], maze: [['maze', { size: 10 }]], cryptogram: [['cryptogram', { hint: true, freq: true }]], ladder: [['wordladder', { steps: 5, hint: true }]], nonogram: [['nonogram', { size: 8 }]], kakuro: [['kakuro', { size: 6 }]], dots: [['dottodot', { detail: 3 }]] };
for (const size of ['small', 'letter']) for (const [tag, blocks] of Object.entries(GROUPS)) {
  const r = buildDay(`${tag}-${size}`, blocks, size), type = blocks[0][0];
  ok(r.days.length === 31 && r.days.every((p) => p.zones.some((x) => x.zone === type && x.w > 20 && x.h > 20)), `${tag} (${size}): all 31 day pages map the ${type} zone in layout.json`);
  ok(new Set([...r.html.matchAll(/<desc id="[^"]+">([^<]{20,})/g)].map((m) => m[1]).filter((d) => /^(Sudoku|Maze|Cryptogram|Word ladder|Nonogram|Kakuro|Dot to dot)/.test(d))).size >= (type === 'wordladder' || type === 'dottodot' ? 20 : 28), `${tag} (${size}): the month's puzzles differ day to day`);
}
buildDay('print-options', [['nonogram', { size: 10, big: true }]], 'small', { large: true, contrast: true });
buildDay('print-options-ladder', [['wordladder', { steps: 6, big: true, hint: true }]], 'letter', { large: true, contrast: true });
buildDay('print-options-sudoku', [['sudoku', { size: 9, big: true }]], 'small', { large: true, contrast: true });
buildDay('print-options-crypto', [['cryptogram', { big: true, hint: true, freq: true }]], 'letter', { large: true, contrast: true });
buildDay('answers', [['sudoku', { size: 6, answers: true }]], 'small');

// the big ones on a blank page, Notes and Collection pages (a book with edited block pages)
{
  const { DEFAULT_BOOK, validateBook } = await import('./book.mjs'), { addEntry, setLayout } = await import('./bookedit.mjs'), { catalog } = await import('./editor/samples.mjs'), { libraryFromProfile } = await import('./library.mjs'), { PROFILE } = await import('./profile.mjs');
  const cat = await catalog('2026-10', DEFAULT_BOOK), must = (r) => { assert.ok(r.book, r.err); return r.book; };
  const grid = (kind, blocks) => { const L = normalize({ v: 2, kind, grid: true, blocks }, 'small', kind), dropped = autoPlace(L, 'small'); assert.equal(dropped.length, 0, `${kind}: ${blocks.map((b) => b.type)} place`); const p = normalize(L, 'small', kind); assert.deepEqual(gridProblems(p, 'small'), []); assert.deepEqual(gridProblems(p, 'letter'), []); return p; };
  let book = must(addEntry(DEFAULT_BOOK, cat, null, 'blank', { before: 'theme' }, {}));
  book = must(addEntry(book, cat, null, 'notes', { before: 'theme' }, { title: 'Puzzle notes' }));
  book = must(addEntry(book, cat, null, 'collection', { before: 'theme' }, { title: 'Puzzle corner' }));
  book = must(addEntry(book, cat, null, 'blank', { before: 'theme' }, {}));
  book = must(addEntry(book, cat, null, 'blank', { before: 'theme' }, {}));
  const ids = Object.keys(book.default.reduce((a, e) => a, {})).length; // (placeholder: the new pages are found by id below)
  const pages = [];
  for (const e of book.default) pages.push(e);
  const added = []; (function find(es) { for (const e of es) { if (['blank', 'notes', 'collection'].includes(e.type) || /^(blank|notes|collection)_?\d*$/.test(e.id || '')) added.push(e); if (Array.isArray(e.options && e.options.week)) find(e.options.week); } })(book.default);
  const idsOf = added.map((e) => e.id || e.type);
  const wants = { blank: [[mkb('maze', { size: 20, answers: false }, 'mz')], [mkb('nonogram', { size: 15 }, 'nn')], [mkb('sudoku', { size: 9 }, 'sd'), mkb('kakuro', { size: 5 }, 'kk')]], notes: [[mkb('wordladder', { steps: 5 }, 'wl'), mkb('dottodot', {}, 'dd')]], collection: [[mkb('cryptogram', { freq: true }, 'cr')]] };
  const used = {};
  for (const e of added) {
    const kind = e.type === 'blank' || /^blank/.test(e.id || '') ? 'blank' : /^notes/.test(e.id || '') || e.type === 'notes' ? 'notes' : 'collection', k = used[kind] = (used[kind] || 0);
    const set = (wants[kind] || [])[k]; used[kind]++;
    if (!set) continue;
    const blocks = kind === 'blank' ? set : [...set, newBlock('body', {}, 'body')];
    book = must(setLayout(book, cat, null, e.id, grid(kind, blocks)));
  }
  ok(validateBook(book).length === 0, 'a book with puzzle pages validates');
  const lib = libraryFromProfile(PROFILE); lib.layouts = [{ id: 'mine', name: 'Puzzle pages', book }]; lib.books[0].layoutRef = 'mine';
  const file = path.join(TMP, 'library.json'); fs.writeFileSync(file, JSON.stringify(lib));
  for (const size of ['small', 'letter']) {
    const out = `${ROOT}/pages-${size}`, env = { ...process.env, KW_OUT: out, KW_LIBRARY: file, SIZE: size }, dir = size === 'letter' ? 'm2026-10-letter' : 'm2026-10';
    run('render.mjs', ['month', '2026-10', 'test.ics'], env);
    ok(/\[\] 0/.test(run('check.mjs', [dir], env)), `puzzle blank, Notes and Collection pages (${size}): every page passes check.mjs ("[] 0")`);
    const lay = JSON.parse(fs.readFileSync(`${out}/${dir}/layout.json`, 'utf8')), zones = lay.pages.flatMap((p) => p.zones.map((z) => z.zone));
    ok(['maze', 'nonogram', 'sudoku', 'kakuro', 'wordladder', 'dottodot', 'cryptogram'].every((z) => zones.includes(z)), `puzzle pages (${size}): layout.json maps a zone for every puzzle (${zones.filter((z) => /maze|nonogram|sudoku|kakuro|wordladder|dottodot|cryptogram/.test(z)).join(', ')})`);
    ok(!/Type 3/i.test(execFileSync('pdffonts', [`${out}/${dir}/${pdfName[size]}`]).toString()), `puzzle pages (${size}): no Type 3 fonts`);
  }
}
console.log(`test-puzzles2: ${n} checks ok (+ ${sdCount} sudokus, ${mzCount} mazes, ${ldCount} ladders, ${nnCount} nonograms, ${kkCount} kakuros)`);
