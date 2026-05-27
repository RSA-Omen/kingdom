import { dependenciesService } from './dependencies';
import { logGuruService } from './logGuru';
import { backupService } from './backup';
import { githubSyncService } from './githubSync';
import { graylogSyncService } from './graylogSync';
import { httpErrorSyncService } from './httpErrorSync';
import { db } from '../models/database';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

class SchedulerService {
  private dependencyCheckInterval: NodeJS.Timeout | null = null;
  private logGuruScanInterval: NodeJS.Timeout | null = null;
  private githubSyncInterval: NodeJS.Timeout | null = null;
  private graylogSyncInterval: NodeJS.Timeout | null = null;
  private httpErrorSyncInterval: NodeJS.Timeout | null = null;
  private readonly DEPENDENCY_CHECK_HOUR = 1; // 1 AM
  private readonly DEPENDENCY_CHECK_MINUTE = 0;
  private readonly LOG_GURU_SCAN_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
  private readonly GITHUB_SYNC_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
  private readonly GRAYLOG_SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
  private readonly HTTP_ERROR_SYNC_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes

  /**
   * Calculate milliseconds until next 1 AM
   */
  private getMsUntilNextCheck(): number {
    const now = new Date();
    const nextCheck = new Date();
    nextCheck.setHours(this.DEPENDENCY_CHECK_HOUR, this.DEPENDENCY_CHECK_MINUTE, 0, 0);
    
    // If it's already past 1 AM today, schedule for tomorrow
    if (now >= nextCheck) {
      nextCheck.setDate(nextCheck.getDate() + 1);
    }
    
    return nextCheck.getTime() - now.getTime();
  }

