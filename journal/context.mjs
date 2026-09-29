// Loads everything the page builders (pages.mjs) need for one monthly book: the month's data, the year's content, the STA
// schedule, the directories, the Keeper's handoff page. This is the only place the page code touches the disk.
//   const ctx = await loadContext({ month: '2026-10', ics: 'test.ics', size: 'small' });
// The editor builds sample pages with the same call on the generic sample calendar (test.ics), never a private one.
import fs from 'node:fs';
import { build, busCoverage } from './data.mjs';
import { normalize } from './daypage.mjs';

const here = (p) => new URL(p, import.meta.url);
const readJson = (p) => (fs.existsSync(here(p)) ? JSON.parse(fs.readFileSync(here(p), 'utf8')) : null);

export async function loadContext({ month, ics, size = 'small', quiet = false }) {
  const [yr, mo] = month.split('-').map(Number);
  const bookNo = (yr - 2026) * 12 + mo - 9; // Oct 2026 = book 1 … Sep 2027 = book 12
  const monthName = new Date(Date.UTC(yr, mo - 1, 1)).toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' });
  // globalContent is kept only so data.json (read by epub.py) stays byte-identical.
  const VOL = { n: bookNo, start: [yr, mo, 1], days: new Date(Date.UTC(yr, mo, 0)).getUTCDate(), label: `${monthName} ${yr}`, short: `${monthName.slice(0, 3)} ${yr}`, globalContent: true, id: `${yr}-${String(mo).padStart(2, '0')}`, month: mo, year: yr };
  // STA bus pages: 'full' (feed covers the whole month), 'partial' (feed ends mid-month) or 'none' (no schedule to print).
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
  const NET = readJson('./gtfs/network.json');
  if (!quiet && NET && BUS_COV === 'partial') console.warn(`! STA schedule ends ${NET.valid_to}; ${VOL.id} is only partly covered (pages say so). Refresh gtfs before printing.`);
  const ki = readJson('./out/keeper/index.json');
  return {
    D, VOL, size, hasIcs: !!ics, BUS_COV, NET,
    SUPPORT: readJson('./content/support.json'), TRANS: readJson('./content/trans.json'), CLINIC: readJson('./content/clinic.json'),
    keeperPage: ki && ki.handoff_page ? ki.handoff_page[VOL.id] : undefined,
    dayLayout: normalize(readJson('./content/daypage.json')),
    refs: {},
  };
}
export const loadBook = () => readJson('./content/book.json');
