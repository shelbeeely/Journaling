-- Journalwright Studio schema, migration 002 (G2: forks, change proposals, merges).
-- A fork is a project whose source_project_id / source_commit_id (from migration 001) are set. Attribution is stored once at fork time
-- and never edited. Commits are global and shared, so a fork and its source share history (project_commits links the ancestry).

ALTER TABLE projects ADD COLUMN license     TEXT NOT NULL DEFAULT '';     -- terms the creator offers for reuse (plain text, carried into every fork)
ALTER TABLE projects ADD COLUMN credit      TEXT NOT NULL DEFAULT '';     -- how the creator wants to be credited
ALTER TABLE projects ADD COLUMN attribution TEXT;                          -- JSON, set once when the project is a fork; never updated

-- A change proposal lives in the TARGET (upstream) project. The source is a fork of it (or the same project, branch to branch).
CREATE TABLE proposals (
  id                TEXT PRIMARY KEY,
  project_id        TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  number            INTEGER NOT NULL,
  source_project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  source_branch     TEXT NOT NULL,
  target_branch     TEXT NOT NULL,
  title             TEXT NOT NULL,
  description       TEXT NOT NULL DEFAULT '',
  status            TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'changes_requested', 'approved', 'merged', 'closed')),
  reviewed_head     TEXT,                                                  -- the source head a reviewer last looked at
  merged_commit_id  TEXT REFERENCES commits(id),
  created_by        TEXT NOT NULL REFERENCES users(id),
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL,
  UNIQUE (project_id, number)
);

-- The discussion and its audit trail: append-only.
CREATE TABLE proposal_events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  proposal_id TEXT NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL CHECK (kind IN ('comment', 'review', 'status', 'accept', 'merge')),
  user_id     TEXT NOT NULL REFERENCES users(id),
  state       TEXT,                                                         -- review: approved | changes_requested | comment; status: closed | open
  body        TEXT NOT NULL DEFAULT '',
  data        TEXT,                                                         -- JSON (accepted keys, merge commit)
  created_at  TEXT NOT NULL
);

-- Changes accepted one by one (per page or per block) before the whole proposal is merged.
CREATE TABLE proposal_accepts (
  proposal_id TEXT NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  item_key    TEXT NOT NULL,
  commit_id   TEXT NOT NULL REFERENCES commits(id),
  created_at  TEXT NOT NULL,
  PRIMARY KEY (proposal_id, item_key)
);

CREATE INDEX idx_proposals_project ON proposals(project_id, status);
CREATE INDEX idx_proposals_source ON proposals(source_project_id);
CREATE INDEX idx_projects_source ON projects(source_project_id);
CREATE TRIGGER proposal_events_no_update BEFORE UPDATE ON proposal_events BEGIN SELECT RAISE(ABORT, 'the discussion is append-only'); END;
