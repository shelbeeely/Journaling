// Canonical JSON (sorted keys, no whitespace). Pure (no imports) so the editor can inline it next to diff.mjs.
export function canonical(v) {
  if (v === null || typeof v !== 'object') {
    if (v === undefined) throw new Error('canonical: undefined is not JSON');
    if (typeof v === 'number' && !Number.isFinite(v)) throw new Error('canonical: numbers must be finite');
    return JSON.stringify(v);
  }
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  return `{${Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`;
}
