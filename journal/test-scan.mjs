// Scan options check (CI: books.yml). Builds one month in both trims with custom scan settings (a Send-to block, pages with the border
// off, code positions, sizes, QR, content id, no code) and checks every gate: overflow (check.mjs), spreads, and check-codes with every
// code decoded at its own size and position. Also: two books with different book ids never collide, layout.json and the manifest
// reflect the options, and the pure rules (validation, resolution, size raising).
//   node test-scan.mjs        (builds into out/scan-test/, about a minute)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { DEFAULT_BOOK, validateBook } from './book.mjs';
import { newBlock, DEFAULT_LAYOUT, normalize, minSpan, dayBlocks } from './daypage.mjs';
import { resolveScan, cleanScan, scanProblems, fitSize, codeText, marksHtml, codeOnLeft, DEFAULT_SCAN } from './scan.mjs';

let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'kw-scan-'));
process.on('exit', () => fs.rmSync(TMP, { recursive: true, force: true }));
const ROOT = 'out/scan-test';
fs.rmSync(ROOT, { recursive: true, force: true });

// ---- pure ----
ok(!cleanScan({}) && !cleanScan({ frame: 'on', code: { position: 'right', size: 10.7 } }), 'default settings store nothing');
ok(JSON.stringify(resolveScan()) === JSON.stringify(DEFAULT_SCAN), 'no layers = the default');
ok(resolveScan({ frame: 'off' }, { frame: 'on' }).frame === 'on' && resolveScan({ code: { size: 14 } }, { code: { format: 'qr' } }).code.size === 14, 'later layers win, keys merge');
ok(scanProblems({ frame: 'maybe' }).length === 1 && scanProblems({ code: { size: 5 } }).length === 1 && scanProblems({ code: { position: 'top' } }).length === 1 && scanProblems({ x: 1 }).length === 1 && scanProblems({ frame: 'off', code: { on: false } }).length === 0, 'bad settings are named');
ok(fitSize(16, 10.7).mm === 10.7 && fitSize(25, 10.7).raised && fitSize(25, 10.7).mm === 12.5 && fitSize(33, 14).error, 'sizes rise to keep 0.5 mm modules, and refuse what cannot fit');
ok(codeText('book', { standard: 'KW2|1|2610|S001' }) === 'KW2|1|2610|S001' && codeText('id', { standard: 'x', edition: 1, bookKey: '2610', size: 'S', pageId: 'day.2026-10-14' }) === 'KWI|1|2610|S|DAY.2026-10-14', 'code text');
ok(codeOnLeft('outer', 'verso') && !codeOnLeft('outer', 'recto') && codeOnLeft('inner', 'recto') && codeOnLeft('left', 'recto'), 'outer and inner follow the page side');
const dm = marksHtml({ n: 3, sc: resolveScan(), side: 'recto', svg: '<svg></svg>', mm: 10.7 });
ok(dm.startsWith('<div class="frame"></div><div class="strip"><span class="pno">3</span><span class="send">SEND TO</span>') && dm.endsWith('<span class="qr"><svg></svg></span></div>'), 'default marks are the original markup');
const b0 = structuredClone(DEFAULT_BOOK); b0.scan = { code: { position: 'left' } }; b0.default[0].scan = { frame: 'off' };
ok(validateBook(b0).length === 0, 'book.json accepts scan at the top and on a page');
b0.default[0].scan = { frame: 'x' }; ok(validateBook(b0).length === 1, 'book.json names a bad page scan');
ok(minSpan(newBlock('sendto')).cols <= 4 && normalize({ v: 2, scan: { frame: 'off' }, blocks: [{ type: 'body' }] }).scan.frame === 'off' && !normalize(DEFAULT_LAYOUT).scan, 'sendto has a grid minimum; a layout keeps only non-default scan');
const gl = normalize({ v: 2, grid: true, blocks: [{ type: 'sendto', uid: 'a', col: 1, row: 1, colSpan: 4, rowSpan: 3 }, { type: 'sendto', uid: 'b', col: 1, row: 4, colSpan: 4, rowSpan: 3 }, { type: 'body', col: 1, row: 8, colSpan: 4, rowSpan: 16 }] });
const html = dayBlocks({ header: '' }, gl, { size: 'small' });
ok(/data-zone="send_to"/.test(html) && /data-zone="send_to_2"/.test(html), 'grid: send-to blocks map zones send_to and send_to_2');

