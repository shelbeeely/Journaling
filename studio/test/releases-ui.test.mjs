// Releases in the editor's Versions drawer, against a real Studio server, in a real browser.
// Needs `node render.mjs month 2026-10 test.ics && node editor/build.mjs` in journal/ first; skipped without the built editor.
// SORTABLE_JS=/path/Sortable.min.js serves the drag library offline (sandbox only). Screens go to journal/editor/dist/test/releases-*.png.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { JOURNAL, serve, PASSWORD } from './helpers.mjs';
import { snapshotFromJournal } from '../src/pipeline.mjs';

const SITE = path.join(JOURNAL, 'editor/dist/site');
const OUT = path.join(JOURNAL, 'editor/dist/test');
const skip = fs.existsSync(path.join(SITE, 'index.html')) && fs.existsSync(path.join(JOURNAL, 'node_modules/playwright-core')) ? false : 'build the editor first (journal: render.mjs month 2026-10 test.ics, editor/build.mjs)';
const openDrawer = async (p) => { await p.click('#v-ver'); await p.waitForSelector('#versions[open]'); await p.waitForTimeout(300); };
const audit = (p) => p.evaluate(() => {
  const bad = [];
  for (const el of document.querySelectorAll('#vl button, #vl input, #vl textarea, #vl select')) {
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
    const name = (el.getAttribute('aria-label') || (el.labels && el.labels[0] && el.labels[0].textContent) || el.textContent || '').trim();
    if (!name) bad.push(`no name: ${el.outerHTML.slice(0, 80)}`);
    if (Math.min(r.width, r.height) < 43.5) bad.push(`small ${Math.round(r.width)}x${Math.round(r.height)}: ${name.slice(0, 40)}`);
  }
  return bad;
});
const noSideways = (p) => p.evaluate(() => { const d = document.querySelector('#versions'); return [document.documentElement.scrollWidth <= innerWidth + 1, d.scrollWidth <= d.clientWidth + 1]; });

test('releases in the Versions drawer: the owner releases a saved version, everyone who can read it sees and downloads it; guests cannot release; phone and dark', { skip, timeout: 240_000 }, async () => {
  const { launch } = await import('../../journal/browser.mjs');
  fs.mkdirSync(OUT, { recursive: true });
  const t = await serve({ staticDir: SITE });
  const b = await launch(), errs = [];
  const route = async (pg) => { await pg.route(/fonts\.(googleapis|gstatic)/, (r) => r.abort()); if (process.env.SORTABLE_JS) await pg.route(/cdnjs\.cloudflare\.com/, (r) => r.fulfill({ path: process.env.SORTABLE_JS, contentType: 'text/javascript' })); };
  try {
    const sam = await t.signup('sam');
    const pub = (await t.call('POST', '/api/projects', { token: sam, body: { name: 'Shared Sample', visibility: 'public', snapshot: snapshotFromJournal(JOURNAL) } })).body.project;
    await t.call('POST', `/api/projects/${pub.id}/releases`, { token: sam, body: { name: 'v0.9', notes: 'Proof copy.' } });

    // ---- the owner ----
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true }), p = await ctx.newPage();
    await route(p); p.on('pageerror', (e) => errs.push(e.message)); p.on('dialog', (d) => d.accept());
    await p.goto(t.base + '/', { waitUntil: 'networkidle' });
    await openDrawer(p);
    assert.equal(await p.locator('#vl').isVisible(), false, 'no releases section until a server project is open');
    await p.fill('#vs-user', 'sam'); await p.fill('#vs-pass', PASSWORD); await p.click('#vs-conn button[type=submit]'); await p.waitForSelector('#vs-who:not([hidden])');
    await p.selectOption('#vs-proj', pub.id);
    await p.waitForSelector('#vl:not([hidden])');
    await p.waitForSelector('#vl-list [data-rel="v0.9"]');
    assert.match(await p.textContent('#vl-list'), /v0\.9.*Proof copy/s);
    assert.ok(await p.locator('#vl-form').isVisible(), 'the owner can release');
    // an empty name is explained, not sent
    await p.click('#vl-form button[type=submit]');
    assert.match(await p.textContent('#vl-err'), /name/);
    await p.fill('#vl-name', 'v1.0'); await p.fill('#vl-notes', 'First print run.');
    await p.click('#vl-form button[type=submit]');
    await p.waitForSelector('#vl-list [data-rel="v1.0"]');
    assert.equal((await t.call('GET', `/api/projects/${pub.id}/releases`)).body.releases.length, 2);
    // the same name again: the server's reason is shown, nothing changes
    await p.fill('#vl-name', 'v1.0'); await p.click('#vl-form button[type=submit]');
    await p.waitForFunction(() => /already exists/.test(document.querySelector('#vl-err').textContent));
    assert.equal((await t.call('GET', `/api/projects/${pub.id}/releases`)).body.releases.length, 2);
    // download
    const [dl] = await Promise.all([p.waitForEvent('download'), p.click('[data-rel="v1.0"]')]);
    assert.equal(dl.suggestedFilename(), 'release-v1.0.json');
    const ex = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
    assert.equal(ex.release.name, 'v1.0'); assert.ok(ex.snapshot.book && ex.files['content/book.json']);
    assert.deepEqual(await audit(p), [], 'names and 44px targets');
    assert.deepEqual(await noSideways(p), [true, true]);
    await p.screenshot({ path: `${OUT}/releases-1-owner.png` });
    await ctx.close();

    // ---- a guest (no account): the list and the download, no form ----
    const gctx = await b.newContext({ viewport: { width: 390, height: 800 }, colorScheme: 'dark' }), g = await gctx.newPage();
    await route(g); g.on('pageerror', (e) => errs.push(e.message));
    const writes = []; g.on('request', (r) => { if (r.url().includes('/api/') && r.method() !== 'GET') writes.push(r.method() + ' ' + r.url()); });
    await g.goto(t.base + '/', { waitUntil: 'networkidle' });
    await openDrawer(g);
    await g.click(`[data-open="${pub.id}"]`);
    await g.waitForSelector('#vl-list [data-rel="v1.0"]');
    assert.equal(await g.locator('#vl-form').isVisible(), false, 'guests cannot release');
    assert.deepEqual(await audit(g), []);
    assert.deepEqual(await noSideways(g), [true, true], 'no sideways scroll at 390px');
    await g.locator('#vl').scrollIntoViewIfNeeded();
    await g.screenshot({ path: `${OUT}/releases-2-guest-phone-dark.png` });
    assert.deepEqual(writes, []);
    await gctx.close();
    assert.deepEqual(errs, []);
  } finally { await b.close(); await t.close(); }
});
