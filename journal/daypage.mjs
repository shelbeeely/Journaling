// Day page layout: the blocks of a monthly day page, their order and options.
// Shared by render.mjs (print) and the page editor (editor/), so the editor preview is the real page.
// The layout lives in content/daypage.json; anything missing falls back to DEFAULT_LAYOUT.
// Fixed, never in the layout: the DATE/TITLE/TAGS header (top) and the scan frame + SEND TO strip (bottom).

export const IC = {
  pill: '<rect x="1.3" y="4" width="9.4" height="4" rx="2" transform="rotate(-35 6 6)"/><path d="M6 3.1 L6 8.9" transform="rotate(-35 6 6)"/>',
  am: '<circle cx="6" cy="6" r="2.3"/><path d="M6 .8V2.2M6 9.8v1.4M.8 6h1.4M9.8 6h1.4M2.3 2.3l1 1M8.7 8.7l1 1M2.3 9.7l1-1M8.7 3.3l1-1"/>',
  pm: '<path d="M8.6 1.6A4.6 4.6 0 1 0 10.4 8 3.7 3.7 0 0 1 8.6 1.6Z"/>',
  prn: '<circle cx="6" cy="6" r="4.6"/><path d="M6 3.4V6l1.8 1.2"/>',
  meal: '<circle cx="6.6" cy="6.4" r="3.4"/><path d="M1.4 1.4v3.4M.6 1.4v2.4a.8.8 0 0 0 1.6 0V1.4M1.4 4.8v5.8"/>',
  snack: '<path d="M6 3.6c-1.4-1-4-.6-4 2.2 0 2.4 1.6 4.6 3 4.6.5 0 .7-.3 1-.3s.5.3 1 .3c1.4 0 3-2.2 3-4.6 0-2.8-2.6-3.2-4-2.2Z"/><path d="M6 3.6c0-1.2.6-2 1.6-2.4"/>',
  shower: '<path d="M2 11V3.2A2 2 0 0 1 4 1.2h1.4a2 2 0 0 1 2 2V4"/><path d="M5.2 4h4.4"/><path d="M5.8 6v.4M7.4 6v.4M9 6v.4M5.4 8v.4M7.2 8v.4M9.2 8v.4"/>',
  teeth: '<path d="M3.2 1.6c-1.4 0-2 1.2-2 2.6 0 2 .8 3 1.2 5.4.2 1 .5 1.4.9 1.4.7 0 .8-2.6 1.4-3.2.3-.3.3-.3.6 0 .6.6.7 3.2 1.4 3.2.4 0 .7-.4.9-1.4.4-2.4 1.2-3.4 1.2-5.4 0-1.4-.6-2.6-2-2.6-1 0-1.4.6-2.3.6s-1.3-.6-2.3-.6Z" transform="translate(.8 0)"/>',
  joy: '<path d="M6 1.2 7.2 4.8 10.8 6 7.2 7.2 6 10.8 4.8 7.2 1.2 6 4.8 4.8Z"/>',
  text: '<path d="M1.4 2.2h9.2v6H5.4L2.8 10.4V8.2H1.4Z"/><path d="M3.6 4.6h4.8M3.6 6.2h3"/>',
  sleep: '<path d="M1 10V3.4M1 7.6h10V10M1 6.2h2.6a1.2 1.2 0 0 0 0-2.4H1"/><path d="M5 6.2V5a1.2 1.2 0 0 1 1.2-1.2H9.8A1.2 1.2 0 0 1 11 5v2.6"/>',
  work: '<rect x="1" y="3.6" width="10" height="7" rx="1"/><path d="M4 3.6V2.2h4v1.4M1 6.8h10"/>',
  spoon: '<path d="M 6.03 0.69 C 7.51 0.69 8.14 2.02 8.14 3.26 8.14 4.51 7.12 5.45 6.42 5.92 L 6.81 10.75 Q 6.81 11.69 6.03 11.69 5.25 11.69 5.25 10.75 L 5.64 5.92 C 4.94 5.45 3.92 4.51 3.92 3.26 3.92 2.02 4.55 0.69 6.03 0.69Z"/>',
  low: '<circle cx="6" cy="6" r="4.8"/><path d="M4.1 8.2c1.1-1 2.7-1 3.8 0"/><path d="M4.3 4.6v.4M7.7 4.6v.4"/>',
  high: '<circle cx="6" cy="6" r="4.8"/><path d="M3.9 6.8c1.1 1.3 3.1 1.3 4.2 0"/><path d="M4.3 4.3v.4M7.7 4.3v.4"/>',
  anx: '<path d="M.8 6c1-2 1.8-2 2.6 0s1.6 2 2.6 0 1.6-2 2.6 0 1.6 2 2.6 0"/>',
  calm: '<path d="M.8 6h10.4"/>',
  well: '<path d="M1.8 6.4 4.6 9.2 10.2 2.8"/>',
  hard: '<path d="M1.2 10.2 4.4 3.2 6.6 6.4 8 4.6 10.8 10.2Z"/>',
  next: '<path d="M1.4 6h8.4M6.8 3l3 3-3 3"/>',
  water: '<path d="M6 1.2C4.4 3.6 2.6 5.6 2.6 7.6a3.4 3.4 0 0 0 6.8 0C9.4 5.6 7.6 3.6 6 1.2Z"/>',
  heart: '<path d="M6 10.4 1.9 6.4A2.4 2.4 0 0 1 6 3a2.4 2.4 0 0 1 4.1 3.4Z"/>',
  cloud: '<path d="M3.6 9.6a2.6 2.6 0 0 1-.4-5.2 3.2 3.2 0 0 1 6 .6 2.3 2.3 0 0 1 .2 4.6Z"/>',
  rain: '<path d="M3.6 7.4a2.3 2.3 0 0 1-.3-4.6 2.9 2.9 0 0 1 5.4.5 2 2 0 0 1 .2 4.1Z"/><path d="M4 9v1.6M6.2 9v1.6M8.4 9v1.6"/>',
  snow: '<path d="M6 1.2v9.6M1.8 3.6l8.4 4.8M1.8 8.4l8.4-4.8"/>',
  smoke: '<path d="M1.2 4.2c1.4-1.2 2.6-1.2 4 0s2.6 1.2 4 0M2.4 7.2c1.4-1.2 2.6-1.2 4 0s2.6 1.2 4 0M1.2 10.2c1.4-1.2 2.6-1.2 4 0s2.6 1.2 4 0"/>',
  bus: '<rect x="2" y="1.4" width="8" height="8" rx="1.4"/><path d="M2 5.6h8M3.6 9.4v1.4M8.4 9.4v1.4"/><circle cx="4" cy="7.5" r=".4"/><circle cx="8" cy="7.5" r=".4"/>',
  coin: '<circle cx="6" cy="6" r="4.8"/><path d="M7.6 4.2c-.4-.6-1-.8-1.6-.8-.9 0-1.6.5-1.6 1.2 0 1.6 3.4.9 3.4 2.6 0 .7-.8 1.2-1.8 1.2-.7 0-1.3-.3-1.7-.8M6 2.4v1M6 8.4v1.2"/>',
  clock: '<circle cx="6" cy="6" r="4.8"/><path d="M6 3.2V6l2 1.4"/>',
  ear: '<path d="M3.2 4.6a3 3 0 0 1 6 0c0 1.8-1.6 2.4-1.8 3.8-.2 1.2-.8 2-2 2-.8 0-1.4-.5-1.6-1.2"/><path d="M5 5a1.2 1.2 0 0 1 2.4 0c0 .8-.8 1-.9 1.8"/>',
  eye: '<path d="M.8 6s2-3.6 5.2-3.6S11.2 6 11.2 6 9.2 9.6 6 9.6.8 6 .8 6Z"/><circle cx="6" cy="6" r="1.6"/>',
  people: '<circle cx="4.2" cy="4" r="1.8"/><circle cx="8.4" cy="4.6" r="1.4"/><path d="M1 10.4a3.2 3.2 0 0 1 6.4 0M7.2 7.6a2.6 2.6 0 0 1 3.8 2.4"/>',
  hand: '<path d="M4 10.6 2.2 7.4a1 1 0 0 1 1.7-1l.9 1.2V2.4a.9.9 0 0 1 1.8 0v3.2-1a.9.9 0 0 1 1.8 0v1.4a.9.9 0 0 1 1.6.4v2.8a2.4 2.4 0 0 1-2.4 2.4Z"/>',
  bolt: '<path d="M6.8 1 2.6 6.8h3.2L5 11l4.4-6H6.2Z"/>',
  pen: '<path d="M8.2 1.6 10.4 3.8 4 10.2l-2.8.6.6-2.8Z"/><path d="M7 2.8l2.2 2.2"/>',
  list: '<path d="M4.2 3h6.4M4.2 6h6.4M4.2 9h6.4"/><circle cx="1.8" cy="3" r=".5"/><circle cx="1.8" cy="6" r=".5"/><circle cx="1.8" cy="9" r=".5"/>',
  sprout: '<path d="M6 11V5.6"/><path d="M6 6.4C6 3.8 4.2 2.4 1.6 2.4c0 2.6 1.8 4 4.4 4ZM6 5.6c0-2.2 1.6-3.6 4.4-3.6 0 2.4-1.8 3.6-4.4 3.6Z"/>',
  flag: '<path d="M2.4 11V1.4M2.4 1.8h7l-1.6 2.6 1.6 2.6h-7"/>',
  box: '<rect x="1.4" y="1.4" width="9.2" height="9.2" rx="1"/>',
  log: '<circle cx="2" cy="2.6" r=".6" fill="currentColor"/><circle cx="2" cy="6" r="1.1"/><path d="M1 9.4h2M4.8 2.6h6M4.8 6h6M4.8 9.4h6"/>',
  dots: '<circle cx="3.2" cy="3.2" r="2"/><circle cx="8.8" cy="3.2" r="2"/><circle cx="3.2" cy="8.8" r="2"/><circle cx="8.8" cy="8.8" r="2"/><circle cx="3.2" cy="3.2" r="2" fill="currentColor"/><path d="M8.8 6.8a2 2 0 0 1 0 4Z" fill="currentColor"/>',
};
export const ic = (k, t = '') => `<svg class="ic" width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.15" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="${t || k}">${IC[k]}</svg>`;
export const box = (label) => `<span class="ck"><i></i>${label ? `<span>${label}</span>` : ''}</span>`;
export const spoon = () => `<svg class="spoon" width="7" height="15" viewBox="0 0 7 15"><path d="M3.5 .5C5.4 .5 6.2 2.2 6.2 3.8 6.2 5.4 4.9 6.6 4 7.2L4.5 13.4Q4.5 14.6 3.5 14.6 2.5 14.6 2.5 13.4L3 7.2C2.1 6.6.8 5.4.8 3.8.8 2.2 1.6.5 3.5.5Z" fill="none" stroke="#333" stroke-width="1" stroke-linejoin="round"/></svg>`;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// 3+ routines collapse into one wrapping row of tick boxes (max 6, then "+N more"), so a busy day keeps its writing space.
export const ROUTINE_ROWS = 2, ROUTINE_MAX = 6;
export function actionZone(n, pre = []) {
  const zl = '<div class="zl">ACTION ITEMS:</div>', blank = '<div class="cb"><i></i><span></span></div>';
  if (pre.length <= ROUTINE_ROWS) {
    const blanks = Math.max(1, n - pre.length);
    return `<div class="az" data-zone="action_items">${zl}${pre.map((t) => `<div class="cb pre"><i></i><span>${esc(t)}</span></div>`).join('')}${Array(blanks).fill(blank).join('')}</div>`;
  }
  const more = pre.length - ROUTINE_MAX;
  return `<div class="az" data-zone="action_items">${zl}<div class="cbi">${pre.slice(0, ROUTINE_MAX).map((t) => `<span class="ci"><i></i><span>${esc(t)}</span></span>`).join('')}${more > 0 ? `<span class="more">+${more} more</span>` : ''}</div>${Array(Math.max(1, n - ROUTINE_ROWS)).fill(blank).join('')}</div>`;
}


