// Renders one monthly book's KDP interior (5.5x8.5, or 8.5x11 with SIZE=letter) as HTML (one fixed-size div per page)
// and prints it to PDF with Chromium.
// Usage: node render.mjs month <YYYY-MM> [a.ics,b.ics]      (SIZE=letter for 8.5x11, HARDCOVER=1 to pad to 76+ pages)
import fs from 'node:fs';
import { launch } from './browser.mjs';
import { build, busCoverage } from './data.mjs';
import bwipjs from 'bwip-js';
import { drawRulings } from './rulings.mjs';
import { EDITION } from './content/edition.mjs';
import { IC, ic, box, spoon, actionZone, dayBlocks, normalize, DAYPAGE_CSS } from './daypage.mjs';
// Day page layout from the page editor (content/daypage.json); defaults reproduce the original page.
const DAYPAGE = normalize(fs.existsSync(new URL('./content/daypage.json', import.meta.url)) ? JSON.parse(fs.readFileSync(new URL('./content/daypage.json', import.meta.url), 'utf8')) : null);
if (process.argv[2] !== 'month' || !/^\d{4}-\d{2}$/.test(process.argv[3] || '')) {
  console.error('Usage: node render.mjs month <YYYY-MM> [a.ics,b.ics]   (SIZE=letter, HARDCOVER=1)');
  process.exit(1);
}
const [yr, mo] = process.argv[3].split('-').map(Number);
const bookNo = (yr - 2026) * 12 + mo - 9; // Oct 2026 = book 1 … Sep 2027 = book 12
const monthName = new Date(Date.UTC(yr, mo - 1, 1)).toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' });
// globalContent is kept only so data.json (read by epub.py) stays byte-identical.
const VOL = { n: bookNo, start: [yr, mo, 1], days: new Date(Date.UTC(yr, mo, 0)).getUTCDate(), label: `${monthName} ${yr}`, short: `${monthName.slice(0, 3)} ${yr}`, globalContent: true, id: `${yr}-${String(mo).padStart(2, '0')}`, month: mo, year: yr };
const ICS = process.argv[4];
// STA bus pages: 'full' (feed covers the whole month), 'partial' (feed ends mid-month) or 'none' (no schedule to print).
const BUS_COV = busCoverage(VOL.id);
const OUT = `out/m${VOL.id}${process.env.SIZE === 'letter' ? '-letter' : ''}`;
const { FACTS, PIONEERS, WORDS, PROMPTS } = await import('./content/year.mjs');
const D = build(ICS, VOL, WORDS);
for (const d of D.days) d.fact = FACTS[d.date.slice(5)] || null;
const thursdayIn = (W) => { const t = W.days.find((d) => d.weekday === 4); return !!t; };
for (const W of D.weeks) {
  // A week's pioneer and exchange prompt live in the book that holds that week's Thursday, so nothing repeats.
  W.owns = thursdayIn(W);
  W.pioneer = W.owns ? PIONEERS[W.gi] || null : null;
  W.prompt = PROMPTS[W.gi] || null;
  W.label = `Week ${W.gi + 1}`;
}
const missing = { facts: D.days.filter((d) => !d.fact).length, pioneers: D.weeks.filter((w) => w.owns && !w.pioneer).length, words: D.weeks.filter((w) => !w.word).length, prompts: D.weeks.filter((w) => !w.prompt).length };
if (Object.values(missing).some(Boolean)) console.warn('content gaps:', JSON.stringify(missing));
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const G = (g) => `<span class="gl">${g}︎</span>`; // text-style astro glyph (never emoji)
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_PLANET = [['Sun', '☉'], ['Moon', '☽'], ['Mars', '♂'], ['Mercury', '☿'], ['Jupiter', '♃'], ['Venus', '♀'], ['Saturn', '♄']]; // by JS weekday
const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const PLANET_GLYPH = { Mercury: '☿', Venus: '♀', Mars: '♂', Jupiter: '♃', Saturn: '♄', Uranus: '♅', Neptune: '♆', Pluto: '♇' };

// ---------- small SVG parts ----------
function moon(deg, size = 18) {
  // deg: 0 new, 90 first quarter, 180 full, 270 last quarter. Lit area white, dark area gray.
  const r = size / 2 - 0.6, c = size / 2;
  const f = Math.cos((deg * Math.PI) / 180); // 1 at new, -1 at full
  const waxing = deg < 180;
  const rx = Math.abs(f) * r;
  // lit half on the right when waxing (northern hemisphere)
  const sweepOuter = waxing ? 1 : 0;
  const litMoreThanHalf = f < 0;
  const sweepInner = waxing ? (litMoreThanHalf ? 1 : 0) : (litMoreThanHalf ? 0 : 1);
  const path = `M ${c} ${c - r} A ${r} ${r} 0 0 ${sweepOuter} ${c} ${c + r} A ${rx} ${r} 0 0 ${sweepInner} ${c} ${c - r} Z`;
  return `<svg class="moon" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${c}" cy="${c}" r="${r}" fill="#8a8a8a" stroke="#222" stroke-width="1"/><path d="${path}" fill="#fff"/><circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="#222" stroke-width="1"/></svg>`;
}

// ---------- icons (monoline, 12x12, stroke 1.15 = 0.8pt at print size) ----------
const ICON_KEY = [['pill', 'Meds'], ['am', 'Morning dose'], ['pm', 'Evening dose'], ['prn', 'As needed (write the time)'], ['meal', 'Meals'], ['snack', 'Snack'], ['shower', 'Shower'], ['teeth', 'Teeth'], ['joy', 'Did something I enjoy'], ['text', 'Texted someone'], ['low', 'Mood low … high'], ['anx', 'Anxiety 0–3'], ['sleep', 'Sleep hours'], ['work', 'Work shift'], ['spoon', 'Spoons: cross off as you use them'], ['coin', 'Payday'], ['well', 'Went well'], ['hard', 'Was hard'], ['next', 'Tomorrow']];
const bubbles = (labels, lo, hi) => `<span class="end">${lo}</span>` + labels.map(() => `<span class="bub"><i></i></span>`).join('') + `<span class="end">${hi}</span>`;
const dur = (min) => `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, '0')}m`;
const ruby = (k, r) => `<ruby>${k}<rt>${r}</rt></ruby>`;

// ---------- page sequencing (mirror margins by parity) ----------
const pages = [];
let SEC = 'front', SPAN = null; // section and date span the pages being added belong to (they end up in layout.json)
const add = (cls, html, date = '', type = 'page') => pages.push({ cls, html, date, type, section: SEC, from: SPAN ? SPAN[0] : null, to: SPAN ? SPAN[1] : null });
const alignToVerso = () => { if ((pages.length + 1) % 2 === 1) add('notes', notesPage('Notes'), '', 'notes'); }; // next page must be even
const alignToRecto = () => { if ((pages.length + 1) % 2 === 0) add('notes', notesPage('Notes'), '', 'notes'); };
const notesPage = (title) => `${headerZone('', title)}<div class="dots fill" data-zone="body"></div>${actionZone(4)}`;
// AI-scan zones: labelled header boxes, faint body grid, checkbox action items.
function headerZone(dateText, titleText = '') {
  return `<div class="hz"><div class="zbox zdate" data-zone="date"><span class="zl">DATE:</span><span class="zv">${dateText}</span></div><div class="zbox ztitle" data-zone="title"><span class="zl">TITLE:</span><span class="zv">${titleText}</span></div><div class="zbox ztags" data-zone="tags"><span class="zl">TAGS:</span></div></div>`;
}

// ---------- content ----------
const LINEAGE = [
  ['Fixed date header', 'Diary of Merer, Egypt, c. 2566 BC — dated day-by-day log'],
  ['Sky beside your life', 'Babylonian Astronomical Diaries, 652–61 BC — sky, weather, prices and news on one tablet'],
  ['Copying words to live by', 'Greco-Roman hupomnemata; Renaissance commonplace books'],
  ['Evening review', 'Seneca, De Ira 3.36 — “What did I do well? Where did I fail? What will I change?”'],
  ['72 micro-seasons', 'The old East Asian calendar of 24 solar terms and 72 five-day seasons, in English'],
  ['Planetary days', 'Each weekday is named for a planet: Sun, Moon, Mars (Tiw), Mercury (Woden), Jupiter (Thor), Venus (Frigg), Saturn'],
  ['Lists & rapid log', 'Sei Shōnagon’s Pillow Book lists (1002); the Bullet Journal'],
  ['Habit grid', 'Benjamin Franklin’s 13-virtue chart, c. 1728'],
  ['Exchange pages', 'Alba amicorum friendship albums (1540s); Japanese kōkan nikki'],
  ['Pre-printed pages', 'Letts’s Diary, 1812 — the printed day box'],
  ['Season theme', 'The Theme System — a direction, not a pass/fail goal'],
  ['Spoons', 'Christine Miserandino’s spoon theory (2003) — energy as a daily budget'],
];



function titlePage() {
  return `<div class="title">
    <div class="tmoon">${moon(90, 64)}${moon(180, 64)}${moon(270, 64)}</div>
    <h1>Keeping Watch</h1>
    <p class="sub">A sky, season &amp; self journal</p>
    <p class="range">Book ${VOL.n} of 12 · ${VOL.label}</p>
    <p class="place">Sky data for ${esc(D.config.place)} · ${D.config.lat.toFixed(2)}° N, ${Math.abs(D.config.lon).toFixed(2)}° W · Pacific Time</p>
    <p class="built">Built ${D.generated.slice(0, 10)}</p>
    <p class="owner">This journal belongs to<br><span class="line"></span></p>
  </div>`;
}

function lineagePage() {
  return `<h2 class="pt">Where each piece comes from</h2>
  <p class="lead">Every part of this journal is borrowed from a method people used for centuries. The history shows one lesson: methods die when they get complicated. <b>Skip anything, any day.</b> A blank box is data too.</p>
  <table class="lin">${LINEAGE.map(([a, b]) => `<tr><th>${a}</th><td>${b}</td></tr>`).join('')}</table>
  <p class="small">Daily “On this day” facts come from the Computer History Museum’s This Day in History and Wikipedia’s date pages. Pioneer profiles are checked against each person’s Wikipedia article.</p>
  <p class="small">Astrology here is a reflection prompt, not a forecast. The astronomy (sunrise, sunset, moon phase, solstice) is real and calculated for ${esc(D.config.place)}.</p>${busLine()}`;
}

function anatomyPage() {
  return `<h2 class="pt">How to use it</h2>
  <div class="steps">
    <div><h3>Each book</h3><p>Pick a <b>theme</b> (page {{P_THEME}}). Carry it over from last month or start a new one.</p></div>
    <div><h3>Each month</h3><p>Calendar, a sky &amp; seasons list, a one-page tracker, and a new-moon / full-moon page.</p></div>
    <div><h3>Each week</h3><p>A two-page spread to plan, a word of the week to copy, a weekly review, and an <b>exchange spread</b> to hand to someone.</p></div>
    <div><h3>Each day</h3><p>A full page. Header is pre-filled with the sky. Circle your mood and spoons. Rapid-log anything. Answer three evening questions.</p></div>
  </div>
  <h3 class="h3b">Anatomy of a day</h3>
  <div class="anat"><div><b class="zl">DATE / TITLE / TAGS</b> printed date; write a title and tags in the boxes</div><div><b class="zl">SKY + CHECK-IN</b> moon, sun, season; circle mood, cross off spoons</div><div class="a3"><b class="zl">BODY</b> faint 5 mm dots: write anything</div><div><b class="zl">ACTION ITEMS</b> one task per checkbox</div><div><b class="zl">REVIEW</b> went well · was hard · tomorrow</div></div><p class="small" style="margin-top:5px"><b>At the back:</b> Support p. {{P_SUPPORT}} · Safety plan p. {{P_SAFETY}} · ${BUS_COV === 'none' ? '' : 'Bus times p. {{P_BUS}} · '}Where each piece comes from p. {{P_LINEAGE}}</p><h3 class="h3b">Scanning pages</h3><p class="small">Every page has a black frame, seven “send to” bubbles and a small square page code (a Data Matrix) that says which book and page it is. Fill a bubble to route the scan (you choose what each shape means in your scanning app). Keep the frame and the page code clear of ink. These markers are made for your own app; the Rocketbook app won’t read them.</p>`;
}

