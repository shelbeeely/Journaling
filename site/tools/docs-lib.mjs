// Shared by build-docs.mjs and lint-docs.mjs: front matter, the method doc rules, and a small Markdown renderer (no dependencies).
import fs from 'node:fs';
import path from 'node:path';

export const ROOT = path.resolve(import.meta.dirname, '../..');
export const METHODS_DIR = path.join(ROOT, 'docs/journaling/methods');
export const REPO_URL = 'https://github.com/shelbeeely/Journaling';

// Front matter rules. Keep in step with docs/journaling/methods/TEMPLATE.md and CONTRIBUTING.md.
export const CATEGORIES = {
  'bujo-family': 'Bullet journal family',
  'japanese': 'Japanese planners',
  'mental-health': 'Mental health and tracking',
  'neurodivergent-and-creative': 'Neurodivergent and creative',
  'paper-and-hybrid': 'Paper and hybrid',
  'planner': 'Planners',
  'productivity': 'Productivity',
  'reflective-writing': 'Reflective writing',
};
export const EVIDENCE = {
  strong: { label: 'Strong', text: 'Several controlled trials or systematic reviews support it.' },
  some: { label: 'Some', text: 'A few studies, or good evidence for a closely related practice.' },
  anecdotal: { label: 'Anecdotal', text: 'Widely used and described by practitioners, with little or no formal research.' },
  none: { label: 'None', text: 'No research on the method itself. The doc says what is known about its parts.' },
};
export const STATUSES = ['draft', 'reviewed', 'needs-update'];
export const REQUIRED_SECTIONS = ['At a glance', 'Summary', 'History and origin', 'Philosophy and principles', 'Core components', 'Setting it up', 'Daily practice', 'Rhythms', 'Page anatomy', 'Worked examples', 'Variations and offshoots', 'Community practice', 'Official products and formats', 'Tools and supplies', 'Digital and hybrid versions', 'Evidence and research', 'Benefits', 'Pitfalls', 'Accessibility and adaptations', 'Comparison', 'Combining', 'Ready-to-use bank', 'Glossary', 'FAQ', 'For Journalwright Studio', 'Open questions', 'Further reading', 'Sources'];
// Words that must never appear in public docs or the public site (the repo URL is the one allowed exception).
export const PERSONAL = /spokane|keeping watch|shelbee|johnsondelbert/i;
export const LICENCE_NOTE = 'Docs and guide text are CC0 1.0, a public domain dedication. Code is MIT.';

export const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function parseFrontMatter(src) {
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { data: null, body: src, errors: ['no front matter block (--- ... ---) at the top'] };
  const data = {}, errors = [];
  const unq = (v) => { v = v.trim(); return /^(".*"|'.*')$/.test(v) ? v.slice(1, -1) : v; };
  let key = null;
  for (const raw of m[1].split(/\r?\n/)) {
    if (!raw.trim() || raw.trim().startsWith('#')) continue;
    let mm;
    if ((mm = raw.match(/^([A-Za-z][A-Za-z0-9]*):\s*(.*)$/))) {
      key = mm[1]; const v = mm[2].trim();
      if (key in data) errors.push(`duplicate key ${key}`);
      if (v === '') data[key] = [];
      else if (v.startsWith('[') && v.endsWith(']')) data[key] = v.slice(1, -1).split(',').map(unq).filter(Boolean);
      else data[key] = unq(v);
    } else if ((mm = raw.match(/^\s+-\s+(.*)$/)) && key && Array.isArray(data[key])) data[key].push(unq(mm[1]));
    else errors.push(`cannot read front matter line: ${raw}`);
  }
  return { data, body: src.slice(m[0].length), errors };
}

export function loadMethods() {
  return fs.readdirSync(METHODS_DIR).filter((f) => f.endsWith('.md') && f !== 'TEMPLATE.md' && f !== 'README.md').sort().map((file) => {
    const src = fs.readFileSync(path.join(METHODS_DIR, file), 'utf8');
    return { file, src, ...parseFrontMatter(src) };
  });
}

