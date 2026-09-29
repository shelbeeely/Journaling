// The six month-end boxes must read the same on the X4 (This month), the book's Closing page and the Keeper's handoff
// (handoff.mjs is the one definition). Fails the build when a label or unit drifts.
//   node check-handoff.mjs [out/m2026-10 ...]     (default: every out/m* book plus out/keeper)
import fs from 'node:fs';
import { HANDOFF_BOXES as ALL_BOXES, SRC } from './handoff.mjs';
import { moduleOn } from './profile.mjs';
const HANDOFF_BOXES = ALL_BOXES.filter((b) => b.id !== 'spoons' || moduleOn('spoons')); // the spoons module off drops the Good-spoon box from the printed pages

const fails = [];
const need = (ok, msg) => { if (!ok) fails.push(msg); };
const unesc = (s) => s.replace(/&amp;/g, '&');

// 1. X4 firmware: the boxes it draws for the Keeper (the two bold tiles) use these labels and units.
const app = fs.readFileSync('../x4/src/app.cpp', 'utf8');
const x4 = HANDOFF_BOXES.filter((b) => b.src === 'x4');
for (const b of x4) {
  const m = app.match(new RegExp(`set\\(\\d, "${b.label}", "([^"]*)"`));
  need(!!m, `X4 This month has no tile labelled "${b.label}"`);
  if (m) need(m[1] === b.unit, `X4 tile "${b.label}" unit "${m[1]}" is not "${b.unit}"`);
}
// ...and it does not offer paper-owned numbers as tiles.
for (const b of HANDOFF_BOXES.filter((x) => x.src === 'paper')) need(!app.includes(`"${b.label}", "${b.unit}"`), `X4 draws paper-owned box "${b.label}"`);

// 2. Closing pages and the Keeper: all six labels, units and both source captions.
const dirs = process.argv.slice(2).length ? process.argv.slice(2) : fs.readdirSync('out').filter((d) => /^m\d{4}-\d{2}(-letter)?$/.test(d)).map((d) => `out/${d}`);
const files = dirs.map((d) => `${d}/journal.html`);
if (fs.existsSync('out/keeper/keeper.html')) files.push('out/keeper/keeper.html');
for (const f of files) {
  if (!fs.existsSync(f)) continue;
  const html = unesc(fs.readFileSync(f, 'utf8'));
  for (const b of HANDOFF_BOXES) {
    need(html.includes(`<span>${b.label}</span>`), `${f}: box "${b.label}" missing`);
    need(html.includes(b.unit), `${f}: unit "${b.unit}" missing for "${b.label}"`);
  }
  for (const s of Object.values(SRC)) need(html.includes(s.tag), `${f}: source caption "${s.tag}" missing`);
  // no leftovers of the old, mismatched labels
  for (const old of ['Meds, both doses', 'Enjoyed something', 'Showers']) need(!html.includes(`<span>${old}</span>`), `${f}: old label "${old}" still printed`);
}
console.log(fails.length ? fails.join('\n') : `handoff boxes agree on the X4, ${files.length} book/Keeper file(s)`);
process.exit(fails.length ? 1 : 0);
