// The book plan as data and as words: `node render.mjs plan` prints it, the studio can show it before printing.
import { rangeLabel, MAX_PAGES, HARDCOVER_MIN, PAPERBACK_MIN } from './plan.mjs';
import { dayIso } from './span.mjs';
import { PROFILE } from './profile.mjs';

export function describePlan(span, res) {
  const { plan, full } = span;
  const undated = plan.scope === 'undated';
  const idBase = `${undated ? 'undated' : `${plan.scope}-${plan.start.slice(0, 7)}`}-${(PROFILE.book.id || 'new').toLowerCase()}`;
  const volumes = res.volumes.map((v) => {
    const first = undated ? null : dayIso(full.days[v.a]), last = undated ? null : dayIso(full.days[v.b - 1]);
    return {
      id: `${idBase}-v${v.n}`, n: v.n, of: v.of, days: v.b - v.a, pages: v.pages, first, last, label: undated ? `days ${full.days[v.a].no}–${full.days[v.b - 1].no}` : rangeLabel(first, last),
      ...(undated ? { day_from: full.days[v.a].no, day_to: full.days[v.b - 1].no } : {}), cut_after: v.cutKind, // 'month' | 'week' | null (the last volume)
    };
  });
  return {
    scope: plan.scope, start: plan.start, end: plan.end, days: plan.days, keeper: plan.keeper, closing: plan.closing, ...(undated ? { undated: plan.undated } : {}),
    hardcover: res.hardcover, limit: res.limit, pages_as_one_book: res.total, split: volumes.length > 1, volumes, why: res.why,
  };
}

export function printPlan(d) {
  const out = [];
  const span = d.scope === 'undated' ? `undated: ${d.undated.days} day pages, ${d.undated.weeks} weeks, ${d.undated.months} months${d.undated.extras.length ? `, extras: ${d.undated.extras.join(', ')}` : ''}` : `${d.scope}, ${rangeLabel(d.start, d.end)} (${d.days} days)`;
  out.push(`Book plan: ${span}`);
  out.push(`  keeper: ${d.keeper} · closing page: ${d.closing === 'month' ? 'after each month' : 'once at the end of each volume'} · ${d.hardcover ? `hardcover (${HARDCOVER_MIN}–${MAX_PAGES} pages, shorter volumes are padded with Notes pages)` : `paperback (${PAPERBACK_MIN}–${MAX_PAGES} pages)`}`);
  out.push(`  as one book: ${d.pages_as_one_book} pages${d.split ? ` -> ${d.volumes.length} volumes` : ' (fits)'}`);
  for (const v of d.volumes) out.push(`  ${v.id.padEnd(22)} ${(d.scope === 'undated' ? `days ${String(v.day_from).padStart(3)}–${String(v.day_to).padEnd(3)}` : `${v.first} → ${v.last}`).padEnd(25)} ${String(v.days).padStart(3)} days  ${String(v.pages).padStart(3)} pages${v.cut_after ? `  (cut on a ${v.cut_after} boundary)` : ''}`);
  out.push(`  why: ${d.why}`);
  return out.join('\n');
}
