// The English words that live in the code's data tables, not in the editor's own code: block names and hints, option labels and choices,
// care rows, page kinds, method layouts, the scan option names. The editor shows them through the catalog (so a language can translate
// them) while the print build keeps reading the very same tables, untouched (printed words are a later slice: BUILD-PLAN section 18).
//   tableStrings(tables) -> { strings: { key: English }, optKey: Map(option -> base key), itemKey: Map(items object -> base key), presetKey: Map(preset -> base key) }
// The keys come from where a string sits (block.checks.title.label), never from its text, so a reworded English string keeps its key.
// i18n/sync-tables.mjs writes these into en.json; test-i18n.mjs fails when a table gains a string en.json does not have.
// Browser-safe: editor/build.mjs inlines this file into the page.

export const snake = (s) => String(s).replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'x';
export const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'x';

export function tableStrings({ TYPES, PRESETS, CARE_ROWS, ROW_OPTS, PAGE_KINDS, METHOD_LAYOUTS, CODE_POSITIONS, CODE_SIZES, CODE_FORMATS, CODE_CONTENTS, MODULES, COVER_STYLES }) {
  const strings = {}, optKey = new Map(), itemKey = new Map(), presetKey = new Map();
  const put = (k, v) => { if (typeof v !== 'string' || v === '') return; if (strings[k] !== undefined && strings[k] !== v) throw new Error(`i18n table key ${k} is used for two different texts: "${strings[k]}" and "${v}"`); strings[k] = v; };
  const walkItems = (base, items) => { if (!items || itemKey.has(items)) return; itemKey.set(items, base); for (const [k, t] of Object.entries(items)) put(`${base}.item_${snake(k)}`, t); };
  const walkOpts = (base, opts) => {
    for (const o of opts || []) {
      if (optKey.has(o)) continue; // an option object shared by several blocks is keyed once, where it is first met
      const b = `${base}.${snake(o.k)}`; optKey.set(o, b);
      put(`${b}.label`, o.label);
      for (const [v, t] of o.choices || []) put(`${b}.choice_${slug(v)}`, t);
      walkItems(b, o.items);
    }
  };
  for (const [id, r] of Object.entries(CARE_ROWS)) { put(`care.${id}.name`, r.name); walkItems(`care.${id}`, r.items); }
  for (const [id, opts] of Object.entries(ROW_OPTS)) walkOpts(`care.${id}`, opts);
  for (const [t, d] of Object.entries(TYPES)) { put(`block.${t}.name`, d.name); put(`block.${t}.hint`, d.hint); walkOpts(`block.${t}`, d.opts); }
  const seen = new Set();
  for (const p of PRESETS) { let k = `preset.${slug(p.type)}_${slug(p.name)}`, n = 2; while (seen.has(k)) k = `preset.${slug(p.type)}_${slug(p.name)}_${n++}`; seen.add(k); put(`${k}.name`, p.name); presetKey.set(p, k); }
  for (const [k, d] of Object.entries(PAGE_KINDS)) put(`pagekind.${k}.name`, d.name);
  for (const m of METHOD_LAYOUTS) { put(`method.${m.id}.name`, m.name); put(`method.${m.id}.blurb`, m.blurb); }
  for (const [g, list] of [['position', CODE_POSITIONS], ['size', CODE_SIZES], ['format', CODE_FORMATS], ['content', CODE_CONTENTS]]) for (const x of list || []) put(`scan.${g}_${slug(x[0])}`, x[1]);
  for (const k of Object.keys(MODULES || {})) put(`lib.module_${snake(k)}`, k.replace(/_/g, ' '));
  for (const s of COVER_STYLES || []) put(`lib.cover_${snake(s)}`, s.charAt(0).toUpperCase() + s.slice(1));
  return { strings, optKey, itemKey, presetKey };
}

// The keys the editor builds at run time (the table keys above, and the palette groups): the unused-key check treats these prefixes as used.
export const DYNAMIC_PREFIXES = ['block.', 'care.', 'preset.', 'pagekind.', 'method.', 'scan.', 'pal.group_', 'lib.module_', 'lib.cover_', 'ver.role_'];
