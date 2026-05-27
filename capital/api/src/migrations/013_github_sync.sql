-- Add columns for GitHub Issues sync
ALTER TABLE todos ADD COLUMN external_url TEXT;
ALTER TABLE todos ADD COLUMN external_state TEXT;

-- Index for fast source lookups during upsert
CREATE INDEX IF NOT EXISTS idx_todos_source ON todos(source);

-- Track sync runs for observability and "last synced" UI
CREATE TABLE IF NOT EXISTS github_sync_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at INTEGER NOT NULL,
  finished_at INTEGER,
  trigger TEXT NOT NULL,
  repos_synced INTEGER DEFAULT 0,
  issues_imported INTEGER DEFAULT 0,
  issues_updated INTEGER DEFAULT 0,
  issues_closed INTEGER DEFAULT 0,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_github_sync_runs_started_at ON github_sync_runs(started_at);
