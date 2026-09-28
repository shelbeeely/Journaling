import { SPOKANE } from './spokane.mjs';
import fsBus from 'node:fs';
const BUS = fsBus.existsSync(new URL('./gtfs/route6.json', import.meta.url)) ? JSON.parse(fsBus.readFileSync(new URL('./gtfs/route6.json', import.meta.url))) : null;
// Builds journal data (sky, astrology, Japanese calendar, iCal events) as JSON.
// Usage: node data.mjs [events.ics] > data.json
import * as A from 'astronomy-engine';
import fs from 'node:fs';
import ical from 'node-ical';
import { WEEKDAYS, SEKKI, KO, koIndex, sekkiIndex } from './japanese.mjs';
import { holidays } from './holidays.mjs';
import { payEvents } from './payperiods.mjs';
const PAY = payEvents();

export const CONFIG = {
  place: 'Spokane, WA',
  lat: 47.6588, lon: -117.4260, elevation: 600,
  tz: 'America/Los_Angeles',
};

const SIGNS = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
const GLYPH = { Aries: '♈', Taurus: '♉', Gemini: '♊', Cancer: '♋', Leo: '♌', Virgo: '♍', Libra: '♎', Scorpio: '♏', Sagittarius: '♐', Capricorn: '♑', Aquarius: '♒', Pisces: '♓' };
const norm = (x) => ((x % 360) + 360) % 360;
const signOf = (lon) => SIGNS[Math.floor(norm(lon) / 30)];
const PLANETS = ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];
const obs = new A.Observer(CONFIG.lat, CONFIG.lon, CONFIG.elevation);

// ---- time-zone helpers ----
function tzOffsetMin(date) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: CONFIG.tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(date).map((x) => [x.type, x.value]));
  const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return (asUTC - date.getTime()) / 60000;
}
function localMidnight(y, m, d) {
  let t = Date.UTC(y, m - 1, d, 0, 0);
  t -= tzOffsetMin(new Date(t)) * 60000;
  t = Date.UTC(y, m - 1, d, 0, 0) - tzOffsetMin(new Date(t)) * 60000; // re-check across DST edge
  return new Date(t);
}
const fmtTime = (date) => date.toLocaleTimeString('en-US', { timeZone: CONFIG.tz, hour: 'numeric', minute: '2-digit' }).replace(' AM', 'a').replace(' PM', 'p');
const ymd = (date) => new Intl.DateTimeFormat('en-CA', { timeZone: CONFIG.tz }).format(date);

const moonLon = (d) => A.EclipticGeoMoon(d).lon;
const sunLon = (d) => A.SunPosition(d).elon;
const planetLon = (b, d) => A.Ecliptic(A.GeoVector(b, d, true)).elon;

// Find times inside [t0,t1) where f(t) crosses a multiple of `step` degrees.
function crossings(f, t0, t1, step, samples = 48) {
  const out = [];
  const dt = (t1 - t0) / samples;
  for (let i = 0; i < samples; i++) {
    let a = new Date(+t0 + i * dt), b = new Date(+t0 + (i + 1) * dt);
    const ia = Math.floor(norm(f(a)) / step), ib = Math.floor(norm(f(b)) / step);
    if (ia !== ib) {
      for (let k = 0; k < 30; k++) { const m = new Date((+a + +b) / 2); if (Math.floor(norm(f(m)) / step) === ia) a = m; else b = m; }
      out.push({ time: b, index: ib });
    }
  }
  return out;
}

// Principal phases only on the day the exact moment happens; in-between days get the intermediate name.
function phaseName(deg, quarterToday) {
  if (quarterToday != null) return ['New Moon', 'First Quarter', 'Full Moon', 'Last Quarter'][quarterToday];
  return ['Waxing Crescent', 'Waxing Gibbous', 'Waning Gibbous', 'Waning Crescent'][Math.floor(norm(deg) / 90)];
}

// Approximate peaks of major meteor showers (IMO typical dates; ±1 day year to year).
const METEORS = { '10-08': 'Draconid meteors (peak, approx.)', '10-21': 'Orionid meteors (peak, approx.)', '11-17': 'Leonid meteors (peak, approx.)', '12-14': 'Geminid meteors (peak, approx.)', '12-22': 'Ursid meteors (peak, approx.)', '01-03': 'Quadrantid meteors (peak, approx.)' };

