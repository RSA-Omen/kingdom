import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { existsSync, mkdirSync } from 'fs';

export interface App {
  id?: number;
  name: string;
  slug: string;
  description?: string;
  container_name?: string;
  compose_file_path?: string;
  project_type?: string;
  status?: string;
  health_endpoint?: string;
  health_port?: number;
  main_port?: number;
  repository_url?: string;
  documentation_url?: string;
  dashboard_url?: string;
  owner?: string;
  created_at?: string;
  updated_at?: string;
  last_health_check?: string;
  last_health_status?: string;
  adoption_metrics?: any;
  metadata?: any;
  manual_time_seconds?: number;
  automation_time_seconds?: number;
  health_check_interval_seconds?: number;
}

export interface HealthHistory {
  id?: number;
  app_id: number;
  status: string;
  response_time_ms?: number;
  checked_at?: string;
  error_message?: string;
}

export interface Event {
  id?: number;
  app_id: number;
  event_type: string;
  message?: string;
  created_at?: string;
  metadata?: any;
}

export interface UsageEvent {
  id?: number;
  app_id: number;
  app_slug: string;
  timestamp: string;
  user?: string;
  action?: string;
  source: string;
  duration_ms?: number;
  metadata?: any;
  created_at?: string;
}

export interface UsageAggregate {
  id?: number;
  app_id: number;
  date: string;
  hour?: number;
  total_events: number;
  unique_users: number;
  total_duration_ms: number;
  avg_duration_ms?: number;
  last_updated?: string;
}

class DatabaseService {
  private db: Database.Database;

  constructor() {
    const dbPath = process.env.DB_PATH || join(process.cwd(), '..', 'data', 'app-registry.db');
    const dbDir = dirname(dbPath);
    
    // Create directory if it doesn't exist
    if (!existsSync(dbDir)) {
      mkdirSync(dbDir, { recursive: true });
    }
    
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
  }

  getDb(): Database.Database {
    return this.db;
  }

  // Apps CRUD
  createApp(app: App): App {
    const stmt = this.db.prepare(`
      INSERT INTO apps (
        name, slug, description, container_name, compose_file_path,
        project_type, status, health_endpoint, health_port, main_port,
        repository_url, documentation_url, dashboard_url, owner, adoption_metrics, metadata,
        manual_time_seconds, automation_time_seconds, health_check_interval_seconds
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(
      app.name,
      app.slug,
      app.description || null,
      app.container_name || null,
      app.compose_file_path || null,
      app.project_type || null,
      app.status || 'active',
      app.health_endpoint || null,
      app.health_port || null,
      app.main_port || null,
      app.repository_url || null,
      app.documentation_url || null,
      app.dashboard_url || null,
      app.owner || null,
      app.adoption_metrics ? JSON.stringify(app.adoption_metrics) : null,
      app.metadata ? JSON.stringify(app.metadata) : null,
      app.manual_time_seconds || null,
      app.automation_time_seconds || null,
      app.health_check_interval_seconds || null
    );

    return this.getAppById(result.lastInsertRowid as number)!;
  }

  getAppById(id: number): App | null {
    const stmt = this.db.prepare('SELECT * FROM apps WHERE id = ?');
    const row = stmt.get(id) as any;
    if (!row) return null;
    return this.parseApp(row);
  }

  getAppBySlug(slug: string): App | null {
    const stmt = this.db.prepare('SELECT * FROM apps WHERE slug = ?');
    const row = stmt.get(slug) as any;
    if (!row) return null;
    return this.parseApp(row);
  }

  getAllApps(filters?: { status?: string; type?: string; search?: string }): App[] {
    try {
      let query = 'SELECT * FROM apps WHERE 1=1';
      const params: any[] = [];

      if (filters?.status) {
        query += ' AND status = ?';
        params.push(filters.status);
      }
      if (filters?.type) {
        query += ' AND project_type = ?';
        params.push(filters.type);
      }
      if (filters?.search) {
        query += ' AND (name LIKE ? OR description LIKE ? OR slug LIKE ?)';
        const searchTerm = `%${filters.search}%`;
        params.push(searchTerm, searchTerm, searchTerm);
      }

      query += ' ORDER BY name ASC';

      const stmt = this.db.prepare(query);
      const rows = stmt.all(...params) as any[];
      return rows.map(row => this.parseApp(row));
    } catch (error: any) {
      // If the apps table doesn't exist yet (fresh / corrupted DB), return empty list
      if (error?.message?.includes('no such table')) {
        console.warn('apps table does not exist yet, returning empty app list');
        return [];
      }
      console.error('Error in getAllApps:', error);
      throw error;
    }
  }

  updateApp(slug: string, updates: Partial<App>): App | null {
    const fields: string[] = [];
    const values: any[] = [];

    Object.entries(updates).forEach(([key, value]) => {
      if (key === 'id' || key === 'created_at') return;
      if (key === 'adoption_metrics' || key === 'metadata') {
        fields.push(`${key} = ?`);
        values.push(value ? JSON.stringify(value) : null);
      } else {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    });

    if (fields.length === 0) return this.getAppBySlug(slug);

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(slug);

    const stmt = this.db.prepare(`UPDATE apps SET ${fields.join(', ')} WHERE slug = ?`);
    stmt.run(...values);

    return this.getAppBySlug(slug);
  }

  deleteApp(slug: string): boolean {
    const stmt = this.db.prepare('DELETE FROM apps WHERE slug = ?');
    const result = stmt.run(slug);
    return result.changes > 0;
  }

  // Health History
  addHealthHistory(history: HealthHistory): HealthHistory {
    const stmt = this.db.prepare(`
      INSERT INTO health_history (app_id, status, response_time_ms, checked_at, error_message)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      history.app_id,
      history.status,
      history.response_time_ms || null,
      history.checked_at || new Date().toISOString(),
      history.error_message || null
    );
    return { ...history, id: result.lastInsertRowid as number };
  }

