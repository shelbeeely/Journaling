// ---------- versions (Journalwright Studio) ----------
// A drawer reachable from every view. Two places to keep versions:
//   This browser  no account: versions are saved in this browser (localStorage), nothing is uploaded, compare and restore work.
//   A Studio project  signed in to a Studio server (studio/): named versions (commits), branches, autosaved drafts, compare, restore.
// Public projects can be read (history, compare) without an account. Signing in uploads nothing until you save a version or create a
// project; "Move this browser's project to my account" is one step. Not signed in and no server = the editor as it always was.
// A version is immutable; edits to a project autosave as a draft per branch. If the branch moved while you worked, nothing is
// overwritten: you choose (see what changed, keep yours as a new branch, or take theirs).
const STUDIO = /*__STUDIO__*/;
const ST = { url: store.get('kw-st-url') || '', token: store.get('kw-st-token') || '', user: null, reach: false, same: false, projects: [], pubs: [], pid: '', pname: '', role: '', branch: 'main', branches: [], head: null, headSnap: null, base: '', rev: 0, behind: false, log: [], cache: new Map(), timer: null, saving: false, again: false, loading: false, pending: false, draftAt: '', sel: '', poll: 0, repaint: null };
const stServer = () => !!(ST.pid && ST.head);
const stCanWrite = () => !ST.pid || (!!ST.user && (ST.role === 'owner' || ST.role === 'editor'));
const stWrites = () => stServer() && stCanWrite(); // a project you can edit: your edits autosave to its draft
const enc = encodeURIComponent, P = (s = '') => `/api/projects/${ST.pid}${s}`;
const IC_CMP = '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="4" width="6" height="12" rx="1.2"/><rect x="11.5" y="4" width="6" height="12" rx="1.2"/><path d="M5.5 8h0M14.5 8h0M12.8 12h3.4"/></svg>';
const IC_RESTORE = '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 10a6.5 6.5 0 1 0 2-4.7M3.5 3.8v3.4h3.4M10 6.5V10l2.4 1.6"/></svg>';
const IC_BACK = '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 10H4.5M9 5.5 4.5 10 9 14.5"/></svg>';
const IC_DOT = '<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><circle cx="10" cy="10" r="4"/></svg>';

