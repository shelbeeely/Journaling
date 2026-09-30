// Pack core (PK0): one manifest (pack.json, schema 1) for every kind of pack, and the loader that the whole build reads packs through.
// A pack is a folder: pack.json + the files the manifest lists (with a sha256 each). What a pack holds, how it is checked and how the
// build uses it is the business of its kind, one entry in kinds.mjs. Nothing here knows about any one kind.
//
//   loadPack(ref)            resolve a pack by id ("generic", looked up in journal/packs/ and in each KW_PACKS folder) or by folder
//                            path, check the manifest, the engine range and every file hash, and return it (cached)
//   readPart(ref, kind)      what the build consumes from that pack for one kind (its registry `consume`)
//   checkPack(ref)           every check a pack must pass (manifest, licence, hashes, sizes, privacy class, then the kind's own validator)
//   sealPack(ref)            recompute the file list and hashes in pack.json (after editing a file)
//   usedPacks()              the packs this process loaded, for the book manifest (id, version, kind, hash, licence, privacy class)
// Pure JS with fs only (no profile, no engine), so the profile, the CLI and the Studio scanner can all import it.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { KINDS, kindNames, kindOf, partKinds, privacyOf, partFile } from './kinds.mjs';

export const SCHEMA = 1;
export const ENGINE_VERSION = '1.0.0'; // the pack format / engine a manifest's `engine` range is checked against
export const PACKS_DIR = path.dirname(new URL(import.meta.url).pathname);
const JOURNAL_DIR = path.dirname(PACKS_DIR);

const isObj = (x) => x && typeof x === 'object' && !Array.isArray(x);
const str = (v) => typeof v === 'string' && v.trim() !== '';
export const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
export const sha256File = (f) => sha256(fs.readFileSync(f));

// ---- semver (enough for engine ranges: exact, >=, >, <=, <, ^, ~ and a space-separated AND; no prerelease handling) ----
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
export const isSemver = (v) => typeof v === 'string' && SEMVER.test(v);
const parse = (v) => v.split('.').map(Number);
const cmp = (a, b) => { for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1; return 0; };
const partial = (s) => { const p = s.split('.').map(Number); return [p[0], p[1] ?? 0, p[2] ?? 0]; };
export function validRange(range) {
  return str(range) && range.trim().split(/\s+/).every((t) => /^(>=|<=|>|<|\^|~|=)?\d+(\.\d+){0,2}$/.test(t));
}
export function satisfies(range, version) {
  if (!validRange(range) || !isSemver(version)) return false;
  const v = parse(version);
  return range.trim().split(/\s+/).every((t) => {
    const m = /^(>=|<=|>|<|\^|~|=)?(.*)$/.exec(t), op = m[1] || '=', b = partial(m[2]);
    const c = cmp(v, b);
    if (op === '>=') return c >= 0;
    if (op === '>') return c > 0;
    if (op === '<=') return c <= 0;
    if (op === '<') return c < 0;
    if (op === '=') return c === 0;
    if (op === '~') return c >= 0 && cmp(v, [b[0], b[1] + 1, 0]) < 0;
    return c >= 0 && cmp(v, b[0] > 0 ? [b[0] + 1, 0, 0] : [0, b[1] + 1, 0]) < 0; // ^
  });
}

// ---- the manifest ----
export const ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const isDate = (d) => typeof d === 'string' && DATE_RE.test(d) && !Number.isNaN(Date.parse(d + 'T00:00:00Z'));
// A verification record: who checked, when, and against what (an organisation's own page, never a third-party listing).
export const validVerification = (v) => isObj(v) && str(v.who) && isDate(v.date) && str(v.source);

