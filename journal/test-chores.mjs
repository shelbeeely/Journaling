// Chores test (CH1, BUILD-PLAN section 24): the chores blocks, the recurrence, the energy-aware wording, the household mode, the tone and the data model.
// Proves (1) the two blocks are declared like every other block (group, icon, options, day-only or not, no place to put a chore's text),
// (2) recurrence is computed from the date alone (daily, weekly, monthly, seasonal; leads that cross a month or a year; the last day of a short
// month; rotation of whose turn it is), (3) the tone: a neutral "due soon" marker and no counts, streaks, red, or shame words anywhere in the
// markup, the printed words or the CSS, (4) energy versions print as written, (5) household mode adds a box per person (and write-in columns when
// the profile names nobody), (6) the profile section is validated in plain words, (7) every CSS class starts with chx and appears nowhere else,
// (8) the default day page is untouched, (9) a Studio snapshot carries the block's options and never a chore, (10) the X4 data model (what the
// device would be sent, what it may send back), and (11) real books in both trims: check.mjs "[] 0", every block mapped to a scan zone, no
// Type 3 fonts, with large print and high contrast on.
//   node test-chores.mjs       (about three minutes: four book builds into out/chores-test/)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { DEFAULT_BOOK, validateBook } from './book.mjs';
import { addEntry, setLayout } from './bookedit.mjs';
import { catalog } from './editor/samples.mjs';
import { libraryFromProfile } from './library.mjs';
import { PROFILE, validateProfile } from './profile.mjs';
import { newBlock, normalize, dayBlocks, kindPage, gridProblems, minSpan, allowedIn, TYPES, IC, DEFAULT_LAYOUT, DAYPAGE_CSS, PRESETS } from './daypage.mjs';
import * as CH from './chores.mjs';
import { serializeDay } from '../studio/src/snapshot.mjs';

let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; console.log('ok   ' + m); };
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'kw-chores-'));
process.on('exit', () => fs.rmSync(TMP, { recursive: true, force: true }));
const ROOT = 'out/chores-test';
fs.rmSync(ROOT, { recursive: true, force: true });
fs.mkdirSync(ROOT, { recursive: true });
const B = (t, o = {}, uid = t) => newBlock(t, o, uid);
const at = (b, col, row, colSpan, rowSpan) => ({ ...b, col, row, colSpan, rowSpan });
const D = (s) => CH.chParse(s);
const text = (html) => html.replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]*>/g, ' ').replace(/&\w+;/g, ' ').replace(/\s+/g, ' ');
const attrs = (html) => [...html.matchAll(/aria-label="([^"]*)"|title="([^"]*)"/g)].map((m) => m[1] || m[2]).join(' ');
const page = (blocks, size = 'small', day = '2026-10-18') => dayBlocks({ header: '', routines: [], day: { date: day } }, normalize({ v: 2, blocks: [...blocks, B('body')] }, size), { size });
const grid = (blocks, size = 'small', day = '2026-10-18') => dayBlocks({ header: '', routines: [], day: { date: day } }, normalize({ v: 2, grid: true, blocks }, size), { size });
CH.chUse(null);
const cfg = CH.chConfig();
const item = (o) => CH.chNorm({ household: ['Alex', 'Sam'], items: [{ id: 'x', name: 'X', ...o }] }).items[0];
const iso = (a) => CH.chIso(a);

// ---- 1. declared like every other block ----
{
  ok(['chores', 'chorerota'].every((t) => TYPES[t] && TYPES[t].group === 'Chores' && IC[TYPES[t].icon] && TYPES[t].name && TYPES[t].hint), 'two blocks, chores and chorerota, in the palette group "Chores", each with an icon, a name and a hint');
  ok(Object.keys(TYPES).filter((t) => TYPES[t].group === 'Chores').length === 2, 'the Chores group holds exactly these two');
  ok(!TYPES.chores.single && !TYPES.chorerota.single, 'both can be added more than once (a list per room, a rotation per person)');
  ok(!allowedIn('notes', 'chores') && !allowedIn('collection', 'chores') && allowedIn('day', 'chores') && allowedIn('spread', 'chores') && allowedIn('half', 'chores'), 'the day list belongs on a day page (and the two pages of a spread day): it reads the date');
  ok(['day', 'notes', 'collection', 'blank', 'spread', 'half'].every((k) => allowedIn(k, 'chorerota')), 'the rotation grid works on every kind of page, dated or not');
  const kinds = new Set(['chores', 'chorerota'].flatMap((t) => TYPES[t].opts.map((o) => o.kind)));
  ok([...kinds].every((k) => ['num', 'bool', 'choice', 'text', 'flags'].includes(k)), 'options are only numbers, switches, choices, flags and a label: ' + [...kinds].join(', '));
  ok(['chores', 'chorerota'].every((t) => TYPES[t].opts.filter((o) => o.kind === 'text' || o.kind === 'list').map((o) => o.k).join() === 'title'), 'the only free text a block holds is its label: no option could carry a chore, a name or a person (the chores live in the profile)');
  const c = B('chores'), r = B('chorerota');
  ok(c.n === 5 && c.tiers === 'none' && c.soon === true && c.people === false && Object.values(c.groups).every(Boolean) && r.period === 'week' && r.n === 10 && r.people === false && r.tiers === false, 'defaults: five lines, no energy versions, "due soon" on, no household; a week grid of up to ten chores');
  const nb = normalize({ v: 2, blocks: [{ type: 'chores', uid: 'a', n: 99, tiers: 'loud', people: 'yes', groups: { day: false, week: 'x', nonsense: true } }, { type: 'chorerota', uid: 'b', period: 'year', n: 1 }, B('body')] }), g = (u) => nb.blocks.find((b) => b.uid === u);
  ok(g('a').n === 10 && g('a').tiers === 'none' && g('a').people === true && g('a').groups.day === false && g('a').groups.week === true && !('nonsense' in g('a').groups) && g('b').period === 'week' && g('b').n === 4, 'out-of-range options are put right when a layout is read');
  ok(PRESETS.filter((p) => p.group === 'Chores').length === 4 && PRESETS.filter((p) => p.group === 'Chores').every((p) => TYPES[p.type].group === 'Chores'), 'four ready-made blocks in the palette: low-energy list, week, month, household week');
}

