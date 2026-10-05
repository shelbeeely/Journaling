// The HTTP API (JSON) on Node's built-in http. A thin translation layer: routing, body parsing, status codes. Every access
// decision is made in repo.mjs, so a route cannot skip it. Optionally serves a folder of static files (the editor) from the same origin.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { StudioError } from './db.mjs';

const MAX_JSON = 2 * 1024 * 1024, MAX_ASSET = 5 * 1024 * 1024 + 1024;
const TYPES = { '.html': 'text/html; charset=utf-8', '.json': 'application/json', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.txt': 'text/plain; charset=utf-8' };

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = []; let n = 0, over = false;
    req.on('data', (c) => { n += c.length; if (n > limit) over = true; else if (!over) chunks.push(c); }); // keep reading (and drop) so the client gets its 413
    req.on('end', () => (over ? reject(new StudioError(413, 'too_large', 'That request is too large.')) : resolve(Buffer.concat(chunks))));
    req.on('error', reject);
  });
}
const dec = (s) => { try { return decodeURIComponent(s); } catch { throw new StudioError(400, 'bad_path', 'Bad path.'); } };

export function createApp(studio, { staticDir = null, corsOrigins = [], openRegistration = true } = {}) {
  const S = studio;
  // [method, pattern, handler(ctx) -> [status, body] | body]. ctx: user, token, params, query, body(), bytes(), req
  const R = [];
  const route = (method, pattern, fn) => R.push([method, new RegExp(`^${pattern}$`), fn]);
  const P = '/api/projects/([0-9a-f-]{36})';

  route('GET', '/api/health', () => ({ ok: true, name: 'journalwright-studio', registration: openRegistration ? 'open' : 'closed' }));
  route('POST', '/api/auth/register', async (c) => { if (!openRegistration) throw new StudioError(403, 'registration_closed', 'Registration is closed on this server.'); return [201, { user: S.register(await c.body()) }]; });
  route('POST', '/api/auth/login', async (c) => S.login(await c.body()));
  route('POST', '/api/auth/logout', (c) => { S.logout(c.token); return { ok: true }; });
  route('GET', '/api/me', (c) => { if (!c.user) throw new StudioError(401, 'login_required', 'Sign in first.'); return { user: c.user }; });

  route('GET', '/api/projects', (c) => ({ projects: S.listProjects(c.user, { publicOnly: c.query.get('public') === '1' }) }));
  route('POST', '/api/projects', async (c) => [201, { project: S.createProject(c.user, await c.body()) }]);
  route('GET', P, (c) => ({ project: S.getProject(c.user, c.m[1]) }));
  route('PATCH', P, async (c) => ({ project: S.updateProject(c.user, c.m[1], await c.body()) }));
  route('DELETE', P, (c) => S.deleteProject(c.user, c.m[1]));

  route('GET', `${P}/members`, (c) => ({ members: S.listMembers(c.user, c.m[1]) }));
  route('PUT', `${P}/members/([^/]+)`, async (c) => ({ members: S.setMember(c.user, c.m[1], dec(c.m[2]), (await c.body()).role) }));
  route('DELETE', `${P}/members/([^/]+)`, (c) => ({ members: S.removeMember(c.user, c.m[1], dec(c.m[2])) }));

  route('GET', `${P}/head`, (c) => S.head(c.user, c.m[1], c.query.get('branch')));
  route('GET', `${P}/commits/([0-9a-f]{7,64})`, (c) => S.getCommit(c.user, c.m[1], c.m[2]));
  route('GET', `${P}/commits/([0-9a-f]{7,64})/verify`, (c) => S.verify(c.user, c.m[1], c.m[2]));
  route('POST', `${P}/commits`, async (c) => { const r = S.commit(c.user, c.m[1], await c.body()); return [r.unchanged ? 200 : 201, r]; });
  route('GET', `${P}/log`, (c) => S.log(c.user, c.m[1], { branch: c.query.get('branch') || undefined, limit: c.query.get('limit') || 50 }));
  route('GET', `${P}/diff`, (c) => S.diff(c.user, c.m[1], c.query.get('from'), c.query.get('to')));
  route('POST', `${P}/restore`, async (c) => { const r = S.restore(c.user, c.m[1], await c.body()); return [r.unchanged ? 200 : 201, r]; });

  route('GET', `${P}/branches`, (c) => ({ branches: S.listBranches(c.user, c.m[1]) }));
  route('POST', `${P}/branches`, async (c) => [201, { branch: S.createBranch(c.user, c.m[1], await c.body()) }]);
  route('GET', `${P}/branches/(.+)`, (c) => ({ branch: dec(c.m[2]), ...S.head(c.user, c.m[1], dec(c.m[2])) })); // "switch" = read that branch's head
  route('DELETE', `${P}/branches/(.+)`, (c) => S.deleteBranch(c.user, c.m[1], dec(c.m[2])));

  route('POST', `${P}/drafts/(.+)/promote`, async (c) => { const r = S.promoteDraft(c.user, c.m[1], dec(c.m[2]), await c.body()); return [r.unchanged ? 200 : 201, r]; });
  route('GET', `${P}/drafts/(.+)`, (c) => S.getDraft(c.user, c.m[1], dec(c.m[2])));
  route('PUT', `${P}/drafts/(.+)`, async (c) => S.saveDraft(c.user, c.m[1], dec(c.m[2]), await c.body()));
  route('DELETE', `${P}/drafts/(.+)`, (c) => S.discardDraft(c.user, c.m[1], dec(c.m[2])));

  // G2: forks, change proposals, merges
  route('GET', `${P}/forks`, (c) => ({ forks: S.listForks(c.user, c.m[1]) }));
  route('POST', `${P}/forks`, async (c) => [201, { project: S.fork(c.user, c.m[1], await c.body()) }]);
  route('GET', `${P}/proposals`, (c) => ({ proposals: S.listProposals(c.user, c.m[1], { status: c.query.get('status') || undefined }) }));
  route('POST', `${P}/proposals`, async (c) => [201, { proposal: S.createProposal(c.user, c.m[1], await c.body()) }]);
  route('GET', `${P}/proposals/(\\d+)`, (c) => ({ proposal: S.getProposal(c.user, c.m[1], c.m[2]) }));
  route('GET', `${P}/proposals/(\\d+)/compare`, (c) => S.compareProposal(c.user, c.m[1], c.m[2]));
  route('POST', `${P}/proposals/(\\d+)/comments`, async (c) => [201, { proposal: S.commentProposal(c.user, c.m[1], c.m[2], await c.body()) }]);
  route('POST', `${P}/proposals/(\\d+)/reviews`, async (c) => [201, { proposal: S.reviewProposal(c.user, c.m[1], c.m[2], await c.body()) }]);
  route('POST', `${P}/proposals/(\\d+)/status`, async (c) => ({ proposal: S.setProposalStatus(c.user, c.m[1], c.m[2], await c.body()) }));
  route('POST', `${P}/proposals/(\\d+)/accept`, async (c) => { const r = S.acceptChanges(c.user, c.m[1], c.m[2], await c.body()); return [r.unchanged ? 200 : 201, r]; });
  route('POST', `${P}/proposals/(\\d+)/merge`, async (c) => [201, S.mergeProposal(c.user, c.m[1], c.m[2], await c.body())]);
  route('POST', `${P}/merge/preview`, async (c) => S.mergePreview(c.user, c.m[1], await c.body()));
  route('POST', `${P}/merge`, async (c) => [201, S.merge(c.user, c.m[1], await c.body())]);

  // G3: releases (immutable: there is no PATCH, PUT or DELETE) and reusable pages
  route('GET', `${P}/releases`, (c) => ({ releases: S.listReleases(c.user, c.m[1]) }));
  route('POST', `${P}/releases`, async (c) => [201, { release: S.createRelease(c.user, c.m[1], await c.body()) }]);
  route('GET', `${P}/releases/([^/]+)/export`, (c) => S.exportRelease(c.user, c.m[1], dec(c.m[2])));
  route('GET', `${P}/releases/([^/]+)`, (c) => ({ release: S.getRelease(c.user, c.m[1], dec(c.m[2])) }));
  route('GET', '/api/library', (c) => ({ items: S.listLibrary(c.user, { publicOnly: c.query.get('public') === '1' }) }));
  route('POST', '/api/library', async (c) => [201, { item: S.createLibraryItem(c.user, await c.body()) }]);
  const I = '/api/library/([0-9a-f-]{36})';
  route('GET', I, (c) => ({ item: S.getLibraryItem(c.user, c.m[1]) }));
  route('PATCH', I, async (c) => ({ item: S.updateLibraryItem(c.user, c.m[1], await c.body()) }));
  route('DELETE', I, (c) => S.deleteLibraryItem(c.user, c.m[1]));
  route('POST', `${I}/versions`, async (c) => [201, { item: S.addLibraryVersion(c.user, c.m[1], await c.body()) }]);
  route('GET', `${I}/versions/(\\d+)`, (c) => S.getLibraryVersion(c.user, c.m[1], c.m[2]));
  route('POST', `${P}/insert`, async (c) => { const r = S.insertFromLibrary(c.user, c.m[1], await c.body()); return [r.unchanged ? 200 : 201, r]; });
  route('GET', `${P}/reuse`, (c) => ({ reuse: S.listReuse(c.user, c.m[1]) }));

  route('GET', `${P}/assets`, (c) => ({ assets: S.listAssets(c.user, c.m[1]) }));
  route('POST', `${P}/assets`, async (c) => [201, { asset: S.putAsset(c.user, c.m[1], { name: c.req.headers['x-asset-name'], mime: String(c.req.headers['content-type'] || '').split(';')[0].trim(), bytes: await c.bytes() }) }]);
  route('GET', `${P}/assets/([0-9a-f]{64})`, (c) => { const a = S.getAsset(c.user, c.m[1], c.m[2]); return { raw: a }; });

  const cors = (req, res) => {
    const o = req.headers.origin;
    if (o && corsOrigins.includes(o)) {
      res.setHeader('Access-Control-Allow-Origin', o); res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Asset-Name'); res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    }
  };
  const send = (res, status, body) => {
    const s = JSON.stringify(body);
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(s);
  };
  function serveStatic(req, res, pathname) {
    if (!staticDir || !['GET', 'HEAD'].includes(req.method)) return false;
    const root = path.resolve(staticDir);
    const f = path.resolve(root, '.' + (pathname.endsWith('/') ? pathname + 'index.html' : pathname));
    if (f !== root && !f.startsWith(root + path.sep)) return false;
    if (!fs.existsSync(f) || !fs.statSync(f).isFile()) return false;
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-cache' });
    res.end(req.method === 'HEAD' ? undefined : fs.readFileSync(f));
    return true;
  }

  return async (req, res) => {
    const url = new URL(req.url, 'http://x');
    try {
      cors(req, res);
      if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
      if (!url.pathname.startsWith('/api/')) { if (serveStatic(req, res, dec(url.pathname))) return; throw new StudioError(404, 'not_found', 'Not found.'); }
      const auth = String(req.headers.authorization || '');
      const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : null;
      const user = S.userFor(token);
      for (const [method, re, fn] of R) {
        if (method !== req.method) continue;
        const m = re.exec(url.pathname);
        if (!m) continue;
        const ctx = {
          user, token, m, query: url.searchParams, req,
          body: async () => { const b = await readBody(req, MAX_JSON); if (!b.length) return {}; try { const v = JSON.parse(b.toString('utf8')); if (!v || typeof v !== 'object' || Array.isArray(v)) throw 0; return v; } catch { throw new StudioError(400, 'bad_json', 'The request body must be a JSON object.'); } },
          bytes: () => readBody(req, MAX_ASSET),
        };
        const out = await fn(ctx);
        if (out && out.raw) { // an asset: bytes, served so a browser can never run it
          res.writeHead(200, { 'Content-Type': out.raw.mime, 'Content-Length': out.raw.bytes.length, 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox", 'Cache-Control': 'private, max-age=0, must-revalidate', 'Content-Disposition': `inline; filename="${out.raw.name.replace(/"/g, '')}"` });
          res.end(out.raw.bytes); return;
        }
        const [status, body] = Array.isArray(out) ? out : [200, out];
        send(res, status, body); return;
      }
      throw new StudioError(404, 'not_found', 'Not found.');
    } catch (e) {
      if (e instanceof StudioError) return send(res, e.status, { error: { code: e.code, message: e.message, ...(e.details !== undefined ? { details: e.details } : {}) } });
      console.error(e);
      send(res, 500, { error: { code: 'server_error', message: 'Something went wrong on the server.' } });
    }
  };
}

export function listen(studio, { port = 0, host = '127.0.0.1', ...opts } = {}) {
  const srv = http.createServer(createApp(studio, opts));
  return new Promise((resolve) => srv.listen(port, host, () => resolve(srv)));
}
