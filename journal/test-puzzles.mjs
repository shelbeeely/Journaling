// Puzzle check (CI: books.yml): the seeded generators and the word search and crossword blocks.
//   1. Determinism: the same seed gives the same grid (in this process and in a fresh one); another seed gives another puzzle.
//   2. Word search: every word is placed where it says, read in an allowed direction, and appears nowhere else; sizes 8 to 15, every difficulty.
//   3. Crossword: valid from the grid alone (pzCheckCrossword), every word crosses another, numbered, every clue present, no answer in its clue.
//   4. The puzzles pack kind: the sample pack and the template pass check; bad lists are refused with a plain reason.
//   5. The blocks: print-safe SVG (strokes >= 0.75 pt = 1 px, no raster, no filter), a text alternative, the answers only when asked, a data-zone.
//   6. Builds (small and letter): a day page with both blocks passes check.mjs ("[] 0"), has no Type 3 fonts, and layout.json maps both zones.
//   node test-puzzles.mjs        (builds into out/puzzles-test/, about a minute)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { generateWordSearch, pzCount, pzCells, PZ_LEVELS, PZ_DIRS } from './puzzles/wordsearch.mjs';
import { generateCrossword, pzCheckCrossword, PZ_CLUE_MAX } from './puzzles/crossword.mjs';
import { PZ_SAMPLE_LISTS, PZ_SAMPLE_IDS } from './puzzles/samples.mjs';
import { pzBlock, pzHeight, usePuzzlePack, PZ_STROKE } from './puzzles/render.mjs';
import { newBlock, normalize, dayBlocks, minSpan, kindPage, autoPlace, gridProblems, TYPES, allowedIn } from './daypage.mjs';
import { KINDS } from './packs/kinds.mjs';
import { checkPack, readPart, loadPack } from './packs/pack.mjs';

let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };
const entries = (id) => PZ_SAMPLE_LISTS[id].entries.map(([word, clue]) => ({ word, clue }));
const words = (id) => PZ_SAMPLE_LISTS[id].entries.map((e) => e[0]);
const sha = (x) => crypto.createHash('sha1').update(JSON.stringify(x)).digest('hex');
const SEEDS = ['a', 'b', '2026-10-05|day|1', '2026-10-06|day|1', 'x y z', ''];
const SIZES = [8, 10, 12, 15], CW_SIZES = [7, 9, 11];

// ---- 1. determinism ----
const probe = () => ({
  ws: SIZES.flatMap((size) => ['easy', 'medium', 'hard'].map((difficulty) => generateWordSearch({ words: words('garden'), size, difficulty, seed: 'det' }))),
  cw: CW_SIZES.flatMap((size) => ['easy', 'medium', 'hard'].map((difficulty) => generateCrossword({ entries: entries('kitchen'), size, difficulty, seed: 'det' }))),
});
const here = sha(probe());
ok(here === sha(probe()), 'the same seed gives the same puzzles twice in one process');
const child = execFileSync('node', ['--input-type=module', '-e', `
  import { generateWordSearch } from './puzzles/wordsearch.mjs'; import { generateCrossword } from './puzzles/crossword.mjs'; import { PZ_SAMPLE_LISTS } from './puzzles/samples.mjs'; import crypto from 'node:crypto';
  const entries = (id) => PZ_SAMPLE_LISTS[id].entries.map(([word, clue]) => ({ word, clue })), words = (id) => PZ_SAMPLE_LISTS[id].entries.map((e) => e[0]);
  const probe = () => ({ ws: [8, 10, 12, 15].flatMap((size) => ['easy', 'medium', 'hard'].map((difficulty) => generateWordSearch({ words: words('garden'), size, difficulty, seed: 'det' }))), cw: [7, 9, 11].flatMap((size) => ['easy', 'medium', 'hard'].map((difficulty) => generateCrossword({ entries: entries('kitchen'), size, difficulty, seed: 'det' }))) });
  process.stdout.write(crypto.createHash('sha1').update(JSON.stringify(probe())).digest('hex'));`]).toString();
