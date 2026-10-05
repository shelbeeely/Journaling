-- Journalwright Studio schema, migration 003 (G3: releases and reusable pages).

-- A release: a named, numbered, immutable tag on one commit of a project, with notes and a manifest. Never updated; deleted only
-- when its whole project is deleted (the trigger lets the cascade through, and nothing else).
CREATE TABLE releases (
  id              TEXT PRIMARY KEY,
  project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  number          INTEGER NOT NULL,
  name            TEXT NOT NULL COLLATE NOCASE,          -- the tag, e.g. v1.0 or 2027-edition
  notes           TEXT NOT NULL DEFAULT '',
  commit_id       TEXT NOT NULL REFERENCES commits(id),
  tree            TEXT NOT NULL,                         -- the commit's tree hash, kept so a later check can prove the content is the same
  manifest        TEXT NOT NULL,                         -- canonical JSON (see releases.mjs)
  manifest_hash   TEXT NOT NULL,
  created_by      TEXT NOT NULL REFERENCES users(id),
  created_by_name TEXT NOT NULL,
  created_at      TEXT NOT NULL,
  UNIQUE (project_id, number),
  UNIQUE (project_id, name)
);
CREATE INDEX idx_releases_project ON releases(project_id, number);
CREATE TRIGGER releases_no_update BEFORE UPDATE ON releases BEGIN SELECT RAISE(ABORT, 'releases are immutable'); END;
CREATE TRIGGER releases_no_delete BEFORE DELETE ON releases
  WHEN EXISTS (SELECT 1 FROM projects WHERE id = OLD.project_id)
  BEGIN SELECT RAISE(ABORT, 'releases are immutable'); END;

-- A user's library of reusable pages and block layouts. An item has numbered, immutable versions.
CREATE TABLE library_items (
  id          TEXT PRIMARY KEY,
  owner_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL CHECK (kind IN ('page', 'blocks')),
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  visibility  TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'public')),
  license     TEXT NOT NULL DEFAULT '',
  credit      TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
CREATE INDEX idx_library_owner ON library_items(owner_id, updated_at);
CREATE TABLE library_versions (
  item_id      TEXT NOT NULL REFERENCES library_items(id) ON DELETE CASCADE,
  version      INTEGER NOT NULL,
  content      TEXT NOT NULL,                            -- canonical JSON: {type, options} for a page, {blocks} for a block layout
  content_hash TEXT NOT NULL,
  note         TEXT NOT NULL DEFAULT '',
  source       TEXT,                                     -- JSON {project, projectName, commit} when copied out of a project
  created_by   TEXT NOT NULL REFERENCES users(id),
  created_at   TEXT NOT NULL,
  PRIMARY KEY (item_id, version)
);
CREATE TRIGGER library_versions_no_update BEFORE UPDATE ON library_versions BEGIN SELECT RAISE(ABORT, 'library versions are immutable'); END;
CREATE TRIGGER library_versions_no_delete BEFORE DELETE ON library_versions
  WHEN EXISTS (SELECT 1 FROM library_items WHERE id = OLD.item_id)
  BEGIN SELECT RAISE(ABORT, 'library versions are immutable'); END;

-- Where a library version was copied into a project: the attribution and the version link. It keeps its own copy of the credit
-- (name, owner, license) so the attribution survives the item being deleted. item_id is deliberately not a foreign key.
CREATE TABLE reuse_links (
  id           TEXT PRIMARY KEY,
  project_id   TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  item_id      TEXT NOT NULL,
  version      INTEGER NOT NULL,
  content_hash TEXT NOT NULL,
  kind         TEXT NOT NULL,
  item_name    TEXT NOT NULL,
  owner_name   TEXT NOT NULL,
  license      TEXT NOT NULL DEFAULT '',
  credit       TEXT NOT NULL DEFAULT '',
  target       TEXT NOT NULL,                            -- JSON: {scope, pageId} or {uids: [...]}
  commit_id    TEXT NOT NULL REFERENCES commits(id),
  inserted_by  TEXT NOT NULL REFERENCES users(id),
  created_at   TEXT NOT NULL
);
CREATE INDEX idx_reuse_project ON reuse_links(project_id, created_at);
CREATE INDEX idx_reuse_item ON reuse_links(item_id);