  getHealthHistory(appId: number, since?: string, limit?: number): HealthHistory[] {
    let query = 'SELECT * FROM health_history WHERE app_id = ?';
    const params: any[] = [appId];

    if (since) {
      query += ' AND checked_at >= ?';
      params.push(since);
    }

    query += ' ORDER BY checked_at DESC';

    if (limit) {
      query += ' LIMIT ?';
      params.push(limit);
    }

    const stmt = this.db.prepare(query);
    return stmt.all(...params) as HealthHistory[];
  }

  // Events
  addEvent(event: Event): Event {
    const stmt = this.db.prepare(`
      INSERT INTO events (app_id, event_type, message, metadata)
      VALUES (?, ?, ?, ?)
    `);
    const result = stmt.run(
      event.app_id,
      event.event_type,
      event.message || null,
      event.metadata ? JSON.stringify(event.metadata) : null
    );
    return { ...event, id: result.lastInsertRowid as number };
  }

  getEvents(appId?: number, limit?: number): Event[] {
    try {
      let query = 'SELECT * FROM events';
      const params: any[] = [];

      if (appId) {
        query += ' WHERE app_id = ?';
        params.push(appId);
      }

      query += ' ORDER BY created_at DESC';

      if (limit) {
        query += ' LIMIT ?';
        params.push(limit);
      }

      const stmt = this.db.prepare(query);
      const rows = stmt.all(...params) as any[];
      return rows.map(row => ({
        ...row,
        metadata: row.metadata ? JSON.parse(row.metadata) : null
      })) as Event[];
    } catch (error: any) {
      // If events table doesn't exist yet, treat as "no events" instead of 500
      if (error?.message?.includes('no such table')) {
        console.warn('events table does not exist yet, returning empty events list');
        return [];
      }
      console.error('Error in getEvents:', error);
      throw error;
    }
  }

