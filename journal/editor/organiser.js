// ---------- page organiser (C4): the Book view, edit mode ----------
// Reorder pages (drag on the canvas, Alt+Left/Right, Move to…, or the list), hide and show them, add and remove Notes pages, give one month
// its own pages, and see what the book becomes: page count, KDP limits, automatic pages. Every change goes through bookedit.mjs, which uses the
// rules of book.mjs (bookrules.mjs), so an impossible change is refused with a reason. The canvas is laid out again after each change by
// flowBook(), the same alignment and padding as the print build. The result is content/book.json: download, GitHub commit, the Studio draft.
// Viewing stays read-only: none of this exists while viewing (the panel, toolbar and buttons are .editonly).
const BKE = /*__BOOKEDIT__*/;
const ORG = { cat: null, book: null, base: null, undo: [], redo: [], only: false, mon: '', hard: false, sel: '', selPid: '', keepHid: false, on: false, open: true, touched: false, flow: null, pending: null, focusFk: '', ghDirty: false, timer: 0 };
const ORG_KEY = 'kw-book';
const orgClone = (x) => JSON.parse(JSON.stringify(x));
const orgMonth = () => (ORG.only && ORG.mon ? ORG.mon : null);
const orgList = (b = ORG.book) => BKE.listFor(b, orgMonth());
const orgMeta = (t) => (ORG.cat && ORG.cat.meta[t]) || {};
const orgName = (e) => BKE.entryName(ORG.cat, e);
const orgPlural = (n, a, b) => `${n} ${n === 1 ? a : b}`;
const OG_SVG = (d, extra = '') => `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${d}</svg>`;
const OG_IC = {
  eye: OG_SVG('<path d="M2.5 10s2.7-5 7.5-5 7.5 5 7.5 5-2.7 5-7.5 5-7.5-5-7.5-5z"/><circle cx="10" cy="10" r="2.2"/>'),
  up: OG_SVG('<path d="M10 16V4.5M5 9l5-5 5 5"/>'), down: OG_SVG('<path d="M10 4v11.5M5 11l5 5 5-5"/>'),
  dup: OG_SVG('<rect x="7" y="7" width="9" height="9" rx="1.5"/><path d="M13 7V5.5A1.5 1.5 0 0 0 11.5 4h-6A1.5 1.5 0 0 0 4 5.5v6A1.5 1.5 0 0 0 5.5 13H7"/>'),
  del: OG_SVG('<path d="M4 6h12M8 6V4.5h4V6M5.5 6l.7 10h7.6l.7-10"/>'), plus: OG_SVG('<path d="M10 4.5v11M4.5 10h11"/>'),
  ok: OG_SVG('<circle cx="10" cy="10" r="7.5"/><path d="M6.5 10.2l2.4 2.4 4.6-5"/>'), bad: OG_SVG('<path d="M10 2.8 18 16.5H2z"/><path d="M10 8v4M10 14.2v.1"/>'),
  info: OG_SVG('<circle cx="10" cy="10" r="7.5"/><path d="M10 9v4.5M10 6.6v.1"/>'),
};
const orgPlanScope = () => { try { return LM.resolveBook(LB.lib, LB.cur, {}).plan.scope || 'month'; } catch { return 'month'; } }; // volumes (H1) come from the plan; the sample is one month
const orgOn = () => ORG.on && !!ORG.cat && NAV.view === 'book' && NAV.level === 'book' && NAV.edit;

// ----- loading -----
async function orgInit(d) {
  if (ORG.cat) return;
  ORG.cat = d.catalog; ORG.base = orgClone(d.catalog.book); ORG.mon = d.catalog.months[0];
  let b = ORG.pending; ORG.pending = null;
  try {
    if (!b && MODE === 'pages') { const s = store.get(ORG_KEY); if (s) b = JSON.parse(s); }
    else if (!b && MODE === 'artifact' && db) { const snap = await db.doc('layouts/book').get(); const v = snap.data && snap.data(); if (v && v.book) b = v.book; }
  } catch { b = null; }
  ORG.book = b && !BKE.checkBook(b, ORG.cat).length ? orgClone(b) : orgClone(d.catalog.book);
  ORG.touched = !BKE.sameBook(ORG.book, ORG.base);
  orgFlow();
  if (ORG.on) orgRender();
}
const orgShape = (p) => ({ ...p, protected: !!orgMeta(p.etype).protected });
function orgFlow() {
  const f = BKE.flowBook(orgList(), ORG.cat, { hardcover: ORG.hard });
  ORG.flow = f; BK.pages = f.pages.map(orgShape); BK.hidden = f.hidden.map(orgShape); if (BK.data) BK.data.refs = f.refs;
}

// ----- saying things -----
const _bkMsg = bkMsg;
bkMsg = function (t, bad) { const m = $('#bk-msg'); m.removeAttribute('aria-live'); _bkMsg(t, bad); };
function orgSay(text, bad) { // one line, on screen and in the live region ("Moved Week 3 review to page 24")
  const m = $('#bk-msg'); m.setAttribute('aria-live', 'off'); m.textContent = text || ''; m.className = bad ? 'bad' : '';
  const l = $('#org-live'); l.textContent = ''; requestAnimationFrame(() => { l.textContent = text || ''; });
}

// ----- the selection -----
const orgPageOf = (eid) => (ORG.flow ? ORG.flow.pages.find((p) => p.eid === eid) : null);
function orgSyncSel() { // the canvas selection decides the selected entry (a hidden card keeps its own)
  if (BK.sel) { const p = BK.pages[BK.sel - 1]; ORG.sel = p ? p.eid : ''; ORG.selPid = p ? p.id : ''; ORG.keepHid = false; }
  else if (!ORG.keepHid) { ORG.sel = ''; ORG.selPid = ''; }
}
const orgEntry = (id = ORG.sel) => (id ? BKE.locate(orgList(), id) : null);
const _bkInfo = bkInfo;
bkInfo = function () {
  _bkInfo();
  if (ORG.cat) {
    orgSyncSel();
    if (ORG.on) { orgSelBar(); orgMarkRows(); const k = ORG.flow && BKE.kdpNote(ORG.flow.pages.length, ORG.hard); if (k && !k.ok) $('#bk-info').insertAdjacentHTML('beforeend', `<span class="kdp-bad">${OG_IC.bad} ${escH(k.text)}</span>`); } // the KDP limit is said here too, not only in the panel
  }
};
const _navTap = navTap;
navTap = function (n, x, y) { // in edit mode a tap on a page selects it; a quick second tap goes in as before
  if (!orgOn() || BK.level !== 'book') return _navTap(n, x, y);
  const now = performance.now(), t = NAV.tap;
  if (t && now - t.t < 450 && Math.hypot(x - t.x, y - t.y) < 40) { NAV.tap = null; return _navTap(n, x, y); }
  NAV.tap = { t: now, x, y, n }; bkSelect(n);
};
function orgSelectEntry(eid, { hidden = false } = {}) {
  const p = ORG.flow.pages.find((x) => x.eid === eid);
  if (p && !hidden) { bkSelect(p.n); return; }
  const h = ORG.flow.hidden.findIndex((x) => x.eid === eid);
  BK.slots.get(BK.sel)?.classList.remove('sel'); BK.sel = 0; ORG.keepHid = true; ORG.sel = eid; ORG.selPid = '';
  bkWorld.querySelectorAll('.bpg.hid.sel').forEach((el) => el.classList.remove('sel'));
  const el = h >= 0 ? BK.slots.get('h' + h) : null; if (el) el.classList.add('sel');
  bkInfo();
}

