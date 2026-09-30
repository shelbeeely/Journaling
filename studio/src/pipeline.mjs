// The bridge to today's single-user pipeline. Import: content/book.json + content/daypage.json (+ the publishable part of
// content/profile.json) become a project snapshot. Export: a snapshot becomes content/book.json and content/daypage.json,
// the two files render.mjs reads. Nothing else in journal/ is touched: profile.json, the packs and the calendars stay where they are.
import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_BOOK } from '../../journal/book.mjs';
import { normalize, TYPES, PLACE } from '../../journal/daypage.mjs';
import { MODULES } from '../../journal/modules.mjs';
import { validateLibrary, resolveBook, layoutsFor, bookOf } from '../../journal/library.mjs';
import { serializeSnapshot, emptySnapshot, libraryOf } from './snapshot.mjs';

const readJson = (f) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null);

// The profile fields that are safe to publish: the book's title and identity, trim, edition, first month, day start, module switches.
// Everything else in the profile (the person, the place and its coordinates, crisis lines, file paths, transit) is left behind.
export function publishableProfile(profile) {
  if (!profile || typeof profile !== 'object') return {};
  const b = profile.book || {};
  const meta = {}, print = {};
  for (const k of ['title', 'subtitle', 'slug']) if (typeof b[k] === 'string') meta[k] = b[k];
  if (['small', 'letter'].includes(profile.trim)) print.trim = profile.trim;
  if (Number.isInteger(b.edition)) print.edition = b.edition;
  if (typeof b.start === 'string') print.start = b.start;
  if (Number.isInteger(profile.day_start_hour)) print.day_start_hour = profile.day_start_hour;
  if (profile.modules && typeof profile.modules === 'object') print.modules = Object.fromEntries(Object.keys(MODULES).filter((k) => typeof profile.modules[k] === 'boolean').map((k) => [k, profile.modules[k]]));
  return { meta, print };
}

// Reads a journal folder (the journal/ directory of the repo): the book, the day layout and the publishable profile fields.
// A missing book.json or daypage.json means the default, exactly as the renderer treats it.
export function readJournal(dir) {
  const content = path.join(dir, 'content');
  const book = readJson(path.join(content, 'book.json'));
  const day = readJson(path.join(content, 'daypage.json'));
  const profile = readJson(path.join(content, 'profile.json'));
  const library = readJson(path.join(content, 'library.json')); // books and series (journal/library.mjs); nothing personal in it
  const safe = publishableProfile(profile);
  if (library) safe.meta = { ...(safe.meta || {}), library };
  return { book: book && Object.keys(book).length ? book : structuredClone(DEFAULT_BOOK), day: day && Object.keys(day).length ? day : null, ...safe };
}

// A snapshot from a journal folder (or from the same three pieces in memory).
export function snapshotFromJournal(src, { title } = {}) {
  const j = typeof src === 'string' ? readJournal(src) : src;
  const base = emptySnapshot(title || (j.meta && j.meta.title) || 'Journal');
  const meta = { ...base.meta, ...(j.meta || {}) };
  if (title) meta.title = title;
  return serializeSnapshot({ meta, print: { ...base.print, ...(j.print || {}) }, book: j.book || base.book, day: j.day || base.day }, base);
}

// The files as the renderer wants them. Same layout as the editor and the repo use today: book.json indented by one space,
// daypage.json by two, each ending in a newline.
// Stored parts are canonical (sorted keys); the files get their readable order back (id, type, on, options; uid, type, on, block options).
const entryOrder = (e) => ({ id: e.id, type: e.type, on: e.on, options: e.type === 'weeks' ? { month: (e.options.month || []).map(entryOrder), week: (e.options.week || []).map(entryOrder) } : e.options });
// A project with a library (snap.meta.library) also exports content/library.json: every book and series, the layouts inline, and
// `defaultBook` = the chosen book (or the library's own default), so `node render.mjs` builds that book, and KW_BOOK=<id> any other.
// content/book.json and daypage.json stay the project's own layouts (what a book with layoutRef "default" builds from).
// A project without a library exports the two files exactly as before.
export function journalFiles(snap, { book } = {}) {
  const book0 = { version: snap.book.version, default: snap.book.default.map(entryOrder), months: Object.fromEntries(Object.entries(snap.book.months).map(([k, v]) => [k, { pages: v.pages.map(entryOrder) }])) };
  const dayFile = (d) => {
    const day = normalize(d);
    day.blocks = day.blocks.map((b) => Object.fromEntries([['uid', b.uid], ['type', b.type], ['on', b.on], ...TYPES[b.type].opts.map((o) => [o.k, b[o.k]]), ...(b.rows ? [['rows', b.rows]] : []), ...PLACE.map((k) => [k, b[k]])].filter(([, v]) => v !== undefined)));
    return day;
  };
  const files = { 'content/book.json': JSON.stringify(book0, null, 1) + '\n', 'content/daypage.json': JSON.stringify(dayFile(snap.day), null, 2) + '\n' };
  const lib = snap.meta && snap.meta.library;
  if (book && !lib) throw new Error(`This project has one book, so there is no book "${book}" to choose. Save a library first (studio library init).`);
  if (lib) {
    if (book && !bookOf(lib, book)) throw new Error(`No book "${book}" in this project's library (books: ${lib.books.map((b) => b.id).join(', ')}).`);
    const out = { ...lib, defaultBook: book || lib.defaultBook || lib.books[0].id };
    out.layouts = (lib.layouts || []).map((l) => ({ id: l.id, name: l.name, ...(l.book ? { book: { version: l.book.version, default: l.book.default.map(entryOrder), months: Object.fromEntries(Object.entries(l.book.months).map(([k, v]) => [k, { pages: v.pages.map(entryOrder) }])) } } : {}), ...(l.day ? { day: dayFile(l.day) } : {}) }));
    files['content/library.json'] = JSON.stringify(out, null, 1) + '\n';
  }
  return files;
}
export function exportJournal(snap, dir, opts = {}) {
  const files = journalFiles(snap, opts), written = [];
  for (const [rel, text] of Object.entries(files)) {
    const f = path.join(dir, rel);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    const tmp = `${f}.tmp-${process.pid}`;
    fs.writeFileSync(tmp, text);
    fs.renameSync(tmp, f);
    written.push(f);
  }
  return written;
}