export function validateManifest(m) {
  const errs = [];
  const bad = (where, msg) => errs.push(`${where}: ${msg}`);
  if (!isObj(m)) return ['pack.json: must be an object'];
  if (m.schema !== SCHEMA) bad('schema', `must be ${SCHEMA}, got ${JSON.stringify(m.schema)}`);
  if (!(str(m.id) && ID_RE.test(m.id))) bad('id', 'is required: lowercase letters, digits and dashes, e.g. "spokane-wa"');
  if (!str(m.title)) bad('title', 'is required: a short name people see');
  if (!isSemver(m.version)) bad('version', `must be a semantic version like 1.0.0, got ${JSON.stringify(m.version)}`);
  if (!str(m.kind)) bad('kind', `is required (one of ${kindNames().join(', ')})`);
  if (!isObj(m.author) || !str(m.author.name)) bad('author.name', 'is required: who made this pack');
  else if (m.author.url !== undefined && m.author.url !== null && !str(m.author.url)) bad('author.url', 'optional; must be text');
  if (!isObj(m.license)) bad('license', 'is required: {spdx, attribution, commercialPrintOk}');
  else {
    if (!(str(m.license.spdx) && /^[A-Za-z0-9.+-]+$/.test(m.license.spdx))) bad('license.spdx', 'is required: an SPDX id like "CC0-1.0" or "CC-BY-4.0", or "LicenseRef-Something" for your own terms');
    if (typeof m.license.attribution !== 'string') bad('license.attribution', 'is required: the credit line to print (may be an empty string when the licence asks for none)');
    if (typeof m.license.commercialPrintOk !== 'boolean') bad('license.commercialPrintOk', 'is required: true or false (may this pack appear in a book that is sold?)');
  }
  if (!validRange(m.engine)) bad('engine', `is required: the engine versions this pack works with, e.g. ">=1.0.0 <2.0.0" (got ${JSON.stringify(m.engine)})`);
  if (m.region !== undefined && m.region !== null && !str(m.region)) bad('region', 'optional; text such as "US-WA", or null');
  if (m.languages !== undefined && !(Array.isArray(m.languages) && m.languages.every((l) => str(l) && /^[A-Za-z]{2,3}(-[A-Za-z0-9]+)*$/.test(l)))) bad('languages', 'optional; a list of language tags like ["en"]');
  if (m.privacy !== undefined && m.privacy !== 'personal') bad('privacy', 'optional; only "personal" (a pack may make itself more private than its kind, never less)');
  if (!Array.isArray(m.verified)) bad('verified', 'is required: a list (may be empty) of {item or kind, who, date, source}');
  else m.verified.forEach((v, i) => {
    if (!isObj(v) || !(str(v.item) || str(v.kind))) bad(`verified[${i}]`, 'needs "item" (an item id) or "kind" (covers the whole kind)');
    else if (!validVerification(v)) bad(`verified[${i}]`, 'needs who, date (YYYY-MM-DD) and source');
  });
  if (!Array.isArray(m.files)) bad('files', 'is required: [{path, sha256}] for every file (node packs-cli.mjs seal <id> writes it)');
  else {
    const seen = new Set();
    m.files.forEach((f, i) => {
      if (!isObj(f) || !str(f.path)) { bad(`files[${i}]`, 'needs a path'); return; }
      if (path.isAbsolute(f.path) || f.path.split(/[\\/]/).includes('..')) bad(`files[${i}].path`, `"${f.path}" must stay inside the pack folder`);
      if (seen.has(f.path)) bad(`files[${i}].path`, `"${f.path}" is listed twice`);
      seen.add(f.path);
      if (!(typeof f.sha256 === 'string' && /^[0-9a-f]{64}$/.test(f.sha256))) bad(`files[${i}].sha256`, 'must be a 64-character sha256 hex');
    });
  }
  return errs;
}

// A pack's identity: the same content gives the same hash. Covers the id, version, kind and every file hash.
export const packHash = (m) => sha256(JSON.stringify([m.id, m.version, m.kind, [...m.files].sort((a, b) => (a.path < b.path ? -1 : 1)).map((f) => [f.path, f.sha256])]));

