// Fewer decisions (BUILD-PLAN section 24): the guided questions, the ready-made books, the Basic view's eight blocks, the recommended values and what
// is remembered. No browser (editor/test-guided.mjs does the screen). Sample data only.
//   node test-presets.mjs
import fs from 'node:fs';
import { TYPES, PRESETS, normalize, allowedIn, newBlock, DEFAULT_LAYOUT, CARE_ROWS, ROW_OPTS } from './daypage.mjs';
import { planProblems } from './plan.mjs';
import { validateLibrary, addBook } from './library.mjs';
import { MODULES } from './modules.mjs';
import {
  QUESTIONS, QUESTION_IDS, TRACK, TRACK_IDS, STARTERS, STARTER_IDS, BASIC_TYPES, BASIC_OPTS, RECOMMENDED, ROOM_BUDGET, PAGES_PER_MONTH,
  guidedBook, starterBook, starterAnswers, cleanAnswers, cleanLast, lastOf, lengthFacts, planFor, recOf, isRec, GUIDED_STRINGS, genericStart, LAST_VERSION,
} from './presets.mjs';

const fails = [], ok = (c, m) => { if (!c) fails.push(m); console.log((c ? 'ok   ' : 'FAIL ') + m); };
const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const clone = (x) => JSON.parse(JSON.stringify(x));
const EN = JSON.parse(read('i18n/en.json'));

// ---------- the questions ----------
ok(QUESTIONS.length === 5, 'five questions');
ok(QUESTION_IDS.join() === 'trim,length,track,tone,room', 'they are size, length, what to track, tone and room to write');
ok(QUESTIONS.every((q) => (q.kind === 'many' ? q.rec.every((r) => q.o.some((o) => o[0] === r)) : q.o.some((o) => o[0] === q.rec))), 'every question has a recommended answer that is one of its options');
ok(QUESTIONS.every((q) => q.q && q.hint && q.o.length >= 2 && q.o.every((o) => o[0] && o[1] && o[2])), 'every question and every option has plain words and a hint');
ok(QUESTIONS.find((q) => q.id === 'track').o.map((o) => o[0]).join() === TRACK_IDS.join(), 'every thing to track has an entry and every entry is offered');
ok(JSON.stringify(cleanAnswers({})) === JSON.stringify({ ...RECOMMENDED(), start: cleanAnswers({}).start }) && /^\d{4}-\d{2}$/.test(cleanAnswers({}).start), 'no answers = the recommended answers');
{
  const a = cleanAnswers({ trim: 'a5', length: 'decade', track: ['mood', 'nonsense', 'sleep'], tone: 5, room: null, start: '2026-13' });
  ok(a.trim === 'small' && a.length === 'month' && a.track.join() === 'mood,sleep' && a.tone === 'balanced' && a.room === 'some' && /^\d{4}-(0[1-9]|1[0-2])$/.test(a.start), 'unknown or stale answers fall back to the recommended one; known ones are kept, in order');
}
ok(cleanAnswers({ track: [] }).track.length === 0, 'a person can track nothing: the page is just the writing space');

