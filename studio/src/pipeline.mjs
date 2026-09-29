// The bridge to today's single-user pipeline. Import: content/book.json + content/daypage.json (+ the publishable part of
// content/profile.json) become a project snapshot. Export: a snapshot becomes content/book.json and content/daypage.json,
// the two files render.mjs reads. Nothing else in journal/ is touched: profile.json, the packs and the calendars stay where they are.
import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_BOOK } from '../../journal/book.mjs';
import { normalize, TYPES } from '../../journal/daypage.mjs';
import { MODULES } from '../../journal/profile.mjs';
import { serializeSnapshot, emptySnapshot } from './snapshot.mjs';

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
  return { book: book && Object.keys(book).length ? book : structuredClone(DEFAULT_BOOK), day: day && Object.keys(day).length ? day : null, ...publishableProfile(profile) };
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
export function journalFiles(snap) {
  const book = { version: snap.book.version, default: snap.book.default.map(entryOrder), months: Object.fromEntries(Object.entries(snap.book.months).map(([k, v]) => [k, { pages: v.pages.map(entryOrder) }])) };
  const day = normalize(snap.day);
  day.blocks = day.blocks.map((b) => Object.fromEntries([['uid', b.uid], ['type', b.type], ['on', b.on], ...TYPES[b.type].opts.map((o) => [o.k, b[o.k]]), ...(b.rows ? [['rows', b.rows]] : [])].filter(([, v]) => v !== undefined)));
  return { 'content/book.json': JSON.stringify(book, null, 1) + '\n', 'content/daypage.json': JSON.stringify(day, null, 2) + '\n' };
}
export function exportJournal(snap, dir) {
  const files = journalFiles(snap), written = [];
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
