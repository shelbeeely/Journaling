// The HTTP API: auth, projects, commits, branches, drafts, assets, and above all who may see and change what.
import test from 'node:test';
import assert from 'node:assert/strict';
import { serve, PASSWORD, withBlock } from './helpers.mjs';

test('accounts: register, login, /me, logout; passwords are hashed with scrypt; bad logins fail without saying which part', async () => {
  const t = await serve();
  try {
    assert.equal((await t.call('POST', '/api/auth/register', { body: { username: 'sam', password: 'short' } })).status, 422);
    assert.equal((await t.call('POST', '/api/auth/register', { body: { username: 'sam', password: PASSWORD, displayName: 'Sam' } })).status, 201);
    assert.equal((await t.call('POST', '/api/auth/register', { body: { username: 'SAM', password: PASSWORD } })).status, 409);
    const row = t.db.prepare('SELECT password_hash FROM users').get();
    assert.match(row.password_hash, /^scrypt\$16384\$8\$1\$/);
    assert.ok(!row.password_hash.includes(PASSWORD));
    const bad = await t.call('POST', '/api/auth/login', { body: { username: 'sam', password: 'wrong wrong wrong' } });
    const ghost = await t.call('POST', '/api/auth/login', { body: { username: 'nobody', password: 'wrong wrong wrong' } });
    assert.equal(bad.status, 401); assert.equal(ghost.status, 401); assert.equal(bad.body.error.message, ghost.body.error.message);
    const ok = await t.call('POST', '/api/auth/login', { body: { username: 'sam', password: PASSWORD } });
    assert.equal(ok.status, 200);
    const { token } = ok.body;
    assert.equal(t.db.prepare('SELECT COUNT(*) n FROM sessions WHERE token_hash = ?').get(token).n, 0); // only a hash of the token is stored
    assert.equal((await t.call('GET', '/api/me', { token })).body.user.username, 'sam');
    assert.equal((await t.call('GET', '/api/me')).status, 401);
    assert.equal((await t.call('GET', '/api/me', { token: 'made-up' })).status, 401);
    await t.call('POST', '/api/auth/logout', { token });
    assert.equal((await t.call('GET', '/api/me', { token })).status, 401);
  } finally { await t.close(); }
});

test('login attempts are throttled after repeated failures', async () => {
  const t = await serve();
  try {
    await t.signup('lockme'); // throttling is per username and lives in the process: use a name no other test uses
    let last;
    for (let i = 0; i < 9; i++) last = await t.call('POST', '/api/auth/login', { body: { username: 'lockme', password: 'wrong wrong wrong' } });
    assert.equal(last.status, 429);
    assert.equal((await t.call('POST', '/api/auth/login', { body: { username: 'lockme', password: PASSWORD } })).status, 429); // even the right password waits
  } finally { await t.close(); }
});

test('registration can be closed', async () => {
  const t = await serve({ openRegistration: false });
  try { assert.equal((await t.call('POST', '/api/auth/register', { body: { username: 'sam', password: PASSWORD } })).status, 403); } finally { await t.close(); }
});