// ======================= block library (layout v2) =======================
// A layout is an ordered list of block instances: { uid, type, on, ...options }.
// "single" types appear at most once (they carry the day's data); the rest can be added as often as you like.
// Option kinds: num {lo,hi} · bool · choice {choices:[[value,label]]} · flags {items:{key:label}} · text {max} · list {max}.

export const CARE_ROWS = {
  meds: { name: 'Meds', icon: 'pill', items: { am: 'Morning', pm: 'Evening', prn: 'As needed' } },
  meals: { name: 'Meals', icon: 'meal' },
  self_care: { name: 'Self-care', icon: 'shower', items: { shower: 'Shower', teeth: 'Teeth', joy: 'Did something I enjoy', text: 'Texted someone' } },
  work: { name: 'Sleep & work', icon: 'sleep' },
  checkin: { name: 'Mood', icon: 'high' },
  anxiety: { name: 'Anxiety', icon: 'anx' },
  water: { name: 'Water', icon: 'water' },
};
export const REVIEW_ITEMS = { well: 'Went well', hard: 'Was hard', next: 'Tomorrow' };
const DEFAULT_ROWS = [
  { id: 'meds', on: true, items: { am: true, pm: true, prn: true } },
  { id: 'meals', on: true, meals: 3, snack: true },
  { id: 'self_care', on: true, items: { shower: true, teeth: true, joy: true, text: true } },
  { id: 'work', on: true, sleep: true, work: true },
  { id: 'checkin', on: true, steps: 7 },
  { id: 'anxiety', on: true },
  { id: 'water', on: false, count: 8 },
];
export const ROW_OPTS = {
  meds: [{ k: 'items', kind: 'flags', label: 'Boxes', items: CARE_ROWS.meds.items, icons: true }],
  meals: [{ k: 'meals', kind: 'num', label: 'Meal boxes', lo: 1, hi: 4 }, { k: 'snack', kind: 'bool', label: 'Snack box' }],
  self_care: [{ k: 'items', kind: 'flags', label: 'Boxes', items: CARE_ROWS.self_care.items, icons: true }],
  work: [{ k: 'sleep', kind: 'bool', label: 'Sleep hours' }, { k: 'work', kind: 'bool', label: 'Work shift' }],
  checkin: [{ k: 'steps', kind: 'choice', label: 'Scale', choices: [[5, '5 steps'], [7, '7 steps']] }],
  anxiety: [],
  water: [{ k: 'count', kind: 'num', label: 'Glasses', lo: 4, hi: 10 }],
};

