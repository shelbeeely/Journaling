// Note, flash card and stimming blocks test (B1, BUILD-PLAN section 24): cornell, notearea, conceptmap, questions, summarybox, flashstrip,
// reviewtracker, stimlog, stimmenu, stimtrace. Paper to write in or trace; nothing is stored, uploaded or cut out.
// Proves (1) the blocks are declared like every other block (options, groups, icons, palette, nothing that could carry data), and the copy for
// the stimming blocks says stimming is self-regulation and never asks anyone to stop, (2) the widths and heights are a plan the drawing keeps
// (minimum spans per trim, a plain reason for every refusal), (3) they work on every page kind, nothing crosses the fold of a spread,
// (4) the drawing is deterministic and honest (counts, options, text alternatives, the class names belong to these blocks alone, strokes are
// 0.75 pt or more, the default page has none of it), (5) the FOLD-OVER STRIP FOLDS TRUE: one fold line at a fixed x on every row, the term and
// answer cells meet exactly there, two strips share the line, in the page's DOM and in the 300 dpi PDF, at both trims, and (6) a book with the
// blocks on every kind of page builds in both trims, plain and with large print and high contrast on: check.mjs "[] 0", scan zones mapped, no
// Type 3 fonts, no raster images (vector only), check-pages, check-codes. Studio snapshots carry the options and nothing else.
//   node test-noteblocks.mjs       (about four minutes: four book builds into out/noteblocks-test/; NB_TAGS=small runs one)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { DEFAULT_BOOK, validateBook } from './book.mjs';
import { addEntry, setLayout } from './bookedit.mjs';
import { catalog } from './editor/samples.mjs';
import { libraryFromProfile } from './library.mjs';
import { PROFILE } from './profile.mjs';
import { launch } from './browser.mjs';
import { pageProblems } from './pageoverflow.mjs';
import { newBlock, normalize, kindPage, dayBlocks, withPageSide, gridProblems, minSpan, spreadHalf, spreadProblems, spreadPage, placeBlock, findFree, GRIDS, gridRows, allowedIn, TYPES, IC, DEFAULT_LAYOUT, PAGE_KINDS, PITCH_IN, DAYPAGE_CSS } from './daypage.mjs';
import * as NB from './noteblocks.mjs';
import * as PH from './photo.mjs';
import { serializeDay } from '../studio/src/snapshot.mjs';

let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; console.log('ok   ' + m); };
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'kw-noteblocks-'));
process.on('exit', () => fs.rmSync(TMP, { recursive: true, force: true }));
const ROOT = 'out/noteblocks-test';
fs.rmSync(ROOT, { recursive: true, force: true });
fs.mkdirSync(ROOT, { recursive: true });
const B = (t, o = {}, uid = t) => newBlock(t, o, uid);
const at = (b, col, row, colSpan, rowSpan) => ({ ...b, col, row, colSpan, rowSpan });
const SIZES = ['small', 'letter'], TRIM = { small: '5.5x8.5', letter: '8.5x11' };
const NOTES = ['cornell', 'notearea', 'conceptmap', 'questions', 'summarybox', 'flashstrip', 'reviewtracker'], STIMS = ['stimlog', 'stimmenu', 'stimtrace'];
const text = (html) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const labelsOf = (html) => [...html.matchAll(/aria-label="([^"]*)"/g)].map((m) => m[1]).join(' ');

