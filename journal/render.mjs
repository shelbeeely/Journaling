// Renders one monthly book's KDP interior (5.5x8.5, or 8.5x11 with SIZE=letter) as HTML (one fixed-size div per page)
// and prints it to PDF with Chromium.
// Usage: node render.mjs month <YYYY-MM> [a.ics,b.ics]      (SIZE=letter for 8.5x11, HARDCOVER=1 to pad to 76+ pages)
import fs from 'node:fs';
import { launch } from './browser.mjs';
import { build } from './data.mjs';
import bwipjs from 'bwip-js';
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
const ICON_KEY = [['pill', 'Meds'], ['am', 'Morning dose'], ['pm', 'Evening dose'], ['prn', 'As needed (write the time)'], ['meal', 'Meals'], ['snack', 'Snack'], ['shower', 'Shower'], ['teeth', 'Teeth'], ['joy', 'Did something I enjoy'], ['text', 'Texted someone'], ['low', 'Mood low … high'], ['anx', 'Anxiety 0–3'], ['sleep', 'Sleep hours'], ['work', 'Work shift'], ['spoon', 'Spoons: cross off as you use them'], ['well', 'Went well'], ['hard', 'Was hard'], ['next', 'Tomorrow']];
const bubbles = (labels, lo, hi) => `<span class="end">${lo}</span>` + labels.map(() => `<span class="bub"><i></i></span>`).join('') + `<span class="end">${hi}</span>`;
const dur = (min) => `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, '0')}m`;
const ruby = (k, r) => `<ruby>${k}<rt>${r}</rt></ruby>`;

// ---------- page sequencing (mirror margins by parity) ----------
const pages = [];
const add = (cls, html, date = '') => pages.push({ cls, html, date });
const alignToVerso = () => { if ((pages.length + 1) % 2 === 1) add('notes', notesPage('Notes')); }; // next page must be even
const alignToRecto = () => { if ((pages.length + 1) % 2 === 0) add('notes', notesPage('Notes')); };
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
    <p class="owner">This journal belongs to<br><span class="line"></span></p>
  </div>`;
}

function lineagePage() {
  return `<h2 class="pt">Where each piece comes from</h2>
  <p class="lead">Every part of this journal is borrowed from a method people used for centuries. The history shows one lesson: methods die when they get complicated. <b>Skip anything, any day.</b> A blank box is data too.</p>
  <table class="lin">${LINEAGE.map(([a, b]) => `<tr><th>${a}</th><td>${b}</td></tr>`).join('')}</table>
  <p class="small">Daily “On this day” facts come from the Computer History Museum’s This Day in History and Wikipedia’s date pages. Pioneer profiles are checked against each person’s Wikipedia article.</p>
  <p class="small">Astrology here is a reflection prompt, not a forecast. The astronomy (sunrise, sunset, moon phase, solstice) is real and calculated for ${esc(D.config.place)}.</p>`;
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
  <div class="anat"><div><b class="zl">DATE / TITLE / TAGS</b> printed date; write a title and tags in the boxes</div><div><b class="zl">SKY + CHECK-IN</b> moon, sun, season; circle mood, cross off spoons</div><div class="a3"><b class="zl">BODY</b> faint 5 mm dots: write anything</div><div><b class="zl">ACTION ITEMS</b> one task per checkbox</div><div><b class="zl">REVIEW</b> went well · was hard · tomorrow</div></div><p class="small" style="margin-top:5px"><b>At the back:</b> Support p. {{P_SUPPORT}} · Safety plan p. {{P_SAFETY}} · Bus times p. {{P_BUS}} · Where each piece comes from p. {{P_LINEAGE}}</p><h3 class="h3b">Scanning pages</h3><p class="small">Every page has a black frame, seven “send to” bubbles and a small square page code (a Data Matrix) that says which book and page it is. Fill a bubble to route the scan (you choose what each shape means in your scanning app). Keep the frame and the page code clear of ink. These markers are made for your own app; the Rocketbook app won’t read them.</p>`;
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
      <p class="small"><b>Mood</b> −3 very low · 0 steady · +3 very high/wired<br><b>Energy</b> 1 empty … 5 full<br><b>Spoons</b> ${spoon()} cross one out per spoon spent. Start with the number you woke up with.</p>
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
function busMeta() {
  const E = NET.months[VOL.id];
  const ymd = (s) => `${s.slice(4, 6).replace(/^0/, '')}/${s.slice(6).replace(/^0/, '')}/${s.slice(2, 4)}`;
  if (E.stale) console.warn(`! STA schedule ends ${NET.valid_to}; refresh gtfs before printing ${VOL.id}`);
  return { E, note: `STA schedule ${ymd(NET.valid_from)}–${ymd(NET.valid_to)}.${E.stale ? ' <b>May have changed: check spokanetransit.com.</b>' : ''}` };
}
function netPage(part) {
  const { E, note } = busMeta();
  const ids = Object.keys(E.summary).filter((r) => NET.routes[r]).sort((a, b) => parseInt(NET.routes[a].n) - parseInt(NET.routes[b].n));
  const half = Math.ceil(ids.length / 2), mine = part === 0 ? ids.slice(0, half) : ids.slice(half);
  const cell = (x) => x ? `${x.span.replace(/:00/g, '')}${x.every ? ` <b>${x.every === 7.5 ? '7–8' : x.every}</b>` : ''}` : '<span class="dim">no service</span>';
  const rows = mine.map((r) => `<tr><td class="rn">${esc(NET.routes[r].n)}</td><td class="rname">${esc(NET.routes[r].name)}</td>${DAY3.map(([k]) => `<td>${cell(E.summary[r][k])}</td>`).join('')}</tr>`).join('');
  return `<h2 class="pt">${part === 0 ? 'STA at a glance' : 'STA at a glance, cont.'}</h2><p class="small">First–last bus, then <b>minutes between buses</b> at midday.</p>
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
  const { E, note } = busMeta();
  return `<div class="xh"><h2 class="pt">Bus times</h2><span class="dim">minutes past the hour</span></div>
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
const CUT = `<div class="cutnote"><svg width="9" height="8" viewBox="0 0 12 10" style="vertical-align:-1px"><circle cx="2.5" cy="2.5" r="1.8" fill="none" stroke="#444" stroke-width="1"/><circle cx="2.5" cy="7.5" r="1.8" fill="none" stroke="#444" stroke-width="1"/><path d="M4 3.4 L11.5 8.5 M4 6.6 L11.5 1.5" stroke="#444" stroke-width="1"/></svg> To remove this page, cut along the inside edge of the black frame.</div>`;
function dirPage(title, intro, data) {
  const chip = (t) => t.split(' ').filter(Boolean).map((x) => `<span class="chip${x === 'TEXT' ? ' tx' : ''}">${x}</span>`).join('');
  return `${CUT}<h2 class="pt">${title}</h2><p class="small">${intro}</p>
  ${data.map(([h, items]) => `<h3 class="sh">${h}</h3>${items.map(([n, d, c]) => `<div class="sup"><div class="sn"><b>${n}</b>${chip(c)}</div><div class="sd">${d}</div></div>`).join('')}`).join('')}`;
}
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
  <h3 class="sh">2 · Hand off to the Keeper${kp ? ` (p. ${kp}–${kp + 1})` : ''}</h3>
  ${step('Copy the totals, highs, lows and health notes')}${step('Add new contacts and birthdays')}${step('Update account hints; cross out used recovery codes')}${step('Index pages worth finding later (this is <b>Book ' + VOL.n + '</b>)')}${step('Back up the X4 log: Wi-Fi sync → download')}
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
  const q = (n, t, h = 'l2') => `<div class="sq"><b>${n}. ${t}</b><div class="lines ${h}"></div></div>`;
  return `${CUT}<h2 class="pt">My safety plan</h2>
  <p class="small">Fill this in on a good day, so it is ready on a hard one. Work down the list until you feel safer.</p>
  ${q(1, 'Signs a hard time is starting (thoughts, moods, situations)')}
  ${q(2, 'Things I can do on my own to feel a little better')}
  ${q(3, 'People or places that help me get my mind off it')}
  ${q(4, 'People I can text for help')}
  ${q(5, 'Professionals: my therapist, my prescriber, 988, crisis line 1-877-266-1818')}
  ${q(6, 'How I can make my space safer (meds, other things)')}
  ${q(7, 'What matters to me, worth staying for', 'l2')}
  <div class="script"><b>A text I can send when talking is too hard:</b><br>“Hey, I’m having a hard time. I’m not up for a call. Can you text with me for a bit?”</div>`;
}

