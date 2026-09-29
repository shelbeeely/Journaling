// Local accounts. Passwords: scrypt with a random salt per user. Sessions: random bearer tokens, stored only as their sha256.
// No third-party service. Login failures are throttled per username (in memory: a restart clears it).
import crypto from 'node:crypto';
import { fail } from './db.mjs';
import { sha256 } from './canon.mjs';

const N = 16384, R = 8, P = 1, KEYLEN = 64;
const SESSION_DAYS = 30;

export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const h = crypto.scryptSync(password, salt, KEYLEN, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${h.toString('base64')}`;
}
export function verifyPassword(password, stored) {
  const [alg, n, r, p, salt, hash] = String(stored).split('$');
  if (alg !== 'scrypt') return false;
  const want = Buffer.from(hash, 'base64');
  const got = crypto.scryptSync(password, Buffer.from(salt, 'base64'), want.length, { N: +n, r: +r, p: +p });
  return want.length === got.length && crypto.timingSafeEqual(want, got);
}
const DUMMY = hashPassword('not-a-real-password'); // so an unknown username costs the same time as a wrong password

const fails = new Map(); // username -> {n, until}
const LOCK_AFTER = 8, LOCK_MS = 60_000;

export class Auth {
  constructor(db, now) { this.db = db; this.now = now; }

  register({ username, password, displayName }) {
    if (typeof username !== 'string' || !/^[a-z0-9][a-z0-9_-]{2,31}$/i.test(username)) fail(422, 'invalid_username', 'Username: 3 to 32 letters, digits, dashes or underscores.');
    if (typeof password !== 'string' || password.length < 10 || password.length > 200) fail(422, 'weak_password', 'Password: at least 10 characters.');
    const name = typeof displayName === 'string' && displayName.trim() ? displayName.trim().slice(0, 60) : username;
    if (this.db.prepare('SELECT 1 FROM users WHERE username = ?').get(username)) fail(409, 'username_taken', 'That username is taken.');
    const id = crypto.randomUUID();
    this.db.prepare('INSERT INTO users (id, username, display_name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)').run(id, username, name, hashPassword(password), this.now());
    return { id, username, displayName: name };
  }

  login({ username, password }) {
    const key = String(username).toLowerCase();
    const f = fails.get(key);
    if (f && f.until > Date.now()) fail(429, 'too_many_attempts', 'Too many failed sign-ins. Wait a minute and try again.');
    const u = typeof username === 'string' && typeof password === 'string' ? this.db.prepare('SELECT * FROM users WHERE username = ?').get(username) : null;
    const ok = verifyPassword(typeof password === 'string' ? password : '', u ? u.password_hash : DUMMY) && !!u;
    if (!ok) {
      const n = (f ? f.n : 0) + 1;
      fails.set(key, n >= LOCK_AFTER ? { n: 0, until: Date.now() + LOCK_MS } : { n, until: 0 });
      fail(401, 'bad_credentials', 'Wrong username or password.');
    }
    fails.delete(key);
    const token = crypto.randomBytes(32).toString('base64url');
    const t = new Date(this.now());
    this.db.prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at, last_used_at) VALUES (?, ?, ?, ?, ?)')
      .run(sha256(token), u.id, t.toISOString(), new Date(t.getTime() + SESSION_DAYS * 86400_000).toISOString(), t.toISOString());
    return { token, user: { id: u.id, username: u.username, displayName: u.display_name } };
  }

  logout(token) { if (token) this.db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token)); }

  // The signed-in user for a bearer token, or null.
  userFor(token) {
    if (!token) return null;
    const row = this.db.prepare('SELECT u.id, u.username, u.display_name, s.expires_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?').get(sha256(token));
    if (!row) return null;
    if (row.expires_at < this.now()) { this.logout(token); return null; }
    return { id: row.id, username: row.username, displayName: row.display_name };
  }
}