export function validateFrontMatter(doc) {
  const p = [], d = doc.data;
  p.push(...doc.errors);
  if (!d) return p;
  for (const k of ['title', 'slug', 'category', 'evidenceLevel', 'lastReviewed', 'status', 'contributors']) if (!(k in d) || (typeof d[k] === 'string' && !d[k]) || (Array.isArray(d[k]) && !d[k].length)) p.push(`front matter: missing ${k}`);
  if (d.slug && d.slug !== doc.file.replace(/\.md$/, '')) p.push(`front matter: slug "${d.slug}" must equal the file name "${doc.file.replace(/\.md$/, '')}"`);
  if (d.slug && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(d.slug)) p.push('front matter: slug must be lowercase words joined by hyphens');
  if (d.category && !CATEGORIES[d.category]) p.push(`front matter: category "${d.category}" is not one of ${Object.keys(CATEGORIES).join(', ')}`);
  if (d.evidenceLevel && !EVIDENCE[d.evidenceLevel]) p.push(`front matter: evidenceLevel "${d.evidenceLevel}" is not one of ${Object.keys(EVIDENCE).join(', ')}`);
  if (d.status && !STATUSES.includes(d.status)) p.push(`front matter: status "${d.status}" is not one of ${STATUSES.join(', ')}`);
  if (d.lastReviewed) {
    const t = Date.parse(d.lastReviewed);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.lastReviewed) || Number.isNaN(t)) p.push('front matter: lastReviewed must be a real date, YYYY-MM-DD');
    else if (t > Date.now() + 864e5) p.push('front matter: lastReviewed is in the future');
  }
  if (d.contributors && !Array.isArray(d.contributors)) p.push('front matter: contributors must be a list');
  if (d.licence !== 'CC0-1.0') p.push('front matter: licence must be CC0-1.0');
  return p;
}

export const slugify = (t) => t.toLowerCase().replace(/<[^>]*>/g, '').replace(/[*_`]/g, '').replace(/[^\p{L}\p{N}\s-]/gu, '').trim().replace(/\s/g, '-');
export const plain = (t) => t.replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/<(https?:[^>]+)>/g, '$1').replace(/[*_`]/g, '').trim();

