// A small JavaScript lexer for the i18n lint and the print-string report: string and template literals with their positions.
// Best effort (regex literals are told from division by the previous token); good enough for this repo's own code.
// lex(src) -> [{ k: 'str', q, start, end, v } | { k: 'tpl', start, end, parts: [{ s } | { e, at }] } | { k: 're' | 'id' | 'p', ... }]
export function lex(src) {
  const out = []; let i = 0; const n = src.length; let prev = '';
  const regexOK = () => !(prev === 'id' || prev === 'num' || prev === ')' || prev === ']' || prev === '}' || prev === 'str');
  const KW = new Set(['return', 'typeof', 'case', 'in', 'of', 'new', 'delete', 'void', 'throw', 'else', 'do', 'instanceof', 'yield', 'await']);
  function str(start) { const q = src[start]; let j = start + 1; while (j < n && src[j] !== q) { if (src[j] === '\\') j++; j++; } return j + 1; }
  function tmpl(start) {
    let j = start + 1, text = ''; const parts = [];
    while (j < n) {
      const c = src[j];
      if (c === '\\') { text += src.slice(j, j + 2); j += 2; continue; }
      if (c === '`') { parts.push({ s: text }); return { end: j + 1, parts }; }
      if (c === '$' && src[j + 1] === '{') {
        let k = j + 2, d = 1; const exprStart = k;
        while (k < n && d > 0) {
          const ch = src[k];
          if (ch === '`') { k = tmpl(k).end; continue; }
          if (ch === '"' || ch === "'") { k = str(k); continue; }
          if (ch === '{') d++; else if (ch === '}') d--;
          k++;
        }
        parts.push({ s: text }); text = ''; parts.push({ e: src.slice(exprStart, k - 1), at: exprStart }); j = k; continue;
      }
      text += c; j++;
    }
    return { end: j, parts };
  }
  while (i < n) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i + 1] === '*') { i = src.indexOf('*/', i + 2) + 2; continue; }
    if (c === "'" || c === '"') { const e = str(i); out.push({ k: 'str', q: c, start: i, end: e, v: src.slice(i + 1, e - 1) }); i = e; prev = 'str'; continue; }
    if (c === '`') { const r = tmpl(i); out.push({ k: 'tpl', start: i, end: r.end, parts: r.parts }); i = r.end; prev = 'str'; continue; }
    if (c === '/' && regexOK()) { let j = i + 1, cls = false; while (j < n) { if (src[j] === '\\') j++; else if (src[j] === '[') cls = true; else if (src[j] === ']') cls = false; else if (src[j] === '/' && !cls) break; j++; } j++; while (/[a-z]/i.test(src[j] || '')) j++; out.push({ k: 're', start: i, end: j }); i = j; prev = 'str'; continue; }
    if (/[A-Za-z_$]/.test(c)) { let j = i; while (/[\w$]/.test(src[j] || '')) j++; const w = src.slice(i, j); out.push({ k: 'id', v: w, start: i, end: j }); prev = KW.has(w) ? 'kw' : 'id'; i = j; continue; }
    if (/[0-9]/.test(c)) { let j = i; while (/[\w.]/.test(src[j] || '')) j++; i = j; prev = 'num'; continue; }
    out.push({ k: 'p', v: c, start: i, end: i + 1 }); prev = c; i++;
  }
  return out;
}