// ---------- guided books: every combination ----------
const BOOK_OK = (start = '2026-11') => (g) => {
  const lib = addBook({ version: 1, books: [{ id: 'x', title: 'X' }], series: [], layouts: [], defaultBook: 'x' }, { title: 'A guided book', start, plan: g.plan, ...(Object.keys(g.modules).length ? { modules: g.modules } : {}) }).library;
  return validateLibrary(lib).length === 0;
};
{
  let n = 0, bad = [], worst = 0;
  const subsets = [];
  for (let m = 0; m < 1 << TRACK_IDS.length; m += 7) subsets.push(TRACK_IDS.filter((_, i) => m >> i & 1)); // a spread of 147 subsets; the loop below also takes all ten singles and the full set
  for (const id of TRACK_IDS) subsets.push([id]);
  subsets.push(TRACK_IDS);
  const q = (id) => QUESTIONS.find((x) => x.id === id).o.map((o) => o[0]);
  for (const trim of q('trim')) for (const length of q('length')) for (const tone of q('tone')) for (const room of q('room')) for (const track of subsets) {
    const g = guidedBook({ trim, length, track, tone, room, start: '2026-11' }); n++;
    const types = g.layout.blocks.map((b) => b.type), uids = g.layout.blocks.map((b) => b.uid);
    const chosen = TRACK.filter((t) => track.includes(t.id)).map((t) => t.id);
    const problems = [];
    if (JSON.stringify(normalize(g.layout)) !== JSON.stringify(g.layout)) problems.push('not stable under normalize');
    if (!types.includes('body') || !g.layout.blocks.find((b) => b.type === 'body').on) problems.push('no writing space');
    if (new Set(uids).size !== uids.length) problems.push('duplicate uid');
    if ([...g.kept, ...g.left].sort().join() !== [...chosen].sort().join()) problems.push('kept + left is not what was chosen');
    if (g.kept.length > ({ gentle: 3, balanced: 5, full: 99 })[tone]) problems.push('more things than the tone allows');
    if (chosen.length && !g.kept.length) problems.push('nothing kept although something was chosen');
    if (g.kept.length > 1 && g.used > ROOM_BUDGET[room] + 1e-6) problems.push('over the room budget');
    if (!BOOK_OK()(g)) problems.push('the library refuses the book');
    if (!g.layout.blocks.every((b) => allowedIn('day', b.type))) problems.push('a block that is not for day pages');
    worst = Math.max(worst, g.used);
    if (problems.length) bad.push(`${trim}/${length}/${tone}/${room}/${track.join('+')}: ${problems.join(', ')}`);
  }
  ok(!bad.length, `${n} answer combinations each make a finished, valid book with a writing space` + (bad.length ? `: ${bad.slice(0, 3).join(' | ')}` : ''));
  ok(worst <= ROOM_BUDGET.compact + 0.2, `the biggest guided page asks for ${worst.toFixed(2)} in of blocks, within the largest budget`);
}
{
  const g = guidedBook({});
  ok(g.kept.join() === 'tasks,mood,good' && !g.left.length, 'the recommended answers keep everything they recommend (nothing is left off)');
  ok(g.plan.scope === 'month' && g.trim === 'small', 'and make a one-month book at 5.5 x 8.5');
  const calm = guidedBook({ tone: 'gentle', track: TRACK_IDS });
  ok(calm.kept.length <= 3 && calm.left.length >= 7, 'a gentle page keeps at most three things and says which it left off');
  ok(calm.layout.blocks.filter((b) => ['checks', 'scale', 'words', 'sleeptimes'].includes(b.type)).every((b) => b.roomy), 'a gentle page makes its check-ins roomy');
  ok(guidedBook({ track: [] }).layout.blocks.map((b) => b.type).join() === 'body', 'tracking nothing gives the writing space alone');
  ok(guidedBook({ length: 'undated' }).plan.scope === 'undated' && guidedBook({ length: 'undated' }).plan.undated.days === 28, 'undated is 28 day pages');
  ok(lengthFacts('year').volumes === 12 && lengthFacts('year').about === 12 * PAGES_PER_MONTH && lengthFacts('month').about === PAGES_PER_MONTH && lengthFacts('undated').days === 28, 'the length facts: a month is about 80 pages, a year is twelve volumes');
  ok(['month', 'quarter', 'half-year', 'year', 'undated'].every((l) => planProblems({ ...planFor(l, '2026-11').plan, start: '2026-11' }).length === 0), 'every length is a plan the build accepts');
}