const T = (label, def, max = 40) => ({ k: 'title', kind: 'text', label, def, max });
const N = (k, label, lo, hi, def) => ({ k, kind: 'num', label, lo, hi, def });
const B = (k, label, def = true) => ({ k, kind: 'bool', label, def });
const LST = (k, label, def, max = 10) => ({ k, kind: 'list', label, def, max });
const PITCH = { k: 'pitch', kind: 'choice', label: 'Line spacing', choices: [[5.6, 'Tight 5.6 mm'], [6.6, 'Standard 6.6 mm'], [8.5, 'Wide 8.5 mm']], def: 5.6 };
const OMR = B('omr', 'Scan-ready (larger marks)', false);
const PAPER = { k: 'paper', kind: 'choice', label: 'Paper', choices: [['lines', 'Lines'], ['dots', 'Dot grid'], ['grid', '4 mm grid']], def: 'lines' };

// group: where the block sits in the "Add blocks" palette.
export const TYPES = {
  // ---- from your day (single) ----
  sky: { name: 'Moon, sun & season', group: 'From your day', icon: 'pm', single: true, hint: 'Moon phase, sunrise–sunset, Spokane micro-season', opts: [] },
  notes: { name: 'Holidays & notes', group: 'From your day', icon: 'flag', single: true, hint: 'Prints only on days that have one', opts: [] },
  events: { name: 'Events', group: 'From your day', icon: 'clock', single: true, hint: 'One-off calendar events (days with events)', opts: [] },
  actions: { name: 'Action items', group: 'From your day', icon: 'well', single: true, hint: 'Routines from your calendar fill in first', opts: [N('count', 'Lines', 1, 6, 3), B('routines', 'Pre-fill routines')] },
  fact: { name: 'On this day', group: 'From your day', icon: 'pen', single: true, hint: 'One line of history', opts: [] },
  review: { name: 'Went well · Was hard · Tomorrow', group: 'From your day', icon: 'next', single: true, hint: 'Short review columns', opts: [{ k: 'items', kind: 'flags', label: 'Columns', items: REVIEW_ITEMS, icons: true }] },
  body: { name: 'Writing space', group: 'Writing', icon: 'pen', single: true, locked: true, hint: 'Takes whatever room is left', opts: [{ k: 'style', kind: 'choice', label: 'Paper', choices: [['dots', 'Dot grid'], ['lines', 'Lines'], ['bold', 'Bold lines'], ['grid', '4 mm grid'], ['grid37', '3.7 mm grid'], ['blank', 'Blank']], def: 'dots' }, B('secretLine', 'Secret line', false)] },
  // ---- check-ins ----
  care: { name: 'Care check-in', group: 'Check-ins', icon: 'pill', single: true, hint: 'Meds, meals, self-care, mood: two columns', opts: [] },
  spoons: { name: 'Spoons', group: 'Check-ins', icon: 'spoon', single: true, hint: 'Cross off as you use them', opts: [N('count', 'How many', 6, 16, 12)] },
  checks: { name: 'Checkboxes', group: 'Check-ins', icon: 'box', hint: 'Your own tick boxes · also on X4', opts: [T('Label', 'Habits', 24), LST('labels', 'Boxes', ['Stretch', 'Outside', 'Read'], 8)] },
  scale: { name: 'Scale', group: 'Check-ins', icon: 'bolt', hint: 'Circle a number between two words · also on X4', opts: [T('Label', 'Energy', 18), N('steps', 'Steps', 3, 10, 5), { k: 'lo', kind: 'text', label: 'Left word', def: 'low', max: 10 }, { k: 'hi', kind: 'text', label: 'Right word', def: 'high', max: 10 }] },
  words: { name: 'Words to circle', group: 'Check-ins', icon: 'list', hint: 'Circle the ones that fit today', opts: [T('Label', 'Feeling', 18), LST('words', 'Words', ['calm', 'tired', 'anxious', 'content', 'flat', 'overwhelmed', 'hopeful', 'irritable', 'proud', 'lonely'], 14)] },
  sensory: { name: 'Sensory load', group: 'Check-ins', icon: 'ear', hint: 'How loud was the world today, 0–3', opts: [{ k: 'items', kind: 'flags', label: 'Senses', items: { sound: 'Sound', light: 'Light', crowd: 'Crowds', touch: 'Touch', smell: 'Smell', social: 'Social', temp: 'Temperature', move: 'Movement' }, def: { sound: true, light: true, crowd: true, touch: true, smell: false, social: false, temp: false, move: false } }] },
  sleeptimes: { name: 'Sleep times', group: 'Check-ins', icon: 'sleep', single: true, hint: 'Bed, wake and how it felt', opts: [B('quality', 'Quality scale')] },
  habits: { name: 'Habit dots', group: 'Check-ins', icon: 'dots', hint: 'One circle each: leave empty, half-fill or fill · also on X4', opts: [T('Label', 'Habits', 24), LST('labels', 'Habits', ['Stretch', 'Outside', 'Read', 'Water'], 8), B('tiny', 'Legend: half = tiny', false)] },
  fields: { name: 'Fill-in blanks', group: 'Check-ins', icon: 'pen', hint: 'Label + a blank to write a number or word · also on X4', opts: [T('Label', 'Outside', 18), LST('labels', 'Blanks', ['Minutes outside', 'Steps'], 6)] },
  weather: { name: 'Weather & air', group: 'Check-ins', icon: 'cloud', single: true, hint: 'Circle the sky; high, low and air quality', opts: [B('aqi', 'Air quality (smoke season)')] },
  // ---- writing ----
  lines: { name: 'Lined notes', group: 'Writing', icon: 'pen', hint: 'A label and a few lines', opts: [T('Label', 'Notes'), N('n', 'Lines', 1, 8, 2), PAPER, PITCH] },
  bullets: { name: 'Quick bullets', group: 'Writing', icon: 'log', hint: 'Ruled rows with a bullet spot; optional key', opts: [T('Label', 'Log', 24), N('n', 'Rows', 2, 10, 5), B('key', 'Key strip')] },
  good: { name: 'Small good things', group: 'Writing', icon: 'heart', hint: 'Short lines for good moments', opts: [{ k: 'label', kind: 'text', label: 'Label', def: 'Small good things', max: 24 }, N('n', 'Lines', 1, 5, 3), B('because', 'Add "because"', false)] },
  split: { name: 'Two columns', group: 'Writing', icon: 'list', hint: 'Two labelled columns side by side', opts: [{ k: 'left', kind: 'text', label: 'Left', def: 'Morning', max: 18 }, { k: 'right', kind: 'text', label: 'Right', def: 'Evening', max: 18 }, N('n', 'Lines', 1, 8, 3), PAPER, PITCH] },
  top: { name: 'Top priorities', group: 'Writing', icon: 'flag', hint: 'Numbered lines', opts: [T('Label', 'Top 3', 18), N('n', 'How many', 1, 6, 3), N('bubbles', 'Time circles (each circle = 15 min)', 0, 8, 0), B('est', 'Guess / took columns', false), B('carried', 'Carried column', false)] },
  sketch: { name: 'Sketch box', group: 'Writing', icon: 'box', hint: 'An empty frame to draw or stick things in', opts: [T('Label', ''), N('h', 'Height (tenths of an inch)', 5, 30, 12), B('corners', 'Tape marks', false), { k: 'caption', kind: 'text', label: 'Caption', def: '', max: 30 }] },
  // ---- planning ----
  timeline: { name: 'Time blocks', group: 'Planning', icon: 'clock', single: true, hint: 'Hours down the side to plan the day', opts: [N('from', 'From (hour, 24h)', 0, 14, 8), N('to', 'To (hour, 24h)', 1, 24, 22), { k: 'every', kind: 'choice', label: 'Every', choices: [[1, '1 hour'], [2, '2 hours']], def: 2 }, B('actual', 'Actual column', false), N('replan', 'Re-plan columns', 0, 2, 0)] },
  shift: { name: 'Work shift', group: 'Planning', icon: 'work', single: true, hint: 'In, out, break and a line for notes', opts: [N('n', 'Note lines', 0, 3, 1)] },
  bus: { name: 'Bus plan', group: 'Planning', icon: 'bus', single: true, hint: 'Route, stop, leave and back', opts: [N('n', 'Trips', 1, 3, 1)] },
  money: { name: 'Spending', group: 'Planning', icon: 'coin', single: true, hint: 'What and how much', opts: [N('n', 'Rows', 2, 8, 4)] },
  reach: { name: 'Reach out', group: 'Planning', icon: 'people', single: true, hint: 'People to text or check on', opts: [N('n', 'Names', 1, 4, 2)] },
  // ---- layout ----
  divider: { name: 'Divider', group: 'Layout', icon: 'calm', hint: 'A thin line', opts: [{ k: 'icon', kind: 'choice', label: 'Icon', choices: [['none', 'None'], ['sun', 'Sun'], ['moon', 'Moon']], def: 'none' }] },
  spacer: { name: 'Space', group: 'Layout', icon: 'box', hint: 'Empty room', opts: [N('h', 'Height (tenths of an inch)', 1, 10, 2)] },
};

