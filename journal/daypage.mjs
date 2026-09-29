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
  x4: '<rect x="2.4" y="1" width="7.2" height="10" rx="1.2"/><path d="M4.4 3.4h3.2M4.4 5.4h3.2M4.4 7.4h1.8"/>',
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
  thought: '<path d="M3.4 8.6a2.2 2.2 0 0 1-.2-4.4 2.9 2.9 0 0 1 5.5-.4 2.1 2.1 0 0 1 .2 4.8Z"/><circle cx="3.4" cy="10.4" r=".7"/><circle cx="1.6" cy="11.2" r=".4"/>',
  needle: '<path d="M9.4 2.6 11 4.2M8.2 3.8 3.2 8.8l-.6 1.6 1.6-.6 5-5M6 6l1.4 1.4M4.6 7.4 6 8.8"/><path d="M2.6 10.4 1 12"/>',
  body: '<circle cx="6" cy="2.4" r="1.4"/><path d="M6 4.2v4M3 5.4h6M6 8.2 4.2 11M6 8.2 7.8 11"/>',
  wave: '<path d="M.8 6c1.2-3 2.4-3 3.6 0s2.4 3 3.6 0 2-2.4 3.2-.6"/>',
  dots: '<circle cx="3.2" cy="3.2" r="2"/><circle cx="8.8" cy="3.2" r="2"/><circle cx="3.2" cy="8.8" r="2"/><circle cx="8.8" cy="8.8" r="2"/><circle cx="3.2" cy="3.2" r="2" fill="currentColor"/><path d="M8.8 6.8a2 2 0 0 1 0 4Z" fill="currentColor"/>',
  // Tier 2 blocks
  dump: '<path d="M1.6 3.2c1.6-1.2 2.6 1.2 4.2 0s2.6-1.2 4.6.2M1.6 6.2c1.6-1.2 2.6 1.2 4.2 0s2.6-1.2 4.6.2M1.6 9.2c1.6-1.2 2.6 1.2 4.2 0"/>',
  wall: '<rect x="1" y="2" width="10" height="8" rx=".6"/><path d="M1 4.7h10M1 7.3h10M5 2v2.7M8.2 4.7v2.6M3.8 7.3V10"/>',
  rounds: '<rect x="1" y="3.6" width="2.4" height="2.4"/><rect x="4.8" y="3.6" width="2.4" height="2.4"/><rect x="8.6" y="3.6" width="2.4" height="2.4"/><path d="M1 9h10"/>',
  keep: '<path d="M3 1.2h6v9.6L6 8.4 3 10.8Z"/>',
  back: '<path d="M10.4 6H2.2M5 3 2 6l3 3"/>',
  week: '<rect x="1" y="3" width="10" height="6" rx="1"/><path d="M3.5 3v6M6 3v6M8.5 3v6"/>',
  pixel: '<rect x="1.6" y="1.6" width="8.8" height="8.8" rx="1"/><path d="M1.6 6h8.8v4.4H1.6Z" fill="currentColor"/>',
};
export const ic = (k, t = '') => `<svg class="ic" width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.15" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="${t || k}">${IC[k]}</svg>`;
export const box = (label) => `<span class="ck"><i></i>${label ? `<span>${label}</span>` : ''}</span>`;
export const spoon = () => `<svg class="spoon" width="7" height="15" viewBox="0 0 7 15"><path d="M3.5 .5C5.4 .5 6.2 2.2 6.2 3.8 6.2 5.4 4.9 6.6 4 7.2L4.5 13.4Q4.5 14.6 3.5 14.6 2.5 14.6 2.5 13.4L3 7.2C2.1 6.6.8 5.4.8 3.8.8 2.2 1.6.5 3.5.5Z" fill="none" stroke="#333" stroke-width="1" stroke-linejoin="round"/></svg>`;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// 3+ routines collapse into one wrapping row of tick boxes (max 6, then "+N more"), so a busy day keeps its writing space.
export const ROUTINE_ROWS = 2, ROUTINE_MAX = 6;
export const ACTION_H = 0.24; // row height in inches: today's
export function actionZone(n, pre = [], h = ACTION_H) {
  const st = h === ACTION_H ? '' : ` style="height:${h}in"`, zl = '<div class="zl">ACTION ITEMS:</div>', blank = `<div class="cb"${st}><i></i><span></span></div>`;
  if (pre.length <= ROUTINE_ROWS) {
    const blanks = Math.max(1, n - pre.length);
    return `<div class="az" data-zone="action_items">${zl}${pre.map((t) => `<div class="cb pre"${st}><i></i><span>${esc(t)}</span></div>`).join('')}${Array(blanks).fill(blank).join('')}</div>`;
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
  self_care: { name: 'Self-care ticks', icon: 'shower', x4: true, items: { shower: 'Shower', teeth: 'Teeth', joy: 'Did something I enjoy', text: 'Texted someone' } },
  work: { name: 'Work shift', icon: 'work' },
  checkin: { name: 'Mood', icon: 'high' },
  anxiety: { name: 'Anxiety', icon: 'anx', x4: true },
  water: { name: 'Water', icon: 'water' },
};
export const REVIEW_ITEMS = { well: 'Went well', hard: 'Was hard', next: 'Tomorrow' };
// The care split (paper and X4, one system): paper keeps meds, meals, water, mood and the work shift times; the X4 records
// spoons left, sleep hours, anxiety and the care ticks (self-care, snack). The X4-only rows stay here, switched off, for
// anyone who wants them on paper too. The little "X4:" line under the block names whatever is not on the page.
const DEFAULT_ROWS = [
  { id: 'meds', on: true, items: { am: true, pm: true, prn: true } },
  { id: 'meals', on: true, meals: 3, snack: false },
  { id: 'self_care', on: false, items: { shower: true, teeth: true, joy: true, text: true } },
  { id: 'work', on: true, sleep: false, work: true },
  { id: 'checkin', on: true, steps: 7 },
  { id: 'anxiety', on: false },
  { id: 'water', on: true, count: 8 },
];
export const ROW_OPTS = {
  meds: [{ k: 'items', kind: 'flags', label: 'Boxes', items: CARE_ROWS.meds.items, icons: true }],
  meals: [{ k: 'meals', kind: 'num', label: 'Meal boxes', lo: 1, hi: 4 }, { k: 'snack', kind: 'bool', label: 'Snack box (X4 has it)' }],
  self_care: [{ k: 'items', kind: 'flags', label: 'Boxes', items: CARE_ROWS.self_care.items, icons: true }],
  work: [{ k: 'work', kind: 'bool', label: 'Work shift times' }, { k: 'sleep', kind: 'bool', label: 'Sleep hours (X4 has it)' }],
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
export const X4_MAXES = [5, 10, 20, 50, 99, 200, 999]; // "fields": the most the X4 counts up to (paper is unaffected)
const BODYSIG = { stomach: 'Hungry', water: 'Thirsty', toilet: 'Toilet', temp: 'Hot/cold', tense: 'Tense', heart: 'Heart', tired: 'Tired' };
const PAPER = { k: 'paper', kind: 'choice', label: 'Paper', choices: [['lines', 'Lines'], ['dots', 'Dot grid'], ['grid', '4 mm grid']], def: 'lines' };

// group: where the block sits in the "Add blocks" palette.
export const TYPES = {
  // ---- from your day (single) ----
  sky: { name: 'Moon, sun & season', group: 'From your day', icon: 'pm', single: true, hint: 'Moon phase, sunrise–sunset, micro-season', opts: [] },
  notes: { name: 'Holidays & notes', group: 'From your day', icon: 'flag', single: true, hint: 'Prints only on days that have one', opts: [] },
  events: { name: 'Events', group: 'From your day', icon: 'clock', single: true, hint: 'One-off calendar events (days with events)', opts: [] },
  actions: { name: 'Action items', group: 'From your day', icon: 'well', single: true, hint: 'Routines from your calendar fill in first', opts: [N('count', 'Lines', 1, 8, 3), B('routines', 'Pre-fill routines'), { k: 'h', kind: 'choice', label: 'Row height', choices: [[0.24, 'Standard'], [0.3, 'Roomy'], [0.36, 'Wide']], def: 0.24 }] },
  fact: { name: 'On this day', group: 'From your day', icon: 'pen', single: true, hint: 'One line of history', opts: [] },
  review: { name: 'Went well · Was hard · Tomorrow', group: 'From your day', icon: 'next', single: true, hint: 'Short review columns', opts: [{ k: 'items', kind: 'flags', label: 'Columns', items: REVIEW_ITEMS, icons: true }, N('h', 'Height (lines)', 1, 5, 2)] },
  body: { name: 'Writing space', group: 'Writing', icon: 'pen', single: true, locked: true, hint: 'Takes whatever room is left', opts: [{ k: 'style', kind: 'choice', label: 'Paper', choices: [['dots', 'Dot grid'], ['lines', 'Lines'], ['bold', 'Bold lines'], ['grid', '4 mm grid'], ['grid37', '3.7 mm grid'], ['blank', 'Blank']], def: 'dots' }, B('secretLine', 'Secret line', false)] },
  // ---- check-ins ----
  care: { name: 'Care check-in', group: 'Check-ins', icon: 'pill', single: true, hint: 'Meds, meals, work shift, mood, water: two columns', opts: [] },
  spoons: { name: 'Spoons left', group: 'Check-ins', icon: 'spoon', single: true, hint: 'Off by default: the X4 counts spoons left', opts: [N('count', 'How many', 6, 16, 12)] },
  checks: { name: 'Checkboxes', group: 'Check-ins', icon: 'box', hint: 'Your own tick boxes · also on X4', opts: [T('Label', 'Habits', 24), LST('labels', 'Boxes', ['Stretch', 'Outside', 'Read'], 8)] },
  scale: { name: 'Scale', group: 'Check-ins', icon: 'bolt', hint: 'Circle a number between two words · also on X4', opts: [T('Label', 'Energy', 18), N('steps', 'Steps', 3, 11, 5), B('zero', 'Number from 0', false), B('signed', 'Signed (−3 … +3)', false), { k: 'lo', kind: 'text', label: 'Left word', def: 'low', max: 10 }, { k: 'hi', kind: 'text', label: 'Right word', def: 'high', max: 10 }] },
  words: { name: 'Words to circle', group: 'Check-ins', icon: 'list', hint: 'Circle the ones that fit today', opts: [T('Label', 'Feeling', 18), LST('words', 'Words', ['calm', 'tired', 'anxious', 'content', 'flat', 'overwhelmed', 'hopeful', 'irritable', 'proud', 'lonely'], 14), B('x4', 'Pick one on X4 (first 8 words)', false)] },
  sensory: { name: 'Sensory load', group: 'Check-ins', icon: 'ear', hint: 'How loud was the world today, 0–3', opts: [{ k: 'items', kind: 'flags', label: 'Senses', items: { sound: 'Sound', light: 'Light', crowd: 'Crowds', touch: 'Touch', smell: 'Smell', social: 'Social', temp: 'Temperature', move: 'Movement' }, def: { sound: true, light: true, crowd: true, touch: true, smell: false, social: false, temp: false, move: false } }] },
  sleeptimes: { name: 'Sleep times', group: 'Check-ins', icon: 'sleep', single: true, hint: 'Bed, wake and how it felt', opts: [B('quality', 'Quality scale')] },
  habits: { name: 'Habit dots', group: 'Check-ins', icon: 'dots', hint: 'One circle each: leave empty, half-fill or fill · also on X4', opts: [T('Label', 'Habits', 24), LST('labels', 'Habits', ['Stretch', 'Outside', 'Read', 'Water'], 8), B('tiny', 'Legend: half = tiny', false)] },
  fields: { name: 'Fill-in blanks', group: 'Check-ins', icon: 'pen', hint: 'Label + a blank to write a number or word · also on X4', opts: [T('Label', 'Outside', 18), LST('labels', 'Blanks', ['Minutes outside', 'Steps'], 6), { k: 'max', kind: 'choice', label: 'Highest count on X4', choices: X4_MAXES.map((m) => [m, String(m)]), def: 99 }] },
  weather: { name: 'Weather & air', group: 'Check-ins', icon: 'cloud', single: true, hint: 'Circle the sky; high, low and air quality', opts: [B('aqi', 'Air quality (smoke season)')] },
  // ---- therapy pack (opt-in; use with a therapist) ----
  feelings: { name: 'Feelings 0–5', group: 'Therapy', icon: 'heart', hint: 'Rate each feeling 0 to 5 · diary card', opts: [T('Label', 'Feelings', 18), LST('labels', 'Feelings', ['Sad', 'Shame', 'Anger', 'Fear', 'Joy'], 6), B('x4', 'Also on X4 (one 0–5 item each)', false)] },
  skills: { name: 'Skills 0–7', group: 'Therapy', icon: 'sprout', hint: 'How far I got with my skills today, 0 to 7', opts: [T('Label', 'Skills', 18), B('key', 'Print what 0–7 mean', true), B('x4', 'Also on X4 (one 0–7 item)', false)] },
  urge: { name: 'Urge + acted', group: 'Therapy', icon: 'wave', hint: 'Strength of an urge, 0 to 5, and a box if I acted on it', opts: [T('Label', 'Urges', 18), LST('labels', 'Your own words', ['Urge'], 3), B('x4', 'Also on X4 (a 0–5 item and an "acted" tick each)', false)] },
  thought: { name: 'Thought record', group: 'Therapy', icon: 'thought', hint: '3, 5 or 7 boxes for a thought that hurt', opts: [{ k: 'cols', kind: 'choice', label: 'Boxes', choices: [[3, '3 boxes'], [5, '5 boxes'], [7, '7 boxes']], def: 3 }, N('n', 'Lines per box', 1, 3, 1)] },
  // ---- body ----
  sites: { name: 'Injection site rotation', group: 'Body', icon: 'needle', hint: 'Circle where today’s injection went · also on X4', opts: [T('Label', 'Site', 14), LST('labels', 'Sites', ['L thigh', 'R thigh', 'L belly', 'R belly'], 8), B('time', 'Time blank', false)] },
  bodysig: { name: 'Body signals', group: 'Body', icon: 'body', hint: 'What my body is telling me, a few times a day', opts: [N('n', 'Times a day', 1, 3, 2), { k: 'items', kind: 'flags', label: 'Signals', items: BODYSIG, def: { stomach: true, water: true, toilet: true, temp: false, tense: true, heart: false, tired: true } }] },
  // ---- writing ----
  lines: { name: 'Lined notes', group: 'Writing', icon: 'pen', hint: 'A label and a few lines', opts: [T('Label', 'Notes'), N('n', 'Lines', 1, 12, 2), PAPER, PITCH] },
  bullets: { name: 'Quick bullets', group: 'Writing', icon: 'log', hint: 'Ruled rows with a bullet spot; optional key', opts: [T('Label', 'Log', 24), N('n', 'Rows', 2, 14, 5), B('key', 'Key strip'), PITCH] },
  good: { name: 'Small good things', group: 'Writing', icon: 'heart', hint: 'Short lines for good moments', opts: [{ k: 'label', kind: 'text', label: 'Label', def: 'Small good things', max: 24 }, N('n', 'Lines', 1, 8, 3), B('because', 'Add "because"', false), { k: 'pitch', kind: 'choice', label: 'Line spacing', choices: [[0.2, 'Tight 5 mm'], [0.26, 'Standard 6.6 mm'], [0.335, 'Wide 8.5 mm']], def: 0.2 }] },
  split: { name: 'Two columns', group: 'Writing', icon: 'list', hint: 'Two labelled columns side by side', opts: [{ k: 'left', kind: 'text', label: 'Left', def: 'Morning', max: 18 }, { k: 'right', kind: 'text', label: 'Right', def: 'Evening', max: 18 }, N('n', 'Lines', 1, 12, 3), PAPER, PITCH] },
  top: { name: 'Top priorities', group: 'Writing', icon: 'flag', hint: 'Numbered lines', opts: [T('Label', 'Top 3', 18), N('n', 'How many', 1, 6, 3), N('bubbles', 'Time circles (each circle = 15 min)', 0, 8, 0), B('est', 'Guess / took columns', false), B('carried', 'Carried column', false), PITCH] },
  sketch: { name: 'Sketch box', group: 'Writing', icon: 'box', hint: 'An empty frame to draw or stick things in', opts: [T('Label', ''), N('h', 'Height (tenths of an inch)', 5, 30, 12), B('corners', 'Tape marks', false), { k: 'caption', kind: 'text', label: 'Caption', def: '', max: 30 }] },
  // ---- planning ----
  timeline: { name: 'Time blocks', group: 'Planning', icon: 'clock', single: true, hint: 'Hours down the side to plan the day', opts: [N('from', 'From (hour, 24h)', 0, 14, 8), N('to', 'To (hour, 24h)', 1, 24, 22), { k: 'every', kind: 'choice', label: 'Every', choices: [[1, '1 hour'], [2, '2 hours']], def: 2 }, B('actual', 'Actual column', false), N('replan', 'Re-plan columns', 0, 2, 0), { ...PITCH, label: 'Row height' }] },
  shift: { name: 'Work shift', group: 'Planning', icon: 'work', single: true, hint: 'In, out, break and a line for notes', opts: [N('n', 'Note lines', 0, 3, 1)] },
  bus: { name: 'Bus plan', group: 'Planning', icon: 'bus', single: true, hint: 'Route, stop, leave and back', opts: [N('n', 'Trips', 1, 3, 1)] },
  money: { name: 'Spending', group: 'Planning', icon: 'coin', single: true, hint: 'What and how much', opts: [N('n', 'Rows', 2, 8, 4)] },
  reach: { name: 'Reach out', group: 'Planning', icon: 'people', single: true, hint: 'People to text or check on', opts: [N('n', 'Names', 1, 4, 2)] },
  // ---- Tier 2 (docs/journaling/BUILD-PLAN.md section 5): all are palette-only, the default page is unchanged ----
  tl24: { name: 'Time line 24 h', group: 'Planning', icon: 'clock', hint: 'A 24-hour strip, plan over actual; night shaded from the day\'s sunrise and sunset', opts: [N('start', 'Starts at (hour, 24h)', 0, 23, 0), { k: 'every', kind: 'choice', label: 'Hour labels', choices: [[2, 'Every 2 h'], [3, 'Every 3 h'], [4, 'Every 4 h'], [6, 'Every 6 h']], def: 3 }, B('actual', 'Actual row', false), B('shade', 'Shade night (sunrise–sunset)'), { k: 'h', kind: 'choice', label: 'Row height', choices: [[0.18, 'Compact'], [0.24, 'Standard'], [0.3, 'Roomy']], def: 0.18 }] },
  dump: { name: 'Brain dump', group: 'Writing', icon: 'dump', hint: 'A box to tip everything out of your head', opts: [T('Label', 'Brain dump', 24), N('n', 'Rows', 1, 10, 1), { k: 'paper', kind: 'choice', label: 'Paper', choices: [['dots', 'Dots'], ['lines', 'Lines'], ['blank', 'Blank']], def: 'dots' }, { ...PITCH, label: 'Row height' }] },
  later: { name: 'Later', group: 'Writing', icon: 'next', hint: 'Park a thought so it is safe and out of the way', opts: [T('Label', 'Later', 24), N('n', 'Rows', 1, 8, 1), { ...PITCH, label: 'Row height' }] },
  done: { name: 'Done list', group: 'Writing', icon: 'well', hint: 'What you did, written down after (no plan needed)', opts: [T('Label', 'Done', 24), N('n', 'Rows', 1, 10, 1), B('gutter', 'Tick boxes', true), { ...PITCH, label: 'Row height' }] },
  wall: { name: 'Wall of Awful', group: 'Writing', icon: 'wall', hint: 'When starting feels hard: circle what is in the way, then a way past. Paper only', opts: [T('Label', 'Wall of Awful', 24), LST('words', 'In the way', ['scary', 'boring', 'too big', 'unclear', 'tired', 'stuck'], 8), LST('ways', 'A way past', ['tiny step', 'ask', '5 minutes', 'not today'], 6), N('n', 'Lines to write below', 0, 4, 0), { ...PITCH, label: 'Row height' }] },
  stamps: { name: 'Time stamps', group: 'Planning', icon: 'clock', hint: 'Between tasks: the time, and what you switched to', opts: [T('Label', 'Between tasks', 24), N('n', 'Rows', 1, 12, 1), B('resume', 'Resume with line', false), { ...PITCH, label: 'Row height' }] },
  rounds: { name: 'Focus rounds', group: 'Planning', icon: 'rounds', hint: 'Boxes to fill, one per round, and marks for interruptions · also on X4 (count)', opts: [T('Label', 'Focus rounds', 24), N('n', 'Tasks', 1, 5, 1), N('boxes', 'Rounds per task', 1, 7, 4), B('marks', 'Interruption marks', true), { k: 'len', kind: 'text', label: 'Round length', def: '25 min', max: 8 }, { ...PITCH, label: 'Row height' }] },
  energy: { name: 'Energy types', group: 'Check-ins', icon: 'bolt', hint: 'How much of each kind of energy is left · also on X4', opts: [T('Label', 'Energy left', 18), LST('labels', 'Kinds', ['Body', 'Mind', 'People', 'Senses'], 6), N('steps', 'Steps', 3, 5, 3)] },
  accounts: { name: 'Energy accounts', group: 'Check-ins', icon: 'spoon', hint: 'Start with what you have, write what each thing cost. The X4 keeps spoons left', opts: [T('Label', 'Energy account', 24), N('n', 'Items', 2, 6, 2), B('x4', 'Left: on the X4', true)] },
  weekstrip: { name: 'Week at a glance', group: 'Planning', icon: 'week', hint: 'This week as a strip, today ringed. Dutch door: same strip on every page, no cutting', opts: [N('h', 'Height (tenths of an inch)', 3, 8, 3)] },
  keep: { name: 'Keep', group: 'Writing', icon: 'keep', hint: 'Words to keep, where they came from, and a moved box for the commonplace pages', opts: [T('Label', 'Words to keep', 24), N('n', 'Lines', 1, 6, 1), B('source', 'Source line', false), B('moved', 'Moved box', true), { ...PITCH, label: 'Row height' }] },
  lookback: { name: 'A month ago today', group: 'Writing', icon: 'back', hint: 'Prints that date so you can look back at that page. Paper only', opts: [{ k: 'period', kind: 'choice', label: 'Look back', choices: [['month', 'A month'], ['year', 'A year']], def: 'month' }, N('n', 'Lines', 1, 4, 1), { ...PITCH, label: 'Row height' }] },
  prompt: { name: 'Rotating prompt', group: 'Writing', icon: 'text', hint: 'A prompt that changes by date: the same on any reprint', opts: [{ k: 'every', kind: 'choice', label: 'Changes', choices: [['day', 'Every day'], ['week', 'Every week']], def: 'day' }, N('n', 'Lines', 1, 8, 1), B('pass', 'Pass box', true), { ...PITCH, label: 'Row height' }] },
  pixel: { name: 'Day pixel', group: 'Check-ins', icon: 'pixel', hint: 'One square for the whole day: fill it to match the level you circle', opts: [{ k: 'levels', kind: 'choice', label: 'Levels', choices: [[5, '5'], [7, '7']], def: 5 }, B('key', 'Low and high words', true)] },
  range: { name: 'Low and high', group: 'Check-ins', icon: 'low', hint: 'The lowest and highest point of the day', opts: [T('Label', 'Low and high', 18), N('steps', 'Steps', 3, 7, 5), { k: 'lo', kind: 'text', label: 'Left word', def: 'flat', max: 10 }, { k: 'hi', kind: 'text', label: 'Right word', def: 'bright', max: 10 }] },
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
P1('habits', 'Overload', { title: 'Overload', labels: ['Overload'] }, 'Body');
P1('lines', 'Special interest', { title: 'Into today', n: 2 }, 'Body');
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
// Roomy rows: single-row blocks whose height is fixed today get more room to write in (off = today's page)
const ROOMY = B('roomy', 'Roomy spacing', false);
for (const t of ['checks', 'scale', 'words', 'sensory', 'sleeptimes', 'habits', 'fields', 'weather', 'bus', 'money', 'reach', 'shift', 'energy', 'accounts', 'wall', 'pixel', 'range']) TYPES[t].opts.push(ROOMY);

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
    ['sky'], ['notes'], ['events'], ['care'], ['spoons', { on: false }], ['good', { on: false }], ['body'], ['actions'], ['review'], ['fact'],
  ].map(([t, o]) => newBlock(t, o, t === 'good' ? 'gratitude' : t)),
};

// Clean up any saved layout: v1 → v2, unknown types dropped, one of each single, the writing space always present.
// Grid layouts (the "Grid" switch, see "Page grid" below) are v2 with `grid: true` and a placement on every block:
// { col, row, colSpan, rowSpan }. Flow layouts never carry `grid`; placements left on their blocks are ignored.
export function normalize(L, size = 'small') {
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
  const grid = !!(L && L.grid && L.v === 2);
  for (const b of blocks) for (const k of PLACE) { const v = Math.round(+b[k]); if (Number.isFinite(v) && v >= 1 && b[k] !== null && b[k] !== '') b[k] = v; else delete b[k]; }
  if (!grid) return { v: 2, blocks };
  const out = { v: 2, grid: true, blocks };
  if (blocks.some((b) => PLACE.some((k) => b[k] === undefined))) placeMissing(out, size);
  return out;
}

// ======================= page grid (layout switch "Grid") =======================
// A grid layout puts every block on a fixed grid instead of stacking them: each block has { col, row, colSpan, rowSpan } (1-based).
// The grid is fixed per page type and trim (GRIDS), never set by the person; blocks only choose where they sit and how far they span.
// Day page: 4 columns, and rows one tight line high (0.22 in = 5.6 mm), so ruled lines line up with the rows.
// Measured on the built pages (both trims): the day area is 590.4 px tall; the DATE/TITLE/TAGS header takes 61.6 px plus its 4 px margin,
// which leaves 524.8 px = 5.47 in, and 5.47 in / 0.22 in = 24.85, so 24 rows fit (0.19 in is left blank above the SEND TO strip).
// The 8.5x11 book is laid out at the same height as 5.5x8.5 and zoomed 1.294x, so its row count is also 24 (a row is 7.2 mm there, and
// the columns are wider: still 4). Both trims keep the same columns and rows, so a layout carries across sizes.
// Other page types can add their own entry here later.
export const GRIDS = {
  day: { cols: 4, rowIn: 0.22, gapPx: 8, rows: { small: 24, letter: 24 } },
};
export const PLACE = ['col', 'row', 'colSpan', 'rowSpan'];
export const gridRows = (size) => GRIDS.day.rows[size === 'letter' ? 'letter' : 'small'];
// Locked: the DATE/TITLE/TAGS header (above the grid), the SEND TO strip, the page code and the 9pt frame (below and around it) are
// not blocks and never sit on the grid. The Writing space stays and keeps a minimum: 8 rows (1.76 in, over the 40 mm floor) by 2 columns.
export const BODY_MIN = { rows: 8, cols: 2 };

// Minimum span per block: the least room its content needs. `cols` is the narrowest it can be; `rows` is its height at that width
// (a wider block is never taller). Measured on every block type in Chromium; editor/test.mjs re-measures them and fails if any block
// overflows its own minimum, so the minimum is a floor the content fits in, not a guess at what looks nice.
const ROW_IN = GRIDS.day.rowIn;
const rowsIn = (h) => Math.max(1, Math.ceil((h + 0.02) / ROW_IN)); // inches of content (+ a little slack for font differences) -> whole rows
// type -> (block, colSpan) => [minimum columns, height in inches at that width]. Heights are the measured natural heights of the
// block at 1-4 columns (small trim, real fonts) plus what each option adds (a ruled line is one pitch, and so on).
const Pi = (b) => PITCH_IN[b.pitch] || 0.22;
const at = (H, w) => H[Math.min(3, Math.max(0, w - 1))] * (w <= 2 ? 1.3 : 1); // heights measured at 1, 2, 3, 4 columns (a narrow block gets extra: words wrap unevenly)
// lines a row of items wraps to (greedy, as flex-wrap does) when `avail` px are free after the label
const flowLines = (widths, avail) => { let lines = 1, x = 0; for (const w of widths) { if (x && x + w > avail) { lines++; x = 0; } x += w + 4; } return lines; };
const wrapH = (b, w, itemPx, cnt) => 0.03 + 0.2 * flowLines(cnt.map(itemPx), w * (colPx + gapPx) - gapPx - (b.title || '').length * 5 - 30);
const more = (n, d) => Math.max(1, Math.ceil(n / d)); // a list longer than the default one wraps onto more lines
const colPx = 76.8, gapPx = 8; // a column and the gap between columns, in px (small trim; the letter trim is wider, so this is the safe one)
const fitCols = (px) => { for (let c = 1; c < GRIDS.day.cols; c++) if (c * (colPx + gapPx) - gapPx >= px + 4) return c; return GRIDS.day.cols; };
const hoursOf = (b) => Math.ceil((Math.max(b.to, b.from + 1) - b.from) / b.every);
const MINSPAN = {
  sky: () => [2, 0.4], // the season line wraps on some days, so two rows at any width
  notes: () => [2, 0.15],
  events: (b, w) => [2, [0.39, 0.39, 0.35, 0.33][w - 1]],
  fact: (b, w) => [2, [1.02, 0.46, 0.32, 0.32][w - 1]],
  actions: (b) => [2, 0.13 + Math.max(b.count, b.routines ? 3 : 1) * b.h], // routines fill in first: up to 2 of them sit above one blank line
  review: (b) => [Math.max(2, Object.values(b.items).filter(Boolean).length), 0.156 + b.h * 0.22],
  care: (b) => [4, 0.06 + Math.ceil((b.rows.filter((r) => r.on).length + 1) / 2) * 0.245],
  spoons: (b) => [b.count > 12 ? 3 : 2, 0.313],
  checks: (b) => { const px = 1.35 * (b.title.length * 5 + 12 + b.labels.reduce((t, l) => t + l.length * 4.3 + 16 + (b.omr ? 3 : 0), 0)), c = fitCols(px); return [c, px + 4 > c * (colPx + gapPx) - gapPx - 12 ? 0.42 : 0.2]; }, // two rows when it is a tight fit
  scale: (b) => [fitCols(95 + 4.6 * (b.title.length + b.lo.length + b.hi.length) + (b.steps - 5) * 17 + (b.omr ? b.steps * 2 : 0)), 0.2],
  words: (b, w) => [2, wrapH(b, w, (l) => l.length * 5 + 14, b.words) + 0.1],
  sensory: (b, w) => [2, at([0.74, 0.46, 0.31, 0.31], w) * more(Object.values(b.items).filter(Boolean).length, 4)],
  sleeptimes: () => [4, 0.2],
  habits: (b, w) => [2, wrapH(b, w, (l) => l.length * 5 + 26, b.labels) + 0.1],
  fields: (b, w) => [2, wrapH(b, w, (l) => l.length * 5 + 42, b.labels) + 0.1],
  weather: (b) => [b.aqi ? 4 : 3, 0.2],
  feelings: (b) => [4, 0.5 + 0.2 * Math.ceil(b.labels.length / 2)],
  skills: () => [4, 0.477],
  urge: (b) => [4, 0.277 + 0.2 * b.labels.length],
  thought: (b, w) => { const r = b.cols === 3 ? 1 : 2; return [2, 0.281 + r * (0.1 + 0.22 * b.n) + (w < 4 ? r * 0.1 : 0)]; },
  sites: (b, w) => [2, at([0.74, 0.31, 0.2, 0.2], w) * more(b.labels.length + (b.time ? 1 : 0), 4)],
  bodysig: (b, w) => [2, 0.156 + b.n * at([0.8, 0.26, 0.26, 0.2], w) * more(Object.values(b.items).filter(Boolean).length, 5)],
  lines: (b) => [2, 0.156 + b.n * Pi(b)],
  bullets: (b) => [b.key ? 3 : 2, b.n * Pi(b) + (b.title || b.key ? 0.24 : 0.04)],
  good: (b) => [2, 0.05 + b.n * (b.because ? Math.max(0.22, b.pitch) + 0.03 : b.pitch)],
  split: (b) => [2, 0.17 + b.n * Pi(b)],
  top: (b) => [b.est || b.carried ? 4 : b.bubbles > 4 ? 3 : 2, 0.156 + b.n * Pi(b) + (b.est || b.carried ? 0.2 : 0)],
  sketch: (b) => [2, b.h / 10 + 0.07 + (b.title || b.caption ? 0.2 : 0)],
  timeline: (b) => { const nc = 1 + (b.actual ? 1 : 0) + b.replan, hrs = hoursOf(b); return nc === 1 ? [2, Math.ceil(hrs / 2) * Pi(b) + 0.04] : nc === 2 ? [3, Math.ceil(hrs / 2) * Pi(b) + 0.135] : [3, hrs * Pi(b) + 0.135]; },
  shift: (b) => [3, 0.242 + b.n * 0.22],
  bus: (b) => [4, 0.042 + b.n * 0.2],
  money: (b) => [2, 0.17 + Math.ceil(b.n / 2) * 0.15],
  reach: (b, w) => [2, at([0.43, 0.29, 0.2, 0.2], w) * more(b.n, 2)],
  tl24: (b) => [2, 0.16 + b.h * (b.actual ? 2 : 1)],
  dump: (b) => [2, 0.083 + b.n * Pi(b)],
  later: (b) => [2, 0.042 + b.n * Pi(b)],
  done: (b) => [2, 0.042 + b.n * Pi(b)],
  wall: (b, w) => [2, at([1.77, 0.83, 0.67, 0.55], w) * more(b.words.length + b.ways.length, 10) + b.n * Pi(b)],
  stamps: (b) => [2, 0.042 + (b.n + (b.resume ? 1 : 0)) * Pi(b)],
  rounds: (b) => [b.boxes > 4 ? 4 : 3, 0.042 + b.n * Pi(b)],
  energy: (b, w) => [2, at([0.74, 0.46, 0.31, 0.2], w) * more(b.labels.length * b.steps, 12)],
  accounts: (b) => [3, 0.346 + (Math.ceil(b.n / 2) - 1) * 0.15],
  weekstrip: (b) => [3, b.h / 10 + 0.07],
  keep: (b) => [3, 0.042 + b.n * Pi(b) + (b.source ? 0.2 : 0)],
  lookback: (b) => [3, 0.042 + b.n * Pi(b)],
  prompt: (b, w) => [2, 0.042 + b.n * Pi(b) + (w < 3 ? 0.16 : 0)],
  pixel: (b) => [b.levels > 5 ? 4 : 3, 0.342],
  range: (b, w) => [2, at([0.45, 0.45, 0.31, 0.2], w) * more(b.steps, 5)],
  divider: () => [1, 0.02],
  spacer: (b) => [1, b.h / 10 + 0.01],
  body: () => [BODY_MIN.cols, BODY_MIN.rows * ROW_IN - 0.05],
};
export function minSpan(b, colSpan = GRIDS.day.cols) {
  const f = MINSPAN[b.type] || (() => [2, 0.5]);
  const [cols, h] = f(b, Math.max(colSpan, 1));
  return { cols: Math.min(GRIDS.day.cols, cols), rows: rowsIn(h) };
}

const blockName = (b) => (TYPES[b.type] ? TYPES[b.type].name : b.type);
const span = (a, n) => (n > 1 ? `${a}–${a + n - 1}` : `${a}`);
const rectOf = (b) => ({ c1: b.col, c2: b.col + b.colSpan - 1, r1: b.row, r2: b.row + b.rowSpan - 1 });
const hit = (a, c) => a.c1 <= c.c2 && c.c1 <= a.c2 && a.r1 <= c.r2 && c.r1 <= a.r2;
const placed = (b) => PLACE.every((k) => Number.isInteger(b[k]) && b[k] >= 1);
// Every reason a grid layout cannot be printed, in words: [{ uid, code, msg }]. Empty = valid. Blocks that are off take no room.
export function gridProblems(L, size = 'small') {
  const G = GRIDS.day, R = gridRows(size), out = [], on = L.blocks.filter((b) => b.on);
  const bad = (b, code, msg) => out.push({ uid: b.uid, code, msg });
  for (const b of on) {
    const nm = blockName(b);
    if (!placed(b)) { bad(b, 'unplaced', `${nm} has no place on the grid yet.`); continue; }
    if (b.col + b.colSpan - 1 > G.cols) bad(b, 'columns', `${nm} sticks out of the page: it uses columns ${span(b.col, b.colSpan)} and the page has ${G.cols}.`);
    if (b.row + b.rowSpan - 1 > R) bad(b, 'rows', `${nm} runs off the bottom: it uses rows ${span(b.row, b.rowSpan)} and the page has ${R}.`);
    const m = minSpan(b, b.colSpan);
    if (b.type === 'body') {
      if (b.rowSpan < BODY_MIN.rows || b.colSpan < BODY_MIN.cols) bad(b, 'body', `The Writing space stays at least ${BODY_MIN.rows} rows tall (${(BODY_MIN.rows * 5.588).toFixed(0)} mm) and ${BODY_MIN.cols} columns wide; it is ${b.rowSpan} rows by ${b.colSpan} columns.`);
    } else if (b.colSpan < m.cols) bad(b, 'min', `${nm} needs at least ${m.cols} columns to fit its content; it has ${b.colSpan}.`);
    else if (b.rowSpan < m.rows) bad(b, 'min', `${nm} needs at least ${m.rows} rows to fit its content at this width; it has ${b.rowSpan}.`);
  }
  for (let i = 0; i < on.length; i++) for (let j = i + 1; j < on.length; j++) {
    const a = on[i], c = on[j];
    if (!placed(a) || !placed(c) || !hit(rectOf(a), rectOf(c))) continue;
    const A = rectOf(a), C = rectOf(c), c1 = Math.max(A.c1, C.c1), c2 = Math.min(A.c2, C.c2), r1 = Math.max(A.r1, C.r1), r2 = Math.min(A.r2, C.r2);
    bad(c, 'overlap', `${blockName(a)} and ${blockName(c)} overlap at column${c2 > c1 ? 's' : ''} ${span(c1, c2 - c1 + 1)}, row${r2 > r1 ? 's' : ''} ${span(r1, r2 - r1 + 1)}.`);
  }
  return out;
}
// The first free rectangle of `cols` × `rows` cells (top to bottom, then left to right), ignoring `except` (a uid), or null.
export function findFree(L, cols, rows, size = 'small', except = null) {
  const G = GRIDS.day, R = gridRows(size), taken = L.blocks.filter((b) => b.on && b.uid !== except && placed(b)).map(rectOf);
  for (let r = 1; r + rows - 1 <= R; r++) for (let c = 1; c + cols - 1 <= G.cols; c++) {
    const q = { c1: c, c2: c + cols - 1, r1: r, r2: r + rows - 1 };
    if (!taken.some((t) => hit(t, q))) return { col: c, row: r, colSpan: cols, rowSpan: rows };
  }
  return null;
}
// Place a block on the first free spot, as wide as it can be (full width first, then narrower down to its minimum); null if the page is full.
export function placeBlock(L, b, size = 'small') {
  for (let w = GRIDS.day.cols; w >= 1; w--) {
    const m = minSpan(b, w); if (w < m.cols) break;
    const f = findFree(L, w, m.rows, size, b.uid); if (f) return f;
  }
  return null;
}
// Today's single-column flow laid on the grid: blocks stacked in list order at full width, each as tall as its minimum, and the Writing
// space takes every row that is left (at its place in the list, as in the flow layout). Blocks that are off get a spot but take no room.
// The stack of minimums can be taller than the page (every block gets its worst-case room, including the ones that are usually empty);
// then blocks are switched off from the end of the list until the Writing space has its minimum. Returns those blocks (uids), in order.
export function autoPlace(L, size = 'small') {
  const R = gridRows(size), W = GRIDS.day.cols, dropped = [];
  const used = () => L.blocks.filter((b) => b.on && b.type !== 'body').reduce((t, b) => t + minSpan(b, W).rows, 0);
  while (R - used() < BODY_MIN.rows) {
    const last = [...L.blocks].reverse().find((b) => b.on && b.type !== 'body');
    if (!last) break;
    last.on = false; dropped.push(last.uid);
  }
  const room = R - used();
  let row = 1;
  for (const b of L.blocks) {
    const rows = b.type === 'body' ? Math.max(BODY_MIN.rows, room) : minSpan(b, W).rows;
    Object.assign(b, { col: 1, row, colSpan: W, rowSpan: rows });
    if (b.on) row += rows;
  }
  return dropped;
}
// Blocks in a grid layout that lack a placement (a hand-edited file, or one just added): put them in the free space.
function placeMissing(L, size) {
  for (const b of L.blocks) {
    if (placed(b)) continue;
    for (const k of PLACE) delete b[k];
    const m = minSpan(b), at = placeBlock({ ...L, blocks: L.blocks.filter((x) => x !== b) }, b, size);
    Object.assign(b, at || { col: 1, row: 1, colSpan: GRIDS.day.cols, rowSpan: m.rows });
  }
}

// ---------- rendering ----------
// Scale numbering. Plain scales print unnumbered bubbles and the X4 stores 1..steps (as ever).
// zero: 0..steps-1, printed under the bubbles. signed: -k..+k around a centre 0 (steps rounded down to odd), 0 is the ringed one.
// The X4 stores exactly these numbers (export_pack.py mirrors this).
export function scaleRange(b) {
  if (b.signed) { const k = Math.floor((b.steps - 1) / 2); return { lo: -k, hi: k, n: 2 * k + 1, def: 0 }; }
  if (b.zero) return { lo: 0, hi: b.steps - 1, n: b.steps, def: Math.floor((b.steps - 1) / 2) };
  return { lo: 1, hi: b.steps, n: b.steps, def: Math.floor((1 + b.steps) / 2) };
}
const scaleBubs = (b) => {
  if (!b.zero && !b.signed) return bubs(b.steps);
  const { lo, hi } = scaleRange(b);
  return Array.from({ length: hi - lo + 1 }, (_, i) => { const v = lo + i; return `<span class="bub n${b.signed && v === 0 ? ' mid' : ''}"><i></i><em>${v < 0 ? '\u2212' + -v : b.signed && v > 0 ? '+' + v : v}</em></span>`; }).join('');
};
const bubs = (n) => Array(n).fill('<span class="bub"><i></i></span>').join('');
// Numbered dots (mood -3..+3, anxiety 0..3): the number printed inside, the middle of a signed scale marked with a heavier ring.
const nbubs = (n, lo, mid = false) => Array.from({ length: n }, (_, i) => { const v = lo + i; return `<span class="bub nb${mid && v === 0 ? ' mid' : ''}"><i>${v > 0 && mid ? '+' : v < 0 ? '−' : ''}${Math.abs(v)}</i></span>`; }).join('');
// A row's own height (bullets): today's 0.22 in adds nothing.
const bs = (pitch) => (PITCH_IN[pitch] && PITCH_IN[pitch] !== 0.22 ? ` style="height:${PITCH_IN[pitch]}in"` : '');
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
    case 'checkin': return `<div class="cr" data-zone="checkin">${ic('low', 'Low')}${nbubs(r.steps, -(r.steps >> 1), true)}${ic('high', 'High')}</div>`;
    case 'anxiety': return `<div class="cr" data-zone="anxiety">${ic('calm', 'Calm')}${nbubs(4, 0)}${ic('anx', 'Anxious')}</div>`;
    case 'water': return `<div class="cr" data-zone="water">${ic('water', 'Water')}${Array(r.count).fill(box('')).join('')}</div>`;
  }
  return '';
}
const spoonRow = (b) => `<div class="cr sp" data-zone="spoons">${ic('spoon', 'Spoons left')}${Array(b.count).fill(spoon()).join('')}</div>`;
// One small line under the care block: what the X4 keeps that this page does not. Names only what is off the page.
function x4Note(b, spoonsOn) {
  const row = (id) => b.rows.find((r) => r.id === id), on = (id) => row(id) && row(id).on;
  const w = row('work'), sc = row('self_care');
  const list = [!spoonsOn && 'spoons', !(on('work') && w.sleep) && 'sleep', !on('anxiety') && 'anxiety', !(on('self_care') && sc && Object.values(sc.items).some(Boolean)) && 'care ticks'].filter(Boolean);
  return list.length ? `<div class="x4n" data-zone="x4_note">${ic('x4', 'X4')}<span>X4: ${list.join(' · ')}</span></div>` : '';
}
// Bullet and habit marks drawn as SVG (never font glyphs, so no Type 3 fonts in the PDF).
const MK = {
  task: '<circle cx="4" cy="4" r="1.5" fill="currentColor" stroke="none"/>', event: '<circle cx="4" cy="4" r="2.2"/>', note: '<path d="M1.8 4h4.4"/>',
  moved: '<path d="M2.8 1.8 5.2 4 2.8 6.2"/>', done: '<path d="M2.2 2.2l3.6 3.6M5.8 2.2 2.2 5.8"/>',
  me: '<path d="M4.6 1.4 3.4 5.4"/>', other: '<path d="M1.4 4h5.2"/>',
  half: '<circle cx="4" cy="4" r="3"/><path d="M4 1a3 3 0 0 1 0 6Z" fill="currentColor"/>', full: '<circle cx="4" cy="4" r="3" fill="currentColor"/>',
};
const mk = (k) => `<svg class="bmk" width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="${k}">${MK[k]}</svg>`;
const mkKey = (ks, names = {}) => `<span class="mkey">${ks.map((k) => `<span>${mk(k)}${names[k] || k}</span>`).join('')}</span>`;
const hour = (h) => { const x = h % 24, ap = x < 12 ? 'a' : 'p'; return `${x % 12 || 12}${ap}`; };

