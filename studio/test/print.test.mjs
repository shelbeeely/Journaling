// Import/export against the real print pipeline. Needs the journal's dependencies (npm ci in journal/) and Chromium; skipped without them.
//   1. round trip: import the default book + layout, export it back, render: the books are byte-identical (and check-identical.mjs agrees)
//   2. editor-to-print: edit in "editor state", commit over the API, export that commit, render, check.mjs says "[] 0"
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const run = promisify(execFile); // async: the API server lives in this process, so the event loop must keep running while a render is going
import { JOURNAL, serve, fresh, withBlock } from './helpers.mjs';
import { scanForbidden } from '../src/snapshot.mjs';
import { readJournal, snapshotFromJournal, exportJournal, journalFiles } from '../src/pipeline.mjs';
import { DEFAULT_BOOK } from '../../journal/book.mjs';
import { normalize } from '../../journal/daypage.mjs';

const haveDeps = fs.existsSync(path.join(JOURNAL, 'node_modules/bwip-js')) && fs.existsSync(path.join(JOURNAL, 'node_modules/playwright-core'));
const skip = haveDeps ? false : 'run "npm ci" in journal/ first (and Chromium: npx playwright-core install chromium)';
const sha = (f) => crypto.createHash('sha1').update(fs.readFileSync(f)).digest('hex');

// A scratch copy of journal/ (sample data path): the tests write content/*.json and render there, never in the repo.
function journalCopy() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-print-'));
  fs.cpSync(JOURNAL, dir, { recursive: true, filter: (src) => { const r = path.relative(JOURNAL, src); return !/^(node_modules|out|private|editor\/dist|gtfs\/.*\.zip)(\/|$)/.test(r) || r === 'out' || r === 'out/keeper' || r === 'out/keeper/index.json'; } });
  fs.rmSync(path.join(dir, 'content/daypage.json'), { force: true });
  fs.symlinkSync(path.join(JOURNAL, 'node_modules'), path.join(dir, 'node_modules'));
  return dir;
}
const render = async (dir, size = 'small', month = '2026-10') => {
  await run('node', ['render.mjs', 'month', month, 'test.ics'], { cwd: dir, env: { ...process.env, SIZE: size } });
  return path.join(dir, 'out', `m${month}${size === 'letter' ? '-letter' : ''}`);
};
const pagesOf = (outDir) => fs.readFileSync(path.join(outDir, 'journal.html'), 'utf8').replace(/Built \d{4}-\d{2}-\d{2}/, 'Built DATE');
const layoutOf = (outDir) => { const L = JSON.parse(fs.readFileSync(path.join(outDir, 'layout.json'), 'utf8')); return JSON.stringify(L.pages.map((p) => [p.page, p.id, p.label, p.type, p.date, p.section, p.code])); };

test('import reads only the book, the day layout and the publishable profile fields; export writes only content/book.json and content/daypage.json', () => {
  const dir = journalCopy();
  const before = ['content/profile.json', 'packs/spokane-wa/pack.json', 'packs/spokane-wa/support.json', 'packs/spokane-wa/clinic.json', 'packs/spokane-wa/trans.json'].map((f) => [f, sha(path.join(dir, f))]);
  const j = readJournal(dir);
  assert.deepEqual(j.book, DEFAULT_BOOK);
  assert.equal(j.day, null); // no daypage.json: the default layout
  const snap = snapshotFromJournal(dir);
  const text = JSON.stringify(snap);
  const profile = JSON.parse(fs.readFileSync(path.join(dir, 'content/profile.json'), 'utf8'));
  for (const private_ of [profile.person.name, profile.location.place, profile.location.timezone]) assert.equal(text.includes(`"${private_}"`), false, `${private_} is not part of a snapshot`);
  // the support / trans / clinic packs: none of their text is in a snapshot (the book lists the pages by type only)
  const strings = (v) => (typeof v === 'string' ? [v] : v && typeof v === 'object' ? Object.values(v).flatMap(strings) : []);
  for (const pack of ['support', 'trans', 'clinic']) {
    const f = path.join(dir, 'packs/spokane-wa', `${pack}.json`);
    if (!fs.existsSync(f)) continue;
    const leaked = strings(JSON.parse(fs.readFileSync(f, 'utf8'))).filter((x) => x.length > 8 && text.includes(JSON.stringify(x).slice(1, -1)));
    assert.deepEqual(leaked, [], `${pack} pack text leaked into the snapshot`);
  }
  assert.deepEqual(scanForbidden(snap), []);
  const written = exportJournal(snap, dir).map((f) => path.relative(dir, f));
  assert.deepEqual(written, ['content/book.json', 'content/daypage.json']);
  for (const [f, h] of before) assert.equal(sha(path.join(dir, f)), h, `${f} untouched`);
  // the exported files parse to exactly what the renderer would have used
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, 'content/book.json'), 'utf8')), DEFAULT_BOOK);
  assert.equal(fs.readFileSync(path.join(dir, 'content/book.json'), 'utf8'), fs.readFileSync(path.join(JOURNAL, 'content/book.json'), 'utf8')); // same bytes as the committed file
  assert.deepEqual(normalize(JSON.parse(fs.readFileSync(path.join(dir, 'content/daypage.json'), 'utf8'))), normalize(null));
  fs.rmSync(dir, { recursive: true, force: true });
});