ok(child === here, 'the same seed gives the same puzzles in a fresh process');
ok(generateWordSearch({ words: words('garden'), size: 10, seed: 'a' }).grid.join() !== generateWordSearch({ words: words('garden'), size: 10, seed: 'b' }).grid.join(), 'another seed gives another word search');
ok(generateCrossword({ entries: entries('calm'), size: 9, seed: 'a' }).cells.join() !== generateCrossword({ entries: entries('calm'), size: 9, seed: 'b' }).cells.join(), 'another seed gives another crossword');
{ // unique across a book: 31 day pages of one layout (the seed holds the date) give 31 different puzzles
  const seen = new Set(Array.from({ length: 31 }, (_, d) => generateWordSearch({ words: words('sky'), size: 10, seed: `2026-10-${d + 1}|ws|` }).grid.join('')));
  ok(seen.size === 31, 'a month of day pages gives 31 different word searches');
}

// ---- 2. word search ----
let wsCount = 0;
for (const id of PZ_SAMPLE_IDS) for (const size of SIZES) for (const difficulty of ['easy', 'medium', 'hard']) for (const seed of SEEDS) {
  const w = generateWordSearch({ words: words(id), size, difficulty, seed });
  wsCount++;
  assert.equal(w.unplaced.length, 0, `${id} ${size} ${difficulty} "${seed}": every word is placed (left out: ${w.unplaced})`);
  assert.equal(w.ambiguous, false, `${id} ${size} ${difficulty} "${seed}": no word appears twice`);
  assert.equal(w.grid.length, size); assert.ok(w.grid.every((r) => r.length === size && /^[A-Z]+$/.test(r)), 'a square grid of A-Z');
  assert.ok(w.words.length >= Math.min(Math.round(size * 0.8), words(id).filter((x) => x.length <= size).length) - 0, `${id} ${size}: the word count`);
  for (const p of w.words) {
    assert.ok(PZ_LEVELS[difficulty].includes(p.dir), `${p.word} runs ${p.dir}, not allowed at ${difficulty}`);
    const c = pzCells(p);
    assert.ok(c.every(([y, x]) => y >= 0 && x >= 0 && y < size && x < size), `${p.word} stays inside the grid`);
    assert.equal(c.map(([y, x]) => w.grid[y][x]).join(''), p.word, `${p.word} is spelled at its place`);
    assert.equal(pzCount(w.grid, p.word), 1 + (p.word === [...p.word].reverse().join('') ? 1 : 0), `${p.word} appears exactly once`);
  }
}
ok(wsCount === 4 * 4 * 3 * 6, `word search: ${wsCount} puzzles, all words placed, found once, in allowed directions`);
ok(['easy', 'medium', 'hard'].every((d) => Object.keys(PZ_DIRS).length === 8 && PZ_LEVELS[d].every((k) => PZ_DIRS[k])), 'directions are defined');
{ // custom words: letters only, upper-cased; too long or too short words are left out
  const w = generateWordSearch({ words: ['hello world', 'a', 'moon', 'supercalifragilistic', 'Tea'], size: 8, seed: 'c' });
  ok(w.words.map((x) => x.word).sort().join() === 'MOON,TEA', 'custom words are cleaned: "hello world" is too long for 8, "a" too short');
}

