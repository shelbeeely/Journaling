// What a snapshot may contain: the allowlist serializer and the forbidden-content scanner.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { serializeSnapshot, scanForbidden, emptySnapshot, toObjects, treeHashOf } from '../src/snapshot.mjs';
import { publishableProfile, snapshotFromJournal } from '../src/pipeline.mjs';
import { StudioError } from '../src/db.mjs';
import { JOURNAL, sampleJournalDir, withBlock } from './helpers.mjs';

const rejects = (fn, code = 'forbidden_content') => assert.throws(fn, (e) => e instanceof StudioError && e.status === 422 && e.code === code, `expected ${code}`);
const base = () => emptySnapshot('Sample');

test('the default snapshot is valid and the scanner finds nothing in it', () => {
  const s = serializeSnapshot({}, base());
  assert.deepEqual(scanForbidden(s), []);
  assert.equal(s.book.default[0].id, 'title');
  assert.equal(s.day.blocks.length, 10);
});

test('forbidden keys are rejected at any depth, whatever the spelling', () => {
  for (const [where, key] of [['meta', 'password'], ['print', 'ICS_URLS'], ['print', 'apiKey'], ['meta', 'recovery-codes'], ['meta', 'person'], ['print', 'location'], ['meta', 'calendars']]) {
    rejects(() => serializeSnapshot({ [where]: { ...base()[where], [key]: 'x' } }, base()));
  }
  const day = base().day; day.blocks[0].labels = [{ token: 'nope' }];
  rejects(() => serializeSnapshot({ day }, base()));
  const book = base().book; book.default[0].options = { deeply: { nested: { secret: 1 } } };
  rejects(() => serializeSnapshot({ book }, base()));
});

test('private packs, filled-in data and account settings are rejected as keys', () => {
  for (const key of ['support', 'clinic', 'trans', 'profile', 'account', 'settings', 'entries', 'answers', 'filled_in', 'events', 'private_pages', 'crisis']) {
    rejects(() => serializeSnapshot({ meta: { ...base().meta, [key]: {} } }, base()));
  }
});

test('forbidden values are rejected: calendar data, .ics paths, private/ paths, tokens, keys, email addresses', () => {
  const bad = ['BEGIN:VCALENDAR\nBEGIN:VEVENT', 'https://example.com/cal/abc.ics', 'webcal://example.com/x', 'journal/private/main.ics', 'private/notes.txt', 'content/support.json', 'content/clinic.json',
    'ghp_abcdefghijklmnopqrstuvwxyz0123456789', 'github_pat_11ABCDEFG0abcdefghijklmnopqrst', '-----BEGIN PRIVATE KEY-----', 'sam@example.com', 'content/profile.json'];
  for (const v of bad) rejects(() => serializeSnapshot({ meta: { ...base().meta, description: v } }, base()));
  const day = base().day; day.blocks.find((b) => b.type === 'sky').label = 'x';
  const withText = withBlock(base().day, 'checks', { title: 'Call sam@example.com' });
  rejects(() => serializeSnapshot({ day: withText }, base()));
});

test('the scanner reports where the problem is', () => {
  const found = scanForbidden({ day: { blocks: [{ a: 1 }, { labels: ['fine', 'mail me@home.org'] }] }, print: { ics: 1 } });
  assert.deepEqual(found.map((f) => f.path).sort(), ['day.blocks[1].labels[1]', 'print.ics']);
});

test('assets: a calendar, a private path or a non-image type cannot be listed', () => {
  const h = 'a'.repeat(64);
  for (const a of [{ name: 'main.ics', hash: h, mime: 'image/png', size: 1 }, { name: 'private.png', hash: h, mime: 'text/calendar', size: 1 }, { name: 'notes.txt', hash: h, mime: 'text/plain', size: 1 }]) {
    assert.throws(() => serializeSnapshot({ assets: [a] }, base()), StudioError);
  }
  const ok = serializeSnapshot({ assets: [{ name: 'logo.png', hash: h, mime: 'image/png', size: 10 }] }, base());
  assert.equal(ok.assets.length, 1);
});

test('unknown top-level parts, unknown meta or print fields and invalid values are rejected with plain messages', () => {
  rejects(() => serializeSnapshot({ pages: [] }, base()), 'invalid_snapshot');
  rejects(() => serializeSnapshot({ meta: { ...base().meta, mood: 'ok' } }, base()), 'invalid_snapshot');
  rejects(() => serializeSnapshot({ print: { ...base().print, trim: 'a5' } }, base()), 'invalid_snapshot');
  rejects(() => serializeSnapshot({ print: { ...base().print, edition: 12 } }, base()), 'invalid_snapshot');
  const book = base().book; book.default.push({ id: 'title', type: 'title' });
  rejects(() => serializeSnapshot({ book }, base()), 'invalid_snapshot');
});

test('the serializer copies only allowlisted block fields', () => {
  const day = withBlock(base().day, 'checks', { title: 'Habits', junk: 'x', more: { a: 1 } });
  const s = serializeSnapshot({ day }, base());
  const b = s.day.blocks.find((x) => x.uid === 'checks-t1');
  assert.equal(b.title, 'Habits');
  assert.equal('junk' in b, false);
  assert.equal('more' in b, false);
  const care = s.day.blocks.find((x) => x.type === 'care');
  assert.ok(care.rows.length > 3 && care.rows.every((r) => 'id' in r && 'on' in r));
});

test('the profile: only the publishable fields cross; person, place, crisis lines and paths never do', () => {
  const profile = JSON.parse(fs.readFileSync(path.join(JOURNAL, 'content/profile.example.json'), 'utf8'));
  const safe = publishableProfile(profile);
  const text = JSON.stringify(safe);
  assert.ok(safe.meta.title && safe.print.trim);
  for (const secret of [profile.person.name, profile.location.place, String(profile.location.lat), profile.location.timezone]) assert.ok(!text.includes(secret), `${secret} leaked`);
  for (const k of ['person', 'location', 'crisis', 'paths', 'transit']) assert.ok(!(k in safe.meta) && !(k in safe.print), k);
  const dir = sampleJournalDir();
  const snap = snapshotFromJournal(dir);
  assert.deepEqual(scanForbidden(snap), []);
  assert.ok(!JSON.stringify(snap).includes(profile.person.name));
});

test('hashing: the same content gives the same tree hash whatever the key order; a change gives a new one', () => {
  const a = base(), b = base();
  b.meta = { description: '', slug: a.meta.slug, subtitle: '', title: a.meta.title }; // reordered keys
  assert.equal(treeHashOf(a), treeHashOf(b));
  const c = serializeSnapshot({ meta: { ...a.meta, title: 'Changed' } }, a);
  assert.notEqual(treeHashOf(a), treeHashOf(c));
  // parts are shared: changing only the title leaves the book object identical
  const oa = toObjects(a).objects.find((o) => o.kind === 'book'), oc = toObjects(c).objects.find((o) => o.kind === 'book');
  assert.equal(oa.hash, oc.hash);
});
