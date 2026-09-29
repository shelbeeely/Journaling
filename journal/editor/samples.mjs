// Sample pages for the editor: every page type of the book, built by the same pages.mjs the print build uses, from the
// generic sample calendar (test.ics), never a private one. The editor's page canvas draws these; the smoke test checks them.
import { loadContext, loadBook } from '../context.mjs';
import { assemble, DEFAULT_BOOK } from '../book.mjs';
import { PAGE_TYPES } from '../pages.mjs';
import { firstMonthId } from '../profile.mjs';

const fresh = async (month) => {
  const ctx = await loadContext({ month, ics: 'test.ics', size: 'small', quiet: true });
  ctx.CLINIC = null; // a real clinic's details do not belong in a public editor
  ctx.keeperPage = undefined; // the Keeper's page numbers are per person
  return ctx;
};
const allOn = (list) => list.map((e) => ({ ...e, on: true, ...(e.options && e.type === 'weeks' ? { options: { month: allOn(e.options.month || []), week: allOn(e.options.week || []) } } : {}) }));

// The sample book follows content/book.json (else DEFAULT_BOOK). Pages the book hides are listed apart in `hidden` (one per
// hidden entry, the first page it would make), so the canvas can show them dimmed.
export async function samplePages(month = firstMonthId(), bookIn = null) {
  const book = bookIn || loadBook() || DEFAULT_BOOK;
  const { pages, refs } = assemble(await fresh(month), book.default);
  const shown = new Set(pages.map((p) => p.id));
  const full = assemble(await fresh(month), allOn(book.default)).pages;
  const seenType = new Set(), hiddenPages = [];
  for (const p of full) if (!shown.has(p.id) && !p.id.startsWith('notes.') && !seenType.has(p.type)) { seenType.add(p.type); hiddenPages.push(p); }
  const shape = (p, i) => ({ n: i + 1, id: p.id, type: p.type, label: p.label, shared: p.shared, section: p.section, cls: p.cls, protected: !!(PAGE_TYPES[p.type] || {}).protected, html: p.html });
  return { month, refs, types: Object.entries(PAGE_TYPES).map(([k, t]) => ({ key: k, name: t.name, scope: t.scope, protected: !!t.protected })), pages: pages.map(shape), hidden: hiddenPages.map((p) => ({ ...shape(p, 0), n: 0, hidden: true })) };
}