  /**
   * Run dependency check and cache results
   */
  private async runDependencyCheck(): Promise<void> {
    try {
      console.log('[Scheduler] Starting scheduled dependency check at', new Date().toISOString());
      
      // Force refresh to get latest data
      const summary = await dependenciesService.getSummary(true);
      
      // Cache the results
      db.saveDependencyCache(summary);
      
      // Save vulnerability snapshot for tracking fixes
      const today = new Date().toISOString().split('T')[0];
      const vulnerabilities: Array<{
        appName: string;
        packageName: string;
        severity: string;
        title: string;
        description?: string;
        recommendation?: string;
        componentType?: string;
      }> = [];
      
      // Extract vulnerabilities from applications
      summary.applications.forEach(app => {
        const processComponent = (component: any, componentType: string) => {
          if (component && component.vulnerabilities) {
            component.vulnerabilities.forEach((vuln: any) => {
              vulnerabilities.push({
                appName: app.appName,
                packageName: vuln.package || 'unknown',
                severity: vuln.severity || 'unknown',
                title: vuln.title || 'Unknown vulnerability',
                description: vuln.description,
                recommendation: vuln.recommendation,
                componentType
              });
            });
          }
        };
        
        if (app.components) {
          if (app.components.frontend) processComponent(app.components.frontend, 'frontend');
          if (app.components.backend) processComponent(app.components.backend, 'backend');
          if (app.components.other) {
            app.components.other.forEach((comp: any) => processComponent(comp, 'other'));
          }
        }
      });
      
      // Save snapshot
      if (vulnerabilities.length > 0) {
        db.saveVulnerabilitySnapshot(today, vulnerabilities);
        
        // Mark vulnerabilities as fixed if they're no longer present
        db.markVulnerabilitiesFixed(today);
      }
      
      console.log('[Scheduler] Dependency check completed and cached:', {
        totalVulnerabilities: summary.totalVulnerabilities,
        totalProjects: summary.totalProjects,
        vulnerabilitiesTracked: vulnerabilities.length,
        cachedAt: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('[Scheduler] Error during dependency check:', error);
    }
  }

  /**
   * Schedule the next dependency check
   */
  private scheduleNextDependencyCheck(): void {
    const msUntilNext = this.getMsUntilNextCheck();
    const nextCheckDate = new Date(Date.now() + msUntilNext);
    
    console.log(`[Scheduler] Next dependency check scheduled for: ${nextCheckDate.toISOString()}`);
    
    // Clear existing interval if any
    if (this.dependencyCheckInterval) {
      clearTimeout(this.dependencyCheckInterval);
    }
    
    this.dependencyCheckInterval = setTimeout(() => {
      this.runDependencyCheck().finally(() => {
        // Schedule the next check after this one completes
        this.scheduleNextDependencyCheck();
      });
    }, msUntilNext);
  }

  /**
   * Initialize scheduler - run initial check if needed and schedule future checks
   */
  start(): void {
    console.log('[Scheduler] Starting scheduler service...');
    
    // Check if we have fresh cache, if not, run check immediately
    const hasFreshCache = db.isDependencyCacheFresh(24);
    
    if (!hasFreshCache) {
      console.log('[Scheduler] No fresh cache found, running initial dependency check...');
      // Run immediately, then schedule next
      this.runDependencyCheck().finally(() => {
        this.scheduleNextDependencyCheck();
      });
    } else {
      console.log('[Scheduler] Fresh cache found, scheduling next check...');
      // Just schedule the next check
      this.scheduleNextDependencyCheck();
    }
    
    // Start Log Guru scanning
    this.startLogGuruScanning();

    // Start GitHub Issues sync (every 30 min)
    this.startGitHubSync();

    // Start Graylog error sync (every 5 min)
    this.startGraylogSync();

    // Start HTTP error sync (every 2 min)
    this.startHttpErrorSync();

    // Start false positive cleanup (daily at 2 AM)
    this.scheduleFalsePositiveCleanup();
  }
  
  /**
   * Schedule false positive cleanup
   */
  private scheduleFalsePositiveCleanup(): void {
    const msUntilNext = this.getMsUntilNextCleanup();
    
    // Run cleanup at next scheduled time
    setTimeout(() => {
      this.cleanupOldFalsePositives();
    }, msUntilNext);
    
    console.log(`[Scheduler] False positive cleanup scheduled for ${new Date(Date.now() + msUntilNext).toISOString()}`);
  }
  
  /**
   * Calculate milliseconds until next cleanup time (2 AM)
   */
  private getMsUntilNextCleanup(): number {
    const now = new Date();
    const nextCleanup = new Date();
    nextCleanup.setHours(2, 0, 0, 0); // 2 AM
    
    // If it's already past 2 AM today, schedule for tomorrow
    if (now >= nextCleanup) {
      nextCleanup.setDate(nextCleanup.getDate() + 1);
    }
    
    return nextCleanup.getTime() - now.getTime();
  }
  
  /**
   * Clean up old false positives (run daily at 2 AM)
   */
  private async cleanupOldFalsePositives(): Promise<void> {
    try {
      console.log('[Scheduler] Starting cleanup of old false positives at', new Date().toISOString());
      const deletedCount = db.deleteOldFalsePositives(20); // 20 days
      console.log(`[Scheduler] Deleted ${deletedCount} false positives older than 20 days`);
      
      // Schedule next cleanup for tomorrow at 2 AM
      this.scheduleFalsePositiveCleanup();
    } catch (error: any) {
      console.error('[Scheduler] Error cleaning up old false positives:', error);
      // Still schedule next attempt
      this.scheduleFalsePositiveCleanup();
    }
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (this.dependencyCheckInterval) {
      clearTimeout(this.dependencyCheckInterval);
      this.dependencyCheckInterval = null;
    }
    this.stopLogGuruScanning();
    this.stopGitHubSync();
    this.stopGraylogSync();
    this.stopHttpErrorSync();
    backupService.stop();
    console.log('[Scheduler] Scheduler stopped');
  }

  /**
   * Scan logs for errors and analyze them (Log Guru)
   */
  private async runLogGuruScan(): Promise<void> {
    try {
      console.log('[Scheduler] Starting Log Guru scan at', new Date().toISOString());
      
      // Get all apps with containers
      const apps = db.getAllApps({ status: 'active' });
      const containerizedApps = apps.filter(app => app.container_name);
      
      let totalAnalyzed = 0;
      
      for (const app of containerizedApps) {
        try {
          const analyses = await logGuruService.scanAndAnalyzeLogs(app.slug, 200);
          totalAnalyzed += analyses.length;
          
          if (analyses.length > 0) {
            console.log(`[Scheduler] Analyzed ${analyses.length} new errors for ${app.name}`);
          }
          
          // Small delay between apps to avoid rate limits
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error: any) {
          console.error(`[Scheduler] Error scanning logs for ${app.name}:`, error.message);
        }
      }
      
      console.log(`[Scheduler] Log Guru scan completed. Analyzed ${totalAnalyzed} new errors across ${containerizedApps.length} apps`);
    } catch (error: any) {
      console.error('[Scheduler] Error during Log Guru scan:', error);
    }
  }

  /**
   * Start periodic Log Guru scanning
   */
  private startLogGuruScanning(): void {
    // Run initial scan after 1 minute (to let system settle)
    setTimeout(() => {
      this.runLogGuruScan();
    }, 60000);
    
    // Then run every 30 minutes
    this.logGuruScanInterval = setInterval(() => {
      this.runLogGuruScan();
    }, this.LOG_GURU_SCAN_INTERVAL_MS);
    
    console.log('[Scheduler] Log Guru scanning started (every 30 minutes)');
  }

  /**
   * Stop Log Guru scanning
   */
  private stopLogGuruScanning(): void {
    if (this.logGuruScanInterval) {
      clearInterval(this.logGuruScanInterval);
      this.logGuruScanInterval = null;
    }
  }


  /**
   * Manually trigger dependency check (for admin/API use)
   */
  async triggerDependencyCheck(): Promise<void> {
    await this.runDependencyCheck();
  }

  /**
   * Manually trigger Log Guru scan (for admin/API use)
   */
  async triggerLogGuruScan(): Promise<void> {
    await this.runLogGuruScan();
  }

  /**
   * Run database migrations on startup
   */
  runMigrations(): void {
    try {
      const dbInstance = db.getDb();
      // Get migrations directory - same approach as run.ts
      const migrationsDir = __dirname.replace(/services$/, 'migrations');
      
      // Run migration 002 if table doesn't exist
      const tableExists = dbInstance.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='dependency_cache'
      `).get();
      
      if (!tableExists) {
        console.log('[Scheduler] Running migration 002_dependency_cache.sql...');
        const migrationPath = join(migrationsDir, '002_dependency_cache.sql');
        
        if (existsSync(migrationPath)) {
          const migrationSQL = readFileSync(migrationPath, 'utf-8');
          dbInstance.exec(migrationSQL);
          console.log('[Scheduler] Migration 002 completed');
        } else {
          console.warn(`[Scheduler] Migration file not found at ${migrationPath}`);
        }
      } else {
        console.log('[Scheduler] Dependency cache table already exists');
      }
      
      // Check for vulnerability_history table
      const vulnTableExists = dbInstance.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='vulnerability_history'
      `).get();
      
      if (!vulnTableExists) {
        console.log('[Scheduler] Running migration 003_vulnerability_history.sql...');
        const migrationPath = join(migrationsDir, '003_vulnerability_history.sql');
        
        if (existsSync(migrationPath)) {
          const migrationSQL = readFileSync(migrationPath, 'utf-8');
          dbInstance.exec(migrationSQL);
          console.log('[Scheduler] Migration 003 completed');
        } else {
          console.warn(`[Scheduler] Migration file not found at ${migrationPath}`);
        }
      } else {
        console.log('[Scheduler] Vulnerability history table already exists');
      }
      
      // Check for dashboard_url column in apps table
      const columnExists = dbInstance.prepare(`
        SELECT name FROM pragma_table_info('apps')
        WHERE name = 'dashboard_url'
      `).get();
      
      if (!columnExists) {
        console.log('[Scheduler] Running migration 004_add_dashboard_url.sql...');
        const migrationPath = join(migrationsDir, '004_add_dashboard_url.sql');
        
        if (existsSync(migrationPath)) {
          const migrationSQL = readFileSync(migrationPath, 'utf-8');
          dbInstance.exec(migrationSQL);
          console.log('[Scheduler] Migration 004 completed');
        } else {
          console.warn(`[Scheduler] Migration file not found at ${migrationPath}`);
        }
      } else {
        console.log('[Scheduler] Dashboard URL column already exists');
      }
      
      // Check for log_analyses table
      const logAnalysesTableExists = dbInstance.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='log_analyses'
      `).get();
      
      if (!logAnalysesTableExists) {
        console.log('[Scheduler] Running migration 005_log_analyses.sql...');
        const migrationPath = join(migrationsDir, '005_log_analyses.sql');
        
        if (existsSync(migrationPath)) {
          const migrationSQL = readFileSync(migrationPath, 'utf-8');
          dbInstance.exec(migrationSQL);
          console.log('[Scheduler] Migration 005 completed');
        } else {
          console.warn(`[Scheduler] Migration file not found at ${migrationPath}`);
        }
      } else {
        console.log('[Scheduler] Log analyses table already exists');
      }
      
      // Check for error_hash column (migration 006)
      const errorHashColumnExists = dbInstance.prepare(`
        SELECT name FROM pragma_table_info('log_analyses')
        WHERE name = 'error_hash'
      `).get();
      
      if (!errorHashColumnExists) {
        console.log('[Scheduler] Running migration 006_add_error_grouping.sql...');
        const migrationPath = join(migrationsDir, '006_add_error_grouping.sql');
        
        if (existsSync(migrationPath)) {
          const migrationSQL = readFileSync(migrationPath, 'utf-8');
          dbInstance.exec(migrationSQL);
          console.log('[Scheduler] Migration 006 completed');
        } else {
          console.warn(`[Scheduler] Migration file not found at ${migrationPath}`);
        }
      } else {
        console.log('[Scheduler] Error grouping columns already exist');
      }
      
      // Check for error_name column (migration 007)
      const errorNameColumnExists = dbInstance.prepare(`
        SELECT name FROM pragma_table_info('log_analyses')
        WHERE name = 'error_name'
      `).get();
      
      if (!errorNameColumnExists) {
        console.log('[Scheduler] Running migration 007_add_error_name.sql...');
        const migrationPath = join(migrationsDir, '007_add_error_name.sql');
        
        if (existsSync(migrationPath)) {
          const migrationSQL = readFileSync(migrationPath, 'utf-8');
          dbInstance.exec(migrationSQL);
          console.log('[Scheduler] Migration 007 completed');
        } else {
          console.warn(`[Scheduler] Migration file not found at ${migrationPath}`);
        }
      } else {
        console.log('[Scheduler] Error name column already exists');
      }
      
      // Check for error_timestamp column (migration 008)
      const errorTimestampColumnExists = dbInstance.prepare(`
        SELECT name FROM pragma_table_info('log_analyses')
        WHERE name = 'error_timestamp'
      `).get();
      
      if (!errorTimestampColumnExists) {
        console.log('[Scheduler] Running migration 008_add_error_timestamp.sql...');
        const migrationPath = join(migrationsDir, '008_add_error_timestamp.sql');
        
        if (existsSync(migrationPath)) {
          const migrationSQL = readFileSync(migrationPath, 'utf-8');
          dbInstance.exec(migrationSQL);
          console.log('[Scheduler] Migration 008 completed');
        } else {
          console.warn(`[Scheduler] Migration file not found at ${migrationPath}`);
        }
      } else {
        console.log('[Scheduler] Error timestamp column already exists');
      }
      
      // Check for burst tracking columns (migration 009)
      const firstOccurrenceColumnExists = dbInstance.prepare(`
        SELECT name FROM pragma_table_info('log_analyses')
        WHERE name = 'first_occurrence_time'
      `).get();
      
      if (!firstOccurrenceColumnExists) {
        console.log('[Scheduler] Running migration 009_add_burst_tracking.sql...');
        const migrationPath = join(migrationsDir, '009_add_burst_tracking.sql');
        
        if (existsSync(migrationPath)) {
          const migrationSQL = readFileSync(migrationPath, 'utf-8');
          dbInstance.exec(migrationSQL);
          console.log('[Scheduler] Migration 009 completed');
        } else {
          console.warn(`[Scheduler] Migration file not found at ${migrationPath}`);
        }
      } else {
        console.log('[Scheduler] Burst tracking columns already exist');
      }
      
      // Check for backup_records table (migration 010)
      const backupRecordsTableExists = dbInstance.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='backup_records'
      `).get();
      
      if (!backupRecordsTableExists) {
        console.log('[Scheduler] Running migration 010_backup_system.sql...');
        const migrationPath = join(migrationsDir, '010_backup_system.sql');
        
        if (existsSync(migrationPath)) {
          const migrationSQL = readFileSync(migrationPath, 'utf-8');
          dbInstance.exec(migrationSQL);
          console.log('[Scheduler] Migration 010 completed');
        } else {
          console.warn(`[Scheduler] Migration file not found at ${migrationPath}`);
        }
      } else {
        console.log('[Scheduler] Backup system tables already exist');
      }

      // Check for errors table (migration 012)
      const errorsTableExists = dbInstance.prepare(`
        SELECT name FROM sqlite_master
        WHERE type='table' AND name='errors'
      `).get();

      if (!errorsTableExists) {
        console.log('[Scheduler] Running migration 012_errors_and_todos.sql...');
        const migrationPath = join(migrationsDir, '012_errors_and_todos.sql');

        if (existsSync(migrationPath)) {
          const migrationSQL = readFileSync(migrationPath, 'utf-8');
          dbInstance.exec(migrationSQL);
          console.log('[Scheduler] Migration 012 completed');
        } else {
          console.warn(`[Scheduler] Migration file not found at ${migrationPath}`);
        }
      } else {
        console.log('[Scheduler] Errors and todos tables already exist');
      }

      // Check for external_url column on todos (migration 013)
      const externalUrlColumnExists = dbInstance.prepare(`
        SELECT name FROM pragma_table_info('todos')
        WHERE name = 'external_url'
      `).get();

      if (!externalUrlColumnExists) {
        console.log('[Scheduler] Running migration 013_github_sync.sql...');
        const migrationPath = join(migrationsDir, '013_github_sync.sql');

        if (existsSync(migrationPath)) {
          const migrationSQL = readFileSync(migrationPath, 'utf-8');
          dbInstance.exec(migrationSQL);
          console.log('[Scheduler] Migration 013 completed');
        } else {
          console.warn(`[Scheduler] Migration file not found at ${migrationPath}`);
        }
      } else {
        console.log('[Scheduler] GitHub sync columns already exist');
      }

      // Check for checkpoint_events table (migration 019)
      const checkpointEventsTableExists = dbInstance.prepare(`
        SELECT name FROM sqlite_master
        WHERE type='table' AND name='checkpoint_events'
      `).get();

      if (!checkpointEventsTableExists) {
        console.log('[Scheduler] Running migration 019_checkpoint_events.sql...');
        const migrationPath = join(migrationsDir, '019_checkpoint_events.sql');

        if (existsSync(migrationPath)) {
          const migrationSQL = readFileSync(migrationPath, 'utf-8');
          dbInstance.exec(migrationSQL);
          console.log('[Scheduler] Migration 019 completed');
        } else {
          console.warn(`[Scheduler] Migration file not found at ${migrationPath}`);
        }
      } else {
        console.log('[Scheduler] Checkpoint events table already exists');
      }
    } catch (error: any) {
      console.error('[Scheduler] Error running migrations:', error);
    }
  }

