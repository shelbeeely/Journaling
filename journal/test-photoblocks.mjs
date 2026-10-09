// Photo blocks test (PH1, BUILD-PLAN section 23): frames for prints that are PASTED on the paper. photoframe, photostrip, photodaily, contactsheet.
// Proves (1) the blocks are declared like every other block (options, group, icon, palette, no image anywhere), (2) the print sizes are physical
// and the fit rules are right per trim and per grid width, with a plain reason for every refusal, (3) the blocks work on every page kind (day,
// Notes, Collection, blank, the two pages of a spread day), nothing crosses the fold and the gutter keep-out holds, (4) the drawing is
// deterministic and the photo-a-day block counts the month's days and honours the day start, (5) SIZES ARE TRUE: the rendered frame measures what
// it says, in the page's DOM and in the PDF itself (rasterised at 300 dpi), at both trims, with the marks drawn inside the print's edge and
// strokes of at least 0.75 pt, and (6) a book with the blocks on every kind of page builds in both trims, plain and with large print and high
// contrast on: check.mjs "[] 0", scan zones mapped, no Type 3 fonts, check-pages, check-codes. Studio snapshots carry the options and nothing else.
//   node test-photoblocks.mjs       (about four minutes: four book builds into out/photoblocks-test/)
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
import { newBlock, normalize, kindPage, dayBlocks, gridProblems, minSpan, spreadHalf, spreadProblems, spreadPage, autoPlace, placeBlock, findFree, GRIDS, gridRows, allowedIn, TYPES, IC, DEFAULT_LAYOUT, PAGE_KINDS } from './daypage.mjs';
import * as PH from './photo.mjs';
import { serializeDay } from '../studio/src/snapshot.mjs';

let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; console.log('ok   ' + m); };
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'kw-photoblocks-'));
process.on('exit', () => fs.rmSync(TMP, { recursive: true, force: true }));
const ROOT = 'out/photoblocks-test';
fs.rmSync(ROOT, { recursive: true, force: true });
fs.mkdirSync(ROOT, { recursive: true });
const B = (t, o = {}, uid = t) => newBlock(t, o, uid);
const at = (b, col, row, colSpan, rowSpan) => ({ ...b, col, row, colSpan, rowSpan });
const SIZES = ['small', 'letter'], TRIM = { small: '5.5x8.5', letter: '8.5x11' };

// What the print sizes are, written out again here (inches, as the print is held: width then height). The code's table must agree.
const NOMINAL = { '0.5x0.5': [0.5, 0.5], '0.75x0.75': [0.75, 0.75], '1x1': [1, 1], '1x1.5': [1, 1.5], '1.5x1.5': [1.5, 1.5], '1.5x2': [1.5, 2], '2x2': [2, 2], '2x3': [2, 3], '3x3': [3, 3], '3x4': [3, 4], '4x6': [4, 6], 'instax-mini': [2.1, 3.4], 'instax-square': [2.4, 2.4], 'instax-wide': [3.4, 2.1], polaroid: [3.1, 3.1] };
// Width of 1 to 4 grid columns, physical inches, measured on the built pages (see the browser section) and written out here.
const CELL = { small: [0.8, 1.683, 2.567, 3.45], letter: [1.381, 2.87, 4.358, 5.847] };
const GLUE = { photoframe: 0.08, photostrip: 0.08, contactsheet: 0.06, photodaily: 0.06 }, GAP = { photostrip: 0.12, contactsheet: 0.08, photodaily: 0.06 };
const dims = (id, turn) => { const [w, h] = NOMINAL[id], lo = Math.min(w, h), hi = Math.max(w, h); return turn === 'landscape' ? [hi, lo] : [lo, hi]; };

// ---- 1. declared like every other block ----
{
  const names = PH.PHOTO_TYPES;
  ok(names.join() === 'photoframe,photostrip,photodaily,contactsheet', 'four photo blocks: photoframe, photostrip, photodaily, contactsheet');
  ok(names.every((t) => TYPES[t].group === 'Photos' && IC[TYPES[t].icon] && TYPES[t].name && /Paper only/.test(TYPES[t].hint)), 'each is in the palette group "Photos" with an icon, a name and a hint that says paper only');
  ok(Object.keys(TYPES).filter((t) => TYPES[t].group === 'Photos').length === 4, 'the Photos group holds exactly these four');
  const kinds = new Set(names.flatMap((t) => TYPES[t].opts.map((o) => o.kind)));
  ok([...kinds].every((k) => ['num', 'bool', 'choice', 'text'].includes(k)), 'options are only numbers, switches, choices and a label: ' + [...kinds].join(', '));
  ok(names.every((t) => TYPES[t].opts.every((o) => o.label && !/image|src|url|file|upload|camera|photo$|data/i.test(o.k))), 'every option has a label, and none of them could carry an image (no src, url, file, upload or camera)');
  ok(names.every((t) => !TYPES[t].single) && names.every((t) => allowedIn('day', t) && allowedIn('notes', t) && allowedIn('collection', t) && allowedIn('blank', t) && allowedIn('spread', t) && allowedIn('half', t)), 'they repeat, and they are ordinary blocks of every page kind: day, Notes, Collection, blank, spread and spread page');
  const f = B('photoframe');
  ok(f.size === '2x3' && f.turn === 'portrait' && f.cut === true && f.lines === 'one' && f.who === false && f.cw === 30 && f.ch === 40, 'photoframe starts as a 2 x 3 in portrait print with trim marks and one caption line: ' + JSON.stringify(f));
  const nb = normalize({ v: 2, blocks: [{ type: 'photoframe', uid: 'a', size: 'wallet', turn: 'sideways', cw: 5, ch: 900, lines: 'ten' }, { type: 'photostrip', uid: 'b', n: 9, dir: 'diagonal', size: '4x6' }, { type: 'photodaily', uid: 'c', days: 40 }, { type: 'contactsheet', uid: 'd', n: 2 }] }).blocks, g = (u) => nb.find((x) => x.uid === u);
  ok(g('a').size === '2x3' && g('a').turn === 'portrait' && g('a').cw === 10 && g('a').ch === 60 && g('a').lines === 'one' && g('b').n === 4 && g('b').dir === 'row' && g('b').size === '1x1.5' && g('c').days === 'auto' && g('d').n === 6, 'wrong values are put right: an unknown print size, turn or caption choice, a custom size past 1 to 6 in, too many or too few frames');
  const png = { type: 'photoframe', uid: 'p', size: '3x4', src: 'data:image/png;base64,AAAA', photo: 'x.png', url: 'https://example.invalid/a.png' };
  const snap = serializeDay({ v: 2, blocks: [png, B('body')] }, []), kept = snap.blocks.find((b) => b.type === 'photoframe');
  ok(kept && kept.size === '3x4' && !('src' in kept) && !('photo' in kept) && !('url' in kept) && !JSON.stringify(snap).includes('data:image'), 'a Studio snapshot keeps the declared options and drops anything else: no image field can ride along');
  const errs = []; const sp = serializeDay({ v: 2, spread: normalize({ v: 2, kind: 'spread', grid: true, blocks: [at(B('body'), 1, 1, 4, 24), at(B('photoframe', { size: '4x6' }), 5, 1, 4, 24)] }, 'letter', 'spread') }, errs);
  ok(!errs.length && sp && sp.spread.blocks.some((b) => b.type === 'photoframe' && b.size === '4x6'), 'a spread day with a 4 x 6 frame (it fits 8.5x11 only) goes through the snapshot allowlist: ' + errs.join('; '));
}

