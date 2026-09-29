// Books longer than a month (book plan: quarter, season, half-year, year, custom, undated) and their volumes.
// loadSpan() builds the whole span once; contextFor(a, b, meta) makes the page-builder context (see context.mjs) for the days
// [a, b) of it, which is one volume. planVolumes() counts pages with those same contexts and the real page builders, so the split
// it reports is the split the printed books have. Pure data in, no browser.
import { build, busCoverage, groupSpan, sliceDays, GLYPH } from './data.mjs';
import { bookPlan, rangeLabel, splitVolumes, explainSplit, MAX_VOLUMES, MAX_PAGES } from './plan.mjs';
import { normalize } from './daypage.mjs';
import { PROFILE, moduleOn, readContent, ensureBookId } from './profile.mjs';
import { applyModules, readJson } from './context.mjs';
import { assemble, assertBook, entriesFor, normalizeBook } from './book.mjs';
import { loadBook } from './context.mjs';

const pad2 = (n) => String(n).padStart(2, '0');
const wrapAt = (arr, i) => (i >= 0 && i < arr.length ? arr[i] : arr[((i % arr.length) + arr.length) % arr.length]); // a plan longer than the year's content repeats it
export const dayIso = (d) => `${d.y}-${pad2(d.m)}-${pad2(d.d)}`;

// Undated data: numbered days grouped into weeks and months, no calendar, no sky, nothing that needs a date.
function undatedData(u) {
  const days = [], weeks = [], months = [];
  let no = 0;
  for (let w = 0; w < u.weeks; w++) {
    const n = Math.floor(((w + 1) * u.days) / u.weeks) - Math.floor((w * u.days) / u.weeks);
    const W = { n: w + 1, gi: w, no: w + 1, days: [], word: null, undated: true };
    for (let k = 0; k < n; k++) { const d = { no: ++no, undated: true }; W.days.push(d); days.push(d); }
    weeks.push(W);
  }
  for (let j = 0; j < u.months; j++) {
    const startWeek = Math.floor((j * u.weeks) / u.months), endWeek = Math.floor(((j + 1) * u.weeks) / u.months);
    months.push({ n: j + 1, key: pad2(j + 1), name: `Month ${j + 1}`, y: null, m: null, startWeek, undated: true, days: weeks.slice(startWeek, endWeek).flatMap((W) => W.days) });
  }
  return { config: { place: PROFILE.location.place }, days, weeks, months, glyphs: GLYPH, generated: new Date().toISOString() };
}

