// Turns the methods library (docs/journaling/methods/*.md) and BUILD-PLAN.md into plain HTML under <out>/docs/, in the site's style.
//   node site/tools/build-docs.mjs <outdir>      (needs `npm i` in site/tools once; site/build.sh does it)
import fs from 'node:fs';
import path from 'node:path';
import { marked } from 'marked';
const root = path.resolve(import.meta.dirname, '../..');
const out = path.resolve(process.argv[2] || 'site/_out', 'docs');
const REPO = 'https://github.com/shelbeeely/Journaling/blob/main/';
// GitHub-style heading ids, so the docs' own #anchors work.
const slug = (t) => t.toLowerCase().replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, '').replace(/[^\p{L}\p{N}\s_-]/gu, '').trim().replace(/\s/g, '-');
marked.use({ renderer: { heading(inner, depth) { return `<h${depth} id="${slug(inner)}">${inner}</h${depth}>\n`; } } });
const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
fs.mkdirSync(path.join(out, 'methods'), { recursive: true });
const shell = (title, body, up) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title><link rel="icon" href="${up}img/icon.svg" type="image/svg+xml"><link rel="stylesheet" href="${up}style.css">
<style>.doc{max-width:46rem;overflow-wrap:break-word;padding-top:24px;padding-bottom:56px}.doc table{display:block;overflow-x:auto;max-width:100%;border-collapse:collapse}.doc th,.doc td{border:1px solid var(--line);padding:8px 10px}.doc img{max-width:100%}.doc pre{overflow-x:auto}.crumb{display:inline-flex;align-items:center;min-height:44px}</style>
</head><body>
<header class="nav"><div class="wrap nav-in"><a class="brand" href="${up}"><span>Journalwright <b>Studio</b></span></a><nav aria-label="Sections"><a href="${up}docs/">Docs</a><a href="${up}editor/">Editor demo</a></nav></div></header>
<main class="wrap doc">${body}</main>
<script src="${up}app.js"></script></body></html>
`;
const fix = (html, fromRel) => html.replace(/href="([^"#:]+?)(#[^"]*)?"/g, (m, u, h = '') => {
  if (/^https?:|^mailto:/.test(u)) return m;
  const abs = path.resolve(root, path.dirname(fromRel), u), rel = path.relative(root, abs);
  if (/^docs\/journaling\/methods\/[^/]+\.md$/.test(rel)) return `href="${up(fromRel)}docs/methods/${path.basename(rel, '.md')}.html${h}"`;
  if (rel === 'docs/journaling/BUILD-PLAN.md') return `href="${up(fromRel)}docs/build-plan.html${h}"`;
  return `href="${REPO}${rel}${h}"`;
});
const up = (fromRel) => (fromRel.includes('methods/') ? '../../' : '../');
const files = fs.readdirSync(path.join(root, 'docs/journaling/methods')).filter((f) => f.endsWith('.md')).sort();
const items = [];
for (const f of files) {
  const rel = `docs/journaling/methods/${f}`, md = fs.readFileSync(path.join(root, rel), 'utf8');
  const title = (md.match(/^#\s+(.+)$/m) || [, f])[1].replace(/[*_`]/g, '');
  const name = f.replace(/\.md$/, '');
  const html = fix(marked.parse(md, { gfm: true }), rel);
  fs.writeFileSync(path.join(out, 'methods', name + '.html'), shell(`${title} · Journalwright Studio`, `<a class="crumb" href="../">Docs</a>${html}`, '../../'));
  items.push({ name, title });
}
{
  const rel = 'docs/journaling/BUILD-PLAN.md', html = fix(marked.parse(fs.readFileSync(path.join(root, rel), 'utf8'), { gfm: true }), rel);
  fs.writeFileSync(path.join(out, 'build-plan.html'), shell('Build plan · Journalwright Studio', `<a class="crumb" href="./">Docs</a>${html}`, '../'));
}
const list = items.map((i) => `<li><a href="methods/${i.name}.html">${esc(i.title)}</a></li>`).join('\n');
fs.writeFileSync(path.join(out, 'index.html'), shell('Docs · Journalwright Studio', `<h1>Docs</h1>
<p class="lede">Every block in the studio comes from research. These are the ${items.length} methods docs, and the plan for where the studio goes next.</p>
<p><a class="link" href="build-plan.html">Build plan</a> · <a class="link" href="${REPO}journal/README.md">Journal guide (GitHub)</a> · <a class="link" href="${REPO}x4/README.md">X4 guide (GitHub)</a></p>
<h2>Methods library (${items.length})</h2><ul class="doclist">${list}</ul>
<style>.doclist{columns:2 16rem;padding-left:0;list-style:none}.doclist a{display:inline-flex;align-items:center;min-height:44px}</style>`, '../'));
console.log(`docs: ${items.length} methods + build plan -> ${out}`);