// ----- one change -----
function orgCount(book) { return BKE.flowBook(BKE.listFor(book, orgMonth()), ORG.cat, { hardcover: ORG.hard }); }
// r = the result of a bookedit change; say(flow) = the sentence to announce once the book is laid out again; keep = the page to keep selected
function orgCommit(r, say, keep, again) {
  if (r.err) { orgSay(r.err, true); return false; }
  if (!again) { // a change that leaves a page pointing at a page the book does not have is warned about first
    const fresh = BKE.newlyMissing(ORG.flow.missing, orgCount(r.book).missing);
    if (fresh.length) { orgWarn(fresh, () => orgCommit(r, say, keep, true)); return false; }
  }
  ORG.undo.push({ book: ORG.book, sel: ORG.sel, pid: ORG.selPid });
  if (ORG.undo.length > 80) ORG.undo.shift();
  ORG.redo = []; ORG.book = r.book; ORG.touched = true;
  orgRender(say, keep);
  orgPersist();
  return true;
}
function orgWarn(list, go) {
  $('#ow-list').innerHTML = list.map((m) => `<li><b>${escH(m.from.slice(0, 3).join(', '))}${m.from.length > 3 ? ' and more' : ''}</b> points to <b>${escH(m.target)}</b>, which the book would no longer have.</li>`).join('');
  const dlg = $('#org-warn'); dlg.dataset.go = ''; dlg.returnValue = ''; ORG.warnGo = go; dlg.showModal();
}
$('#org-warn').addEventListener('close', () => { const dlg = $('#org-warn'), go = ORG.warnGo; ORG.warnGo = null; if (dlg.returnValue === 'go' && go) go(); else orgSay('Nothing changed.'); if (orgOn()) orgFocusBack(); });
function orgUndo() {
  const s = ORG.undo.pop(); if (!s) { orgSay('Nothing to undo.'); return; }
  ORG.redo.push({ book: ORG.book, sel: ORG.sel, pid: ORG.selPid }); ORG.book = s.book; ORG.touched = true;
  orgRender((f) => 'Undone. The book is back to ' + f.pages.length + ' pages.', s.pid || undefined, s.sel); orgPersist();
}
function orgRedo() {
  const s = ORG.redo.pop(); if (!s) { orgSay('Nothing to redo.'); return; }
  ORG.undo.push({ book: ORG.book, sel: ORG.sel, pid: ORG.selPid }); ORG.book = s.book; ORG.touched = true;
  orgRender((f) => 'Redone. The book has ' + f.pages.length + ' pages.', s.pid || undefined, s.sel); orgPersist();
}

// What each change says, once the book is laid out again.
function orgMoveSay(id, pid, r) {
  return (f) => { const p = (pid && f.pages.find((x) => x.id === pid && x.eid === id)) || f.pages.find((x) => x.eid === id), e = orgEntry(id); return p ? `Moved ${p.label || orgName(e.entry)} to page ${p.n}${r.scope && r.scope !== 'book' ? `, and every ${r.scope} follows` : ''}.` : `Moved ${orgName(e.entry)}.`; };
}
function orgMove(spec, id = ORG.sel) {
  if (!id) { orgSay('Select a page first.', true); return; }
  const pid = ORG.selPid && orgPageOf(id) && (BK.pages[BK.sel - 1] || {}).eid === id ? ORG.selPid : '';
  const r = BKE.moveEntry(ORG.book, ORG.cat, orgMonth(), id, spec);
  if (!pid) ORG.sel = id;
  return orgCommit(r, r.err ? null : orgMoveSay(id, pid, r), pid || undefined, false);
}
function orgEye(id = ORG.sel) {
  const at = orgEntry(id); if (!at) { orgSay('Select a page first.', true); return; }
  const on = at.entry.on === false, r = BKE.setOn(ORG.book, ORG.cat, orgMonth(), id, on);
  if (r.err) { orgSay(r.err, true); return; }
  const n = orgName(at.entry);
  orgCommit(r, (f) => (on ? `${n} is back in the book${f.pages.find((p) => p.eid === id) ? `, from page ${f.pages.find((p) => p.eid === id).n}` : ''}.` : `${n} is hidden. It is not printed; it waits under the book.`), undefined, false);
}
function orgAdd(type, where) {
  const r = BKE.addEntry(ORG.book, ORG.cat, orgMonth(), type, where || {});
  if (r.err) { orgSay(r.err, true); return; }
  const id = r.id;
  if (orgCommit(r, (f) => { const p = f.pages.find((x) => x.eid === id); return `Added ${p ? p.label : 'a page'} as page ${p ? p.n : '?'}.`; }, undefined, false)) { ORG.focusFk = `sel:${id}`; orgSelectEntry(id); orgFocusBack(); }
}
function orgRemove(id = ORG.sel) {
  const at = orgEntry(id); if (!at) return;
  const r = BKE.removeEntry(ORG.book, ORG.cat, orgMonth(), id); if (r.err) { orgSay(r.err, true); return; }
  const list = at.arr, next = (list[at.i + 1] || list[at.i - 1] || {}).id, name = orgName(at.entry);
  if (orgCommit(r, () => `Removed ${name}. Undo brings it back.`, undefined, false)) { if (next) { ORG.focusFk = `sel:${next}`; orgSelectEntry(next); } else { ORG.sel = ''; bkSelect(0); } orgFocusBack(); }
}
function orgDup(id = ORG.sel) {
  const r = BKE.duplicateEntry(ORG.book, ORG.cat, orgMonth(), id); if (r.err) { orgSay(r.err, true); return; }
  const nid = r.id;
  if (orgCommit(r, (f) => { const p = f.pages.find((x) => x.eid === nid); return `Duplicated as ${p ? p.label : 'a new page'}, page ${p ? p.n : '?'}.`; }, undefined, false)) { ORG.focusFk = `sel:${nid}`; orgSelectEntry(nid); orgFocusBack(); }
}
function orgRename(id, title) {
  const r = BKE.setTitle(ORG.book, ORG.cat, orgMonth(), id, title); if (r.err) { orgSay(r.err, true); orgSelBar(); return; }
  if (BKE.sameBook(r.book, ORG.book)) return;
  orgCommit(r, (f) => `Renamed to ${(f.pages.find((x) => x.eid === id) || {}).label || 'Notes'}.`, ORG.selPid || undefined, false);
}
function orgResetMonth(mon) {
  const r = BKE.resetMonth(ORG.book, ORG.cat, mon); if (r.err) { orgSay(r.err, true); return; }
  if (orgCommit(r, () => `${orgMonthName(mon)} follows the default pages again.`, undefined, false) && ORG.only && ORG.mon === mon) { orgRender(); }
}
const orgMonthName = (m) => new Date(Date.UTC(+m.slice(0, 4), +m.slice(5) - 1, 1)).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });

