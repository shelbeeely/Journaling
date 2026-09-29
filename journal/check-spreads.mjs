// Checks page parity in built books: every Exchange page must be a verso (even) with its Reply on the facing recto,
// and the first/last book must not point at a book that doesn't exist.
//   node check-spreads.mjs out/m2026-10 [out/m2026-10-letter ...]
import { readFileSync } from 'node:fs';
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
  const id = /m(\d{4}-\d{2})/.exec(dir)?.[1];
  if (id === firstMonthId() && /in the previous book/.test(html)) errs.push('first book says "previous book"');
  if (id === lastMonthId() && /in the next book/.test(html)) errs.push('last book says "next book"');
  console.log(`${dir}: ${pages.length} pages, ${errs.length ? errs.join('; ') : 'ok'}`);
  bad += errs.length;
}
process.exit(bad ? 1 : 0);
