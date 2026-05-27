-- Add error timestamp column for time-based grouping
ALTER TABLE log_analyses ADD COLUMN error_timestamp DATETIME;

-- Create index for time-based queries
CREATE INDEX IF NOT EXISTS idx_log_analyses_error_timestamp ON log_analyses(error_timestamp);