// ---- Tier 2 helpers: dates and sun times come from parts.day ({date, rise, set}); the editor's sample day is generic ----
export const SAMPLE_DAY = { date: '2026-10-31', rise: '7:26a', set: '5:58p' };
const MON3 = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dparse = (s) => { const m = /^(\d{4})-(\d\d)-(\d\d)$/.exec(s || ''); return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null; };
const dnum = (dt) => Math.floor(dt.getTime() / 864e5); // days since 1970-01-01 (a Thursday)
const clock = (s) => { const m = /^(\d{1,2}):(\d\d)([ap])$/.exec(s || ''); return m ? (+m[1] % 12) + (m[3] === 'p' ? 12 : 0) + +m[2] / 60 : null; };
// A month or year before, same day of the month, clamped to the last day (Mar 31 -> Feb 28).
export function lookBack(date, period) {
  const d = dparse(date); if (!d) return '';
  const y = d.getUTCFullYear() - (period === 'year' ? 1 : 0), m = d.getUTCMonth() - (period === 'year' ? 0 : 1);
  const last = new Date(Date.UTC(y, m + 1, 0)); // day 0 of the next month = last day of this one
  const t = new Date(Date.UTC(y, m, Math.min(d.getUTCDate(), last.getUTCDate())));
  return `${MON3[t.getUTCMonth()]} ${t.getUTCDate()}${period === 'year' ? ', ' + t.getUTCFullYear() : ''}`;
}
// Rotating prompts: [tag, text]. Picked by date only (days since 1970, or the Monday's), so a reprint gives the same prompt.
export const DAY_PROMPTS = [
  ['noticing', 'One thing I noticed today that I usually miss'], ['body', 'Where my body asked for something today'], ['people', 'Someone I was glad to hear from'],
  ['small', 'A small thing that went better than I expected'], ['rest', 'What would count as rest today'], ['place', 'A place that felt okay to be in'],
  ['noticing', 'A sound I liked'], ['self', 'Something I did that was kind to me'], ['past', 'Something I used to worry about that is quieter now'],
  ['body', 'What my body needed more of this week'], ['people', 'Something I would like to say to someone'], ['small', 'A thing I finished, however small'],
  ['noticing', 'The light at a time of day I usually miss'], ['self', 'A word I would use for today'], ['rest', 'One thing I can put down until tomorrow'],
  ['place', 'A corner of my home I like, and why'], ['past', 'A day I got through, and what helped'], ['body', 'What I ate or drank that felt good'],
  ['people', 'A person who makes things easier'], ['small', 'Something I am looking forward to'], ['noticing', 'Something I saw on the way'],
  ['self', 'A boundary that helped me'], ['rest', 'What I would do with an empty hour'], ['place', 'The weather today, in three words'],
  ['past', 'Something I have learned about myself lately'], ['body', 'A moment I felt steady'], ['people', 'A kind thing someone did'],
  ['small', 'A plan that can stay small'], ['noticing', 'A smell I liked'], ['self', 'What I forgave myself for'], ['rest', 'Where I felt most at ease today'],
  ['place', 'Somewhere I would like to go'], ['past', 'What I would tell myself a year ago'], ['body', 'How I moved today'], ['people', 'Someone I miss'],
  ['small', 'A choice that was mine today'],
];
export function promptFor(date, every) {
  const d = dparse(date); if (!d) return DAY_PROMPTS[0];
  const n = dnum(d), k = every === 'week' ? Math.floor((n + 3) / 7) : n; // (n + 3) % 7 = 0 on a Monday, so a week is Monday to Sunday
  return DAY_PROMPTS[((k % DAY_PROMPTS.length) + DAY_PROMPTS.length) % DAY_PROMPTS.length];
}
// The seven days of this date's week, Monday first.
function weekOf(date) {
  const d = dparse(date) || dparse(SAMPLE_DAY.date), mon = new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * 864e5);
  return Array.from({ length: 7 }, (_, i) => { const t = new Date(mon.getTime() + i * 864e5); return { l: 'MTWTFSS'[i], d: t.getUTCDate(), m: t.getUTCMonth(), today: t.getTime() === d.getTime() }; });
}
// Day pixel swatch: a 10x10 square filled from the bottom, level 0 = empty (SVG, so no font glyphs).
const swatch = (i, n) => { const h = Math.round((i / (n - 1)) * 8); return `<svg class="pxs" width="12" height="12" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width=".9" role="img" aria-label="level ${i + 1} of ${n}"><rect x="1" y="1" width="8" height="8" rx=".8"/>${h ? `<rect x="1" y="${9 - h}" width="8" height="${h}" fill="#888" stroke="none"/>` : ''}</svg>`; };
// Therapy pack: every block carries a "use with a therapist" note and the same two numbers the book's Support page prints
// (988 call or text; Trans Lifeline). Keep them in step with content/support.json.
export const THERAPY_NOTE = '<div class="tn">Use with a therapist. Crisis: call or text <b>988</b> · Trans Lifeline <b>(877) 565-8860</b></div>';
const SKILLS_KEY = '0 none · 1–2 thought of · 3–5 tried · 6–7 came on their own · 5 and 7 helped';
// Thought record boxes (CBT): 3 = quick record, 5 = Beck style, 7 = Mind Over Mood style. Feelings/moods are rated 0-100 by hand.
const THOUGHT_BOXES = { 3: ['Thought', 'Trap', 'Balanced'], 5: ['Situation', 'Feeling %', 'Thought', 'Balanced', 'Outcome'], 7: ['Situation', 'Mood %', 'Thought', 'For', 'Against', 'Balanced', 'Mood now'] };
function renderBlock(b, parts, zone) {
  const Z = `data-zone="${zone}"`;
  switch (b.type) {
    case 'sky': case 'notes': case 'events': case 'fact': return parts[b.type] || '';
    case 'spoons': return `<div class="care solo">${spoonRow(b)}</div>`;
    case 'good': return `<div class="grat" ${Z}><b class="zl">${ic('heart', esc(b.label || 'Small good things'))}</b>${b.because ? `<div class="gbs">${Array(b.n).fill(`<div class="gb"><span class="lines" data-pitch="${b.pitch}" style="height:${(b.pitch + 0.02).toFixed(2)}in"></span><i>because</i><span class="lines" data-pitch="${b.pitch}" style="height:${(b.pitch + 0.02).toFixed(2)}in"></span></div>`).join('')}</div>` : `<span class="lines" data-pitch="${b.pitch}" style="height:${(b.n * b.pitch + 0.02).toFixed(2)}in"></span>`}</div>`;
    case 'body': return `<div class="${{ lines: 'ruled', bold: 'ruled bold', blank: 'plain', grid: 'grid', grid37: 'grid g37' }[b.style] || 'dots'} log${b.secretLine ? ' sl' : ''}" data-zone="body"></div>`;
    case 'actions': return actionZone(b.count, b.routines ? parts.routines || [] : [], b.h);
    case 'review': {
      const it = Object.keys(REVIEW_ITEMS).filter((k) => b.items[k]);
      return it.length ? `<div class="rev${it.length < 3 ? ` c${it.length}` : ''}" data-zone="review">${it.map((k) => `<div><b class="zl">${ic(k, REVIEW_ITEMS[k])}<i>${REVIEW_ITEMS[k]}</i></b><span class="lines" data-pitch="0.22"${b.h === 2 ? '' : ` style="height:${(b.h * 0.22).toFixed(2)}in"`}></span></div>`).join('')}</div>` : '';
    }
    case 'checks': return b.labels.length ? `<div class="xb xrow${b.omr ? ' omr' : ''}" ${Z}>${lbl('', b.title)}${b.labels.map((t) => box(`<span class="t">${esc(t)}</span>`)).join('')}</div>` : '';
    case 'scale': return `<div class="xb xrow${b.omr ? ' omr' : ''}" ${Z}>${lbl('', b.title)}<span class="end">${esc(b.lo)}</span>${scaleBubs(b)}<span class="end">${esc(b.hi)}</span></div>`;
    case 'words': return b.words.length ? `<div class="xb xrow wr" ${Z}>${lbl('', b.title)}${b.words.map((w) => `<span class="w">${esc(w)}</span>`).join('')}</div>` : '';
    case 'sensory': {
      const S = TYPES.sensory.opts[0].items, it = Object.keys(S).filter((k) => b.items[k]);
      return it.length ? `<div class="xb xrow wr" ${Z}>${lbl('ear', 'Sensory')}${it.map((k) => `<span class="sn">${S[k]} ${bubs(4)}</span>`).join('')}</div>` : '';
    }
    case 'sleeptimes': return `<div class="xb xrow" ${Z}>${lbl('sleep', 'Sleep')}<span class="f">bed <span class="blank"></span></span><span class="f">up <span class="blank"></span></span>${b.quality ? `<span class="end">rough</span>${bubs(5)}<span class="end">rested</span>` : ''}</div>`;
    case 'habits': return b.labels.length ? `<div class="xb xrow wr xhab" ${Z}>${lbl('', b.title)}${b.labels.map((t) => `<span class="hd"><span class="t">${esc(t)}</span><i></i></span>`).join('')}${b.tiny ? mkKey(['half', 'full'], { half: 'tiny', full: 'done' }) : mkKey(['half', 'full'])}</div>` : '';
    case 'fields': return `<div class="xb xrow wr" ${Z}>${lbl('', b.title)}${b.labels.map((t) => `<span class="f">${esc(t)} <span class="blank"></span></span>`).join('')}</div>`;
    case 'weather': return `<div class="xb xrow" ${Z}>${['am', 'cloud', 'rain', 'snow', ...(b.aqi ? ['smoke'] : [])].map((k) => `<span class="cir">${ic(k, k === 'am' ? 'Sun' : k)}</span>`).join('')}<span class="f">hi <span class="blank xs"></span></span><span class="f">lo <span class="blank xs"></span></span>${b.aqi ? '<span class="f">AQI <span class="blank xs"></span></span>' : ''}</div>`;
    case 'feelings': return b.labels.length ? `<div class="xb" ${Z}>${lbl('heart', b.title)}<div class="frs">${b.labels.map((t) => `<div class="fr"><span>${esc(t)}</span>${nbubs(6, 0)}</div>`).join('')}</div>${THERAPY_NOTE}</div>` : '';
    case 'skills': return `<div class="xb" ${Z}><div class="xrow">${lbl('sprout', b.title)}<span class="end">not used</span>${nbubs(8, 0)}<span class="end">used, helped</span></div>${b.key ? `<div class="skey">${SKILLS_KEY}</div>` : ''}${THERAPY_NOTE}</div>`;
    case 'urge': return b.labels.length ? `<div class="xb" ${Z}>${lbl('wave', b.title)}${b.labels.map((t) => `<div class="xrow ur"><span class="ul">${esc(t)}</span><span class="end">none</span>${nbubs(6, 0)}<span class="end">strong</span>${box('<span class="t">acted</span>')}</div>`).join('')}${THERAPY_NOTE}</div>` : '';
    case 'thought': {
      const names = THOUGHT_BOXES[b.cols] || THOUGHT_BOXES[3], first = b.cols === 3 ? 3 : Math.ceil(b.cols / 2);
      return `<div class="xb" ${Z}>${lbl('thought', 'Thought record')}${[names.slice(0, first), names.slice(first)].filter((r) => r.length).map((r) => `<div class="thr">${r.map((t) => `<div><i>${t}</i>${ruled(b.n)}</div>`).join('')}</div>`).join('')}${THERAPY_NOTE}</div>`;
    }
    case 'sites': return b.labels.length ? `<div class="xb xrow wr" ${Z}>${lbl('needle', b.title)}${b.labels.map((w) => `<span class="w">${esc(w)}</span>`).join('')}${b.time ? '<span class="f">time <span class="blank xs"></span></span>' : ''}</div>` : '';
    case 'bodysig': {
      const it = Object.keys(BODYSIG).filter((k) => b.items[k]);
      return it.length ? `<div class="xb" ${Z}>${lbl('body', 'Body signals')}${Array(b.n).fill(`<div class="xrow wr"><span class="f">at <span class="blank xs"></span></span>${it.map((k) => box(`<span class="t">${BODYSIG[k]}</span>`)).join('')}</div>`).join('')}</div>` : '';
    }
    case 'lines': return `<div class="xb" ${Z}>${lbl('', b.title)}${ruled(b.n, PAPER_CLS[b.paper] || '', b.pitch)}</div>`;
    case 'bullets': return `<div class="xb xbul" ${Z}>${b.title || b.key ? `<div class="xrow">${b.title ? lbl('', b.title) : ''}${b.key ? mkKey(['task', 'event', 'note', 'moved', 'done']) : ''}</div>` : ''}${Array(b.n).fill(`<div class="bl"><i></i><span${bs(b.pitch)}></span></div>`).join('')}</div>`;
    case 'split': return `<div class="xb xsplit" ${Z}><div>${lbl('', b.left)}${ruled(b.n, PAPER_CLS[b.paper] || '', b.pitch)}</div><div>${lbl('', b.right)}${ruled(b.n, PAPER_CLS[b.paper] || '', b.pitch)}</div></div>`;
    case 'top': {
      if (b.est || b.carried) { // extra columns after the line: bubbles, guess, took, carried; a header row names them
        const cols = (b.bubbles ? ['auto'] : []).concat(b.est ? ['0.5in', '0.5in'] : [], b.carried ? ['0.42in'] : []), g = `style="grid-template-columns:10px 1fr ${cols.join(' ')}"`;
        const head = `<div class="num te th" ${g}><span></span><span>${lbl('', b.title)}</span>${b.bubbles ? `<span class="tbub" style="visibility:hidden">${bubs(b.bubbles)}</span>` : ''}${b.est ? '<span class="tc">guess</span><span class="tc">took</span>' : ''}${b.carried ? '<span class="tc">carried</span>' : ''}</div>`;
        return `<div class="xb" ${Z}>${head}${Array.from({ length: b.n }, (_, i) => `<div class="num te" ${g}><span>${i + 1}</span>${ruled(1, '', b.pitch)}${b.bubbles ? `<span class="tbub">${bubs(b.bubbles)}</span>` : ''}${b.est ? `${ruled(1, 'tcl', b.pitch)}${ruled(1, 'tcl', b.pitch)}` : ''}${b.carried ? '<span class="tck"><i></i></span>' : ''}</div>`).join('')}</div>`;
      }
      return `<div class="xb" ${Z}>${lbl('', b.title)}${Array.from({ length: b.n }, (_, i) => b.bubbles ? `<div class="num tb"><span>${i + 1}</span>${ruled(1, '', b.pitch)}<span class="tbub">${bubs(b.bubbles)}</span></div>` : `<div class="num"><span>${i + 1}</span>${ruled(1, '', b.pitch)}</div>`).join('')}</div>`;
    }
    case 'sketch': return `<div class="xb" ${Z}>${b.caption ? `<div class="xrow">${b.title ? lbl('', b.title) : ''}<span class="cap">${esc(b.caption)}</span></div>` : b.title ? lbl('', b.title) : ''}<div class="sk-box${b.corners ? ' tp' : ''}" style="height:${(b.h / 10).toFixed(1)}in">${b.corners ? '<i class="tm a"></i><i class="tm b"></i><i class="tm c"></i><i class="tm d"></i>' : ''}</div></div>`;
    case 'timeline': {
      const hrs = []; for (let h = b.from; h < Math.max(b.to, b.from + 1); h += b.every) hrs.push(h);
      const cols = ['plan'].concat(b.actual ? ['actual'] : [], Array.from({ length: b.replan }, (_, i) => (b.replan > 1 ? `re-plan ${i + 1}` : 're-plan')));
      if (cols.length === 1) return `<div class="xb xtl" ${Z}>${hrs.map((h) => `<div><span class="hr">${hour(h)}</span>${ruled(1, '', b.pitch)}</div>`).join('')}</div>`;
      // plan + actual / re-plan columns: two halves side by side, or one wide list from three columns up
      const head = `<div class="xth"><span></span>${cols.map((c) => `<span>${c}</span>`).join('')}</div>`;
      return `<div class="xb xtl xtc${cols.length > 2 ? ' w1' : ''}" style="--tc:${cols.length}" ${Z}>${head}${cols.length > 2 ? '' : head}${hrs.map((h) => `<div><span class="hr">${hour(h)}</span>${cols.map(() => ruled(1, '', b.pitch)).join('')}</div>`).join('')}</div>`;
    }
    case 'shift': return `<div class="xb" ${Z}><div class="xrow">${lbl('work', 'Shift')}<span class="f">in <span class="blank"></span></span><span class="f">out <span class="blank"></span></span><span class="f">break <span class="blank"></span></span></div>${b.n ? ruled(b.n) : ''}</div>`;
    case 'bus': return `<div class="xb" ${Z}>${Array.from({ length: b.n }, (_, i) => `<div class="xrow">${i ? '<b class="xl"></b>' : lbl('bus', 'Bus')}<span class="f">route <span class="blank xs"></span></span><span class="f">stop <span class="blank"></span></span><span class="f">leave <span class="blank xs"></span></span><span class="f">back <span class="blank xs"></span></span></div>`).join('')}</div>`;
    case 'money': return `<div class="xb" ${Z}>${lbl('coin', 'Spent')}<div class="xmoney">${Array(b.n).fill('<span class="f"><span class="blank long"></span> $<span class="blank xs"></span></span>').join('')}</div></div>`;
    case 'reach': return `<div class="xb xrow wr" ${Z}>${lbl('people', 'Reach out')}${Array(b.n).fill(box('<span class="blank"></span>')).join('')}</div>`;
    case 'tl24': {
      const dy = parts.day || SAMPLE_DAY, rise = clock(dy.rise), set = clock(dy.set), night = b.shade && rise !== null && set !== null;
      const hrs = Array.from({ length: 24 }, (_, i) => (b.start + i) % 24);
      const row = (name) => `<div class="tlr"><span class="tln">${name}</span>${hrs.map((h) => `<i${night && (h + 0.5 < rise || h + 0.5 > set) ? ' class="nt"' : ''}></i>`).join('')}</div>`;
      return `<div class="xb xtl24"${b.h === 0.18 ? '' : ` style="--th:${b.h}in"`} ${Z}><div class="tlr th"><span class="tln">${ic('clock', '24 h')}</span>${hrs.map((h, i) => `<span>${i % b.every === 0 ? hour(h) : ''}</span>`).join('')}</div>${row('plan')}${b.actual ? row('actual') : ''}</div>`;
    }
    case 'dump': return `<div class="xb" ${Z}><div class="dbox"><b class="dbl">${lbl('dump', b.title)}</b>${b.paper === 'blank' ? `<span class="blk" style="height:${(b.n * PITCH_IN[b.pitch]).toFixed(2)}in"></span>` : ruled(b.n, b.paper === 'dots' ? 'pd' : '', b.pitch)}</div></div>`;
    case 'later': return `<div class="xb xbul" ${Z}><div class="hrw">${lbl('next', b.title)}${ruled(1, '', b.pitch)}</div>${Array(b.n - 1).fill(`<div class="bl">${mk('moved')}<span${bs(b.pitch)}></span></div>`).join('')}</div>`;
    case 'done': return `<div class="xb xbul dn" ${Z}><div class="hrw">${lbl('well', b.title)}${ruled(1, '', b.pitch)}</div>${Array(b.n - 1).fill(`<div class="bl">${b.gutter ? '<i class="bx"></i>' : mk('done')}<span${bs(b.pitch)}></span></div>`).join('')}</div>`;
    case 'wall': return `<div class="xb xwall" ${Z}>${b.words.length ? `<div class="xrow wr">${lbl('wall', b.title)}${b.words.map((w) => `<span class="w">${esc(w)}</span>`).join('')}</div>` : `<div class="xrow">${lbl('wall', b.title)}</div>`}${b.ways.length ? `<div class="xrow wr"><span class="wl">${ic('next', 'A way past')}a way past</span>${b.ways.map((w) => `<span class="w">${esc(w)}</span>`).join('')}</div>` : ''}${b.n ? ruled(b.n, '', b.pitch) : ''}</div>`;
    case 'stamps': return `<div class="xb xst" ${Z}>${Array.from({ length: b.n }, (_, i) => `<div class="str"><span class="tsc">${i ? '<i class="sp"></i>' : ic('clock', b.title)}__:__</span>${ruled(1, '', b.pitch)}</div>`).join('')}${b.resume ? `<div class="str rs"><span class="tsc">${ic('next', 'Resume with')}</span>${ruled(1, '', b.pitch)}</div>` : ''}</div>`;
    case 'rounds': return `<div class="xb xrd" style="--rc:${b.marks ? 'auto 1fr auto auto' : 'auto 1fr auto'}" ${Z}>${Array.from({ length: b.n }, (_, i) => `<div class="rr"><span class="rn">${i ? i + 1 : lbl('rounds', b.title)}</span>${ruled(1, '', b.pitch)}<span class="rbx">${Array(b.boxes).fill('<i></i>').join('')}${!i && b.len ? `<span class="cap">${esc(b.len)}</span>` : ''}</span>${b.marks ? `<span class="rty"><span>${mk('me')}</span><span>${mk('other')}</span></span>` : ''}</div>`).join('')}</div>`;
    case 'energy': return b.labels.length ? `<div class="xb xrow wr" ${Z}>${lbl('bolt', b.title)}${b.labels.map((t) => `<span class="sn">${esc(t)} ${bubs(b.steps)}</span>`).join('')}</div>` : '';
    case 'accounts': return `<div class="xb" ${Z}><div class="xrow">${lbl('spoon', b.title)}<span class="f">start <span class="blank xs"></span></span><span class="f rgt">left ${b.x4 ? `${ic('x4', 'X4')}<span class="dim">X4</span>` : '<span class="blank xs"></span>'}</span></div><div class="xmoney">${Array(b.n).fill('<span class="f"><span class="blank long"></span> <span class="blank xs"></span></span>').join('')}</div></div>`;
    case 'weekstrip': return `<div class="xb" ${Z}><div class="wsk" style="height:${(b.h / 10).toFixed(1)}in">${weekOf((parts.day || SAMPLE_DAY).date).map((x) => `<span class="wsc${x.today ? ' td' : ''}"><b>${x.l}</b><i>${x.d === 1 ? MON3[x.m] + ' 1' : x.d}</i></span>`).join('')}</div></div>`;
    case 'keep': return `<div class="xb" ${Z}><div class="hrw">${lbl('keep', b.title)}${ruled(1, '', b.pitch)}${b.moved ? box('moved') : ''}</div>${b.n > 1 ? ruled(b.n - 1, '', b.pitch) : ''}${b.source ? '<div class="xrow"><span class="f">from <span class="blank long"></span></span></div>' : ''}</div>`;
    case 'lookback': { const dy = parts.day || SAMPLE_DAY, when = lookBack(dy.date, b.period); return `<div class="xb" ${Z}><div class="hrw">${lbl('back', b.period === 'year' ? 'A year ago today' : 'A month ago today')}${when ? `<span class="cap">${when}</span>` : ''}${ruled(1, '', b.pitch)}</div>${b.n > 1 ? ruled(b.n - 1, '', b.pitch) : ''}</div>`; }
    case 'prompt': { const [tag, text] = promptFor((parts.day || SAMPLE_DAY).date, b.every); return `<div class="xb" ${Z}><div class="hrw">${ic('text', 'Prompt: ' + tag)}<span class="pq">${esc(text)}</span>${ruled(1, '', b.pitch)}${b.pass ? box('pass') : ''}</div>${b.n > 1 ? ruled(b.n - 1, '', b.pitch) : ''}</div>`; }
    case 'pixel': return `<div class="xb xrow xpx" ${Z}>${lbl('pixel', 'Day pixel')}<span class="pxb"></span>${b.key ? '<span class="end">low</span>' : ''}${Array.from({ length: b.levels }, (_, i) => `<span class="pxc">${swatch(i, b.levels)}<i></i></span>`).join('')}${b.key ? '<span class="end">high</span>' : ''}</div>`;
    case 'range': return `<div class="xb xrow wr" ${Z}>${lbl('', b.title)}${[['low', 'Lowest'], ['high', 'Highest']].map(([k, t]) => `<span class="sn">${ic(k, t)}<span class="end">${esc(b.lo)}</span> ${bubs(b.steps)} <span class="end">${esc(b.hi)}</span></span>`).join('')}</div>`;
    case 'divider': return b.icon === 'sun' || b.icon === 'moon' ? `<div class="xdiv xdi"><i></i>${ic(b.icon === 'sun' ? 'am' : 'pm', b.icon === 'sun' ? 'Sun' : 'Moon')}<i></i></div>` : `<div class="xdiv"></div>`;
    case 'spacer': return `<div class="xsp" style="height:${(b.h / 10).toFixed(1)}in"></div>`;
  }
  return '';
}