function keyPage() {
  const signs = Object.entries(D.glyphs).map(([n, g]) => `<span>${G(g)} ${n}</span>`).join('');
  const planets = Object.entries(PLANET_GLYPH).map(([n, g]) => `<span>${G(g)} ${n}</span>`).join('');
  return `<h2 class="pt">Key</h2>
  <div class="keycols">
    <div><h3>Rapid log</h3>
      <ul class="bul"><li><b>•</b> task</li><li><b>×</b> done</li><li><b>&gt;</b> moved forward</li><li><b>&lt;</b> scheduled</li><li><b>○</b> event</li><li><b>–</b> note</li><li><b>${'<svg width="8" height="8" viewBox="0 0 10 10" style="vertical-align:-1px"><path d="M5 9 L1.2 5.2 A2.2 2.2 0 0 1 5 2.4 A2.2 2.2 0 0 1 8.8 5.2 Z" fill="none" stroke="#000" stroke-width="1.1"/></svg>'}</b> feeling</li><li><b>!</b> important</li></ul>
      <h3>Moon</h3>
      <div class="phases">${[[0, 'New'], [45, 'Waxing crescent'], [90, 'First quarter'], [135, 'Waxing gibbous'], [180, 'Full'], [225, 'Waning gibbous'], [270, 'Last quarter'], [315, 'Waning crescent']].map(([d, n]) => `<span>${moon(d, 14)} ${n}</span>`).join('')}</div>
      <p class="small">“Moon enters ${G('♓')} Pisces 3:12p” means the moon changes sign at that time. ${G('℞')} = retrograde (the planet appears to move backward).</p>
    </div>
    <div><h3>Signs</h3><div class="gl-list">${signs}</div>
      <h3>Planets</h3><div class="gl-list">${planets}</div>
      <h3>Check-in</h3>
      <p class="small"><b>Mood</b> −3 very low · 0 steady · +3 very high/wired<br><b>Spoons</b> ${spoon()} cross one out per spoon spent. Start with the number you woke up with. A <b>good-spoon day</b> ends with 4 or more left.</p>
    </div>
  </div>
  `;
}

function weekdayTable() {
  const origin = ['the Sun', 'the Moon', 'Tiw, a war god matched with Mars', 'Woden, matched with Mercury', 'Thor, matched with Jupiter', 'Frigg, matched with Venus', 'Saturn'];
  return `<h3>The planetary week</h3>
  <table class="wk">${[1, 2, 3, 4, 5, 6, 0].map((i) => `<tr><td>${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][i]}</td><td>${G(DAY_PLANET[i][1])} ${DAY_PLANET[i][0]}</td><td class="dim">named for ${origin[i]}</td></tr>`).join('')}</table>`;
}

function seasonGoal() {
  const d = D.days.find((x) => x.notes.some((n) => n.kind === 'season'));
  if (!d) return 'the end of this book';
  const n = d.notes.find((n) => n.kind === 'season').text.replace(/ \d.*$/, '');
  return `the ${n} (${MONTHS[d.m - 1].slice(0, 3)} ${d.d})`;
}

const tc = (n) => n.replace(/ Transit Center/g, ' TC').replace(/ Park & Ride/g, ' P&R').replace(/^To /, '');
// STA schedules from static GTFS (gtfs/network.json, built by gtfs/network.py): a network summary + hour grids.
const NET = fs.existsSync('gtfs/network.json') ? JSON.parse(fs.readFileSync('gtfs/network.json', 'utf8')) : null;
// Hour grids: routes in this order first (Cheney + West Plains + the routes you ride), then every other
// route that runs every 20+ minutes (frequent routes are covered by the summary). Packed into GRID_PAGE_BUDGET pages.
const GRID_PRIORITY = ['6', '68', '66', '32', '97', '65', '61', '62', '63', '7'];
const GRID_PAGE_BUDGET = 4, GRID_PAGE_ROWS = 34;
function packGrids(E) {
  const all = Object.keys(E.grids).filter((r) => NET.routes[r]);
  const freq = (r) => { const w = E.summary[r] && E.summary[r].weekday; return w && w.every && w.every < 20; };
  const order = [...GRID_PRIORITY.filter((r) => all.includes(r)), ...all.filter((r) => !GRID_PRIORITY.includes(r) && !freq(r)).sort((a, b) => parseInt(NET.routes[a].n) - parseInt(NET.routes[b].n))];
  const pagesOut = [];
  const place = (r) => {
    const c = gridCols(E, r); if (!c.length || c.length > 6) return;
    const h = runsOf(gridHours(c), c).length + 4;
    const pg = pagesOut.find((p) => p.used + h <= GRID_PAGE_ROWS);
    if (pg) { pg.routes.push(r); pg.used += h; } else if (pagesOut.length < GRID_PAGE_BUDGET) pagesOut.push({ routes: [r], used: h });
  };
  order.filter((r) => GRID_PRIORITY.includes(r)).forEach(place); // your routes first, then fill the gaps
  order.filter((r) => !GRID_PRIORITY.includes(r)).forEach(place);
  const rank = (r) => order.indexOf(r);
  pagesOut.forEach((p) => p.routes.sort((a, b) => rank(a) - rank(b)));
  return pagesOut.map((p) => p.routes);
}
const DAY3 = [['weekday', 'WKDY'], ['saturday', 'SAT'], ['sunday', 'SUN']];
const shortStop = (n) => tc(n || '').replace('K Street Station', 'Cheney').replace('Eagle Station', 'EWU').replace('West Plains TC', 'W Plains').replace(/ \(.*?\)/g, '').replace('Spokane International Airport Concourse ', 'Airport ');
let busWarned = false;
function busMeta() {
  const E = NET.months[VOL.id];
  const ymd = (s) => `${s.slice(4, 6).replace(/^0/, '')}/${s.slice(6).replace(/^0/, '')}/${s.slice(2, 4)}`;
  if (BUS_COV === 'partial' && !busWarned && (busWarned = true)) console.warn(`! STA schedule ends ${NET.valid_to}; ${VOL.id} is only partly covered (pages say so). Refresh gtfs before printing.`);
  const until = new Date(Date.UTC(+NET.valid_to.slice(0, 4), +NET.valid_to.slice(4, 6) - 1, +NET.valid_to.slice(6))).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const from = new Date(Date.UTC(+NET.valid_from.slice(0, 4), +NET.valid_from.slice(4, 6) - 1, +NET.valid_from.slice(6))).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const startsLate = `${NET.valid_from.slice(0, 4)}-${NET.valid_from.slice(4, 6)}` === VOL.id && NET.valid_from.slice(6) !== '01';
  const valid = BUS_COV === 'partial' ? `<p class="busvalid">${startsLate ? `Schedule starts ${from} · check spokanetransit.com before` : `Schedule valid through ${until} · check spokanetransit.com after`}</p>` : '';
  return { E, valid, note: `STA schedule ${ymd(NET.valid_from)}–${ymd(NET.valid_to)}.` };
}
function netPage(part) {
  const { E, note, valid } = busMeta();
  const ids = Object.keys(E.summary).filter((r) => NET.routes[r]).sort((a, b) => parseInt(NET.routes[a].n) - parseInt(NET.routes[b].n));
  const half = Math.ceil(ids.length / 2), mine = part === 0 ? ids.slice(0, half) : ids.slice(half);
  const cell = (x) => x ? `${x.span.replace(/:00/g, '')}${x.every ? ` <b>${x.every === 7.5 ? '7–8' : x.every}</b>` : ''}` : '<span class="dim">no service</span>';
  const rows = mine.map((r) => `<tr><td class="rn">${esc(NET.routes[r].n)}</td><td class="rname">${esc(NET.routes[r].name)}</td>${DAY3.map(([k]) => `<td>${cell(E.summary[r][k])}</td>`).join('')}</tr>`).join('');
  return `<h2 class="pt">${part === 0 ? 'STA at a glance' : 'STA at a glance, cont.'}</h2>${valid}<p class="small">First–last bus, then <b>minutes between buses</b> at midday.</p>
  <table class="net"><colgroup><col class="c1"><col class="c2"><col><col><col></colgroup><tr><th></th><th>Route</th>${DAY3.map(([, l]) => `<th>${l}</th>`).join('')}</tr>${rows}</table>
  ${part === 1 ? `<p class="small">${note} Gaps are typical 7a–6p. Holidays run the Sunday schedule. Next pages: minutes past the hour at the first stop named, → where the bus is headed. Weekday times are from ${E.samples.weekday.slice(5).replace('-', '/')}; EWU break days can differ.</p>` : ''}`;
}
// merge consecutive hours whose minutes are identical in every column into one "8a–5p" row
function runsOf(hrs, cols) {
  const sig = (h) => cols.map((c) => (c.hours[h] || []).join(' ')).join('|');
  const out = [];
  for (const h of hrs) { const last = out[out.length - 1]; if (last && (last[1] + 1) % 24 === h && sig(last[1]) === sig(h)) last[1] = h; else out.push([h, h]); }
  return out;
}
const gridHours = (cols) => [...new Set(cols.flatMap((c) => Object.keys(c.hours).map(Number)))].sort((a, b) => ((a + 21) % 24) - ((b + 21) % 24)); // day starts 3a
function gridCols(E, r) {
  const cols = [];
  {
    const G = E.grids[r]; if (!G) return '';
    for (const dir of ['0', '1']) {
      const days = DAY3.filter(([k]) => G[k] && G[k][dir]);
      if (!days.length) continue;
      const g0 = G[days[0][0]][dir];
      const run = g0.run ? ` · ${g0.run[0] === g0.run[1] ? g0.run[0] : g0.run[0] + '–' + g0.run[1]} min` : '';
      const title = `${shortStop(g0.from)} → ${esc(tc(g0.to))}`;
      days.forEach(([k, l], i) => cols.push({ group: i === 0 ? { title, run, span: days.length } : null, label: l, hours: G[k][dir].hours }));
    }
  }
  return cols;
}
function gridTable(E, r) {
  const cols = gridCols(E, r);
  const hrs = gridHours(cols);
  const hl = (h) => `${(h % 12) || 12}${h < 12 ? 'a' : 'p'}`;
  const partial = cols.some((c) => Object.values(c.hours).flat().some((m) => m.endsWith('*')));
  if (!cols.length) return '';
  return `<h3 class="rt">Route ${esc(NET.routes[r].n)} · ${esc(NET.routes[r].name)}</h3><table class="hg"><colgroup><col style="width:0.4in">${cols.map(() => "<col>").join("")}</colgroup><tr><th></th>${cols.filter((c) => c.group).map((c) => `<th colspan="${c.group.span}" class="gh">${c.group.title}<span class="dim">${c.group.run}</span></th>`).join('')}</tr>
  <tr><th></th>${cols.map((c, i) => `<th class="${c.group ? 'gs' : ''}">${c.label}</th>`).join('')}</tr>
  ${runsOf(hrs, cols).map(([a, b]) => `<tr${a !== b ? ' class="rng"' : ''}><td class="hl${a >= 12 ? ' pm' : ''}">${a === b ? hl(a) : ((a < 12) === (b < 12) ? hl(a).slice(0, -1) : hl(a)) + '–' + hl(b)}</td>${cols.map((c) => `<td class="${c.group ? 'gs' : ''}">${(c.hours[a] || []).join(' ')}</td>`).join('')}</tr>`).join('')}</table>
${partial ? '<p class="small">* starts partway along the route.</p>' : ''}`;
}
function gridPage(routeIds) {
  const { E, note, valid } = busMeta();
  return `<div class="xh"><h2 class="pt">Bus times</h2><span class="dim">minutes past the hour</span></div>${valid}
  ${routeIds.map((r) => gridTable(E, r)).join('')}
  <p class="small">Shaded rows like <b>8–10a</b> repeat the same minutes each hour. ${note}</p>`;
}

