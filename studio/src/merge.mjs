// Three-way merge of two snapshots on their common ancestor, by stable ids: page ids (book), block uids (day), asset names, component ids.
// Pure: no database, no disk. The repo layer feeds it snapshots and the commit graph, and commits the result.
//
// Rules (docs: studio/README.md "Merging"):
//   * Every item is compared with the ancestor (base). An item only one side changed takes that side's version. Items both sides
//     changed are merged field by field (a block's title on one side and its count on the other both survive); only the SAME field
//     changed to two different values is a conflict.
//   * Lists keep the order the sides agree on. One side reordered: that order wins. Both reordered differently: a `reorder` conflict.
//     Items added by either side are placed after the neighbour they had; when both add after the same neighbour, ours comes first.
//   * Conflict kinds:
//       edit_edit    the same field of the same item changed to two different values (fields listed)
//       add_add      the same id (or the same one-per-page block type) added on both sides with different content
//       delete_edit  deleted on one side, changed or moved on the other
//       reorder      the same list reordered differently on both sides
//       move_edit    a grid block moved or resized on one side and edited on the other, and the merged page breaks a page rule
//       component    a reusable component changed (or added) on both sides. Whole-component rule, see below
//       layout       two independent moves collide on the grid (overlap, no room): the merged page breaks a rule neither side broke.
//                    move_edit and layout both offer a side's whole layout, or a manual layout
//   * Every conflict carries base / ours / theirs and what each choice would give (ifOurs, ifTheirs). A resolution
//     is { choose: 'ours' | 'theirs' | 'manual', value? } keyed by the conflict id. The merge is a pure function of
//     (base, ours, theirs, resolutions): a conflict that has a resolution is applied in place; the rest stay conflicts.
//   * Components are atomic: if both sides changed one, the resolved component always gets a version above both sides' versions
//     (max + 1), so adopters can tell it is newer than either.
import { canonical } from './canonical.mjs';
import { fail } from './db.mjs';
import { normalize, TYPES, gridProblems } from '../../journal/daypage.mjs';
import { PAGE_TYPES } from '../../journal/pages.mjs';
import { diffKeyed } from './diff.mjs';

export const CONFLICT_KINDS = ['edit_edit', 'add_add', 'delete_edit', 'reorder', 'move_edit', 'component', 'layout'];

const eq = (a, b) => canonical(a === undefined ? null : a) === canonical(b === undefined ? null : b);
const isRec = (x) => x && typeof x === 'object' && !Array.isArray(x);
const clone = (x) => (x === undefined ? undefined : structuredClone(x));
const same = (a, c) => a.join('\0') === c.join('\0');

// ---------- the commit graph ----------
// parentsOf(id) -> [ids]. Ancestors include the commit itself.
export function ancestors(parentsOf, start) {
  const seen = new Set(), stack = [start];
  while (stack.length) { const c = stack.pop(); if (seen.has(c)) continue; seen.add(c); for (const p of parentsOf(c)) stack.push(p); }
  return seen;
}
export const isAncestor = (parentsOf, maybeAncestor, of) => ancestors(parentsOf, of).has(maybeAncestor);
// The best common ancestors of a and b: common commits that are not an ancestor of another common commit. Usually one; a criss-cross
// history (both sides merged each other) has two or more, and the caller folds them into a virtual base. Sorted, so it is deterministic.
export function mergeBases(parentsOf, a, b) {
  const A = ancestors(parentsOf, a), B = ancestors(parentsOf, b);
  const common = [...A].filter((x) => B.has(x));
  const hidden = new Set(); // ancestors (strictly) of some common commit
  for (const c of common) { const stack = [...parentsOf(c)]; while (stack.length) { const x = stack.pop(); if (hidden.has(x)) continue; hidden.add(x); stack.push(...parentsOf(x)); } }
  return common.filter((c) => !hidden.has(c)).sort();
}

