-- Add health_check_interval_seconds column to apps table
-- This allows each app to have its own health check interval
-- If NULL, uses the global HEALTH_CHECK_INTERVAL environment variable
ALTER TABLE apps ADD COLUMN health_check_interval_seconds INTEGER;



