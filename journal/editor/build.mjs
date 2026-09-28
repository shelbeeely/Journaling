// Builds editor/day-editor.html: the drag-and-drop day page editor (published as a private Artifact).
// It inlines daypage.mjs (the same block code the print build uses) plus the real page CSS, so the preview
// is the printed page. Sample content is generic: no calendar events or routines from private/.
//   node render.mjs month 2026-10 private/main.ics,private/birthdays.ics && node editor/build.mjs
import fs from 'node:fs';
const root = new URL('../', import.meta.url);
const read = (p) => fs.readFileSync(new URL(p, root), 'utf8');
const h = read('out/m2026-10/journal.html');
const css = h.slice(h.indexOf('<style>') + 7, h.indexOf('</style>'))
  .replace(/@page[^}]*\}/, '').replace(/html, body \{[^}]*\}/, '')
  .replace(/(^|\n)body \{/, '$1.page {') // no body in the preview: the page carries the base font
  .replace(/([^{}]+)\{/g, (_, sel) => sel.split(',').map((x) => `#pv ${x.trim()}`).join(', ') + ' {'); // scope to the preview
const k = h.indexOf('2026-10-31 · ');
const seg = h.slice(h.lastIndexOf('<div class="page', k), h.indexOf('<div class="page', k));
const pick = (re) => (seg.match(re) || [''])[0];
const kit = {
  css,
  header: pick(/<div class="hz">.*?TAGS:<\/span><\/div><\/div>/s),
  sky: pick(/<div class="sky1".*?<\/span><\/div>/s),
  notes: pick(/<div class="sky2l"[^>]*>.*?<\/div>/s),
  events: '<div class="dev" data-zone="events">○ 10:00a Clinic appointment · ○ 2:00p Pick up prescription · ○ 6:30p Dinner with a friend downtown</div>',
  fact: pick(/<div class="fact".*?<\/div>/s),
  routines: ['7:30a Morning routine', '8:00p Evening routine'], // a busy day, so the meter errs on the safe side
  strip: seg.slice(seg.indexOf('<div class="frame">'), seg.trimEnd().lastIndexOf('</div>')),
};
// Method layouts ride along after the block library (their import of daypage.mjs is already in scope).
const lib = read('daypage.mjs').replace(/^export /gm, '') + '\n' + read('content/layouts.mjs').replace(/^import .*$/gm, '').replace(/^export /gm, '');
const tpl = read('editor/template.html').replace('/*__DAYPAGE__*/', () => lib).replace('/*__KIT__*/', () => `const KIT = ${JSON.stringify(kit)};`);
const dist = new URL('editor/dist/', root);
fs.mkdirSync(new URL('site/', dist), { recursive: true });
// 1) Claude Artifact (saves to the artifact's store; the host adds the document skeleton)
const art = tpl.replace("'__MODE__'", "'artifact'").replace('<!--__HEAD__-->', '').replace('<!--__FOOT__-->', '');
fs.writeFileSync(new URL('artifact.html', dist), art);
// 2) GitHub Pages site (saves in the browser, commits to the repo with a token)
const site = tpl.replace("'__MODE__'", "'pages'")
  .replace('<!--__HEAD__-->', '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="robots" content="noindex">')
  .replace('<header class="top">', '</head>\n<body>\n<header class="top">')
  .replace('<!--__FOOT__-->', '</body>\n</html>');
fs.writeFileSync(new URL('site/index.html', dist), site);
const cur = new URL('content/daypage.json', root);
fs.writeFileSync(new URL('site/daypage.json', dist), fs.existsSync(cur) ? fs.readFileSync(cur) : '{}\n');
fs.writeFileSync(new URL('site/.nojekyll', dist), '');
console.log('editor/dist/artifact.html + editor/dist/site/', (site.length / 1024).toFixed(0) + ' KB');
