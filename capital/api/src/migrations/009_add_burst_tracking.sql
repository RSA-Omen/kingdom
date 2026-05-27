-- Add burst tracking columns
ALTER TABLE log_analyses ADD COLUMN first_occurrence_time DATETIME;
ALTER TABLE log_analyses ADD COLUMN last_occurrence_time DATETIME;
ALTER TABLE log_analyses ADD COLUMN burst_count INTEGER DEFAULT 0; -- Number of times it happened in bursts


