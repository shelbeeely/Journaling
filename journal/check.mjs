import { launch } from './browser.mjs';
const b = await launch();
const p = await b.newPage();
await p.goto('file://' + process.cwd() + `/out/${process.argv[2] || 'v1'}/journal.html`, { waitUntil: 'networkidle' });
await p.evaluate(() => document.fonts.ready);
const res = await p.evaluate(() => [...document.querySelectorAll('.page')].map((pg, i) => {
  const over = pg.scrollHeight > pg.clientHeight + 1 || pg.scrollWidth > pg.clientWidth + 1;
  const r = pg.getBoundingClientRect(); const cs = getComputedStyle(pg);
  const box = { l: r.left + parseFloat(cs.paddingLeft), r: r.right - parseFloat(cs.paddingRight), t: r.top + parseFloat(cs.paddingTop), b: r.bottom - parseFloat(cs.paddingBottom) };
  let out = 0;
  pg.querySelectorAll('*').forEach((el) => { if (el.closest('.folio') || el.closest('.frame') || el.closest('.strip')) return; const e = el.getBoundingClientRect(); if (e.width && (e.left < box.l - 1 || e.right > box.r + 1 || e.bottom > box.b + 1)) out++; });
  // bus grid / summary cells whose text is wider than their column (overflow:hidden would clip it silently)
  const cell = [...pg.querySelectorAll('.hg td, .net td:not(.rname)')].filter((td) => td.scrollWidth > td.clientWidth + 1).length;
  // month-calendar cells and week rows clip their own content (overflow:hidden), so the page-level tests above never see it
  const clip = [...pg.querySelectorAll('.cal td, .wev')].filter((el) => el.scrollHeight > el.clientHeight + 1).length;
  // grid layouts: every block sits in its own cell (.gc) and clips what does not fit, so each cell is checked on its own; the names say which block
  const blk = [...pg.querySelectorAll('.gc')].filter((g) => g.scrollHeight > g.clientHeight + 1 || g.scrollWidth > g.clientWidth + 1).map((g) => g.dataset.zone);
  return { n: i + 1, over, out, cell, clip, ...(blk.length ? { blk } : {}) };
}).filter((x) => x.over || x.out || x.cell || x.clip || x.blk));
console.log(JSON.stringify(res.slice(0, 20)), res.length);
if (res.length) process.exitCode = 1; // CI fails on any overflow
await b.close();
