import { db, UsageEvent, UsageAggregate, App } from '../models/database';

export interface TrackRequest {
  app_slug: string;
  user?: string;
  action?: string;
  source: string;
  duration_ms?: number;
  metadata?: any;
}

class UsageService {
  async trackUsage(request: TrackRequest): Promise<UsageEvent> {
    // Auto-register app if it doesn't exist
    let app = await db.getAppBySlug(request.app_slug);
    if (!app || !app.id) {
      // Auto-create app with defaults
      const appName = request.app_slug
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      
      app = await db.createApp({
        name: appName,
        slug: request.app_slug,
        description: `Auto-registered from ${request.source}`,
        project_type: request.source === 'power-automate' ? 'power-automate' : 
                      request.source === 'flask' ? 'flask' :
                      request.source === 'react' ? 'react' : 'other',
        status: 'active'
      });
      console.log(`Auto-registered app: ${request.app_slug}`);
    }

    // Ensure app has an ID
    if (!app.id) {
      throw new Error(`App ${request.app_slug} has no ID`);
    }

    // Create usage event
    const event: UsageEvent = {
      app_id: app.id,
      app_slug: request.app_slug,
      timestamp: new Date().toISOString(),
      user: request.user,
      action: request.action,
      source: request.source,
      duration_ms: request.duration_ms,
      metadata: request.metadata
    };

    const createdEvent = await db.addUsageEvent(event);

    // Trigger aggregation update (async, don't wait)
    this.updateAggregates(app.id, request.app_slug).catch(err => {
      console.error('Error updating aggregates:', err);
    });

    return createdEvent;
  }