// ---- builds ----
const day = normalize(DEFAULT_LAYOUT); day.blocks.splice(6, 0, newBlock('sendto', {}, 'sendto'));
const book = structuredClone(DEFAULT_BOOK);
const by = (id) => book.default.find((e) => e.id === id);
by('title').scan = { frame: 'off', code: { on: false } };
by('key').scan = { code: { format: 'qr', size: 12, label: true } };
by('key_2').scan = { frame: 'off' };
by('contacts').scan = { code: { content: 'id', size: 14, position: 'left' } };
by('theme').scan = { code: { size: 9, label: true, position: 'outer' } };
by('weeks').options.week.find((e) => e.id === 'days').scan = { code: { content: 'id', position: 'inner' } };
const bf = path.join(TMP, 'book.json'), df = path.join(TMP, 'day.json');
fs.writeFileSync(bf, JSON.stringify(book)); fs.writeFileSync(df, JSON.stringify(day));
const env = { ...process.env, KW_OUT: ROOT, KW_BOOKFILE: bf, KW_DAYFILE: df };
const run = (s, a, e = env) => execFileSync('node', [s, ...a], { env: e, stdio: 'pipe' }).toString();
const out = run('render.mjs', ['month', '2026-10', 'test.ics']) + run('render.mjs', ['month', '2026-10', 'test.ics'], { ...env, SIZE: 'letter' });
ok(/need a 20x20 Data Matrix/.test(out) && /raised so no module is under 0.5 mm/.test(out), 'the build says when content needs a bigger symbol and when a size is raised');
for (const d of ['m2026-10', 'm2026-10-letter']) {
  const L = JSON.parse(fs.readFileSync(`${ROOT}/${d}/layout.json`)), M = JSON.parse(fs.readFileSync(`${ROOT}/${d}/manifest.json`)), P = (id) => L.pages.find((p) => p.id === id);
  run('check.mjs', [d], env); ok(true, `${d}: every page passes check.mjs`);
  run('check-spreads.mjs', [`${ROOT}/${d}`], env); ok(true, `${d}: spreads ok`);
  ok(JSON.stringify(L.pages_without_frame) === '["title","key.2"]' && JSON.stringify(L.pages_without_code) === '["title"]' && JSON.stringify(M.pages_without_code) === '["title"]' && JSON.stringify(M.pages_without_frame) === '["title","key.2"]', `${d}: layout.json and the manifest list pages without a border or a code`);
  ok(P('title').code === null && !P('title').zones.some((z) => z.zone === 'page_code') && P('key.2').code && P('key.2').scan.crop === false && !P('key.2').zones.some((z) => /^send_to/.test(z.zone)), `${d}: no code and no zone on the title page; key.2 has a code but no send_to or crop`);
  ok(P('key').code_format === 'qr' && P('key').code_size_mm >= 12.5 && P('contacts').code_content === 'id' && P('contacts').code_size_mm === 14 && P('theme').code_size_mm === 9, `${d}: format, content and size reach layout.json`);
  ok(P('contacts').code_position === 'left' && P('key').code_position === 'right' && P('theme').code_position === (P('theme').page % 2 ? 'right' : 'left'), `${d}: positions resolve (outer follows the page side)`);
  const dp = L.pages.find((p) => p.type === 'dayp');
  ok(dp.zones.some((z) => z.zone === 'send_to') && dp.zones.some((z) => z.zone === 'send_to_fire') && !dp.zones.some((z) => z.zone === 'send_to_2'), `${d}: the day page's Send-to block maps zone send_to (the strip's symbols moved into it)`);
  ok(new Set(L.pages.filter((p) => p.code).map((p) => p.code)).size === L.pages.filter((p) => p.code).length, `${d}: codes unique`);
  const cc = run('check-codes.mjs', [`${ROOT}/${d}`], { ...env, DECODE: 'all' }); ok(/decoded (\d+)\/\1/.test(cc), `${d}: every configured code decodes at its own size and position`);
}
// two books, different book ids: no collision (KW3 books built with content id and default)
const prof = (id) => { const p = JSON.parse(fs.readFileSync('content/profile.json', 'utf8')); p.book.scope = 'undated'; p.book.undated = { days: 30, weeks: 5, months: 1 }; p.book.keeper = 'none'; p.book.id = id; const f = path.join(TMP, `${id}.json`); fs.writeFileSync(f, JSON.stringify(p)); return f; };
const b2 = structuredClone(book); b2.scan = { code: { content: 'id' } };
const bf2 = path.join(TMP, 'book2.json'); fs.writeFileSync(bf2, JSON.stringify(b2));
run('render.mjs', ['book', 'test.ics'], { ...env, KW_PROFILE: prof('K7M2QX9A'), KW_BOOKFILE: bf2 });
run('render.mjs', ['book', 'test.ics'], { ...env, KW_PROFILE: prof('M3N4P5Q6'), KW_BOOKFILE: bf2 });
const dirs = fs.readdirSync(ROOT).filter((d) => d.startsWith('b-'));
ok(dirs.length >= 2, 'two undated books built');
const cc2 = run('check-codes.mjs', dirs.map((d) => `${ROOT}/${d}`), { ...env, DECODE: 'sample' });
ok(/check-codes: ok/.test(cc2), 'two books with different book ids share no code (KWI, content id)');
console.log(`test-scan: ${n} checks ok`);