// ---- 2. recurrence is computed from the date ----
{
  const sample = (id) => cfg.items.find((i) => i.id === id);
  // weekday: 2026-10-18 is a Sunday
  ok(CH.chDow(D('2026-10-18')) === 6 && CH.chDow(D('2026-10-19')) === 0 && CH.chDow(D('1970-01-01')) === 3, 'weekdays count from Monday (2026-10-18 is a Sunday, 1970-01-01 a Thursday)');
  ok(CH.chParse('2026-02-30') === null && CH.chParse('nope') === null && CH.chParse('') === null, 'a date that does not exist is no date');
  const daily = item({ every: 'day' }), mwf = item({ every: 'day', days: ['mon', 'wed', 'fri'] });
  ok(CH.chOcc(daily, D('2026-10-18')) && [0, 1, 2, 3, 4, 5, 6].every((i) => (CH.chOcc(mwf, D('2026-10-19') + i) !== null) === [0, 2, 4].includes(i)), 'daily chores are listed every day, or on the weekdays given');
  ok(!CH.chOcc(daily, D('2026-10-18')).soon, 'a daily chore is never "due soon"');
  // weekly with a due day (Saturday, listed 3 days before)
  const sat = item({ every: 'week', day: 'sat' }), listed = (it, from, days) => Array.from({ length: days }, (_, i) => iso(D(from) + i)).filter((d) => CH.chOcc(it, D(d)));
  ok(listed(sat, '2026-10-12', 7).join() === '2026-10-14,2026-10-15,2026-10-16,2026-10-17', 'a weekly chore due Saturday is listed Wed to Sat (three days of lead)');
  ok(CH.chOcc(sat, D('2026-10-17')).soon && CH.chOcc(sat, D('2026-10-16')).soon && !CH.chOcc(sat, D('2026-10-15')).soon && !CH.chOcc(sat, D('2026-10-14')).soon, 'it is "due soon" on the due day and the day before, and not before that');
  ok(CH.chOcc(sat, D('2026-10-18')) === null, 'the day after the due day it is not listed (nothing is "overdue": the next one is not listed yet either)');
  const mon = item({ every: 'week', day: 'mon', lead: 3 });
  ok(listed(mon, '2026-10-12', 7).join() === '2026-10-12,2026-10-16,2026-10-17,2026-10-18' && CH.chOcc(mon, D('2026-10-16')).due === D('2026-10-19') && CH.chOcc(mon, D('2026-10-18')).due === D('2026-10-19'), 'a weekly chore due Monday is listed from the Friday before (the lead crosses into the week before)');
  const any = item({ every: 'week' });
  ok(listed(any, '2026-10-12', 7).length === 7 && CH.chOcc(any, D('2026-10-17')).soon && CH.chOcc(any, D('2026-10-18')).soon && !CH.chOcc(any, D('2026-10-16')).soon, 'a weekly chore with no day is listed all week, due Sunday: "due soon" on Saturday and Sunday');
  // monthly
  const m15 = item({ every: 'month', day: 15 });
  ok(listed(m15, '2026-10-01', 31).join() === '2026-10-10,2026-10-11,2026-10-12,2026-10-13,2026-10-14,2026-10-15' && CH.chOcc(m15, D('2026-10-14')).soon && !CH.chOcc(m15, D('2026-10-13')).soon, 'a monthly chore due the 15th is listed from the 10th (five days of lead), "due soon" on the 14th and 15th');
  const last = item({ every: 'month', day: 'last' });
  ok(CH.chOcc(last, D('2026-02-28')).due === D('2026-02-28') && CH.chOcc(last, D('2028-02-29')).due === D('2028-02-29') && CH.chOcc(last, D('2026-02-27')).soon && CH.chOcc(last, D('2026-04-30')).due === D('2026-04-30') && CH.chOcc(last, D('2026-04-20')) === null, '"last" is the last day of the month, in a short month and in a leap year');
  const m1 = item({ every: 'month', day: 1, lead: 5 });
  ok(CH.chOcc(m1, D('2026-12-28')).due === D('2027-01-01') && CH.chOcc(m1, D('2026-12-26')) === null && CH.chOcc(m1, D('2026-12-31')).soon, 'a chore due the 1st is listed in the last days of the month before, across a year end');
  ok(listed(item({ every: 'month', day: 28, lead: 0 }), '2026-02-01', 28).join() === '2026-02-28' && CH.chNorm({ items: [{ id: 'a', name: 'A', every: 'month', day: 31 }] }).items[0].day === 1, 'a month day above 28 is not offered (28 is the highest); "last" is');
  // seasonal
  const win = sample('windows'), war = item({ every: 'season', months: [3, 6, 9, 12], day: 1, lead: 7 });
  ok(CH.chOcc(war, D('2027-02-25')).due === D('2027-03-01') && CH.chOcc(war, D('2027-02-20')) === null && CH.chOcc(war, D('2026-12-25')) === null && CH.chOcc(war, D('2026-11-30')).due === D('2026-12-01'), 'a seasonal chore on the first of March, June, September and December is listed a week before');
  const jan = item({ every: 'season', months: [1], day: 3, lead: 10 });
  ok(CH.chOcc(jan, D('2026-12-25')).due === D('2027-01-03') && CH.chOcc(jan, D('2027-01-04')) === null, 'a seasonal chore in January is listed in the last days of December');
  ok(win.months.join() === '4,10' && CH.chOcc(win, D('2026-10-05')).due === D('2026-10-10') && CH.chOcc(win, D('2026-11-05')) === null && CH.chOcc(win, D('2027-03-31')).due === D('2027-04-10'), 'the sample\'s windows chore comes in April and October only');
  // the same date always gives the same answer
  const day = (d) => JSON.stringify(CH.chToday(cfg, D(d)).map((e) => [e.it.id, e.soon, e.who]));
  ok(day('2026-10-31') === day('2026-10-31') && day('2026-10-31') !== day('2026-11-01'), 'the same date always gives the same list (a reprint is identical), another date another list');
  // today's list: due-soon first, then daily, then the rest
  const t = CH.chToday(cfg, D('2026-10-31'));
  ok(t.map((e) => e.it.id).join() === 'laundry,floors,bed-linen,fridge,oven,dishes,counters,floor-things' && t.slice(0, 5).every((e) => e.soon) && t.slice(5).every((e) => !e.soon), 'on 2026-10-31 the chores due soon come first, then the daily ones');
  ok(CH.chToday(cfg, null).every((e) => e.it.every === 'day') && CH.chToday(cfg, null).length === 3, 'with no date (an undated book) only the daily chores can be listed');
  ok(CH.chToday(cfg, D('2026-10-31'), { day: false, week: true, month: true, season: true }).every((e) => e.it.every !== 'day'), 'the rhythms switch chores in and out of a list');
  // whose turn: rotates with the week, the month, the season
  const rb = cfg.items.find((i) => i.id === 'bathroom'), turn = (d) => CH.chWho(rb, cfg.people, CH.chOcc(rb, D(d)).k);
  ok(turn('2026-10-16') !== turn('2026-10-23') && turn('2026-10-16') === turn('2026-10-30') && turn('2026-10-14') === turn('2026-10-16') && cfg.people.includes(turn('2026-10-16')), 'a rotating chore changes hands each time it comes round (and stays with one person for the whole week it is listed)');
  ok(CH.chWho({ who: 'Sam' }, cfg.people, 5) === 'Sam' && CH.chWho({}, cfg.people, 5) === '', 'a chore can belong to one person, or to nobody');
  ok(CH.chToday(cfg, null).every((e) => e.who === ''), 'an undated page does not guess whose turn it is');
}

