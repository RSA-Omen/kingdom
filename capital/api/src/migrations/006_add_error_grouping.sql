-- Add error grouping columns
ALTER TABLE log_analyses ADD COLUMN error_hash TEXT;
ALTER TABLE log_analyses ADD COLUMN group_id INTEGER;
ALTER TABLE log_analyses ADD COLUMN occurrence_count INTEGER DEFAULT 1;

-- Create index for grouping
CREATE INDEX IF NOT EXISTS idx_log_analyses_error_hash ON log_analyses(error_hash);
CREATE INDEX IF NOT EXISTS idx_log_analyses_group_id ON log_analyses(group_id);


