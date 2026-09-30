// Checks page parity in built books: every Exchange page must be a verso (even) with its Reply on the facing recto,
// and the first/last book must not point at a book that doesn't exist.
//   node check-spreads.mjs out/m2026-10 [out/m2026-10-letter ...]
import { readFileSync, existsSync } from 'node:fs';
import { firstMonthId, lastMonthId } from './profile.mjs';
let bad = 0;
for (const dir of process.argv.slice(2)) {
  const html = readFileSync(`${dir}/journal.html`, 'utf8');
  const pages = html.split(/<div class="page /).slice(1);
  const isX = (p, w) => p.includes(`<h2 class="pt">${w}</h2>`);
  const errs = [];
  pages.forEach((p, i) => {
    const n = i + 1;
    if (isX(p, 'Exchange')) {
      if (n % 2 !== 0) errs.push(`Exchange on recto p${n}`);
      if (!pages[i + 1] || !isX(pages[i + 1], 'Reply')) errs.push(`no Reply after Exchange p${n}`);
    }
    if (isX(p, 'Reply') && (n % 2 !== 1 || !pages[i - 1] || !isX(pages[i - 1], 'Exchange'))) errs.push(`Reply p${n} does not face its Exchange`);
  });
  // Pages with the scanning border off (scan.mjs): the html and layout.json must agree, the border must be gone with its Send-to strip, and a
  // spread with one framed page and one frame-less page is reported (fine, but Send-to works on only one side of it).
  const tag = (p) => p.slice(0, p.indexOf('>'));
  const noFrame = pages.map((p) => /data-scan-frame="off"/.test(tag(p)));
  pages.forEach((p, i) => { if (noFrame[i] && (/<span class="send">/.test(p) || /<div class="frame"><\/div>/.test(p))) errs.push(`p${i + 1} has the border off but still prints it or its SEND TO strip`); });
  if (existsSync(`${dir}/layout.json`)) {
    const L = JSON.parse(readFileSync(`${dir}/layout.json`, 'utf8')), fromHtml = pages.map((p, i) => (noFrame[i] ? /data-page-id="([^"]*)"/.exec(tag(p))?.[1] : null)).filter(Boolean);
    if (JSON.stringify(fromHtml) !== JSON.stringify(L.pages_without_frame || [])) errs.push(`pages without a border differ between journal.html (${fromHtml.join(', ') || 'none'}) and layout.json (${(L.pages_without_frame || []).join(', ') || 'none'})`);
  }
  const mixed = []; for (let i = 1; i < pages.length; i += 2) if (pages[i + 1] !== undefined && noFrame[i] !== noFrame[i + 1]) mixed.push(`${i + 1}-${i + 2}`);
  if (noFrame.some(Boolean)) console.log(`${dir}: ${noFrame.filter(Boolean).length} page(s) without the scanning border${mixed.length ? `; spreads with one bordered page: ${mixed.join(', ')}` : ''}`);
  const id = /m(\d{4}-\d{2})/.exec(dir)?.[1];
  if (id === firstMonthId() && /in the previous book/.test(html)) errs.push('first book says "previous book"');
  if (id === lastMonthId() && /in the next book/.test(html)) errs.push('last book says "next book"');
  console.log(`${dir}: ${pages.length} pages, ${errs.length ? errs.join('; ') : 'ok'}`);
  bad += errs.length;
}
process.exit(bad ? 1 : 0);
