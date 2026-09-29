// Builds editor/day-editor.html: the drag-and-drop day page editor (published as a private Artifact).
// It inlines daypage.mjs (the same block code the print build uses) plus the real page CSS, so the preview
// is the printed page. Sample content is generic: no calendar events or routines from private/.
//   node render.mjs month 2026-10 private/main.ics,private/birthdays.ics && node editor/build.mjs
import fs from 'node:fs';
import zlib from 'node:zlib';
import { samplePages } from './samples.mjs';
import { PROFILE, firstMonthId } from '../profile.mjs';
const M0 = firstMonthId(); // the profile's first month: the book the editor's preview is cut from
const SAMPLE_DATE = `${M0}-${new Date(Date.UTC(+M0.slice(0, 4), +M0.slice(5), 0)).getUTCDate()}`; // its last day (Oct 31 2026 for Shelbee)
const root = new URL('../', import.meta.url);
const OUTD = process.env.KW_OUT || 'out'; // KW_OUT + KW_PROFILE: the public demo is cut from a generic-profile build
const DIST = process.env.EDITOR_DIST || 'editor/dist/'; // where the three builds go (default editor/dist/)
const read = (p) => fs.readFileSync(new URL(p, root), 'utf8');
const h = read(`${OUTD}/m${M0}/journal.html`);
const css = h.slice(h.indexOf('<style>') + 7, h.indexOf('</style>'))
  .replace(/@page[^}]*\}/, '').replace(/html, body \{[^}]*\}/, '')
  .replace(/(^|\n)body \{/, '$1.page {') // no body in the preview: the page carries the base font
  .replace(/([^{}]+)\{/g, (_, sel) => sel.split(',').map((x) => `#pv ${x.trim()}`).join(', ') + ' {'); // scope to the preview
// The sample day for the Tier 2 blocks: a real date and its calculated sunrise and sunset (generic, no calendar data).
const sd = JSON.parse(read(`${OUTD}/m${M0}/data.json`)).days.find((x) => x.date === SAMPLE_DATE);
const sampleDay = { date: SAMPLE_DATE, rise: sd.sun.rise, set: sd.sun.set };
const k = h.indexOf(`${SAMPLE_DATE} · `);
const seg = h.slice(h.lastIndexOf('<div class="page', k), h.indexOf('<div class="page', k));
const pick = (re) => (seg.match(re) || [''])[0];
const kit = {
  css,
  header: pick(/<div class="hz">.*?TAGS:<\/span><\/div><\/div>/s),
  sky: pick(/<div class="sky1".*?<\/span><\/div>/s),
  notes: pick(/<div class="sky2l"[^>]*>.*?<\/div>/s),
  events: '<div class="dev" data-zone="events">○ 10:00a Clinic appointment · ○ 2:00p Pick up prescription · ○ 6:30p Dinner with a friend downtown</div>',
  fact: pick(/<div class="fact".*?<\/div>/s),
  day: sampleDay,
  routines: ['7:30a Morning routine', '8:00p Evening routine'], // a busy day, so the meter errs on the safe side
  strip: seg.slice(seg.indexOf('<div class="frame">'), seg.trimEnd().lastIndexOf('</div>')),
};
// Method layouts ride along after the block library (their import of daypage.mjs is already in scope).
const lib = read('daypage.mjs').replace(/^export /gm, '') + '\n' + read('content/layouts.mjs').replace(/^import .*$/gm, '').replace(/^export /gm, '');
const tpl = read('editor/template.html').replace('Keeping Watch · every monthly book', () => `${PROFILE.book.title.replace(/&/g, '&amp;').replace(/</g, '&lt;')} · every monthly book`).replace('/*__DAYPAGE__*/', () => lib).replace('/*__KIT__*/', () => `const KIT = ${JSON.stringify(kit)};`);
const dist = new URL(DIST, root);
fs.mkdirSync(new URL('site/', dist), { recursive: true });
// 1) Claude Artifact (saves to the artifact's store; the host adds the document skeleton)
// The Artifact is one file, so the sample book (the book canvas's thumbnails) rides inside it, gzipped: about a tenth of its size.
const sample = JSON.stringify({ css, ...(await samplePages()) });
const art = tpl.replace("'__MODE__'", "'artifact'").replace("'__BOOKDATA__'", () => `'${zlib.gzipSync(sample, { level: 9 }).toString('base64')}'`).replace('<!--__HEAD__-->', '').replace('<!--__FOOT__-->', '');
fs.writeFileSync(new URL('artifact.html', dist), art);
// 2) GitHub Pages site (saves in the browser, commits to the repo with a token)
const site = tpl.replace("'__MODE__'", "'pages'").replace("'__BOOKDATA__'", "''")
  .replace('<!--__HEAD__-->', '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="robots" content="noindex">')
  .replace('<header class="top">', '</head>\n<body>\n<header class="top">')
  .replace('<!--__FOOT__-->', '</body>\n</html>');
fs.writeFileSync(new URL('site/index.html', dist), site);
const cur = new URL('content/daypage.json', root);
fs.writeFileSync(new URL('site/daypage.json', dist), fs.existsSync(cur) ? fs.readFileSync(cur) : '{}\n');
fs.writeFileSync(new URL('site/.nojekyll', dist), '');
// 3) The public demo (the product site links to it at /editor/): built from the generic profile and test.ics only, never saves anywhere
// (no GitHub, no browser storage of the layout), and shows a "demo, sample data" banner. Same pages-sample.json.
fs.mkdirSync(new URL('demo/', dist), { recursive: true });
fs.writeFileSync(new URL('demo/index.html', dist), site.replace("'pages'", "'demo'").replace('<meta name="robots" content="noindex">', '<meta name="robots" content="index">').replace('<title>Day Page Editor</title>', '<title>Journalwright Studio editor demo</title>').replaceAll('Keeping Watch', () => PROFILE.book.title));
fs.writeFileSync(new URL('demo/pages-sample.json', dist), sample);
fs.writeFileSync(new URL('demo/daypage.json', dist), '{}\n');
fs.writeFileSync(new URL('demo/.nojekyll', dist), '');
// The sample book (every page of the book, drawn by pages.mjs from test.ics) with the scoped page CSS: the Book view's thumbnails.
fs.writeFileSync(new URL('site/pages-sample.json', dist), sample);
console.log('editor/dist/artifact.html', (art.length / 1024).toFixed(0) + ' KB, editor/dist/site/', (site.length / 1024).toFixed(0) + ' KB + pages-sample.json', (sample.length / 1024).toFixed(0) + ' KB');