// ---- finding and reading a pack ----
const extraDirs = () => (process.env.KW_PACKS ? process.env.KW_PACKS.split(path.delimiter).filter(Boolean).map((d) => path.resolve(d)) : []);
export function resolveDir(ref) {
  if (!str(ref)) throw new Error('a pack reference must be text: a pack id like "generic" or a folder with a pack.json');
  const tries = [];
  if (ID_RE.test(ref)) { for (const d of [...extraDirs(), PACKS_DIR]) tries.push(path.join(d, ref)); }
  else { tries.push(path.isAbsolute(ref) ? ref : path.resolve(JOURNAL_DIR, ref)); }
  for (const t of tries) if (fs.existsSync(path.join(t, 'pack.json'))) return t;
  const have = listPacks().map((p) => p.id);
  throw new Error(`No pack "${ref}" (looked for ${tries.map((t) => path.relative(process.cwd(), t) || t).join(', ')} with a pack.json). Installed packs: ${have.join(', ') || 'none'}. A pack is a folder with a pack.json: see journal/PACKS.md.`);
}
function readJsonFile(f, what) {
  let raw;
  try { raw = fs.readFileSync(f, 'utf8'); } catch (e) { throw new Error(`${what}: cannot read ${f} (${e.code || e.message})`); }
  try { return JSON.parse(raw); } catch (e) { throw new Error(`${what} is not valid JSON: ${e.message}`); }
}
export function listPacks() {
  const out = [];
  for (const d of [...extraDirs(), PACKS_DIR]) {
    if (!fs.existsSync(d)) continue;
    for (const n of fs.readdirSync(d).sort()) {
      const dir = path.join(d, n);
      if (n.startsWith('_') || !fs.existsSync(path.join(dir, 'pack.json'))) continue;
      let m = null; try { m = JSON.parse(fs.readFileSync(path.join(dir, 'pack.json'), 'utf8')); } catch { /* reported by check */ }
      out.push({ id: n, dir, manifest: m });
    }
  }
  return out;
}
export const privacyClass = (m) => (m.privacy === 'personal' ? 'personal' : privacyOf(m.kind));

// Hashes of every listed file, against the manifest. Returns problems (empty = all match).
export function fileProblems(dir, m) {
  const out = [];
  for (const f of m.files || []) {
    const p = path.join(dir, f.path);
    if (!fs.existsSync(p)) { out.push(`${f.path}: listed in pack.json but missing`); continue; }
    const h = sha256File(p);
    if (h !== f.sha256) out.push(`${f.path}: changed since it was sealed (expected ${f.sha256.slice(0, 12)}…, found ${h.slice(0, 12)}…)`);
  }
  return out;
}

const LOADED = new Map(); // dir -> pack
export function loadPack(ref) {
  const dir = resolveDir(ref);
  if (LOADED.has(dir)) return LOADED.get(dir);
  const name = path.relative(process.cwd(), dir) || dir;
  const m = readJsonFile(path.join(dir, 'pack.json'), `${name}/pack.json`);
  const errs = validateManifest(m);
  if (errs.length) throw new Error(`Pack ${name} has an invalid pack.json:\n  - ${errs.join('\n  - ')}\n(see journal/PACKS.md, "Write a content pack")`);
  kindOf(m.kind); // an unknown kind stops here with the list of installed kinds
  if (!satisfies(m.engine, ENGINE_VERSION)) throw new Error(`Pack "${m.id}" needs engine ${m.engine}, this is ${ENGINE_VERSION}. Get a newer version of the pack or of the engine.`);
  if (path.basename(dir) !== m.id && ID_RE.test(String(ref))) throw new Error(`Pack folder "${path.basename(dir)}" says id "${m.id}": the folder name and the id must match`);
  const probs = fileProblems(dir, m);
  if (probs.length) throw new Error(`Pack "${m.id}" does not match its pack.json:\n  - ${probs.join('\n  - ')}\nIf you edited it on purpose, reseal it: node packs-cli.mjs seal ${m.id}`);
  const pack = { dir, manifest: m, id: m.id, kind: m.kind, hash: packHash(m), privacy: privacyClass(m), parts: new Set() };
  LOADED.set(dir, pack);
  return pack;
}

