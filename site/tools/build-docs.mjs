// Builds the public docs under <out>/docs/: an index with search and filters, one page per method doc
// (docs/journaling/methods/*.md) and a contributors page generated from front matter.
//   node site/tools/build-docs.mjs <outdir>      (site/build.sh runs it)
// The docs are written without personal content, and lint-docs.mjs + the privacy gate in site/build.sh enforce that.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, REPO_URL, CATEGORIES, EVIDENCE, LICENCE_NOTE, esc, loadMethods, validateFrontMatter, renderMarkdown, plain } from './docs-lib.mjs';

const out = path.resolve(process.argv[2] || 'site/_out', 'docs');
fs.mkdirSync(out, { recursive: true });
const docs = loadMethods();
const bad = docs.flatMap((d) => validateFrontMatter(d).map((p) => `${d.file}: ${p}`));
if (bad.length) { console.error(bad.join('\n')); console.error('docs: front matter is invalid (node site/tools/lint-docs.mjs lists everything)'); process.exit(1); }

const shell = ({ title, description, body, up, depth }) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(description)}">
<link rel="icon" href="${up}img/icon.svg" type="image/svg+xml"><link rel="stylesheet" href="${up}style.css"><link rel="stylesheet" href="${depth}docs.css">
</head><body>
<a class="skip" href="#main">Skip to content</a>
<header class="nav"><div class="wrap nav-in"><a class="brand" href="${up}"><span>Journalwright <b>Studio</b></span></a><nav aria-label="Sections"><a href="${depth}" aria-current="${depth === './' ? 'page' : 'false'}">Docs</a><a href="${depth}contributors/">Contributors</a><a href="${up}editor/">Editor demo</a></nav>
<button class="theme" id="theme" type="button" aria-label="Switch between light and dark" aria-pressed="false"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg></button></div></header>
<main id="main" class="wrap doc">${body}</main>
<footer class="foot"><div class="wrap foot-in"><p><b>Docs licence (placeholder).</b> ${esc(LICENCE_NOTE)}</p>
<ul class="links"><li><a href="${REPO_URL}/blob/main/CONTRIBUTING.md">How to contribute</a></li><li><a href="${REPO_URL}/issues/new/choose">Suggest, correct or add a source</a></li><li><a href="${depth}contributors/">Contributors</a></li></ul></div></footer>
<script src="${up}app.js"></script>${depth === './' ? `<script src="${depth}docs.js"></script>` : ''}</body></html>
`;

const summaryOf = (body) => {
  const m = body.match(/^##\s+(?:\d+\.\s+)?Summary\s*\n+([\s\S]*?)(?=\n##\s|$)/m);
  const para = (m ? m[1] : body).split(/\n\s*\n/).map((p) => p.trim()).find((p) => p && !/^[#|>`]/.test(p)) || '';
  const first = /^\s*[-*]\s/.test(para) ? para.split(/\n\s*[-*]\s/)[0].replace(/^\s*[-*]\s+/, '') : para;
  const t = plain(first).replace(/\s+/g, ' ');
  return t.length > 240 ? t.slice(0, 237).replace(/\s+\S*$/, '') + '…' : t;
};
const badge = (e) => `<span class="ev ev-${e}" title="${esc(EVIDENCE[e].text)}">Evidence: ${EVIDENCE[e].label}</span>`;
const fmtDate = (d) => new Date(d + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

// ---- per-doc pages ----
const slugs = new Set(docs.map((d) => d.data.slug));
const linkProblems = [];
for (const d of docs) {
  const { data: fm } = d;
  const r = renderMarkdown(d.body, { onLink: (u) => { const m = u.match(/^(?:\.\/)?([a-z0-9-]+)\.md/); if (m && !slugs.has(m[1])) linkProblems.push(`${d.file}: link to unknown doc ${u}`); } });
  let html = r.html;
  const first = r.headings.find((h) => h.level === 1);
  html = html.replace(/<h1 id="[^"]*">[\s\S]*?<\/h1>\n?/, ''); // the page title comes from front matter
  const toc = r.headings.filter((h) => h.level === 2);
  const editUrl = `${REPO_URL}/edit/main/docs/journaling/methods/${d.file}`;
  const fixUrl = `${REPO_URL}/issues/new?template=correct-a-fact.yml&title=${encodeURIComponent('Correction: ' + fm.title)}`;
  const body = `<nav class="crumb-row" aria-label="Breadcrumb"><a class="crumb" href="../">← All docs</a></nav>
<article>
<header class="dochead"><p class="eyebrow">${esc(CATEGORIES[fm.category])}</p><h1>${esc(fm.title)}</h1>
${first && plain(first.text) !== fm.title ? `<p class="lede">${esc(first.text)}</p>` : ''}
<ul class="meta"><li>${badge(fm.evidenceLevel)}</li><li>Last reviewed <time datetime="${fm.lastReviewed}">${fmtDate(fm.lastReviewed)}</time></li><li>Status: ${esc(fm.status)}</li></ul>
<p class="note">Contributors: ${fm.contributors.map(esc).join(', ')}. ${esc(LICENCE_NOTE)}</p>
<p class="note">This is research and design reference, not medical or mental health advice. If you are in crisis, contact local emergency services or a crisis line.</p>
<p class="actions"><a class="btn" href="${editUrl}" rel="noopener noreferrer">Improve this page</a><a class="btn" href="${fixUrl}" rel="noopener noreferrer">Correct a fact</a></p></header>
<div class="docgrid"><nav class="toc" aria-label="On this page"><details id="toc"><summary>On this page</summary><ol>${toc.map((h) => `<li><a href="#${h.id}">${esc(h.text.replace(/^\d+\.\s*/, ''))}</a></li>`).join('')}</ol></details></nav>
<div class="prose">${html}</div></div></article>
<script>try{if(matchMedia('(min-width:960px)').matches)document.getElementById('toc').open=true}catch(e){}</script>`;
  fs.mkdirSync(path.join(out, fm.slug), { recursive: true });
  fs.writeFileSync(path.join(out, fm.slug, 'index.html'), shell({ title: `${fm.title} · Docs · Journalwright Studio`, description: summaryOf(d.body) || fm.title, body, up: '../../', depth: '../' }));
  d.summary = summaryOf(d.body); d.headings = r.headings; d.plainText = plain(d.body.replace(/```[\s\S]*?```/g, ' ')).replace(/\s+/g, ' ');
}
if (linkProblems.length) { console.error(linkProblems.join('\n')); process.exit(1); }

// ---- index ----
const catCount = Object.fromEntries(Object.keys(CATEGORIES).map((c) => [c, docs.filter((d) => d.data.category === c).length]));
const evCount = Object.fromEntries(Object.keys(EVIDENCE).map((e) => [e, docs.filter((d) => d.data.evidenceLevel === e).length]));
const cards = docs.sort((a, b) => a.data.title.localeCompare(b.data.title)).map((d) => {
  const fm = d.data;
  const hay = [fm.title, CATEGORIES[fm.category], EVIDENCE[fm.evidenceLevel].label, d.summary, d.headings.filter((h) => h.level >= 2).map((h) => h.text).join(' '), d.plainText.slice(0, 1500)].join(' ').toLowerCase();
  return `<li class="mcard" data-category="${fm.category}" data-evidence="${fm.evidenceLevel}" data-title="${esc(fm.title.toLowerCase())}" data-search="${esc(hay)}"><h3><a href="${fm.slug}/">${esc(fm.title)}</a></h3><p class="meta2">${esc(CATEGORIES[fm.category])} · ${badge(fm.evidenceLevel)}</p><p>${esc(d.summary)}</p></li>`;
}).join('\n');
const idx = `<h1>Docs</h1>
<p class="lede">Every block in the studio comes from research. The methods library has ${docs.length} docs, one per journaling or planning method: what it is, where it came from, what the evidence says, how to set it up, and where it goes wrong.</p>
<p class="actions"><a class="btn primary" href="${REPO_URL}/blob/main/CONTRIBUTING.md" rel="noopener noreferrer">Contribute</a><a class="btn" href="${REPO_URL}/issues/new?template=suggest-a-method.yml" rel="noopener noreferrer">Suggest a method</a><a class="btn" href="contributors/">Contributors</a></p>
<form class="filters" id="filters" role="search" aria-label="Search the docs" hidden>
<div class="f"><label for="q">Search</label><input id="q" name="q" type="search" autocomplete="off" placeholder="Try ADHD, sleep, grid or a method name"></div>
<div class="f"><label for="cat">Category</label><select id="cat" name="category"><option value="">All categories</option>${Object.entries(CATEGORIES).map(([k, v]) => `<option value="${k}">${esc(v)} (${catCount[k]})</option>`).join('')}</select></div>
<div class="f"><label for="ev">Evidence level</label><select id="ev" name="evidence"><option value="">Any evidence level</option>${Object.entries(EVIDENCE).map(([k, v]) => `<option value="${k}">${v.label} (${evCount[k]})</option>`).join('')}</select></div>
<div class="f"><button class="btn" type="reset" id="reset">Clear</button></div>
</form>
<p class="count" id="count" role="status" aria-live="polite">Showing all ${docs.length} docs.</p>
<p id="empty" class="empty" hidden>No docs match. Clear a filter or try another word.</p>
<ul class="mlist" id="list">${cards}</ul>
<details class="legend"><summary>What the evidence levels mean</summary><dl>${Object.entries(EVIDENCE).map(([k, v]) => `<dt>${badge(k)}</dt><dd>${esc(v.text)}</dd>`).join('')}</dl><p class="note">Levels describe how much research supports a method's claimed benefits, not whether it is worth trying. Each doc says so plainly, and cites its sources.</p></details>`;
fs.writeFileSync(path.join(out, 'index.html'), shell({ title: 'Docs · Journalwright Studio', description: `${docs.length} research docs on journaling and planning methods, with sources and evidence levels.`, body: idx, up: '../', depth: './' }));

// ---- contributors (from front matter) ----
const by = new Map();
for (const d of docs) for (const c of d.data.contributors) { if (!by.has(c)) by.set(c, []); by.get(c).push(d.data); }
const people = [...by.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
fs.mkdirSync(path.join(out, 'contributors'), { recursive: true });
fs.writeFileSync(path.join(out, 'contributors', 'index.html'), shell({ title: 'Contributors · Docs · Journalwright Studio', description: 'People and groups credited in the docs front matter.', up: '../../', depth: '../', body: `<nav class="crumb-row" aria-label="Breadcrumb"><a class="crumb" href="../">← All docs</a></nav><h1>Contributors</h1>
<p class="lede">Everyone credited in a doc's front matter, generated at build time. Contributors are listed with their consent; to be added, removed or renamed, edit the <code>contributors</code> list in the doc or ask in an issue.</p>
<p>${docs.length} docs, ${people.length} ${people.length === 1 ? 'credit' : 'credits'}.</p>
${people.map(([name, list]) => `<section class="person"><h2>${esc(name)}</h2><p class="note">${list.length} ${list.length === 1 ? 'doc' : 'docs'}</p><ul class="mlist plain">${list.sort((a, b) => a.title.localeCompare(b.title)).map((f) => `<li><a href="../${f.slug}/">${esc(f.title)}</a></li>`).join('')}</ul></section>`).join('\n')}
<p><a class="btn primary" href="${REPO_URL}/blob/main/CONTRIBUTING.md" rel="noopener noreferrer">How to contribute</a></p>` }));

for (const f of ['docs.css', 'docs.js']) fs.copyFileSync(path.join(ROOT, 'site', f), path.join(out, f));
console.log(`docs: ${docs.length} pages + index + contributors -> ${out}`);