// ---------- ready-made books ----------
ok(STARTERS.length === 4 && STARTER_IDS.join() === 'daily-planner,mood-log,low-energy,art-practice', 'four ready-made books: a daily planner, a mood log, a low-energy week and art practice');
for (const s of STARTERS) {
  const b = starterBook(s.id, { trim: 'letter', start: '2026-11' }), types = b.layout.blocks.map((x) => x.type), uids = b.layout.blocks.map((x) => x.uid);
  ok(JSON.stringify(normalize(b.layout)) === JSON.stringify(b.layout) && types.every((t) => TYPES[t]) && new Set(uids).size === uids.length, `${s.id}: a normal day layout, every block real, no duplicate uid`);
  ok(types.includes('body') && b.layout.blocks.find((x) => x.type === 'body').on && types.length <= 6, `${s.id}: keeps the writing space and has at most five blocks besides it`);
  ok(BOOK_OK('2026-11')(b) && b.trim === 'letter', `${s.id}: the library accepts it as a book`);
  ok(Object.keys(b.modules).every((k) => MODULES[k]), `${s.id}: its modules are real`);
  const a = starterAnswers(s.id);
  ok(QUESTION_IDS.every((id) => id in a), `${s.id}: "change things" can open the five questions on its choices`);
  ok(s.name && s.blurb && s.icon && !/spokane|keeping watch|shelbee/i.test(JSON.stringify(s)), `${s.id}: named in plain words, nothing personal`);
}
ok(starterBook('low-energy').plan.scope === 'undated' && starterBook('low-energy').modules.spoons === true, 'the low-energy week is undated, so a missed day costs nothing, and turns spoons on');
ok(starterBook('nope') === null, 'an unknown ready-made book is nothing');

// ---------- Basic view ----------
ok(BASIC_TYPES.length === 8 && new Set(BASIC_TYPES).size === 8 && BASIC_TYPES.every((t) => TYPES[t] && allowedIn('day', t)), 'Basic offers eight everyday blocks, each a real block for a day page');
ok(BASIC_TYPES.every((t) => !TYPES[t].locked), 'none of them is the locked writing space (that is always there)');
ok(Object.keys(TYPES).length - BASIC_TYPES.length > 20, 'the rest are still there: Advanced shows every block (nothing is removed)');
ok(Number.isInteger(BASIC_OPTS) && BASIC_OPTS >= 2 && BASIC_OPTS <= 4, `Basic shows the first ${BASIC_OPTS} options of a block, then "more options"`);

// ---------- recommended values ----------
{
  let n = 0, bad = [];
  const each = (label, opts, make) => { for (const o of opts) { n++; const b = make(); if (!isRec(o, b[o.k])) bad.push(`${label}.${o.k}`); } };
  for (const [t, d] of Object.entries(TYPES)) { const b = newBlock(t); each(t, d.opts, () => b); }
  ok(!bad.length && n > 150, `every option of every block (${n}) has a recommended value, and a new block starts on it` + (bad.length ? `: ${bad.slice(0, 5).join(', ')}` : ''));
  ok(Object.keys(ROW_OPTS).every((id) => CARE_ROWS[id]), 'care rows are left as they are: their defaults come from the row');
  const o = TYPES.scale.opts.find((x) => x.k === 'steps');
  ok(recOf(o) === 5 && isRec(o, 5) && !isRec(o, 7), 'recOf and isRec: the scale\'s recommended steps are 5');
  const f = TYPES.sensory.opts.find((x) => x.k === 'items'), r = recOf(f); r.sound = false;
  ok(recOf(f).sound === true, 'recOf returns a copy: changing it never changes the block library');
  ok(JSON.stringify(normalize(null)) === JSON.stringify(normalize(DEFAULT_LAYOUT)) && DEFAULT_LAYOUT.blocks.map((b) => b.type).join() === 'sky,notes,events,care,spoons,good,body,actions,review,fact', 'the default day layout is untouched');
}

