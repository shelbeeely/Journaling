// ---------- Library and Series (L1b): the two levels above the Book ----------
// One continuous zoom: Library (shelves of covers) > Series (its books) > Book > Spread > Page/Day. This file draws the shelves, the settings
// sheets and the undo; the navigation itself (hash routes, breadcrumb, Back, focus) lives in the navigation section above (navGo, navParse,
// navRefresh) and calls the lb* functions here. The data model and every rule is journal/library.mjs (LM): the editor never invents its own.
const LM = /*__LIBM__*/;
const SAMPLE_LIB = /*__SAMPLELIB__*/null; // the public demo's generic library; null in every other build
const LB = { lib: null, undo: [], cur: '', touched: false, warned: false, focus: null, tkey: '' };
const LB_KEY = 'kw-library', LB_CUR = 'kw-lib-cur';
const BOOK_TITLE0 = String(I18N_VARS.title || '').trim() || _t('lib.my_book'); // the build's own book title (the header says it)
const SCOPE_LABEL = { get month() { return _t('lib.scope_month'); }, get quarter() { return _t('lib.scope_quarter'); }, get season() { return _t('lib.scope_season'); }, get 'half-year'() { return _t('lib.scope_half_year'); }, get year() { return _t('lib.scope_year'); }, get custom() { return _t('lib.scope_custom'); }, get undated() { return _t('lib.scope_undated'); } };
const SCOPE_PICK = LM.SCOPES.filter((s) => s !== 'custom');
const lbClone = (x) => JSON.parse(JSON.stringify(x));
const lbBook = (id) => LM.bookOf(LB.lib, id), lbSeries = (id) => LM.seriesOf(LB.lib, id), lbSeriesOfBook = (id) => LM.seriesOfBook(LB.lib, id);
const LI = {
  lib: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="4" width="3.6" height="12" rx=".8"/><rect x="7.2" y="4" width="3.6" height="12" rx=".8"/><path d="m12.7 5.4 3.4-.9 2.4 10.6-3.4.9z"/></svg>',
  series: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="2.5" width="12" height="4" rx="1"/><rect x="4" y="8" width="12" height="4" rx="1"/><rect x="4" y="13.5" width="12" height="4" rx="1"/></svg>',
  gear: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><circle cx="10" cy="10" r="2.6"/><path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M4.7 15.3l1.4-1.4M13.9 6.1l1.4-1.4"/></svg>',
  grip: '<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><circle cx="7.5" cy="5" r="1.4"/><circle cx="12.5" cy="5" r="1.4"/><circle cx="7.5" cy="10" r="1.4"/><circle cx="12.5" cy="10" r="1.4"/><circle cx="7.5" cy="15" r="1.4"/><circle cx="12.5" cy="15" r="1.4"/></svg>',
  left: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4.5 6.5 10l5.5 5.5"/></svg>',
  right: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 4.5 13.5 10 8 15.5"/></svg>',
  up: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.5 12 10 6.5l5.5 5.5"/></svg>',
  down: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.5 8 10 13.5 15.5 8"/></svg>',
};

// ----- plain words for library.mjs problems -----
const FIELD_NAME = { get title() { return _t('lib.field_title'); }, get subtitle() { return _t('lib.field_subtitle'); }, get spineTitle() { return _t('lib.field_spine_title'); }, get slug() { return _t('lib.field_slug'); }, get edition() { return _t('lib.field_edition'); }, get start() { return _t('lib.field_start'); }, get bookId() { return _t('lib.field_book_id'); }, get seriesId() { return _t('lib.field_series'); }, get 'plan.scope'() { return _t('lib.field_plan'); }, get order() { return _t('lib.field_order'); }, get defaults() { return _t('lib.field_defaults'); } };
function lbPlain(lib, m) {
  const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1) + (/[.!?]$/.test(t) ? '' : '.');
  const words = (t) => t.replace(/"([a-z0-9-]+)"/g, (x, id) => { const o = LM.bookOf(lib, id) || LM.seriesOf(lib, id); return o ? _t('lib.quoted', { title: o.title }) : x; }); // ids become titles
  const r = /^(books|series)\[(\d+)\](?:\.([\w.]+))?: (.*)$/.exec(m);
  if (!r) return cap(words(m.replace(/^\w+: /, '')));
  const kind = r[1] === 'books' ? 'book' : 'series', item = (lib[r[1]] || [])[+r[2]], msg = words(r[4]);
  if (r[3] === 'title' && /^required/.test(r[4])) return kind === 'book' ? _t('lib.give_book_title') : _t('lib.give_series_title');
  const f = r[3] ? (FIELD_NAME[r[3]] || r[3].replace(/^defaults\./, 'default ').replace(/^plan\./, 'plan ')) : '';
  return cap(`${kind === 'book' ? _t('lib.kind_book') : _t('lib.kind_series')} ${item && item.title ? _t('lib.quoted', { title: item.title }) : _t('lib.number_n', { n: +r[2] + 1 })}${f ? `, ${f}` : ''}: ${msg}`);
}

