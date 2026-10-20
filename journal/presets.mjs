// Fewer decisions (BUILD-PLAN section 26): the guided start, the ready-made books, the Basic view and what the editor remembers.
// Pure data and functions, no fs and no browser, so the editor inlines this file after daypage.mjs (imports and "export" stripped)
// and the tests run it in Node. Top-level names must not clash with daypage.mjs, content/layouts.mjs or scan.mjs.
//
//   QUESTIONS            the five plain-language questions, each with a recommended answer
//   STARTERS             four complete books (a day layout, a length, modules) the person accepts or tweaks
//   guidedBook(answers)  answers -> { layout, plan, modules, trim, left, used }: a finished day layout, never a blank page
//   BASIC_TYPES          the eight blocks the Basic view offers (Advanced shows all of them; nothing is removed)
//   recOf(option)        the recommended value of a block option: the value it ships with
//   applyPages(book, p)  the page set of a made book: 'full' (every page) or 'calm' (no moon and sky pages, a shorter back of the book)
//   calmLibrary(lib, id, defaultBook)  the library with that book on the calm page set (a layout that hides one back page, see CALM_HIDE)
//   cleanLast(x)         what the editor may remember about the last book (choices only: no calendar, no profile, no pages)
//   GUIDED_STRINGS()     the English words of the tables above, keyed for i18n/en.json (test-presets.mjs checks the catalog has them)
// The layouts are ordinary v2 layouts: they print, scan and pass check.mjs like any other. Every block they use is in daypage.mjs.
import { normalize, defaultLayout, TYPES } from './daypage.mjs';

// ---------- Basic view ----------
export const BASIC_TYPES = ['top', 'timeline', 'checks', 'scale', 'words', 'lines', 'good', 'sketch'];
// How many options a block shows in Basic before "More options"; the order of a block's options already puts the ones people change first.
export const BASIC_OPTS = 3;
// The recommended value of one option (what newBlock gives it): the "Back to recommended" button in the editor sets this.
export const recOf = (o) => (o.def !== undefined ? structuredClone(o.def) : o.kind === 'flags' ? Object.fromEntries(Object.keys(o.items).map((k) => [k, true])) : o.kind === 'bool' ? true : o.kind === 'num' ? o.lo : '');
export const isRec = (o, v) => JSON.stringify(recOf(o)) === JSON.stringify(v);

// ---------- what to track ----------
// One entry per thing the person can choose to track. `rank` is the order things are kept in when a calm page only has room for a few.
// `h` is how much of the page it takes, in inches (measured in the editor preview at both sizes: test-guided.mjs checks them against the real page).
// `b` makes the blocks: [type, uid, options]. The words are the printed labels; they are plain and carry no judgement.
export const TRACK = [
  { id: 'tasks', rank: 1, h: 0.85, b: [['top', 'g-top', { title: 'Top 3', n: 3 }]] },
  { id: 'mood', rank: 2, h: 0.6, b: [['scale', 'g-mood', { title: 'Mood', steps: 5, lo: 'low', hi: 'high' }], ['words', 'g-feel', { title: 'Feeling' }]] },
  { id: 'habits', rank: 3, h: 0.25, b: [['checks', 'g-habits', { title: 'Habits', labels: ['Stretch', 'Outside', 'Read'] }]] },
  { id: 'good', rank: 4, h: 0.5, b: [['good', 'g-good', { label: 'Small good things', n: 2 }]] },
  { id: 'energy', rank: 5, h: 0.25, b: [['scale', 'g-energy', { title: 'Energy', steps: 5, lo: 'low', hi: 'high' }]] },
  { id: 'sleep', rank: 6, h: 0.25, b: [['sleeptimes', 'g-sleep', {}]] },
  { id: 'body', rank: 7, h: 0.25, b: [['checks', 'g-body', { title: 'Body care', labels: ['Meds', 'Water', 'Moved'] }]] },
  { id: 'making', rank: 8, h: 1.3, b: [['sketch', 'g-sketch', { title: '', h: 12, corners: true, caption: '' }]] },
  { id: 'time', rank: 9, h: 0.75, b: [['timeline', 'g-time', { from: 8, to: 20, every: 2 }]] },
  { id: 'calendar', rank: 10, h: 0.55, b: [['notes', 'g-notes', {}], ['events', 'g-events', {}]] },
];
export const TRACK_IDS = TRACK.map((t) => t.id);