// ---------- flat view of a snapshot ----------
// coll[part] = Map(scope -> Map(list -> items)). day: one scope, one list. book: a scope per top-level list (default, months.YYYY-MM),
// a list per sub-list (weeks month/week pages, path "default>week"). assets and components: one list.
const pageItem = (it) => ({ id: it.id, type: it.type, on: it.on !== false, options: it.type === 'weeks' ? {} : clone(it.options || {}) });
function bookScopes(book) {
  const out = new Map();
  const add = (scope, path, items) => {
    if (!out.has(scope)) out.set(scope, new Map());
    out.get(scope).set(path, items.map(pageItem));
    for (const it of items) if (it.type === 'weeks') { add(scope, `${path}>month`, (it.options || {}).month || []); add(scope, `${path}>week`, (it.options || {}).week || []); }
  };
  add('default', 'default', book.default || []);
  for (const [m, v] of Object.entries(book.months || {})) add(`months.${m}`, `months.${m}`, v.pages || []);
  return out;
}
function buildBook(scopes) {
  const mk = (path, lists) => (it) => (it.type === 'weeks'
    ? { id: it.id, type: it.type, on: it.on, options: { month: (lists.get(`${path}>month`) || []).map(mk(`${path}>month`, lists)), week: (lists.get(`${path}>week`) || []).map(mk(`${path}>week`, lists)) } }
    : { id: it.id, type: it.type, on: it.on, options: clone(it.options) });
  const book = { version: 1, default: [], months: {} };
  for (const [scope, lists] of scopes) {
    const top = (lists.get(scope) || []).map(mk(scope, lists));
    if (scope === 'default') book.default = top;
    else if (top.length) book.months[scope.slice('months.'.length)] = { pages: top };
  }
  return book;
}
const one = (scope, list, items) => new Map([[scope, new Map([[list, items]])]]);
export function flatten(s) {
  return {
    meta: s.meta, print: s.print, grid: !!s.day.grid,
    coll: { day: one('day', 'blocks', s.day.blocks || []), book: bookScopes(s.book), assets: one('assets', 'assets', s.assets || []), components: one('components', 'components', s.components || []) },
  };
}
function assemble(f, rest) {
  const day = { v: 2, ...(f.grid ? { grid: true } : {}), blocks: (f.coll.day.get('day') || new Map()).get('blocks') || [] };
  return { meta: f.meta, print: f.print, book: buildBook(f.coll.book), day, assets: ((f.coll.assets.get('assets') || new Map()).get('assets')) || [], components: ((f.coll.components.get('components') || new Map()).get('components')) || [], ...(rest || {}) };
}

// ---------- names ----------
const blockLabel = (b) => `${(TYPES[b.type] || {}).name || b.type}${b.title && typeof b.title === 'string' ? ` “${b.title}”` : ''}`;
const pageLabel = (p) => (p.type === 'weeks' ? 'The weeks' : (PAGE_TYPES[p.type] || {}).name || p.type);
const fieldName = (part, path) => ({ title: 'Title', subtitle: 'Subtitle', slug: 'Web name', description: 'Description', trim: 'Trim size', edition: 'Edition', start: 'First month', day_start_hour: 'Day starts at', hardcover: 'Hardcover' }[path] || (path.startsWith('modules.') ? `Module “${path.slice(8)}”` : path));

