-- Journalwright Studio schema, migration 005 (decision fatigue: remembered choices).
-- What a person chose for their last book (answers, length, modules, day layout blocks), so a new book can start from it. Choices only:
-- the server runs the same cleaner as the editor (journal/presets.mjs cleanLast) before it stores anything, so there is no title, calendar,
-- profile field, pack or page here. It belongs to the account, is never part of a project or snapshot, and is deleted with the user.
CREATE TABLE user_prefs (
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key        TEXT NOT NULL CHECK (key IN ('startFrom')),
  value      TEXT NOT NULL,                                       -- JSON, at most 16000 characters
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, key)
);
