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
  catch { throw Object.assign(new Error(_t('ver.cant_reach') + (MODE === 'artifact' ? ' ' + _t('ver.artifact_cant_call') : '')), { offline: true }); }
  let data = null; try { data = await r.json(); } catch { /* not JSON */ }
  if (!r.ok) throw Object.assign(new Error((data && data.error && data.error.message) || _t('ver.studio_said', { status: r.status })), { status: r.status, code: data && data.error && data.error.code, details: data && data.error && data.error.details });
  return data;
}
const stAgo = (iso) => { const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000); if (s < 45) return _t('ver.just_now'); const m = Math.round(s / 60); if (m < 60) return _t('ver.min_ago', { n: m }); const h = Math.round(m / 60); if (h < 24) return _t('ver.h_ago', { n: h }); const d = Math.round(h / 24); return d < 30 ? _t('ver.d_ago', { n: d }) : new Date(iso).toLocaleDateString(); };
const stClock = (d = new Date()) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const stMsg = (e) => (e && e.message) || _t('ver.went_wrong');
const stDay = (L) => STUDIO.canonical(normalize(L));

// ----- versions kept in this browser (no account) -----
const LOC_KEY = 'kw-st-local';
const locRead = () => { try { const j = JSON.parse(store.get(LOC_KEY) || 'null'); return j && Array.isArray(j.versions) ? j.versions : []; } catch { return []; } };
function locWrite(v) { store.set(LOC_KEY, JSON.stringify({ v: 1, versions: v.slice(0, 30) })); if (v.length && !store.get(LOC_KEY)) toast(_t('ver.storage_blocked')); }
const locSnap = (day, book) => ({ meta: {}, print: {}, book: book || KWBK.base() || { default: [], months: {} }, day: normalize(day), assets: [], components: [] }); // the book (organiser.js) rides in a version when it was changed
const locId = () => 'l-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const locView = (v, i, a) => ({ id: v.id, short: v.id.slice(-6), message: v.message, author: { name: _t('ver.you') }, createdAt: v.createdAt, parents: a[i + 1] ? [a[i + 1].id] : [] });
function locAdd(message) { const vs = locRead(); vs.unshift({ id: locId(), message, createdAt: new Date().toISOString(), day: normalize(dayNow()), ...(KWBK.touched ? { book: KWBK.current() } : {}) }); locWrite(vs); }
function stLocalRefresh() {
  const vs = locRead(); ST.log = vs.map(locView); ST.head = null; ST.headSnap = vs[0] ? locSnap(vs[0].day, vs[0].book) : null;
  stChip(); stDrawLog(); stDrawCtx();
}
// The day the current layout is compared with: the newest version (server head, or the newest kept in this browser; none = the original page).
const stBaseDay = () => (stServer() ? ST.headSnap.day : ST.headSnap ? ST.headSnap.day : normalize(null));
const stBaseBook = () => (stServer() ? ST.headSnap.book : ST.headSnap ? ST.headSnap.book : KWBK.base());
const stBookDirty = () => { const c = KWBK.current(), b = stBaseBook(); return !!c && !!b && STUDIO.canonical(c) !== STUDIO.canonical(b); };
const stDirty = () => stDay(dayNow()) !== stDay(stBaseDay()) || stBookDirty();

// ----- state line -----
function stChip() {
  const el = $('#vs-chip'); let t = '', cls = '';
  if (ST.pid && !stCanWrite()) t = _t('ver.read_only');
  else if (!ST.pid) { const n = locRead().length, d = n > 0 && stDirty(); t = !n ? _t('ver.no_versions') : d ? _t('ver.changes_since') : _t('ver.matches_latest'); cls = !n ? '' : d ? 'draft' : 'ok'; }
  else if (!ST.head) t = '';
  else if (ST.behind) { t = _t('ver.branch_moved'); cls = 'draft'; }
  else if (ST.saving) t = _t('ver.saving_draft');
  else if (ST.pending) { t = _t('ver.unsaved_pending'); cls = 'draft'; }
  else if (stDirty() && ST.rev > 0) { t = _t('ver.draft_autosaved', { time: stClock(new Date(ST.draftAt || Date.now())) }); cls = 'draft'; }
  else if (stDirty()) { t = _t('ver.unsaved'); cls = 'draft'; }
  else { t = _t('ver.saved_as_version'); cls = 'ok'; }
  el.className = 'vs-chip' + (cls ? ' ' + cls : '');
  el.innerHTML = t ? `${IC_DOT}<span>${escH(t)}</span>` : '';
  if (stWrites()) setStatus(t + (ST.behind || !stDirty() ? '' : ' · ' + _t('ver.not_version_yet')), cls === 'ok' ? 'ok' : '');
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
  $('#vs-proj').innerHTML = '<option value="">' + _t('ver.this_browser') + '</option>' + ST.projects.map((p) => `<option value="${p.id}">${escH(p.name)}${p.role !== 'owner' ? ' (' + _tx('ver.role_' + p.role, p.role) + ')' : ''}</option>`).join('')
    + (cur && !ST.projects.some((p) => p.id === cur.id) ? `<option value="${cur.id}">${_t('ver.public_name', { name: escH(cur.name) })}</option>` : '') + (ST.user ? '<option value="__new">' + _t('ver.new_project_option') + '</option>' : '');
  $('#vs-proj').value = ST.pid || '';
  $('#vs-brwrap').hidden = !stServer(); $('#vs-nb').hidden = !(stServer() && stCanWrite());
  if (!stServer()) $('#vs-newbr').hidden = true;
  $('#vs-save').hidden = !!ST.pid && !stCanWrite();
  $('#vs-hint').textContent = ST.pid ? _t('ver.hint_project') : _t('ver.hint_browser');
  $('#vs-sub').textContent = ST.pid ? `${ST.pname} · ${ST.branch}${stCanWrite() ? '' : ' · ' + _t('ver.read_only_l')}` : _t('ver.this_browser');
  const pubs = ST.pubs.filter((p) => p.id !== ST.pid);
  $('#vs-pub').hidden = !ST.reach || !pubs.length;
  $('#vs-publist').innerHTML = pubs.map((p) => `<li><div><b>${escH(p.name)}</b><small>${escH(p.description || _t('ver.public_readonly'))} · ${_t('ver.updated_ago', { ago: stAgo(p.updatedAt) })}</small></div><button class="vs-b" data-open="${p.id}" type="button" aria-label="${_t('ver.open_history', { name: escH(p.name) })}">${_t('ver.open')}</button></li>`).join('');
  vpDrawCtx();
  const offer = !ST.pid && !!ST.user && (locRead().length > 0 || stDirty());
  if (offer && $('#vs-banner').hidden) {
    stBanner('<p>' + _t('ver.move_banner') + '</p><div class="vs-acts"><button class="btn" id="vb-move" type="button">' + _t('ver.move_it') + '</button></div>', (b) => { b.querySelector('#vb-move').onclick = () => stOpenNp(true); }, 'info');
    ST.moveBanner = true;
  } else if (!offer && ST.moveBanner) stBanner('');
}

// ----- draft autosave (the editor's queueSave calls this) -----
function stQueueDraft() {
  if (!ST.pid && !ST.loading) { stChip(); stDrawLog(); return; } // this browser: no draft to send, just keep the state line and the list honest
  if (!stWrites() || ST.loading) return;
  if (ST.rev === 0 && !stDirty() && !KWLIB.touched && !KWBK.touched) { stChip(); return; } // KWLIB: the library (L1b) rides in the same draft
  ST.pending = true; stChip(); clearTimeout(ST.timer); ST.timer = setTimeout(stSaveDraft, 900);
}
async function stSaveDraft() {
  if (!stWrites()) return true;
  if (ST.saving) { ST.again = true; return false; }
  clearTimeout(ST.timer); ST.saving = true; ST.pending = false; stChip();
  let ok = false;
  try {
    const r = await stApi('PUT', P(`/drafts/${enc(ST.branch)}`), { base: ST.base || undefined, rev: ST.rev, snapshot: { day: dayNow(), ...KWLIB.part(), ...KWBK.part() } });
    ST.rev = r.rev; ST.base = r.base; ST.draftAt = r.updatedAt; ok = true;
    if (r.head !== ST.head.id) { ST.behind = true; await stMoved(r.head); } else ST.behind = false;
  } catch (e) {
    if (e.code === 'draft_conflict' || e.code === 'draft_base_mismatch' || e.code === 'draft_gone') stBanner('<p>' + _t('ver.draft_other_tab') + '</p><div class="vs-acts"><button class="btn" id="vb-reload" type="button">' + _t('ver.reload_draft') + '</button></div>', (b) => { b.querySelector('#vb-reload').onclick = () => stLoad(); });
    else setStatus(_t('ver.not_autosaved', { why: stMsg(e) }), 'bad');
  } finally { ST.saving = false; if (ST.again) { ST.again = false; stQueueDraft(); } stChip(); }
  return ok;
}