  async getUsageStats(appSlug: string, days: number = 30): Promise<any> {
    const app = await db.getAppBySlug(appSlug);
    if (!app || !app.id) {
      throw new Error(`App with slug ${appSlug} not found`);
    }

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get ALL events for the period (not just recent 1000) for accurate aggregates
    const allEvents = await db.getUsageEvents(appSlug, startDate.toISOString());
    
    console.log(`[getUsageStats] Retrieved ${allEvents.length} events from database`);
    console.log(`[getUsageStats] Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);

    // Calculate totals from all events
    const totalEvents = allEvents.length;
    const uniqueUsers = new Set(allEvents.map(e => e.user).filter(Boolean)).size;
    const totalDuration = allEvents.reduce((sum, e) => sum + (e.duration_ms || 0), 0);
    const avgDuration = totalEvents > 0 ? totalDuration / totalEvents : 0;

    // Filter for redirect entries only (events with redirect_url in metadata)
    const redirectEvents = allEvents.filter(event => {
      return event.metadata && 
             typeof event.metadata === 'object' && 
             event.metadata.redirect_url;
    });

    // Get only recent redirect entries (last 30 days or last 1000, whichever is more)
    const recentRedirectCutoffDate = new Date();
    recentRedirectCutoffDate.setDate(recentRedirectCutoffDate.getDate() - 30);
    
    const recentRedirectEvents = redirectEvents
      .filter(event => new Date(event.timestamp) >= recentRedirectCutoffDate)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .slice(-1000); // Take last 1000 recent redirect entries
    
    console.log(`[getUsageStats] Found ${redirectEvents.length} redirect entries, ${recentRedirectEvents.length} recent redirect entries`);

    // Calculate daily aggregates from ALL EVENTS for graph data (showing API hits)
    // But also calculate redirect-only aggregates for reference
    const dailyMap: { [key: string]: { events: UsageEvent[], users: Set<string>, duration: number } } = {};
    const redirectDailyMap: { [key: string]: { events: UsageEvent[], users: Set<string>, duration: number } } = {};
    
    // Debug: Check if allEvents is populated
    if (allEvents.length === 0) {
      console.error(`[getUsageStats] WARNING: allEvents is empty! Expected events but got 0.`);
    }
    
    // Calculate aggregates from ALL events (for main graph showing API hits)
    allEvents.forEach(event => {
      const eventDate = new Date(event.timestamp);
      const dateKey = eventDate.toISOString().split('T')[0];
      
      if (!dailyMap[dateKey]) {
        dailyMap[dateKey] = { events: [], users: new Set(), duration: 0 };
      }
      
      dailyMap[dateKey].events.push(event);
      if (event.user) {
        dailyMap[dateKey].users.add(event.user);
      }
      dailyMap[dateKey].duration += event.duration_ms || 0;
    });
    
    // Also calculate redirect-only aggregates (for reference/separate view if needed)
    recentRedirectEvents.forEach(event => {
      const eventDate = new Date(event.timestamp);
      const dateKey = eventDate.toISOString().split('T')[0];
      
      if (!redirectDailyMap[dateKey]) {
        redirectDailyMap[dateKey] = { events: [], users: new Set(), duration: 0 };
      }
      
      redirectDailyMap[dateKey].events.push(event);
      if (event.user) {
        redirectDailyMap[dateKey].users.add(event.user);
      }
      redirectDailyMap[dateKey].duration += event.duration_ms || 0;
    });

    // Convert to aggregate format matching database schema (from ALL events - shows API hits)
    const aggregates = Object.entries(dailyMap)
      .map(([date, data]) => ({
        app_id: app.id,
        date: date,
        hour: null,
        total_events: data.events.length,
        unique_users: data.users.size,
        total_duration_ms: data.duration,
        avg_duration_ms: data.events.length > 0 ? data.duration / data.events.length : 0,
        last_updated: new Date().toISOString()
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
    
    console.log(`[getUsageStats] Generated ${aggregates.length} daily aggregates for graph`);
    if (aggregates.length > 0) {
      console.log(`[getUsageStats] Sample aggregate: ${JSON.stringify(aggregates[0])}`);
    }
    
    // Also create redirect-only aggregates (for reference)
    const redirectAggregates = Object.entries(redirectDailyMap)
      .map(([date, data]) => ({
        app_id: app.id,
        date: date,
        hour: null,
        total_events: data.events.length,
        unique_users: data.users.size,
        total_duration_ms: data.duration,
        avg_duration_ms: data.events.length > 0 ? data.duration / data.events.length : 0,
        last_updated: new Date().toISOString()
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Get recent events for display (last 500 for better redirect statistics)
    const recentEvents = allEvents.slice(-500);

    // Calculate time saved if manual_time and automation_time are set
    let timeSaved = null;
    if (app.manual_time_seconds && app.automation_time_seconds) {
      const timeSavedPerEvent = (app.manual_time_seconds - app.automation_time_seconds) * 1000; // Convert to ms
      timeSaved = {
        per_event_ms: timeSavedPerEvent,
        total_ms: timeSavedPerEvent * totalEvents,
        total_hours: (timeSavedPerEvent * totalEvents) / (1000 * 60 * 60)
      };
    }

    return {
      app: {
        id: app.id,
        name: app.name,
        slug: app.slug
      },
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        days
      },
      totals: {
        events: totalEvents,
        unique_users: uniqueUsers,
        total_duration_ms: totalDuration,
        avg_duration_ms: avgDuration
      },
      time_saved: timeSaved,
      aggregates: aggregates,
      recent_events: recentEvents.slice(0, 500) // Last 500 events for better statistics
    };
  }

  async getTopApps(limit: number = 10, days: number = 7): Promise<any[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get all apps
    const apps = await db.getAllApps({ status: 'active' });

    // Get usage stats for each app
    const appStats = await Promise.all(
      apps.map(async (app) => {
        try {
          const events = await db.getUsageEvents(app.slug, startDate.toISOString());
          return {
            app,
            event_count: events.length,
            unique_users: new Set(events.map(e => e.user).filter(Boolean)).size
          };
        } catch (error) {
          return { app, event_count: 0, unique_users: 0 };
        }
      })
    );

    // Sort by event count and return top N
    return appStats
      .sort((a, b) => b.event_count - a.event_count)
      .slice(0, limit)
      .map(({ app, event_count, unique_users }) => ({
        app: {
          id: app.id,
          name: app.name,
          slug: app.slug,
          project_type: app.project_type
        },
        event_count,
        unique_users
      }));
  }

  async getUsageEvents(appSlug: string, since?: string, limit?: number, offset: number = 0): Promise<UsageEvent[]> {
    return db.getUsageEvents(appSlug, since, limit, offset);
  }

  async getUsageEventsCount(appSlug: string, since?: string): Promise<number> {
    const app = await db.getAppBySlug(appSlug);
    if (!app || !app.id) {
      return 0;
    }
    
    const dbInstance = db.getDb();
    let query = 'SELECT COUNT(*) as count FROM usage_events WHERE app_slug = ?';
    const params: any[] = [appSlug];
    
    if (since) {
      query += ' AND timestamp >= ?';
      params.push(since);
    }
    
    const stmt = dbInstance.prepare(query);
    const result = stmt.get(...params) as { count: number };
    return result.count;
  }

  private async updateAggregates(appId: number, appSlug: string): Promise<void> {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const hour = now.getHours();

    // Get events for today
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const events = await db.getUsageEvents(appSlug, startOfDay.toISOString());

    // Calculate hourly aggregate
    const hourlyEvents = events.filter(e => {
      const eventDate = new Date(e.timestamp);
      return eventDate.getHours() === hour && eventDate.toISOString().split('T')[0] === today;
    });

    const hourlyUniqueUsers = new Set(hourlyEvents.map(e => e.user).filter(Boolean)).size;
    const hourlyTotalDuration = hourlyEvents.reduce((sum, e) => sum + (e.duration_ms || 0), 0);
    const hourlyAvgDuration = hourlyEvents.length > 0 ? hourlyTotalDuration / hourlyEvents.length : 0;

    // Update or insert hourly aggregate
    const dbInstance = db.getDb();
    const hourlyStmt = dbInstance.prepare(`
      INSERT INTO usage_aggregates (app_id, date, hour, total_events, unique_users, total_duration_ms, avg_duration_ms, last_updated)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(app_id, date, hour) DO UPDATE SET
        total_events = excluded.total_events,
        unique_users = excluded.unique_users,
        total_duration_ms = excluded.total_duration_ms,
        avg_duration_ms = excluded.avg_duration_ms,
        last_updated = excluded.last_updated
    `);

    hourlyStmt.run(
      appId,
      today,
      hour,
      hourlyEvents.length,
      hourlyUniqueUsers,
      hourlyTotalDuration,
      hourlyAvgDuration,
      now.toISOString()
    );

    // Calculate daily aggregate
    const dailyUniqueUsers = new Set(events.map(e => e.user).filter(Boolean)).size;
    const dailyTotalDuration = events.reduce((sum, e) => sum + (e.duration_ms || 0), 0);
    const dailyAvgDuration = events.length > 0 ? dailyTotalDuration / events.length : 0;

    // Update or insert daily aggregate
    // Use -1 as sentinel value for daily aggregates (NULL causes issues with UNIQUE constraint)
    const dailyStmt = dbInstance.prepare(`
      INSERT INTO usage_aggregates (app_id, date, hour, total_events, unique_users, total_duration_ms, avg_duration_ms, last_updated)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(app_id, date, hour) DO UPDATE SET
        total_events = excluded.total_events,
        unique_users = excluded.unique_users,
        total_duration_ms = excluded.total_duration_ms,
        avg_duration_ms = excluded.avg_duration_ms,
        last_updated = excluded.last_updated
    `);

    dailyStmt.run(
      appId,
      today,
      -1,  // Use -1 instead of NULL for daily aggregates (NULL breaks UNIQUE constraint)
      events.length,
      dailyUniqueUsers,
      dailyTotalDuration,
      dailyAvgDuration,
      now.toISOString()
    );
  }
}

export const usageService = new UsageService();