// ---- 3. the profile section is validated in words ----
{
  ok(CH.chProblems(undefined).length === 0 && CH.chProblems(CH.CH_SAMPLE).length === 0, 'no section is fine, and so is the sample');
  const bad = (c) => CH.chProblems(c).join(' | ');
  ok(/items.*1 to 40/.test(bad({ items: [] })) && /must be an object/.test(bad([])), 'an empty list and a wrong type are named');
  ok(/id.*is used twice/.test(bad({ items: [{ id: 'a', name: 'A', every: 'day' }, { id: 'a', name: 'B', every: 'day' }] })) && /\.id.*lowercase/.test(bad({ items: [{ id: 'Bad Id', name: 'A', every: 'day' }] })), 'a repeated or untidy id is named');
  ok(/every.*one of day, week, month, season/.test(bad({ items: [{ id: 'a', name: 'A', every: 'fortnight' }] })) && /name.*1 to 28/.test(bad({ items: [{ id: 'a', name: 'x'.repeat(29), every: 'day' }] })), 'an unknown rhythm and a long name are named');
  ok(/\.day.*one of mon/.test(bad({ items: [{ id: 'a', name: 'A', every: 'week', day: 'funday' }] })) && /1 to 28, or "last"/.test(bad({ items: [{ id: 'a', name: 'A', every: 'month', day: 31 }] })) && /months/.test(bad({ items: [{ id: 'a', name: 'A', every: 'season', months: [13] }] })) && /lead.*0 to 6/.test(bad({ items: [{ id: 'a', name: 'A', every: 'week', lead: 9 }] })), 'a bad weekday, month day, month or lead says what is allowed');
  ok(/rotate.*two or more/.test(bad({ items: [{ id: 'a', name: 'A', every: 'day', who: 'rotate' }] })) && /household/.test(bad({ household: ['a', 'b', 'c', 'd', 'e'], items: [{ id: 'a', name: 'A', every: 'day' }] })) && /1 to 60/.test(bad({ items: [{ id: 'a', name: 'A', every: 'day', min: 'x'.repeat(61) }] })), 'rotation needs a household, a household has at most four names, a small version is at most 60 characters');
  const base = JSON.parse(fs.readFileSync('content/profile.example.json', 'utf8'));
  ok(validateProfile(base).length === 0 && validateProfile({ ...base, chores: CH.CH_SAMPLE }).length === 0, 'the profile validator accepts a profile with no chores section and one with the sample');
  ok(validateProfile({ ...base, chores: { items: [{ id: 'a', name: '', every: 'day' }] } }).some((e) => /^chores\.items\[0\]\.name/.test(e)), 'and names the chore that is wrong');
}

