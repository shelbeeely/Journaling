// Puzzles P2: draws the sudoku, maze, cryptogram, word ladder, nonogram, kakuro and dot to dot blocks as print-safe SVG plus a line of instructions.
//   pzxBlock(b, key, { answers, cols }) -> { label, body, alt }   body = the HTML inside the block (the drawing, and the instructions beside or under it)
//   pzxMin(b) -> [columns, inches]   the least room the block needs (daypage.mjs minSpan); pzxFit(b, cols, rows, size, name) -> a plain reason or null
// Rules every drawing follows: vector only (no raster, filter or mask), every stroke 1 px (0.75 pt) or more, letters are real text in Inter (never Type 3),
// role="img" with a <title> and <desc> (the puzzle read out; the solution ONLY when answers are shown), and nothing outside the block's own cell.
// The drawing's size depends on the block's options and never on how wide the block is, so a wider block is never taller than the minimum says.
// Each family has its own class prefix (pzsd pzmz pzcr pzld pznn pzkk pzdd) and shares pzx; test-puzzles2.mjs proves no other file uses them.
// Pure: no fs, no DOM. Names start with pzx because the editor build inlines this file.
import { generateSudoku, PZ_SD_BOX } from './sudoku.mjs';
import { generateMaze, pzMzWalls, pzMzRoute, PZ_MZ_MIN, PZ_MZ_MAX } from './maze.mjs';
import { generateCryptogram, pzCrWrap, pzCrPick, pzCrClean, pzCrLetters, PZ_CR_MIN_LETTERS, PZ_CR_MAX } from './cipher.mjs';
import { generateLadder, pzLdChanges } from './ladder.mjs';
import { generateNonogram, PZ_NN_MIN, PZ_NN_MAX } from './nonogram.mjs';
import { generateKakuro } from './kakuro.mjs';
import { generateDots, pzDdLabels } from './dots.mjs';
import { PZ_SAMPLE_QUOTES, PZ_QUOTE_IDS } from './samples2.mjs';
import { pzPackQuotes } from './render.mjs';

export const PZX_TYPES = ['sudoku', 'maze', 'cryptogram', 'wordladder', 'nonogram', 'kakuro', 'dottodot'];
export const pzxIs = (t) => PZX_TYPES.includes(t);
export const PZX_STROKE = 1.1;          // px = 0.8 pt: the floor is 0.75 pt = 1 px
export const PZX_GAP = 8, PZX_CHROME = 30, PZX_SIDE_MIN = 76; // px: grid to text gap, the label row and padding, the narrowest side column
export const PZX_MAZE_CORRIDOR_MM = 3.5; // a maze corridor is never narrower than this on paper (small trim: 1 px = 0.26 mm)
const pzxEsc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const pzxW = (cols) => cols * 84.8 - 8;  // the width of 1 to 4 grid columns in px (a column is 76.8 px, a gap 8 px: the small trim, narrowest; the letter trim is the same in CSS px)
const pzxNeed = (px) => { for (let c = 1; c <= 4; c++) if (pzxW(c) >= px + 0.5) return c; return 4; };
const pzxHash = (s) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
const pzxMemo = new Map();
const pzxCached = (key, make) => { if (!pzxMemo.has(key)) { if (pzxMemo.size > 300) pzxMemo.clear(); pzxMemo.set(key, make()); } return pzxMemo.get(key); };
const pzxOpen = (w, h, id, title, desc) => `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-labelledby="${id}t ${id}d" font-family="Inter, sans-serif"><title id="${id}t">${pzxEsc(title)}</title><desc id="${id}d">${pzxEsc(desc)}</desc>`;
const pzxN = (x) => +x.toFixed(1);
const pzxLevel = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