function themePage() {
  return `<h2 class="pt">Season theme</h2>
  <p class="lead">A theme is a direction for the season, like “Season of Rest” or “Season of Order.” There's no pass or fail.</p>
  <div class="boxline big">My theme for ${VOL.short}</div>
  <div class="boxline">What it means to me</div><div class="lines l4"></div>
  <div class="boxline">Three small ways to live it (these become your habit grid)</div>
  <ol class="three"><li></li><li></li><li></li></ol>
  <div class="boxline">What I want to feel by ${seasonGoal()}</div><div class="lines l4"></div>`;
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
  return `<div class="mhead"><h2 class="month">${M.name}</h2><span class="big">${M.y}</span></div>
  <table class="cal rows${rows.length}"><tr>${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((x) => `<th>${x}</th>`).join('')}</tr>${rows.join('')}</table>
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
  <div class="daylen"><div><b>${f.sun.rise}</b> / <b>${f.sun.set}</b><br><span class="dim">${M.name.slice(0, 3)} ${f.d} · ${dur(f.sun.lengthMin)}</span></div><div class="arrow">→</div><div><b>${l.sun.rise}</b> / <b>${l.sun.set}</b><br><span class="dim">${M.name.slice(0, 3)} ${l.d} · ${dur(l.sun.lengthMin)}</span></div><div class="chg">${change < 0 ? '−' : '+'}${dur(Math.abs(change))} of daylight</div></div>
  <table class="sky">${rows.join('')}</table>
  <p class="small">${G('℞')} Retrograde at some point this month: ${retroStart.map((p) => `${G(PLANET_GLYPH[p])} ${p}`).join(', ') || 'none'}.</p>`;
}