export async function loadSpan({ ics, quiet = false } = {}) {
  const plan = bookPlan(PROFILE.book);
  if (plan.scope === 'month') throw new Error('book plan: scope is "month"; build monthly books with render.mjs month YYYY-MM');
  const { FACTS, PIONEERS, WORDS, PROMPTS } = await import('./content/year.mjs');
  const undated = plan.scope === 'undated';
  let full, gi0 = 0;
  if (undated) full = undatedData(plan.undated);
  else {
    const [y, m, d] = plan.start.split('-').map(Number);
    full = build(ics, { start: [y, m, d], days: plan.days, id: `span-${plan.start}`, label: rangeLabel(plan.start, plan.end), short: rangeLabel(plan.start, plan.end) }, WORDS);
    for (const day of full.days) day.fact = FACTS[day.date.slice(5)] || null;
    gi0 = groupSpan(full.days, WORDS).weeks[0].gi;
  }
  const N = full.days.length;
  // Where a new volume may start: a month boundary (a month's first day) or a week boundary (a Monday; undated: the first day of a week).
  const cuts = [];
  if (undated) {
    let i = 0;
    full.weeks.forEach((W, wi) => { if (wi) cuts.push({ i, kind: full.months.some((M) => M.startWeek === wi) ? 'month' : 'week' }); i += W.days.length; });
  } else full.days.forEach((d, i) => { if (i && (d.d === 1 || d.weekday === 1)) cuts.push({ i, kind: d.d === 1 ? 'month' : 'week' }); });
  const NET = moduleOn('bus') && PROFILE.paths.transit ? readJson(`./${PROFILE.paths.transit}/network.json`) : null;
  const ki = readJson('./out/keeper/index.json');

  // meta: { n, of, size, count } (a provisional one is enough for counting pages)
  function contextFor(a, b, meta = {}) {
    const first = undated ? null : dayIso(full.days[a]), last = undated ? null : dayIso(full.days[b - 1]);
    const n = meta.n || 1, of = meta.of || 1;
    const label = undated ? `${b - a} days` : rangeLabel(first, last);
    const idBase = undated ? 'undated' : `${plan.scope}-${plan.start.slice(0, 7)}`;
    const VOL = {
      scoped: true, scope: plan.scope, undated, id: `${idBase}-v${n}`, n, of, isFirst: n === 1, isLast: meta.isLast !== undefined ? meta.isLast : n === of, label, short: label, first, last, days: b - a,
      dayFrom: undated ? full.days[a].no : null, dayTo: undated ? full.days[b - 1].no : null,
      bookId: meta.count ? PROFILE.book.id || null : ensureBookId(), // the book's own scan-code id (made once, kept in the profile)
      edge: { before: n === 1 ? 'before this journal starts' : `in volume ${n - 1}`, after: n === of ? 'after this journal ends' : `in volume ${n + 1}` },
    };
    let D;
    if (undated) {
      // whole weeks only: a and b are week starts
      let i = 0; const ws = [];
      for (const W of full.weeks) { if (i >= a && i < b) ws.push(W); i += W.days.length; }
      const ms = full.months.filter((M) => ws.some((W) => full.weeks.indexOf(W) === M.startWeek)).map((M) => ({ ...M }));
      D = { ...full, volume: VOL, days: ws.flatMap((W) => W.days), weeks: ws.map((W) => ({ ...W })), months: ms };
    } else D = sliceDays(full, a, b, VOL, WORDS);
    // A week's pioneer and exchange prompt live in the volume that holds its Thursday (undated: every week has its own)
    for (const W of D.weeks) {
      const ix = undated ? W.no - 1 : W.gi;
      W.no = undated ? W.no : W.gi - gi0 + 1;
      W.owns = undated ? true : W.days.some((d) => d.weekday === 4);
      W.pioneer = W.owns ? wrapAt(PIONEERS, ix) || null : null;
      W.prompt = wrapAt(PROMPTS, ix) || null;
      W.label = `Week ${W.no}`;
    }
    if (!undated) for (const M of D.months) M.key = `${M.y}-${pad2(M.m)}`;
    // Bus pages come from the transit feed's own month: the volume's first covered month
    let BUS_COV = 'none';
    if (!undated && NET) for (const M of D.months) { const c = busCoverage(M.key); if (c !== 'none') { VOL.busMonth = M.key; BUS_COV = c; break; } }
    // The page builders read the profile through ctx.PROFILE: an undated book has no sky, bus times or pay marks to print.
    const P = undated ? { ...PROFILE, modules: { ...PROFILE.modules, sky: false, bus: false, pay_periods: false } } : PROFILE;
    if (!quiet && !meta.count && NET && BUS_COV === 'partial') console.warn(`! ${PROFILE.transit.agency} schedule only partly covers ${VOL.busMonth} (volume ${n}); the pages say so.`);
    return {
      D, VOL, size: meta.size || 'small', hasIcs: !!ics, BUS_COV, NET: undated ? null : NET, PROFILE: P,
      SUPPORT: readContent('support'), TRANS: moduleOn('trans_support') ? readContent('trans') : null, CLINIC: readContent('clinic'),
      keeperPage: undefined, keeperPages: ki && ki.handoff_page ? ki.handoff_page : {}, keeper: plan.keeper, closingPolicy: plan.closing,
      undated, scoped: true, plan,
      dayLayout: applyModules(normalize(readJson('./content/daypage.json'))),
      refs: {},
    };
  }
  return { plan, full, N, cuts, contextFor, undated };
}

// The book layout entries a volume is built from (content/book.json, else the default), checked like render.mjs does.
export function bookEntries(volId) {
  const fileBook = loadBook();
  if (fileBook && Object.keys(fileBook).length) assertBook(fileBook);
  return entriesFor(normalizeBook(fileBook), volId);
}

// The volume plan: how many pages any run of days makes (the real page builders, no rendering), then the split.
// `hardcover`: each volume pads to at least 76 pages, so the limit is the only thing that forces a cut.
export function planVolumes(span, { hardcover = false, limit = MAX_PAGES } = {}) {
  const { plan, N, cuts, contextFor } = span;
  const entries = bookEntries(`${plan.scope}`);
  const countPages = (a, b) => assemble(contextFor(a, b, { count: true, isLast: b === N }), entries, { hardcover, count: true }).pages.length;
  const res = splitVolumes(N, cuts, countPages, limit);
  const of = res.volumes.length;
  if (of > MAX_VOLUMES) throw new Error(`This plan is ${of} volumes; a scan code has room for ${MAX_VOLUMES}. Shorten the span (book.custom) or use a bigger volume trim.`);
  const volumes = res.volumes.map((v, i) => ({ ...v, n: i + 1, of }));
  return { ...res, volumes, why: explainSplit(res, hardcover), hardcover };
}