// ---------- value merge ----------
// Field-level three-way merge of plain JSON. Arrays and scalars are atomic. `bad` collects {path, base, ours, theirs} for every field
// changed to two different values; the result takes ours there (prefer 'ours') or theirs (prefer 'theirs').
function mergeValue(b, o, t, prefer, path, bad) {
  if (eq(o, t)) return o;
  if (eq(b, o)) return t;
  if (eq(b, t)) return o;
  if (isRec(o) && isRec(t) && (isRec(b) || b === undefined || b === null)) {
    const B = isRec(b) ? b : {}, out = {};
    for (const k of [...new Set([...Object.keys(B), ...Object.keys(o), ...Object.keys(t)])].sort()) {
      const v = mergeValue(B[k], o[k], t[k], prefer, path ? `${path}.${k}` : k, bad);
      if (v !== undefined) out[k] = v;
    }
    return out;
  }
  bad.push({ path, base: b, ours: o, theirs: t });
  return prefer === 'theirs' ? t : o;
}
// Care rows: fixed ids in a movable order. Same ids on all sides: merge row by row, and the order like a list. Otherwise atomic.
function mergeRows(b, o, t, prefer, bad) {
  if (eq(o, t)) return o;
  if (eq(b, o)) return t;
  if (eq(b, t)) return o;
  const ids = (x) => (x || []).map((r) => r.id), key = (x) => [...ids(x)].sort().join('|');
  if (!(key(b) === key(o) && key(o) === key(t))) { bad.push({ path: 'rows', base: b, ours: o, theirs: t }); return prefer === 'theirs' ? t : o; }
  const by = (x) => Object.fromEntries(x.map((r) => [r.id, r])), mb = by(b), mo = by(o), mt = by(t), rows = {};
  for (const id of ids(b)) rows[id] = mergeValue(mb[id], mo[id], mt[id], prefer, `rows.${id}`, bad);
  const bi = ids(b), oi = ids(o), ti = ids(t);
  let order = oi;
  if (same(oi, bi) || same(oi, ti)) order = ti.length && !same(ti, bi) ? ti : oi;
  else if (!same(ti, bi)) { bad.push({ path: 'rows.order', base: bi, ours: oi, theirs: ti }); order = prefer === 'theirs' ? ti : oi; }
  return order.map((id) => rows[id]);
}
function mergeWithRows(b, o, t, prefer) {
  const bad = [], { rows: rb, ...bb } = b, { rows: ro, ...oo } = o, { rows: rt, ...tt } = t;
  const value = mergeValue(bb, oo, tt, prefer, '', bad);
  if (rb || ro || rt) value.rows = mergeRows(rb || [], ro || [], rt || [], prefer, bad);
  return { value, bad };
}
const mergeItemPlain = (b, o, t, prefer) => { const bad = []; return { value: mergeValue(b, o, t, prefer, '', bad), bad }; };
const mergeAtomic = (b, o, t, prefer) => (eq(o, t) ? { value: o, bad: [] } : eq(b, o) ? { value: t, bad: [] } : eq(b, t) ? { value: o, bad: [] } : { value: prefer === 'theirs' ? t : o, bad: [{ path: '', base: b, ours: o, theirs: t }] });
const mergePage = (b, o, t, prefer) => mergeItemPlain(b, o, t, prefer);

const setPath = (obj, path, v) => { const p = path.split('.'); let x = obj; for (const k of p.slice(0, -1)) { if (!isRec(x[k])) x[k] = {}; x = x[k]; } if (v === undefined || v === null) delete x[p[p.length - 1]]; else x[p[p.length - 1]] = v; };

// ---------- conflicts and resolutions ----------
class Ctx {
  constructor(resolutions) { this.res = resolutions && typeof resolutions === 'object' ? resolutions : {}; this.conflicts = []; this.used = new Set(); this.resolved = []; this.stats = { ours: 0, theirs: 0, merged: 0 }; }
  decide(c, check) {
    Object.defineProperty(c, 'check', { value: check, enumerable: false });
    const r = Object.hasOwn(this.res, c.id) ? this.res[c.id] : undefined;
    if (r === undefined) { this.conflicts.push(c); return { value: c.provisional, resolved: false }; }
    this.used.add(c.id);
    if (!r || typeof r !== 'object') fail(422, 'invalid_resolution', `The resolution for “${c.label}” must be {choose: "ours" | "theirs" | "manual", value}.`);
    let value;
    if (r.choose === 'ours') value = c.ifOurs;
    else if (r.choose === 'theirs') value = c.ifTheirs;
    else if (r.choose === 'manual') { if (!('value' in r)) fail(422, 'invalid_resolution', `A manual resolution for “${c.label}” needs a value.`); value = check ? check(r.value) : r.value; }
    else fail(422, 'invalid_resolution', `“${r.choose}” is not a choice for “${c.label}”.`);
    this.resolved.push({ id: c.id, kind: c.kind, label: c.label, choose: r.choose });
    return { value, resolved: true };
  }
}

