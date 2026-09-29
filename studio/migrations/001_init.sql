-- Journalwright Studio schema, migration 001 (G1: accounts, projects, commits, branches, drafts, assets).
-- Reserved for G2/G3 and left unused for now: projects.source_*, commits.source_*, the components tables.

CREATE TABLE users (
  id            TEXT PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE COLLATE NOCASE,
  display_name  TEXT NOT NULL,
  password_hash TEXT NOT NULL,                 -- scrypt$N$r$p$salt$hash (never the password)
  created_at    TEXT NOT NULL
);

CREATE TABLE sessions (
  token_hash   TEXT PRIMARY KEY,               -- sha256 of the bearer token; the token itself is never stored
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at   TEXT NOT NULL,
  expires_at   TEXT NOT NULL,
  last_used_at TEXT NOT NULL
);

CREATE TABLE projects (
  id                TEXT PRIMARY KEY,
  slug              TEXT NOT NULL UNIQUE,
  name              TEXT NOT NULL,
  description       TEXT NOT NULL DEFAULT '',
  visibility        TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'public')),
  allow_reuse       INTEGER NOT NULL DEFAULT 0 CHECK (allow_reuse IN (0, 1)),   -- creator opts in to forks/reuse (G2)
  default_branch    TEXT NOT NULL DEFAULT 'main',
  source_project_id TEXT REFERENCES projects(id),   -- G2: the project this one was forked from
  source_commit_id  TEXT,                            -- G2: the commit it was forked at
  created_by        TEXT NOT NULL REFERENCES users(id),
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);

CREATE TABLE memberships (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')),
  created_at TEXT NOT NULL,
  PRIMARY KEY (project_id, user_id)
);

-- Content-addressed snapshot parts and trees. hash = sha256 of the canonical JSON of body. Never updated, never deleted.
CREATE TABLE objects (
  hash TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('meta', 'print', 'book', 'day', 'assets', 'components', 'tree')),
  body TEXT NOT NULL,
  size INTEGER NOT NULL
);

-- Immutable. id = sha256 of the canonical JSON of {v, tree, parents, author, message, timestamp}.
-- parents is a JSON array (empty for the first commit, two entries for a merge in G2).
CREATE TABLE commits (
  id                TEXT PRIMARY KEY,
  tree              TEXT NOT NULL REFERENCES objects(hash),
  parents           TEXT NOT NULL,
  author_id         TEXT NOT NULL REFERENCES users(id),
  author_name       TEXT NOT NULL,
  message           TEXT NOT NULL,
  created_at        TEXT NOT NULL,
  source_project_id TEXT,                      -- G2: set on the first commit of a fork
  source_commit_id  TEXT
);

-- Which commits a project holds. A commit row is global and shared (a fork keeps the same commit ids), so membership is a link.
CREATE TABLE project_commits (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  commit_id  TEXT NOT NULL REFERENCES commits(id),
  PRIMARY KEY (project_id, commit_id)
);

CREATE TABLE branches (
  project_id     TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  head_commit_id TEXT NOT NULL REFERENCES commits(id),
  created_by     TEXT NOT NULL REFERENCES users(id),
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL,
  PRIMARY KEY (project_id, name)
);

-- Autosave: one per user and branch, distinct from commits. base = the commit the draft started from; rev = optimistic-concurrency counter.
CREATE TABLE drafts (
  project_id     TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  branch         TEXT NOT NULL,
  base_commit_id TEXT NOT NULL REFERENCES commits(id),
  snapshot       TEXT NOT NULL,
  rev            INTEGER NOT NULL,
  updated_at     TEXT NOT NULL,
  PRIMARY KEY (project_id, user_id, branch)
);

-- Content-addressed per project; read only through routes that check the project's access.
CREATE TABLE assets (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  hash       TEXT NOT NULL,                    -- sha256 of the bytes
  name       TEXT NOT NULL,
  mime       TEXT NOT NULL,
  size       INTEGER NOT NULL,
  data       BLOB NOT NULL,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  PRIMARY KEY (project_id, hash)
);

-- G3 (reusable pages): a component has versions; a version points at an object and the commit that made it. Unused in G1.
CREATE TABLE components (
  id         TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  key        TEXT NOT NULL,
  name       TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (project_id, key)
);
CREATE TABLE component_versions (
  component_id TEXT NOT NULL REFERENCES components(id) ON DELETE CASCADE,
  version      INTEGER NOT NULL,
  object_hash  TEXT NOT NULL REFERENCES objects(hash),
  commit_id    TEXT REFERENCES commits(id),
  created_at   TEXT NOT NULL,
  PRIMARY KEY (component_id, version)
);

CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_memberships_user ON memberships(user_id);
CREATE INDEX idx_project_commits_commit ON project_commits(commit_id);

CREATE TRIGGER commits_no_update BEFORE UPDATE ON commits BEGIN SELECT RAISE(ABORT, 'commits are immutable'); END;
CREATE TRIGGER commits_no_delete BEFORE DELETE ON commits BEGIN SELECT RAISE(ABORT, 'commits are immutable'); END;
CREATE TRIGGER objects_no_update BEFORE UPDATE ON objects BEGIN SELECT RAISE(ABORT, 'objects are immutable'); END;
CREATE TRIGGER objects_no_delete BEFORE DELETE ON objects BEGIN SELECT RAISE(ABORT, 'objects are immutable'); END;