// ---- 3. crossword ----
let cwCount = 0;
for (const id of PZ_SAMPLE_IDS) for (const size of CW_SIZES) for (const difficulty of ['easy', 'medium', 'hard']) for (const seed of SEEDS) {
  const c = generateCrossword({ entries: entries(id), size, difficulty, seed });
  cwCount++;
  const probs = pzCheckCrossword(c);
  assert.deepEqual(probs, [], `${id} ${size} ${difficulty} "${seed}": ${probs.join('; ')}`);
  assert.ok(c.rows <= size && c.cols <= size, 'fits the largest grid');
  assert.ok(c.across.length + c.down.length >= 4 && c.across.length >= 1 && c.down.length >= 1, `${id} ${size} ${difficulty}: at least four words, across and down`);
  for (const e of [...c.across, ...c.down]) { assert.ok(!e.clue.toUpperCase().includes(e.word), 'no clue contains its answer'); assert.ok(e.clue.length <= PZ_CLUE_MAX); }
}
ok(cwCount === 4 * 3 * 3 * 6, `crossword: ${cwCount} puzzles, all valid (runs, crossings, numbers, clues)`);
{ // the checker really catches problems
  const c = generateCrossword({ entries: entries('garden'), size: 9, seed: 'bad' });
  const y = c.cells.findIndex((r) => /[A-Z]/.test(r));
  const broken = { ...c, cells: c.cells.map((r, i) => (i === y ? r.replace(/[A-Z]/, '#').replace('#', 'Q') : r)) };
  ok(pzCheckCrossword(broken).length > 0, 'a changed letter is caught');
  ok(pzCheckCrossword({ ...c, across: c.across.slice(1) }).length > 0, 'a missing entry is caught');
  ok(pzCheckCrossword({ ...c, down: c.down.map((e, i) => (i ? e : { ...e, n: 99 })) }).length > 0, 'a wrong number is caught');
  const alone = { rows: 3, cols: 7, cells: ['ABC....', '.......', '..DEF..'], across: [{ n: 1, word: 'ABC', clue: 'x', row: 0, col: 0 }, { n: 2, word: 'DEF', clue: 'y', row: 2, col: 2 }], down: [] };
  ok(pzCheckCrossword(alone).some((p) => /crosses no other word/.test(p)), 'a word that crosses nothing is caught');
  const touching = { rows: 2, cols: 3, cells: ['ABC', 'DEF'], across: [{ n: 1, word: 'ABC', clue: 'x', row: 0, col: 0 }, { n: 2, word: 'DEF', clue: 'y', row: 1, col: 0 }], down: [] };
  ok(pzCheckCrossword(touching).some((p) => /not an entry/.test(p)), 'two words touching side by side (accidental down runs) are caught');
}

// ---- 4. the puzzles pack kind ----
ok(KINDS.puzzles && KINDS.puzzles.privacy === 'public' && typeof KINDS.puzzles.validate === 'function', 'the puzzles kind is registered and public');
for (const p of ['packs/puzzles-sample', 'packs/_template/puzzles']) { const c = checkPack(p); ok(c.errors.length === 0, `${p} passes its own check: ${c.errors}`); }
{
  const v = (lists) => KINDS.puzzles.validate({ lists }).errors.join(' | '), good = (o = {}) => ({ id: 'a', title: 'A', entries: [{ word: 'MOON', clue: 'Lit by borrowed light', ...o }] });
  ok(/at least one list/.test(KINDS.puzzles.validate({}).errors[0]), 'no lists is refused');
  ok(/gives away its answer "MOON"/.test(v([good({ clue: 'The moon is bright' })])), 'a clue that contains its answer is refused');
  ok(/3 to 12 letters/.test(v([good({ word: 'no way' })])) && /3 to 12 letters/.test(v([good({ word: 'AB' })])), 'words are 3 to 12 letters, A to Z');
  ok(/up to 40 characters/.test(v([good({ clue: 'x'.repeat(41) })])) && /up to 40 characters/.test(v([good({ clue: '' })])), 'clues are required and short');
  ok(/used twice/.test(v([good(), good()])) && /lowercase with dashes/.test(v([{ ...good(), id: 'Bad Id' }])), 'list ids are unique slugs');
  ok(/twice/.test(v([{ id: 'a', title: 'A', entries: [{ word: 'MOON', clue: 'c' }, { word: 'moon', clue: 'd' }] }])), 'a word twice in a list is refused');
  const packLists = readPart('puzzles-sample', 'puzzles');
  ok(Object.keys(packLists.lists).join() === 'seasons,library' && packLists.lists.seasons.entries.every((e) => e.word === e.word.toUpperCase()), 'the sample pack reads as lists of upper-case words and clues');
  ok(loadPack('puzzles-sample').manifest.license.spdx === 'CC0-1.0' && loadPack('puzzles-sample').manifest.author.name, 'the sample pack has a licence and an author');
}
for (const [id, l] of Object.entries(PZ_SAMPLE_LISTS)) {
  const v = KINDS.puzzles.validate({ lists: [{ id, title: l.title, entries: l.entries.map(([word, clue]) => ({ word, clue })) }] });
  ok(v.errors.length === 0, `built-in list "${id}" meets the pack rules: ${v.errors}`);
}

