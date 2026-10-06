// ---------- languages (BUILD-PLAN section 18, slice I1) ----------
// Inlined into the editor page by editor/build.mjs (the three /*__...__*/ markers are filled there). English is the page as written: nothing here
// changes a character of it. Any other language (today only the pseudo-locales en-XA and ar-XB, chosen with ?lang= or localStorage "kw-lang")
// swaps every message: the static HTML through its data-i18n markers (see i18n/htmlscan.mjs), the rest through _t() at the moment it is drawn.
const { createT, pseudoCatalog, dirOf, LOCALES, tableStrings, slug, snake } = /*__I18N_LIB__*/;
const I18N_EN = /*__I18N_EN__*/; // the en.json catalog
const I18N_VARS = /*__I18N_VARS__*/; // what a static message may name: the book's title, the day layout's path
const I18N_LANG = (() => { let q = ''; try { q = new URLSearchParams(location.search).get('lang') || store.get('kw-lang') || ''; } catch { /* no URL or storage: English */ } return q in LOCALES ? q : 'en'; })();
const I18N_CAT = I18N_LANG === 'en' ? I18N_EN : pseudoCatalog(I18N_EN, I18N_LANG);
const _t0 = createT({ catalogs: { en: I18N_EN, [I18N_LANG]: I18N_CAT }, locale: I18N_LANG });
const _t = (key, vars) => _t0(key, vars); // short name: it is the one every message in the editor goes through
const _tx = (key, en, vars) => (I18N_CAT[key] !== undefined ? _t0(key, vars) : en); // a word from a data table: its own English when the catalog has no entry
// The words of the data tables (daypage.mjs, content/layouts.mjs, scan.mjs): looked up, never changed, so the preview and the print code keep their English.
const TBL = tableStrings({ TYPES, PRESETS, CARE_ROWS, ROW_OPTS, PAGE_KINDS, METHOD_LAYOUTS, CODE_POSITIONS, CODE_SIZES, CODE_FORMATS, CODE_CONTENTS, MODULES: {}, COVER_STYLES: [] });
const tName = (t) => (TYPES[t] ? _tx('block.' + t + '.name', TYPES[t].name) : t);
const tHint = (t) => _tx('block.' + t + '.hint', TYPES[t].hint);
const pName = (p) => { const k = TBL.presetKey.get(p); return k ? _tx(k + '.name', p.name) : p.name; };
const crName = (id) => (CARE_ROWS[id] ? _tx('care.' + id + '.name', CARE_ROWS[id].name) : id);
const pkName = (k) => _tx('pagekind.' + k + '.name', (PAGE_KINDS[k] || {}).name || k);
const mName = (m) => _tx('method.' + m.id + '.name', m.name);
const mBlurb = (m) => _tx('method.' + m.id + '.blurb', m.blurb);
const oLab = (o) => { const k = TBL.optKey.get(o); return k ? _tx(k + '.label', o.label) : o.label; };
const oCh = (o, c, t) => { const k = TBL.optKey.get(o); return k ? _tx(k + '.choice_' + slug(c), t) : t; };
const oIt = (o, k, t) => { const b = TBL.itemKey.get(o.items); return b ? _tx(b + '.item_' + snake(k), t) : t; };
const scanLab = (g, x) => _tx('scan.' + g + '_' + slug(x[0]), x[1]);
// Static HTML: data-i18n="key [key ...]" (one key per non-blank text node, "-" skips one), data-i18n-html="key", data-i18n-attr="aria-label:key;title:key".
function applyI18n(root) {
  const v = { ...I18N_VARS };
  root.querySelectorAll('[data-i18n-attr]').forEach((el) => el.getAttribute('data-i18n-attr').split(';').forEach((p) => { const i = p.indexOf(':'); el.setAttribute(p.slice(0, i), _t(p.slice(i + 1), v)); }));
  root.querySelectorAll('[data-i18n-html]').forEach((el) => { el.innerHTML = _t(el.getAttribute('data-i18n-html'), v); });
  root.querySelectorAll('[data-i18n]').forEach((el) => {
    const keys = el.getAttribute('data-i18n').split(/\s+/); let i = 0;
    for (const n of el.childNodes) if (n.nodeType === 3 && /\S/.test(n.data)) { const k = keys[i++]; if (k && k !== '-') { const m = /^(\s*)[\s\S]*?(\s*)$/.exec(n.data); n.data = m[1] + _t(k, v) + m[2]; } }
  });
}
document.documentElement.lang = I18N_LANG === 'en' ? document.documentElement.lang || 'en' : I18N_LANG;
if (I18N_LANG !== 'en') { document.documentElement.dir = dirOf(I18N_LANG); applyI18n(document); document.title = _t('app.book_editor'); document.documentElement.style.setProperty('--t-on-page', JSON.stringify(_t('app.on_page'))); } // (the one word the CSS prints: li.pi.used::after)
window.KWI18N = { lang: I18N_LANG, dir: dirOf(I18N_LANG), t: _t, catalog: I18N_CAT, missing: () => [..._t0.missing] }; // for the tests: a key the code asks for and the catalog lacks