  // Usage Events
  addUsageEvent(event: UsageEvent): UsageEvent {
    const stmt = this.db.prepare(`
      INSERT INTO usage_events (app_id, app_slug, timestamp, user, action, source, duration_ms, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      event.app_id,
      event.app_slug,
      event.timestamp,
      event.user || null,
      event.action || null,
      event.source,
      event.duration_ms || null,
      event.metadata ? JSON.stringify(event.metadata) : null
    );
    return { ...event, id: result.lastInsertRowid as number };
  }

  getUsageEvents(appSlug?: string, since?: string, limit?: number, offset: number = 0): UsageEvent[] {
    let query = 'SELECT * FROM usage_events WHERE 1=1';
    const params: any[] = [];

    if (appSlug) {
      query += ' AND app_slug = ?';
      params.push(appSlug);
    }
    if (since) {
      query += ' AND timestamp >= ?';
      params.push(since);
    }

    query += ' ORDER BY timestamp DESC';

    if (limit) {
      query += ' LIMIT ? OFFSET ?';
      params.push(limit, offset);
    } else if (offset > 0) {
      query += ' LIMIT -1 OFFSET ?';
      params.push(offset);
    }

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];
    return rows.map(row => ({
      ...row,
      metadata: row.metadata ? JSON.parse(row.metadata) : null
    })) as UsageEvent[];
  }

  deleteUsageEvent(eventId: number): boolean {
    const stmt = this.db.prepare('DELETE FROM usage_events WHERE id = ?');
    const result = stmt.run(eventId);
    return result.changes > 0;
  }

  deleteUsageEventsByCriteria(criteria: {
    appSlug?: string;
    since?: string;
    before?: string;
    emptyMetadata?: boolean;
  }): number {
    let query = 'DELETE FROM usage_events WHERE 1=1';
    const params: any[] = [];

    if (criteria.appSlug) {
      query += ' AND app_slug = ?';
      params.push(criteria.appSlug);
    }
    if (criteria.since) {
      query += ' AND timestamp >= ?';
      params.push(criteria.since);
    }
    if (criteria.before) {
      query += ' AND timestamp < ?';
      params.push(criteria.before);
    }
    if (criteria.emptyMetadata) {
      query += ' AND (metadata IS NULL OR metadata = ? OR metadata = ?)';
      params.push(null, '{}');
    }

    const stmt = this.db.prepare(query);
    const result = stmt.run(...params);
    return result.changes;
  }

  // Usage Aggregates
  getUsageAggregates(appId: number, startDate: string, endDate: string, granularity: 'hourly' | 'daily' = 'daily'): UsageAggregate[] {
    let query = `
      SELECT * FROM usage_aggregates
      WHERE app_id = ? AND date >= ? AND date <= ?
    `;
    const params: any[] = [appId, startDate, endDate];

    if (granularity === 'hourly') {
      query += ' AND hour IS NOT NULL AND hour >= 0';
    } else {
      query += ' AND hour = -1';  // Daily aggregates use -1 as sentinel value
    }

    query += ' ORDER BY date ASC, hour ASC';

    const stmt = this.db.prepare(query);
    return stmt.all(...params) as UsageAggregate[];
  }

  // Dependency Cache
  saveDependencyCache(data: any): void {
    const stmt = this.db.prepare(`
      INSERT INTO dependency_cache (
        cached_at, data, total_vulnerabilities, critical_vulnerabilities,
        high_vulnerabilities, medium_vulnerabilities, low_vulnerabilities, total_projects
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      new Date().toISOString(),
      JSON.stringify(data),
      data.totalVulnerabilities || 0,
      data.criticalVulnerabilities || 0,
      data.highVulnerabilities || 0,
      data.mediumVulnerabilities || 0,
      data.lowVulnerabilities || 0,
      data.totalProjects || 0
    );
    
    // Keep only last 7 days of cache
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const deleteStmt = this.db.prepare('DELETE FROM dependency_cache WHERE cached_at < ?');
    deleteStmt.run(sevenDaysAgo.toISOString());
  }

  getLatestDependencyCache(): { data: any; cached_at: string } | null {
    const stmt = this.db.prepare(`
      SELECT data, cached_at FROM dependency_cache
      ORDER BY cached_at DESC
      LIMIT 1
    `);
    const row = stmt.get() as any;
    
    if (!row) return null;
    
    return {
      data: JSON.parse(row.data),
      cached_at: row.cached_at
    };
  }

  isDependencyCacheFresh(maxAgeHours: number = 24): boolean {
    const cache = this.getLatestDependencyCache();
    if (!cache) return false;
    
    const cachedAt = new Date(cache.cached_at);
    const now = new Date();
    const ageHours = (now.getTime() - cachedAt.getTime()) / (1000 * 60 * 60);
    
    return ageHours < maxAgeHours;
  }

  // Vulnerability History
  saveVulnerabilitySnapshot(date: string, vulnerabilities: Array<{
    appName: string;
    packageName: string;
    severity: string;
    title: string;
    description?: string;
    recommendation?: string;
    componentType?: string;
  }>): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO vulnerability_history (
        snapshot_date, app_name, package_name, severity, title, description,
        recommendation, component_type, status, first_seen, last_seen
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', COALESCE((SELECT first_seen FROM vulnerability_history WHERE app_name = ? AND package_name = ? AND title = ? LIMIT 1), ?), ?)
    `);

    for (const vuln of vulnerabilities) {
      stmt.run(
        date,
        vuln.appName,
        vuln.packageName,
        vuln.severity,
        vuln.title,
        vuln.description || null,
        vuln.recommendation || null,
        vuln.componentType || null,
        vuln.appName,
        vuln.packageName,
        vuln.title,
        date, // first_seen if new
        date  // last_seen
      );
    }
  }

  getVulnerabilityFixes(startDate: string, endDate: string): Array<{
    appName: string;
    packageName: string;
    severity: string;
    title: string;
    description?: string;
    recommendation?: string;
    fixedDate: string;
  }> {
    // Find vulnerabilities that were fixed between startDate and endDate
    // A vulnerability is considered fixed if:
    // 1. It was active before startDate
    // 2. It's marked as fixed with a fixed_date between startDate and endDate
    // OR it doesn't appear in any snapshot after startDate
    const stmt = this.db.prepare(`
      SELECT DISTINCT
        v.app_name as appName,
        v.package_name as packageName,
        v.severity,
        v.title,
        v.description,
        v.recommendation,
        COALESCE(v.fixed_date, (
          SELECT MIN(v2.snapshot_date)
          FROM vulnerability_history v2
          WHERE v2.app_name = v.app_name
            AND v2.package_name = v.package_name
            AND v2.title = v.title
            AND v2.snapshot_date > v.snapshot_date
            AND v2.status = 'fixed'
        )) as fixedDate
      FROM vulnerability_history v
      WHERE v.status = 'fixed'
        AND COALESCE(v.fixed_date, v.snapshot_date) >= ?
        AND COALESCE(v.fixed_date, v.snapshot_date) <= ?
        AND EXISTS (
          SELECT 1 FROM vulnerability_history v_prev
          WHERE v_prev.app_name = v.app_name
            AND v_prev.package_name = v.package_name
            AND v_prev.title = v.title
            AND v_prev.snapshot_date < ?
            AND v_prev.status = 'active'
        )
      ORDER BY fixedDate DESC
    `);

    return stmt.all(startDate, endDate, startDate).map((row: any) => ({
      appName: row.appName,
      packageName: row.packageName,
      severity: row.severity,
      title: row.title,
      description: row.description,
      recommendation: row.recommendation,
      fixedDate: row.fixedDate || endDate
    }));
  }

  markVulnerabilitiesFixed(fixedDate: string): void {
    // Mark vulnerabilities as fixed if they don't appear in the latest snapshot
    const latestDate = this.db.prepare(`
      SELECT MAX(snapshot_date) as latest_date FROM vulnerability_history
    `).get() as { latest_date: string } | null;

    if (!latestDate || !latestDate.latest_date) return;

    const updateStmt = this.db.prepare(`
      UPDATE vulnerability_history
      SET status = 'fixed', fixed_date = ?
      WHERE snapshot_date < ?
        AND status = 'active'
        AND NOT EXISTS (
          SELECT 1 FROM vulnerability_history v2
          WHERE v2.app_name = vulnerability_history.app_name
            AND v2.package_name = vulnerability_history.package_name
            AND v2.title = vulnerability_history.title
            AND v2.snapshot_date = ?
            AND v2.status = 'active'
        )
    `);

    updateStmt.run(fixedDate, latestDate.latest_date, latestDate.latest_date);
  }

  // Log Analyses (Log Guru)
  saveLogAnalysis(analysis: {
    app_id: number;
    app_slug: string;
    error_log: string;
    error_name?: string;
    context_before?: string;
    context_after?: string;
    analysis_summary?: string;
    analysis_fix?: string;
    is_real_issue?: number;
    user_notes?: string;
    error_hash?: string;
    group_id?: number;
    occurrence_count?: number;
    error_timestamp?: Date | string;
    first_occurrence_time?: Date | string;
    last_occurrence_time?: Date | string;
    burst_count?: number;
  }): any {
    const stmt = this.db.prepare(`
      INSERT INTO log_analyses (
        app_id, app_slug, error_log, error_name, context_before, context_after,
        analysis_summary, analysis_fix, is_real_issue, user_notes,
        error_hash, group_id, occurrence_count, error_timestamp,
        first_occurrence_time, last_occurrence_time, burst_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const timestamp = analysis.error_timestamp 
      ? (typeof analysis.error_timestamp === 'string' ? analysis.error_timestamp : analysis.error_timestamp.toISOString())
      : null;
    const firstOccurrence = analysis.first_occurrence_time
      ? (typeof analysis.first_occurrence_time === 'string' ? analysis.first_occurrence_time : analysis.first_occurrence_time.toISOString())
      : timestamp;
    const lastOccurrence = analysis.last_occurrence_time
      ? (typeof analysis.last_occurrence_time === 'string' ? analysis.last_occurrence_time : analysis.last_occurrence_time.toISOString())
      : timestamp;
    
    const result = stmt.run(
      analysis.app_id,
      analysis.app_slug,
      analysis.error_log,
      analysis.error_name || null,
      analysis.context_before || null,
      analysis.context_after || null,
      analysis.analysis_summary || null,
      analysis.analysis_fix || null,
      analysis.is_real_issue ?? 0,
      analysis.user_notes || null,
      analysis.error_hash || null,
      analysis.group_id || null,
      analysis.occurrence_count ?? 1,
      timestamp,
      firstOccurrence,
      lastOccurrence,
      analysis.burst_count ?? 0
    );

    return this.getLogAnalysisById(result.lastInsertRowid as number);
  }

  getLogAnalysisById(id: number): any | null {
    const stmt = this.db.prepare('SELECT * FROM log_analyses WHERE id = ?');
    const row = stmt.get(id) as any;
    return row || null;
  }

  getLogAnalyses(appSlug?: string, isRealIssue?: number, excludeFalsePositives: boolean = true): any[] {
    let query = 'SELECT la.*, a.name as app_name FROM log_analyses la LEFT JOIN apps a ON la.app_id = a.id WHERE 1=1';
    const params: any[] = [];

    if (appSlug) {
      query += ' AND la.app_slug = ?';
      params.push(appSlug);
    }

    if (isRealIssue !== undefined) {
      query += ' AND la.is_real_issue = ?';
      params.push(isRealIssue);
    } else if (excludeFalsePositives) {
      // By default, exclude false positives unless explicitly filtering for them
      query += ' AND la.is_real_issue != 2';
    }

    query += ' ORDER BY la.analyzed_at DESC';

    const stmt = this.db.prepare(query);
    return stmt.all(...params) as any[];
  }

  getLogAnalysesByApp(appSlug: string): any[] {
    const stmt = this.db.prepare('SELECT * FROM log_analyses WHERE app_slug = ? ORDER BY analyzed_at DESC');
    return stmt.all(appSlug) as any[];
  }

  getLogAnalysisByHash(errorHash: string, appSlug: string): any | null {
    const stmt = this.db.prepare('SELECT * FROM log_analyses WHERE error_hash = ? AND app_slug = ? ORDER BY analyzed_at DESC LIMIT 1');
    const row = stmt.get(errorHash, appSlug) as any;
    return row || null;
  }

  getLogAnalysisByHashAndTime(errorHash: string, appSlug: string, timestamp: Date, timeWindowMs: number): any | null {
    const timestampMs = timestamp.getTime();
    const windowStart = new Date(timestampMs - timeWindowMs).toISOString();
    const windowEnd = new Date(timestampMs + timeWindowMs).toISOString();
    
    const stmt = this.db.prepare(`
      SELECT * FROM log_analyses 
      WHERE error_hash = ? 
        AND app_slug = ? 
        AND error_timestamp IS NOT NULL
        AND error_timestamp >= ? 
        AND error_timestamp <= ?
      ORDER BY analyzed_at DESC 
      LIMIT 1
    `);
    const row = stmt.get(errorHash, appSlug, windowStart, windowEnd) as any;
    return row || null;
  }

  getLogAnalysesByHashAndGroup(errorHash: string, appSlug: string): any[] {
    const stmt = this.db.prepare(`
      SELECT * FROM log_analyses 
      WHERE error_hash = ? AND app_slug = ?
      ORDER BY error_timestamp ASC, analyzed_at ASC
    `);
    return stmt.all(errorHash, appSlug) as any[];
  }

  deleteLogAnalyses(ids: number[]): void {
    if (ids.length === 0) return;
    const placeholders = ids.map(() => '?').join(',');
    const stmt = this.db.prepare(`DELETE FROM log_analyses WHERE id IN (${placeholders})`);
    stmt.run(...ids);
  }

  /**
   * Delete false positives older than specified days
   */
  deleteOldFalsePositives(daysOld: number = 20): number {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    const cutoffISO = cutoffDate.toISOString();

    const stmt = this.db.prepare(`
      DELETE FROM log_analyses 
      WHERE is_real_issue = 2 
        AND (analyzed_at < ? OR created_at < ?)
    `);
    
    const result = stmt.run(cutoffISO, cutoffISO);
    return result.changes || 0;
  }

  updateLogAnalysisRepresentative(
    id: number, 
    latestTimestamp: Date, 
    totalOccurrences: number,
    firstOccurrence?: Date,
    burstCount?: number
  ): void {
    const setParts = [
      'error_timestamp = ?',
      'last_occurrence_time = ?',
      'occurrence_count = ?',
      'analyzed_at = CURRENT_TIMESTAMP',
      'updated_at = CURRENT_TIMESTAMP'
    ];
    const params: any[] = [
      latestTimestamp.toISOString(),
      latestTimestamp.toISOString(),
      totalOccurrences
    ];
    
    if (firstOccurrence) {
      setParts.push('first_occurrence_time = ?');
      params.push(firstOccurrence.toISOString());
    }
    
    if (burstCount !== undefined) {
      setParts.push('burst_count = ?');
      params.push(burstCount);
    }
    
    params.push(id);
    
    const stmt = this.db.prepare(`
      UPDATE log_analyses 
      SET ${setParts.join(', ')}
      WHERE id = ?
    `);
    stmt.run(...params);
  }

  getOrCreateErrorGroup(errorHash: string, appSlug: string, timestamp?: Date, timeWindowMs?: number): number {
    // Always group by hash + app - same error pattern in same app = same problem, regardless of time
    // Check if any group exists for this hash in this app
    const existing = this.db.prepare(`
      SELECT group_id FROM log_analyses 
      WHERE error_hash = ? AND app_slug = ? AND group_id IS NOT NULL 
      LIMIT 1
    `).get(errorHash, appSlug) as any;
    
    if (existing && existing.group_id) {
      return existing.group_id;
    }
    
    // Create new group ID (use max + 1, but ensure it's unique per app)
    // Use app-specific group IDs by incorporating app_slug in the calculation
    const maxGroup = this.db.prepare(`
      SELECT MAX(group_id) as max_id FROM log_analyses 
      WHERE app_slug = ?
    `).get(appSlug) as any;
    const appBaseId = (maxGroup?.max_id || 0);
    
    // Generate unique group ID: use app-specific incrementing
    // This ensures each app has its own group numbering
    const newGroupId = appBaseId + 1;
    return newGroupId;
  }

  incrementErrorOccurrence(analysisId: number): void {
    const stmt = this.db.prepare(`
      UPDATE log_analyses 
      SET occurrence_count = occurrence_count + 1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    stmt.run(analysisId);
  }

  getLogAnalysesByGroup(groupId: number): any[] {
    const stmt = this.db.prepare('SELECT * FROM log_analyses WHERE group_id = ? ORDER BY analyzed_at DESC');
    return stmt.all(groupId) as any[];
  }

  getGroupedAnalyses(appSlug?: string, excludeFalsePositives: boolean = true): any[] {
    let query = `
      SELECT 
        MIN(la.id) as id,
        la.group_id,
        la.error_hash,
        la.app_slug,
        a.name as app_name,
        la.error_log,
        la.error_name,
        la.analysis_summary,
        la.analysis_fix,
        la.is_real_issue,
        la.user_notes,
        SUM(la.occurrence_count) as total_occurrences,
        COUNT(*) as unique_instances,
        MAX(la.analyzed_at) as last_seen,
        MIN(la.analyzed_at) as first_seen
      FROM log_analyses la
      LEFT JOIN apps a ON la.app_id = a.id
      WHERE la.group_id IS NOT NULL
    `;
    const params: any[] = [];

    if (appSlug) {
      query += ' AND la.app_slug = ?';
      params.push(appSlug);
    }

    // Exclude false positives by default
    if (excludeFalsePositives) {
      query += ' AND la.is_real_issue != 2';
    }

    query += `
      GROUP BY la.group_id, la.error_hash, la.app_slug, la.error_log, la.error_name, la.analysis_summary, la.analysis_fix, la.is_real_issue, la.user_notes, a.name
      ORDER BY total_occurrences DESC, last_seen DESC
    `;

    const stmt = this.db.prepare(query);
    return stmt.all(...params) as any[];
  }

  markGroupAnalysis(groupId: number, isRealIssue: number, userNotes?: string, errorName?: string): void {
    const setParts: string[] = [
      'is_real_issue = ?',
      'marked_at = CURRENT_TIMESTAMP',
      'updated_at = CURRENT_TIMESTAMP'
    ];
    const params: any[] = [isRealIssue];

    if (userNotes !== undefined) {
      setParts.push('user_notes = ?');
      params.push(userNotes);
    }

    if (errorName !== undefined) {
      setParts.push('error_name = ?');
      params.push(errorName);
    }

    params.push(groupId);

    const stmt = this.db.prepare(`
      UPDATE log_analyses 
      SET ${setParts.join(', ')}
      WHERE group_id = ?
    `);
    stmt.run(...params);
  }

  updateLogAnalysis(id: number, updates: {
    is_real_issue?: number;
    user_notes?: string;
    error_name?: string;
  }): any {
    const setParts: string[] = [];
    const params: any[] = [];

    if (updates.is_real_issue !== undefined) {
      setParts.push('is_real_issue = ?');
      params.push(updates.is_real_issue);
      setParts.push('marked_at = CURRENT_TIMESTAMP');
    }

    if (updates.user_notes !== undefined) {
      setParts.push('user_notes = ?');
      params.push(updates.user_notes);
    }

    if (updates.error_name !== undefined) {
      setParts.push('error_name = ?');
      params.push(updates.error_name);
    }

    if (setParts.length === 0) {
      return this.getLogAnalysisById(id);
    }

    setParts.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    const stmt = this.db.prepare(`
      UPDATE log_analyses 
      SET ${setParts.join(', ')}
      WHERE id = ?
    `);

    stmt.run(...params);
    return this.getLogAnalysisById(id);
  }

  // Backup Records
  saveBackupRecord(record: {
    app_name: string;
    backup_path: string | null;
    backup_size: number;
    backup_type: string;
    status: 'success' | 'failed';
    error_message?: string | null;
    created_at: string;
  }): void {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO backup_records (
          app_name, backup_path, backup_size, backup_type, status, error_message, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run(
        record.app_name,
        record.backup_path,
        record.backup_size,
        record.backup_type,
        record.status,
        record.error_message || null,
        record.created_at
      );
    } catch (error: any) {
      if (error.message && error.message.includes('no such table')) {
        console.warn('backup_records table does not exist yet, skipping save');
      } else {
        throw error;
      }
    }
  }

  getBackups(limit: number = 50, appName?: string): any[] {
    try {
      // Check if table exists first
      const tableExists = this.db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='backup_records'
      `).get();
      
      if (!tableExists) {
        console.warn('backup_records table does not exist yet');
        return [];
      }
      
      let query = 'SELECT * FROM backup_records WHERE 1=1';
      const params: any[] = [];

      if (appName) {
        query += ' AND app_name = ?';
        params.push(appName);
      }

      query += ' ORDER BY created_at DESC LIMIT ?';
      params.push(limit);

      const stmt = this.db.prepare(query);
      return stmt.all(...params) as any[];
    } catch (error: any) {
      console.error('Error in getBackups:', error);
      // If table doesn't exist, return empty array
      if (error.message && error.message.includes('no such table')) {
        return [];
      }
      throw error;
    }
  }

  getBackupsByDate(date: string): any[] {
    const stmt = this.db.prepare(`
      SELECT * FROM backup_records 
      WHERE DATE(created_at) = DATE(?)
      ORDER BY created_at DESC
    `);
    return stmt.all(date) as any[];
  }

  hasBackupToday(date: string): boolean {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM backup_records 
      WHERE DATE(created_at) = DATE(?)
      AND status = 'success'
    `);
    const result = stmt.get(date) as { count: number };
    return (result?.count || 0) > 0;
  }

  // Backup Reports
  saveBackupReport(report: any): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO backup_reports (report_date, report_data, created_at)
      VALUES (?, ?, ?)
    `);
    
    stmt.run(
      report.date,
      JSON.stringify(report),
      report.timestamp || new Date().toISOString()
    );
  }

