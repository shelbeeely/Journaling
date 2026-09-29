// The editor's Versions drawer against a real Studio server (serving the built editor from the same origin), in a real browser.
// Needs `node render.mjs month 2026-10 test.ics && node editor/build.mjs` in journal/ first; skipped without the built editor.
// Screens go to journal/editor/dist/test/studio-*.png (look at them).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { JOURNAL, serve, PASSWORD } from './helpers.mjs';
import { snapshotFromJournal } from '../src/pipeline.mjs';

const SITE = path.join(JOURNAL, 'editor/dist/site');
const OUT = path.join(JOURNAL, 'editor/dist/test');
const skip = fs.existsSync(path.join(SITE, 'index.html')) && fs.existsSync(path.join(JOURNAL, 'node_modules/playwright-core')) ? false : 'build the editor first (journal: render.mjs month 2026-10 test.ics, editor/build.mjs)';
const types = (p) => p.evaluate(() => layout.blocks.map((x) => x.type).join(' '));
const openDrawer = async (p) => { await p.click('#v-ver'); await p.waitForSelector('#versions[open]'); await p.waitForTimeout(300); }; // the drawer slides in

test('guests: local versions in this browser (no account), read a public project, nothing uploaded, no writes', { skip, timeout: 240_000 }, async () => {
  const { launch } = await import('../../journal/browser.mjs');
  fs.mkdirSync(OUT, { recursive: true });
  const t = await serve({ staticDir: SITE });
  const b = await launch(), errs = [];
  try {
    const sam = await t.signup('sam');
    const pub = (await t.call('POST', '/api/projects', { token: sam, body: { name: 'Shared Sample', description: 'A public sample book', visibility: 'public', allowReuse: true, snapshot: snapshotFromJournal(JOURNAL) } })).body.project;
    const priv = (await t.call('POST', '/api/projects', { token: sam, body: { name: 'Private Sample' } })).body.project;
    const h = (await t.call('GET', `/api/projects/${pub.id}/head`, { token: sam })).body;
    const day = structuredClone(h.snapshot.day); day.blocks.splice(day.blocks.findIndex((x) => x.type === 'actions'), 0, { uid: 'habits', type: 'checks', on: true, title: 'Habits', labels: ['Stretch'] });
    await t.call('POST', `/api/projects/${pub.id}/commits`, { token: sam, body: { branch: 'main', expectedHead: h.commit.id, message: 'Add habit boxes', snapshot: { day } } });

    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
    const p = await ctx.newPage(), calls = [], writes = [];
    p.on('pageerror', (e) => errs.push(e.message));
    p.on('dialog', (d) => d.accept());
    p.on('request', (r) => { if (r.url().includes('/api/')) calls.push(r.method() + ' ' + new URL(r.url()).pathname + new URL(r.url()).search); if (r.url().includes('/api/') && r.method() !== 'GET') writes.push(r.url()); });
    await p.goto(t.base + '/', { waitUntil: 'networkidle' });
    const original = await types(p);
    assert.equal(original, 'sky notes events care spoons good body actions review fact');
    // reachable from the header, in every view
    await p.click('#v-book'); assert.ok(await p.locator('#v-ver').isVisible(), 'the Versions button is there in the Book view');
    await p.click('#v-day');
    await openDrawer(p);
    assert.match(await p.textContent('#vs-guest'), /Sign in to save versions/);
    assert.match(await p.textContent('#vs-guest'), /stays in this browser/);
    assert.equal(await p.locator('#vs-proj option:checked').textContent(), 'This browser');
    assert.ok(await p.locator('#vs-save').isVisible(), 'a guest can save versions here');
    assert.ok(await p.locator('#vs-pub').isVisible(), 'the public projects on the server are listed without signing in');
    assert.match(await p.textContent('#vs-publist'), /Shared Sample/);
    assert.doesNotMatch(await p.textContent('#vs-publist'), /Private Sample/);
    await p.screenshot({ path: `${OUT}/studio-1-guest.png` });
    // save a version, edit, save another, compare, restore: all in this browser
    await p.fill('#vs-msg', 'The original page'); await p.click('#vs-savebtn');
    await p.waitForFunction(() => document.querySelectorAll('#vs-log .vs-c').length === 1);
    await p.evaluate(() => change((L) => { L.blocks.splice(L.blocks.findIndex((x) => x.type === 'actions'), 0, { uid: 'mine', type: 'checks', on: true, title: 'My habits', labels: ['Walk', 'Water'] }); L.blocks.find((x) => x.type === 'fact').on = false; }));
    assert.match(await p.textContent('#vs-chip'), /Changes since your last version/);
    assert.ok(await p.locator('#vs-log .vs-c.draft').isVisible());
    await p.fill('#vs-msg', 'Habit boxes, no fact line'); await p.click('#vs-savebtn');
    await p.waitForFunction(() => document.querySelectorAll('#vs-log .vs-c:not(.draft)').length === 2);
    assert.match(await p.textContent('#vs-chip'), /Matches your latest version/);
    await p.locator('#vs-log .vs-c', { hasText: 'Habit boxes, no fact line' }).locator('[data-cmp]').click();
    await p.waitForSelector('#vs-pb .vpv [data-mark]');
    assert.match(await p.textContent('#vs-cmp'), /Checkboxes “My habits”/);
    assert.match(await p.textContent('#vs-cmp'), /On this day/);
    assert.equal(await p.locator('#vs-cmp h3', { hasText: 'Book pages' }).count(), 0, 'this browser keeps the day page only');
    await p.screenshot({ path: `${OUT}/studio-2-guest-compare.png` });
    await p.locator('#vs-log .vs-c', { hasText: 'The original page' }).locator('[data-restore]').click();
    await p.waitForFunction(() => document.querySelectorAll('#vs-log .vs-c:not(.draft)').length === 3);
    assert.equal(await types(p), original, 'restored into the editor');
    assert.match(await p.textContent('#vs-log'), /Restore “The original page”/);
    // the history survives a reload (this browser's own storage)
    await p.reload({ waitUntil: 'networkidle' }); await openDrawer(p);
    assert.equal(await p.locator('#vs-log .vs-c').count(), 3);
    // a public project: history and compare, read only, the editor's own page untouched
    await p.click('[data-open="' + pub.id + '"]');
    await p.waitForFunction(() => /Reading/.test(document.querySelector('#vs-banner').textContent));
    assert.ok(await p.locator('#vs-save').isHidden(), 'no saving into someone else’s project');
    assert.equal(await p.locator('#vs-log [data-restore]').count(), 0);
    assert.equal(await p.locator('#vs-nb').isHidden(), true);
    assert.equal(await types(p), original, 'the guest’s own page was not replaced');
    assert.match(await p.textContent('#vs-log'), /Add habit boxes/);
    await p.locator('#vs-log .vs-c', { hasText: 'Add habit boxes' }).locator('[data-cmp]').click();
    await p.waitForSelector('#vs-pb .vpv [data-mark]');
    await p.screenshot({ path: `${OUT}/studio-3-guest-public.png` });
    await p.click('#vs-close');
    assert.equal(await types(p), original);
    // nothing but reads left this browser: no writes, no private project
    assert.deepEqual(writes, [], 'a guest makes no write requests');
    assert.ok(calls.every((c) => c.startsWith('GET ')), calls.join(' | '));
    assert.equal((await t.call('GET', `/api/projects/${priv.id}`)).status, 404, 'the private project is invisible to a guest');
    assert.equal((await t.call('POST', `/api/projects/${pub.id}/commits`, { body: { branch: 'main', expectedHead: h.commit.id, message: 'x', snapshot: {} } })).status, 401);
    await ctx.close();
    assert.deepEqual(errs, [], 'no page errors');
  } finally { await b.close(); await t.close(); }
});

