// Puzzle blocks: picks the word list, runs the seeded generator, and draws the puzzle as print-safe SVG plus its text (word list, clues).
//   pzBlock(b, key, { answers }) -> { label, body, alt, hIn }   body = the HTML inside the block (grid SVG + words or clues)
//   pzHeight(b) -> the most height (inches) the block can need, for the grid minimum span (daypage.mjs minSpan)
//   usePuzzlePack(consumed) -> the build gives the profile's puzzles pack lists to the "pack" word list source (the editor never does)
// Print safety: the grid is vector (strokes of 1 px = 0.75 pt or more, no filters, no raster), letters are real text in Inter (the book's own font: no Type 3).
// Text alternative: the SVG has role="img" with a <title> and <desc> (the grid read out in rows; a crossword's answers only when they are shown),
// and the words or clues are plain HTML text next to it. Pure: no fs, no DOM. Names start with pz because the editor build inlines this file.
import { generateWordSearch, pzCells, PZ_WORD_MAX } from './wordsearch.mjs';
import { generateCrossword, pzEntries, pzClueCount } from './crossword.mjs';
import { PZ_SAMPLE_LISTS, PZ_SAMPLE_IDS } from './samples.mjs';

export const PZ_PAGE_W = 331, PZ_GAP = 8; // the day page's content width in px (4 columns, small trim: the narrowest) and the gap between grid and text
export const PZ_SIDE_WS = 84, PZ_SIDE_CW = 120; // the narrowest the text column may get
export const PZ_CHROME = 26; // px: the label row and the block's padding
export const PZ_LH = 11, PZ_CLUE_LH = 10.4; // line heights in px
export const PZ_STROKE = 1.1; // px; 0.75 pt is 1 px
const pzEsc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
let PZ_PACK = null;
export const usePuzzlePack = (c) => { PZ_PACK = c && c.lists ? c : null; };

export const pzCell = (b) => (b.type === 'crossword' ? Math.min(b.big ? 28 : 22, Math.floor((PZ_PAGE_W - PZ_GAP - PZ_SIDE_CW) / b.size)) : Math.min(b.big ? 26 : 20, Math.floor((PZ_PAGE_W - PZ_GAP - PZ_SIDE_WS) / b.size)));

// The most clue lines a crossword block can have: every clue wraps to at most two lines in the text column.
const pzClueBound = (b) => { const n = pzClueCount(b.size, b.difficulty); return n * 2 * PZ_CLUE_LH + n * 1.5 + 30; };
export function pzHeight(b) {
  const grid = b.size * pzCell(b);
  return (PZ_CHROME + (b.type === 'crossword' ? Math.max(grid, pzClueBound(b) * (b.big ? 1.15 : 1)) : grid)) / 96;
}

// ---- the word list ----
const pzPairs = (l) => l.entries.map(([word, clue]) => ({ word, clue }));
function pzList(b) {
  const sample = (id) => { const l = PZ_SAMPLE_LISTS[id] || PZ_SAMPLE_LISTS[PZ_SAMPLE_IDS[0]]; return { title: l.title, entries: pzPairs(l) }; };
  const min = b.type === 'crossword' ? 4 : 3;
  if (b.source === 'custom') {
    const entries = pzEntries((b.words || []).map((t) => { const m = /^([^=:]+)[=:](.*)$/.exec(t); return m ? { word: m[1], clue: m[2] } : { word: t, clue: b.type === 'crossword' ? '' : '-' }; }), b.type === 'crossword' ? b.size : Math.min(b.size, PZ_WORD_MAX));
    if (entries.length >= min) return { title: '', entries };
    return sample(b.theme); // too few usable words (a crossword needs "word=clue"): the sample list rather than an empty puzzle
  }
  if (b.source === 'pack' && PZ_PACK) {
    const l = PZ_PACK.lists[b.theme] || PZ_PACK.lists[Object.keys(PZ_PACK.lists)[0]];
    if (l) return { title: l.title, entries: l.entries };
  }
  return sample(b.theme);
}

// ---- drawing ----
const pzHashId = (s) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
const pzSvgOpen = (w, h, id, title, desc) => `<svg class="pzg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-labelledby="${id}t ${id}d" font-family="Inter, sans-serif"><title id="${id}t">${pzEsc(title)}</title><desc id="${id}d">${pzEsc(desc)}</desc>`;

export function pzWordSearchSvg(ws, cell, answers, id, title) {
  const n = ws.size, G = n * cell, fs = (cell * 0.56).toFixed(1);
  let s = pzSvgOpen(G, G, id, title, `Word search, ${n} letters by ${n}. ${ws.grid.map((r, i) => `Row ${i + 1}: ${r.split('').join(' ')}.`).join(' ')} Find these words: ${ws.words.map((w) => w.word).join(', ')}.${answers ? ' The answers are marked.' : ''}`);
  s += `<rect x="${PZ_STROKE / 2}" y="${PZ_STROKE / 2}" width="${G - PZ_STROKE}" height="${G - PZ_STROKE}" rx="3" fill="#fff" stroke="#000" stroke-width="${PZ_STROKE}"/>`;
  if (answers) for (const p of ws.words) {
    const c = pzCells(p), a = c[0], z = c[c.length - 1];
    s += `<line x1="${(a[1] + 0.5) * cell}" y1="${(a[0] + 0.5) * cell}" x2="${(z[1] + 0.5) * cell}" y2="${(z[0] + 0.5) * cell}" stroke="#cfcfcf" stroke-width="${(cell * 0.78).toFixed(1)}" stroke-linecap="round"/>`;
  }
  ws.grid.forEach((row, y) => { for (let x = 0; x < n; x++) s += `<text x="${((x + 0.5) * cell).toFixed(1)}" y="${((y + 0.5) * cell + cell * 0.2).toFixed(1)}" font-size="${fs}" font-weight="600" text-anchor="middle" fill="#000">${row[x]}</text>`; });
  return s + '</svg>';
}