// ---------- the sources of text ----------
function pzxQuoteList(b) { // { title, items } for the cryptogram
  const ok = (t) => { const c = pzCrClean(t); return pzCrLetters(c) >= PZ_CR_MIN_LETTERS && c.length <= PZ_CR_MAX; };
  if (b.source === 'custom') { const own = (b.words || []).filter(ok); if (own.length) return { title: '', items: own }; }
  if (b.source === 'pack') { const q = pzPackQuotes(), ids = Object.keys(q); if (ids.length) { const l = q[b.theme] || q[ids[0]]; return { title: l.title, items: l.items.filter(ok) }; } }
  const l = PZ_SAMPLE_QUOTES[b.theme] || PZ_SAMPLE_QUOTES[PZ_QUOTE_IDS[0]];
  return { title: l.title, items: l.items };
}
const pzxLadderPair = (b) => { // the person's own "start-end", if they typed one
  const m = b.source === 'custom' && (b.words || []).map((t) => /^\s*([A-Za-z]{3,5})\s*[-=>: ]+\s*([A-Za-z]{3,5})\s*$/.exec(t)).find(Boolean);
  return m ? { start: m[1], end: m[2] } : null;
};
const pzxLadder = (b, key) => pzxCached(`ld|${b.length}|${b.steps}|${key}|${JSON.stringify(pzxLadderPair(b))}`, () => generateLadder({ length: b.length, steps: b.steps, seed: key, ...(pzxLadderPair(b) || {}) }));

// ---------- plans: the size of each drawing (from the options only) and its instructions ----------
const pzxPlan = {
  sudoku(b) {
    const n = +b.size, cell = n === 9 ? 26 : n === 6 ? (b.big ? 38 : 34) : (b.big ? 44 : 38), [br, bc] = PZ_SD_BOX[n] || PZ_SD_BOX[9];
    return { gw: n * cell + 3, gh: n * cell + 3, cell, text: [`Fill every row, column and ${br} × ${bc} box with 1 to ${n}, once each.`] };
  },
  maze(b) {
    const n = +b.size, cell = Math.min(b.big ? 30 : 26, Math.floor(331 / n));
    return { gw: n * cell + 4, gh: n * cell + 4, cell, text: [`<svg class="pzxk" width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><circle cx="5" cy="5" r="3.4" fill="#000"/></svg> Start at the top left. <svg class="pzxk" width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><circle cx="5" cy="5" r="3.6" fill="none" stroke="#000" stroke-width="1.2"/><circle cx="5" cy="5" r="1.4" fill="#000"/></svg> Finish at the bottom right.`, 'Trace the one way through with your pen.'] };
  },
  cryptogram(b) {
    const big = !!b.big, slot = big ? 19 : 16, per = Math.floor(331 / slot), lineH = big ? 42 : 36;
    const lines = Math.max(...pzxQuoteList(b).items.map((t) => pzCrWrap(pzCrClean(t), per).length), 1);
    return { gw: 331, gh: lines * lineH + (b.freq ? 62 : 0), slot, per, lineH, text: ['Each coded letter stands for one other letter, always the same one, and never for itself.', ...(b.freq ? ['Common in English: E T A O I N S H R.'] : []), ...(b.hint ? ['Hint: every X is a Y.'] : [])] };
  },
  wordladder(b) {
    const L = +b.length, bw = b.big ? 24 : 20, pitch = b.big ? 30 : 25, pair = pzxLadderPair(b);
    let steps = +b.steps; if (pair) { try { steps = generateLadder({ ...pair }).steps; } catch (e) { /* falls back to the built-in pair */ } }
    steps = Math.max(2, Math.min(8, Math.max(steps, pair ? steps : 0)));
    return { gw: L * (bw + 3) + 3, gh: (steps + 1) * pitch, bw, pitch, L, text: ['Change one letter at a time to turn START into END in 8 steps. Every rung is a word.', ...(b.hint ? ['The thick line marks the letter that changes.'] : [])] };
  },
  nonogram(b) {
    const n = +b.size, per = Math.ceil(n / 2), rw = per * (n >= 10 ? 8.4 : 7) + 4, ch = per * (b.big ? 11 : 9.6) + 4, cell = Math.min(b.big ? 28 : 24, Math.floor((331 - rw) / n));
    return { gw: rw + n * cell + 2, gh: ch + n * cell + 2, cell, rw, ch, text: ['The numbers give the runs of filled squares in each row and column, in order, with at least one gap between runs. Fill squares to find the picture.'] };
  },
  kakuro(b) {
    const n = +b.size, cell = b.big ? 36 : 32;
    return { gw: n * cell + 3, gh: n * cell + 3, cell, text: ['Put 1 to 9 in the white squares. Each run adds up to the number in its clue square, and no digit repeats in a run.'] };
  },
  dottodot(b) {
    const S = b.big ? 232 : 208;
    return { gw: S, gh: S, S, text: ['Join the dots in order, 1 upward, then close the shape by going back to 1.'] };
  },
};
const pzxLines = (plan, w, big) => plan.text.reduce((s, t) => s + Math.max(1, Math.ceil((t.replace(/<[^>]+>/g, '').length * (big ? 5.7 : 4.6)) / w)), 0);
// How the block lays out in `cols` columns: beside its text when there is room, else the text under it. Returns { side, h (px) }.
function pzxFlow(plan, cols, big) {
  const avail = pzxW(cols), sideW = avail - plan.gw - PZX_GAP, side = sideW >= PZX_SIDE_MIN, lh = big ? 13 : 11;
  const th = pzxLines(plan, side ? sideW : avail, big) * lh + plan.text.length * 2;
  return { side, h: side ? Math.max(plan.gh, th) : plan.gh + 4 + th };
}
export function pzxMin(b) {
  const plan = pzxPlan[b.type](b), cols = pzxNeed(plan.gw);
  return [cols, (PZX_CHROME + pzxFlow(plan, cols, !!b.big).h + 3) / 96];
}
const pzxDescribe = (b) => ({ sudoku: `${b.size} × ${b.size} sudoku`, maze: `${b.size} × ${b.size} maze`, cryptogram: 'cryptogram', wordladder: 'word ladder', nonogram: `${b.size} × ${b.size} nonogram`, kakuro: 'kakuro', dottodot: 'dot to dot' })[b.type];
// Why a block does not fit its place on the grid, in plain words (null when it fits). `rowIn` = the grid row in inches.
export function pzxFit(b, cols, rows, size, name, rowIn = 0.22) {
  const plan = pzxPlan[b.type](b), [needCols, h] = pzxMin(b), needRows = Math.max(1, Math.ceil((h + 0.02) / rowIn));
  if (b.type === 'maze' && ((plan.cell - 1.6) * 0.2646) < PZX_MAZE_CORRIDOR_MM) return `${name}: a ${b.size} × ${b.size} maze would have corridors under ${PZX_MAZE_CORRIDOR_MM} mm wide, too narrow to trace with a pen. Choose a smaller maze.`;
  if (cols < needCols) return `${name} (${pzxDescribe(b)}) needs at least ${needCols} columns so its squares stay big enough to write in; it has ${cols}.`;
  if (rows < needRows) return `${name} (${pzxDescribe(b)}) needs at least ${needRows} rows at this width to fit its drawing and instructions; it has ${rows}.`;
  return null;
}

