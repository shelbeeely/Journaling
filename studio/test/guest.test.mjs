// Guests: people with no account. Everything that only reads a public project works; everything that writes is refused; a private
// project does not exist for them. (What a guest can do on their own device, with no server at all, is tested in ui.test.mjs.)
import test from 'node:test';
import assert from 'node:assert/strict';
import { serve } from './helpers.mjs';

test('guests (no account): every read of a public project works, every write is refused, a private project does not exist', async () => {
  const t = await serve();
  try {
    const sam = await t.signup('sam');
    const pub = (await t.call('POST', '/api/projects', { token: sam, body: { name: 'Public Book', visibility: 'public', allowReuse: true } })).body.project;
    const priv = (await t.call('POST', '/api/projects', { token: sam, body: { name: 'Private Book' } })).body.project;
    const url = (id, s) => `/api/projects/${id}${s}`;
    const h = (await t.call('GET', url(pub.id, '/head'), { token: sam })).body;
    const c2 = (await t.call('POST', url(pub.id, '/commits'), { token: sam, body: { branch: 'main', expectedHead: h.commit.id, message: 'Rename', snapshot: { meta: { title: 'Renamed', subtitle: '', slug: 'r', description: '' } } } })).body.commit;
    const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.from('x')]);
    const asset = (await t.call('POST', url(pub.id, '/assets'), { token: sam, headers: { 'Content-Type': 'image/png', 'X-Asset-Name': 'a.png' }, raw: png })).body.asset;
    // reads, no token
    for (const [s, check] of [['', (b) => b.project.name === 'Public Book'], ['/head', (b) => b.commit.id === c2.id], [`/commits/${c2.id}`, (b) => b.snapshot.meta.title === 'Renamed'], [`/commits/${c2.id}/verify`, (b) => b.ok],
      ['/log', (b) => b.total === 2], [`/diff?from=${h.commit.id}&to=${c2.id}`, (b) => b.meta.length > 0], ['/branches', (b) => b.branches.length === 1], ['/branches/main', (b) => b.commit.id === c2.id],
      ['/members', (b) => b.members.length === 1], ['/assets', (b) => b.assets.length === 1]]) {
      const r = await t.call('GET', url(pub.id, s));
      assert.equal(r.status, 200, `GET ${s || '/'} as a guest`);
      assert.ok(check(r.body), `GET ${s || '/'} body`);
    }
    assert.equal((await t.call('GET', url(pub.id, `/assets/${asset.hash}`))).status, 200);
    assert.deepEqual((await t.call('GET', '/api/projects?public=1')).body.projects.map((p) => p.name), ['Public Book']);
    // every write is 401, and a guest has no drafts
    for (const [m, s, body] of [['PATCH', '', { name: 'x' }], ['DELETE', ''], ['PUT', '/members/sam', { role: 'viewer' }], ['POST', '/commits', { branch: 'main', expectedHead: c2.id, message: 'x', snapshot: {} }], ['POST', '/restore', { commit: h.commit.id, expectedHead: c2.id }],
      ['POST', '/branches', { name: 'x' }], ['DELETE', '/branches/main'], ['GET', '/drafts/main'], ['PUT', '/drafts/main', { snapshot: {} }], ['POST', '/drafts/main/promote', { message: 'x' }], ['DELETE', '/drafts/main'], ['POST', '/assets']]) {
      assert.equal((await t.call(m, url(pub.id, s), { body })).status, 401, `${m} ${s} as a guest`);
    }
    assert.equal((await t.call('POST', '/api/projects', { body: { name: 'Guest project' } })).status, 401);
    // the private one is simply not there
    for (const s of ['', '/head', '/log', '/members', '/assets', '/branches']) assert.equal((await t.call('GET', url(priv.id, s))).status, 404, `private GET ${s}`);
    // a signed-in stranger is a guest for this purpose too: reads yes, writes 403
    const eve = await t.signup('eve');
    assert.equal((await t.call('GET', url(pub.id, '/head'), { token: eve })).status, 200);
    assert.equal((await t.call('POST', url(pub.id, '/commits'), { token: eve, body: { branch: 'main', expectedHead: c2.id, message: 'x', snapshot: {} } })).status, 403);
    assert.equal((await t.call('GET', url(priv.id, '/head'), { token: eve })).status, 404);
    // nothing changed
    assert.equal((await t.call('GET', url(pub.id, '/log'))).body.total, 2);
  } finally { await t.close(); }
});