function monthTracker(M) {
  const rows = M.days.map((d) => `<tr><td class="dn">${d.d}</td><td class="kj">${DAY_LETTERS[(d.weekday + 6) % 7]}</td><td class="mc">${moon(d.moon.phaseDeg, 8)}</td><td class="mood">${[-3, -2, -1, 0, 1, 2, 3].map(() => '<i></i>').join('')}</td><td class="bx"></td><td class="bx"></td><td class="bx"></td><td class="bx"></td><td class="bx"></td><td class="bx"></td></tr>`).join('');
  return `<h2 class="pt">${M.name} · tracker</h2>
  <table class="trk"><tr><th colspan="3"></th><th>${ic('low')} mood ${ic('high')}</th><th>${ic('sleep', 'Sleep')}</th><th>${ic('pill', 'Meds')}</th><th>${ic('meal', 'Meals')}</th><th>${ic('shower', 'Shower')}</th><th>${ic('work', 'Work')}</th><th>${ic('spoon', 'Spoons')}</th></tr><tr class="un"><th colspan="3"></th><th>−3 … +3</th><th>hrs</th><th>tick</th><th>0–3</th><th>tick</th><th>hrs</th><th>used</th></tr>${rows}</table>
  <p class="small">Mood: fill one dot, −3 low to +3 high. Sleep and work in hours, meals 0–3, spoons used; tick meds and shower. X4: Menu → This month has the totals.</p>`;
}

function monthMoonPage(M) {
  const nm = M.days.find((d) => d.moon.quarter === 0), fm = M.days.find((d) => d.moon.quarter === 2);
  const block = (d, title, prompt) => d ? `<div class="mp"><div class="mph">${moon(d.moon.phaseDeg, 26)}<div><h3>${title} · ${M.name.slice(0, 3)} ${d.d}</h3><p class="dim">in ${G(d.moon.glyph)} ${d.moon.sign} · ${esc(d.notes.find((n) => n.kind === 'moon')?.text || '')}</p></div></div><p class="small">${prompt}</p><div class="lines l7"></div></div>` : '';
  return `<h2 class="pt">${M.name} · moon pages</h2>
  <div class="boxline">Theme check-in: how is my season theme going?</div><div class="lines l3"></div>
  ${block(nm, 'New moon', 'Set an intention for the next four weeks. What do you want to start, or tend?')}
  ${block(fm, 'Full moon', 'What came to light? What are you ready to put down?')}`;
}

// ---------- week section ----------
function weekLeft(W) {
  const f = W.days[0], l = W.days[W.days.length - 1];
  const lead = (f.weekday + 6) % 7, tail = 6 - ((l.weekday + 6) % 7);
  const other = (label) => `<div class="wrow other"><div class="wd"><span class="dt">${label}</span></div><div></div><div class="wev dim">${lead ? (VOL.n === 1 ? 'before this journal starts' : 'in the previous book') : (VOL.n === 12 ? 'after this journal ends' : 'in the next book')}</div></div>`;
  const rows = Array(lead).fill(0).map(() => other('—')).join('') + W.days.map((d) => `<div class="wrow"><div class="wd"><span class="wdn">${d.weekdayName.slice(0, 3)}</span><span class="dt">${MONTHS[d.m - 1].slice(0, 3)} ${d.d}</span></div><div class="wsky"><span class="ms">${moon(d.moon.phaseDeg, 11)} ${G(d.moon.glyph)} ${d.moon.lit}%</span><span class="dim">${G('☀')} ${d.sun.rise}–${d.sun.set}</span><span class="wk-shift">work ____–____</span></div><div class="wev" data-pitch="0.22"><div class="rules lines" data-pitch="0.22"></div>${d.events.filter((e) => !e.routine).map((e) => `<div class="ev">${e.time ? e.time + ' ' : ''}${esc(e.title)}</div>`).join('')}${d.notes.filter((n) => n.kind !== 'astro').map((n) => `<div class="evs">${esc(n.text)}</div>`).join('')}</div></div>`).join('') + Array(tail).fill(0).map(() => other('—')).join('');
  return `<div class="whead"><h2 class="pt">${W.label}</h2><span class="dim">${MONTHS[f.m - 1].slice(0, 3)} ${f.d} – ${MONTHS[l.m - 1].slice(0, 3)} ${l.d}</span></div>${rows}`;
}

function weekRight(W) {
  const days = DAY_LETTERS;
  const grid = (label) => `<tr><td class="hl">${label}</td>${days.map(() => '<td></td>').join('')}</tr>`;
  return `<div class="wr-top"><div class="word"><h3>Words to keep</h3><p class="dim">A line worth copying out this week: a quote, a lyric you heard, something someone said.</p><div class="lines l3" data-pitch="0.24"></div></div>
  <div class="prio"><h3>This week</h3><ol><li></li><li></li><li></li></ol></div></div>
  <h3>Habits &amp; theme</h3>
  <table class="hab"><tr><th></th>${days.map((x) => `<th>${x}</th>`).join('')}</tr>${grid('')}${grid('')}${grid('')}${grid('work hours')}</table>
  <h3>Mood line</h3>
  <table class="mline">${[3, 2, 1, 0, -1, -2, -3].map((v) => `<tr class="${v === 0 ? 'zero' : ''}"><td class="hl">${v > 0 ? '+' + v : v}</td>${days.map(() => '<td><i></i></td>').join('')}</tr>`).join('')}<tr><td></td>${days.map((x) => `<td class="dl">${x}</td>`).join('')}</tr></table>
  ${pioneerCard(W)}
  ${W.pioneer ? '' : '<h3>Notes</h3><div class="dots fill"></div>'}`;
}