const CLINIC = fs.existsSync('content/clinic.json') ? JSON.parse(fs.readFileSync('content/clinic.json', 'utf8')) : null;
function clinicBox() {
  if (!CLINIC) return '';
  const chip = (t) => t.split(' ').filter(Boolean).map((x) => `<span class="chip${x === 'TEXT' ? ' tx' : ''}">${x}</span>`).join('');
  return `<h3>My clinic</h3><div class="clinic"><div class="sn"><b>${CLINIC.name}</b></div><div class="sd">${CLINIC.address}</div>
  ${CLINIC.lines.map(([k, d, c]) => `<div class="sup"><div class="sn"><b>${k}</b>${chip(c)}</div><div class="sd">${d}</div></div>`).join('')}
  <div class="cf"><span>My provider</span><i></i><span>Counselor</span><i></i></div><div class="cf"><span>Next appointment</span><i></i></div></div>`;
}
function carePage() {
  const rows = (n, cols) => Array(n).fill(`<tr>${cols.map(() => '<td></td>').join('')}</tr>`).join('');
  return `<h2 class="pt">Care plan</h2>
  <p class="lead">The daily care boxes are there to notice, not to grade. A day with one box checked still counts.</p>
  <h3>My meds</h3>
  <table class="carep"><tr><th>Name</th><th>When</th><th>What it’s for</th></tr>${rows(4, [1, 2, 3])}</table>
  <h3>What helps on hard days</h3><div class="lines l2"></div>
  ${clinicBox()}
  <p class="small"><b>If it gets bad:</b> call or text <b>988</b>, or text HOME to 741741. Support is on <b>p. {{P_SUPPORT}}</b>, your safety plan on <b>p. {{P_SAFETY}}</b>.</p>`;
}

// ---------- support pages (checked Sep 2026; numbers and hours change, so re-check each edition) ----------
const SUPPORT = JSON.parse(fs.readFileSync('content/support.json', 'utf8')); // shared with epub.py
const TRANS = JSON.parse(fs.readFileSync('content/trans.json', 'utf8'));
function dirPage(title, intro, data) {
  const chip = (t) => t.split(' ').filter(Boolean).map((x) => `<span class="chip${x === 'TEXT' ? ' tx' : ''}">${x}</span>`).join('');
  return `<h2 class="pt">${title}</h2><p class="small">${intro}</p>
  ${data.map(([h, items]) => `<h3 class="sh">${h}</h3>${items.map(([n, d, c]) => `<div class="sup"><div class="sn"><b>${n}</b>${chip(c)}</div><div class="sd">${d}</div></div>`).join('')}`).join('')}`;
}
const busLine = () => BUS_COV === 'none' ? '<div class="busbox"><b>Bus times:</b> spokanetransit.com or the STA app</div>' : '';
const supportPage = () => dirPage('Support', '<span class="chip tx">TEXT</span> means you can text instead of talking. Emergency: <b>911</b>. 988’s LGBTQ+ “press 3” option ended July 2025. Checked Sep 2026.', SUPPORT);
const transPage = () => dirPage('Trans support', 'For trans people in Spokane and Washington. <span class="chip tx">TEXT</span> means you can message instead of calling. Checked Sep 2026.', TRANS);
// Last page of each monthly book: the handoff to the Keeper (page numbers from out/keeper/index.json).
function closingPage() {
  const KI = fs.existsSync('out/keeper/index.json') ? JSON.parse(fs.readFileSync('out/keeper/index.json', 'utf8')).handoff_page : {};
  const kp = KI[VOL.id];
  const nd = new Date(Date.UTC(VOL.year, VOL.month, 1)), nextName = nd.toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' });
  const dim = new Date(Date.UTC(VOL.year, VOL.month, 0)).getUTCDate();
  const st = (l, u) => `<div class="qf"><span>${l}</span><i></i><span class="u">${u}</span></div>`;
  const step = (t) => `<div class="cbl2"><i></i><span>${t}</span></div>`;
  return `<h2 class="pt">Closing ${VOL.label}</h2>
  <p class="small">Do this with your Keeper open${kp ? ` to <b>page ${kp}</b>` : ''}, before starting ${nextName}. About 15 minutes.</p>
  <h3 class="sh">1 · Total the tracker</h3>
  <div class="qg">${st('Avg mood', '−3…+3')}${st('Avg sleep', 'h')}${st('Showers', '/' + dim)}${st('Meds taken', 'days')}${st('Good-spoon days', 'days')}${st('Work hours', 'h')}</div>
  <p class="small">Good-spoon day: 4 or more spoons left at bedtime. In the tracker’s spoons box, write the number left.</p>
  <h3 class="sh">2 · Hand off to the Keeper${kp ? ` (p. ${kp}–${kp + 1})` : ''}</h3>
  ${step('Copy the totals, highs, lows and health notes')}${step('Add new contacts and birthdays')}${step('Update account hints and where recovery codes are kept')}${step('Index pages worth finding later (this is <b>Book ' + VOL.n + '</b>)')}${step('Back up the X4 log: Wi-Fi sync → download')}
  <h3 class="sh">3 · Carry forward</h3>
  ${step('Mark unfinished tasks in this book with &gt; and copy them to the Keeper')}${step('Scan any pages you still want in your app')}
  <h3 class="sh">4 · Start fresh</h3>
  ${step(VOL.n < 12 ? `Copy the carry-forward list into week 1 of <b>${nextName}</b> (Book ${VOL.n + 1})` : 'Fill in the Keeper’s Year at a glance')}${step('Shelve this book')}`;
}
function contactsPage() {
  const f = (l, w = '') => `<div class="qf ${w}"><span>${l}</span><i></i></div>`;
  const one = () => `<div class="qc">${f('Name')}<div class="qr">${f('Phone')}<span class="qt"><i></i> TEXT</span></div></div>`;
  return `<h2 class="pt">Quick contacts</h2><p class="small">The people you reach for most this month. Everyone else lives in your Keeper book at home.</p>
  <h3 class="sh">In an emergency</h3>${one()}${one()}
  <h3 class="sh">This month</h3><div class="qg">${Array(10).fill(0).map(one).join('')}</div>`;
}
function safetyPage() {
  const q = (n, t, h = 'l2') => `<div class="sq" data-zone="safety_${n}"><b>${n}. ${t}</b><div class="lines ${h}"></div></div>`;
  const person = () => `<div class="pn"><div class="qf"><span>Name</span><i></i></div><div class="qf"><span>Phone</span><i></i></div><span class="qt"><i></i> TEXT OK</span></div>`;
  return `<div class="sph"><h2 class="pt">My safety plan</h2><div class="qf"><span>Last reviewed</span><i></i></div></div>
  <p class="small">Fill this in on a good day, so it is ready on a hard one. Work down the list until you feel safer.</p>
  ${q(1, 'Signs a hard time is starting (thoughts, moods, situations)')}
  ${q(2, 'Things I can do on my own to feel a little better')}
  ${q(3, 'People or places that help me get my mind off it')}
  <div class="sq" style="margin-bottom:5px"><b>4. People I can text or call for help</b>${person()}${person()}${person()}</div>
  ${q(5, 'Professionals and crisis lines: my therapist, my prescriber; 988 (call or text); text HOME to 741741; Frontier crisis line 1-877-266-1818; Trans Lifeline (877) 565-8860 (call, weekdays 10–6 PT)')}
  ${q(6, 'How I can make my space safer (meds, other things)')}
  ${q(7, 'What matters to me, worth staying for', 'l2')}
  <div class="script"><b>A text I can send when talking is too hard:</b><br>“Hey, I’m having a hard time. I’m not up for a call. Can you text with me for a bit?”</div>`;
}

function themePage() {
  return `<h2 class="pt">Season theme</h2>
  <p class="lead">A theme is a direction for the season, like “Season of Rest” or “Season of Order.” There's no pass or fail.</p>
  <div class="boxline big" data-zone="theme_name">My theme for ${VOL.short}</div>
  <div class="boxline">What it means to me</div><div class="lines l4" data-zone="theme_meaning"></div>
  <div class="boxline">Three small ways to live it (these become your habit grid)</div>
  <ol class="three" data-zone="theme_habits"><li></li><li></li><li></li></ol>
  <div class="boxline">What I want to feel by ${seasonGoal()}</div><div class="lines l4" data-zone="theme_feel"></div>`;
}