// ----- the library: load, keep, change, undo -----
function lbDefault(title, subtitle, slug) { // a project that has one book: a library of one (nothing changes until a second book is added)
  const t = title || BOOK_TITLE0, id = LM.slugify(slug || t) || 'book';
  return { version: 1, books: [{ id, title: t, ...(subtitle ? { subtitle } : {}) }], series: [], layouts: [], defaultBook: id };
}
const lbValid = (l) => l && typeof l === 'object' && LM.validateLibrary(l).length === 0;
function lbLocal() { try { const j = JSON.parse(store.get(LB_KEY) || 'null'); return lbValid(j) ? j : null; } catch { return null; } }
function lbInitCur() {
  const id = MODE === 'demo' ? '' : store.get(LB_CUR), l = LB.lib; // the demo remembers nothing
  LB.cur = id && lbBook(id) ? id : l.defaultBook && lbBook(l.defaultBook) ? l.defaultBook : l.books[0].id;
}
async function lbLoad() {
  let lib = null;
  if (MODE === 'demo' && SAMPLE_LIB) lib = lbClone(SAMPLE_LIB); // the demo never saves anywhere
  else if (MODE === 'pages') lib = lbLocal();
  else if (db) { try { const s = await db.doc('layouts/library').get(), d = s.data && s.data(); if (d && lbValid(d.library)) lib = d.library; } catch { /* the default library below */ } }
  LB.lib = lib || lbDefault(); LB.undo = []; LB.touched = false; lbInitCur();
}
function lbPersist() { // saves; returns a warning when it could not (said with the change, so it is not lost behind "Book saved.")
  if (MODE === 'demo') return '';
  if (typeof ST !== 'undefined' && ST.pid) { // a Studio project: the library is part of the project's draft
    if (stWrites()) { stQueueDraft(); return ''; }
    if (!LB.warned) { LB.warned = true; return _t('lib.readonly_project'); }
    return '';
  }
  let w = '';
  if (MODE === 'pages') {
    const j = JSON.stringify(LB.lib); store.set(LB_KEY, j);
    if (store.get(LB_KEY) !== j) { w = _t('lib.storage_blocked'); }
  } else if (db && !readOnly) db.doc('layouts/library').set({ library: LB.lib, savedAt: new Date().toISOString() }).catch(() => lbSnack(_t('lib.cant_save_library')));
  else if (!LB.warned) { LB.warned = true; w = _t('lib.preview_only'); }
  return w;
}
// Apply a new library: validated by library.mjs first; returns the problems in plain words (empty = done).
function lbApply(next, snack) {
  const errs = LM.validateLibrary(next);
  if (errs.length) return errs.map((m) => lbPlain(next, m));
  LB.undo.push(LB.lib); if (LB.undo.length > 40) LB.undo.shift();
  LB.lib = next; LB.touched = true; const w = lbPersist(); lbEnsureContext(); lbRedraw();
  if (snack || w) lbSnack([snack, w].filter(Boolean).join(' '), !!snack);
  return [];
}
function lbUndo(quiet) {
  if (!LB.undo.length) return;
  LB.lib = LB.undo.pop(); LB.touched = true; const w = lbPersist(); lbEnsureContext(); lbRedraw();
  if (!quiet || w) lbSnack(quiet ? w : [_t('lib.undone'), w].filter(Boolean).join(' '));
}
// A book or series that no longer exists: the level falls back (a deleted book while it is open, an undo, an import).
function lbEnsureContext() {
  if (!lbBook(LB.cur)) lbInitCur();
  if (typeof NAV === 'undefined') return;
  if (NAV.sid && !lbSeries(NAV.sid)) NAV.sid = '';
  if (NAV.level === 'series' && !NAV.sid) navGo(lbLanding(), { push: false, anim: false });
}
const lbLanding = () => (LB.lib.books.length === 1 ? { level: 'book', bid: LB.lib.books[0].id } : { level: 'library' });
let snackT = 0;
function lbSnack(text, undo = false) {
  const el = $('#lib-snack'); $('#lib-snack-t').textContent = text; $('#lib-snack-undo').hidden = !undo || !LB.undo.length; el.hidden = false;
  clearTimeout(snackT); snackT = setTimeout(() => { el.hidden = true; }, Math.max(9000, text.length * 90)); // long enough to reach Undo (WCAG 2.2.1)
}
$('#lib-snack-undo').onclick = () => { lbUndo(); $('#lib-snack-undo').hidden = true; };

