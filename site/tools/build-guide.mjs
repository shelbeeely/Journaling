#!/usr/bin/env node
// Builds the guide page: site/guide/index.html (shell) + site/tools/guide-content.mjs (chapters, shots) -> <out>/guide/.
// The numbers in each picture's list are the numbers drawn on the picture by make-guide-shots.mjs, from the same callouts.
// Fails if a shot has no committed image, if an image is not used, or if a picture has no alt text.
//   node site/tools/build-guide.mjs site/_out
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CHAPTERS, SHOTS } from './guide-content.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.resolve(process.argv[2] || path.join(ROOT, 'site/_out'));
const G = path.join(ROOT, 'site/guide'), IMG = path.join(ROOT, 'site/img');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const problems = [];
const readJson = (f) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {});
const GM = readJson(path.join(IMG, 'guide/manifest.json')), SM = readJson(path.join(IMG, 'shots/manifest.json'));
const used = new Set();
const first = (t) => (t.match(/^[^.!?]*[.!?]?/) || [t])[0].trim();

function image(file, m, alt, cls = '', lazy = true) {
  return `<img${cls ? ` class="${cls}"` : ''} src="../img/${file}" width="${m.w}" height="${m.h}" alt="${esc(alt)}"${lazy ? ' loading="lazy" decoding="async"' : ''}>`;
}
function shot(id) {
  const s = SHOTS[id]; if (!s) { problems.push(`unknown shot "${id}" in a chapter`); return ''; }
  used.add(id);
  const dark = (s.themes || []).includes('dark'), m = GM[id];
  if (!m || !fs.existsSync(path.join(IMG, 'guide', id + '.webp'))) { problems.push(`shot "${id}" has no image: run node site/tools/make-guide-shots.mjs and commit site/img/guide/`); return ''; }
  const md = dark ? GM[id + '-dark'] : null;
  if (dark && (!md || !fs.existsSync(path.join(IMG, 'guide', id + '-dark.webp')))) problems.push(`shot "${id}" has no dark image`);
  const marks = s.callouts.map((c, i) => `${i + 1}, ${c.name}: ${first(c.does)}`).join(' ');
  const alt = `${s.alt} Marked: ${marks}`;
  const narrow = m.w / (s.scale || 1) <= 420 && s.vp[0] <= 420 ? ' narrow' : '';
  return `<figure class="g-shot${dark ? ' has-dark' : ''}${narrow}">
  ${image(`guide/${id}.webp`, m, alt, 'lt')}${dark && md ? '\n  ' + image(`guide/${id}-dark.webp`, md, alt, 'dk') : ''}
  <figcaption><ol class="g-marks">
${s.callouts.map((c) => `    <li><span><b>${esc(c.name)}.</b> ${esc(c.does)}</span></li>`).join('\n')}
  </ol></figcaption>
</figure>`;
}
function ref(id, alt, cap) {
  const m = SM[id]; alt = alt || (m && m.alt);
  if (!m || !alt || !fs.existsSync(path.join(IMG, 'shots', id + '.webp'))) { problems.push(`reference image "${id}" is not in site/img/shots (run site/tools/make-screens.mjs)`); return ''; }
  return `<figure class="g-ref">${image(`shots/${id}.webp`, m, alt)}${cap ? `<figcaption>${esc(cap)}</figcaption>` : ''}</figure>`;
}
const part = (p) => {
  if (p.p) return `<p>${p.p}</p>`;
  if (p.h3) return `<h3>${p.h3}</h3>`;
  if (p.shot) return shot(p.shot);
  if (p.ref) return ref(p.ref);
  if (p.refs) return `<div class="g-refrow">\n${p.refs.map((r) => ref(r.id, r.alt, r.cap)).join('\n')}\n</div>`;
  if (p.note) return `<div class="g-note" role="note"><p>${p.note}</p></div>`;
  if (p.ul) return `<ul>\n${p.ul.map((x) => `  <li>${x}</li>`).join('\n')}\n</ul>`;
  if (p.steps) return `<ol class="g-do">\n${p.steps.map((x) => `  <li><span>${x}</span></li>`).join('\n')}\n</ol>`;
  if (p.code) return `<div class="g-code"><div class="g-cl"><span>${esc(p.label || 'Commands')}</span></div><pre tabindex="0"><code>${esc(p.code)}</code></pre></div>`;
  problems.push('unknown chapter part ' + JSON.stringify(p).slice(0, 60)); return '';
};

const toc = CHAPTERS.map((c, i) => `          <li><a href="#${c.id}">${esc(c.title)}${c.time ? ` <small>${esc(c.time)}</small>` : ''}</a></li>`).join('\n');
const chapters = CHAPTERS.map((c, i) => `      <section class="g-ch" id="${c.id}" aria-labelledby="${c.id}-h">
        <h2 id="${c.id}-h"><span class="g-n" aria-hidden="true">${i + 1}</span><span>${esc(c.title)}</span>${c.time ? `<span class="g-time">${esc(c.time)}</span>` : ''}</h2>
        <p class="lead">${c.lead}</p>
${c.parts.map(part).filter(Boolean).join('\n').replace(/^/gm, '        ')}
      </section>`).join('\n');

for (const id of Object.keys(SHOTS)) if (!used.has(id)) problems.push(`shot "${id}" is defined but no chapter uses it`);
let html = fs.readFileSync(path.join(G, 'index.html'), 'utf8');
html = html.replace('<!--@@toc-->', toc).replace('<!--@@chapters-->', chapters);
for (const m of html.matchAll(/<img\b[^>]*>/g)) if (!/\salt="[^"]{8,}"/.test(m[0])) problems.push('image without useful alt text: ' + m[0].slice(0, 70));
if (problems.length) { console.error(problems.map((p) => '  ' + p).join('\n') + `\n${problems.length} guide problem(s)`); process.exit(1); }
fs.mkdirSync(path.join(OUT, 'guide'), { recursive: true });
fs.writeFileSync(path.join(OUT, 'guide/index.html'), html);
for (const f of ['guide.css', 'guide.js']) fs.copyFileSync(path.join(G, f), path.join(OUT, 'guide', f));
console.log(`guide: ${CHAPTERS.length} chapters, ${used.size} annotated pictures -> ${path.relative(ROOT, OUT)}/guide/`);