// ---- iCal import ----
function loadEvents(paths, t0, t1) {
  // paths: one .ics path or several joined with commas. Handles recurring events, EXDATE and moved occurrences.
  const byDay = {};
  const list = (paths || '').split(',').map((p) => p.trim()).filter((p) => p && fs.existsSync(p));
  // routine = repeats daily/weekly (rrule freq 2 WEEKLY, 3 DAILY). Routines print as checkboxes on day pages, not on calendars.
  const add = (start, summary, allDay, routine = false) => {
    const key = allDay ? start.toISOString().slice(0, 10) : ymd(start);
    (byDay[key] ||= []).push({ title: String(summary || '(untitled)').replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, '').replace(/\s{2,}/g, ' ').trim(), /* emoji would print as Type 3 fonts */ time: allDay ? '' : fmtTime(start), allDay, routine });
  };
  for (const path of list) {
    const data = ical.sync.parseFile(path);
    for (const ev of Object.values(data)) {
      if (ev.type !== 'VEVENT' || !ev.start) continue;
      const allDay = ev.datetype === 'date';
      if (ev.rrule) {
        const f = ev.rrule.options.freq; const routine = [2, 3, 'WEEKLY', 'DAILY'].includes(f);
        const ex = new Set(Object.keys(ev.exdate || {}).map((k) => k.slice(0, 10)));
        for (const occ of ev.rrule.between(t0, t1, true)) {
          const k = occ.toISOString().slice(0, 10);
          if (ex.has(k)) continue;
          const moved = ev.recurrences && ev.recurrences[k];
          if (moved) { if (moved.start >= t0 && moved.start < t1) add(moved.start, moved.summary || ev.summary, moved.datetype === 'date', routine); continue; }
          add(occ, ev.summary, allDay, routine);
        }
      } else if (ev.start >= t0 && ev.start < t1 && !ev.recurrenceid) add(ev.start, ev.summary, allDay);
    }
  }
  for (const k in byDay) byDay[k].sort((a, b) => (b.allDay - a.allDay) || a.time.localeCompare(b.time));
  return byDay;
}

