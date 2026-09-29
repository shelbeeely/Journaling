// Forks, proposals and the conflict resolver in the editor's Versions drawer, against a real Studio server, in a real browser.
// Needs `node render.mjs month 2026-10 test.ics && node editor/build.mjs` in journal/ first; skipped without the built editor.
// Screens go to journal/editor/dist/test/collab-*.png (look at them).
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
const signIn = async (p, name) => { await p.fill('#vs-user', name); await p.fill('#vs-pass', PASSWORD); await p.click('#vs-conn button[type=submit]'); await p.waitForSelector('#vs-who:not([hidden])'); };
const shot = (p, name) => p.screenshot({ path: `${OUT}/collab-${name}.png` });
// Every visible control in the proposals pane: a name, and a 44px target (a checkbox or radio counts through its label).
const audit = (p, scope = '#vp, #vs-fk, #vp-np') => p.evaluate((sel) => {
  const bad = [];
  for (const root of document.querySelectorAll(sel)) {
    if (!root.offsetParent && root.tagName !== 'DIALOG') continue;
    for (const el of root.querySelectorAll('button, input, select, textarea, [role=button]')) {
      const r = el.getBoundingClientRect(); if (!r.width || !r.height || getComputedStyle(el).visibility === 'hidden') continue;
      const lab = el.closest('label'), box = ['checkbox', 'radio'].includes(el.type) && lab ? lab.getBoundingClientRect() : r;
      const name = (el.getAttribute('aria-label') || (el.labels && el.labels[0] && el.labels[0].textContent) || el.textContent || el.placeholder || (lab && lab.textContent) || '').trim();
      if (!name) bad.push(`no name: ${el.outerHTML.slice(0, 80)}`);
      if (Math.min(box.width, box.height) < 43.5) bad.push(`small ${Math.round(box.width)}x${Math.round(box.height)}: ${(name || el.id).slice(0, 40)}`);
    }
  }
  return bad;
}, scope);
const noSideways = (p) => p.evaluate(() => { const d = document.querySelector('#versions'); return [document.documentElement.scrollWidth <= innerWidth + 1, d.scrollWidth <= d.clientWidth + 1]; });