test('round trip through the store: import -> commit -> read back -> export gives the same two files, from any commit', () => {
  const { studio, user } = fresh();
  const sam = user('sam');
  const snap = snapshotFromJournal(JOURNAL);
  const p = studio.createProject(sam, { name: 'Round trip', snapshot: snap, message: 'Import' });
  const v1 = studio.head(sam, p.id).commit;
  const day = withBlock(studio.head(sam, p.id).snapshot.day, 'checks', { title: 'Habits' });
  studio.commit(sam, p.id, { branch: 'main', expectedHead: v1.id, message: 'Add habits', snapshot: { day } });
  const a = journalFiles(studio.getCommit(sam, p.id, v1.id).snapshot);
  assert.deepEqual(a, journalFiles(snap)); // the first commit exports exactly what was imported
  const b = journalFiles(studio.getCommit(sam, p.id, 'main').snapshot);
  assert.equal(a['content/book.json'], b['content/book.json']);
  assert.notEqual(a['content/daypage.json'], b['content/daypage.json']);
  assert.ok(b['content/daypage.json'].includes('"Habits"'));
});

test('byte-identical books: the default project exports and renders exactly the current books (small and letter), and check-identical agrees', { skip, timeout: 600_000 }, async () => {
  const dir = journalCopy();
  try {
    const base = { small: await render(dir, 'small'), letter: await render(dir, 'letter') };
    const want = Object.fromEntries(Object.entries(base).map(([k, d]) => [k, [pagesOf(d), layoutOf(d)]]));
    // import the default project, export it back over the files, render again
    const { studio, user } = fresh();
    const sam = user('sam');
    const p = studio.createProject(sam, { name: 'Default', snapshot: snapshotFromJournal(dir), message: 'Import' });
    exportJournal(studio.head(sam, p.id).snapshot, dir);
    assert.ok(fs.existsSync(path.join(dir, 'content/daypage.json')));
    for (const size of ['small', 'letter']) {
      const out = await render(dir, size);
      assert.equal(pagesOf(out), want[size][0], `${size}: every page's HTML is identical`);
      assert.equal(layoutOf(out), want[size][1], `${size}: page order, ids, labels and scan codes are identical`);
    }
    // the repo's own gate, against its committed fingerprints (needs the Keeper index from build-all.sh, which the fingerprints include)
    if (fs.existsSync(path.join(dir, 'out/keeper/index.json'))) {
      for (const d of ['out/m2026-10', 'out/m2026-10-letter']) {
        const r = (await run('node', ['check-identical.mjs', d], { cwd: dir })).stdout;
        assert.match(r, /match the committed fingerprints/, r);
      }
    } else console.log('note: no out/keeper/index.json (run journal/build-all.sh first): the committed-fingerprint check was skipped, the byte comparison above still ran');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('editor to print: edit in editor state, commit over the API, export that commit, render a page, check.mjs says "[] 0"', { skip, timeout: 600_000 }, async () => {
  const t = await serve();
  const dir = journalCopy();
  try {
    const tok = await t.signup('editor-person');
    const { project } = (await t.call('POST', '/api/projects', { token: tok, body: { name: 'Editor to print', snapshot: snapshotFromJournal(dir) } })).body;
    const url = (s) => `/api/projects/${project.id}${s}`;
    const head = (await t.call('GET', url('/head'), { token: tok })).body;
    // "editor state": what the editor's change() does: mutate the layout, run normalize, save it as the day layout
    let layout = normalize(head.snapshot.day);
    layout.blocks.splice(layout.blocks.findIndex((b) => b.type === 'actions'), 0, { uid: 'studio-habits', type: 'checks', on: true, title: 'Studio habits', labels: ['Walked', 'Stretched'] });
    layout.blocks.find((b) => b.type === 'fact').on = false;
    layout = normalize(layout);
    const saved = await t.call('POST', url('/commits'), { token: tok, body: { branch: 'main', expectedHead: head.commit.id, message: 'Habits, no fact', snapshot: { day: layout } } });
    assert.equal(saved.status, 201);
    // export exactly that commit into the print pipeline (here, a scratch copy) and render
    const got = (await t.call('GET', url(`/commits/${saved.body.commit.id}`), { token: tok })).body;
    exportJournal(got.snapshot, dir);
    const disk = normalize(JSON.parse(fs.readFileSync(path.join(dir, 'content/daypage.json'), 'utf8')));
    assert.ok(disk.blocks.some((b) => b.uid === 'studio-habits' && b.title === 'Studio habits'));
    for (const size of ['small', 'letter']) {
      const out = await render(dir, size);
      const html = pagesOf(out);
      assert.ok(html.includes('Studio habits'), `${size}: the new block is on the printed day pages`);
      assert.ok(!html.includes('class="fact"'), `${size}: the fact block is off`);
      const r = (await run('node', ['check.mjs', path.basename(out)], { cwd: dir })).stdout.trim();
      assert.match(r, /\[\] 0$/, `${size}: check.mjs -> ${r}`);
    }
    // the old version still exports the old page
    const old = (await t.call('GET', url(`/commits/${head.commit.id}`), { token: tok })).body;
    exportJournal(old.snapshot, dir);
    assert.ok(!pagesOf(await render(dir, 'small')).includes('Studio habits'));
  } finally { await t.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('editor to print after a fork and a merge: independent edits in a fork and upstream (and one resolved conflict) merge, export, render, check.mjs says "[] 0"', { skip, timeout: 600_000 }, async () => {
  const t = await serve();
  const dir = journalCopy();
  try {
    const ana = await t.signup('anna-print'), bo = await t.signup('bobo-print');
    const api = (m, u, token, body) => t.call(m, u, { token, body });
    const up = (await api('POST', '/api/projects', ana, { name: 'Print Sample', visibility: 'public', allowReuse: true, snapshot: snapshotFromJournal(dir), license: 'CC BY 4.0' })).body.project;
    const fk = (await api('POST', `/api/projects/${up.id}/forks`, bo, { name: 'Print fork' })).body.project;
    assert.equal(fk.attribution.license, 'CC BY 4.0');
    const edit = async (who, pid, message, fn) => {
      const h = (await api('GET', `/api/projects/${pid}/head`, who)).body, snap = structuredClone(h.snapshot); fn(snap);
      const r = await api('POST', `/api/projects/${pid}/commits`, who, { branch: 'main', expectedHead: h.commit.id, message, snapshot: { day: snap.day, book: snap.book } });
      assert.equal(r.status, 201, JSON.stringify(r.body));
    };
    const block = (s, u) => s.day.blocks.find((b) => b.uid === u);
    // the fork: a habits block, no fact line, a Notes page, and a shorter action list
    await edit(bo, fk.id, 'Habits, no fact, a Trip page', (s) => {
      s.day.blocks.splice(s.day.blocks.findIndex((b) => b.type === 'actions'), 0, { uid: 'fork-habits', type: 'checks', on: true, title: 'Fork habits', labels: ['Walked', 'Stretched'] });
      block(s, 'fact').on = false; block(s, 'actions').count = 2;
      s.book.default.splice(3, 0, { id: 'trip', type: 'notes', on: true, options: { title: 'Trip notes' } });
    });
    // upstream, meanwhile: a shorter review, the same action list changed differently (a conflict), lineage page hidden
    await edit(ana, up.id, 'Shorter review, one action line', (s) => { block(s, 'review').h = 1; block(s, 'actions').count = 1; s.book.default.find((p) => p.id === 'lineage').on = false; });
    const pr = (await api('POST', `/api/projects/${up.id}/proposals`, bo, { sourceProject: fk.id, sourceBranch: 'main', title: 'Habits and a trip page' })).body.proposal;
    const cmp = (await api('GET', `/api/projects/${up.id}/proposals/${pr.number}/compare`, ana)).body;
    assert.deepEqual(cmp.merge.conflicts.map((c) => c.id), ['block:actions']);
    const expectedHeads = { ours: cmp.commits.ours.id, theirs: cmp.commits.theirs.id };
    assert.equal((await api('POST', `/api/projects/${up.id}/proposals/${pr.number}/merge`, ana, { expectedHeads })).status, 409);
    const merged = await api('POST', `/api/projects/${up.id}/proposals/${pr.number}/merge`, ana, { expectedHeads, resolutions: { 'block:actions': { choose: 'manual', value: { ...cmp.merge.conflicts[0].ours, count: 2 } } } });
    assert.equal(merged.status, 201, JSON.stringify(merged.body)); assert.equal(merged.body.commit.parents.length, 2);
    // export exactly the merged version into the print pipeline and render both trims
    const got = (await api('GET', `/api/projects/${up.id}/commits/${merged.body.commit.id}`, ana)).body;
    exportJournal(got.snapshot, dir);
    for (const size of ['small', 'letter']) {
      const out = await render(dir, size), html = pagesOf(out);
      assert.ok(html.includes('Fork habits'), `${size}: the fork's block is on the printed day pages`);
      assert.ok(!html.includes('class="fact"'), `${size}: the fork hid the fact line`);
      assert.ok(html.includes('Trip notes'), `${size}: the fork's Notes page is in the book`);
      assert.ok(!html.includes('Where each piece comes from'), `${size}: upstream hid the lineage page`);
      const r = (await run('node', ['check.mjs', path.basename(out)], { cwd: dir }).catch((e) => ({ stdout: `FAILED: ${e.stdout}${e.stderr}` }))).stdout.trim();
      assert.match(r, /\[\] 0$/, `${size}: check.mjs -> ${r}`);
    }
    // page ids stay unique and stable through the merge
    const L = JSON.parse(fs.readFileSync(path.join(dir, 'out/m2026-10/layout.json'), 'utf8')), ids = L.pages.map((p) => p.id);
    assert.equal(new Set(ids).size, ids.length); assert.ok(ids.includes('trip'));
  } finally { await t.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});
