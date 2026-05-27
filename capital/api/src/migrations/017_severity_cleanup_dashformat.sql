-- Fix messages using "- INFO -" / "- WARNING -" dash format (e.g. Gunicorn, Python logging)
-- that were missed by migration 016 which only checked for [INFO] bracket format

UPDATE errors SET severity = 'info'
WHERE severity = 'error'
  AND (message LIKE '% - INFO - %' OR message LIKE '% - DEBUG - %' OR message LIKE '% - NOTICE - %');

UPDATE errors SET severity = 'warning'
WHERE severity = 'error'
  AND (message LIKE '% - WARNING - %' OR message LIKE '% - WARN - %');

UPDATE errors SET severity = 'critical'
WHERE severity = 'error'
  AND (message LIKE '% - CRITICAL - %' OR message LIKE '% - EMERG - %' OR message LIKE '% - ALERT - %');
