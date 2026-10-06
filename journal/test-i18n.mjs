// Languages check (BUILD-PLAN section 18, slice I1): the message catalog and the editor's extraction of its words.
//   node test-i18n.mjs
// 1. The helper: placeholders, plurals, fallback, pseudo-locales.
// 2. The catalog: every message parses; every locale (the generated pseudo-locales, and any i18n/<lang>.json) has every key of en.json, no extras,
//    the same placeholders in every message.
// 3. The editor: every key the code asks for exists, no key is left unused, the data-table keys are in step with the tables.
// 4. No hard-coded English in the extracted areas (best effort: i18n/allow.json lists the few exceptions); the static HTML is marked, and what is marked
//    says what en.json says.
// 5. The print strings report (i18n/print-strings.md) is current.
// Printed words (pages.mjs, daypage.mjs ...) are not extracted yet (slice I3); this test does not look at them.
import fs from 'node:fs';
import vm from 'node:vm';
import { createT, format, parse, placeholders, pseudo, pseudoCatalog, PSEUDO, LOCALES, dirOf } from './i18n/i18n.mjs';
import { DYNAMIC_PREFIXES } from './i18n/tables.mjs';
import { synced } from './i18n/sync-tables.mjs';
import { lex } from './i18n/lex.mjs';
import { scanHtml, norm } from './i18n/htmlscan.mjs';
import { printReport } from './i18n/print-report.mjs';

const here = (p) => new URL(p, import.meta.url);
const read = (p) => fs.readFileSync(here(p), 'utf8');
const fails = [], ok = (c, m) => { if (!c) fails.push(m); console.log((c ? 'ok   ' : 'FAIL ') + m); };

// ---------- 1. the helper ----------
{
  const t = createT({ catalogs: { en: { a: 'Hi {name}', n: '{n, plural, =0 {no pages} one {# page} other {# pages}}', only: 'Only English' }, xx: { a: 'Salut {name}' } }, locale: 'xx' });
  ok(t('a', { name: 'Ada' }) === 'Salut Ada', 'a message takes its variables');
  ok(t('only') === 'Only English' && t.fellBack.has('only'), 'an untranslated key falls back to English');
  ok(t('nope') === 'nope' && t.missing.has('nope'), 'an unknown key shows as itself and is listed as missing');
  ok(['0', '1', '5'].map((n) => format('{n, plural, =0 {no pages} one {# page} other {# pages}}', { n })).join('|') === 'no pages|1 page|5 pages', 'plurals: =0, one, other');
  ok(format('{n} of {total}', { n: 2 }) === '2 of {total}', 'a variable that is not given stays visible');
  ok(placeholders('{a} and {n, plural, one {# {b}} other {# {b}s}}').join() === 'a,b,n', 'placeholders() finds variables, plural selectors and nested ones');
  let bad = 0; for (const m of ['{a', '{a, select, x {y}}', '{n, plural, one {x}}', 'a } b']) { try { parse(m); } catch { bad++; } }
  ok(bad === 4, 'malformed messages are refused (open brace, select, plural without other, stray close)');
  ok(pseudo('Save <b>{n}</b> &amp; go', 'en-XA').includes('<b>{n}</b> &amp;') && /^\[.*\]$/.test(pseudo('Save', 'en-XA')) && pseudo('Save', 'en-XA').length > 6, 'en-XA accents and lengthens text, never tags, entities or variables');
  ok(pseudo('Save {n}', 'ar-XB').includes('‮') && placeholders(pseudo('Save {n}', 'ar-XB')).join() === 'n', 'ar-XB forces right-to-left text and keeps the variable');
  ok(dirOf('ar-XB') === 'rtl' && dirOf('en-XA') === 'ltr' && dirOf('en') === 'ltr' && dirOf('he') === 'rtl', 'text direction per locale');
}