// ---------- the questions ----------
// kind 'one' = pick one, 'many' = pick any. `rec` is the recommended answer, shown first and marked. Every option has a hint in plain words.
export const QUESTIONS = [
  { id: 'trim', kind: 'one', rec: 'small', q: 'Which size will you print first?', hint: 'Both sizes are always built, so this only sets the preview.',
    o: [['small', '5.5 × 8.5 in', 'Fits a bag.'], ['letter', '8.5 × 11 in', 'More room for each page.']] },
  { id: 'length', kind: 'one', rec: 'month', q: 'How much time should the book cover?', hint: 'A month is about 80 pages (about 70 with the calm page set). A longer book is cut into volumes of up to 110 pages.',
    o: [['month', 'One month', 'The easiest place to start.'], ['quarter', 'Three months', 'Three volumes, one a month.'], ['half-year', 'Six months', 'Six volumes.'], ['year', 'A year', 'Twelve volumes.'], ['undated', 'Undated, 28 days', 'No dates on the pages. Start on any day, skip days freely.']] },
  { id: 'track', kind: 'many', rec: ['tasks', 'mood', 'good'], q: 'What would you like to keep track of?', hint: 'Pick any. A calm page keeps the first few and tells you what it left off.',
    o: [['tasks', 'Tasks and priorities', 'Three lines for what matters today.'], ['mood', 'Mood and feelings', 'A scale and words to circle.'], ['habits', 'Habits and routines', 'Tick boxes.'], ['good', 'Small good things', 'A few lines at the end of the day.'], ['energy', 'Energy', 'One scale.'], ['sleep', 'Sleep', 'Bed, wake and how it felt.'], ['body', 'Meds and body care', 'Tick boxes.'], ['making', 'Drawing or making', 'A frame to draw or stick things in.'], ['time', 'Planning my hours', 'Hours down the side.'], ['calendar', 'Events and holidays from my calendar', 'Prints only on days that have one.']] },
  { id: 'tone', kind: 'one', rec: 'balanced', q: 'How should the page feel?', hint: 'This sets how much goes on one page.',
    o: [['gentle', 'Gentle', 'Three things at most, with roomy boxes.'], ['balanced', 'Balanced', 'Up to five things.'], ['full', 'Full', 'Everything you picked, as long as it fits.']] },
  { id: 'room', kind: 'one', rec: 'some', q: 'How much room to write?', hint: 'The writing space is whatever is left after your blocks.',
    o: [['lots', 'Lots', 'A big open page.'], ['some', 'Some', 'A good amount.'], ['compact', 'A little', 'More boxes, less blank.']] },
];
export const QUESTION_IDS = QUESTIONS.map((q) => q.id);
export const RECOMMENDED = () => ({ ...Object.fromEntries(QUESTIONS.map((q) => [q.id, structuredClone(q.rec)])), pages: 'full' }); // the page set is not a sixth question: it follows the tone, and the review shows it
const LENGTH_MONTHS = { month: 1, quarter: 3, 'half-year': 6, year: 12 };
const TONE_MAX = { gentle: 3, balanced: 5, full: 99 };
// Inches the blocks may take. A day page has about 5.4 in under its header; this keeps at least 4.2 (lots), 3.2 (some) or 2.2 (a little) for writing.
export const ROOM_BUDGET = { lots: 1.2, some: 2.2, compact: 3.2 };
export const ROOMY_EXTRA = 0.15; // a roomy block (the gentle tone) takes a little more
export const PAGES_PER_MONTH = 80; // a month of this book is 74 to 86 pages (HANDOFF.md)
// The calm page set (BUILD-PLAN section 26.7): the moon and sky pages are left out (module `sky` off), and the back of the book is shorter (the bus
// times pages, module `bus` off, and the "Where each piece comes from" page, hidden by a layout). Safety plan, Support and Closing stay.
// A month of it is about 70 pages (measured on the sample book: 80 become 71, see the plan).
export const PAGES_PER_MONTH_CALM = 70;
export const CALM_MODULES = { sky: false, bus: false };
export const CALM_HIDE = ['lineage']; // page types the calm layout switches off
export const CALM_LAYOUT_ID = 'calm-pages';

