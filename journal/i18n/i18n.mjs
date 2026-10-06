// Journalwright Studio message catalogs: the tiny lookup + format helper, and the pseudo-locales.
// Shared by the editor build (editor/build.mjs inlines this file into the page: keep it dependency-free and
// browser-safe) and by the tests (test-i18n.mjs, editor/test.mjs). BUILD-PLAN section 18, slice I1.
//
// Catalog: a flat { key: message } object (i18n/en.json is the source). A message is plain text or HTML, with
//   {name}                                   a variable
//   {n, plural, one {# page} other {# pages}}   plurals; "=0 {no pages}" for an exact count; # is the number
// Braces are always syntax (no escaping): a message never needs a literal brace. Apostrophes are plain text.
// Pseudo-locales (made from en.json, never stored): en-XA (accented, about a third longer, in [brackets]: finds
// strings that are still hard-coded and layouts that break when text grows) and ar-XB (the same text forced
// right to left: finds layouts that do not mirror).

export const LOCALES = {
  en: { dir: 'ltr', plural: 'en' },
  'en-XA': { dir: 'ltr', plural: 'en', pseudo: true },
  'ar-XB': { dir: 'rtl', plural: 'en', pseudo: true },
};
export const PSEUDO = Object.keys(LOCALES).filter((l) => LOCALES[l].pseudo);
export const dirOf = (locale) => (LOCALES[locale] || { dir: /^(ar|he|fa|ur)\b/.test(locale) ? 'rtl' : 'ltr' }).dir;

// ---------- parse ----------
// nodes: { text } | { arg: name } | { plural: name, opts: { one: nodes, other: nodes, '=0': nodes } } | { hash: true } (# inside a plural)
export function parse(msg) {
  let i = 0;
  const fail = (why) => { throw new Error(`bad message (${why}) at ${i}: ${msg}`); };
  function nodes(inPlural, top) {
    const out = []; let text = '';
    const flush = () => { if (text) out.push({ text }); text = ''; };
    while (i < msg.length) {
      const c = msg[i];
      if (c === '}') { if (top) fail('unmatched }'); break; }
      if (c === '#' && inPlural) { flush(); out.push({ hash: true }); i++; continue; }
      if (c !== '{') { text += c; i++; continue; }
      flush(); i++;
      const end = msg.slice(i).search(/[,}]/); if (end < 0) fail('unclosed {');
      const name = msg.slice(i, i + end).trim(); if (!/^\w+$/.test(name)) fail('bad name "' + name + '"');
      i += end;
      if (msg[i] === '}') { i++; out.push({ arg: name }); continue; }
      i++; // the comma
      const kind = msg.slice(i).match(/^\s*(\w+)\s*,/); if (!kind || kind[1] !== 'plural') fail('only plural is supported');
      i += kind[0].length;
      const opts = {};
      for (;;) {
        const sel = msg.slice(i).match(/^\s*(=\d+|\w+)\s*\{/);
        if (!sel) break;
        i += sel[0].length;
        opts[sel[1]] = nodes(true, false);
        if (msg[i] !== '}') fail('unclosed plural branch'); i++;
      }
      if (!msg.slice(i).match(/^\s*\}/)) fail('unclosed plural'); i += msg.slice(i).match(/^\s*\}/)[0].length;
      if (!opts.other) fail('plural needs an "other" branch');
      out.push({ plural: name, opts });
    }
    flush();
    return out;
  }
  const out = nodes(false, true);
  if (i < msg.length) fail('trailing text');
  return out;
}

export function serialize(ns) {
  return ns.map((n) => n.text !== undefined ? n.text : n.arg !== undefined ? `{${n.arg}}` : n.hash ? '#'
    : `{${n.plural}, plural, ${Object.entries(n.opts).map(([k, v]) => `${k} {${serialize(v)}}`).join(' ')}}`).join('');
}

// The variable names a message uses (sorted, unique): the placeholder check compares these between locales.
export function placeholders(msg) {
  const names = new Set();
  (function walk(ns) { for (const n of ns) { if (n.arg !== undefined) names.add(n.arg); if (n.plural !== undefined) { names.add(n.plural); Object.values(n.opts).forEach(walk); } } })(parse(msg));
  return [...names].sort();
}
// The plural categories a message spells out, e.g. ['other', 'one'] (for a locale that needs more, the catalog adds them).
export function pluralKeys(msg) {
  const out = [];
  (function walk(ns) { for (const n of ns) if (n.plural !== undefined) { out.push(...Object.keys(n.opts)); Object.values(n.opts).forEach(walk); } })(parse(msg));
  return out;
}

