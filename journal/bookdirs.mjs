// Which folders under out/ are built books: a monthly book (m2026-10, m2026-10-letter) or a volume of a book plan (b-year-2026-10-v3,
// b-undated-v1-letter). The gates (check-pages, check-codes, check-handoff) default to all of them.
import fs from 'node:fs';
export const BOOK_DIR = /^(m\d{4}-\d{2}|b-[a-z0-9-]+-v\d+)(-letter)?$/;
export const bookDirs = (root = 'out') => (fs.existsSync(root) ? fs.readdirSync(root).filter((d) => BOOK_DIR.test(d)).sort().map((d) => `${root}/${d}`) : []);
