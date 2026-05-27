-- Backup records table
CREATE TABLE IF NOT EXISTS backup_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_name TEXT NOT NULL,
  backup_path TEXT,
  backup_size INTEGER DEFAULT 0,
  backup_type TEXT NOT NULL, -- 'sqlite' or 'postgresql'
  status TEXT NOT NULL, -- 'success' or 'failed'
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Backup reports table
CREATE TABLE IF NOT EXISTS backup_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_date TEXT NOT NULL,
  report_data TEXT NOT NULL, -- JSON string
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(report_date)
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_backup_records_app_date ON backup_records(app_name, created_at);
CREATE INDEX IF NOT EXISTS idx_backup_records_status ON backup_records(status);
CREATE INDEX IF NOT EXISTS idx_backup_reports_date ON backup_reports(report_date);
