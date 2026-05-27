CREATE TABLE IF NOT EXISTS checkpoint_events (
  id TEXT PRIMARY KEY,
  village TEXT NOT NULL,
  repo_path TEXT NOT NULL,
  branch TEXT NOT NULL,
  commit_sha TEXT NOT NULL,
  summary TEXT NOT NULL,
  body TEXT,
  files_changed INTEGER NOT NULL DEFAULT 0,
  pushed INTEGER NOT NULL DEFAULT 0,
  remote_url TEXT,
  metadata TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_checkpoint_events_village ON checkpoint_events(village);
CREATE INDEX IF NOT EXISTS idx_checkpoint_events_created_at ON checkpoint_events(created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_checkpoint_events_commit_sha ON checkpoint_events(village, commit_sha);