export function pzCrosswordSvg(cw, cell, answers, id, title) {
  const W = cw.cols * cell, H = cw.rows * cell, nf = Math.max(6.5, cell * 0.3).toFixed(1), fs = (cell * 0.58).toFixed(1), pad = PZ_STROKE / 2;
  const numAt = new Map([...cw.across, ...cw.down].map((e) => [`${e.row},${e.col}`, e.n]));
  let s = pzSvgOpen(W, H, id, title, `Crossword, ${cw.rows} rows by ${cw.cols} columns, ${cw.across.length} clues across and ${cw.down.length} down. The clues are listed next to the grid.${answers ? ' Answers: ' + [...cw.across.map((e) => `${e.n} across ${e.word}`), ...cw.down.map((e) => `${e.n} down ${e.word}`)].join(', ') + '.' : ''}`);
  cw.cells.forEach((row, y) => {
    for (let x = 0; x < cw.cols; x++) {
      if (row[x] === '.') continue;
      s += `<rect x="${x * cell + pad}" y="${y * cell + pad}" width="${cell - PZ_STROKE}" height="${cell - PZ_STROKE}" fill="#fff" stroke="#000" stroke-width="${PZ_STROKE}"/>`;
      const n = numAt.get(`${y},${x}`);
      if (n) s += `<text x="${x * cell + 2.2}" y="${y * cell + 2 + +nf * 0.82}" font-size="${nf}" font-weight="500" fill="#000">${n}</text>`;
      if (answers) s += `<text x="${((x + 0.5) * cell).toFixed(1)}" y="${((y + 0.5) * cell + cell * 0.24).toFixed(1)}" font-size="${fs}" font-weight="600" text-anchor="middle" fill="#000">${row[x]}</text>`;
    }
  });
  return s + '</svg>';
}

// The block: its label and its inside. `key` is the seed text (the page, the block and the puzzle seed: see daypage.mjs pzSeed).
export function pzBlock(b, key, opt = {}) {
  const answers = opt.answers !== undefined ? opt.answers : b.answers, list = pzList(b), cell = pzCell(b), id = 'pz' + pzHashId(key + '|' + b.type + (answers ? 'a' : ''));
  const name = b.title || (b.type === 'crossword' ? 'Crossword' : 'Word search'), label = list.title && b.source !== 'custom' ? `${name} · ${list.title}` : name;
  if (b.type === 'crossword') {
    const cw = generateCrossword({ entries: list.entries, size: b.size, difficulty: b.difficulty, seed: key });
    const clues = (t, es) => `<div class="pzc"><b>${t}</b>${es.map((e) => `<p><i>${e.n}</i><span>${pzEsc(e.clue)}</span></p>`).join('')}</div>`;
    return { label, cw, alt: `${name}: ${cw.across.length} across, ${cw.down.length} down`, body: `${pzCrosswordSvg(cw, cell, answers, id, name)}<div class="pzw pzcw">${clues('Across', cw.across)}${clues('Down', cw.down)}</div>` };
  }
  const ws = generateWordSearch({ words: list.entries.map((e) => e.word), size: b.size, difficulty: b.difficulty, seed: key });
  return { label, ws, alt: `${name}: ${ws.words.length} words to find`, body: `${pzWordSearchSvg(ws, cell, answers, id, name)}<div class="pzw">${ws.words.map((w) => `<span>${w.word}</span>`).join('')}</div>` };
}

export const PZ_CSS = `
.pz .pzr { display: flex; gap: ${PZ_GAP}px; align-items: flex-start; padding-top: 2px; } .pz svg.pzg { flex: none; display: block; }
.pz .pzw { flex: 1; min-width: 0; font: 600 6.5pt/${PZ_LH}px Inter, sans-serif; letter-spacing: 0.3px; color: #111; } .pz .pzw > span { display: block; overflow-wrap: anywhere; }
.pz .pzcw { font-weight: 400; letter-spacing: 0; line-height: ${PZ_CLUE_LH}px; } .pz .pzc + .pzc { margin-top: 3px; } .pz .pzc > b { display: block; font: 700 6.3pt/12px Inter, sans-serif; letter-spacing: 0.5px; text-transform: uppercase; }
.pz .pzc p { display: flex; gap: 3px; margin: 0; } .pz .pzc i { flex: none; width: 12px; font-style: normal; font-weight: 600; text-align: right; } .pz .pzc span { min-width: 0; overflow-wrap: anywhere; }
.pz.big .pzw { font-size: 8pt; line-height: 13px; } .pz.big .pzcw { line-height: 12px; }
`;