// ---------- drawings ----------
const pzxLine = (x1, y1, x2, y2, w) => `<line x1="${pzxN(x1)}" y1="${pzxN(y1)}" x2="${pzxN(x2)}" y2="${pzxN(y2)}" stroke="#000" stroke-width="${w}"/>`;
const pzxText = (x, y, size, t, o = '') => `<text x="${pzxN(x)}" y="${pzxN(y)}" font-size="${pzxN(size)}" text-anchor="middle" ${o}>${pzxEsc(t)}</text>`;

function pzxSudokuSvg(sd, plan, answers, id, title) {
  const n = sd.size, c = plan.cell, o = 1.5, fs = c * (n === 9 ? 0.6 : 0.58);
  const read = (rows, tag) => rows.map((r, i) => `${tag} ${i + 1}: ${[...r].map((d) => (d === '.' ? 'blank' : d)).join(' ')}.`).join(' ');
  let s = pzxOpen(plan.gw, plan.gh, id, title, `Sudoku, ${n} by ${n}, boxes ${sd.boxRows} rows by ${sd.boxCols} columns, ${sd.givens} numbers given. ${read(sd.puzzle, 'Row')}${answers ? ' Solution. ' + read(sd.solution, 'Row') : ''}`);
  s += `<rect x="${o}" y="${o}" width="${n * c}" height="${n * c}" fill="#fff" stroke="#000" stroke-width="2.4"/>`;
  for (let i = 1; i < n; i++) {
    s += pzxLine(o + i * c, o, o + i * c, o + n * c, i % sd.boxCols ? PZX_STROKE : 2.4) + pzxLine(o, o + i * c, o + n * c, o + i * c, i % sd.boxRows ? PZX_STROKE : 2.4);
  }
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const g = sd.puzzle[y][x];
    if (g !== '.') s += pzxText(o + (x + 0.5) * c, o + (y + 0.5) * c + fs * 0.35, fs, g, 'font-weight="700" fill="#000"');
    else if (answers) s += pzxText(o + (x + 0.5) * c, o + (y + 0.5) * c + fs * 0.35, fs, sd.solution[y][x], 'font-weight="400" fill="#555"');
  }
  return s + '</svg>';
}