// ----- laying the canvas out again -----
function orgRender(say, keepPid, keepEid) {
  const eid0 = keepEid !== undefined ? keepEid : ORG.sel;
  orgFlow();
  const f = ORG.flow;
  let n = 0;
  if (keepPid) { const p = f.pages.find((x) => x.id === keepPid); if (p) { n = p.n; ORG.sel = p.eid; } }
  if (!n && eid0) { const p = f.pages.find((x) => x.eid === eid0); if (p) { n = p.n; ORG.sel = p.eid; ORG.selPid = p.id; } else if (!f.hidden.some((x) => x.eid === eid0)) ORG.sel = ''; }
  if (BK.ready) {
    const lv = BK.level;
    BK.slots.get(BK.sel)?.classList.remove('sel'); BK.sel = n; BK.cols = bkPickCols(); bkBuild();
    $('#bk-ids').innerHTML = BK.pages.map((p) => `<option value="${escH(p.id)}"></option>`).join('');
    if (lv === 'book') bkLevel('book', false); else bkApply();
    if (!n && ORG.sel) { ORG.keepHid = true; const h = f.hidden.findIndex((x) => x.eid === ORG.sel); const el = h >= 0 ? BK.slots.get('h' + h) : null; if (el) el.classList.add('sel'); }
    bkInfo();
  }
  orgPanel(); orgSelBar(); orgButtons();
  if (say) orgSay(say(f));
}
function orgButtons() {
  $('#og-undo').disabled = !ORG.undo.length; $('#og-redo').disabled = !ORG.redo.length;
}

// ----- the selected page toolbar -----
function orgSelBar() {
  const bar = $('#org-sel'); if (!ORG.on || !ORG.cat) { bar.hidden = true; return; }
  const n = BK.sel, p = n ? BK.pages[n - 1] : null, at = orgEntry(), hid = !n && at && ORG.keepHid;
  bar.hidden = false;
  const set = (id, disabled) => { const b = $(id); b.setAttribute('aria-disabled', disabled ? 'true' : 'false'); };
  if (!p && !hid) {
    $('#os-what').innerHTML = '<span>Select a page to move, hide, add to or remove. Tap or click a page; drag it to move it; Alt+Left and Alt+Right move it one place.</span>';
    for (const id of ['#os-earlier', '#os-later', '#os-moveto', '#os-eye']) set(id, true);
    $('#os-dup').hidden = $('#os-del').hidden = $('#os-title-w').hidden = true; $('#os-why').textContent = ''; $('#os-eye-t').textContent = 'Hide'; $('#os-eye-ic').innerHTML = BK_IC.eyeoff;
    return;
  }
  if (p && p.auto) {
    $('#os-what').innerHTML = `<b>Page ${p.n}</b> <span>${escH(p.label)} · added by itself to keep the spreads facing and the page count even. It moves and goes away on its own, so it has no controls.</span>`;
    for (const id of ['#os-earlier', '#os-later', '#os-moveto', '#os-eye']) set(id, true);
    $('#os-dup').hidden = $('#os-del').hidden = $('#os-title-w').hidden = true; $('#os-why').textContent = ''; $('#os-eye-t').textContent = 'Hide'; $('#os-eye-ic').innerHTML = BK_IC.eyeoff;
    return;
  }
  const e = at.entry, T = orgMeta(e.type), off = e.on === false, prot = !!T.protected || e.type === 'weeks', built = (ORG.cat.builtIn || []).includes(e.id) || e.type === 'weeks';
  const scopeTxt = at.scope === 'book' ? '' : at.scope === 'month' ? ' · month page, in every month' : ' · week page, in every week';
  $('#os-what').innerHTML = `<b>${off ? 'Hidden' : `Page ${p.n}`}</b> <span>${escH(off ? orgName(e) : (p.label || orgName(e)))}${!off && (p.label || orgName(e)) !== orgName(e) ? ' · ' + escH(orgName(e)) : ''}${scopeTxt}${p && p.n % 2 ? ' · right-hand' : p ? ' · left-hand' : ''}${off ? ' · not printed' : ''}</span>`;
  for (const id of ['#os-earlier', '#os-later', '#os-moveto']) set(id, off);
  $('#os-earlier span').textContent = 'Earlier'; $('#os-later span').textContent = 'Later';
  const eye = $('#os-eye');
  eye.setAttribute('aria-disabled', prot && !off ? 'true' : 'false');
  $('#os-eye-t').textContent = prot && !off ? 'Can’t hide' : off ? 'Show' : 'Hide';
  $('#os-eye-ic').innerHTML = prot && !off ? BK_IC.lock : off ? OG_IC.eye : BK_IC.eyeoff;
  eye.setAttribute('aria-label', prot && !off ? `${orgName(e)} is protected: it can move but can’t be hidden` : off ? `Show ${orgName(e)} again` : `Hide ${orgName(e)}`);
  $('#os-why').textContent = prot && !off ? BKE.protectWhy(ORG.cat, e) : off ? 'Hidden pages are not printed. Show it to put it back where it was.' : ''; $('#os-why').className = 'os-why';
  $('#os-dup').hidden = e.type !== 'notes';
  $('#os-del').hidden = built; $('#os-del span').textContent = 'Remove'; $('#os-del').setAttribute('aria-label', `Remove ${orgName(e)} from the book`);
  const tw = $('#os-title-w'); tw.hidden = e.type !== 'notes';
  if (e.type === 'notes' && document.activeElement !== $('#os-title')) $('#os-title').value = (e.options && e.options.title) || '';
}
$('#os-earlier').onclick = () => { if (ORG.sel && orgEntry() && orgEntry().entry.on !== false) orgMove({ step: -1 }); };
$('#os-later').onclick = () => { if (ORG.sel && orgEntry() && orgEntry().entry.on !== false) orgMove({ step: 1 }); };
$('#os-eye').onclick = () => orgEye();
$('#os-dup').onclick = () => orgDup();
$('#os-del').onclick = () => orgRemove();
$('#os-title').addEventListener('change', () => { if (ORG.sel) orgRename(ORG.sel, $('#os-title').value); });
$('#os-title').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); } e.stopPropagation(); });
$('#os-moveto').onclick = () => orgMoveDialog();

