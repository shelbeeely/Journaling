// Sample pages for the editor: every page type of the book, built by the same pages.mjs the print build uses, from the
// generic sample calendar (test.ics), never a private one. The editor's page canvas draws these; the smoke test checks them.
import { loadContext } from '../context.mjs';
import { assemble, DEFAULT_BOOK } from '../book.mjs';
import { PAGE_TYPES } from '../pages.mjs';
import { firstMonthId } from '../profile.mjs';

export async function samplePages(month = firstMonthId()) {
  const ctx = await loadContext({ month, ics: 'test.ics', size: 'small', quiet: true });
  ctx.CLINIC = null; // a real clinic's details do not belong in a public editor
  ctx.keeperPage = undefined; // the Keeper's page numbers are per person
  const { pages, refs } = assemble(ctx, DEFAULT_BOOK.default);
  const seen = new Set();
  // one entry per page of the sample book, plus which page type made it (a type can make several pages)
  const out = pages.map((p, i) => ({ n: i + 1, id: p.id, type: p.type, label: p.label, shared: p.shared, section: p.section, cls: p.cls, html: p.html }));
  for (const p of out) seen.add(p.type);
  return { month, refs, types: Object.entries(PAGE_TYPES).map(([k, t]) => ({ key: k, name: t.name, scope: t.scope, protected: !!t.protected })), pages: out };
}
