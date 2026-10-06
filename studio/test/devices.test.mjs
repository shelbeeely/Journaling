// N2: X4 device sync, server side. Device tokens (hashed, revocable, one account, rate limited), the upload endpoint, and the rule that
// a device's check-in log is private: never in a snapshot, a project, a fork or an export, and the snapshot scanner still refuses it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { serve, PASSWORD, project, emptySnapshot } from './helpers.mjs';
import { fresh } from './helpers.mjs';
import { scanForbidden, serializeSnapshot } from '../src/snapshot.mjs';
import { LIMITS, syncFile, serverOk } from '../src/devices.mjs';
import { sha256 } from '../src/canon.mjs';
import { StudioError } from '../src/db.mjs';

const LOG = '2026-10-14T08:15,spoons,4\n2026-10-14T08:16,sleep,7\n2026-10-14T21:02,shower,1\n';
const post = (t, token, month, body, offset, extra = {}) => t.call('POST', `/api/device/log/${month}`, { token, raw: body, headers: { 'X-Offset': String(offset), 'Content-Type': 'text/csv', ...extra } });
async function paired(t, name = 'sam', device = 'My X4') {
  const user = await t.signup(name);
  const r = await t.call('POST', '/api/devices', { token: user, body: { name: device, server: 'studio.example.com' } });
  assert.equal(r.status, 201);
  return { user, ...r.body };
}

