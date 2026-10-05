// G2 against the core (no HTTP unless said): forks, attribution, forbidden content, proposals, reviews, merges, conflicts, accepting
// selected changes, concurrency, and who may do what. Sample data only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fresh, project, serve, PASSWORD } from './helpers.mjs';
import { StudioError } from '../src/db.mjs';
import { canonical, objectHash, sha256 } from '../src/canon.mjs';
import { scanForbidden, toObjects, emptySnapshot } from '../src/snapshot.mjs';
import { newBlock } from '../../journal/daypage.mjs';

const err = (fn) => { try { fn(); } catch (e) { assert.ok(e instanceof StudioError, String(e)); return e; } assert.fail('expected an error'); };
const status = (fn, s, code) => { const e = err(fn); assert.equal(e.status, s, `${e.code}: ${e.message}`); if (code) assert.equal(e.code, code); return e; };
const blk = (s, uid) => s.day.blocks.find((b) => b.uid === uid);
const checks = (uid, title) => newBlock('checks', { title, labels: ['A'] }, uid);

// A public, reusable project by `ana`, a fork of it by `bo`, and a helper to save on a branch.
function world(over = {}) {
  const t = fresh(), { studio } = t;
  const ana = t.user('anna'), bo = t.user('bobo'), cy = t.user('cyrus'), dee = t.user('deedee');
  const up = studio.createProject(ana, { name: 'Sample Journal', description: 'A calm planner', visibility: 'public', allowReuse: true, license: 'CC BY 4.0', credit: 'Ana Sample', ...over });
  const save = (who, pid, branch, message, patch) => {
    const h = studio.head(who, pid, branch), snap = typeof patch === 'function' ? patch(structuredClone(h.snapshot)) : patch;
    return studio.commit(who, pid, { branch, expectedHead: h.commit.id, message, snapshot: snap }).commit;
  };
  const fork = studio.fork(bo, up.id, { name: 'Bo’s copy' });
  const heads = (fp = fork.id) => ({ ours: studio.head(ana, up.id).commit.id, theirs: studio.head(bo, fp).commit.id });
  return { ...t, ana, bo, cy, dee, up, fork, save, heads };
}