test('accounts: sign in changes nothing until you choose; move this browser’s project up in one step; draft, version, conflict, compare, restore, branch; phone and dark mode', { skip, timeout: 300_000 }, async () => {
  const { launch } = await import('../../journal/browser.mjs');
  fs.mkdirSync(OUT, { recursive: true });
  const t = await serve({ staticDir: SITE });
  const b = await launch(), errs = [];
  try {
    const sam = await t.signup('sam'), kim = await t.signup('kim');
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errs.push(e.message));
    p.on('dialog', (d) => d.accept());
    await p.goto(t.base + '/', { waitUntil: 'networkidle' });
    // a guest's work: two versions in this browser and an unsaved change
    await openDrawer(p);
    await p.fill('#vs-msg', 'Start'); await p.click('#vs-savebtn');
    await p.evaluate(() => change((L) => { L.blocks.splice(L.blocks.findIndex((x) => x.type === 'actions'), 0, { uid: 'habits', type: 'checks', on: true, title: 'Habits', labels: ['Stretch', 'Outside'] }); }));
    await p.fill('#vs-msg', 'Add habit boxes'); await p.click('#vs-savebtn');
    await p.evaluate(() => change((L) => { L.blocks.find((x) => x.uid === 'habits').title = 'Daily habits'; }));
    const localLayout = await p.evaluate(() => stDay(layout));
    // sign in: wrong password first
    await p.fill('#vs-user', 'sam'); await p.fill('#vs-pass', 'wrong password here'); await p.click('#vs-conn button[type=submit]');
    await p.waitForFunction(() => document.querySelector('#vs-err').textContent.length > 0);
    assert.match(await p.textContent('#vs-err'), /Wrong username or password/);
    await p.fill('#vs-pass', PASSWORD); await p.click('#vs-conn button[type=submit]');
    await p.waitForSelector('#vs-who:not([hidden])');
    assert.equal(await p.locator('#vs-proj option:checked').textContent(), 'This browser', 'signing in stays on this browser’s project');
    assert.equal(await p.evaluate(() => stDay(layout)), localLayout, 'signing in did not touch the page');
    assert.deepEqual((await t.call('GET', '/api/projects', { token: sam })).body.projects, [], 'signing in uploaded nothing');
    assert.match(await p.textContent('#vs-banner'), /not on your account yet/);
    await p.screenshot({ path: `${OUT}/studio-4-signed-in-local.png` });
    // move it up in one step: the two versions and the unsaved change come along
    await p.click('#vb-move');
    await p.fill('#vs-npname', 'Sample Journal'); await p.click('#vs-np button[value=create]');
    await p.waitForFunction(() => document.querySelector('#vs-proj').selectedOptions[0].textContent === 'Sample Journal', null, { timeout: 8000 });
    const proj = (await t.call('GET', '/api/projects', { token: sam })).body.projects[0];
    const url = (s) => `/api/projects/${proj.id}${s}`;
    const log0 = (await t.call('GET', url('/log'), { token: sam })).body.commits.map((c) => c.message);
    assert.deepEqual(log0, ['Latest changes from this browser', 'Add habit boxes', 'Start']);
    assert.equal(await p.evaluate(() => stDay(layout)), localLayout);
    await p.waitForFunction(() => document.querySelectorAll('#vs-log .vs-c').length === 3);
    assert.match(await p.textContent('#vs-chip'), /Saved as a version/);
    await p.screenshot({ path: `${OUT}/studio-5-history.png` });
    await t.call('PUT', url('/members/kim'), { token: sam, body: { role: 'editor' } });

    // edits autosave to a draft, not a version
    await p.evaluate(() => change((L) => { L.blocks.find((x) => x.uid === 'habits').labels = ['Stretch', 'Outside', 'Read']; }));
    await p.waitForFunction(() => /Draft autosaved/.test(document.querySelector('#vs-chip').textContent), null, { timeout: 8000 });
    const d = (await t.call('GET', url('/drafts/main'), { token: sam })).body.draft;
    assert.deepEqual(d.snapshot.day.blocks.find((x) => x.uid === 'habits').labels, ['Stretch', 'Outside', 'Read']);
    assert.equal((await t.call('GET', url('/log'), { token: sam })).body.total, 3, 'autosave made no version');
    assert.ok(await p.locator('#vs-log .vs-c.draft').isVisible());
    await p.screenshot({ path: `${OUT}/studio-6-draft.png` });
    await p.fill('#vs-msg', 'Add a Read box'); await p.click('#vs-savebtn');
    await p.waitForFunction(() => document.querySelectorAll('#vs-log .vs-c:not(.draft)').length === 4);
    assert.match(await p.textContent('#vs-chip'), /Saved as a version/);
    assert.equal((await t.call('GET', url('/drafts/main'), { token: sam })).body.draft, null);
    const v2 = (await t.call('GET', url('/head'), { token: sam })).body.commit;

    // someone else saves while I have unsaved edits: nothing is overwritten and the editor says so
    await p.evaluate(() => change((L) => { L.blocks.find((x) => x.type === 'fact').on = false; }));
    await p.waitForFunction(() => /Draft autosaved/.test(document.querySelector('#vs-chip').textContent), null, { timeout: 8000 });
    const theirs = structuredClone((await t.call('GET', url('/head'), { token: kim })).body.snapshot.day);
    theirs.blocks.find((x) => x.uid === 'habits').labels = ['Stretch', 'Outside', 'Read', 'Sleep'];
    const v3 = (await t.call('POST', url('/commits'), { token: kim, body: { branch: 'main', expectedHead: v2.id, message: 'Kim adds a Sleep box', snapshot: { day: theirs } } })).body.commit;
    await p.evaluate(() => change((L) => { L.blocks.find((x) => x.type === 'review').on = false; }));
    await p.waitForFunction(() => !document.querySelector('#vs-banner').hidden && /Kim/.test(document.querySelector('#vs-banner').textContent), null, { timeout: 8000 });
    assert.match(await p.textContent('#vs-banner'), /nothing was overwritten/);
    await p.fill('#vs-msg', 'My tidy up'); await p.click('#vs-savebtn');
    await p.waitForTimeout(600);
    assert.equal((await t.call('GET', url('/head'), { token: sam })).body.commit.id, v3.id, 'a stale save did not move the branch');
    assert.equal((await t.call('GET', url('/drafts/main'), { token: sam })).body.draft.snapshot.day.blocks.find((x) => x.type === 'review').on, false, 'the draft survived the conflict');
    await p.screenshot({ path: `${OUT}/studio-7-conflict.png` });

    // see what they changed: the real page renderer, changed blocks marked
    await p.click('#vb-see');
    await p.waitForSelector('#vs-pb .vpv [data-mark]');
    assert.ok(await p.locator('#vs-pa .vpv [data-zone]').count() > 5, 'the day page is the real page');
    assert.match(await p.textContent('#vs-cmp'), /Checkboxes “Daily habits”/);
    assert.match(await p.textContent('#vs-cmp'), /Boxes: Stretch, Outside, Read → Stretch, Outside, Read, Sleep/);
    await p.screenshot({ path: `${OUT}/studio-8-compare.png` });

    // keep mine on a new branch: both survive
    await p.click('#vb-mine');
    await p.waitForFunction(() => /^sam-/.test(document.querySelector('#vs-br').value), null, { timeout: 8000 });
    const branches = (await t.call('GET', url('/branches'), { token: sam })).body.branches.map((x) => x.name);
    assert.equal(branches.length, 2);
    const mine = branches.find((n) => n !== 'main');
    assert.equal((await t.call('GET', url(`/branches/${encodeURIComponent(mine)}`), { token: sam })).body.snapshot.day.blocks.find((x) => x.type === 'review').on, false);
    assert.equal((await t.call('GET', url('/head'), { token: sam })).body.commit.id, v3.id);

    // back to main, compare an older version with the one before it, restore the very first
    await p.selectOption('#vs-br', 'main');
    await p.waitForFunction(() => /Kim adds/.test((document.querySelector('#vs-log .vs-c .vs-msg') || {}).textContent || ''));
    await p.locator('#vs-log .vs-c', { hasText: 'Add a Read box' }).locator('[data-cmp]').click();
    await p.waitForSelector('#vs-pb .vpv [data-mark]');
    assert.match(await p.textContent('#vs-cmp'), /Boxes: Stretch, Outside → Stretch, Outside, Read/);
    await p.locator('#vs-log .vs-c', { hasText: 'Start' }).locator('[data-restore]').click();
    await p.waitForFunction(() => /Restore version/.test((document.querySelector('#vs-log .vs-c .vs-msg') || {}).textContent || ''), null, { timeout: 8000 });
    const after = (await t.call('GET', url('/head'), { token: sam })).body;
    assert.equal(after.snapshot.day.blocks.some((x) => x.uid === 'habits'), false);
    assert.equal(await p.evaluate(() => layout.blocks.some((x) => x.uid === 'habits')), false, 'the editor shows the restored page');
    assert.equal((await t.call('GET', url('/log'), { token: sam })).body.total, 6, 'restore added a version; nothing was removed');
    await p.screenshot({ path: `${OUT}/studio-9-restored.png` });

    // a change to the book's pages, compared with thumbnails from the real page renderers
    const book = structuredClone(after.snapshot.book), list = book.default;
    list.find((e) => e.id === 'theme').on = false;
    const [lin] = list.splice(list.findIndex((e) => e.id === 'lineage'), 1); list.splice(1, 0, lin);
    list.splice(3, 0, { id: 'scratch', type: 'notes', on: true, options: { title: 'Scratch pad' } });
    assert.equal((await t.call('POST', url('/commits'), { token: sam, body: { branch: 'main', expectedHead: after.commit.id, message: 'Tidy the front of the book', snapshot: { book } } })).status, 201);
    await p.reload({ waitUntil: 'networkidle' }); await openDrawer(p);
    await p.waitForFunction(() => document.querySelectorAll('#vs-log .vs-c').length >= 7, null, { timeout: 8000 });
    assert.equal(await p.locator('#vs-proj option:checked').textContent(), 'Sample Journal', 'the project you were on is remembered');
    await p.locator('#vs-log .vs-c', { hasText: 'Tidy the front of the book' }).locator('[data-cmp]').click();
    await p.waitForSelector('#vs-cmp .vs-chg .vth-box');
    const rowsText = await p.textContent('#vs-cmp');
    assert.match(rowsText, /Added[\s\S]*Notes page[\s\S]*scratch/);
    assert.match(rowsText, /Moved[\s\S]*lineage/i);
    assert.match(rowsText, /hidden from the book/);
    assert.match(rowsText, /Book pages: 3 changes/);
    await p.locator('#vs-cmp .vs-chg').nth(1).scrollIntoViewIfNeeded();
    await p.screenshot({ path: `${OUT}/studio-10-book-compare.png` });

    // new branch from the UI
    await p.click('#vs-nb');
    await p.fill('#vs-brname', 'try-purple'); await p.press('#vs-brname', 'Enter');
    await p.waitForFunction(() => document.querySelector('#vs-br').value === 'try-purple');
    assert.equal((await t.call('GET', url('/branches'), { token: sam })).body.branches.some((x) => x.name === 'try-purple'), true);
    // back to this browser: its own latest version returns, the project is untouched
    await p.selectOption('#vs-proj', '');
    await p.waitForFunction(() => document.querySelector('#vs-proj').value === '' && document.querySelectorAll('#vs-log .vs-c').length >= 2);
    assert.equal(await p.evaluate(() => layout.blocks.some((x) => x.uid === 'habits')), true, 'this browser’s own page is back');
    await ctx.close();

    // phone: no sideways scroll, 44px targets, both panes; dark mode
    const pctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
    const ph = await pctx.newPage();
    ph.on('pageerror', (e) => errs.push(e.message)); ph.on('dialog', (d) => d.accept());
    await ph.goto(t.base + '/#versions', { waitUntil: 'networkidle' });
    await ph.waitForSelector('#versions[open]');
    const noScroll = () => ph.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1 && document.getElementById('versions').scrollWidth <= innerWidth + 1);
    assert.ok(await noScroll(), 'guest state: no sideways scroll at 390px');
    await ph.screenshot({ path: `${OUT}/studio-11-phone-guest.png` });
    await ph.fill('#vs-user', 'sam'); await ph.fill('#vs-pass', PASSWORD); await ph.click('#vs-conn button[type=submit]');
    await ph.waitForSelector('#vs-who:not([hidden])');
    await ph.selectOption('#vs-proj', proj.id);
    await ph.waitForFunction(() => document.querySelectorAll('#vs-log .vs-c').length >= 3);
    assert.ok(await noScroll(), 'history: no sideways scroll at 390px');
    const small = await ph.evaluate(() => [...document.querySelectorAll('#versions button, #versions select, #versions input')].filter((el) => el.offsetParent && (el.getBoundingClientRect().height < 43.5 || el.getBoundingClientRect().width < 43.5)).map((el) => el.id || el.className));
    assert.deepEqual(small, [], `targets under 44px: ${small}`);
    await ph.screenshot({ path: `${OUT}/studio-12-phone-history.png` });
    await ph.locator('#vs-log .vs-c', { hasText: 'Kim adds' }).locator('[data-cmp]').click();
    await ph.waitForSelector('#vs-pb .vpv [data-mark]');
    assert.ok(await noScroll(), 'compare: no sideways scroll at 390px');
    await ph.screenshot({ path: `${OUT}/studio-13-phone-compare.png` });
    await ph.click('#vs-cback');
    assert.ok(await ph.locator('#vs-log').isVisible());
    await pctx.close();
    const dctx = await b.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: 'dark' });
    const dk = await dctx.newPage();
    dk.on('pageerror', (e) => errs.push(e.message));
    await dk.goto(t.base + '/#versions', { waitUntil: 'networkidle' });
    await dk.fill('#vs-user', 'sam'); await dk.fill('#vs-pass', PASSWORD); await dk.click('#vs-conn button[type=submit]');
    await dk.waitForSelector('#vs-who:not([hidden])');
    await dk.selectOption('#vs-proj', proj.id);
    await dk.waitForFunction(() => document.querySelectorAll('#vs-log .vs-c').length >= 3);
    await dk.locator('#vs-log .vs-c', { hasText: 'Kim adds' }).locator('[data-cmp]').click();
    await dk.waitForSelector('#vs-pb .vpv [data-mark]');
    await dk.screenshot({ path: `${OUT}/studio-14-dark.png` });
    await dctx.close();
    assert.deepEqual(errs, [], 'no page errors');
  } finally { await b.close(); await t.close(); }
});