// ----- covers: the real title page, with this book's own words -----
const mon = (s) => { const [y, m] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' }); };
function lbMeta(b) {
  const r = LM.resolveBook(LB.lib, b.id, {}), sc = r.plan.scope || 'month';
  return `${SCOPE_LABEL[sc] || sc}${b.start && sc !== 'undated' ? ' · ' + mon(b.start) : ''}`;
}
const lbBase = () => LB.p0 || (BK.data && BK.data.pages[0] ? (LB.p0 = BK.data.pages[0]) : null); // the sample book's own title page, kept before any book's words go in
function lbTitleHtml(b, { cover = false } = {}) { // pages.mjs's title page (from the sample book) with this book's title, subtitle, range and series line
  const p0 = lbBase(); if (!p0) return '';
  let h = p0.html.replace(/<h1>[\s\S]*?<\/h1>/, () => `<h1>${escH(b.title)}</h1>`).replace(/<p class="sub">[\s\S]*?<\/p>/, () => `<p class="sub">${escH(b.subtitle || '')}</p>`)
    .replace(/<p class="range">[\s\S]*?<\/p>/, () => `<p class="range">${escH(lbMeta(b))}</p>`);
  const sl = LM.seriesLine(LB.lib, b.id), sr = lbSeriesOfBook(b.id);
  if (sl && sr && (sr.show || []).includes('titlepage')) h = h.replace(/(<p class="range">[\s\S]*?<\/p>)/, (m) => `${m}<p class="sub">${escH(sl.line)}</p>`);
  if (cover) h = h.replace(/<p class="(place|built)">[\s\S]*?<\/p>/g, '').replace(/<p class="owner">[\s\S]*?<\/p>/, '');
  return h;
}
function lbCover(b) {
  if (!lbBase()) return `<span class="cv cv-plain" aria-hidden="true">${escH(b.title)}</span>`;
  return `<span class="cv" aria-hidden="true"><span class="cv-in"><div class="page recto title m">${lbTitleHtml(b, { cover: true })}</div></span></span>`;
}
function lbApplyTitlePage() { // the Book level's page 1 says this book's own title
  if (!BK.loaded || !BK.data) return; lbBase(); const b = lbBook(LB.cur); if (!b) return;
  const key = [b.id, b.title, b.subtitle, b.start, JSON.stringify(b.plan), b.seriesId, JSON.stringify(lbSeriesOfBook(b.id) || '')].join('|');
  if (LB.tkey === key) return; LB.tkey = key;
  BK.pages[0] = { ...lbBase(), label: b.title, html: lbTitleHtml(b) };
  if (BK.ready) { if (NAV.view === 'book') { const n = BK.sel, lv = BK.level; BK.cols = bkPickCols(); bkBuild(); bkSelect(n); bkLevel(lv === 'detail' ? 'page' : lv, false); } else BK.stale = true; } // hidden canvas: rebuilt when it is shown
}
function lbSetBook(id) { if (!lbBook(id)) return false; LB.cur = id; if (MODE !== 'demo') store.set(LB_CUR, id); lbApplyTitlePage(); return true; }

// ----- the shelf -----
const lbEditing = () => NAV.view === 'shelf' && NAV.edit;
function lbEntries() { // what the current shelf level shows
  if (NAV.level === 'series') { const s = lbSeries(NAV.sid); return s ? s.order.map((id, i) => ({ kind: 'book', book: lbBook(id), n: i + 1, of: s.order.length })) : []; }
  return LM.shelf(LB.lib).map((e) => (e.kind === 'series' ? { kind: 'series', series: e.series, books: e.books } : { kind: 'book', book: e.book }));
}
const keyOf = (e) => `${e.kind}:${e.kind === 'series' ? e.series.id : e.book.id}`;
function shelfCard(e, i, total, edit) {
  const key = keyOf(e), nm = e.kind === 'series' ? e.series.title : e.book.title;
  let cover, meta, label;
  if (e.kind === 'series') {
    const first = e.books[0], n = e.books.length;
    cover = `<span class="sh-stack st ${n > 1 ? '' : 'one'}">${first ? lbCover(first) : '<span class="cv empty"></span>'}</span>`;
    meta = `${_t('lib.count_book', { n })}${e.series.subtitle ? ' · ' + escH(e.series.subtitle) : ''}`; label = _t('lib.open_series', { name: nm, count: _t('lib.count_book', { n }) });
  } else {
    cover = `<span class="sh-stack">${lbCover(e.book)}${e.n ? `<span class="sh-n" aria-hidden="true">${e.n}</span>` : ''}</span>`;
    meta = escH(lbMeta(e.book)); label = e.n ? _t('lib.open_book_n', { name: nm, n: e.n, of: e.of, meta: lbMeta(e.book) }) : _t('lib.open_book', { name: nm, meta: lbMeta(e.book) });
  }
  const tools = edit ? `<div class="sh-tools" role="group" aria-label="${_t('lib.edit_name', { name: escH(nm) })}">
    <button class="bk-b sh-grip" type="button" data-act="grip" aria-label="${_t('lib.drag_to_place', { name: escH(nm) })}" title="${_t('lib.drag_reorder')}"><span aria-hidden="true">${LI.grip}</span></button>
    <button class="bk-b" type="button" data-act="earlier" aria-label="${_t('lib.move_earlier', { name: escH(nm) })}"${i === 0 ? ' disabled' : ''}>${LI.left}</button>
    <button class="bk-b" type="button" data-act="later" aria-label="${_t('lib.move_later', { name: escH(nm) })}"${i === total - 1 ? ' disabled' : ''}>${LI.right}</button>
    <button class="bk-b" type="button" data-act="settings" aria-label="${_t('lib.settings_for', { name: escH(nm) })}">${LI.gear}</button></div>` : '';
  return `<li class="sh-item" data-key="${escH(key)}" data-kind="${e.kind}" data-id="${escH(e.kind === 'series' ? e.series.id : e.book.id)}"><div class="sh-card">${cover}<span class="sh-name">${escH(nm)}</span><span class="sh-meta">${meta}</span><button class="sh-open"${i === 0 ? ' id="sh-first"' : ''} type="button" data-act="open" aria-label="${escH(label)}"></button></div>${tools}</li>`;
}
function shelfDraw(keepFocus) {
  if (NAV.view !== 'shelf') return;
  const lv = NAV.level, edit = NAV.edit, lib = LB.lib, ser = lv === 'series' ? lbSeries(NAV.sid) : null;
  const items = lbEntries(), n = lib.books.length;
  $('#sh-title').textContent = ser ? ser.title : _t('lib.library');
  $('#sh-sub').textContent = ser ? [ser.subtitle, _t('lib.books_in_order', { n: ser.order.length })].filter(Boolean).join(' · ') : `${_t('lib.count_book', { n })}${lib.series.length ? ' · ' + _t('lib.count_series', { n: lib.series.length }) : ''}`;
  $('#sh-list').setAttribute('aria-label', ser ? _t('lib.books_in', { title: ser.title }) : _t('lib.books_and_series'));
  $('#sh-list').innerHTML = items.length ? items.map((e, i) => shelfCard(e, i, items.length, edit)).join('') : `<li class="sh-empty">${ser ? _t('lib.series_empty') : _t('lib.library_empty')}</li>`;
  $('#sh-note').textContent = edit ? '' : ser ? '' : n === 1 ? _t('lib.one_book_note') : '';
  $('#sh-new-series').hidden = lv === 'series'; $('#sh-series-set').hidden = lv !== 'series'; $('#sh-export').hidden = $('#sh-import').hidden = lv === 'series';
  $('#sh-undo').disabled = !LB.undo.length;
  $('#sh-out').disabled = lv === 'library'; $('#sh-in').disabled = !items.length;
  shelfSortable();
  if (keepFocus) shelfFocus(keepFocus);
}
function shelfFocus(key) {
  const el = (key && [...document.querySelectorAll('#sh-list .sh-item')].find((x) => x.dataset.key === key)) || null;
  const t = el ? (el.querySelector('[data-act="open"]')) : document.querySelector('#sh-list .sh-open') || $('#sh-title');
  if (t) t.focus({ preventScroll: false });
}
let shSort = null;
function shelfSortable() {
  if (shSort) { try { shSort.destroy(); } catch {} shSort = null; }
  if (!NAV.edit || typeof Sortable === 'undefined' || !$('#sh-list .sh-item')) return;
  shSort = Sortable.create($('#sh-list'), { handle: '.sh-grip', animation: ANIM, draggable: '.sh-item', onEnd: (ev) => { if (ev.oldIndex !== ev.newIndex) lbMoveEntry(ev.oldIndex, ev.newIndex); } });
}
// Order. In a series it is the numbering ("Book 3 of 12"); on the library shelf it is the order the books are listed.
function lbMoveEntry(from, to) {
  const l = lbClone(LB.lib);
  if (NAV.level === 'series') { const r = LM.reorderSeries(l, NAV.sid, from, to); return lbAfterMove(r, from, to, lbEntries()); }
  const entries = LM.shelf(l); if (to < 0 || to >= entries.length) return;
  const [x] = entries.splice(from, 1); entries.splice(to, 0, x);
  const byId = new Map(l.books.map((b) => [b.id, b]));
  l.books = entries.flatMap((e) => (e.kind === 'book' ? [e.book] : e.series.order.map((id) => byId.get(id))));
  lbAfterMove(l, from, to, entries);
}
function lbAfterMove(next, from, to, before) {
  const moved = before[to] || before[from], key = moved ? keyOf(moved) : null;
  const errs = lbApply(next);
  if (errs.length) { lbSnack(errs[0]); shelfDraw(); return; }
  live(_t('lib.moved_to_position', { n: to + 1 })); shelfDraw(key);
}
function live(t) { const el = $('#live'); el.textContent = ''; setTimeout(() => { el.textContent = t; }, 30); }
function lbRedraw() {
  lbApplyTitlePage();
  if (NAV.view === 'shelf') shelfDraw();
  navRefresh();
}

// shelf events: open, settings, move; arrow keys move between covers
$('#sh-list').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-act]'); if (!btn) return; const it = btn.closest('.sh-item'); if (!it) return;
  const kind = it.dataset.kind, id = it.dataset.id, act = btn.dataset.act, idx = [...it.parentNode.children].indexOf(it);
  if (act === 'open') return lbOpen(kind, id);
  if (act === 'settings') return kind === 'series' ? lbSeriesSheet(id) : lbBookSheet(id);
  if (act === 'earlier') return lbMoveEntry(idx, idx - 1);
  if (act === 'later') return lbMoveEntry(idx, idx + 1);
});
function lbOpen(kind, id) { LB.focus = null; navGo(kind === 'series' ? { level: 'series', sid: id } : { level: 'book', bid: id }); }
$('#sh-list').addEventListener('keydown', (e) => {
  const cur = e.target.closest('.sh-open'); if (!cur || e.altKey || e.ctrlKey || e.metaKey) return;
  const all = [...document.querySelectorAll('#sh-list .sh-open')], i = all.indexOf(cur), r = cur.getBoundingClientRect(); let to = null;
  if (e.key === 'ArrowRight') to = all[i + 1]; else if (e.key === 'ArrowLeft') to = all[i - 1]; else if (e.key === 'Home') to = all[0]; else if (e.key === 'End') to = all[all.length - 1];
  else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { // the nearest cover in the row below or above
    const dir = e.key === 'ArrowDown' ? 1 : -1, cx = r.left + r.width / 2;
    const cand = all.filter((x) => { const q = x.getBoundingClientRect(); return dir > 0 ? q.top > r.top + 8 : q.top < r.top - 8; });
    if (cand.length) { const rowTop = dir > 0 ? Math.min(...cand.map((x) => x.getBoundingClientRect().top)) : Math.max(...cand.map((x) => x.getBoundingClientRect().top)); to = cand.filter((x) => Math.abs(x.getBoundingClientRect().top - rowTop) < 8).sort((a, b2) => Math.abs(a.getBoundingClientRect().left + a.offsetWidth / 2 - cx) - Math.abs(b2.getBoundingClientRect().left + b2.offsetWidth / 2 - cx))[0]; }
  } else if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && e.shiftKey) to = null;
  if (to) { e.preventDefault(); to.focus(); }
  if (lbEditing() && e.shiftKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) { e.preventDefault(); const it = cur.closest('.sh-item'), idx = [...it.parentNode.children].indexOf(it); lbMoveEntry(idx, idx + (e.key === 'ArrowRight' ? 1 : -1)); }
});
// Zoom in on the focused (or first) cover; out to the level above.
let lastCard = '';
$('#sh-list').addEventListener('focusin', (e) => { const it = e.target.closest('.sh-item'); if (it) lastCard = it.dataset.key; }); // the zoom buttons take focus, so the last cover you were on is the one they open
const lbFocused = () => { const a = document.activeElement, k = a && a.closest && a.closest('#sh-list .sh-item'); return k || [...document.querySelectorAll('#sh-list .sh-item')].find((x) => x.dataset.key === lastCard) || document.querySelector('#sh-list .sh-item'); };
function lbZoomIn(x, y) { // a point on the shelf (a pinch), or the focused cover
  let it = null; if (x != null) { const el = document.elementFromPoint(x, y); it = el && el.closest && el.closest('.sh-item'); }
  it = it || lbFocused(); if (it && it.dataset.id) lbOpen(it.dataset.kind, it.dataset.id);
}
$('#sh-in').onclick = () => lbZoomIn(); $('#sh-out').onclick = () => navOut();
// Pinch (two fingers) and ctrl/cmd + wheel (a trackpad pinch) on the shelf: in on the cover under the fingers, out to the level above. Plain wheel scrolls.
(function shelfGestures() {
  const el = $('#shelf'), pt = new Map(); let d0 = 0, acc = 0, accT = 0;
  el.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'touch') return; pt.set(e.pointerId, [e.clientX, e.clientY]); if (pt.size === 2) { const [a, b] = [...pt.values()]; d0 = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1; } });
  el.addEventListener('pointermove', (e) => {
    if (!pt.has(e.pointerId)) return; pt.set(e.pointerId, [e.clientX, e.clientY]); if (pt.size !== 2 || NAV.busy()) return;
    const [a, b] = [...pt.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
    if (d > d0 * 1.4) { pt.clear(); lbZoomIn((a[0] + b[0]) / 2, (a[1] + b[1]) / 2); } else if (d < d0 * 0.7) { pt.clear(); navOut(); }
  });
  const up = (e) => pt.delete(e.pointerId); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  el.addEventListener('wheel', (e) => {
    if (!(e.ctrlKey || e.metaKey)) return; e.preventDefault(); if (NAV.busy()) return;
    clearTimeout(accT); accT = setTimeout(() => { acc = 0; }, 350); acc += -e.deltaY * (e.deltaMode === 1 ? 33 : 1);
    if (acc > 60) { acc = 0; lbZoomIn(e.clientX, e.clientY); } else if (acc < -60) { acc = 0; navOut(); }
  }, { passive: false });
})();
// Keys on the shelf (Enter goes in on a focused cover by itself): Escape out (Done first), + in, - out, E edit.
document.addEventListener('keydown', (e) => {
  if (NAV.view !== 'shelf' || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.target.closest && e.target.closest('input, textarea, select, dialog[open]')) return;
  if (e.key === '+' || e.key === '=') { e.preventDefault(); lbZoomIn(); }
  else if (e.key === '-' || e.key === '_') { e.preventDefault(); navOut(); }
  else if ((e.key === 'e' || e.key === 'E') && !NAV.edit) { e.preventDefault(); editOn(); }
});