// ----- Move to… (the way to move on a phone, and for anyone who does not drag) -----
function orgMoveDialog(id = ORG.sel, back) {
  const at = orgEntry(id); if (!at) { orgSay('Select a page first.', true); return; }
  if (at.entry.on === false) { orgSay('Show this page before you move it.', true); return; }
  const e = at.entry, sibs = at.arr.filter((x) => x.id !== id), where = at.scope === 'book' ? 'front and back pages' : at.scope === 'month' ? 'month pages' : 'week pages';
  const pageTxt = (x) => { const p = orgPageOf(x.id); return at.scope === 'book' && p ? ` (page ${p.n})` : ''; };
  const opts = []; const cur = at.arr[at.i + 1] ? at.arr[at.i + 1].id : null, prev = at.arr[at.i - 1] ? at.arr[at.i - 1].id : null;
  sibs.forEach((s) => { if (s.id !== cur) opts.push([`before:${s.id}`, `Before ${orgName(s)}${pageTxt(s)}${s.on === false ? ' (hidden)' : ''}`]); });
  if (cur) opts.push(['after:' + at.arr[at.arr.length - 1].id, `At the very end of the ${where}`]);
  $('#om-h').textContent = `Move ${orgName(e)}`;
  $('#om-p').textContent = `${orgName(e)} is one of the ${where}, so it can go anywhere among them.${at.scope === 'book' ? ' The weeks are one block in this list: put a page before or after it.' : ` Every ${at.scope} follows.`}`;
  $('#om-sel').innerHTML = opts.map(([v, t]) => `<option value="${escH(v)}">${escH(t)}</option>`).join('');
  $('#om-go').disabled = !opts.length; $('#org-move').dataset.id = id; $('#org-move').returnValue = ''; ORG.moveBack = back || document.activeElement;
  $('#org-move').showModal();
}
$('#org-move').addEventListener('close', () => {
  const d = $('#org-move'), id = d.dataset.id, v = $('#om-sel').value;
  if (d.returnValue === 'go' && v) { const [k, t] = [v.slice(0, v.indexOf(':')), v.slice(v.indexOf(':') + 1)]; orgMove(k === 'before' ? { before: t } : { after: t }, id); }
  if (ORG.moveBack && ORG.moveBack.isConnected) ORG.moveBack.focus(); else orgFocusBack();
});

