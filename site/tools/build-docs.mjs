// Writes <out>/docs/index.html: the titles of the methods library (docs/journaling/methods/*.md). Text of the docs is NOT published.
//   node site/tools/build-docs.mjs <outdir>      (site/build.sh runs it)
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '../..');
const out = path.resolve(process.argv[2] || 'site/_out', 'docs');
const REPO = 'https://github.com/shelbeeely/Journaling/blob/main/';
const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
fs.mkdirSync(out, { recursive: true });
const shell = (title, body, up) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title><link rel="icon" href="${up}img/icon.svg" type="image/svg+xml"><link rel="stylesheet" href="${up}style.css">
<style>.doc{max-width:46rem;overflow-wrap:break-word;padding-top:24px;padding-bottom:56px}.doc table{display:block;overflow-x:auto;max-width:100%;border-collapse:collapse}.doc th,.doc td{border:1px solid var(--line);padding:8px 10px}.doc img{max-width:100%}.doc pre{overflow-x:auto}.crumb{display:inline-flex;align-items:center;min-height:44px}</style>
</head><body>
<a class="skip" href="#main">Skip to content</a>
<header class="nav"><div class="wrap nav-in"><a class="brand" href="${up}"><span>Journalwright <b>Studio</b></span></a><nav aria-label="Sections"><a href="${up}docs/">Docs</a><a href="${up}editor/">Editor demo</a></nav></div></header>
<main id="main" class="wrap doc">${body}</main>
<script src="${up}app.js"></script></body></html>
`;
const files = fs.readdirSync(path.join(root, 'docs/journaling/methods')).filter((f) => f.endsWith('.md')).sort();
// Only titles are published here. The method docs and BUILD-PLAN hold personal decisions, so their text is not put on the public site.
const items = files.map((f) => ({ name: f.replace(/\.md$/, ''), title: ((fs.readFileSync(path.join(root, 'docs/journaling/methods', f), 'utf8').match(/^#\s+(.+)$/m) || [, f])[1]).replace(/[*_`]/g, '') }));
const SENSITIVE = /hrt|euphoria/i; // titles that are personal are left off the public list
const shown = items.filter((i) => !SENSITIVE.test(i.title) && !SENSITIVE.test(i.name));
const list = shown.map((i) => `<li>${esc(i.title)}</li>`).join('\n');
fs.writeFileSync(path.join(out, 'index.html'), shell('Docs · Journalwright Studio', `<h1>Docs</h1>
<p class="lede">Every block in the studio comes from research. The methods library has ${items.length} short docs, one per journaling or planning method: what it is, what it is good at, and where it goes wrong.</p>
<p><a class="link" href="../#roadmap">Roadmap</a> · <a class="link" href="${REPO}journal/README.md">Journal guide (GitHub)</a> · <a class="link" href="${REPO}x4/README.md">X4 guide (GitHub)</a></p>
<h2>Some of the methods covered</h2><ul class="doclist">${list}</ul>
<style>.doclist{columns:2 16rem;padding-left:20px}.doclist li{margin:6px 0}</style>`, '../'));
console.log(`docs: index of ${items.length} methods -> ${out}`);
