import { db, App } from '../models/database';
import { usageService } from './usage';
import { healthService } from './health';
import { dependenciesService } from './dependencies';
import { dependencyResolutionsService } from './dependencyResolutions';
const PDFDocument = require('pdfkit');

export interface WeeklyReportData {
  weekStart: Date;
  weekEnd: Date;
  /** Per-day breakdown for the week (Mon–Sun) for charts */
  dailyBreakdown?: Array<{ date: string; label: string; events: number; timeSavedHours: number }>;
  apps: Array<{
    app: App;
    stats: {
      totalEvents: number;
      uniqueUsers: number;
      avgDuration: number;
      timeSaved?: {
        total_hours: number;
        per_event_ms: number;
      };
    };
  }>;
  summary: {
    totalApps: number;
    totalEvents: number;
    totalUniqueUsers: number;
    totalTimeSaved?: number;
  };
  dependencies?: {
    totalVulnerabilities: number;
    criticalVulnerabilities: number;
    highVulnerabilities: number;
    mediumVulnerabilities: number;
    lowVulnerabilities: number;
    totalProjects: number;
    appsWithVulnerabilities: Array<{
      appName: string;
      critical: number;
      high: number;
      medium: number;
      low: number;
      total: number;
    }>;
    cachedAt?: string;
    fixesThisWeek?: Array<{
      riskName: string;
      risk: string;
      riskFix: string;
      appName: string;
      packageName: string;
      fixedDate: string;
    }>;
    fixesCount?: number;
    documentedResolutions?: Array<{
      id: string;
      date: string;
      appName: string;
      packageName: string;
      severity: string;
      title: string;
      description: string;
      fixedBy?: string;
      relatedIssues?: string[];
      verification?: string;
    }>;
    documentedResolutionsCount?: number;
  };
}

export interface DailyReportData {
  date: Date;
  apps: Array<{
    app: App;
    stats: {
      totalEvents: number;
      uniqueUsers: number;
      avgDuration: number;
      timeSaved?: {
        total_hours: number;
        per_event_ms: number;
      };
    };
    healthStatus?: 'healthy' | 'unhealthy' | 'unknown' | 'timeout' | 'error';
  }>;
  summary: {
    totalApps: number;
    totalEvents: number;
    totalUniqueUsers: number;
    totalTimeSaved?: number;
    healthyApps: number;
    unhealthyApps: number;
    unknownApps: number;
  };
  growth: {
    dayOverDay?: {
      eventsChange: number;
      eventsChangePercent: number;
      timeSavedChange: number;
      timeSavedChangePercent: number;
    };
    weekOverWeek?: {
      eventsChange: number;
      eventsChangePercent: number;
      timeSavedChange: number;
      timeSavedChangePercent: number;
    };
  };
  topServices: Array<{
    app: App;
    events: number;
    timeSaved?: number;
  }>;
  dependencies?: {
    totalVulnerabilities: number;
    criticalVulnerabilities: number;
    highVulnerabilities: number;
    mediumVulnerabilities: number;
    lowVulnerabilities: number;
    totalProjects: number;
    appsWithVulnerabilities: Array<{
      appName: string;
      critical: number;
      high: number;
      medium: number;
      low: number;
      total: number;
    }>;
  };
  detailedUsage?: {
    totalEvents: number;
    eventsByApp: Array<{
      appSlug: string;
      appName: string;
      events: number;
      uniqueUsers: number;
      totalDuration: number;
      avgDuration: number;
      timeSaved?: number;
    }>;
    eventsBySource: Array<{
      source: string;
      events: number;
    }>;
    eventsByHour: Array<{
      hour: number;
      events: number;
    }>;
  };
}

class ReportsService {
  /**
   * Normalize vulnerability severity to standard values
   */
  private normalizeSeverity(severity: string): 'critical' | 'high' | 'medium' | 'low' | null {
    const s = severity.toLowerCase().trim();
    if (s.includes('critical') || s === '9' || s === '10') return 'critical';
    if (s.includes('high') || s === '7' || s === '8') return 'high';
    if (s.includes('medium') || s.includes('moderate') || s === '4' || s === '5' || s === '6') return 'medium';
    if (s.includes('low') || s === '1' || s === '2' || s === '3') return 'low';
    return null;
  }