// ---- 4. the tone ----
const FORBIDDEN = /overdue|over due|\blate\b|missed|behind|streak|failed|failure|lazy|should|must|\bonly\b|\bjust\b|shame|guilt|deadline|urgent|warning|alert|\bred\b|\bcount\b|score|points|\bbad\b|hurry|catch up/i;
const every = []; // every piece of markup drawn in this test, for the class check
{
  const variants = [
    page([B('chores', { tiers: 'text' })]), page([B('chores', { tiers: 'ticks' })]), page([B('chores', { people: true, tiers: 'text' })]), page([B('chores', { n: 2 })]),
    page([B('chorerota', { tiers: true })]), page([B('chorerota', { period: 'month', tiers: true })]), page([B('chorerota', { people: true })]), page([B('chorerota', { period: 'month', people: true, n: 4 })]),
    page([B('chores')], 'small', ''), page([B('chorerota')], 'small', ''), page([B('chorerota', { period: 'month' })], 'small', ''),
  ];
  every.push(...variants);
  const all = variants.map((h) => text(h) + ' ' + attrs(h)).join(' ');
  ok(!FORBIDDEN.test(all) && !FORBIDDEN.test(JSON.stringify(CH.CH_WORDS)), 'nothing printed or read aloud uses overdue, late, missed, streak, count, score, red or shame wording');
  ok(!/\d+ (more|chores|left|to do|due|overdue)/i.test(all) && !/\+\d/.test(all), 'no chore count is printed (when a list is longer than the room it says "and more", with no number)');
  const tone = DAYPAGE_CSS.slice(DAYPAGE_CSS.indexOf('/* Chores (chores.mjs)'));
  const css = CH.CH_CSS, hex = [...css.matchAll(/#([0-9a-fA-F]{3,8})\b/g)].map((m) => m[1]);
  ok(css.length > 500 && DAYPAGE_CSS.includes(css) && tone.length > 0, 'the chores CSS is part of the page CSS');
  ok(hex.length > 5 && hex.every((h) => (h.length === 3 && h[0] === h[1] && h[1] === h[2]) || (h.length === 6 && h.slice(0, 2) === h.slice(2, 4) && h.slice(2, 4) === h.slice(4, 6))), `every colour in the chores CSS is a grey (${hex.length} colours checked), and none is red`);
  ok(!/\bred\b|rgb\(|hsl|orange|crimson|#f00|#ff0000/i.test(css.replace(/\/\*[^]*?\*\//g, '')) && !/stroke="#|fill="#/.test(variants.join('')), 'no named or computed colour, and no coloured SVG');
  const soon = page([B('chores')], 'small', '2026-10-31');
  ok(/chxd/.test(soon) && /<svg class="chxs"[^>]*><path d="M6 1\.6 10\.4 6 6 10\.4 1\.6 6Z"\/><\/svg>soon/.test(soon), 'the "due soon" marker is a small open diamond and the word "soon"');
  ok(!/chxd/.test(page([B('chores', { soon: false })], 'small', '2026-10-31')) && !/chxd/.test(page([B('chores')], 'small', '2026-10-21')), 'it can be switched off, and a day with nothing due soon has none');
  const exp = Object.keys(CH).join(' ');
  ok(!/streak|overdue|late|missed|count|score/i.test(exp), 'the module exports nothing that counts, scores or measures lateness: ' + exp.match(/ch\w+/gi).slice(0, 4).join(', ') + ' ...');
}

// ---- 5. energy-aware: a small version and a good-enough version ----
{
  const h = page([B('chores', { tiers: 'text', n: 8 })], 'small', '2026-10-31');
  const dishes = cfg.items.find((i) => i.id === 'dishes');
  ok(h.includes(`<em>small</em> ${dishes.min} · <em>good enough</em> ${dishes.ok}`) && (h.match(/class="chxt"/g) || []).length === 8, 'tiers "text" prints the small and the good-enough version of every chore that has them, as written');
  const t = page([B('chores', { tiers: 'ticks' })], 'small', '2026-10-31');
  ok((t.match(/class="chxq"/g) || []).length === 3 * 4 + 3 && /chx3/.test(t) && !/class="chxb"/.test(t), 'tiers "ticks" gives each chore three round marks (a quarter, a half, all of it) in place of the box, and says what they mean once');
  ok(/class="chxkl"[^>]*>[^]*small[^]*good enough[^]*all of it/.test(t), 'the key says: small, good enough, all of it');
  ok(!/class="chxt"/.test(page([B('chores')], 'small', '2026-10-31')), 'with no energy versions nothing else is added to the list');
  const plain = CH.CH_SAMPLE.items.map((i) => ({ id: i.id, name: i.name, every: i.every, day: i.day, months: i.months }));
  CH.chUse({ items: plain });
  ok(!/chxt/.test(page([B('chores', { tiers: 'text' })], 'small', '2026-10-31')), 'a chore with no versions written prints no empty line');
  CH.chUse(null);
  const r = page([B('chorerota', { tiers: true })]);
  ok(/<em>small<\/em>/.test(r) && /<em>good enough<\/em>/.test(r), 'the rotation grid can print them too');
  ok(page([B('chores', { n: 3 })], 'small', '2026-10-31').includes('chxo') && !page([B('chores', { n: 10 })], 'small', '2026-10-31').includes('chxo'), 'a list longer than its room says "and more", and room left over becomes write-in lines (a box and a rule)');
  ok((page([B('chores', { n: 10 })], 'small', '2026-10-31').match(/class="chxr chxe"/g) || []).length === 2, 'eight chores in ten lines leave two write-in lines');
}

// ---- 6. household mode ----
{
  const h = page([B('chores', { people: true, n: 8 })], 'small', '2026-10-31'), r = page([B('chorerota', { people: true })]);
  ok((h.match(/class="chxr chxh"/g) || []).length === 8 && /--p:2/.test(h) && /A Alex · S Sam/.test(h), 'a household list has a box for each of the two people on every line, and says which letter is whom');
  const oven = h.slice(h.indexOf('>Clean the oven<'));
  ok(/class="chxb chxa"[^]*class="chxb"/.test(oven.slice(0, 600)) || /class="chxb"[^]*class="chxb chxa"/.test(oven.slice(0, 600)), 'a chore that is somebody\'s turn has that person\'s box drawn heavier');
  ok((r.match(/class="chxb chxa"/g) || []).length >= 1 && (r.match(/<b title="/g) || []).length === 2, 'the rotation grid adds a column for each person after the days, with the turn marked');
  CH.chUse({ items: CH.CH_SAMPLE.items.map(({ who, ...i }) => i) });
  const none = page([B('chores', { people: true, n: 8 })], 'small', '2026-10-31');
  ok((none.match(/class="chxb"/g) || []).length === 16 && !/chxkl/.test(none), 'a profile that names nobody gets two write-in columns and no names line');
  CH.chUse({ household: ['Ann', 'Alf', 'Bo', 'Cy'], items: [{ id: 'a', name: 'A', every: 'day' }] });
  ok(CH.chInitials(CH.chConfig().people).join() === 'An,Al,B,C' && /--p:4/.test(page([B('chores', { people: true })])) && minSpan(B('chores', { people: true })).cols === 3, 'four people: initials stay apart (An, Al, B, C) and the block asks for three columns');
  CH.chUse(null);
  ok(minSpan(B('chorerota', { people: true })).cols === 4 && minSpan(B('chorerota')).cols === 3 && minSpan(B('chores')).cols === 2, 'minimum widths: a week grid with people needs the whole page, without three columns; a list needs two');
}

// ---- 7. fit: minimums, refusals, zones ----
{
  const min = minSpan(B('chorerota')); // a week grid at its smallest
  ok(min.cols === 3 && min.rows > 10, `the week grid asks for ${min.cols} columns by ${min.rows} rows`);
  const small = at(B('chorerota'), 1, 1, 2, 4);
  const probs = gridProblems(normalize({ v: 2, grid: true, blocks: [small, at(B('body'), 1, 6, 4, 18)] }), 'small');
  ok(probs.length === 1 && /Chore rotation needs at least 3 columns/.test(probs[0].msg), 'a grid layout that squeezes a rotation too small is refused in plain words: ' + (probs[0] || {}).msg);
  const ok2 = gridProblems(normalize({ v: 2, grid: true, blocks: [at(B('chores'), 1, 1, 2, minSpan(B('chores')).rows), at(B('chorerota'), 1, 8, 4, minSpan(B('chorerota')).rows), at(B('body'), 3, 1, 2, 8)].map((b, i) => (i === 1 ? { ...b } : b)) }), 'small');
  ok(ok2.length === 0 || ok2.every((p) => p.code !== 'min'), 'the minimum span is enough: the grid accepts a list and a rotation at their minimums');
  const h = grid([at(B('chores'), 1, 1, 2, 6), at(B('chores', {}, 'two'), 3, 1, 2, 6), at(B('body'), 1, 7, 4, 17)]);
  ok(/data-zone="chores"/.test(h) && /data-zone="chores_2"/.test(h), 'every block carries a data-zone, and a repeat gets _2');
  ok(/role="group" aria-label="Chores: /.test(page([B('chores')])), 'each block is a labelled group for a screen reader, with the chores named in the label');
  const none = dayBlocks({ header: '', routines: [] }, normalize({ v: 2, blocks: [B('chorerota'), B('body')] }), { size: 'small' });
  ok(/Chores this week/.test(none) && !/chxm/.test(none), 'with no date a rotation prints as a template (the chores that repeat every week, daily and weekly)');
  ok(!/Test the smoke alarms/.test(none) && /Rubbish and recycling/.test(none), 'a template week leaves out monthly and seasonal chores (they need a date to know which week); the month grid has them');
  const mo = page([B('chorerota', { period: 'month' })], 'small', '');
  ok(/Wash the windows/.test(mo) && /<small>Apr Oct<\/small>/.test(mo) && /Test the smoke alarms/.test(mo), 'a template month shows the seasonal chores with their months beside them');
  const mo2 = page([B('chorerota', { period: 'month' })], 'small', '2026-10-18');
  ok(/Wash the windows/.test(mo2) && !/Swap the wardrobe/.test(mo2) && /Oct 2026/.test(mo2) && /<em>Daily<\/em> Dishes/.test(mo2), 'a dated month shows only this month\'s seasonal chores, and the daily ones as one line, not boxes');
  const wk = page([B('chorerota')], 'small', '2026-10-18');
  ok(/Oct 12 – 18/.test(wk) && /Oct 26 – Nov 1/.test(page([B('chorerota')], 'small', '2026-10-28')), 'a dated week names its days, across a month end too');
  every.push(h, none, mo, mo2, wk);
}

// ---- 8. class names: every one starts with chx, and chx appears nowhere else ----
{
  const classes = new Set();
  for (const h of every) for (const m of h.matchAll(/class="([^"]*)"/g)) for (const c of m[1].split(/\s+/)) if (c) classes.add(c);
  const mine = [...classes].filter((c) => /^chx/.test(c)), other = [...classes].filter((c) => !/^chx/.test(c) && !['xb', 'xl', 'ic', 'cap', 'zl', 'gc', 'gg', 'fill', 'day', 'full', 'gm', 'log', 'dots'].includes(c));
  ok(mine.length >= 20 && other.length === 0, `the blocks draw ${mine.length} chx classes and borrow only the shared ones (xb, xl, ic): ${other.join(' ') || 'nothing else'}`);
  const css = [...CH.CH_CSS.replace(/\/\*[^]*?\*\//g, '').matchAll(/\.([a-z][\w-]*)/g)].map((m) => m[1]).filter((c) => !/^\d/.test(c));
  ok(css.every((c) => /^chx/.test(c) || ['xl'].includes(c)), 'every selector in the chores CSS is a chx class (or the shared label, xl)');
  // chx appears in no other file: the engine, the editor, the site, the studio, the firmware
  const skip = new Set(['node_modules', 'out', 'out-demo', 'out-sample', 'dist', 'dist-demo', '.git', 'shots', 'img', '.pio']);
  const found = [];
  const walk = (dir) => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { if (skip.has(e.name) || e.name.startsWith('out-')) continue; const f = path.join(dir, e.name); if (e.isDirectory()) walk(f); else if (/\.(mjs|js|html|css|json|md|py|c|h|cpp|sh|yml)$/.test(e.name) && fs.statSync(f).size < 4e6 && /\bchx[a-z0-9_-]*/.test(fs.readFileSync(f, 'utf8'))) found.push(path.relative('..', f)); } };
  walk('..');
  const allowed = new Set(['journal/chores.mjs', 'journal/test-chores.mjs', 'journal/i18n/print-strings.md', 'docs/journaling/BUILD-PLAN.md', 'docs/journaling/chores.md']);
  ok(found.every((f) => allowed.has(f)), 'the prefix chx is used by chores.mjs and nothing else' + (found.filter((f) => !allowed.has(f)).length ? ': also in ' + found.filter((f) => !allowed.has(f)).join(', ') : ''));
  const js = fs.readFileSync('chores.mjs', 'utf8');
  const tops = [...js.matchAll(/^(?:export )?(?:const|let|function) (\w+)/gm)].map((m) => m[1]);
  ok(tops.length > 20 && tops.every((t) => /^(ch|CH_)/.test(t)), 'every top-level name in chores.mjs starts with ch or CH_ (the editor inlines the file next to daypage.mjs)');
}

// ---- 9. the default page is untouched ----
{
  ok(!DEFAULT_LAYOUT.blocks.some((b) => ['chores', 'chorerota'].includes(b.type)), 'the default day layout has no chores block');
  const html = dayBlocks({ header: '', routines: [], day: { date: '2026-10-18' } }, DEFAULT_LAYOUT, { size: 'small' });
  ok(!/chx/.test(html) && !/chx/.test(kindPage('notes', 'Notes', null, 'small')) && !/chx/.test(kindPage('blank', '', null, 'small')), 'the default day, Notes and blank pages carry no chores markup (check-identical.mjs compares the whole default book byte for byte)');
}

// ---- 10. Studio snapshot: options only, never a chore ----
{
  const stray = { type: 'chores', uid: 'c', n: 4, items: [{ id: 'secret', name: 'Call the landlord' }], household: ['Someone'], chores: [1], people: true, tiers: 'text' };
  const snap = serializeDay({ v: 2, blocks: [stray, B('body')] }, []), kept = snap.blocks.find((b) => b.type === 'chores');
  ok(kept && kept.n === 4 && kept.people === true && kept.tiers === 'text' && !('items' in kept) && !('household' in kept) && !('chores' in kept) && !JSON.stringify(snap).includes('landlord') && !JSON.stringify(snap).includes('Someone'), 'a Studio snapshot keeps the declared options and drops any chore or person that is not one');
  const none = JSON.stringify(serializeDay(normalize({ v: 2, blocks: [B('chorerota'), B('body')] }), []));
  ok(!CH.CH_SAMPLE.items.some((i) => none.includes(i.name)) && !CH.CH_SAMPLE.household.some((p) => none.includes(p)), 'and the sample chores and names are not in a snapshot of a layout that uses them');
}

// ---- 11. the X4 data model (the firmware is a later slice: BUILD-PLAN section 24.6) ----
{
  const pack = CH.chX4Pack(cfg, '2026-10-30', 3), days = Object.keys(pack);
  ok(days.join() === '2026-10-30,2026-10-31,2026-11-01' && pack['2026-10-31'].some((e) => e.id === 'oven' && e.soon === true && e.who) && pack['2026-10-31'].every((e) => e.label.length <= 28 && /^[a-z0-9-]+$/.test(e.id)), 'the pack for a run of days lists each date\'s chores with an id, a short label, the versions, whose turn and "soon"');
  ok(Object.values(pack).flat().every((e) => Object.keys(e).every((k) => ['id', 'label', 'min', 'ok', 'who', 'soon'].includes(k))), 'a pack row has no field for a count, a streak or a lateness: ' + [...new Set(Object.values(pack).flat().flatMap((e) => Object.keys(e)))].join(', '));
  const off = CH.chNorm({ items: [{ id: 'a', name: 'A', every: 'day' }, { id: 'b', name: 'B', every: 'day', x4: false }] });
  ok(CH.chX4Pack(off, '2026-10-30', 1)['2026-10-30'].map((e) => e.id).join() === 'a', 'a chore with x4: false stays off the device');
  ok(Object.keys(CH.chX4Pack(cfg, '2026-10-30', 500)).length === 62 && Object.keys(CH.chX4Pack(cfg, 'junk', 3)).length === 0, 'a pack covers at most 62 days, and a bad date gives nothing');
  const t = CH.chTicks({ dishes: 2, oven: 3, nope: 1, counters: 7, laundry: 'yes', 'floor-things': 0, __proto__: 1 }, cfg);
  ok(JSON.stringify(t) === '{"dishes":2,"oven":3}', 'a tick report from the device keeps only known chores with a level of 1 to 3: ' + JSON.stringify(t));
  ok(CH.CH_LEVELS.join() === 'none,small,enough,full', 'a tick means none, small, good enough or all of it: any of the last three counts as done');
  const plan = fs.readFileSync('../docs/journaling/BUILD-PLAN.md', 'utf8'), fw = fs.readdirSync('../x4', { recursive: true }).filter((f) => /\.(c|cpp|h|ino|ini)$/.test(f)).map((f) => fs.readFileSync(path.join('../x4', f), 'utf8')).join('\n');
  ok(!/chore/i.test(fw), 'the firmware is untouched: nothing about chores in x4/ yet (a follow-up slice, with its own scope review)');
  ok(/## 24\. Chores/.test(plan) && /explicit/i.test(plan.slice(plan.indexOf('## 24. Chores'))), 'BUILD-PLAN section 24 holds the plan, and says the sync is explicit');
}

// ---- 12. the books: both trims, plain and with large print and high contrast ----
{
  const MONTH = '2026-10', must = (r) => { assert.ok(r.book, r.err); return r.book; };
  const cat = await catalog(MONTH, DEFAULT_BOOK), L = (kind, blocks) => normalize({ v: 2, kind, grid: true, blocks }, 'small', kind);
  let b = must(addEntry(DEFAULT_BOOK, cat, null, 'collection', { before: 'theme' }, { title: 'Week of chores' }));
  b = must(addEntry(b, cat, null, 'collection', { before: 'theme' }, { title: 'Month of chores' }));
  const wk = B('chorerota', { people: true, n: 8 }), mo = B('chorerota', { period: 'month', n: 6 }), wr = minSpan(wk).rows, mr = minSpan(mo).rows;
  assert.ok(wr + 8 <= 24 && mr + 8 <= 24, `the grids leave the Writing space its 8 rows (${wr}, ${mr})`);
  b = must(setLayout(b, cat, null, 'collection_1', L('collection', [at(wk, 1, 1, 4, wr), at(B('body'), 1, wr + 1, 4, 24 - wr)])));
  b = must(setLayout(b, cat, null, 'collection_2', L('collection', [at(mo, 1, 1, 4, mr), at(B('body'), 1, mr + 1, 4, 24 - mr)])));
  assert.equal(validateBook(b).length, 0, validateBook(b).join('; '));
  ok(validateBook(b).length === 0, 'a book with a week grid and a month grid on Collection pages validates');
  const c1 = B('chores', { tiers: 'text', n: 5 }), c2 = B('chores', { tiers: 'ticks', n: 2 }, 'low'), r1 = minSpan(c1).rows, r2 = minSpan(c2).rows;
  assert.ok(3 + r1 + r2 + 8 <= 25, `the two lists leave the Writing space its 8 rows (${r1}, ${r2})`);
  const day = normalize({ v: 2, grid: true, blocks: [at(B('sky'), 1, 1, 4, 2), at(c1, 1, 3, 4, r1), at(c2, 1, 3 + r1, 2, r2), at(B('body'), 1, 3 + r1 + r2, 4, 25 - (3 + r1 + r2))] });
  const lib = libraryFromProfile(PROFILE); lib.layouts = [{ id: 'mine', name: 'Chores', book: b, day }]; lib.books[0].layoutRef = 'mine';
  const libFile = path.join(TMP, 'library.json'); fs.writeFileSync(libFile, JSON.stringify(lib));
  const a11y = (() => { const p = JSON.parse(fs.readFileSync('content/profile.json', 'utf8')); p.print = { large_print: true, high_contrast: true }; const f = path.join(TMP, 'a11y.json'); fs.writeFileSync(f, JSON.stringify(p)); return f; })();
  const run = (s, a, env = {}) => execFileSync('node', [s, ...a], { env: { ...process.env, KW_LIBRARY: libFile, ...env }, stdio: 'pipe' }).toString();
  const TRIM = { small: '5.5x8.5', letter: '8.5x11' };
  for (const [tag, size, prof] of [['small', 'small', null], ['letter', 'letter', null], ['small-a11y', 'small', a11y], ['letter-a11y', 'letter', a11y]]) {
    const out = `${ROOT}/${tag}`, env = { KW_OUT: out, SIZE: size, ...(prof ? { KW_PROFILE: prof } : {}) };
    run('render.mjs', ['month', MONTH, 'test.ics'], env);
    const dirName = `m${MONTH}${size === 'letter' ? '-letter' : ''}`, dir = `${out}/${dirName}`, lay = JSON.parse(fs.readFileSync(`${dir}/layout.json`, 'utf8'));
    const pdf = `${dir}/${fs.readdirSync(dir).find((f) => /interior.*\.pdf$/.test(f))}`, label = `${TRIM[size]}${prof ? ' with large print and high contrast on' : ''}`;
    ok(/^\[\] 0$/.test(run('check.mjs', [dirName], env).trim()), `${label}: check.mjs, every page fits ("[] 0")`);
    const pg = (id) => lay.pages.find((p) => p.id === id), zones = (id) => (pg(id) ? pg(id).zones.map((z) => z.zone) : []);
    ok(zones('collection_1').includes('chorerota') && zones('collection_2').includes('chorerota') && zones('day.2026-10-14').includes('chores') && zones('day.2026-10-14').includes('chores_2'), `${label}: layout.json maps a zone for every chores block (a repeat is chores_2)`);
    ok(['collection_1', 'day.2026-10-14'].every((id) => ['date', 'title', 'tags'].some((z) => zones(id).includes(z)) && zones(id).includes('page_code')) && pg('day.2026-10-14').zones.every((z) => z.w > 0 && z.h > 0), `${label}: the fixed scan zones (header, page code) are still there, and every zone has a size`);
    ok(!/Type 3/.test(execFileSync('pdffonts', [pdf]).toString()), `${label}: no Type 3 fonts`);
    ok(/ok/.test(run('check-pages.mjs', [dir], env)) && /ok/.test(run('check-codes.mjs', [dir], { ...env, DECODE: 'sample' })), `${label}: ids and printed labels are unique, and the page codes decode`);
    const html = fs.readFileSync(`${dir}/journal.html`, 'utf8');
    ok(/Chores this week/.test(html) && /Chores this month/.test(html) && /<em>good enough<\/em>/.test(html) && /chxd/.test(html), `${label}: the grids, the energy versions and a "due soon" mark are in the pages`);
  }
}
console.log(`test-chores: ${n} checks passed`);