// ---- 1. declared like every other block ----
{
  ok(NB.NOTE_TYPES.join() === [...NOTES, ...STIMS].join(), 'ten blocks: ' + NB.NOTE_TYPES.join(', '));
  ok(NOTES.every((t) => TYPES[t].group === 'Notes and study') && STIMS.every((t) => TYPES[t].group === 'Regulation'), 'the study blocks are in the palette group "Notes and study", the stimming blocks in "Regulation"');
  ok(NB.NOTE_TYPES.every((t) => IC[TYPES[t].icon] && TYPES[t].name && /Paper only/.test(TYPES[t].hint)), 'each has an icon, a name and a hint that says paper only');
  ok(Object.keys(TYPES).filter((t) => ['Notes and study', 'Regulation'].includes(TYPES[t].group)).length === 10, 'the two groups hold exactly these ten');
  const kinds = new Set(NB.NOTE_TYPES.flatMap((t) => TYPES[t].opts.map((o) => o.kind)));
  ok([...kinds].every((k) => ['num', 'bool', 'choice', 'text', 'flags'].includes(k)), 'options are only numbers, switches, choices, flags and a label: ' + [...kinds].join(', '));
  ok(NB.NOTE_TYPES.every((t) => TYPES[t].opts.every((o) => o.label && !/image|src|url|file|upload|camera|audio|sensor|data/i.test(o.k))), 'every option has a label, and none of them could carry data (no src, url, file, upload, camera, audio, sensor)');
  const ALL = ['day', 'notes', 'collection', 'blank', 'spread', 'half'];
  ok(NB.NOTE_TYPES.every((t) => !TYPES[t].single && ALL.every((k) => allowedIn(k, t))), 'they repeat, and they are ordinary blocks of every page kind: day, Notes, Collection, blank, spread and spread page');
  ok(JSON.stringify(NB.NOTE_PITCH) === JSON.stringify(PITCH_IN), 'the line pitches in noteblocks.mjs are the block library\'s (5.6, 6.6 and 8.5 mm)');
  const f = B('flashstrip');
  ok(f.n === 6 && f.num === true && f.split === 50 && f.answer === 'auto' && f.reviews === 3 && f.gotit === false && f.hint === true && f.pitch === 6.6, 'flashstrip starts as 6 numbered cards, an even fold, answers on the outer edge (it flips by itself on left-hand pages), 3 review ticks, the fold hint, no got it / again: ' + JSON.stringify(f));
  const nb = normalize({ v: 2, blocks: [{ type: 'flashstrip', uid: 'a', n: 99, split: 70, answer: 'up', reviews: 9, pitch: 1 }, { type: 'reviewtracker', uid: 'b', every: { d1: false, d3: false, d7: false, d14: false, d21: false, d30: false }, n: 1 }, { type: 'stimmenu', uid: 'c', senses: { touch: false, move: false, sound: false, sight: false, chew: false, press: false }, rows: 9 }, { type: 'stimtrace', uid: 'd', pattern: 'maze', size: 'huge', h: 400 }, { type: 'conceptmap', uid: 'e', branches: 2, h: 1 }, { type: 'summarybox', uid: 'f', prompt: 'x' }, { type: 'notearea', uid: 'g', paper: 'felt', n: 0 }].map((x) => ({ ...x })) }).blocks, g = (u) => nb.find((x) => x.uid === u);
  ok(g('a').n === 12 && g('a').split === 50 && g('a').answer === 'auto' && g('a').reviews === 5 && g('a').pitch === 6.6, 'wrong values are put right: too many cards, an odd fold position, an unknown side, too many ticks, an unknown pitch');
  ok(NB.reviewSteps(g('b')).join() === 'd1,d3,d7,d21' && g('b').n === 2, 'a review tracker with every time switched off gets the 1, 3, 7 and 21 day rhythm back');
  ok(NB.stimSenses(g('c')).length === 6 && g('c').rows === 4, 'a stim menu with every sense switched off gets all six back');
  ok(g('d').pattern === 'waves' && g('d').size === 'm' && g('d').h === 40 && g('e').branches === 3 && g('e').h === 14 && g('f').prompt === 'own' && g('g').paper === 'lines' && g('g').n === 2, 'an unknown pattern, size, prompt or paper, and numbers past their range, are put right');
  const bad = { type: 'flashstrip', uid: 'p', n: 5, src: 'data:image/png;base64,AAAA', audio: 'x.mp3', url: 'https://example.invalid/a', notes: 'a secret' };
  const snap = serializeDay({ v: 2, blocks: [bad, B('body')] }, []), kept = snap.blocks.find((b) => b.type === 'flashstrip');
  ok(kept && kept.n === 5 && !('src' in kept) && !('audio' in kept) && !('url' in kept) && !('notes' in kept) && !JSON.stringify(snap).includes('data:image'), 'a Studio snapshot keeps the declared options and drops anything else: no data field can ride along');
  const errs = []; const sp = serializeDay({ v: 2, spread: normalize({ v: 2, kind: 'spread', grid: true, blocks: [at(B('body'), 1, 1, 4, 24), at(B('flashstrip', { n: 4, answer: 'left' }), 5, 1, 4, 9)] }, 'small', 'spread') }, errs);
  ok(!errs.length && sp && sp.spread.blocks.some((b) => b.type === 'flashstrip' && b.answer === 'left'), 'a spread day with a flash strip goes through the snapshot allowlist: ' + errs.join('; '));
  // the copy: stimming is self-regulation and nothing asks anyone to stop
  const NOASK = /\b(reduce|stop|stopping|suppress|supress|control|cure|fix|too much|excessive|bad|wrong|problem|compuls|abnormal|inappropriate|disruptive)\b/i;
  const words = (t) => [TYPES[t].name, TYPES[t].hint, ...TYPES[t].opts.flatMap((o) => [o.label, ...(o.choices || []).map((c) => c[1]), ...(o.items ? Object.values(o.items) : [])])].join(' ');
  ok(STIMS.every((t) => !NOASK.test(words(t))), 'the stimming blocks\' names, hints, options and choices never use reduce, stop, suppress, control, fix, bad, wrong or problem');
  ok(STIMS.every((t) => /self-regulation/.test(TYPES[t].hint)), 'each stimming block\'s hint says stimming is self-regulation');
  const exWords = Object.values(NB.STIM_EXAMPLES).flat();
  ok(Object.keys(NB.STIM_EXAMPLES).join() === Object.keys(NB.STIM_SENSES).join() && Object.values(NB.STIM_EXAMPLES).every((l) => l.length === 4 && new Set(l).size === 4) && exWords.every((w) => w.length <= 20 && !NOASK.test(w)), 'the stim menu has four original examples for each of its six senses, short enough for half a column, and none of them uses a word that asks anyone to stop');
  ok(B('stimmenu').examples === false && TYPES.stimmenu.opts.find((o) => o.k === 'examples').label === 'Print a few examples in the lines', 'printing examples is an option on the stim menu and is off unless asked for (the boxes stay blank either way)');
  const idx = fs.readFileSync(new URL('./i18n/en.json', import.meta.url), 'utf8');
  ok(/"pal\.note_regulation": "Stimming is self-regulation\./.test(idx) && !NOASK.test(JSON.parse(idx)['pal.note_regulation'].replace(/none of them asks you to stop/, '')), 'the palette note over the Regulation group says it: stimming is self-regulation, no block asks you to stop');
}

// ---- 2. widths, heights and the fit rules ----
{
  // the plan: every block, both trims, several option sets: at its minimum there is no problem, one row fewer is refused, one column fewer is refused
  const lay = (blocks, kind = 'blank') => normalize({ v: 2, kind, grid: true, blocks }, 'letter', kind);
  const variants = [['cornell', {}], ['cornell', { head: false, n: 16, s: 4, paper: 'dots', pitch: 8.5 }], ['notearea', {}], ['notearea', { title: '', topic: false, date: false, source: true, n: 24, paper: 'blank' }], ['notearea', { topic: true, date: false, paper: 'grid', pitch: 6.6 }],
    ['conceptmap', {}], ['conceptmap', { branches: 8, h: 40 }], ['conceptmap', { title: '', branches: 3, h: 14 }], ['questions', {}], ['questions', { n: 10, answers: false, tick: false, title: '' }], ['questions', { n: 10, pitch: 8.5 }],
    ['summarybox', {}], ['summarybox', { n: 8, prompt: 'none', pitch: 8.5 }], ['flashstrip', {}], ['flashstrip', { n: 12, split: 60, gotit: true, reviews: 5 }], ['flashstrip', { n: 4, num: false, reviews: 0, split: 40 }], ['flashstrip', { answer: 'left', hint: false, pitch: 8.5 }],
    ['reviewtracker', {}], ['reviewtracker', { n: 12, date: false, every: { d1: true, d3: false, d7: false, d14: false, d21: false, d30: false } }], ['reviewtracker', { every: { d1: true, d3: true, d7: true, d14: true, d21: true, d30: true } }],
    ['stimlog', {}], ['stimlog', { n: 6, size: true, note: false }], ['stimlog', { where: false, ba: false, n: 1 }], ['stimmenu', {}], ['stimmenu', { rows: 4, ideas: 4, note: false }], ['stimmenu', { rows: 2, examples: true }], ['stimmenu', { rows: 4, ideas: 4, examples: true, note: false }], ['stimmenu', { senses: { touch: true, move: false, sound: false, sight: false, chew: false, press: false }, ideas: 0 }],
    ['stimtrace', {}], ['stimtrace', { h: 40, pattern: 'spiral', size: 'l' }], ['stimtrace', { h: 8, pattern: 'grid', frame: false }]];
  let cnt = 0, narrower = 0;
  for (const size of SIZES) for (const [t, o] of variants) {
    const b = B(t, o, 'v'), m = minSpan(b, 4, size);
    const prob = (c, r) => gridProblems(lay([at(b, 1, 1, c, r)]), size).filter((x) => /^note/.test(x.code));
    const p = NB.notePlan(b, size);
    if (!p.fitsPage) { assert.ok(prob(4, 27).some((x) => x.code === 'notewidth'), `${TRIM[size]} ${t} ${JSON.stringify(o)}: too wide for the page and not refused`); cnt++; continue; }
    if (m.rows > 27) continue;
    assert.ok(prob(m.cols, m.rows).length === 0, `${TRIM[size]} ${t} ${JSON.stringify(o)}: a problem at its minimum ${m.cols} x ${m.rows}: ${JSON.stringify(prob(m.cols, m.rows))}`);
    if (m.rows > 1) assert.ok(prob(m.cols, m.rows - 1).some((x) => x.code === 'noterows'), `${TRIM[size]} ${t} ${JSON.stringify(o)}: one row fewer is not refused`);
    if (m.cols > 1) { assert.ok(prob(m.cols - 1, m.rows).some((x) => x.code === 'notewidth'), `${TRIM[size]} ${t} ${JSON.stringify(o)}: one column fewer is not refused`); narrower++; }
    cnt++;
  }
  ok(cnt >= 50 && narrower >= 20, `minSpan(block, columns, trim) is the least room: fits at the minimum, refused one row or one column below (${cnt} block and option variants, both trims, ${narrower} with a narrower width tested)`);
  // flash cards: the width a strip needs is its term side (the number, the ticks, the pair, and a line of at least 0.5 in) at its share of the strip
  {
    const b = B('flashstrip', { split: 50, reviews: 3, gotit: false, num: true }), P = NB.flashParts(b);
    ok(near(P.ticks, 3 * 0.104 + 2 * 0.034, 1e-9) && P.pair === 0 && near(NB.flashNeed(b), Math.max(P.term / 0.5, P.answer / 0.5), 1e-9), 'flashstrip: 3 tick boxes are 3 x 0.104 in and two gaps; the strip needs the larger of the term side and the answer side, scaled to its share');
    ok(NB.notePlan(b, 'small').cols <= 4 && PH.cellWidth(NB.notePlan(b, 'small').cols, 'small') >= NB.flashNeed(b) && (NB.notePlan(b, 'small').cols === 1 || PH.cellWidth(NB.notePlan(b, 'small').cols - 1, 'small') < NB.flashNeed(b)), 'flashstrip: the minimum width is the first column count that holds the need');
    const wide = B('flashstrip', { split: 40, reviews: 5, gotit: true, num: true });
    for (const size of SIZES) {
      const f = NB.noteFit(wide, 4, undefined, size, 'Flash cards (fold-over strip)');
      ok(f && f.code === 'notewidth' && /does not fit the/.test(f.msg) && /fewer review ticks/.test(f.msg) && new RegExp(`${TRIM[size].replace('x', '×')}`).test(f.msg), `${TRIM[size]}: a strip with five ticks, got it / again and a 40 percent term side is refused, with a way out: ${f && f.msg}`);
    }
    const rowsWhy = NB.noteFit(B('flashstrip', { n: 12 }), 4, 5, 'small', 'Flash cards').msg;
    ok(/needs 1\d rows/.test(rowsWhy) && /it has 5/.test(rowsWhy), 'too few rows is refused with the rows it needs: ' + rowsWhy);
    const colsWhy = NB.noteFit(B('conceptmap'), 1, 20, 'small', 'Concept map').msg;
    ok(/Concept map does not fit: it needs 2\.\d+ in across, and 1 column of the 5\.5×8\.5 page is 0\.8 in wide/.test(colsWhy) && /Give it 3 columns or more/.test(colsWhy), 'a block too narrow for its columns says how wide it needs to be: ' + colsWhy);
  }
  // concept map: bubbles never touch each other, the centre or the edge; the same every time
  {
    let c = 0;
    for (const nb of [3, 4, 5, 6, 7, 8]) for (const [W, H] of [[3.44, 1.4], [3.44, 2.4], [3.44, 4], [2.56, 2.4], [2.2, 2.4], [4.5, 2.4], [1.9, 1.6]]) {
      const mp = NB.mapPlan(nb, W, H);
      if (!mp.ok) continue;
      const E = [mp.centre, ...mp.nodes], bx = (e) => [e.cx - e.rx, e.cy - e.ry, e.cx + e.rx, e.cy + e.ry];
      for (const e of E) { const q = bx(e); assert.ok(q[0] >= 0 && q[1] >= 0 && q[2] <= W && q[3] <= H, `map ${nb} in ${W} x ${H}: a bubble leaves the box`); }
      for (let i = 0; i < E.length; i++) for (let j = i + 1; j < E.length; j++) { const a = bx(E[i]), d = bx(E[j]); assert.ok(a[2] <= d[0] + 1e-9 || d[2] <= a[0] + 1e-9 || a[3] <= d[1] + 1e-9 || d[3] <= a[1] + 1e-9, `map ${nb} in ${W} x ${H}: bubbles ${i} and ${j} touch`); }
      assert.ok(mp.nodes.every((e) => e.rx >= 0.15 && e.ry >= 0.08), `map ${nb} in ${W} x ${H}: a bubble too small to write in`);
      assert.deepEqual(NB.mapPlan(nb, W, H), mp); c++;
    }
    ok(c >= 30, `concept map: branches 3 to 8 in ${c} box sizes never touch each other, the centre or the edge, are big enough to write in, and are the same every time`);
    const small = NB.mapPlan(8, 2.2, 1.0);
    ok(!small.ok || small.nodes.every((e) => e.rx >= 0.05), 'a box too small for eight bubbles is reported (ok false), not drawn overlapping silently');
  }
  // tracing patterns: pure, inside the box and its margin, and they all have something to trace
  {
    let c = 0;
    for (const [id] of NB.TRACE_PATTERNS) for (const [sz] of NB.TRACE_SIZES) for (const [W, H] of [[3.4, 1.4], [2.5, 0.8], [3.4, 4], [1.6, 1.0], [5.8, 2.0]]) {
      const paths = NB.tracePaths(id, sz, W, H), nums = paths.join(' ').match(/-?\d+(\.\d+)?/g).map(Number);
      assert.ok(paths.length >= 1 && nums.length >= 4 && paths.every((d) => /^M[\d.\- L]+$|^M[\d. ]+[VH][\d.]+$/.test(d)), `${id} ${sz} ${W}x${H}: paths ${paths.length}`);
      let pts = 0;
      for (const d of paths) { const xs = [...d.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)]; for (const m of xs) { pts++; const x = +m[1] / 96, y = +m[2] / 96; assert.ok(x >= NB.TRACE_MARGIN - 0.011 && x <= W - NB.TRACE_MARGIN + 0.011 && y >= NB.TRACE_MARGIN - 0.011 && y <= H - NB.TRACE_MARGIN + 0.011, `${id} ${sz} ${W}x${H}: point ${x.toFixed(2)},${y.toFixed(2)} leaves the margin`); } }
      assert.ok(pts >= 2, `${id} ${sz} ${W}x${H}: no points`);
      assert.deepEqual(NB.tracePaths(id, sz, W, H), paths); c++;
    }
    ok(c === 75, `tracing patterns: ${c} combinations (5 patterns, 3 sizes, 5 boxes) stay inside the box and its 0.1 in margin, are plain moveto and lineto paths, and are the same every time`);
    const sp = NB.tracePaths('spiral', 'm', 3.4, 1.4), sl = NB.tracePaths('spiral', 's', 3.4, 1.4);
    ok(sp.length >= 2 && sl.length > sp.length, 'spirals tile the box, more of them at the small size');
  }
}