// ---------- one scope: items by id across its lists ----------
// spec: {part, prefix, id(item), label(item), merge(b,o,t,prefer), lists (items carry a `list`), ordered, kindEdit, defaultList}
function mergeScope(ctx, spec, B, O, T) {
  const idx = (M) => { const m = new Map(); for (const [lp, items] of M) for (const it of items) m.set(spec.id(it), { it, list: lp }); return m; };
  const b = idx(B), o = idx(O), t = idx(T);
  const ids = [...new Set([...b.keys(), ...o.keys(), ...t.keys()])];
  const val = (x) => (x ? { ...clone(x.it), ...(spec.lists ? { list: x.list } : {}) } : null);
  const split = (v, fallback) => { if (!v) return null; if (!spec.lists) return { it: v, list: spec.defaultList }; const { list, ...it } = v; return { it, list: typeof list === 'string' ? list : fallback }; };
  const final = new Map(), labels = new Map();
  for (const id of ids) {
    const B_ = b.get(id), O_ = o.get(id), T_ = t.get(id), any = O_ || T_ || B_;
    labels.set(id, spec.label(any.it));
    const cid = spec.prefix + id;
    const conflict = (kind, extra) => ({ id: cid, kind, part: spec.part, itemType: any.it.type, key: id, label: spec.label(any.it), base: val(B_), ours: val(O_), theirs: val(T_), ...extra });
    // manual values: the same item (same id) or, where allowed, null (delete)
    const check = (allowNull) => (v) => {
      if (v === null && allowNull) return null;
      if (!isRec(v) || spec.id(v) !== id) fail(422, 'invalid_resolution', `The manual value for “${spec.label(any.it)}” must be that item (id “${id}”).`);
      return v;
    };
    let out, c = null;
    if (B_) {
      if (O_ && T_) {
        // a page's list never changes between sides (each page type belongs to one list), so the side's list is used as it is
        const rO = spec.merge(B_.it, O_.it, T_.it, 'ours'), rT = spec.merge(B_.it, O_.it, T_.it, 'theirs'), loc = O_.list !== B_.list ? O_.list : T_.list;
        const fields = rO.bad.map((x) => ({ path: x.path, base: x.base ?? null, ours: x.ours ?? null, theirs: x.theirs ?? null }));
        const mv = (it) => val({ it, list: loc });
        if (rO.bad.length) c = conflict(spec.kindEdit, { fields, ifOurs: mv(rO.value), ifTheirs: mv(rT.value), provisional: mv(rO.value) });
        else out = { it: rO.value, list: loc };
      } else if (!O_ && !T_) out = null;
      else {
        const X = O_ || T_;
        if (eq(X.it, B_.it) && X.list === B_.list) out = null;
        else c = conflict('delete_edit', { deletedBy: O_ ? 'theirs' : 'ours', ifOurs: val(O_), ifTheirs: val(T_), provisional: val(X) });
      }
    } else if (O_ && T_) {
      if (eq(O_.it, T_.it) && O_.list === T_.list) out = O_;
      else c = conflict(spec.kindAdd, { fields: [], ifOurs: val(O_), ifTheirs: val(T_), provisional: val(O_) });
    } else out = O_ || T_;
    if (c) {
      if (spec.afterChoice) spec.afterChoice(c);
      const d = ctx.decide(c, check(c.kind === 'delete_edit'));
      out = split(d.value, (O_ || T_ || B_).list);
    } else if (out) {
      const sO = O_ && eq(out.it, O_.it) && out.list === O_.list, sT = T_ && eq(out.it, T_.it) && out.list === T_.list, sB = B_ && eq(out.it, B_.it) && out.list === B_.list;
      if (!sB) { if (sO && !sT) ctx.stats.ours++; else if (sT && !sO) ctx.stats.theirs++; else if (!sO && !sT) ctx.stats.merged++; }
    } else if (B_ && !c) { if (!O_) ctx.stats.ours++; else ctx.stats.theirs++; }
    if (out) final.set(id, out);
  }
  if (spec.postDecide) spec.postDecide(ctx, final, { b, o, t, val });
  const paths = [...new Set([...B.keys(), ...O.keys(), ...T.keys(), ...[...final.values()].map((x) => x.list)])];
  const result = new Map();
  for (const lp of paths) {
    const S = new Set([...final].filter(([, v]) => v.list === lp).map(([id]) => id));
    const idsOf = (M) => (M.get(lp) || []).map(spec.id);
    const order = spec.ordered ? mergeOrder(ctx, spec, lp, idsOf(B), idsOf(O), idsOf(T), S, labels) : [...S];
    result.set(lp, order.map((id) => final.get(id).it));
  }
  return result;
}

