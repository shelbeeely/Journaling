// ---------- Fewer decisions (BUILD-PLAN section 25): the guided start, ready-made books, the Basic view, and what the editor remembers ----------
// The choices and the layouts come from journal/presets.mjs (inlined above, so the page and the tests run the same code). This file draws them.
// Every word goes through the catalog: the words of the data tables with _tx('guided.d_...'), the rest with _t('guided....').
// Nothing here makes a decision for the person: every step has a recommended answer already chosen, Back and Close change nothing, and Undo takes back a made book's page.
const GD_KEY = 'kw-last-book', VM_KEY = 'kw-view';
const GD = { step: 'home', via: 'q', i: 0, answers: null, starter: null, book: null, last: null, loaded: false, busy: false };

// ----- what is remembered: this browser, or the Studio when signed in. The demo remembers nothing. -----
async function gdLoadLast() {
  if (MODE === 'demo') return null;
  let v = null;
  if (typeof ST !== 'undefined' && ST.user) { try { v = cleanLast((await stApi('GET', '/api/me/prefs/startFrom')).value); } catch { /* the copy in this browser, below */ } }
  if (!v) { try { v = cleanLast(JSON.parse(store.get(GD_KEY) || 'null')); } catch { v = null; } }
  return v;
}
async function gdRemember(book) {
  const last = lastOf({ answers: book.answers || RECOMMENDED(), starter: book.starter, layout: book.layout, plan: book.plan, modules: book.modules, trim: book.trim });
  if (!last || MODE === 'demo') return;
  GD.last = last;
  try { store.set(GD_KEY, JSON.stringify(last)); } catch { /* storage blocked: the book is still made */ }
  if (typeof ST !== 'undefined' && ST.user) { try { await stApi('PUT', '/api/me/prefs/startFrom', { value: last }); } catch { /* the Studio is out of reach: this browser still has it */ } }
}
// A New book starts the way the last one did (its length and modules); the day page already is the last one's, because the editor keeps one working day page.
function gdBookDefaults() {
  const l = GD.last; if (!l) return {};
  return { ...(l.plan ? { plan: structuredClone(l.plan) } : {}), ...(l.modules && Object.keys(l.modules).length ? { modules: { ...l.modules } } : {}) };
}
gdLoadLast().then((v) => { GD.last = v; GD.loaded = true; });