// Ready-made blocks for the palette: a type plus starting options.
export const PRESETS = [
  { type: 'lines', name: 'A moment I felt like me', opts: { title: 'A moment I felt like me', n: 2 }, group: 'Writing' },
  { type: 'lines', name: "Tomorrow's first step", opts: { title: "Tomorrow's first step", n: 1 }, group: 'Writing' },
  { type: 'lines', name: 'Words to keep', opts: { title: 'Words to keep', n: 2 }, group: 'Writing' },
  { type: 'lines', name: 'What I ate', opts: { title: 'What I ate', n: 2 }, group: 'Check-ins' },
  { type: 'checks', name: 'HRT & body care', opts: { title: 'Body care', labels: ['HRT', 'Moisturise', 'Stretch'] }, group: 'Check-ins' },
  { type: 'scale', name: 'Pain', opts: { title: 'Pain', steps: 6, lo: 'none', hi: 'bad' }, group: 'Check-ins' },
  { type: 'scale', name: 'Dysphoria', opts: { title: 'Dysphoria', steps: 5, lo: 'quiet', hi: 'loud' }, group: 'Check-ins' },
  { type: 'fields', name: 'Outside & moving', opts: { title: 'Outside', labels: ['Minutes outside', 'Steps'] }, group: 'Check-ins' },
];
// Tier 1 presets (docs/journaling/BUILD-PLAN.md section 5): plain blocks with starting options, labels from the method docs.
// checks / scale / habits / fields presets are also X4 check-ins after the next Books build.
const P1 = (type, name, opts, group) => PRESETS.push({ type, name, opts, group });
P1('checks', 'Rituals', { title: 'Rituals', labels: ['Morning', 'Start', 'Shut down', 'Evening'] }, 'Planning');
P1('checks', "Today's 3", { title: "Today's 3", labels: ['#1', '#2', '#3'] }, 'Planning');
P1('checks', 'One Q2 thing', { title: 'Q2', labels: ['Did one Q2 thing'] }, 'Planning');
P1('checks', 'Inbox cleared', { title: 'GTD', labels: ['Inbox cleared'] }, 'Planning');
P1('habits', 'Weekly review', { title: 'Review', labels: ['Weekly review'] }, 'Planning');
P1('checks', 'Shutdown', { title: 'Shutdown', labels: ['Lists captured', "Tomorrow's first block", 'Work closed'] }, 'Planning');
P1('fields', 'Deep blocks', { title: 'Deep blocks', labels: ['Deep blocks planned', 'Deep blocks done'] }, 'Planning');
P1('fields', 'Focus rounds count', { title: 'Focus rounds', labels: ['Focus rounds'] }, 'Planning');
P1('checks', 'Supports', { title: 'Supports', labels: ['Headphones', 'Hood', 'Dark room', 'Alone time'] }, 'Check-ins');
P1('scale', 'Masking', { title: 'Masking', steps: 4, lo: 'none', hi: 'all day' }, 'Check-ins');
P1('habits', 'Overload', { title: 'Overload', labels: ['Overload'] }, 'Check-ins');
P1('scale', 'Felt like me', { title: 'Felt like me', steps: 5, lo: 'not today', hi: 'so me' }, 'Check-ins');
P1('fields', 'Voice minutes', { title: 'Voice', labels: ['Voice min'] }, 'Check-ins');
P1('checks', 'Cycle & dose', { title: 'Cycle & dose', labels: ['Period', 'Dose day'] }, 'Check-ins');
P1('checks', 'Deposits done', { title: 'Deposits', labels: ['Rest', 'Alone time', 'Outside'] }, 'Check-ins');
P1('checks', 'Sharpen the saw', { title: 'Renew', labels: ['Body', 'Mind', 'Heart', 'Spirit'] }, 'Check-ins');
P1('fields', 'Places', { title: 'Places', labels: ['Places visited'] }, 'Check-ins');
P1('checks', 'Something new', { title: 'Firsts', labels: ['Something new', 'Went outside', 'Talked to someone'] }, 'Check-ins');
P1('checks', 'Made something', { title: 'Made', labels: ['Made something', 'Went outside'] }, 'Check-ins');
P1('checks', 'Good today', { title: 'Good today', labels: ['Warmth', 'Food', 'Rest', 'People', 'Outside'] }, 'Check-ins');
P1('checks', 'Device-free hour', { title: 'Device-free', labels: ['Phone away 1 h'] }, 'Check-ins');
P1('habits', 'Outside & light', { title: 'Outside & light', labels: ['Outside', 'Daylight on face', 'Moved'] }, 'Check-ins');
P1('fields', 'One small good thing', { title: 'One good thing', labels: ['Good thing'] }, 'Check-ins');
// scan-ready marks (optical mark reading): added here so the scale block's own option list stays untouched
TYPES.checks.opts.push(OMR); TYPES.scale.opts.push(OMR);

