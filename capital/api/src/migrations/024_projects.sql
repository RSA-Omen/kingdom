-- Projects registry: Asana tasks enrolled as company projects
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  asana_task_gid TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  notes TEXT,
  completed INTEGER NOT NULL DEFAULT 0,
  enrolled_at INTEGER NOT NULL,
  last_synced_at INTEGER,
  asana_modified_at TEXT
);

-- Subtasks: one level deep — phases / milestones
CREATE TABLE IF NOT EXISTS project_subtasks (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  asana_gid TEXT NOT NULL,
  name TEXT NOT NULL,
  completed INTEGER NOT NULL DEFAULT 0,
  due_on TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE(project_id, asana_gid)
);

-- Comments: human comment stories only (type = 'comment')
CREATE TABLE IF NOT EXISTS project_comments (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  asana_gid TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  created_by TEXT,
  text TEXT NOT NULL
);

-- Attachments: files attached to the Asana task
CREATE TABLE IF NOT EXISTS project_attachments (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  asana_gid TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  download_url TEXT,
  view_url TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_project_subtasks_project ON project_subtasks(project_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_project_comments_project ON project_comments(project_id, created_at);
CREATE INDEX IF NOT EXISTS idx_project_attachments_project ON project_attachments(project_id, created_at);
