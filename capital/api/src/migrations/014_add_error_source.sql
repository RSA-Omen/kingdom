ALTER TABLE errors ADD COLUMN source TEXT;
CREATE INDEX IF NOT EXISTS idx_errors_source ON errors(source);
