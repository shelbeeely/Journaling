// The six month-end totals, one definition for the Closing page (render.mjs), the Keeper's handoff boxes (keeper.mjs)
// and the X4's This month screen (x4/src/app.cpp; check-handoff.mjs keeps its two labels in step with this file).
// Each box says where its number comes from, because the care split gives every item exactly one home:
//   paper tracker (the month's tracker page) -> mood, meds, meals, work hours
//   X4 This month (Menu -> This month)       -> sleep, spoons left
export const SRC = {
  paper: { key: 'paper', tag: 'from the paper tracker' },
  x4: { key: 'x4', tag: 'from X4 · This month' },
};
export const HANDOFF_BOXES = [
  { id: 'mood', label: 'Avg mood', unit: '−3…+3', src: 'paper' },
  { id: 'meds', label: 'Meds taken', unit: 'days, all doses', src: 'paper' },
  { id: 'meals', label: 'Avg meals', unit: 'a day, 0–3', src: 'paper' },
  { id: 'work', label: 'Work hours', unit: 'h', src: 'paper' },
  { id: 'sleep', label: 'Avg sleep', unit: 'hours', src: 'x4' },
  { id: 'spoons', label: 'Good-spoon days', unit: '4+ left', src: 'x4' },
];
export const GOOD_SPOON_NOTE = 'Good-spoon day: 4 or more spoons left. The X4 counts spoons left and adds up the days for you.';
// Same HTML shape on both pages: a small caption per source, then its boxes. `cell(label, unit)` draws one box, `grid(html)` wraps a group.
// `omit`: box ids to leave out (the profile's spoons module off drops "spoons").
export function handoffHtml({ cell, grid, caption, trackerPage, omit = [] }) {
  return Object.values(SRC).map((s) => {
    const boxes = HANDOFF_BOXES.filter((b) => b.src === s.key && !omit.includes(b.id));
    const where = s.key === 'paper' ? (trackerPage ? `tracker, p. ${trackerPage}` : 'tracker page') : 'Menu → This month';
    return `${caption(s.tag, where)}${grid(boxes.map((b) => cell(b.label, b.unit)).join(''))}`;
  }).join('');
}