function pioneerCard(W) {
  const p = W.pioneer; if (!p) return '';
  const [name, years, what, fact] = p;
  return `<div class="pio"><div class="pio-h"><span class="pio-k">Pioneer of the week</span><b>${esc(name)}</b> <span class="dim">${years}</span></div><p>${esc(what)}</p><p class="pio-f"><b>Useless knowledge</b> ${esc(fact)}</p></div>`;
}

function dayFull(d) {
  const moonTxt = d.moon.ingress.length ? d.moon.ingress.map((i) => `→ ${G(D.glyphs[i.sign])} ${i.time}`).join(' ') : `in ${G(d.moon.glyph)}`;
  const retro = d.retro.length ? ` · ${G('℞')} ${d.retro.map((p) => G(PLANET_GLYPH[p])).join('')}` : '';
  const hol = d.notes.filter((n) => n.kind === 'holiday').map((n) => `<b>${esc(n.text)}</b>`);
  const other = d.notes.filter((n) => n.kind !== 'holiday').map((n) => esc(n.text));
  const oneOff = d.events.filter((e) => !e.routine);
  const routines = d.events.filter((e) => e.routine).map((e) => `${e.time ? e.time + ' ' : ''}${e.title}`);
  const ev = oneOff.length ? `<div class="dev" data-zone="events">${oneOff.map((e) => `○ ${e.time ? e.time + ' ' : ''}${esc(e.title)}`).join(' · ')}</div>` : '';
  const dateText = `${d.weekdayName.slice(0, 3).toUpperCase()} · ${d.date} · ${G(DAY_PLANET[d.weekday][1])}`;
  const extra = [...hol, ...other];
  const parts = {
    header: headerZone(dateText),
    sky: `<div class="sky1" data-zone="sky">${moon(d.moon.phaseDeg, 14)}<span>${d.moon.lit}% · ${moonTxt} · ${G('☀')} ${d.sun.rise}–${d.sun.set}</span><span class="season">${esc(d.jp.ko.en)}</span></div>`,
    notes: extra.length ? `<div class="sky2l">${extra.join(' · ')}</div>` : '',
    events: ev,
    fact: d.fact ? `<div class="fact" data-zone="fact"><b>On this day</b> ${esc(d.fact)}</div>` : '',
    routines,
  };
  return dayBlocks(parts, DAYPAGE);
}

function weekReview(W) {
  return `<div class="day review"><h3 class="rvh">${W.label} review</h3>
  <div class="rq"><b>What did I do well?</b><div class="lines l2"></div></div>
  <div class="rq"><b>Where did I fall short, and was it about capacity or choice?</b><div class="lines l2"></div></div>
  <div class="rq"><b>What will I change, move forward (&gt;) or drop?</b><div class="lines l2"></div></div>
  <div class="rq"><b>Carry forward</b> <span class="dim">— tasks and threads for next week</span></div><div class="dots log"></div></div>`;
}

function exchange(W, side) {
  const p = W.prompt || 'Anything you want to tell me.';
  return side === 'L'
    ? `<div class="xh"><h2 class="pt">Exchange</h2><span class="dim">${W.label}</span></div><div class="xft"><span>From</span><i></i><span>To</span><i></i><span>Date</span><i></i></div><p class="xp">This week's prompt: <b>${p}</b></p><div class="lines fill"></div>`
    : `<div class="xh"><h2 class="pt">Reply</h2><span class="dim">hand the book back when done</span></div><div class="xft"><span>From</span><i></i><span>Date</span><i></i></div><p class="xp">Answer the prompt, respond to their page, or ask them something.</p><div class="lines fill"></div>`;
}

// ---------- assemble ----------
let REF_THEME = 0;
add('title', titlePage());               // 1 (recto)
add('', `<div class="blankpage"></div>`); // 2
add('', anatomyPage());
add('', keyPage());
add('', `<h2 class="pt">Key, continued</h2><h3>Day page icons</h3><div class="ikey">${ICON_KEY.map(([k, t]) => `<span>${ic(k)} ${t}</span>`).join('')}</div>${weekdayTable()}<h3>Send-to symbols</h3><p class="small">Fire (solid triangle), water (open triangle), air (three winds), earth (circled cross), crescent moon, full moon and pentacle. Fill the bubble above one to route a scan; you decide what each means in your app.</p>`);
add('', carePage()); add('', contactsPage());
REF_THEME = pages.length + 1; add('', themePage());