// ----- the panel -----
const orgKey = () => { const a = document.activeElement; return a && a.closest && a.closest('#org') && a.dataset.fk ? a.dataset.fk : ''; };
function orgFocusBack(fk = ORG.focusFk) {
  ORG.focusFk = '';
  if (!fk) return;
  const el = [...document.querySelectorAll('#org [data-fk]')].find((x) => x.dataset.fk === fk);
  if (el) { el.focus(); return; }
  if (fk.startsWith('sel:') || fk.startsWith('del:')) { const f = $('#org [data-act="sel"]'); if (f) f.focus(); }
}
function orgPagesText(e, scope) {
  if (e.on === false) return 'hidden';
  if (scope === 'week') return 'every week'; if (scope === 'month') return 'each month';
  const ns = ORG.flow.pages.filter((p) => p.eid === e.id).map((p) => p.n); if (!ns.length) return e.type === 'weeks' ? '' : 'not in this book';
  if (e.type === 'weeks') return `pages ${ns[0]} to ${ns[ns.length - 1]}`;
  return ns.length === 1 ? `page ${ns[0]}` : ns.every((x, i) => i === 0 || x === ns[i - 1] + 1) ? `pages ${ns[0]} to ${ns[ns.length - 1]}` : `pages ${ns.join(', ')}`;
}
function orgRow(e, scope, list, i) {
  const T = orgMeta(e.type), off = e.on === false, isW = e.type === 'weeks', prot = !!T.protected || isW, built = (ORG.cat.builtIn || []).includes(e.id) || isW, name = orgName(e);
  const first = i === 0, last = i === list.length - 1, gcls = scope === 'book' ? 'og-gt' : 'og-gs';
  const eyeLab = isW ? `${name}: the journal itself, can’t be hidden` : prot ? `${name} is protected: it can move but can’t be hidden` : off ? `Show ${name}` : `Hide ${name}`;
  const why = isW ? 'The weeks are the journal itself, so they can’t be hidden.' : prot ? BKE.protectWhy(ORG.cat, e) : '';
  return `<li class="og-row${off ? ' off' : ''}${ORG.sel === e.id ? ' sel' : ''}${e.type === 'notes' || !built ? ' many' : ''}" data-eid="${escH(e.id)}" data-scope="${scope}">
    <span class="og-grip ${gcls}" aria-hidden="true">${GRIP}</span>
    <button class="og-name" type="button" data-act="sel" data-fk="sel:${escH(e.id)}" ${ORG.sel === e.id ? 'aria-current="true"' : ''}><b>${prot ? BK_IC.lock : ''}${off ? BK_IC.eyeoff : ''}<span>${escH(name)}</span></b><small>${escH(orgPagesText(e, scope))}</small></button>
    <span class="og-btns">
      <button class="og-b" type="button" data-act="up" data-fk="up:${escH(e.id)}" aria-label="Move ${escH(name)} earlier" ${first || off ? 'aria-disabled="true"' : ''}>${OG_IC.up}</button>
      <button class="og-b" type="button" data-act="down" data-fk="down:${escH(e.id)}" aria-label="Move ${escH(name)} later" ${last || off ? 'aria-disabled="true"' : ''}>${OG_IC.down}</button>
      ${isW ? '' : `<button class="og-b" type="button" data-act="eye" data-fk="eye:${escH(e.id)}" aria-label="${escH(eyeLab)}" ${prot ? `aria-disabled="true" aria-describedby="ogw-${escH(e.id)}"` : `aria-pressed="${off}"`}>${prot ? BK_IC.lock : off ? OG_IC.eye : BK_IC.eyeoff}</button>`}
      ${e.type === 'notes' ? `<button class="og-b" type="button" data-act="dup" data-fk="dup:${escH(e.id)}" aria-label="Duplicate ${escH(name)}">${OG_IC.dup}</button>` : ''}
      ${built ? '' : `<button class="og-b danger" type="button" data-act="del" data-fk="del:${escH(e.id)}" aria-label="Remove ${escH(name)} from the book">${OG_IC.del}</button>`}
    </span>
    ${why ? `<small class="og-why-row" id="ogw-${escH(e.id)}">${escH(why)}</small>` : ''}
    ${isW ? orgWeeksGroup(e) : ''}</li>`;
}
function orgWeeksGroup(w) {
  const o = w.options || {}, m = o.month || [], k = o.week || [];
  return `<div class="og-group" style="grid-column:1/-1"><p class="og-grouplab" id="ogl-m">Month pages: each month has these, in this order</p><ul class="og-list" data-list="month" aria-labelledby="ogl-m">${m.map((e, i) => orgRow(e, 'month', m, i)).join('')}</ul>
    <p class="og-grouplab" id="ogl-w">Week pages: every week has these, in this order</p><ul class="og-list" data-list="week" aria-labelledby="ogl-w">${k.map((e, i) => orgRow(e, 'week', k, i)).join('')}</ul></div>`;
}
function orgPanel() {
  const body = $('#og-body'); if (!body || !ORG.cat) return;
  const fk = orgKey() || ORG.focusFk, f = ORG.flow, mon = orgMonth(), list = orgList(), kdp = BKE.kdpNote(f.pages.length, ORG.hard);
  const spreads = Math.floor(f.pages.length / 2) + 1, own = BKE.overridden(ORG.book), months = ORG.cat.months;
  const missing = f.missing;
  const openDet = body.querySelector('details.og-auto')?.open, moreOpen = body.querySelector('details.og-more')?.open;
  const pos = body.scrollTop;
  const flat = list.flatMap((x) => (x.type === 'weeks' ? [...((x.options || {}).month || []), ...((x.options || {}).week || [])] : [x]));
  const typeRows = Object.entries(ORG.cat.meta).filter(([k]) => k !== 'weeks' && k !== 'notes').map(([k, T]) => {
    const e = flat.find((x) => x.type === k);
    const state = e ? (e.on === false ? 'Hidden: switch it on with the eye' : `Already in the book (${orgPagesText(e, T.scope)})`) : `${T.scope === 'book' ? 'Front or back page' : T.scope === 'month' ? 'Month page' : 'Week page'}`;
    return `<li><span>${escH(T.name)}<small>${escH(state)}</small></span>${e ? '' : `<button class="og-b" type="button" data-act="add" data-type="${k}" data-fk="add:${k}" aria-label="Add ${escH(T.name)}">${OG_IC.plus}<span>Add</span></button>`}</li>`;
  }).join('');
  const top = list;
  const whereOpts = () => { const w = []; top.forEach((x) => { const p = orgPageOf(x.id); w.push(`<option value="before:${escH(x.id)}">Before ${escH(orgName(x))}${p && x.type !== 'weeks' ? ` (page ${p.n})` : x.type === 'weeks' ? ' (the weeks start here)' : ''}</option>`); }); w.push('<option value="end" selected>At the end of the book</option>'); return w.join(''); };
  const whereSel = $('#og-where') ? $('#og-where').value : '';
  const auto = f.autoNotes;
  body.innerHTML = `
    <div class="og-sum" id="og-sum"><div><b>${orgPlural(f.pages.length, 'page', 'pages')}</b> <span class="fine">· ${orgPlural(spreads, 'spread', 'spreads')}${ORG.hard ? ' · hardcover' : ' · paperback'}</span></div>
      <div class="kdp ${kdp.ok ? 'ok' : 'bad'}">${kdp.ok ? OG_IC.ok : OG_IC.bad}<span>${escH(kdp.text)}</span></div>
      <button class="og-sw" type="button" role="switch" aria-checked="${ORG.hard}" data-act="hard" data-fk="hard" style="justify-content:flex-start">Count as a hardcover (76 pages at least)</button>
      <p class="fine" style="margin:0">${orgPlanScope() !== 'month' ? `This book’s plan is ${escH(LM.SCOPE_NAMES[orgPlanScope()] || orgPlanScope())}: it prints as volumes of at most 110 pages, cut on month or week boundaries. The sample here is one month.` : 'The sample shows one month. Every month follows the same page list, with its own weeks.'}</p></div>
    ${missing.length ? `<div class="og-warn" id="og-missing" role="alert"><b>This book can’t be saved or printed yet.</b><ul>${missing.map((m) => `<li>${escH(m.from.slice(0, 3).join(', '))}${m.from.length > 3 ? ' and more' : ''} points to <b>${escH(m.target)}</b>, which isn’t in the book. Put ${escH(m.target)} back, or undo.</li>`).join('')}</ul></div>` : ''}
    <h3>Changes apply to</h3>
    <fieldset class="og-scope"><legend class="sr">Which months a change applies to</legend>
      <label class="og-radio"><input type="radio" name="og-scope" value="all" ${ORG.only ? '' : 'checked'} data-fk="scope-all"> All months</label>
      <label class="og-radio"><input type="radio" name="og-scope" value="one" ${ORG.only ? 'checked' : ''} data-fk="scope-one"> Only <select id="og-mon" aria-label="Which month" data-fk="scope-mon">${months.map((m) => `<option value="${m}" ${m === ORG.mon ? 'selected' : ''}>${orgMonthName(m)}${own.includes(m) ? ' (own pages)' : ''}</option>`).join('')}</select></label></fieldset>
    <p class="fine" style="margin-top:8px">${ORG.only ? (own.includes(ORG.mon) ? `${orgMonthName(ORG.mon)} has its own page list. Changes here don’t touch the other months.` : `${orgMonthName(ORG.mon)} follows the default. Your first change here gives it its own page list.`) : own.length ? `Changes here don’t reach the ${own.length} ${own.length === 1 ? 'month that has its own pages' : 'months that have their own pages'}. Reset ${own.length === 1 ? 'it' : 'them'} to follow the default.` : 'Every month shares one page list.'}</p>
    ${own.length ? `<ul class="og-months" aria-label="Months with their own pages">${own.map((m) => `<li><span>${escH(orgMonthName(m))}</span><button class="og-b" type="button" data-act="resetmon" data-mon="${m}" data-fk="reset:${m}" aria-label="Reset ${escH(orgMonthName(m))} to the default pages">Reset</button></li>`).join('')}</ul>` : ''}
    <h3>${mon ? escH(orgMonthName(mon)) + ': pages' : 'Pages, front to back'}</h3>
    <ul class="og-list" data-list="book" id="og-list" aria-label="${mon ? escH(orgMonthName(mon)) + ' pages' : 'Pages of the book'}">${top.map((e, i) => orgRow(e, 'book', top, i)).join('')}</ul>
    <p class="fine" style="margin-top:8px">Drag a row by its handle, or use the arrows. Month pages stay among month pages, week pages among week pages.</p>
    <h3>Add a page</h3>
    <label class="og-where"><span>Where</span><select id="og-where" data-fk="where">${whereOpts()}</select></label>
    <ul class="og-add"><li><span>Notes page<small>A header and a dot grid to write on. You can add as many as you like.</small></span><button class="og-b primary" type="button" data-act="add" data-type="notes" data-fk="add:notes" aria-label="Add a Notes page">${OG_IC.plus}<span>Add</span></button></li></ul>
    <details class="og-more"${moreOpen ? ' open' : ''}><summary>Other page types</summary><ul class="og-add">${typeRows}</ul>
      <p class="fine" style="margin-top:8px">Only Notes pages can repeat. A built-in page can be hidden with the eye, not deleted. Pages you add can be removed.</p></details>
    <details class="og-auto"${openDet ? ' open' : ''}><summary>${OG_IC.info} Automatic: made for you, not editable</summary><ul>
      <li>${auto ? `${orgPlural(auto, 'Notes page', 'Notes pages')} ${auto === 1 ? 'is' : 'are'} added by itself (dashed on the canvas) so left and right pages face correctly and the count stays even, at least 24 (76 for a hardcover).` : 'No Notes pages needed: the spreads face correctly and the count is even.'}</li>
      <li>Page numbers, and every “see page N” pointer, follow the pages when they move.</li>
      <li>Scan codes and page codes are made at print. The Keeper’s page number is filled in for you.</li></ul></details>
    <h3>The book file</h3>
    <p class="fine" id="og-fmsg">${escH(orgSaveText())}</p>
    <div class="og-file">
      <button class="og-b" type="button" data-act="download" data-fk="download">Download book.json</button>
      <button class="og-b" type="button" data-act="copy" data-fk="copy">Copy</button>
      <button class="og-b" type="button" data-act="import" data-fk="import">Import…</button>
      ${MODE === 'pages' ? `<button class="og-b" type="button" data-act="gh" data-fk="gh">Save to GitHub…</button><button class="og-b" type="button" data-act="ghload" data-fk="ghload">Load from GitHub</button>` : ''}
      <button class="og-b danger" type="button" data-act="reset" data-fk="reset">Reset to the original</button></div>`;
  body.scrollTop = pos;
  orgSortable();
  const w = $('#og-where'); if (w && whereSel && [...w.options].some((o) => o.value === whereSel)) w.value = whereSel;
  orgSelWhere();
  if (fk) orgFocusBack(fk);
  $('#og-state').textContent = orgSaveText();
}
function orgSelWhere() { // a new page goes after the selected one, at the front or back (Notes pages sit outside the weeks)
  const w = $('#og-where'); if (!w || ORG.whereTouched) return;
  const at = orgEntry();
  if (!at) { w.value = 'end'; return; }
  const top = orgList(); let ix = at.scope === 'book' ? at.i : top.findIndex((x) => x.type === 'weeks'); if (ix < 0) return;
  const nxt = top[ix + 1]; w.value = nxt ? `before:${nxt.id}` : 'end';
}
function orgMarkRows() {
  document.querySelectorAll('#org .og-row').forEach((li) => { const on = li.dataset.eid === ORG.sel; li.classList.toggle('sel', on); const b = li.querySelector(':scope > .og-name'); if (b) { if (on) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current'); } });
  orgSelWhere();
}
function orgSaveText() {
  if (MODE === 'demo') return 'Demo: your changes stay on this page and are not saved anywhere.';
  if (!ORG.touched) return MODE === 'pages' ? 'The book matches the pages the books use now.' : 'The book matches the original pages.';
  if (MODE === 'pages') return ORG.ghDirty ? 'Saved in this browser · not on GitHub yet.' : 'Saved in this browser and on GitHub.';
  if (MODE === 'artifact') return db ? 'Saved.' : 'Preview only: changes aren’t saved here.';
  return 'Saved.';
}

// Drag a row (the list is a second, always-available way to drag; the canvas is the first). A list only takes its own kind of page.
function orgSortable() {
  if (typeof Sortable === 'undefined') return;
  document.querySelectorAll('#org ul.og-list').forEach((ul) => {
    const scope = ul.dataset.list, top = scope === 'book';
    Sortable.create(ul, { group: 'og-' + scope, handle: top ? '.og-gt' : '.og-gs', draggable: '.og-row', animation: matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 150, ghostClass: 'og-ghost', chosenClass: 'og-chosen', fallbackTolerance: 3,
      onEnd: (e) => {
        if (e.oldIndex === e.newIndex) return;
        const ids = [...ul.children].filter((c) => c.classList.contains('og-row')).map((c) => c.dataset.eid), i = e.newIndex, id = ids[i];
        orgMove(ids[i + 1] ? { before: ids[i + 1] } : { after: ids[i - 1] }, id); orgPanel();
      } });
  });
}

// ----- clicks in the panel -----
$('#og-body').addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]'); if (!b) return; const li = b.closest('.og-row'), id = li && li.dataset.eid, act = b.dataset.act;
  if (act === 'sel') { const at = BKE.locate(orgList(), id); if (at && at.entry.on === false) orgSelectEntry(id, { hidden: true }); else orgSelectEntry(id); ORG.focusFk = 'sel:' + id; return; }
  if (act === 'up' || act === 'down') { if (b.getAttribute('aria-disabled') === 'true') { const at = BKE.locate(orgList(), id); orgSay(at && at.entry.on === false ? 'Show this page before you move it.' : 'It is already at the end of its list.', true); return; } ORG.focusFk = `${act}:${id}`; orgSelectEntry(id); orgMove({ step: act === 'up' ? -1 : 1 }, id); return; }
  if (act === 'eye') { const at = BKE.locate(orgList(), id); if (b.getAttribute('aria-disabled') === 'true') { orgSay(BKE.protectWhy(ORG.cat, at.entry), true); return; } ORG.focusFk = `eye:${id}`; orgEye(id); return; }
  if (act === 'dup') { orgDup(id); return; }
  if (act === 'del') { orgRemove(id); return; }
  if (act === 'add') { const w = $('#og-where').value; ORG.whereTouched = false; orgAdd(b.dataset.type, w === 'end' || b.dataset.type !== 'notes' ? {} : { before: w.slice(7) }); return; }
  if (act === 'resetmon') { orgResetMonth(b.dataset.mon); return; }
  if (act === 'hard') { ORG.hard = !ORG.hard; orgRender(); orgSay(ORG.hard ? 'Counting as a hardcover: at least 76 pages.' : 'Counting as a paperback: at least 24 pages.'); return; }
  if (act === 'download') return orgDownload(); if (act === 'copy') return orgCopy(); if (act === 'import') return $('#org-file').click();
  if (act === 'gh') return orgGh(); if (act === 'ghload') return orgGhLoad();
  if (act === 'reset') { $('#org-reset').returnValue = ''; $('#org-reset').showModal(); }
});
$('#og-body').addEventListener('change', (e) => {
  if (e.target.name === 'og-scope') { ORG.only = e.target.value === 'one'; orgRender(); orgSay(ORG.only ? `Changes now apply only to ${orgMonthName(ORG.mon)}.` : 'Changes now apply to all months.'); }
  else if (e.target.id === 'og-mon') { ORG.mon = e.target.value; ORG.only = true; orgRender(); orgSay(`Showing ${orgMonthName(ORG.mon)}${BKE.overridden(ORG.book).includes(ORG.mon) ? ', which has its own pages' : ', which follows the default'}.`); }
  else if (e.target.id === 'og-where') ORG.whereTouched = true;
});
$('#org-reset').addEventListener('close', () => { if ($('#org-reset').returnValue === 'go') orgCommit({ book: orgClone(ORG.cat.defaultBook) }, () => 'The book is back to the original pages.', undefined, false); orgFocusBack('reset'); });
$('#og-undo').onclick = orgUndo; $('#og-redo').onclick = orgRedo;
$('#og-toggle').onclick = () => { ORG.open = !ORG.open; ORG.userToggled = true; orgLayout(); setTimeout(() => { if (BK.ready) bkResize(); }, 0); };
$('#org-file').onchange = async () => {
  const f = $('#org-file').files[0]; $('#org-file').value = ''; if (!f) return;
  try { const b = JSON.parse(await f.text()), errs = BKE.checkBook(b, ORG.cat); if (errs.length) { orgSay(`That file isn’t a valid book: ${errs[0]}${errs.length > 1 ? ` (and ${errs.length - 1} more)` : ''}`, true); return; } orgCommit({ book: b }, (fl) => `Imported a book of ${fl.pages.length} pages.`, undefined, false); }
  catch { orgSay('That file isn’t a book.json.', true); }
};