test('a full session over HTTP: create, commit, log, diff, restore, branches, drafts', async () => {
  const t = await serve();
  try {
    const tok = await t.signup('sam');
    const created = await t.call('POST', '/api/projects', { token: tok, body: { name: 'My Book', description: 'sample', visibility: 'private', allowReuse: false } });
    assert.equal(created.status, 201);
    const id = created.body.project.id, url = (s) => `/api/projects/${id}${s}`;
    const head = await t.call('GET', url('/head'), { token: tok });
    assert.equal(head.status, 200);
    const h0 = head.body.commit.id;
    const day = withBlock(head.body.snapshot.day, 'checks', { title: 'Habits' });
    const c = await t.call('POST', url('/commits'), { token: tok, body: { branch: 'main', expectedHead: h0, message: 'Add habits', snapshot: { day } } });
    assert.equal(c.status, 201);
    const stale = await t.call('POST', url('/commits'), { token: tok, body: { branch: 'main', expectedHead: h0, message: 'Late', snapshot: { day } } });
    assert.equal(stale.status, 409); assert.equal(stale.body.error.code, 'head_moved'); assert.equal(stale.body.error.details.head, c.body.commit.id);
    assert.equal((await t.call('POST', url('/commits'), { token: tok, body: { branch: 'main', expectedHead: c.body.commit.id, message: 'Same', snapshot: {} } })).status, 200); // unchanged
    const log = await t.call('GET', url('/log?branch=main'), { token: tok });
    assert.deepEqual(log.body.commits.map((x) => x.message), ['Add habits', 'Start the project']);
    const df = await t.call('GET', url(`/diff?from=${h0}&to=${c.body.commit.id}`), { token: tok });
    assert.deepEqual(df.body.day.added.map((x) => x.id), ['checks-t1']);
    assert.equal((await t.call('GET', url(`/commits/${c.body.commit.id}/verify`), { token: tok })).body.ok, true);
    const rs = await t.call('POST', url('/restore'), { token: tok, body: { commit: h0, branch: 'main', expectedHead: c.body.commit.id } });
    assert.equal(rs.status, 201); assert.equal(rs.body.commit.tree, head.body.commit.tree);
    const br = await t.call('POST', url('/branches'), { token: tok, body: { name: 'idea/purple', from: 'main' } });
    assert.equal(br.status, 201);
    assert.deepEqual((await t.call('GET', url('/branches'), { token: tok })).body.branches.map((b) => b.name), ['idea/purple', 'main']);
    assert.equal((await t.call('GET', url('/branches/idea%2Fpurple'), { token: tok })).body.commit.id, rs.body.commit.id); // switch = read that head
    const dr = await t.call('PUT', url('/drafts/idea%2Fpurple'), { token: tok, body: { snapshot: { day } } });
    assert.equal(dr.status, 200); assert.equal(dr.body.rev, 1);
    assert.equal((await t.call('PUT', url('/drafts/idea%2Fpurple'), { token: tok, body: { rev: 0, snapshot: { day } } })).status, 409);
    assert.equal((await t.call('GET', url('/drafts/idea%2Fpurple'), { token: tok })).body.draft.snapshot.day.blocks.some((b) => b.uid === 'checks-t1'), true);
    const pr = await t.call('POST', url('/drafts/idea%2Fpurple/promote'), { token: tok, body: { message: 'Purple habits' } });
    assert.equal(pr.status, 201);
    assert.equal((await t.call('GET', url('/drafts/idea%2Fpurple'), { token: tok })).body.draft, null);
    assert.equal((await t.call('DELETE', url('/drafts/main'), { token: tok })).body.discarded, false);
    // forbidden content over HTTP
    const bad = await t.call('POST', url('/commits'), { token: tok, body: { branch: 'main', expectedHead: rs.body.commit.id, message: 'leak', snapshot: { print: { trim: 'small', edition: 1, ICS_URLS: 'https://x/y.ics' } } } });
    assert.equal(bad.status, 422); assert.equal(bad.body.error.code, 'forbidden_content'); assert.ok(bad.body.error.details.length >= 1);
    assert.equal((await t.call('POST', url('/commits'), { token: tok, raw: '{not json', headers: { 'Content-Type': 'application/json' } })).status, 400);
  } finally { await t.close(); }
});

