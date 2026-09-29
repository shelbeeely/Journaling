// Structured diff between two snapshots, by stable ids: pages (book entries by id) and blocks (day blocks by uid), never by position.
// Pure. The editor draws these with the real page renderers; the API returns them as JSON.
//   added / removed  items present on one side only
//   moved            same id, different order among the items both sides have (a minimal set: the smallest number of items to move)
//   changed          same id, different content: [{key, before, after}] per field
import { canonical } from './canonical.mjs';

const same = (a, b) => canonical(a === undefined ? null : a) === canonical(b === undefined ? null : b);

function fieldDiff(a, b, prefix = '') {
  const out = [];
  const keys = [...new Set([...Object.keys(a || {}), ...Object.keys(b || {})])];
  for (const k of keys) if (!same((a || {})[k], (b || {})[k])) out.push({ key: prefix + k, before: (a || {})[k] ?? null, after: (b || {})[k] ?? null });
  return out;
}

// Longest increasing subsequence of positions: the items that keep their relative order; everything else counts as moved.
function stableSet(order) {
  const tails = [], prev = new Array(order.length).fill(-1), idx = [];
  order.forEach((v, i) => {
    let lo = 0, hi = tails.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (order[tails[m]] < v) lo = m + 1; else hi = m; }
    if (lo > 0) prev[i] = tails[lo - 1];
    tails[lo] = i; idx[lo] = i;
  });
  const keep = new Set();
  for (let i = tails.length ? tails[tails.length - 1] : -1; i >= 0; i = prev[i]) keep.add(i);
  return keep;
}

// items: [{id, ...}]; fields(a, b) -> [{key, before, after}]
export function diffKeyed(listA, listB, fields, label = (x) => ({ id: x.id, type: x.type })) {
  const A = new Map(listA.map((x, i) => [x.id, { x, i }])), B = new Map(listB.map((x, i) => [x.id, { x, i }]));
  const added = [], removed = [], moved = [], changed = [];
  for (const [id, { x, i }] of B) if (!A.has(id)) added.push({ ...label(x), index: i });
  for (const [id, { x, i }] of A) if (!B.has(id)) removed.push({ ...label(x), index: i });
  const common = listB.filter((x) => A.has(x.id)); // in B's order
  const posInA = common.map((x) => A.get(x.id).i);
  const keep = stableSet(posInA);
  common.forEach((x, k) => { if (!keep.has(k)) moved.push({ ...label(x), from: A.get(x.id).i, to: B.get(x.id).i }); });
  for (const x of common) { const f = fields(A.get(x.id).x, x); if (f.length) changed.push({ ...label(x), fields: f }); }
  return { added, removed, moved, changed };
}
const count = (d) => d.added.length + d.removed.length + d.moved.length + d.changed.length;

// ---------- book ----------
function bookLists(book) {
  const lists = new Map();
  const add = (path, items) => { lists.set(path, items); for (const it of items) if (it.type === 'weeks') { add(`${path}>month`, (it.options || {}).month || []); add(`${path}>week`, (it.options || {}).week || []); } };
  add('default', book.default || []);
  for (const [m, v] of Object.entries(book.months || {})) add(`months.${m}`, v.pages || []);
  return lists;
}
const entryFields = (a, b) => {
  const oa = a.type === 'weeks' ? {} : a.options || {}, ob = b.type === 'weeks' ? {} : b.options || {};
  return [...fieldDiff({ type: a.type, on: a.on }, { type: b.type, on: b.on }), ...fieldDiff(oa, ob, 'options.')];
};
export function diffBook(a, b) {
  const la = bookLists(a), lb = bookLists(b), out = { added: [], removed: [], moved: [], changed: [] };
  for (const path of new Set([...la.keys(), ...lb.keys()])) {
    if (!la.has(path)) { for (const [i, x] of lb.get(path).entries()) out.added.push({ list: path, id: x.id, type: x.type, index: i }); continue; }
    if (!lb.has(path)) { for (const [i, x] of la.get(path).entries()) out.removed.push({ list: path, id: x.id, type: x.type, index: i }); continue; }
    const d = diffKeyed(la.get(path), lb.get(path), entryFields);
    for (const k of Object.keys(out)) out[k].push(...d[k].map((x) => ({ list: path, ...x })));
  }
  return out;
}

// ---------- day layout ----------
function blockFields(a, b) {
  const skip = ['uid', 'rows'];
  const out = fieldDiff(Object.fromEntries(Object.entries(a).filter(([k]) => !skip.includes(k))), Object.fromEntries(Object.entries(b).filter(([k]) => !skip.includes(k))));
  if (a.rows || b.rows) {
    const ra = a.rows || [], rb = b.rows || [];
    const d = diffKeyed(ra, rb, (x, y) => fieldDiff(x, y), (x) => ({ id: x.id }));
    for (const x of d.added) out.push({ key: `rows.${x.id}`, before: null, after: 'added' });
    for (const x of d.removed) out.push({ key: `rows.${x.id}`, before: 'present', after: null });
    for (const x of d.moved) out.push({ key: `rows.${x.id}.order`, before: x.from, after: x.to });
    for (const x of d.changed) for (const f of x.fields) out.push({ key: `rows.${x.id}.${f.key}`, before: f.before, after: f.after });
  }
  return out;
}
export const diffDay = (a, b) => diffKeyed((a.blocks || []).map((x) => ({ ...x, id: x.uid })), (b.blocks || []).map((x) => ({ ...x, id: x.uid })), blockFields, (x) => ({ id: x.uid, type: x.type }));

// ---------- everything ----------
export function diffSnapshots(a, b) {
  const assets = diffKeyed(a.assets.map((x) => ({ ...x, id: x.name })), b.assets.map((x) => ({ ...x, id: x.name })), (x, y) => fieldDiff({ hash: x.hash, mime: x.mime, size: x.size }, { hash: y.hash, mime: y.mime, size: y.size }), (x) => ({ id: x.name, type: x.mime }));
  const components = diffKeyed(a.components, b.components, (x, y) => fieldDiff({ name: x.name, version: x.version, page: x.page }, { name: y.name, version: y.version, page: y.page }), (x) => ({ id: x.id, type: x.page && x.page.type }));
  const r = { meta: fieldDiff(a.meta, b.meta), print: fieldDiff(a.print, b.print), book: diffBook(a.book, b.book), day: diffDay(a.day, b.day), assets, components };
  r.summary = { meta: r.meta.length, print: r.print.length, book: count(r.book), day: count(r.day), assets: count(assets), components: count(components) };
  r.summary.total = Object.values(r.summary).reduce((t, n) => t + n, 0);
  return r;
}