// The order of one list. K = items every side still has here. See the header for the rules.
function mergeOrder(ctx, spec, lp, Bi, Oi, Ti, S, labels) {
  const K = Bi.filter((x) => Oi.includes(x) && Ti.includes(x) && S.has(x)), seq = (L) => L.filter((x) => K.includes(x));
  const sB = K, sO = seq(Oi), sT = seq(Ti), chO = !same(sO, sB), chT = !same(sT, sB);
  const build = (skel) => {
    const merged = [...skel], oursAdded = new Set(), rest = [...S].filter((x) => !merged.includes(x));
    const fromO = Oi.filter((x) => rest.includes(x)), fromT = Ti.filter((x) => rest.includes(x) && !fromO.includes(x)), left = rest.filter((x) => !fromO.includes(x) && !fromT.includes(x));
    const put = (x, src, side) => {
      let i = src.indexOf(x) - 1; while (i >= 0 && !merged.includes(src[i])) i--;
      let pos = i >= 0 ? merged.indexOf(src[i]) + 1 : 0;
      if (side === 'T') while (pos < merged.length && oursAdded.has(merged[pos])) pos++; // ours first when both add after the same neighbour
      merged.splice(pos, 0, x); if (side === 'O') oursAdded.add(x);
    };
    fromO.forEach((x) => put(x, Oi, 'O')); fromT.forEach((x) => put(x, Ti, 'T')); merged.push(...left);
    return merged;
  };
  if (chO && chT && !same(sO, sT)) {
    const names = Object.fromEntries([...new Set([...Bi, ...Oi, ...Ti])].map((x) => [x, labels.get(x) || x]));
    const c = { id: `order:${lp}`, kind: 'reorder', part: spec.part, itemType: 'list', key: lp, label: spec.listLabel ? spec.listLabel(lp) : `Order of ${lp}`, base: Bi.filter((x) => S.has(x)), ours: build(sO), theirs: build(sT), names, ifOurs: build(sO), ifTheirs: build(sT), provisional: build(sO) };
    const d = ctx.decide(c, (v) => { if (!Array.isArray(v) || v.length !== S.size || new Set(v).size !== S.size || !v.every((x) => S.has(x))) fail(422, 'invalid_resolution', `A manual order for “${c.label}” must list exactly these items, once each: ${[...S].join(', ')}.`); return v; });
    return d.value;
  }
  return build(chO ? sO : chT ? sT : sB);
}

// One-per-page block types (Moon & sun, Writing space, ...): two different uids of one type cannot both stay.
function singleDupes(ctx, final, { b, o, t, val }) {
  const by = new Map();
  for (const [id, v] of final) if ((TYPES[v.it.type] || {}).single) { if (!by.has(v.it.type)) by.set(v.it.type, []); by.get(v.it.type).push(id); }
  for (const [type, list] of by) {
    if (list.length < 2) continue;
    const mine = list.find((id) => o.has(id) && !b.has(id)) || list.find((id) => o.has(id)), theirs = list.find((id) => t.has(id) && id !== mine && !b.has(id)) || list.find((id) => t.has(id) && id !== mine);
    if (!mine || !theirs) continue;
    const c = { id: `single:${type}`, kind: 'add_add', part: 'day', itemType: type, key: type, label: `${TYPES[type].name} (only one per page)`, base: null, ours: val(o.get(mine)), theirs: val(t.get(theirs)), fields: [], ifOurs: val(o.get(mine)), ifTheirs: val(t.get(theirs)), provisional: val(o.get(mine)) };
    const d = ctx.decide(c, (v) => { if (!isRec(v) || v.type !== type) fail(422, 'invalid_resolution', `The manual value for “${c.label}” must be one ${type} block.`); return v; });
    const keep = d.value, list_ = 'blocks';
    for (const id of list) final.delete(id);
    if (keep) { const { list: _l, ...it } = keep; final.set(it.uid, { it, list: list_ }); }
  }
}

