// N2: X4 device sync, the server side. These are Studio methods (installed on Studio.prototype by repo.mjs).
//
// Pairing: a signed-in user adds a device (a name). The server returns a token ONCE, plus the text of the device's `sync.txt`; only the
// token's sha256 is stored. The user copies sync.txt to the X4's card. From then on the X4 uploads its check-in log with that token.
//
// What a device token can do (and nothing else): read the list of month logs it has uploaded, and append to them (/api/device/*).
// It is not a session: it cannot read projects, drafts, the account or another device, and the user's session cannot upload as a device.
// It belongs to one account, can be revoked at once (a revoked token is refused the same way as an unknown one), and is rate limited.
// The log is private to the account: its own tables, never in a snapshot, a fork, an export or a project.
import crypto from 'node:crypto';
import { fail, tx } from './db.mjs';
import { sha256 } from './canon.mjs';

export const TOKEN_PREFIX = 'kwd_';
const TOKEN_RE = /^kwd_[0-9a-f]{12}_[A-Za-z0-9_-]{43}$/;
export const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
export const LIMITS = {
  chunk: 16 * 1024,              // bytes in one upload request (the X4 sends 3 KB at a time)
  month: 2 * 1024 * 1024,        // bytes of one month's log
  device: 16 * 1024 * 1024,      // bytes of all of one device's logs
  months: 36,                    // month logs per device
  devices: 10,                   // active devices per account
  perWindow: 120,                // requests a device token may make per window
  window: 10 * 60_000,
  badPerWindow: 20,              // wrong tokens one address may try per window
};

// Sliding window per key, in memory (a restart clears it, like the sign-in throttle).
class Limiter {
  constructor(max, windowMs, nowMs) { this.max = max; this.windowMs = windowMs; this.nowMs = nowMs; this.hits = new Map(); }
  _live(key) { const from = this.nowMs() - this.windowMs; const a = (this.hits.get(key) || []).filter((x) => x > from); this.hits.set(key, a); return a; }
  wait(key) { const a = this._live(key); return a.length >= this.max ? Math.max(1, Math.ceil((a[0] + this.windowMs - this.nowMs()) / 1000)) : 0; }   // seconds to wait, 0 = free
  hit(key) {   // records a use; returns the seconds to wait if the window was already full (and records nothing then)
    const w = this.wait(key);
    if (w) return w;
    this.hits.get(key).push(this.nowMs());
    if (this.hits.size > 5000) for (const [k] of this.hits) if (!this._live(k).length) this.hits.delete(k);
    return 0;
  }
}

const view = (d, extra = {}) => ({ id: d.id, name: d.name, scope: d.scope, createdAt: d.created_at, lastUsedAt: d.last_used_at || null, revokedAt: d.revoked_at || null, ...extra });
const tooMany = (secs) => fail(429, 'rate_limited', `Too many requests. Try again in ${secs} seconds.`, { retryAfter: secs });