// ---- 2. physical sizes and the fit rules ----
{
  ok(Object.entries(NOMINAL).every(([id, [w, h]]) => PH.PHOTO_SIZES[id] && PH.PHOTO_SIZES[id][0] === w && PH.PHOTO_SIZES[id][1] === h), 'the print size table says what is written here (2x3, 3x3, 3x4, 4x6, Instax mini 2.1x3.4, square 2.4x2.4, wide 3.4x2.1, Polaroid picture 3.1x3.1, and the small ones)');
  ok(!Object.keys(PH.PHOTO_SIZES).some((k) => /passport|visa|\bid\b/i.test(k)) && !Object.values(PH.SIZE_NAMES).some((v) => /passport|visa|\bID\b/i.test(v)), 'no passport or ID size is offered');
  for (const size of SIZES) ok(CELL[size].every((w, i) => near(PH.cellWidth(i + 1, size) * PH.zoomOf(size), w, 0.002)), `${TRIM[size]}: 1 to 4 columns are ${CELL[size].join(', ')} in wide on paper`);
  ok(near(PH.PHOTO_ZOOM, 11 / 8.5, 1e-9) && PH.zoomOf('small') === 1, 'the 8.5x11 page is the small layout zoomed by 11 / 8.5');
  ok(PH.printDims(B('photoframe', { size: 'instax-mini' })).w === 2.1 && PH.printDims(B('photoframe', { size: 'instax-mini', turn: 'landscape' })).w === 3.4 && PH.printDims(B('photoframe', { size: 'instax-wide', turn: 'landscape' })).h === 2.1 && PH.printDims(B('photoframe', { size: 'custom', cw: 25, ch: 35 })).h === 3.5, 'portrait puts the long side upright and landscape lays it down; custom is in tenths of an inch');
  // every frame size, both turns, both trims, every width: it fits exactly when the print and its glue margin are no wider than the columns
  let rows = 0;
  const table = [];
  for (const size of SIZES) for (const id of [...Object.keys(NOMINAL), 'custom']) for (const turn of ['portrait', 'landscape']) {
    if (!PH.FRAME_SIZES.some(([k]) => k === id) && !['custom'].includes(id)) continue;
    const b = B('photoframe', id === 'custom' ? { size: id, cw: 25, ch: 35, turn } : { size: id, turn }), [w] = id === 'custom' ? (turn === 'landscape' ? [3.5, 2.5] : [2.5, 3.5]) : dims(id, turn);
    let first = 0;
    for (let c = 1; c <= 4; c++) {
      const want = w + 2 * GLUE.photoframe <= CELL[size][c - 1] + 0.0005, f = PH.photoFit(b, c, undefined, size);
      assert.ok(want === (f === null), `${TRIM[size]} ${id} ${turn} in ${c} column(s): ${f ? f.msg : 'fits'}`); rows++;
      if (want && !first) first = c;
    }
    table.push({ size, id, turn, first });
  }
  ok(rows > 100, `photoFit agrees with the widths above for every frame size, both turns, 1 to 4 columns, both trims (${rows} cases)`);
  const need = (size, id, turn) => table.find((t) => t.size === size && t.id === id && t.turn === turn).first;
  ok(need('small', '3x4', 'portrait') === 4 && need('small', '2x3', 'portrait') === 3 && need('small', 'polaroid', 'portrait') === 4 && need('small', 'instax-mini', 'portrait') === 3 && need('small', 'instax-square', 'portrait') === 3, '5.5x8.5: 2x3, Instax mini and square take 3 columns; 3x4 and the Polaroid picture take all 4');
  ok(need('small', '4x6', 'portrait') === 0 && need('small', 'instax-wide', 'landscape') === 0 && need('small', '3x4', 'landscape') === 0 && need('small', '3x3', 'landscape') === 4, '5.5x8.5: a 4x6, a lying Instax wide (3.4 in) and a lying 3x4 do not fit any width; 3x3 does');
  ok(need('letter', '4x6', 'portrait') === 3 && need('letter', '3x4', 'landscape') === 3 && need('letter', 'instax-wide', 'landscape') === 3 && need('letter', '4x6', 'landscape') === 0 && need('letter', '2x3', 'portrait') === 2, '8.5x11: a 4x6 standing, a 3x4 lying and an Instax wide fit 3 columns; a lying 4x6 (6.16 in with glue) is wider than the page');
  const huge = B('photoframe', { size: 'custom', cw: 60, ch: 60 });
  ok(PH.photoFit(huge, 4, undefined, 'small') && PH.photoFit(huge, 4, undefined, 'letter'), 'a custom 6 x 6 in print fits neither trim (custom stays within 1 to 6 in, and the page decides)');
  const why = PH.photoFit(B('photoframe', { size: '4x6' }), 4, undefined, 'small').msg;
  ok(/Photo frame does not fit/.test(why) && /4 × 6 in print/.test(why) && /4\.16 in across/.test(why) && /3\.45 in/.test(why) && /8\.5×11/.test(why), 'the refusal says it in plain words, with the numbers and a way out: ' + why);
  const rowsWhy = PH.photoFit(B('photoframe', { size: '3x4' }), 4, 10, 'small').msg;
  ok(/needs 2\d rows/.test(rowsWhy) && /it has 10/.test(rowsWhy), 'too few rows is refused with the rows it needs: ' + rowsWhy);
  const stripWhy = PH.photoFit(B('photostrip', { size: '2x3', n: 3 }), 4, undefined, 'small').msg;
  ok(/3 2 × 3 in prints in a row/.test(stripWhy), 'a strip says how many prints and which way: ' + stripWhy);
  // the grid: gridProblems refuses with the same words, per trim and per width
  const lay = (blocks, kind = 'blank') => normalize({ v: 2, kind, grid: true, blocks }, 'letter', kind);
  for (const size of SIZES) {
    let cases = 0;
    for (const id of ['2x3', '3x4', '4x6', 'instax-wide', 'polaroid']) for (const c of [1, 2, 3, 4]) {
      const b = B('photoframe', { size: id, turn: id === 'instax-wide' ? 'landscape' : 'portrait', lines: 'one' }), p = PH.photoPlan(b, size, c), L = lay([at(b, 1, 1, c, Math.min(27, p.rowsNeeded))]);
      const probs = gridProblems(L, size).filter((x) => /^photo/.test(x.code));
      assert.ok((probs.length === 0) === p.fitsWidth && (probs.length === 0 || probs[0].code === 'photowidth'), `${TRIM[size]} ${id} ${c} cols`); cases++;
    }
    ok(cases === 20, `${TRIM[size]}: gridProblems refuses exactly the frames that do not fit their columns, with the code "photowidth"`);
  }
  {
    const b = B('photoframe', { size: '3x4', lines: 'three', who: true }), p = PH.photoPlan(b, 'small', 4);
    ok(gridProblems(lay([at(b, 1, 1, 4, p.rowsNeeded)]), 'small').length === 0 && gridProblems(lay([at(b, 1, 1, 4, p.rowsNeeded - 1)]), 'small').filter((x) => x.code === 'photorows').length === 1, `a 3x4 with three lines and a who-and-when line needs ${p.rowsNeeded} rows at 5.5x8.5: one row fewer is refused ("photorows")`);
    const q = PH.photoPlan(b, 'letter', 4);
    ok(q.rowsNeeded < p.rowsNeeded && gridProblems(lay([at(b, 1, 1, 4, q.rowsNeeded)]), 'letter').length === 0, `the same frame needs ${q.rowsNeeded} rows at 8.5x11 (a row is taller there): rows are per trim`);
  }
  // minSpan is a floor the plan fits in, for every block type, option and trim: at the minimum there is no problem, one row fewer is refused
  let cnt = 0;
  const variants = [['photoframe', { size: '2x3' }], ['photoframe', { size: '3x3', lines: 'three', who: true }], ['photoframe', { size: 'instax-mini', cut: false, lines: 'none' }], ['photoframe', { size: 'custom', cw: 15, ch: 20 }], ['photoframe', { size: '3x4', turn: 'landscape' }],
    ['photostrip', {}], ['photostrip', { n: 2, size: '2x2', dir: 'column' }], ['photostrip', { n: 4, size: '1x1', dates: false, lines: 'one' }], ['photostrip', { n: 2, size: 'instax-mini' }],
    ['photodaily', {}], ['photodaily', { size: '0.75x0.75', days: 28, note: false }], ['contactsheet', {}], ['contactsheet', { n: 12, size: '0.75x0.75' }], ['contactsheet', { n: 9, size: '1x1.5', turn: 'landscape', lines: 'none' }]];
  for (const size of SIZES) for (const [t, o] of variants) {
    const b = B(t, o, 'v'), m = minSpan(b, 4, size), c = Math.max(m.cols, 1), mm = minSpan(b, c, size);
    if (mm.rows > 27 || mm.cols > 4) continue;
    const ph = (rowSpan) => gridProblems(lay([at(b, 1, 1, c, rowSpan)]), size).filter((x) => /^photo/.test(x.code));
    assert.ok(ph(mm.rows).length === 0 || PH.photoPlan(b, size, c, t === 'photodaily' ? { days: PH.dailyDays(b, ''), note: !!b.note } : {}).fitsWidth === false, `${TRIM[size]} ${t} ${JSON.stringify(o)}: no problem at its minimum ${c} x ${mm.rows}`);
    if (ph(mm.rows).length === 0 && mm.rows > 1) assert.ok(ph(mm.rows - 1).some((x) => x.code === 'photorows'), `${TRIM[size]} ${t} ${JSON.stringify(o)}: one row fewer is refused`);
    cnt++;
  }
  ok(cnt >= 24, `minSpan(block, columns, trim) is the least room: fits at the minimum, refused one row below (${cnt} block and option variants, both trims)`);
  ok(minSpan(B('photoframe', { size: '4x6' }), 4, 'small').rows > minSpan(B('photoframe', { size: '4x6' }), 4, 'letter').rows && minSpan(B('lines')).rows === minSpan(B('lines'), 4, 'letter').rows, 'the minimum is per trim for a photo frame (the 8.5x11 row is taller) and unchanged for every other block');
  // the gutter keep-out
  ok(PH.GUTTER_KEEP_IN === 0.625 && near(PH.gutterClearance('small'), 0.925, 1e-9) && PH.gutterClearance('letter') > 1.19, 'gutter keep-out: a glued print starts at least 0.625 in from the spine edge; every cell of the page is at least 0.925 in (5.5x8.5) or 1.197 in (8.5x11) from its nearest edge');
  ok(PH.gutterProblem('small') === null && PH.gutterProblem('letter') === null && /spine edge/.test(PH.gutterProblem('small', 1.5)), 'the keep-out is a rule that holds today and says so in words if the page ever moves in: ' + PH.gutterProblem('small', 1.5));
}