// ---------- the merge ----------
const SPECS = {
  day: { part: 'day', prefix: 'block:', id: (x) => x.uid, label: blockLabel, merge: mergeWithRows, ordered: true, kindEdit: 'edit_edit', kindAdd: 'add_add', defaultList: 'blocks', postDecide: singleDupes, listLabel: () => 'Order of the blocks on the day page' },
  book: (scope) => ({ part: 'book', prefix: `page:${scope}/`, id: (x) => x.id, label: pageLabel, merge: mergePage, lists: true, ordered: true, kindEdit: 'edit_edit', kindAdd: 'add_add', listLabel: (lp) => `Order of the pages${lp.includes('>') ? ` (${lp.split('>')[1]} pages)` : ''}${scope === 'default' ? '' : ` in ${scope.replace('months.', '')}`}` }),
  assets: { part: 'assets', prefix: 'asset:', id: (x) => x.name, label: (x) => `Image ${x.name}`, merge: mergeItemPlain, ordered: false, kindEdit: 'edit_edit', kindAdd: 'add_add', defaultList: 'assets' },
  components: { part: 'components', prefix: 'component:', id: (x) => x.id, label: (x) => `Component “${x.name}”`, merge: mergeAtomic, ordered: false, kindEdit: 'component', kindAdd: 'component', defaultList: 'components' },
};
const specFor = (part, scope) => (typeof SPECS[part] === 'function' ? SPECS[part](scope) : SPECS[part]);
const bumpComponent = (c) => {
  if (c.kind !== 'component') return;
  const v = Math.max((c.ours || {}).version || 0, (c.theirs || {}).version || 0) + 1;
  for (const k of ['ifOurs', 'ifTheirs']) if (c[k]) c[k] = { ...c[k], version: v };
  c.provisional = c.ifOurs; c.minVersion = v;
};

// Did some block move or resize on one side and get edited on the other?
const PLACE_KEYS = ['col', 'row', 'colSpan', 'rowSpan'];
function movedAndEdited(b, o, t) {
  const by = (d) => Object.fromEntries((d.blocks || []).map((x) => [x.uid, x]));
  const moved = (x, y) => PLACE_KEYS.some((k) => x[k] !== y[k]), strip = (x) => Object.fromEntries(Object.entries(x).filter(([k]) => !PLACE_KEYS.includes(k))), edited = (x, y) => !eq(strip(x), strip(y));
  const B = by(b), O = by(o), T = by(t);
  return Object.keys(B).some((u) => O[u] && T[u] && ((moved(B[u], O[u]) && edited(B[u], T[u])) || (moved(B[u], T[u]) && edited(B[u], O[u]))));
}