const defOf = (o) => (o.def !== undefined ? structuredClone(o.def) : o.kind === 'flags' ? Object.fromEntries(Object.keys(o.items).map((k) => [k, true])) : o.kind === 'bool' ? true : o.kind === 'num' ? o.lo : '');
export function newBlock(type, opts = {}, uid) {
  const t = TYPES[type], b = { uid: uid || type + '-' + Math.random().toString(36).slice(2, 7), type, on: true };
  for (const o of t.opts) b[o.k] = defOf(o);
  if (type === 'care') b.rows = structuredClone(DEFAULT_ROWS);
  return fixOpts({ ...b, ...structuredClone(opts) });
}
const clamp = (v, lo, hi, d) => (Number.isFinite(+v) && v !== '' && v !== null ? Math.min(hi, Math.max(lo, Math.round(+v))) : d);
function fixOpt(o, v) {
  const d = defOf(o);
  switch (o.kind) {
    case 'num': return clamp(v, o.lo, o.hi, d);
    case 'bool': return v === undefined ? d : !!v;
    case 'choice': return o.choices.some(([c]) => c == v) ? o.choices.find(([c]) => c == v)[0] : d;
    case 'flags': return Object.fromEntries(Object.keys(o.items).map((k) => [k, v && v[k] !== undefined ? !!v[k] : d[k]]));
    case 'text': return v === undefined || v === null ? d : String(v).slice(0, o.max || 40);
    case 'list': return (Array.isArray(v) ? v : typeof v === 'string' ? v.split(',') : d).map((x) => String(x).trim().slice(0, 24)).filter(Boolean).slice(0, o.max || 10);
  }
  return v;
}
function fixOpts(b) {
  for (const o of TYPES[b.type].opts) b[o.k] = fixOpt(o, b[o.k]);
  if (b.type === 'care') {
    const seen = new Set();
    const src = (Array.isArray(b.rows) ? b.rows : []).filter((r) => r && CARE_ROWS[r.id] && !seen.has(r.id) && seen.add(r.id));
    const order = [...src.map((r) => r.id), ...DEFAULT_ROWS.map((r) => r.id).filter((x) => !seen.has(x))];
    b.rows = order.map((id) => {
      const d = DEFAULT_ROWS.find((r) => r.id === id), s = src.find((r) => r.id === id) || {}, r = { ...structuredClone(d), ...s, id, on: s.on === undefined ? d.on : !!s.on };
      for (const o of ROW_OPTS[id]) r[o.k] = fixOpt({ ...o, def: d[o.k] }, r[o.k]);
      return r;
    });
  }
  if (TYPES[b.type].locked) b.on = true;
  return b;
}

// The original page, block for block (uids = type names so v1 layouts map straight across).
export const DEFAULT_LAYOUT = {
  v: 2,
  blocks: [
    ['sky'], ['notes'], ['events'], ['care'], ['spoons'], ['good', { on: false }], ['body'], ['actions'], ['review'], ['fact'],
  ].map(([t, o]) => newBlock(t, o, t === 'good' ? 'gratitude' : t)),
};

// Clean up any saved layout: v1 → v2, unknown types dropped, one of each single, the writing space always present.
export function normalize(L) {
  let src = L && Array.isArray(L.blocks) ? L.blocks : DEFAULT_LAYOUT.blocks;
  if (!L || L.v !== 2) src = src.map((b) => (b && b.id ? { ...b, uid: b.id, type: b.id === 'gratitude' ? 'good' : b.id } : b));
  const singles = new Set(), uids = new Set(), blocks = [];
  for (const s of src) {
    if (!s || !TYPES[s.type]) continue;
    if (TYPES[s.type].single) { if (singles.has(s.type)) continue; singles.add(s.type); }
    let uid = typeof s.uid === 'string' && /^[\w-]{1,40}$/.test(s.uid) ? s.uid : s.type;
    while (uids.has(uid)) uid = s.type + '-' + Math.random().toString(36).slice(2, 7);
    uids.add(uid);
    blocks.push(fixOpts({ ...structuredClone(s), uid, on: s.on === undefined ? true : !!s.on }));
  }
  if (!singles.has('body')) { const i = blocks.findIndex((b) => b.type === 'actions'); blocks.splice(i < 0 ? blocks.length : i, 0, newBlock('body', {}, 'body')); }
  return { v: 2, blocks };
}

// ---------- rendering ----------
const bubs = (n) => Array(n).fill('<span class="bub"><i></i></span>').join('');
const lbl = (icon, t) => `<b class="xl">${icon ? ic(icon, t) : ''}${t ? `<span>${esc(t)}</span>` : ''}</b>`;
const PAPER_CLS = { lines: '', dots: 'pd', grid: 'pg' }; // lines = today's ruling, byte for byte
// Line spacing (mm -> class): tight 5.6 mm is today's 0.22 in and adds nothing; standard 6.6 mm = 0.26 in, wide 8.5 mm = 0.335 in.
export const PITCH_IN = { 5.6: 0.22, 6.6: 0.26, 8.5: 0.335 }, PITCH_CLS = { 5.6: '', 6.6: 'p26', 8.5: 'p33' };
const ruled = (n, cls = '', pitch = 5.6) => `<span class="ru ${cls}${PITCH_CLS[pitch] ? (cls ? ' ' : '') + PITCH_CLS[pitch] : ''}" style="height:${(n * PITCH_IN[pitch]).toFixed(2)}in"></span>`;
function careRow(r) {
  switch (r.id) {
    case 'meds': {
      const it = ['am', 'pm', 'prn'].filter((k) => r.items[k]);
      if (!it.length) return '';
      return `<div class="cr" data-zone="meds">${ic('pill', 'Meds')}${it.map((k) => box(ic(k, CARE_ROWS.meds.items[k]))).join('')}${r.items.prn ? '<span class="blank xs"></span>' : ''}</div>`;
    }
    case 'meals': return `<div class="cr" data-zone="meals">${ic('meal', 'Meals')}${Array(r.meals).fill(box('')).join('')}${r.snack ? `<span class="gap"></span>${box(ic('snack', 'Snack'))}` : ''}</div>`;
    case 'self_care': {
      const it = Object.keys(CARE_ROWS.self_care.items).filter((k) => r.items[k]);
      return it.length ? `<div class="cr" data-zone="self_care">${it.map((k) => box(ic(k, CARE_ROWS.self_care.items[k]))).join('')}</div>` : '';
    }
    case 'work': {
      if (!r.sleep && !r.work) return '';
      const s = r.sleep ? `${ic('sleep', 'Sleep')}<span class="blank xs"></span><span class="u">h</span>` : '';
      const w = r.work ? `${ic('work', 'Work')}${box('<span class="off">off</span>')}<span class="blank xs"></span><span class="u">–</span><span class="blank xs"></span>` : '';
      return `<div class="cr" data-zone="work">${s}${s && w ? '<span class="gap"></span>' : ''}${w}</div>`;
    }
    case 'checkin': return `<div class="cr" data-zone="checkin">${ic('low', 'Low')}${bubs(r.steps)}${ic('high', 'High')}</div>`;
    case 'anxiety': return `<div class="cr" data-zone="anxiety">${ic('calm', 'Calm')}${bubs(4)}${ic('anx', 'Anxious')}</div>`;
    case 'water': return `<div class="cr" data-zone="water">${ic('water', 'Water')}${Array(r.count).fill(box('')).join('')}</div>`;
  }
  return '';
}
const spoonRow = (b) => `<div class="cr sp" data-zone="spoons">${ic('spoon', 'Spoons')}${Array(b.count).fill(spoon()).join('')}</div>`;
// Bullet and habit marks drawn as SVG (never font glyphs, so no Type 3 fonts in the PDF).
const MK = {
  task: '<circle cx="4" cy="4" r="1.5" fill="currentColor" stroke="none"/>', event: '<circle cx="4" cy="4" r="2.2"/>', note: '<path d="M1.8 4h4.4"/>',
  moved: '<path d="M2.8 1.8 5.2 4 2.8 6.2"/>', done: '<path d="M2.2 2.2l3.6 3.6M5.8 2.2 2.2 5.8"/>',
  half: '<circle cx="4" cy="4" r="3"/><path d="M4 1a3 3 0 0 1 0 6Z" fill="currentColor"/>', full: '<circle cx="4" cy="4" r="3" fill="currentColor"/>',
};
const mk = (k) => `<svg class="bmk" width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="${k}">${MK[k]}</svg>`;
const mkKey = (ks, names = {}) => `<span class="mkey">${ks.map((k) => `<span>${mk(k)}${names[k] || k}</span>`).join('')}</span>`;
const hour = (h) => { const x = h % 24, ap = x < 12 ? 'a' : 'p'; return `${x % 12 || 12}${ap}`; };

