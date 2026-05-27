-- Retroactively reclassify errors that are actually INFO messages from Gunicorn/apps
-- that log all levels at syslog level 3 (ERROR)
UPDATE errors SET severity = 'info'
WHERE message LIKE '%[INFO]%' AND severity = 'error';

UPDATE errors SET severity = 'warning'
WHERE message LIKE '%[WARNING]%' AND severity = 'error';

UPDATE errors SET severity = 'warning'
WHERE message LIKE '%[WARN]%' AND severity = 'error';

UPDATE errors SET severity = 'critical'
WHERE (message LIKE '%[CRITICAL]%' OR message LIKE '%[EMERG]%' OR message LIKE '%[ALERT]%')
AND severity = 'error';

-- Index for faster severity filtering
CREATE INDEX IF NOT EXISTS idx_errors_severity ON errors(severity);
