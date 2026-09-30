#!/usr/bin/env node
// The library from the command line (library.mjs is the model; content/library.json is the file).
//   node library-cli.mjs list                    books and series, and which book a build uses (KW_BOOK=<id> picks another)
//   node library-cli.mjs check [file]            validate a library file (default content/library.json, else the profile's own book)
//   node library-cli.mjs resolve <book id>       what a book is after series defaults: title, plan, modules, cover, layouts, and where each came from
//   node library-cli.mjs migrate [--write]       the profile's single book as a library (prints it; --write saves content/library.json)
//   node library-cli.mjs effective               the profile a build of this book sees (epub.py reads this), as JSON
// Build one book of the library:  KW_BOOK=<id> KW_OUT=out/<id> ./build-all.sh   (each book needs its own out folder)
import fs from 'node:fs';
import path from 'node:path';
import { PROFILE, PROFILE_FILE, PROFILE_BOOK, LIBRARY, LIBRARY_FILE, BOOK_KEY } from './profile.mjs';
import { validateLibrary, resolveBook, libraryFromProfile, shelf } from './library.mjs';

const [cmd, arg] = process.argv.slice(2);
const HERE = path.dirname(new URL(import.meta.url).pathname);
const out = (x) => console.log(typeof x === 'string' ? x : JSON.stringify(x, null, 1));
const baseProfile = () => JSON.parse(fs.readFileSync(PROFILE_FILE, 'utf8'));
if (cmd === 'list') {
  console.log(`library: ${LIBRARY_FILE ? path.relative(process.cwd(), LIBRARY_FILE) : 'derived from the profile (one book)'}; a build uses "${BOOK_KEY}"`);
  for (const s of shelf(LIBRARY)) {
    if (s.kind === 'book') console.log(`  ${s.book.id}  "${s.book.title}"  (standalone)`);
    else { console.log(`  series ${s.series.id}  "${s.series.title}"  ${s.books.length} book${s.books.length === 1 ? '' : 's'}`); s.books.forEach((b, i) => console.log(`    ${i + 1}. ${b.id}  "${b.title}"`)); }
  }
} else if (cmd === 'check') {
  const f = arg ? path.resolve(arg) : LIBRARY_FILE;
  const lib = f ? JSON.parse(fs.readFileSync(f, 'utf8')) : LIBRARY;
  const errs = validateLibrary(lib);
  if (errs.length) { console.error(`${f || 'library'} is not valid:\n  - ${errs.join('\n  - ')}`); process.exit(1); }
  console.log(`${f ? path.relative(process.cwd(), f) : 'library (derived from the profile)'}: ${lib.books.length} book(s), ${(lib.series || []).length} series. Valid.`);
} else if (cmd === 'resolve') {
  out(resolveBook(LIBRARY, arg || BOOK_KEY, PROFILE_BOOK));
} else if (cmd === 'migrate') {
  const lib = libraryFromProfile(baseProfile());
  if (process.argv.includes('--write')) {
    const f = path.join(HERE, 'content/library.json');
    if (fs.existsSync(f)) { console.error(`${f} already exists; not overwritten.`); process.exit(1); }
    fs.writeFileSync(f, JSON.stringify(lib, null, 1) + '\n');
    console.log(`Wrote ${f}. The profile keeps the person, place and packs; the book's own fields now also live in the library (they match, so nothing changes).`);
  } else out(lib);
} else if (cmd === 'effective') out(PROFILE);
else console.log(fs.readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(1, 9).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