function renderBlock(b, parts, zone) {
  const Z = `data-zone="${zone}"`;
  switch (b.type) {
    case 'sky': case 'notes': case 'events': case 'fact': return parts[b.type] || '';
    case 'spoons': return `<div class="care solo">${spoonRow(b)}</div>`;
    case 'good': return `<div class="grat" ${Z}><b class="zl">${ic('heart', b.label || 'Small good things')}</b>${b.because ? `<div class="gbs">${Array(b.n).fill('<div class="gb"><span class="lines" data-pitch="0.2" style="height:0.22in"></span><i>because</i><span class="lines" data-pitch="0.2" style="height:0.22in"></span></div>').join('')}</div>` : `<span class="lines" data-pitch="0.2" style="height:${(b.n * 0.2 + 0.02).toFixed(2)}in"></span>`}</div>`;
    case 'body': return `<div class="${{ lines: 'ruled', bold: 'ruled bold', blank: 'plain', grid: 'grid', grid37: 'grid g37' }[b.style] || 'dots'} log${b.secretLine ? ' sl' : ''}" data-zone="body"></div>`;
    case 'actions': return actionZone(b.count, b.routines ? parts.routines || [] : []);
    case 'review': {
      const it = Object.keys(REVIEW_ITEMS).filter((k) => b.items[k]);
      return it.length ? `<div class="rev${it.length < 3 ? ` c${it.length}` : ''}" data-zone="review">${it.map((k) => `<div><b class="zl">${ic(k, REVIEW_ITEMS[k])}<i>${REVIEW_ITEMS[k]}</i></b><span class="lines" data-pitch="0.22"></span></div>`).join('')}</div>` : '';
    }
    case 'checks': return b.labels.length ? `<div class="xb xrow${b.omr ? ' omr' : ''}" ${Z}>${lbl('', b.title)}${b.labels.map((t) => box(`<span class="t">${esc(t)}</span>`)).join('')}</div>` : '';
    case 'scale': return `<div class="xb xrow${b.omr ? ' omr' : ''}" ${Z}>${lbl('', b.title)}<span class="end">${esc(b.lo)}</span>${bubs(b.steps)}<span class="end">${esc(b.hi)}</span></div>`;
    case 'words': return b.words.length ? `<div class="xb xrow wr" ${Z}>${lbl('', b.title)}${b.words.map((w) => `<span class="w">${esc(w)}</span>`).join('')}</div>` : '';
    case 'sensory': {
      const S = TYPES.sensory.opts[0].items, it = Object.keys(S).filter((k) => b.items[k]);
      return it.length ? `<div class="xb xrow wr" ${Z}>${lbl('ear', 'Sensory')}${it.map((k) => `<span class="sn">${S[k]} ${bubs(4)}</span>`).join('')}</div>` : '';
    }
    case 'sleeptimes': return `<div class="xb xrow" ${Z}>${lbl('sleep', 'Sleep')}<span class="f">bed <span class="blank"></span></span><span class="f">up <span class="blank"></span></span>${b.quality ? `<span class="end">rough</span>${bubs(5)}<span class="end">rested</span>` : ''}</div>`;
    case 'habits': return b.labels.length ? `<div class="xb xrow wr xhab" ${Z}>${lbl('', b.title)}${b.labels.map((t) => `<span class="hd"><span class="t">${esc(t)}</span><i></i></span>`).join('')}${b.tiny ? mkKey(['half', 'full'], { half: 'tiny', full: 'done' }) : mkKey(['half', 'full'])}</div>` : '';
    case 'fields': return `<div class="xb xrow wr" ${Z}>${lbl('', b.title)}${b.labels.map((t) => `<span class="f">${esc(t)} <span class="blank"></span></span>`).join('')}</div>`;
    case 'weather': return `<div class="xb xrow" ${Z}>${['am', 'cloud', 'rain', 'snow', ...(b.aqi ? ['smoke'] : [])].map((k) => `<span class="cir">${ic(k, k === 'am' ? 'Sun' : k)}</span>`).join('')}<span class="f">hi <span class="blank xs"></span></span><span class="f">lo <span class="blank xs"></span></span>${b.aqi ? '<span class="f">AQI <span class="blank xs"></span></span>' : ''}</div>`;
    case 'lines': return `<div class="xb" ${Z}>${lbl('', b.title)}${ruled(b.n, PAPER_CLS[b.paper] || '', b.pitch)}</div>`;
    case 'bullets': return `<div class="xb xbul" ${Z}>${b.title || b.key ? `<div class="xrow">${b.title ? lbl('', b.title) : ''}${b.key ? mkKey(['task', 'event', 'note', 'moved', 'done']) : ''}</div>` : ''}${Array(b.n).fill('<div class="bl"><i></i><span></span></div>').join('')}</div>`;
    case 'split': return `<div class="xb xsplit" ${Z}><div>${lbl('', b.left)}${ruled(b.n, PAPER_CLS[b.paper] || '', b.pitch)}</div><div>${lbl('', b.right)}${ruled(b.n, PAPER_CLS[b.paper] || '', b.pitch)}</div></div>`;
    case 'top': {
      if (b.est || b.carried) { // extra columns after the line: bubbles, guess, took, carried; a header row names them
        const cols = (b.bubbles ? ['auto'] : []).concat(b.est ? ['0.5in', '0.5in'] : [], b.carried ? ['0.42in'] : []), g = `style="grid-template-columns:10px 1fr ${cols.join(' ')}"`;
        const head = `<div class="num te th" ${g}><span></span><span>${lbl('', b.title)}</span>${b.bubbles ? `<span class="tbub" style="visibility:hidden">${bubs(b.bubbles)}</span>` : ''}${b.est ? '<span class="tc">guess</span><span class="tc">took</span>' : ''}${b.carried ? '<span class="tc">carried</span>' : ''}</div>`;
        return `<div class="xb" ${Z}>${head}${Array.from({ length: b.n }, (_, i) => `<div class="num te" ${g}><span>${i + 1}</span>${ruled(1)}${b.bubbles ? `<span class="tbub">${bubs(b.bubbles)}</span>` : ''}${b.est ? `${ruled(1, 'tcl')}${ruled(1, 'tcl')}` : ''}${b.carried ? '<span class="tck"><i></i></span>' : ''}</div>`).join('')}</div>`;
      }
      return `<div class="xb" ${Z}>${lbl('', b.title)}${Array.from({ length: b.n }, (_, i) => b.bubbles ? `<div class="num tb"><span>${i + 1}</span>${ruled(1)}<span class="tbub">${bubs(b.bubbles)}</span></div>` : `<div class="num"><span>${i + 1}</span>${ruled(1)}</div>`).join('')}</div>`;
    }
    case 'sketch': return `<div class="xb" ${Z}>${b.caption ? `<div class="xrow">${b.title ? lbl('', b.title) : ''}<span class="cap">${esc(b.caption)}</span></div>` : b.title ? lbl('', b.title) : ''}<div class="sk-box${b.corners ? ' tp' : ''}" style="height:${(b.h / 10).toFixed(1)}in">${b.corners ? '<i class="tm a"></i><i class="tm b"></i><i class="tm c"></i><i class="tm d"></i>' : ''}</div></div>`;
    case 'timeline': {
      const hrs = []; for (let h = b.from; h < Math.max(b.to, b.from + 1); h += b.every) hrs.push(h);
      const cols = ['plan'].concat(b.actual ? ['actual'] : [], Array.from({ length: b.replan }, (_, i) => (b.replan > 1 ? `re-plan ${i + 1}` : 're-plan')));
      if (cols.length === 1) return `<div class="xb xtl" ${Z}>${hrs.map((h) => `<div><span class="hr">${hour(h)}</span>${ruled(1)}</div>`).join('')}</div>`;
      // plan + actual / re-plan columns: two halves side by side, or one wide list from three columns up
      const head = `<div class="xth"><span></span>${cols.map((c) => `<span>${c}</span>`).join('')}</div>`;
      return `<div class="xb xtl xtc${cols.length > 2 ? ' w1' : ''}" style="--tc:${cols.length}" ${Z}>${head}${cols.length > 2 ? '' : head}${hrs.map((h) => `<div><span class="hr">${hour(h)}</span>${cols.map(() => ruled(1)).join('')}</div>`).join('')}</div>`;
    }
    case 'shift': return `<div class="xb" ${Z}><div class="xrow">${lbl('work', 'Shift')}<span class="f">in <span class="blank"></span></span><span class="f">out <span class="blank"></span></span><span class="f">break <span class="blank"></span></span></div>${b.n ? ruled(b.n) : ''}</div>`;
    case 'bus': return `<div class="xb" ${Z}>${Array.from({ length: b.n }, (_, i) => `<div class="xrow">${i ? '<b class="xl"></b>' : lbl('bus', 'Bus')}<span class="f">route <span class="blank xs"></span></span><span class="f">stop <span class="blank"></span></span><span class="f">leave <span class="blank xs"></span></span><span class="f">back <span class="blank xs"></span></span></div>`).join('')}</div>`;
    case 'money': return `<div class="xb" ${Z}>${lbl('coin', 'Spent')}<div class="xmoney">${Array(b.n).fill('<span class="f"><span class="blank long"></span> $<span class="blank xs"></span></span>').join('')}</div></div>`;
    case 'reach': return `<div class="xb xrow wr" ${Z}>${lbl('people', 'Reach out')}${Array(b.n).fill(box('<span class="blank"></span>')).join('')}</div>`;
    case 'divider': return b.icon === 'sun' || b.icon === 'moon' ? `<div class="xdiv xdi"><i></i>${ic(b.icon === 'sun' ? 'am' : 'pm', b.icon === 'sun' ? 'Sun' : 'Moon')}<i></i></div>` : `<div class="xdiv"></div>`;
    case 'spacer': return `<div class="xsp" style="height:${(b.h / 10).toFixed(1)}in"></div>`;
  }
  return '';
}