// ----- Basic and Advanced -----
let vmMode = store.get(VM_KEY) === 'advanced' ? 'advanced' : 'basic';
const basicView = () => vmMode === 'basic';
const moreIds = new Set(); // blocks whose full option list is open in Basic (Advanced always shows everything)
function vmDraw() {
  $('#vm-b').setAttribute('aria-pressed', basicView()); $('#vm-a').setAttribute('aria-pressed', !basicView());
  $('#vm-note').textContent = basicView() ? _t('guided.vm_note_basic', { n: BASIC_TYPES.length }) : _t('guided.vm_note_adv');
}
function vmSet(m) {
  vmMode = m === 'advanced' ? 'advanced' : 'basic';
  if (MODE !== 'demo') store.set(VM_KEY, vmMode);
  vmDraw(); drawPalette(); drawList();
  announce(basicView() ? _t('guided.vm_said_basic') : _t('guided.vm_said_adv'));
}
$('#vm-b').onclick = () => vmSet('basic'); $('#vm-a').onclick = () => vmSet('advanced');
$('#pal').addEventListener('click', (e) => { if (e.target.closest('[data-vm="advanced"]')) { vmSet('advanced'); const b = $('#vm-a'); if (b) b.focus(); } });
// The palette in Basic: the eight everyday blocks in one plain list. Same tiles, same drag, same + button.
function basicPalette(used, items) {
  const by = Object.fromEntries(items.filter((it) => !it.preset).map((it) => [it.type, it]));
  const li = BASIC_TYPES.filter((t) => by[t]).map((t) => {
    const it = by[t], u = TYPES[t].single && used.has(t);
    return `<li class="pi ${u ? 'used' : ''}" data-key="${it.key}">${icon(it.icon, 'ico')}<span class="n">${escH(it.name)}</span><button class="add" data-add="${it.key}" aria-label="${_t('app.add_name', { name: escH(it.name) })}">+</button></li>`;
  }).join('');
  return `<h3>${_t('guided.everyday_blocks')}</h3><ul class="pg">${li}</ul><p class="fine">${_t('guided.more_blocks_note')} <button class="chip" type="button" data-vm="advanced">${_t('guided.show_all_blocks')}</button></p>`;
}
// A block's options. Basic shows the first few and anything already changed (a change is never hidden); every option offers its recommended value.
function recBtn(html, o, b) {
  if (isRec(o, b[o.k])) return html;
  const lab = oLab(o), btn = `<button class="rec-b" type="button" data-rec="${b.uid}/${o.k}" aria-label="${_t('guided.back_to_rec_for', { name: escH(lab) })}" title="${_t('guided.back_to_rec_for', { name: escH(lab) })}"><svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 6a4 4 0 1 0 1.3-3M2 1.6v2.2h2.2"/></svg><span>${_t('guided.recommended')}</span></button>`;
  return html.replace(/<\/div>$/, btn + '</div>');
}
function blockOpts(b, t) {
  const opts = t.opts, all = !basicView() || moreIds.has(b.uid);
  const show = all ? opts : opts.filter((o, i) => i < BASIC_OPTS || !isRec(o, b[o.k])), hidden = opts.length - show.length;
  let h = show.map((x) => recBtn(optControl(x, b[x.k], `${b.uid}/${x.k}`), x, b)).join('');
  if (hidden > 0) h += `<div class="opt"><button class="chip" type="button" data-more="${b.uid}" aria-expanded="false">${_t('guided.more_options', { n: hidden })}</button></div>`;
  else if (basicView() && opts.length > BASIC_OPTS) h += `<div class="opt"><button class="chip" type="button" data-more="${b.uid}" aria-expanded="true">${_t('guided.fewer_options')}</button></div>`;
  if (opts.some((x) => !isRec(x, b[x.k]))) h += `<div class="opt"><button class="chip" type="button" data-rec="${b.uid}/*">${_t('guided.all_recommended')}</button></div>`;
  return h;
}
$('#list').addEventListener('click', (e) => {
  const m = e.target.closest('[data-more]'), r = e.target.closest('[data-rec]');
  if (m) { const u = m.dataset.more; moreIds.has(u) ? moreIds.delete(u) : moreIds.add(u); drawList(); const b = $(`#list [data-more="${u}"]`); if (b) b.focus(); return; }
  if (!r) return;
  const [uid, key] = r.dataset.rec.split('/');
  change((L) => { const b = L.blocks.find((x) => x.uid === uid); if (b) for (const o of TYPES[b.type].opts) if (key === '*' || key === o.k) b[o.k] = recOf(o); });
  toast(_t('guided.back_to_rec_done'));
  const li = [...document.querySelectorAll('#list > li')].find((x) => x.dataset.uid === uid), f = li && li.querySelector('.opts button, .opts input'); if (f) f.focus();
});