// ----- sheets -----
const fld = (id, label, inner, hint, from) => `<div class="ls-f"><label for="${id}">${label}${from ? ` <span class="from">(${escH(from)})</span>` : ''}</label>${inner}${hint ? `<p class="ls-h" id="${id}-h">${hint}</p>` : ''}</div>`;
const txt = (id, v, max, req) => `<input type="text" id="${id}" value="${escH(v || '')}" maxlength="${max}" autocomplete="off"${req ? ' required aria-required="true"' : ''}${''}>`;
const sel = (id, opts, cur) => `<select id="${id}">${opts.map(([v, t]) => `<option value="${escH(v)}"${String(v) === String(cur) ? ' selected' : ''}>${escH(t)}</option>`).join('')}</select>`;
const withHint = (html, id) => html.replace('<input ', `<input aria-describedby="${id}-h" `).replace('<select ', `<select aria-describedby="${id}-h" `);
const modOpts = (inherit) => [['', inherit], ['on', _t('lib.on')], ['off', _t('lib.off')]];
const triOf = (v) => (v === true ? 'on' : v === false ? 'off' : '');
const EDITIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => [n, String(n)]);
let sheet = null; // { kind, id, isNew, build(next) -> void, extra }
function sheetOpen(title, bodyHtml, opts) {
  sheet = opts; $('#ls-h').textContent = title; $('#ls-body').innerHTML = bodyHtml; $('#ls-errs').hidden = true; $('#ls-errs').innerHTML = '';
  $('#ls-body').querySelectorAll('.ls-f').forEach((f) => { const i = f.querySelector('input, select'), h = f.querySelector('.ls-h'); if (i && h && !i.getAttribute('aria-describedby')) i.setAttribute('aria-describedby', h.id); });
  const d = $('#lib-sheet'); if (!d.open) d.showModal();
  const first = $('#ls-body input, #ls-body select'); if (first) first.focus();
}
function sheetClose(save) {
  const d = $('#lib-sheet'); if (d.open) d.close();
  if (!save && sheet && sheet.isNew) lbUndo(true); // a new book or series that was never named is taken back
  const back = sheet && sheet.back; sheet = null;
  if (back) { const b = document.querySelector(back); if (b && b.focus) b.focus(); } else if (NAV.view === 'shelf') shelfFocus(LB.focus);
}
$('#ls-cancel').onclick = () => sheetClose(false); $('#ls-x').onclick = () => sheetClose(false);
$('#lib-sheet').addEventListener('cancel', (e) => { e.preventDefault(); sheetClose(false); }); // Escape
$('#ls-form').onsubmit = (e) => {
  e.preventDefault(); if (!sheet) return;
  const next = lbClone(LB.lib); sheet.build(next);
  const errs = lbApply(next, sheet.saved);
  if (errs.length) { const ul = $('#ls-errs'); ul.innerHTML = errs.map((m) => `<li>${escH(m)}</li>`).join(''); ul.hidden = false; const bad = /title/i.test(errs[0]) ? $('#bs-title, #ss-title') : null; if (bad) bad.focus(); return; }
  if (sheet.isNew) { LB.undo.splice(-1, 1); sheet.isNew = false; } // creating and naming it is one step: Undo goes back to before it existed
  LB.focus = sheet.kind === 'series' ? 'series:' + sheet.id : 'book:' + sheet.id; sheetClose(true);
};
// One question with buttons: resolves the chosen value, or null (Cancel / Escape).
function lbAsk({ title, text, list, buttons }) {
  return new Promise((res) => {
    const d = $('#lib-confirm'); $('#lc-h').textContent = title; $('#lc-t').textContent = text || ''; $('#lc-t').hidden = !text;
    const ul = $('#lc-list'); ul.innerHTML = (list || []).map((m) => `<li>${escH(m)}</li>`).join(''); ul.hidden = !(list && list.length);
    const acts = $('#lc-acts'); acts.innerHTML = '';
    for (const b of buttons) { const x = document.createElement('button'); x.type = 'button'; x.className = 'btn' + (b.danger ? ' danger' : b.primary ? ' primary' : ''); x.textContent = b.text; x.onclick = () => { d.close(); res(b.value); }; acts.appendChild(x); }
    d.onclose = () => res(null); d.showModal(); (acts.querySelector('.btn:not(.danger)') || acts.firstChild).focus();
  });
}
const CANCEL = { get text() { return _t('lib.cancel'); }, value: null };

