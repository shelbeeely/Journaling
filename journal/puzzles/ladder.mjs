// Word ladder: turn the start word into the end word by changing ONE letter at a time, every step a real word.
//   generateLadder({ length, steps, seed, start, end, extra }) -> { length, steps, asked, words: [start, ..., end], ways, custom }
// The words come from a small original dictionary of everyday words (samples2.mjs PZ_LD_WORDS). A breadth-first search over it finds the
// shortest ladder between two words, so every puzzle printed has a ladder that is VERIFIED to exist and to be the shortest one.
// With no words given, a seeded start word is picked and the end word is one that the search finds exactly `steps` steps away.
// `ways` = how many different shortest ladders there are (the answer key shows one; any of them is right). Pure: no fs, no DOM. Names start with pz.
import { pzRng, pzInt, pzShuffle } from './rng.mjs';
import { PZ_LD_WORDS } from './samples2.mjs';

export const PZ_LD_LENGTHS = [3, 4, 5], PZ_LD_STEPS_MIN = 2, PZ_LD_STEPS_MAX = 8;
const pzLdCache = {};
export function pzLdDict(len, extra = []) {
  const key = len + '|' + extra.join(',');
  if (pzLdCache[key]) return pzLdCache[key];
  const words = (PZ_LD_WORDS[len] || '').split(' ').filter(Boolean).concat(extra.filter((w) => w.length === len));
  return (pzLdCache[key] = new Set(words));
}
const pzLdAlpha = 'abcdefghijklmnopqrstuvwxyz';
export function pzLdNeighbours(dict, w) {
  const o = [];
  for (let i = 0; i < w.length; i++) for (const c of pzLdAlpha) { if (c === w[i]) continue; const v = w.slice(0, i) + c + w.slice(i + 1); if (dict.has(v)) o.push(v); }
  return o;
}
// Breadth first from a word: Map word -> { d, n } (distance and the number of shortest ways to reach it).
export function pzLdFrom(dict, a) {
  const info = new Map([[a, { d: 0, n: 1 }]]), q = [a];
  for (let h = 0; h < q.length; h++) for (const v of pzLdNeighbours(dict, q[h])) {
    const u = info.get(v), here = info.get(q[h]);
    if (!u) { info.set(v, { d: here.d + 1, n: here.n }); q.push(v); } else if (u.d === here.d + 1) u.n = Math.min(u.n + here.n, 9999);
  }
  return info;
}
// One shortest ladder from a to b (the first found in alphabetical order, so it is the same everywhere), or null.
export function pzLdPath(dict, a, b) {
  if (!dict.has(a) || !dict.has(b)) return null;
  const from = pzLdFrom(dict, b); // distances to b: walk from a downhill
  if (!from.has(a)) return null;
  const path = [a];
  while (path[path.length - 1] !== b) {
    const cur = path[path.length - 1], d = from.get(cur).d;
    path.push(pzLdNeighbours(dict, cur).filter((v) => from.get(v) && from.get(v).d === d - 1).sort()[0]);
  }
  return path;
}
export function generateLadder({ length = 4, steps = 4, seed = '', start = '', end = '', extra = [] } = {}) {
  const len = PZ_LD_LENGTHS.includes(+length) ? +length : 4, want = Math.max(PZ_LD_STEPS_MIN, Math.min(PZ_LD_STEPS_MAX, Math.round(+steps) || 4));
  const s0 = String(start).toLowerCase().replace(/[^a-z]/g, ''), e0 = String(end).toLowerCase().replace(/[^a-z]/g, '');
  if (s0 && e0 && s0.length === e0.length && s0 !== e0 && s0.length >= 3 && s0.length <= 5) { // the person's own pair: their words join the dictionary
    const dict = pzLdDict(s0.length, [s0, e0, ...extra.map((w) => w.toLowerCase())]), path = pzLdPath(dict, s0, e0);
    if (path && path.length - 1 >= 2 && path.length - 1 <= PZ_LD_STEPS_MAX) return { length: s0.length, steps: path.length - 1, asked: want, words: path, ways: pzLdFrom(dict, s0).get(e0).n, custom: true };
  }
  const dict = pzLdDict(len), r = pzRng(`ladder|${len}|${want}|${seed}`);
  const starts = pzShuffle(r, [...dict].filter((w) => pzLdNeighbours(dict, w).length >= 2));
  for (const target of [want, want - 1, want - 2].filter((t) => t >= PZ_LD_STEPS_MIN && t <= PZ_LD_STEPS_MAX)) {
    for (const a of starts) {
      const info = pzLdFrom(dict, a), ends = [...info.entries()].filter(([, v]) => v.d === target).map(([w]) => w).sort();
      if (!ends.length) continue;
      const b = ends[pzInt(r, ends.length)];
      return { length: len, steps: target, asked: want, words: pzLdPath(dict, a, b), ways: info.get(b).n, custom: false };
    }
  }
  throw new Error(`word ladder: no ladder of ${want} steps for ${len}-letter words`);
}
// The letter that changes at each step (0-based position), for the "show the changing letter" hint.
export const pzLdChanges = (words) => words.slice(1).map((w, i) => [...w].findIndex((c, k) => c !== words[i][k]));