  /**
   * Start periodic GitHub Issues sync (every 30 minutes)
   */
  private startGitHubSync(): void {
    // Run initial sync after 90 seconds (let app settle, after Log Guru's 60s)
    setTimeout(() => {
      githubSyncService.sync('scheduled').catch(e =>
        console.error('[Scheduler] Initial GitHub sync failed:', e.message || e)
      );
    }, 90000);

    this.githubSyncInterval = setInterval(() => {
      githubSyncService.sync('scheduled').catch(e =>
        console.error('[Scheduler] Scheduled GitHub sync failed:', e.message || e)
      );
    }, this.GITHUB_SYNC_INTERVAL_MS);

    console.log('[Scheduler] GitHub Issues sync started (every 30 minutes)');
  }

  private stopGitHubSync(): void {
    if (this.githubSyncInterval) {
      clearInterval(this.githubSyncInterval);
      this.githubSyncInterval = null;
    }
  }

  /**
   * Start periodic Graylog error sync (every 5 minutes)
   */
  private startGraylogSync(): void {
    // Run initial sync after 120 seconds (let app settle)
    setTimeout(() => {
      graylogSyncService.sync().catch(e =>
        console.error('[Scheduler] Initial Graylog sync failed:', e.message || e)
      );
    }, 120000);

    this.graylogSyncInterval = setInterval(() => {
      graylogSyncService.sync().catch(e =>
        console.error('[Scheduler] Scheduled Graylog sync failed:', e.message || e)
      );
    }, this.GRAYLOG_SYNC_INTERVAL_MS);

    console.log('[Scheduler] Graylog error sync started (every 5 minutes)');
  }

  private stopGraylogSync(): void {
    if (this.graylogSyncInterval) {
      clearInterval(this.graylogSyncInterval);
      this.graylogSyncInterval = null;
    }
  }

  private startHttpErrorSync(): void {
    // Run initial sync after 180 seconds (let app settle)
    setTimeout(() => {
      httpErrorSyncService.sync().catch(e =>
        console.error('[Scheduler] Initial HTTP error sync failed:', e.message || e)
      );
    }, 180000);

    this.httpErrorSyncInterval = setInterval(() => {
      httpErrorSyncService.sync().catch(e =>
        console.error('[Scheduler] Scheduled HTTP error sync failed:', e.message || e)
      );
    }, this.HTTP_ERROR_SYNC_INTERVAL_MS);

    console.log('[Scheduler] HTTP error sync started (every 2 minutes)');
  }

  private stopHttpErrorSync(): void {
    if (this.httpErrorSyncInterval) {
      clearInterval(this.httpErrorSyncInterval);
      this.httpErrorSyncInterval = null;
    }
  }
}

export const schedulerService = new SchedulerService();