// ---------- what is remembered ----------
{
  const g = guidedBook({ tone: 'gentle', track: ['mood', 'sleep'], length: 'quarter', trim: 'letter' });
  const last = lastOf({ answers: g.answers, starter: 'mood-log', layout: g.layout, plan: g.plan, modules: { spoons: true, bus: true }, trim: 'letter' });
  ok(last && last.v === LAST_VERSION && last.answers.start === '' && last.starter === 'mood-log' && last.trim === 'letter', 'a remembered book keeps its answers, starter and size, and not its first month');
  ok(JSON.stringify(last.modules) === '{"spoons":true}', 'only the modules a book chooses for itself (sky, spoons, therapy) are kept: bus and trans support depend on the person\'s packs');
  const dirty = { ...last, title: 'A private title', profile: { person: { name: 'Sam' } }, location: 'Lakemont', calendar: 'BEGIN:VCALENDAR', pack: 'my-pack', layout: { v: 2, blocks: [...last.layout.blocks, { uid: 'g-x', type: 'checks', on: true, labels: ['Stretch'], note: 'private note', secret: 'x' }] } };
  const c = cleanLast(dirty), s = JSON.stringify(c);
  ok(c && ['private', 'Sam', 'Lakemont', 'VCALENDAR', 'my-pack'].every((w) => !s.includes(w)), 'cleanLast drops a title, a profile, a place, a calendar, a pack and any field a block does not declare');
  ok(JSON.stringify(Object.keys(c).sort()) === JSON.stringify(['answers', 'layout', 'modules', 'plan', 'starter', 'trim', 'v']), 'and keeps only these seven fields');
  ok(cleanLast(null) === null && cleanLast({ v: 99, answers: {} }) === null && cleanLast('x') === null && cleanLast([]) === null, 'anything that is not a v1 remembered start is nothing');
  ok(cleanLast({ v: 1, answers: {}, layout: { blocks: Array.from({ length: 500 }, (_, i) => ({ uid: 'u' + i, type: 'checks', labels: ['x'.repeat(24)] })) } }) === null || JSON.stringify(cleanLast({ v: 1, answers: {}, layout: { blocks: Array.from({ length: 500 }, (_, i) => ({ uid: 'u' + i, type: 'checks', labels: ['x'.repeat(24)] })) } })).length <= 16000, 'a remembered start is size-capped');
  ok(cleanLast({ v: 1, answers: {}, plan: { scope: 'custom', custom: { start: '2020-01-01' } } }).plan.scope === 'month', 'a plan that is not one of the guided lengths becomes a month');
  ok(JSON.stringify(cleanLast(clone(c))) === JSON.stringify(c), 'cleaning twice changes nothing');
  ok(genericStart().layout === DEFAULT_LAYOUT && genericStart().plan.scope === 'month' && !Object.keys(genericStart().modules).length, 'with nothing remembered a new book starts from the generic default: the original page, one month');
}

// ---------- the words ----------
{
  const S = GUIDED_STRINGS(), keys = Object.keys(S);
  ok(keys.length > 40 && keys.every((k) => /^guided\.d_[a-z0-9_]+$/.test(k)), `${keys.length} table strings, keyed guided.d_*`);
  const missing = keys.filter((k) => EN[k] !== S[k]), extra = Object.keys(EN).filter((k) => k.startsWith('guided.d_') && !(k in S));
  ok(!missing.length && !extra.length, 'i18n/en.json has every one, with the same English, and no stale guided.d_ key' + (missing.length || extra.length ? `: run node -e (see test-presets.mjs) ${[...missing, ...extra].slice(0, 3)}` : ''));
  // the tone: a guide, not a taskmaster. No words that push or blame.
  const all = Object.entries(EN).filter(([k]) => k.startsWith('guided.')).map(([k, v]) => [k, v]);
  const GUILT = /\b(must|fail(ed|ure)?|behind|lazy|guilt\w*|miss(ed)?|catch up|streak|overdue|shame\w*|wrong|bad|never|forgot\w*|ought|have to|need to|try harder)\b/i;
  const hit = all.filter(([, v]) => GUILT.test(v));
  ok(!hit.length, 'no guilt or pressure wording in any guided string' + (hit.length ? `: ${hit.slice(0, 3).map(([k, v]) => k + ' "' + v + '"').join(' | ')}` : ''));
  const blurbs = STARTERS.flatMap((s) => [s.name, s.blurb]).concat(QUESTIONS.flatMap((q) => [q.q, q.hint, ...q.o.flatMap((o) => [o[1], o[2]])]));
  ok(!blurbs.some((t) => GUILT.test(t)) && blurbs.every((t) => t.length <= 120), 'the question and ready-made book words are short and calm too');
  ok(!/spokane|keeping watch|shelbee/i.test(read('presets.mjs') + read('editor/guided.js') + read('editor/guided.html') + read('editor/guided.css') + JSON.stringify(Object.entries(EN).filter(([k]) => k.startsWith('guided.')))), 'nothing personal in the guided start, its words or its styles');
  ok(PRESETS.length > 30 && Object.keys(TYPES).includes('top'), 'the block library is as it was (the existing block presets are separate from the ready-made books)');
}

console.log(fails.length ? `\n${fails.length} check(s) failed` : '\npresets: all checks passed');
process.exit(fails.length ? 1 : 0);
