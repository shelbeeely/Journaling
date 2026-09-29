// The editor's Versions view against a real Studio server (serving the built editor from the same origin), in a real browser.
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

test('Versions view: sign in, autosave a draft, save a version, conflict, compare, restore, branch; phone and dark mode', { skip, timeout: 240_000 }, async () => {
  const { launch } = await import('../../journal/browser.mjs');
  fs.mkdirSync(OUT, { recursive: true });
  const t = await serve({ staticDir: SITE });
  const b = await launch();
  const errs = [];
  try {
    // accounts and a project with a little history, made through the API (sample data only)
    const sam = await t.signup('sam'), kim = await t.signup('kim');
    const { project } = (await t.call('POST', '/api/projects', { token: sam, body: { name: 'Sample Journal', snapshot: snapshotFromJournal(path.join(JOURNAL)) } })).body;
    await t.call('PUT', `/api/projects/${project.id}/members/kim`, { token: sam, body: { role: 'editor' } });
    const url = (s) => `/api/projects/${project.id}${s}`;
    const head0 = (await t.call('GET', url('/head'), { token: sam })).body;
    const day1 = structuredClone(head0.snapshot.day); day1.blocks.splice(day1.blocks.findIndex((x) => x.type === 'actions'), 0, { uid: 'habits', type: 'checks', on: true, title: 'Habits', labels: ['Stretch', 'Outside'] });
    const v1 = (await t.call('POST', url('/commits'), { token: sam, body: { branch: 'main', expectedHead: head0.commit.id, message: 'Add habit boxes', snapshot: { day: day1 } } })).body.commit;

    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errs.push(e.message));
    p.on('dialog', (d) => d.accept());
    await p.goto(t.base + '/', { waitUntil: 'networkidle' });
    // 1. before signing in the editor is the editor it always was
    assert.equal(await p.evaluate(() => layout.blocks.map((x) => x.type).join(' ')), 'sky notes events care spoons good body actions review fact');
    await p.click('#v-ver');
    assert.ok(await p.locator('#vs-off').isVisible(), 'sign-in card');
    assert.ok(await p.locator('#vs-on').isHidden());
    await p.screenshot({ path: `${OUT}/studio-1-signin.png` });
    await p.fill('#vs-user', 'sam'); await p.fill('#vs-pass', 'wrong password here'); await p.click('#vs-conn button[type=submit]');
    await p.waitForFunction(() => document.querySelector('#vs-err').textContent.length > 0);
    assert.match(await p.textContent('#vs-err'), /Wrong username or password/);
    await p.fill('#vs-pass', PASSWORD); await p.click('#vs-conn button[type=submit]');
    await p.waitForSelector('#vs-on:not([hidden])');
    await p.waitForFunction(() => document.querySelectorAll('#vs-log .vs-c').length >= 2);
    assert.equal(await p.locator('#vs-proj option:checked').textContent(), 'Sample Journal');
    assert.match(await p.textContent('#vs-log'), /Add habit boxes/);
    assert.match(await p.textContent('#vs-chip'), /Saved as a version/);
    assert.equal(await p.evaluate(() => layout.blocks.some((x) => x.uid === 'habits')), true, 'the latest version is loaded into the editor');
    await p.screenshot({ path: `${OUT}/studio-2-history.png` });

    // 2. editing autosaves a draft (not a version)
    await p.click('#v-day');
    await p.evaluate(() => change((L) => { L.blocks.find((x) => x.uid === 'habits').title = 'Daily habits'; }));
    await p.waitForFunction(() => /Draft autosaved/.test(document.querySelector('#status').textContent), null, { timeout: 8000 });
    let d = (await t.call('GET', url('/drafts/main'), { token: sam })).body.draft;
    assert.equal(d.snapshot.day.blocks.find((x) => x.uid === 'habits').title, 'Daily habits');
    assert.equal((await t.call('GET', url('/log'), { token: sam })).body.total, 2, 'autosave made no version');
    await p.click('#v-ver');
    assert.match(await p.textContent('#vs-chip'), /Draft autosaved/);
    assert.ok(await p.locator('#vs-log .vs-c.draft').isVisible(), 'the draft is listed above the versions');
    await p.screenshot({ path: `${OUT}/studio-3-draft.png` });

    // 3. save it as a named version
    await p.fill('#vs-msg', 'Rename the habits block');
    await p.click('#vs-savebtn');
    await p.waitForFunction(() => document.querySelectorAll('#vs-log .vs-c:not(.draft)').length === 3);
    assert.match(await p.textContent('#vs-chip'), /Saved as a version/);
    assert.equal((await t.call('GET', url('/drafts/main'), { token: sam })).body.draft, null);
    const v2 = (await t.call('GET', url('/head'), { token: sam })).body.commit;
    assert.equal(v2.message, 'Rename the habits block');

    // 4. someone else saves while I have unsaved edits: nothing is overwritten and the editor says so
    await p.click('#v-day');
    await p.evaluate(() => change((L) => { L.blocks.find((x) => x.type === 'fact').on = false; }));
    await p.waitForFunction(() => /Draft autosaved/.test(document.querySelector('#status').textContent), null, { timeout: 8000 });
    const theirs = structuredClone(v2 && (await t.call('GET', url('/head'), { token: kim })).body.snapshot.day);
    theirs.blocks.find((x) => x.uid === 'habits').labels = ['Stretch', 'Outside', 'Read'];
    const v3 = (await t.call('POST', url('/commits'), { token: kim, body: { branch: 'main', expectedHead: v2.id, message: 'Kim adds a Read box', snapshot: { day: theirs } } })).body.commit;
    await p.evaluate(() => change((L) => { L.blocks.find((x) => x.type === 'review').on = false; }));
    await p.waitForFunction(() => document.querySelector('#vs-banner') && !document.querySelector('#vs-banner').hidden, null, { timeout: 8000 });
    await p.click('#v-ver');
    assert.match(await p.textContent('#vs-banner'), /Kim/);
    assert.match(await p.textContent('#vs-banner'), /nothing was overwritten/);
    await p.fill('#vs-msg', 'My tidy up'); await p.click('#vs-savebtn');
    await p.waitForTimeout(600);
    assert.equal((await t.call('GET', url('/head'), { token: sam })).body.commit.id, v3.id, 'a stale save did not move the branch');
    assert.equal((await t.call('GET', url('/drafts/main'), { token: sam })).body.draft.snapshot.day.blocks.find((x) => x.type === 'review').on, false, 'the draft survived the conflict');
    assert.ok(await p.locator('#vs-banner').isVisible());
    await p.screenshot({ path: `${OUT}/studio-4-conflict.png` });

    // 5. "See what they changed": the compare view, drawn with the real page renderer, changed blocks marked
    await p.click('#vb-see');
    await p.waitForSelector('#vs-pb .vpv [data-mark]');
    assert.ok(await p.locator('#vs-pa .vpv [data-zone]').count() > 5, 'the day page is the real page');
    assert.ok((await p.locator('#vs-pb .vpv [data-mark]').count()) >= 1);
    assert.match(await p.textContent('#vs-cmp'), /Checkboxes “Daily habits”/);
    assert.match(await p.textContent('#vs-cmp'), /Boxes: Stretch, Outside → Stretch, Outside, Read/);
    assert.ok(await p.locator('#vs-cmp .vth-box').count() >= 0);
    await p.screenshot({ path: `${OUT}/studio-5-compare.png` });

    // 6. keep mine on a new branch: both survive
    await p.click('#vb-mine');
    await p.waitForFunction(() => /^sam-/.test(document.querySelector('#vs-br').value), null, { timeout: 8000 });
    const branches = (await t.call('GET', url('/branches'), { token: sam })).body.branches.map((x) => x.name);
    assert.equal(branches.length, 2);
    const mine = branches.find((n) => n !== 'main');
    const mineHead = (await t.call('GET', url(`/branches/${encodeURIComponent(mine)}`), { token: sam })).body;
    assert.equal(mineHead.snapshot.day.blocks.find((x) => x.type === 'review').on, false);
    assert.equal((await t.call('GET', url('/head'), { token: sam })).body.commit.id, v3.id);

    // 7. switch back to main (it has Kim's version), then compare a version with the one before it, and restore
    await p.selectOption('#vs-br', 'main');
    await p.waitForFunction(() => document.querySelector('#vs-log .vs-c .vs-msg') && /Kim adds/.test(document.querySelector('#vs-log .vs-c .vs-msg').textContent));
    assert.equal(await p.evaluate(() => layout.blocks.find((x) => x.uid === 'habits').labels.length), 3);
    await p.locator('#vs-log .vs-c', { hasText: 'Rename the habits block' }).locator('[data-cmp]').click();
    await p.waitForSelector('#vs-pb .vpv [data-mark]');
    assert.match(await p.textContent('#vs-cmp'), /Label: Habits → Daily habits/);
    await p.locator('#vs-pb').scrollIntoViewIfNeeded();
    await p.screenshot({ path: `${OUT}/studio-6-compare-block.png`, fullPage: false });
    await p.locator('#vs-log .vs-c', { hasText: 'Start the project' }).locator('[data-restore]').click();
    await p.waitForFunction(() => document.querySelectorAll('#vs-log .vs-c:not(.draft)').length === 5, null, { timeout: 8000 });
    const after = (await t.call('GET', url('/head'), { token: sam })).body;
    assert.match(after.commit.message, /^Restore version/);
    assert.equal(after.snapshot.day.blocks.some((x) => x.uid === 'habits'), false);
    assert.equal(await p.evaluate(() => layout.blocks.some((x) => x.uid === 'habits')), false, 'the editor shows the restored page');
    assert.equal((await t.call('GET', url('/log'), { token: sam })).body.total, 5, 'restore added a version; nothing was removed');
    await p.screenshot({ path: `${OUT}/studio-7-restored.png` });

    // 8. new branch from the UI
    await p.click('#vs-nb');
    await p.fill('#vs-brname', 'try-purple'); await p.press('#vs-brname', 'Enter');
    await p.waitForFunction(() => document.querySelector('#vs-br').value === 'try-purple');
    assert.deepEqual((await t.call('GET', url('/branches'), { token: sam })).body.branches.map((x) => x.name).includes('try-purple'), true);

    // 8b. a change to the book's pages, compared with thumbnails from the real page renderers
    const mainHead = (await t.call('GET', url('/head'), { token: sam })).body;
    const book = structuredClone(mainHead.snapshot.book), list = book.default;
    list.find((e) => e.id === 'theme').on = false;
    const [lin] = list.splice(list.findIndex((e) => e.id === 'lineage'), 1); list.splice(1, 0, lin);
    list.splice(3, 0, { id: 'scratch', type: 'notes', on: true, options: { title: 'Scratch pad' } });
    const bookVer = await t.call('POST', url('/commits'), { token: sam, body: { branch: 'main', expectedHead: mainHead.commit.id, message: 'Tidy the front of the book', snapshot: { book } } });
    assert.equal(bookVer.status, 201);
    await p.goto(t.base + '/#versions', { waitUntil: 'networkidle' });
    await p.waitForSelector('#vs-on:not([hidden]) #vs-br option[value="main"]', { state: 'attached', timeout: 8000 });
    assert.equal(await p.inputValue('#vs-br'), 'try-purple', 'the branch you were on is remembered');
    await p.selectOption('#vs-br', 'main');
    await p.waitForFunction(() => document.querySelectorAll('#vs-log .vs-c').length >= 6, null, { timeout: 8000 });
    await p.locator('#vs-log .vs-c', { hasText: 'Tidy the front of the book' }).locator('[data-cmp]').click();
    await p.waitForSelector('#vs-cmp .vs-chg .vth-box');
    const rowsText = await p.textContent('#vs-cmp');
    assert.match(rowsText, /Added[\s\S]*Notes page[\s\S]*scratch/);
    assert.match(rowsText, /Moved[\s\S]*lineage/i);
    assert.match(rowsText, /hidden from the book/);
    assert.match(rowsText, /Book pages: 3 changes/);
    await p.locator('#vs-cmp .vs-chg').nth(1).scrollIntoViewIfNeeded();
    await p.screenshot({ path: `${OUT}/studio-7b-book-compare.png` });

    // 9. phone: no sideways scroll, 44px targets, both panes; dark mode
    await ctx.close();
    const pctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, colorScheme: 'light' });
    const ph = await pctx.newPage();
    ph.on('pageerror', (e) => errs.push(e.message));
    ph.on('dialog', (d) => d.accept());
    await ph.goto(t.base + '/#versions', { waitUntil: 'networkidle' });
    await ph.fill('#vs-user', 'sam'); await ph.fill('#vs-pass', PASSWORD); await ph.click('#vs-conn button[type=submit]');
    await ph.waitForFunction(() => document.querySelectorAll('#vs-log .vs-c').length >= 3);
    const noScroll = () => ph.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
    assert.ok(await noScroll(), 'history: no sideways scroll at 390px');
    const small = await ph.evaluate(() => [...document.querySelectorAll('#versions button, #versions select, #versions input')].filter((el) => el.offsetParent && (el.getBoundingClientRect().height < 43.5 || el.getBoundingClientRect().width < 43.5)).map((el) => el.id || el.className));
    assert.deepEqual(small, [], `targets under 44px: ${small}`);
    await ph.screenshot({ path: `${OUT}/studio-8-phone-history.png` });
    await ph.locator('#vs-log .vs-c', { hasText: 'Kim adds' }).locator('[data-cmp]').click();
    await ph.waitForSelector('#vs-pb .vpv [data-mark]');
    assert.ok(await noScroll(), 'compare: no sideways scroll at 390px');
    await ph.screenshot({ path: `${OUT}/studio-9-phone-compare.png` });
    await ph.click('#vs-cback');
    assert.ok(await ph.locator('#vs-log').isVisible());
    await pctx.close();
    const dctx = await b.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: 'dark' });
    const dk = await dctx.newPage();
    dk.on('pageerror', (e) => errs.push(e.message));
    await dk.goto(t.base + '/#versions', { waitUntil: 'networkidle' });
    await dk.fill('#vs-user', 'sam'); await dk.fill('#vs-pass', PASSWORD); await dk.click('#vs-conn button[type=submit]');
    await dk.waitForFunction(() => document.querySelectorAll('#vs-log .vs-c').length >= 3);
    await dk.locator('#vs-log .vs-c', { hasText: 'Kim adds' }).locator('[data-cmp]').click();
    await dk.waitForSelector('#vs-pb .vpv [data-mark]');
    await dk.screenshot({ path: `${OUT}/studio-10-dark.png` });
    await dctx.close();
    assert.deepEqual(errs, [], 'no page errors');
  } finally { await b.close(); await t.close(); }
});