// The value the build consumes for `kind` from pack `ref` (a bundle like `region` provides several kinds). Null when the pack has none of it.
export function readPart(ref, kind) {
  const pack = loadPack(ref);
  const provided = pack.kind === 'region' ? partKinds() : [pack.kind];
  if (!provided.includes(kind)) throw new Error(`Pack "${pack.id}" is a ${pack.kind} pack: it does not provide ${kind}. Use a pack of kind ${kind}${pack.kind === 'region' ? '' : ' or a region pack that includes it'}.`);
  const file = partFile(kind);
  const abs = path.join(pack.dir, file);
  if (!fs.existsSync(abs)) return null; // a region pack may leave a part out (the generic pack has no clinic and no transit)
  const def = kindOf(kind);
  const data = readJsonFile(abs, `${pack.id}/${file}`);
  const ctx = { pack: pack.manifest, dir: pack.dir, file };
  const errs = def.validate(data, ctx);
  if (errs.errors.length) throw new Error(`Pack "${pack.id}" (${file}) is not valid ${kind} data:\n  - ${errs.errors.join('\n  - ')}`);
  const gate = def.gate ? def.gate(data, ctx) : { refuse: [], warn: [] };
  if (gate.refuse.length) throw new Error(`Not printing the ${def.title} pages of pack "${pack.id}": ${gate.refuse.length} item${gate.refuse.length > 1 ? 's have' : ' has'} no verification note.\n  - ${gate.refuse.slice(0, 12).join('\n  - ')}${gate.refuse.length > 12 ? `\n  - (+${gate.refuse.length - 12} more)` : ''}\nGive each one "verified": {"who", "date" (YYYY-MM-DD), "source"} from the organisation's own page, or mark it "placeholder": true (the page then says to add your local numbers). See journal/PACKS.md, "Verification".`);
  if (gate.warn.length && !process.env.KW_PACK_QUIET) {
    const key = `${pack.id}:${kind}`;
    if (!WARNED.has(key)) { WARNED.add(key); console.warn(`! pack ${pack.id} (${def.title}): ${gate.warn.length} item${gate.warn.length > 1 ? 's are' : ' is'} not verified and marked checkBeforePrinting. They print anyway; check them first:\n    ${gate.warn.join('\n    ')}`); }
  }
  pack.parts.add(kind);
  return def.consume(data, ctx);
}
const WARNED = new Set();

// Absolute path of a file inside the pack that provides `kind` (the transit feed folder, for example). Null when absent.
export function partPath(ref, kind, rel = '') {
  const pack = loadPack(ref);
  const file = partFile(kind);
  const base = path.join(pack.dir, path.dirname(file) === '.' ? '' : path.dirname(file));
  pack.parts.add(kind);
  const abs = path.join(base, rel || path.basename(file));
  return fs.existsSync(abs) ? abs : null;
}

// Packs this process loaded (the book manifest lists them: id, version, kind, hash, licence, credit, privacy class, parts read).
export const usedPacks = () => [...LOADED.values()].map((p) => ({ id: p.id, title: p.manifest.title, version: p.manifest.version, kind: p.kind, hash: p.hash, privacy: p.privacy, license: p.manifest.license.spdx, attribution: p.manifest.license.attribution, commercialPrintOk: p.manifest.license.commercialPrintOk, author: p.manifest.author.name, parts: [...p.parts].sort() })).sort((a, b) => (a.id < b.id ? -1 : 1));
// A book marked for sale may only use packs whose licence allows commercial print.
export function assertSellable(packs = usedPacks()) {
  const no = packs.filter((p) => !p.commercialPrintOk);
  if (no.length) throw new Error(`This book is marked for sale (book.for_sale) but ${no.map((p) => `"${p.id}" (${p.license})`).join(', ')} ${no.length > 1 ? 'are' : 'is'} not licensed for commercial print. Use another pack or ask its author.`);
}