  async getWeeklyReportData(weekStart?: Date): Promise<WeeklyReportData> {
    // Calculate week start (Monday) and end (Sunday)
    const now = weekStart || new Date();
    const startOfWeek = new Date(now);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    startOfWeek.setDate(diff);
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    // Get all active apps
    const apps = await db.getAllApps({ status: 'active' });

    // Get stats for each app for this week
    const appStats = await Promise.all(
      apps.map(async (app) => {
        try {
          // Get events for this week
          const events = await db.getUsageEvents(app.slug, startOfWeek.toISOString());
          
          // Filter to only this week
          const weekEvents = events.filter(e => {
            const eventDate = new Date(e.timestamp);
            return eventDate >= startOfWeek && eventDate <= endOfWeek;
          });

          const totalEvents = weekEvents.length;
          const uniqueUsers = new Set(weekEvents.map(e => e.user).filter(Boolean)).size;
          const totalDuration = weekEvents.reduce((sum, e) => sum + (e.duration_ms || 0), 0);
          const avgDuration = totalEvents > 0 ? totalDuration / totalEvents : 0;

          // Calculate time saved if available
          let timeSaved = undefined;
          if (app.manual_time_seconds && app.automation_time_seconds) {
            const timeSavedPerEvent = (app.manual_time_seconds - app.automation_time_seconds) * 1000;
            timeSaved = {
              total_hours: (timeSavedPerEvent * totalEvents) / (1000 * 60 * 60),
              per_event_ms: timeSavedPerEvent
            };
          }

          return {
            app,
            weekEvents,
            stats: {
              totalEvents,
              uniqueUsers,
              avgDuration,
              timeSaved
            }
          };
        } catch (error) {
          console.error(`Error getting stats for app ${app.slug}:`, error);
          return {
            app,
            weekEvents: [],
            stats: {
              totalEvents: 0,
              uniqueUsers: 0,
              avgDuration: 0
            }
          };
        }
      })
    );

    // Daily breakdown for charts (Mon–Sun)
    const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const dailyBreakdown: Array<{ date: string; label: string; events: number; timeSavedHours: number }> = [];
    for (let d = 0; d < 7; d++) {
      const dayStart = new Date(startOfWeek);
      dayStart.setDate(dayStart.getDate() + d);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);
      let dayEvents = 0;
      let dayTimeSaved = 0;
      for (const a of appStats) {
        const weekEvents = (a as any).weekEvents as Array<{ timestamp: string }> | undefined;
        const eventsThisDay = (weekEvents || []).filter((e: { timestamp: string }) => {
          const t = new Date(e.timestamp);
          return t >= dayStart && t <= dayEnd;
        });
        dayEvents += eventsThisDay.length;
        const app = a.app;
        if (app.manual_time_seconds != null && app.automation_time_seconds != null) {
          const perEventMs = (app.manual_time_seconds - app.automation_time_seconds) * 1000;
          dayTimeSaved += (perEventMs * eventsThisDay.length) / (1000 * 60 * 60);
        }
      }
      dailyBreakdown.push({
        date: dayStart.toISOString().split('T')[0],
        label: dayLabels[d],
        events: dayEvents,
        timeSavedHours: Math.round(dayTimeSaved * 10) / 10
      });
    }

    // Calculate summary
    const totalEvents = appStats.reduce((sum, a) => sum + a.stats.totalEvents, 0);
    const allUsers = new Set<string>();
    appStats.forEach(a => {
      // We can't get unique users across apps from this data, so we'll use a sum
      // This is an approximation
    });
    const totalUniqueUsers = appStats.reduce((sum, a) => sum + a.stats.uniqueUsers, 0);
    const totalTimeSaved = appStats.reduce((sum, a) => sum + (a.stats.timeSaved?.total_hours || 0), 0);

