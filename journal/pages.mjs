// Page builders: every page of a book as a pure function (data + options -> HTML), shared by the print build (render.mjs)
// and the page editor (editor/), the way daypage.mjs is for the day page. No fs, no process: everything a page needs comes
// in through `ctx` (see context.mjs, which loads it) so the same code runs in Node and in a browser.
//   ctx = { D, VOL, size: 'small'|'letter', hasIcs, BUS_COV, NET, PROFILE, SUPPORT, TRANS, CLINIC, keeperPage, dayLayout, refs }
// PROFILE is content/profile.json (see profile.mjs): the person, the book's title, the place, the module switches. Nothing personal lives in this file.
// `refs` maps {{P_x}} names to page numbers; the book assembler fills it before any page is built, and replaces the
// {{P_x}} markers in the finished HTML. Page numbers are never hand-set.
import { ic, box, spoon, actionZone, dayBlocks } from './daypage.mjs';
import { handoffHtml, GOOD_SPOON_NOTE } from './handoff.mjs';

export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const G = (g) => `<span class="gl">${g}︎</span>`; // text-style astro glyph (never emoji)
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const DAY_PLANET = [['Sun', '☉'], ['Moon', '☽'], ['Mars', '♂'], ['Mercury', '☿'], ['Jupiter', '♃'], ['Venus', '♀'], ['Saturn', '♄']]; // by JS weekday
export const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
export const PLANET_GLYPH = { Mercury: '☿', Venus: '♀', Mars: '♂', Jupiter: '♃', Saturn: '♄', Uranus: '♅', Neptune: '♆', Pluto: '♇' };

