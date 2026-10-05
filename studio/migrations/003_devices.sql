-- Journalwright Studio schema, migration 003 (N2: X4 device sync).
-- A device is the user's own X4, paired with ONE account. Its token is a separate credential from a sign-in session: it is stored only
-- as a sha256, it can be revoked at any time, and the server accepts it only on /api/device/*. The check-in log a device uploads lives in
-- its own tables, apart from `objects` (the snapshot store): a log is health data, never part of a project, a snapshot, a fork or an export.

CREATE TABLE devices (
  id           TEXT PRIMARY KEY,                                  -- 12 hex characters, shown in the Studio and inside the token
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  token_hash   TEXT NOT NULL UNIQUE,                              -- sha256 of the token; the token itself is shown once, never stored
  scope        TEXT NOT NULL DEFAULT 'log:write' CHECK (scope IN ('log:write')),
  created_at   TEXT NOT NULL,
  last_used_at TEXT,
  revoked_at   TEXT
);
CREATE INDEX devices_user ON devices(user_id);

-- One row per month log a device has uploaded. The body is append-only text (the device's /kw/log/YYYY-MM.csv), kept as bytes.
CREATE TABLE device_logs (
  device_id  TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  month      TEXT NOT NULL CHECK (month GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]'),
  body       BLOB NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (device_id, month)
);

-- What happened to a device, append-only: no log content, no token, no address.
CREATE TABLE device_audit (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  at        TEXT NOT NULL,
  action    TEXT NOT NULL CHECK (action IN ('created', 'revoked', 'upload', 'rejected', 'logs_deleted')),
  detail    TEXT NOT NULL DEFAULT ''
);
CREATE INDEX device_audit_device ON device_audit(device_id, id);