function pzxMazeSvg(m, plan, answers, id, title) {
  const n = m.n, c = plan.cell, o = 2, W = 1.6;
  let s = pzxOpen(plan.gw, plan.gh, id, title, `Maze, ${n} by ${n} squares. Start in the top left, finish in the bottom right. There is exactly one way through.${answers ? ' The way through: ' + pzMzRoute(m) + '.' : ''}`);
  const ctr = (i) => [o + (i % n + 0.5) * c, o + (Math.floor(i / n) + 0.5) * c];
  if (answers) s += `<polyline points="${m.path.map((i) => ctr(i).map(pzxN).join(',')).join(' ')}" fill="none" stroke="#8a8a8a" stroke-width="${pzxN(Math.max(3, c * 0.2))}" stroke-linecap="round" stroke-linejoin="round"/>`;
  s += `<path d="${pzMzWalls(m).map(([x1, y1, x2, y2]) => `M${pzxN(o + x1 * c)} ${pzxN(o + y1 * c)}L${pzxN(o + x2 * c)} ${pzxN(o + y2 * c)}`).join('')}" fill="none" stroke="#000" stroke-width="${W}" stroke-linecap="round"/>`;
  const [sx, sy] = ctr(m.start), [fx, fy] = ctr(m.finish);
  s += `<circle cx="${pzxN(sx)}" cy="${pzxN(sy)}" r="${pzxN(c * 0.22)}" fill="#000"/>`;
  s += `<circle cx="${pzxN(fx)}" cy="${pzxN(fy)}" r="${pzxN(c * 0.28)}" fill="none" stroke="#000" stroke-width="${W}"/><circle cx="${pzxN(fx)}" cy="${pzxN(fy)}" r="${pzxN(c * 0.1)}" fill="#000"/>`;
  return s + '</svg>';
}

function pzxCryptoSvg(cg, plan, b, answers, id, title) {
  const big = !!b.big, bw = big ? 17 : 14, bh = big ? 21 : 17, slot = plan.slot, fsC = big ? 12 : 10.5, fsA = big ? 13.5 : 12, pw = 6;
  const lines = pzCrWrap(cg.cipher, plan.per), plainLines = pzCrWrap(cg.plain, plan.per);
  const hint = b.hint && cg.hint ? cg.hint : null;
  const H = lines.length * plan.lineH + (b.freq ? 62 : 0);
  let s = pzxOpen(plan.gw, H, id, title, `Cryptogram. The coded sentence is: ${cg.cipher}${hint ? ` Hint: every ${hint.cipher} stands for ${hint.plain}.` : ''}${answers ? ` Answer: ${cg.plain}` : ''}`);
  lines.forEach((words, li) => {
    const y0 = li * plan.lineH;
    let x = 1;
    words.forEach((w, wi) => {
      [...w].forEach((ch, k) => {
        if (/[A-Z]/.test(ch)) {
          const pl = plainLines[li][wi][k], cx = x + bw / 2;
          s += pzxText(cx, y0 + fsC, fsC, ch, 'font-weight="600" fill="#000"');
          s += `<rect x="${pzxN(x)}" y="${y0 + fsC + 3}" width="${bw}" height="${bh}" fill="#fff" stroke="#000" stroke-width="${PZX_STROKE}"/>`;
          if (answers) s += pzxText(cx, y0 + fsC + 3 + bh * 0.75, fsA, pl, 'font-weight="600" fill="#000"');
          else if (hint && pl === hint.plain) s += pzxText(cx, y0 + fsC + 3 + bh * 0.75, fsA, pl, 'font-weight="400" fill="#555"');
          x += slot;
        } else { s += pzxText(x + pw / 2 - 1, y0 + fsC + 3 + bh * 0.85, fsC + 1, ch, 'font-weight="700" fill="#000"'); x += pw + 2; }
      });
      x += slot * 0.6;
    });
  });
  if (b.freq) { // the helper strip: how many times each coded letter appears (2 rows of 13)
    const y0 = lines.length * plan.lineH + 4, cw = 331 / 13;
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').forEach((L, i) => {
      const x = (i % 13) * cw, y = y0 + Math.floor(i / 13) * 28;
      s += `<rect x="${pzxN(x + 1)}" y="${y}" width="${pzxN(cw - 2)}" height="26" fill="#fff" stroke="#000" stroke-width="${PZX_STROKE}"/>`;
      s += pzxText(x + cw / 2, y + 11, big ? 10.5 : 9.5, L, 'font-weight="700" fill="#000"') + pzxText(x + cw / 2, y + 22, big ? 10.5 : 9.5, String(cg.counts[L] || 0), 'font-weight="400" fill="#000"');
    });
  }
  return s + '</svg>';
}