// ---------- 2. the catalog ----------
const EN = JSON.parse(read('i18n/en.json'));
const keys = Object.keys(EN);
ok(keys.length > 500, `en.json has ${keys.length} messages`);
{
  let bad = [];
  for (const [k, v] of Object.entries(EN)) { if (!/^[a-z0-9_]+(\.[a-z0-9_]+)+$/.test(k)) bad.push(`key ${k}`); try { parse(v); } catch (e) { bad.push(`${k}: ${e.message}`); } }
  ok(!bad.length, 'every key is lower-case dotted words and every message parses' + (bad.length ? ': ' + bad.slice(0, 5).join('; ') : ''));
}
const locales = { ...Object.fromEntries(PSEUDO.map((l) => [l, pseudoCatalog(EN, l)])) };
for (const f of fs.readdirSync(here('i18n/'))) if (/^[a-z]{2,3}(-[A-Za-z0-9]+)?\.json$/.test(f) && f !== 'en.json') locales[f.replace('.json', '')] = JSON.parse(read('i18n/' + f));
for (const [loc, cat] of Object.entries(locales)) {
  const missing = keys.filter((k) => !(k in cat)), extra = Object.keys(cat).filter((k) => !(k in EN));
  const mism = keys.filter((k) => k in cat).filter((k) => { try { return placeholders(cat[k]).join() !== placeholders(EN[k]).join(); } catch { return true; } });
  ok(!missing.length, `${loc}: no key missing` + (missing.length ? ` (${missing.slice(0, 5).join(', ')} ...)` : ''));
  ok(!extra.length, `${loc}: no key that en.json does not have` + (extra.length ? ` (${extra.slice(0, 5).join(', ')})` : ''));
  ok(!mism.length, `${loc}: every message has the same placeholders as English` + (mism.length ? ` (${mism.slice(0, 5).join(', ')})` : ''));
}
ok(LOCALES['en-XA'].pseudo && LOCALES['ar-XB'].dir === 'rtl', 'the two pseudo-locales exist: en-XA (accented, longer) and ar-XB (mirrored)');

// ---------- 3. the editor's code ----------
const AREAS = [ // the editor's own UI: its script and static HTML. Add a file here when the editor grows one.
  { file: 'editor/template.html', js: true, html: true },
  { file: 'i18n/runtime.js', js: true },
  { file: 'editor/organiser.js', js: true }, { file: 'editor/library-ui.js', js: true }, { file: 'editor/versions.js', js: true },
  { file: 'editor/organiser.html', html: true }, { file: 'editor/library-ui.html', html: true }, { file: 'editor/versions.html', html: true },
];
const allow = JSON.parse(read('i18n/allow.json'));
const allowJs = new Set(allow.js), allowHtml = new Set(allow.html);
// all tokens, including the ones inside ${ ... } of template literals
function tokens(src, base = 0, out = []) { for (const t of lex(src)) { out.push({ ...t, start: t.start + base }); if (t.k === 'tpl') for (const p of t.parts) if (p.e !== undefined) tokens(p.e, base + p.at, out); } return out; }
const jsOf = (a) => { const s = read(a.file); if (a.file.endsWith('.html')) { const i = s.indexOf('<script>\n'); return { src: s.slice(i + 8), line0: s.slice(0, i).split('\n').length - 1 }; } return { src: s, line0: 0 }; };
const used = new Set(), dynamicUse = [], badCalls = [];
const syn = (cond, m) => ok(cond, m);
for (const a of AREAS.filter((x) => x.js)) {
  const { src } = jsOf(a), toks = tokens(src);
  for (let i = 0; i < toks.length - 2; i++) {
    const t = toks[i];
    if (t.k === 'id' && (t.v === '_t' || t.v === '_tx') && toks[i + 1].v === '(') {
      const k = toks[i + 2];
      if (k.k === 'str') used.add(k.v);
      else if (!a.file.endsWith('runtime.js')) badCalls.push(`${a.file}:${src.slice(0, t.start).split('\n').length} ${t.v}( without a literal key`);
    }
  }
}
// the markers in the static HTML are uses too
const htmlItems = {};
for (const a of AREAS.filter((x) => x.html)) {
  htmlItems[a.file] = scanHtml(read(a.file));
  for (const it of htmlItems[a.file]) if (it.key && it.key !== '-') used.add(it.key);
}
syn(!badCalls.length, '_t() and _tx() always get a literal key' + (badCalls.length ? ': ' + badCalls.slice(0, 3).join('; ') : ''));
const isPrefix = (k) => /[._]$/.test(k);
const missingKeys = [...used].filter((k) => !isPrefix(k) && !(k in EN));
ok(!missingKeys.length, 'every key the editor asks for is in en.json' + (missingKeys.length ? ': ' + missingKeys.slice(0, 8).join(', ') : ''));
const dyn = (k) => DYNAMIC_PREFIXES.some((p) => k.startsWith(p));
const unused = keys.filter((k) => !used.has(k) && !dyn(k));
ok(!unused.length, 'no message is left unused in en.json' + (unused.length ? ': ' + unused.slice(0, 8).join(', ') : ''));
{
  const next = JSON.stringify(synced(EN), null, 1) + '\n';
  ok(next === read('i18n/en.json'), 'the table keys of en.json (block., care., preset., pagekind., method., scan.) are in step with the code tables' + (next === read('i18n/en.json') ? '' : ': run node i18n/sync-tables.mjs'));
}

