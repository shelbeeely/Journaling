#!/usr/bin/env node
// Journalwright Studio command line.
//   node bin/studio.mjs serve                       start the API (and the editor, if it is built) on http://127.0.0.1:8787
//   node bin/studio.mjs user add <name>             create an account (password from STUDIO_PASSWORD, or prompted)
//   node bin/studio.mjs import <journal-dir> --user <name> [--name "Title"] [--public]   book.json + daypage.json -> a new project
//   node bin/studio.mjs export --user <name> --project <id|slug> [--ref main] [--out <journal-dir>]   a commit -> content/*.json
//   node bin/studio.mjs projects --user <name>
//   node bin/studio.mjs library list --user <name> --project <id|slug> [--ref main]        books and series of a project (an old project is a library of one book)
//   node bin/studio.mjs library init --user <name> --project <id|slug> [--branch main]     save that library into the project as a commit (migration; changes nothing else)
//   node bin/studio.mjs export ... --book <book id>      with a library: content/library.json with that book as the default, plus book.json and daypage.json
// Environment: STUDIO_DB (default studio/data/studio.db), PORT (8787), HOST (127.0.0.1), STUDIO_STATIC (folder to serve, default the built
// editor), STUDIO_CORS (comma list of allowed origins for a separately hosted editor), STUDIO_REGISTRATION=closed.
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { openDb } from '../src/db.mjs';
import { Studio } from '../src/repo.mjs';
import { listen } from '../src/server.mjs';
import { readJournal, snapshotFromJournal, exportJournal } from '../src/pipeline.mjs';
import { libraryOf } from '../src/snapshot.mjs';
import { shelf } from '../../journal/library.mjs';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(`--${n}`); return i < 0 ? d : args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true; };
const DB = process.env.STUDIO_DB || path.join(HERE, '../data/studio.db');
const die = (m) => { console.error(m); process.exit(1); };

async function password() {
  if (process.env.STUDIO_PASSWORD) return process.env.STUDIO_PASSWORD;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try { return await rl.question('Password (10+ characters): '); } finally { rl.close(); }
}
const asUser = (db, name) => { const u = db.prepare('SELECT id, username, display_name AS displayName FROM users WHERE username = ?').get(String(name)); if (!u) die(`No user "${name}". Create one: node bin/studio.mjs user add ${name}`); return { ...u }; };

const cmd = args[0];
if (cmd === 'serve') {
  const db = openDb(DB), studio = new Studio(db);
  const dist = path.join(HERE, '../../journal/editor/dist/site');
  const staticDir = process.env.STUDIO_STATIC || (fs.existsSync(dist) ? dist : null);
  const srv = await listen(studio, { port: +(process.env.PORT || 8787), host: process.env.HOST || '127.0.0.1', staticDir, corsOrigins: (process.env.STUDIO_CORS || '').split(',').map((s) => s.trim()).filter(Boolean), openRegistration: process.env.STUDIO_REGISTRATION !== 'closed' });
  const { port } = srv.address();
  console.log(`Journalwright Studio on http://${process.env.HOST || '127.0.0.1'}:${port}/  (database ${DB})`);
  console.log(staticDir ? `Editor: http://127.0.0.1:${port}/  (open the Versions view)` : 'The editor is not built: cd journal && node render.mjs month 2026-10 test.ics && node editor/build.mjs');
} else if (cmd === 'user' && args[1] === 'add') {
  if (!args[2]) die('Usage: user add <name>');
  const s = new Studio(openDb(DB));
  const u = s.register({ username: args[2], password: await password(), displayName: flag('display', args[2]) });
  console.log(`Created user ${u.username}.`);
} else if (cmd === 'import') {
  const dir = args[1] && !args[1].startsWith('--') ? args[1] : die('Usage: import <journal-dir> --user <name>');
  const db = openDb(DB), s = new Studio(db), user = asUser(db, flag('user'));
  const j = readJournal(dir);
  const snap = snapshotFromJournal(j, { title: typeof flag('name') === 'string' ? flag('name') : undefined });
  const p = s.createProject(user, { name: snap.meta.title, visibility: flag('public') ? 'public' : 'private', allowReuse: !!flag('allow-reuse'), snapshot: snap, message: 'Import from the journal folder' });
  console.log(`Imported ${dir} as project "${p.name}" (${p.id}), branch main at ${p.head.slice(0, 10)}. Private pages, calendars and profile secrets were not read into it.`);
} else if (cmd === 'export') {
  const db = openDb(DB), s = new Studio(db), user = asUser(db, flag('user'));
  const key = String(flag('project'));
  const row = db.prepare('SELECT id FROM projects WHERE id = ? OR slug = ?').get(key, key);
  if (!row) die(`No project "${key}".`);
  const { commit, snapshot } = s.getCommit(user, row.id, typeof flag('ref') === 'string' ? flag('ref') : 'main');
  const out = typeof flag('out') === 'string' ? flag('out') : path.join(HERE, '../../journal');
  const written = exportJournal(snapshot, out, { book: typeof flag('book') === 'string' ? flag('book') : undefined });
  console.log(`Exported ${commit.short} (${commit.message}) to:\n  ${written.join('\n  ')}`);
} else if (cmd === 'library') {
  const db = openDb(DB), s = new Studio(db), user = asUser(db, flag('user'));
  const key = String(flag('project'));
  const row = db.prepare('SELECT id FROM projects WHERE id = ? OR slug = ?').get(key, key);
  if (!row) die(`No project "${key}".`);
  const branch = typeof flag('branch') === 'string' ? flag('branch') : typeof flag('ref') === 'string' ? flag('ref') : 'main';
  const { commit, snapshot } = s.getCommit(user, row.id, branch);
  if (args[1] === 'list') {
    console.log(`${snapshot.meta.library ? 'library saved in the project' : 'no library saved: the project is a library of one book'} (${commit.short})`);
    for (const x of shelf(libraryOf(snapshot))) {
      if (x.kind === 'book') console.log(`  ${x.book.id}  "${x.book.title}"  (standalone)`);
      else { console.log(`  series ${x.series.id}  "${x.series.title}"`); x.books.forEach((b, i) => console.log(`    ${i + 1}. ${b.id}  "${b.title}"`)); }
    }
  } else if (args[1] === 'init') {
    if (snapshot.meta.library) die('This project already has a library.');
    const c = s.commit(user, row.id, { branch, expectedHead: commit.id, message: 'Save the library (one book)', snapshot: { meta: { ...snapshot.meta, library: libraryOf(snapshot) } } });
    console.log(`Saved the library into ${row.id} on ${branch}: ${c.unchanged ? 'unchanged' : `commit ${c.commit ? c.commit.short : ''}`}. Nothing else changed.`);
  } else die('Usage: library list|init --user <name> --project <id|slug>');
} else if (cmd === 'projects') {
  const db = openDb(DB), s = new Studio(db);
  for (const p of s.listProjects(asUser(db, flag('user')))) console.log(`${p.id}  ${p.slug}  ${p.visibility}  ${p.role}`);
} else {
  console.log(fs.readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(1, 11).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
}
