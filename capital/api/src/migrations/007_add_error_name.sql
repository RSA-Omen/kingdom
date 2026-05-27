-- Add error name/title column
ALTER TABLE log_analyses ADD COLUMN error_name TEXT;

-- Create index for searching by name
CREATE INDEX IF NOT EXISTS idx_log_analyses_error_name ON log_analyses(error_name);


