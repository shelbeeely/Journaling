#!/usr/bin/env node
// Link checker for the assembled site: every local href/src must exist, every #anchor must match an id, and every
// image needs alt text. External links are listed, and checked with a HEAD request only when you pass --external.
//   node site/check-links.mjs site/_out [--external]
import fs from 'node:fs';
import path from 'node:path';
const dir = path.resolve(process.argv[2] || 'site/_out');
const external = process.argv.includes('--external');
if (!fs.existsSync(dir)) { console.error(`no such folder: ${dir} (run site/build.sh first)`); process.exit(2); }
const pages = [];
(function walk(d) { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) walk(p); else if (f.name.endsWith('.html')) pages.push(p); } })(dir);
const problems = [], ext = new Set();
const idsOf = (html) => new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
for (const file of pages) {
  const html = fs.readFileSync(file, 'utf8'), rel = path.relative(dir, file), ids = idsOf(html);
  // page hygiene: language, title, unique ids, and on docs pages one h1 and a skip link target
  if (!/<html[^>]*\slang="/.test(html)) problems.push(`${rel}: <html> has no lang`);
  if (!/<title>[^<]+<\/title>/.test(html)) problems.push(`${rel}: no <title>`);
  const allIds = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  for (const id of rel.startsWith('editor' + path.sep) ? [] : new Set(allIds.filter((x, i) => allIds.indexOf(x) !== i))) problems.push(`${rel}: duplicate id "${id}"`);
  if (rel.startsWith('docs' + path.sep)) {
    if ((html.match(/<h1[\s>]/g) || []).length !== 1) problems.push(`${rel}: docs pages need exactly one h1`);
    if (!ids.has('main')) problems.push(`${rel}: no #main for the skip link`);
  }
  for (const m of html.matchAll(/<img\b[^>]*>/g)) if (!/\salt="/.test(m[0])) problems.push(`${rel}: image without alt: ${m[0].slice(0, 60)}`);
  for (const m of html.matchAll(/\s(?:href|src)="([^"]*)"/g)) {
    const u = m[1];
    if (!u || /^(mailto:|tel:|data:|javascript:)/.test(u)) continue;
    if (/^https?:/.test(u)) { if (new URL(u).pathname !== '/') ext.add(u); continue; } // bare origins are preconnect hints
    if (u.startsWith('#')) { if (u !== '#' && !ids.has(u.slice(1))) problems.push(`${rel}: missing anchor ${u}`); continue; }
    const [pathPart, hash] = u.split('#');
    const clean = pathPart.split('?')[0];
    let target = path.resolve(path.dirname(file), clean);
    if (!target.startsWith(dir)) { problems.push(`${rel}: link leaves the site: ${u}`); continue; }
    if (fs.existsSync(target) && fs.statSync(target).isDirectory()) target = path.join(target, 'index.html');
    if (!fs.existsSync(target)) { problems.push(`${rel}: broken link ${u}`); continue; }
    if (hash && target.endsWith('.html') && !idsOf(fs.readFileSync(target, 'utf8')).has(hash)) problems.push(`${rel}: ${u} has no #${hash} in the target`);
  }
}
// docs coverage: every docs page is linked from the docs index, and there is one page per method doc
const docsDir = path.join(dir, 'docs');
if (fs.existsSync(docsDir)) {
  const idx = fs.readFileSync(path.join(docsDir, 'index.html'), 'utf8');
  const methods = path.resolve(import.meta.dirname, '../docs/journaling/methods');
  const slugs = fs.existsSync(methods) ? fs.readdirSync(methods).filter((f) => f.endsWith('.md') && !['TEMPLATE.md', 'README.md'].includes(f)).map((f) => f.replace(/\.md$/, '')) : [];
  for (const s of slugs) { if (!fs.existsSync(path.join(docsDir, s, 'index.html'))) problems.push(`docs/${s}/ was not built`); else if (!idx.includes(`href="${s}/"`)) problems.push(`docs/index.html does not link to ${s}/`); }
  if (!fs.existsSync(path.join(docsDir, 'contributors', 'index.html'))) problems.push('docs/contributors/ was not built');
  if (!/id="q"/.test(idx)) problems.push('docs/index.html has no search box');
}
if (external) {
  for (const u of ext) {
    try { const r = await fetch(u, { method: 'HEAD', redirect: 'follow' }); if (!r.ok) problems.push(`external ${u}: HTTP ${r.status}`); }
    catch (e) { problems.push(`external ${u}: ${e.message}`); }
  }
}
console.log(`${pages.length} page(s), ${ext.size} external link(s)${external ? ' (checked)' : ' (not checked; use --external)'}`);
if (problems.length) { console.error(problems.map((p) => '  ' + p).join('\n')); console.error(`${problems.length} problem(s)`); process.exit(1); }
console.log('links ok');