function pzxLadderSvg(ld, plan, b, answers, id, title) {
  const { bw, pitch, L } = plan, rows = ld.words.length, pad = 1.5, ch = b.hint ? pzLdChanges(ld.words) : [];
  const H = (plan.gh), fs = bw * 0.7;
  let s = pzxOpen(plan.gw, H, id, title, `Word ladder. Start word ${ld.words[0].toUpperCase()}, end word ${ld.words[rows - 1].toUpperCase()}, ${ld.steps} steps, so ${rows - 2} blank rungs in between.${answers ? ' One answer: ' + ld.words.join(', ').toUpperCase() + '. Other ladders may also be right.' : ''}`);
  ld.words.forEach((w, r) => {
    const fixed = r === 0 || r === rows - 1, y = pad + r * pitch;
    for (let k = 0; k < L; k++) {
      const x = pad + k * (bw + 3);
      s += `<rect x="${x}" y="${y}" width="${bw}" height="${bw}" fill="#fff" stroke="#000" stroke-width="${PZX_STROKE}"/>`;
      if (fixed || answers) s += pzxText(x + bw / 2, y + bw * 0.74, fs, w[k].toUpperCase(), `font-weight="${fixed ? 700 : 400}" fill="${fixed ? '#000' : '#555'}"`);
      if (b.hint && r > 0 && ch[r - 1] === k) s += pzxLine(x, y - 1.2, x + bw, y - 1.2, 2.4);
    }
  });
  return s + '</svg>';
}

function pzxNonoSvg(nn, plan, b, answers, id, title) {
  const n = nn.n, c = plan.cell, fs = b.big ? 10.5 : 9, per = Math.max(...nn.rowClues.map((a) => a.length)), perC = Math.max(...nn.colClues.map((a) => a.length));
  const ox = Math.min(plan.rw, per * (n >= 10 ? 8.4 : 7) + 4), oy = Math.min(plan.ch, perC * (b.big ? 11 : 9.6) + 4);
  const clueTxt = (a) => (a.length === 1 && a[0] === 0 ? '0' : a.join(' '));
  let s = pzxOpen(ox + n * c + 2, oy + n * c + 2, id, title, `Nonogram, ${n} by ${n}. Row clues, top to bottom: ${nn.rowClues.map(clueTxt).join('; ')}. Column clues, left to right: ${nn.colClues.map(clueTxt).join('; ')}.${answers ? ' Solution rows, # filled: ' + nn.rows.join(' ') : ''}`);
  if (answers) nn.rows.forEach((row, y) => { for (let x = 0; x < n; x++) if (row[x] === '#') s += `<rect x="${ox + x * c + 1}" y="${oy + y * c + 1}" width="${c - 2}" height="${c - 2}" fill="#000"/>`; });
  for (let i = 0; i <= n; i++) {
    const w = i % 5 === 0 ? 1.8 : PZX_STROKE;
    s += pzxLine(ox + i * c, oy, ox + i * c, oy + n * c, w) + pzxLine(ox, oy + i * c, ox + n * c, oy + i * c, w);
  }
  nn.rowClues.forEach((cl, y) => { s += `<text x="${ox - 4}" y="${pzxN(oy + (y + 0.5) * c + fs * 0.36)}" font-size="${fs}" font-weight="600" text-anchor="end" fill="#000">${cl.join('\u2002')}</text>`; });
  nn.colClues.forEach((cl, x) => cl.forEach((v, k) => { s += pzxText(ox + (x + 0.5) * c, oy - 3 - (cl.length - 1 - k) * (fs + 1.2), fs, String(v), 'font-weight="600" fill="#000"'); }));
  return s + '</svg>';
}