// parts: pre-built, data-driven strings from render.mjs: header, sky, notes, events, fact ('' when none), routines [].
// opt.tag (editor only): mark each block's outer element with data-b="<uid>" so the preview can be dragged.
export function dayBlocks(parts, layout, opt = {}) {
  const L = normalize(layout, opt.size);
  if (L.grid) return gridBlocks(parts, L, opt);
  const on = L.blocks.filter((b) => b.on);
  const count = {}, out = [];
  const push = (b, h) => { if (h && b.roomy) h = h.replace(/class="xb( |")/, 'class="xb rm$1'); if (h) out.push(opt.tag ? h.replace(/^<div/, `<div data-b="${b.uid}"`) : h); };
  for (let i = 0; i < on.length; i++) {
    const b = on[i];
    count[b.type] = (count[b.type] || 0) + 1;
    const zone = count[b.type] > 1 ? `${b.type}_${count[b.type]}` : b.type;
    if (b.type === 'care') {
      const sp = on[i + 1] && on[i + 1].type === 'spoons' ? on[++i] : null; // spoons right after care share its box
      push(b, careBox(b, on, sp));
      continue;
    }
    push(b, renderBlock(b, parts, zone));
  }
  return `<div class="day full">\n    ${parts.header}\n    ${out.join('\n    ')}\n  </div>`;
}
// The care check-in box (rows in two columns, the X4 line, and the spoons row when it rides along); '' when nothing is on.
function careBox(b, on, sp) {
  const rowH = b.rows.filter((r) => r.on).map(careRow).filter(Boolean);
  const note = x4Note(b, on.some((x) => x.type === 'spoons')); // a spoons block anywhere on the page counts
  // The X4 line takes the last free cell of the two-column grid; on an even row count it spans the width.
  const grid = rowH.join('') + (note ? note.replace('class="x4n"', `class="x4n${rowH.length % 2 ? '' : ' wide'}"`) : '');
  return grid || sp ? `<div class="care" data-zone="care">${grid ? `<div class="cg2">${grid}</div>` : ''}${sp ? spoonRow(sp) : ''}</div>` : '';
}

