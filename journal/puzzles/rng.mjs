// Seeded randomness for the puzzle generators: the same seed string always gives the same numbers, on every machine and every run
// (no Math.random, no Date). A string seed is hashed (xmur3) and drives a small fast generator (mulberry32).
// The editor build inlines this file with its imports and exports stripped, so every top-level name here starts with pz.
function pzHash(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  return () => { h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return (h ^= h >>> 16) >>> 0; };
}
// pzRng('some seed') -> () => a float in [0, 1)
export function pzRng(seed) {
  let a = pzHash(String(seed))();
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const pzInt = (r, n) => Math.floor(r() * n);
export function pzShuffle(r, list) { const a = list.slice(); for (let i = a.length - 1; i > 0; i--) { const j = pzInt(r, i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
// The letters a word is made of: upper case A-Z only (other characters are dropped).
export const pzWord = (w) => String(w).toUpperCase().replace(/[^A-Z]/g, '');
