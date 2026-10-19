// Remembered choices (BUILD-PLAN section 26): "start the next book the way the last one went". Studio methods (installed on Studio.prototype by repo.mjs).
// One key today, `startFrom`. The value is cleaned by the editor's own cleaner (journal/presets.mjs cleanLast) before it is stored, so only choices
// are kept: never a title, a calendar, a profile field, a pack or a page. It belongs to the account and is never in a snapshot, a fork or an export.
import { fail } from './db.mjs';
import { cleanLast } from '../../journal/presets.mjs';

export const PREF_KEYS = ['startFrom'];
const keyOk = (k) => PREF_KEYS.includes(k);

export const prefs = {
  getPref(user, key) {
    if (!user) fail(401, 'login_required', 'Sign in first.');
    if (!keyOk(key)) fail(404, 'not_found', 'No such setting.');
    const r = this.db.prepare('SELECT value, updated_at FROM user_prefs WHERE user_id = ? AND key = ?').get(user.id, key);
    return { key, value: r ? JSON.parse(r.value) : null, updatedAt: r ? r.updated_at : null };
  },
  setPref(user, key, body) {
    if (!user) fail(401, 'login_required', 'Sign in first.');
    if (!keyOk(key)) fail(404, 'not_found', 'No such setting.');
    const v = cleanLast(body && body.value);
    if (!v) fail(422, 'invalid_value', 'That is not a remembered start: it needs {"v": 1, "answers": {...}} and nothing else is kept.');
    const at = this.now();
    this.db.prepare('INSERT INTO user_prefs (user_id, key, value, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT (user_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at').run(user.id, key, JSON.stringify(v), at);
    return { key, value: v, updatedAt: at };
  },
  deletePref(user, key) {
    if (!user) fail(401, 'login_required', 'Sign in first.');
    if (!keyOk(key)) fail(404, 'not_found', 'No such setting.');
    this.db.prepare('DELETE FROM user_prefs WHERE user_id = ? AND key = ?').run(user.id, key);
    return { key, value: null };
  },
};