// ---- Markdown renderer ----
// Links to other docs (x.md#anchor) become /docs/x/#anchor. opts.onLink(url) is called for every link so callers can collect them.
export function renderMarkdown(body, opts = {}) {
  const lines = body.replace(/\r/g, '').split('\n');
  const headings = [], seen = new Map();
  const link = (u) => {
    opts.onLink && opts.onLink(u);
    if (/^https?:/.test(u)) return { href: esc(u), ext: true };
    const m = u.match(/^(?:\.\/)?([a-z0-9-]+)\.md(#.*)?$/);
    if (m) return { href: `../${m[1]}/${m[2] || ''}`, ext: false };
    return { href: esc(u), ext: false };
  };
  const inline = (s) => {
    const stash = [];
    const hold = (h) => `\u0000${stash.push(h) - 1}\u0000`;
    s = s.replace(/`([^`]+)`/g, (_, c) => hold(`<code>${esc(c)}</code>`));
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) => { const l = link(u); return hold(`<a href="${l.href}"${l.ext ? ' rel="noopener noreferrer"' : ''}>${inlineNoLink(t)}</a>`); });
    s = s.replace(/<(https?:\/\/[^>\s]+)>/g, (_, u) => { const l = link(u); return hold(`<a href="${l.href}" rel="noopener noreferrer">${esc(u)}</a>`); });
    s = s.replace(/(^|[\s(])(https?:\/\/[^\s<>)\]]+[^\s<>)\].,;:!?'"])/g, (_, pre, u) => { const l = link(u); return pre + hold(`<a href="${l.href}" rel="noopener noreferrer">${esc(u)}</a>`); });
    s = emphasis(esc(s));
    return s.replace(/\u0000(\d+)\u0000/g, (_, i) => stash[+i]);
  };
  const emphasis = (s) => s.replace(/\*\*([^*\n]+?)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*\w])\*([^*\s][^*\n]*?)\*(?![*\w])/g, '$1<em>$2</em>').replace(/(^|[^\w])_([^_\s][^_\n]*?)_(?![\w])/g, '$1<em>$2</em>');
  const inlineNoLink = (s) => emphasis(esc(s.replace(/`([^`]+)`/g, '$1')));
  const cells = (l) => { l = l.trim().replace(/^\|/, '').replace(/\|$/, ''); return l.split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, '|')); };
  const isSep = (l) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(l) && l.includes('|');
  const indentOf = (l) => l.match(/^ */)[0].length;
  const itemRe = /^( *)([-*+]|\d+[.)])\s+(.*)$/;

  function list(i, base) {
    const ordered = /\d/.test(lines[i].match(itemRe)[2]);
    let out = `<${ordered ? 'ol' : 'ul'}>`;
    while (i < lines.length) {
      const m = lines[i].match(itemRe);
      if (!m || indentOf(lines[i]) < base) break;
      if (indentOf(lines[i]) > base) break;
      let text = m[3]; i++;
      let sub = '';
      while (i < lines.length) {
        const l = lines[i];
        if (!l.trim()) { // blank: continue only if the next non-blank line is still inside this list
          let j = i; while (j < lines.length && !lines[j].trim()) j++;
          if (j < lines.length && indentOf(lines[j]) > base && j - i < 3) { i = j; continue; }
          break;
        }
        const im = l.match(itemRe);
        if (im && indentOf(l) > base) { const r = list(i, indentOf(l)); sub += r.html; i = r.next; continue; }
        if (im || indentOf(l) <= base) break;
        text += ' ' + l.trim(); i++;
      }
      const task = text.match(/^\[([ xX])\]\s+(.*)$/);
      out += `<li>${task ? `<span aria-hidden="true">${task[1] === ' ' ? '☐' : '☑'}</span><span class="sr-only">${task[1] === ' ' ? 'To do: ' : 'Done: '}</span> ${inline(task[2])}` : inline(text)}${sub}</li>`;
    }
    return { html: out + `</${ordered ? 'ol' : 'ul'}>`, next: i };
  }

  let html = '', i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (!l.trim()) { i++; continue; }
    let m;
    if ((m = l.match(/^(\s*)(```+|~~~+)(.*)$/))) { // fenced code
      const fence = m[2]; const buf = []; i++;
      while (i < lines.length && !lines[i].trim().startsWith(fence)) { buf.push(lines[i].slice(Math.min(m[1].length, indentOf(lines[i])))); i++; }
      i++;
      html += `<pre tabindex="0"><code>${esc(buf.join('\n'))}</code></pre>\n`; continue;
    }
    if ((m = l.match(/^(#{1,6})\s+(.*?)\s*#*\s*$/))) {
      const level = m[1].length, text = m[2];
      let id = slugify(text) || 'section'; const n = seen.get(id) || 0; seen.set(id, n + 1); if (n) id += `-${n}`;
      headings.push({ level, text: plain(text), id });
      html += `<h${level} id="${id}">${inline(text)}</h${level}>\n`; i++; continue;
    }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(l)) { html += '<hr>\n'; i++; continue; }
    if (l.includes('|') && i + 1 < lines.length && isSep(lines[i + 1])) {
      const head = cells(l); i += 2; const rows = [];
      while (i < lines.length && lines[i].trim() && lines[i].includes('|')) rows.push(cells(lines[i++]));
      const th = head.some((h) => h) ? head : null;
      html += `<div class="tablewrap" role="region" aria-label="Table" tabindex="0"><table>${th ? `<thead><tr>${th.map((c) => `<th scope="col">${inline(c)}</th>`).join('')}</tr></thead>` : ''}<tbody>${rows.map((r) => `<tr>${r.map((c, k) => (k === 0 && !th ? `<th scope="row">${inline(c)}</th>` : `<td>${inline(c)}</td>`)).join('')}</tr>`).join('')}</tbody></table></div>\n`;
      continue;
    }
    if (l.startsWith('>')) {
      const buf = []; while (i < lines.length && lines[i].startsWith('>')) buf.push(lines[i++].replace(/^>\s?/, ''));
      html += `<blockquote>${renderMarkdown(buf.join('\n'), { ...opts, _inner: true }).html}</blockquote>\n`; continue;
    }
    if (itemRe.test(l)) { const r = list(i, indentOf(l)); html += r.html + '\n'; i = r.next; continue; }
    const buf = [l.trim()]; i++;
    while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|```|~~~|>)/.test(lines[i]) && !itemRe.test(lines[i]) && !(lines[i].includes('|') && i + 1 < lines.length && isSep(lines[i + 1]))) buf.push(lines[i++].trim());
    html += `<p>${buf.map((b) => inline(b.replace(/\s{2,}$/, ''))).join(' ')}</p>\n`;
  }
  return opts._inner ? { html } : { html, headings };
}