const monthStartWeek = (M) => D.weeks.find((W) => W.days.some((d) => d.m === M.m && d.y === M.y));
for (const W of D.weeks) {
  const M = D.months.find((M) => monthStartWeek(M) === W);
  if (M) { alignToVerso(); add('', monthCalendar(M)); add('', monthSky(M)); add('', monthTracker(M)); add('', monthMoonPage(M)); }
  alignToVerso();
  add('', weekLeft(W)); add('', weekRight(W));
  const endsHere = W.days[W.days.length - 1].weekday === 0; // the week's Sunday is in this book
  for (const d of W.days) add('dayp', dayFull(d), d.date);
  if (endsHere) { add('', weekReview(W)); alignToVerso(); add('', exchange(W, 'L')); add('', exchange(W, 'R')); } // Exchange (verso) and Reply (recto) must face each other
}
alignToVerso();
add('', `<h2 class="pt">Looking back on the month</h2><div class="boxline">My theme was</div><div class="lines l2"></div><div class="boxline">What the trackers showed me</div><div class="lines l6"></div><div class="boxline">Which parts of this journal I actually used</div><div class="lines l4"></div><div class="boxline">What to change in the next edition</div><div class="lines l6"></div>`);
add('', closingPage());
// Reference section at the back: support, safety plan, bus times, and where each piece comes from.
const REF = { theme: REF_THEME };
REF.support = pages.length + 1; add('', supportPage()); add('', transPage());
REF.safety = pages.length + 1; add('', safetyPage());
if (NET && NET.months[VOL.id]) { alignToVerso(); REF.bus = pages.length + 1; add('', netPage(0)); add('', netPage(1)); for (const g of packGrids(NET.months[VOL.id])) add('', gridPage(g)); }
REF.lineage = pages.length + 1; add('', lineagePage());
for (const p of pages) p.html = p.html.replace(/\{\{P_(\w+)\}\}/g, (_, k) => REF[k.toLowerCase()] ?? '?');
while (pages.length % 2) add('notes', notesPage('Notes'));

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
// Payload: KW1|<book id>|<page no>|<page type>|<date>. Read by Shelbee's own scanning app, not the Rocketbook app.
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
if (HARDCOVER) while (pages.length < 76 || pages.length % 2) add('notes', notesPage('Notes'));
// Page code: Data Matrix with a short payload "KW1|<yymm>|<page>" (16x16 modules). Page type and date come from layout.json.
const pageCode = (i) => `KW1|${VOL.id.slice(2).replace('-', '')}|${String(i + 1).padStart(3, '0')}`;
// Rulings for print: every ruled line, dot grid and 4 mm grid is redrawn as one plain inline SVG per area, same
// geometry as its CSS background. Chromium turns CSS gradients and tiled SVG backgrounds into PDF shadings and image
// patterns that renderers disagree on (poppler: stray/doubled lines, cairo: nothing, mupdf: grey bars), and KDP
// rasterises with its own pipeline. The CSS backgrounds stay for the editor preview; this runs in the page (after
// fonts load, and again from render.mjs before the PDF) and switches them off. Keep the table in sync with the CSS.
// Idempotent. Everything is clipped to the area, so no drawn box pokes past it (check.mjs stays at [] 0).
function drawRulings() {
  const IN = 96, MM = 96 / 25.4;
  const SPECS = [ // first match wins; lines: 1px band at the bottom of each pitch; dots: centres ox + i·pitch, oy + j·pitch
    ['.ru.pd', { dots: 0.22 * IN, ox: 0.11 * IN, oy: 0.2 * IN, r: 0.012 * IN, c: '#999' }],
    ['.ru.pg, .grid.log', { grid: 4 * MM, w: 0.1 * MM, dash: [0.2 * MM, 0.3 * MM], c: '#d6d6d6' }],
    ['.ruled.log', { lines: 0.26 * IN, c: '#999' }],
    ['.ru', { lines: 0.22 * IN, c: '#999' }],
    ['.m .dots', { dots: 5 * MM, ox: 0, oy: 0, r: 0.3 * MM, c: '#DCDCDC' }],
    ['.dots', { dots: 0.17 * IN, ox: 0, oy: 0, r: 0.01 * IN, c: '#555' }],
    ['.genko span', { cross: 0.5, c: '#ddd' }],
  ];
  const f = (v) => +v.toFixed(3);
  const NS = 'http://www.w3.org/2000/svg';
  document.querySelectorAll('svg.vrule').forEach((s) => s.remove());
  const rect = (x0, y0, x1, y1) => `M${f(x0)} ${f(y0)}H${f(x1)}V${f(y1)}H${f(x0)}Z`;
  // A dot as a Bézier circle; one cut by the edge becomes a clipped 32-gon, so the path never leaves the area.
  const dot = (cx, cy, r, W, H) => {
    if (cx - r >= 0 && cy - r >= 0 && cx + r <= W && cy + r <= H) return `M${f(cx - r)} ${f(cy)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0Z`;
    let P = Array.from({ length: 32 }, (_, k) => [cx + r * Math.cos(k * Math.PI / 16), cy + r * Math.sin(k * Math.PI / 16)]);
    for (const [ax, lim, keepLE] of [[0, 0, false], [0, W, true], [1, 0, false], [1, H, true]]) {
      const inside = (p) => (keepLE ? p[ax] <= lim : p[ax] >= lim), out = [];
      P.forEach((p, i) => {
        const q = P[(i + 1) % P.length];
        if (inside(p)) out.push(p);
        if (inside(p) !== inside(q)) { const t = (lim - p[ax]) / (q[ax] - p[ax]); out.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]); }
      });
      P = out;
      if (P.length < 3) return '';
    }
    return 'M' + P.map((p) => `${f(p[0])} ${f(p[1])}`).join('L') + 'Z';
  };
  document.querySelectorAll('.page').forEach((pg) => { const z = parseFloat(getComputedStyle(pg).zoom) || 1; SPECS.forEach(([sel, s]) => pg.querySelectorAll(sel).forEach((el) => {
    if (el.dataset.vrule) return; // already taken by an earlier (more specific) spec
    el.dataset.vrule = '1';
    const cs = getComputedStyle(el), b = el.getBoundingClientRect();
    // the letter book zooms each page; measure in the page's own CSS px, where the backgrounds tile
    const W = b.width / z - parseFloat(cs.borderLeftWidth) - parseFloat(cs.borderRightWidth), H = b.height / z - parseFloat(cs.borderTopWidth) - parseFloat(cs.borderBottomWidth);
    let d = '', attrs = { fill: s.c };
    if (s.lines) for (let y = s.lines; y - 1 < H; y += s.lines) d += rect(0, y - 1, W, Math.min(y, H));
    if (s.cross) d += rect(0, (H - s.cross) / 2, W, (H + s.cross) / 2) + rect((W - s.cross) / 2, 0, (W + s.cross) / 2, H);
    if (s.dots) for (let y = s.oy + Math.ceil((-s.r - s.oy) / s.dots) * s.dots; y - s.r < H; y += s.dots) for (let x = s.ox + Math.ceil((-s.r - s.ox) / s.dots) * s.dots; x - s.r < W; x += s.dots) d += dot(x, y, s.r, W, H);
    if (s.grid) { // dashes restart at every 4 mm tile edge, and 4 mm is a whole number of dash periods, so one line per row/column matches
      const o = s.w / 2;
      for (let y = o; y < H; y += s.grid) d += `M0 ${f(y)}H${f(W)}`;
      for (let x = o; x < W; x += s.grid) d += `M${f(x)} 0V${f(H)}`;
      attrs = { fill: 'none', stroke: s.c, 'stroke-width': f(s.w), 'stroke-dasharray': s.dash.map(f).join(' ') };
    }
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'vrule'); svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('width', f(W)); svg.setAttribute('height', f(H)); svg.setAttribute('viewBox', `0 0 ${f(W)} ${f(H)}`);
    svg.style.cssText = 'position:absolute;left:0;top:0;overflow:hidden;pointer-events:none';
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', d); for (const [k, v] of Object.entries(attrs)) path.setAttribute(k, v);
    svg.appendChild(path);
    if (cs.position === 'static') el.style.position = 'relative';
    el.style.backgroundImage = 'none';
    el.appendChild(svg);
  })); });
  document.querySelectorAll('[data-vrule]').forEach((el) => delete el.dataset.vrule);
}

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
.place { font-size: 7.5pt; color: #444; } .owner { margin-top: 0.6in; font-size: 8pt; color: #444; } .owner .line { display: inline-block; width: 3in; border-bottom: 1px solid #333; height: 0.3in; }
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
.lines { overflow: hidden; } .rule { border-bottom: 1px solid #999; }
.lines.l2 { height: 0.52in; } .lines.l3 { height: 0.78in; } .lines.l4 { height: 1.04in; } .lines.l6 { height: 1.56in; } .lines.l7 { height: 1.82in; }
.fill { flex: 1; min-height: 0.5in; }
/* .dots, .m .dots and .genko backgrounds: print redraws them as vectors in drawRulings() above; keep its SPECS in sync */
.dots { background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='17' height='17' viewBox='0 0 17 17'%3E%3Ccircle cx='8.5' cy='8.5' r='1' fill='%23555'/%3E%3C/svg%3E"); background-size: 0.17in 0.17in; background-position: -0.085in -0.085in; }
.three { margin: 4px 0 0 16px; padding: 0; } .three li { height: 0.34in; border-bottom: 1px solid #999; }
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
.wev { padding-left: 4px; overflow: hidden; position: relative; } .wev .rules { position: absolute; inset: 0 0 0 4px; } .wev .ev, .wev .evs { position: relative; background: #fff; display: inline-block; }
.wd .kj { font-size: 14pt; display: block; line-height: 1.1; } .wd .dt { font-size: 7.6pt; font-weight: 700; }
.wsky { font-size: 7pt; display: flex; flex-direction: column; gap: 1px; } .wsky .ms { display: flex; align-items: center; gap: 3px; }
.wr-top { display: grid; grid-template-columns: 1.25fr 1fr; gap: 0.15in; } .word .wk-k { font-size: 20pt; line-height: 1.2; }
.genko { display: grid; grid-template-columns: repeat(6, 0.26in); gap: 0; margin-top: 4px; } .genko span { width: 0.26in; height: 0.26in; border: 1px solid #999; background: linear-gradient(#ddd, #ddd) center/100% 0.5px no-repeat, linear-gradient(#ddd, #ddd) center/0.5px 100% no-repeat; }
.word p { margin: 2px 0 0; font-size: 7pt; } .prio ol { margin: 0; padding-left: 14px; } .prio li { height: 0.36in; border-bottom: 1px solid #999; }
.hab, .mline { width: 100%; table-layout: fixed; } .hab th { font-family: 'Noto Serif JP', serif; font-size: 8pt; } .hab td { border: 1px solid #999; height: 0.24in; } .hab td.hl, .mline td.hl { width: 0.75in; border: none; border-bottom: 1px solid #999; font-size: 7pt; color: #444; }
.mline td { height: 0.16in; text-align: center; } .mline i { display: inline-block; width: 4px; height: 4px; border-radius: 50%; background: #888; } .mline td.hl { border: none; text-align: right; padding-right: 6px; } .mline tr.zero td { border-top: 1px solid #999; border-bottom: 1px solid #999; } .mline td.dl { font-family: 'Noto Serif JP', serif; font-size: 7pt; }
.halves { gap: 0; } .day { flex: 1; display: flex; flex-direction: column; min-height: 0; } .cut { height: 0; border-top: 1px dashed #999; margin: 0.08in 0; }
.dh { display: grid; grid-template-columns: 0.52in 1.55in 1fr; align-items: center; border-bottom: 1px solid #111; padding-bottom: 3px; }
.dnum { font-size: 26pt; font-weight: 600; line-height: 1; } .dname { font-size: 9.5pt; font-weight: 700; } .djp { font-size: 7pt; } .djp .kj { font-size: 12pt; }
.dsky { display: flex; gap: 5px; align-items: center; font-size: 7pt; line-height: 1.35; justify-content: flex-end; text-align: right; } .dsky svg { order: 2; }
.dko { font-size: 7pt; padding: 3px 0 2px; border-bottom: 1px solid #999; } .dko .jp { font-size: 8pt; } .dn2 { font-style: italic; } .rt { float: right; }
.dev { font-size: 7pt; padding: 2px 0; border-bottom: 1px solid #999; }
.chk, .spn { display: flex; align-items: center; gap: 3px; font-size: 7pt; padding: 3px 0 1px; } .lbl { font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; font-size: 7pt; margin: 0 2px 0 5px; } .lbl:first-child { margin-left: 0; }
.bub { display: inline-flex; } .bub i { width: 9px; height: 9px; border: 1px solid #333; border-radius: 50%; } .bub:nth-child(5) i { border-width: 1.6px; } .end { font-size: 7pt; color: #444; }
.blank { display: inline-block; width: 0.35in; border-bottom: 1px solid #333; height: 9px; } .blank.long { flex: 1; } .spoon { margin: 0 0.5px; } .sp2 { margin-left: 8px; }
.log { flex: 1; min-height: 0.8in; margin-top: 3px; }
.rev { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px; border-top: 1px solid #333; padding-top: 2px; } .rev div { font-size: 7pt; display: flex; flex-direction: column; } .rev b { text-transform: uppercase; letter-spacing: 0.5px; font-size: 7pt; } .rev span { height: 0.42in; overflow: hidden; }
.fact { font-size: 7pt; line-height: 1.25; padding-top: 3px; margin-top: 2px; border-top: 1px dotted #777; font-style: italic; color: #222; } .fact b { font-style: normal; text-transform: uppercase; letter-spacing: 0.5px; margin-right: 3px; }
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
.m .dots { background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='5mm' height='5mm' viewBox='0 0 50 50'%3E%3Ccircle cx='25' cy='25' r='3' fill='%23DCDCDC'/%3E%3C/svg%3E"); background-size: 5mm 5mm; background-position: -2.5mm -2.5mm; }
.m .rule { border-bottom-color: #DCDCDC; }
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
.cutnote { font: 600 7pt Inter, sans-serif; color: #444; margin: -4px 0 0; line-height: 1.1; } .sq { margin-top: 3px; } .sq .lines.l2 { height: 0.46in; } .sq b { font-size: 7.5pt; } .script { margin-top: 3px; border: 1px solid #000; padding: 5px 7px; font-size: 7.5pt; line-height: 1.35; }
.carep { width: 100%; } .carep th { text-align: left; font-size: 7.5pt; border-bottom: 1px solid #333; } .carep td { height: 0.28in; border-bottom: 1px solid #bbb; } .wd .wdn { font-size: 11pt; font-weight: 600; display: block; line-height: 1.1; } .cal .sk { font-size: 7pt; font-style: italic; color: #333; line-height: 1.1; border: none; padding: 0; }
.ztags { grid-column: 1 / -1; }
.sky1 { display: flex; gap: 4px; align-items: center; font-size: 7pt; line-height: 1.25; margin: 2px 0; } .sky1 .season { margin-left: auto; font-style: italic; color: #333; text-align: right; } .sky2l { font-size: 7pt; color: #333; margin: 1px 0 3px; }
.net { width: 100%; table-layout: fixed; border-collapse: collapse; font-size: 7pt; font-variant-numeric: tabular-nums; margin-top: 4px; }
.net th { font: 600 7pt Inter, sans-serif; text-align: left; border-bottom: 1px solid #000; padding: 1px 3px; }
.net td { padding: 1.6px 1.5px; overflow: hidden; letter-spacing: -0.015em; border-bottom: 1px solid #e3e3e3; white-space: nowrap; } .net .rn { font: 700 7.5pt Inter, sans-serif; text-align: right; padding-right: 4px; } .net col.c1 { width: 0.22in; } .net col.c2 { width: 0.66in; }
.net .rname { text-overflow: ellipsis; }
.hg { width: 100%; border-collapse: collapse; font-size: 7pt; font-variant-numeric: tabular-nums; margin-top: 4px; table-layout: fixed; }
.hg th { font: 600 7pt Inter, sans-serif; padding: 1px 2px; text-align: left; } .hg th.gh { border-bottom: 1px solid #000; line-height: 1.15; vertical-align: bottom; } .hg th.gh .dim { font-weight: 400; }
.hg tr.rng td { background: #f1f1f1; } .hg td { padding: 0.4px 2px; line-height: 1.1; border-bottom: 1px solid #e3e3e3; white-space: nowrap; overflow: hidden; } .hg td.hl { font: 600 7pt Inter, sans-serif; text-align: right; padding-right: 5px; } .hg td.hl.pm { font-weight: 800; }
.rt { font: 600 7.5pt Inter, sans-serif; text-transform: uppercase; margin: 6px 0 0; } .hg .gs { border-left: 1px solid #9a9a9a; padding-left: 4px; }
.az { margin-top: 4px; } .cb { display: flex; align-items: center; gap: 6px; height: 0.24in; } .cb i { width: 10px; height: 10px; border: 1.2px solid #000; flex: none; } .cb span { flex: 1; border-bottom: 1px solid #DCDCDC; height: 100%; display: flex; align-items: flex-end; font-size: 7.5pt; padding-bottom: 1px; }
.m .chk .zl, .m .spn .zl { margin-right: 3px; }
.m .lin th, .m .lin td { font-size: 7pt; padding: 2px 6px 2px 0; } .m .lin th { width: 1.1in; } .m .lead { font-size: 7.5pt; } .m .small { font-size: 7pt; }
.m .steps { gap: 0.06in; } .m .steps p { font-size: 7.4pt; } .m .anat .a3 { height: 0.45in; } .m .anat div { font-size: 7pt; padding: 3px 5px; }
.m .cal.rows5 td { height: 0.8in; } .m .cal.rows6 td { height: 0.67in; } .m .trk td { height: 0.14in; } .m .trk th { white-space: nowrap; } .m .trk { font-size: 7pt; } .m .trk .mood i, .m .trk .en i { width: 6px; height: 6px; margin: 0 0.5px; } .m .trk .mood { white-space: nowrap; } .m .trk .bx { width: 0.34in; }
.m .keycols { gap: 0.08in; } .m .phases, .m .gl-list { font-size: 7pt; }
.m .cal + .small { display: none; } .trk .un th { font: 500 5.6pt Inter, sans-serif; color: #444; padding: 0 1px 1px; text-align: left; } .m .mline td { height: 0.12in; } .m .hab td { height: 0.2in; } .m .fill { min-height: 0.25in; } .m .genko { grid-template-columns: repeat(6, 0.22in); } .m .genko span { width: 0.22in; height: 0.22in; } .m .pio { margin-top: 0.06in; }
.m .wrow.other { flex: 0 0 0.22in; } .m .wrow.other .wev { background: none; }
.day.full .log { min-height: 1.2in; } .day.full .rev { margin-top: 4px; } .day.full .rev span { height: 0.44in; }
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
    const zones = [...pg.querySelectorAll('[data-zone]')].map((el) => ({ zone: el.dataset.zone, ...rect(el) }));
    zones.push({ zone: 'page_code', ...rect(pg.querySelector('.qr')) }, { zone: 'send_to', ...rect(pg.querySelector('.strip')) });
    return { page: i + 1, frame_inner_mm: { w: +(fw * px2mm).toFixed(1), h: +(fh * px2mm).toFixed(1) }, zones };
  });
});
const meta = pages.map((p, i) => ({ type: (p.cls || 'page').split(' ')[0] || 'page', date: p.date || null, code: pageCode(i), code_format: 'data_matrix' }));
fs.writeFileSync(`${OUT}/layout.json`, JSON.stringify({ book: VOL.id, trim_in: [TRIM_W, TRIM_H], border_pt: BORDER_PT, quiet_zone_in: QUIET, symbols: ['fire', 'water', 'air', 'earth', 'crescent_moon', 'full_moon', 'pentacle'], pages: layout.map((l, i) => ({ ...meta[i], ...l })) }, null, 1));
await page.pdf({ width: `${TRIM_W}in`, height: `${TRIM_H}in`, path: `${OUT}/keeping-watch-${VOL.id}-interior-${HARDCOVER ? 'hardcover-' : ''}${SIZE_TAG}.pdf`, printBackground: true, preferCSSPageSize: true });
await browser.close();
fs.writeFileSync(`${OUT}/pages${HARDCOVER ? '-hardcover' : ''}.txt`, String(pages.length)); // separate counts, so each cover sizes its own spine
console.log(`book ${VOL.id}: ${D.days[0].date} → ${D.days[D.days.length - 1].date}, ${D.weeks.length} weeks, ${pages.length} pages`);