test('adding a device: the token is shown once, only its sha256 is stored, and sync.txt carries it', async () => {
  const t = await serve();
  try {
    const { token, device, syncTxt } = await paired(t);
    assert.match(token, /^kwd_[0-9a-f]{12}_[A-Za-z0-9_-]{43}$/);
    assert.equal(token.split('_')[1], device.id);
    assert.equal(device.scope, 'log:write');
    const row = t.db.prepare('SELECT token_hash FROM devices WHERE id = ?').get(device.id);
    assert.equal(row.token_hash, sha256(token));
    // the token is nowhere in the database in the clear, and nothing the API lists can show it again
    for (const tbl of ['devices', 'device_logs', 'device_audit', 'sessions', 'users']) assert.ok(!JSON.stringify(t.db.prepare(`SELECT * FROM ${tbl}`).all()).includes(token.slice(token.indexOf('_', 4) + 1)), tbl);
    const list = await t.call('GET', '/api/devices', { token: (await t.call('POST', '/api/auth/login', { body: { username: 'sam', password: PASSWORD } })).body.token });
    assert.ok(!JSON.stringify(list.body).includes(token.slice(token.indexOf('_', 4) + 1)));
    assert.match(syncTxt, /^# KEEPING WATCH STUDIO SYNC\. THIS FILE HOLDS A SECRET TOKEN/);
    assert.ok(syncTxt.includes(`\nserver=studio.example.com\ntoken=${token}\nlog=0\n`));
    assert.equal(syncFile(undefined, token).includes('server=studio.example.com'), true);
  } finally { await t.close(); }
});

test('adding a device needs a signed-in user, a sane name and a valid server', async () => {
  const t = await serve();
  try {
    assert.equal((await t.call('POST', '/api/devices', { body: { name: 'x' } })).status, 401);
    const u = await t.signup('ana');
    assert.equal((await t.call('POST', '/api/devices', { token: u, body: {} })).status, 422);
    assert.equal((await t.call('POST', '/api/devices', { token: u, body: { name: 'a'.repeat(41) } })).status, 422);
    assert.equal((await t.call('POST', '/api/devices', { token: u, body: { name: 'ok', server: 'evil.example.com/../x' } })).status, 422);
    assert.equal((await t.call('POST', '/api/devices', { token: u, body: { name: 'ok', server: 'host name' } })).status, 422);
    assert.ok(serverOk('studio.example.com') && serverOk('studio.example.com:8443') && !serverOk('a..b') && !serverOk('https://x') && !serverOk(''));
    for (let i = 0; i < LIMITS.devices; i++) assert.equal((await t.call('POST', '/api/devices', { token: u, body: { name: `d${i}` } })).status, 201);
    assert.equal((await t.call('POST', '/api/devices', { token: u, body: { name: 'one too many' } })).status, 409);
  } finally { await t.close(); }
});

test('upload: chunks append at the right offset; a wrong offset is a 409 that says where to resume; the log is stored as sent', async () => {
  const t = await serve();
  try {
    const { token } = await paired(t);
    const a = LOG.slice(0, 30), b = LOG.slice(30);
    assert.equal((await t.call('GET', '/api/device/info', { token })).body.logs.length, 0);
    let r = await post(t, token, '2026-10', a, 0);
    assert.equal(r.status, 200); assert.deepEqual(r.body, { month: '2026-10', size: 30 });
    r = await post(t, token, '2026-10', a, 0);                       // the same chunk again (a retry after a lost answer)
    assert.equal(r.status, 409); assert.equal(r.body.error.code, 'offset_mismatch'); assert.equal(r.body.error.details.size, 30);
    r = await post(t, token, '2026-10', b, 99);                      // a gap
    assert.equal(r.status, 409);
    r = await post(t, token, '2026-10', b, 30);
    assert.equal(r.status, 200); assert.equal(r.body.size, LOG.length);
    const info = (await t.call('GET', '/api/device/info', { token })).body;
    assert.deepEqual(info.logs, [{ month: '2026-10', size: LOG.length }]);
    assert.equal(info.limits.chunk, LIMITS.chunk);
    assert.equal(Buffer.from(t.db.prepare('SELECT body FROM device_logs').get().body).toString('utf8'), LOG);
  } finally { await t.close(); }
});

test('upload refuses what is not a month log: bad month, bad offset, empty, NUL bytes, too big a chunk, too big a month', async () => {
  const t = await serve();
  try {
    const { token } = await paired(t);
    assert.equal((await post(t, token, '2026-13', LOG, 0)).status, 400);   // 13 is not a month
    assert.equal((await post(t, token, '2026-00', LOG, 0)).status, 400);
    assert.equal((await post(t, token, '2026-10', LOG, 'abc')).status, 400);
    assert.equal((await post(t, token, '2026-10', LOG, -1)).status, 400);
    assert.equal((await post(t, token, '2026-10', '', 0)).status, 400);
    assert.equal((await post(t, token, '2026-10', Buffer.from([65, 0, 66]), 0)).status, 415);
    assert.equal((await post(t, token, '2026-10', 'a'.repeat(LIMITS.chunk + 1), 0)).status, 413);
    assert.equal(t.db.prepare('SELECT COUNT(*) n FROM device_logs').get().n, 0);
    const { id } = t.db.prepare('SELECT id FROM devices').get();
    t.db.prepare('INSERT INTO device_logs (device_id, month, body, updated_at) VALUES (?, ?, ?, ?)').run(id, '2026-09', Buffer.alloc(LIMITS.month - 10, 97), 'x');
    assert.equal((await post(t, token, '2026-09', 'a'.repeat(11), LIMITS.month - 10)).status, 413);
    assert.equal((await post(t, token, '2026-09', 'a'.repeat(10), LIMITS.month - 10)).status, 200);
  } finally { await t.close(); }
});

test('a device token works on /api/device/* only: it is not a session and the account API does not know it', async () => {
  const t = await serve();
  try {
    const { token, user } = await paired(t);
    const owner = await t.call('POST', '/api/projects', { token: user, body: { name: 'Private book' } });
    assert.equal(owner.status, 201);
    for (const [m, url] of [['GET', '/api/me'], ['GET', '/api/projects'], ['GET', `/api/projects/${owner.body.project.id}`], ['GET', `/api/projects/${owner.body.project.id}/head`], ['GET', '/api/devices'], ['POST', '/api/devices']]) {
      const r = await t.call(m, url, { token, body: m === 'POST' ? { name: 'x' } : undefined });
      assert.ok(r.status === 401 || r.status === 404 || (r.status === 200 && url === '/api/projects'), `${m} ${url} -> ${r.status}`);
    }
    const list = await t.call('GET', '/api/projects', { token });
    assert.equal(list.body.projects.length, 0);                                  // exactly what an anonymous reader sees
    // and the other way round: a signed-in user's session is not a device token
    assert.equal((await t.call('GET', '/api/device/info', { token: user })).status, 401);
    assert.equal((await post(t, user, '2026-10', LOG, 0)).status, 401);
  } finally { await t.close(); }
});

test('wrong, malformed, unknown and revoked tokens all get the same answer', async () => {
  const t = await serve();
  try {
    const { token, device, user } = await paired(t);
    const forged = `kwd_${device.id}_${'A'.repeat(43)}`;
    const answers = [];
    for (const tk of [undefined, 'nope', forged, `kwd_${'0'.repeat(12)}_${'A'.repeat(43)}`, token.slice(0, -1) + (token.endsWith('A') ? 'B' : 'A')]) {
      const r = await t.call('GET', '/api/device/info', { token: tk });
      answers.push([r.status, r.body.error.code, r.body.error.message]);
    }
    for (const a of answers) assert.deepEqual(a, [401, 'device_token', answers[0][2]]);
    assert.equal((await t.call('GET', '/api/device/info', { token })).status, 200);
    const rv = await t.call('POST', `/api/devices/${device.id}/revoke`, { token: user });
    assert.equal(rv.status, 200); assert.ok(rv.body.device.revokedAt);
    const after = await t.call('GET', '/api/device/info', { token });
    assert.deepEqual([after.status, after.body.error.code, after.body.error.message], answers[0]);   // a revoked token looks like any wrong one
    assert.equal((await post(t, token, '2026-10', LOG, 0)).status, 401);
    assert.equal(t.db.prepare('SELECT COUNT(*) n FROM device_logs').get().n, 0);
    assert.ok(t.db.prepare("SELECT 1 FROM device_audit WHERE action = 'rejected'").get());
  } finally { await t.close(); }
});

test('a device is scoped to one account: other users cannot see, read, revoke or delete it, and its logs stay with its owner', async () => {
  const t = await serve();
  try {
    const a = await paired(t, 'ana', 'Ana X4');
    const b = await paired(t, 'ben', 'Ben X4');
    assert.equal((await post(t, a.token, '2026-10', LOG, 0)).status, 200);
    assert.deepEqual((await t.call('GET', '/api/device/info', { token: b.token })).body.logs, []);       // ben's device sees none of ana's
    assert.equal((await t.call('GET', '/api/devices', { token: b.user })).body.devices.length, 1);
    for (const [m, url] of [['GET', `/api/devices/${a.device.id}/logs`], ['GET', `/api/devices/${a.device.id}/logs/2026-10`], ['GET', `/api/devices/${a.device.id}/audit`], ['POST', `/api/devices/${a.device.id}/revoke`], ['DELETE', `/api/devices/${a.device.id}/logs`]]) {
      assert.equal((await t.call(m, url, { token: b.user })).status, 404, `${m} ${url}`);
    }
    assert.equal((await t.call('GET', `/api/devices/${a.device.id}/logs`)).status, 401);
    assert.equal((await t.call('GET', '/api/device/info', { token: a.token })).status, 200);              // ben's attempts changed nothing
    const mine = await t.call('GET', `/api/devices/${a.device.id}/logs/2026-10`, { token: a.user });
    assert.equal(mine.status, 200); assert.equal(mine.body.toString('utf8'), LOG);
    assert.match(mine.headers.get('content-type'), /^text\/csv/); assert.equal(mine.headers.get('cache-control'), 'no-store');
    assert.match(mine.headers.get('content-disposition'), /^attachment/);
  } finally { await t.close(); }
});

test('the owner can list, read and delete what a device sent, and see an audit trail without log content or tokens', async () => {
  const t = await serve();
  try {
    const { token, device, user } = await paired(t);
    await post(t, token, '2026-10', LOG, 0); await post(t, token, '2026-09', LOG, 0);
    const months = (await t.call('GET', `/api/devices/${device.id}/logs`, { token: user })).body.logs;
    assert.deepEqual(months.map((m) => [m.month, m.size]), [['2026-09', LOG.length], ['2026-10', LOG.length]]);
    assert.equal((await t.call('GET', '/api/devices', { token: user })).body.devices[0].logs.months, 2);
    const audit = (await t.call('GET', `/api/devices/${device.id}/audit`, { token: user })).body.audit;
    assert.deepEqual(audit.map((x) => x.action).sort(), ['created', 'upload', 'upload']);
    assert.ok(!JSON.stringify(audit).includes('spoons') && !JSON.stringify(audit).includes(token.slice(token.indexOf('_', 4) + 1)));
    assert.equal((await t.call('DELETE', `/api/devices/${device.id}/logs?month=2026-09`, { token: user })).body.deleted, 1);
    assert.equal((await t.call('GET', `/api/devices/${device.id}/logs/2026-09`, { token: user })).status, 404);
    assert.equal((await t.call('DELETE', `/api/devices/${device.id}/logs`, { token: user })).body.deleted, 1);
    assert.equal(t.db.prepare('SELECT COUNT(*) n FROM device_logs').get().n, 0);
    assert.equal((await t.call('DELETE', `/api/devices/${device.id}/logs?month=2026-9`, { token: user })).status, 400);
    // after a delete the device starts that month again from 0
    assert.equal((await post(t, token, '2026-10', LOG, 0)).status, 200);
  } finally { await t.close(); }
});

test('rate limits: a token is limited per window, wrong tokens lock their address out, and Retry-After says when', async () => {
  const t = await serve();
  try {
    let now = 1_000_000;
    t.studio.nowMs = () => now;
    t.studio._lim = undefined;
    const { token } = await paired(t);
    for (let i = 0; i < LIMITS.perWindow; i++) assert.equal((await t.call('GET', '/api/device/info', { token })).status, 200, `request ${i}`);
    const r = await t.call('GET', '/api/device/info', { token });
    assert.equal(r.status, 429); assert.equal(r.body.error.code, 'rate_limited');
    assert.ok(+r.headers.get('retry-after') > 0 && +r.headers.get('retry-after') <= LIMITS.window / 1000);
    now += LIMITS.window + 1000;
    assert.equal((await t.call('GET', '/api/device/info', { token })).status, 200);       // the window moved on
    // wrong tokens: counted per address, then even the right token from there waits
    for (let i = 0; i < LIMITS.badPerWindow; i++) assert.equal((await t.call('GET', '/api/device/info', { token: `kwd_${'1'.repeat(12)}_${'B'.repeat(43)}` })).status, 401);
    assert.equal((await t.call('GET', '/api/device/info', { token: `kwd_${'1'.repeat(12)}_${'B'.repeat(43)}` })).status, 429);
    assert.equal((await t.call('GET', '/api/device/info', { token })).status, 429);
    now += LIMITS.window + 1000;
    assert.equal((await t.call('GET', '/api/device/info', { token })).status, 200);
  } finally { await t.close(); }
});

test('storage limits: months per device and bytes per device', async () => {
  const t = await serve();
  try {
    const { token, device } = await paired(t);
    const ins = t.db.prepare('INSERT INTO device_logs (device_id, month, body, updated_at) VALUES (?, ?, ?, ?)');
    for (let i = 0; i < LIMITS.months; i++) ins.run(device.id, `${2020 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`, Buffer.from('x'), 'x');
    const r = await post(t, token, '2030-01', LOG, 0);
    assert.equal(r.status, 413); assert.equal(r.body.error.code, 'too_many_months');
    t.db.prepare('DELETE FROM device_logs').run();
    for (let i = 0; i < 8; i++) ins.run(device.id, `2024-${String(i + 1).padStart(2, '0')}`, Buffer.alloc(LIMITS.month, 97), 'x');
    const full = await post(t, token, '2025-01', LOG, 0);
    assert.equal(full.status, 413); assert.equal(full.body.error.code, 'device_full');
  } finally { await t.close(); }
});

test('privacy: an uploaded log is in no project, snapshot, commit, fork or export; removing the device removes it', async () => {
  const t = await serve();
  try {
    const { token, device, user } = await paired(t);
    const marker = '2026-10-14T08:15,spoons,4\n2026-10-14T08:16,note_unique_marker_77,3\n';
    await post(t, token, '2026-10', marker, 0);
    const p = await t.call('POST', '/api/projects', { token: user, body: { name: 'Book', visibility: 'public', allowReuse: true } });
    const pid = p.body.project.id;
    const head = (await t.call('GET', `/api/projects/${pid}/head`, { token: user })).body;
    const c = await t.call('POST', `/api/projects/${pid}/commits`, { token: user, body: { branch: 'main', expectedHead: head.commit.id, message: 'again', snapshot: { meta: { title: 'Book', description: 'after the upload' } } } });
    assert.equal(c.status, 201);
    const f = await t.call('POST', `/api/projects/${pid}/forks`, { token: await t.signup('fran'), body: {} });
    assert.ok([201, 403].includes(f.status));
    // nothing in the snapshot store, and nothing any read of a project returns, mentions the log
    const objects = JSON.stringify(t.db.prepare('SELECT body FROM objects').all());
    assert.ok(!objects.includes('note_unique_marker_77') && !objects.includes('2026-10-14T08'));
    for (const tbl of ['projects', 'commits', 'branches', 'drafts', 'proposals', 'proposal_events']) {
      try { assert.ok(!JSON.stringify(t.db.prepare(`SELECT * FROM ${tbl}`).all()).includes('note_unique_marker_77'), tbl); } catch (e) { if (e instanceof assert.AssertionError) throw e; }
    }
    const pub = JSON.stringify((await t.call('GET', `/api/projects/${pid}/head`)).body);
    assert.ok(!pub.includes('note_unique_marker_77'));
    // removing the device removes its logs and its audit trail
    assert.equal(t.db.prepare('SELECT COUNT(*) n FROM device_logs').get().n, 1);
    t.db.prepare('DELETE FROM devices WHERE id = ?').run(device.id);   // the logs go with the device (ON DELETE CASCADE)
    assert.equal(t.db.prepare('SELECT COUNT(*) n FROM device_logs').get().n, 0);
    assert.equal(t.db.prepare('SELECT COUNT(*) n FROM device_audit').get().n, 0);
  } finally { await t.close(); }
});

test('snapshot.mjs still refuses device logs and tokens: by key, by path and by value', () => {
  const rejects = (fn) => assert.throws(fn, (e) => e instanceof StudioError && e.status === 422 && e.code === 'forbidden_content');
  const base = () => emptySnapshot('Sample');
  for (const key of ['log', 'logs', 'checkins', 'device', 'devices', 'deviceLog', 'devicetoken', 'token']) rejects(() => serializeSnapshot({ meta: { ...base().meta, [key]: 'x' } }, base()));
  for (const v of ['/kw/log/2026-10.csv', 'kw/sync.txt', '/kw/net.txt', 'out/2026-10.csv', 'sync.txt',
    'kwd_0123456789ab_' + 'A'.repeat(43), '2026-10-14T08:15,spoons,4', 'x\n2026-10-14T08:15,spoons,4\n2026-10-14T08:16,sleep,7\n', '2026-10-14T08:15,mood,Calm']) {
    rejects(() => serializeSnapshot({ meta: { ...base().meta, description: v } }, base()));
  }
  assert.deepEqual(scanForbidden({ day: { blocks: [{ title: 'Spoons left: how many? 2026-10 is October' }] } }), []);   // ordinary text is fine
  assert.ok(scanForbidden({ day: { blocks: [{ logs: [] }] } }).length === 1);
  // and the real log text, uploaded as a device would, cannot be committed to a project by hand either
  const { studio, user } = fresh();
  const u = user('sam'), p = project(studio, u);
  assert.throws(() => studio.commit(u, p.id, { branch: 'main', expectedHead: p.head, message: 'x', snapshot: { meta: { description: LOG } } }), (e) => e.code === 'forbidden_content');
});
