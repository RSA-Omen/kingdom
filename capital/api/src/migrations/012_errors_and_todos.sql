CREATE TABLE IF NOT EXISTS errors (
  id TEXT PRIMARY KEY,
  village TEXT NOT NULL,
  message TEXT NOT NULL,
  stack TEXT,
  severity TEXT NOT NULL DEFAULT 'error',
  status TEXT NOT NULL DEFAULT 'open',
  linked_todo_id TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS todos (
  id TEXT PRIMARY KEY,
  village TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'open',
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_errors_village ON errors(village);
CREATE INDEX IF NOT EXISTS idx_errors_status ON errors(status);
CREATE INDEX IF NOT EXISTS idx_errors_created_at ON errors(created_at);
CREATE INDEX IF NOT EXISTS idx_todos_village ON todos(village);
CREATE INDEX IF NOT EXISTS idx_todos_status ON todos(status);
