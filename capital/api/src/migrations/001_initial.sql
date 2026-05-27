-- Apps table
CREATE TABLE IF NOT EXISTS apps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    container_name TEXT UNIQUE,
    compose_file_path TEXT,
    project_type TEXT,
    status TEXT DEFAULT 'active',
    health_endpoint TEXT,
    health_port INTEGER,
    main_port INTEGER,
    repository_url TEXT,
    documentation_url TEXT,
    owner TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_health_check DATETIME,
    last_health_status TEXT,
    adoption_metrics TEXT, -- JSON
    metadata TEXT, -- JSON
    manual_time_seconds INTEGER,
    automation_time_seconds INTEGER
);

-- Health history table
CREATE TABLE IF NOT EXISTS health_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    app_id INTEGER REFERENCES apps(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    response_time_ms INTEGER,
    checked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    error_message TEXT
);

-- Events table
CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    app_id INTEGER REFERENCES apps(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    metadata TEXT -- JSON
);

-- Usage events table
CREATE TABLE IF NOT EXISTS usage_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    app_id INTEGER REFERENCES apps(id) ON DELETE CASCADE,
    app_slug TEXT NOT NULL,
    timestamp DATETIME NOT NULL,
    user TEXT,
    action TEXT,
    source TEXT NOT NULL,
    duration_ms INTEGER,
    metadata TEXT, -- JSON
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Usage aggregates table (materialized view/cache)
CREATE TABLE IF NOT EXISTS usage_aggregates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    app_id INTEGER REFERENCES apps(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    hour INTEGER, -- NULL for daily aggregates
    total_events INTEGER DEFAULT 0,
    unique_users INTEGER DEFAULT 0,
    total_duration_ms INTEGER DEFAULT 0,
    avg_duration_ms REAL,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(app_id, date, hour)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_apps_slug ON apps(slug);
CREATE INDEX IF NOT EXISTS idx_apps_status ON apps(status);
CREATE INDEX IF NOT EXISTS idx_health_history_app_id ON health_history(app_id);
CREATE INDEX IF NOT EXISTS idx_health_history_checked_at ON health_history(checked_at);
CREATE INDEX IF NOT EXISTS idx_events_app_id ON events(app_id);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at);
CREATE INDEX IF NOT EXISTS idx_usage_events_app_id ON usage_events(app_id);
CREATE INDEX IF NOT EXISTS idx_usage_events_app_slug ON usage_events(app_slug);
CREATE INDEX IF NOT EXISTS idx_usage_events_timestamp ON usage_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_usage_aggregates_app_id ON usage_aggregates(app_id);
CREATE INDEX IF NOT EXISTS idx_usage_aggregates_date ON usage_aggregates(date);

