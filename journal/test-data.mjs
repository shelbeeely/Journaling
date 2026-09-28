// Regression checks for data.mjs. CI: `node test-data.mjs` (generic data only: test.ics + a synthetic busy day).
import assert from 'node:assert/strict';
import * as A from 'astronomy-engine';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { build } from './data.mjs';

// Synthetic busy day (Oct 14 2026): 7 timed events + 1 all-day + 5 routines, written to a temp file (no .ics in the repo).
const tz = 'DTSTART;TZID=America/Los_Angeles:20261014T';
const vev = (i, start, sum, rr = '') => `BEGIN:VEVENT\nUID:b${i}\n${start}\n${rr}SUMMARY:${sum}\nEND:VEVENT\n`;
const timed = ['100000', '203000', '083000', '123000', '150000', '190000', '000000'].map((t, i) => vev(i, tz + t, 'Event ' + t));
const routines = ['130000', '140000', '150000', '080000', '210000'].map((t, i) => vev(20 + i, tz + t, 'Routine ' + t, 'RRULE:FREQ=WEEKLY;COUNT=2\n'));
const BUSY = path.join(os.tmpdir(), `busy-${process.pid}.ics`);
fs.writeFileSync(BUSY, `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//test//EN\n${timed.join('')}${vev(9, 'DTSTART;VALUE=DATE:20261014', 'All day')}${routines.join('')}END:VCALENDAR\n`);
process.on('exit', () => fs.rmSync(BUSY, { force: true }));

const vol = (yr, mo) => ({ n: 1, start: [yr, mo, 1], days: new Date(Date.UTC(yr, mo, 0)).getUTCDate(), id: `${yr}-${mo}` });
const SIGNS = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
const signOf = (lon) => SIGNS[Math.floor((((lon % 360) + 360) % 360) / 30)];
let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };
const months = Array.from({ length: 12 }, (_, i) => [2026 + Math.floor((8 + i) / 12), ((8 + i) % 12) + 1]);

// D1: events and routines sort by clock time, all-day first (was text order: 8:30a after 7:00p).
{
  const day = build(BUSY, vol(2026, 10)).days.find((d) => d.date === '2026-10-14');
  const times = (f) => day.events.filter(f).map((e) => e.time).join();
  ok(day.events.length === 13, `busy day has 13 items, got ${day.events.length}`);
  ok(day.events[0].allDay, 'all-day first');
  ok(times((e) => !e.routine && !e.allDay) === '12:00a,8:30a,10:00a,12:30p,3:00p,7:00p,8:30p', 'events: ' + times((e) => !e.routine && !e.allDay));
  ok(times((e) => e.routine) === '8:00a,1:00p,2:00p,3:00p,9:00p', 'routines: ' + times((e) => e.routine));
}

// MW2: a phase's sign is the sign at the exact phase moment. Independent check: at a quarter the Moon sits
// 0/90/180/270 degrees ahead of the Sun, so its longitude is Sun + 90*q. All 4 phases a month, Oct 2026 - Sep 2027.
{
  let count = 0; const seen = new Set();
  for (const [y, m] of months) for (const d of build('test.ics', vol(y, m)).days) {
    if (d.moon.quarter == null || seen.has(d.date)) continue;
    seen.add(d.date);
    const note = d.notes.find((x) => x.kind === 'moon');
    let q = A.SearchMoonQuarter(new Date(Date.UTC(d.y, d.m - 1, d.d) - 2 * 864e5));
    while (q.quarter !== d.moon.quarter || Math.abs(q.time.date - Date.UTC(d.y, d.m - 1, d.d, 12)) > 1.5 * 864e5) q = A.NextMoonQuarter(q);
    const want = signOf(A.SunPosition(q.time.date).elon + 90 * q.quarter);
    ok(d.moon.phaseSign === want && note.sign === want, `${d.date} ${note.text}: got ${d.moon.phaseSign}, want ${want}`);
    count++;
  }
  ok(count >= 49, `phases checked: ${count}`);
  // the five that used to be wrong (noon sign): Oct 25, Dec 23, Apr 20, May 20, Aug 24
  const sign = (y, m, date) => build('test.ics', vol(y, m)).days.find((d) => d.date === date).moon.phaseSign;
  ok(sign(2026, 10, '2026-10-25') === 'Taurus', 'Oct 25');
  ok(sign(2026, 12, '2026-12-23') === 'Cancer', 'Dec 23');
  ok(sign(2027, 4, '2027-04-20') === 'Scorpio', 'Apr 20');
  ok(sign(2027, 5, '2027-05-20') === 'Scorpio', 'May 20');
  ok(sign(2027, 8, '2027-08-24') === 'Gemini', 'Aug 24');
}

// MW8: every eclipse says whether Spokane can see it. Only Aug 17 2027 (penumbral) is up from Spokane.
{
  const notes = [];
  for (const [y, m] of months) for (const d of build('test.ics', vol(y, m)).days) for (const x of d.notes) if (/eclipse/.test(x.text)) notes.push(`${d.date} ${x.text}`);
  ok(notes.length === 5, `5 eclipses expected, got ${notes.length}`);
  ok(notes.every((t) => /(^| )(not )?visible from Spokane/.test(t)), 'each eclipse is labelled');
  ok(notes.filter((t) => !/not visible/.test(t)).length === 1 && /2027-08-17.*visible from Spokane · starts .*max .*ends/.test(notes.find((t) => !/not visible/.test(t))), 'only Aug 17 visible, with times');
}

// MW9: meteor showers cover Apr-Sep 2027.
{
  const all = [];
  for (const [y, m] of months.filter(([y, m]) => y === 2027 && m >= 4)) for (const d of build('test.ics', vol(y, m)).days) for (const x of d.notes) if (/meteor/.test(x.text)) all.push(x.text);
  for (const s of ['Lyrid', 'Eta Aquariid', 'Southern Delta Aquariid', 'Perseid']) ok(all.some((t) => t.startsWith(s)), s);
}
console.log(`data checks passed (${n})`);