function pzxKakuroSvg(kk, plan, answers, id, title) {
  const n = kk.n, c = plan.cell, o = 1.5, fs = c * 0.5, nf = c * 0.29;
  const clueWords = kk.clues.map((q) => `row ${q.y + 1} column ${q.x + 1}: ${[q.across ? 'across ' + q.across : '', q.down ? 'down ' + q.down : ''].filter(Boolean).join(', ')}`).join('; ');
  let s = pzxOpen(plan.gw, plan.gh, id, title, `Kakuro, ${n} by ${n} including the clue row and column. Clue squares: ${clueWords}.${answers ? ' Solution rows: ' + kk.solution.map((r) => [...r].map((d) => (d === '#' ? 'black' : d)).join(' ')).join('; ') + '.' : ''}`);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const px = o + x * c, py = o + y * c;
    if (kk.cells[y][x] === '.') {
      s += `<rect x="${px}" y="${py}" width="${c}" height="${c}" fill="#fff" stroke="#000" stroke-width="${PZX_STROKE}"/>`;
      if (answers) s += pzxText(px + c / 2, py + c / 2 + fs * 0.35, fs, kk.solution[y][x], 'font-weight="600" fill="#000"');
    } else {
      s += `<rect x="${px}" y="${py}" width="${c}" height="${c}" fill="#c9c9c9" stroke="#000" stroke-width="${PZX_STROKE}"/>`;
      const q = kk.clues.find((u) => u.y === y && u.x === x);
      if (q) {
        s += pzxLine(px, py, px + c, py + c, PZX_STROKE);
        if (q.across) s += pzxText(px + c * 0.72, py + c * 0.4, nf, String(q.across), 'font-weight="700" fill="#000"');
        if (q.down) s += pzxText(px + c * 0.28, py + c * 0.88, nf, String(q.down), 'font-weight="700" fill="#000"');
      }
    }
  }
  return s + '</svg>';
}

function pzxDotsSvg(dd, plan, b, answers, id, title) {
  const S = plan.S, pad = 16, k = (S - pad * 2) / 100, fs = b.big ? 10.5 : 9;
  let s = pzxOpen(S, S, id, title, `Dot to dot with ${dd.n} numbered dots. Join them in order from 1 to ${dd.n}, then back to 1.${answers ? ' The picture is ' + dd.name + '.' : ''}`);
  const P = dd.points.map(([x, y]) => [pad + x * k, pad + y * k]);
  if (answers) s += `<polygon points="${P.map((p) => p.map(pzxN).join(',')).join(' ')}" fill="none" stroke="#777" stroke-width="1.4" stroke-linejoin="round"/>`;
  P.forEach(([x, y]) => { s += `<circle cx="${pzxN(x)}" cy="${pzxN(y)}" r="2.3" fill="#000"/>`; });
  pzDdLabels(dd.points, 7.2).forEach(([lx, ly], i) => { s += pzxText(pad + lx * k, pad + ly * k + fs * 0.35, fs, String(i + 1), 'font-weight="600" fill="#000"'); });
  return s + '</svg>';
}