// ---------- 4. no hard-coded English in the extracted areas ----------
// Static HTML: every text node, title, label and placeholder that has words is marked with a key, and en.json says what the HTML says.
const rx = (m) => new RegExp('^' + m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\{\w+\\\}/g, '[\\s\\S]*') + '$');
const dec = (s) => s.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
for (const [file, items] of Object.entries(htmlItems)) {
  const unmarked = items.filter((it) => !it.key && !allowHtml.has(norm(dec(it.value)))).map((it) => it.value.slice(0, 50));
  ok(!unmarked.length, `${file}: every word on the page is marked for translation (data-i18n)` + (unmarked.length ? `: ${unmarked.slice(0, 4).join(' | ')}` : ''));
  const drift = items.filter((it) => it.key && it.key !== '-' && it.key in EN).filter((it) => !rx(it.kind === 'html' ? norm(EN[it.key]) : norm(EN[it.key])).test(it.kind === 'html' ? it.value : norm(dec(it.value)))).map((it) => `${it.key}: "${it.value.slice(0, 40)}" vs "${EN[it.key].slice(0, 40)}"`);
  ok(!drift.length, `${file}: the HTML English is what en.json says` + (drift.length ? ': ' + drift.slice(0, 3).join(' | ') : ''));
}
// Script: a string or template text that reads like English (two or more words, or a capitalised word) outside _t().
const PROSE = /(^|[^A-Za-z])[A-Za-z’']{3,}[ ·]+[A-Za-z’']{2,}/;
const WORD = /^[A-Z][a-z]{2,}[.…:!?]?$/;
const plain = (s) => s.replace(/^[^<]*?>/, ' ').replace(/<[^>]*>/g, ' ').replace(/<[^>]*$/, ' ').replace(/&#?\w+;/g, ' ').replace(/\$\{[^}]*\}/g, ' ').replace(/\s+/g, ' ').trim();
function prose(s) {
  const t = plain(s);
  if (!t || /^[#.\[:(@]/.test(t) || /^[\w.-]+\/[\w./-]+$/.test(t) || /^https?:/.test(t)) return false;
  return PROSE.test(t) || WORD.test(t);
}
const between = (s) => [...s.replace(/\$\{[^}]*\}/g, '\u0001').matchAll(/>([^<>]*)</g)].map((m) => m[1].replace(/\u0001/g, ' ').trim()).filter((x) => /[A-Za-z]{3,}/.test(x));
const hard = [];
for (const a of AREAS.filter((x) => x.js)) {
  const { src } = jsOf(a), toks = tokens(src), line = (p) => src.slice(0, p).split('\n').length;
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i], prev = toks[i - 1], prev2 = toks[i - 2];
    if (t.k === 'str') {
      if (prev && prev.v === '(' && prev2 && (prev2.v === '_t' || prev2.v === '_tx')) continue; // the key
      if (prev && prev.v === '=' && prev2 && (prev2.v === '=' || prev2.v === '!')) continue; // a comparison (e.key === 'Escape')
      if (prev && prev.v === 'case') continue;
      if (prose(t.v) && !allowJs.has(t.v) && !allowJs.has(plain(t.v))) hard.push(`${a.file}:${line(t.start)} "${t.v.slice(0, 50)}"`);
      else for (const w of between(t.v)) if (!allowJs.has(w)) hard.push(`${a.file}:${line(t.start)} text between tags "${w.slice(0, 50)}"`);
    } else if (t.k === 'tpl') for (const p of t.parts) if (p.s !== undefined && prose(p.s) && !allowJs.has(p.s.trim()) && !allowJs.has(plain(p.s))) hard.push(`${a.file}:${line(t.start)} \`${p.s.slice(0, 50)}\``);
      else if (p.s !== undefined) for (const w of between(p.s)) if (!allowJs.has(w)) hard.push(`${a.file}:${line(t.start)} text between tags "${w.slice(0, 50)}"`);
  }
}
ok(!hard.length, 'no hard-coded English in the editor scripts (add words to i18n/en.json and use _t(); an exception goes in i18n/allow.json)' + (hard.length ? `\n      ${hard.slice(0, 25).join('\n      ')}${hard.length > 25 ? `\n      ... ${hard.length - 25} more` : ''}` : ''));