// ---- 5. the blocks ----
const strokes = (svg) => [...svg.matchAll(/stroke-width="([\d.]+)"/g)].map((m) => +m[1]);
for (const type of ['wordsearch', 'crossword']) {
  ok(TYPES[type] && TYPES[type].opts.some((o) => o.k === 'size') && TYPES[type].opts.some((o) => o.k === 'difficulty') && TYPES[type].opts.some((o) => o.k === 'source') && TYPES[type].opts.some((o) => o.k === 'seed') && TYPES[type].opts.some((o) => o.k === 'answers'), `${type}: declares size, difficulty, word list source, seed and show answers`);
  ok(allowedIn('day', type) && allowedIn('notes', type) && allowedIn('collection', type) && allowedIn('blank', type), `${type}: allowed on day, Notes, Collection and blank pages`);
  const b = newBlock(type, {}, 'p1'), html = dayBlocks({ header: '', day: { date: '2026-10-05' } }, { v: 2, blocks: [b, newBlock('body', {}, 'body')] }), svg = /<svg class="pzg".*?<\/svg>/s.exec(html)[0];
  ok(new RegExp(`data-zone="${type}"`).test(html), `${type}: the block has its data-zone`);
  ok(strokes(svg).length > 0 && strokes(svg).every((w) => w >= 0.75 / 0.75 - 1e-9), `${type}: every stroke is 1 px (0.75 pt) or more (${strokes(svg).slice(0, 3)})`);
  ok(PZ_STROKE >= 1 && !/<image|<filter|<mask|filter=|<pattern|<foreignObject|<script/.test(svg), `${type}: plain vector, no raster, filter, mask or script`);
  ok(/role="img"/.test(svg) && /<title id="[^"]+">[^<]+<\/title>/.test(svg) && /<desc id="[^"]+">[^<]{20,}/.test(svg) && /aria-labelledby="(\S+) (\S+)"/.test(svg), `${type}: text alternative (role img, title, desc)`);
  const fonts = [...svg.matchAll(/font-family="([^"]+)"/g)].map((m) => m[1]);
  ok(fonts.every((f) => /^Inter, sans-serif$/.test(f)), `${type}: letters are text in Inter (a real font, never Type 3)`);
  ok(minSpan(b).cols === 4 && minSpan(b).rows >= 8 && minSpan(b).rows <= 20, `${type}: has a grid minimum (${JSON.stringify(minSpan(b))})`);
  // same page, same block: identical HTML; another day: another puzzle
  const again = dayBlocks({ header: '', day: { date: '2026-10-05' } }, { v: 2, blocks: [b, newBlock('body', {}, 'body')] });
  ok(again === html, `${type}: the same page and seed print the same block`);
  ok(dayBlocks({ header: '', day: { date: '2026-10-06' } }, { v: 2, blocks: [b, newBlock('body', {}, 'body')] }) !== html, `${type}: another day gives another puzzle`);
  const s2 = { ...b, seed: 'again' }; ok(dayBlocks({ header: '', day: { date: '2026-10-05' } }, { v: 2, blocks: [s2, newBlock('body', {}, 'body')] }) !== html, `${type}: changing the seed gives another puzzle`);
  // repeats get _2
  const gh = dayBlocks({ header: '', day: { date: '2026-10-05' } }, { v: 2, blocks: [newBlock(type, { size: 8 }, 'a'), newBlock(type, { size: 8 }, 'b')] });
  ok(new RegExp(`data-zone="${type}"`).test(gh) && new RegExp(`data-zone="${type}_2"`).test(gh), `${type}: a repeated block maps ${type} and ${type}_2`);
}
{ // answers appear only when asked
  const day = { date: '2026-10-05' }, mk = (type, o) => dayBlocks({ header: '', day }, { v: 2, blocks: [newBlock(type, o, 'k'), newBlock('body', {}, 'body')] });
  const plainCw = /<desc[^>]*>([^<]*)/.exec(mk('crossword', {}))[1], keyCw = /<desc[^>]*>([^<]*)/.exec(mk('crossword', { answers: true }))[1];
  const cw = generateCrossword({ entries: entries('garden'), size: 9, difficulty: 'medium', seed: '2026-10-05|k|' }), a0 = cw.across[0].word;
  ok(!plainCw.includes(a0) && /Answers: /.test(keyCw) && keyCw.includes(a0), 'crossword: the answers are in the text alternative only when shown');
  ok(!/<svg[^>]*>(?:(?!<\/svg>).)*<text [^>]*text-anchor="middle"/s.test(mk('crossword', {}).replace(/<text[^>]*>\d+<\/text>/g, '')), 'crossword: no letters are drawn when answers are off');
  ok(/stroke="#cfcfcf"/.test(mk('wordsearch', { answers: true })) && !/stroke="#cfcfcf"/.test(mk('wordsearch', {})), 'word search: the answers are marked only when shown');
  const key = pzBlock(newBlock('crossword', {}, 'k'), '2026-10-05|k|', { answers: true });
  ok(/Answers: /.test(key.body), 'pzBlock can draw the answer key for the same seed (for a key page)');
}
{ // sources: own words, an unknown list falls back, a pack
  const cust = dayBlocks({ header: '', day: { date: '2026-10-05' } }, { v: 2, blocks: [newBlock('wordsearch', { source: 'custom', words: ['otter', 'beaver', 'badger', 'heron'] }, 'c'), newBlock('body', {}, 'body')] });
  ok(/OTTER/.test(cust) && /BEAVER/.test(cust) && !/GARDEN/i.test(/class="pzw".*?<\/div>/s.exec(cust)[0]), 'word search: "My own words" uses the typed words');
  const few = dayBlocks({ header: '', day: { date: '2026-10-05' } }, { v: 2, blocks: [newBlock('crossword', { source: 'custom', words: ['otter', 'beaver'] }, 'c'), newBlock('body', {}, 'body')] });
  ok(/pzcw/.test(few) && /Across/.test(few), 'crossword: too few own words falls back to the sample list instead of an empty puzzle');
  const cwc = dayBlocks({ header: '', day: { date: '2026-10-05' } }, { v: 2, blocks: [newBlock('crossword', { source: 'custom', size: 9, words: ['otter=Sleeps holding hands', 'beaver=Builds a dam', 'badger=Digs a sett', 'heron=Waits on one leg', 'newt=Small and spotted'] }, 'c'), newBlock('body', {}, 'body')] });
  ok(/Builds a dam/.test(cwc) && /Digs a sett/.test(cwc), 'crossword: "word=clue" entries become clues');
  ok(/Garden/.test(dayBlocks({ header: '', day: { date: '2026-10-05' } }, { v: 2, blocks: [newBlock('wordsearch', { theme: 'nonsense' }, 'u'), newBlock('body', {}, 'body')] })), 'an unknown list name uses the first built-in list');
  usePuzzlePack(readPart('puzzles-sample', 'puzzles'));
  const pk = dayBlocks({ header: '', day: { date: '2026-10-05' } }, { v: 2, blocks: [newBlock('crossword', { source: 'pack', theme: 'library' }, 'p'), newBlock('body', {}, 'body')] });
  ok(/Library/.test(pk) && /A short piece arguing one idea|Pages bound between two covers|The alphabetical list at the back/.test(pk), 'the "pack" source reads the puzzles pack list');
  usePuzzlePack(null);
  ok(/Garden/.test(dayBlocks({ header: '', day: { date: '2026-10-05' } }, { v: 2, blocks: [newBlock('wordsearch', { source: 'pack', theme: 'library' }, 'p'), newBlock('body', {}, 'body')] })), 'no pack: the "pack" source falls back to the built-in list');
}
{ // Notes and Collection pages: the blocks sit on a grid, with zones and no rule broken
  for (const kind of ['notes', 'collection']) {
    const L = normalize({ v: 2, kind, grid: true, blocks: [newBlock('wordsearch', { size: 8 }, 'ws'), newBlock('body', {}, 'body')] }, 'small', kind), dropped = autoPlace(L, 'small');
    const placed = normalize(L, 'small', kind);
    ok(dropped.length === 0 && gridProblems(placed, 'small').length === 0, `${kind}: a word search and the writing space place on its grid`);
    const html = kindPage(kind, 'Puzzles', placed, 'small', { pageId: `${kind}.1` });
    ok(/data-zone="wordsearch"/.test(html) && /data-zone="body"/.test(html), `${kind}: the page prints both zones`);
    ok(html !== kindPage(kind, 'Puzzles', placed, 'small', { pageId: `${kind}.2` }), `${kind}: another page gets another puzzle`);
  }
}

