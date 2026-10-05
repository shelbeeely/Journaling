// The overflow gate, as one function that runs inside the page: for every .page, what spills (the page, its content, a table cell, a
// month cell, a grid block, the scan strip). check.mjs prints it and fails on any; render.mjs uses it to fit large print (a11yprint.mjs).
// Serialised with evaluate(), so it must not use anything from this file.
export const pageProblems = () => [...document.querySelectorAll('.page')].map((pg, i) => {
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
  // scan marks: nothing in the bottom strip overlaps or spills out of it (a bigger code, a label, a code moved to the other corner), and a page
  // with the border off really shows no frame and no Send-to block (scan.mjs)
  let scan = 0;
  const strip = pg.querySelector('.strip');
  if (strip) {
    const kids = [...strip.children].map((k) => k.getBoundingClientRect()).filter((q) => q.width);
    for (let a = 0; a < kids.length; a++) for (let b = a + 1; b < kids.length; b++) if (kids[a].left < kids[b].right - 0.5 && kids[b].left < kids[a].right - 0.5) scan++;
    if (strip.scrollWidth > strip.clientWidth + 1) scan++;
  }
  if (pg.dataset.scanFrame === 'off') {
    if (getComputedStyle(pg.querySelector('.frame')).visibility !== 'hidden') scan++;
    scan += [...pg.querySelectorAll('.sendblk, .strip .send, .strip .sym')].filter((el) => getComputedStyle(el).visibility !== 'hidden').length;
  }
  return { n: i + 1, over, out, cell, clip, ...(blk.length ? { blk } : {}), ...(scan ? { scan } : {}) };
}).filter((x) => x.over || x.out || x.cell || x.clip || x.blk || x.scan);
