// Brings the table part of en.json (block., care., preset., pagekind., method., scan. keys) in line with the code tables that own the words.
//   node i18n/sync-tables.mjs           rewrite en.json
//   node i18n/sync-tables.mjs --check   exit 1 when en.json is out of date (test-i18n.mjs runs the same check)
// Run it after adding a block, an option, a method layout or a scan choice. The keys are the ones the editor looks up at run time.
import fs from 'node:fs';
import { TYPES, PRESETS, CARE_ROWS, ROW_OPTS, PAGE_KINDS } from '../daypage.mjs';
import { METHOD_LAYOUTS } from '../content/layouts.mjs';
import { CODE_POSITIONS, CODE_SIZES, CODE_FORMATS, CODE_CONTENTS } from '../scan.mjs';
import { MODULES } from '../modules.mjs';
import { COVER_STYLES } from '../library.mjs';
import { tableStrings } from './tables.mjs';

export const TABLE_PREFIXES = ['block.', 'care.', 'preset.', 'pagekind.', 'method.', 'scan.', 'lib.module_', 'lib.cover_'];
export const tables = () => tableStrings({ TYPES, PRESETS, CARE_ROWS, ROW_OPTS, PAGE_KINDS, METHOD_LAYOUTS, CODE_POSITIONS, CODE_SIZES, CODE_FORMATS, CODE_CONTENTS, MODULES, COVER_STYLES });
const EN = new URL('./en.json', import.meta.url);
export const sortKeys = (o) => Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]]));
export function synced(en) {
  const keep = Object.fromEntries(Object.entries(en).filter(([k]) => !TABLE_PREFIXES.some((p) => k.startsWith(p))));
  return sortKeys({ ...keep, ...tables().strings });
}
if (process.argv[1] && new URL(import.meta.url).pathname === fs.realpathSync(process.argv[1])) {
  const en = JSON.parse(fs.readFileSync(EN, 'utf8')), next = JSON.stringify(synced(en), null, 1) + '\n';
  if (process.argv.includes('--check')) { if (next !== fs.readFileSync(EN, 'utf8')) { console.error('en.json is out of date: run node i18n/sync-tables.mjs'); process.exit(1); } console.log('en.json table keys are up to date'); }
  else { fs.writeFileSync(EN, next); console.log('en.json:', Object.keys(JSON.parse(next)).length, 'messages'); }
}