function modulesFields(prefix, cur, inherit) {
  return `<div class="ls-mods">${Object.entries(LM.MODULES).map(([k, d]) => fld(`${prefix}-m-${k}`, escH(_tx('lib.module_' + k, k.replace(/_/g, ' '))), sel(`${prefix}-m-${k}`, modOpts(inherit), triOf(cur && cur[k])), null)).join('')}</div>`;
}
function readModules(prefix) {
  const m = {}; for (const k of Object.keys(LM.MODULES)) { const v = $(`#${prefix}-m-${k}`).value; if (v) m[k] = v === 'on'; }
  return Object.keys(m).length ? m : undefined;
}
const setOrDel = (o, k, v) => { if (v === undefined || v === '' || v === null) delete o[k]; else o[k] = v; };

// Book settings
function lbBookSheet(id, { isNew, back } = {}) {
  const b = lbBook(id); if (!b) return;
  const r = LM.resolveBook(LB.lib, id, {}), s = lbSeriesOfBook(id), sd = (s && s.defaults) || {}, sp = sd.plan || {};
  const scope = (b.plan && b.plan.scope) || '', scopeOpts = [['', s && sp.scope ? _t('lib.same_series_scope', { scope: SCOPE_LABEL[sp.scope] }) : _t('lib.month_default')], ...SCOPE_PICK.filter((x) => x !== 'month' || (s && sp.scope)).map((x) => [x, SCOPE_LABEL[x]])];
  if (scope === 'custom') scopeOpts.push(['custom', _t('lib.custom_dates_plan')]);
  const coverInherit = s && sd.cover ? _t('lib.same_series') : _t('lib.night_default');
  const body = [
    fld('bs-title', _t('lib.f_title'), txt('bs-title', b.title, 120, true), _t('lib.hint_book_title')),
    fld('bs-sub', _t('lib.f_subtitle'), txt('bs-sub', b.subtitle, 200)),
    fld('bs-spine', _t('lib.f_spine'), txt('bs-spine', b.spineTitle, 40), _t('lib.hint_spine')),
    fld('bs-series', _t('lib.f_series'), sel('bs-series', [['', _t('lib.none_alone')], ...LB.lib.series.map((x) => [x.id, x.title])], b.seriesId || ''), _t('lib.hint_series')),
    `<p class="ls-sec">${_t('lib.sec_plan')}</p>`,
    fld('bs-scope', _t('lib.f_length'), sel('bs-scope', scopeOpts, scope), scope === 'undated' || (!scope && sp.scope === 'undated') ? _t('lib.hint_undated') : _t('lib.hint_length')),
    fld('bs-start', _t('lib.f_first_month'), `<input type="month" id="bs-start" value="${escH(b.start || '')}">`, _t('lib.hint_first_month')),
    fld('bs-ed', _t('lib.f_edition'), sel('bs-ed', [['', s && sp.edition ? _t('lib.same_series_ed', { n: r.edition }) : _t('lib.same_default_ed', { n: r.edition })], ...EDITIONS], b.edition ?? ''), _t('lib.hint_edition')),
    `<p class="ls-sec">${_t('lib.sec_cover_modules')}</p>`,
    fld('bs-cover', _t('lib.f_cover'), sel('bs-cover', [['', coverInherit], ...LM.COVER_STYLES.map((x) => [x, _tx('lib.cover_' + x, x.charAt(0).toUpperCase() + x.slice(1))])], (b.cover && b.cover.style) || '')),
    `<details><summary class="ls-l" style="min-height:44px;display:flex;align-items:center;cursor:pointer">${_t('lib.modules_book')}</summary>${modulesFields('bs', b.modules, s && sd.modules ? _t('lib.same_series') : _t('lib.same_project'))}</details>`,
    `<div class="ls-danger"><button class="btn" type="button" id="bs-dup">${_t('lib.duplicate_book')}</button><button class="btn danger" type="button" id="bs-del">${_t('lib.delete_book')}</button></div>`,
  ].join('');
  sheetOpen(isNew ? _t('lib.new_book') : _t('lib.book_settings'), body, {
    kind: 'book', id, isNew, back, saved: isNew ? _t('lib.book_added') : _t('lib.book_saved'),
    build(next) {
      const nb = LM.bookOf(next, id); nb.title = $('#bs-title').value.trim();
      setOrDel(nb, 'subtitle', $('#bs-sub').value.trim()); setOrDel(nb, 'spineTitle', $('#bs-spine').value.trim());
      const sc = $('#bs-scope').value; nb.plan = { ...(nb.plan || {}) }; setOrDel(nb.plan, 'scope', sc);
      if (sc !== 'undated') delete nb.plan.undated; if (sc !== 'custom') delete nb.plan.custom;
      if (!Object.keys(nb.plan).length) delete nb.plan;
      setOrDel(nb, 'start', $('#bs-start').value); const ed = $('#bs-ed').value; setOrDel(nb, 'edition', ed === '' ? '' : +ed);
      const cv = $('#bs-cover').value; if (cv) nb.cover = { style: cv }; else delete nb.cover;
      const mods = readModules('bs'); if (mods) nb.modules = mods; else delete nb.modules;
      const want = $('#bs-series').value; if ((nb.seriesId || '') !== want) { const moved = LM.moveBookToSeries(next, id, want || null); Object.assign(next, moved); }
    },
  });
  $('#bs-dup').onclick = () => { const r2 = LM.duplicateBook(LB.lib, id); const errs = lbApply(r2.library, _t('lib.duplicated_as', { title: LM.bookOf(r2.library, r2.id).title })); if (errs.length) return lbShowErrs(errs); sheet.isNew = false; LB.focus = 'book:' + r2.id; sheetClose(true); };
  $('#bs-del').onclick = () => lbDeleteBook(id);
}
const lbShowErrs = (errs) => { const ul = $('#ls-errs'); ul.innerHTML = errs.map((m) => `<li>${escH(m)}</li>`).join(''); ul.hidden = false; };
async function lbDeleteBook(id) {
  const b = lbBook(id); if (!b) return;
  const ok = await lbAsk({ title: _t('lib.delete_book_q', { title: b.title }), text: _t('lib.delete_book_text'), buttons: [CANCEL, { text: _t('lib.delete_book_btn'), value: 'del', danger: true }] });
  if (ok !== 'del') { const d = $('#lib-sheet'); if (d.open) $('#ls-body input, #ls-body select')?.focus(); return; }
  const errs = lbApply(LM.removeBook(LB.lib, id), _t('lib.deleted_book', { title: b.title }));
  if (errs.length) { await lbAsk({ title: _t('lib.cant_delete_book'), list: errs, buttons: [{ text: _t('lib.ok'), value: 'ok', primary: true }] }); return; }
  if (sheet) { sheet.isNew = false; sheetClose(true); }
  if (NAV.bid === id || LB.cur === id) { lbInitCur(); if (NAV.view !== 'shelf') navGo(lbLanding(), { push: false, anim: false }); }
  LB.focus = null; if (NAV.view === 'shelf') shelfFocus(null);
}

