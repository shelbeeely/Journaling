// Loads everything the page builders (pages.mjs) need for one monthly book: the month's data, the year's content, the transit
// schedule, the directories, the Keeper's handoff page. This is the only place the page code touches the disk.
//   const ctx = await loadContext({ month: '2026-10', ics: 'test.ics', size: 'small' });
// The editor builds sample pages with the same call on the generic sample calendar (test.ics), never a private one.
import fs from 'node:fs';
import { build, busCoverage } from './data.mjs';
import { normalize } from './daypage.mjs';
import { PROFILE, moduleOn, bookNo as bookNoOf, readContent, MODULE_BLOCKS } from './profile.mjs';

// A switched-off module leaves its day-page blocks out of the layout (they stay in the file, so switching the module back on restores them).
export function applyModules(layout) {
  const off = Object.entries(MODULE_BLOCKS).filter(([m]) => !moduleOn(m)).flatMap(([, types]) => types);
  return off.length ? { ...layout, blocks: layout.blocks.map((b) => (off.includes(b.type) ? { ...b, on: false } : b)) } : layout;
}
const here = (p) => new URL(p, import.meta.url);
export const readJson = (p) => (fs.existsSync(here(p)) ? JSON.parse(fs.readFileSync(here(p), 'utf8')) : null);

export async function loadContext({ month, ics, size = 'small', quiet = false }) {
  const [yr, mo] = month.split('-').map(Number);
  const bookNo = bookNoOf(yr, mo); // the profile's first month = book 1 … its twelfth = book 12 (Oct 2026 … Sep 2027 for Shelbee)
  const monthName = new Date(Date.UTC(yr, mo - 1, 1)).toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' });
  // globalContent is kept only so data.json (read by epub.py) stays byte-identical.
  const VOL = { n: bookNo, start: [yr, mo, 1], days: new Date(Date.UTC(yr, mo, 0)).getUTCDate(), label: `${monthName} ${yr}`, short: `${monthName.slice(0, 3)} ${yr}`, globalContent: true, id: `${yr}-${String(mo).padStart(2, '0')}`, month: mo, year: yr };
  // Bus pages: 'full' (feed covers the whole month), 'partial' (feed ends mid-month) or 'none' (no schedule to print).
  const BUS_COV = busCoverage(VOL.id);
  const { FACTS, PIONEERS, WORDS, PROMPTS } = await import('./content/year.mjs');
  const D = build(ics, VOL, WORDS);
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
  if (!quiet && Object.values(missing).some(Boolean)) console.warn('content gaps:', JSON.stringify(missing));
  const NET = moduleOn('bus') && PROFILE.paths.transit ? readJson(`./${PROFILE.paths.transit}/network.json`) : null;
  if (!quiet && NET && BUS_COV === 'partial') console.warn(`! ${PROFILE.transit.agency} schedule ends ${NET.valid_to}; ${VOL.id} is only partly covered (pages say so). Refresh the transit feed before printing.`);
  const ki = readJson('./out/keeper/index.json');
  return {
    D, VOL, size, hasIcs: !!ics, BUS_COV, NET,
    PROFILE,
    SUPPORT: readContent('support'), TRANS: moduleOn('trans_support') ? readContent('trans') : null, CLINIC: readContent('clinic'),
    keeperPage: ki && ki.handoff_page ? ki.handoff_page[VOL.id] : undefined,
    dayLayout: applyModules(normalize(PROFILE.library.layouts.day || readJson('./content/daypage.json'))),
    refs: {},
  };
}
// A library book can carry its own page structure and day layout (library.mjs layouts); otherwise the project's content/*.json files.
export const loadBook = () => PROFILE.library.layouts.book || readJson('./content/book.json');
