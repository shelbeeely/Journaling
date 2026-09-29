// Shared test helpers. Sample data only: the default book and layout, and the generic profile (profile.example.json).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openDb } from '../src/db.mjs';
import { Studio } from '../src/repo.mjs';
import { listen } from '../src/server.mjs';
import { emptySnapshot } from '../src/snapshot.mjs';
import { DEFAULT_BOOK } from '../../journal/book.mjs';

export const JOURNAL = path.resolve(new URL('../../journal', import.meta.url).pathname);
export const PASSWORD = 'correct horse battery';

// A clock that ticks one second per call, so commit times are distinct and ordered.
export function ticking() { let t = Date.parse('2026-10-01T09:00:00Z'); return () => new Date((t += 1000)).toISOString(); }

export function fresh() {
  const db = openDb(':memory:'), studio = new Studio(db, { now: ticking() });
  const user = (name) => { const u = studio.register({ username: name, password: PASSWORD, displayName: name[0].toUpperCase() + name.slice(1) }); return { id: u.id, username: u.username, displayName: u.displayName }; };
  return { db, studio, user };
}

// A project with the default book and layout, owned by `owner`.
export function project(studio, owner, over = {}) { return studio.createProject(owner, { name: 'Sample Journal', ...over }); }

// Edit like the editor does: mutate a copy of the day layout, hand it back.
export function withBlock(day, type, opts = {}) {
  const d = structuredClone(day);
  d.blocks.splice(d.blocks.findIndex((b) => b.type === 'actions'), 0, { uid: `${type}-t1`, type, on: true, ...opts });
  return d;
}
export const cloneBook = () => structuredClone(DEFAULT_BOOK);

// A journal folder made only of sample data: default book, default layout (none), the generic profile.
export function sampleJournalDir(extra = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-journal-'));
  fs.mkdirSync(path.join(dir, 'content'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'content/book.json'), JSON.stringify(DEFAULT_BOOK, null, 1) + '\n');
  fs.copyFileSync(path.join(JOURNAL, 'content/profile.example.json'), path.join(dir, 'content/profile.json'));
  for (const [rel, text] of Object.entries(extra)) fs.writeFileSync(path.join(dir, rel), text);
  return dir;
}

// A running server on a free port plus a tiny JSON client.
export async function serve(opts = {}) {
  const { db, studio, user } = fresh();
  const srv = await listen(studio, opts);
  const base = `http://127.0.0.1:${srv.address().port}`;
  const call = async (method, url, { token, body, headers = {}, raw } = {}) => {
    const r = await fetch(base + url, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers }, body: raw !== undefined ? raw : body ? JSON.stringify(body) : undefined });
    const ct = r.headers.get('content-type') || '';
    return { status: r.status, headers: r.headers, body: ct.includes('json') ? await r.json() : Buffer.from(await r.arrayBuffer()) };
  };
  const signup = async (name) => { await call('POST', '/api/auth/register', { body: { username: name, password: PASSWORD } }); const r = await call('POST', '/api/auth/login', { body: { username: name, password: PASSWORD } }); return r.body.token; };
  return { db, studio, user, srv, base, call, signup, close: () => new Promise((r) => srv.close(r)) };
}
export { emptySnapshot };