// ---------- small SVG parts ----------
export function moon(deg, size = 18) {
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
export const ICON_KEY = [['pill', 'Meds'], ['am', 'Morning dose'], ['pm', 'Evening dose'], ['prn', 'As needed (write the time)'], ['meal', 'Meals'], ['snack', 'Snack'], ['shower', 'Shower'], ['teeth', 'Teeth'], ['joy', 'Did something I enjoy'], ['text', 'Texted someone'], ['low', 'Mood −3 … +3 (0 = steady)'], ['anx', 'Anxiety 0–3'], ['sleep', 'Sleep hours'], ['work', 'Work shift'], ['spoon', 'Spoons left (counted on the X4)'], ['x4', 'Kept on the X4, not on this page'], ['coin', 'Payday'], ['well', 'Went well'], ['hard', 'Was hard'], ['next', 'Tomorrow']];
const bubbles = (labels, lo, hi) => `<span class="end">${lo}</span>` + labels.map(() => `<span class="bub"><i></i></span>`).join('') + `<span class="end">${hi}</span>`;
const dur = (min) => `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, '0')}m`;
const ruby = (k, r) => `<ruby>${k}<rt>${r}</rt></ruby>`;

// AI-scan zones: labelled header boxes, faint body grid, checkbox action items.
export function headerZone(dateText, titleText = '') {
  return `<div class="hz"><div class="zbox zdate" data-zone="date"><span class="zl">DATE:</span><span class="zv">${dateText}</span></div><div class="zbox ztitle" data-zone="title"><span class="zl">TITLE:</span><span class="zv">${titleText}</span></div><div class="zbox ztags" data-zone="tags"><span class="zl">TAGS:</span></div></div>`;
}

export const notesPage = (title) => `${headerZone('', title)}<div class="dots fill" data-zone="body"></div>${actionZone(4)}`;
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



// ---------- the page builders, bound to one book's data ----------
// Each builder takes only data + options and returns HTML. They live in one closure so they can share the small helpers
// (`tc`, `wkRange` ...) and read the book's context once.
export function createPages(ctx) {
  const { D, VOL, BUS_COV, NET, SUPPORT, TRANS, CLINIC, PROFILE } = ctx;
  const mod = (m) => !!PROFILE.modules[m], TRANSIT = PROFILE.transit || {}, BOOK = PROFILE.book, LOC = PROFILE.location;
  const coords = `${Math.abs(LOC.lat).toFixed(2)}° ${LOC.lat >= 0 ? 'N' : 'S'}, ${Math.abs(LOC.lon).toFixed(2)}° ${LOC.lon < 0 ? 'W' : 'E'}`;
  const ICS = ctx.hasIcs;
function titlePage() {
  return `<div class="title">
    <div class="tmoon">${moon(90, 64)}${moon(180, 64)}${moon(270, 64)}</div>
    <h1>${esc(BOOK.title)}</h1>
    <p class="sub">${esc(BOOK.subtitle)}</p>
    <p class="range">Book ${VOL.n} of 12 · ${VOL.label}</p>
    ${mod('sky') ? `<p class="place">Sky data for ${esc(D.config.place)} · ${coords} · ${esc(LOC.timezone_name)}</p>` : ''}
    <p class="built">Built ${D.generated.slice(0, 10)}</p>
    <p class="owner">This journal belongs to<br><span class="line"></span></p>
  </div>`;
}

function lineagePage() {
  return `<h2 class="pt">Where each piece comes from</h2>
  <p class="lead">Every part of this journal is borrowed from a method people used for centuries. The history shows one lesson: methods die when they get complicated. <b>Skip anything, any day.</b> A blank box is data too.</p>
  <table class="lin">${LINEAGE.filter(([a]) => a !== 'Spoons' || mod('spoons')).map(([a, b]) => `<tr><th>${a}</th><td>${b}</td></tr>`).join('')}</table>
  <p class="small">Daily “On this day” facts come from the Computer History Museum’s This Day in History and Wikipedia’s date pages. Pioneer profiles are checked against each person’s Wikipedia article.</p>
  <p class="small">Astrology here is a reflection prompt, not a forecast. The astronomy (sunrise, sunset, moon phase, solstice) is real and calculated for ${esc(D.config.place)}.</p>${busLine()}`;
}

function anatomyPage() {
  return `<h2 class="pt">How to use it</h2>
  <div class="steps">
    <div><h3>Each book</h3><p>Pick a <b>theme</b>${ctx.refs.theme ? ' (page {{P_THEME}})' : ''}. Carry it over from last month or start a new one.</p></div>
    <div><h3>Each month</h3><p>${mod('sky') ? 'Calendar, a sky &amp; seasons list, a one-page tracker, and a new-moon / full-moon page.' : 'Calendar and a one-page tracker.'}</p></div>
    <div><h3>Each week</h3><p>A two-page spread to plan, a word of the week to copy, a weekly review, and an <b>exchange spread</b> to hand to someone.</p></div>
    <div><h3>Each day</h3><p>A full page. ${mod('sky') ? 'Header is pre-filled with the sky. ' : ''}Circle your mood, tick meds and meals. Rapid-log anything. Answer three evening questions.</p></div>
  </div>
  <h3 class="h3b">Anatomy of a day</h3>
  <div class="anat"><div><b class="zl">DATE / TITLE / TAGS</b> printed date; write a title and tags in the boxes</div><div>${mod('sky') ? '<b class="zl">SKY + CHECK-IN</b> moon, sun, season; circle mood, tick meds and meals' : '<b class="zl">CHECK-IN</b> circle mood, tick meds and meals'}</div><div class="a3"><b class="zl">BODY</b> faint 5 mm dots: write anything</div><div><b class="zl">ACTION ITEMS</b> one task per checkbox</div><div><b class="zl">REVIEW</b> went well · was hard · tomorrow</div></div><p class="small" style="margin-top:5px"><b>At the back:</b> ${['Support p. {{P_SUPPORT}}', 'Safety plan p. {{P_SAFETY}}', ctx.refs.bus && 'Bus times p. {{P_BUS}}', ctx.refs.lineage && 'Where each piece comes from p. {{P_LINEAGE}}'].filter(Boolean).join(' · ')}</p><h3 class="h3b">Scanning pages</h3><p class="small">Every page has a black frame, seven “send to” bubbles and a small square page code (a Data Matrix) that says which book and page it is. Fill a bubble to route the scan (you choose what each shape means in your scanning app). Keep the frame and the page code clear of ink. These markers are made for your own app; the Rocketbook app won’t read them.</p>`;
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
      <p class="small"><b>Mood</b> −3 very low · 0 steady · +3 very high/wired${mod('spoons') ? `<br><b>Spoons</b> ${spoon()} the X4 counts the spoons you have <b>left</b>. A <b>good-spoon day</b> ends with 4 or more left.` : ''}</p>
      <p class="small lives"><b>What lives where.</b> Paper is the record: meds, meals, water, mood, work shift, routines, events, writing and the safety plan. The X4 takes the counting: spoons left, sleep, anxiety and shower, teeth, joy, texted, snack. Your own check-ins are on both. If they differ, trust the book.</p>
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
// route that runs every 20+ minutes (frequent routes are covered by the summary). Packed into GRID_PAGE_BUDGET pages.
const GRID_PRIORITY = TRANSIT.priority_routes || []; // profile transit.priority_routes: your routes get grids first
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
const shortStop = (n) => (TRANSIT.short_stops || []).reduce((t, [from, to]) => t.replace(from, to), tc(n || '')).replace(/ \(.*?\)/g, '');
function busMeta() {
  const E = NET.months[VOL.id];
  const ymd = (s) => `${s.slice(4, 6).replace(/^0/, '')}/${s.slice(6).replace(/^0/, '')}/${s.slice(2, 4)}`;
  const until = new Date(Date.UTC(+NET.valid_to.slice(0, 4), +NET.valid_to.slice(4, 6) - 1, +NET.valid_to.slice(6))).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const from = new Date(Date.UTC(+NET.valid_from.slice(0, 4), +NET.valid_from.slice(4, 6) - 1, +NET.valid_from.slice(6))).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const startsLate = `${NET.valid_from.slice(0, 4)}-${NET.valid_from.slice(4, 6)}` === VOL.id && NET.valid_from.slice(6) !== '01';
  const valid = BUS_COV === 'partial' ? `<p class="busvalid">${startsLate ? `Schedule starts ${from} · check ${TRANSIT.site} before` : `Schedule valid through ${until} · check ${TRANSIT.site} after`}</p>` : '';
  return { E, valid, note: `${TRANSIT.agency} schedule ${ymd(NET.valid_from)}–${ymd(NET.valid_to)}.` };
}
function netPage(part) {
  const { E, note, valid } = busMeta();
  const ids = Object.keys(E.summary).filter((r) => NET.routes[r]).sort((a, b) => parseInt(NET.routes[a].n) - parseInt(NET.routes[b].n));
  const half = Math.ceil(ids.length / 2), mine = part === 0 ? ids.slice(0, half) : ids.slice(half);
  const cell = (x) => x ? `${x.span.replace(/:00/g, '')}${x.every ? ` <b>${x.every === 7.5 ? '7–8' : x.every}</b>` : ''}` : '<span class="dim">no service</span>';
  const rows = mine.map((r) => `<tr><td class="rn">${esc(NET.routes[r].n)}</td><td class="rname">${esc(NET.routes[r].name)}</td>${DAY3.map(([k]) => `<td>${cell(E.summary[r][k])}</td>`).join('')}</tr>`).join('');
  return `<h2 class="pt">${part === 0 ? `${TRANSIT.agency} at a glance` : `${TRANSIT.agency} at a glance, cont.`}</h2>${valid}<p class="small">First–last bus, then <b>minutes between buses</b> at midday.</p>
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
const gridRoutes = (routeIds) => routeIds.map((r) => NET.routes[r].n).join(', ');
function gridPage(routeIds) {
  const { E, note, valid } = busMeta();
  return `<div class="xh"><h2 class="pt">Bus times</h2><span class="dim">routes ${esc(gridRoutes(routeIds))} · minutes past the hour</span></div>${valid}
  ${routeIds.map((r) => gridTable(E, r)).join('')}
  <p class="small">Shaded rows like <b>8–10a</b> repeat the same minutes each hour. ${note}</p>`;
}

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
  <p class="small lives"><b>Paper:</b> meds, meals, water, mood, work · <b>X4:</b> spoons, sleep, anxiety, ticks</p>
  <h3>My meds</h3>
  <table class="carep"><tr><th>Name</th><th>When</th><th>What it’s for</th></tr>${rows(4, [1, 2, 3])}</table>
  <h3>What helps on hard days</h3><div class="lines l2"></div>
  ${clinicBox()}
  <p class="small"><b>If it gets bad:</b> call or text <b>988</b>, or text HOME to 741741. Support is on <b>p. {{P_SUPPORT}}</b>, your safety plan on <b>p. {{P_SAFETY}}</b>.</p>`;
}

function dirPage(title, intro, data) {
  const chip = (t) => t.split(' ').filter(Boolean).map((x) => `<span class="chip${x === 'TEXT' ? ' tx' : ''}">${x}</span>`).join('');
  return `<h2 class="pt">${title}</h2><p class="small">${intro}</p>
  ${data.map(([h, items]) => `<h3 class="sh">${h}</h3>${items.map(([n, d, c]) => `<div class="sup"><div class="sn"><b>${n}</b>${chip(c)}</div><div class="sd">${d}</div></div>`).join('')}`).join('')}`;
}
const busLine = () => mod('bus') && BUS_COV === 'none' ? `<div class="busbox"><b>Bus times:</b> ${TRANSIT.site} or the ${TRANSIT.app}</div>` : '';
const supportPage = () => dirPage('Support', '<span class="chip tx">TEXT</span> means you can text instead of talking. Emergency: <b>911</b>. 988’s LGBTQ+ “press 3” option ended July 2025. Checked Sep 2026.', SUPPORT);
const transPage = () => dirPage('Trans support', `For trans people in ${LOC.city} and ${LOC.region}. <span class="chip tx">TEXT</span> means you can message instead of calling. Checked Sep 2026.`, TRANS);
// Last page of each monthly book: the handoff to the Keeper (page numbers from out/keeper/index.json).
function closingPage() {
  const kp = ctx.keeperPage; // Keeper handoff page for this book (out/keeper/index.json), if the Keeper is built
  const nd = new Date(Date.UTC(VOL.year, VOL.month, 1)), nextName = nd.toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' });
  const dim = new Date(Date.UTC(VOL.year, VOL.month, 0)).getUTCDate();
  const st = (l, u) => `<div class="qf"><span>${l}</span><i></i><span class="u">${u}</span></div>`;
  const step = (t) => `<div class="cbl2"><i></i><span>${t}</span></div>`;
  return `<h2 class="pt">Closing ${VOL.label}</h2>
  <p class="small">Do this with your Keeper open${kp ? ` to <b>page ${kp}</b>` : ''}, before starting ${nextName}. About 15 minutes.</p>
  <h3 class="sh">1 · Total the month</h3>
  ${handoffHtml({ omit: mod('spoons') ? [] : ['spoons'], trackerPage: ctx.refs.tracker ? '{{P_TRACKER}}' : 0, caption: (tag, where) => `<p class="src"><b>${tag}</b> · ${where}</p>`, grid: (h) => `<div class="qg">${h}</div>`, cell: st })}
  ${mod('spoons') ? `<p class="small">${GOOD_SPOON_NOTE}</p>` : ''}
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
  ${q(5, `Professionals and crisis lines: my therapist, my prescriber; ${PROFILE.crisis.lines.join('; ')}`)}
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
  // Paper items only (mood, meds, meals, work hours). Spoons, sleep, anxiety and care ticks are counted on the X4.
  const rows = M.days.map((d) => `<tr><td class="dn">${d.d}</td><td class="kj">${DAY_LETTERS[(d.weekday + 6) % 7]}</td><td class="mc">${moon(d.moon.phaseDeg, 8)}</td><td class="mood">${[-3, -2, -1, 0, 1, 2, 3].map(() => '<i></i>').join('')}</td><td class="bx"></td><td class="bx"></td><td class="bx"></td></tr>`).join('');
  return `<h2 class="pt">${M.name} · tracker</h2>
  <table class="trk" data-zone="tracker_grid"><tr><th colspan="3"></th><th>${ic('low')} mood ${ic('high')}</th><th>${ic('pill', 'Meds')}</th><th>${ic('meal', 'Meals')}</th><th>${ic('work', 'Work')}</th></tr><tr class="un"><th colspan="3"></th><th>−3 … <b>0</b> … +3</th><th>tick</th><th>0–3</th><th>hrs</th></tr>${rows}</table>
  <p class="small trn" data-zone="tracker_note">${ic('x4', 'X4')} Spoons, sleep, anxiety and care ticks: X4 → This month. Mood: one dot. Meds: tick when all doses are taken.</p>`;
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
const wk = (W) => String(W.gi + 1).padStart(2, '0'); // week number in page ids: week.03.left
const wkRange = (W) => { const f = W.days[0], l = W.days[W.days.length - 1]; return `${MONTHS[f.m - 1].slice(0, 3)} ${f.d} – ${MONTHS[l.m - 1].slice(0, 3)} ${l.d}`; }; // the week's days in this book
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
  return `<div class="whead" data-zone="week_header"><h2 class="pt">${W.label}</h2><span class="dim">${wkRange(W)}</span></div>${rows}`;
}

function weekRight(W) {
  const days = DAY_LETTERS;
  const grid = (label) => `<tr><td class="hl">${label}</td>${days.map(() => '<td></td>').join('')}</tr>`;
  return `<div class="wr-top"><div class="word" data-zone="words"><h3>Words to keep</h3><p class="dim">A line worth copying out this week: a quote, a lyric you heard, something someone said.</p><div class="lines l3" data-pitch="0.24"></div></div>
  <div class="prio" data-zone="priorities"><h3>${W.label}</h3><ol><li></li><li></li><li></li></ol></div></div>
  <h3>Habits &amp; theme</h3>
  <table class="hab" data-zone="habits"><tr><th></th>${days.map((x) => `<th>${x}</th>`).join('')}</tr>${grid('')}${grid('')}${grid('')}${grid('work hours')}</table>
  <h3>Mood line</h3>
  <table class="mline" data-zone="mood_line">${[3, 2, 1, 0, -1, -2, -3].map((v) => `<tr class="${v === 0 ? 'zero' : ''}"><td class="hl">${v > 0 ? '+' + v : v}</td>${days.map(() => '<td><i></i></td>').join('')}</tr>`).join('')}<tr><td></td>${days.map((x) => `<td class="dl">${x}</td>`).join('')}</tr></table>
  ${pioneerCard(W)}
  ${W.pioneer && ctx.size !== 'letter' ? '' : '<h3>Notes</h3><div class="dots fill" data-zone="notes"></div>'}`;  // letter has room under the pioneer card; the small page is full
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
    day: { date: d.date, rise: d.sun.rise, set: d.sun.set }, // Tier 2 blocks: the 24 h line's night, the look-back date, the rotating prompt
  };
  return dayBlocks(parts, ctx.dayLayout);
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
    ? `<div class="xh"><h2 class="pt">Exchange</h2><span class="dim">${W.label} · ${wkRange(W)}</span></div><div class="xft" data-zone="exchange_from"><span>From</span><i></i><span>To</span><i></i><span>Date</span><i></i></div><p class="xp" data-zone="prompt">This week's prompt: <b>${p}</b></p><div class="lines fill" data-zone="body"></div>`
    : `<div class="xh"><h2 class="pt">Reply</h2><span class="dim">${W.label} · ${wkRange(W)}</span></div><div class="xft" data-zone="exchange_from"><span>From</span><i></i><span>Date</span><i></i></div><p class="xp" data-zone="prompt">Answer the prompt, respond to their page, or ask them something. Hand the book back when done.</p><div class="lines fill" data-zone="body"></div>`;
}

  return {
    titlePage, lineagePage, anatomyPage, keyPage, weekdayTable, carePage, contactsPage, safetyPage, themePage, closingPage,
    supportPage, transPage, netPage, gridPage, packGrids, gridRoutes,
    monthCalendar, monthSky, monthTracker, monthMoonPage, weekLeft, weekRight, dayFull, weekReview, exchange,
    wk, wkRange,
  };
}

// ---------- page types: what book.json can list ----------
// scope: 'book' (once), 'month' (once per month in the book, before that month's first week) or 'week' (once per week).
// `build(ctx, at)` returns the page specs for one entry: [{ id, type, label, cls, date, shared, html }]. `id` is the stable
// page id (never a position), `type` is the layout.json type, `html` is built lazily (after page numbers are known).
// align: 'verso' means the entry's first page must open on a left-hand page, so a Notes page is added before it when needed.
// ref: the {{P_x}} name that points at this entry's first page. protected: can be moved but never hidden.
// module: a profile module switch (profile.mjs MODULES); with it off the entry is left out of the book, so no page refers to it.
const cache = new WeakMap();
const pagesFor = (ctx) => cache.get(ctx) || cache.set(ctx, createPages(ctx)).get(ctx);
const one = (o) => [{ cls: '', date: '', shared: false, label: '', ...o }];
const wkId = (W) => String(W.gi + 1).padStart(2, '0');
export const PAGE_TYPES = {
  title: { name: 'Title page', scope: 'book', build: (ctx) => one({ cls: 'title', type: 'title', id: 'title', label: ctx.PROFILE.book.title, html: () => pagesFor(ctx).titlePage() }) },
  blank: { name: 'Blank page', scope: 'book', build: () => one({ type: 'blank', id: 'blank', shared: true, html: () => '<div class="blankpage"></div>' }) },
  anatomy: { name: 'How to use it', scope: 'book', build: (ctx) => one({ type: 'anatomy', id: 'anatomy', label: 'How to use it', html: () => pagesFor(ctx).anatomyPage() }) },
  key: { name: 'Key', scope: 'book', build: (ctx) => one({ type: 'key', id: 'key', label: 'Key', shared: true, html: () => pagesFor(ctx).keyPage() }) },
  key_2: { name: 'Key, continued', scope: 'book', build: (ctx) => one({ type: 'key', id: 'key.2', label: 'Key, continued', shared: true, html: () => { const P = pagesFor(ctx); return `<h2 class="pt">Key, continued</h2><h3>Day page icons</h3><div class="ikey">${ICON_KEY.map(([k, t]) => `<span>${ic(k)} ${t}</span>`).join('')}</div>${P.weekdayTable()}<h3>Send-to symbols</h3><p class="small">Fire (solid triangle), water (open triangle), air (three winds), earth (circled cross), crescent moon, full moon and pentacle. Fill the bubble above one to route a scan; you decide what each means in your app.</p>`; } }) },
  care_plan: { name: 'Care plan', scope: 'book', build: (ctx) => one({ type: 'care', id: 'care_plan', label: 'Care plan', html: () => pagesFor(ctx).carePage() }) },
  contacts: { name: 'Quick contacts', scope: 'book', build: (ctx) => one({ type: 'contacts', id: 'contacts', label: 'Quick contacts', shared: true, html: () => pagesFor(ctx).contactsPage() }) },
  theme: { name: 'Season theme', scope: 'book', ref: 'theme', build: (ctx) => one({ type: 'theme', id: 'theme', label: 'Season theme', html: () => pagesFor(ctx).themePage() }) },
  month_cal: { name: 'Month calendar', scope: 'month', align: 'verso', build: (ctx, { M }) => one({ type: 'month_cal', id: 'month.calendar', label: `${M.name} ${M.y}`, html: () => pagesFor(ctx).monthCalendar(M) }) },
  month_sky: { name: 'Sky & seasons', scope: 'month', module: 'sky', build: (ctx, { M }) => one({ type: 'month_sky', id: 'month.sky', label: `${M.name} · sky & seasons`, html: () => pagesFor(ctx).monthSky(M) }) },
  month_tracker: { name: 'Month tracker', scope: 'month', ref: 'tracker', build: (ctx, { M }) => one({ type: 'month_tracker', id: 'month.tracker', label: `${M.name} · tracker`, html: () => pagesFor(ctx).monthTracker(M) }) },
  month_moon: { name: 'Moon pages', scope: 'month', module: 'sky', build: (ctx, { M }) => one({ type: 'month_moon', id: 'month.moon', label: `${M.name} · moon pages`, html: () => pagesFor(ctx).monthMoonPage(M) }) },
  week_left: { name: 'Week plan (left)', scope: 'week', align: 'verso', build: (ctx, { W }) => one({ type: 'week_left', id: `week.${wkId(W)}.left`, label: `${W.label} · ${pagesFor(ctx).wkRange(W)}`, html: () => pagesFor(ctx).weekLeft(W) }) },
  week_right: { name: 'Week plan (right)', scope: 'week', build: (ctx, { W }) => one({ type: 'week_right', id: `week.${wkId(W)}.right`, label: W.label, html: () => pagesFor(ctx).weekRight(W) }) },
  days: { name: 'Day pages', scope: 'week', build: (ctx, { W }) => W.days.map((d) => ({ cls: 'dayp', type: 'dayp', id: `day.${d.date}`, label: d.date, date: d.date, shared: false, html: () => pagesFor(ctx).dayFull(d) })) },
  // The review and the exchange spread go after the week's Sunday. The year's last week (Sep 27–Oct 3 2027, week 53) ends after the final book, so it gets them in this one.
  week_review: { name: 'Week review', scope: 'week', when: 'weekEnd', build: (ctx, { W }) => one({ type: 'week_review', id: `week.${wkId(W)}.review`, label: `${W.label} review`, html: () => pagesFor(ctx).weekReview(W) }) },
  week_exchange: { name: 'Exchange + Reply', scope: 'week', when: 'weekEnd', align: 'verso', // Exchange (verso) and Reply (recto) must face each other
    build: (ctx, { W }) => [
      { cls: '', date: '', shared: false, type: 'exchange_l', id: `week.${wkId(W)}.exchange`, label: `Exchange · ${W.label}`, html: () => pagesFor(ctx).exchange(W, 'L') },
      { cls: '', date: '', shared: false, type: 'exchange_r', id: `week.${wkId(W)}.reply`, label: `Reply · ${W.label}`, html: () => pagesFor(ctx).exchange(W, 'R') }] },
  month_review: { name: 'Looking back on the month', scope: 'book', align: 'verso', build: () => one({ type: 'month_review', id: 'month_review', label: 'Looking back on the month', shared: true, html: () => `<h2 class="pt">Looking back on the month</h2><div class="boxline">My theme was</div><div data-zone="review_theme" class="lines l2"></div><div class="boxline">What the trackers showed me</div><div data-zone="review_trackers" class="lines l6"></div><div class="boxline">Which parts of this journal I actually used</div><div data-zone="review_used" class="lines l4"></div><div class="boxline">What to change in the next edition</div><div data-zone="review_change" class="lines l6"></div>` }) },
  closing: { name: 'Closing the month', scope: 'book', protected: true, build: (ctx) => one({ type: 'closing', id: 'closing', label: `Closing ${ctx.VOL.label}`, html: () => pagesFor(ctx).closingPage() }) },
  support: { name: 'Support', scope: 'book', protected: true, ref: 'support', build: (ctx) => one({ type: 'support', id: 'support', label: 'Support', shared: true, html: () => pagesFor(ctx).supportPage() }) },
  trans_support: { name: 'Trans support', scope: 'book', module: 'trans_support', build: (ctx) => one({ type: 'trans', id: 'trans_support', label: 'Trans support', shared: true, html: () => pagesFor(ctx).transPage() }) },
  safety: { name: 'My safety plan', scope: 'book', protected: true, ref: 'safety', build: (ctx) => one({ type: 'safety', id: 'safety', label: 'My safety plan', shared: true, html: () => pagesFor(ctx).safetyPage() }) },
  // Bus pages exist only with the bus module on and a schedule feed that covers the book (none: a one-line note on the lineage page instead).
  bus: { name: 'Bus times', scope: 'book', align: 'verso', ref: 'bus', module: 'bus', build: (ctx) => {
    if (!ctx.NET || ctx.BUS_COV === 'none') return [];
    const P = pagesFor(ctx);
    return [
      { cls: '', date: '', shared: false, type: 'bus', id: 'bus.net.1', label: `${ctx.PROFILE.transit.agency} at a glance`, html: () => P.netPage(0) },
      { cls: '', date: '', shared: false, type: 'bus', id: 'bus.net.2', label: `${ctx.PROFILE.transit.agency} at a glance, cont.`, html: () => P.netPage(1) },
      ...P.packGrids(ctx.NET.months[ctx.VOL.id]).map((g, gi) => ({ cls: '', date: '', shared: false, type: 'bus_grid', id: `bus.grid.${gi + 1}`, label: `Bus times · routes ${P.gridRoutes(g)}`, html: () => P.gridPage(g) }))];
  } },
  lineage: { name: 'Where each piece comes from', scope: 'book', ref: 'lineage', build: (ctx) => one({ type: 'lineage', id: 'lineage', label: 'Where each piece comes from', html: () => pagesFor(ctx).lineagePage() }) },
  // A page the reader adds: a header + dot grid to write on. Padding pages (numbered by position) are made the same way.
  notes: { name: 'Notes page', scope: 'book', options: { title: { kind: 'text', label: 'Title', max: 40 } },
    build: (ctx, { entry }) => { const t = (entry && entry.options && entry.options.title) || 'Notes'; return one({ cls: 'notes', type: 'notes', id: entry ? entry.id : 'notes', label: t, html: () => notesPage(t) }); } },
};

// Render one page of any type from a context (the editor uses this with sample data): the finished page HTML, with page
// references filled from ctx.refs. `at` is {M}, {W} or {} for the type's scope; a multi-page entry (bus, days, exchange) gives all its pages.
export function renderPages(type, ctx, at = {}) {
  const T = PAGE_TYPES[type];
  if (!T) throw new Error(`Unknown page type "${type}". Known: ${Object.keys(PAGE_TYPES).join(', ')}`);
  const refs = ctx.refs || (ctx.refs = {});
  return T.build(ctx, at).map((s) => ({ ...s, html: fillRefs(s.html(), refs) }));
}
export const fillRefs = (html, refs) => html.replace(/\{\{P_(\w+)\}\}/g, (_, k) => refs[k.toLowerCase()] ?? '?');
