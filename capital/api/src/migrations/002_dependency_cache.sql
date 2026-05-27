-- Dependency cache table for storing daily dependency summaries
CREATE TABLE IF NOT EXISTS dependency_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cached_at DATETIME NOT NULL,
    data TEXT NOT NULL, -- JSON
    total_vulnerabilities INTEGER DEFAULT 0,
    critical_vulnerabilities INTEGER DEFAULT 0,
    high_vulnerabilities INTEGER DEFAULT 0,
    medium_vulnerabilities INTEGER DEFAULT 0,
    low_vulnerabilities INTEGER DEFAULT 0,
    total_projects INTEGER DEFAULT 0
);

-- Index for quick lookup of latest cache
CREATE INDEX IF NOT EXISTS idx_dependency_cache_cached_at ON dependency_cache(cached_at DESC);