// Grid layout: the same block HTML, each block in one cell (.gc) that spans its grid rectangle. The cell carries the block's single
// data-zone (its rectangle is the scan zone: the zone name of the block's first element moves to the cell) and, in the editor, data-b.
// Blocks with room to spare (Lined notes, Two columns, Sketch box, Brain dump, Writing space) fill their cell: extra rows become lines.
// A grid layout that breaks a rule cannot print: the build stops and says why (the editor passes opt.tag and shows the problems instead).
const FILLS = new Set(['body', 'lines', 'split', 'sketch', 'dump']);
function gridBlocks(parts, L, opt) {
  const size = opt.size === 'letter' ? 'letter' : 'small', probs = gridProblems(L, size);
  if (probs.length && !opt.tag) throw new Error('The day page grid layout cannot be printed:\n - ' + probs.map((x) => x.msg).join('\n - '));
  const on = L.blocks.filter((b) => b.on), count = {}, seen = {}, out = [];
  for (const b of on) {
    count[b.type] = (count[b.type] || 0) + 1;
    let h = b.type === 'care' ? careBox(b, on, null) : renderBlock(b, parts, count[b.type] > 1 ? `${b.type}_${count[b.type]}` : b.type);
    if (!h) continue; // data-driven blocks (holidays, events, the fact) leave their cell empty on days without one
    if (b.roomy) h = h.replace(/class="xb( |")/, 'class="xb rm$1');
    const m = /data-zone="([^"]+)"/.exec(h);
    let zone = m ? m[1] : b.type;
    if (m) h = h.replace(` data-zone="${zone}"`, '');
    seen[zone] = (seen[zone] || 0) + 1; if (seen[zone] > 1) zone += `_${seen[zone]}`;
    out.push(`<div class="gc${FILLS.has(b.type) ? ' fill' : ''}" data-zone="${zone}"${opt.tag ? ` data-b="${b.uid}"` : ''} style="grid-column:${b.col}/span ${b.colSpan};grid-row:${b.row}/span ${b.rowSpan}">${h}</div>`);
  }
  return `<div class="day full gm">\n    ${parts.header}\n    <div class="gg" style="--gr:${gridRows(size)}">\n    ${out.join('\n    ')}\n    </div>\n  </div>`;
}

