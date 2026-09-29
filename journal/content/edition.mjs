// Edition number, printed in every page code (KW2|<edition>|<yymm>|<size><page>). It lives in content/profile.json (book.edition):
// bump it there for a new edition (see NEW-EDITION.md).
import { PROFILE } from "../profile.mjs";
export const EDITION = PROFILE.book.edition; // from content/profile.json (book.edition)