export function mergeSnapshots(base, ours, theirs, resolutions = {}) {
  const ctx = new Ctx(resolutions), fB = flatten(base), fO = flatten(ours), fT = flatten(theirs);
  const merged = { meta: null, print: null };
  for (const part of ['meta', 'print']) {
    const bad = [], v = clone(mergeValue(base[part], ours[part], theirs[part], 'ours', '', bad)) || {};
    for (const x of bad) {
      const c = { id: `${part}.${x.path}`, kind: 'edit_edit', part, itemType: 'setting', key: x.path, label: fieldName(part, x.path), base: x.base ?? null, ours: x.ours ?? null, theirs: x.theirs ?? null, fields: [], ifOurs: x.ours ?? null, ifTheirs: x.theirs ?? null, provisional: x.ours ?? null };
      setPath(v, x.path, ctx.decide(c).value);
    }
    merged[part] = v;
  }
  const flat = { meta: merged.meta, print: merged.print, grid: false, coll: {} };
  flat.grid = (() => { const bad = []; return !!mergeValue(fB.grid, fO.grid, fT.grid, 'ours', 'grid', bad); })();
  for (const part of ['day', 'book', 'assets', 'components']) {
    const scopes = new Map(), keys = [...new Set([...fB.coll[part].keys(), ...fO.coll[part].keys(), ...fT.coll[part].keys()])];
    for (const scope of keys) {
      const spec = { ...specFor(part, scope), afterChoice: part === 'components' ? bumpComponent : undefined };
      const g = (F) => F.coll[part].get(scope) || new Map();
      scopes.set(scope, mergeScope(ctx, spec, g(fB), g(fO), g(fT)));
    }
    flat.coll[part] = scopes;
  }
  let snap = assemble(flat);
  // the merged grid page must obey the page rules, unless a side already broke them
  if (snap.day.grid) {
    const prob = (d) => new Set(gridProblems(normalize(d), 'small').map((p) => `${p.uid}|${p.code}`));
    const pO = prob(ours.day), pT = prob(theirs.day), now = gridProblems(normalize(snap.day), 'small').filter((p) => !pO.has(`${p.uid}|${p.code}`) && !pT.has(`${p.uid}|${p.code}`));
    if (now.length) {
      const kind = movedAndEdited(base.day, ours.day, theirs.day) ? 'move_edit' : 'layout';
      const c = { id: 'layout:day', kind, part: 'day', itemType: 'layout', key: 'day', label: 'The day page grid', base: base.day, ours: ours.day, theirs: theirs.day, problems: now.map((p) => p.msg), fields: [], ifOurs: ours.day, ifTheirs: theirs.day, provisional: snap.day };
      const d = ctx.decide(c, (v) => { if (!isRec(v) || !Array.isArray(v.blocks)) fail(422, 'invalid_resolution', 'A manual day layout must be {v: 2, blocks: [...]}.'); return v; });
      snap = { ...snap, day: d.value };
    }
  }
  for (const id of Object.keys(ctx.res)) if (!ctx.used.has(id)) fail(422, 'unknown_resolution', `There is no conflict “${id}” to resolve (it may already be resolved, or the branches changed).`);
  // components: a hand-made resolution takes at least the next version
  const comps = ctx.resolved.filter((r) => r.kind === 'component');
  for (const r of comps) {
    const c = snap.components.find((x) => `component:${x.id}` === r.id);
    const o = ours.components.find((x) => x.id === (c && c.id)), t = theirs.components.find((x) => x.id === (c && c.id));
    if (c) c.version = Math.max(c.version, Math.max((o || {}).version || 0, (t || {}).version || 0) + 1);
  }
  return { snapshot: clone(snap), conflicts: ctx.conflicts, resolved: ctx.resolved, stats: ctx.stats, clean: !ctx.conflicts.length };
}

// ---------- what a proposal changes, and accepting only some of it ----------
function leaves(b, t, path, out) {
  if (eq(b, t)) return;
  if (isRec(b) && isRec(t)) { for (const k of [...new Set([...Object.keys(b), ...Object.keys(t)])].sort()) leaves(b[k], t[k], path ? `${path}.${k}` : k, out); return; }
  out.push(path);
}
// [{key, part, kind: added|removed|changed|moved, label, id, detail}] from base to theirs. Keys are what acceptChanges takes.
export function listChanges(base, theirs) {
  const fB = flatten(base), fT = flatten(theirs), out = [];
  for (const part of ['meta', 'print']) {
    const paths = []; leaves(base[part], theirs[part], '', paths);
    for (const p of paths) out.push({ key: `${part}:${p}`, part, kind: 'changed', label: fieldName(part, p), id: p, detail: { before: p.split('.').reduce((x, k) => (x || {})[k], base[part]) ?? null, after: p.split('.').reduce((x, k) => (x || {})[k], theirs[part]) ?? null } });
  }
  if (fB.grid !== fT.grid) out.push({ key: 'day:grid', part: 'day', kind: 'changed', label: 'Grid layout', id: 'grid', detail: { before: fB.grid, after: fT.grid } });
  for (const part of ['day', 'book', 'assets', 'components']) {
    for (const scope of new Set([...fB.coll[part].keys(), ...fT.coll[part].keys()])) {
      const spec = specFor(part, scope), gB = fB.coll[part].get(scope) || new Map(), gT = fT.coll[part].get(scope) || new Map();
      const idx = (M) => { const m = new Map(); for (const [lp, items] of M) for (const it of items) m.set(spec.id(it), { it, list: lp }); return m; };
      const b = idx(gB), t = idx(gT);
      for (const [id, T_] of t) {
        const B_ = b.get(id), key = spec.prefix + id;
        if (!B_) out.push({ key, part, scope, kind: 'added', label: spec.label(T_.it), id, itemType: T_.it.type, list: T_.list });
        else if (!eq(B_.it, T_.it) || B_.list !== T_.list) {
          const fs = []; leaves(B_.it, T_.it, '', fs);
          out.push({ key, part, scope, kind: !eq(B_.it, T_.it) ? 'changed' : 'moved', label: spec.label(T_.it), id, itemType: T_.it.type, list: T_.list, fromList: B_.list, fields: fs });
        }
      }
      for (const [id, B_] of b) if (!t.has(id)) out.push({ key: spec.prefix + id, part, scope, kind: 'removed', label: spec.label(B_.it), id, itemType: B_.it.type, list: B_.list });
      if (spec.ordered) {
        for (const lp of new Set([...gB.keys(), ...gT.keys()])) {
          const A = (gB.get(lp) || []).filter((x) => t.has(spec.id(x)) && t.get(spec.id(x)).list === lp), Z = (gT.get(lp) || []).filter((x) => b.has(spec.id(x)) && b.get(spec.id(x)).list === lp);
          const d = diffKeyed(A.map((x) => ({ ...x, id: spec.id(x) })), Z.map((x) => ({ ...x, id: spec.id(x) })), () => [], (x) => ({ id: x.id, type: x.type }));
          if (d.moved.length) out.push({ key: `order:${lp}`, part, scope, kind: 'moved', label: spec.listLabel(lp), id: lp, moved: d.moved.map((m) => ({ id: m.id, label: spec.label(Z.find((z) => spec.id(z) === m.id)), from: m.from, to: m.to })) });
        }
      }
    }
  }
  return out;
}

