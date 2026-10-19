// Cryptogram: a short sentence written in a substitution cipher (each letter always stands for the same other letter). Seeded.
//   generateCryptogram({ text, seed }) -> { plain, cipher, key (plain letter -> cipher letter), counts (cipher letter -> times), hint: { plain, cipher } }
// The key is a DERANGEMENT of the alphabet: no letter stands for itself, so no letter of the sentence is ever printed as itself. Only A-Z are
// enciphered; spaces, commas, full stops and other marks stay as they are. Decoding the cipher with the key gives back the sentence exactly.
// The hint is the most frequent letter of the sentence (a good first foothold). Pure: no fs, no DOM. Names start with pz.
import { pzRng, pzInt, pzShuffle } from './rng.mjs';

const pzCrAbc = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
export const PZ_CR_MAX = 110, PZ_CR_MIN_LETTERS = 12;
// The sentence as the puzzle uses it: tidy spaces, upper case, only characters the boxes can show.
export const pzCrClean = (t) => String(t).replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[^A-Za-z .,;:!?'"-]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();
export const pzCrLetters = (t) => (String(t).match(/[A-Z]/g) || []).length;
export function pzCrKey(r) {
  for (let tries = 0; tries < 200; tries++) {
    const p = pzShuffle(r, pzCrAbc.split(''));
    if (p.every((c, i) => c !== pzCrAbc[i])) return Object.fromEntries(p.map((c, i) => [pzCrAbc[i], c]));
  }
  const p = pzCrAbc.split('').map((_, i) => pzCrAbc[(i + 1 + pzInt(r, 24)) % 26]); // (not reached in practice) a shifted alphabet is a derangement too
  return Object.fromEntries(p.map((c, i) => [pzCrAbc[i], c]));
}
export const pzCrEncode = (text, key) => text.replace(/[A-Z]/g, (c) => key[c]);
export const pzCrDecode = (cipher, key) => { const back = Object.fromEntries(Object.entries(key).map(([p, c]) => [c, p])); return cipher.replace(/[A-Z]/g, (c) => back[c]); };
export function generateCryptogram({ text = '', seed = '' } = {}) {
  const plain = pzCrClean(text).slice(0, PZ_CR_MAX);
  const key = pzCrKey(pzRng(`cryptogram|${plain}|${seed}`)), cipher = pzCrEncode(plain, key), counts = {};
  for (const c of cipher.match(/[A-Z]/g) || []) counts[c] = (counts[c] || 0) + 1;
  const pc = {}; for (const c of plain.match(/[A-Z]/g) || []) pc[c] = (pc[c] || 0) + 1;
  const top = Object.keys(pc).sort((a, b) => pc[b] - pc[a] || (a < b ? -1 : 1))[0];
  return { plain, cipher, key, counts, hint: top ? { plain: top, cipher: key[top] } : null };
}
// Words laid out in lines of at most `perLine` boxes (a space takes `gap` of a box). Returns lines of words (strings, marks attached to their word).
export function pzCrWrap(text, perLine, gap = 0.6) {
  const lines = [[]]; let used = 0;
  for (const w of text.split(' ')) {
    const wide = w.length;
    if (lines[lines.length - 1].length && used + gap + wide > perLine) { lines.push([]); used = 0; }
    const l = lines[lines.length - 1];
    used += (l.length ? gap : 0) + wide; l.push(w);
  }
  return lines;
}
// The sentence a cryptogram block uses: from the given items, seeded; `length` is any, short (up to 34 letters) or long (more).
export function pzCrPick(items, length, seed) {
  const ok = items.map(pzCrClean).filter((t) => pzCrLetters(t) >= PZ_CR_MIN_LETTERS && t.length <= PZ_CR_MAX);
  const by = length === 'short' ? ok.filter((t) => pzCrLetters(t) <= 34) : length === 'long' ? ok.filter((t) => pzCrLetters(t) > 34) : ok;
  const pool = by.length ? by : ok;
  return pool.length ? pool[pzInt(pzRng(`pick|${seed}`), pool.length)] : '';
}