// ---- 3. every page kind, the fold ----
const day = { date: '2026-10-14', rise: '7:20a', set: '6:00p' };
const stack = (kind, size, blocks) => { // blocks one under the other at full width, each as tall as its minimum at BOTH trims; the Writing space takes the rest
  let row = 1;
  const out = blocks.map((b) => { const r = Math.max(minSpan(b, 4, 'small').rows, minSpan(b, 4, 'letter').rows); const o = at(b, 1, row, 4, r); row += r; return o; });
  if (PAGE_KINDS[kind].body) out.push(at(B('body'), 1, row, 4, gridRows(size, kind) - row + 1));
  return normalize({ v: 2, kind: kind === 'day' ? undefined : kind, grid: true, blocks: out }, size, kind);
};
{
  const parts = { header: '', routines: [], day };
  const render = (kind, L, size = 'small') => (kind === 'day' ? dayBlocks(parts, L, { size }) : kindPage(kind, 'T', L, size, { pageId: 'x' }));
  for (const kind of ['day', 'notes', 'collection', 'blank']) for (const size of SIZES) {
    for (const [t, o] of [['flashstrip', { n: 4 }], ['reviewtracker', { n: 3 }], ['cornell', { n: 6, s: 1 }], ['stimlog', { n: 1 }], ['stimmenu', { rows: 1, ideas: 1 }], ['stimtrace', { h: 10 }], ['conceptmap', { h: 14 }], ['questions', { n: 2 }], ['summarybox', { n: 2 }], ['notearea', { n: 4 }]]) {
      const L = stack(kind, size, [B(t, o)]), html = render(kind, L, size);
      assert.ok(gridProblems(L, size).length === 0, `${kind} ${size} ${t}: ${JSON.stringify(gridProblems(L, size))}`);
      assert.ok(html.includes(`data-zone="${t}"`) && html.includes('class="gc'), `${kind} ${size} ${t}: no zone`);
    }
  }
  ok(true, 'day, Notes, Collection and blank pages: each block sits on the grid at its minimum at both trims and prints with its data-zone');
  const two = render('notes', stack('notes', 'small', [B('flashstrip', { n: 4 }, 'a'), B('flashstrip', { n: 4 }, 'b')]));
  ok(/data-zone="flashstrip"/.test(two) && /data-zone="flashstrip_2"/.test(two), 'a second flash strip on a page is zone flashstrip_2');
  for (const kind of ['day', 'notes', 'collection']) {
    const flow = kind === 'day' ? dayBlocks({ ...parts }, normalize({ v: 2, blocks: [B('flashstrip', { n: 4 }, 's'), B('body')] }), { size: 'small' }) : kindPage(kind, 'T', normalize({ v: 2, kind, blocks: [B('flashstrip', { n: 4 }, 's'), B('body')] }, 'small', kind), 'small', { pageId: 'x' });
    ok(/class="xb flx-fs" data-zone="flashstrip"/.test(flow) && !/class="gc/.test(flow), `${kind} page: a flow layout stacks a flash strip too`);
  }
  const flowBad = () => dayBlocks({ header: '', routines: [] }, normalize({ v: 2, blocks: [B('flashstrip', { split: 40, reviews: 5, gotit: true }), B('body')] }), { size: 'small' });
  assert.throws(flowBad, /does not fit the 5\.5×8\.5 page/);
  ok(dayBlocks({ header: '', routines: [] }, normalize({ v: 2, blocks: [B('flashstrip', { split: 40, reviews: 5, gotit: true }), B('body')] }), { size: 'small', tag: true }).includes('data-b="flashstrip"'), 'a flow layout with a strip too wide for the page stops the build with the reason; the editor still draws it (opt.tag)');
  // a Notes page cannot lose its Writing space to a big block
  const tall = normalize({ v: 2, kind: 'notes', grid: true, blocks: [at(B('cornell', { n: 16, s: 4 }), 1, 1, 4, 24), at(B('body'), 1, 25, 4, 1)] }, 'small', 'notes');
  ok(gridProblems(tall, 'small').some((p) => /Writing space|runs off the bottom/.test(p.msg)), 'a full-page Cornell block does not leave a Notes page its Writing space: it belongs on the blank page');
  // spread days: nothing crosses the fold; each page of a spread holds a strip folded the right way
  const S = normalize({ v: 2, kind: 'spread', grid: true, blocks: [at(B('flashstrip', { answer: 'left', n: 6 }, 'L'), 1, 1, 4, 9), at(B('body'), 1, 10, 4, 15), at(B('flashstrip', { answer: 'right', n: 6 }, 'R'), 5, 1, 4, 9), at(B('notearea', { n: 8 }), 5, 10, 4, 15)] }, 'small', 'spread');
  ok(spreadProblems(S).length === 0, 'a spread: a strip folded on the left edge on the left page, a strip folded on the right edge on the right page: ' + spreadProblems(S).join(' | '));
  const Rp = spreadPage({ header: 'H', headerR: 'HR', routines: [], day }, S, 'R', { size: 'small' }), Lh = spreadPage({ header: 'H', headerR: 'HR', routines: [], day }, S, 'L', { size: 'small' });
  ok(Rp.includes('flx-fs') && Lh.includes('flx-fs') && /Answers on the left/.test(Lh) && /Terms on the left, answers on the right/.test(Rp), 'each page of a spread day prints its own strip: answers on the left edge of the left page, on the right edge of the right page');
  const cross = normalize({ v: 2, kind: 'spread', grid: true, blocks: [at(B('body'), 1, 1, 4, 24), at(B('flashstrip', { n: 4 }), 3, 1, 4, 9)] }, 'small', 'spread');
  ok(gridProblems(cross, 'small').some((p) => p.code === 'fold' && /crosses the fold/.test(p.msg)) && spreadProblems(cross).some((m) => /crosses the fold/.test(m)), 'a strip over the fold of a spread is refused: "crosses the fold"');
  let crossed = 0;
  for (const [t, o] of [['flashstrip', {}], ['cornell', {}], ['stimmenu', {}], ['conceptmap', {}], ['reviewtracker', {}]]) for (const size of SIZES) {
    const L = normalize({ v: 2, kind: 'spread', grid: true, blocks: [at(B('body'), 1, 1, 3, 12), at(B('lines', {}, 'z'), 4, 1, 2, 12)] }, size, 'spread'), b = B(t, o, 'p'), f = placeBlock(L, b, size);
    if (f && Math.ceil(f.col / 4) !== Math.ceil((f.col + f.colSpan - 1) / 4)) crossed++;
    const fr = findFree(L, 3, 5, size); if (fr && Math.ceil(fr.col / 4) !== Math.ceil((fr.col + fr.colSpan - 1) / 4)) crossed++;
  }
  ok(crossed === 0, 'placing a note block on a spread never puts it across the fold');
  ok(GRIDS.spread.fold === 4 && PAGE_KINDS.half && gridRows('small', 'half') === 24, 'the spread: 8 columns, fold after column 4, each page 24 rows');
}

// ---- 4. deterministic, honest content ----
{
  const mk = (t, o, extra = {}) => dayBlocks({ header: '', routines: [], day: { date: '2026-10-14', rise: '', set: '' } }, normalize({ v: 2, kind: 'blank', grid: true, blocks: [at(B(t, o, 'q'), 1, 1, 4, 27)] }, 'small', 'blank'), { size: 'small', kind: 'blank', ...extra });
  for (const t of NB.NOTE_TYPES) { const a = mk(t, {}), b = mk(t, {}); ok(a === b && !/Math\.random|undefined|NaN|Infinity/.test(a), `${t}: the same inputs draw the same page, with no undefined or NaN in it`); }
  const cnt = (html, re) => (html.match(re) || []).length;
  // flash cards
  ok(cnt(mk('flashstrip', { n: 7 }), /class="flx-r"/g) === 7 && cnt(mk('flashstrip', { n: 12 }), /class="flx-r"/g) === 12 && cnt(mk('flashstrip', { n: 4 }), /class="flx-r"/g) === 4, 'a flash strip has 4 to 12 rows');
  ok(cnt(mk('flashstrip', { n: 5 }), /class="nbk-n"/g) === 5 && cnt(mk('flashstrip', { n: 5, num: false }), /class="nbk-n"/g) === 0, 'numbers on each card, or none');
  ok(cnt(mk('flashstrip', { n: 5, reviews: 4 }), /class="nbk-bx"/g) === 20 && cnt(mk('flashstrip', { n: 5, reviews: 0 }), /class="nbk-bx"/g) === 0 && cnt(mk('flashstrip', { n: 5, reviews: 2, gotit: true }), /class="nbk-bx"/g) === 20 && cnt(mk('flashstrip', { n: 5, reviews: 2, gotit: true }), /class="flx-g"/g) === 5, 'review-count ticks on every row (0 to 5), and a got it / again pair when asked for');
  ok(/fold here/.test(mk('flashstrip')) && !/fold here/.test(mk('flashstrip', { hint: false })) && cnt(mk('flashstrip'), /class="flx-f"/g) === 1 && /stroke-dasharray/.test(mk('flashstrip')), 'one dashed fold line and a "fold here" hint (or no hint)');
  for (const [sp, ans] of [[40, 'right'], [50, 'right'], [60, 'right'], [40, 'left'], [60, 'left']]) {
    const html = mk('flashstrip', { split: sp, answer: ans }), at100 = ans === 'left' ? 100 - sp : sp;
    ok(new RegExp(`class="flx-f" style="left:${at100}%"`).test(html) && cnt(html, new RegExp(`grid-template-columns:${ans === 'left' ? `${100 - sp}% ${sp}%` : `${sp}% ${100 - sp}%`}`, 'g')) === 7, `split ${sp} answers ${ans}: the fold line and the header and every row use the same ${at100} percent`);
  }
  // the owner's decision 1: the answers go on the OUTER edge by themselves, so the fold is on the edge you can reach; the manual choices stay
  {
    const R = mk('flashstrip', { answer: 'auto', split: 40 }), Lh = withPageSide('verso', () => mk('flashstrip', { answer: 'auto', split: 40 }));
    ok(/data-flx="auto"/.test(R) && /class="flx-f" style="left:40%"/.test(R) && /fold the right edge/.test(labelsOf(R)) && R === mk('flashstrip', { split: 40 }), 'on a right-hand page (and anywhere a page has no side, like the editor) the outer edge is the right: terms on the left, the fold at 40 percent');
    ok(/data-flx="auto"/.test(Lh) && /class="flx-f" style="left:60%"/.test(Lh) && /fold the left edge/.test(labelsOf(Lh)) && /grid-template-columns:60% 40%/.test(Lh), 'on a left-hand page the same block is mirrored: answers on the left, the fold at 60 percent from the left, "fold the left edge"');
    ok(withPageSide('verso', () => mk('flashstrip', { answer: 'right', split: 40 })) === mk('flashstrip', { answer: 'right', split: 40 }) && withPageSide('recto', () => mk('flashstrip', { answer: 'left', split: 40 })) === mk('flashstrip', { answer: 'left', split: 40 }) && !/data-flx/.test(mk('flashstrip', { answer: 'left' })), 'the manual choices never flip: "always right" stays right on a left-hand page, "always left" stays left on a right-hand one');
    withPageSide('verso', () => withPageSide('recto', () => mk('flashstrip')));
    ok(/class="flx-f" style="left:40%"/.test(mk('flashstrip', { split: 40 })), 'the page side is put back after a page is drawn, nested or not (no side leaks into the next page)');
    let thrown = false; try { withPageSide('verso', () => { throw new Error('x'); }); } catch { thrown = true; }
    ok(thrown && !/flx-f" style="left:60%"/.test(mk('flashstrip', { split: 40 })), 'and put back even when the page cannot be drawn');
  }
  ok(/Nothing is cut out/.test(labelsOf(mk('flashstrip'))) && !/perforat|cut out along|scissors/i.test(mk('flashstrip').replace('Nothing is cut out', '')), 'a flash strip has no perforation, scissors or cut-out cards: it says nothing is cut out');
  // the other study blocks
  ok(cnt(mk('questions', { n: 6 }), /class="nbk-n">\d+</g) === 6 && cnt(mk('questions', { n: 6, answers: false }), /class="nbk-q"/g) === 6 && cnt(mk('questions', { n: 6 }), /class="nbk-q"/g) === 12 && cnt(mk('questions', { n: 6, tick: false }), /class="nbk-bx"/g) === 0 && cnt(mk('questions', { n: 6 }), /class="nbk-bx"/g) === 6, 'questions: numbered, an answer line under each (or not), a box to tick when answered (or not)');
  const steps = (o) => NB.reviewSteps(B('reviewtracker', o)).length;
  ok(cnt(mk('reviewtracker', { n: 5 }), /class="flx-c"/g) === 5 * 4 && cnt(mk('reviewtracker', { n: 3, every: { d1: true, d3: false, d7: false, d14: true, d21: false, d30: true } }), /class="flx-c"/g) === 9 && ['1d', '3d', '7d', '21d'].every((d) => new RegExp(`class="flx-l">${d}<`).test(mk('reviewtracker'))) && steps({}) === 4, 'review tracker: a tick for each topic and review time (1, 3, 7 and 21 days by default; 14 and 30 on request), labelled in the header');
  ok(/flx-l">date</.test(mk('reviewtracker')) && !/flx-l">date</.test(mk('reviewtracker', { date: false })), 'review tracker: a learned-on date column, or none');
  ok(/rhythm to change as you like/.test(labelsOf(mk('reviewtracker'))), 'review tracker: the text alternative says the rhythm is a starting point');
  ok(/Topic/.test(mk('cornell')) && !/Topic/.test(mk('cornell', { head: false })) && /Cues/.test(mk('cornell')) && /Summary/.test(mk('cornell')) && /grid-template-columns:35% 1fr/.test(mk('cornell')) && /grid-template-columns:30% 1fr/.test(mk('cornell', { cue: 30 })), 'cornell: a topic and date line, a cue column, notes and a summary strip; the cue share is an option');
  ok(/Topic/.test(mk('notearea')) && /Date/.test(mk('notearea')) && !/Source/.test(mk('notearea')) && /Source/.test(mk('notearea', { source: true })) && !/Topic/.test(mk('notearea', { topic: false })) && /nbk-bl/.test(mk('notearea', { paper: 'blank' })) && /class="ru pd/.test(mk('notearea', { paper: 'dots' })) && /class="ru pg/.test(mk('notearea', { paper: 'grid' })), 'note area: topic, date and source lines on request; ruled, dot, 4 mm grid or blank paper');
  ok(cnt(mk('conceptmap', { branches: 6 }), /<ellipse/g) === 7 && cnt(mk('conceptmap', { branches: 3 }), /<ellipse/g) === 4 && /role="group" aria-label="Concept map: a centre bubble with 6 branches/.test(mk('conceptmap', { branches: 6 })), 'concept map: a centre bubble and the branches you ask for');
  ok(/In my own words/.test(mk('summarybox')) && /In one sentence/.test(mk('summarybox', { prompt: 'one' })) && !/nbk-c/.test(mk('summarybox', { prompt: 'none' })), 'summary box: a prompt you choose, or none');
  // stimming
  ok(/Stimming is self-regulation\./.test(mk('stimlog')) && !/Stimming is self-regulation\./.test(mk('stimlog', { note: false })) && /My stims are valid\./.test(mk('stimmenu')), 'stim log and stim menu carry the line that says so (and it can be switched off)');
  ok(cnt(mk('stimlog', { n: 4 }), /class="stm-e"/g) === 4 && cnt(mk('stimlog', { n: 3 }), /class="bub"/g) === 3 * 10 && cnt(mk('stimlog', { n: 3, ba: false }), /class="bub"/g) === 0 && cnt(mk('stimlog', { n: 3, size: true }), /class="bub"/g) === 3 * 15 && /felt good/.test(mk('stimlog')) && /where \/ helped/.test(mk('stimlog')) && !/where \/ helped/.test(mk('stimlog', { where: false })), 'stim log: entries with when, what felt good, where it helped, how settled before and after (and how much, 1 to 5, when asked)');
  const log = mk('stimlog'), lt = text(log);
  ok(!/\b(good|bad)\b/i.test(lt.replace(/felt good/gi, '')) && !/\b(wrong|problem|too much|reduce|stop)\b/i.test(lt), 'the stim log\'s words are neutral: "felt good" is the only judgement word, and it is the person\'s own');
  ok(cnt(mk('stimmenu'), /class="stm-s"/g) === 6 && cnt(mk('stimmenu', { rows: 3 }), /class="stm-q"/g) === 6 * 3 + 2 && cnt(mk('stimmenu', { senses: { touch: true, move: true, sound: false, sight: false, chew: false, press: false }, rows: 2, ideas: 0 }), /class="stm-q"/g) === 4 && ['Touch', 'Movement', 'Sound', 'Sight', 'Taste and chew', 'Deep pressure'].every((s) => mk('stimmenu').includes(`<span>${s}</span>`)) && /new stim idea/.test(mk('stimmenu')) && !/new stim idea/.test(mk('stimmenu', { ideas: 0 })), 'stim menu: the six senses (or the ones you pick), boxes and free lines, and blank rows for new stim ideas');
  {
    const plainMenu = mk('stimmenu', { rows: 3 }), ex = mk('stimmenu', { rows: 3, examples: true }), shown = [...ex.matchAll(/class="stm-x">([^<]*)</g)].map((m) => m[1]);
    ok(!/stm-x/.test(plainMenu) && shown.length === 6 * 3 && shown.slice(0, 3).join() === NB.STIM_EXAMPLES.touch.slice(0, 3).join() && cnt(ex, /class="stm-q"/g) === cnt(plainMenu, /class="stm-q"/g) && cnt(ex, /class="nbk-bx"/g) === cnt(plainMenu, /class="nbk-bx"/g), 'with examples on, each sense prints as many examples as it has rows, in the lines; the boxes are still blank and the rows are the same');
    ok(shown.every((w) => Object.values(NB.STIM_EXAMPLES).flat().includes(w)) && cnt(mk('stimmenu', { rows: 1, examples: true }), /class="stm-x"/g) === 6 && cnt(mk('stimmenu', { rows: 4, examples: true }), /class="stm-x"/g) === 24 && cnt(mk('stimmenu', { rows: 4, examples: true, senses: { touch: true, move: false, sound: false, sight: false, chew: false, press: false } }), /class="stm-x"/g) === 4, 'one to four examples a sense, only for the senses that are on, all from the project\'s own list');
    ok(/a few examples printed lightly in the lines/.test(labelsOf(ex)) && !/a few examples/.test(labelsOf(plainMenu)) && /My stims are valid\./.test(labelsOf(ex)), 'the text alternative says examples are printed, and still says the stims are valid');
    ok(NB.stimmenuNeed(B('stimmenu', { examples: true })) > NB.stimmenuNeed(B('stimmenu')) && NB.noteFit(B('stimmenu', { examples: true }), 2, undefined, 'small', 'Stim menu') !== null, 'the menu with examples needs a little more width than the plain one, and a narrower cell is refused');
  }
  for (const [id] of NB.TRACE_PATTERNS) {
    const h = mk('stimtrace', { pattern: id });
    ok(/trace slowly/.test(h) && cnt(h, /<path d="M/g) >= 2 && /A quiet stim/.test(labelsOf(h)) && /stroke-width="1\.6"/.test(h) && !/<image|<img|<text|<tspan|href=/.test(h), `stim trace (${id}): "trace slowly" hint, vector paths only (no image, no text), 1.6 px strokes`);
  }
  ok(/class="nbk-tf fr"/.test(mk('stimtrace')) && !/class="nbk-tf fr"/.test(mk('stimtrace', { frame: false })), 'stim trace: a frame, or none');
  // every block: no image anywhere, a text alternative, drawing parts hidden from readers
  for (const t of NB.NOTE_TYPES) { const html = mk(t, {}); ok(!/<img|data:image|<image|src=|href=/i.test(html) && /role="group" aria-label="[^"]{20,}"/.test(html) && (!['cornell', 'conceptmap', 'flashstrip', 'reviewtracker', 'stimtrace'].includes(t) || cnt(html, /aria-hidden="true"/g) >= 1), `${t}: no image in the markup; a text alternative (role group and aria-label); the drawing parts are hidden from readers`); }
  ok(/aria-label="Flash cards: 6 fold-over cards\. Terms on the left, answers on the right: fold the right edge of the page along the dashed line to hide the answers\. Each card has 3 tick boxes to count reviews\. Nothing is cut out\."/.test(mk('flashstrip')), 'the flash strip\'s text alternative says how to fold it: ' + /aria-label="([^"]*)"/.exec(mk('flashstrip'))[1]);
  // class names and stroke weights
  const others = ['render.mjs', 'pages.mjs', 'scan.mjs', 'puzzles/render.mjs', 'rulings.mjs', 'a11yprint.mjs', 'photo.mjs', 'bookedit.mjs'].map((f) => fs.readFileSync(f, 'utf8')).join('\n');
  ok(!/(?<![\w-])(nbk|flx|stm)-[a-z]/.test(others), 'the class names nbk-, flx- and stm- are used by these blocks alone, so their CSS cannot restyle another page (check-identical compares HTML, so a clash would not show there)');
  const css = DAYPAGE_CSS.replace(/\/\*[\s\S]*?\*\//g, ''), mine = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter((m) => /(nbk|flx|stm)-/.test(m[1]));
  const widths = mine.flatMap((m) => [...m[2].matchAll(/border(?:-(?:top|left|right|bottom))?\s*:\s*([\d.]+)px/g)].map((x) => +x[1]));
  ok(mine.length >= 25 && widths.length >= 5 && widths.every((w) => w >= 1), `every border these blocks draw is 1 px (0.75 pt) or more (${widths.length} of them in ${mine.length} rules)`);
  const sw = NB.NOTE_TYPES.flatMap((t) => [...mk(t, {}).matchAll(/stroke-width="([\d.]+)"/g)].map((x) => +x[1]));
  ok(sw.length >= 20 && sw.every((w) => w >= 1), `every SVG stroke is 1 px (0.75 pt) or more (${sw.length} strokes)`);
  const html0 = dayBlocks({ header: '', routines: [] }, DEFAULT_LAYOUT, { size: 'small' });
  ok(!/nbk-|flx-|stm-/.test(html0) && !DEFAULT_LAYOUT.blocks.some((b) => NB.isNote(b)), 'the default day page has no note markup (the default build is checked byte for byte by check-identical.mjs)');
}

// ---- 5. the books: every kind of page, both trims, with and without the print accessibility options ----
const MONTH = '2026-10';
const must = (r) => { assert.ok(r.book, r.err); return r.book; };
const cat = await catalog(MONTH, DEFAULT_BOOK);
let noteBook = DEFAULT_BOOK;
{
  const weekends = structuredClone(DEFAULT_BOOK); weekends.default.find((e) => e.type === 'weeks').options.week.find((e) => e.type === 'days').options = { weekdays: { sat: 'spread', sun: 'spread' } };
  let b = weekends;
  const add = (type, title) => { b = must(addEntry(b, cat, null, type, { before: 'theme' }, { title })); };
  add('notes', 'Cards'); add('notes', 'Left cards'); add('collection', 'Study'); add('notes', 'Map'); add('notes', 'Regulation'); add('notes', 'Menu'); add('notes', 'Trace one'); add('notes', 'Trace two'); add('notes', 'Trace three'); add('notes', 'Note area');
  const L = (kind, blocks) => stack(kind, 'small', blocks), set = (id, kind, blocks) => { b = must(setLayout(b, cat, null, id, L(kind, blocks))); };
  set('blank', 'blank', [B('cornell', { n: 14, s: 3, head: true })]);
  set('notes_1', 'notes', [B('flashstrip', { n: 4, gotit: true, reviews: 3 }, 'a'), B('flashstrip', { n: 4, reviews: 4, hint: false, num: false }, 'b')]);
  set('notes_2', 'notes', [B('flashstrip', { n: 5, answer: 'left', split: 60, reviews: 2 }, 'a'), B('summarybox', { n: 3 })]);
  set('collection_1', 'collection', [B('questions', { n: 2 }), B('summarybox', { n: 2 }), B('reviewtracker', { n: 4 })]);
  set('notes_3', 'notes', [B('conceptmap', { branches: 6, h: 24 })]);
  set('notes_4', 'notes', [B('stimlog', { n: 2, size: true }), B('stimtrace', { pattern: 'waves', size: 'm', h: 14 })]);
  set('notes_5', 'notes', [B('stimmenu', { rows: 2, ideas: 1 })]);
  set('notes_6', 'notes', [B('stimtrace', { pattern: 'waves', size: 's', h: 14 }, 'a'), B('stimtrace', { pattern: 'zigzag', size: 'm', h: 14 }, 'b')]);
  set('notes_7', 'notes', [B('stimtrace', { pattern: 'loops', size: 'l', h: 14 }, 'a'), B('stimtrace', { pattern: 'spiral', size: 'm', h: 14 }, 'b')]);
  set('notes_8', 'notes', [B('stimtrace', { pattern: 'grid', size: 's', h: 14, frame: false }, 'a'), B('stimtrace', { pattern: 'spiral', size: 's', h: 14 }, 'b')]);
  set('notes_9', 'notes', [B('notearea', { n: 6, source: true, paper: 'dots' }), B('notearea', { n: 3, title: 'Grid', paper: 'grid', topic: false }, 'g')]);
  noteBook = b;
  ok(validateBook(noteBook).length === 0, 'a book with note, flash card and stimming blocks on the blank page, Notes pages and a Collection page validates: ' + validateBook(noteBook).join('; '));
  const wide = structuredClone(noteBook), e = wide.default.find((x) => x.id === 'notes_1'); e.layout = normalize({ v: 2, kind: 'notes', grid: true, blocks: [at(B('flashstrip', { split: 40, reviews: 5, gotit: true }), 1, 1, 4, 9), at(B('body'), 1, 10, 4, 15)] }, 'letter', 'notes');
  ok(validateBook(wide).length === 0 || validateBook(wide).every((m) => /does not fit/.test(m)), 'a strip too wide for any trim is a book.json problem that says "does not fit" (a book that fits only 8.5x11 is still valid)');
}
const dayFile = (() => {
  const left = normalize({ v: 2, kind: 'spread', grid: true, blocks: [at(B('sky'), 1, 1, 4, 2), at(B('flashstrip', { n: 6, answer: 'auto' }, 'L'), 1, 3, 4, 9), at(B('body', { style: 'lines' }), 1, 12, 4, 13), at(B('flashstrip', { n: 6, answer: 'auto' }, 'R'), 5, 1, 4, 9), at(B('stimtrace', { pattern: 'spiral', h: 14 }), 5, 10, 4, 8), at(B('notearea', { n: 4 }), 5, 18, 4, 7)] }, 'small', 'spread');
  assert.equal(spreadProblems(left).length, 0, spreadProblems(left).join('; '));
  return { ...normalize({ v: 2, grid: true, blocks: [at(B('sky'), 1, 1, 4, 2), at(B('flashstrip', { n: 4, split: 40, answer: 'right' }), 1, 3, 4, 7), at(B('stimlog', { n: 1 }), 1, 10, 4, 6), at(B('body'), 1, 16, 4, 9)] }), spread: left };
})();
const lib = libraryFromProfile(PROFILE); lib.layouts = [{ id: 'mine', name: 'Note pages', book: noteBook, day: dayFile }]; lib.books[0].layoutRef = 'mine';
const libFile = path.join(TMP, 'library.json'); fs.writeFileSync(libFile, JSON.stringify(lib));
const a11yProfile = (() => { const p = JSON.parse(fs.readFileSync('content/profile.json', 'utf8')); p.print = { large_print: true, high_contrast: true }; const f = path.join(TMP, 'a11y.json'); fs.writeFileSync(f, JSON.stringify(p)); return f; })();
const run = (s, a, env = {}) => execFileSync('node', [s, ...a], { env: { ...process.env, KW_LIBRARY: libFile, ...env }, stdio: 'pipe' }).toString();
const builds = {};
const TAGS = (process.env.NB_TAGS || 'small,letter,small-a11y,letter-a11y').split(',');
for (const tag of TAGS) {
  const size = /letter/.test(tag) ? 'letter' : 'small', prof = /a11y/.test(tag) ? a11yProfile : null;
  const out = `${ROOT}/${tag}`, env = { KW_OUT: out, SIZE: size, ...(prof ? { KW_PROFILE: prof } : {}) };
  run('render.mjs', ['month', MONTH, 'test.ics'], env);
  const dirName = `m${MONTH}${size === 'letter' ? '-letter' : ''}`, dir = `${out}/${dirName}`, lay = JSON.parse(fs.readFileSync(`${dir}/layout.json`, 'utf8'));
  builds[tag] = { dir, out, dirName, lay, size, env, html: `${dir}/journal.html`, pdf: `${dir}/${fs.readdirSync(dir).find((f) => /interior.*\.pdf$/.test(f))}` };
  const label = `${TRIM[size]}${prof ? ' with large print and high contrast on' : ''}`;
  ok(/^\[\] 0$/.test(run('check.mjs', [dirName], env).trim()), `${label}: check.mjs, every page fits ("[] 0")`);
  const pg = (id) => lay.pages.find((p) => p.id === id), zones = (id) => (pg(id) ? pg(id).zones.map((z) => z.zone) : []);
  const want = { blank: ['cornell'], notes_1: ['flashstrip', 'flashstrip_2'], notes_2: ['flashstrip', 'summarybox'], collection_1: ['questions', 'summarybox', 'reviewtracker'], notes_3: ['conceptmap'], notes_4: ['stimlog', 'stimtrace'], notes_5: ['stimmenu'], notes_6: ['stimtrace', 'stimtrace_2'], notes_9: ['notearea', 'notearea_2'], 'day.2026-10-14': ['flashstrip', 'stimlog'], 'day.2026-10-03': ['flashstrip'], 'day.2026-10-03.cont': ['flashstrip', 'stimtrace', 'notearea'] };
  ok(Object.entries(want).every(([id, zs]) => zs.every((z) => zones(id).includes(z))), `${label}: layout.json maps a zone for every note block, on Notes, Collection, blank, day and both pages of a spread day`);
  ok(Object.keys(want).filter((id) => id !== 'blank').every((id) => ['date', 'title', 'tags'].some((z) => zones(id).includes(z)) && zones(id).includes('page_code')) && pg('day.2026-10-14').zones.every((z) => z.w > 0 && z.h > 0), `${label}: the fixed scan zones (header, SEND TO strip, page code) are still on those pages, and every zone has a size`);
  ok(!/Type 3/.test(execFileSync('pdffonts', [builds[tag].pdf]).toString()), `${label}: no Type 3 fonts`);
  ok(execFileSync('pdfimages', ['-list', builds[tag].pdf]).toString().trim().split('\n').length <= 2, `${label}: no raster image in the PDF (every pattern, line and box is vector)`);
  ok(/ok/.test(run('check-pages.mjs', [dir], env)), `${label}: check-pages: ids and printed labels are unique`);
  ok(/ok/.test(run('check-codes.mjs', [dir], { ...env, DECODE: 'sample' })), `${label}: check-codes: page codes are unique and decode`);
  if (prof) ok(/data-a11y="large contrast"/.test(fs.readFileSync(builds[tag].html, 'utf8')), `${label}: the options are really on (data-a11y="large contrast")`);
}

// ---- 6. measured on the built pages and in the PDF ----
const pgm = (file) => { // a binary PGM (P5) from pdftoppm -gray
  const buf = fs.readFileSync(file); let i = 0; const tok = () => { while (buf[i] <= 32) i++; let s = ''; while (buf[i] > 32) s += String.fromCharCode(buf[i++]); return s; };
  tok(); const w = +tok(), h = +tok(); tok(); i++;
  return { w, h, px: buf.subarray(i, i + w * h) };
};
const DPI = 300;
// The dark pixels inside a rectangle (inches from the page's top left) of one PDF page: their box, in inches from the rectangle's corner.
const ink = (pdf, pageNo, r, thr = 215) => {
  const f = path.join(TMP, `r${n}-${pageNo}-${Math.round(r.x * 100)}`), px = (v) => Math.max(0, Math.round(v * DPI));
  execFileSync('pdftoppm', ['-r', String(DPI), '-f', String(pageNo), '-l', String(pageNo), '-gray', '-singlefile', '-x', String(px(r.x)), '-y', String(px(r.y)), '-W', String(px(r.w)), '-H', String(px(r.h)), pdf, f]);
  const im = pgm(f + '.pgm'); fs.rmSync(f + '.pgm');
  let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1, dark = 255;
  for (let y = 0; y < im.h; y++) for (let x = 0; x < im.w; x++) { const v = im.px[y * im.w + x]; if (v < thr) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (v < dark) dark = v; } }
  return x1 < 0 ? null : { l: x0 / DPI, t: y0 / DPI, r: (x1 + 1) / DPI, b: (y1 + 1) / DPI, dark, im };
};
const browser = await launch();
const domOf = async (htmlFile) => {
  const p = await browser.newPage();
  await p.goto('file://' + path.resolve(htmlFile), { waitUntil: 'networkidle' }); await p.evaluate(() => document.fonts.ready);
  const pages = await p.evaluate(() => [...document.querySelectorAll('.page')].map((pg, i) => {
    const a = pg.getBoundingClientRect(), rel = (el) => { const c = el.getBoundingClientRect(); return { x: (c.left - a.left) / 96, y: (c.top - a.top) / 96, w: c.width / 96, h: c.height / 96 }; };
    const bw = (el) => parseFloat(getComputedStyle(el).borderTopWidth || '0');
    return {
      n: i + 1, id: pg.dataset.pageId, side: pg.classList.contains('verso') ? 'verso' : 'recto', page: { w: a.width / 96, h: a.height / 96 },
      strips: [...pg.querySelectorAll('.flx-fs')].map((s) => {
        const rw = s.querySelector('.flx-rw'), f = s.querySelector('.flx-f'), rows = [...s.querySelectorAll('.flx-r')], t0 = rows[0].querySelector('.flx-t'), a0 = rows[0].querySelector('.flx-a');
        return { auto: s.dataset.flx === 'auto', box: rel(s), rw: rel(rw), fold: rel(f), left: f.style.left, rows: rows.map(rel), term: rows.map((r) => rel(r.querySelector('.flx-t'))), ans: rows.map((r) => rel(r.querySelector('.flx-a'))), termFirst: !!(t0.compareDocumentPosition(a0) & Node.DOCUMENT_POSITION_FOLLOWING), ticks: s.querySelectorAll('.flx-t .nbk-bx').length, boxW: [...s.querySelectorAll('.nbk-bx')].map(bw), hint: s.querySelector('.flx-ah') ? s.querySelector('.flx-ah').textContent.trim() : '', head: rel(s.querySelector('.flx-hd')), cells: [...s.querySelectorAll('.flx-hd > div')].map(rel) };
      }),
      blocks: [...pg.querySelectorAll('.xb[data-zone], .gc > .xb')].filter((x) => /(nbk|flx|stm)-/.test(x.className)).map((x) => ({ cls: x.className, box: rel(x), cell: x.closest('.gc') ? rel(x.closest('.gc')) : null, overflow: x.closest('.gc') ? x.closest('.gc').scrollHeight > x.closest('.gc').clientHeight + 1 || x.closest('.gc').scrollWidth > x.closest('.gc').clientWidth + 1 : false })),
      traces: [...pg.querySelectorAll('.nbk-tr')].map((s) => ({ box: rel(s), paths: s.querySelectorAll('path').length })),
    };
  }));
  const problems = await p.evaluate(pageProblems); await p.close();
  return { pages, problems };
};
const TOL = 0.004;
{
  const meas = {};
  for (const tag of TAGS) {
    const bd = builds[tag], d = await domOf(bd.html), page = (id) => d.pages.find((p) => p.id === id), no = (id) => bd.lay.pages.find((p) => p.id === id).page, z = PH.zoomOf(bd.size);
    meas[tag] = d;
    const label = `${TRIM[bd.size]}${/a11y/.test(tag) ? ' (large print, high contrast)' : ''}`;
    // the fold line: one x for every row, where the term cells and the answer cells meet
    let strips = 0;
    for (const pg of d.pages) for (const s of pg.strips) {
      strips++;
      const left = s.left.endsWith('%') ? parseFloat(s.left) : NaN, foldX = s.fold.x + s.fold.w / 2;
      assert.ok(near(foldX, s.rw.x + (left / 100) * s.rw.w, TOL), `${label} ${pg.id}: the fold line is at ${foldX.toFixed(4)} in, ${left} percent of the strip is ${(s.rw.x + (left / 100) * s.rw.w).toFixed(4)}`);
      const seam = s.termFirst ? s.term.map((t) => t.x + t.w) : s.term.map((t) => t.x), seam2 = s.termFirst ? s.ans.map((t) => t.x) : s.ans.map((t) => t.x + t.w);
      assert.ok(seam.every((x) => near(x, foldX, TOL)) && seam2.every((x) => near(x, foldX, TOL)), `${label} ${pg.id}: every row\'s term and answer cells meet at the fold line (${seam.map((x) => x.toFixed(3)).join(' ')} | ${seam2.map((x) => x.toFixed(3)).join(' ')} vs ${foldX.toFixed(3)})`);
      assert.ok(near(s.fold.y, s.rw.y, TOL) && near(s.fold.h, s.rw.h, 0.006) && s.rows.every((r) => near(r.w, s.rw.w, TOL) && near(r.x, s.rw.x, TOL)), `${label} ${pg.id}: the fold line runs the whole height of the rows, and every row is as wide as the strip`);
      assert.ok(s.boxW.every((w) => w * z >= 0.99) && s.hint !== undefined, `${label} ${pg.id}: tick boxes have 1 px (0.75 pt) borders or more`);
      
      // the strip spans the whole width of its columns, so the fold is a fixed share of the page's content width
      const cw = PH.cellWidth(4, bd.size) * z;
      assert.ok(near(s.box.w, cw, TOL), `${label} ${pg.id}: a 4-column strip is ${cw.toFixed(4)} in wide on paper (${s.box.w.toFixed(4)})`);
    }
    assert.ok(strips >= 8, `${label}: ${strips} strips found`);
    // the share is physical: 50 percent of 3.45 in (5.5x8.5) or 5.85 in (8.5x11) from the strip's left edge; two strips on a page share the line
    const c1 = page('notes_1').strips; assert.ok(c1.length === 2 && near(c1[0].fold.x, c1[1].fold.x, 0.0005), `${label}: the two strips on the Cards page fold along the same line (${c1.map((s) => s.fold.x.toFixed(4)).join(' and ')} in)`);
    assert.ok(near(c1[0].fold.x + c1[0].fold.w / 2 - c1[0].box.x, 0.5 * PH.cellWidth(4, bd.size) * z, TOL), `${label}: an even fold is half of ${(PH.cellWidth(4, bd.size) * z).toFixed(3)} in from the strip's left edge`);
    const l1 = page('notes_2').strips[0]; assert.ok(!l1.termFirst && near(l1.fold.x + l1.fold.w / 2 - l1.box.x, 0.4 * PH.cellWidth(4, bd.size) * z, TOL), `${label}: answers on the left with a 60 percent term side: the fold is 40 percent from the left edge`);
    const r1 = page('day.2026-10-14').strips[0]; assert.ok(r1.termFirst && near(r1.fold.x + r1.fold.w / 2 - r1.box.x, 0.4 * PH.cellWidth(4, bd.size) * z, TOL), `${label}: on the day page a 40 percent term side puts the fold 40 percent in`);
    // the owner's decision 1: a strip set to "the outer edge" folds on the outer edge of EVERY page, left or right, in a day book, on Notes pages and on a spread day
    const autos = d.pages.flatMap((pg) => pg.strips.filter((s) => s.auto).map((s) => ({ pg, s })));
    assert.ok(autos.length >= 5 && autos.some((x) => x.pg.side === 'verso') && autos.some((x) => x.pg.side === 'recto'), `${label}: ${autos.length} auto strips, on both left-hand and right-hand pages`);
    for (const { pg, s } of autos) {
      assert.ok(s.termFirst === (pg.side === 'recto'), `${label} ${pg.id} (${pg.side}): answers go on the outer edge (terms first on a right-hand page, answers first on a left-hand one)`);
      const foldFrom = (s.fold.x + s.fold.w / 2 - s.box.x) / s.box.w;
      const share = s.term[0].w / s.rw.w; assert.ok(near(foldFrom, pg.side === 'recto' ? share : 1 - share, 0.004), `${label} ${pg.id}: the fold sits ${(foldFrom * 100).toFixed(1)} percent in from the left, answer side on the outer edge`);
    }
    const cards = page('notes_1').strips; assert.ok(cards.length === 2 && cards.every((s) => s.auto) && cards[0].termFirst === (page('notes_1').side === 'recto'), `${label}: both strips of the Cards page flip together and still fold along one line`);
    n++; console.log(`ok   ${label}: ${autos.length} strips set to the outer edge fold on the outer edge of their page (${autos.filter((x) => x.pg.side === 'verso').length} on left-hand pages, ${autos.filter((x) => x.pg.side === 'recto').length} on right-hand pages, the spread day included)`);
    // the spread day: each page holds a strip that folds on its own outer edge, inside its page, away from the spine
    const sl = page('day.2026-10-03').strips[0], sr = page('day.2026-10-03.cont').strips[0];
    assert.ok(!sl.termFirst && sr.termFirst && sl.box.x >= 0.9 && sr.box.x >= 0.9 && sl.box.x + sl.box.w <= page('day.2026-10-03').page.w - 0.2 && sr.box.x + sr.box.w <= page('day.2026-10-03.cont').page.w - 0.2, `${label}: both pages of a spread day hold their own strip, answers on the left on the left page and on the right on the right page, wholly inside each page (nothing crosses the spread fold)`);
    // the blocks fit their cells (the gate says so too), and no block is taller than its minimum span
    let nb = 0;
    for (const pg of d.pages) for (const b of pg.blocks) { nb++; assert.ok(!b.overflow, `${label} ${pg.id}: ${b.cls} overflows its cell`); if (b.cell) assert.ok(b.box.h <= b.cell.h + 0.011 && b.box.w <= b.cell.w + 0.011, `${label} ${pg.id}: ${b.cls} (${b.box.w.toFixed(3)} x ${b.box.h.toFixed(3)}) is bigger than its cell (${b.cell.w.toFixed(3)} x ${b.cell.h.toFixed(3)})`); }
    assert.ok(nb >= 22, `${label}: ${nb} note blocks measured`);
    assert.ok(d.problems.length === 0, `${label}: pageProblems ${JSON.stringify(d.problems)}`);
    // the patterns: drawn, and inside their boxes
    const tr = ['notes_6', 'notes_7', 'notes_8', 'notes_4'].flatMap((id) => page(id).traces); assert.ok(tr.length >= 7 && tr.every((t) => t.paths >= 1 && t.box.w > 1 && t.box.h > 0.5), `${label}: ${tr.length} tracing patterns drawn`);
    n++; console.log(`ok   ${label}: ${strips} fold-over strips fold true (one line at a fixed x, cells meeting exactly there, two strips sharing it), ${nb} blocks fit their cells, ${tr.length} patterns drawn, overflow gate clean`);
  }
  // large print and high contrast change type and ink, never where the fold is
  if (TAGS.includes('small') && TAGS.includes('small-a11y')) for (const t of ['small', 'letter']) {
    if (!TAGS.includes(t) || !TAGS.includes(t + '-a11y')) continue;
    const rel = (m, id) => m.pages.find((p) => p.id === id).strips.map((s) => +((s.fold.x - s.box.x) / s.box.w).toFixed(3));
    ok(['notes_1', 'notes_2', 'day.2026-10-14', 'day.2026-10-03', 'day.2026-10-03.cont'].every((id) => JSON.stringify(rel(meas[t], id)) === JSON.stringify(rel(meas[t + '-a11y'], id))), `${TRIM[t === 'small' ? 'small' : 'letter']}: large print and high contrast leave every fold line where it was (the same share of the strip)`);
  }
  // the PDF itself: the fold line is where the page says, dashed, and at least 0.75 pt
  for (const tag of TAGS.filter((t) => !/a11y/.test(t))) {
    const bd = builds[tag], d = meas[tag], pg = d.pages.find((p) => p.id === 'notes_1'), s = pg.strips[0], no = bd.lay.pages.find((p) => p.id === 'notes_1').page;
    const foldX = s.fold.x + s.fold.w / 2, band = { x: foldX - 0.06, y: s.rw.y + 0.01, w: 0.12, h: s.rw.h - 0.02 };
    const m = ink(bd.pdf, no, band, 200), cx = m ? (m.l + m.r) / 2 + band.x : NaN;
    assert.ok(m && near(cx, foldX, 0.02), `${TRIM[bd.size]}: the dashed fold line in the PDF is at ${cx.toFixed(3)} in, the page says ${foldX.toFixed(3)}`);
    // dashes: along the line, ink rows alternate with gaps (count the runs)
    let runs = 0, prev = false, best = 0; const colA = Math.round((foldX - band.x - 0.02) * DPI), colB = Math.round((foldX - band.x + 0.02) * DPI);
    for (let y = 0; y < m.im.h; y++) { let dk = 255, sum = 0; for (let x = colA; x <= colB; x++) { const v = m.im.px[y * m.im.w + x]; if (v < dk) dk = v; sum += Math.max(0, 255 - v) / (255 - 0x8c); } const on = dk < 200; if (on && !prev) runs++; prev = on; if (on) best = Math.max(best, sum); }
    assert.ok(runs >= 8, `${TRIM[bd.size]}: the fold line is dashed in the PDF (${runs} dashes down the strip)`);
    const minPx = 0.75 * DPI / 72;
    assert.ok(best >= minPx * 0.9, `${TRIM[bd.size]}: the fold line is ${(best / DPI * 72).toFixed(2)} pt thick in the PDF raster (the floor is 0.75 pt, within anti-aliasing)`);
    n++; console.log(`ok   ${TRIM[bd.size]}: the fold line in the 300 dpi PDF is ${runs} dashes at ${cx.toFixed(3)} in (the page says ${foldX.toFixed(3)}), ${(best / DPI * 72).toFixed(2)} pt thick`);
    // a tracing pattern: ink inside its box and inside the margin, nothing outside
    const tr = d.pages.find((p) => p.id === 'notes_6').traces[0], tn = bd.lay.pages.find((p) => p.id === 'notes_6').page, t = ink(bd.pdf, tn, { x: tr.box.x + 0.03, y: tr.box.y + 0.03, w: tr.box.w - 0.06, h: tr.box.h - 0.06 }, 215);
    assert.ok(t, 'no pattern ink');
    const mg = NB.TRACE_MARGIN * PH.zoomOf(bd.size);
    assert.ok(t.l + (tr.box.x + 0.03) >= tr.box.x + mg - 0.04 && t.t + (tr.box.y + 0.03) >= tr.box.y + mg - 0.04 && t.r + (tr.box.x + 0.03) <= tr.box.x + tr.box.w - mg + 0.04 && t.b + (tr.box.y + 0.03) <= tr.box.y + tr.box.h - mg + 0.04, `${TRIM[bd.size]}: the waves in the PDF stay inside their box and its margin`);
    n++; console.log(`ok   ${TRIM[bd.size]}: the tracing pattern in the PDF is vector ink inside its box and its margin`);
  }
}
await browser.close();
console.log(`test-noteblocks: ${n} checks passed`);