// Series settings
function lbSeriesSheet(id, { isNew, back } = {}) {
  const s = lbSeries(id); if (!s) return; const d = s.defaults || {}, p = d.plan || {}, show = s.show || [];
  let order = [...s.order];
  const body = [
    fld('ss-title', _t('lib.f_title'), txt('ss-title', s.title, 120, true), _t('lib.hint_series_title')),
    fld('ss-sub', _t('lib.f_subtitle'), txt('ss-sub', s.subtitle, 200)),
    `<div class="ls-f"><span class="ls-l" id="ss-ord-l">${_t('lib.books_in_order_l')}</span><ol class="ls-order" id="ss-order" aria-labelledby="ss-ord-l"></ol><p class="ls-h" id="ss-ord-h">${_t('lib.order_hint', { n: Math.max(order.length, 3) })}</p></div>`,
    `<p class="ls-sec">${_t('lib.series_defaults')}</p><p class="ls-h">${_t('lib.series_defaults_hint')}</p>`,
    fld('ss-scope', _t('lib.f_length'), sel('ss-scope', [['', _t('lib.not_set')], ...SCOPE_PICK.map((x) => [x, SCOPE_LABEL[x]])], p.scope || '')),
    fld('ss-keeper', _t('lib.f_keeper'), sel('ss-keeper', [['', _t('lib.not_set')], ['twelve-book', _t('lib.keeper_year')], ['per-book', _t('lib.keeper_book')], ['none', _t('lib.keeper_none')]], p.keeper || ''), _t('lib.hint_keeper')),
    fld('ss-closing', _t('lib.f_closing'), sel('ss-closing', [['', _t('lib.not_set')], ['month', _t('lib.closing_month')], ['end', _t('lib.closing_end')]], p.closing || '')),
    fld('ss-ed', _t('lib.f_edition'), sel('ss-ed', [['', _t('lib.not_set')], ...EDITIONS], p.edition ?? '')),
    fld('ss-cover', _t('lib.f_cover'), sel('ss-cover', [['', _t('lib.not_set')], ...LM.COVER_STYLES.map((x) => [x, _tx('lib.cover_' + x, x.charAt(0).toUpperCase() + x.slice(1))])], (d.cover && d.cover.style) || '')),
    `<details><summary class="ls-l" style="min-height:44px;display:flex;align-items:center;cursor:pointer">${_t('lib.modules_series')}</summary>${modulesFields('ss', d.modules, _t('lib.not_set'))}</details>`,
    `<fieldset class="ls-f" style="border:0;padding:0;margin:0"><legend class="ls-l">${_t('lib.print_series_line')}</legend><div class="ls-checks"><label><input type="checkbox" id="ss-show-cover"${show.includes('cover') ? ' checked' : ''}> ${_t('lib.show_on_cover')}</label><label><input type="checkbox" id="ss-show-tp"${show.includes('titlepage') ? ' checked' : ''}> ${_t('lib.show_on_title')}</label></div></fieldset>`,
    `<div class="ls-danger"><button class="btn" type="button" id="ss-dup">${_t('lib.duplicate_series')}</button><button class="btn danger" type="button" id="ss-del">${_t('lib.delete_series')}</button></div>`,
  ].join('');
  sheetOpen(isNew ? _t('lib.new_series') : _t('lib.series_settings'), body, {
    kind: 'series', id, isNew, back, saved: isNew ? _t('lib.series_added') : _t('lib.series_saved'),
    build(next) {
      const ns = LM.seriesOf(next, id); ns.title = $('#ss-title').value.trim(); setOrDel(ns, 'subtitle', $('#ss-sub').value.trim());
      const inSeries = new Set(order); ns.order = [...order]; for (const b of next.books) { if (inSeries.has(b.id)) b.seriesId = id; }
      const df = {}, pl = {}; setOrDel(pl, 'scope', $('#ss-scope').value); setOrDel(pl, 'keeper', $('#ss-keeper').value); setOrDel(pl, 'closing', $('#ss-closing').value);
      const ed = $('#ss-ed').value; if (ed) pl.edition = +ed; if (Object.keys(pl).length) df.plan = pl;
      const cv = $('#ss-cover').value; if (cv) df.cover = { style: cv }; const mods = readModules('ss'); if (mods) df.modules = mods;
      if (d.dayLayout) df.dayLayout = d.dayLayout; if (p.undated) df.plan = { ...(df.plan || {}), undated: p.undated };
      if (Object.keys(df).length) ns.defaults = df; else delete ns.defaults;
      const sh = []; if ($('#ss-show-cover').checked) sh.push('cover'); if ($('#ss-show-tp').checked) sh.push('titlepage'); if (sh.length) ns.show = sh; else delete ns.show;
    },
  });
  const drawOrder = (focusIdx, dir) => {
    $('#ss-order').innerHTML = order.length ? order.map((bid, i) => { const b = lbBook(bid); return `<li data-id="${escH(bid)}"><span class="n">${i + 1}</span><span class="t">${escH(b ? b.title : bid)}</span><button class="bk-b" type="button" data-mv="-1" aria-label="${_t('lib.move_up', { name: escH(b ? b.title : bid) })}"${i === 0 ? ' disabled' : ''}>${LI.up}</button><button class="bk-b" type="button" data-mv="1" aria-label="${_t('lib.move_down', { name: escH(b ? b.title : bid) })}"${i === order.length - 1 ? ' disabled' : ''}>${LI.down}</button><button class="bk-b sh-grip" type="button" data-grip aria-label="${_t('lib.drag_name', { name: escH(b ? b.title : bid) })}" tabindex="-1">${LI.grip}</button></li>`; }).join('') : '<li><span class="t">' + _t('lib.no_books_yet') + '</span></li>';
    if (focusIdx != null) { const li = $(`#ss-order li:nth-child(${focusIdx + 1})`), btn = li && (li.querySelector(`[data-mv="${dir}"]:not(:disabled)`) || li.querySelector('[data-mv]:not(:disabled)')); if (btn) btn.focus(); } // the keyboard stays on the book it moved
  };
  drawOrder();
  $('#ss-order').onclick = (e) => {
    const b = e.target.closest('[data-mv]'); if (!b) return; const li = b.closest('li'), i = [...li.parentNode.children].indexOf(li), j = i + +b.dataset.mv;
    if (j < 0 || j >= order.length) return; [order[i], order[j]] = [order[j], order[i]]; drawOrder(j, +b.dataset.mv); live(_t('lib.is_now_book', { title: lbBook(order[j]) ? lbBook(order[j]).title : '', n: j + 1, of: order.length }));
  };
  if (typeof Sortable !== 'undefined' && order.length > 1) Sortable.create($('#ss-order'), { handle: '[data-grip]', animation: ANIM, onEnd: (ev) => { if (ev.oldIndex !== ev.newIndex) { const [x] = order.splice(ev.oldIndex, 1); order.splice(ev.newIndex, 0, x); drawOrder(); } } });
  $('#ss-dup').onclick = () => { const r2 = LM.duplicateSeries(LB.lib, id); const errs = lbApply(r2.library, _t('lib.duplicated_as', { title: LM.seriesOf(r2.library, r2.id).title })); if (errs.length) return lbShowErrs(errs); sheet.isNew = false; LB.focus = 'series:' + r2.id; sheetClose(true); };
  $('#ss-del').onclick = () => lbDeleteSeries(id);
}
async function lbDeleteSeries(id) {
  const s = lbSeries(id); if (!s) return; const n = s.order.length;
  const choice = await lbAsk({ title: _t('lib.delete_series_q', { title: s.title }), text: n ? _t('lib.series_has_books', { n }) : _t('lib.series_no_books'), buttons: [CANCEL, ...(n ? [{ text: _t('lib.keep_books'), value: 'keep' }, { text: _t('lib.delete_series_and', { n }), value: 'all', danger: true }] : [{ text: _t('lib.delete_series_btn'), value: 'keep', danger: true }])] });
  if (!choice) { if ($('#lib-sheet').open) $('#ls-body input, #ls-body select')?.focus(); return; }
  const errs = lbApply(LM.removeSeries(LB.lib, id, { withBooks: choice === 'all' }), (choice === 'all' && n ? _t('lib.deleted_series_books', { title: s.title, n }) : _t('lib.deleted_series', { title: s.title })));
  if (errs.length) { await lbAsk({ title: _t('lib.cant_delete_series'), list: errs, buttons: [{ text: _t('lib.ok'), value: 'ok', primary: true }] }); return; }
  if (sheet) { sheet.isNew = false; sheetClose(true); }
  LB.focus = null; if (NAV.level === 'series' && NAV.sid === id) navGo({ level: 'library' }, { push: false, anim: false });
}
$('#sh-new-book').onclick = () => {
  const r = LM.addBook(LB.lib, { title: _t('lib.untitled_book'), ...(NAV.level === 'series' ? { seriesId: NAV.sid } : {}) });
  const errs = lbApply(r.library); if (errs.length) return lbSnack(errs[0]);
  lbBookSheet(r.id, { isNew: true, back: '#sh-new-book' });
};
$('#sh-new-series').onclick = () => {
  const r = LM.addSeries(LB.lib, { title: _t('lib.new_series') }); const errs = lbApply(r.library); if (errs.length) return lbSnack(errs[0]);
  lbSeriesSheet(r.id, { isNew: true, back: '#sh-new-series' });
};
$('#sh-series-set').onclick = () => lbSeriesSheet(NAV.sid, { back: '#sh-series-set' });
$('#sh-undo').onclick = () => { lbUndo(); shelfDraw(); };
$('#bk-set').onclick = () => lbBookSheet(LB.cur, { back: '#bk-set' });

