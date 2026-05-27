-- Add execution tier to todos for the Executor pipeline.
-- 0 = autonomous (safe, no approval), 1 = approval required, 2 = manual only, NULL = unclassified.
ALTER TABLE todos ADD COLUMN tier INTEGER;
CREATE INDEX IF NOT EXISTS idx_todos_tier ON todos(tier);