// base with only the chosen changes (keys from listChanges) taken from theirs. The result goes through mergeSnapshots against ours.
export function applyChanges(base, theirs, keys) {
  const sel = new Set(keys), fb = flatten(clone(base)), ft = flatten(theirs);
  for (const part of ['meta', 'print']) {
    const b = fb[part];
    for (const k of sel) if (k.startsWith(part + ':')) { const p = k.slice(part.length + 1); setPath(b, p, p.split('.').reduce((x, q) => (x || {})[q], theirs[part])); }
  }
  if (sel.has('day:grid')) fb.grid = ft.grid;
  for (const part of ['day', 'book', 'assets', 'components']) {
    for (const scope of new Set([...fb.coll[part].keys(), ...ft.coll[part].keys()])) {
      const spec = specFor(part, scope);
      if (!fb.coll[part].has(scope)) fb.coll[part].set(scope, new Map());
      const gB = fb.coll[part].get(scope), gT = ft.coll[part].get(scope) || new Map();
      const find = (G, id) => { for (const [lp, items] of G) { const i = items.findIndex((x) => spec.id(x) === id); if (i >= 0) return { lp, i, it: items[i] }; } return null; };
      const ids = new Set([...[...gB.values()].flat().map(spec.id), ...[...gT.values()].flat().map(spec.id)]);
      for (const id of ids) {
        if (!sel.has(spec.prefix + id)) continue;
        const cur = find(gB, id), want = find(gT, id);
        if (!want) { if (cur) gB.get(cur.lp).splice(cur.i, 1); continue; }
        if (cur && cur.lp === want.lp) { gB.get(cur.lp)[cur.i] = clone(want.it); continue; }
        if (cur) gB.get(cur.lp).splice(cur.i, 1);
        if (!gB.has(want.lp)) gB.set(want.lp, []);
        const list = gB.get(want.lp), src = gT.get(want.lp);
        let i = want.i - 1; while (i >= 0 && !list.some((x) => spec.id(x) === spec.id(src[i]))) i--;
        list.splice(i >= 0 ? list.findIndex((x) => spec.id(x) === spec.id(src[i])) + 1 : 0, 0, clone(want.it));
      }
      if (spec.ordered) for (const [lp, list] of gB) {
        if (!sel.has(`order:${lp}`)) continue;
        const want = (gT.get(lp) || []).map(spec.id).filter((id) => list.some((x) => spec.id(x) === id));
        const slots = list.map((x, i) => (want.includes(spec.id(x)) ? i : -1)).filter((i) => i >= 0), items = new Map(list.map((x) => [spec.id(x), x]));
        slots.forEach((slot, n) => { list[slot] = items.get(want[n]); });
      }
    }
  }
  return assemble(fb);
}