    // Get dependency/vulnerability information from cache
    let dependencies = undefined;
    try {
      // Use cached dependency data (updated daily at 1 AM)
      const cachedData = db.getLatestDependencyCache();
      
      if (!cachedData) {
        console.log('[Weekly Report] No dependency cache found, skipping dependency data');
      } else {
        const depSummary = cachedData.data;
      
        // Map vulnerabilities to apps and recalculate counts for accuracy
        const appsWithVulns = new Map<string, { critical: number; high: number; medium: number; low: number; total: number }>();
        let totalCritical = 0, totalHigh = 0, totalMedium = 0, totalLow = 0;
        
        // Process applications and count vulnerabilities
        depSummary.applications.forEach((app: any) => {
          let critical = 0, high = 0, medium = 0, low = 0;
          
          const processVulnerabilities = (vulnerabilities: any[]) => {
            vulnerabilities.forEach((vuln: any) => {
              const normalizedSeverity = this.normalizeSeverity(vuln.severity || '');
              if (normalizedSeverity === 'critical') {
                critical++;
                totalCritical++;
              } else if (normalizedSeverity === 'high') {
                high++;
                totalHigh++;
              } else if (normalizedSeverity === 'medium') {
                medium++;
                totalMedium++;
              } else if (normalizedSeverity === 'low') {
                low++;
                totalLow++;
              } else if (vuln.severity) {
                // Log unknown severity for debugging
                console.warn(`[Weekly Reports] Unknown vulnerability severity: "${vuln.severity}" for ${vuln.package || 'unknown package'}`);
              }
            });
          };
          
          // Check frontend
          if (app.components?.frontend?.vulnerabilities) {
            processVulnerabilities(app.components.frontend.vulnerabilities);
          }
          
          // Check backend
          if (app.components?.backend?.vulnerabilities) {
            processVulnerabilities(app.components.backend.vulnerabilities);
          }
          
          // Check other components
          if (app.components?.other) {
            app.components.other.forEach((comp: any) => {
              if (comp.vulnerabilities) {
                processVulnerabilities(comp.vulnerabilities);
              }
            });
          }
          
          if (critical + high + medium + low > 0) {
            appsWithVulns.set(app.appName, {
              critical,
              high,
              medium,
              low,
              total: critical + high + medium + low
            });
          }
        });
        
        // Also check projects directly — but skip ones already counted via applications loop.
        // Projects attached to an app have `appName` set; standalone projects don't.
        if (depSummary.projects) {
          depSummary.projects.forEach((project: any) => {
            if (project.appName) return;
            if (project.vulnerabilities) {
              project.vulnerabilities.forEach((vuln: any) => {
                const normalizedSeverity = this.normalizeSeverity(vuln.severity || '');
                if (normalizedSeverity === 'critical') totalCritical++;
                else if (normalizedSeverity === 'high') totalHigh++;
                else if (normalizedSeverity === 'medium') totalMedium++;
                else if (normalizedSeverity === 'low') totalLow++;
              });
            }
          });
        }

        if (depSummary.pythonProjects) {
          depSummary.pythonProjects.forEach((project: any) => {
            if (project.appName) return;
            if (project.vulnerabilities) {
              project.vulnerabilities.forEach((vuln: any) => {
                const normalizedSeverity = this.normalizeSeverity(vuln.severity || '');
                if (normalizedSeverity === 'critical') totalCritical++;
                else if (normalizedSeverity === 'high') totalHigh++;
                else if (normalizedSeverity === 'medium') totalMedium++;
                else if (normalizedSeverity === 'low') totalLow++;
              });
            }
          });
        }

        const recalculatedTotal = totalCritical + totalHigh + totalMedium + totalLow;
        
        // Get vulnerability fixes for this week
        const weekStartStr = startOfWeek.toISOString().split('T')[0];
        const weekEndStr = endOfWeek.toISOString().split('T')[0];
        
        const fixes = db.getVulnerabilityFixes(weekStartStr, weekEndStr);
        const fixesThisWeek = fixes.map(fix => ({
          riskName: fix.title,
          risk: fix.severity,
          riskFix: fix.recommendation || fix.description || 'Fixed',
          appName: fix.appName,
          packageName: fix.packageName,
          fixedDate: fix.fixedDate
        }));
        
        // Get documented resolutions from markdown files
        const documentedResolutions = dependencyResolutionsService.getWeeklyResolutions(startOfWeek, endOfWeek);
        
        dependencies = {
          totalVulnerabilities: recalculatedTotal,
          criticalVulnerabilities: totalCritical,
          highVulnerabilities: totalHigh,
          mediumVulnerabilities: totalMedium,
          lowVulnerabilities: totalLow,
          totalProjects: depSummary.totalProjects,
          appsWithVulnerabilities: Array.from(appsWithVulns.entries()).map(([appName, counts]) => ({
            appName,
            ...counts
          })).sort((a, b) => b.total - a.total),
          cachedAt: cachedData.cached_at,
          fixesThisWeek,
          fixesCount: fixesThisWeek.length,
          documentedResolutions: documentedResolutions.map(r => ({
            id: r.id,
            date: r.date,
            appName: r.appName,
            packageName: r.packageName,
            severity: r.severity,
            title: r.title,
            description: r.description,
            fixedBy: r.fixedBy,
            relatedIssues: r.relatedIssues,
            verification: r.verification
          })),
          documentedResolutionsCount: documentedResolutions.length
        };
      }
    } catch (error) {
      console.error('Error fetching dependency information from cache:', error);
      // Don't fail the report if dependencies fail
    }