// parts: pre-built, data-driven strings from render.mjs: header, sky, notes, events, fact ('' when none), routines [].
// opt.tag (editor only): mark each block's outer element with data-b="<uid>" so the preview can be dragged.
export function dayBlocks(parts, layout, opt = {}) {
  const L = normalize(layout);
  const on = L.blocks.filter((b) => b.on);
  const count = {}, out = [];
  const push = (b, h) => { if (h) out.push(opt.tag ? h.replace(/^<div/, `<div data-b="${b.uid}"`) : h); };
  for (let i = 0; i < on.length; i++) {
    const b = on[i];
    count[b.type] = (count[b.type] || 0) + 1;
    const zone = count[b.type] > 1 ? `${b.type}_${count[b.type]}` : b.type;
    if (b.type === 'care') {
      const rows = b.rows.filter((r) => r.on).map(careRow).filter(Boolean).join('');
      const sp = on[i + 1] && on[i + 1].type === 'spoons' ? on[++i] : null; // spoons right after care share its box
      if (rows || sp) push(b, `<div class="care" data-zone="care">${rows ? `<div class="cg2">${rows}</div>` : ''}${sp ? spoonRow(sp) : ''}</div>`);
      continue;
    }
    push(b, renderBlock(b, parts, zone));
  }
  return `<div class="day full">\n    ${parts.header}\n    ${out.join('\n    ')}\n  </div>`;
}