test('authorization: a non-member gets 404 on every route of a private project; nothing leaks', async () => {
  const t = await serve();
  try {
    const sam = await t.signup('sam'), eve = await t.signup('eve');
    const { project } = (await t.call('POST', '/api/projects', { token: sam, body: { name: 'Private Book' } })).body;
    const id = project.id, url = (s) => `/api/projects/${id}${s}`;
    const h = (await t.call('GET', url('/head'), { token: sam })).body.commit.id;
    const routes = [['GET', ''], ['PATCH', '', { name: 'x' }], ['DELETE', ''], ['GET', '/members'], ['PUT', '/members/eve', { role: 'owner' }], ['GET', '/head'], ['GET', `/commits/${h}`], ['GET', `/commits/${h}/verify`],
      ['POST', '/commits', { branch: 'main', expectedHead: h, message: 'x', snapshot: {} }], ['GET', '/log'], ['GET', `/diff?from=${h}&to=${h}`], ['POST', '/restore', { commit: h, expectedHead: h }],
      ['GET', '/branches'], ['POST', '/branches', { name: 'x' }], ['GET', '/branches/main'], ['DELETE', '/branches/main'], ['GET', '/drafts/main'], ['PUT', '/drafts/main', { snapshot: {} }],
      ['POST', '/drafts/main/promote', { message: 'x' }], ['DELETE', '/drafts/main'], ['GET', '/assets'], ['POST', '/assets']];
    for (const [m, s, body] of routes) {
      for (const token of [eve, undefined]) {
        const r = await t.call(m, url(s), { token, body });
        assert.equal(r.status, 404, `${m} ${s} as ${token ? 'eve' : 'anonymous'} -> ${r.status}`);
        assert.equal(JSON.stringify(r.body).includes('Private Book'), false);
      }
    }
    assert.deepEqual((await t.call('GET', '/api/projects', { token: eve })).body.projects, []);
    assert.deepEqual((await t.call('GET', '/api/projects?public=1', { token: eve })).body.projects, []);
    // unchanged for the owner
    assert.equal((await t.call('GET', url('/head'), { token: sam })).status, 200);
  } finally { await t.close(); }
});

test('authorization: roles. viewer reads, editor writes, owner administers; a public project is readable by anyone but writable only by members', async () => {
  const t = await serve();
  try {
    const sam = await t.signup('sam'), ed = await t.signup('eddy'), vi = await t.signup('vivi'), pub = await t.signup('pat');
    const id = (await t.call('POST', '/api/projects', { token: sam, body: { name: 'Team Book' } })).body.project.id, url = (s) => `/api/projects/${id}${s}`;
    assert.equal((await t.call('PUT', url('/members/eddy'), { token: sam, body: { role: 'editor' } })).status, 200);
    assert.equal((await t.call('PUT', url('/members/vivi'), { token: sam, body: { role: 'viewer' } })).status, 200);
    const h = (await t.call('GET', url('/head'), { token: vi })).body.commit.id; // viewer can read
    assert.equal((await t.call('GET', url('/log'), { token: vi })).status, 200);
    const w = { branch: 'main', expectedHead: h, message: 'x', snapshot: { meta: { title: 'By viewer', subtitle: '', slug: 'v', description: '' } } };
    assert.equal((await t.call('POST', url('/commits'), { token: vi, body: w })).status, 403);
    assert.equal((await t.call('POST', url('/branches'), { token: vi, body: { name: 'v' } })).status, 403);
    assert.equal((await t.call('PUT', url('/drafts/main'), { token: vi, body: { snapshot: {} } })).status, 403);
    assert.equal((await t.call('POST', url('/commits'), { token: ed, body: { ...w, snapshot: { meta: { title: 'By editor', subtitle: '', slug: 'e', description: '' } } } })).status, 201);
    assert.equal((await t.call('PATCH', url(''), { token: ed, body: { visibility: 'public' } })).status, 403);
    assert.equal((await t.call('PUT', url('/members/vivi'), { token: ed, body: { role: 'owner' } })).status, 403);
    assert.equal((await t.call('DELETE', url(''), { token: ed })).status, 403);
    assert.equal((await t.call('PATCH', url(''), { token: sam, body: { visibility: 'public', allowReuse: true } })).body.project.allowReuse, true);
    // now public: pat (not a member) and anonymous can read, neither can write
    assert.equal((await t.call('GET', url('/head'), { token: pub })).status, 200);
    assert.equal((await t.call('GET', url('/head'))).status, 200);
    assert.equal((await t.call('GET', '/api/projects?public=1')).body.projects.length, 1);
    assert.equal((await t.call('POST', url('/commits'), { token: pub, body: { ...w, expectedHead: (await t.call('GET', url('/head'))).body.commit.id } })).status, 403);
    assert.equal((await t.call('POST', url('/commits'), { body: w })).status, 401);
    assert.equal((await t.call('GET', url('/members'), { token: pub })).status, 200);
    assert.equal((await t.call('PUT', url('/members/pat'), { token: pub, body: { role: 'owner' } })).status, 403);
    // going private again hides it again
    await t.call('PATCH', url(''), { token: sam, body: { visibility: 'private' } });
    assert.equal((await t.call('GET', url('/head'), { token: pub })).status, 404);
    // the last owner cannot leave; removing a member removes their access and drafts
    assert.equal((await t.call('DELETE', url('/members/sam'), { token: sam })).status, 409);
    assert.equal((await t.call('DELETE', url('/members/eddy'), { token: sam })).status, 200);
    assert.equal((await t.call('GET', url('/head'), { token: ed })).status, 404);
  } finally { await t.close(); }
});

