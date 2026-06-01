-- Add deduplication columns to errors table.
-- occurrence_count tracks how many times the same open error has been reported.
-- last_seen_at is updated on each duplicate submission.
ALTER TABLE errors ADD COLUMN occurrence_count INTEGER DEFAULT 1;
ALTER TABLE errors ADD COLUMN last_seen_at INTEGER;