// Extra CSS the blocks need (appended to the page CSS).
export const DAYPAGE_CSS = `
.rev .zl { display: flex; align-items: center; gap: 3px; } .rev .zl i { font-style: normal; font-size: 6.5pt; letter-spacing: 0.4px; white-space: nowrap; }
.cbi { display: flex; flex-wrap: wrap; align-items: center; gap: 2px 10px; padding: 3px 0 4px; font-size: 7.5pt; line-height: 1.2; border-bottom: 1px solid #DCDCDC; }
.ci { display: inline-flex; align-items: center; gap: 4px; max-width: 100%; } .ci i { width: 10px; height: 10px; border: 1.2px solid #000; flex: none; } .ci span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .cbi .more { font-style: italic; color: #444; }
.rev.c2 { grid-template-columns: 1fr 1fr; } .rev.c1 { grid-template-columns: 1fr; }
.care.solo { padding: 3px 0; } .care.solo .cr.sp { margin-top: 0; }
.plain.log { border-top: 1px solid #bbb; }
/* ruling backgrounds (.ruled/.ru/.pd/.pg/.grid) are for the screen; print redraws them as vectors: drawRulings() in render.mjs, keep its SPECS in sync */
.ruled.log { background: repeating-linear-gradient(to bottom, transparent 0 calc(0.26in - 1pt), #a0a0a0 calc(0.26in - 1pt) 0.26in); }
.grat { display: grid; grid-template-columns: auto 1fr; gap: 6px; align-items: start; border-top: 1px solid #9a9a9a; padding-top: 2px; margin-top: 2px; } .grat span { height: 0.62in; }
.care [data-zone="water"] { gap: 3px; }
.xb { border-top: 1px solid #bbb; padding: 2px 0 1px; margin-top: 2px; font-size: 7pt; flex: none; }
.xrow { display: flex; align-items: center; gap: 5px; min-height: 0.2in; } .xrow.wr { flex-wrap: wrap; row-gap: 2px; }
.xl { display: inline-flex; align-items: center; gap: 3px; font: 700 6.6pt Inter, sans-serif; text-transform: uppercase; letter-spacing: 0.5px; color: #333; margin-right: 2px; white-space: nowrap; }
.xb > .xl { display: flex; } .xrow > .xl { display: inline-flex; }
.xl .ic { width: 11px; height: 11px; }
.xb .ck { gap: 2px; font-size: 7pt; } .xb .ck .t { margin-right: 3px; }
.xb .w { padding: 0 4px; } .xb .sn { display: inline-flex; align-items: center; gap: 2px; margin-right: 4px; } .xb .sn .bub i { width: 7px; height: 7px; }
.xb .f { display: inline-flex; align-items: baseline; gap: 2px; white-space: nowrap; } .xb .blank { height: 8px; }
.xb .cir { display: inline-flex; width: 15px; height: 15px; align-items: center; justify-content: center; } .xb .cir .ic { width: 11px; height: 11px; }
.ru { display: block; background: repeating-linear-gradient(to bottom, transparent 0 calc(0.22in - 1pt), #a0a0a0 calc(0.22in - 1pt) 0.22in); }
.xsplit { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.xb .num { display: grid; grid-template-columns: 10px 1fr; align-items: end; font-weight: 600; } .xb .num span:first-child { padding-bottom: 2px; }
.sk-box { border: 1px solid #999; border-radius: 2px; margin-top: 2px; }
.xtl { display: grid; grid-template-columns: 1fr 1fr; column-gap: 10px; } .xtl > div { display: grid; grid-template-columns: 0.26in 1fr; align-items: end; } .xtl .hr { font: 500 6.5pt Inter, sans-serif; color: #444; padding-bottom: 2px; }
.xmoney { display: grid; grid-template-columns: 1fr 1fr; column-gap: 10px; row-gap: 3px; padding-top: 2px; } .xmoney .f { display: flex; } .xmoney .blank.long { flex: 1; }
.bmk { width: 8px; height: 8px; flex: none; } .mkey { display: inline-flex; align-items: center; gap: 6px; margin-left: auto; font: 500 6pt Inter, sans-serif; color: #555; white-space: nowrap; } .mkey > span { display: inline-flex; align-items: center; gap: 2px; }
.xbul .bl { display: grid; grid-template-columns: 9px 1fr; align-items: end; } .xbul .bl span { height: 0.22in; border-bottom: 1px solid #a0a0a0; } .xbul .bl i { width: 3px; height: 3px; border-radius: 50%; background: #999; margin-bottom: 4px; }
.xhab .hd { display: inline-flex; align-items: center; gap: 3px; margin-right: 5px; font: 500 7pt Inter, sans-serif; white-space: nowrap; } .xhab .hd i { width: 10px; height: 10px; border: 1.1px solid #000; border-radius: 50%; }
.xdiv { border-top: 1px solid #777; margin: 4px 0 2px; flex: none; } .xsp { flex: none; }
/* paper: a quiet 4 mm dashed grid (Hobonichi style), lighter than the dot grid; dots on the ruling's baselines */
.grid.log, .ru.pg { background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='4mm' height='4mm' viewBox='0 0 40 40'%3E%3Cpath d='M0 1.3H40M1.3 0V40' stroke='%23c8c8c8' stroke-width='2.65' stroke-dasharray='6 4' fill='none'/%3E%3C/svg%3E"); background-size: 4mm 4mm; }
.ru.pd { background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='22' height='22' viewBox='0 0 22 22'%3E%3Ccircle cx='11' cy='11' r='1.4' fill='%23808080'/%3E%3C/svg%3E"); background-size: 0.22in 0.22in; background-position: 0 0.09in; }
/* Tier 1 options (see journal/README.md, "Day page presets and options"): every one is off by default and adds nothing to today's page */
.ru.p26 { background: repeating-linear-gradient(to bottom, transparent 0 calc(0.26in - 1pt), #a0a0a0 calc(0.26in - 1pt) 0.26in); }
.ru.p33 { background: repeating-linear-gradient(to bottom, transparent 0 calc(0.335in - 1pt), #a0a0a0 calc(0.335in - 1pt) 0.335in); }
.ru.pd.p26 { background-size: 0.26in 0.26in; background-position: 0 0.106in; }
.ru.pd.p33 { background-size: 0.335in 0.335in; background-position: 0 0.137in; }
.ruled.log.bold { background: repeating-linear-gradient(to bottom, transparent 0 calc(0.5625in - 1.5pt), #000 calc(0.5625in - 1.5pt) 0.5625in); }
.grid.g37.log { background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='3.7mm' height='3.7mm' viewBox='0 0 40 40'%3E%3Cpath d='M0 1.3H40M1.3 0V40' stroke='%23c8c8c8' stroke-width='2.65' stroke-dasharray='6 4' fill='none'/%3E%3C/svg%3E"); background-size: 3.7mm 3.7mm; }
.log.sl { position: relative; } .log.sl::before { content: ''; position: absolute; left: 0.9in; top: 0; bottom: 0; width: 1pt; background: #c0c0c0; }
.grat .gbs { display: grid; } .grat .gb { display: grid; grid-template-columns: 1.3fr auto 1fr; gap: 5px; align-items: end; } .grat .gb span { height: 0.22in; } .grat .gb i { font: 500 6.5pt Inter, sans-serif; font-style: normal; color: #555; padding-bottom: 2px; }
.xb .num.te { column-gap: 4px; align-items: end; } .xb .tc { font: 600 5.5pt Inter, sans-serif; text-transform: uppercase; letter-spacing: 0.4px; color: #555; text-align: center; padding: 0 0 1px; white-space: nowrap; }
.xb .tck { display: flex; justify-content: center; padding: 0 0 3px; } .xb .tck i { width: 9px; height: 9px; border: 1.1px solid #000; display: block; }
.sk-box.tp { position: relative; } .tm { position: absolute; width: 9px; height: 9px; border: 0 solid #555; } .tm.a { left: 5px; top: 5px; border-top-width: 1px; border-left-width: 1px; } .tm.b { right: 5px; top: 5px; border-top-width: 1px; border-right-width: 1px; } .tm.c { left: 5px; bottom: 5px; border-bottom-width: 1px; border-left-width: 1px; } .tm.d { right: 5px; bottom: 5px; border-bottom-width: 1px; border-right-width: 1px; }
.xb .cap { font: italic 500 6.5pt Inter, sans-serif; color: #666; }
.xdi { display: flex; align-items: center; gap: 6px; border-top: 0; } .xdi i { flex: 1; border-top: 1px solid #777; } .xdi .ic { width: 11px; height: 11px; color: #555; flex: none; }
.xtc > div, .xtc .xth { grid-template-columns: 0.26in repeat(var(--tc), 1fr); column-gap: 3px; } .xtc .xth { display: grid; font: 600 5.5pt Inter, sans-serif; text-transform: uppercase; letter-spacing: 0.4px; color: #555; text-align: center; } .xtc.w1 { grid-template-columns: 1fr; }
.xb.omr { gap: 8px; } .xb.omr .bub i { width: 12px; height: 12px; border-width: 1.3px; } .xb.omr .ck i { width: 12px; height: 12px; border-width: 1.3px; } .xb.omr .ck .t { margin-right: 4px; }
/* top priorities: time circles at the line's end, each = 15 min (estimate, then fill) */
.xb .num.tb { grid-template-columns: 10px 1fr auto; } .xb .tbub { display: inline-flex; gap: 2px; padding: 0 0 2px 4px; } .xb .tbub .bub i { width: 7px; height: 7px; border-width: 0.8px; }
`;
