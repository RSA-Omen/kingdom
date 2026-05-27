-- Re-register PDF Removal app for Admin Center monitoring if missing
INSERT INTO apps (
    name,
    slug,
    description,
    container_name,
    project_type,
    status,
    health_endpoint,
    health_port,
    main_port
)
SELECT
    'PDF Removal',
    'pdf-removal-api',
    'PDF page removal automation API',
    'pdf-removal-api',
    'automation',
    'active',
    '/api/health',
    5007,
    5007
WHERE NOT EXISTS (
    SELECT 1 FROM apps WHERE slug = 'pdf-removal-api'
);
