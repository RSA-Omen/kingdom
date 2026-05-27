-- Log analyses table for Log Guru feature
CREATE TABLE IF NOT EXISTS log_analyses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    app_id INTEGER REFERENCES apps(id) ON DELETE CASCADE,
    app_slug TEXT NOT NULL,
    error_log TEXT NOT NULL,
    context_before TEXT, -- Log lines before the error
    context_after TEXT, -- Log lines after the error
    analysis_summary TEXT, -- AI-generated summary
    analysis_fix TEXT, -- AI-generated fix
    is_real_issue INTEGER DEFAULT 0, -- 0 = unknown, 1 = real issue, 2 = false positive
    user_notes TEXT, -- User-added notes
    analyzed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    marked_at DATETIME, -- When user marked as real issue/false positive
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_log_analyses_app_id ON log_analyses(app_id);
CREATE INDEX IF NOT EXISTS idx_log_analyses_app_slug ON log_analyses(app_slug);
CREATE INDEX IF NOT EXISTS idx_log_analyses_analyzed_at ON log_analyses(analyzed_at);
CREATE INDEX IF NOT EXISTS idx_log_analyses_is_real_issue ON log_analyses(is_real_issue);