// ----- the guided start -----
const gdQ = (q) => _tx('guided.d_q_' + snk(q.id), q.q);
const gdQh = (q) => _tx('guided.d_q_' + snk(q.id) + '_hint', q.hint);
const gdO = (q, o) => _tx('guided.d_o_' + snk(q.id) + '_' + snk(o[0]), o[1]);
const gdOh = (q, o) => _tx('guided.d_o_' + snk(q.id) + '_' + snk(o[0]) + '_hint', o[2]);
const gdSt = (s) => _tx('guided.d_starter_' + snk(s.id) + '_name', s.name);
const gdSb = (s) => _tx('guided.d_starter_' + snk(s.id) + '_blurb', s.blurb);
function gdStepText() {
  if (GD.step === 'q') return _t('guided.step_of', { n: GD.i + 1, total: QUESTIONS.length });
  return GD.step === 'review' ? _t('guided.step_review') : '';
}
function gdFacts(b) {
  const f = lengthFacts(b.plan.scope === 'undated' ? 'undated' : b.plan.scope);
  if (f.days) return _t('guided.facts_undated', { n: f.days });
  return f.months === 1 ? _t('guided.facts_month', { pages: f.about }) : _t('guided.facts_months', { n: f.months, pages: f.about, vols: f.volumes });
}
function gdBlockLine(b) {
  const w = b.title || b.label || '';
  return `<li>${icon(TYPES[b.type].icon, 'bico')}<span>${escH(tName(b.type))}${w ? ` <small>${escH(w)}</small>` : ''}</span></li>`;
}
function gdPreview(layoutObj, sz) {
  const doc = `<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Lora:ital,wght@0,400;0,600;0,700;1,400&display=swap"><style>html,body{margin:0;background:#fff}${KIT.css}#pv .page{width:${SIZES[sz]}in}</style><div id="pv"><div class="page verso dayp m">${dayBlocks(KIT, layoutObj, { tag: true, size: sz, kind: 'day' })}</div></div>`;
  const W = SIZES[sz] * 96, H = 8.5 * 96, pw = matchMedia('(max-width: 760px)').matches ? 132 : 230, k = pw / W; // smaller on a phone, beside the words
  const fr = document.createElement('iframe'); // built as an element so the page text in srcdoc is escaped for us
  fr.title = _t('guided.preview_title'); fr.setAttribute('sandbox', ''); fr.srcdoc = doc; fr.tabIndex = -1;
  fr.style.cssText = `width:${Math.round(W)}px;height:${H}px;transform:scale(${k.toFixed(4)})`;
  return `<div class="gd-pv" style="width:${pw}px;height:${Math.round(H * k)}px">${fr.outerHTML}</div>`;
}
function gdDraw() {
  const body = $('#gd-body'), back = $('#gd-back'), next = $('#gd-next'), skip = $('#gd-skip'), tweak = $('#gd-tweak');
  $('#gd-errs').hidden = true; $('#gd-step').textContent = gdStepText();
  back.hidden = GD.step === 'home'; skip.hidden = GD.step !== 'q'; tweak.hidden = GD.step !== 'review'; next.hidden = GD.step === 'home';
  next.textContent = GD.step === 'review' ? _t('guided.make') : _t('guided.next');
  if (GD.step === 'home') {
    const last = GD.last;
    body.innerHTML = `<p class="gd-lead">${_t('guided.home_lead')}</p>
      <button class="gd-card main" type="button" data-gd="questions">${icon('pen', 'bico')}<span><b>${_t('guided.five_questions')}</b><small>${_t('guided.five_questions_hint')}</small></span></button>
      ${last ? `<button class="gd-card" type="button" data-gd="last">${icon('back', 'bico')}<span><b>${_t('guided.from_last')}</b><small>${_t('guided.from_last_hint')}</small></span></button>` : ''}
      <h4 class="ls-sec">${_t('guided.ready_made')}</h4>
      <ul class="gd-list">${STARTERS.map((s) => `<li><button class="gd-card" type="button" data-starter="${s.id}">${icon(s.icon, 'bico')}<span><b>${escH(gdSt(s))}</b><small>${escH(gdSb(s))}</small></span></button></li>`).join('')}</ul>
      <p class="ls-h">${_t('guided.home_note')}</p>`;
    $('#gd-h').textContent = _t('guided.title');
  } else if (GD.step === 'q') {
    const q = QUESTIONS[GD.i], a = GD.answers, many = q.kind === 'many';
    const isRecO = (v) => (many ? q.rec.includes(v) : q.rec === v), on = (v) => (many ? a[q.id].includes(v) : a[q.id] === v);
    body.innerHTML = `<fieldset class="gd-q"><legend id="gd-q-l">${escH(gdQ(q))}</legend><p class="ls-h" id="gd-q-h">${escH(gdQh(q))}</p>${q.o.map((o) => `<label class="gd-opt"><input type="${many ? 'checkbox' : 'radio'}" name="gd-${q.id}" value="${o[0]}" ${on(o[0]) ? 'checked' : ''}><span><b>${escH(gdO(q, o))}${isRecO(o[0]) ? ` <em class="gd-rec">${_t('guided.recommended')}</em>` : ''}</b><small>${escH(gdOh(q, o))}</small></span></label>`).join('')}</fieldset>`;
    $('#gd-h').textContent = _t('guided.title');
  } else {
    const b = GD.book, dated = b.plan.scope !== 'undated', nm = $('#gd-title') ? $('#gd-title').value : null;
    const left = (b.left || []).map((id) => _tx('guided.d_o_track_' + snk(id), (QUESTIONS[2].o.find((o) => o[0] === id) || [0, id])[1]).toLowerCase());
    const blocks = b.layout.blocks.filter((x) => x.on && x.type !== 'body');
    const title = nm !== null && nm !== '' ? nm : GD.starter ? gdSt(starterOf(GD.starter)) : _t('guided.default_title');
    body.innerHTML = `<div class="gd-rev"><div class="gd-pvbox">${gdPreview(b.layout, b.trim)}</div><div class="gd-sum">
      <div class="ls-f"><label for="gd-title">${_t('guided.book_title')}</label><input id="gd-title" type="text" maxlength="120" value="${escH(title)}" autocomplete="off"></div>
      ${dated ? `<div class="ls-f"><label for="gd-start">${_t('guided.first_month')}</label><input id="gd-start" type="month" value="${escH(b.start)}"></div>` : ''}
      <p class="gd-facts">${escH(gdFacts(b))}</p>
      <p class="gd-facts">${b.trim === 'letter' ? _t('guided.size_letter') : _t('guided.size_small')}</p></div></div>
      <h4 class="ls-sec">${_t('guided.on_each_page')}</h4><ul class="gd-blocks">${blocks.map(gdBlockLine).join('')}<li>${icon('pen', 'bico')}<span>${_t('guided.writing_space')}</span></li></ul>
      ${left.length ? `<p class="ls-h">${_t('guided.left_off', { list: escH(left.join(', ')) })}</p>` : ''}
      <p class="ls-h">${_t('guided.review_note')}</p>`;
    $('#gd-h').textContent = _t('guided.here_is');
  }
}
function gdGo(step, i = 0) { GD.step = step; GD.i = i; gdDraw(); const f = step === 'q' ? $('#gd-body input:checked, #gd-body input') : step === 'review' ? $('#gd-title') : $('#gd-body button'); if (f) f.focus(); }
function gdBuild() { // answers -> the finished book (GD.book)
  GD.starter = null; GD.book = guidedBook(GD.answers); GD.book.starter = null;
}
function gdStart() { GD.answers = cleanAnswers(GD.last && GD.last.answers ? GD.last.answers : RECOMMENDED()); GD.answers.start = nextMonth(); GD.book = null; GD.starter = null; gdGo('home'); }
function gdOpen() {
  if (PGE || SPD) { toast(_t('guided.close_page_first')); return; }
  if (!$('#guided').open) $('#guided').showModal();
  gdStart();
  gdLoadLast().then((v) => { const same = JSON.stringify(v) === JSON.stringify(GD.last); GD.last = v; GD.loaded = true; if (!same && GD.step === 'home' && $('#guided').open) gdStart(); }); // the Studio's copy, when signed in
}
function gdClose() { if ($('#guided').open) $('#guided').close(); }
$('#gd-x').onclick = gdClose;
$('#guided').addEventListener('cancel', (e) => { e.preventDefault(); gdClose(); });
$('#gd-body').addEventListener('click', (e) => {
  const g = e.target.closest('[data-gd],[data-starter]'); if (!g) return;
  if (g.dataset.starter) { GD.starter = g.dataset.starter; const tr = (GD.last && GD.last.trim) || size; GD.book = starterBook(GD.starter, { trim: tr, start: nextMonth() }); GD.answers = cleanAnswers(starterAnswers(GD.starter)); GD.via = 'home'; return gdGo('review'); }
  if (g.dataset.gd === 'questions') return gdGo('q', 0);
  if (g.dataset.gd === 'last') {
    const l = GD.last; GD.answers = cleanAnswers({ ...l.answers, start: nextMonth() });
    if (l.starter) { GD.starter = l.starter; GD.book = starterBook(l.starter, { trim: l.trim || size, start: nextMonth() }); } else gdBuild();
    if (l.layout) GD.book = { ...GD.book, layout: normalize({ v: 2, blocks: structuredClone(l.layout.blocks) }, size) };
    GD.book.trim = l.trim || GD.book.trim;
    GD.via = 'home'; return gdGo('review');
  }
});
$('#gd-body').addEventListener('change', (e) => {
  const el = e.target; if (el.name === undefined || !el.name.startsWith('gd-')) return;
  const q = QUESTIONS[GD.i];
  if (q.kind === 'many') GD.answers[q.id] = TRACK_IDS.filter((id) => [...document.querySelectorAll(`#gd-body input[name="gd-${q.id}"]:checked`)].some((x) => x.value === id));
  else GD.answers[q.id] = el.value;
});
$('#gd-back').onclick = () => {
  if (GD.step === 'review') return GD.via === 'home' ? gdGo('home') : gdGo('q', QUESTIONS.length - 1);
  if (GD.step === 'q') return GD.i > 0 ? gdGo('q', GD.i - 1) : gdGo('home');
};
$('#gd-skip').onclick = () => { gdBuild(); GD.via = 'q'; gdGo('review'); };
$('#gd-form').onsubmit = (e) => {
  e.preventDefault();
  if (GD.step === 'q') { if (GD.i < QUESTIONS.length - 1) return gdGo('q', GD.i + 1); gdBuild(); GD.via = 'q'; return gdGo('review'); }
  if (GD.step === 'review') gdMake(false);
};
$('#gd-tweak').onclick = () => gdMake(true);
function gdErrs(list) { const ul = $('#gd-errs'); ul.innerHTML = list.map((m) => `<li>${escH(m)}</li>`).join(''); ul.hidden = false; }

