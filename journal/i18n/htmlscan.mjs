// Finds the user-visible English in the editor's static HTML (template.html and the three pieces it includes) and how each piece is
// marked for translation. Used by test-i18n.mjs (the lint) and by the one-off extraction that added the markers.
//
// Markers (applied at page load in any language except English, where the HTML is already the English message):
//   data-i18n="key"            the element's own text. Several text nodes: one key per non-blank text node, in order, "-" to skip one.
//   data-i18n-html="key"       the element's inner HTML (a message with <b>, <code>, <a> in it)
//   data-i18n-attr="aria-label:key;title:key"   attributes
// scanHtml(src) -> [{ kind: 'text' | 'html' | 'attr', el, ...}] for everything that shows English, with its marker state.

const VOID = new Set(['br', 'hr', 'img', 'input', 'link', 'meta', 'source', 'wbr', 'col', 'area', 'base', 'embed', 'track']);
const INLINE = new Set(['b', 'i', 'em', 'strong', 'code', 'kbd', 'a', 'br', 'u', 'mark', 'sub', 'sup']);
export const ATTRS = ['aria-label', 'title', 'placeholder', 'alt', 'aria-description'];
export const hasWords = (s) => /[A-Za-z]{2}/.test(s.replace(/&#?\w+;/g, ' ').replace(/\$\{[^}]*\}/g, ' '));
export const norm = (s) => s.replace(/\s+/g, ' ').trim();

export function scanHtml(src) {
  const re = /<!--[\s\S]*?-->|<(script|style|svg)\b[\s\S]*?<\/\1\s*>|<(\/?)([a-zA-Z][\w-]*)((?:"[^"]*"|'[^']*'|[^'">])*)>/g;
  const root = { tag: '#root', kids: [], texts: [], attrs: {}, depth: 0 }, stack = [root], all = [];
  let pos = 0, m;
  const text = (to) => { const el = stack[stack.length - 1]; if (to > pos) el.texts.push({ start: pos, end: to, raw: src.slice(pos, to), after: el.kids.length }); };
  while ((m = re.exec(src))) {
    text(m.index); pos = re.lastIndex;
    const top = stack[stack.length - 1];
    if (m[0].startsWith('<!--')) continue;
    if (m[1]) { top.kids.push({ tag: m[1], opaque: true }); continue; } // script, style, svg: skipped
    const [, , closing, tag, rest] = m, t = tag.toLowerCase();
    if (closing) {
      for (let i = stack.length - 1; i > 0; i--) if (stack[i].tag === t) { stack[i].innerEnd = m.index; stack[i].end = pos; stack.length = i; break; }
      continue;
    }
    const attrs = {}, attrPos = {};
    for (const a of rest.matchAll(/([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) { attrs[a[1]] = a[2] ?? a[3] ?? a[4] ?? ''; attrPos[a[1]] = a.index; }
    const el = { tag: t, attrs, start: m.index, openEnd: pos, selfClose: /\/\s*$/.test(rest), kids: [], texts: [], depth: stack.length };
    el.insertAt = pos - 1 - (el.selfClose ? (rest.match(/\s*\/\s*$/)[0].length) : 0); // where a new attribute goes
    el.parent = top; top.kids.push(el); all.push(el);
    if (!VOID.has(t) && !el.selfClose) { el.innerStart = pos; stack.push(el); }
  }
  const out = [], htmlForm = new Set(), inHtml = (el) => { for (let p = el.parent; p; p = p.parent) if (htmlForm.has(p)) return true; return false; };
  for (const el of all) {
    if (inHtml(el) || el.tag === 'title') continue; // (<title> stays plain: the page sets document.title itself, see i18n/runtime.js)
    const a = el.attrs, ai = a['data-i18n-attr'] ? Object.fromEntries(a['data-i18n-attr'].split(';').map((x) => x.split(':'))) : {};
    for (const n of ATTRS) if (a[n] !== undefined && hasWords(a[n])) out.push({ kind: 'attr', el, name: n, value: a[n], key: ai[n] || null });
    if (el.innerStart === undefined || el.innerEnd === undefined) continue;
    const textual = el.texts.filter((x) => /\S/.test(x.raw) && hasWords(x.raw));
    if (!textual.length) continue;
    const inlineOnly = el.kids.every((k) => k.opaque ? false : INLINE.has(k.tag) && !k.attrs.id);
    if (el.tag === 'code' || el.tag === 'kbd') continue; // literal text: file names, keys
    if (inlineOnly && el.kids.length) htmlForm.add(el), out.push({ kind: 'html', el, value: norm(src.slice(el.innerStart, el.innerEnd)), key: a['data-i18n-html'] || null });
    else {
      const nodes = el.texts.filter((x) => /\S/.test(x.raw)), keys = (a['data-i18n'] || '').split(/\s+/).filter(Boolean);
      nodes.forEach((x, i) => out.push({ kind: 'text', el, value: norm(x.raw), key: keys.length ? (keys[i] || null) : null, i, of: nodes.length, skip: !hasWords(x.raw) }));
    }
  }
  return out.filter((x) => !(x.kind === 'text' && x.skip && !x.key));
}