const nextMonth = (from = new Date()) => { const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1)); return d.toISOString().slice(0, 7); };

// What a length means in pages, in words a person can use. Dated books are cut into monthly volumes; the undated book is 28 day pages and a few extras.
export function lengthFacts(length, pages = 'full') {
  if (length === 'undated') return { months: 0, volumes: 1, about: null, days: 28 };
  const m = LENGTH_MONTHS[length] || 1;
  return { months: m, volumes: m, about: m * (pages === 'calm' ? PAGES_PER_MONTH_CALM : PAGES_PER_MONTH), days: null };
}

// Clean answers: anything missing or unknown becomes the recommended answer, so a stale or hand-edited remembered answer never breaks the start.
export function cleanAnswers(a = {}) {
  const rec = RECOMMENDED(), out = {};
  for (const q of QUESTIONS) {
    const ok = q.o.map((x) => x[0]), v = a[q.id];
    if (q.kind === 'one') out[q.id] = ok.includes(v) ? v : rec[q.id];
    else { const list = Array.isArray(v) ? v.filter((x) => ok.includes(x)) : rec[q.id]; out[q.id] = TRACK_IDS.filter((x) => list.includes(x)); }
  }
  out.pages = a.pages === 'full' || a.pages === 'calm' ? a.pages : out.tone === 'gentle' ? 'calm' : 'full'; // the page set follows the tone (gentle = calm) unless it was chosen
  out.start = /^\d{4}-(0[1-9]|1[0-2])$/.test(a.start || '') ? a.start : nextMonth();
  return out;
}

// The finished book for a set of answers. `left` lists what was kept off the page to keep it calm (so the review can say so, and Advanced can add it back).
export function guidedBook(answersIn) {
  const a = cleanAnswers(answersIn), pick = TRACK.filter((t) => a.track.includes(t.id));
  const max = TONE_MAX[a.tone], budget = ROOM_BUDGET[a.room];
  const kept = [], left = [];
  let used = 0;
  for (const t of pick) {
    const need = t.h + (a.tone === 'gentle' ? ROOMY_EXTRA * t.b.length : 0); // gentle = roomy boxes
    if (kept.length < max && (used + need <= budget + 1e-9 || !kept.length)) { kept.push(t); used += need; } else left.push(t.id);
  }
  const roomy = a.tone === 'gentle';
  const blocks = [];
  for (const t of kept) for (const [type, uid, o] of t.b) blocks.push({ uid, type, on: true, ...(roomy && TYPES_ROOMY.has(type) ? { roomy: true } : {}), ...o });
  blocks.push({ uid: 'body', type: 'body', on: true, style: 'dots' });
  const layout = normalize({ v: 2, blocks });
  return applyPages({ layout, answers: a, kept: kept.map((t) => t.id), left, used, trim: a.trim, ...planFor(a.length, a.start) }, a.pages);
}
// The page set of a made book. 'calm' leaves out the moon and sky pages and shortens the back of the book (modules sky and bus off; the library
// layout from calmLibrary hides the rest); 'full' is every page, the book as it always was. Other modules the book already has are kept.
export function applyPages(book, pages) {
  const calm = pages === 'calm', modules = { ...(book.modules || {}) };
  for (const k of Object.keys(CALM_MODULES)) { if (calm) modules[k] = CALM_MODULES[k]; else if (modules[k] === CALM_MODULES[k]) delete modules[k]; }
  return { ...book, pages: calm ? 'calm' : 'full', modules, answers: book.answers ? { ...book.answers, pages: calm ? 'calm' : 'full' } : book.answers };
}
// The calm layout (book.json shape): the default book with the pages in CALM_HIDE switched off. Pure; the caller passes the project's default book.
export function calmBook(defaultBook) {
  const b = structuredClone(defaultBook);
  const hide = (list) => { for (const e of list || []) { if (CALM_HIDE.includes(e.type)) e.on = false; if (e.options) { hide(e.options.month); hide(e.options.week); } } };
  hide(b.default);
  return b;
}
// The library with book `bookId` on the calm page set: adds (or refreshes) the layout and points the book at it. No default book given: the modules alone do the work.
export function calmLibrary(lib, bookId, defaultBook) {
  if (!defaultBook) return lib;
  const layouts = (lib.layouts || []).filter((l) => l.id !== CALM_LAYOUT_ID);
  layouts.push({ id: CALM_LAYOUT_ID, name: 'Calm pages', book: calmBook(defaultBook) });
  return { ...lib, layouts, books: lib.books.map((x) => (x.id === bookId ? { ...x, layoutRef: CALM_LAYOUT_ID } : x)) };
}
const TYPES_ROOMY = new Set(['checks', 'scale', 'words', 'sleeptimes']);