// ----- saving (download, GitHub, the browser, the artifact store, the Studio draft) -----
const orgBlocked = () => { const m = ORG.flow && ORG.flow.missing; if (m && m.length) { orgSay(`Not saved: ${m[0].from[0]} points to ${m[0].target}, which isn’t in the book. Put it back, or undo.`, true); return true; } return false; };
async function orgDownload() {
  if (orgBlocked()) return;
  const text = BKE.bookJson(ORG.book);
  if (typeof dl !== 'undefined' && dl) { try { await dl.save({ filename: 'book.json', data: text }); orgSay('Saved book.json.'); } catch (e) { if (e && e.code !== 'declined') orgSay('Couldn’t save the file.', true); } return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' })); a.download = 'book.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  orgSay('Downloaded book.json. Put it in journal/content/ to use it.');
}
async function orgCopy() { if (orgBlocked()) return; try { await navigator.clipboard.writeText(BKE.bookJson(ORG.book)); orgSay('Copied the book JSON.'); } catch { orgSay('Couldn’t copy here. Use Download instead.', true); } }
function orgGh() { if (orgBlocked()) return; ghOpen({ path: 'journal/content/book.json', msg: 'Book pages from the editor', body: () => BKE.bookJson(ORG.book), after: () => { ORG.ghDirty = false; $('#og-state').textContent = orgSaveText(); const m = $('#og-fmsg'); if (m) m.textContent = orgSaveText(); } }); }
async function orgGhLoad() {
  const repo = ghRepo(), branch = store.get('kw-gh-branch') || 'main', token = store.get('kw-gh-token') || sessionToken;
  if (!repo) { orgGh(); return; }
  try {
    const f = await gh('GET', repo, token, `journal/content/book.json?ref=${encodeURIComponent(branch)}`);
    if (!f) { orgSay('No book.json on GitHub yet: the books use the original pages.'); return; }
    const b = JSON.parse(unb64(f.content)), errs = BKE.checkBook(b, ORG.cat); if (errs.length) { orgSay(`The book on GitHub isn’t valid: ${errs[0]}`, true); return; }
    orgCommit({ book: b }, (fl) => `Loaded the book from GitHub: ${fl.pages.length} pages.`, undefined, false); ORG.ghDirty = false;
  } catch (e) { orgSay(e.message || 'Couldn’t reach GitHub.', true); }
}
function orgPersist() {
  const changed = !BKE.sameBook(ORG.book, ORG.base);
  if (MODE === 'demo') { $('#og-state').textContent = orgSaveText(); return; }
  if (MODE === 'pages') { store.set(ORG_KEY, BKE.sameBook(ORG.book, ORG.cat.defaultBook) && !changed ? null : JSON.stringify(ORG.book)); ORG.ghDirty = changed; if (changed) dirty = true; }
  else if (db && !readOnly && !(ORG.flow.missing || []).length) { clearTimeout(ORG.timer); ORG.timer = setTimeout(async () => { try { await db.doc('layouts/book').set({ book: ORG.book, savedAt: new Date().toISOString() }); } catch { setStatus('Couldn’t save the book. Try again in a moment', 'bad'); } }, 600); }
  if (typeof stQueueDraft === 'function') stQueueDraft(); // the Studio draft carries the book too (KWBK.part)
  $('#og-state').textContent = orgSaveText(); const m = $('#og-fmsg'); if (m) m.textContent = orgSaveText();
}
window.KWBK = { // for the Versions drawer (versions.js): the book rides in the draft and the versions
  get touched() { return ORG.touched; },
  current() { return ORG.book ? orgClone(ORG.book) : null; },
  base() { return ORG.base ? orgClone(ORG.base) : null; },
  part() { return ORG.book && ORG.touched && !((ORG.flow && ORG.flow.missing) || []).length ? { book: orgClone(ORG.book) } : {}; },
  load(book) { // a version or draft opened from the Studio
    const b = book && Object.keys(book).length ? book : null;
    if (!ORG.cat) { ORG.pending = b; return; }
    const next = b && !BKE.checkBook(b, ORG.cat).length ? orgClone(b) : orgClone(ORG.base); // nothing stored = the book as the site has it
    if (BKE.sameBook(next, ORG.book)) return;
    ORG.undo.push({ book: ORG.book, sel: '', pid: '' }); ORG.redo = []; ORG.book = next; ORG.touched = !BKE.sameBook(next, ORG.base); orgRender(null); if (MODE === 'pages') store.set(ORG_KEY, ORG.touched ? JSON.stringify(next) : null);
  },
};

// ----- mode: the panel, toolbar and buttons exist only while editing the book -----
function orgLayout() {
  const open = ORG.on && ORG.open; $('#org').hidden = !open; $('#og-toggle').setAttribute('aria-expanded', open);
}
function orgMode(on) {
  const was = ORG.on; ORG.on = !!on;
  if (ORG.on && !was && !ORG.userToggled) ORG.open = !matchMedia('(max-width: 960px)').matches; // a phone starts with the canvas and the page toolbar; Pages opens the list
  orgLayout();
  bkView.setAttribute('aria-label', 'Book canvas. Drag to move, scroll or pinch to zoom in and out, arrow keys to move, plus and minus to zoom, Enter to go in one level, Escape to go out one level, 0 whole book, 1 spread, 2 day page, bracket keys for the previous and next page.' + (ORG.on ? ' Editing: Alt with Left or Right moves the selected page, H hides or shows it, Delete removes a page you added, Control Z undoes.' : ''));
  $('#book').setAttribute('aria-label', ORG.on ? 'Book canvas, editing pages' : 'Book canvas, read-only');
  if (ORG.on && ORG.cat) { orgRender(); if (BK.ready) setTimeout(() => bkResize(), 0); }
  else { $('#org-sel').hidden = true; orgDragCancel(); if (was && BK.ready) setTimeout(() => bkResize(), 0); }
}

// ----- keyboard on the canvas and the panel -----
$('#book').addEventListener('keydown', (e) => {
  if (!orgOn()) return;
  const typing = e.target.closest('input, textarea, select, dialog');
  if (typing) return;
  const k = e.key;
  if (e.altKey && !e.ctrlKey && !e.metaKey && (k === 'ArrowLeft' || k === 'ArrowRight')) { e.preventDefault(); e.stopPropagation(); const at = orgEntry(); if (!at) { orgSay('Select a page first: click it, or press the bracket keys.', true); return; } if (BK.sel && BK.pages[BK.sel - 1].auto) { orgSay('This Notes page was added by itself, so it can’t be moved.', true); return; } if (at.entry.on === false) { orgSay('Show this page before you move it.', true); return; } orgMove({ step: k === 'ArrowLeft' ? -1 : 1 }); return; }
  if ((e.ctrlKey || e.metaKey) && !e.altKey && (k === 'z' || k === 'Z')) { e.preventDefault(); e.shiftKey ? orgRedo() : orgUndo(); return; }
  if ((e.ctrlKey || e.metaKey) && !e.altKey && (k === 'y' || k === 'Y')) { e.preventDefault(); orgRedo(); return; }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.target === bkView) {
    if (k === 'h' || k === 'H') { e.preventDefault(); orgEye(); }
    else if (k === 'Delete') { e.preventDefault(); const at = orgEntry(); if (at && !(ORG.cat.builtIn || []).includes(at.entry.id)) orgRemove(); else orgSay(at ? BKE.removeEntry(ORG.book, ORG.cat, orgMonth(), at.entry.id).err : 'Select a page first.', true); }
    else if (k === 'm' || k === 'M') { e.preventDefault(); orgMoveDialog(); }
  }
}, true);