// ---------- the block ----------
const pzxTitle = { sudoku: 'Sudoku', maze: 'Maze', cryptogram: 'Cryptogram', wordladder: 'Word ladder', nonogram: 'Nonogram', kakuro: 'Kakuro', dottodot: 'Dot to dot' };
export function pzxBlock(b, key, opt = {}) {
  const answers = opt.answers !== undefined ? opt.answers : !!b.answers, cols = Math.max(1, Math.min(4, opt.cols || 4)), big = !!b.big;
  const name = b.title || pzxTitle[b.type], plan = pzxPlan[b.type](b), id = 'pzx' + pzxHash(`${key}|${b.type}|${answers ? 'a' : ''}`);
  let svg, label = name, text = plan.text.slice();
  const seed = key + '|' + (b.seed || '');
  if (b.type === 'sudoku') {
    const sd = pzxCached(`sd|${b.size}|${b.difficulty}|${seed}`, () => generateSudoku({ size: +b.size, difficulty: b.difficulty, seed }));
    svg = pzxSudokuSvg(sd, plan, answers, id, name); label = `${name} · ${b.size} × ${b.size} · ${pzxLevel[sd.difficulty]}`;
  } else if (b.type === 'maze') {
    const m = pzxCached(`mz|${b.size}|${b.style}|${seed}`, () => generateMaze({ size: +b.size, style: b.style, seed }));
    svg = pzxMazeSvg(m, plan, answers, id, name); label = `${name} · ${b.size} × ${b.size}`;
  } else if (b.type === 'cryptogram') {
    const list = pzxQuoteList(b), quote = pzCrPick(list.items, b.length, seed), cg = pzxCached(`cr|${quote}|${seed}`, () => generateCryptogram({ text: quote, seed }));
    svg = pzxCryptoSvg(cg, plan, b, answers, id, name); label = list.title && b.source !== 'custom' ? `${name} · ${list.title}` : name;
    if (b.hint && cg.hint) text[text.length - 1] = (`Hint: every ${cg.hint.cipher} is ${/^[AEIOU]/.test(cg.hint.plain) ? 'an' : 'a'} ${cg.hint.plain}.`);
  } else if (b.type === 'wordladder') {
    const ld = pzxLadder(b, seed);
    svg = pzxLadderSvg(ld, plan, b, answers, id, name); label = `${name} · ${ld.words[0].toUpperCase()} to ${ld.words[ld.words.length - 1].toUpperCase()}`;
    text = [`Change one letter at a time to turn <b>${pzxEsc(ld.words[0].toUpperCase())}</b> into <b>${pzxEsc(ld.words[ld.words.length - 1].toUpperCase())}</b> in ${ld.steps} steps. Every rung is a word.`, ...(b.hint ? ['The thick line marks the letter that changes.'] : [])];
  } else if (b.type === 'nonogram') {
    const nn = pzxCached(`nn|${b.size}|${b.difficulty}|${seed}`, () => generateNonogram({ size: +b.size, difficulty: b.difficulty, seed }));
    svg = pzxNonoSvg(nn, plan, b, answers, id, name); label = `${name} · ${b.size} × ${b.size} · ${pzxLevel[nn.difficulty]}`;
  } else if (b.type === 'kakuro') {
    const kk = pzxCached(`kk|${b.size}|${seed}`, () => generateKakuro({ size: +b.size, seed }));
    svg = pzxKakuroSvg(kk, plan, answers, id, name); label = `${name} · ${b.size - 1} × ${b.size - 1}`;
  } else {
    const dd = generateDots({ shape: b.shape, detail: +b.detail, seed });
    svg = pzxDotsSvg(dd, plan, b, answers, id, name); label = `${name} · ${dd.n} dots`;
    text = [`Join the dots in order, 1 to ${dd.n}, then close the shape by going back to 1.`];
  }
  const side = pzxFlow({ ...plan, text }, cols, big).side;
  return { label, alt: `${name}: ${pzxDescribe(b)}`, body: `<div class="pzxr ${{ sudoku: 'pzsd', maze: 'pzmz', cryptogram: 'pzcr', wordladder: 'pzld', nonogram: 'pznn', kakuro: 'pzkk', dottodot: 'pzdd' }[b.type]}${side ? '' : ' pzxs'}">${svg}<div class="pzxt">${text.map((t) => `<p>${t}</p>`).join('')}</div></div>` };
}

export const PZX_CSS = `
.pzx .pzxr { display: flex; gap: ${PZX_GAP}px; align-items: flex-start; padding-top: 2px; } .pzx .pzxr.pzxs { flex-direction: column; gap: 4px; }
.pzx .pzxr > svg { flex: none; display: block; }
.pzx .pzxt { flex: 1; min-width: 0; font: 400 6.5pt/11px Inter, sans-serif; color: #111; } .pzx .pzxt p { margin: 0 0 2px; } .pzx .pzxt b { font-weight: 700; letter-spacing: 0.3px; }
.pzx .pzxk { display: inline-block; vertical-align: -2px; margin-right: 1px; }
.pzx.big .pzxt { font-size: 8pt; line-height: 13px; }
.pzx .pzcr, .pzx .pzcr.pzxs { gap: 3px; }
`;
