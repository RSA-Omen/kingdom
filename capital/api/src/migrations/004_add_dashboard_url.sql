-- Add dashboard_url column to apps table
-- This allows each app to have a configurable dashboard URL for navigation
ALTER TABLE apps ADD COLUMN dashboard_url TEXT;