// ----- putting a version into the editor -----
function stApply(day, persist = false) {
  if (PGE) { pgeLeave(); navGo({ level: 'book' }, { push: false }); } // a version replaces the day layout (and maybe the book): the page editor closes behind it
  spdLeave(); // (a spread day: back to the day layout first; the spread rides inside it and comes back below)
  const same = stDay(dayNow()) === stDay(day);
  if (!same) snapshot();
  ST.loading = true; try { selected = null; layout = normalize(day); spdEnsure(); drawList(); drawPalette(); drawPreview(); drawSpan(); } finally { ST.loading = false; }
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
  if (writable && !ST.pid && !skipAuto) stAutoLocal(_t('ver.before_opening', { name: p.name }));
  ST.wasWritable = writable;
  ST.pid = id; ST.pname = p.name; ST.role = role; store.set('kw-st-pid', mine ? id : null);
  const saved = (store.get('kw-st-branch') || '').split('|'); ST.branch = saved[0] === id && saved[1] ? saved[1] : p.defaultBranch || 'main';
  ST.cache.clear(); ST.sel = ''; stCmpClear(); vpReset();
  await stLoad();
  if (!ST.head && ST.branch !== 'main') { ST.branch = 'main'; await stLoad(); }
  vpLoad(true);
}
async function stGoLocal({ applyNewest = true } = {}) {
  const was = ST.wasWritable; ST.wasWritable = false;
  clearTimeout(ST.timer); ST.pending = false; ST.saving = false;
  Object.assign(ST, { pid: '', pname: '', role: '', head: null, headSnap: null, branch: 'main', behind: false, rev: 0, base: '', sel: '' }); ST.cache.clear();
  store.set('kw-st-pid', null); stBanner(''); stCmpClear(); vpReset();
  const vs = locRead();
  if (was && applyNewest && vs[0]) { stApply(vs[0].day, true); KWBK.load(vs[0].book || null); toast(_t('ver.back_latest')); }
  if (was) KWLIB.local(); // the library goes back to this browser's too
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
      stBanner(`<p>${ST.role === 'public' ? _t('ver.reading_public', { name: escH(ST.pname) }) : _t('ver.reading', { name: escH(ST.pname) })}</p><div class="vs-acts"><button class="btn" id="vb-home" type="button">${_t('ver.back_browser')}</button></div>`, (b) => { b.querySelector('#vb-home').onclick = () => stGoLocal({ applyNewest: false }); }, 'info');
      return;
    }
    let dr = null;
    try { dr = (await stApi('GET', P(`/drafts/${enc(ST.branch)}`))).draft; } catch (e) { if (e.status !== 403) throw e; }
    let changed;
    if (dr) { ST.rev = dr.rev; ST.base = dr.base; ST.behind = dr.behind; ST.draftAt = dr.updatedAt; changed = stApply(dr.snapshot.day); KWLIB.fromSnapshot(dr.snapshot); KWBK.load(dr.snapshot.book); }
    else { ST.rev = 0; ST.base = h.commit.id; ST.behind = false; ST.draftAt = ''; changed = stApply(h.snapshot.day); KWLIB.fromSnapshot(h.snapshot); KWBK.load(h.snapshot.book); }
    ST.loading = false;
    await stLog();
    if (ST.behind) await stMoved(ST.head.id);
    if (changed) toast(dr ? _t('ver.loaded_draft') : _t('ver.loaded_version'));
  } catch (e) { setStatus(stMsg(e), 'bad'); stBanner(`<p>${escH(stMsg(e))}</p>`); }
  finally { ST.loading = false; stChip(); stDrawLog(); stDrawCtx(); }
}
async function stLog() {
  const [lg, br] = await Promise.all([stApi('GET', P(`/log?branch=${enc(ST.branch)}&limit=60`)), stApi('GET', P('/branches'))]);
  ST.log = lg.commits; ST.branches = br.branches;
  $('#vs-br').innerHTML = ST.branches.map((b) => `<option value="${escH(b.name)}"${b.name === ST.branch ? ' selected' : ''}>${escH(b.name)}${b.isDefault ? ' ' + _t('ver.paren_main_line') : ''}</option>`).join('');
}
async function stMoved(headId) { // the branch has a newer version than the one this draft started from
  let c = ST.log.find((x) => x.id === headId);
  if (!c) { try { await stLog(); c = ST.log.find((x) => x.id === headId); } catch { /* keep going */ } }
  const who = c ? _t('ver.who_saved', { name: escH(c.author.name), message: escH(c.message), ago: stAgo(c.createdAt) }) : _t('ver.newer_saved');
  stBanner(`<p>${who}. ${_t('ver.draft_safe')}</p><div class="vs-acts"><button class="btn" id="vb-see" type="button">${_t('ver.see_changed')}</button><button class="btn" id="vb-mine" type="button">${_t('ver.keep_mine')}</button><button class="btn" id="vb-theirs" type="button">${_t('ver.start_theirs')}</button></div>`, (b) => {
    b.querySelector('#vb-see').onclick = () => stCompare(ST.base, headId, _t('ver.changed_while'));
    b.querySelector('#vb-mine').onclick = stKeepMine;
    b.querySelector('#vb-theirs').onclick = async () => { if (!confirm(_t('ver.discard_confirm'))) return; try { await stApi('DELETE', P(`/drafts/${enc(ST.branch)}`)); await stLoad(); } catch (e) { toast(stMsg(e)); } };
  });
}
async function stKeepMine() { // conflict, keep both: my draft becomes a version on a fresh branch that starts where I started
  const name = `${ST.user.username}-${new Date().toISOString().slice(5, 16).replace(/[-:T]/g, '')}`;
  try {
    await stApi('POST', P('/branches'), { name, from: ST.base });
    await stApi('POST', P('/commits'), { branch: name, expectedHead: ST.base, message: _t('ver.my_changes_msg'), snapshot: { day: dayNow(), ...KWBK.part() } });
    await stApi('DELETE', P(`/drafts/${enc(ST.branch)}`));
    ST.branch = name; store.set('kw-st-branch', `${ST.pid}|${name}`); await stLoad(); toast(_t('ver.saved_on_branch', { name }));
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
    ? `<li class="vs-c draft"><div class="vs-cm"><span class="vs-msg">${_t('ver.your_unsaved')}</span><code class="vs-h">${_t('ver.short_draft')}</code></div><div class="vs-meta">${!ST.pid ? _t('ver.not_version_browser') : ST.rev > 0 ? _t('ver.autosaved_on', { time: stClock(new Date(ST.draftAt)), branch: escH(ST.branch) }) : _t('ver.not_autosaved_yet')}</div><div class="vs-acts"><button class="vs-b" data-cmp="draft" aria-label="${_t('ver.compare_unsaved')}">${IC_CMP}<span class="lab">${_t('ver.compare')}</span></button></div></li>` : '';
  ol.innerHTML = draft + ST.log.map((c) => `<li class="vs-c${c.id === head ? ' cur' : ''}${c.id === ST.sel ? ' sel' : ''}" data-id="${c.id}">
    <div class="vs-cm"><span class="vs-msg">${escH(c.message)}</span><code class="vs-h" title="${c.id}">${c.short}</code></div>
    <div class="vs-meta">${escH(c.author.name)} · <time datetime="${c.createdAt}" title="${escH(new Date(c.createdAt).toLocaleString())}">${stAgo(c.createdAt)}</time>${c.id === head ? ' · <b>' + _t('ver.latest') + '</b>' : ''}${c.id === ST.base && ST.rev > 0 && c.id !== head ? ' · <b>' + _t('ver.draft_starts') + '</b>' : ''}</div>
    <div class="vs-acts"><button class="vs-b" data-cmp="${c.id}" aria-label="${_t('ver.compare_prev', { message: escH(c.message) })}">${IC_CMP}<span class="lab">${_t('ver.compare')}</span></button>${c.id !== head && canRestore ? `<button class="vs-b" data-restore="${c.id}" aria-label="${_t('ver.restore_as_new', { message: escH(c.message) })}">${IC_RESTORE}<span class="lab">${_t('ver.restore')}</span></button>` : ''}</div></li>`).join('') || `<li class="vs-empty">${ST.pid ? _t('ver.no_versions_dot') : _t('ver.no_versions_save')}</li>`;
  ST.newest = newest;
}
$('#vs-log').addEventListener('click', (e) => {
  const c = e.target.closest('[data-cmp]'), r = e.target.closest('[data-restore]');
  if (c) { const id = c.dataset.cmp; if (id === 'draft') return stCompare(ST.newest, 'draft', _t('ver.your_unsaved')); const x = ST.log.find((y) => y.id === id); ST.sel = id; stDrawLog(); return stCompare(x.parents[0] || x.id, x.id, x.message); }
  if (r) stRestore(r.dataset.restore);
});

// ----- save a version -----
async function stSaveVersion() {
  const msg = $('#vs-msg').value.trim();
  if (!msg) { $('#vs-msg').focus(); toast(_t('ver.add_words')); return; }
  if (!ST.pid) { // this browser
    if (locRead().length && !stDirty()) { toast(_t('ver.nothing_new_latest')); return; }
    locAdd(msg); $('#vs-msg').value = ''; stBanner(''); stLocalRefresh(); toast(_t('ver.saved_in_browser', { message: msg })); return;
  }
  if (!stDirty() && ST.rev === 0) { toast(_t('ver.nothing_new_latest')); return; }
  $('#vs-savebtn').disabled = true;
  try {
    if (!(await stSaveDraft()) && ST.rev === 0) throw new Error(_t('ver.cant_save_first'));
    const r = await stApi('POST', P(`/drafts/${enc(ST.branch)}/promote`), { message: msg, expectedHead: ST.head.id });
    $('#vs-msg').value = ''; ST.rev = 0; ST.behind = false; stBanner('');
    const h = await stApi('GET', P(`/head?branch=${enc(ST.branch)}`)); ST.head = h.commit; ST.headSnap = h.snapshot; ST.base = h.commit.id; ST.cache.set(h.commit.id, h);
    await stLog(); dirty = false; toast(r.unchanged ? _t('ver.nothing_changed') : _t('ver.saved_msg', { message: r.commit.message }));
  } catch (e) {
    if (e.code === 'head_moved') await stMoved(e.details.head); else if (e.code === 'no_draft') toast(_t('ver.nothing_new')); else toast(stMsg(e));
  } finally { $('#vs-savebtn').disabled = !stCanWrite(); stChip(); stDrawLog(); }
}
$('#vs-save').onsubmit = (e) => { e.preventDefault(); stSaveVersion(); };

// ----- restore (a new version; history is never rewritten) -----
async function stRestore(id) {
  const c = ST.log.find((x) => x.id === id); if (!c) return;
  if (!ST.pid) {
    const v = locRead().find((x) => x.id === id); if (!v) return;
    const extra = stDirty() ? ' ' + _t('ver.extra_kept') : '';
    if (!confirm(`${_t('ver.restore_confirm_browser', { message: c.message })}${extra}`)) return;
    stApply(v.day, true); KWBK.load(v.book || null); locAdd(_t('ver.restore_msg', { message: c.message })); stLocalRefresh(); toast(_t('ver.restored_new')); return;
  }
  const extra = stDirty() ? ' ' + _t('ver.extra_history') : '';
  if (!confirm(`${_t('ver.restore_confirm_branch', { message: c.message, short: c.short, branch: ST.branch })}${extra}`)) return;
  try {
    if (ST.rev > 0) await stApi('DELETE', P(`/drafts/${enc(ST.branch)}`));
    const r = await stApi('POST', P('/restore'), { commit: id, branch: ST.branch, expectedHead: ST.head.id });
    ST.rev = 0; await stLoad(); toast(r.unchanged ? _t('ver.already_latest') : _t('ver.restored_short', { short: c.short }));
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
    await stSwitch(name); toast(_t('ver.on_new_branch', { name }));
  } catch (e2) { toast(stMsg(e2)); }
};
async function stSwitch(name) { ST.branch = name; store.set('kw-st-branch', `${ST.pid}|${name}`); ST.sel = ''; stCmpClear(); await stLoad(); }
$('#vs-br').onchange = async (e) => { if (ST.pending) await stSaveDraft(); await stSwitch(e.target.value); };

// ----- compare: real page renderers, changed blocks marked -----
const stName = (t) => tName(t);
const stBlockLabel = (b) => stName(b.type) + (b.title && typeof b.title === 'string' ? ' ' + _t('lib.quoted', { title: b.title }) : '');
function stFmt(v) { if (v === null || v === undefined) return _t('ver.f_none'); if (v === true) return _t('ver.f_on'); if (v === false) return _t('ver.f_off'); if (Array.isArray(v)) return v.length ? v.map(stFmt).join(', ') : _t('ver.f_none'); if (typeof v === 'object') { const j = JSON.stringify(v); return j.length > 60 ? j.slice(0, 60) + '…' : j; } const s = String(v); return s === '' ? _t('ver.f_empty') : s.length > 40 ? s.slice(0, 40) + '…' : s; }
function stFieldText(type, f) {
  if (f.key === 'on') return f.after ? _t('ver.turned_on') : _t('ver.turned_off');
  const m = f.key.match(/^rows\.([a-z_0-9]+)(?:\.(.+))?$/);
  if (m) { const row = crName(m[1]), what = m[2]; if (!what) return f.after === 'added' ? _t('ver.care_added', { row }) : _t('ver.care_removed', { row }); return _t('ver.care_field', { row: row + (what === 'on' ? '' : ' › ' + what), before: stFmt(f.before), after: stFmt(f.after) }); }
  const o = ((TYPES[type] || {}).opts || []).find((x) => x.k === f.key), place = { col: _t('ver.grid_col'), row: _t('ver.grid_row'), colSpan: _t('ver.grid_w'), rowSpan: _t('ver.grid_h') }[f.key];
  return _t('ver.field_change', { what: o ? o.label : place || f.key, before: stFmt(f.before), after: stFmt(f.after) });
}
const stCmpClear = () => { $('#vs-cols').dataset.pane = 'log'; ST.repaint = null; $('#vs-cmp').innerHTML = '<p class="vs-empty">' + _t('ver.pick_compare') + '</p>'; };
async function stSnap(ref) {
  if (ref === 'base') return { commit: { short: _t('ver.short_start'), message: _t('ver.original_page') }, snapshot: locSnap(null) };
  if (ref === 'draft') return { commit: { short: _t('ver.short_draft'), message: _t('ver.your_unsaved') }, snapshot: { ...(ST.headSnap || locSnap(null)), day: normalize(dayNow()), ...(KWBK.current() ? { book: KWBK.current() } : {}) } };
  if (typeof ref === 'string' && ref.startsWith('l-')) { const v = locRead().find((x) => x.id === ref); if (!v) throw new Error(_t('ver.version_gone')); return { commit: { short: v.id.slice(-6), message: v.message }, snapshot: locSnap(v.day, v.book) }; }
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
const stEntryName = (e) => { const t = BK.data && BK.data.types.find((x) => x.key === e.type); return t ? t.name : e.type === 'weeks' ? _t('ver.the_weeks') : e.type; };
async function stCompare(a, b, title) {
  const box = $('#vs-cmp'); $('#vs-cols').dataset.pane = 'cmp';
  box.innerHTML = '<p class="vs-empty">' + _t('ver.comparing') + '</p>';
  try {
    if (!BK.data) { try { BK.data = await bkLoadData(); } catch { /* thumbnails are optional */ } }
    stThumbCss(); stInjectCss();
    const [A, B] = await Promise.all([stSnap(a), stSnap(b)]);
    const df = STUDIO.diffSnapshots(A.snapshot, B.snapshot), sm = df.summary;
    const chip = (n, l) => `<span${n ? ' class="on"' : ''}>${l}: ${n ? _t('ver.n_changes', { n }) : _t('ver.f_none')}</span>`;
    const ad = Object.fromEntries(A.snapshot.day.blocks.map((x) => [x.uid, x])), bd = Object.fromEntries(B.snapshot.day.blocks.map((x) => [x.uid, x]));
    const mA = {}, mB = {}, rows = [];
    if (df.day.grid) rows.push(['chg', _t('ver.b_changed'), df.day.grid.after ? _t('ver.grid_on') : _t('ver.grid_off'), df.day.grid.after ? _t('ver.grid_on_why') : _t('ver.grid_off_why')]);
    for (const x of df.day.added) { mB[x.id] = ['add', _t('ver.b_new')]; rows.push(['add', _t('ver.b_added'), `${stBlockLabel(bd[x.id])}`, '']); }
    for (const x of df.day.removed) { mA[x.id] = ['del', _t('ver.b_removed')]; rows.push(['del', _t('ver.b_removed'), stBlockLabel(ad[x.id]), '']); }
    for (const x of df.day.moved) { mA[x.id] = ['mov', _t('ver.b_moved')]; mB[x.id] = ['mov', _t('ver.b_moved')]; rows.push(['mov', _t('ver.b_moved'), stBlockLabel(bd[x.id]), _t('ver.from_position', { from: x.from + 1, to: x.to + 1 })]); }
    for (const x of df.day.changed) {
      const on = x.fields.find((f) => f.key === 'on');
      mA[x.id] = ['chg', on && !on.after ? _t('ver.turned_off') : _t('ver.b_changed')]; mB[x.id] = ['chg', on && on.after ? _t('ver.turned_on') : _t('ver.b_changed')];
      rows.push(['chg', _t('ver.b_changed'), stBlockLabel(bd[x.id]), x.fields.map((f) => stFieldText(x.type, f)).join(' · ')]);
    }
    const li = (k, w, t, s) => `<li><span class="bd ${k}">${w}</span><span class="tx">${escH(t)}${s ? `<small>${escH(s)}</small>` : ''}</span></li>`;
    const bookRows = [];
    for (const x of df.book.added) bookRows.push(`<li>${stThumb(x)}<span class="bd add">${_t('ver.b_added')}</span><span class="tx">${escH(stEntryName(x))}<small>${escH(x.id)}</small></span></li>`);
    for (const x of df.book.removed) bookRows.push(`<li>${stThumb(x)}<span class="bd del">${_t('ver.b_removed')}</span><span class="tx">${escH(stEntryName(x))}<small>${escH(x.id)}</small></span></li>`);
    for (const x of df.book.moved) bookRows.push(`<li>${stThumb(x)}<span class="bd mov">${_t('ver.b_moved')}</span><span class="tx">${escH(stEntryName(x))}<small>${escH(x.id)} · ${_t('ver.position_range', { from: x.from + 1, to: x.to + 1 })}${x.list.includes('>') ? ' ' + _t('ver.paren_pages', { name: escH(x.list.split('>')[1]) }) : ''}</small></span></li>`);
    for (const x of df.book.changed) bookRows.push(`<li>${stThumb(x)}<span class="bd chg">${_t('ver.b_changed')}</span><span class="tx">${escH(stEntryName(x))}<small>${escH(x.id)} · ${x.fields.map((f) => (f.key === 'on' ? (f.after ? _t('ver.shown_in_book') : _t('ver.hidden_from_book')) : `${f.key.replace(/^options\./, '')}: ${stFmt(f.before)} → ${stFmt(f.after)}`)).join(' · ')}</small></span></li>`);
    const other = [...df.meta.map((f) => [_t('ver.title_details'), f]), ...df.print.map((f) => [_t('ver.print_settings'), f])].map(([w, f]) => li('chg', _t('ver.b_changed'), `${w}: ${f.key}`, `${stFmt(f.before)} → ${stFmt(f.after)}`));
    const extra = [...df.assets.added.map((x) => li('add', _t('ver.b_added'), _t('ver.image_id', { id: x.id }), '')), ...df.assets.removed.map((x) => li('del', _t('ver.b_removed'), _t('ver.image_id', { id: x.id }), '')), ...df.assets.changed.map((x) => li('chg', _t('ver.b_changed'), _t('ver.image_id', { id: x.id }), ''))];
    const cap = (X) => `<code class="vs-h">${escH(X.commit.short)}</code> <span class="cm">${escH(X.commit.message)}</span>`;
    const local = a.startsWith('l-') || a === 'base' || (!ST.pid); // this browser keeps the day page only: no book pages to compare
    box.innerHTML = `<div class="vs-cmp-h"><button class="vs-b vs-back" id="vs-cback" type="button">${IC_BACK}<span>${_t('ver.history')}</span></button><div><b>${escH(title || _t('ver.compare'))}</b><small>${escH(A.commit.short)} → ${escH(B.commit.short)}</small></div></div>
      <div class="vs-sum">${chip(sm.day, _t('ver.day_page'))}${local ? '' : chip(sm.book, _t('ver.book_pages'))}${local ? '' : chip(sm.meta + sm.print + sm.assets, _t('ver.settings'))}</div>
      <section><h3 class="sec">${_t('ver.day_page')}</h3><div class="vs-pair"><figure><figcaption>${_t('ver.before')} ${cap(A)}</figcaption><div class="vs-pg" id="vs-pa"></div></figure><figure><figcaption>${_t('ver.after')} ${cap(B)}</figcaption><div class="vs-pg" id="vs-pb"></div></figure></div>
        <ul class="vs-chg">${rows.map((r) => li(...r)).join('') || '<li><span class="tx">' + _t('ver.day_same') + '</span></li>'}</ul></section>
      ${local ? '' : `<section><h3 class="sec">${_t('ver.book_pages')}</h3><ul class="vs-chg">${bookRows.join('') || '<li><span class="tx">' + _t('ver.pages_same') + '</span></li>'}</ul></section>`}
      ${!local && (other.length || extra.length) ? `<section><h3 class="sec">${_t('ver.details')}</h3><ul class="vs-chg">${other.join('')}${extra.join('')}</ul></section>` : ''}`;
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
  $('#vs-nph').textContent = moving ? _t('ver.move_title') : _t('ver.np_title');
  $('#vs-npp').textContent = moving ? _t('ver.move_text') : _t('ver.np_text');
  $('#vs-nphistwrap').hidden = !(moving && n); $('#vs-nphist').checked = true;
  $('#vs-nphistl').textContent = _t('ver.include_n', { n });
  $('#vs-npname').value = ''; $('#vs-np').showModal();
}
async function stCreateProject(name, visibility, allowReuse, withHistory) {
  const vs = withHistory ? locRead().slice().reverse() : []; // oldest first
  const first = vs.shift();
  const r = await stApi('POST', '/api/projects', { name, visibility, allowReuse, message: first ? first.message : _t('ver.first_version_msg'), snapshot: { day: first ? first.day : dayNow(), ...(first ? (first.book ? { book: first.book } : {}) : KWBK.part()) } });
  const id = r.project.id; let head = r.project.head, lastDay = first ? first.day : dayNow();
  for (const v of vs) { const c = await stApi('POST', `/api/projects/${id}/commits`, { branch: 'main', expectedHead: head, message: v.message, snapshot: { day: v.day, ...(v.book ? { book: v.book } : {}) } }); head = c.commit.id; lastDay = v.day; }
  if (stDay(dayNow()) !== stDay(lastDay)) { const c = await stApi('POST', `/api/projects/${id}/commits`, { branch: 'main', expectedHead: head, message: _t('ver.latest_changes_msg'), snapshot: { day: dayNow(), ...KWBK.part() } }); head = c.commit.id; }
  return id;
}
$('#vs-np').addEventListener('close', async () => {
  if ($('#vs-np').returnValue !== 'create') return;
  const name = $('#vs-npname').value.trim() || _t('ver.my_journal');
  try {
    const id = await stCreateProject(name, $('#vs-npvis').value, $('#vs-npreuse').checked, !$('#vs-nphistwrap').hidden && $('#vs-nphist').checked);
    await stMine(); stBanner(''); await stOpenProject(id, { skipAuto: true }); toast(_t('ver.on_account', { name }));
  } catch (e) { toast(stMsg(e)); }
});

// ----- sign in / out, probing the server -----
async function stProbe() { // is there a Studio server to talk to? (no request beyond a health check unless there is)
  try { const r = await fetch(ST.url + '/api/health', { cache: 'no-store' }); const j = r.ok ? await r.json() : null; ST.reach = !!(j && j.name === 'journalwright-studio'); ST.same = ST.reach && !ST.url; } catch { ST.reach = false; }
  if (ST.reach) await stPublicLoad(); else ST.pubs = [];
  $('#vs-url').placeholder = ST.same ? _t('ver.this_server') : 'http://127.0.0.1:8787';
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
  if (!username || !password) { $('#vs-err').textContent = _t('ver.enter_credentials'); return; }
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
  stBanner(''); stDrawCtx(); setStatus(_t('ver.signed_out'));
};
async function stInit() { // a stored token, or this very server (Studio serves the editor itself)
  if (MODE === 'demo') { $('#v-ver').hidden = true; return; } // the public demo saves nothing anywhere: no versions, no server
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

// ---------- forks, change proposals, merges (Phase G2) ----------
// Fork: a copy that credits the original and has its own history. Proposal: the fork's owner asks upstream to take some changes; the
// reviewer sees them page by page and block by block (the real renderers), discusses, accepts selected changes or merges everything.
// Merge conflicts (the same thing changed differently on both sides) are resolved here, each one shown with both versions rendered.
// The server decides who may do what; this only shows what the server says you can do (proposal.can) and never edits your own page.
const VP = { tab: 'hist', list: [], cur: null, prop: null, d: null, sel: new Set(), conf: [], mode: null, res: {}, hand: {}, err: '', busy: false };
const VPW = { get open() { return _t('ver.st_open'); }, get changes_requested() { return _t('ver.st_changes'); }, get approved() { return _t('ver.st_approved'); }, get merged() { return _t('ver.st_merged'); }, get closed() { return _t('ver.st_closed'); } };
const vpP = (pid, s = '') => `/api/projects/${pid}${s}`;
const stCur = () => ST.projects.find((p) => p.id === ST.pid) || ST.pubs.find((p) => p.id === ST.pid) || null;
const vpPill = (s) => `<span class="vp-pill ${s}">${VPW[s] || s}</span>`;
const vpVal = (v) => (v === null || v === undefined ? _t('ver.f_none') : v === true ? _t('ver.f_on') : v === false ? _t('ver.f_off') : Array.isArray(v) ? (v.length ? v.map(vpVal).join(', ') : _t('ver.f_none')) : typeof v === 'object' ? JSON.stringify(v) : String(v) === '' ? _t('ver.f_empty') : String(v));

function vpAttr(p) {
  if (!p) return '';
  const a = p.attribution;
  if (a) return _t('ver.forked_from', { source: escH(a.source.name), creator: escH(a.creator.name) }) + (a.license ? ' · ' + _t('ver.license', { license: escH(a.license) }) : '') + (a.credit ? ' · ' + escH(a.credit) : '');
  const terms = [p.license && _t('ver.license', { license: escH(p.license) }), p.credit && escH(p.credit)].filter(Boolean).join(' · ');
  return p.allowReuse ? `${_t('ver.others_may_fork')}${terms ? ` · ${terms}` : ''}` : '';
}
function vpDrawCtx() { // called at the end of stDrawCtx: the tabs, the fork button, the credit line, which pane shows
  const server = stServer(), p = stCur();
  if (!server) VP.tab = 'hist';
  $('#vs-tabs').hidden = !server;
  $('#vs-fork').hidden = !(server && p && p.allowReuse);
  const at = server ? vpAttr(p) : ''; $('#vs-attr').hidden = !at; $('#vs-attr').innerHTML = at;
  const prop = server && VP.tab === 'prop';
  $('#vs-cols').hidden = prop; $('#vp').hidden = !prop; if (prop) $('#vs-save').hidden = true;
  vlDraw(server && !prop);
  $('#vs-t-hist').setAttribute('aria-pressed', String(!prop)); $('#vs-t-prop').setAttribute('aria-pressed', String(prop));
}
function vpTab(t) { VP.tab = t; stDrawCtx(); if (t === 'prop') vpLoad(); }
$('#vs-t-hist').onclick = () => vpTab('hist');
$('#vs-t-prop').onclick = () => vpTab('prop');
function vpReset() { VP.tab = 'hist'; VP.list = []; VP.cur = null; VP.prop = null; VP.d = null; $('#vp-listv').hidden = false; $('#vp-detv').hidden = true; $('#vp-detv').innerHTML = ''; $('#vs-t-n').hidden = true; }

// ----- fork -----
$('#vs-fork').onclick = () => {
  const p = stCur(); if (!p) return;
  if (!ST.user) { toast(_t('ver.sign_in_to_fork')); $('#vs-user').focus(); return; }
  $('#vs-fkname').value = p.name; $('#vs-fkvis').value = 'private'; $('#vs-fkreuse').checked = false; $('#vs-fkerr').textContent = '';
  $('#vs-fkp').innerHTML = `${_t('ver.fork_copy', { author: escH(p.attribution ? p.attribution.creator.name : _t('ver.original_author')) })}${p.license ? ' ' + _t('ver.paren_license', { license: escH(p.license) }) : ''}. ${_t('ver.fork_yours')}`;
  $('#vs-fk').showModal(); $('#vs-fkname').focus();
};
$('#vs-fkx').onclick = () => $('#vs-fk').close();
$('#vs-fkf').onsubmit = async (e) => {
  e.preventDefault();
  try {
    const r = await stApi('POST', vpP(ST.pid, '/forks'), { name: $('#vs-fkname').value.trim() || undefined, visibility: $('#vs-fkvis').value, allowReuse: $('#vs-fkreuse').checked });
    $('#vs-fk').close(); await stMine(); await stOpenProject(r.project.id); toast(_t('ver.your_copy', { name: r.project.name, creator: r.project.attribution.creator.name }));
  } catch (e2) { $('#vs-fkerr').textContent = stMsg(e2); }
};

// ----- the list -----
async function vpLoad(quiet) {
  if (!stServer()) return;
  try {
    const p = stCur(), mine = (await stApi('GET', vpP(ST.pid, '/proposals'))).proposals.map((x) => ({ ...x, dir: 'in' }));
    let out = [];
    if (p && p.source && ST.user) { try { out = (await stApi('GET', vpP(p.source.project, '/proposals'))).proposals.filter((x) => x.source.project && x.source.project.id === ST.pid).map((x) => ({ ...x, dir: 'out' })); } catch { out = []; } }
    VP.list = [...mine, ...out];
    const open = VP.list.filter((x) => ['open', 'changes_requested', 'approved'].includes(x.status)).length;
    $('#vs-t-n').hidden = !open; $('#vs-t-n').textContent = open; $('#vs-t-n').setAttribute('aria-label', _t('ver.n_open', { n: open }));
    if (!quiet) vpDrawList();
  } catch (e) { if (!quiet) $('#vp-list').innerHTML = `<li class="vs-empty">${escH(stMsg(e))}</li>`; }
}
function vpDrawList() {
  const p = stCur(), canProp = !!ST.user && stCanWrite() && ((p && p.source) || ST.branches.length > 1);
  $('#vp-new').hidden = !canProp;
  $('#vp-hint').textContent = p && p.source ? _t('ver.prop_hint_fork') : _t('ver.prop_hint');
  $('#vp-list').innerHTML = VP.list.map((x) => `<li><button class="vp-item" type="button" data-p="${x.target.project.id}" data-n="${x.number}" aria-label="${_t('ver.prop_label', { n: x.number, title: escH(x.title), status: VPW[x.status] })}">
      <span class="t"><span>${escH(x.title)}</span>${vpPill(x.status)}</span>
      <span class="m">#${x.number} · ${x.dir === 'out' ? _t('ver.sent_to', { name: escH(x.target.project.name) }) : `${_t('ver.from_author', { name: escH(x.author.name) })}${x.source.project ? ` · ${escH(x.source.project.name)}` : ''}`} · ${escH(x.source.branch)} → ${escH(x.target.branch)} · ${stAgo(x.updatedAt)}</span></button></li>`).join('') || '<li class="vs-empty">' + _t('ver.no_proposals') + '</li>';
}
$('#vp-list').addEventListener('click', (e) => { const b = e.target.closest('[data-p]'); if (b) vpOpen(b.dataset.p, +b.dataset.n); });

// ----- new proposal -----
$('#vp-new').onclick = async () => {
  const p = stCur(), fork = p && p.source; $('#vp-nperr').textContent = ''; $('#vp-nptitle').value = ''; $('#vp-npdesc').value = '';
  $('#vp-npsrc').innerHTML = ST.branches.map((b) => `<option value="${escH(b.name)}"${b.name === ST.branch ? ' selected' : ''}>${escH(b.name)}</option>`).join('');
  try {
    if (fork) { const br = (await stApi('GET', vpP(p.source.project, '/branches'))).branches, up = await stApi('GET', vpP(p.source.project)); VP.np = { target: p.source.project }; $('#vp-nptgt').innerHTML = br.map((b) => `<option value="${escH(b.name)}"${b.isDefault ? ' selected' : ''}>${escH(up.project.name)} · ${escH(b.name)}</option>`).join(''); $('#vp-npp').textContent = _t('ver.ask_take', { name: up.project.name }); }
    else { VP.np = { target: ST.pid }; $('#vp-nptgt').innerHTML = ST.branches.map((b) => `<option value="${escH(b.name)}"${b.isDefault ? ' selected' : ''}>${escH(b.name)}</option>`).join(''); $('#vp-npp').textContent = _t('ver.propose_merge'); }
    $('#vp-np').showModal(); $('#vp-nptitle').focus();
  } catch (e) { toast(stMsg(e)); }
};
$('#vp-npx').onclick = () => $('#vp-np').close();
$('#vp-npf').onsubmit = async (e) => {
  e.preventDefault(); const title = $('#vp-nptitle').value.trim();
  if (!title) { $('#vp-nperr').textContent = _t('ver.give_title'); $('#vp-nptitle').focus(); return; }
  try {
    if (ST.pending) await stSaveDraft();
    const r = await stApi('POST', vpP(VP.np.target, '/proposals'), { sourceProject: ST.pid, sourceBranch: $('#vp-npsrc').value, targetBranch: $('#vp-nptgt').value, title, description: $('#vp-npdesc').value });
    $('#vp-np').close(); await vpLoad(); await vpOpen(VP.np.target, r.proposal.number); toast(_t('ver.prop_sent'));
  } catch (e2) { $('#vp-nperr').textContent = stMsg(e2); }
};

// ----- one proposal -----
async function vpOpen(pid, n, keepSel) {
  VP.cur = { pid, n }; VP.err = ''; if (!keepSel) VP.sel = new Set(); VP.conf = []; VP.mode = null;
  $('#vp-listv').hidden = true; const box = $('#vp-detv'); box.hidden = false; box.innerHTML = '<p class="vs-empty">' + _t('ver.loading') + '</p>';
  try {
    if (!BK.data) { try { BK.data = await bkLoadData(); } catch { /* thumbnails are optional */ } }
    stThumbCss(); stInjectCss();
    const [pr, cmp] = await Promise.all([stApi('GET', vpP(pid, `/proposals/${n}`)), stApi('GET', vpP(pid, `/proposals/${n}/compare`)).catch((e) => ({ error: stMsg(e) }))]);
    VP.prop = pr.proposal; VP.d = cmp.error ? null : cmp; VP.dErr = cmp.error || '';
    vpDrawDetail();
  } catch (e) { box.innerHTML = `<p class="vs-empty">${escH(stMsg(e))}</p><div class="vs-acts"><button class="btn" id="vp-back" type="button">${_t('ver.back_proposals')}</button></div>`; $('#vp-back').onclick = vpBack; }
}
function vpBack() { VP.cur = null; VP.d = null; $('#vp-detv').hidden = true; $('#vp-listv').hidden = false; vpLoad(); }
const vpHeads = () => ({ ours: VP.d.commits.ours.id, theirs: VP.d.commits.theirs.id });
const vpBadge = { get added() { return ['add', _t('ver.b_added')]; }, get removed() { return ['del', _t('ver.b_removed')]; }, get changed() { return ['chg', _t('ver.b_changed')]; }, get moved() { return ['mov', _t('ver.b_moved')]; } };
function vpChangeRows(d, df) {
  const bookFields = Object.fromEntries(df.book.changed.map((x) => [x.id, x])), dayFields = Object.fromEntries(df.day.changed.map((x) => [x.id, x]));
  const done = new Set(VP.accepted || []);
  return d.changes.map((c) => {
    const [k, w] = vpBadge[c.kind] || vpBadge.changed;
    let detail = '';
    if (c.key.startsWith('block:') && dayFields[c.id]) detail = dayFields[c.id].fields.map((f) => stFieldText(c.itemType, f)).join(' · ');
    else if (c.key.startsWith('page:') && bookFields[c.id]) detail = bookFields[c.id].fields.map((f) => (f.key === 'on' ? (f.after ? _t('ver.shown_in_book') : _t('ver.hidden_from_book')) : `${f.key.replace(/^options\./, '')}: ${stFmt(f.before)} → ${stFmt(f.after)}`)).join(' · ');
    else if (c.key.startsWith('order:')) detail = c.moved.map((m) => _t('ver.label_position', { label: m.label, from: m.from + 1, to: m.to + 1 })).join(' · ');
    else if (c.detail) detail = `${stFmt(c.detail.before)} → ${stFmt(c.detail.after)}`;
    const thumb = c.part === 'book' && !c.key.startsWith('order:') ? stThumb({ id: c.id, type: c.itemType }) : '';
    const can = VP.prop.can.merge;
    return `<li>${can ? `<label class="vp-chk"><input type="checkbox" data-key="${escH(c.key)}" ${VP.sel.has(c.key) ? 'checked' : ''} aria-label="${_t('ver.accept_label', { label: escH(c.label) })}"></label>` : ''}${thumb}<span class="bd ${k}">${w}</span><span class="tx">${escH(c.label)}${detail ? `<small>${escH(detail)}</small>` : ''}</span>${done.has(c.key) ? '<span class="acc">' + _t('ver.accepted') + '</span>' : ''}</li>`;
  });
}
function vpEvents(p) {
  const st = { approved: _t('ver.ev_approved'), changes_requested: _t('ver.ev_asked'), comment: _t('ver.ev_note') };
  return p.events.map((e) => {
    const who = `<span class="who">${escH(e.user.name)}</span><time datetime="${e.createdAt}">${stAgo(e.createdAt)}</time>`;
    if (e.kind === 'comment') return `<li>${who}<p>${escH(e.body)}</p></li>`;
    if (e.kind === 'review') return `<li>${who} · ${st[e.state] || _t('ver.ev_reviewed')}${e.body ? `<p>${escH(e.body)}</p>` : ''}</li>`;
    const t = e.kind === 'status' ? (e.state === 'closed' ? _t('ver.ev_closed') : _t('ver.ev_reopened')) : e.kind === 'accept' ? (e.data && e.data.keys ? _t('ver.ev_accepted_n', { n: e.data.keys.length }) : _t('ver.ev_accepted_some')) : _t('ver.ev_merged');
    return `<li class="sys">${who} · ${t}</li>`;
  }).join('') || '<li class="sys">' + _t('ver.no_discussion') + '</li>';
}
function vpDrawDetail() {
  const p = VP.prop, d = VP.d, box = $('#vp-detv'), can = p.can;
  VP.accepted = (p.accepted || []).map((a) => a.key);
  const open = ['open', 'changes_requested', 'approved'].includes(p.status);
  let state = '', df = null, body = '';
  if (d) {
    df = STUDIO.diffSnapshots(d.snapshots.base, d.snapshots.theirs);
    const nc = d.merge.conflicts.length, sm = df.summary;
    if (!open) state = `<div class="vp-state" role="status"><span class="msg">${p.status === 'merged' ? _t('ver.was_merged') : _t('ver.is_closed')}</span></div>`;
    else if (!nc) state = `<div class="vp-state ok" role="status"><span class="msg">${p.status === 'changes_requested' ? _t('ver.no_conflicts_review') : _t('ver.no_conflicts')}</span>${can.merge ? '<button class="btn primary" id="vp-merge" type="button">' + _t('ver.merge') + '</button>' : ''}</div>`;
    else state = `<div class="vp-state warn" role="status"><span class="msg">${_t('ver.conflicts_msg', { n: nc })}</span>${can.merge ? '<button class="btn primary" id="vp-resolve" type="button">' + _t('ver.resolve') + '</button>' : ''}</div>`;
    const chip = (n, l) => `<span${n ? ' class="on"' : ''}>${l}: ${n ? _t('ver.n_changes', { n }) : _t('ver.f_none')}</span>`;
    const rows = vpChangeRows(d, df), sel = VP.sel.size;
    body = `<div class="vs-sum">${chip(sm.day, _t('ver.day_page'))}${chip(sm.book, _t('ver.book_pages'))}${chip(sm.meta + sm.print + sm.assets + sm.components, _t('ver.settings'))}</div>
      <section aria-labelledby="vp-ch"><h3 class="sec" id="vp-ch">${_t('ver.what_changes')}</h3>
        <div class="vs-pair"><figure><figcaption>${_t('ver.before')} <code class="vs-h">${escH(d.commits.base.short || _t('ver.base'))}</code></figcaption><div class="vs-pg" id="vp-pa"></div></figure><figure><figcaption>${_t('ver.proposed')} <code class="vs-h">${escH(d.commits.theirs.short)}</code></figcaption><div class="vs-pg" id="vp-pb"></div></figure></div>
        <ul class="vs-chg vp-chg">${rows.join('') || '<li><span class="tx">' + _t('ver.nothing_differs') + '</span></li>'}</ul>
        ${can.merge && rows.length && open ? `<div class="vp-sel"><button class="btn" id="vp-all" type="button">${_t('ver.select_all')}</button><button class="btn" id="vp-acc" type="button" ${sel ? '' : 'disabled'}>${_t('ver.accept_selected', { n: sel || '', count: sel })}</button><span class="hint" id="vp-selh">${_t('ver.tick_hint')}</span></div>` : ''}
      </section>`;
  } else body = `<div class="vp-state warn" role="status"><span class="msg">${escH(VP.dErr || _t('ver.cant_load'))}</span></div>`;
  const acts = [];
  if (can.close) acts.push('<button class="btn" id="vp-close" type="button">' + _t('ver.close_proposal') + '</button>');
  if (can.reopen) acts.push('<button class="btn" id="vp-reopen" type="button">' + _t('ver.reopen') + '</button>');
  box.innerHTML = `<div class="vp-top"><button class="vs-b" id="vp-back" type="button" aria-label="${_t('ver.back_proposals')}">${IC_BACK}<span class="lab">${_t('ver.proposals')}</span></button><div><b id="vp-dh" tabindex="-1">${escH(p.title)}</b><small>#${p.number} · ${escH(p.author.name)} · ${escH(p.source.project ? p.source.project.name : _t('ver.deleted_project'))}: ${escH(p.source.branch)} → ${escH(p.target.project.name)}: ${escH(p.target.branch)}</small></div>${vpPill(p.status)}${p.stale ? '<span class="vp-pill">' + _t('ver.review_stale') + '</span>' : ''}</div>
    ${p.description ? `<p class="vp-desc">${escH(p.description)}</p>` : ''}
    <div id="vp-err" class="vp-err" role="alert">${escH(VP.err)}</div>
    ${state}${body}
    <section aria-labelledby="vp-dis"><h3 class="sec" id="vp-dis">${_t('ver.discussion')}</h3><ul class="vp-ev">${vpEvents(p)}</ul>
      ${can.comment ? `<div class="vp-say"><label class="sr" for="vp-say">${_t('ver.write_comment')}</label><textarea id="vp-say" maxlength="4000" placeholder="${_t('ver.add_comment')}"></textarea><div class="vs-acts"><button class="btn" id="vp-post" type="button">${_t('ver.comment')}</button>${can.review ? '<button class="btn" id="vp-approve" type="button">' + _t('ver.approve') + '</button><button class="btn" id="vp-changes" type="button">' + _t('ver.request_changes') + '</button>' : ''}${acts.join('')}</div></div>` : `<p class="note">${ST.user ? _t('ver.only_members') : _t('ver.sign_in_discuss')}</p>`}
    </section>`;
  $('#vp-back').onclick = vpBack; $('#vp-dh').focus({ preventScroll: true });
  if (d) vpPaintDiff(df);
}
function vpPaintDiff(df) {
  const d = VP.d, A = d.snapshots.base.day, B = d.snapshots.theirs.day, mA = {}, mB = {};
  const bd = Object.fromEntries(B.blocks.map((x) => [x.uid, x]));
  for (const x of df.day.added) mB[x.id] = ['add', _t('ver.b_new')];
  for (const x of df.day.removed) mA[x.id] = ['del', _t('ver.b_removed')];
  for (const x of df.day.moved) { mA[x.id] = ['mov', _t('ver.b_moved')]; mB[x.id] = ['mov', _t('ver.b_moved')]; }
  for (const x of df.day.changed) { const on = x.fields.find((f) => f.key === 'on'); mA[x.id] = ['chg', on && !on.after ? _t('ver.turned_off') : _t('ver.b_changed')]; mB[x.id] = ['chg', on && on.after ? _t('ver.turned_on') : _t('ver.b_changed')]; }
  const paint = () => { if (!$('#vp-pa')) return; stPaintPage($('#vp-pa'), A, mA); stPaintPage($('#vp-pb'), B, mB); };
  paint(); ST.repaint = paint; void bd;
}
$('#vp-detv').addEventListener('click', async (e) => {
  const id = e.target.closest('button') && e.target.closest('button').id;
  if (!id) return;
  const { pid, n } = VP.cur || {};
  const act = async (fn) => { VP.err = ''; try { await fn(); } catch (e2) { VP.err = stMsg(e2); if (!(e2.code === 'unresolved_conflicts')) { const el = $('#vp-err'); if (el) el.textContent = VP.err; } else throw e2; } };
  if (id === 'vp-all') { VP.sel = new Set(VP.d.changes.map((c) => c.key)); return vpDrawDetail(); }
  if (id === 'vp-resolve') return vpResolveOpen(VP.d.merge.conflicts, { kind: 'merge' });
  if (id === 'vp-merge') { if (ST.pending) await stSaveDraft(); try { await act(async () => { const r = await stApi('POST', vpP(pid, `/proposals/${n}/merge`), { expectedHeads: vpHeads() }); await vpAfter(pid, r, _t('ver.merged')); }); } catch (e2) { if (e2.code === 'unresolved_conflicts') vpResolveOpen(e2.details.conflicts, { kind: 'merge' }); } return; }
  if (id === 'vp-acc') { const items = [...VP.sel]; try { await act(async () => { const r = await stApi('POST', vpP(pid, `/proposals/${n}/accept`), { expectedHeads: vpHeads(), items }); await vpAfter(pid, r, r.unchanged ? _t('ver.already_here') : `${_t('ver.accepted_n', { n: items.length })}`); }); } catch (e2) { if (e2.code === 'unresolved_conflicts') vpResolveOpen(e2.details.conflicts, { kind: 'accept', items }); } return; }
  if (id === 'vp-post') { const t = $('#vp-say').value.trim(); if (!t) { $('#vp-say').focus(); return; } return act(async () => { await stApi('POST', vpP(pid, `/proposals/${n}/comments`), { body: t }); await vpOpen(pid, n, true); }); }
  if (id === 'vp-approve') return act(async () => { await stApi('POST', vpP(pid, `/proposals/${n}/reviews`), { state: 'approved', body: $('#vp-say').value.trim() }); await vpOpen(pid, n, true); });
  if (id === 'vp-changes') { if (!$('#vp-say').value.trim()) { VP.err = _t('ver.say_first'); $('#vp-err').textContent = VP.err; $('#vp-say').focus(); return; } return act(async () => { await stApi('POST', vpP(pid, `/proposals/${n}/reviews`), { state: 'changes_requested', body: $('#vp-say').value.trim() }); await vpOpen(pid, n, true); }); }
  if (id === 'vp-close' || id === 'vp-reopen') return act(async () => { await stApi('POST', vpP(pid, `/proposals/${n}/status`), { status: id === 'vp-close' ? 'closed' : 'open' }); await vpOpen(pid, n, true); });
});
$('#vp-detv').addEventListener('change', (e) => {
  const c = e.target.closest('[data-key]'); if (!c) return;
  c.checked ? VP.sel.add(c.dataset.key) : VP.sel.delete(c.dataset.key);
  const b = $('#vp-acc'); if (b) { const n = VP.sel.size; b.disabled = !n; b.textContent = _t('ver.accept_selected', { n: n || '', count: n }); }
});
async function vpAfter(pid, r, msg) { // the target branch moved because of us: show it, keep any draft
  toast(msg);
  if (pid === ST.pid) { await stLog(); if (ST.rev > 0 || stDirty()) { ST.behind = true; await stMoved(r.commit.id); } else await stLoad(); }
  await vpOpen(pid, VP.cur.n);
  await vpLoad(true);
}

// ----- the conflict resolver -----
const VP_WHY = {
  edit_edit: _t('ver.why_edit_edit'),
  add_add: _t('ver.why_add_add'),
  delete_edit: (c) => (c.deletedBy === 'ours' ? _t('ver.why_deleted_ours') : _t('ver.why_deleted_theirs')),
  reorder: _t('ver.why_reorder'),
  component: _t('ver.why_component'),
  move_edit: _t('ver.why_move_edit'),
  layout: _t('ver.why_layout'),
};
const vpHandOk = (c) => c.kind !== 'layout' && c.kind !== 'move_edit' && !(c.kind === 'delete_edit' && !c.ifOurs && !c.ifTheirs);
function vpResolveOpen(conflicts, mode) {
  VP.conf = conflicts; VP.mode = mode; VP.res = {}; VP.hand = {}; VP.err = '';
  vpResolveDraw();
}
function vpDayWith(day, uid, blk, theirsDay) {
  const L = structuredClone(day), i = L.blocks.findIndex((b) => b.uid === uid);
  if (!blk) { if (i >= 0) L.blocks.splice(i, 1); }
  else { const { list, ...b } = blk; if (i >= 0) L.blocks[i] = b; else { const j = theirsDay ? theirsDay.blocks.findIndex((x) => x.uid === uid) : L.blocks.length; L.blocks.splice(Math.min(Math.max(j, 0), L.blocks.length), 0, b); } }
  return normalize(L);
}
function vpFieldsHtml(c) {
  if (!c.fields || !c.fields.length) return '';
  const opt = (p) => { const o = ((TYPES[c.itemType] || {}).opts || []).find((x) => x.k === p); const m = p.match(/^rows\.([a-z_0-9]+)\.(.+)$/); return o ? o.label : m ? `${crName(m[1])} › ${m[2]}` : p === 'rows.order' ? _t('ver.care_order') : p === 'on' ? _t('ver.shown') : p.replace(/^options\./, ''); };
  return `<ul class="vr-fields" aria-label="${_t('ver.what_differs')}">${c.fields.map((f) => `<li><b>${escH(opt(f.path))}</b>: ${_t('ver.was_this_proposal', { base: escH(stFmt(f.base)), ours: escH(stFmt(f.ours)), theirs: escH(stFmt(f.theirs)) })}</li>`).join('')}</ul>`;
}
function vpSide(c, side, i) { // one version, drawn with the real renderers
  const v = side === 'ours' ? c.ifOurs : c.ifTheirs, snap = VP.d ? VP.d.snapshots : null, title = side === 'ours' ? _t('ver.this_branch') : _t('ver.the_proposal');
  let inner = '';
  if (c.part === 'day' && (c.kind === 'layout' || c.kind === 'move_edit')) inner = `<div class="vs-pg" data-paint="${side}" data-c="${i}" role="img" aria-label="${_t('ver.title_whole_page', { title })}"></div>`;
  else if (c.part === 'day' && c.kind === 'reorder') inner = `<ol>${(side === 'ours' ? c.ours : c.theirs).map((id) => `<li>${escH(c.names[id] || id)}</li>`).join('')}</ol>`;
  else if (c.part === 'day') inner = v ? `<div class="vs-pg" data-paint="${side}" data-c="${i}" role="img" aria-label="${_t('ver.title_page_with', { title, label: escH(c.label) })}"></div>` : '<div class="val">' + _t('ver.deleted_here') + '</div>';
  else if (c.part === 'book' && c.kind === 'reorder') inner = `<ol>${(side === 'ours' ? c.ours : c.theirs).map((id) => `<li>${escH(c.names[id] || id)}</li>`).join('')}</ol>`;
  else if (c.part === 'book') inner = v ? `<div class="val pg">${stThumb({ id: v.id, type: v.type })}<span>${escH(c.label)}<br>${v.on === false ? _t('ver.hidden_from_book_cap') : _t('ver.shown_in_book_cap')}${v.options && Object.keys(v.options).length ? `<br>${escH(Object.entries(v.options).map(([k, x]) => `${k}: ${vpVal(x)}`).join(' · '))}` : ''}</span></div>` : '<div class="val">' + _t('ver.removed_here') + '</div>';
  else if (c.part === 'components') inner = `<div class="val">${v ? `${_t('ver.component_line', { name: escH(v.name), version: v.version, type: escH((v.page || {}).type || '') })}` : _t('ver.deleted_here')}</div>`;
  else inner = `<div class="val">${escH(vpVal(v))}</div>`;
  return `<div class="vr-side" data-side="${side}" data-c="${i}"><h4>${title}${side === 'ours' ? ` (${escH(VP.prop.target.branch)})` : ''}</h4>${inner}</div>`;
}
function vpHandHtml(c, i) {
  const h = VP.hand[c.id]; if (h === undefined) return '';
  let inner = '';
  if (c.kind === 'reorder') inner = `<ol class="order" aria-label="${_t('ver.order')}">${h.map((id, k) => `<li><span>${k + 1}. ${escH(c.names[id] || id)}</span><button type="button" data-mv="${i}" data-k="${k}" data-d="-1" aria-label="${_t('ver.move_up', { name: escH(c.names[id] || id) })}" ${k ? '' : 'disabled'}>↑</button><button type="button" data-mv="${i}" data-k="${k}" data-d="1" aria-label="${_t('ver.move_down', { name: escH(c.names[id] || id) })}" ${k < h.length - 1 ? '' : 'disabled'}>↓</button></li>`).join('')}</ol>`;
  else if (c.part === 'day' && h) {
    const t = TYPES[h.type] || { opts: [] };
    const care = h.type === 'care' ? h.rows.map((r) => `<div class="opt"><label>${escH(crName(r.id))}</label>${optControl({ k: 'on', kind: 'bool', label: _t('ver.show') }, r.on, `rows/${r.id}/on`)}${(ROW_OPTS[r.id] || []).map((o) => optControl(o, r[o.k], `rows/${r.id}/${o.k}`)).join('')}</div>`).join('') : t.opts.map((o) => optControl(o, h[o.k], o.k)).join('');
    inner = `<div class="opts" data-hand="${i}">${optControl({ k: 'on', kind: 'bool', label: _t('ver.show_on_page') }, h.on, 'on')}${care}</div><div class="vs-pg" data-paint="hand" data-c="${i}" role="img" aria-label="${_t('ver.your_edited')}"></div>`;
  } else if (c.part === 'book' && h) inner = `<div class="opts" data-hand="${i}">${optControl({ k: 'on', kind: 'bool', label: _t('ver.shown_in_book_cap') }, h.on, 'on')}${Object.entries(h.options || {}).filter(([, v]) => typeof v === 'string').map(([k, v]) => optControl({ kind: 'text', label: k, max: 40 }, v, `options.${k}`)).join('')}</div>`;
  else if (c.part === 'components' && h) inner = `<div class="opts" data-hand="${i}">${optControl({ kind: 'text', label: _t('ver.name'), max: 80 }, h.name, 'name')}</div><p class="note">${_t('ver.merged_component', { n: c.minVersion })}</p>`;
  else if (typeof c.base === 'boolean' || typeof c.ours === 'boolean') inner = `<div class="opts" data-hand="${i}">${optControl({ kind: 'bool', label: c.label }, !!h, 'v')}</div>`;
  else if (typeof c.base === 'number' || typeof c.ours === 'number') inner = `<div class="opts" data-hand="${i}"><div class="opt"><label>${escH(c.label)}</label><input type="number" data-scalar="${i}" value="${escH(h)}" aria-label="${escH(c.label)}"></div></div>`;
  else inner = `<div class="opts" data-hand="${i}"><div class="opt"><label>${escH(c.label)}</label><input type="text" data-scalar="${i}" value="${escH(h ?? '')}" aria-label="${escH(c.label)}"></div></div>`;
  return `<div class="vr-hand" aria-label="${_t('ver.edit_by_hand')}">${inner}</div>`;
}
function vpCard(c, i) {
  const why = typeof VP_WHY[c.kind] === 'function' ? VP_WHY[c.kind](c) : VP_WHY[c.kind], r = VP.res[c.id];
  const oursLab = c.kind === 'delete_edit' && !c.ifOurs ? _t('ver.keep_ours_delete') : _t('ver.keep_ours'), theirsLab = c.kind === 'delete_edit' && !c.ifTheirs ? _t('ver.take_theirs_delete') : _t('ver.take_theirs');
  const radio = (v, lab) => `<label><input type="radio" name="vr-${i}" value="${v}" ${r && r.choose === v ? 'checked' : ''}><span>${lab}</span></label>`;
  return `<fieldset class="vr-card${r ? ' done' : ''}" data-c="${i}"><legend>${escH(c.label)}</legend><p class="why">${escH(why)}</p>
    ${c.problems ? `<p class="vp-prob">${c.problems.map(escH).join(' ')}</p>` : ''}${vpFieldsHtml(c)}
    <div class="vr-pair">${vpSide(c, 'ours', i)}${vpSide(c, 'theirs', i)}</div>
    <div class="vr-choice" role="radiogroup" aria-label="${_t('ver.choose_for', { label: escH(c.label) })}">${radio('ours', oursLab)}${radio('theirs', theirsLab)}${vpHandOk(c) ? radio('manual', _t('ver.edit_by_hand')) : ''}</div>
    <div data-handbox="${i}">${r && r.choose === 'manual' ? vpHandHtml(c, i) : ''}</div></fieldset>`;
}
function vpResolveDraw() {
  const p = VP.prop, box = $('#vp-detv'), n = VP.conf.length, done = VP.conf.filter((c) => VP.res[c.id]).length;
  box.innerHTML = `<div class="vp-top"><button class="vs-b" id="vr-back" type="button" aria-label="${_t('ver.back_proposal')}">${IC_BACK}<span class="lab">${_t('ver.proposal')}</span></button><div><b id="vp-dh" tabindex="-1">${_t('ver.resolve_n', { n })}</b><small>${escH(p.title)} · ${_t('ver.pick_each')}</small></div></div>
    <div id="vp-err" class="vp-err" role="alert">${escH(VP.err)}</div>
    <form class="vr" id="vr-form">${VP.conf.map(vpCard).join('')}
    <div class="vr-foot"><span class="msg" id="vr-msg" role="status">${_t('ver.n_chosen', { done, n })}</span><button class="btn" type="button" id="vr-cancel">${_t('ver.cancel')}</button><button class="btn primary" type="submit" id="vr-go">${VP.mode.kind === 'accept' ? _t('ver.accept_choices') : _t('ver.merge_choices')}</button></div></form>`;
  $('#vr-back').onclick = $('#vr-cancel').onclick = () => { VP.mode = null; vpDrawDetail(); };
  $('#vp-dh').focus({ preventScroll: true });
  vpPaintCards();
}
function vpFocus(host, uid) { // the whole page is drawn (real renderer); the window on it is cut to the block in question
  const root = host.querySelector('.vpv'), el = root && root.querySelector(`[data-b="${uid}"]`); if (!el) return;
  const sc = parseFloat((root.style.transform.match(/scale\(([\d.]+)\)/) || [])[1]) || 1, full = parseFloat(host.style.height) || host.clientHeight;
  const rr = root.getBoundingClientRect(), er = el.getBoundingClientRect(), view = Math.min(full, Math.max(240, er.height + 110)), off = Math.max(0, Math.min(full - view, er.top - rr.top - 46));
  host.style.height = `${view}px`; root.style.transform = `translateY(${-off}px) scale(${sc})`;
}
function vpPaintCards() {
  if (!VP.d || !VP.mode) return;
  const S = VP.d.snapshots;
  const paint = () => {
    document.querySelectorAll('#vr-form [data-paint]').forEach((host) => {
      const c = VP.conf[+host.dataset.c], side = host.dataset.paint;
      if (c.kind === 'layout' || c.kind === 'move_edit') return stPaintPage(host, normalize(side === 'ours' ? c.ifOurs : c.ifTheirs), {});
      const uid = c.key;
      if (side === 'hand') stPaintPage(host, vpDayWith(S.ours.day, uid, VP.hand[c.id], S.theirs.day), { [uid]: ['chg', _t('ver.your_version')] });
      else { const v = side === 'ours' ? c.ifOurs : c.ifTheirs; stPaintPage(host, side === 'ours' ? vpDayWith(S.ours.day, uid, v, S.theirs.day) : vpDayWith(S.theirs.day, uid, v, S.ours.day), { [uid]: ['chg', side === 'ours' ? _t('ver.this_branch') : _t('ver.proposal')] }); }
      vpFocus(host, uid);
    });
    document.querySelectorAll('#vr-form .vr-card').forEach((card) => { const c = VP.conf[+card.dataset.c], r = VP.res[c.id]; card.querySelectorAll('.vr-side').forEach((s) => s.classList.toggle('pick', !!r && r.choose === s.dataset.side)); });
  };
  paint(); ST.repaint = paint;
}
function vpHandInit(c) {
  const from = structuredClone(c.ifOurs || c.ifTheirs);
  if (c.kind === 'reorder') return [...c.ifOurs];
  if (c.part === 'day' || c.part === 'book' || c.part === 'components') return from;
  return c.ifOurs === null || c.ifOurs === undefined ? c.ifTheirs : c.ifOurs;
}
$('#vp-detv').addEventListener('change', (e) => {
  const r = e.target.closest('input[type=radio][name^="vr-"]'); if (!r) return;
  const i = +r.name.slice(3), c = VP.conf[i];
  if (r.value === 'manual') { if (VP.hand[c.id] === undefined) VP.hand[c.id] = vpHandInit(c); VP.res[c.id] = { choose: 'manual', value: VP.hand[c.id] }; } else VP.res[c.id] = { choose: r.value };
  const card = r.closest('.vr-card'); card.classList.add('done');
  card.querySelector('[data-handbox]').innerHTML = r.value === 'manual' ? vpHandHtml(c, i) : '';
  vpResolveCount(); vpPaintCards();
});
function vpResolveCount() { const done = VP.conf.filter((c) => VP.res[c.id]).length; $('#vr-msg').textContent = _t('ver.n_chosen', { done, n: VP.conf.length }); }
function vpHandSet(i, path, fn) { // the block's own controls (optControl) edit a copy of the block: same paths as the editor's list
  const c = VP.conf[i], h = VP.hand[c.id]; if (h === undefined) return;
  let o = h, k = path; const seg = path.split('/');
  if (seg[0] === 'rows') { o = h.rows.find((x) => x.id === seg[1]); k = seg[2]; } else if (path.startsWith('options.')) { o = h.options; k = path.slice(8); }
  if (!o) return; fn(o, k); VP.res[c.id] = { choose: 'manual', value: h };
  if (c.part === 'day') { vpRedrawHand(i); vpPaintCards(); }
}
function vpRedrawHand(i) { // redraw the controls, and put the keyboard focus back on the same control
  const c = VP.conf[i], box = document.querySelector(`[data-handbox="${i}"]`), a = document.activeElement;
  let sel = '';
  if (a && a.dataset && box && box.contains(a)) for (const k of ['num', 'bool', 'choice', 'flag', 'mv']) if (a.dataset[k] !== undefined) { sel = `[data-${k}="${CSS.escape(a.dataset[k])}"]${a.dataset.d ? `[data-d="${a.dataset.d}"]` : ''}${a.dataset.v ? `[data-v="${CSS.escape(a.dataset.v)}"]` : ''}${a.dataset.k ? `[data-k="${a.dataset.k}"]` : ''}`; break; }
  box.innerHTML = vpHandHtml(c, i);
  const t = sel && box.querySelector(sel); if (t && !t.disabled) t.focus(); else if (sel) { const alt = box.querySelector(sel.replace(/\[data-d="[^"]*"\]/, '')); if (alt) alt.focus(); }
}
$('#vp-detv').addEventListener('click', (e) => {
  const t = e.target.closest('[data-num],[data-bool],[data-choice],[data-flag],[data-mv]'); if (!t || !t.closest('#vr-form')) return;
  const d = t.dataset;
  if (d.mv) { const i = +d.mv, c = VP.conf[i], h = VP.hand[c.id], k = +d.k, j = k + +d.d; if (j < 0 || j >= h.length) return; [h[k], h[j]] = [h[j], h[k]]; VP.res[c.id] = { choose: 'manual', value: h }; const box = document.querySelector(`[data-handbox="${i}"]`); box.innerHTML = vpHandHtml(c, i); const b = box.querySelector(`button[data-k="${j}"][data-d="${d.d}"]`) || box.querySelector(`button[data-k="${j}"]`); if (b) b.focus(); return; }
  const i = +t.closest('[data-hand]').dataset.hand, path = d.num || d.bool || d.choice || d.flag;
  vpHandSet(i, path, (o, k) => { if (d.num) o[k] += +d.d; else if (d.bool) { if (path === 'v') VP.hand[VP.conf[i].id] = !VP.hand[VP.conf[i].id]; else o[k] = !o[k]; } else if (d.choice) o[k] = isNaN(+d.v) ? d.v : +d.v; else if (d.flag) o[k][d.k] = !o[k][d.k]; });
  if (path === 'v') { const c = VP.conf[i]; VP.res[c.id] = { choose: 'manual', value: VP.hand[c.id] }; vpRedrawHand(i); }
});
$('#vp-detv').addEventListener('input', (e) => {
  const el = e.target;
  if (el.dataset.scalar !== undefined) { const i = +el.dataset.scalar, c = VP.conf[i]; VP.hand[c.id] = el.type === 'number' ? Number(el.value) : el.value; VP.res[c.id] = { choose: 'manual', value: VP.hand[c.id] }; return; }
  const path = el.dataset.text || el.dataset.list, box = el.closest('[data-hand]'); if (!path || !box) return;
  const i = +box.dataset.hand, c = VP.conf[i], h = VP.hand[c.id];
  const o = path.startsWith('options.') ? h.options : h, k = path.startsWith('options.') ? path.slice(8) : path;
  if (c.part === 'day' && path.includes('/')) return;
  o[k] = el.dataset.list ? el.value.split(',') : el.value; VP.res[c.id] = { choose: 'manual', value: h };
  if (c.part === 'day') vpPaintCards();
});
$('#vp-detv').addEventListener('submit', async (e) => {
  if (e.target.id !== 'vr-form') return;
  e.preventDefault();
  const open = VP.conf.filter((c) => !VP.res[c.id]);
  if (open.length) { $('#vr-msg').textContent = _t('ver.choose_first', { label: open[0].label, done: VP.conf.length - open.length, n: VP.conf.length }); const card = document.querySelector(`.vr-card[data-c="${VP.conf.indexOf(open[0])}"] input`); if (card) card.focus(); return; }
  const { pid, n } = VP.cur, resolutions = Object.fromEntries(VP.conf.map((c) => [c.id, VP.res[c.id]]));
  try {
    if (ST.pending) await stSaveDraft();
    const body = { expectedHeads: vpHeads(), resolutions, ...(VP.mode.kind === 'accept' ? { items: VP.mode.items } : {}) };
    const r = await stApi('POST', vpP(pid, `/proposals/${n}/${VP.mode.kind === 'accept' ? 'accept' : 'merge'}`), body);
    const kind = VP.mode.kind; VP.mode = null; await vpAfter(pid, r, kind === 'accept' ? _t('ver.accepted_choices') : _t('ver.merged_choices'));
  } catch (e2) {
    if (e2.code === 'unresolved_conflicts') { VP.conf = e2.details.conflicts; VP.res = Object.fromEntries(Object.entries(VP.res).filter(([id]) => VP.conf.some((c) => c.id === id))); VP.err = _t('ver.choices_kept'); vpResolveDraw(); }
    else { VP.err = e2.code === 'head_moved' ? _t('ver.branch_changed') : stMsg(e2); const el = $('#vp-err'); if (el) el.textContent = VP.err; }
  }
});

// ---------- releases (Phase G3) ----------
// A release is a named, immutable copy of a saved version (never your draft). Anyone who can read the project sees the list and can
// download one; only the project's owner makes a release. The server refuses anything that is not public-safe.
const VL = { pid: '', list: [], busy: false };
function vlDraw(show) {
  $('#vl').hidden = !show;
  if (!show) { VL.pid = ''; return; }
  $('#vl-form').hidden = !(ST.user && ST.role === 'owner');
  if (VL.pid !== ST.pid) { VL.pid = ST.pid; VL.list = []; vlLoad(); }
}
async function vlLoad() {
  const pid = ST.pid;
  try { const r = await stApi('GET', P('/releases')); if (pid === ST.pid) VL.list = r.releases; } catch { if (pid === ST.pid) VL.list = []; }
  vlList();
}
const IC_DOWN = '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 3.5v9M6 9l4 4 4-4M4 16.5h12"/></svg>';
function vlList() {
  $('#vl-list').innerHTML = VL.list.length ? VL.list.map((r) => `<li><div><b>${escH(r.name)}</b><small>#${r.number} · ${_t('ver.version_short', { short: escH(r.commit.short) })} · ${stAgo(r.createdAt)}${r.notes ? ' · ' + escH(r.notes) : ''}</small></div><button class="vs-b" data-rel="${escH(r.name)}" type="button" aria-label="${_t('ver.download_release', { name: escH(r.name) })}">${IC_DOWN}</button></li>`).join('') : '<li><div><small>' + _t('ver.no_releases') + '</small></div></li>';
  $('#vl-list').querySelectorAll('[data-rel]').forEach((b) => { b.onclick = () => vlDownload(b.dataset.rel); });
}
async function vlDownload(name) {
  try {
    const x = await stApi('GET', P(`/releases/${enc(name)}/export`));
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(x, null, 2)], { type: 'application/json' })); a.download = `release-${name}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    setStatus(_t('ver.downloaded_release', { name }), 'ok');
  } catch (e) { $('#vl-err').textContent = stMsg(e); }
}
$('#vl-form').onsubmit = async (e) => {
  e.preventDefault(); if (VL.busy) return;
  const name = $('#vl-name').value.trim(), notes = $('#vl-notes').value.trim(); $('#vl-err').textContent = '';
  if (!name) { $('#vl-err').textContent = _t('ver.give_release_name'); $('#vl-name').focus(); return; }
  VL.busy = true;
  try { await stApi('POST', P('/releases'), { name, notes, branch: ST.branch }); $('#vl-name').value = ''; $('#vl-notes').value = ''; await vlLoad(); setStatus(_t('ver.released', { name }), 'ok'); }
  catch (er) { $('#vl-err').textContent = stMsg(er); }
  finally { VL.busy = false; }
};