export const devices = {
  _limiters() {
    if (!this._lim) this._lim = { use: new Limiter(LIMITS.perWindow, LIMITS.window, this.nowMs), bad: new Limiter(LIMITS.badPerWindow, LIMITS.window, this.nowMs) };
    return this._lim;
  },
  _audit(deviceId, action, detail = '') { this.db.prepare('INSERT INTO device_audit (device_id, at, action, detail) VALUES (?, ?, ?, ?)').run(deviceId, this.now(), action, detail); },
  _ownDevice(user, id) {
    if (!user) fail(401, 'login_required', 'Sign in first.');
    const d = typeof id === 'string' ? this.db.prepare('SELECT * FROM devices WHERE id = ? AND user_id = ?').get(id, user.id) : null;
    if (!d) fail(404, 'not_found', 'No such device.'); // someone else's device does not exist for you
    return d;
  },

  // ---------- the signed-in user's side ----------
  addDevice(user, { name, server } = {}) {
    if (!user) fail(401, 'login_required', 'Sign in first.');
    const nm = typeof name === 'string' ? name.trim() : '';
    if (!nm || nm.length > 40 || /[\u0000-\u001f\u007f]/.test(nm)) fail(422, 'invalid_name', 'Name the device: up to 40 characters, no control characters.');
    if (server !== undefined && !serverOk(server)) fail(422, 'invalid_server', 'Server: a host name like studio.example.com, with an optional :port.');
    if (this.db.prepare('SELECT COUNT(*) AS n FROM devices WHERE user_id = ? AND revoked_at IS NULL').get(user.id).n >= LIMITS.devices) fail(409, 'too_many_devices', `You can have ${LIMITS.devices} active devices. Revoke one first.`);
    const id = crypto.randomBytes(6).toString('hex');
    const token = `${TOKEN_PREFIX}${id}_${crypto.randomBytes(32).toString('base64url')}`;
    this.db.prepare('INSERT INTO devices (id, user_id, name, token_hash, created_at) VALUES (?, ?, ?, ?, ?)').run(id, user.id, nm, sha256(token), this.now());
    this._audit(id, 'created');
    // `token` and `syncTxt` are in this answer only. Nothing can show them again: revoke the device and add a new one.
    return { device: view(this.db.prepare('SELECT * FROM devices WHERE id = ?').get(id)), token, syncTxt: syncFile(server, token) };
  },
  listDevices(user) {
    if (!user) fail(401, 'login_required', 'Sign in first.');
    return this.db.prepare('SELECT * FROM devices WHERE user_id = ? ORDER BY created_at, id').all(user.id).map((d) => {
      const l = this.db.prepare('SELECT COUNT(*) AS months, COALESCE(SUM(length(body)), 0) AS bytes FROM device_logs WHERE device_id = ?').get(d.id);
      return view(d, { logs: { months: l.months, bytes: l.bytes } });
    });
  },
  revokeDevice(user, id) {
    const d = this._ownDevice(user, id);
    if (!d.revoked_at) { this.db.prepare('UPDATE devices SET revoked_at = ? WHERE id = ?').run(this.now(), d.id); this._audit(d.id, 'revoked'); }
    return { device: view(this.db.prepare('SELECT * FROM devices WHERE id = ?').get(d.id)) };
  },
  deviceAudit(user, id, limit = 50) {
    const d = this._ownDevice(user, id);
    const n = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
    return { audit: this.db.prepare('SELECT at, action, detail FROM device_audit WHERE device_id = ? ORDER BY id DESC LIMIT ?').all(d.id, n) };
  },
  deviceLogMonths(user, id) {
    const d = this._ownDevice(user, id);
    return { logs: this.db.prepare('SELECT month, length(body) AS size, updated_at AS updatedAt FROM device_logs WHERE device_id = ? ORDER BY month').all(d.id) };
  },
  readDeviceLog(user, id, month) {
    const d = this._ownDevice(user, id);
    if (!MONTH_RE.test(String(month))) fail(400, 'bad_month', 'Month looks like 2026-10.');
    const r = this.db.prepare('SELECT body FROM device_logs WHERE device_id = ? AND month = ?').get(d.id, month);
    if (!r) fail(404, 'not_found', 'No log for that month.');
    return { month, body: Buffer.from(r.body) };
  },
  deleteDeviceLogs(user, id, month) {
    const d = this._ownDevice(user, id);
    if (month !== undefined && month !== null && !MONTH_RE.test(String(month))) fail(400, 'bad_month', 'Month looks like 2026-10.');
    const r = month ? this.db.prepare('DELETE FROM device_logs WHERE device_id = ? AND month = ?').run(d.id, month) : this.db.prepare('DELETE FROM device_logs WHERE device_id = ?').run(d.id);
    this._audit(d.id, 'logs_deleted', month ? String(month) : 'all');
    return { deleted: Number(r.changes) };
  },

  // ---------- the device's side ----------
  // The device for a bearer token, or a refusal. Wrong, malformed, unknown and revoked tokens all get the same answer (401 device_token),
  // so nothing tells a guesser which part was close. Wrong tokens count against the caller's address (20 per 10 minutes, then 429 even
  // for a good token from that address); a good token is limited too (120 requests per 10 minutes).
  deviceAuth(token, ip = '') {
    const lim = this._limiters();
    const blocked = lim.bad.wait('ip:' + ip);
    if (blocked) tooMany(blocked);
    const d = typeof token === 'string' && TOKEN_RE.test(token) ? this.db.prepare('SELECT * FROM devices WHERE token_hash = ?').get(sha256(token)) : null;
    if (!d || d.revoked_at) {
      if (d) this._audit(d.id, 'rejected', 'revoked token');
      lim.bad.hit('ip:' + ip);
      fail(401, 'device_token', 'This device is not paired, or its token was revoked. Add the device again in the Studio.');
    }
    const secs = lim.use.hit(d.id);
    if (secs) tooMany(secs);
    this.db.prepare('UPDATE devices SET last_used_at = ? WHERE id = ?').run(this.now(), d.id);
    return d;
  },
  deviceInfo(device) {
    return { device: { id: device.id, name: device.name, scope: device.scope }, limits: { chunk: LIMITS.chunk, month: LIMITS.month }, logs: this.db.prepare('SELECT month, length(body) AS size FROM device_logs WHERE device_id = ? ORDER BY month').all(device.id) };
  },
  // Appends `bytes` to the month's log at `offset`. The offset must be exactly what the server holds, so a repeated or out-of-order
  // chunk can never duplicate or reorder lines: a mismatch answers 409 with the size the server has, and the device carries on from there.
  appendDeviceLog(device, month, offset, bytes) {
    if (!MONTH_RE.test(String(month))) fail(400, 'bad_month', 'Month looks like 2026-10.');
    if (!Number.isSafeInteger(offset) || offset < 0) fail(400, 'bad_offset', 'X-Offset must be a whole number of bytes, 0 or more.');
    if (!Buffer.isBuffer(bytes) || !bytes.length) fail(400, 'empty', 'Nothing to store.');
    if (bytes.length > LIMITS.chunk) fail(413, 'too_large', `At most ${LIMITS.chunk} bytes per request.`);
    if (bytes.includes(0)) fail(415, 'not_text', 'A check-in log is text.');
    return tx(this.db, () => {
      const cur = this.db.prepare('SELECT length(body) AS n FROM device_logs WHERE device_id = ? AND month = ?').get(device.id, month);
      const size = cur ? cur.n : 0;
      if (offset !== size) fail(409, 'offset_mismatch', `The Studio holds ${size} bytes of ${month}, not ${offset}.`, { size });
      if (size + bytes.length > LIMITS.month) fail(413, 'month_full', 'That month is larger than the Studio keeps.');
      const all = this.db.prepare('SELECT COUNT(*) AS months, COALESCE(SUM(length(body)), 0) AS bytes FROM device_logs WHERE device_id = ?').get(device.id);
      if (!cur && all.months >= LIMITS.months) fail(413, 'too_many_months', `The Studio keeps ${LIMITS.months} months per device.`);
      if (all.bytes + bytes.length > LIMITS.device) fail(413, 'device_full', "This device has reached the Studio's storage limit. Delete old logs in the Studio.");
      if (cur) this.db.prepare('UPDATE device_logs SET body = body || ?, updated_at = ? WHERE device_id = ? AND month = ?').run(bytes, this.now(), device.id, month);
      else this.db.prepare('INSERT INTO device_logs (device_id, month, body, updated_at) VALUES (?, ?, ?, ?)').run(device.id, month, bytes, this.now());
      this._audit(device.id, 'upload', `${month} +${bytes.length}`);
      return { month, size: size + bytes.length };
    });
  },
};

// A host name with an optional port, as the X4 takes it in sync.txt (the same check runs on the device).
export function serverOk(s) {
  return typeof s === 'string' && s.length <= 80 && /^[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?(:[0-9]{1,5})?$/.test(s) && !/\.\./.test(s);
}

// The text of the device's /kw-update/sync.txt. The X4 keeps it on its card; `studio-ca.pem` (the server's root certificate) goes beside it.
export function syncFile(server, token) {
  const host = typeof server === 'string' && server.trim() ? server.trim() : 'studio.example.com';
  return [
    '# KEEPING WATCH STUDIO SYNC. THIS FILE HOLDS A SECRET TOKEN: DO NOT SHARE THE CARD OR THE FILE.',
    "# Put it in the card's kw-update folder with studio-ca.pem (the root certificate of your Studio server).",
    '# Anyone with the token can add check-in logs to your Studio account until you revoke the device there.',
    `server=${host}`,
    `token=${token}`,
    'log=0',
    '',
  ].join('\n');
}
