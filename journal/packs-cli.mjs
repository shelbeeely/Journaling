#!/usr/bin/env node
// Content packs from the command line (packs/pack.mjs is the loader, packs/kinds.mjs the registry). See journal/PACKS.md.
//   node packs-cli.mjs list                        installed packs and kinds (a pack folder in packs/, or in a KW_PACKS folder)
//   node packs-cli.mjs new <kind> [id] [--dir d]   start a pack from packs/_template/<kind>/ (default folder packs/<id>)
//   node packs-cli.mjs check <id|folder>           every check: manifest, licence, file hashes, size limits, privacy class, then the kind's validator
//   node packs-cli.mjs seal <id|folder>            recompute the file list and sha256s in pack.json (run after editing a pack file)
//   node packs-cli.mjs kinds                       the registry: each kind's privacy class, data format and how the build uses it
//   node packs-cli.mjs resolve <key>               what the build reads for a profile paths key (support, trans, clinic, seasons, holidays),
//                                                  as JSON (epub.py and the X4 export read packs through this)
//   node packs-cli.mjs path <key> [file]           the absolute path of a pack file for a key (transit: the feed folder file, default network.json)
// `check` exits 1 when anything is wrong. Warnings (unverified items marked checkBeforePrinting, an expired feed) do not fail it.
import fs from 'node:fs';
import path from 'node:path';
import { listPacks, checkPack, sealPack, PACKS_DIR, ID_RE, KINDS, kindNames, privacyClass, packHash } from './packs/pack.mjs';

const args = process.argv.slice(2);
const flag = (n) => { const i = args.indexOf(n); if (i < 0) return null; const v = args[i + 1]; args.splice(i, 2); return v; };
const dirFlag = flag('--dir');
const [cmd, a, b] = args;
const out = (x) => console.log(typeof x === 'string' ? x : JSON.stringify(x, null, 1));
const die = (m) => { console.error(m); process.exit(1); };

if (cmd === 'list') {
  const ps = listPacks();
  console.log(`kinds: ${kindNames().join(', ')}`);
  if (!ps.length) console.log('no packs installed');
  for (const p of ps) {
    const m = p.manifest;
    let cls; try { cls = m && privacyClass(m); } catch { cls = 'unknown kind'; }
    console.log(m ? `${p.id}  ${m.version}  ${m.kind}  ${cls}  ${m.title}` : `${p.id}  (pack.json is not readable: run check)`);
  }
} else if (cmd === 'kinds') {
  for (const [k, d] of Object.entries(KINDS)) console.log(`${k}  [${d.privacy}]\n  format:  ${d.schema}\n  build:   ${d.consumedBy}\n  print:   ${d.print}`);
} else if (cmd === 'check') {
  if (!a) die('usage: node packs-cli.mjs check <pack id or folder>');
  const r = checkPack(a);
  for (const i of r.info) console.log(`  ${i}`);
  for (const w of r.warnings) console.log(`warning: ${w}`);
  for (const e of r.errors) console.log(`ERROR: ${e}`);
  console.log(r.errors.length ? `${r.id || a}: ${r.errors.length} problem${r.errors.length > 1 ? 's' : ''}` : `${r.id || a}: ok${r.warnings.length ? ` (${r.warnings.length} warning${r.warnings.length > 1 ? 's' : ''})` : ''}`);
  process.exit(r.errors.length ? 1 : 0);
} else if (cmd === 'seal') {
  if (!a) die('usage: node packs-cli.mjs seal <pack id or folder>');
  const m = sealPack(a);
  console.log(`${m.id}: sealed ${m.files.length} files (pack hash ${packHash(m).slice(0, 12)})`);
} else if (cmd === 'new') {
  if (!a) die(`usage: node packs-cli.mjs new <kind> [id] [--dir folder]   (kinds: ${kindNames().join(', ')})`);
  if (!Object.prototype.hasOwnProperty.call(KINDS, a)) die(`Unknown pack kind "${a}". Installed kinds: ${kindNames().join(', ')}.`);
  const id = b || `my-${a}`;
  if (!ID_RE.test(id)) die(`"${id}" is not a pack id: lowercase letters, digits and dashes`);
  const tpl = path.join(PACKS_DIR, '_template', a);
  if (!fs.existsSync(tpl)) die(`No template for ${a} (expected packs/_template/${a}/). Every kind needs one: see PACKS.md, "Add a pack kind".`);
  const dest = path.resolve(dirFlag || path.join(PACKS_DIR, id));
  if (fs.existsSync(dest)) die(`${path.relative(process.cwd(), dest) || dest} already exists: pick another id or --dir`);
  fs.cpSync(tpl, dest, { recursive: true });
  const f = path.join(dest, 'pack.json'), m = JSON.parse(fs.readFileSync(f, 'utf8'));
  m.id = id; m.title = m.title.replace(/^Template: /, '') + (b ? '' : ' (edit me)');
  fs.writeFileSync(f, JSON.stringify(m, null, 1) + '\n');
  sealPack(dest);
  console.log(`created ${path.relative(process.cwd(), dest) || dest}. Edit its files, then:\n  node packs-cli.mjs seal ${dirFlag ? dest : id}\n  node packs-cli.mjs check ${dirFlag ? dest : id}\nand name it in content/profile.json under "paths".`);
} else if (cmd === 'resolve' || cmd === 'path') {
  if (!a) die(`usage: node packs-cli.mjs ${cmd} <key>`);
  const P = await import('./profile.mjs');
  if (cmd === 'resolve') out(P.readContent(a) ?? null);
  else { const p = P.packFile(a, b); out(p ? p : ''); }
} else {
  console.log(fs.readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(1, 13).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
  process.exit(cmd ? 1 : 0);
}