  getBackupReports(limit: number = 30): any[] {
    try {
      // Check if table exists first
      const tableExists = this.db.prepare(`
        SELECT name FROM sqlite_master
        WHERE type='table' AND name='backup_reports'
      `).get();

      if (!tableExists) {
        console.warn('backup_reports table does not exist yet');
        return [];
      }

      const stmt = this.db.prepare(`
        SELECT * FROM backup_reports 
        ORDER BY report_date DESC 
        LIMIT ?
      `);
      const rows = stmt.all(limit) as any[];
      return rows.map(row => ({
        ...row,
        report_data: JSON.parse(row.report_data)
      }));
    } catch (error: any) {
      console.error('Error in getBackupReports:', error);
      // If table doesn't exist, return empty array
      if (error.message && error.message.includes('no such table')) {
        return [];
      }
      throw error;
    }
  }

  getBackupReportByDate(date: string): any | null {
    const stmt = this.db.prepare(`
      SELECT * FROM backup_reports 
      WHERE report_date = ?
    `);
    const row = stmt.get(date) as any;
    if (!row) return null;
    return {
      ...row,
      report_data: JSON.parse(row.report_data)
    };
  }

  // Helper methods
  private parseApp(row: any): App {
    return {
      ...row,
      adoption_metrics: row.adoption_metrics ? JSON.parse(row.adoption_metrics) : null,
      metadata: row.metadata ? JSON.parse(row.metadata) : null
    };
  }
}

export const db = new DatabaseService();

