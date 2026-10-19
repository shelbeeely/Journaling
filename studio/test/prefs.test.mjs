// Remembered choices (BUILD-PLAN section 24): the account's "start the next book the way the last one went". Choices only, cleaned on the server too,
// private to the account, never in a project or snapshot. Sample data only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { serve } from './helpers.mjs';
import { scanForbidden } from '../src/snapshot.mjs';

const LAST = () => ({ v: 1, answers: { trim: 'letter', length: 'quarter', track: ['mood', 'sleep'], tone: 'gentle', room: 'lots' }, starter: 'mood-log', plan: { scope: 'quarter' }, modules: { spoons: true }, trim: 'letter',
  layout: { v: 2, blocks: [{ uid: 'g-mood', type: 'scale', on: true, title: 'Mood' }, { uid: 'body', type: 'body', on: true }] } });

test('prefs: nothing is remembered until it is saved; then it comes back, and saving again replaces it', async () => {
  const t = await serve();
  try {
    const sam = await t.signup('sam');
    assert.deepEqual((await t.call('GET', '/api/me/prefs/startFrom', { token: sam })).body.value, null);
    const put = await t.call('PUT', '/api/me/prefs/startFrom', { token: sam, body: { value: LAST() } });
    assert.equal(put.status, 200);
    const got = (await t.call('GET', '/api/me/prefs/startFrom', { token: sam })).body;
    assert.equal(got.value.answers.tone, 'gentle');
    assert.equal(got.value.starter, 'mood-log');
    assert.deepEqual(got.value.plan, { scope: 'quarter' });
    assert.deepEqual(got.value.layout.blocks.map((b) => b.type), ['scale', 'body']);
    const again = LAST(); again.answers.tone = 'full';
    await t.call('PUT', '/api/me/prefs/startFrom', { token: sam, body: { value: again } });
    assert.equal((await t.call('GET', '/api/me/prefs/startFrom', { token: sam })).body.value.answers.tone, 'full');
    assert.equal(t.db.prepare('SELECT COUNT(*) AS n FROM user_prefs').get().n, 1);
    assert.equal((await t.call('DELETE', '/api/me/prefs/startFrom', { token: sam })).status, 200);
    assert.equal((await t.call('GET', '/api/me/prefs/startFrom', { token: sam })).body.value, null);
  } finally { await t.close(); }
});

test('prefs: only choices are stored, whatever is sent (no title, place, calendar, pack or profile field)', async () => {
  const t = await serve();
  try {
    const sam = await t.signup('sam');
    const dirty = { ...LAST(), title: 'My private book', person: { name: 'Sam' }, location: { place: 'Lakemont' }, ics: 'BEGIN:VCALENDAR', pack: 'spokane-wa', paths: { support: 'x' }, modules: { spoons: true, trans_support: true, bus: true, secret: true } };
    dirty.layout.blocks[0].note = 'a private note';
    dirty.answers.title = 'My private book';
    await t.call('PUT', '/api/me/prefs/startFrom', { token: sam, body: { value: dirty } });
    const raw = t.db.prepare('SELECT value FROM user_prefs').get().value;
    for (const word of ['private', 'Sam', 'Lakemont', 'VCALENDAR', 'spokane', 'support', 'trans_support', '"bus"']) assert.ok(!raw.includes(word), `the stored choice must not hold "${word}"`);
    assert.deepEqual(Object.keys(JSON.parse(raw)).sort(), ['answers', 'layout', 'modules', 'plan', 'starter', 'trim', 'v']);
    assert.deepEqual(JSON.parse(raw).modules, { spoons: true });
    assert.deepEqual(scanForbidden(raw), []);
  } finally { await t.close(); }
});

test('prefs: it is the account\'s own: signed-in only, one key, bad values refused, never in a project', async () => {
  const t = await serve();
  try {
    const sam = await t.signup('sam'), ada = await t.signup('ada');
    assert.equal((await t.call('GET', '/api/me/prefs/startFrom', {})).status, 401);
    assert.equal((await t.call('PUT', '/api/me/prefs/startFrom', { body: { value: LAST() } })).status, 401);
    await t.call('PUT', '/api/me/prefs/startFrom', { token: sam, body: { value: LAST() } });
    assert.equal((await t.call('GET', '/api/me/prefs/startFrom', { token: ada })).body.value, null, 'another account sees nothing');
    assert.equal((await t.call('GET', '/api/me/prefs/theme', { token: sam })).status, 404, 'only known keys');
    assert.equal((await t.call('PUT', '/api/me/prefs/theme', { token: sam, body: { value: LAST() } })).status, 404);
    for (const bad of [null, 'text', 5, { v: 2, answers: {} }, { answers: {} }, []]) assert.equal((await t.call('PUT', '/api/me/prefs/startFrom', { token: sam, body: { value: bad } })).status, 422, `refuses ${JSON.stringify(bad)}`);
    const huge = LAST(); huge.layout.blocks = Array.from({ length: 4000 }, (_, i) => ({ uid: 'g' + i, type: 'checks', on: true, labels: ['x'.repeat(24)] }));
    assert.ok([200, 422].includes((await t.call('PUT', '/api/me/prefs/startFrom', { token: sam, body: { value: huge } })).status));
    assert.ok(t.db.prepare('SELECT length(value) AS n FROM user_prefs WHERE user_id = (SELECT id FROM users WHERE username = ?)').get('sam').n <= 16000, 'a stored choice is size-capped');
    const tables = t.db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((r) => r.name);
    assert.ok(tables.includes('user_prefs'));
    for (const tbl of ['objects', 'commits', 'drafts', 'assets']) if (tables.includes(tbl)) assert.ok(!JSON.stringify(t.db.prepare(`SELECT * FROM ${tbl}`).all()).includes('g-mood'), `${tbl} holds no remembered choice`);
  } finally { await t.close(); }
});