test('forks, proposals and the conflict resolver: fork, propose, review, accept some, resolve conflicts, merge; guests read only; phone and dark mode', { skip, timeout: 420_000 }, async () => {
  const { launch } = await import('../../journal/browser.mjs');
  fs.mkdirSync(OUT, { recursive: true });
  const t = await serve({ staticDir: SITE });
  const b = await launch(), errs = [];
  try {
    const ana = await t.signup('anna'), bo = await t.signup('bobo');
    const api = (m, u, token, body) => t.call(m, u, { token, body });
    const up = (await api('POST', '/api/projects', ana, { name: 'Shared Sample', description: 'A calm planner', visibility: 'public', allowReuse: true, license: 'CC BY 4.0', credit: 'Anna Sample', snapshot: snapshotFromJournal(JOURNAL) })).body.project;
    const edit = async (token, pid, message, fn) => {
      const h = (await api('GET', `/api/projects/${pid}/head`, token)).body, snap = structuredClone(h.snapshot); fn(snap);
      const r = await api('POST', `/api/projects/${pid}/commits`, token, { branch: 'main', expectedHead: h.commit.id, message, snapshot: { day: snap.day, book: snap.book } });
      assert.equal(r.status, 201, JSON.stringify(r.body));
    };
    const blk = (s, u) => s.day.blocks.find((x) => x.uid === u);

    // ---------- Bo forks it in the editor ----------
    const bctx = await b.newContext({ viewport: { width: 1280, height: 900 } }), bp = await bctx.newPage();
    bp.on('pageerror', (e) => errs.push(e.message)); bp.on('dialog', (d) => d.accept());
    await bp.goto(t.base + '/', { waitUntil: 'networkidle' });
    await openDrawer(bp);
    await signIn(bp, 'bobo');
    await bp.click('[data-open="' + up.id + '"]');
    await bp.waitForFunction(() => /Reading/.test(document.querySelector('#vs-banner').textContent));
    assert.ok(await bp.locator('#vs-fork').isVisible(), 'the fork button is there on a project that allows reuse');
    assert.match(await bp.textContent('#vs-attr'), /Others may fork this project.*CC BY 4.0/);
    await bp.click('#vs-fork'); await bp.waitForSelector('#vs-fk[open]');
    assert.match(await bp.textContent('#vs-fkp'), /credits.*CC BY 4\.0|License: CC BY 4\.0/);
    assert.deepEqual(await audit(bp), [], 'fork dialog: names and targets');
    await shot(bp, '1-fork-dialog');
    await bp.fill('#vs-fkname', 'Bobo’s calm planner'); await bp.click('#vs-fkf button[type=submit]');
    await bp.waitForFunction(() => /Forked from/.test(document.querySelector('#vs-attr').textContent));
    assert.match(await bp.textContent('#vs-attr'), /Forked from Shared Sample by anna.*CC BY 4.0/);
    const fork = (await api('GET', '/api/projects', bo)).body.projects.find((p) => p.name === 'Bobo’s calm planner');
    assert.equal(fork.source.project, up.id); assert.equal(fork.attribution.license, 'CC BY 4.0');
    assert.equal(await bp.locator('#vs-sub').textContent(), 'Bobo’s calm planner · main');
    await shot(bp, '2-forked');

    // The fork and upstream both move on (edits made over the API, so this test stays about the drawer)
    await edit(bo, fork.id, 'Habits, a quieter review, a trip page', (s) => {
      s.day.blocks.splice(s.day.blocks.findIndex((x) => x.type === 'actions'), 0, { uid: 'habits', type: 'checks', on: true, title: 'Habits', labels: ['Walked', 'Stretched'] });
      blk(s, 'actions').count = 2; blk(s, 'review').h = 4; blk(s, 'fact').on = false;
      s.book.default.splice(3, 0, { id: 'trip', type: 'notes', on: true, options: { title: 'Trip notes' } });
    });
    await edit(ana, up.id, 'Upstream: longer action list, no review line, a Trip page too', (s) => {
      blk(s, 'actions').count = 6; s.day.blocks = s.day.blocks.filter((x) => x.uid !== 'review');
      s.book.default.splice(3, 0, { id: 'trip', type: 'notes', on: true, options: { title: 'Trip journal' } });
      blk(s, 'body').style = 'lines';
    });
    await bp.evaluate(() => stLoad());
    await bp.click('#vs-t-prop'); await bp.waitForSelector('#vp:not([hidden])');
    assert.ok(await bp.locator('#vp-new').isVisible());
    await bp.click('#vp-new'); await bp.waitForSelector('#vp-np[open]');
    assert.match(await bp.textContent('#vp-npp'), /Ask Shared Sample/);
    await bp.click('#vp-npf button[type=submit]'); assert.match(await bp.textContent('#vp-nperr'), /short title/);
    await bp.fill('#vp-nptitle', 'Habit boxes and a quieter review'); await bp.fill('#vp-npdesc', 'Adds habit boxes, a shorter action list, a Trip page and turns off the fact line.');
    assert.deepEqual(await audit(bp), [], 'proposal dialog');
    await bp.click('#vp-npf button[type=submit]');
    await bp.waitForSelector('#vp-detv .vp-top #vp-dh');
    assert.match(await bp.textContent('#vp-detv'), /Habit boxes and a quieter review/);
    // Bo (the author) sees the visual diff but no merge controls
    await bp.waitForSelector('#vp-pb .vpv [data-mark]');
    assert.equal(await bp.locator('#vp-merge, #vp-resolve, #vp-acc, #vp-approve').count(), 0, 'the author cannot merge or approve');
    await bp.fill('#vp-say', 'Happy to change anything.'); await bp.click('#vp-post');
    await bp.waitForFunction(() => /Happy to change anything/.test((document.querySelector('#vp-detv') || {}).textContent));
    await shot(bp, '3-author-view');

    // ---------- Anna reviews ----------
    const actx = await b.newContext({ viewport: { width: 1280, height: 900 } }), ap = await actx.newPage();
    ap.on('pageerror', (e) => errs.push(e.message)); ap.on('dialog', (d) => d.accept());
    await ap.goto(t.base + '/', { waitUntil: 'networkidle' });
    await openDrawer(ap); await signIn(ap, 'anna');
    await ap.selectOption('#vs-proj', up.id); await ap.waitForFunction(() => document.querySelector('#vs-sub').textContent.startsWith('Shared Sample'));
    await ap.click('#vs-t-prop'); await ap.waitForSelector('#vp-list .vp-item');
    assert.equal(await ap.locator('#vs-t-n').textContent(), '1');
    assert.match(await ap.textContent('#vp-list'), /Habit boxes and a quieter review/);
    assert.match(await ap.textContent('#vp-list'), /Open/);
    await shot(ap, '4-proposals-list');
    await ap.click('#vp-list .vp-item'); await ap.waitForSelector('#vp-pb .vpv [data-mark]');
    assert.match(await ap.textContent('#vp-detv'), /3 things were changed differently|3 things|things were changed differently/);
    const rows = await ap.locator('.vp-chg li').allTextContents();
    assert.ok(rows.some((r) => /Checkboxes “Habits”/.test(r)), rows.join(' | '));
    assert.ok(rows.some((r) => /Trip|Notes page/.test(r)));
    assert.ok(await ap.locator('#vp-resolve').isVisible()); assert.equal(await ap.locator('#vp-merge').count(), 0, 'no plain merge while conflicts exist');
    assert.deepEqual(await audit(ap), [], 'proposal detail: names and 44px targets');
    assert.deepEqual(await noSideways(ap).then(([a]) => [a]), [true]);
    await shot(ap, '5-diff-desktop');
    // dark, and a phone
    await ap.emulateMedia({ colorScheme: 'dark' }); await ap.waitForTimeout(150); await shot(ap, '6-diff-desktop-dark');
    await ap.setViewportSize({ width: 390, height: 844 }); await ap.waitForTimeout(400);
    assert.deepEqual(await noSideways(ap), [true, true], 'no sideways scroll at 390px');
    assert.deepEqual(await audit(ap), [], 'phone: names and targets');
    await shot(ap, '7-diff-390-dark');
    await ap.emulateMedia({ colorScheme: 'light' }); await ap.waitForTimeout(150); await shot(ap, '8-diff-390-light');
    await ap.setViewportSize({ width: 1280, height: 900 }); await ap.waitForTimeout(300);

    // accept two changes that have no conflict, by ticking them (keyboard: space on a focused checkbox)
    assert.equal(await ap.locator('#vp-acc').isDisabled(), true);
    await ap.focus('input[data-key="block:habits"]'); await ap.keyboard.press('Space');
    await ap.focus('input[data-key="block:fact"]'); await ap.keyboard.press('Space');
    assert.match(await ap.textContent('#vp-acc'), /Accept 2 selected changes/);
    await ap.click('#vp-acc');
    await ap.waitForFunction(() => document.querySelectorAll('.vp-chg .acc').length === 2);
    const log1 = (await api('GET', `/api/projects/${up.id}/log`, ana)).body.commits;
    assert.match(log1[0].message, /Accept 2 changes/); assert.equal(log1[0].parents.length, 1);
    const head1 = (await api('GET', `/api/projects/${up.id}/head`, ana)).body.snapshot;
    assert.ok(blk(head1, 'habits')); assert.equal(blk(head1, 'fact').on, false); assert.equal(blk(head1, 'actions').count, 6, 'the other changes were not taken');

    // a review: the discussion and the status
    await ap.fill('#vp-say', 'Lovely. The trip page needs the same title as ours.'); await ap.click('#vp-changes');
    await ap.waitForFunction(() => /Changes requested/.test((document.querySelector('.vp-top') || {}).textContent));
    assert.equal(await ap.locator('#vp-resolve, #vp-acc').count(), 0, 'merging and accepting wait while changes are requested');
    // a reviewer clears it by approving
    await ap.fill('#vp-say', 'Fine as it is.'); await ap.click('#vp-approve');
    await ap.waitForFunction(() => /Approved/.test((document.querySelector('.vp-top') || {}).textContent));
    assert.match(await ap.textContent('.vp-ev'), /asked for changes/);

    // ---------- the resolver ----------
    await ap.click('#vp-resolve'); await ap.waitForSelector('#vr-form .vr-card');
    const cards = await ap.locator('.vr-card legend').allTextContents();
    assert.equal(cards.length, 3, cards.join(' | ')); assert.ok(cards.some((c) => /Action items/.test(c))); assert.ok(cards.some((c) => /Notes page/.test(c)));
    await ap.waitForSelector('.vr-card [data-paint="theirs"] .vpv');
    assert.ok(await ap.locator('.vr-card [data-paint] .vpv [data-mark]').count() >= 2, 'both versions are drawn on real pages with the block marked');
    assert.match(await ap.textContent('#vr-msg'), /0 of 3 chosen/);
    assert.deepEqual(await audit(ap), [], 'resolver: names and targets');
    await shot(ap, '9-resolver-desktop');
    // the merge button refuses to guess
    await ap.click('#vr-go'); assert.match(await ap.textContent('#vr-msg'), /Choose what to keep for/);
    // keyboard: the radios are one Tab stop per card and arrows choose
    await ap.focus('.vr-card[data-c="0"] input[type=radio]'); await ap.keyboard.press('ArrowRight');
    assert.equal(await ap.locator('.vr-card[data-c="0"] input:checked').getAttribute('value'), 'theirs');
    // card 1: take this branch's; card 2: by hand (the block's own controls), then check the preview changes
    const order = await ap.locator('.vr-card legend').allTextContents(), iAct = order.findIndex((c) => /Action items/.test(c));
    await ap.check(`.vr-card[data-c="${iAct}"] input[value="manual"]`);
    await ap.waitForSelector(`.vr-card[data-c="${iAct}"] .vr-hand [data-num]`);
    const before = await ap.locator(`.vr-card[data-c="${iAct}"] .vr-hand output`).first().textContent();
    await ap.click(`.vr-card[data-c="${iAct}"] .vr-hand [data-num][data-d="1"]`);
    const after = await ap.locator(`.vr-card[data-c="${iAct}"] .vr-hand output`).first().textContent();
    assert.equal(+after, +before + 1, 'the same steppers as the editor’s block controls');
    assert.equal(await ap.evaluate(() => document.activeElement.dataset.num !== undefined), true, 'focus stays on the control after it redraws');
    for (const [i, c] of order.entries()) { if (i === iAct || i === 0) continue; await ap.check(`.vr-card[data-c="${i}"] input[value="ours"]`); void c; }
    assert.match(await ap.textContent('#vr-msg'), /3 of 3 chosen/);
    await shot(ap, '10-resolver-chosen');
    // phone + dark
    await ap.emulateMedia({ colorScheme: 'dark' }); await ap.setViewportSize({ width: 390, height: 844 }); await ap.waitForTimeout(500);
    assert.deepEqual(await noSideways(ap), [true, true], 'resolver: no sideways scroll at 390px');
    assert.deepEqual(await audit(ap), [], 'resolver on a phone');
    await ap.locator('.vr-card').first().scrollIntoViewIfNeeded(); await shot(ap, '11-resolver-390-dark');
    await ap.emulateMedia({ colorScheme: 'light' }); await ap.waitForTimeout(200); await shot(ap, '12-resolver-390-light');
    await ap.setViewportSize({ width: 1280, height: 900 }); await ap.waitForTimeout(300);
    await ap.click('#vr-go');
    await ap.waitForFunction(() => /Merged/.test((document.querySelector('.vp-top') || {}).textContent), null, { timeout: 15000 });
    const log2 = (await api('GET', `/api/projects/${up.id}/log`, ana)).body.commits;
    assert.equal(log2[0].parents.length, 2, 'a merge commit');
    const head2 = (await api('GET', `/api/projects/${up.id}/head`, ana)).body.snapshot;
    assert.equal(blk(head2, 'actions').count, 7, 'the hand-edited value (6 + 1)'); assert.equal(head2.day.blocks.some((x) => x.uid === 'review'), false, 'ours kept the deletion');
    assert.equal(head2.book.default.find((p) => p.id === 'trip').options.title, 'Trip journal'); assert.equal(blk(head2, 'body').style, 'lines');
    const prop = (await api('GET', `/api/projects/${up.id}/proposals/1`, ana)).body.proposal;
    assert.equal(prop.status, 'merged');
    await shot(ap, '13-merged');
    assert.match(await ap.textContent('#vs-attr'), /Others may fork/);
    await ap.click('#vs-t-hist'); await ap.waitForSelector('#vs-log .vs-c');
    assert.match(await ap.textContent('#vs-log'), /Merge proposal #1/);

    // ---------- a guest reads, and writes nothing ----------
    const gctx = await b.newContext({ viewport: { width: 1280, height: 900 } }), gp = await gctx.newPage(), writes = [];
    gp.on('pageerror', (e) => errs.push(e.message));
    gp.on('request', (r) => { if (r.url().includes('/api/') && r.method() !== 'GET') writes.push(r.method() + ' ' + r.url()); });
    await gp.goto(t.base + '/', { waitUntil: 'networkidle' });
    await openDrawer(gp);
    await gp.click('[data-open="' + up.id + '"]'); await gp.waitForFunction(() => /Reading/.test(document.querySelector('#vs-banner').textContent));
    await gp.click('#vs-t-prop'); await gp.waitForSelector('#vp-list .vp-item');
    assert.equal(await gp.locator('#vp-new').isHidden(), true);
    await gp.click('#vp-list .vp-item'); await gp.waitForSelector('#vp-pb .vpv');
    assert.equal(await gp.locator('#vp-merge, #vp-resolve, #vp-acc, #vp-post, #vp-approve, #vp-changes, #vp-close, #vp-say, input[data-key]').count(), 0, 'no write controls for a guest');
    assert.match(await gp.textContent('#vp-detv'), /Sign in to join the discussion/);
    assert.match(await gp.textContent('.vp-ev'), /Happy to change anything/);
    await gp.click('#vp-back'); await gp.click('#vs-fork');
    assert.match(await gp.textContent('#vs-guest'), /Sign in/); assert.equal(await gp.locator('#vs-fk[open]').count(), 0, 'a guest is asked to sign in, nothing opens');
    await shot(gp, '14-guest-proposal');
    assert.deepEqual(writes, [], 'a guest makes no write requests');
    assert.equal((await t.call('POST', `/api/projects/${up.id}/proposals/1/comments`, { body: { body: 'x' } })).status, 401);
    await gctx.close(); await actx.close(); await bctx.close();
    assert.deepEqual(errs, [], 'no page errors');
  } finally { await b.close(); await t.close(); }
});

test('the resolver: reorder by hand with the arrow buttons, a setting typed in, the branch moving while you choose, and a merge that then succeeds', { skip, timeout: 240_000 }, async () => {
  const { launch } = await import('../../journal/browser.mjs');
  fs.mkdirSync(OUT, { recursive: true });
  const t = await serve({ staticDir: SITE });
  const b = await launch(), errs = [];
  try {
    const ana = await t.signup('anna'), bo = await t.signup('bobo');
    const api = (m, u, token, body) => t.call(m, u, { token, body });
    const up = (await api('POST', '/api/projects', ana, { name: 'Order Sample', visibility: 'public', allowReuse: true, snapshot: snapshotFromJournal(JOURNAL) })).body.project;
    const fork = (await api('POST', `/api/projects/${up.id}/forks`, bo, { name: 'Order fork' })).body.project;
    const edit = async (token, pid, message, fn) => {
      const h = (await api('GET', `/api/projects/${pid}/head`, token)).body, snap = structuredClone(h.snapshot); fn(snap);
      const r = await api('POST', `/api/projects/${pid}/commits`, token, { branch: 'main', expectedHead: h.commit.id, message, snapshot: snap });
      assert.equal(r.status, 201, JSON.stringify(r.body));
    };
    await edit(bo, fork.id, 'Bo reorders and retitles', (s) => { const [x] = s.day.blocks.splice(0, 1); s.day.blocks.push(x); s.meta.title = 'Bobo’s title'; });
    await edit(ana, up.id, 'Anna reorders and retitles', (s) => { s.day.blocks.reverse(); s.meta.title = 'Anna’s title'; });
    await api('POST', `/api/projects/${up.id}/proposals`, bo, { sourceProject: fork.id, sourceBranch: 'main', title: 'Reorder' });
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }), p = await ctx.newPage();
    p.on('pageerror', (e) => errs.push(e.message)); p.on('dialog', (d) => d.accept());
    await p.goto(t.base + '/', { waitUntil: 'networkidle' });
    await openDrawer(p); await signIn(p, 'anna');
    await p.selectOption('#vs-proj', up.id); await p.click('#vs-t-prop'); await p.waitForSelector('#vp-list .vp-item');
    await p.click('#vp-list .vp-item'); await p.click('#vp-resolve'); await p.waitForSelector('#vr-form .vr-card');
    const legends = await p.locator('.vr-card legend').allTextContents();
    const iOrder = legends.findIndex((l) => /Order of the blocks/.test(l)), iTitle = legends.findIndex((l) => /Title/.test(l));
    assert.ok(iOrder >= 0 && iTitle >= 0, legends.join(' | '));
    // reorder: both lists are shown, then "by hand" gives up/down buttons for every item
    assert.equal(await p.locator(`.vr-card[data-c="${iOrder}"] .vr-side ol`).count(), 2);
    await p.check(`.vr-card[data-c="${iOrder}"] input[value="manual"]`);
    const first = await p.locator(`.vr-card[data-c="${iOrder}"] ol.order li span`).first().textContent();
    await p.click(`.vr-card[data-c="${iOrder}"] ol.order li:first-child button[aria-label$="down"]`);
    assert.notEqual(await p.locator(`.vr-card[data-c="${iOrder}"] ol.order li span`).first().textContent(), first, 'the first item moved down');
    assert.equal(await p.evaluate(() => document.activeElement.tagName), 'BUTTON', 'focus stays on a button after the list redraws');
    // a setting: typed in by hand
    await p.check(`.vr-card[data-c="${iTitle}"] input[value="manual"]`);
    await p.fill(`.vr-card[data-c="${iTitle}"] input[type=text]`, 'Our shared title');
    await shot(p, '15-resolver-order-by-hand');
    // upstream moves on while Anna is choosing: nothing is merged, she is told
    await edit(ana, up.id, 'Anna, meanwhile', (s) => { s.meta.subtitle = 'meanwhile'; });
    await p.click('#vr-go');
    await p.waitForFunction(() => /changed while you were choosing/.test((document.querySelector('#vp-err') || {}).textContent || ''));
    assert.equal((await api('GET', `/api/projects/${up.id}/log`, ana)).body.commits.filter((c) => c.parents.length === 2).length, 0, 'nothing was merged');
    await p.click('#vr-cancel'); await p.click('#vp-back');
    await p.click('#vp-list .vp-item'); await p.waitForSelector('#vp-resolve'); await p.click('#vp-resolve'); await p.waitForSelector('#vr-form .vr-card');
    for (const [i] of (await p.locator('.vr-card legend').allTextContents()).entries()) await p.check(`.vr-card[data-c="${i}"] input[value="theirs"]`);
    await p.click('#vr-go'); await p.waitForFunction(() => /Merged/.test((document.querySelector('.vp-top') || {}).textContent), null, { timeout: 15000 });
    const head = (await api('GET', `/api/projects/${up.id}/head`, ana)).body.snapshot;
    assert.equal(head.meta.title, 'Bobo’s title'); assert.equal(head.meta.subtitle, 'meanwhile', 'the change made meanwhile is kept');
    assert.equal(head.day.blocks[head.day.blocks.length - 1].uid, 'sky', 'their order won');
    await ctx.close();
    assert.deepEqual(errs, [], 'no page errors');
  } finally { await b.close(); await t.close(); }
});