// The plan and modules that go with a length. Moon and sky pages are kept off the book unless asked for: fewer pages, fewer things to read.
export function planFor(length, start) {
  const plan = length === 'undated' ? { scope: 'undated', undated: { days: 28, extras: ['theme', 'tracker'] } } : { scope: length === 'month' ? 'month' : length };
  return { plan, start, modules: {} };
}

// ---------- ready-made books ----------
// Each is a complete book: a day layout, a length and what goes with it. Accept it as it is, or open it and change anything.
const sb = (type, uid, o = {}) => ({ uid, type, on: true, ...o });
export const STARTERS = [
  { id: 'daily-planner', icon: 'clock', name: 'Daily planner', blurb: 'Three priorities, the hours of the day, a few tick boxes and a line of thanks.',
    length: 'month', modules: {},
    blocks: [sb('top', 'g-top', { title: 'Top 3', n: 3 }), sb('timeline', 'g-time', { from: 8, to: 20, every: 2 }), sb('checks', 'g-rituals', { title: 'Rituals', labels: ['Morning', 'Shut down'] }), sb('good', 'g-good', { label: 'Small good things', n: 1 }), sb('body', 'body', { style: 'dots' })] },
  { id: 'mood-log', icon: 'heart', name: 'Mood log', blurb: 'How I felt, in a number and in words, with sleep and a few care ticks.',
    length: 'quarter', modules: {},
    blocks: [sb('scale', 'g-mood', { title: 'Mood', steps: 5, lo: 'low', hi: 'high' }), sb('words', 'g-feel', { title: 'Feeling' }), sb('sleeptimes', 'g-sleep'), sb('checks', 'g-body', { title: 'Body care', labels: ['Meds', 'Water', 'Moved'] }), sb('good', 'g-good', { label: 'Small good things', n: 2 }), sb('body', 'body', { style: 'dots' })] },
  { id: 'low-energy', icon: 'spoon', name: 'Low-energy days', blurb: 'Undated pages with a few big boxes: how much energy there is, the basics, and what got done.',
    length: 'undated', modules: { spoons: true },
    blocks: [sb('scale', 'g-energy', { title: 'Energy', steps: 5, lo: 'drained', hi: 'full', roomy: true }), sb('checks', 'g-basics', { title: 'The basics', labels: ['Ate', 'Drank', 'Rested'], roomy: true }), sb('done', 'g-done', { title: 'Done', n: 3 }), sb('good', 'g-good', { label: 'One kind thing', n: 1 }), sb('body', 'body', { style: 'dots' })] },
  { id: 'art-practice', icon: 'box', name: 'Art practice', blurb: 'A frame to draw in, a line about what you noticed, and a tick for showing up.',
    length: 'month', modules: {},
    blocks: [sb('sketch', 'g-sketch', { title: '', h: 16, corners: true, caption: 'today' }), sb('checks', 'g-made', { title: 'Made something', labels: ['Drew', 'Tried something new'] }), sb('lines', 'g-noticed', { title: 'What I noticed', n: 2 }), sb('body', 'body', { style: 'dots' })] },
];
export const STARTER_IDS = STARTERS.map((s) => s.id);
export const starterOf = (id) => STARTERS.find((s) => s.id === id) || null;