test('assets are access-checked: members read them, outsiders get 404, and they are served so a browser cannot run them', async () => {
  const t = await serve();
  try {
    const sam = await t.signup('sam'), eve = await t.signup('eve');
    const id = (await t.call('POST', '/api/projects', { token: sam, body: { name: 'Assets' } })).body.project.id, url = (s) => `/api/projects/${id}${s}`;
    const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.from('sample-image')]);
    const up = await t.call('POST', url('/assets'), { token: sam, headers: { 'Content-Type': 'image/png', 'X-Asset-Name': 'logo.png' }, raw: png });
    assert.equal(up.status, 201);
    const { hash } = up.body.asset;
    const got = await t.call('GET', url(`/assets/${hash}`), { token: sam });
    assert.equal(got.status, 200); assert.equal(got.headers.get('content-type'), 'image/png'); assert.equal(got.headers.get('x-content-type-options'), 'nosniff');
    assert.match(got.headers.get('content-security-policy'), /sandbox/);
    assert.ok(Buffer.from(got.body).equals(png));
    for (const token of [eve, undefined]) assert.equal((await t.call('GET', url(`/assets/${hash}`), { token })).status, 404);
    assert.equal((await t.call('POST', url('/assets'), { token: eve, headers: { 'Content-Type': 'image/png', 'X-Asset-Name': 'x.png' }, raw: png })).status, 404);
    // the same bytes in another project are a different address there: eve cannot reach sam's copy through her own project
    const eid = (await t.call('POST', '/api/projects', { token: eve, body: { name: 'Eve' } })).body.project.id;
    assert.equal((await t.call('GET', `/api/projects/${eid}/assets/${hash}`, { token: eve })).status, 404);
    assert.equal((await t.call('POST', url('/assets'), { token: sam, headers: { 'Content-Type': 'text/calendar', 'X-Asset-Name': 'cal.ics' }, raw: 'BEGIN:VCALENDAR' })).status, 415);
    assert.equal((await t.call('POST', url('/assets'), { token: sam, headers: { 'Content-Type': 'image/png', 'X-Asset-Name': '../../etc/passwd' }, raw: png })).status, 422);
    assert.equal((await t.call('POST', url('/assets'), { token: sam, headers: { 'Content-Type': 'image/png', 'X-Asset-Name': 'big.png' }, raw: Buffer.concat([png, Buffer.alloc(6 * 1024 * 1024)]) })).status, 413);
  } finally { await t.close(); }
});

test('CORS: only listed origins get headers; preflight works; the editor can be served from the same origin', async () => {
  const t = await serve({ corsOrigins: ['https://editor.example.org'] });
  try {
    const ok = await t.call('GET', '/api/health', { headers: { Origin: 'https://editor.example.org' } });
    assert.equal(ok.headers.get('access-control-allow-origin'), 'https://editor.example.org');
    const no = await t.call('GET', '/api/health', { headers: { Origin: 'https://evil.example.com' } });
    assert.equal(no.headers.get('access-control-allow-origin'), null);
    const pre = await t.call('OPTIONS', '/api/projects', { headers: { Origin: 'https://editor.example.org' } });
    assert.equal(pre.status, 204); assert.match(pre.headers.get('access-control-allow-headers'), /Authorization/);
    assert.equal((await t.call('GET', '/nope')).status, 404);
  } finally { await t.close(); }
});
