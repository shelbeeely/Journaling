// Method layouts: one-click starting points for the day page editor ("More > Start from a method").
// Each is a normal v2 layout built only from the block types and options in daypage.mjs, so it prints,
// passes check.mjs at both sizes, and (for checks/scale/habits/fields) exports to the X4 like any layout.
// Uids stay fixed so X4 check-in keys (c_<uid>_<label>) keep their history if you re-apply a method.
// build.mjs inlines this file into the editor after daypage.mjs (imports and "export" stripped),
// so top-level names here must not clash with daypage.mjs.
import { DEFAULT_LAYOUT, normalize } from '../daypage.mjs';

const methodBlock = (type, uid, o = {}) => ({ uid, type, on: true, ...o });
const methodLayout = (blocks) => normalize({ v: 2, blocks: blocks.map(([t, u, o]) => methodBlock(t, u, o)) });

export const METHOD_LAYOUTS = [
  {
    id: 'original', name: 'Keeping Watch original',
    blurb: 'Care check-in, spoons, writing space and a short review.',
    layout: DEFAULT_LAYOUT,
  },
  {
    id: 'bujo', name: 'Bullet Journal daily',
    blurb: 'A rapid log with the bullet key, then open dot grid.',
    layout: methodLayout([
      ['sky', 'sky'], ['events', 'events'],
      ['bullets', 'bujo-log', { title: 'Daily log', n: 8, key: true }],
      ['body', 'body', { style: 'dots' }], ['actions', 'actions'],
    ]),
  },
  {
    id: 'hobonichi', name: 'Hobonichi',
    blurb: 'Time blocks over a quiet 4 mm grid, one line of history.',
    layout: methodLayout([
      ['sky', 'sky'], ['fact', 'fact'],
      ['timeline', 'timeline', { from: 8, to: 22, every: 2 }],
      ['body', 'body', { style: 'grid' }],
      ['good', 'gratitude', { n: 2 }],
    ]),
  },
  {
    id: 'fiveminute', name: 'Five Minute (AM/PM)',
    blurb: 'Gratitude and intention in the morning, good things at night.',
    layout: methodLayout([
      ['lines', 'fm-grateful', { title: "I'm grateful for", n: 3 }],
      ['lines', 'fm-good', { title: 'What would make today good', n: 2 }],
      ['lines', 'fm-iam', { title: 'I am…', n: 1 }],
      ['body', 'body', { style: 'dots' }],
      ['lines', 'fm-three', { title: 'Three good things today', n: 3 }],
      ['lines', 'fm-better', { title: 'What could have gone better', n: 1 }],
    ]),
  },
  {
    id: 'theme', name: 'Theme System day',
    blurb: 'Where you are, two gratitudes, one goal and half-fill habit dots.',
    layout: methodLayout([
      ['fields', 'ts-where', { title: 'Where I am', labels: ['Energy', 'Focus'] }],
      ['lines', 'ts-grat-personal', { title: 'Grateful: personal', n: 1 }],
      ['lines', 'ts-grat-work', { title: 'Grateful: work', n: 1 }],
      ['lines', 'ts-goal', { title: 'One goal', n: 1 }],
      ['habits', 'ts-habits', { title: 'Habits', labels: ['Stretch', 'Outside', 'Read', 'Water'] }],
      ['body', 'body', { style: 'dots' }],
    ]),
  },
];