// A starter as a finished book, with the person's size and first month (the two things that vary).
export function starterBook(id, { trim = 'small', start } = {}) {
  const s = starterOf(id); if (!s) return null;
  const st = /^\d{4}-(0[1-9]|1[0-2])$/.test(start || '') ? start : nextMonth();
  return { layout: normalize({ v: 2, blocks: structuredClone(s.blocks) }), trim: trim === 'letter' ? 'letter' : 'small', starter: s.id, ...planFor(s.length, st), modules: structuredClone(s.modules), pages: 'full', left: [], kept: s.blocks.map((b) => b.type) };
}
// The answers that would make about the same book (so "tweak" can open the five questions on a starter's choices).
export function starterAnswers(id) {
  const s = starterOf(id); if (!s) return RECOMMENDED();
  const have = new Set(s.blocks.map((b) => b.uid)), track = TRACK.filter((t) => t.b.every(([, u]) => have.has(u))).map((t) => t.id);
  return cleanAnswers({ length: s.length, track, tone: s.id === 'low-energy' ? 'gentle' : 'balanced', room: s.id === 'art-practice' ? 'lots' : 'some', pages: 'full' }); // a ready-made book is the full page set unless asked otherwise
}

// ---------- what the editor remembers ----------
// Choices only, so a new book starts the way the last one did: the answers, the starter if one was used, the day layout's blocks, the length and the
// modules. Never a calendar, a name, a place, a pack, a page or a profile field. The title is not kept (every book gets its own). Size-capped.
export const LAST_VERSION = 1;
export function cleanLast(x) {
  if (!x || typeof x !== 'object' || x.v !== LAST_VERSION) return null;
  const out = { v: LAST_VERSION, answers: cleanAnswers(x.answers || {}) };
  out.answers.start = ''; // a first month is for one book; the next one asks again
  if (x.starter && STARTER_IDS.includes(x.starter)) out.starter = x.starter;
  if (x.layout && Array.isArray(x.layout.blocks)) { // only what a block declares: its uid, type, switch, options (and a care block's rows); anything else is dropped
    const L = normalize({ v: 2, blocks: x.layout.blocks.slice(0, 40) });
    out.layout = { v: 2, blocks: L.blocks.map((b) => { const keep = new Set(['uid', 'type', 'on', 'rows', ...TYPES[b.type].opts.map((o) => o.k)]); return Object.fromEntries(Object.entries(b).filter(([k]) => keep.has(k))); }) };
  }
  if (x.plan && typeof x.plan === 'object') { const sc = ['month', 'quarter', 'half-year', 'year', 'undated'].includes(x.plan.scope) ? x.plan.scope : 'month'; out.plan = sc === 'undated' ? { scope: sc, undated: { days: 28, extras: ['theme', 'tracker'] } } : { scope: sc }; }
  if (x.modules && typeof x.modules === 'object') out.modules = Object.fromEntries(['sky', 'spoons', 'therapy', 'bus'].filter((k) => (k === 'bus' ? x.modules[k] === false : typeof x.modules[k] === 'boolean')).map((k) => [k, x.modules[k]])); // bus only as "off": a bus feed is somebody's own place
  if (x.trim === 'letter' || x.trim === 'small') out.trim = x.trim;
  const s = JSON.stringify(out);
  return s.length <= 16000 ? out : null;
}
// The remembered choices for a book that was just made (what cleanLast keeps).
export const lastOf = ({ answers, starter, layout, plan, modules, trim }) => cleanLast({ v: LAST_VERSION, answers, starter, layout, plan, modules, trim });

// ---------- the words ----------
// English only here; the editor looks every one up in the catalog (guided.d_*), so a language can translate them.
export const snk = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
export function GUIDED_STRINGS() {
  const s = {};
  for (const q of QUESTIONS) {
    s[`guided.d_q_${snk(q.id)}`] = q.q; s[`guided.d_q_${snk(q.id)}_hint`] = q.hint;
    for (const [v, t, h] of q.o) { s[`guided.d_o_${snk(q.id)}_${snk(v)}`] = t; s[`guided.d_o_${snk(q.id)}_${snk(v)}_hint`] = h; }
  }
  for (const st of STARTERS) { s[`guided.d_starter_${snk(st.id)}_name`] = st.name; s[`guided.d_starter_${snk(st.id)}_blurb`] = st.blurb; }
  return s;
}
// A new book's day layout, when there is nothing to start from: the original page.
export const genericStart = () => ({ layout: defaultLayout('day'), trim: 'small', plan: { scope: 'month' }, modules: {} });