// ---------- forks ----------
test('fork: only when the creator set allowReuse (owner included), and only when the project is readable', () => {
  const t = fresh(), { studio } = t, ana = t.user('anna'), bo = t.user('bobo'), cy = t.user('cyrus');
  const closed = project(studio, ana, { visibility: 'public' }), priv = project(studio, ana, { name: 'Private one', allowReuse: true });
  status(() => studio.fork(bo, closed.id), 403, 'reuse_not_allowed');
  status(() => studio.fork(ana, closed.id), 403, 'reuse_not_allowed');
  status(() => studio.fork(null, closed.id), 401);
  status(() => studio.fork(bo, priv.id), 404); // a private project does not exist for non-members
  status(() => studio.fork(bo, 'not-a-project'), 404);
  studio.updateProject(ana, closed.id, { allowReuse: true });
  assert.equal(studio.fork(bo, closed.id).role, 'owner');
  // a member of a private project (even a viewer) may fork it when reuse is on
  studio.setMember(ana, priv.id, 'cyrus', 'viewer');
  const f = studio.fork(cy, priv.id, { name: 'Cy fork' });
  assert.equal(f.visibility, 'private');
  status(() => studio.fork(bo, closed.id, { name: 'x'.repeat(200) }), 422);
  status(() => studio.fork(bo, closed.id, { visibility: 'secret' }), 422);
  // the creator turns reuse off again: no new forks
  studio.updateProject(ana, closed.id, { allowReuse: false });
  status(() => studio.fork(cy, closed.id), 403, 'reuse_not_allowed');
});
test('fork: records source project and commit, keeps attribution, has independent history, branches and members', () => {
  const { studio, ana, bo, cy, up, fork, save } = world();
  assert.deepEqual(fork.source, { project: up.id, commit: studio.head(ana, up.id).commit.id });
  assert.equal(fork.role, 'owner'); assert.equal(fork.visibility, 'private'); assert.equal(fork.allowReuse, false);
  const a = fork.attribution;
  assert.equal(a.source.name, 'Sample Journal'); assert.equal(a.source.project, up.id);
  assert.equal(a.creator.name, 'Anna'); assert.equal(a.license, 'CC BY 4.0'); assert.equal(a.credit, 'Ana Sample');
  assert.deepEqual(a.authors.map((x) => x.name), ['Anna']); assert.deepEqual(a.lineage, []);
  assert.equal(fork.license, 'CC BY 4.0');
  // same content, shared history (same commit ids), then independent
  const f0 = studio.head(bo, fork.id), u0 = studio.head(ana, up.id);
  assert.equal(f0.commit.id, u0.commit.id);
  const c1 = save(bo, fork.id, 'main', 'Bo edits', (s) => { blk(s, 'actions').count = 5; return s; });
  assert.equal(studio.head(ana, up.id).snapshot.day.blocks.find((b) => b.uid === 'actions').count, 3, 'the source is untouched');
  assert.equal(studio.log(ana, up.id, {}).total, 1); assert.equal(studio.log(bo, fork.id, {}).total, 2);
  status(() => studio.getCommit(ana, up.id, c1.id), 404); // the fork's commit is not in the source
  studio.createBranch(bo, fork.id, { name: 'try-purple' });
  assert.deepEqual(studio.listBranches(bo, fork.id).map((b) => b.name), ['main', 'try-purple']);
  assert.deepEqual(studio.listBranches(ana, up.id).map((b) => b.name), ['main']);
  // members and drafts are the fork's own
  assert.deepEqual(studio.listMembers(bo, fork.id).map((m) => m.username), ['bobo']);
  status(() => studio.getProject(ana, fork.id), 404, 'not_found'); // a private fork is invisible to the source's owner
  studio.saveDraft(ana, up.id, 'main', { rev: 0, snapshot: { meta: { ...studio.head(ana, up.id).snapshot.meta, description: 'ana draft' } } });
  assert.equal(studio.getDraft(bo, fork.id, 'main').draft, null, 'the source’s drafts never cross');
  // attribution cannot be edited, and survives changes to the fork's own terms
  const changed = studio.updateProject(bo, fork.id, { name: 'Renamed', license: 'Mine', credit: 'Bo', visibility: 'public', attribution: { creator: 'me' } });
  assert.equal(changed.name, 'Renamed'); assert.equal(changed.license, 'Mine');
  assert.deepEqual(changed.attribution, a);
  assert.deepEqual(studio.getProject(cy, fork.id).attribution, a);
  // the source lists its public forks
  assert.deepEqual(studio.listForks(cy, up.id).map((f) => f.name), ['Renamed']);
  assert.deepEqual(studio.listForks(ana, up.id).map((f) => f.name), ['Renamed']);
});
test('fork of a fork keeps the whole lineage; forking at an older version works; only the published line can be forked', () => {
  const { studio, ana, bo, cy, dee, up, fork, save } = world();
  studio.updateProject(bo, fork.id, { allowReuse: true, visibility: 'public' });
  save(bo, fork.id, 'main', 'Bo change', (s) => { s.meta.subtitle = 'Bo'; return s; });
  const f2 = studio.fork(cy, fork.id, { name: 'Cy’s' });
  assert.equal(f2.attribution.creator.name, 'Bobo'); assert.equal(f2.attribution.lineage.length, 1); assert.equal(f2.attribution.lineage[0].creator, 'Anna');
  assert.deepEqual(f2.attribution.authors.map((x) => x.name).sort(), ['Anna', 'Bobo']);
  // an older version
  const first = studio.log(ana, up.id, {}).commits[0].id;
  save(ana, up.id, 'main', 'Second', (s) => { s.meta.title = 'Second'; return s; });
  const old = studio.fork(dee, up.id, { commit: first });
  assert.equal(studio.head(dee, old.id).commit.id, first); assert.equal(old.source.commit, first);
  // a commit that is not on the published line (main) cannot be forked
  studio.createBranch(ana, up.id, { name: 'wip' });
  const wip = save(ana, up.id, 'wip', 'Not ready', (s) => { s.meta.title = 'WIP'; return s; });
  status(() => studio.fork(dee, up.id, { commit: wip.id }), 403, 'not_published');
  status(() => studio.fork(dee, up.id, { commit: 'deadbeefdeadbeef' }), 404);
});
test('fork: private content never crosses, even when the source project’s other branch (or history) holds some', () => {
  const { studio, db, ana, bo, up } = world();
  // Plant what the serializer would never store, directly in the database: a private branch with personal data in it.
  const plant = (body, message, parents, kind = 'meta') => {
    const snap = studio.head(ana, up.id).snapshot;
    const s2 = structuredClone(snap); s2.day.blocks[0].person = { name: 'Real Name' }; s2.day.blocks[1].note = 'call me at me@example.com';
    const { objects, tree } = toObjects(snap);
    const dayBody = canonical(s2.day), dayHash = objectHash('day', s2.day);
    db.prepare('INSERT OR IGNORE INTO objects (hash, kind, body, size) VALUES (?, ?, ?, ?)').run(dayHash, 'day', dayBody, dayBody.length);
    const parts = { ...JSON.parse(objects.find((o) => o.kind === 'tree').body).parts, day: dayHash };
    const t = { format: 1, parts }, tb = canonical(t), th = objectHash('tree', t);
    db.prepare('INSERT OR IGNORE INTO objects (hash, kind, body, size) VALUES (?, ?, ?, ?)').run(th, 'tree', tb, tb.length);
    const id = sha256('planted' + message);
    db.prepare('INSERT INTO commits (id, tree, parents, author_id, author_name, message, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(id, th, canonical(parents), ana.id, 'Anna', message, '2026-10-02T00:00:00.000Z');
    db.prepare('INSERT INTO project_commits (project_id, commit_id) VALUES (?, ?)').run(up.id, id);
    return id;
  };
  const head = studio.head(ana, up.id).commit.id;
  const bad = plant('x', 'Private notes branch', [head]);
  db.prepare('INSERT INTO branches (project_id, name, head_commit_id, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(up.id, 'private-notes', bad, ana.id, 'x', 'x');
  // sanity: the planted snapshot really is forbidden
  assert.ok(scanForbidden(studio.getCommit(ana, up.id, bad).snapshot).length >= 2);
  const f = studio.fork(bo, up.id, { name: 'Clean fork' });
  const held = db.prepare('SELECT commit_id FROM project_commits WHERE project_id = ?').all(f.id).map((r) => r.commit_id);
  assert.ok(!held.includes(bad), 'the private branch’s commit is not in the fork');
  assert.deepEqual(studio.listBranches(bo, f.id).map((b) => b.name), ['main']);
  status(() => studio.getCommit(bo, f.id, bad), 404);
  status(() => studio.getCommit(bo, f.id, 'private-notes'), 404);
  status(() => studio.fork(bo, up.id, { commit: bad }), 403, 'not_published');
  for (const id of held) assert.deepEqual(scanForbidden(studio.readSnapshot(db.prepare('SELECT tree FROM commits WHERE id = ?').get(id).tree)), [], 'every version in the fork is clean');
  // a proposal cannot smuggle it in either: the private branch can only be proposed from a project you can edit, and it is scanned
  const fp = studio.head(bo, f.id).commit.id;
  assert.equal(fp, head);
  // now the published line itself carries planted content: the fork is refused outright and nothing is created
  const before = db.prepare('SELECT COUNT(*) n FROM projects').get().n;
  const bad2 = plant('y', 'Planted in main', [head]);
  db.prepare('UPDATE branches SET head_commit_id = ? WHERE project_id = ? AND name = ?').run(bad2, up.id, 'main');
  const e = status(() => studio.fork(bo, up.id, { name: 'Should not exist' }), 422, 'not_forkable');
  assert.match(e.message, /Nothing was forked|Nothing was shared/);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM projects').get().n, before, 'no fork project was created');
  // an unknown field (not on the forbidden list, but not part of the publication source either) is refused too
  const snap = studio.readSnapshot(db.prepare('SELECT tree FROM commits WHERE id = ?').get(head).tree);
  const s3 = structuredClone(snap); s3.day.blocks[2].diary = 'entry';
  const dayHash = objectHash('day', s3.day); db.prepare('INSERT OR IGNORE INTO objects (hash, kind, body, size) VALUES (?, ?, ?, ?)').run(dayHash, 'day', canonical(s3.day), 1);
  const tr = { format: 1, parts: { ...JSON.parse(db.prepare('SELECT body FROM objects WHERE hash = ?').get(db.prepare('SELECT tree FROM commits WHERE id = ?').get(head).tree).body).parts, day: dayHash } };
  db.prepare('INSERT OR IGNORE INTO objects (hash, kind, body, size) VALUES (?, ?, ?, ?)').run(objectHash('tree', tr), 'tree', canonical(tr), 1);
  const id3 = sha256('planted3'); db.prepare('INSERT INTO commits (id, tree, parents, author_id, author_name, message, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(id3, objectHash('tree', tr), canonical([head]), ana.id, 'Anna', 'Extra field', '2026-10-03T00:00:00.000Z');
  db.prepare('INSERT INTO project_commits (project_id, commit_id) VALUES (?, ?)').run(up.id, id3);
  db.prepare('UPDATE branches SET head_commit_id = ? WHERE project_id = ? AND name = ?').run(id3, up.id, 'main');
  status(() => studio.fork(bo, up.id, { name: 'Nope' }), 422, 'not_forkable');
});
test('fork: assets travel (only those the history uses), and the fork keeps working after the source is deleted', () => {
  const { studio, ana, bo, up, save } = world();
  const png = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
  const a = studio.putAsset(ana, up.id, { name: 'logo.png', mime: 'image/png', bytes: png });
  studio.putAsset(ana, up.id, { name: 'unused.png', mime: 'image/png', bytes: Buffer.concat([png, Buffer.from('zz')]) });
  save(ana, up.id, 'main', 'Add logo', (s) => { s.assets = [{ name: a.name, hash: a.hash, mime: a.mime, size: a.size }]; return s; });
  const f = studio.fork(bo, up.id, { name: 'With logo' });
  assert.deepEqual(studio.listAssets(bo, f.id).map((x) => x.name), ['logo.png']);
  assert.equal(studio.getAsset(bo, f.id, a.hash).bytes.equals(png), true);
  studio.deleteProject(ana, up.id);
  const after = studio.getProject(bo, f.id);
  assert.equal(after.attribution.source.name, 'Sample Journal'); assert.equal(after.source, null);
  assert.equal(studio.head(bo, f.id).commit.message, 'Add logo');
});

// ---------- proposals ----------
const propose = (w, extra = {}) => w.studio.createProposal(w.bo, w.up.id, { sourceProject: w.fork.id, sourceBranch: 'main', title: 'Habits and a calmer review', description: 'Two small changes', ...extra });
test('proposals: the fork owner proposes upstream; who may propose; duplicates and no-ops are refused', () => {
  const w = world(), { studio, ana, bo, cy, up, fork, save } = w;
  status(() => propose(w), 422, 'nothing_to_propose');
  save(bo, fork.id, 'main', 'Habits', (s) => { s.day.blocks.splice(1, 0, checks('habits', 'Habits')); return s; });
  const p = propose(w);
  assert.equal(p.number, 1); assert.equal(p.status, 'open'); assert.equal(p.source.branch, 'main'); assert.equal(p.target.branch, 'main'); assert.equal(p.author.name, 'Bobo');
  status(() => propose(w), 409, 'already_open');
  status(() => studio.createProposal(cy, up.id, { sourceProject: fork.id, sourceBranch: 'main', title: 'Not mine' }), 404); // cy cannot even see bo's private fork
  studio.setMember(bo, fork.id, 'cyrus', 'viewer');
  status(() => studio.createProposal(cy, up.id, { sourceProject: fork.id, sourceBranch: 'main', title: 'Viewer' }), 403);
  status(() => studio.createProposal(null, up.id, { sourceProject: fork.id, sourceBranch: 'main', title: 'Guest' }), 401);
  const other = studio.createProject(cy, { name: 'Unrelated', visibility: 'public' });
  status(() => studio.createProposal(cy, up.id, { sourceProject: other.id, sourceBranch: 'main', title: 'Not a fork' }), 422, 'not_a_fork');
  status(() => studio.createProposal(bo, up.id, { sourceProject: fork.id, sourceBranch: 'main', title: '' }), 422);
  status(() => studio.createProposal(bo, up.id, { sourceProject: fork.id, sourceBranch: 'main', title: 'mail me@example.com' }), 422, 'forbidden_content');
  status(() => studio.createProposal(bo, up.id, { sourceProject: fork.id, sourceBranch: 'nope', title: 'x' }), 404);
  // branch to branch inside the project needs editor on it
  studio.createBranch(ana, up.id, { name: 'autumn' });
  save(ana, up.id, 'autumn', 'Autumn', (s) => { s.meta.subtitle = 'Autumn'; return s; });
  status(() => studio.createProposal(bo, up.id, { sourceBranch: 'autumn', title: 'x' }), 403);
  assert.equal(studio.createProposal(ana, up.id, { sourceBranch: 'autumn', title: 'Autumn edition' }).number, 2);
  status(() => studio.createProposal(ana, up.id, { sourceBranch: 'main', targetBranch: 'main', title: 'x' }), 422, 'same_branch');
  assert.deepEqual(studio.listProposals(ana, up.id).map((x) => x.number), [2, 1]);
  assert.deepEqual(studio.listProposals(ana, up.id, { status: 'merged' }), []);
});
test('proposals: guests read public proposals and can write nothing; private projects hide theirs; who may comment, review, close', () => {
  const w = world(), { studio, ana, bo, cy, dee, up, fork, save } = w;
  save(bo, fork.id, 'main', 'Habits', (s) => { s.day.blocks.splice(1, 0, checks('habits', 'Habits')); return s; });
  const p = propose(w);
  // guests: read everything on a public project…
  assert.equal(studio.listProposals(null, up.id).length, 1);
  const g = studio.getProposal(null, up.id, p.number);
  assert.equal(g.title, p.title); assert.deepEqual(g.can, { comment: false, review: false, merge: false, close: false, reopen: false });
  assert.ok(studio.compareProposal(null, up.id, p.number).changes.length);
  // …and write nothing
  status(() => studio.commentProposal(null, up.id, p.number, { body: 'hi' }), 401);
  status(() => studio.reviewProposal(null, up.id, p.number, { state: 'approved' }), 401);
  status(() => studio.setProposalStatus(null, up.id, p.number, { status: 'closed' }), 401);
  status(() => studio.mergeProposal(null, up.id, p.number, { expectedHeads: w.heads() }), 401);
  status(() => studio.acceptChanges(null, up.id, p.number, { items: ['block:habits'], expectedHeads: w.heads() }), 401);
  status(() => studio.createProposal(null, up.id, { sourceBranch: 'main', title: 'x' }), 401);
  status(() => studio.fork(null, up.id), 401);
  // a signed-in stranger reads but cannot comment, review, close or merge
  assert.equal(studio.getProposal(dee, up.id, p.number).title, p.title);
  status(() => studio.commentProposal(dee, up.id, p.number, { body: 'hi' }), 403);
  status(() => studio.reviewProposal(dee, up.id, p.number, { state: 'comment', body: 'hi' }), 403);
  status(() => studio.setProposalStatus(dee, up.id, p.number, { status: 'closed' }), 403);
  status(() => studio.mergeProposal(dee, up.id, p.number, { expectedHeads: w.heads() }), 403);
  // a viewer member comments, cannot review or merge
  studio.setMember(ana, up.id, 'cyrus', 'viewer');
  assert.equal(studio.commentProposal(cy, up.id, p.number, { body: 'Nice' }).events.length, 1);
  status(() => studio.reviewProposal(cy, up.id, p.number, { state: 'approved' }), 403);
  status(() => studio.mergeProposal(cy, up.id, p.number, { expectedHeads: w.heads() }), 403);
  status(() => studio.acceptChanges(cy, up.id, p.number, { items: ['block:habits'], expectedHeads: w.heads() }), 403);
  status(() => studio.setProposalStatus(cy, up.id, p.number, { status: 'closed' }), 403);
  // the author comments (also without being a member of upstream), and may close and reopen their own proposal
  assert.equal(studio.commentProposal(bo, up.id, p.number, { body: 'Thanks' }).events.length, 2);
  status(() => studio.commentProposal(bo, up.id, p.number, { body: 'mail me@example.com' }), 422, 'forbidden_content');
  status(() => studio.commentProposal(bo, up.id, p.number, { body: '' }), 422);
  assert.equal(studio.setProposalStatus(bo, up.id, p.number, { status: 'closed' }).status, 'closed');
  status(() => studio.reviewProposal(ana, up.id, p.number, { state: 'approved' }), 409, 'not_open');
  status(() => studio.mergeProposal(ana, up.id, p.number, { expectedHeads: w.heads() }), 409, 'not_open');
  assert.equal(studio.setProposalStatus(bo, up.id, p.number, { status: 'open' }).status, 'open');
  // reviewers must be owners or editors of the target; an author cannot approve their own
  studio.setMember(ana, up.id, 'bobo', 'editor');
  status(() => studio.reviewProposal(bo, up.id, p.number, { state: 'approved' }), 403, 'self_approval');
  assert.equal(studio.reviewProposal(bo, up.id, p.number, { state: 'comment', body: 'self note' }).events.length, 5);
  // a private target hides its proposals from non-members entirely
  studio.updateProject(ana, up.id, { visibility: 'private' });
  status(() => studio.listProposals(dee, up.id), 404); status(() => studio.getProposal(dee, up.id, p.number), 404); status(() => studio.compareProposal(null, up.id, p.number), 404);
  assert.equal(studio.listProposals(cy, up.id).length, 1);
  // the discussion is append-only
  assert.throws(() => w.db.prepare('UPDATE proposal_events SET body = ? WHERE id = 1').run('edited'), /append-only/);
});
test('proposals: review status (changes requested blocks merging until the branch moves or a reviewer approves); approvals go stale when the branch moves', () => {
  const w = world(), { studio, ana, bo, up, fork, save } = w;
  save(bo, fork.id, 'main', 'Habits', (s) => { s.day.blocks.splice(1, 0, checks('habits', 'Habits')); return s; });
  const p = propose(w);
  status(() => studio.reviewProposal(ana, up.id, p.number, { state: 'changes_requested' }), 422); // say what to change
  assert.equal(studio.reviewProposal(ana, up.id, p.number, { state: 'changes_requested', body: 'Please add a title' }).status, 'changes_requested');
  status(() => studio.mergeProposal(ana, up.id, p.number, { expectedHeads: w.heads() }), 409, 'changes_requested');
  status(() => studio.acceptChanges(ana, up.id, p.number, { items: ['block:habits'], expectedHeads: w.heads() }), 409, 'changes_requested');
  assert.equal(studio.getProposal(ana, up.id, p.number).can.merge, false);
  // the proposer updates the branch: the review no longer applies, the proposal is open again
  save(bo, fork.id, 'main', 'Title added', (s) => { blk(s, 'habits').title = 'Little habits'; return s; });
  const again = studio.getProposal(ana, up.id, p.number);
  assert.equal(again.status, 'open'); assert.equal(again.stale, true);
  assert.equal(studio.reviewProposal(ana, up.id, p.number, { state: 'approved', body: 'Good' }).status, 'approved');
  assert.equal(studio.listProposals(ana, up.id)[0].status, 'approved');
  save(bo, fork.id, 'main', 'One more tweak', (s) => { s.meta.subtitle = 'again'; return s; });
  assert.equal(studio.getProposal(ana, up.id, p.number).status, 'open', 'an approval is for the version the reviewer saw');
  studio.reviewProposal(ana, up.id, p.number, { state: 'approved' });
  const merged = studio.mergeProposal(ana, up.id, p.number, { expectedHeads: w.heads() });
  assert.equal(merged.proposal.status, 'merged');
  assert.deepEqual(merged.proposal.events.map((e) => e.kind), ['review', 'review', 'review', 'merge']);
  status(() => studio.reviewProposal(ana, up.id, p.number, { state: 'comment', body: 'late' }), 409, 'not_open');
  assert.equal(studio.commentProposal(ana, up.id, p.number, { body: 'Thanks for this' }).status, 'merged', 'the discussion continues after a merge');
});

// ---------- merging ----------
test('merge: independent edits on both sides become a merge commit with two parents; the history and the proposal follow', () => {
  const w = world(), { studio, ana, bo, up, fork, save } = w;
  const start = studio.head(ana, up.id).commit;
  const b1 = save(bo, fork.id, 'main', 'Habits', (s) => { s.day.blocks.splice(1, 0, checks('habits', 'Habits')); blk(s, 'review').h = 4; return s; });
  const b2 = save(bo, fork.id, 'main', 'Hide fact', (s) => { blk(s, 'fact').on = false; return s; });
  const a1 = save(ana, up.id, 'main', 'Bigger action list', (s) => { blk(s, 'actions').count = 6; s.meta.subtitle = 'Autumn'; return s; });
  const p = propose(w);
  const cmp = studio.compareProposal(bo, up.id, p.number);
  assert.equal(cmp.commits.base.id, start.id, 'the merge base is the version they forked at');
  assert.equal(cmp.commits.ours.id, a1.id); assert.equal(cmp.commits.theirs.id, b2.id);
  assert.deepEqual(cmp.changes.map((c) => c.key).sort(), ['block:fact', 'block:habits', 'block:review']);
  assert.equal(cmp.merge.clean, true); assert.deepEqual(cmp.merge.conflicts, []);
  assert.ok(cmp.diff.summary.day >= 3);
  const r = studio.mergeProposal(ana, up.id, p.number, { expectedHeads: w.heads() });
  assert.equal(r.merged, true); assert.deepEqual(r.commit.parents, [a1.id, b2.id]);
  assert.match(r.commit.message, /Merge proposal #1/);
  const m = studio.head(ana, up.id);
  assert.equal(m.commit.id, r.commit.id);
  assert.equal(blk(m.snapshot, 'actions').count, 6); assert.equal(m.snapshot.meta.subtitle, 'Autumn');
  assert.ok(blk(m.snapshot, 'habits')); assert.equal(blk(m.snapshot, 'review').h, 4); assert.equal(blk(m.snapshot, 'fact').on, false);
  // upstream can now read the fork's versions; the log follows both parents; the fork is unchanged and can catch up with a fast merge
  assert.equal(studio.getCommit(ana, up.id, b1.id).commit.message, 'Habits');
  assert.deepEqual(studio.log(ana, up.id, {}).commits.map((c) => c.message).slice(0, 4), ['Merge proposal #1: Habits and a calmer review', 'Bigger action list', 'Hide fact', 'Habits']);
  assert.equal(studio.verify(ana, up.id, r.commit.id).ok, true);
  assert.equal(studio.head(bo, fork.id).commit.id, b2.id);
  const p2 = studio.getProposal(ana, up.id, p.number);
  assert.equal(p2.status, 'merged'); assert.equal(p2.mergedCommit, r.commit.id);
  assert.deepEqual(studio.compareProposal(ana, up.id, p.number).changes.map((c) => c.key).sort(), ['block:fact', 'block:habits', 'block:review'], 'a merged proposal still shows what it changed');
  status(() => studio.mergeProposal(ana, up.id, p.number, { expectedHeads: w.heads() }), 409, 'not_open');
  // after the merge the merge base is the merged-in tip: a second proposal from later work only carries the later work
  const b3 = save(bo, fork.id, 'main', 'Later', (s) => { s.meta.description = 'later'; return s; });
  const p3 = propose(w, { title: 'Later' });
  const c3 = studio.compareProposal(ana, up.id, p3.number);
  assert.equal(c3.commits.base.id, b2.id); assert.deepEqual(c3.changes.map((c) => c.key), ['meta:description']);
  assert.ok(b3);
});
test('merge: a conflict carries base/ours/theirs and nothing is written until every conflict is resolved (all or nothing)', () => {
  const w = world(), { studio, db, ana, bo, up, fork, save } = w;
  save(bo, fork.id, 'main', 'Bo', (s) => { blk(s, 'actions').count = 2; s.meta.title = 'Bo title'; blk(s, 'review').h = 5; return s; });
  save(ana, up.id, 'main', 'Anna', (s) => { blk(s, 'actions').count = 6; s.meta.title = 'Ana title'; return s; });
  const p = propose(w), commitsBefore = db.prepare('SELECT COUNT(*) n FROM commits').get().n, headBefore = studio.head(ana, up.id).commit.id;
  const cmp = studio.compareProposal(ana, up.id, p.number);
  assert.equal(cmp.merge.clean, false);
  assert.deepEqual(cmp.merge.conflicts.map((c) => [c.id, c.kind]).sort(), [['block:actions', 'edit_edit'], ['meta.title', 'edit_edit']]);
  const c = cmp.merge.conflicts.find((x) => x.id === 'block:actions');
  assert.equal(c.base.count, 3); assert.equal(c.ours.count, 6); assert.equal(c.theirs.count, 2);
  const unchanged = () => { assert.equal(studio.head(ana, up.id).commit.id, headBefore); assert.equal(db.prepare('SELECT COUNT(*) n FROM commits').get().n, commitsBefore); assert.equal(studio.getProposal(ana, up.id, p.number).status, 'open'); };
  const e = status(() => studio.mergeProposal(ana, up.id, p.number, { expectedHeads: w.heads() }), 409, 'unresolved_conflicts');
  assert.equal(e.details.conflicts.length, 2); unchanged();
  // half resolved: still nothing
  status(() => studio.mergeProposal(ana, up.id, p.number, { expectedHeads: w.heads(), resolutions: { 'meta.title': { choose: 'theirs' } } }), 409, 'unresolved_conflicts'); unchanged();
  // a bad resolution: nothing
  status(() => studio.mergeProposal(ana, up.id, p.number, { expectedHeads: w.heads(), resolutions: { 'meta.title': { choose: 'theirs' }, 'block:actions': { choose: 'manual', value: { uid: 'nope', type: 'actions' } } } }), 422, 'invalid_resolution'); unchanged();
  status(() => studio.mergeProposal(ana, up.id, p.number, { expectedHeads: w.heads(), resolutions: { 'ghost': { choose: 'ours' } } }), 422, 'unknown_resolution'); unchanged();
  status(() => studio.mergeProposal(ana, up.id, p.number, { expectedHeads: w.heads(), resolutions: { 'meta.title': { choose: 'manual', value: 'x'.repeat(300) }, 'block:actions': { choose: 'ours' } } }), 422, 'invalid_snapshot'); unchanged();
  // resolved: ours for the block, a manual value for the title, and the non-conflicting change (review h=5) merges
  const value = { ...c.ours, count: 4 };
  const r = studio.mergeProposal(ana, up.id, p.number, { expectedHeads: w.heads(), resolutions: { 'block:actions': { choose: 'manual', value }, 'meta.title': { choose: 'theirs' } } });
  assert.deepEqual(r.commit.parents.length, 2);
  const m = studio.head(ana, up.id).snapshot;
  assert.equal(blk(m, 'actions').count, 4); assert.equal(m.meta.title, 'Bo title'); assert.equal(blk(m, 'review').h, 5);
  assert.deepEqual(r.resolved.map((x) => [x.id, x.choose]).sort(), [['block:actions', 'manual'], ['meta.title', 'theirs']]);
});
test('merge: concurrency, expected heads must match both branches or nothing is merged', () => {
  const w = world(), { studio, db, ana, bo, up, fork, save } = w;
  save(bo, fork.id, 'main', 'Bo', (s) => { blk(s, 'review').h = 4; return s; });
  const p = propose(w), seen = w.heads();
  status(() => studio.mergeProposal(ana, up.id, p.number, {}), 422, 'expected_heads_required');
  status(() => studio.mergeProposal(ana, up.id, p.number, { expectedHeads: { ours: seen.ours } }), 422, 'expected_heads_required');
  save(ana, up.id, 'main', 'Someone saved upstream meanwhile', (s) => { s.meta.subtitle = 'new'; return s; });
  const e1 = status(() => studio.mergeProposal(ana, up.id, p.number, { expectedHeads: seen }), 409, 'head_moved');
  assert.equal(e1.details.ours, studio.head(ana, up.id).commit.id);
  const seen2 = w.heads();
  save(bo, fork.id, 'main', 'Bo again', (s) => { s.meta.description = 'more'; return s; });
  status(() => studio.mergeProposal(ana, up.id, p.number, { expectedHeads: seen2 }), 409, 'head_moved');
  assert.equal(db.prepare("SELECT COUNT(*) n FROM commits WHERE message LIKE 'Merge%'").get().n, 0, 'no merge commit was written');
  assert.equal(studio.mergeProposal(ana, up.id, p.number, { expectedHeads: w.heads() }).merged, true);
});
test('merge: edit/delete, reorder and component conflicts resolve through the same API', () => {
  const w = world(), { studio, ana, bo, up, fork, save } = w;
  const plain = (s) => s;
  // upstream deletes a block that the fork edited; both reorder the blocks differently; both change a component
  studio.updateProject(ana, up.id, {});
  save(ana, up.id, 'main', 'Add component', (s) => { s.components = [{ id: 'weekly', name: 'Weekly check', version: 1, page: { type: 'blank', options: {} } }]; return s; });
  const fp = studio.fork(bo, up.id, { name: 'Second fork' });
  const sv = (who, pid, msg, fn) => save(who, pid, 'main', msg, fn);
  sv(ana, up.id, 'Ana: delete review, reorder, component v2', (s) => { s.day.blocks = s.day.blocks.filter((b) => b.uid !== 'review'); s.day.blocks.reverse(); s.components[0].version = 2; return s; });
  sv(bo, fp.id, 'Bo: edit review, reorder, component v3', (s) => { blk(s, 'review').h = 4; const [x] = s.day.blocks.splice(0, 1); s.day.blocks.push(x); s.components[0].version = 3; s.components[0].name = 'Weekly'; return s; });
  const p = studio.createProposal(bo, up.id, { sourceProject: fp.id, sourceBranch: 'main', title: 'Conflicts' });
  const heads = () => ({ ours: studio.head(ana, up.id).commit.id, theirs: studio.head(bo, fp.id).commit.id });
  const cmp = studio.compareProposal(ana, up.id, p.number);
  assert.deepEqual(cmp.merge.conflicts.map((c) => [c.id, c.kind]).sort(), [['block:review', 'delete_edit'], ['component:weekly', 'component'], ['order:blocks', 'reorder']]);
  const r = studio.mergeProposal(ana, up.id, p.number, { expectedHeads: heads(), resolutions: { 'block:review': { choose: 'ours' }, 'order:blocks': { choose: 'theirs' }, 'component:weekly': { choose: 'theirs' } } });
  const m = studio.head(ana, up.id).snapshot;
  assert.ok(!m.day.blocks.some((b) => b.uid === 'review'), 'deleted, as chosen');
  assert.equal(m.day.blocks[m.day.blocks.length - 1].uid, 'sky', 'their order (sky moved to the end)');
  assert.equal(m.components[0].version, 4); assert.equal(m.components[0].name, 'Weekly');
  assert.equal(r.commit.parents.length, 2); assert.ok(plain);
});
test('accept selected changes: applied as one new commit on the target (one parent); the proposal stays open; the rest merges later without conflict', () => {
  const w = world(), { studio, db, ana, bo, up, fork, save } = w;
  save(bo, fork.id, 'main', 'Three changes', (s) => { s.day.blocks.splice(1, 0, checks('habits', 'Habits')); blk(s, 'review').h = 4; s.meta.title = 'Bo title'; return s; });
  const a1 = save(ana, up.id, 'main', 'Anna', (s) => { blk(s, 'body').style = 'lines'; return s; });
  const p = propose(w), cmp = studio.compareProposal(ana, up.id, p.number);
  assert.deepEqual(cmp.changes.map((c) => [c.key, c.kind]).sort(), [['block:habits', 'added'], ['block:review', 'changed'], ['meta:title', 'changed']]);
  status(() => studio.acceptChanges(ana, up.id, p.number, { items: [], expectedHeads: w.heads() }), 422, 'unknown_change');
  status(() => studio.acceptChanges(ana, up.id, p.number, { items: ['block:ghost'], expectedHeads: w.heads() }), 422, 'unknown_change');
  status(() => studio.acceptChanges(ana, up.id, p.number, { items: ['block:habits'], expectedHeads: { ours: a1.id, theirs: a1.id } }), 409, 'head_moved');
  const r = studio.acceptChanges(ana, up.id, p.number, { items: ['block:habits', 'block:review'], expectedHeads: w.heads() });
  assert.equal(r.merged, false); assert.deepEqual(r.commit.parents, [a1.id]);
  assert.match(r.commit.message, /Accept 2 changes from proposal #1/);
  const m = studio.head(ana, up.id).snapshot;
  assert.ok(blk(m, 'habits')); assert.equal(blk(m, 'review').h, 4); assert.equal(m.meta.title, 'Sample Journal', 'the title was not selected'); assert.equal(blk(m, 'body').style, 'lines', 'upstream’s own change is kept');
  const after = studio.getProposal(ana, up.id, p.number);
  assert.equal(after.status, 'open'); assert.deepEqual(after.accepted.map((a) => a.key).sort(), ['block:habits', 'block:review']);
  assert.ok(after.events.some((e) => e.kind === 'accept'));
  // asking again for the same change changes nothing
  const again = studio.acceptChanges(ana, up.id, p.number, { items: ['block:habits'], expectedHeads: w.heads() });
  assert.equal(again.unchanged, true);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM commits WHERE message LIKE 'Accept%'").get().n, 1);
  // the still-open remainder is only the title; merging the whole thing now has no conflict
  assert.deepEqual(studio.compareProposal(ana, up.id, p.number).changes.map((c) => c.key).sort(), ['block:habits', 'block:review', 'meta:title'].sort());
  const done = studio.mergeProposal(ana, up.id, p.number, { expectedHeads: w.heads() });
  assert.equal(done.commit.parents.length, 2); assert.equal(studio.head(ana, up.id).snapshot.meta.title, 'Bo title');
});
test('accept selected changes that meet a conflict need a resolution like any merge; a page (book) change can be accepted on its own', () => {
  const w = world(), { studio, ana, bo, up, fork, save } = w;
  save(bo, fork.id, 'main', 'Changes', (s) => { blk(s, 'actions').count = 2; s.book.default.find((p) => p.id === 'lineage').on = false; s.book.default.splice(3, 0, { id: 'trip', type: 'notes', on: true, options: { title: 'Trip' } }); return s; });
  save(ana, up.id, 'main', 'Anna', (s) => { blk(s, 'actions').count = 6; return s; });
  const p = propose(w);
  const e = status(() => studio.acceptChanges(ana, up.id, p.number, { items: ['block:actions'], expectedHeads: w.heads() }), 409, 'unresolved_conflicts');
  assert.equal(e.details.conflicts[0].id, 'block:actions');
  const r = studio.acceptChanges(ana, up.id, p.number, { items: ['page:default/trip'], expectedHeads: w.heads() });
  const m = studio.head(ana, up.id).snapshot;
  assert.ok(m.book.default.some((x) => x.id === 'trip')); assert.equal(m.book.default.find((x) => x.id === 'lineage').on, true); assert.equal(blk(m, 'actions').count, 6);
  assert.equal(r.commit.parents.length, 1);
});
test('direct merges: another branch of the same project, and syncing a fork from its upstream; a fork never merges upstream without a proposal', () => {
  const w = world(), { studio, ana, bo, up, fork, save } = w;
  studio.createBranch(ana, up.id, { name: 'autumn' });
  save(ana, up.id, 'autumn', 'Autumn', (s) => { s.meta.subtitle = 'Autumn'; return s; });
  const pv = studio.mergePreview(ana, up.id, { into: 'main', from: { ref: 'autumn' } });
  assert.equal(pv.merge.clean, true); assert.deepEqual(pv.changes.map((c) => c.key), ['meta:subtitle']);
  const a = studio.head(ana, up.id, 'main').commit.id, b = studio.head(ana, up.id, 'autumn').commit.id;
  status(() => studio.merge(bo, up.id, { into: 'main', from: { ref: 'autumn' }, expectedHeads: { ours: a, theirs: b } }), 403);
  const r = studio.merge(ana, up.id, { into: 'main', from: { ref: 'autumn' }, expectedHeads: { ours: a, theirs: b } });
  assert.deepEqual(r.commit.parents, [a, b]); assert.equal(studio.head(ana, up.id).snapshot.meta.subtitle, 'Autumn');
  status(() => studio.merge(ana, up.id, { into: 'main', from: { ref: 'autumn' }, expectedHeads: { ours: r.commit.id, theirs: b } }), 409, 'already_merged');
  // sync the fork from upstream
  save(bo, fork.id, 'main', 'Bo', (s) => { s.meta.description = 'Bo’s'; return s; });
  const synced = studio.merge(bo, fork.id, { into: 'main', from: { project: up.id, ref: 'main' }, expectedHeads: { ours: studio.head(bo, fork.id).commit.id, theirs: studio.head(ana, up.id).commit.id } });
  const fs = studio.head(bo, fork.id).snapshot;
  assert.equal(fs.meta.subtitle, 'Autumn'); assert.equal(fs.meta.description, 'Bo’s'); assert.equal(synced.commit.parents.length, 2);
  // the other way (fork into upstream) is only through a proposal
  status(() => studio.merge(ana, up.id, { into: 'main', from: { project: fork.id, ref: 'main' }, expectedHeads: { ours: studio.head(ana, up.id).commit.id, theirs: studio.head(bo, fork.id).commit.id } }), 404); // bo's fork is private: ana cannot read it
  studio.updateProject(bo, fork.id, { visibility: 'public' });
  status(() => studio.merge(ana, up.id, { into: 'main', from: { project: fork.id, ref: 'main' }, expectedHeads: { ours: studio.head(ana, up.id).commit.id, theirs: studio.head(bo, fork.id).commit.id } }), 403, 'not_upstream');
});
test('merge: the merged result is validated and scanned like any commit (a proposal cannot smuggle private content in)', () => {
  const w = world(), { studio, db, ana, bo, up, fork, save } = w;
  save(bo, fork.id, 'main', 'Habits', (s) => { s.day.blocks.splice(1, 0, checks('habits', 'Habits')); return s; });
  const p = propose(w);
  // plant forbidden content in the fork's head commit, directly (the serializer would have refused it)
  const head = studio.head(bo, fork.id), s2 = structuredClone(head.snapshot); s2.day.blocks[1].person = { name: 'Real' };
  const dh = objectHash('day', s2.day); db.prepare('INSERT OR IGNORE INTO objects (hash, kind, body, size) VALUES (?, ?, ?, ?)').run(dh, 'day', canonical(s2.day), 1);
  const tree = JSON.parse(db.prepare('SELECT body FROM objects WHERE hash = ?').get(head.commit.tree).body), t2 = { format: 1, parts: { ...tree.parts, day: dh } };
  db.prepare('INSERT OR IGNORE INTO objects (hash, kind, body, size) VALUES (?, ?, ?, ?)').run(objectHash('tree', t2), 'tree', canonical(t2), 1);
  const id = sha256('planted-fork-head'); db.prepare('INSERT INTO commits (id, tree, parents, author_id, author_name, message, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(id, objectHash('tree', t2), canonical([head.commit.id]), bo.id, 'Bo', 'Planted', '2026-10-04T00:00:00.000Z');
  db.prepare('INSERT INTO project_commits (project_id, commit_id) VALUES (?, ?)').run(fork.id, id);
  db.prepare('UPDATE branches SET head_commit_id = ? WHERE project_id = ? AND name = ?').run(id, fork.id, 'main');
  const before = db.prepare('SELECT COUNT(*) n FROM commits').get().n;
  status(() => studio.mergeProposal(ana, up.id, p.number, { expectedHeads: w.heads() }), 422);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM commits').get().n, before);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM project_commits WHERE project_id = ? AND commit_id = ?').get(up.id, id).n, 0, 'the planted commit was not linked into upstream');
});

// ---------- over HTTP ----------
test('HTTP: fork, propose, review, merge and the guest/permission matrix through the real routes', async () => {
  const t = await serve();
  try {
    const ana = await t.signup('anna'), bo = await t.signup('bobo'), cy = await t.signup('cyrus');
    const proj = (await t.call('POST', '/api/projects', { token: ana, body: { name: 'HTTP Sample', visibility: 'public', allowReuse: true, license: 'CC BY', credit: 'Anna' } })).body.project;
    assert.equal(proj.license, 'CC BY');
    assert.equal((await t.call('POST', `/api/projects/${proj.id}/forks`, { body: {} })).status, 401);
    const fk = await t.call('POST', `/api/projects/${proj.id}/forks`, { token: bo, body: { name: 'HTTP fork' } });
    assert.equal(fk.status, 201); const fork = fk.body.project;
    assert.equal(fork.attribution.creator.name, 'anna'); assert.equal(fork.attribution.license, 'CC BY');
    const h = (await t.call('GET', `/api/projects/${fork.id}/head`, { token: bo })).body;
    const day = structuredClone(h.snapshot.day); day.blocks.splice(1, 0, checks('habits', 'Habits'));
    assert.equal((await t.call('POST', `/api/projects/${fork.id}/commits`, { token: bo, body: { branch: 'main', expectedHead: h.commit.id, message: 'Habits', snapshot: { day } } })).status, 201);
    assert.equal((await t.call('POST', `/api/projects/${proj.id}/proposals`, { token: cy, body: { sourceProject: fork.id, sourceBranch: 'main', title: 'x' } })).status, 404);
    const pr = await t.call('POST', `/api/projects/${proj.id}/proposals`, { token: bo, body: { sourceProject: fork.id, sourceBranch: 'main', title: 'Habits' } });
    assert.equal(pr.status, 201); const n = pr.body.proposal.number;
    // guests read, never write
    assert.equal((await t.call('GET', `/api/projects/${proj.id}/proposals`)).body.proposals.length, 1);
    assert.equal((await t.call('GET', `/api/projects/${proj.id}/proposals/${n}`)).status, 200);
    const cmp = await t.call('GET', `/api/projects/${proj.id}/proposals/${n}/compare`);
    assert.equal(cmp.status, 200); assert.deepEqual(cmp.body.changes.map((c) => c.key), ['block:habits']);
    for (const [m, u] of [['POST', `/proposals/${n}/comments`], ['POST', `/proposals/${n}/reviews`], ['POST', `/proposals/${n}/status`], ['POST', `/proposals/${n}/accept`], ['POST', `/proposals/${n}/merge`], ['POST', '/merge'], ['POST', '/forks'], ['POST', '/proposals']]) {
      const r = await t.call(m, `/api/projects/${proj.id}${u}`, { body: { body: 'x', state: 'comment', status: 'closed', items: ['block:habits'], expectedHeads: {} } });
      assert.equal(r.status, 401, `${m} ${u} as a guest`);
    }
    assert.equal((await t.call('POST', `/api/projects/${proj.id}/proposals/${n}/comments`, { token: cy, body: { body: 'hi' } })).status, 403);
    assert.equal((await t.call('POST', `/api/projects/${proj.id}/proposals/${n}/reviews`, { token: bo, body: { state: 'approved' } })).status, 403);
    assert.equal((await t.call('GET', `/api/projects/${proj.id}/proposals/999`)).status, 404);
    // ana reviews and merges
    assert.equal((await t.call('POST', `/api/projects/${proj.id}/proposals/${n}/reviews`, { token: ana, body: { state: 'approved', body: 'Looks calm' } })).status, 201);
    const heads = { ours: cmp.body.commits.ours.id, theirs: cmp.body.commits.theirs.id };
    const bad = await t.call('POST', `/api/projects/${proj.id}/proposals/${n}/merge`, { token: ana, body: { expectedHeads: { ours: 'x', theirs: heads.theirs } } });
    assert.equal(bad.status, 409); assert.equal(bad.body.error.code, 'head_moved');
    const ok = await t.call('POST', `/api/projects/${proj.id}/proposals/${n}/merge`, { token: ana, body: { expectedHeads: heads } });
    assert.equal(ok.status, 201); assert.equal(ok.body.commit.parents.length, 2); assert.equal(ok.body.proposal.status, 'merged');
    const log = (await t.call('GET', `/api/projects/${proj.id}/log`)).body;
    assert.equal(log.commits[0].parents.length, 2);
    // conflicts come back as data
    const h2 = (await t.call('GET', `/api/projects/${proj.id}/head`, { token: ana })).body, fh = (await t.call('GET', `/api/projects/${fork.id}/head`, { token: bo })).body;
    const edit = (snap, count) => { const d = structuredClone(snap.day); d.blocks.find((b) => b.uid === 'actions').count = count; return d; };
    await t.call('POST', `/api/projects/${proj.id}/commits`, { token: ana, body: { branch: 'main', expectedHead: h2.commit.id, message: 'Ana count', snapshot: { day: edit(h2.snapshot, 6) } } });
    await t.call('POST', `/api/projects/${fork.id}/commits`, { token: bo, body: { branch: 'main', expectedHead: fh.commit.id, message: 'Bo count', snapshot: { day: edit(fh.snapshot, 2) } } });
    const p2 = (await t.call('POST', `/api/projects/${proj.id}/proposals`, { token: bo, body: { sourceProject: fork.id, sourceBranch: 'main', title: 'Count' } })).body.proposal;
    const c2 = (await t.call('GET', `/api/projects/${proj.id}/proposals/${p2.number}/compare`)).body;
    assert.equal(c2.merge.conflicts[0].kind, 'edit_edit');
    const eh = { ours: c2.commits.ours.id, theirs: c2.commits.theirs.id };
    const nores = await t.call('POST', `/api/projects/${proj.id}/proposals/${p2.number}/merge`, { token: ana, body: { expectedHeads: eh } });
    assert.equal(nores.status, 409); assert.equal(nores.body.error.code, 'unresolved_conflicts'); assert.equal(nores.body.error.details.conflicts[0].id, 'block:actions');
    const res = await t.call('POST', `/api/projects/${proj.id}/proposals/${p2.number}/merge`, { token: ana, body: { expectedHeads: eh, resolutions: { 'block:actions': { choose: 'theirs' } } } });
    assert.equal(res.status, 201);
    assert.equal((await t.call('GET', `/api/projects/${proj.id}/head`)).body.snapshot.day.blocks.find((b) => b.uid === 'actions').count, 2);
    // direct-merge preview route
    assert.equal((await t.call('POST', `/api/projects/${proj.id}/merge/preview`, { body: { into: 'main', from: { ref: 'main' } } })).status, 200);
  } finally { await t.close(); }
});
test('migration 002 applies on top of a G1 database and is recorded', () => {
  const { db } = fresh();
  const names = db.prepare('SELECT name FROM schema_migrations ORDER BY name').all().map((r) => r.name);
  assert.deepEqual(names, ['001_init.sql', '002_collab.sql', '003_releases.sql']);
  for (const tbl of ['proposals', 'proposal_events', 'proposal_accepts']) assert.ok(db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(tbl));
  assert.ok(emptySnapshot && PASSWORD);
});