// Extra CSS the blocks need (appended to the page CSS).
export const DAYPAGE_CSS = `
.rev .zl { display: flex; align-items: center; gap: 3px; } .rev .zl i { font-style: normal; font-size: 6.5pt; letter-spacing: 0.4px; white-space: nowrap; }
.cbi { display: flex; flex-wrap: wrap; align-items: center; gap: 2px 10px; padding: 3px 0 4px; font-size: 7.5pt; line-height: 1.2; border-bottom: 1px solid #DCDCDC; }
.ci { display: inline-flex; align-items: center; gap: 4px; max-width: 100%; } .ci i { width: 10px; height: 10px; border: 1.2px solid #000; flex: none; } .ci span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .cbi .more { font-style: italic; color: #444; }
.rev.c2 { grid-template-columns: 1fr 1fr; } .rev.c1 { grid-template-columns: 1fr; }
.x4n { display: flex; align-items: center; gap: 4px; height: 0.23in; font: 500 6.2pt Inter, sans-serif; color: #555; white-space: nowrap; } .x4n.wide { grid-column: 1 / -1; } .x4n .ic { width: 10px; height: 10px; margin-right: 1px; }
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
.bub.n { flex-direction: column; align-items: center; } .bub.n:nth-child(5) i { border-width: 1px; } .bub.n.mid i { border-width: 1.6px; } .bub.n em { font: normal 500 6.3pt/1 Inter, sans-serif; color: #222; margin-top: 1px; min-width: 12px; text-align: center; }
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
.ru.p26:not(.pg):not(.pd) { background: repeating-linear-gradient(to bottom, transparent 0 calc(0.26in - 1pt), #a0a0a0 calc(0.26in - 1pt) 0.26in); }
.ru.p33:not(.pg):not(.pd) { background: repeating-linear-gradient(to bottom, transparent 0 calc(0.335in - 1pt), #a0a0a0 calc(0.335in - 1pt) 0.335in); }
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

/* Roomy spacing (option on single-row blocks): more height per row, nothing else changes */
.xb.rm { padding: 6px 0 5px; } .xb.rm.xrow, .xb.rm .xrow { min-height: 0.34in; gap: 10px; } .xb.rm.xrow.wr, .xb.rm .xrow.wr { row-gap: 7px; } .xb.rm .xmoney { row-gap: 9px; }
/* Tier 2 blocks: palette-only, so none of this touches today's page */
.xtl24 .tlr { display: grid; grid-template-columns: 0.42in repeat(24, 1fr); align-items: stretch; } .xtl24 .tlr > i { height: var(--th, 0.18in); border-left: 1px solid #888; border-bottom: 1px solid #888; border-top: 1px solid #888; } .xtl24 .tlr > i:last-child { border-right: 1px solid #888; } .xtl24 .tlr > i.nt { background: #d4d4d4; }
.xtl24 .tln { font: 500 5.5pt Inter, sans-serif; text-transform: uppercase; letter-spacing: 0.4px; color: #555; align-self: center; } .xtl24 .tln .ic { width: 10px; height: 10px; } .xtl24 .th span { font: 500 5.6pt Inter, sans-serif; color: #444; white-space: nowrap; overflow: visible; height: 0.12in; }
.dbox { border: 1px solid #999; border-radius: 2px; margin-top: 2px; padding: 0 3px; position: relative; } .dbox .ru { margin: 0; } .blk { display: block; } .dbl { position: absolute; left: 3px; top: 3px; background: #fff; padding: 0 3px; z-index: 1; } .dbl .xl { margin: 0; }
.hrw { display: flex; align-items: flex-end; gap: 4px; min-height: 0.22in; } .hrw > .ru { flex: 1; min-width: 0.4in; } .hrw > .xl { align-self: center; } .hrw .ck { align-self: center; } .hrw .cap { align-self: center; white-space: nowrap; } .hrw .ic { align-self: center; }
.xbul .bl .bmk { margin-bottom: 3px; } .xbul.dn .bl i.bx { width: 8px; height: 8px; border: 1.1px solid #000; border-radius: 0; background: none; margin-bottom: 3px; }
.xwall .wl { font: 500 6pt Inter, sans-serif; color: #555; letter-spacing: 0.3px; display: inline-flex; align-items: center; gap: 3px; } .xwall .w { border: 1px solid #999; border-radius: 999px; padding: 0 5px; }
.xst .str { display: grid; grid-template-columns: 0.5in 1fr; align-items: end; } .xst .tsc { font: 500 6.5pt Inter, sans-serif; color: #777; padding-bottom: 2px; letter-spacing: 0.3px; display: inline-flex; align-items: center; gap: 3px; } .xst .tsc .ic { width: 10px; height: 10px; color: #333; } .xst .tsc .sp { width: 10px; height: 10px; }
.xrd { display: grid; grid-template-columns: var(--rc); column-gap: 4px; align-items: end; } .xrd .rr { display: contents; } .xrd .rn { font-weight: 600; padding-bottom: 2px; justify-self: start; } .xrd .rbx { display: inline-flex; align-items: center; gap: 3px; padding-bottom: 3px; } .xrd .rbx i { width: 9px; height: 9px; border: 1.1px solid #000; display: block; } .xrd .rbx .cap { margin-left: 2px; white-space: nowrap; }
.xrd .rty { display: inline-flex; gap: 4px; padding-bottom: 1px; } .xrd .rty span { width: 0.3in; height: 0.17in; border-bottom: 1px solid #a0a0a0; display: inline-flex; align-items: flex-end; color: #666; }
.rgt { margin-left: auto; } .xb .f.rgt { margin-left: auto; } .xb .f .ic { width: 10px; height: 10px; align-self: center; }
.wsk { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; margin-top: 2px; } .wsc { border: 1px solid #999; border-radius: 2px; padding: 1px 3px; display: flex; justify-content: space-between; align-items: flex-start; font: 500 6pt Inter, sans-serif; color: #444; } .wsc b { font-weight: 600; letter-spacing: 0.4px; } .wsc i { font-style: normal; font-weight: 700; color: #000; } .wsc.td { border: 1.8px solid #000; padding: 0 2px; }
.pq { font: italic 500 7.5pt/1.2 Inter, sans-serif; color: #222; align-self: center; }
.xpx { gap: 4px; } .xpx .pxb { width: 0.3in; height: 0.3in; border: 1.4px solid #000; border-radius: 2px; margin-right: 4px; flex: none; } .xpx .pxc { display: inline-flex; flex-direction: column; align-items: center; gap: 1px; } .xpx .pxs { width: 12px; height: 12px; display: block; } .xpx .pxc i { width: 8px; height: 8px; border: 1px solid #000; border-radius: 50%; display: block; }
/* Tier 2 care blocks: therapy pack (feelings, skills, urge, thought record) and body (sites, body signals) */
.tn { font: 500 6pt Inter, sans-serif; color: #555; margin-top: 2px; line-height: 1.2; } .tn b { font-weight: 700; color: #333; }
.frs { display: grid; grid-template-columns: 1fr 1fr; column-gap: 14px; } .fr { display: flex; align-items: center; gap: 3px; min-height: 0.2in; } .fr > span:first-child { flex: none; width: 0.62in; font: 500 7pt Inter, sans-serif; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.skey { font: 500 6pt Inter, sans-serif; color: #444; margin-top: 1px; line-height: 1.25; }
.xrow.ur .ul { font: 600 7pt Inter, sans-serif; min-width: 0.5in; max-width: 0.9in; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .xrow.ur .ck { margin-left: auto; }
.thr { display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; column-gap: 8px; margin-top: 1px; } .thr > div { min-width: 0; } .thr i { display: block; font: 600 5.8pt Inter, sans-serif; font-style: normal; text-transform: uppercase; letter-spacing: 0.4px; color: #555; }
/* Page grid (layout switch "Grid"; see GRIDS): 4 columns, rows 0.22 in high, one cell (.gc) per block. Nothing here touches the flow layout. */
.day.gm .gg { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); grid-template-rows: repeat(var(--gr), 0.22in); column-gap: 8px; height: calc(var(--gr) * 0.22in); flex: none; }
.gc { min-width: 0; min-height: 0; overflow: hidden; display: flex; flex-direction: column; }
.day.full.gm .gc > * { margin-top: 0; }
.day.full.gm .gc > .log { flex: 1; min-height: 0; }
.gc.fill > .xb { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.gc.fill > .xb > .ru, .gc.fill .sk-box, .gc.fill .dbox > .ru, .gc.fill .dbox > .blk { flex: 1; min-height: 0; height: auto !important; }
.gc.fill .dbox { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.gc.fill > .xb.xsplit { display: grid; grid-template-rows: minmax(0, 1fr); }
.gc.fill .xsplit > div { display: flex; flex-direction: column; min-height: 0; } .gc.fill .xsplit > div > .ru { flex: 1; min-height: 0; height: auto !important; }
`;