// ---- 3. every page kind, the fold ----
const day = { date: '2026-10-14', rise: '7:20a', set: '6:00p' };
{
  const parts = { header: '', routines: [], day };
  const render = (kind, blocks, size = 'small') => (kind === 'day' ? dayBlocks(parts, normalize({ v: 2, grid: true, blocks }, size), { size }) : kindPage(kind, 'T', normalize({ v: 2, kind, grid: true, blocks }, size, kind), size, { pageId: 'x' }));
  const strip = (rows) => at(B('photostrip'), 1, 1, 4, rows), body = (row) => at(B('body'), 1, row, 4, 25 - row);
  for (const kind of ['day', 'notes', 'collection']) {
    const blocks = [strip(10), at(B('contactsheet', { size: '0.75x0.75', lines: 'none' }), 1, 11, 4, 8), at(B('body'), 1, 19, 4, 6)];
    // one block per page keeps the Writing space at 8 rows: strip (10 rows) over the space (14), then a frame and a sheet in turn
    const html = render(kind, [strip(10), body(11)]);
    ok(/class="pjb" data-zone="photostrip"/.test(html.replace(/ role="group"[^>]*>/, '>').replace('class="gc" data-zone', 'class="pjb" data-zone')) || /data-zone="photostrip"/.test(html), `${kind} page: a photo strip sits on the grid with its data-zone`);
    const two = render(kind, [at(B('photoframe', { size: 'custom', cw: 12, ch: 16, lines: 'none' }, 'a'), 1, 1, 2, 10), at(B('photoframe', { size: 'custom', cw: 12, ch: 16, lines: 'none' }, 'b'), 3, 1, 2, 10), body(11)]);
    ok(/data-zone="photoframe"/.test(two) && /data-zone="photoframe_2"/.test(two), `${kind} page: a second frame is zone photoframe_2`);
    const flow = kind === 'day' ? dayBlocks({ ...parts }, normalize({ v: 2, blocks: [B('photostrip', {}, 's'), B('body')] }), { size: 'small' }) : kindPage(kind, 'T', normalize({ v: 2, kind, blocks: [B('photostrip', {}, 's'), B('body')] }, 'small', kind), 'small', { pageId: 'x' });
    ok(/class="pjb" data-zone="photostrip"/.test(flow) && !/class="gc/.test(flow), `${kind} page: a flow layout stacks a photo strip too`);
    void blocks;
  }
  const dailyOnNotes = normalize({ v: 2, kind: 'notes', grid: true, blocks: [at(B('photodaily'), 1, 1, 4, 22), at(B('body'), 1, 23, 4, 2)] }, 'small', 'notes');
  ok(gridProblems(dailyOnNotes, 'small').some((p) => /Writing space/.test(p.msg)), 'a photo-a-day grid (22 rows at 5.5x8.5) does not leave a Notes page its Writing space: it belongs on a blank page or a spread page');
  for (const kind of ['blank', 'half']) {
    for (const size of SIZES) {
      for (const [t, o] of [['photoframe', { size: '3x4' }], ['photostrip', {}], ['photodaily', {}], ['contactsheet', { n: 12, size: '0.75x0.75' }]]) {
        const b = B(t, o), m = minSpan(b, 4, size), L = normalize({ v: 2, kind, grid: true, blocks: [at(b, 1, 1, 4, m.rows)] }, size, kind);
        const html = kind === 'blank' ? kindPage('blank', '', L, size, { pageId: 'x', dayStart: 4 }) : dayBlocks({ header: '', routines: [], day }, spreadHalf({ kind: 'spread', blocks: L.blocks.map((x) => ({ ...x, col: x.col + 4 })) }, 'R'), { size, kind: 'half', dayStart: 4 });
        assert.ok(gridProblems(L, size).length === 0 && html.includes(`data-zone="${t}"`) && html.includes('class="gc"'), `${kind} ${size} ${t}`);
      }
    }
    ok(true, `${kind} page: each photo block fits its own minimum at both trims and prints with its zone`);
  }
  // spread days: nothing crosses the fold, the right page holds a photo grid
  const S = normalize({ v: 2, kind: 'spread', grid: true, blocks: [at(B('sky'), 1, 1, 4, 2), at(B('body', { style: 'lines' }), 1, 3, 4, 22), at(B('photodaily', { size: '0.5x0.5' }), 5, 1, 4, 22), at(B('photostrip', { n: 2, size: '1x1' }), 5, 23, 4, 2)] }, 'small', 'spread');
  ok(spreadProblems(S).filter((m) => !/photo/i.test(m)).length === 0, 'a spread with a photo grid on the right page is a valid spread apart from the strip that is too short: ' + spreadProblems(S).join(' | '));
  const S2 = normalize({ v: 2, kind: 'spread', grid: true, blocks: [at(B('body'), 1, 1, 4, 24), at(B('photodaily', { size: '0.5x0.5' }), 5, 1, 4, 22)] }, 'small', 'spread');
  ok(spreadProblems(S2).length === 0, 'a spread: Writing space on the left page, photo-a-day grid on the right is valid: ' + spreadProblems(S2).join(' | '));
  const R = spreadPage({ header: 'H', headerR: 'HR', routines: [], day }, S2, 'R', { size: 'small', dayStart: 4 }), Lh = spreadPage({ header: 'H', headerR: 'HR', routines: [], day }, S2, 'L', { size: 'small', dayStart: 4 });
  ok(R.includes('data-zone="photodaily"') && !Lh.includes('data-zone="photodaily"') && /Oct 2026/.test(R) && (R.match(/class="pjd/g) || []).length === 31, 'the right page of a spread day prints the photo-a-day grid for its own date (Oct 2026: 31 frames); the left page does not');
  const cross = normalize({ v: 2, kind: 'spread', grid: true, blocks: [at(B('body'), 1, 1, 4, 24), at(B('photoframe', { size: '2x3' }), 3, 1, 3, 17)] }, 'letter', 'spread');
  ok(gridProblems(cross, 'letter').some((p) => p.code === 'fold' && /crosses the fold/.test(p.msg)) && spreadProblems(cross, 'letter').some((m) => /crosses the fold/.test(m)), 'a photo frame over the fold of a spread is refused: "crosses the fold"');
  let crossed = 0;
  for (const [t, o] of [['photoframe', { size: '2x3' }], ['photostrip', {}], ['photodaily', {}], ['contactsheet', {}]]) for (const size of SIZES) {
    const L = normalize({ v: 2, kind: 'spread', grid: true, blocks: [at(B('body'), 1, 1, 3, 12), at(B('lines', {}, 'z'), 4, 1, 2, 12)] }, size, 'spread'), b = B(t, o, 'p'), f = placeBlock(L, b, size);
    if (f && Math.ceil(f.col / 4) !== Math.ceil((f.col + f.colSpan - 1) / 4)) crossed++;
    const fr = findFree(L, 3, 5, size); if (fr && Math.ceil(fr.col / 4) !== Math.ceil((fr.col + fr.colSpan - 1) / 4)) crossed++;
  }
  ok(crossed === 0, 'placing a photo block on a spread never puts it across the fold');
  ok(GRIDS.spread.fold === 4 && PAGE_KINDS.half && gridRows('small', 'half') === 24, 'the spread: 8 columns, fold after column 4, each page 24 rows');
}

// ---- 4. deterministic, honest content ----
{
  const mk = (t, o, date, extra = {}) => dayBlocks({ header: '', routines: [], day: { date, rise: '', set: '' } }, normalize({ v: 2, kind: 'blank', grid: true, blocks: [at(B(t, o, 'q'), 1, 1, 4, 27)] }, 'small', 'blank'), { size: 'small', kind: 'blank', ...extra });
  for (const [t, o] of [['photoframe', { lines: 'three', who: true }], ['photostrip', {}], ['photodaily', {}], ['contactsheet', { n: 9 }]]) ok(mk(t, o, '2026-10-14', { dayStart: 4 }) === mk(t, o, '2026-10-14', { dayStart: 4 }) && !/Math\.random|undefined|NaN/.test(mk(t, o, '2026-10-14')), `${t}: the same inputs draw the same page, with no undefined or NaN in it`);
  const labels = (html) => (html.match(/<span class="pjd[^"]*"[^>]*><b>(\d+)<\/b>/g) || []).map((x) => +/<b>(\d+)/.exec(x)[1]);
  ok(labels(mk('photodaily', {}, '2026-10-14')).length === 31 && labels(mk('photodaily', {}, '2026-11-03')).length === 30 && labels(mk('photodaily', {}, '2027-02-10')).length === 28 && labels(mk('photodaily', {}, '2028-02-10')).length === 29, 'photo a day counts the days of the page\'s month (Oct 31, Nov 30, Feb 28, leap Feb 29)');
  ok(labels(mk('photodaily', { days: 30 }, '2026-10-14')).length === 30 && labels(mk('photodaily', {}, '')).length === 31, 'or the days you set, or 31 off a day page');
  ok(labels(mk('photodaily', {}, '2026-10-14')).join() === Array.from({ length: 31 }, (_, i) => i + 1).join() && /class="pjd td"[^>]*><b>14<\/b>/.test(mk('photodaily', {}, '2026-10-14')) && (mk('photodaily', {}, '2026-10-14').match(/ td"/g) || []).length === 1, 'frames are labelled 1 to 31 by date, and today\'s number is marked once');
  ok(/A day starts at 4 a\.m\./.test(mk('photodaily', {}, '2026-10-14', { dayStart: 4 })) && /A day starts at 6 a\.m\./.test(mk('photodaily', {}, '2026-10-14', { dayStart: 6 })) && !/A day starts/.test(mk('photodaily', {}, '2026-10-14', { dayStart: 0 })) && !/A day starts/.test(mk('photodaily', { note: false }, '2026-10-14', { dayStart: 4 })) && !/A day starts/.test(mk('photodaily', {}, '2026-10-14')), 'it honours the book\'s day start: a line says "A day starts at 4 a.m." (or the profile\'s hour); midnight, switched off, or no profile says nothing');
  ok(/Oct 2026/.test(mk('photodaily', {}, '2026-10-14')) && !/Oct 2026/.test(mk('photodaily', {}, '')), 'it names the month on a day page and not on a page without a date');
  ok((mk('photostrip', { n: 3, size: '1x1' }, '').match(/class="pjf"/g) || []).length === 3 && (mk('photostrip', { n: 2 }, '').match(/class="pjf"/g) || []).length === 2 && (mk('photostrip', { n: 3 }, '').match(/<b>date<\/b>/g) || []).length === 3 && !/<b>date<\/b>/.test(mk('photostrip', { dates: false }, '')), 'a strip has 2 to 4 frames, a date line under each (or none)');
  ok((mk('contactsheet', { n: 12, size: '0.75x0.75' }, '').match(/class="pjk"/g) || []).length === 12 && labels(mk('contactsheet', { n: 7 }, '')).join() === '1,2,3,4,5,6,7' && !/class="pjk"/.test(mk('contactsheet', { pick: false }, '')), 'a contact sheet numbers its frames and gives each a pick-one tick (or not)');
  const hrw = (html) => (html.match(/class="hrw"/g) || []).length;
  ok(hrw(mk('photoframe', { lines: 'none' }, '')) === 0 && hrw(mk('photoframe', { lines: 'one' }, '')) === 1 && hrw(mk('photoframe', { lines: 'three' }, '')) === 3 && hrw(mk('photoframe', { lines: 'three', who: true }, '')) === 4 && /What<\/span>/.test(mk('photoframe', { lines: 'three' }, '')) && /Why this one/.test(mk('photoframe', { lines: 'three' }, '')), 'caption lines: none, one (what and where) or three (what, where, why this one), plus a who and when line');
  ok(/trim your print to this/.test(mk('photoframe', {}, '')) && !/trim your print to this/.test(mk('photoframe', { cut: false }, '')) && (mk('photoframe', {}, '').match(/class="pjt /g) || []).length === 4 && !/class="pjt /.test(mk('photoframe', { cut: false }, '')), 'the cut guide: the words and four tick marks, or neither');
  for (const [t, o] of [['photoframe', {}], ['photostrip', {}], ['photodaily', {}], ['contactsheet', {}]]) {
    const html = mk(t, o, '2026-10-14', { dayStart: 4 });
    ok(!/<img|data:image|<image|src=|href=/i.test(html) && new RegExp(`role="group" aria-label="[^"]*${{ photoframe: 'print', photostrip: 'frames', photodaily: 'frames', contactsheet: 'frames' }[t]}`).test(html) && (html.match(/aria-hidden="true"/g) || []).length >= 4, `${t}: no image in the markup; the block has a text alternative (role group and aria-label) and its drawing parts are hidden from readers`);
  }
  ok(/aria-label="Photo frame: space for a 2 × 3 in print, portrait\. Paste your print here and trim it to this size\. One caption line: what and where\./.test(mk('photoframe', {}, '')), 'the text alternative says the size, the turn and the lines in a sentence: ' + (/aria-label="([^"]*)"/.exec(mk('photoframe', {}, ''))[1]));
  const others = ['render.mjs', 'pages.mjs', 'scan.mjs', 'puzzles/render.mjs', 'rulings.mjs', 'a11yprint.mjs'].map((f) => fs.readFileSync(f, 'utf8')).join('\n');
  ok(!/[.'"]pj[bhscwfdmtk]\b/.test(others), 'the photo blocks\' class names (pjb, pjh, pjf ...) are used nowhere else, so their CSS cannot restyle another page (a plain "ph" class once did: it broke the Exchange page header while check-identical, which compares HTML, stayed green)');
  const html0 = dayBlocks({ header: '', routines: [] }, DEFAULT_LAYOUT, { size: 'small' });
  ok(!/class="pjb"|class="pjf"|phw/.test(html0) && !DEFAULT_LAYOUT.blocks.some((b) => PH.isPhoto(b)), 'the default day page has no photo markup (the default build is checked byte for byte by check-identical.mjs)');
  const flowBad = () => dayBlocks({ header: '', routines: [] }, normalize({ v: 2, blocks: [B('photoframe', { size: '4x6' }), B('body')] }), { size: 'small' });
  assert.throws(flowBad, /Photo frame does not fit/);
  ok(dayBlocks({ header: '', routines: [] }, normalize({ v: 2, blocks: [B('photoframe', { size: '4x6' }), B('body')] }), { size: 'small', tag: true }).includes('data-b="photoframe"') && !/does not fit/.test(dayBlocks({ header: '', routines: [] }, normalize({ v: 2, blocks: [B('photoframe', { size: '4x6' }), B('body')] }), { size: 'letter' })), 'a flow layout with a print too wide for 5.5x8.5 stops the build with the reason; the editor still draws it (opt.tag) and 8.5x11 prints it');
}

// ---- 5. the books: every kind of page, both trims, with and without the print accessibility options ----
const MONTH = '2026-10';
const must = (r) => { assert.ok(r.book, r.err); return r.book; };
const cat = await catalog(MONTH, DEFAULT_BOOK);
let photoBook = DEFAULT_BOOK;
{
  const weekends = structuredClone(DEFAULT_BOOK); weekends.default.find((e) => e.type === 'weeks').options.week.find((e) => e.type === 'days').options = { weekdays: { sat: 'spread', sun: 'spread' } };
  let b = must(addEntry(weekends, cat, null, 'notes', { before: 'theme' }, { title: 'Strip' }));
  b = must(addEntry(b, cat, null, 'collection', { before: 'theme' }, { title: 'Sheet' }));
  b = must(addEntry(b, cat, null, 'notes', { before: 'theme' }, { title: 'Small prints' }));
  const L = (kind, blocks) => normalize({ v: 2, kind, grid: true, blocks }, 'small', kind);
  b = must(setLayout(b, cat, null, 'notes_1', L('notes', [at(B('photostrip'), 1, 1, 4, 10), at(B('body', { style: 'lines' }), 1, 11, 4, 14)])));
  b = must(setLayout(b, cat, null, 'collection_1', L('collection', [at(B('contactsheet', { size: '0.75x0.75', n: 6 }), 1, 1, 4, 12), at(B('body'), 1, 13, 4, 12)])));
  b = must(setLayout(b, cat, null, 'notes_2', L('notes', [at(B('photoframe', { size: 'custom', cw: 12, ch: 16, lines: 'none' }, 'one'), 1, 1, 2, 10), at(B('photoframe', { size: 'custom', cw: 10, ch: 10, lines: 'none' }, 'two'), 3, 1, 2, 10), at(B('body'), 1, 11, 4, 14)])));
  b = must(setLayout(b, cat, null, 'blank', L('blank', [at(B('photoframe', { size: '3x4', lines: 'three', who: true }), 1, 1, 4, 24)])));
  photoBook = b;
  ok(validateBook(photoBook).length === 0, 'a book with photo blocks on a Notes page, a Collection page and the blank page validates');
  const big = structuredClone(photoBook), e = big.default.find((x) => x.id === 'blank'); e.layout = L('blank', [at(B('photoframe', { size: '4x6' }), 1, 1, 4, 27)]);
  ok(validateBook(big).length === 0, 'a blank page with a 4x6 frame (8.5x11 only) is still a valid book.json: the 5.5x8.5 build is what says no');
}
const place = (b, col, row, colSpan, rowSpan) => at(b, col, row, colSpan, rowSpan);
const dayFile = (() => {
  const mine = normalize({ v: 2, kind: 'spread', grid: true, blocks: [place(B('sky'), 1, 1, 4, 2), place(B('body', { style: 'lines' }), 1, 3, 4, 22), place(B('photodaily', { size: '0.5x0.5' }), 5, 1, 4, 22)] }, 'small', 'spread');
  assert.equal(spreadProblems(mine).length, 0, spreadProblems(mine).join('; '));
  return { ...normalize({ v: 2, grid: true, blocks: [place(B('sky'), 1, 1, 4, 2), place(B('photostrip', { size: '1x1.5', n: 3 }), 1, 3, 4, 10), place(B('body'), 1, 13, 4, 12)] }), spread: mine };
})();
const lib = libraryFromProfile(PROFILE); lib.layouts = [{ id: 'mine', name: 'Photo pages', book: photoBook, day: dayFile }]; lib.books[0].layoutRef = 'mine';
const libFile = path.join(TMP, 'library.json'); fs.writeFileSync(libFile, JSON.stringify(lib));
const a11yProfile = (() => { const p = JSON.parse(fs.readFileSync('content/profile.json', 'utf8')); p.print = { large_print: true, high_contrast: true }; const f = path.join(TMP, 'a11y.json'); fs.writeFileSync(f, JSON.stringify(p)); return f; })();
const run = (s, a, env = {}) => execFileSync('node', [s, ...a], { env: { ...process.env, KW_LIBRARY: libFile, ...env }, stdio: 'pipe' }).toString();
const builds = {};
for (const [tag, size, prof] of [['small', 'small', null], ['letter', 'letter', null], ['small-a11y', 'small', a11yProfile], ['letter-a11y', 'letter', a11yProfile]]) {
  const out = `${ROOT}/${tag}`, env = { KW_OUT: out, SIZE: size, ...(prof ? { KW_PROFILE: prof } : {}) };
  run('render.mjs', ['month', MONTH, 'test.ics'], env);
  const dirName = `m${MONTH}${size === 'letter' ? '-letter' : ''}`, dir = `${out}/${dirName}`, lay = JSON.parse(fs.readFileSync(`${dir}/layout.json`, 'utf8'));
  builds[tag] = { dir, out, dirName, lay, size, env, html: `${dir}/journal.html`, pdf: `${dir}/${fs.readdirSync(dir).find((f) => /interior.*\.pdf$/.test(f))}` };
  const label = `${TRIM[size]}${prof ? ' with large print and high contrast on' : ''}`;
  ok(/^\[\] 0$/.test(run('check.mjs', [dirName], env).trim()), `${label}: check.mjs, every page fits ("[] 0")`);
  const pg = (id) => lay.pages.find((p) => p.id === id), zones = (id) => (pg(id) ? pg(id).zones.map((z) => z.zone) : []);
  ok(zones('notes_1').includes('photostrip') && zones('collection_1').includes('contactsheet') && ['photoframe', 'photoframe_2'].every((z) => zones('notes_2').includes(z)) && zones('blank').includes('photoframe') && zones('day.2026-10-14').includes('photostrip') && zones('day.2026-10-03.cont').includes('photodaily'), `${label}: layout.json maps a zone for every photo block, on Notes, Collection, blank, day and the right page of a spread day`);
  ok(['notes_1', 'notes_2', 'collection_1', 'day.2026-10-14', 'day.2026-10-03.cont'].every((id) => ['date', 'title', 'tags'].some((z) => zones(id).includes(z)) && zones(id).includes('page_code')) && pg('day.2026-10-14').zones.every((z) => z.w > 0 && z.h > 0), `${label}: the fixed scan zones (header, SEND TO strip, page code) are still on those pages, and every zone has a size`);
  ok(!/Type 3/.test(execFileSync('pdffonts', [builds[tag].pdf]).toString()), `${label}: no Type 3 fonts`);
  ok(/ok/.test(run('check-pages.mjs', [dir], env)), `${label}: check-pages: ids and printed labels are unique`);
  ok(/ok/.test(run('check-codes.mjs', [dir], { ...env, DECODE: 'sample' })), `${label}: check-codes: page codes are unique and decode`);
  if (prof) ok(/data-a11y="large contrast"/.test(fs.readFileSync(builds[tag].html, 'utf8')), `${label}: the options are really on (data-a11y="large contrast")`);
}

// ---- 6. true size: measured on the built pages and in the PDF ----
const pgm = (file) => { // a binary PGM (P5) from pdftoppm -gray
  const buf = fs.readFileSync(file); let i = 0; const tok = () => { while (buf[i] <= 32) i++; let s = ''; while (buf[i] > 32) s += String.fromCharCode(buf[i++]); return s; };
  tok(); const w = +tok(), h = +tok(); tok(); i++;
  return { w, h, px: buf.subarray(i, i + w * h) };
};
const DPI = 300;
// The dark pixels inside a rectangle (inches from the page's top left) of one PDF page: their box, in inches from the rectangle's corner.
const ink = (pdf, pageNo, r, thr = 215) => {
  const f = path.join(TMP, `r${n}-${pageNo}`), px = (v) => Math.max(0, Math.round(v * DPI));
  execFileSync('pdftoppm', ['-r', String(DPI), '-f', String(pageNo), '-l', String(pageNo), '-gray', '-singlefile', '-x', String(px(r.x)), '-y', String(px(r.y)), '-W', String(px(r.w)), '-H', String(px(r.h)), pdf, f]);
  const im = pgm(f + '.pgm'); fs.rmSync(f + '.pgm');
  let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1, dark = 255;
  for (let y = 0; y < im.h; y++) for (let x = 0; x < im.w; x++) { const v = im.px[y * im.w + x]; if (v < thr) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (v < dark) dark = v; } }
  return x1 < 0 ? null : { l: x0 / DPI, t: y0 / DPI, r: (x1 + 1) / DPI, b: (y1 + 1) / DPI, dark, im };
};
// Ink thickness (in px at DPI) of the horizontal line through column x of an image, from y0 to y1: its coverage summed, so anti-aliasing counts.
const thick = (im, x, y0, y1, bg = 255, fg = 0x8c) => { let s = 0; for (let y = y0; y < y1; y++) s += (bg - im.px[y * im.w + x]) / (bg - fg); return s; };
const browser = await launch();
const domOf = async (htmlFile, ids, extra = 'null') => { // frames of every page: sizes in inches (getBoundingClientRect is in zoomed px: /96 is paper inches)
  const p = await browser.newPage();
  await p.goto('file://' + path.resolve(htmlFile), { waitUntil: 'networkidle' }); await p.evaluate(() => document.fonts.ready);
  const r = await p.evaluate((pageIds) => [...document.querySelectorAll('.page')].map((pg, i) => {
    const a = pg.getBoundingClientRect(), rel = (el) => { const c = el.getBoundingClientRect(); return { x: (c.left - a.left) / 96, y: (c.top - a.top) / 96, w: c.width / 96, h: c.height / 96 }; };
    const ph = pg.querySelector('.pjb'), w = pg.querySelector('.pjw'), m = pg.querySelector('.pjm.a'), pk = pg.querySelector('.pjd .pjk, .pjd i'), bw = (el) => (el ? parseFloat(getComputedStyle(el).borderTopWidth || '0') + parseFloat(getComputedStyle(el).borderLeftWidth || '0') : 0);
    return { n: i + 1, id: pg.dataset.pageId, side: pg.classList.contains('verso') ? 'verso' : 'recto', page: { w: a.width / 96, h: a.height / 96 }, ph: ph ? rel(ph) : null, phw: w ? rel(w) : null, frames: [...pg.querySelectorAll('.pjf')].map(rel), caps: [...pg.querySelectorAll('.pjd')].map(rel), mark: m ? bw(m) : 0, markColor: m ? getComputedStyle(m).borderTopColor : '', pickBorder: pk ? bw(pk) : 0 };
  }), ids);
  const problems = await p.evaluate(pageProblems); await p.close();
  return { pages: r, problems };
};
const INSET = PH.MARK_INSET_IN, TOL = 0.004;
// A frame's check: the nominal print (inches) against the page's own frame box, then the marks in the PDF.
const checkFrame = (label, pdf, pageNo, f, [w, h], zoomSize) => {
  assert.ok(near(f.w, w, TOL) && near(f.h, h, TOL), `${label}: the frame box measures ${f.w.toFixed(4)} x ${f.h.toFixed(4)} in, it should be ${w} x ${h}`);
  const m = ink(pdf, pageNo, f);
  assert.ok(m, `${label}: no marks found in the PDF`);
  assert.ok(near(m.l, INSET, 0.012) && near(m.t, INSET, 0.012) && near(m.r, w - INSET, 0.012) && near(m.b, h - INSET, 0.012), `${label}: marks span ${m.l.toFixed(3)}..${m.r.toFixed(3)} x ${m.t.toFixed(3)}..${m.b.toFixed(3)} in a ${w} x ${h} in frame; they should sit ${INSET} in inside every edge`);
  return m;
};
{
  // 6a. the real books: the blank page's 3x4 frame, the Notes and Collection pages, a spread day's photo-a-day grid, in both trims
  const meas = {};
  for (const tag of ['small', 'letter', 'small-a11y', 'letter-a11y']) {
    const bd = builds[tag], d = await domOf(bd.html), page = (id) => d.pages.find((p) => p.id === id), no = (id) => bd.lay.pages.find((p) => p.id === id).page;
    meas[tag] = d;
    const label = `${TRIM[bd.size]}${/a11y/.test(tag) ? ' (large print, high contrast)' : ''}`;
    const fr = page('blank').frames[0];
    checkFrame(`${label} blank page 3x4 frame`, bd.pdf, no('blank'), fr, [3, 4]);
    const s = page('notes_1').frames, c = page('collection_1').frames, two = page('notes_2').frames, dd = page('day.2026-10-03.cont').frames, dp = page('day.2026-10-14').frames;
    assert.ok(s.length === 3 && c.length === 6 && two.length === 2 && dd.length === 31 && dp.length === 3, `${label}: frame counts ${s.length}, ${c.length}, ${two.length}, ${dd.length}, ${dp.length}`);
    checkFrame(`${label} Notes strip frame`, bd.pdf, no('notes_1'), s[0], [1, 1.5]);
    checkFrame(`${label} Notes strip last frame`, bd.pdf, no('notes_1'), s[2], [1, 1.5]);
    checkFrame(`${label} Collection sheet frame`, bd.pdf, no('collection_1'), c[5], [0.75, 0.75]);
    checkFrame(`${label} custom 1.2 x 1.6 frame`, bd.pdf, no('notes_2'), two[0], [1.2, 1.6]);
    checkFrame(`${label} custom 1 x 1 frame`, bd.pdf, no('notes_2'), two[1], [1, 1]);
    checkFrame(`${label} day page strip frame`, bd.pdf, no('day.2026-10-14'), dp[1], [1, 1.5]);
    checkFrame(`${label} spread day photo-a-day frame 1`, bd.pdf, no('day.2026-10-03.cont'), dd[0], [0.5, 0.5]);
    checkFrame(`${label} spread day photo-a-day frame 31`, bd.pdf, no('day.2026-10-03.cont'), dd[30], [0.5, 0.5]);
    // the glue margin and the gaps are physical too
    const w = page('blank').phw;
    assert.ok(near(fr.x - w.x, 0.08, TOL) && near(fr.y - w.y, 0.08, TOL) && near(w.w, 3.16, TOL) && near(w.h, 4.16, TOL), `${label}: the keep-clear glue margin round the 3x4 print is 0.08 in on every side`);
    assert.ok(near(s[1].x - s[0].x - s[0].w, 0.12, TOL) && near(dd[1].x - dd[0].x - dd[0].w, 0.06, TOL) && near(c[1].x - c[0].x - c[0].w, 0.08, TOL), `${label}: the gaps between frames are 0.12 in (strip), 0.08 in (contact sheet) and 0.06 in (photo a day)`);
    // the gutter keep-out: every frame's edge is at least 0.625 in from the spine edge of its page
    for (const pgd of d.pages.filter((p) => p.frames.length)) for (const f of pgd.frames) {
      const toSpine = pgd.side === 'verso' ? pgd.page.w - (f.x + f.w) : f.x;
      assert.ok(toSpine >= PH.GUTTER_KEEP_IN, `${label}: ${pgd.id} frame starts ${toSpine.toFixed(3)} in from the spine edge (keep-out ${PH.GUTTER_KEEP_IN})`);
    }
    assert.ok(d.problems.length === 0, `${label}: pageProblems ${JSON.stringify(d.problems)}`);
    n++; console.log(`ok   ${label}: every frame on the built pages measures its nominal size (box in the page, marks in the 300 dpi PDF raster), the glue margin and gaps are true, and every frame stays at least ${PH.GUTTER_KEEP_IN} in from the spine`);
  }
  ok(['blank', 'notes_1', 'collection_1', 'notes_2', 'day.2026-10-14', 'day.2026-10-03.cont'].every((id) => ['small', 'letter'].every((t) => JSON.stringify(meas[t].pages.find((p) => p.id === id).frames.map((f) => [f.x, f.y, f.w, f.h].map((v) => +v.toFixed(3)))) === JSON.stringify(meas[t + '-a11y'].pages.find((p) => p.id === id).frames.map((f) => [f.x, f.y, f.w, f.h].map((v) => +v.toFixed(3)))))), 'large print and high contrast never move or resize a frame: the same boxes in the same places in both trims');
  const m0 = meas.small.pages.find((p) => p.id === 'blank');
  ok(m0.mark >= 1 && meas.letter.pages.find((p) => p.id === 'blank').mark >= 1 && m0.pickBorder >= 0, 'corner marks are 1 px = 0.75 pt borders in both trims (the floor is 0.75 pt; Chromium keeps a 1 px border at 1 px under the 8.5x11 zoom)');
  // the marks' own ink: darkness, thickness at 300 dpi, and that it is not so dark that a print would not be needed to hide it
  for (const tag of ['small', 'letter']) {
    const bd = builds[tag], d = meas[tag], f = d.pages.find((p) => p.id === 'blank').frames[0], pgn = bd.lay.pages.find((p) => p.id === 'blank').page;
    const m = ink(bd.pdf, pgn, f), arm = PH.markArm(3, 4) * 1;
    const x = Math.round((INSET + arm / 2 / PH.zoomOf(bd.size) * PH.zoomOf(bd.size)) * DPI), t = thick(m.im, Math.max(1, Math.min(m.im.w - 1, x)) | 0, 0, Math.round(0.12 * DPI));
    const minPt = 0.75 * DPI / 72;
    assert.ok(t >= minPt * 0.9, `${TRIM[bd.size]}: a corner mark is ${(t / DPI * 72).toFixed(2)} pt thick in the PDF (the floor is 0.75 pt, measured within anti-aliasing)`);
    assert.ok(m.dark >= 60 && m.dark <= 190, `${TRIM[bd.size]}: the marks' darkest pixel is ${m.dark}: visible, but a mid grey, not black`);
    n++; console.log(`ok   ${TRIM[bd.size]}: marks measure ${(t / DPI * 72).toFixed(2)} pt thick in the 300 dpi PDF raster (the 0.75 pt floor, within anti-aliasing) and grey ${m.dark} (visible, not black)`);
  }
  // 6b. a sweep of every frame size, both turns, at both trims, on blank pages built from the same page chrome and CSS
  const sweepRun = async (size, items, name) => {
    const base = fs.readFileSync(builds[size].html, 'utf8'), head = base.slice(0, base.indexOf('<body>') + 6);
    const i0 = base.indexOf('data-page-id="blank">'), s0 = base.lastIndexOf('<div class="page', i0), open = base.slice(s0, i0 + 'data-page-id="blank">'.length), rest = base.slice(i0 + 'data-page-id="blank">'.length);
    const tail = rest.slice(rest.indexOf('<div class="frame">'), rest.indexOf('<div class="page', 10) > 0 ? rest.indexOf('<div class="page') : undefined);
    const pages = items.map((it, i) => open.replace(/page (verso|recto)/, `page ${it.side || 'recto'}`).replace('data-page-id="blank">', `data-page-id="s${i + 1}">`) + kindPage('blank', '', normalize({ v: 2, kind: 'blank', grid: true, blocks: it.blocks }, size, 'blank'), size, { pageId: 'x', dayStart: 4 }) + tail);
    const file = `${ROOT}/${name}-${size}.html`; fs.writeFileSync(file, head + pages.join('\n') + '</body></html>');
    const d = await domOf(file), pdf = `${ROOT}/${name}-${size}.pdf`, pg = await browser.newPage();
    await pg.goto('file://' + path.resolve(file), { waitUntil: 'networkidle' }); await pg.evaluate(() => document.fonts.ready);
    await pg.pdf({ path: pdf, preferCSSPageSize: true, printBackground: true }); await pg.close();
    return { d, pdf, file };
  };
  for (const size of SIZES) {
    const items = [], want = [];
    for (const id of [...Object.keys(NOMINAL).filter((k) => PH.FRAME_SIZES.some(([x]) => x === k)), 'custom']) for (const turn of ['portrait', 'landscape']) {
      const o = id === 'custom' ? { size: id, cw: 25, ch: 35, turn } : { size: id, turn }, b = B('photoframe', { ...o, lines: 'three', who: true }), p = PH.photoPlan(b, size, 4);
      if (!p.fitsWidth || p.rowsNeeded > 27) { const f = PH.photoFit(b, 4, 27, size); assert.ok(f && /does not fit/.test(f.msg), `${TRIM[size]} ${id} ${turn} is refused`); continue; }
      items.push({ side: items.length % 2 ? 'verso' : 'recto', blocks: [at(b, 1, 1, 4, p.rowsNeeded)] });
      want.push(id === 'custom' ? (turn === 'landscape' ? [3.5, 2.5] : [2.5, 3.5]) : dims(id, turn));
    }
    const { d, pdf } = await sweepRun(size, items, 'frames');
    d.pages.forEach((pgd, i) => { checkFrame(`${TRIM[size]} sweep page ${i + 1}`, pdf, i + 1, pgd.frames[0], want[i]); const toSpine = pgd.side === 'verso' ? pgd.page.w - (pgd.frames[0].x + pgd.frames[0].w) : pgd.frames[0].x; assert.ok(toSpine >= PH.GUTTER_KEEP_IN, `${TRIM[size]} sweep page ${i + 1} gutter`); });
    assert.ok(d.problems.length === 0, `${TRIM[size]} sweep: ${JSON.stringify(d.problems)}`);
    assert.ok(!/Type 3/.test(execFileSync('pdffonts', [pdf]).toString()), 'no Type 3 in the sweep');
    ok(items.length >= (size === 'small' ? 10 : 16), `${TRIM[size]}: ${items.length} frame sizes (every print size, standing and lying, that fits) measure true in the DOM and in the PDF, sit clear of the spine, and pass the overflow gate`);
  }
  // multi-frame blocks
  for (const size of SIZES) {
    const specs = [['photostrip', { size: '1x1', n: 4, dir: 'row' }], ['photostrip', { size: '1x1.5', n: 3, dir: 'row' }], ['photostrip', { size: '2x2', n: 2, dir: 'column' }], ['photostrip', { size: '1.5x2', n: 2, dir: 'row' }], ['photostrip', { size: '2x3', n: 2, dir: 'row', turn: 'landscape' }], ['photostrip', { size: 'instax-mini', n: 2, dir: 'row' }],
      ['contactsheet', { size: '1x1', n: 6 }], ['contactsheet', { size: '0.75x0.75', n: 12 }], ['contactsheet', { size: '1x1.5', n: 9, turn: 'landscape' }], ['contactsheet', { size: '1.5x1.5', n: 8 }], ['photodaily', { size: '0.5x0.5' }], ['photodaily', { size: '0.75x0.75', days: 28 }]];
    const items = [], meta = [];
    for (const [t, o] of specs) {
      const b = B(t, o), x = t === 'photodaily' ? { days: PH.dailyDays(b, ''), note: !!b.note } : {}, p = PH.photoPlan(b, size, 4, x);
      if (!p.fitsWidth || p.rowsNeeded > 27) { const f = PH.photoFit(b, 4, 27, size, x); assert.ok(f && /does not fit/.test(f.msg) && f.msg.includes(t === 'photostrip' ? 'prints' : 'frames'), `${TRIM[size]} ${t} ${JSON.stringify(o)} is refused: ${f && f.msg}`); continue; }
      items.push({ blocks: [at(b, 1, 1, 4, p.rowsNeeded)], side: items.length % 2 ? 'verso' : 'recto' }); meta.push({ t, o, p, b });
    }
    const { d, pdf } = await sweepRun(size, items, 'multi');
    d.pages.forEach((pgd, i) => {
      const { t, o, p, b } = meta[i], [w, h] = PH.printDims(b) && [PH.printDims(b).w, PH.printDims(b).h], nom = o.size && NOMINAL[o.size] ? (o.turn === 'landscape' ? [Math.max(...NOMINAL[o.size]), Math.min(...NOMINAL[o.size])] : [Math.min(...NOMINAL[o.size]), Math.max(...NOMINAL[o.size])]) : [w, h];
      assert.ok(pgd.frames.length === (t === 'photodaily' ? p.n : b.n), `${TRIM[size]} ${t} ${JSON.stringify(o)}: ${pgd.frames.length} frames`);
      pgd.frames.forEach((f) => assert.ok(near(f.w, nom[0], TOL) && near(f.h, nom[1], TOL), `${TRIM[size]} ${t} ${JSON.stringify(o)}: a frame is ${f.w.toFixed(3)} x ${f.h.toFixed(3)}, should be ${nom.join(' x ')}`));
      checkFrame(`${TRIM[size]} ${t} ${JSON.stringify(o)} first frame`, pdf, i + 1, pgd.frames[0], nom);
      checkFrame(`${TRIM[size]} ${t} ${JSON.stringify(o)} last frame`, pdf, i + 1, pgd.frames[pgd.frames.length - 1], nom);
      // frames never overlap and none touches the next one's glue margin
      for (let a = 0; a < pgd.frames.length; a++) for (let c = a + 1; c < pgd.frames.length; c++) { const A = pgd.frames[a], C = pgd.frames[c]; assert.ok(A.x + A.w <= C.x + 0.001 || C.x + C.w <= A.x + 0.001 || A.y + A.h <= C.y + 0.001 || C.y + C.h <= A.y + 0.001, `${t} frames ${a} and ${c} overlap`); }
      const toSpine = pgd.side === 'verso' ? pgd.page.w - Math.max(...pgd.frames.map((f) => f.x + f.w)) : Math.min(...pgd.frames.map((f) => f.x));
      assert.ok(toSpine >= PH.GUTTER_KEEP_IN, `${t} gutter: ${toSpine}`);
    });
    assert.ok(d.problems.length === 0, `${TRIM[size]} multi: ${JSON.stringify(d.problems)}`);
    ok(items.length >= 6, `${TRIM[size]}: ${items.length} strips, contact sheets and photo-a-day grids measure true (every frame the nominal size, no overlaps, clear of the spine, overflow gate clean); the others are refused with a reason`);
  }
}
await browser.close();
console.log(`test-photoblocks: ${n} checks passed`);