async function stApi(method, path, body) {
  let r;
  try { r = await fetch(ST.url + path, { method, cache: 'no-store', headers: { ...(ST.token ? { Authorization: 'Bearer ' + ST.token } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined }); }
  catch { throw Object.assign(new Error('Couldn’t reach the Studio server.' + (MODE === 'artifact' ? ' A Claude Artifact usually can’t call outside servers: use the site build, or open the editor from the Studio server itself.' : '')), { offline: true }); }
  let data = null; try { data = await r.json(); } catch { /* not JSON */ }
  if (!r.ok) throw Object.assign(new Error((data && data.error && data.error.message) || `Studio said ${r.status}.`), { status: r.status, code: data && data.error && data.error.code, details: data && data.error && data.error.details });
  return data;
}
const stAgo = (iso) => { const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000); if (s < 45) return 'just now'; const m = Math.round(s / 60); if (m < 60) return `${m} min ago`; const h = Math.round(m / 60); if (h < 24) return `${h} h ago`; const d = Math.round(h / 24); return d < 30 ? `${d} d ago` : new Date(iso).toLocaleDateString(); };
const stClock = (d = new Date()) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const stMsg = (e) => (e && e.message) || 'Something went wrong.';
const stDay = (L) => STUDIO.canonical(normalize(L));

// ----- versions kept in this browser (no account) -----
const LOC_KEY = 'kw-st-local';
const locRead = () => { try { const j = JSON.parse(store.get(LOC_KEY) || 'null'); return j && Array.isArray(j.versions) ? j.versions : []; } catch { return []; } };
function locWrite(v) { store.set(LOC_KEY, JSON.stringify({ v: 1, versions: v.slice(0, 30) })); if (v.length && !store.get(LOC_KEY)) toast('This browser can’t keep versions (its storage is blocked).'); }
const locSnap = (day) => ({ meta: {}, print: {}, book: { default: [], months: {} }, day: normalize(day), assets: [], components: [] });
const locId = () => 'l-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const locView = (v, i, a) => ({ id: v.id, short: v.id.slice(-6), message: v.message, author: { name: 'You' }, createdAt: v.createdAt, parents: a[i + 1] ? [a[i + 1].id] : [] });
function locAdd(message) { const vs = locRead(); vs.unshift({ id: locId(), message, createdAt: new Date().toISOString(), day: normalize(layout) }); locWrite(vs); }
function stLocalRefresh() {
  const vs = locRead(); ST.log = vs.map(locView); ST.head = null; ST.headSnap = vs[0] ? locSnap(vs[0].day) : null;
  stChip(); stDrawLog(); stDrawCtx();
}
// The day the current layout is compared with: the newest version (server head, or the newest kept in this browser; none = the original page).
const stBaseDay = () => (stServer() ? ST.headSnap.day : ST.headSnap ? ST.headSnap.day : normalize(null));
const stDirty = () => stDay(layout) !== stDay(stBaseDay());

// ----- state line -----
function stChip() {
  const el = $('#vs-chip'); let t = '', cls = '';
  if (ST.pid && !stCanWrite()) t = 'Read only';
  else if (!ST.pid) { const n = locRead().length, d = n > 0 && stDirty(); t = !n ? 'No versions yet' : d ? 'Changes since your last version' : 'Matches your latest version'; cls = !n ? '' : d ? 'draft' : 'ok'; }
  else if (!ST.head) t = '';
  else if (ST.behind) { t = 'Branch moved: your draft is kept'; cls = 'draft'; }
  else if (ST.saving) t = 'Saving draft…';
  else if (ST.pending) { t = 'Unsaved changes…'; cls = 'draft'; }
  else if (stDirty() && ST.rev > 0) { t = `Draft autosaved ${stClock(new Date(ST.draftAt || Date.now()))}`; cls = 'draft'; }
  else if (stDirty()) { t = 'Unsaved changes'; cls = 'draft'; }
  else { t = 'Saved as a version'; cls = 'ok'; }
  el.className = 'vs-chip' + (cls ? ' ' + cls : '');
  el.innerHTML = t ? `${IC_DOT}<span>${escH(t)}</span>` : '';
  if (stWrites()) setStatus(t + (ST.behind || !stDirty() ? '' : ' · not a version yet'), cls === 'ok' ? 'ok' : '');
  if ($('#versions').open) stDrawLog(); // the draft card follows the state line
}
function stBanner(html, wire, cls = '') {
  ST.moveBanner = false; const b = $('#vs-banner'); b.className = 'vs-banner' + (cls ? ' ' + cls : ''); b.setAttribute('role', cls ? 'status' : 'alert');
  if (!html) { b.hidden = true; b.innerHTML = ''; return; }
  b.hidden = false; b.innerHTML = html; if (wire) wire(b);
}

// ----- the header of the drawer: who, project, branch -----
function stDrawCtx() {
  $('#vs-guest').hidden = !!ST.user; $('#vs-who').hidden = !ST.user; $('#vs-me').textContent = ST.user ? ST.user.displayName || ST.user.username : '';
  const cur = ST.projects.find((p) => p.id === ST.pid) || (ST.pid ? { id: ST.pid, name: ST.pname, role: 'public' } : null);
  $('#vs-proj').innerHTML = '<option value="">This browser</option>' + ST.projects.map((p) => `<option value="${p.id}">${escH(p.name)}${p.role !== 'owner' ? ` (${p.role})` : ''}</option>`).join('')
    + (cur && !ST.projects.some((p) => p.id === cur.id) ? `<option value="${cur.id}">Public: ${escH(cur.name)}</option>` : '') + (ST.user ? '<option value="__new">+ New project on my account…</option>' : '');
  $('#vs-proj').value = ST.pid || '';
  $('#vs-brwrap').hidden = !stServer(); $('#vs-nb').hidden = !(stServer() && stCanWrite());
  if (!stServer()) $('#vs-newbr').hidden = true;
  $('#vs-save').hidden = !!ST.pid && !stCanWrite();
  $('#vs-hint').textContent = ST.pid ? 'Your edits are autosaved as a draft. A version is a named point you can compare with and come back to.' : 'Versions saved here stay in this browser. Nothing is uploaded.';
  $('#vs-sub').textContent = ST.pid ? `${ST.pname} · ${ST.branch}${stCanWrite() ? '' : ' · read only'}` : 'This browser';
  const pubs = ST.pubs.filter((p) => p.id !== ST.pid);
  $('#vs-pub').hidden = !ST.reach || !pubs.length;
  $('#vs-publist').innerHTML = pubs.map((p) => `<li><div><b>${escH(p.name)}</b><small>${escH(p.description || 'Public, read-only')} · updated ${stAgo(p.updatedAt)}</small></div><button class="vs-b" data-open="${p.id}" type="button" aria-label="Open ${escH(p.name)} to read its history">Open</button></li>`).join('');
  const offer = !ST.pid && !!ST.user && (locRead().length > 0 || stDirty());
  if (offer && $('#vs-banner').hidden) {
    stBanner('<p>This browser’s project is not on your account yet. Moving it is one step, and only what you choose is uploaded.</p><div class="vs-acts"><button class="btn" id="vb-move" type="button">Move it to my account</button></div>', (b) => { b.querySelector('#vb-move').onclick = () => stOpenNp(true); }, 'info');
    ST.moveBanner = true;
  } else if (!offer && ST.moveBanner) stBanner('');
}

// ----- draft autosave (the editor's queueSave calls this) -----
function stQueueDraft() {
  if (!ST.pid && !ST.loading) { stChip(); stDrawLog(); return; } // this browser: no draft to send, just keep the state line and the list honest
  if (!stWrites() || ST.loading) return;
  if (ST.rev === 0 && !stDirty()) { stChip(); return; }
  ST.pending = true; stChip(); clearTimeout(ST.timer); ST.timer = setTimeout(stSaveDraft, 900);
}
async function stSaveDraft() {
  if (!stWrites()) return true;
  if (ST.saving) { ST.again = true; return false; }
  clearTimeout(ST.timer); ST.saving = true; ST.pending = false; stChip();
  let ok = false;
  try {
    const r = await stApi('PUT', P(`/drafts/${enc(ST.branch)}`), { base: ST.base || undefined, rev: ST.rev, snapshot: { day: layout } });
    ST.rev = r.rev; ST.base = r.base; ST.draftAt = r.updatedAt; ok = true;
    if (r.head !== ST.head.id) { ST.behind = true; await stMoved(r.head); } else ST.behind = false;
  } catch (e) {
    if (e.code === 'draft_conflict' || e.code === 'draft_base_mismatch' || e.code === 'draft_gone') stBanner('<p>This draft was saved from another tab or device. Reload it to keep going from there.</p><div class="vs-acts"><button class="btn" id="vb-reload" type="button">Reload the draft</button></div>', (b) => { b.querySelector('#vb-reload').onclick = () => stLoad(); });
    else setStatus('Not autosaved: ' + stMsg(e), 'bad');
  } finally { ST.saving = false; if (ST.again) { ST.again = false; stQueueDraft(); } stChip(); }
  return ok;
}

// ----- putting a version into the editor -----
function stApply(day, persist = false) {
  const same = stDay(layout) === stDay(day);
  if (!same) snapshot();
  ST.loading = true; try { selected = null; layout = normalize(day); drawList(); drawPalette(); drawPreview(); } finally { ST.loading = false; }
  if (persist) queueSave(); // the editor's own save (this browser or the Artifact store)
  return !same;
}
function stAutoLocal(why) { if (!ST.pid && stDirty()) { locAdd(why); return true; } return false; } // never lose this browser's unsaved work when opening a project

// ----- opening a project (yours or a public one) -----
async function stMine() { ST.projects = (await stApi('GET', '/api/projects')).projects; }
async function stPublicLoad() { try { ST.pubs = (await stApi('GET', '/api/projects?public=1')).projects; } catch { ST.pubs = []; } }
async function stOpenProject(id, { skipAuto = false } = {}) {
  const mine = ST.projects.find((p) => p.id === id), pub = ST.pubs.find((p) => p.id === id), p = mine || pub;
  if (!p) return;
  const role = mine ? mine.role : 'public', writable = !!ST.user && (role === 'owner' || role === 'editor');
  if (writable && !ST.pid && !skipAuto) stAutoLocal(`Before opening “${p.name}”`);
  ST.wasWritable = writable;
  ST.pid = id; ST.pname = p.name; ST.role = role; store.set('kw-st-pid', mine ? id : null);
  const saved = (store.get('kw-st-branch') || '').split('|'); ST.branch = saved[0] === id && saved[1] ? saved[1] : p.defaultBranch || 'main';
  ST.cache.clear(); ST.sel = ''; stCmpClear();
  await stLoad();
  if (!ST.head && ST.branch !== 'main') { ST.branch = 'main'; await stLoad(); }
}
async function stGoLocal({ applyNewest = true } = {}) {
  const was = ST.wasWritable; ST.wasWritable = false;
  clearTimeout(ST.timer); ST.pending = false; ST.saving = false;
  Object.assign(ST, { pid: '', pname: '', role: '', head: null, headSnap: null, branch: 'main', behind: false, rev: 0, base: '', sel: '' }); ST.cache.clear();
  store.set('kw-st-pid', null); stBanner(''); stCmpClear();
  const vs = locRead();
  if (was && applyNewest && vs[0]) { stApply(vs[0].day, true); toast('Back to this browser’s latest version. Undo brings back the project’s page.'); }
  stLocalRefresh();
}
async function stLoad() {
  ST.loading = true; clearTimeout(ST.timer); ST.pending = false; stBanner('');
  try {
    const h = await stApi('GET', P(`/head?branch=${enc(ST.branch)}`));
    ST.head = h.commit; ST.headSnap = h.snapshot; ST.cache.set(h.commit.id, h);
    if (!stCanWrite()) { // reading: a public project, or a viewer. Your own page in the editor is left alone.
      ST.rev = 0; ST.base = h.commit.id; ST.behind = false; ST.loading = false;
      await stLog();
      stBanner(`<p>Reading “${escH(ST.pname)}”${ST.role === 'public' ? ' (public)' : ''}. Its history and comparisons are here; the page in your editor is untouched.</p><div class="vs-acts"><button class="btn" id="vb-home" type="button">Back to this browser</button></div>`, (b) => { b.querySelector('#vb-home').onclick = () => stGoLocal({ applyNewest: false }); }, 'info');
      return;
    }
    let dr = null;
    try { dr = (await stApi('GET', P(`/drafts/${enc(ST.branch)}`))).draft; } catch (e) { if (e.status !== 403) throw e; }
    let changed;
    if (dr) { ST.rev = dr.rev; ST.base = dr.base; ST.behind = dr.behind; ST.draftAt = dr.updatedAt; changed = stApply(dr.snapshot.day); }
    else { ST.rev = 0; ST.base = h.commit.id; ST.behind = false; ST.draftAt = ''; changed = stApply(h.snapshot.day); }
    ST.loading = false;
    await stLog();
    if (ST.behind) await stMoved(ST.head.id);
    if (changed) toast(dr ? 'Loaded your draft. Undo brings back what you had.' : 'Loaded this version. Undo brings back what you had.');
  } catch (e) { setStatus(stMsg(e), 'bad'); stBanner(`<p>${escH(stMsg(e))}</p>`); }
  finally { ST.loading = false; stChip(); stDrawLog(); stDrawCtx(); }
}
async function stLog() {
  const [lg, br] = await Promise.all([stApi('GET', P(`/log?branch=${enc(ST.branch)}&limit=60`)), stApi('GET', P('/branches'))]);
  ST.log = lg.commits; ST.branches = br.branches;
  $('#vs-br').innerHTML = ST.branches.map((b) => `<option value="${escH(b.name)}"${b.name === ST.branch ? ' selected' : ''}>${escH(b.name)}${b.isDefault ? ' (main line)' : ''}</option>`).join('');
}
async function stMoved(headId) { // the branch has a newer version than the one this draft started from
  let c = ST.log.find((x) => x.id === headId);
  if (!c) { try { await stLog(); c = ST.log.find((x) => x.id === headId); } catch { /* keep going */ } }
  const who = c ? `<b>${escH(c.author.name)}</b> saved “${escH(c.message)}” ${stAgo(c.createdAt)}` : 'A newer version was saved';
  stBanner(`<p>${who}. Your changes are safe as a draft, and nothing was overwritten.</p><div class="vs-acts"><button class="btn" id="vb-see" type="button">See what they changed</button><button class="btn" id="vb-mine" type="button">Keep mine as a new branch</button><button class="btn" id="vb-theirs" type="button">Start from their version</button></div>`, (b) => {
    b.querySelector('#vb-see').onclick = () => stCompare(ST.base, headId, 'What changed while you were editing');
    b.querySelector('#vb-mine').onclick = stKeepMine;
    b.querySelector('#vb-theirs').onclick = async () => { if (!confirm('Discard your draft and start from their version? Undo can bring the page back in this tab.')) return; try { await stApi('DELETE', P(`/drafts/${enc(ST.branch)}`)); await stLoad(); } catch (e) { toast(stMsg(e)); } };
  });
}
async function stKeepMine() { // conflict, keep both: my draft becomes a version on a fresh branch that starts where I started
  const name = `${ST.user.username}-${new Date().toISOString().slice(5, 16).replace(/[-:T]/g, '')}`;
  try {
    await stApi('POST', P('/branches'), { name, from: ST.base });
    await stApi('POST', P('/commits'), { branch: name, expectedHead: ST.base, message: 'My changes (kept beside the newer version)', snapshot: { day: layout } });
    await stApi('DELETE', P(`/drafts/${enc(ST.branch)}`));
    ST.branch = name; store.set('kw-st-branch', `${ST.pid}|${name}`); await stLoad(); toast(`Your changes are saved on the branch “${name}”.`);
  } catch (e) { toast(stMsg(e)); }
}

// ----- history list -----
function stDrawLog() {
  const ol = $('#vs-log'); if (!ol) return;
  const head = ST.log[0] && ST.log[0].id; // the newest version (a moved branch shows theirs first)
  const canRestore = stCanWrite();
  const showDraft = canRestore && stDirty() && (stServer() || (!ST.pid && ST.log.length > 0));
  const newest = ST.log[0] ? ST.log[0].id : 'base';
  const draft = showDraft
    ? `<li class="vs-c draft"><div class="vs-cm"><span class="vs-msg">Your unsaved changes</span><code class="vs-h">draft</code></div><div class="vs-meta">${!ST.pid ? 'Not a version yet · in this browser' : ST.rev > 0 ? `Autosaved ${stClock(new Date(ST.draftAt))} · on “${escH(ST.branch)}”` : 'Not autosaved yet'}</div><div class="vs-acts"><button class="vs-b" data-cmp="draft" aria-label="Compare your unsaved changes with the latest version">${IC_CMP}<span class="lab">Compare</span></button></div></li>` : '';
  ol.innerHTML = draft + ST.log.map((c) => `<li class="vs-c${c.id === head ? ' cur' : ''}${c.id === ST.sel ? ' sel' : ''}" data-id="${c.id}">
    <div class="vs-cm"><span class="vs-msg">${escH(c.message)}</span><code class="vs-h" title="${c.id}">${c.short}</code></div>
    <div class="vs-meta">${escH(c.author.name)} · <time datetime="${c.createdAt}" title="${escH(new Date(c.createdAt).toLocaleString())}">${stAgo(c.createdAt)}</time>${c.id === head ? ' · <b>latest</b>' : ''}${c.id === ST.base && ST.rev > 0 && c.id !== head ? ' · <b>your draft starts here</b>' : ''}</div>
    <div class="vs-acts"><button class="vs-b" data-cmp="${c.id}" aria-label="Compare “${escH(c.message)}” with the version before it">${IC_CMP}<span class="lab">Compare</span></button>${c.id !== head && canRestore ? `<button class="vs-b" data-restore="${c.id}" aria-label="Restore “${escH(c.message)}” as a new version">${IC_RESTORE}<span class="lab">Restore</span></button>` : ''}</div></li>`).join('') || `<li class="vs-empty">${ST.pid ? 'No versions yet.' : 'No versions yet. Save one to keep this page’s history here.'}</li>`;
  ST.newest = newest;
}
$('#vs-log').addEventListener('click', (e) => {
  const c = e.target.closest('[data-cmp]'), r = e.target.closest('[data-restore]');
  if (c) { const id = c.dataset.cmp; if (id === 'draft') return stCompare(ST.newest, 'draft', 'Your unsaved changes'); const x = ST.log.find((y) => y.id === id); ST.sel = id; stDrawLog(); return stCompare(x.parents[0] || x.id, x.id, x.message); }
  if (r) stRestore(r.dataset.restore);
});

// ----- save a version -----
async function stSaveVersion() {
  const msg = $('#vs-msg').value.trim();
  if (!msg) { $('#vs-msg').focus(); toast('Add a few words about what changed.'); return; }
  if (!ST.pid) { // this browser
    if (locRead().length && !stDirty()) { toast('Nothing new to save: this is the latest version.'); return; }
    locAdd(msg); $('#vs-msg').value = ''; stBanner(''); stLocalRefresh(); toast(`Saved “${msg}” in this browser.`); return;
  }
  if (!stDirty() && ST.rev === 0) { toast('Nothing new to save: this is the latest version.'); return; }
  $('#vs-savebtn').disabled = true;
  try {
    if (!(await stSaveDraft()) && ST.rev === 0) throw new Error('Couldn’t save your changes first. Try again.');
    const r = await stApi('POST', P(`/drafts/${enc(ST.branch)}/promote`), { message: msg, expectedHead: ST.head.id });
    $('#vs-msg').value = ''; ST.rev = 0; ST.behind = false; stBanner('');
    const h = await stApi('GET', P(`/head?branch=${enc(ST.branch)}`)); ST.head = h.commit; ST.headSnap = h.snapshot; ST.base = h.commit.id; ST.cache.set(h.commit.id, h);
    await stLog(); dirty = false; toast(r.unchanged ? 'Nothing had changed.' : `Saved “${r.commit.message}”.`);
  } catch (e) {
    if (e.code === 'head_moved') await stMoved(e.details.head); else if (e.code === 'no_draft') toast('Nothing new to save.'); else toast(stMsg(e));
  } finally { $('#vs-savebtn').disabled = !stCanWrite(); stChip(); stDrawLog(); }
}
$('#vs-save').onsubmit = (e) => { e.preventDefault(); stSaveVersion(); };

// ----- restore (a new version; history is never rewritten) -----
async function stRestore(id) {
  const c = ST.log.find((x) => x.id === id); if (!c) return;
  if (!ST.pid) {
    const v = locRead().find((x) => x.id === id); if (!v) return;
    const extra = stDirty() ? ' Your unsaved changes are kept in the undo history of this tab.' : '';
    if (!confirm(`Restore “${c.message}”? It is saved as a NEW version in this browser; nothing is deleted.${extra}`)) return;
    stApply(v.day, true); locAdd(`Restore “${c.message}”`); stLocalRefresh(); toast('Restored as a new version.'); return;
  }
  const extra = stDirty() ? ' Your unsaved changes become part of the undo history in this tab and the draft is discarded.' : '';
  if (!confirm(`Restore “${c.message}” (${c.short})? It is saved as a NEW version on “${ST.branch}”; nothing is deleted.${extra}`)) return;
  try {
    if (ST.rev > 0) await stApi('DELETE', P(`/drafts/${enc(ST.branch)}`));
    const r = await stApi('POST', P('/restore'), { commit: id, branch: ST.branch, expectedHead: ST.head.id });
    ST.rev = 0; await stLoad(); toast(r.unchanged ? 'That is already the latest version.' : `Restored ${c.short} as a new version.`);
  } catch (e) { if (e.code === 'head_moved') await stMoved(e.details.head); else toast(stMsg(e)); }
}

// ----- branches -----
$('#vs-nb').onclick = () => { const f = $('#vs-newbr'); f.hidden = !f.hidden; $('#vs-nb').setAttribute('aria-expanded', !f.hidden); if (!f.hidden) $('#vs-brname').focus(); };
$('#vs-brx').onclick = () => { $('#vs-newbr').hidden = true; $('#vs-nb').setAttribute('aria-expanded', 'false'); };
$('#vs-newbr').onsubmit = async (e) => {
  e.preventDefault();
  const name = $('#vs-brname').value.trim(); if (!name) return;
  try {
    await stSaveDraft();
    await stApi('POST', P('/branches'), { name, from: ST.branch });
    $('#vs-brname').value = ''; $('#vs-newbr').hidden = true; $('#vs-nb').setAttribute('aria-expanded', 'false');
    await stSwitch(name); toast(`On the new branch “${name}”.`);
  } catch (e2) { toast(stMsg(e2)); }
};
async function stSwitch(name) { ST.branch = name; store.set('kw-st-branch', `${ST.pid}|${name}`); ST.sel = ''; stCmpClear(); await stLoad(); }
$('#vs-br').onchange = async (e) => { if (ST.pending) await stSaveDraft(); await stSwitch(e.target.value); };

// ----- compare: real page renderers, changed blocks marked -----
const stName = (t) => (TYPES[t] || {}).name || t;
const stBlockLabel = (b) => stName(b.type) + (b.title && typeof b.title === 'string' ? ` “${b.title}”` : '');
function stFmt(v) { if (v === null || v === undefined) return 'none'; if (v === true) return 'on'; if (v === false) return 'off'; if (Array.isArray(v)) return v.length ? v.map(stFmt).join(', ') : 'none'; if (typeof v === 'object') { const j = JSON.stringify(v); return j.length > 60 ? j.slice(0, 60) + '…' : j; } const s = String(v); return s === '' ? 'empty' : s.length > 40 ? s.slice(0, 40) + '…' : s; }
function stFieldText(type, f) {
  if (f.key === 'on') return f.after ? 'Turned on' : 'Turned off';
  const m = f.key.match(/^rows\.([a-z_0-9]+)(?:\.(.+))?$/);
  if (m) { const row = (CARE_ROWS[m[1]] || {}).name || m[1], what = m[2]; if (!what) return `Care › ${row}: ${f.after === 'added' ? 'added' : 'removed'}`; return `Care › ${row}${what === 'on' ? '' : ' › ' + what}: ${stFmt(f.before)} → ${stFmt(f.after)}`; }
  const o = ((TYPES[type] || {}).opts || []).find((x) => x.k === f.key), place = { col: 'Grid column', row: 'Grid row', colSpan: 'Grid width', rowSpan: 'Grid height' }[f.key];
  return `${o ? o.label : place || f.key}: ${stFmt(f.before)} → ${stFmt(f.after)}`;
}
const stCmpClear = () => { $('#vs-cols').dataset.pane = 'log'; ST.repaint = null; $('#vs-cmp').innerHTML = '<p class="vs-empty">Pick a version and tap Compare to see what changed, page by page and block by block.</p>'; };
async function stSnap(ref) {
  if (ref === 'base') return { commit: { short: 'start', message: 'The original page' }, snapshot: locSnap(null) };
  if (ref === 'draft') return { commit: { short: 'draft', message: 'Your unsaved changes' }, snapshot: { ...(ST.headSnap || locSnap(null)), day: normalize(layout) } };
  if (typeof ref === 'string' && ref.startsWith('l-')) { const v = locRead().find((x) => x.id === ref); if (!v) throw new Error('That version is no longer in this browser.'); return { commit: { short: v.id.slice(-6), message: v.message }, snapshot: locSnap(v.day) }; }
  if (ST.cache.has(ref)) return ST.cache.get(ref);
  const r = await stApi('GET', P(`/commits/${ref}`)); ST.cache.set(ref, r); return r;
}
function stInjectCss() {
  if (document.getElementById('vs-css')) return;
  const st = document.createElement('style'); st.id = 'vs-css'; st.textContent = KIT.css.replace(/#pv /g, '.vpv ') + '.vpv .page { box-shadow: none; }'; document.head.appendChild(st);
}
function stPaintPage(host, day, marks) {
  const W = SIZES[size] * 96, H = 8.5 * 96;
  host.innerHTML = `<div class="vpv" style="width:${W}px;height:${H}px"><div class="page verso dayp m" style="width:${SIZES[size]}in">${dayBlocks(KIT, day, { tag: true, size })}${KIT.strip}</div></div>`;
  const root = host.querySelector('.vpv');
  drawRules(root);
  for (const [uid, [kind, text]] of Object.entries(marks)) root.querySelectorAll(`[data-b="${uid}"]`).forEach((el) => { el.dataset.mark = text; el.dataset.mk = kind; });
  const s = Math.max(0.2, host.clientWidth / W); root.style.transform = `scale(${s})`; host.style.height = H * s + 'px';
}
function stThumb(entry) {
  const d = BK.data; if (!d) return '<div class="vth-box ph" aria-hidden="true">·</div>';
  const idd = entry.id.replace(/_/g, '.');
  const p = d.pages.find((x) => x.id === entry.id || x.id === idd) || d.pages.find((x) => x.type === entry.type) || (d.hidden || []).find((x) => x.type === entry.type);
  if (!p || entry.type === 'weeks') return '<div class="vth-box ph" aria-hidden="true">·</div>';
  const w = SIZES[size] * 96, s = 54 / w;
  return `<div class="vth-box" style="height:${8.5 * 96 * s}px" aria-hidden="true"><div class="vth" style="width:${w}px;height:${8.5 * 96}px;transform:scale(${s})"><div class="page recto ${escH(p.cls || '')} m" style="width:${SIZES[size]}in;height:8.5in">${p.html}</div></div></div>`;
}
function stThumbCss() {
  if (document.getElementById('vs-thumb-css') || !BK.data) return;
  const st = document.createElement('style'); st.id = 'vs-thumb-css'; st.textContent = BK.data.css.replace(/#pv /g, '.vth ') + '.vth .page { position: relative; }'; document.head.appendChild(st);
}
const stEntryName = (e) => { const t = BK.data && BK.data.types.find((x) => x.key === e.type); return t ? t.name : e.type === 'weeks' ? 'The weeks' : e.type; };
async function stCompare(a, b, title) {
  const box = $('#vs-cmp'); $('#vs-cols').dataset.pane = 'cmp';
  box.innerHTML = '<p class="vs-empty">Comparing…</p>';
  try {
    if (!BK.data) { try { BK.data = await bkLoadData(); } catch { /* thumbnails are optional */ } }
    stThumbCss(); stInjectCss();
    const [A, B] = await Promise.all([stSnap(a), stSnap(b)]);
    const df = STUDIO.diffSnapshots(A.snapshot, B.snapshot), sm = df.summary;
    const chip = (n, l) => `<span${n ? ' class="on"' : ''}>${l}: ${n ? n + (n === 1 ? ' change' : ' changes') : 'none'}</span>`;
    const ad = Object.fromEntries(A.snapshot.day.blocks.map((x) => [x.uid, x])), bd = Object.fromEntries(B.snapshot.day.blocks.map((x) => [x.uid, x]));
    const mA = {}, mB = {}, rows = [];
    if (df.day.grid) rows.push(['chg', 'Changed', df.day.grid.after ? 'Grid layout switched on' : 'Grid layout switched off', df.day.grid.after ? 'Blocks sit on the page grid instead of stacking' : 'Blocks stack in order again']);
    for (const x of df.day.added) { mB[x.id] = ['add', 'New']; rows.push(['add', 'Added', `${stBlockLabel(bd[x.id])}`, '']); }
    for (const x of df.day.removed) { mA[x.id] = ['del', 'Removed']; rows.push(['del', 'Removed', stBlockLabel(ad[x.id]), '']); }
    for (const x of df.day.moved) { mA[x.id] = ['mov', 'Moved']; mB[x.id] = ['mov', 'Moved']; rows.push(['mov', 'Moved', stBlockLabel(bd[x.id]), `From position ${x.from + 1} to ${x.to + 1}`]); }
    for (const x of df.day.changed) {
      const on = x.fields.find((f) => f.key === 'on');
      mA[x.id] = ['chg', on && !on.after ? 'Turned off' : 'Changed']; mB[x.id] = ['chg', on && on.after ? 'Turned on' : 'Changed'];
      rows.push(['chg', 'Changed', stBlockLabel(bd[x.id]), x.fields.map((f) => stFieldText(x.type, f)).join(' · ')]);
    }
    const li = (k, w, t, s) => `<li><span class="bd ${k}">${w}</span><span class="tx">${escH(t)}${s ? `<small>${escH(s)}</small>` : ''}</span></li>`;
    const bookRows = [];
    for (const x of df.book.added) bookRows.push(`<li>${stThumb(x)}<span class="bd add">Added</span><span class="tx">${escH(stEntryName(x))}<small>${escH(x.id)}</small></span></li>`);
    for (const x of df.book.removed) bookRows.push(`<li>${stThumb(x)}<span class="bd del">Removed</span><span class="tx">${escH(stEntryName(x))}<small>${escH(x.id)}</small></span></li>`);
    for (const x of df.book.moved) bookRows.push(`<li>${stThumb(x)}<span class="bd mov">Moved</span><span class="tx">${escH(stEntryName(x))}<small>${escH(x.id)} · position ${x.from + 1} to ${x.to + 1}${x.list.includes('>') ? ' (' + escH(x.list.split('>')[1]) + ' pages)' : ''}</small></span></li>`);
    for (const x of df.book.changed) bookRows.push(`<li>${stThumb(x)}<span class="bd chg">Changed</span><span class="tx">${escH(stEntryName(x))}<small>${escH(x.id)} · ${x.fields.map((f) => (f.key === 'on' ? (f.after ? 'shown in the book' : 'hidden from the book') : `${f.key.replace(/^options\./, '')}: ${stFmt(f.before)} → ${stFmt(f.after)}`)).join(' · ')}</small></span></li>`);
    const other = [...df.meta.map((f) => ['Title & details', f]), ...df.print.map((f) => ['Print settings', f])].map(([w, f]) => li('chg', 'Changed', `${w}: ${f.key}`, `${stFmt(f.before)} → ${stFmt(f.after)}`));
    const extra = [...df.assets.added.map((x) => li('add', 'Added', `Image ${x.id}`, '')), ...df.assets.removed.map((x) => li('del', 'Removed', `Image ${x.id}`, '')), ...df.assets.changed.map((x) => li('chg', 'Changed', `Image ${x.id}`, ''))];
    const cap = (X) => `<code class="vs-h">${escH(X.commit.short)}</code> <span class="cm">${escH(X.commit.message)}</span>`;
    const local = a.startsWith('l-') || a === 'base' || (!ST.pid); // this browser keeps the day page only: no book pages to compare
    box.innerHTML = `<div class="vs-cmp-h"><button class="vs-b vs-back" id="vs-cback" type="button">${IC_BACK}<span>History</span></button><div><b>${escH(title || 'Compare')}</b><small>${escH(A.commit.short)} → ${escH(B.commit.short)}</small></div></div>
      <div class="vs-sum">${chip(sm.day, 'Day page')}${local ? '' : chip(sm.book, 'Book pages')}${local ? '' : chip(sm.meta + sm.print + sm.assets, 'Settings')}</div>
      <section><h3 class="sec">Day page</h3><div class="vs-pair"><figure><figcaption>Before ${cap(A)}</figcaption><div class="vs-pg" id="vs-pa"></div></figure><figure><figcaption>After ${cap(B)}</figcaption><div class="vs-pg" id="vs-pb"></div></figure></div>
        <ul class="vs-chg">${rows.map((r) => li(...r)).join('') || '<li><span class="tx">The day page is the same in both.</span></li>'}</ul></section>
      ${local ? '' : `<section><h3 class="sec">Book pages</h3><ul class="vs-chg">${bookRows.join('') || '<li><span class="tx">The page list is the same in both.</span></li>'}</ul></section>`}
      ${!local && (other.length || extra.length) ? `<section><h3 class="sec">Details</h3><ul class="vs-chg">${other.join('')}${extra.join('')}</ul></section>` : ''}`;
    $('#vs-cback').onclick = () => { $('#vs-cols').dataset.pane = 'log'; };
    const paint = () => { if (!$('#vs-pa')) return; stPaintPage($('#vs-pa'), A.snapshot.day, mA); stPaintPage($('#vs-pb'), B.snapshot.day, mB); };
    paint(); ST.repaint = paint;
    if (matchMedia('(max-width: 900px)').matches) box.scrollIntoView({ block: 'start' });
  } catch (e) { box.innerHTML = `<p class="vs-empty">${escH(stMsg(e))}</p>`; }
}
addEventListener('resize', () => { if (ST.repaint && $('#versions').open) ST.repaint(); });

// ----- projects: choose, create, move this browser's project to an account -----
$('#vs-proj').onchange = async (e) => {
  const v = e.target.value;
  if (v === '__new') { e.target.value = ST.pid || ''; stOpenNp(false); return; }
  if (ST.pending) await stSaveDraft();
  if (!v) await stGoLocal(); else await stOpenProject(v);
};
$('#vs-publist').addEventListener('click', (e) => { const b = e.target.closest('[data-open]'); if (b) stOpenProject(b.dataset.open); });
function stOpenNp(fromBrowser) {
  const n = locRead().length, moving = fromBrowser || (!ST.pid && (n || stDirty()));
  $('#vs-nph').textContent = moving ? 'Move this browser’s project to my account' : 'New project from this page';
  $('#vs-npp').textContent = moving ? 'Creates a project on your account from the page you have open. Only what you choose here is uploaded.' : 'Starts a project with the day page you have open and the default book, and saves it as the first version.';
  $('#vs-nphistwrap').hidden = !(moving && n); $('#vs-nphist').checked = true;
  $('#vs-nphistl').textContent = `Include the ${n} version${n === 1 ? '' : 's'} saved in this browser (messages kept; times start now)`;
  $('#vs-npname').value = ''; $('#vs-np').showModal();
}
async function stCreateProject(name, visibility, allowReuse, withHistory) {
  const vs = withHistory ? locRead().slice().reverse() : []; // oldest first
  const first = vs.shift();
  const r = await stApi('POST', '/api/projects', { name, visibility, allowReuse, message: first ? first.message : 'First version from the editor', snapshot: { day: first ? first.day : layout } });
  const id = r.project.id; let head = r.project.head, lastDay = first ? first.day : layout;
  for (const v of vs) { const c = await stApi('POST', `/api/projects/${id}/commits`, { branch: 'main', expectedHead: head, message: v.message, snapshot: { day: v.day } }); head = c.commit.id; lastDay = v.day; }
  if (stDay(layout) !== stDay(lastDay)) { const c = await stApi('POST', `/api/projects/${id}/commits`, { branch: 'main', expectedHead: head, message: 'Latest changes from this browser', snapshot: { day: layout } }); head = c.commit.id; }
  return id;
}
$('#vs-np').addEventListener('close', async () => {
  if ($('#vs-np').returnValue !== 'create') return;
  const name = $('#vs-npname').value.trim() || 'My journal';
  try {
    const id = await stCreateProject(name, $('#vs-npvis').value, $('#vs-npreuse').checked, !$('#vs-nphistwrap').hidden && $('#vs-nphist').checked);
    await stMine(); stBanner(''); await stOpenProject(id, { skipAuto: true }); toast(`“${name}” is on your account.`);
  } catch (e) { toast(stMsg(e)); }
});

// ----- sign in / out, probing the server -----
async function stProbe() { // is there a Studio server to talk to? (no request beyond a health check unless there is)
  try { const r = await fetch(ST.url + '/api/health', { cache: 'no-store' }); const j = r.ok ? await r.json() : null; ST.reach = !!(j && j.name === 'journalwright-studio'); ST.same = ST.reach && !ST.url; } catch { ST.reach = false; }
  if (ST.reach) await stPublicLoad(); else ST.pubs = [];
  $('#vs-url').placeholder = ST.same ? 'This server (Studio is serving the editor)' : 'http://127.0.0.1:8787';
  stDrawCtx();
}
async function stEnter(user) {
  ST.user = user; $('#vs-err').textContent = '';
  await stMine(); await stPublicLoad();
  const last = store.get('kw-st-pid');
  if (last && ST.projects.some((p) => p.id === last)) await stOpenProject(last, { skipAuto: true });
  stDrawCtx(); stChip();
  clearInterval(ST.poll); ST.poll = setInterval(stPoll, 30000);
}
async function stPoll() { // a light check that the branch has not moved under a draft
  if (!stWrites() || document.hidden || ST.saving || ST.loading) return;
  try { const b = (await stApi('GET', P('/branches'))).branches.find((x) => x.name === ST.branch); if (b && b.head !== ST.head.id && !ST.behind) { ST.behind = stDirty() || ST.rev > 0; if (ST.behind) { await stMoved(b.head); stChip(); } else { await stLoad(); } } } catch { /* offline: try again later */ }
}
async function stAuth(kind) {
  const url = $('#vs-url').value.trim().replace(/\/+$/, ''), username = $('#vs-user').value.trim(), password = $('#vs-pass').value;
  $('#vs-err').textContent = '';
  if (!username || !password) { $('#vs-err').textContent = 'Enter a username and password.'; return; }
  ST.url = url; store.set('kw-st-url', url || null);
  try {
    if (kind === 'register') await stApi('POST', '/api/auth/register', { username, password });
    const r = await stApi('POST', '/api/auth/login', { username, password });
    ST.token = r.token; ST.reach = true; store.set('kw-st-token', r.token); $('#vs-pass').value = '';
    await stEnter(r.user); // stays on "This browser" until you pick a project: nothing is uploaded or replaced
  } catch (e) { $('#vs-err').textContent = stMsg(e); }
}
$('#vs-conn').onsubmit = (e) => { e.preventDefault(); stAuth('login'); };
$('#vs-reg').onclick = () => stAuth('register');
$('#vs-url').onchange = () => { ST.url = $('#vs-url').value.trim().replace(/\/+$/, ''); store.set('kw-st-url', ST.url || null); stProbe(); };
$('#vs-out').onclick = async () => {
  if (ST.pending) await stSaveDraft();
  try { await stApi('POST', '/api/auth/logout'); } catch { /* signed out here anyway */ }
  clearInterval(ST.poll); ST.token = ''; ST.user = null; ST.projects = []; store.set('kw-st-token', null);
  if (ST.pid) await stGoLocal({ applyNewest: false }); else stLocalRefresh();
  stBanner(''); stDrawCtx(); setStatus('Signed out of Studio');
};
async function stInit() { // a stored token, or this very server (Studio serves the editor itself)
  $('#vs-url').value = ST.url;
  stCmpClear(); stLocalRefresh();
  await stProbe();
  if (ST.token && ST.reach) { try { const me = await stApi('GET', '/api/me'); await stEnter(me.user); } catch (e) { if (e.status === 401) { ST.token = ''; store.set('kw-st-token', null); } } }
  stDrawCtx();
}

// ----- the drawer -----
function showVersions() {
  const d = $('#versions'); if (!d.open) d.showModal();
  if (!ST.pid) stLocalRefresh(); else { stChip(); stDrawLog(); stDrawCtx(); }
  if (!ST.reach) stProbe();
  if (ST.repaint) ST.repaint();
}
$('#v-ver').onclick = showVersions;
$('#vs-close').onclick = () => $('#versions').close();
$('#versions').addEventListener('click', (e) => { if (e.target === $('#versions')) $('#versions').close(); }); // a click on the backdrop