    return {
      weekStart: startOfWeek,
      weekEnd: endOfWeek,
      dailyBreakdown,
      apps: appStats
        .sort((a, b) => b.stats.totalEvents - a.stats.totalEvents)
        .map(({ app, stats }) => ({ app, stats })), // Sort by usage, omit weekEvents
      summary: {
        totalApps: apps.length,
        totalEvents,
        totalUniqueUsers,
        totalTimeSaved: totalTimeSaved > 0 ? totalTimeSaved : undefined
      },
      dependencies
    };
  }

  async generateWeeklyPDF(weekStart?: Date): Promise<Buffer> {
    const reportData = await this.getWeeklyReportData(weekStart);

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header
      doc.fontSize(24).text('Weekly Usage Report', { align: 'center' });
      doc.moveDown();
      
      const weekStartDate = new Date(reportData.weekStart);
      const weekEndDate = new Date(reportData.weekEnd);
      const weekStartStr = weekStartDate.toLocaleDateString('en-US', { 
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
      });
      const weekEndStr = weekEndDate.toLocaleDateString('en-US', { 
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
      });
      
      doc.fontSize(12).text(`Week: ${weekStartStr} - ${weekEndStr}`, { align: 'center' });
      doc.fontSize(10).text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
      doc.moveDown(2);

      // Summary Section
      doc.fontSize(16).text('Summary', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(11);
      doc.text(`Total Apps: ${reportData.summary.totalApps}`);
      doc.text(`Total Events: ${reportData.summary.totalEvents.toLocaleString()}`);
      doc.text(`Total Unique Users: ${reportData.summary.totalUniqueUsers}`);
      if (reportData.summary.totalTimeSaved) {
        doc.text(`Total Time Saved: ${reportData.summary.totalTimeSaved.toFixed(1)} hours`);
      }
      doc.moveDown(2);

      // Apps Section
      doc.fontSize(16).text('App Usage Breakdown', { underline: true });
      doc.moveDown(0.5);

      // Table header
      const tableTop = doc.y;
      const col1 = 50;
      const col2 = 300;
      const col3 = 400;
      const col4 = 500;
      const rowHeight = 20;

      doc.fontSize(10).font('Helvetica-Bold');
      doc.text('App Name', col1, tableTop);
      doc.text('Events', col2, tableTop);
      doc.text('Users', col3, tableTop);
      doc.text('Time Saved', col4, tableTop);
      
      // Draw line under header
      doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

      // Table rows
      let y = tableTop + 25;
      doc.font('Helvetica').fontSize(9);
      
      reportData.apps.forEach((appData, index) => {
        // Check if we need a new page
        if (y > 750) {
          doc.addPage();
          y = 50;
        }

        const appName = appData.app.name.length > 30 
          ? appData.app.name.substring(0, 27) + '...' 
          : appData.app.name;
        
        doc.text(appName, col1, y);
        doc.text(appData.stats.totalEvents.toLocaleString(), col2, y);
        doc.text(appData.stats.uniqueUsers.toString(), col3, y);
        
        if (appData.stats.timeSaved) {
          doc.text(`${appData.stats.timeSaved.total_hours.toFixed(1)}h`, col4, y);
        } else {
          doc.text('—', col4, y);
        }

        // Draw line under row
        doc.moveTo(50, y + 12).lineTo(550, y + 12).stroke();
        y += rowHeight;
      });

      // Detailed breakdown for top apps
      doc.addPage();
      doc.fontSize(16).text('Top Apps - Detailed Breakdown', { underline: true });
      doc.moveDown();

      const topApps = reportData.apps.slice(0, 10); // Top 10 apps
      topApps.forEach((appData, index) => {
        if (index > 0) doc.moveDown();
        
        doc.fontSize(12).font('Helvetica-Bold').text(`${index + 1}. ${appData.app.name}`);
        doc.font('Helvetica').fontSize(10);
        doc.text(`   Slug: ${appData.app.slug}`);
        doc.text(`   Total Events: ${appData.stats.totalEvents.toLocaleString()}`);
        doc.text(`   Unique Users: ${appData.stats.uniqueUsers}`);
        doc.text(`   Avg Duration: ${(appData.stats.avgDuration / 1000).toFixed(2)}s`);
        if (appData.stats.timeSaved) {
          doc.text(`   Time Saved: ${appData.stats.timeSaved.total_hours.toFixed(1)} hours`);
          doc.text(`   Time Saved per Event: ${(appData.stats.timeSaved.per_event_ms / 1000).toFixed(1)}s`);
        }
        
        if (appData.app.description) {
          doc.text(`   Description: ${appData.app.description}`);
        }
      });

      // Dependencies & Vulnerabilities Section
      if (reportData.dependencies) {
        doc.addPage();
        doc.fontSize(16).text('Dependencies & Vulnerabilities', { underline: true });
        doc.moveDown(0.5);
        
        doc.fontSize(11);
        doc.text(`Total Projects Scanned: ${reportData.dependencies.totalProjects}`);
        doc.text(`Total Vulnerabilities: ${reportData.dependencies.totalVulnerabilities}`);
        doc.moveDown(0.3);
        
        doc.font('Helvetica-Bold').fontSize(10);
        doc.text('Vulnerabilities by Severity:');
        doc.font('Helvetica').fontSize(10);
        doc.text(`  Critical: ${reportData.dependencies.criticalVulnerabilities}`);
        doc.text(`  High: ${reportData.dependencies.highVulnerabilities}`);
        doc.text(`  Medium: ${reportData.dependencies.mediumVulnerabilities}`);
        doc.text(`  Low: ${reportData.dependencies.lowVulnerabilities}`);
        doc.moveDown(0.5);
        
        if (reportData.dependencies.cachedAt) {
          doc.fontSize(9).text(`Last Scanned: ${new Date(reportData.dependencies.cachedAt).toLocaleString()}`, { align: 'left' });
          doc.moveDown(0.5);
        }
        
        // Apps with vulnerabilities
        if (reportData.dependencies.appsWithVulnerabilities.length > 0) {
          doc.moveDown(0.5);
          doc.fontSize(14).font('Helvetica-Bold').text('Apps with Vulnerabilities', { underline: true });
          doc.moveDown(0.3);
          
          // Table header
          const vulnTableTop = doc.y;
          const vulnCol1 = 50;
          const vulnCol2 = 200;
          const vulnCol3 = 280;
          const vulnCol4 = 340;
          const vulnCol5 = 400;
          const vulnCol6 = 480;
          const vulnRowHeight = 18;
          
          doc.fontSize(9).font('Helvetica-Bold');
          doc.text('App Name', vulnCol1, vulnTableTop);
          doc.text('Critical', vulnCol2, vulnTableTop);
          doc.text('High', vulnCol3, vulnTableTop);
          doc.text('Medium', vulnCol4, vulnTableTop);
          doc.text('Low', vulnCol5, vulnTableTop);
          doc.text('Total', vulnCol6, vulnTableTop);
          
          // Draw line under header
          doc.moveTo(50, vulnTableTop + 12).lineTo(550, vulnTableTop + 12).stroke();
          
          // Table rows
          let vulnY = vulnTableTop + 22;
          doc.font('Helvetica').fontSize(8);
          
          reportData.dependencies.appsWithVulnerabilities.slice(0, 20).forEach((appVuln) => {
            // Check if we need a new page
            if (vulnY > 750) {
              doc.addPage();
              vulnY = 50;
            }
            
            const appName = appVuln.appName.length > 20 
              ? appVuln.appName.substring(0, 17) + '...' 
              : appVuln.appName;
            
            doc.text(appName, vulnCol1, vulnY);
            doc.text(appVuln.critical.toString(), vulnCol2, vulnY);
            doc.text(appVuln.high.toString(), vulnCol3, vulnY);
            doc.text(appVuln.medium.toString(), vulnCol4, vulnY);
            doc.text(appVuln.low.toString(), vulnCol5, vulnY);
            doc.text(appVuln.total.toString(), vulnCol6, vulnY);
            
            // Draw line under row
            doc.moveTo(50, vulnY + 10).lineTo(550, vulnY + 10).stroke();
            vulnY += vulnRowHeight;
          });
        }
        
        // Vulnerability fixes this week
        if (reportData.dependencies.fixesThisWeek && reportData.dependencies.fixesThisWeek.length > 0) {
          doc.addPage();
          doc.fontSize(16).text('Vulnerability Fixes This Week', { underline: true });
          doc.moveDown(0.5);
          
          doc.fontSize(10);
          doc.text(`Total Fixes: ${reportData.dependencies.fixesCount}`);
          doc.moveDown(0.5);
          
          reportData.dependencies.fixesThisWeek.slice(0, 15).forEach((fix, index) => {
            if (index > 0) doc.moveDown(0.3);
            
            doc.fontSize(11).font('Helvetica-Bold').text(`${index + 1}. ${fix.riskName || fix.packageName}`);
            doc.font('Helvetica').fontSize(9);
            doc.text(`   App: ${fix.appName}`);
            doc.text(`   Package: ${fix.packageName}`);
            doc.text(`   Severity: ${fix.risk}`);
            if (fix.riskFix) {
              const fixText = fix.riskFix.length > 100 
                ? fix.riskFix.substring(0, 97) + '...' 
                : fix.riskFix;
              doc.text(`   Fix: ${fixText}`);
            }
            if (fix.fixedDate) {
              doc.text(`   Fixed: ${new Date(fix.fixedDate).toLocaleDateString()}`);
            }
          });
        }
        
        // Documented resolutions from markdown files
        if (reportData.dependencies.documentedResolutions && reportData.dependencies.documentedResolutions.length > 0) {
          doc.addPage();
          doc.fontSize(16).text('Documented Dependency Resolutions', { underline: true });
          doc.moveDown(0.5);
          
          doc.fontSize(10);
          doc.text(`Total Documented Resolutions: ${reportData.dependencies.documentedResolutionsCount}`);
          doc.moveDown(0.5);
          
          reportData.dependencies.documentedResolutions.slice(0, 20).forEach((resolution, index) => {
            if (index > 0) doc.moveDown(0.5);
            
            doc.fontSize(12).font('Helvetica-Bold').text(`${index + 1}. ${resolution.title}`);
            doc.font('Helvetica').fontSize(9);
            doc.text(`   Date: ${new Date(resolution.date).toLocaleDateString()}`);
            doc.text(`   App: ${resolution.appName}`);
            doc.text(`   Package: ${resolution.packageName}`);
            doc.text(`   Severity: ${resolution.severity.toUpperCase()}`);
            if (resolution.fixedBy) {
              doc.text(`   Fixed By: ${resolution.fixedBy}`);
            }
            
            // Add description (truncate if too long)
            if (resolution.description) {
              doc.moveDown(0.2);
              const descLines = resolution.description.split('\n').slice(0, 5); // First 5 lines
              descLines.forEach(line => {
                const cleanLine = line.trim().replace(/^[-*]\s*/, ''); // Remove markdown list markers
                if (cleanLine.length > 80) {
                  doc.text(`   ${cleanLine.substring(0, 77)}...`, { continued: false });
                } else {
                  doc.text(`   ${cleanLine}`, { continued: false });
                }
              });
              if (resolution.description.split('\n').length > 5) {
                doc.text('   ...', { continued: false });
              }
            }
            
            if (resolution.verification) {
              doc.moveDown(0.2);
              doc.font('Helvetica-Bold').fontSize(8).text('   Verification:', { continued: false });
              doc.font('Helvetica').fontSize(8);
              const verifyText = resolution.verification.length > 100 
                ? resolution.verification.substring(0, 97) + '...' 
                : resolution.verification;
              doc.text(`   ${verifyText}`, { continued: false });
            }
          });
        }
      }

      doc.end();
    });
  }

  async getDailyReportData(date?: Date): Promise<DailyReportData> {
    // Use provided date or today
    const reportDate = date || new Date();
    const startOfDay = new Date(reportDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(reportDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Get all active apps
    const apps = await db.getAllApps({ status: 'active' });

    // Get stats for each app for this day
    const appStats = await Promise.all(
      apps.map(async (app) => {
        try {
          // Get events for this day
          const events = await db.getUsageEvents(app.slug, startOfDay.toISOString());
          
          // Filter to only this day
          const dayEvents = events.filter(e => {
            const eventDate = new Date(e.timestamp);
            return eventDate >= startOfDay && eventDate <= endOfDay;
          });

          const totalEvents = dayEvents.length;
          const uniqueUsers = new Set(dayEvents.map(e => e.user).filter(Boolean)).size;
          const totalDuration = dayEvents.reduce((sum, e) => sum + (e.duration_ms || 0), 0);
          const avgDuration = totalEvents > 0 ? totalDuration / totalEvents : 0;

          // Calculate time saved if available
          let timeSaved = undefined;
          if (app.manual_time_seconds && app.automation_time_seconds) {
            const timeSavedPerEvent = (app.manual_time_seconds - app.automation_time_seconds) * 1000;
            timeSaved = {
              total_hours: (timeSavedPerEvent * totalEvents) / (1000 * 60 * 60),
              per_event_ms: timeSavedPerEvent
            };
          }

          // Get health status
          let healthStatus: 'healthy' | 'unhealthy' | 'unknown' | 'timeout' | 'error' | undefined = undefined;
          if (app.last_health_status) {
            healthStatus = app.last_health_status as any;
          }

          return {
            app,
            stats: {
              totalEvents,
              uniqueUsers,
              avgDuration,
              timeSaved
            },
            healthStatus
          };
        } catch (error) {
          console.error(`Error getting stats for app ${app.slug}:`, error);
          return {
            app,
            stats: {
              totalEvents: 0,
              uniqueUsers: 0,
              avgDuration: 0
            },
            healthStatus: 'unknown' as const
          };
        }
      })
    );

    // Calculate summary
    const totalEvents = appStats.reduce((sum, a) => sum + a.stats.totalEvents, 0);
    const totalUniqueUsers = appStats.reduce((sum, a) => sum + a.stats.uniqueUsers, 0);
    const totalTimeSaved = appStats.reduce((sum, a) => sum + (a.stats.timeSaved?.total_hours || 0), 0);
    
    // Health summary
    const healthyApps = appStats.filter(a => a.healthStatus === 'healthy').length;
    const unhealthyApps = appStats.filter(a => a.healthStatus === 'unhealthy' || a.healthStatus === 'error' || a.healthStatus === 'timeout').length;
    const unknownApps = appStats.filter(a => !a.healthStatus || a.healthStatus === 'unknown').length;

    // Get top services (sorted by events)
    const topServices = appStats
      .sort((a, b) => b.stats.totalEvents - a.stats.totalEvents)
      .slice(0, 10)
      .map(a => ({
        app: a.app,
        events: a.stats.totalEvents,
        timeSaved: a.stats.timeSaved?.total_hours
      }));

    // Calculate growth metrics
    const growth: DailyReportData['growth'] = {};

    // Day-over-day comparison
    const previousDay = new Date(startOfDay);
    previousDay.setDate(previousDay.getDate() - 1);
    const previousDayEnd = new Date(previousDay);
    previousDayEnd.setHours(23, 59, 59, 999);

    try {
      const previousDayEvents = await Promise.all(
        apps.map(async (app) => {
          const events = await db.getUsageEvents(app.slug, previousDay.toISOString());
          return events.filter(e => {
            const eventDate = new Date(e.timestamp);
            return eventDate >= previousDay && eventDate <= previousDayEnd;
          });
        })
      );
      const previousDayTotalEvents = previousDayEvents.reduce((sum, events) => sum + events.length, 0);
      
      // Calculate previous day time saved
      let previousDayTimeSaved = 0;
      for (let i = 0; i < apps.length; i++) {
        const app = apps[i];
        if (app.manual_time_seconds && app.automation_time_seconds) {
          const timeSavedPerEvent = (app.manual_time_seconds - app.automation_time_seconds) * 1000;
          previousDayTimeSaved += (timeSavedPerEvent * previousDayEvents[i].length) / (1000 * 60 * 60);
        }
      }

      if (previousDayTotalEvents > 0 || totalEvents > 0) {
        const eventsChange = totalEvents - previousDayTotalEvents;
        const eventsChangePercent = previousDayTotalEvents > 0 
          ? (eventsChange / previousDayTotalEvents) * 100 
          : totalEvents > 0 ? 100 : 0;
        
        const timeSavedChange = totalTimeSaved - previousDayTimeSaved;
        const timeSavedChangePercent = previousDayTimeSaved > 0
          ? (timeSavedChange / previousDayTimeSaved) * 100
          : totalTimeSaved > 0 ? 100 : 0;

        growth.dayOverDay = {
          eventsChange: Math.round(eventsChange),
          eventsChangePercent,
          timeSavedChange: Math.round(timeSavedChange),
          timeSavedChangePercent
        };
      }
    } catch (error) {
      console.error('Error calculating day-over-day growth:', error);
    }

    // Week-over-week comparison
    const previousWeek = new Date(startOfDay);
    previousWeek.setDate(previousWeek.getDate() - 7);
    const previousWeekEnd = new Date(previousWeek);
    previousWeekEnd.setHours(23, 59, 59, 999);

    try {
      const previousWeekEvents = await Promise.all(
        apps.map(async (app) => {
          const events = await db.getUsageEvents(app.slug, previousWeek.toISOString());
          return events.filter(e => {
            const eventDate = new Date(e.timestamp);
            return eventDate >= previousWeek && eventDate <= previousWeekEnd;
          });
        })
      );
      const previousWeekTotalEvents = previousWeekEvents.reduce((sum, events) => sum + events.length, 0);
      
      // Calculate previous week time saved
      let previousWeekTimeSaved = 0;
      for (let i = 0; i < apps.length; i++) {
        const app = apps[i];
        if (app.manual_time_seconds && app.automation_time_seconds) {
          const timeSavedPerEvent = (app.manual_time_seconds - app.automation_time_seconds) * 1000;
          previousWeekTimeSaved += (timeSavedPerEvent * previousWeekEvents[i].length) / (1000 * 60 * 60);
        }
      }

      if (previousWeekTotalEvents > 0 || totalEvents > 0) {
        const eventsChange = totalEvents - previousWeekTotalEvents;
        const eventsChangePercent = previousWeekTotalEvents > 0
          ? (eventsChange / previousWeekTotalEvents) * 100
          : totalEvents > 0 ? 100 : 0;
        
        const timeSavedChange = totalTimeSaved - previousWeekTimeSaved;
        const timeSavedChangePercent = previousWeekTimeSaved > 0
          ? (timeSavedChange / previousWeekTimeSaved) * 100
          : totalTimeSaved > 0 ? 100 : 0;

        growth.weekOverWeek = {
          eventsChange: Math.round(eventsChange),
          eventsChangePercent,
          timeSavedChange: Math.round(timeSavedChange),
          timeSavedChangePercent
        };
      }
    } catch (error) {
      console.error('Error calculating week-over-week growth:', error);
    }

    // Get dependency/vulnerability information from cache
    let dependencies = undefined;
    try {
      // Use cached dependency data (updated daily at 1 AM)
      const cachedData = db.getLatestDependencyCache();
      
      if (!cachedData) {
        console.log('[Daily Report] No dependency cache found, skipping dependency data');
      } else {
        const depSummary = cachedData.data;
      
      // Map vulnerabilities to apps and recalculate counts for accuracy
      const appsWithVulns = new Map<string, { critical: number; high: number; medium: number; low: number; total: number }>();
      let totalCritical = 0, totalHigh = 0, totalMedium = 0, totalLow = 0;
      
      // Process applications and count vulnerabilities
      depSummary.applications.forEach((app: any) => {
        let critical = 0, high = 0, medium = 0, low = 0;
        
        const processVulnerabilities = (vulnerabilities: any[]) => {
          vulnerabilities.forEach(vuln => {
            const normalizedSeverity = this.normalizeSeverity(vuln.severity || '');
            if (normalizedSeverity === 'critical') {
              critical++;
              totalCritical++;
            } else if (normalizedSeverity === 'high') {
              high++;
              totalHigh++;
            } else if (normalizedSeverity === 'medium') {
              medium++;
              totalMedium++;
            } else if (normalizedSeverity === 'low') {
              low++;
              totalLow++;
            } else if (vuln.severity) {
              // Log unknown severity for debugging
              console.warn(`[Reports] Unknown vulnerability severity: "${vuln.severity}" for ${vuln.package || 'unknown package'}`);
            }
          });
        };
        
        // Check frontend
        if (app.components?.frontend?.vulnerabilities) {
          processVulnerabilities(app.components.frontend.vulnerabilities);
        }
        
        // Check backend
        if (app.components?.backend?.vulnerabilities) {
          processVulnerabilities(app.components.backend.vulnerabilities);
        }
        
        // Check other components
        if (app.components?.other) {
          app.components.other.forEach((comp: any) => {
            if (comp.vulnerabilities) {
              processVulnerabilities(comp.vulnerabilities);
            }
          });
        }
        
        if (critical + high + medium + low > 0) {
          appsWithVulns.set(app.appName, {
            critical,
            high,
            medium,
            low,
            total: critical + high + medium + low
          });
        }
      });
      
      // Also check projects directly — but skip ones already counted via applications loop.
      // Projects attached to an app have `appName` set; standalone projects don't.
      if (depSummary.projects) {
        depSummary.projects.forEach((project: any) => {
          if (project.appName) return;
          if (project.vulnerabilities) {
            project.vulnerabilities.forEach((vuln: any) => {
              const normalizedSeverity = this.normalizeSeverity(vuln.severity || '');
              if (normalizedSeverity === 'critical') totalCritical++;
              else if (normalizedSeverity === 'high') totalHigh++;
              else if (normalizedSeverity === 'medium') totalMedium++;
              else if (normalizedSeverity === 'low') totalLow++;
            });
          }
        });
      }

        if (depSummary.pythonProjects) {
          depSummary.pythonProjects.forEach((project: any) => {
            if (project.appName) return;
            if (project.vulnerabilities) {
              project.vulnerabilities.forEach((vuln: any) => {
                const normalizedSeverity = this.normalizeSeverity(vuln.severity || '');
                if (normalizedSeverity === 'critical') totalCritical++;
                else if (normalizedSeverity === 'high') totalHigh++;
                else if (normalizedSeverity === 'medium') totalMedium++;
                else if (normalizedSeverity === 'low') totalLow++;
              });
            }
          });
        }
      
      const recalculatedTotal = totalCritical + totalHigh + totalMedium + totalLow;
      
        // Get vulnerability fixes for this week
        const weekStart = new Date(startOfDay);
        weekStart.setDate(weekStart.getDate() - 7); // Go back 7 days for "this week"
        const weekStartStr = weekStart.toISOString().split('T')[0];
        const todayStr = startOfDay.toISOString().split('T')[0];
        
        const fixes = db.getVulnerabilityFixes(weekStartStr, todayStr);
        const fixesThisWeek = fixes.map(fix => ({
          riskName: fix.title,
          risk: fix.severity,
          riskFix: fix.recommendation || fix.description || 'Fixed',
          appName: fix.appName,
          packageName: fix.packageName,
          fixedDate: fix.fixedDate
        }));
        
        dependencies = {
          totalVulnerabilities: recalculatedTotal,
          criticalVulnerabilities: totalCritical,
          highVulnerabilities: totalHigh,
          mediumVulnerabilities: totalMedium,
          lowVulnerabilities: totalLow,
          totalProjects: depSummary.totalProjects,
          appsWithVulnerabilities: Array.from(appsWithVulns.entries()).map(([appName, counts]) => ({
            appName,
            ...counts
          })).sort((a, b) => b.total - a.total),
          cachedAt: cachedData.cached_at,
          fixesThisWeek,
          fixesCount: fixesThisWeek.length
        } as any;
      }
    } catch (error) {
      console.error('Error fetching dependency information from cache:', error);
      // Don't fail the report if dependencies fail
    }

    // Generate detailed usage breakdown
    const sourceMap = new Map<string, number>();
    const hourMap = new Map<number, number>();
    
    // Collect all events for source and hour analysis
    for (const appStat of appStats) {
      const events = await db.getUsageEvents(appStat.app.slug, startOfDay.toISOString());
      const dayEvents = events.filter(e => {
        const eventDate = new Date(e.timestamp);
        return eventDate >= startOfDay && eventDate <= endOfDay;
      });
      
      dayEvents.forEach(e => {
        // Count by source
        const source = e.source || 'unknown';
        sourceMap.set(source, (sourceMap.get(source) || 0) + 1);
        
        // Count by hour
        const hour = new Date(e.timestamp).getHours();
        hourMap.set(hour, (hourMap.get(hour) || 0) + 1);
      });
    }
    
    const detailedUsage = {
      totalEvents,
      eventsByApp: appStats.map(a => ({
        appSlug: a.app.slug,
        appName: a.app.name,
        events: a.stats.totalEvents,
        uniqueUsers: a.stats.uniqueUsers,
        totalDuration: a.stats.avgDuration * a.stats.totalEvents,
        avgDuration: a.stats.avgDuration,
        timeSaved: a.stats.timeSaved?.total_hours
      })),
      eventsBySource: Array.from(sourceMap.entries())
        .map(([source, events]) => ({ source, events }))
        .sort((a, b) => b.events - a.events),
      eventsByHour: Array.from(hourMap.entries())
        .map(([hour, events]) => ({ hour, events }))
        .sort((a, b) => a.hour - b.hour)
    };

    return {
      date: startOfDay,
      apps: appStats.sort((a, b) => b.stats.totalEvents - a.stats.totalEvents),
      summary: {
        totalApps: apps.length,
        totalEvents,
        totalUniqueUsers,
        totalTimeSaved: totalTimeSaved > 0 ? totalTimeSaved : undefined,
        healthyApps,
        unhealthyApps,
        unknownApps
      },
      growth,
      topServices,
      dependencies,
      detailedUsage
    };
  }

  /**
   * Send daily report via email (optional implementation)
   * Requires email service configuration (e.g., nodemailer, SendGrid, etc.)
   */
  async sendDailyReportEmail(date?: Date, recipients?: string[]): Promise<void> {
    // TODO: Implement email delivery
    // This would require:
    // 1. Email service configuration (SMTP, SendGrid, etc.)
    // 2. Email template generation
    // 3. Recipient list management
    // 4. Scheduling (cron job integration)
    throw new Error('Email delivery not yet implemented. Configure email service to enable.');
  }

  /**
   * Send daily report via Slack (optional implementation)
   * Requires Slack webhook URL or Slack API token
   */
  async sendDailyReportSlack(date?: Date, webhookUrl?: string): Promise<void> {
    // TODO: Implement Slack delivery
    // This would require:
    // 1. Slack webhook URL or API token configuration
    // 2. Slack message formatting (blocks, attachments, etc.)
    // 3. Channel selection
    // 4. Scheduling (cron job integration)
    throw new Error('Slack delivery not yet implemented. Configure Slack webhook to enable.');
  }
}

export const reportsService = new ReportsService();

