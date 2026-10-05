// Content packs and the publication source: a snapshot carries public packs by reference (id, kind, version, hash) and never a
// personal pack (support numbers, personal contacts), by name, by path or by content. Forks and proposals use the same rule.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { serializeSnapshot, scanForbidden, emptySnapshot, treeHashOf } from '../src/snapshot.mjs';
import { diffSnapshots } from '../src/diff.mjs';
import { assertPublishable } from '../src/collab.mjs';
import { StudioError } from '../src/db.mjs';
import { loadPack } from '../../journal/packs/pack.mjs';
import { JOURNAL } from './helpers.mjs';

const rejects = (fn, code = 'forbidden_content') => assert.throws(fn, (e) => e instanceof StudioError && e.status === 422 && e.code === code, `expected ${code}`);
const base = () => emptySnapshot('Sample');
const ref = (folder) => { const p = loadPack(path.join(JOURNAL, 'packs', folder)); return { id: p.id, kind: p.kind, version: p.manifest.version, sha256: p.hash }; };
const publicRef = () => ({ ...ref('_template/holidays') });
const withPacks = (packs) => ({ meta: { ...base().meta, packs } });

test('a public pack travels as a reference: id, kind, version and hash', () => {
  const r = publicRef();
  assert.equal(r.kind, 'holidays');
  const s = serializeSnapshot(withPacks([r]), base());
  assert.deepEqual(s.meta.packs, [r]);
  assert.deepEqual(scanForbidden(s), []);
  assert.doesNotThrow(() => assertPublishable(s, 'the project'), 'public references do not block a fork or a proposal');
});

test('the snapshot without packs is unchanged (additive, like the library)', () => {
  const plain = serializeSnapshot({}, base());
  assert.equal('packs' in plain.meta, false);
  const again = serializeSnapshot({ meta: { ...plain.meta, packs: [] } }, base());
  assert.equal(treeHashOf(again), treeHashOf(plain), 'an empty list is the same snapshot');
  assert.notEqual(treeHashOf(serializeSnapshot(withPacks([publicRef()]), base())), treeHashOf(plain), 'a pack reference changes the hash');
});

test('personal packs are refused, even as a reference: support, trans, clinic, and regions that bundle them', () => {
  for (const kind of ['support', 'trans-support', 'clinic', 'region']) {
    const r = { id: 'mine', kind, version: '1.0.0', sha256: 'a'.repeat(64) };
    rejects(() => serializeSnapshot(withPacks([r]), base()));
    assert.ok(scanForbidden(withPacks([r])).some((f) => /personal .* pack: personal packs never travel/.test(f.rule)), `${kind}: the scanner says why`);
  }
  // the packs this repo really has: Shelbee's and the generic one are both regions, so neither travels
  for (const folder of ['spokane-wa', 'generic']) rejects(() => serializeSnapshot(withPacks([ref(folder)]), base()));
});

test('a pack\'s contents never travel: extra keys, manifests, folders and files are refused', () => {
  const r = publicRef();
  rejects(() => serializeSnapshot(withPacks([{ ...r, files: [{ path: 'holidays.json', sha256: 'a'.repeat(64) }] }]), base()));
  rejects(() => serializeSnapshot(withPacks([{ ...r, data: { observances: [] } }]), base()));
  rejects(() => serializeSnapshot({ meta: { ...base().meta, description: 'journal/packs/spokane-wa/support.json' } }, base()));
  rejects(() => serializeSnapshot({ meta: { ...base().meta, description: 'packs/my-pack/pack.json' } }, base()));
  rejects(() => serializeSnapshot({ meta: { ...base().meta, description: 'pack.json' } }, base()));
  // a packs list anywhere but meta is still the forbidden key
  rejects(() => serializeSnapshot({ print: { ...base().print, packs: [publicRef()] } }, base()));
  rejects(() => serializeSnapshot({ day: { ...base().day, packs: [] } }, base()));
  rejects(() => serializeSnapshot({ meta: { ...base().meta, pack: 'spokane-wa' } }, base()));
  rejects(() => serializeSnapshot({ meta: { ...base().meta, supportPack: {} } }, base()));
});

test('references are checked: a known public kind, semver, sha256, unique ids, at most 100', () => {
  const r = publicRef();
  const bad = (o, code = 'invalid_snapshot') => rejects(() => serializeSnapshot(withPacks([{ ...r, ...o }]), base()), code);
  bad({ kind: 'glitter' });
  bad({ version: '1.0' });
  bad({ sha256: 'xyz' });
  bad({ id: 'Bad Id' });
  rejects(() => serializeSnapshot(withPacks([r, r]), base()), 'invalid_snapshot');
  rejects(() => serializeSnapshot(withPacks('holidays'), base()), 'forbidden_content');
  rejects(() => serializeSnapshot(withPacks([{ ...r, id: 'x' }, 7]), base()), 'forbidden_content');
  const many = Array.from({ length: 101 }, (_, i) => ({ ...r, id: `p${i}` }));
  rejects(() => serializeSnapshot(withPacks(many), base()), 'invalid_snapshot');
});

test('a snapshot that keeps its packs when a client saves without them (null drops them)', () => {
  const s0 = serializeSnapshot(withPacks([publicRef()]), base());
  const s1 = serializeSnapshot({ meta: { title: 'Renamed', subtitle: '', slug: 'sample', description: '' } }, s0);
  assert.equal(s1.meta.packs.length, 1, 'older clients never erase the references by saving');
  const s2 = serializeSnapshot({ meta: { ...s1.meta, packs: null } }, s0);
  assert.equal('packs' in s2.meta, false);
});

test('the diff lists pack changes by id', () => {
  const a = serializeSnapshot(withPacks([publicRef()]), base());
  const b = serializeSnapshot(withPacks([{ ...publicRef(), version: '1.1.0', sha256: 'b'.repeat(64) }]), base());
  const d = diffSnapshots(a, b);
  assert.equal(d.packs.changed.length, 1);
  assert.equal(d.packs.changed[0].id, 'my-holidays');
  const none = diffSnapshots(serializeSnapshot({}, base()), a);
  assert.equal(none.packs.added.length, 1);
  assert.equal(diffSnapshots(a, a).packs, undefined, 'nothing to say when nothing changed');
});