// ---------- month section ----------
function monthCalendar(M) {
  // Full month grid; dates that live in the neighbouring volume are shaded.
  const firstWd = new Date(Date.UTC(M.y, M.m - 1, 1)).getUTCDay(), dim = new Date(Date.UTC(M.y, M.m, 0)).getUTCDate();
  const lead = (firstWd + 6) % 7;
  const cells = Array(lead).fill('<td class="out"></td>');
  const nRows = Math.ceil((lead + dim) / 7), maxEv = nRows > 5 ? 1 : nRows < 5 ? 3 : 2;
  const soft = (t) => t.replace(/[\p{L}’']{9,}/gu, (w) => w.slice(0, Math.ceil(w.length / 2)) + '\u00ad' + w.slice(Math.ceil(w.length / 2))); // soft hyphen so long words break inside a 0.5in cell
  const calHol = (t) => t.replace(' (clocks forward)', ' ').replace(' (clocks back)', ' ').replace('Daylight saving time', 'DST').replace('Martin Luther King Jr. Day', 'MLK Day').replace('Indigenous Peoples’ Day / Columbus Day', 'Indig. Peoples’ / Columbus Day').trim();
  for (let n = 1; n <= dim; n++) {
    const d = M.days.find((x) => x.d === n);
    if (!d) { cells.push(`<td class="out other"><div class="cd"><span class="n">${n}</span></div><div class="ev">in Vol ${n < 15 ? VOL.n - 1 : VOL.n + 1}</div></td>`); continue; }
    const marks = [];
    if (d.moon.quarter != null) marks.push(`${moon(d.moon.phaseDeg, 10)}`);
    
    const payTag = d.notes.filter((n) => n.kind === 'pay').map((n) => n.text.startsWith('Payday') ? 'PAYDAY' : n.text.startsWith('Pay period starts') ? 'NEW PERIOD' : 'PERIOD ENDS').filter((t) => t !== 'PERIOD ENDS').map((t) => `<div class="pay">${t}</div>`).join('');
    const holTxt = d.notes.filter((n) => n.kind === 'holiday').map((n) => n.text.toLowerCase());
    const evs = d.events.filter((e) => !e.routine && !(e.allDay && holTxt.includes(e.title.replace(/\s*\(.*\)$/, '').toLowerCase()))); // weekly/daily routines live on the day pages as checkboxes
    const shown = evs.filter((e) => e.allDay).concat(evs.filter((e) => !e.allDay)).slice(0, maxEv);
    const ev = shown.map((e) => `<div class="ev">${e.time ? e.time + ' ' : ''}${esc(soft(e.title))}</div>`).join('') + (evs.length > maxEv ? `<div class="ev dim">+${evs.length - maxEv} more</div>` : '');
    cells.push(`<td><div class="cd"><span class="n">${d.d}</span><span class="mk">${marks.join('')}</span></div>${d.notes.filter((n) => n.kind === 'holiday').map((n) => `<div class="hol${n.federal ? ' fed' : ''}">${esc(soft(calHol(n.text)))}</div>`).join('')}${payTag}${d.notes.some((n) => n.kind === 'bus') ? '<div class="pay">SUN BUS</div>' : ''}${ev}</td>`);
  }
  while (cells.length % 7) cells.push('<td class="out"></td>');
  const rows = []; for (let i = 0; i < cells.length; i += 7) rows.push(`<tr>${cells.slice(i, i + 7).join('')}</tr>`);
  return `<div class="mhead" data-zone="month_title"><h2 class="month">${M.name}</h2><span class="big">${M.y}</span></div>
  <table class="cal rows${rows.length}" data-zone="calendar"><tr>${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((x) => `<th>${x}</th>`).join('')}</tr>${rows.join('')}</table>
  <p class="small">${moon(180, 9)} principal moon phases. ${ICS ? 'One-off events and birthdays from your calendar; weekly routines are checkboxes on each day page.' : 'Write in your events, or import an .ics file in the next edition.'}</p>`;
}

function monthSky(M) {
  const rows = [];
  for (const d of M.days) {
    const when = `${d.d} ${d.weekdayName.slice(0, 3)}`;
    for (const n of d.notes.filter((n) => n.kind !== 'pay' && n.kind !== 'holiday' && n.kind !== 'bus')) rows.push(`<tr><td>${when}</td><td>${n.kind === 'moon' ? moon(d.moon.phaseDeg, 10) + ' ' : ''}${esc(n.text)}</td></tr>`);
    for (const s of d.sun.ingress) rows.push(`<tr><td>${when}</td><td>Sun enters ${G(D.glyphs[s.sign])} ${s.sign} ${s.time}</td></tr>`);
    for (const c of d.jp.koChange) {
      rows.push(`<tr><td>${when}</td><td><i>${esc(c.en)}</i></td></tr>`);
    }
  }
  const f = M.days[0], l = M.days[M.days.length - 1];
  const change = l.sun.lengthMin - f.sun.lengthMin;
  const retroStart = [...new Set(M.days.flatMap((d) => d.retro))];
  return `<h2 class="pt">${M.name} · sky &amp; seasons</h2>
  <div class="daylen" data-zone="daylight"><div><b>${f.sun.rise}</b> / <b>${f.sun.set}</b><br><span class="dim">${M.name.slice(0, 3)} ${f.d} · ${dur(f.sun.lengthMin)}</span></div><div class="arrow">→</div><div><b>${l.sun.rise}</b> / <b>${l.sun.set}</b><br><span class="dim">${M.name.slice(0, 3)} ${l.d} · ${dur(l.sun.lengthMin)}</span></div><div class="chg">${change < 0 ? '−' : '+'}${dur(Math.abs(change))} of daylight</div></div>
  <table class="sky" data-zone="sky_list">${rows.join('')}</table>
  <p class="small" data-zone="retrograde">${G('℞')} Retrograde at some point this month: ${retroStart.map((p) => `${G(PLANET_GLYPH[p])} ${p}`).join(', ') || 'none'}.</p>`;
}

function monthTracker(M) {
  const rows = M.days.map((d) => `<tr><td class="dn">${d.d}</td><td class="kj">${DAY_LETTERS[(d.weekday + 6) % 7]}</td><td class="mc">${moon(d.moon.phaseDeg, 8)}</td><td class="mood">${[-3, -2, -1, 0, 1, 2, 3].map(() => '<i></i>').join('')}</td><td class="bx"></td><td class="bx"></td><td class="bx"></td><td class="bx"></td><td class="bx"></td><td class="bx"></td></tr>`).join('');
  return `<h2 class="pt">${M.name} · tracker</h2>
  <table class="trk" data-zone="tracker_grid"><tr><th colspan="3"></th><th>${ic('low')} mood ${ic('high')}</th><th>${ic('sleep', 'Sleep')}</th><th>${ic('pill', 'Meds')}</th><th>${ic('meal', 'Meals')}</th><th>${ic('shower', 'Shower')}</th><th>${ic('work', 'Work')}</th><th>${ic('spoon', 'Spoons')}</th></tr><tr class="un"><th colspan="3"></th><th>−3 … +3</th><th>hrs</th><th>tick</th><th>0–3</th><th>tick</th><th>hrs</th><th>left</th></tr>${rows}</table>
  <p class="small">Fill one mood dot (−3 to +3). Hours for sleep and work, meals 0–3, spoons left at bedtime. X4: Menu → This month.</p>`;
}

function monthMoonPage(M) {
  const nm = M.days.find((d) => d.moon.quarter === 0), fm = M.days.find((d) => d.moon.quarter === 2);
  const block = (d, title, prompt, z) => d ? `<div class="mp" data-zone="${z}"><div class="mph">${moon(d.moon.phaseDeg, 26)}<div><h3>${title} · ${M.name.slice(0, 3)} ${d.d}</h3><p class="dim">in ${G(d.moon.phaseGlyph || d.moon.glyph)} ${d.moon.phaseSign || d.moon.sign} · ${esc(d.notes.find((n) => n.kind === 'moon')?.text || '')}</p></div></div><p class="small">${prompt}</p><div class="lines l7"></div></div>` : '';
  return `<h2 class="pt">${M.name} · moon pages</h2>
  <div class="boxline">Theme check-in: how is my season theme going?</div><div class="lines l3" data-zone="theme_check"></div>
  ${block(nm, 'New moon', 'Set an intention for the next four weeks. What do you want to start, or tend?', 'new_moon')}
  ${block(fm, 'Full moon', 'What came to light? What are you ready to put down?', 'full_moon')}`;
}

// ---------- week section ----------
// A week row holds ~5 one-line items: events first, then the day's notes; the rest becomes "+N more" (a busy day never spills).
const WEEK_ITEMS = 5;
function weekItems(d) {
  const items = d.events.filter((e) => !e.routine).map((e) => `<div class="ev">${e.time ? e.time + ' ' : ''}${esc(e.title)}</div>`)
    .concat(d.notes.filter((n) => n.kind !== 'astro').map((n) => `<div class="evs">${esc(n.text)}</div>`));
  return items.length <= WEEK_ITEMS ? items.join('') : items.slice(0, WEEK_ITEMS - 1).join('') + `<div class="evs">+${items.length - WEEK_ITEMS + 1} more</div>`;
}

function weekLeft(W) {
  const f = W.days[0], l = W.days[W.days.length - 1];
  const lead = (f.weekday + 6) % 7, tail = 6 - ((l.weekday + 6) % 7);
  const other = (label) => `<div class="wrow other"><div class="wd"><span class="dt">${label}</span></div><div></div><div class="wev dim">${lead ? (VOL.n === 1 ? 'before this journal starts' : 'in the previous book') : (VOL.n === 12 ? 'after this journal ends' : 'in the next book')}</div></div>`;
  const rows = Array(lead).fill(0).map(() => other('—')).join('') + W.days.map((d) => `<div class="wrow" data-zone="week_day_${(d.weekday + 6) % 7 + 1}"><div class="wd"><span class="wdn">${d.weekdayName.slice(0, 3)}</span><span class="dt">${MONTHS[d.m - 1].slice(0, 3)} ${d.d}</span></div><div class="wsky"><span class="ms">${moon(d.moon.phaseDeg, 11)} ${G(d.moon.glyph)} ${d.moon.lit}%</span><span class="dim">${G('☀')} ${d.sun.rise}–${d.sun.set}</span><span class="wk-shift">work ____–____</span></div><div class="wev" data-pitch="0.22"><div class="rules lines" data-pitch="0.22"></div>${weekItems(d)}</div></div>`).join('') + Array(tail).fill(0).map(() => other('—')).join('');
  return `<div class="whead" data-zone="week_header"><h2 class="pt">${W.label}</h2><span class="dim">${MONTHS[f.m - 1].slice(0, 3)} ${f.d} – ${MONTHS[l.m - 1].slice(0, 3)} ${l.d}</span></div>${rows}`;
}

function weekRight(W) {
  const days = DAY_LETTERS;
  const grid = (label) => `<tr><td class="hl">${label}</td>${days.map(() => '<td></td>').join('')}</tr>`;
  return `<div class="wr-top"><div class="word" data-zone="words"><h3>Words to keep</h3><p class="dim">A line worth copying out this week: a quote, a lyric you heard, something someone said.</p><div class="lines l3" data-pitch="0.24"></div></div>
  <div class="prio" data-zone="priorities"><h3>This week</h3><ol><li></li><li></li><li></li></ol></div></div>
  <h3>Habits &amp; theme</h3>
  <table class="hab" data-zone="habits"><tr><th></th>${days.map((x) => `<th>${x}</th>`).join('')}</tr>${grid('')}${grid('')}${grid('')}${grid('work hours')}</table>
  <h3>Mood line</h3>
  <table class="mline" data-zone="mood_line">${[3, 2, 1, 0, -1, -2, -3].map((v) => `<tr class="${v === 0 ? 'zero' : ''}"><td class="hl">${v > 0 ? '+' + v : v}</td>${days.map(() => '<td><i></i></td>').join('')}</tr>`).join('')}<tr><td></td>${days.map((x) => `<td class="dl">${x}</td>`).join('')}</tr></table>
  ${pioneerCard(W)}
  ${W.pioneer && process.env.SIZE !== 'letter' ? '' : '<h3>Notes</h3><div class="dots fill" data-zone="notes"></div>'}`;  // letter has room under the pioneer card; the small page is full
}

function pioneerCard(W) {
  const p = W.pioneer; if (!p) return '';
  const [name, years, what, fact] = p;
  return `<div class="pio" data-zone="pioneer"><div class="pio-h"><span class="pio-k">Pioneer of the week</span><b>${esc(name)}</b> <span class="dim">${years}</span></div><p>${esc(what)}</p><p class="pio-f"><b>Useless knowledge</b> ${esc(fact)}</p></div>`;
}

function dayFull(d) {
  const moonTxt = d.moon.ingress.length ? d.moon.ingress.map((i) => `→ ${G(D.glyphs[i.sign])} ${i.time}`).join(' ') : `in ${G(d.moon.glyph)}`;
  const retro = d.retro.length ? ` · ${G('℞')} ${d.retro.map((p) => G(PLANET_GLYPH[p])).join('')}` : '';
  const hol = d.notes.filter((n) => n.kind === 'holiday').map((n) => `<b>${esc(n.text)}</b>`);
  // Pay periods: only payday gets a mark (a quiet coin in the sky line); period start/end live on the month calendar.
  const other = d.notes.filter((n) => n.kind !== 'holiday' && n.kind !== 'pay').map((n) => esc(n.text));
  const payday = d.notes.some((n) => n.kind === 'pay' && n.text.startsWith('Payday'));
  // Busy days: show 4 events then "+N more"; 3+ routines collapse to one row (daypage.mjs); the fact yields before the writing space does.
  const oneOff = d.events.filter((e) => !e.routine), EV_MAX = 4;
  const routines = d.events.filter((e) => e.routine).map((e) => `${e.time ? e.time + ' ' : ''}${e.title}`);
  const evShown = oneOff.slice(0, EV_MAX), evMore = oneOff.length - evShown.length;
  const ev = oneOff.length ? `<div class="dev" data-zone="events">${evShown.map((e) => `○ ${e.time ? e.time + ' ' : ''}${esc(e.title)}`).join(' · ')}${evMore > 0 ? ` · <i class="more">+${evMore} more</i>` : ''}</div>` : '';
  const dateText = `${d.weekdayName.slice(0, 3).toUpperCase()} · ${d.date} · ${G(DAY_PLANET[d.weekday][1])}`;
  const extra = [...hol, ...other];
  const parts = {
    header: headerZone(dateText),
    sky: `<div class="sky1" data-zone="sky">${moon(d.moon.phaseDeg, 14)}<span>${d.moon.lit}% · ${moonTxt} · ${G('☀')} ${d.sun.rise}–${d.sun.set}</span>${payday ? `<span class="pay-mk">${ic('coin', 'Payday')}</span>` : ''}<span class="season">${esc(d.jp.ko.en)}</span></div>`,
    notes: extra.length ? `<div class="sky2l" data-zone="notes">${extra.join(' · ')}</div>` : '',
    events: ev,
    fact: d.fact ? `<div class="fact" data-zone="fact"><b>On this day</b> ${esc(d.fact)}</div>` : '',
    routines,
  };
  return dayBlocks(parts, DAYPAGE);
}

function weekReview(W) {
  return `<div class="day review"><h3 class="rvh">${W.label} review</h3>
  <div class="rq" data-zone="review_q1"><b>What did I do well?</b><div class="lines l2"></div></div>
  <div class="rq" data-zone="review_q2"><b>Where did I fall short, and was it about capacity or choice?</b><div class="lines l2"></div></div>
  <div class="rq" data-zone="review_q3"><b>What will I change, move forward (&gt;) or drop?</b><div class="lines l2"></div></div>
  <div class="rq"><b>Carry forward</b> <span class="dim">— tasks and threads for next week</span></div><div class="dots log" data-zone="carry_forward"></div></div>`;
}

function exchange(W, side) {
  const p = W.prompt || 'Anything you want to tell me.';
  return side === 'L'
    ? `<div class="xh"><h2 class="pt">Exchange</h2><span class="dim">${W.label}</span></div><div class="xft" data-zone="exchange_from"><span>From</span><i></i><span>To</span><i></i><span>Date</span><i></i></div><p class="xp" data-zone="prompt">This week's prompt: <b>${p}</b></p><div class="lines fill" data-zone="body"></div>`
    : `<div class="xh"><h2 class="pt">Reply</h2><span class="dim">hand the book back when done</span></div><div class="xft" data-zone="exchange_from"><span>From</span><i></i><span>Date</span><i></i></div><p class="xp" data-zone="prompt">Answer the prompt, respond to their page, or ask them something.</p><div class="lines fill" data-zone="body"></div>`;
}

// ---------- assemble ----------
let REF_THEME = 0;
add('title', titlePage(), '', 'title');               // 1 (recto)
add('', `<div class="blankpage"></div>`, '', 'blank'); // 2
add('', anatomyPage(), '', 'anatomy');
add('', keyPage(), '', 'key');
add('', `<h2 class="pt">Key, continued</h2><h3>Day page icons</h3><div class="ikey">${ICON_KEY.map(([k, t]) => `<span>${ic(k)} ${t}</span>`).join('')}</div>${weekdayTable()}<h3>Send-to symbols</h3><p class="small">Fire (solid triangle), water (open triangle), air (three winds), earth (circled cross), crescent moon, full moon and pentacle. Fill the bubble above one to route a scan; you decide what each means in your app.</p>`, '', 'key');
add('', carePage(), '', 'care'); add('', contactsPage(), '', 'contacts');
REF_THEME = pages.length + 1; add('', themePage(), '', 'theme');

const monthStartWeek = (M) => D.weeks.find((W) => W.days.some((d) => d.m === M.m && d.y === M.y));
for (const W of D.weeks) {
  const M = D.months.find((M) => monthStartWeek(M) === W);
  if (M) { SEC = 'month'; SPAN = [M.days[0].date, M.days[M.days.length - 1].date]; alignToVerso(); add('', monthCalendar(M), '', 'month_cal'); add('', monthSky(M), '', 'month_sky'); add('', monthTracker(M), '', 'month_tracker'); add('', monthMoonPage(M), '', 'month_moon'); }
  SEC = 'week'; SPAN = [W.days[0].date, W.days[W.days.length - 1].date];
  alignToVerso();
  add('', weekLeft(W), '', 'week_left'); add('', weekRight(W), '', 'week_right');
  // The week's Sunday is in this book. The year's last week (Sep 27–Oct 3 2027, week 53) ends after the final book,
  // so it gets its review and exchange here instead of never being printed.
  const endsHere = W.days[W.days.length - 1].weekday === 0 || (W === D.weeks[D.weeks.length - 1] && W.gi === 52);
  for (const d of W.days) add('dayp', dayFull(d), d.date, 'dayp');
  if (endsHere) { add('', weekReview(W), '', 'week_review'); alignToVerso(); add('', exchange(W, 'L'), '', 'exchange_l'); add('', exchange(W, 'R'), '', 'exchange_r'); } // Exchange (verso) and Reply (recto) must face each other
}
SEC = 'back'; SPAN = null;
alignToVerso();
add('', `<h2 class="pt">Looking back on the month</h2><div class="boxline">My theme was</div><div data-zone="review_theme" class="lines l2"></div><div class="boxline">What the trackers showed me</div><div data-zone="review_trackers" class="lines l6"></div><div class="boxline">Which parts of this journal I actually used</div><div data-zone="review_used" class="lines l4"></div><div class="boxline">What to change in the next edition</div><div data-zone="review_change" class="lines l6"></div>`, '', 'month_review');
add('', closingPage(), '', 'closing');
// Reference section at the back: support, safety plan, bus times, and where each piece comes from.
const REF = { theme: REF_THEME };
REF.support = pages.length + 1; add('', supportPage(), '', 'support'); add('', transPage(), '', 'trans');
REF.safety = pages.length + 1; add('', safetyPage(), '', 'safety');
if (NET && BUS_COV !== 'none') { alignToVerso(); REF.bus = pages.length + 1; add('', netPage(0), '', 'bus'); add('', netPage(1), '', 'bus'); for (const g of packGrids(NET.months[VOL.id])) add('', gridPage(g), '', 'bus_grid'); }
REF.lineage = pages.length + 1; add('', lineagePage(), '', 'lineage');
for (const p of pages) p.html = p.html.replace(/\{\{P_(\w+)\}\}/g, (_, k) => REF[k.toLowerCase()] ?? '?');
while (pages.length % 2) add('notes', notesPage('Notes'), '', 'notes');

// ---------- HTML ----------
// 5.5 x 8.5 in: a KDP.com size for both paperback and hardcover (A5 is only offered on KDP Japan)
// SIZE=letter: 8.5 x 11 in. The page is laid out at 6.57 x 8.5 (same height as the small book) and zoomed x1.294,
// so everything, type included, scales up evenly and the wider page gets a little more room across.
const LETTER = process.env.SIZE === 'letter', ZOOM = LETTER ? 11 / 8.5 : 1;
const W_IN = LETTER ? +(8.5 / ZOOM).toFixed(4) : 5.5, H_IN = 8.5;
const TRIM_W = +(W_IN * ZOOM).toFixed(3), TRIM_H = +(H_IN * ZOOM).toFixed(3), SIZE_TAG = LETTER ? '8.5x11' : '5.5x8.5';
const INSIDE = 0.5, OUTSIDE = 0.3, TOP = 0.3, BOTTOM = 0.3;
const BORDER_PT = 9, BORDER = BORDER_PT / 72, QUIET = 0.5, STRIP = 0.42; // 9pt anchor border, 0.5in quiet zone, marker strip height
const FRAME_PAD = BORDER + QUIET;

// Scan markers: thick border + 7 send-to bubbles + a Data Matrix page code.
// Payload: see pageCode below (KW2|<edition>|<yymm>|<size><page>). Read by Shelbee's own scanning app, not the Rocketbook app.
const SYMBOLS = [ // fire (solid △), water (open ▽), air (three winds), earth (⊕), crescent (solid), full moon (solid disc), pentacle
  // Chosen so no two look alike after a blurry phone photo (tested: worst pair correlation 0.63; the old set had 0.90).
  '<path d="M7 1.5 L12.5 12 H1.5 Z" fill="#000"/>',
  '<path d="M7 12.5 L12.5 2 H1.5 Z"/>',
  '<path d="M1.5 4.5 Q4 2.5 6.5 4.5 T11.5 4.5 M1.5 7.5 Q4 5.5 6.5 7.5 T11.5 7.5 M1.5 10.5 Q4 8.5 6.5 10.5 T11.5 10.5"/>',
  '<circle cx="7" cy="7" r="5.5"/><path d="M7 1.5 V12.5 M1.5 7 H12.5"/>',
  '<path d="M9.5 1.8 A5.5 5.5 0 1 0 12.2 9.6 A4.3 4.3 0 1 1 9.5 1.8 Z" fill="#000"/>',
  '<circle cx="7" cy="7" r="5.5" fill="#000"/>',
  '<circle cx="7" cy="7" r="6"/><path d="M 7.00 1.70 L 10.12 11.29 L 1.96 5.36 L 12.04 5.36 L 3.88 11.29 Z"/>',
];
const SYMBOL_NAMES = ['fire', 'water', 'air', 'earth', 'crescent_moon', 'full_moon', 'pentacle'];
const symbolRow = SYMBOLS.map((s, i) => `<span class="sym" data-zone="send_to_${SYMBOL_NAMES[i]}"><i></i><svg width="17" height="17" viewBox="0 0 14 14" fill="none" stroke="#000" stroke-width="1.1">${s}</svg></span>`).join('');
// Hardcover (HARDCOVER=1): KDP needs at least 75 pages, so pad with notes pages to an even count >= 76.
const HARDCOVER = process.env.HARDCOVER === '1';
if (HARDCOVER) while (pages.length < 76 || pages.length % 2) add('notes', notesPage('Notes'), '', 'notes');
// Page code: Data Matrix, payload "KW2|<edition>|<yymm>|<size><page>", e.g. KW2|1|2610|S026 (15 chars = 16x16 modules, the
// same symbol size as the old KW1|2610|026, so modules stay 0.42in / 16 = 0.66 mm). Size: S 5.5x8.5, L 8.5x11, H 5.5x8.5
// hardcover. Size and edition are in the code because zone positions differ by size and layout.json is per book variant.
// Built from `pages` as it stands here (after all padding), so a page's code always names its real position; check-codes.mjs
// re-verifies that on every build. Page type and date come from layout.json.
const SIZE_CODE = HARDCOVER ? 'H' : LETTER ? 'L' : 'S';
const pageCode = (i) => `KW2|${EDITION}|${VOL.id.slice(2).replace('-', '')}|${SIZE_CODE}${String(i + 1).padStart(3, '0')}`;
// Rulings for print: drawRulings() (rulings.mjs) redraws every ruled line, dot grid and 4 mm grid as vector SVG; keep its SPECS in sync with the CSS below and in daypage.mjs.

const qrSvgs = pages.map((p, i) => bwipjs.toSVG({ bcid: 'datamatrix', text: pageCode(i) }));
const html = `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="file://${process.cwd()}/node_modules/@fontsource/lora/400.css"><link rel="stylesheet" href="file://${process.cwd()}/node_modules/@fontsource/lora/600.css"><link rel="stylesheet" href="file://${process.cwd()}/node_modules/@fontsource/lora/700.css"><link rel="stylesheet" href="file://${process.cwd()}/node_modules/@fontsource/lora/400-italic.css"><link rel="stylesheet" href="file://${process.cwd()}/node_modules/@fontsource/noto-serif-jp/400.css"><link rel="stylesheet" href="file://${process.cwd()}/node_modules/@fontsource/noto-serif-jp/600.css"><link rel="stylesheet" href="file://${process.cwd()}/node_modules/@fontsource/noto-sans-jp/400.css"><link rel="stylesheet" href="file://${process.cwd()}/node_modules/@fontsource/dejavu-sans/400.css"><link rel="stylesheet" href="file://${process.cwd()}/node_modules/@fontsource/inter/500.css"><link rel="stylesheet" href="file://${process.cwd()}/node_modules/@fontsource/inter/700.css"><style>
@page { size: ${TRIM_W}in ${TRIM_H}in; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body { font-family: 'Lora', 'Noto Serif JP', serif; font-size: 8.4pt; color: #111; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.jp, .kj, ruby, .sk, .jp-title, .wk-k { font-family: 'Noto Serif JP', 'Noto Sans JP', serif; }
rt { font-size: 7pt; font-family: 'Noto Serif JP', serif; color: #444; }
.gl { font-family: 'DejaVu Sans', sans-serif; font-size: 0.95em; }
.page { width: ${W_IN}in; height: ${H_IN}in; zoom: ${ZOOM}; position: relative; overflow: hidden; page-break-after: always; break-after: page; padding: ${TOP}in ${OUTSIDE}in ${BOTTOM}in ${INSIDE}in; display: flex; flex-direction: column; }
.page.verso { padding-left: ${OUTSIDE}in; padding-right: ${INSIDE}in; }
.folio { position: absolute; bottom: 0.3in; font-size: 7pt; color: #555; }
.recto .folio { right: ${OUTSIDE}in; } .verso .folio { left: ${OUTSIDE}in; }
h1 { font-size: 34pt; font-weight: 600; margin: 0.2in 0 0.05in; letter-spacing: 0.5px; }
h2.pt { font-size: 14pt; font-weight: 600; margin: 0 0 0.08in; }
h2.month { font-size: 22pt; margin: 0; font-weight: 600; }
h3 { font-size: 9pt; font-weight: 700; margin: 0.12in 0 0.04in; text-transform: uppercase; letter-spacing: 0.6px; }
h4 { margin: 0 0 2px; font-size: 8.5pt; }
.dim { color: #555; } .small { font-size: 7.2pt; color: #333; line-height: 1.35; }
.lead { font-size: 8.8pt; line-height: 1.45; margin: 0 0 0.1in; }
.title { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; height: 100%; }
.tmoon { display: flex; gap: 14px; margin-bottom: 0.2in; }
.sub { font-style: italic; font-size: 12pt; margin: 0; } .jp-title { font-size: 16pt; margin: 0.12in 0; } .range { font-size: 11pt; letter-spacing: 2px; text-transform: uppercase; margin: 0.1in 0; }
.place { font-size: 7.5pt; color: #444; } .built { font-size: 6pt; line-height: 9pt; margin: 0; color: #666; } .owner { margin-top: calc(0.6in - 9pt); font-size: 8pt; color: #444; } .owner .line { display: inline-block; width: 3in; border-bottom: 1px solid #333; height: 0.3in; }
table { border-collapse: collapse; }
.lin th { text-align: left; vertical-align: top; padding: 4px 8px 4px 0; width: 1.45in; font-size: 8pt; }
.lin td { padding: 4px 0; font-size: 8pt; border-bottom: 1px solid #bbb; line-height: 1.35; }
.lin tr th { border-bottom: 1px solid #bbb; }
.steps { display: grid; grid-template-columns: 1fr 1fr; gap: 0.12in; } .steps p { margin: 0; line-height: 1.4; } .steps h3 { margin-top: 0.05in; }
.h3b { margin-top: 0.25in; }
.anat { border: 1px solid #333; padding: 6px; display: grid; gap: 5px; } .anat div { border: 1px dashed #777; padding: 5px 6px; font-size: 8pt; } .anat .a3 { height: 1in; } .anat .a1 { height: 0.45in; }
.keycols { display: grid; grid-template-columns: 1fr 1fr; gap: 0.15in; }
.bul { list-style: none; padding: 0; margin: 0; columns: 2; } .bul li { padding: 1px 0; } .bul b { display: inline-block; width: 12px; }
.phases { display: grid; grid-template-columns: 1fr 1fr; gap: 3px 6px; font-size: 7.4pt; } .phases span, .gl-list span { display: flex; align-items: center; gap: 4px; }
.gl-list { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 6px; font-size: 7.6pt; }
.wk td { padding: 2px 10px 2px 0; font-size: 8pt; border-bottom: 1px solid #ccc; } .wk .kj { font-size: 13pt; }
.boxline { border-bottom: 1px solid #333; font-size: 8pt; font-weight: 700; padding: 0.14in 0 2px; margin-bottom: 2px; }
.boxline.big { height: 0.6in; font-size: 9pt; }
.lines { overflow: hidden; } .rule { border-bottom: 1px solid #a0a0a0; }
.lines.l2 { height: 0.52in; } .lines.l3 { height: 0.78in; } .lines.l4 { height: 1.04in; } .lines.l6 { height: 1.56in; } .lines.l7 { height: 1.82in; }
.fill { flex: 1; min-height: 0.5in; }
/* .dots, .m .dots and .genko backgrounds: print redraws them as vectors in drawRulings() (rulings.mjs); keep its SPECS in sync */
.dots { background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='17' height='17' viewBox='0 0 17 17'%3E%3Ccircle cx='8.5' cy='8.5' r='1.344' fill='%23606060'/%3E%3C/svg%3E"); background-size: 0.17in 0.17in; background-position: -0.085in -0.085in; }
.three { margin: 4px 0 0 16px; padding: 0; } .three li { height: 0.34in; border-bottom: 1px solid #a0a0a0; }
.minis { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.12in; margin-bottom: 0.05in; }
.mini table { width: 100%; font-size: 7pt; text-align: center; } .mini th { font-weight: 700; color: #444; } .mini td { padding: 1.5px 0; position: relative; } .mini td.q { font-weight: 700; } .mq { position: absolute; top: 0; right: -1px; }
.sky2 td, .sky td { padding: 2.5px 8px 2.5px 0; font-size: 7.8pt; border-bottom: 1px solid #ccc; vertical-align: middle; } .sky2 td:first-child, .sky td:first-child { white-space: nowrap; font-weight: 600; width: 0.6in; }
.sky2 { width: 100%; columns: 2; }
.mhead { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 4px; } .jp.big { font-size: 16pt; }
.cal { width: 100%; flex: 1; table-layout: fixed; } .cal th { font-size: 7pt; font-weight: 700; padding: 3px 0; text-align: left; border-bottom: 1px solid #333; }
.cal td { border: 1px solid #888; vertical-align: top; padding: 2px 3px; font-size: 7pt; overflow: hidden; overflow-wrap: anywhere; }
.cal .hol, .cal .ev, .cal .pay { font-size: 5.8pt; overflow-wrap: anywhere; } .cal .ev { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; overflow: hidden; } .cal .pay { letter-spacing: 0.1px; } .cal.rows6 .ev { -webkit-line-clamp: 2; }
.cal.rows4 td { height: 1.62in; } .cal.rows5 td { height: 1.3in; } .cal.rows6 td { height: 1.08in; } .cal td.out { background: #dedede; }
.cd { display: flex; justify-content: space-between; align-items: center; } .cd .n { font-size: 10pt; font-weight: 600; } .mk { display: flex; gap: 2px; align-items: center; } .sk { font-size: 7pt; border: 1px solid #555; padding: 0 1px; }
.ev { font-size: 7pt; line-height: 1.2; } .evs { font-size: 7pt; color: #444; font-style: italic; }
.daylen { display: flex; align-items: center; gap: 10px; border: 1px solid #333; padding: 6px 8px; margin-bottom: 8px; font-size: 8.4pt; } .daylen .arrow { font-size: 12pt; } .daylen .chg { margin-left: auto; font-weight: 700; }
.sky { width: 100%; }
.trk { width: 100%; font-size: 7pt; } .trk th { font-size: 7pt; font-weight: 700; text-align: left; padding: 2px; border-bottom: 1px solid #333; }
.trk td { border-bottom: 1px solid #bbb; padding: 0 2px; height: 0.2in; } .trk .dn { width: 0.2in; font-weight: 700; text-align: right; } .trk .kj { width: 0.18in; color: #444; } .trk .mc { width: 0.14in; }
.trk i { display: inline-block; width: 7px; height: 7px; border: 1px solid #444; border-radius: 50%; margin: 0 2px; vertical-align: middle; }
.trk .mood i:nth-child(4) { border-width: 1.2px; } .trk .bx { width: 0.42in; border-left: 1px solid #bbb; } .trk .nt { border-left: 1px solid #bbb; }
.mp { margin-top: 0.1in; } .mph { display: flex; gap: 8px; align-items: center; } .mph h3 { margin: 0; } .mph p { margin: 0; font-size: 7.6pt; }
.whead { display: flex; justify-content: space-between; align-items: baseline; }
.wrow { flex: 1; display: grid; grid-template-columns: 0.62in 0.9in 1fr; border-top: 1px solid #333; padding-top: 3px; min-height: 0; }
.wev { padding-left: 4px; overflow: hidden; position: relative; } .wev .rules { position: absolute; inset: 0 0 0 4px; } .wev .ev, .wev .evs { position: relative; background: #fff; display: inline-block; max-width: 100%; box-sizing: border-box; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; vertical-align: top; margin-right: 9px; } .wev .evs { font-size: 6.4pt; }
.wd .kj { font-size: 14pt; display: block; line-height: 1.1; } .wd .dt { font-size: 7.6pt; font-weight: 700; }
.wsky { font-size: 7pt; display: flex; flex-direction: column; gap: 1px; } .wsky .ms { display: flex; align-items: center; gap: 3px; }
.wr-top { display: grid; grid-template-columns: 1.25fr 1fr; gap: 0.15in; } .word .wk-k { font-size: 20pt; line-height: 1.2; }
.genko { display: grid; grid-template-columns: repeat(6, 0.26in); gap: 0; margin-top: 4px; } .genko span { width: 0.26in; height: 0.26in; border: 1px solid #999; background: linear-gradient(#ccc, #ccc) center/100% 1px no-repeat, linear-gradient(#ccc, #ccc) center/1px 100% no-repeat; }
.word p { margin: 2px 0 0; font-size: 7pt; } .prio ol { margin: 0; padding-left: 14px; } .prio li { height: 0.36in; border-bottom: 1px solid #a0a0a0; }
.hab, .mline { width: 100%; table-layout: fixed; } .hab th { font-family: 'Noto Serif JP', serif; font-size: 8pt; } .hab td { border: 1px solid #999; height: 0.24in; } .hab td.hl, .mline td.hl { width: 0.75in; border: none; border-bottom: 1px solid #999; font-size: 7pt; color: #444; }
.mline td { height: 0.16in; text-align: center; } .mline i { display: inline-block; width: 4px; height: 4px; border-radius: 50%; background: #888; } .mline td.hl { border: none; text-align: right; padding-right: 6px; } .mline tr.zero td { border-top: 1px solid #999; border-bottom: 1px solid #999; } .mline td.dl { font-family: 'Noto Serif JP', serif; font-size: 7pt; }
.halves { gap: 0; } .day { flex: 1; display: flex; flex-direction: column; min-height: 0; } .cut { height: 0; border-top: 1px dashed #999; margin: 0.08in 0; }
.dh { display: grid; grid-template-columns: 0.52in 1.55in 1fr; align-items: center; border-bottom: 1px solid #111; padding-bottom: 3px; }
.dnum { font-size: 26pt; font-weight: 600; line-height: 1; } .dname { font-size: 9.5pt; font-weight: 700; } .djp { font-size: 7pt; } .djp .kj { font-size: 12pt; }
.dsky { display: flex; gap: 5px; align-items: center; font-size: 7pt; line-height: 1.35; justify-content: flex-end; text-align: right; } .dsky svg { order: 2; }
.dko { font-size: 7pt; padding: 3px 0 2px; border-bottom: 1px solid #999; } .dko .jp { font-size: 8pt; } .dn2 { font-style: italic; } .rt { float: right; }
.dev { font-size: 7pt; padding: 2px 0; border-bottom: 1px solid #999; max-height: calc(3 * 1.2em + 4px); overflow: hidden; } .dev .more { color: #444; }
.sky1 .pay-mk { display: inline-flex; margin-left: 4px; color: #555; } .sky1 .pay-mk .ic { width: 11px; height: 11px; }
.chk, .spn { display: flex; align-items: center; gap: 3px; font-size: 7pt; padding: 3px 0 1px; } .lbl { font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; font-size: 7pt; margin: 0 2px 0 5px; } .lbl:first-child { margin-left: 0; }
.bub { display: inline-flex; } .bub i { width: 9px; height: 9px; border: 1px solid #333; border-radius: 50%; } .bub:nth-child(5) i { border-width: 1.6px; } .end { font-size: 7pt; color: #444; }
.blank { display: inline-block; width: 0.35in; border-bottom: 1px solid #333; height: 9px; } .blank.long { flex: 1; } .spoon { margin: 0 0.5px; } .sp2 { margin-left: 8px; }
.log { flex: 1; min-height: 0.8in; margin-top: 3px; }
.rev { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px; border-top: 1px solid #333; padding-top: 2px; } .rev div { font-size: 7pt; display: flex; flex-direction: column; } .rev b { text-transform: uppercase; letter-spacing: 0.5px; font-size: 7pt; } .rev span { height: 0.42in; overflow: hidden; }
.fact { font-size: 8pt; line-height: 1.25; padding-top: 3px; margin-top: 2px; border-top: 1px dotted #777; font-style: italic; color: #222; } .fact b { font-style: normal; text-transform: uppercase; letter-spacing: 0.5px; margin-right: 3px; }
.pio { border: 1px solid #333; padding: 5px 7px; margin-top: 0.1in; font-size: 7.4pt; line-height: 1.32; } .pio p { margin: 2px 0 0; } .pio-h { display: flex; align-items: baseline; gap: 5px; } .pio-h b { font-size: 9.5pt; } .pio-k { font-size: 7pt; text-transform: uppercase; letter-spacing: 0.6px; font-weight: 700; margin-right: 3px; } .pio-f { font-style: italic; } .pio-f b { font-style: normal; font-size: 7pt; text-transform: uppercase; letter-spacing: 0.5px; margin-right: 3px; }

.page.m { padding: ${TOP + FRAME_PAD}in ${OUTSIDE + FRAME_PAD}in ${BOTTOM + FRAME_PAD + STRIP + 0.08}in ${INSIDE + FRAME_PAD}in; }
.page.m.verso { padding-left: ${OUTSIDE + FRAME_PAD}in; padding-right: ${INSIDE + FRAME_PAD}in; }
.frame { position: absolute; top: ${TOP}in; bottom: ${BOTTOM}in; border: ${BORDER_PT}pt solid #000; pointer-events: none; }
.recto .frame { left: ${INSIDE}in; right: ${OUTSIDE}in; } .verso .frame { left: ${OUTSIDE}in; right: ${INSIDE}in; }
.strip { position: absolute; bottom: ${BOTTOM + FRAME_PAD}in; height: ${STRIP}in; display: flex; align-items: flex-end; gap: 0.1in; }
.recto .strip { left: ${INSIDE + FRAME_PAD}in; right: ${OUTSIDE + FRAME_PAD}in; } .verso .strip { left: ${OUTSIDE + FRAME_PAD}in; right: ${INSIDE + FRAME_PAD}in; }
.strip .pno { font: 500 7pt 'Inter', sans-serif; color: #333; width: 0.2in; } .strip .send { font: 700 7pt 'Inter', sans-serif; color: #333; letter-spacing: 0.5px; }
.sym { display: flex; flex-direction: column; align-items: center; gap: 2px; } .sym i { width: 12px; height: 12px; border: 1px dashed #333; border-radius: 50%; }
.strip .qr { margin-left: auto; width: ${STRIP}in; height: ${STRIP}in; } .strip .qr svg { width: 100%; height: 100%; display: block; }
.m .dots { background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='5mm' height='5mm' viewBox='0 0 50 50'%3E%3Ccircle cx='25' cy='25' r='4' fill='%23C8C8C8'/%3E%3C/svg%3E"); background-size: 5mm 5mm; background-position: -2.5mm -2.5mm; }
.m .rule { border-bottom-color: #c8c8c8; }
.zl { font-family: 'Inter', sans-serif; font-weight: 700; font-size: 7pt; letter-spacing: 0.6px; text-transform: uppercase; color: #111; }
.hz { display: grid; grid-template-columns: 1.35fr 1fr; gap: 4px; margin-bottom: 4px; }
.zbox { border: 1px solid #9a9a9a; background: #e6e6e6; padding: 3px 5px; min-height: 0.3in; display: flex; gap: 5px; align-items: baseline; }
.zbox .zv { font: 500 7.5pt 'Inter', sans-serif; } .blank.sm { width: 0.25in; margin-right: 4px; }
.care { border-top: 1px solid #9a9a9a; border-bottom: 1px solid #9a9a9a; padding: 4px 0; margin: 3px 0; }
.cr { display: flex; align-items: center; gap: 4px; font-size: 7pt; height: 0.215in; white-space: nowrap; } .cr .sp { margin-left: 14px; } .cr > .zl:first-child { width: 0.52in; flex: none; }
.ck { display: inline-flex; align-items: center; gap: 2px; margin-right: 4px; } .ck i { width: 9px; height: 9px; border: 1.1px solid #000; display: inline-block; } .ck span { font: 500 7pt 'Inter', sans-serif; }
.work { display: flex; align-items: center; gap: 3px; font-size: 7pt; height: 0.22in; } .work .blank { width: 0.42in; }
.pay { font: 700 7pt 'Inter', sans-serif; letter-spacing: 0.3px; } .hol { font-size: 7pt; line-height: 1.1; font-weight: 700; } .hol.fed { text-decoration: underline; }
.wk-shift { font-size: 7pt; color: #333; margin-top: 2px; }
.sh { font: 600 7.5pt Inter, sans-serif; text-transform: uppercase; margin: 5px 0 1px; border-bottom: 1px solid #000; }
.sup { padding: 1px 0; border-bottom: 1px solid #e3e3e3; font-size: 7.2pt; line-height: 1.2; } .sup .sn { display: flex; align-items: center; gap: 3px; } .sup .sn b { margin-right: auto; }
.chip { font: 600 7pt Inter, sans-serif; border: 1px solid #000; padding: 0 2px; line-height: 1.2; } .chip.tx { background: #000; color: #fff; }
.clinic { border: 1px solid #000; padding: 4px 6px; font-size: 7.2pt; line-height: 1.2; } .clinic .sup:last-of-type { border-bottom: none; } .cf { display: flex; gap: 4px; align-items: flex-end; margin-top: 4px; font: 600 7pt Inter, sans-serif; text-transform: uppercase; } .cf i { flex: 1; border-bottom: 1px solid #000; height: 0.16in; }
.qc { padding: 3px 0 5px; border-bottom: 1px solid #e3e3e3; } .qg { display: grid; grid-template-columns: 1fr 1fr; column-gap: 12px; } .qr { display: flex; gap: 6px; align-items: flex-end; }
.qf { display: flex; gap: 4px; align-items: flex-end; flex: 1; min-height: 0.25in; } .qf span { font: 500 7pt Inter, sans-serif; text-transform: uppercase; color: #333; } .qf i { flex: 1; border-bottom: 1px solid #777; height: 0.17in; }
.qt { font: 600 7pt Inter, sans-serif; display: flex; gap: 2px; align-items: center; padding-bottom: 1px; } .qt i { width: 9px; height: 9px; border: 1px solid #000; display: inline-block; }
.cbl2 { display: flex; align-items: center; gap: 6px; font-size: 7.8pt; padding: 3px 0; border-bottom: 1px solid #e3e3e3; } .cbl2 i { width: 10px; height: 10px; border: 1.2px solid #000; flex: none; } .qf .u { text-transform: none; color: #666; }
.ic { flex: none; vertical-align: -2px; color: var(--ink, #000); }
.cg2 { display: grid; grid-template-columns: 1fr 1fr; column-gap: 12px; } .care .cr { gap: 5px; height: 0.23in; } .care .cr > .ic:first-child { width: 12px; height: 12px; margin-right: 3px; }
.care .ck { gap: 2px; } .care .ck .ic { width: 11px; height: 11px; } .care .gap { width: 6px; } .care .u { font-size: 7pt; color: #555; } .care .off { font: 500 7pt Inter, sans-serif; text-transform: uppercase; }
.blank.xs { width: 0.24in; } .care [data-zone="work"] { gap: 3px; } .care .cr.sp { margin-top: 1px; }
.rev .zl .ic { width: 12px; height: 12px; }
.trk th .ic { width: 10px; height: 10px; }
.ikey { display: grid; grid-template-columns: 1fr 1fr; gap: 3px 12px; font-size: 7.5pt; margin-bottom: 6px; } .ikey span { display: flex; align-items: center; gap: 5px; } .ikey .ic { width: 11px; height: 11px; }
.sq { margin-top: 3px; } .sph { display: flex; align-items: flex-end; gap: 10px; } .sph .pt { flex: none; } .sph .qf { max-width: 2.1in; } .pn { display: flex; gap: 8px; align-items: flex-end; } .pn .qf:first-child { flex: 1.2; } .sq .lines.l2 { height: 0.36in; } .sq + .sq { margin-top: 5px; } .sq b { font-size: 7.5pt; } .script { margin-top: 3px; border: 1px solid #000; padding: 5px 7px; font-size: 7.5pt; line-height: 1.35; }
.carep { width: 100%; } .carep th { text-align: left; font-size: 7.5pt; border-bottom: 1px solid #333; } .carep td { height: 0.28in; border-bottom: 1px solid #bbb; } .wd .wdn { font-size: 11pt; font-weight: 600; display: block; line-height: 1.1; } .cal .sk { font-size: 7pt; font-style: italic; color: #333; line-height: 1.1; border: none; padding: 0; }
.ztags { grid-column: 1 / -1; }
.sky1 { display: flex; flex-wrap: wrap; gap: 0 4px; align-items: center; font-size: 8pt; line-height: 1.25; margin: 2px 0; } .sky1 > span:not(.season) { white-space: nowrap; } .sky1 .season { margin-left: auto; font-style: italic; color: #333; text-align: right; } .sky2l { font-size: 8pt; color: #333; margin: 1px 0 3px; }
.net { width: 100%; table-layout: fixed; border-collapse: collapse; font-size: 7pt; font-variant-numeric: tabular-nums; margin-top: 4px; }
.net th { font: 600 7pt Inter, sans-serif; text-align: left; border-bottom: 1px solid #000; padding: 1px 3px; }
.net td { padding: 1.6px 1.5px; overflow: hidden; letter-spacing: -0.015em; border-bottom: 1px solid #e3e3e3; white-space: nowrap; } .net .rn { font: 700 7.5pt Inter, sans-serif; text-align: right; padding-right: 4px; } .net col.c1 { width: 0.3in; } .net col.c2 { width: 0.66in; }
.net .rname { text-overflow: ellipsis; }
.hg { width: 100%; border-collapse: collapse; font-size: 7pt; font-variant-numeric: tabular-nums; margin-top: 4px; table-layout: fixed; }
.hg th { font: 600 7pt Inter, sans-serif; padding: 1px 2px; text-align: left; } .hg th.gh { border-bottom: 1px solid #000; line-height: 1.15; vertical-align: bottom; } .hg th.gh .dim { font-weight: 400; }
.hg tr.rng td { background: #f1f1f1; } .hg td { padding: 0.4px 2px; line-height: 1.1; border-bottom: 1px solid #e3e3e3; overflow: hidden; letter-spacing: -0.02em; } .hg td.hl { white-space: nowrap; font: 600 7pt Inter, sans-serif; text-align: right; padding-right: 5px; } .hg td.hl.pm { font-weight: 800; }
.busvalid { font: 600 7pt Inter, sans-serif; margin: 3px 0 0; border: 1px solid #000; padding: 2px 5px; display: inline-block; } .busbox { margin-top: 8px; border: 1px solid #000; padding: 4px 7px; font-size: 8pt; }
.rt { font: 600 7.5pt Inter, sans-serif; text-transform: uppercase; margin: 6px 0 0; } .hg .gs { border-left: 1px solid #9a9a9a; padding-left: 4px; }
.az { margin-top: 4px; } .cb { display: flex; align-items: center; gap: 6px; height: 0.24in; } .cb i { width: 10px; height: 10px; border: 1.2px solid #000; flex: none; } .cb span { flex: 1; border-bottom: 1px solid #c8c8c8; height: 100%; display: flex; align-items: flex-end; font-size: 7.5pt; padding-bottom: 1px; }
.m .chk .zl, .m .spn .zl { margin-right: 3px; }
.m .lin th, .m .lin td { font-size: 7pt; padding: 2px 6px 2px 0; } .m .lin th { width: 1.1in; } .m .lead { font-size: 7.5pt; } .m .small { font-size: 7pt; }
.m .steps { gap: 0.06in; } .m .steps p { font-size: 7.4pt; } .m .anat .a3 { height: 0.45in; } .m .anat div { font-size: 7pt; padding: 3px 5px; }
.m .cal.rows5 td { height: 0.8in; } .m .cal.rows6 td { height: 0.67in; } .m .trk td { height: 0.14in; } .m .trk th { white-space: nowrap; } .m .trk { font-size: 7pt; } .m .trk .mood i, .m .trk .en i { width: 6px; height: 6px; margin: 0 0.5px; } .m .trk .mood { white-space: nowrap; } .m .trk .bx { width: 0.34in; }
.m .keycols { gap: 0.08in; } .m .phases, .m .gl-list { font-size: 7pt; }
.m .cal + .small { display: none; } .trk .un th { font: 500 5.6pt Inter, sans-serif; color: #444; padding: 0 1px 1px; text-align: left; } .m .mline td { height: 0.12in; } .m .hab td { height: 0.2in; } .m .fill { min-height: 0.25in; } .m .genko { grid-template-columns: repeat(6, 0.22in); } .m .genko span { width: 0.22in; height: 0.22in; } .m .pio { margin-top: 0.06in; }
.m .wrow.other { flex: 0 0 0.22in; } .m .wrow.other .wev { background: none; }
.day.full .log { min-height: 1.6in; } /* writing space is never below 40 mm (1.6 in = 40.6 mm) */ .day.full .rev { margin-top: 4px; } .day.full .rev span { height: 0.44in; }
.wrow.other { color: #777; }
.m .cal.rows4 td { height: 1.26in; } .m .cal.rows5 td { height: 1.0in; } .m .cal.rows6 td { height: 0.84in; } .m .trk td { height: 0.16in; } .m .cal { flex: 0 0 auto; }
.review .rvh { margin-top: 0.02in; font-size: 10pt; text-transform: none; letter-spacing: 0; } .rq { margin-top: 4px; font-size: 7.6pt; }
.xh { display: flex; justify-content: space-between; align-items: baseline; } .xft { display: flex; gap: 5px; align-items: flex-end; font-size: 7.4pt; margin: 4px 0; } .xft i { flex: 1; border-bottom: 1px solid #333; height: 12px; }
.xp { font-size: 8pt; margin: 4px 0 6px; }
.lines.fill { flex: 1; }
.blankpage { flex: 1; }
${DAYPAGE_CSS}
</style></head><body>
${pages.map((p, i) => { const n = i + 1; const side = n % 2 ? 'recto' : 'verso'; const marks = `<div class="frame"></div><div class="strip"><span class="pno">${n}</span><span class="send">SEND TO</span>${symbolRow}<span class="qr">${qrSvgs[i]}</span></div>`; return `<div class="page ${side} ${p.cls} m">${p.html}${marks}</div>`; }).join('\n')}
<script>
document.querySelectorAll('.lines').forEach((el) => {
  const pitch = parseFloat(el.dataset.pitch || '0.26') * 96;
  const n = Math.floor((el.clientHeight - 1) / pitch);
  for (let i = 0; i < n; i++) { const d = document.createElement('div'); d.className = 'rule'; d.style.height = pitch + 'px'; el.appendChild(d); }
});
${drawRulings.toString()}
document.fonts.ready.then(drawRulings);
</script></body></html>`;

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(`${OUT}/journal.html`, html);
fs.writeFileSync(`${OUT}/data.json`, JSON.stringify(D, null, 1));
const browser = await launch();
const page = await browser.newPage();
await page.goto('file://' + process.cwd() + `/${OUT}/journal.html`, { waitUntil: 'networkidle' }); await page.evaluate(() => document.fonts.ready);
await page.evaluate(() => drawRulings()); // vector rulings on the final layout (the page also does this on load)
// Zone map for the scanning app: every labelled zone in mm, relative to the inner edge of the black frame.
const layout = await page.evaluate(() => {
  const px2mm = 25.4 / 96;
  return [...document.querySelectorAll('.page')].map((pg, i) => {
    const f = pg.querySelector('.frame').getBoundingClientRect(), bw = parseFloat(getComputedStyle(pg.querySelector('.frame')).borderTopWidth);
    const ox = f.left + bw, oy = f.top + bw, fw = f.width - 2 * bw, fh = f.height - 2 * bw;
    const rect = (el) => { const e = el.getBoundingClientRect(); return { x: +((e.left - ox) * px2mm).toFixed(1), y: +((e.top - oy) * px2mm).toFixed(1), w: +(e.width * px2mm).toFixed(1), h: +(e.height * px2mm).toFixed(1) }; };
    // repeated zone names get _2, _3 ... (same rule as the day page blocks)
    const seen = {};
    const zones = [...pg.querySelectorAll('[data-zone]')].map((el) => { const n = el.dataset.zone; seen[n] = (seen[n] || 0) + 1; return { zone: seen[n] > 1 ? `${n}_${seen[n]}` : n, ...rect(el) }; });
    if (!zones.some((z) => !z.zone.startsWith('send_to_'))) { // a page with no labelled block (title, key, directories ...): one zone for everything inside the frame
      const kids = [...pg.children].filter((c) => !c.matches('.frame, .strip, .folio')).map((c) => c.getBoundingClientRect()).filter((r) => r.width && r.height);
      if (!kids.length) kids.push(pg.getBoundingClientRect()); // nothing measurable inside: fall back to the whole page
      const l = Math.min(...kids.map((r) => r.left)), t = Math.min(...kids.map((r) => r.top));
      zones.push({ zone: 'content', ...rect({ getBoundingClientRect: () => ({ left: l, top: t, width: Math.max(...kids.map((r) => r.right)) - l, height: Math.max(...kids.map((r) => r.bottom)) - t }) }) });
    }
    zones.push({ zone: 'page_code', ...rect(pg.querySelector('.strip .qr')) }, { zone: 'send_to', ...rect(pg.querySelector('.strip')) });
    return { page: i + 1, frame_inner_mm: { w: +(fw * px2mm).toFixed(1), h: +(fh * px2mm).toFixed(1) }, zones };
  });
});
const meta = pages.map((p, i) => ({ type: p.type, date: p.date || null, ...(p.from && !p.date ? { from: p.from, to: p.to } : {}), section: p.section, code: pageCode(i), code_format: 'data_matrix' }));
fs.writeFileSync(`${OUT}/layout.json`, JSON.stringify({ book: VOL.id, edition: EDITION, size: SIZE_CODE, code_scheme: 'KW2|<edition>|<yymm>|<size><page>', trim_in: [TRIM_W, TRIM_H], border_pt: BORDER_PT, quiet_zone_in: QUIET, symbols: ['fire', 'water', 'air', 'earth', 'crescent_moon', 'full_moon', 'pentacle'], pages: layout.map((l, i) => ({ ...meta[i], ...l })) }, null, 1));
await page.pdf({ width: `${TRIM_W}in`, height: `${TRIM_H}in`, path: `${OUT}/keeping-watch-${VOL.id}-interior-${HARDCOVER ? 'hardcover-' : ''}${SIZE_TAG}.pdf`, printBackground: true, preferCSSPageSize: true });
await browser.close();
fs.writeFileSync(`${OUT}/pages${HARDCOVER ? '-hardcover' : ''}.txt`, String(pages.length)); // separate counts, so each cover sizes its own spine
console.log(`book ${VOL.id}: ${D.days[0].date} → ${D.days[D.days.length - 1].date}, ${D.weeks.length} weeks, ${pages.length} pages`);