// ---------- format ----------
const cache = new Map();
const parsed = (m) => { let p = cache.get(m); if (!p) { p = m.includes('{') ? parse(m) : [{ text: m }]; cache.set(m, p); } return p; };
const rules = new Map();
const cat = (locale, n) => { const k = (LOCALES[locale] || {}).plural || locale; let r = rules.get(k); if (!r) { r = new Intl.PluralRules(k); rules.set(k, r); } return r.select(n); };
export function format(msg, vars = {}, locale = 'en') {
  const run = (ns, num) => ns.map((n) => {
    if (n.text !== undefined) return n.text;
    if (n.hash) return String(num);
    if (n.arg !== undefined) return n.arg in vars ? String(vars[n.arg]) : `{${n.arg}}`;
    const v = Number(vars[n.plural]);
    const opt = n.opts['=' + v] || n.opts[cat(locale, v)] || n.opts.other;
    return run(opt, v);
  }).join('');
  return run(parsed(msg));
}

// ---------- lookup ----------
// createT({ catalogs: { en: {...}, ... }, locale: 'en' }) -> t(key, vars). An untranslated key falls back to English; an unknown
// key returns the key itself, so a typo is visible on screen and in the tests (t.missing lists them).
export function createT({ catalogs, locale = 'en', fallback = 'en' }) {
  const own = catalogs[locale] || {}, fb = catalogs[fallback] || {}, missing = new Set(), fellBack = new Set();
  const t = (key, vars) => {
    let m = own[key];
    if (m === undefined) { m = fb[key]; if (m === undefined) { missing.add(key); return key; } fellBack.add(key); }
    return format(m, vars, locale);
  };
  t.locale = locale; t.dir = dirOf(locale); t.missing = missing; t.fellBack = fellBack;
  return t;
}

// ---------- pseudo-locales ----------
const ACCENT = { a: 'á', b: 'ƀ', c: 'ç', d: 'ð', e: 'é', f: 'ƒ', g: 'ĝ', h: 'ĥ', i: 'í', j: 'ĵ', k: 'ķ', l: 'ļ', m: 'ɱ', n: 'ñ', o: 'ö', p: 'þ', q: 'ǫ', r: 'ŕ', s: 'š', t: 'ţ', u: 'û', v: 'ṽ', w: 'ŵ', x: 'ẋ', y: 'ý', z: 'ž',
  A: 'Á', B: 'Ɓ', C: 'Ç', D: 'Ð', E: 'É', F: 'Ƒ', G: 'Ĝ', H: 'Ĥ', I: 'Í', J: 'Ĵ', K: 'Ķ', L: 'Ļ', M: 'Ṁ', N: 'Ñ', O: 'Ö', P: 'Þ', Q: 'Ǫ', R: 'Ŕ', S: 'Š', T: 'Ţ', U: 'Û', V: 'Ṽ', W: 'Ŵ', X: 'Ẋ', Y: 'Ý', Z: 'Ž' };
const RLM = '‏', RLO = '‮', PDF = '‬';
// Text outside HTML tags and entities only: <b class="x"> and &amp; stay exactly as they are.
const plainParts = (s) => s.split(/(<[^>]*>|&#?\w+;)/).map((p, i) => ({ p, markup: i % 2 === 1 }));
function pseudoText(s, kind) {
  return plainParts(s).map(({ p, markup }) => {
    if (markup || !/\S/.test(p)) return p;
    if (kind === 'en-XA') return p.replace(/[A-Za-z]/g, (c) => ACCENT[c]);
    return RLM + RLO + p + PDF + RLM; // ar-XB: right to left, forced, so Latin text reads backwards: obvious when it is not mirrored
  }).join('');
}
export function pseudo(msg, kind = 'en-XA') {
  const walk = (ns, top) => {
    const out = ns.map((n) => n.text !== undefined ? { text: pseudoText(n.text, kind) }
      : n.plural !== undefined ? { plural: n.plural, opts: Object.fromEntries(Object.entries(n.opts).map(([k, v]) => [k, walk(v, false)])) } : n);
    if (kind === 'en-XA') { // about a third longer, so layouts that only fit the short English show it: pad the last text of each run
      const len = ns.reduce((a, n) => a + (n.text ? n.text.replace(/<[^>]*>|&#?\w+;/g, '').length : 0), 0);
      const pad = ' ' + '~~~ '.repeat(Math.ceil(Math.max(3, len / 3) / 4)).trim(); // groups, so the extra length can wrap like words (one long run would force a sideways scroll that no real text causes)
      for (let j = out.length - 1; j >= 0; j--) if (out[j].text !== undefined && /\S/.test(out[j].text.replace(/<[^>]*>/g, ''))) { out[j] = { text: out[j].text + pad }; break; }
    }
    if (kind === 'en-XA' && top && out.length) out.unshift({ text: '[' }), out.push({ text: ']' });
    return out;
  };
  return serialize(walk(parsed(msg), true));
}
export function pseudoCatalog(en, kind) { return Object.fromEntries(Object.entries(en).map(([k, v]) => [k, pseudo(v, kind)])); }

// A catalog for any locale the page or a test asks for: the real file when there is one, else a pseudo-locale made from English.
export function catalogFor(locale, en, real = {}) { return real[locale] || (LOCALES[locale] && LOCALES[locale].pseudo ? pseudoCatalog(en, locale) : null); }