// ----- export and import (a file the person keeps; nothing leaves the browser) -----
async function lbExport() {
  const j = JSON.stringify(LB.lib, null, 1) + '\n';
  if (dl) { try { await dl.save({ filename: 'library.json', data: j }); } catch (e) { if (e && e.code !== 'declined') lbSnack(_t('lib.cant_save_file')); } return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([j], { type: 'application/json' })); a.download = 'library.json'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
$('#sh-export').onclick = lbExport;
$('#sh-import').onclick = () => $('#lib-file').click();
$('#lib-file').onchange = async () => {
  const f = $('#lib-file').files[0]; $('#lib-file').value = ''; if (!f) return;
  let j; try { j = JSON.parse(await f.text()); } catch { return lbAsk({ title: _t('lib.file_unusable'), text: _t('lib.file_not_json'), buttons: [{ text: _t('lib.ok'), value: 'ok', primary: true }] }); }
  const errs = LM.validateLibrary(j);
  if (errs.length) return lbAsk({ title: _t('lib.file_problems'), text: _t('lib.file_problems_text'), list: errs.slice(0, 12).map((m) => lbPlain(j, m)), buttons: [{ text: _t('lib.ok'), value: 'ok', primary: true }] });
  const go = await lbAsk({ title: _t('lib.replace_q'), text: _t('lib.replace_text', { books: j.books.length, series: (j.series || []).length, current: LB.lib.books.length }), buttons: [CANCEL, { text: _t('lib.replace'), value: 'go', primary: true }] });
  if (go !== 'go') return;
  const e2 = lbApply(j, _t('lib.imported')); if (e2.length) return lbSnack(e2[0]);
  if (NAV.level === 'series' && !lbSeries(NAV.sid)) navGo({ level: 'library' }, { push: false, anim: false });
};

// ----- the hooks the Versions panel uses: a Studio project keeps the library in its snapshot (meta.library) -----
window.KWLIB = {
  get touched() { return LB.touched; },
  part() { return LB.touched && ST.headSnap && ST.headSnap.meta ? { meta: { ...ST.headSnap.meta, library: lbClone(LB.lib) } } : {}; }, // sent with the draft only after the library was edited
  fromSnapshot(snap) { // a project's own library (or, for an older project, its one book)
    const m = (snap && snap.meta) || {}; LB.lib = m.library && lbValid(m.library) ? lbClone(m.library) : lbDefault(m.title, m.subtitle, m.slug); LB.undo = []; LB.touched = false;
    lbInitCur(); lbEnsureContext(); lbRedraw();
  },
  local() { LB.lib = (MODE === 'demo' && SAMPLE_LIB ? lbClone(SAMPLE_LIB) : lbLocal()) || lbDefault(); LB.undo = []; LB.touched = false; lbInitCur(); lbEnsureContext(); lbRedraw(); },
};