// CSS prints words too (content: "..."): they must come from a variable the page sets in its language (content: var(--t-x, "English")).
{
  const css = [read('editor/template.html').slice(0, read('editor/template.html').indexOf('</style>')), read('editor/organiser.css'), read('editor/library-ui.css'), read('editor/versions.css')].join('\n');
  const words = [...css.replace(/var\([^)]*\)/g, '').matchAll(/content:\s*(["'])([^"']*)\1/g)].map((m) => m[2]).filter((w) => /[A-Za-z]{2}/.test(w) && !allowJs.has(w));
  ok(!words.length, 'no CSS content: "word" that the catalog cannot translate (use var(--t-name, "English") and set it in i18n/runtime.js)' + (words.length ? ': ' + words.join(', ') : ''));
}

// ---------- the built page (when it is built): it parses, and carries the catalog ----------
const dist = here('editor/dist/site/index.html');
if (fs.existsSync(dist)) {
  const h = fs.readFileSync(dist, 'utf8'), js = h.slice(h.lastIndexOf('<script>') + 8, h.lastIndexOf('</script>'));
  let syntax = true; try { new vm.Script(js, { filename: 'editor.js' }); } catch (e) { syntax = e.message; }
  ok(syntax === true, 'the built editor script parses' + (syntax === true ? '' : ': ' + syntax));
  ok(h.includes('"app.book_editor"') && h.includes('const I18N_LANG'), 'the built editor carries the catalog and the language switch');
} else console.log('skip the built page checks: run node editor/build.mjs first');

// ---------- 5. the print strings report ----------
ok(printReport() === read('i18n/print-strings.md'), 'i18n/print-strings.md is current (the printed strings and where each lives)' + (printReport() === read('i18n/print-strings.md') ? '' : ': run node i18n/print-report.mjs'));

console.log(fails.length ? `\n${fails.length} i18n check(s) failed` : '\ni18n: all checks passed');
process.exit(fails.length ? 1 : 0);
