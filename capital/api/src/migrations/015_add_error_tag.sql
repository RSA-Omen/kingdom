ALTER TABLE errors ADD COLUMN tag TEXT;
CREATE INDEX IF NOT EXISTS idx_errors_tag ON errors(tag);
