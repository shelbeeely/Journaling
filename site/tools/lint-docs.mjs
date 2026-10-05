#!/usr/bin/env node
// Doc lint for docs/journaling/methods/*.md (CI: .github/workflows/docs.yml). Fails on:
//   front matter missing or invalid, required sections missing or out of order, sources section without a checked date or links,
//   personal words, broken links to other docs or #anchors. Links to the web are only fetched with --external.
//   node site/tools/lint-docs.mjs [--external]
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, METHODS_DIR, REQUIRED_SECTIONS, PERSONAL, loadMethods, validateFrontMatter, renderMarkdown, parseFrontMatter } from './docs-lib.mjs';

const external = process.argv.includes('--external');
const problems = [];
const add = (f, msg) => problems.push(`${f}: ${msg}`);
const docs = loadMethods();
const slugs = new Set(docs.map((d) => d.file.replace(/\.md$/, '')));
const anchors = {}, extUrls = new Map();
const scrub = (t) => t.replace(/github\.com\/shelbeeely\/Journaling/gi, 'REPO');

const check = (name, src, { template = false } = {}) => {
  const fm = parseFrontMatter(src);
  const links = [];
  const r = renderMarkdown(fm.body || src, { onLink: (u) => links.push(u) });
  anchors[name.replace(/\.md$/, '')] = new Set(r.headings.map((h) => h.id));
  // required sections, numbered 1..N in order
  const h2 = r.headings.filter((h) => h.level === 2);
  REQUIRED_SECTIONS.forEach((want, i) => {
    const got = h2[i];
    if (!got) return add(name, `missing section ${i + 1}. ${want}`);
    const m = got.text.match(/^(\d+)\.\s+(.*)$/);
    if (!m || +m[1] !== i + 1 || m[2].trim().toLowerCase() !== want.toLowerCase()) add(name, `section ${i + 1} should be "## ${i + 1}. ${want}" (found "## ${got.text}")`);
  });
  if (!template) {
    if (r.headings.filter((h) => h.level === 1).length !== 1) add(name, 'needs exactly one # title');
    // sources: a checked date and at least three links
    const body = fm.body;
    const s = body.split(/^##\s+\d+\.\s+Sources\s*$/m)[1] || '';
    if (!/(checked|opened|accessed|retrieved)[^\n]{0,80}(\d{4}-\d{2}-\d{2}|\d{1,2} [A-Z][a-z]+ \d{4})/i.test(s)) add(name, 'Sources: say when they were checked with a date (for example "All checked 2026-09-28.")');
    const urls = s.match(/https?:\/\/[^\s<>)|\]]+/g) || [];
    if (urls.length < 3) add(name, `Sources: only ${urls.length} link(s); every source needs a title and a URL (at least 3)`);
    if (/\]\(\s*\)/.test(body)) add(name, 'empty link target');
  }
  if (PERSONAL.test(scrub(src))) add(name, `personal words found: ${[...new Set(scrub(src).match(new RegExp(PERSONAL.source, 'gi')))].join(', ')}`);
  const cross = [];
  for (const u of links) {
    if (/^https?:/.test(u)) { if (!extUrls.has(u)) extUrls.set(u, name); continue; }
    if (/^(mailto:|#)/.test(u)) continue;
    const m = u.match(/^(?:\.\/)?([^#]+)(#.*)?$/);
    const target = path.resolve(METHODS_DIR, m[1]);
    if (!fs.existsSync(target)) add(name, `broken link ${u}`);
    else if (m[1].endsWith('.md') && m[2]) cross.push({ doc: m[1].replace(/\.md$/, ''), hash: m[2].slice(1), from: name, u });
  }
  return cross;
};

const pending = [];
const seenSlug = new Set(), seenTitle = new Set();
for (const d of docs) {
  for (const p of validateFrontMatter(d)) add(d.file, p);
  if (d.data) {
    if (seenSlug.has(d.data.slug)) add(d.file, 'duplicate slug'); seenSlug.add(d.data.slug);
    if (seenTitle.has(d.data.title)) add(d.file, 'duplicate title'); seenTitle.add(d.data.title);
  }
  pending.push(...check(d.file, d.src));
}
const tpl = path.join(METHODS_DIR, 'TEMPLATE.md');
if (fs.existsSync(tpl)) check('TEMPLATE.md', fs.readFileSync(tpl, 'utf8'), { template: true }); else add('TEMPLATE.md', 'missing');
for (const l of pending) if (anchors[l.doc] && !anchors[l.doc].has(l.hash)) add(l.from, `link ${l.u}: no heading #${l.hash} in ${l.doc}.md`);

// other public contribution files: no personal words
for (const f of ['CONTRIBUTING.md', '.github/pull_request_template.md', ...(fs.existsSync(path.join(ROOT, '.github/ISSUE_TEMPLATE')) ? fs.readdirSync(path.join(ROOT, '.github/ISSUE_TEMPLATE')).map((x) => `.github/ISSUE_TEMPLATE/${x}`) : [])]) {
  const p = path.join(ROOT, f);
  if (!fs.existsSync(p)) { add(f, 'missing'); continue; }
  if (PERSONAL.test(scrub(fs.readFileSync(p, 'utf8')))) add(f, 'personal words found');
}

if (external) {
  for (const [u, name] of extUrls) {
    try {
      let r = await fetch(u, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(20000), headers: { 'user-agent': 'journalwright-doc-lint' } });
      if (r.status === 405 || r.status === 403) r = await fetch(u, { redirect: 'follow', signal: AbortSignal.timeout(20000), headers: { 'user-agent': 'journalwright-doc-lint' } });
      if (!r.ok && ![401, 403, 429].includes(r.status)) add(name, `${u}: HTTP ${r.status}`);
    } catch (e) { add(name, `${u}: ${e.message}`); }
  }
}
console.log(`${docs.length} doc(s) checked, ${extUrls.size} web link(s)${external ? ' (fetched)' : ' (not fetched; use --external)'}`);
if (problems.length) { console.error(problems.map((p) => '  ' + p).join('\n')); console.error(`${problems.length} problem(s)`); process.exit(1); }
console.log('docs lint ok');
