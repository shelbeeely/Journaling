// Busy-calendar regression: a synthetic, generic calendar (7 long-titled timed events + 2 all-day events on several days
// per month, holidays included, plus a daily appointment) must still pass check.mjs on every month page, both sizes.
// Month cells and week rows cap + "+N more", so nothing spills. Temp .ics only (never committed).
// CI: `node test-busy.mjs` (all 12 months x 2 sizes), or `MONTHS="2026-10" SIZES=small node test-busy.mjs`.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const p2 = (n) => String(n).padStart(2, '0');
const tz = 'DTSTART;TZID=America/Los_Angeles:';
let s = 'BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//test//EN\n', i = 0;
const ev = (start, sum) => { s += `BEGIN:VEVENT\nUID:busy${i++}\n${start}\nSUMMARY:${sum}\nEND:VEVENT\n`; };
const all = [];
for (let y = 2026, m = 10, k = 0; k < 12; k++, m++) {
  if (m > 12) { m = 1; y++; }
  all.push(`${y}-${p2(m)}`);
  const ymd = (d) => `${y}${p2(m)}${p2(d)}`;
  for (const d of [1, 5, 12, 15, 18, 25, 26]) { // includes holiday dates (Jan 1, MLK, Thanksgiving, Christmas)
    for (let h = 0; h < 7; h++) ev(tz + ymd(d) + `T${p2(8 + h)}0000`, `Extremely long appointment title number ${h} with Pneumonoultramicroscopic details`);
    ev('DTSTART;VALUE=DATE:' + ymd(d), 'All-day conference on interdisciplinary communication');
    ev('DTSTART;VALUE=DATE:' + ymd(d), 'Second all-day event');
  }
  for (let d = 1; d <= 28; d++) ev(tz + ymd(d) + 'T090000', 'Supercalifragilistic checkup');
}
const ICS = path.join(os.tmpdir(), `busy-cal-${process.pid}.ics`);
fs.writeFileSync(ICS, s + 'END:VCALENDAR\n');
process.on('exit', () => fs.rmSync(ICS, { force: true }));

const months = (process.env.MONTHS || all.join(' ')).split(/\s+/).filter(Boolean);
const sizes = (process.env.SIZES || 'small letter').split(/\s+/).filter(Boolean);
let bad = 0;
for (const m of months) for (const size of sizes) {
  const env = { ...process.env }; delete env.SIZE; if (size === 'letter') env.SIZE = 'letter';
  const r = spawnSync('node', ['render.mjs', 'month', m, ICS], { env, encoding: 'utf8' });
  if (r.status) { console.error(`render failed for ${m} ${size}\n${r.stderr}`); bad++; continue; }
  const c = spawnSync('node', ['check.mjs', `m${m}${size === 'letter' ? '-letter' : ''}`], { env, encoding: 'utf8' });
  const ok = c.status === 0;
  console.log(`${ok ? 'ok  ' : 'FAIL'} busy ${m} ${size} ${c.stdout.trim()}`);
  if (!ok) bad++;
}
if (bad) { console.error(`${bad} busy-calendar build(s) overflow`); process.exit(1); }
console.log('busy calendar: every page fits');