// Make the book: one library entry (title, first month, length, modules) and the day page. Undo (the editor's, and the library's) takes both back.
async function gdMake(tweak) {
  if (GD.busy || !GD.book) return; GD.busy = true;
  try {
    const b = GD.book, title = ($('#gd-title').value || '').trim(), startEl = $('#gd-start'), start = startEl ? startEl.value : b.start;
    if (!title) { gdErrs([_t('guided.give_title')]); $('#gd-title').focus(); return; }
    const dayNew = normalize({ v: 2, blocks: structuredClone(b.layout.blocks) }, size);
    const changes = !sameBlocks(layout.blocks, dayNew.blocks);
    if (changes && !sameBlocks(layout.blocks, DEFAULT_LAYOUT.blocks)) {
      const ok = await lbAsk({ title: _t('guided.replace_q'), text: _t('guided.replace_text'), buttons: [CANCEL, { text: _t('guided.replace'), value: 'ok', primary: true }] });
      if (!ok) { const t = $('#gd-title'); if (t) t.focus(); return; }
    }
    const mk = (edition) => LM.addBook(LB.lib, { title, ...(start ? { start } : {}), ...(edition ? { edition } : {}), plan: structuredClone(b.plan), ...(Object.keys(b.modules || {}).length ? { modules: { ...b.modules } } : {}), ...(NAV.level === 'series' ? { seriesId: NAV.sid } : {}) });
    let r = mk(0);
    for (let ed = 2; ed <= 9 && LM.validateLibrary(r.library).length; ed++) r = mk(ed); // two books over the same months need different editions, so their scan codes never repeat: pick the first that works
    const errs = lbApply(r.library, _t('guided.book_made', { title })); if (errs.length) { gdErrs(errs); return; }
    if (changes) { selected = null; change((L) => setLayoutFrom(L, dayNew)); }
    if (b.trim !== size) setSize(b.trim);
    gdRemember({ answers: GD.answers, starter: GD.starter, layout: dayNew, plan: b.plan, modules: b.modules, trim: b.trim });
    gdClose(); lbSetBook(r.id); LB.focus = 'book:' + r.id;
    if (tweak) navGo(navParse('#day/' + KIT.day.date.slice(0, 7) + '-14/edit')); else navGo({ level: 'book', bid: r.id });
    announce(_t('guided.book_made', { title }));
  } finally { GD.busy = false; }
}
$('#sh-guided').onclick = gdOpen;
$('#m-guided').onclick = () => { $('#menu').classList.remove('open'); gdOpen(); };
vmDraw();