// ---- checking (packs-cli check) ----
export function checkPack(ref) {
  const errors = [], warnings = [], info = [];
  let dir;
  try { dir = resolveDir(ref); } catch (e) { return { errors: [e.message], warnings, info, id: String(ref) }; }
  let m;
  try { m = readJsonFile(path.join(dir, 'pack.json'), 'pack.json'); } catch (e) { return { errors: [e.message], warnings, info, id: String(ref) }; }
  errors.push(...validateManifest(m).map((x) => `manifest: ${x}`));
  if (!isObj(m) || !str(m.kind)) return { errors, warnings, info, id: m && m.id };
  if (path.basename(dir) !== m.id && ID_RE.test(String(ref))) errors.push(`manifest: the folder "${path.basename(dir)}" and id "${m.id}" must match`);
  let def = null;
  try { def = kindOf(m.kind); } catch (e) { errors.push(e.message); }
  if (Array.isArray(m.files)) {
    errors.push(...fileProblems(dir, m).map((x) => `files: ${x}`));
    const listed = new Set(m.files.map((f) => f.path));
    for (const f of walk(dir)) if (f !== 'pack.json' && !listed.has(f)) warnings.push(`files: ${f} is in the folder but not in pack.json (seal the pack to add it)`);
    if (def) {
      const lim = def.limits || {};
      let total = 0;
      for (const f of m.files) {
        const p = path.join(dir, f.path);
        if (!fs.existsSync(p)) continue;
        const n = fs.statSync(p).size; total += n;
        if (n > (lim.maxFileBytes || 1_000_000)) errors.push(`size: ${f.path} is ${(n / 1024).toFixed(0)} KB, over the ${((lim.maxFileBytes || 1_000_000) / 1024).toFixed(0)} KB limit for ${m.kind} packs`);
      }
      if (total > (lim.maxTotalBytes || 4_000_000)) errors.push(`size: the pack is ${(total / 1024).toFixed(0)} KB, over the ${((lim.maxTotalBytes || 4_000_000) / 1024).toFixed(0)} KB limit for ${m.kind} packs`);
      info.push(`${m.files.length} files, ${(total / 1024).toFixed(0)} KB`);
    }
  }
  if (isObj(m.license) && m.license.commercialPrintOk === false) warnings.push('license: commercialPrintOk is false, so books marked for sale (book.for_sale) refuse this pack');
  if (def) {
    info.push(`privacy class: ${privacyClass(m)}${privacyClass(m) === 'personal' ? ' (never part of a Studio snapshot or a fork)' : ''}`);
    const provided = m.kind === 'region' ? partKinds() : [m.kind];
    let any = false;
    for (const k of provided) {
      const file = partFile(k);
      const abs = path.join(dir, file);
      if (!fs.existsSync(abs)) { if (m.kind !== 'region') errors.push(`${k}: ${file} is missing`); continue; }
      any = true;
      let data;
      try { data = readJsonFile(abs, `${file}`); } catch (e) { errors.push(`${k}: ${e.message}`); continue; }
      const ctx = { pack: m, dir, file };
      const r = kindOf(k).validate(data, ctx);
      errors.push(...r.errors.map((x) => `${k}: ${x}`));
      warnings.push(...(r.warnings || []).map((x) => `${k}: ${x}`));
      const g = kindOf(k).gate ? kindOf(k).gate(data, ctx) : { refuse: [], warn: [] };
      errors.push(...g.refuse.map((x) => `${k}: no verification note (the build refuses to print it): ${x}`));
      warnings.push(...g.warn.map((x) => `${k}: not verified, checkBeforePrinting: ${x}`));
    }
    if (m.kind === 'region' && !any) errors.push('a region pack needs at least one part (support.json, clinic.json, trans.json, gtfs/network.json, seasons.json, holidays.json)');
  }
  return { errors, warnings, info, id: m.id, manifest: m };
}
function walk(dir, base = '') {
  const out = [];
  for (const n of fs.readdirSync(path.join(dir, base)).sort()) {
    const rel = base ? `${base}/${n}` : n;
    if (SEAL_IGNORE.some((re) => re.test(rel))) continue;
    if (fs.statSync(path.join(dir, rel)).isDirectory()) out.push(...walk(dir, rel)); else out.push(rel);
  }
  return out;
}
const SEAL_IGNORE = [/(^|\/)\./, /(^|\/)node_modules(\/|$)/, /\.zip$/, /^gtfs\/[^/]*\.txt$/];

// Recompute `files` (every file in the folder except pack.json) and write pack.json, keeping its own key order.
export function sealPack(ref) {
  const dir = resolveDir(ref);
  const f = path.join(dir, 'pack.json');
  const m = readJsonFile(f, 'pack.json');
  m.files = walk(dir).filter((x) => x !== 'pack.json').map((p) => ({ path: p, sha256: sha256File(path.join(dir, p)) }));
  fs.writeFileSync(f, JSON.stringify(m, null, 1) + '\n');
  LOADED.delete(dir);
  return m;
}
export { KINDS, kindNames };