// ----- drag on the canvas: mouse and pen (touch pans; on a phone use Move to… or the list) -----
let ogDrag = null;
function orgDragCancel() { if (!ogDrag) return; ogDrag.fly?.remove(); $('#org-drop')?.remove(); bkView.classList.remove('moving'); bkWorld.querySelectorAll('.dragging').forEach((el) => el.classList.remove('dragging')); ogDrag = null; }
function orgEat(e) { e.stopPropagation(); ptrs.delete(e.pointerId); gest = null; bkView.classList.remove('drag'); }
bkView.addEventListener('pointerdown', (e) => {
  if (!orgOn() || BK.level !== 'book' && BK.level !== 'spread' && BK.level !== 'page' || e.pointerType === 'touch' || e.button !== 0) return;
  const el = e.target.closest('.bpg'); if (!el) return;
  ogDrag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, el, n: el.dataset.n ? +el.dataset.n : 0, hid: el.dataset.hid !== undefined ? +el.dataset.hid : -1, live: false, drop: null };
}, true);
function orgResolve(x, y, mover) { // the pointer's page and side -> a place in the list, checked against the rules
  let el = document.elementFromPoint(x, y); el = el && el.closest ? el.closest('.bpg[data-n]') : null;
  const r0 = bkView.getBoundingClientRect(); let n;
  if (el) n = +el.dataset.n; else { const inside = x >= r0.left && x <= r0.right && y >= r0.top && y <= r0.bottom; if (!inside) return { none: true }; n = bkPageAt((x - r0.left - BK.x) / BK.z, (y - r0.top - BK.y) / BK.z); }
  const slot = BK.slots.get(n); if (!slot) return { none: true };
  const rr = slot.getBoundingClientRect(), right = x > rr.left + rr.width / 2, pages = BK.pages, gapA = right ? n : n - 1, gapB = right ? n + 1 : n;
  const A = pages[gapA - 1], B = pages[gapB - 1], cands = [];
  if (B && !B.auto && B.eid !== mover) cands.push({ before: B.eid }); if (A && !A.auto && A.eid !== mover) cands.push({ after: A.eid });
  if (!cands.length) { const same = (A && A.eid === mover) || (B && B.eid === mover); return { n, right, err: same ? '' : 'Drop it between two pages of the book.' }; }
  let first = null;
  for (const c of cands) { const r = BKE.moveEntry(ORG.book, ORG.cat, orgMonth(), mover, c); if (r.book) return { n, right, spec: c }; first = first || r.err; }
  return { n, right, err: /is already there/.test(first || '') ? '' : first }; // passing over its own place is not an error
}
function orgDropMark(t, ok) {
  let d = $('#org-drop');
  if (!t || t.none || t.n === undefined) { d?.remove(); return; }
  if (!d) { d = document.createElement('div'); d.id = 'org-drop'; bkWorld.appendChild(d); }
  const p = bkSlotPos(t.n), w = 6 / BK.z;
  d.className = ok ? '' : 'bad'; d.style.width = w + 'px'; d.style.height = BK.geo.ph + 'px'; d.style.left = (p.x + (t.right ? BK.geo.pw : 0) - w / 2) + 'px'; d.style.top = p.y + 'px';
}
bkView.addEventListener('pointermove', (e) => {
  const d = ogDrag; if (!d || e.pointerId !== d.id) return;
  if (!d.live) {
    if (Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < 4) return;
    if (d.hid >= 0) { ogDrag = null; return; }  // a hidden page comes back with the eye, not by dragging
    const p = BK.pages[d.n - 1];
    if (!p || p.auto) { orgSay('This Notes page was added by itself, so it can’t be moved. It goes where the book needs it.', true); ogDrag = null; return; }
    d.live = true; d.mover = p.eid; orgEat(e); bkView.classList.add('moving'); d.el.classList.add('dragging'); bkSelect(d.n);
    d.fly = document.createElement('div'); d.fly.className = 'og-ghost-fly'; d.fly.textContent = `Moving ${p.label || orgName(orgEntry(p.eid).entry)}`; document.body.appendChild(d.fly);
  }
  e.stopPropagation(); e.preventDefault();
  d.fly.style.left = e.clientX + 14 + 'px'; d.fly.style.top = e.clientY + 14 + 'px';
  const t = orgResolve(e.clientX, e.clientY, d.mover); d.drop = t;
  const ok = !!t.spec; orgDropMark(t, ok); d.fly.classList.toggle('bad', !ok && !t.none);
  if (t.err && t.err !== d.said) { d.said = t.err; orgSay(t.err, true); } else if (t.spec) d.said = '';
}, true);
const orgUp = (e) => {
  const d = ogDrag; if (!d || e.pointerId !== d.id) return;
  if (!d.live) { ogDrag = null; if (d.hid >= 0 && e.type === 'pointerup' && Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < 4) { orgEat(e); const h = BK.hidden[d.hid]; if (h) { orgSelectEntry(h.eid, { hidden: true }); if (ORG.on) { const b = $(`#org [data-fk="sel:${CSS.escape(h.eid)}"]`); b && b.scrollIntoView({ block: 'nearest' }); } } } return; }
  e.stopPropagation(); ptrs.delete(e.pointerId); gest = null;
  const t = d.drop, mover = d.mover; orgDragCancel();
  if (e.type === 'pointerup' && t && t.spec) orgMove(t.spec, mover);
  else if (e.type === 'pointerup' && t && t.err) orgSay(t.err, true);
  else orgSay('Nothing moved.');
};
bkView.addEventListener('pointerup', orgUp, true); bkView.addEventListener('pointercancel', orgUp, true);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && ogDrag && ogDrag.live) { e.stopPropagation(); orgDragCancel(); orgSay('Nothing moved.'); } }, true);