// ---- 6. builds ----
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'kw-puzzles-'));
process.on('exit', () => fs.rmSync(TMP, { recursive: true, force: true }));
const ROOT = 'out/puzzles-test';
fs.rmSync(ROOT, { recursive: true, force: true });
const day = normalize({ v: 2, blocks: [newBlock('wordsearch', { size: 8, difficulty: 'medium' }, 'ws'), newBlock('crossword', { size: 7, difficulty: 'easy' }, 'cw'), newBlock('body', {}, 'body')] });
const df = path.join(TMP, 'day.json'); fs.writeFileSync(df, JSON.stringify(day));
const env = { ...process.env, KW_OUT: ROOT, KW_DAYFILE: df };
const run = (s, a, e = env) => execFileSync('node', [s, ...a], { env: e, stdio: 'pipe' }).toString();
for (const [size, dir, pdf] of [['small', 'm2026-10', 'keeping-watch-2026-10-interior-5.5x8.5.pdf'], ['letter', 'm2026-10-letter', 'keeping-watch-2026-10-interior-8.5x11.pdf']]) {
  run('render.mjs', ['month', '2026-10', 'test.ics'], { ...env, SIZE: size });
  const gate = run('check.mjs', [dir], env);
  ok(/\[\] 0/.test(gate), `${dir}: every page passes check.mjs ("[] 0")`);
  const fonts = execFileSync('pdffonts', [`${ROOT}/${dir}/${pdf}`]).toString();
  ok(!/Type 3/i.test(fonts) && /Inter/.test(fonts), `${dir}: no Type 3 fonts in the PDF (puzzle letters are Inter)`);
  const L = JSON.parse(fs.readFileSync(`${ROOT}/${dir}/layout.json`, 'utf8')), days = L.pages.filter((p) => p.type === 'dayp');
  ok(days.length === 31 && days.every((p) => ['wordsearch', 'crossword'].every((z) => p.zones.some((x) => x.zone === z && x.w > 20 && x.h > 20))), `${dir}: all 31 day pages map both puzzle zones in layout.json`);
  const html = fs.readFileSync(`${ROOT}/${dir}/journal.html`, 'utf8');
  ok(new Set([...html.matchAll(/<desc id="[^"]+">(Word search[^<]+)/g)].map((m) => m[1])).size === 31, `${dir}: 31 different word searches in the book`);
}
console.log(`test-puzzles: ${n} checks ok (+ ${wsCount} word searches, ${cwCount} crosswords)`);