const HOL = {};
export function build(icsPath, vol, words = []) {
  const [sy, sm, sd] = vol.start;
  const first = localMidnight(sy, sm, sd), last = localMidnight(sy, sm, sd + (vol.days || vol.weeks * 7));
  const events = loadEvents(icsPath, first, last);
  const days = [];
  // Quarter moons across the range
  const quarters = [];
  for (let q = A.SearchMoonQuarter(new Date(+first - 8 * 864e5)); q.time.date < last; q = A.NextMoonQuarter(q)) quarters.push(q);
  // Solstices / equinoxes
  const seasons = [A.Seasons(sy), A.Seasons(sy + 1)].flatMap((s) => [['March equinox', s.mar_equinox], ['June solstice', s.jun_solstice], ['September equinox', s.sep_equinox], ['December solstice', s.dec_solstice]]);

  let prevLon = Object.fromEntries(PLANETS.map((b) => [b, planetLon(b, new Date(+first - 864e5 + 12 * 36e5))]));
  let prevDir = {};
  for (const b of PLANETS) { const l2 = planetLon(b, new Date(+first + 12 * 36e5)); prevDir[b] = ((l2 - prevLon[b] + 540) % 360 - 180) < 0 ? 'R' : 'D'; }

  for (let d = new Date(first), i = 0; d < last; i++) {
    const y = +ymd(d).slice(0, 4), m = +ymd(d).slice(5, 7), dd = +ymd(d).slice(8, 10);
    const start = localMidnight(y, m, dd), end = localMidnight(y, m, dd + 1);
    const noon = new Date((+start + +end) / 2);
    const key = ymd(noon);
    const wd = new Date(Date.UTC(y, m - 1, dd)).getUTCDay();
    const rise = A.SearchRiseSet('Sun', obs, +1, start, 1), set = A.SearchRiseSet('Sun', obs, -1, start, 1);
    const moonrise = A.SearchRiseSet('Moon', obs, +1, start, 1), moonset = A.SearchRiseSet('Moon', obs, -1, start, 1);
    const lengthMin = rise && set ? Math.round((set.date - rise.date) / 60000) : null;
    const phaseDeg = A.MoonPhase(noon);
    const lit = A.Illumination('Moon', noon).phase_fraction;
    const sLon = sunLon(noon);

    const notes = [];
    const qToday = quarters.find((q) => q.time.date >= start && q.time.date < end);
    // Moon & sun sign changes during the day
    const moonIngress = crossings(moonLon, start, end, 30).map((c) => ({ time: fmtTime(c.time), sign: SIGNS[c.index] }));
    const sunIngress = crossings(sunLon, start, end, 30, 24).map((c) => ({ time: fmtTime(c.time), sign: SIGNS[c.index] }));
    const koChange = crossings(sunLon, start, end, 5, 24).map((c) => { const ko = koIndex(c.index * 5 + 0.01); const si = Math.floor(ko / 3); return { time: fmtTime(c.time), ko, kanji: KO[ko][0], en: SPOKANE[ko + 1][0], note: SPOKANE[ko + 1][1], n: ko + 1, sekki: ko % 3 === 0 ? { kanji: SEKKI[si][0], kana: SEKKI[si][1], romaji: SEKKI[si][2], en: SEKKI[si][3] } : null }; });
    for (const q of quarters) if (q.time.date >= start && q.time.date < end) notes.push({ kind: 'moon', text: `${['New Moon', 'First Quarter', 'Full Moon', 'Last Quarter'][q.quarter]} ${fmtTime(q.time.date)}` });
    for (const [name, t] of seasons) if (t.date >= start && t.date < end) notes.push({ kind: 'season', text: `${name} ${fmtTime(t.date)}` });
    const mm = key.slice(5);
    for (const h of (HOL[y] ||= holidays(y))[mm] || []) notes.unshift({ kind: 'holiday', text: h.name, federal: h.federal });
    for (const t of PAY[key] || []) notes.push({ kind: 'pay', text: t });
    if (BUS && BUS.holiday_service.includes(key)) notes.push({ kind: 'bus', text: 'STA: Sunday bus schedule' });
    if (METEORS[mm]) notes.push({ kind: 'sky', text: METEORS[mm] });

    // Retrogrades + stations
    const retro = [], stations = [];
    for (const b of PLANETS) {
      const l1 = planetLon(b, noon), l2 = planetLon(b, new Date(+noon + 864e5));
      const dir = ((l2 - l1 + 540) % 360 - 180) < 0 ? 'R' : 'D';
      if (dir === 'R') retro.push(b);
      if (dir !== prevDir[b]) stations.push(`${b} stations ${dir === 'R' ? 'retrograde' : 'direct'}`);
      prevDir[b] = dir;
    }
    for (const s of stations) notes.push({ kind: 'astro', text: s });

    // Eclipses (none expected Oct–Dec 2026, but computed anyway)
    const lunar = A.SearchLunarEclipse(start);
    if (lunar.peak.date >= start && lunar.peak.date < end) notes.push({ kind: 'sky', text: `${lunar.kind} lunar eclipse ${fmtTime(lunar.peak.date)}` });
    const solar = A.SearchGlobalSolarEclipse(start);
    if (solar.peak.date >= start && solar.peak.date < end) notes.push({ kind: 'sky', text: `${solar.kind} solar eclipse (global) ${fmtTime(solar.peak.date)}` });

    const k = koIndex(sLon), s = sekkiIndex(sLon);
    days.push({
      date: key, y, m, d: dd, weekday: wd,
      weekdayName: new Date(Date.UTC(y, m - 1, dd)).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' }),
      jp: { ...WEEKDAYS[wd], sekki: { i: s, kanji: SEKKI[s][0], kana: SEKKI[s][1], romaji: SEKKI[s][2], en: SEKKI[s][3] }, ko: { i: k, n: k + 1, kanji: KO[k][0], romaji: KO[k][1], en: SPOKANE[k + 1][0], note: SPOKANE[k + 1][1] }, koChange, sekkiStart: koChange.some((c) => c.ko % 3 === 0) },
      sun: { rise: rise ? fmtTime(rise.date) : null, set: set ? fmtTime(set.date) : null, lengthMin, sign: signOf(sLon), glyph: GLYPH[signOf(sLon)], ingress: sunIngress },
      moon: { phaseDeg: +phaseDeg.toFixed(1), phase: phaseName(phaseDeg, qToday ? qToday.quarter : null), quarter: qToday ? qToday.quarter : null, lit: Math.round(lit * 100), waxing: phaseDeg < 180, sign: signOf(moonLon(noon)), glyph: GLYPH[signOf(moonLon(noon))], ingress: moonIngress, rise: moonrise ? fmtTime(moonrise.date) : null, set: moonset ? fmtTime(moonset.date) : null },
      retro, notes, events: events[key] || [],
    });
    d = end;
  }

  // Weeks (Mon–Sun) and months
  // Monday-based weeks. gi = global week index counted from Mon Sep 28 2026 (week 0), shared by every edition.
  const EPOCH = Date.UTC(2026, 8, 28);
  const weeks = [];
  for (const day of days) {
    if (!weeks.length || day.weekday === 1) {
      const monday = Date.UTC(day.y, day.m - 1, day.d) - ((day.weekday + 6) % 7) * 864e5;
      const gi = Math.round((monday - EPOCH) / (7 * 864e5));
      weeks.push({ n: weeks.length + 1, gi, days: [], word: null });
    }
    weeks[weeks.length - 1].days.push(day);
  }
  for (const W of weeks) W.word = words.length ? (vol.globalContent ? words[W.gi] : words[(W.n - 1) % words.length]) || null : null;
  // A month belongs to this volume if its 15th is inside the volume.
  const months = days.filter((x) => x.d === 15).map((x) => ({ y: x.y, m: x.m, name: new Date(Date.UTC(x.y, x.m - 1, 1)).toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' }), days: days.filter((z) => z.y === x.y && z.m === x.m) }));
  return { config: CONFIG, volume: vol, days, weeks, months, glyphs: GLYPH, generated: new Date().toISOString() };
}


