-- Lord Chamberlain processed-task tracking
CREATE TABLE IF NOT EXISTS lord_chamberlain_processed (
  task_gid        TEXT PRIMARY KEY,
  processed_at    INTEGER NOT NULL,
  classification  TEXT,
  confidence      TEXT,
  github_issue_url TEXT,
  retriage_count  INTEGER NOT NULL DEFAULT 0
);
