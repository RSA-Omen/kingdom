import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, mkdirSync, readdirSync, statSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { db } from '../models/database';

const execAsync = promisify(exec);

interface BackupConfig {
  databaseType: 'sqlite' | 'postgresql';
  databasePath?: string; // For SQLite
  connectionString?: string; // For PostgreSQL
  backupDir: string;
  appName: string;
}

interface BackupResult {
  success: boolean;
  backupPath?: string;
  error?: string;
  size?: number;
  timestamp: string;
}

class BackupService {
  private backupInterval: NodeJS.Timeout | null = null;
  private readonly BACKUP_HOUR = 1; // 1 AM
  private readonly BACKUP_MINUTE = 0;
  private readonly BACKUP_DIR = process.env.BACKUP_DIR || join(process.cwd(), '..', 'data', 'backups');
  private readonly AUSTRALIA_TIMEZONE = 'Australia/Sydney';

  constructor() {
    // Ensure backup directory exists
    if (!existsSync(this.BACKUP_DIR)) {
      mkdirSync(this.BACKUP_DIR, { recursive: true });
    }
    
    // Ensure backup tables exist
    this.ensureBackupTables();
  }
  
  /**
   * Ensure backup tables exist in database
   */
  private ensureBackupTables(): void {
    try {
      const dbInstance = db.getDb();
      const tableExists = dbInstance.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='backup_records'
      `).get();
      
      if (!tableExists) {
        console.log('[Backup] Creating backup tables...');
        // Create tables directly
        dbInstance.exec(`
          CREATE TABLE IF NOT EXISTS backup_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            app_name TEXT NOT NULL,
            backup_path TEXT,
            backup_size INTEGER DEFAULT 0,
            backup_type TEXT NOT NULL,
            status TEXT NOT NULL,
            error_message TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
          );
          CREATE TABLE IF NOT EXISTS backup_reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            report_date TEXT NOT NULL,
            report_data TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(report_date)
          );
          CREATE INDEX IF NOT EXISTS idx_backup_records_app_date ON backup_records(app_name, created_at);
          CREATE INDEX IF NOT EXISTS idx_backup_records_status ON backup_records(status);
          CREATE INDEX IF NOT EXISTS idx_backup_reports_date ON backup_reports(report_date);
        `);
        console.log('[Backup] Backup tables created successfully');
      }
    } catch (error: any) {
      console.error('[Backup] Error ensuring backup tables:', error);
    }
  }

  /**
   * Calculate milliseconds until next 1 AM Australia time
   * Uses a simple approach: get current Australia time, calculate next 1 AM, then find UTC equivalent
   */
  private getMsUntilNextBackup(): number {
    const now = new Date();
    
    // Get current time in Australia timezone as a string
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: this.AUSTRALIA_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    
    const parts = formatter.formatToParts(now);
    const getPart = (type: string) => parts.find(p => p.type === type)?.value || '0';
    
    const ausYear = parseInt(getPart('year'), 10);
    const ausMonth = parseInt(getPart('month'), 10) - 1;
    const ausDay = parseInt(getPart('day'), 10);
    const ausHour = parseInt(getPart('hour'), 10);
    const ausMinute = parseInt(getPart('minute'), 10);
    
    // Calculate target date (today or tomorrow)
    let targetYear = ausYear;
    let targetMonth = ausMonth;
    let targetDay = ausDay;
    
    if (ausHour >= this.BACKUP_HOUR || (ausHour === this.BACKUP_HOUR && ausMinute >= this.BACKUP_MINUTE)) {
      // Already past 1 AM, schedule for tomorrow
      const tomorrow = new Date(ausYear, ausMonth, ausDay + 1);
      targetYear = tomorrow.getFullYear();
      targetMonth = tomorrow.getMonth();
      targetDay = tomorrow.getDate();
    }
    
    // Create a date string representing 1 AM in Australia timezone
    // We'll create multiple UTC candidates and test which one gives us 1 AM in Australia
    const targetDateStr = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}T${String(this.BACKUP_HOUR).padStart(2, '0')}:${String(this.BACKUP_MINUTE).padStart(2, '0')}:00`;
    
    // Australia/Sydney is UTC+10 or UTC+11 (DST)
    // Try different UTC offsets to find the right one
    // Start with UTC+10 (36000 seconds)
    let utcTarget = new Date(`${targetDateStr}+10:00`);
    
    // Verify and adjust if needed
    let attempts = 0;
    while (attempts < 5) {
      const testAusTime = formatter.formatToParts(utcTarget);
      const testHour = parseInt(testAusTime.find(p => p.type === 'hour')?.value || '0', 10);
      const testMinute = parseInt(testAusTime.find(p => p.type === 'minute')?.value || '0', 10);
      
      if (testHour === this.BACKUP_HOUR && testMinute === this.BACKUP_MINUTE) {
        break;
      }
      
      // Adjust by the difference
      const hourDiff = this.BACKUP_HOUR - testHour;
      const minuteDiff = this.BACKUP_MINUTE - testMinute;
      utcTarget = new Date(utcTarget.getTime() + (hourDiff * 60 + minuteDiff) * 60 * 1000);
      attempts++;
    }
    
    return Math.max(0, utcTarget.getTime() - now.getTime());
  }

  /**
   * Backup SQLite database
   */
  private async backupSQLite(databasePath: string, backupDir: string, appName: string): Promise<BackupResult> {
    try {
      if (!existsSync(databasePath)) {
        return {
          success: false,
          error: `Database file not found: ${databasePath}`,
          timestamp: new Date().toISOString()
        };
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
      const backupFilename = `${appName}_backup_${timestamp}.db`;
      const backupPath = join(backupDir, backupFilename);

      // Use SQLite backup API
      const sqlite3 = require('better-sqlite3');
      const sourceDb = sqlite3(databasePath);
      const backupDb = sqlite3(backupPath);
      
      sourceDb.backup(backupDb);
      sourceDb.close();
      backupDb.close();

      const size = statSync(backupPath).size;

      return {
        success: true,
        backupPath,
        size,
        timestamp: new Date().toISOString()
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Backup PostgreSQL database
   */
  private async backupPostgreSQL(connectionString: string, backupDir: string, appName: string): Promise<BackupResult> {
    try {
      // Parse connection string
      const url = new URL(connectionString.replace('postgresql://', 'http://'));
      const dbName = url.pathname.slice(1);
      const host = url.hostname;
      const port = url.port || '5432';
      const user = url.username;
      const password = url.password;

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
      const backupFilename = `${appName}_backup_${timestamp}.sql`;
      const backupPath = join(backupDir, backupFilename);

      // Use pg_dump
      const env = { ...process.env, PGPASSWORD: password };
      const command = `pg_dump -h ${host} -p ${port} -U ${user} -d ${dbName} -F c -f "${backupPath}"`;

      await execAsync(command, { env, maxBuffer: 1024 * 1024 * 100 }); // 100MB buffer

      const size = statSync(backupPath).size;

      return {
        success: true,
        backupPath,
        size,
        timestamp: new Date().toISOString()
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Backup admin center database
   */
  private async backupAdminCenter(): Promise<BackupResult> {
    const dbPath = process.env.DB_PATH || join(process.cwd(), '..', 'data', 'app-registry.db');
    return this.backupSQLite(dbPath, this.BACKUP_DIR, 'admin-center');
  }

  /**
   * Backup Gekko Tracks database
   */
  private async backupGekkoTracks(): Promise<BackupResult> {
    const cccDbUrl = process.env.CCC_DB_URL;
    
    if (cccDbUrl && cccDbUrl.startsWith('postgresql://')) {
      return this.backupPostgreSQL(cccDbUrl, this.BACKUP_DIR, 'gekko-tracks');
    } else {
      // SQLite fallback – use known absolute path so we always hit the real GT DB
      const dbPath =
        process.env.CCC_DB_PATH ||
        '/home/lauchlandupreez/Operations/Gekko-Tracks/backend/ccc.db';
      return this.backupSQLite(dbPath, this.BACKUP_DIR, 'gekko-tracks');
    }
  }

  /**
   * Run all backups
   */
  private async runBackups(): Promise<void> {
    try {
      console.log('[Backup] Starting scheduled backups at', new Date().toISOString());
      
      const results: Array<{ app: string; result: BackupResult }> = [];

      // Backup admin center
      const adminResult = await this.backupAdminCenter();
      results.push({ app: 'admin-center', result: adminResult });

      // Backup Gekko Tracks
      const gekkoResult = await this.backupGekkoTracks();
      results.push({ app: 'gekko-tracks', result: gekkoResult });

      // Save backup records to database
      for (const { app, result } of results) {
        if (result.success) {
          db.saveBackupRecord({
            app_name: app,
            backup_path: result.backupPath!,
            backup_size: result.size!,
            backup_type: app === 'admin-center' ? 'sqlite' : (process.env.CCC_DB_URL?.startsWith('postgresql://') ? 'postgresql' : 'sqlite'),
            status: 'success',
            created_at: result.timestamp
          });
        } else {
          db.saveBackupRecord({
            app_name: app,
            backup_path: null,
            backup_size: 0,
            backup_type: 'unknown',
            status: 'failed',
            error_message: result.error,
            created_at: result.timestamp
          });
        }
      }

      // Generate daily report
      await this.generateDailyReport(results);

      console.log('[Backup] Backups completed:', {
        successful: results.filter(r => r.result.success).length,
        failed: results.filter(r => !r.result.success).length,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('[Backup] Error during backup:', error);
    }
  }

  /**
   * Generate daily backup report
   */
  private async generateDailyReport(results: Array<{ app: string; result: BackupResult }>): Promise<void> {
    try {
      const reportDate = new Date().toISOString().split('T')[0];
      const report = {
        date: reportDate,
        timestamp: new Date().toISOString(),
        timezone: this.AUSTRALIA_TIMEZONE,
        backups: results.map(({ app, result }) => ({
          app,
          success: result.success,
          size: result.size || 0,
          error: result.error || null,
          path: result.backupPath || null
        })),
        summary: {
          total: results.length,
          successful: results.filter(r => r.result.success).length,
          failed: results.filter(r => !r.result.success).length,
          totalSize: results.reduce((sum, r) => sum + (r.result.size || 0), 0)
        }
      };

      // Save report to database
      db.saveBackupReport(report);

      // Also save as JSON file for easy access
      const reportPath = join(this.BACKUP_DIR, `backup_report_${reportDate}.json`);
      writeFileSync(reportPath, JSON.stringify(report, null, 2));

      console.log('[Backup] Daily report generated:', reportPath);
    } catch (error: any) {
      console.error('[Backup] Error generating daily report:', error);
    }
  }

  /**
   * Schedule the next backup
   */
  private scheduleNextBackup(): void {
    const msUntilNext = this.getMsUntilNextBackup();
    const nextBackupDate = new Date(Date.now() + msUntilNext);
    
    console.log(`[Backup] Next backup scheduled for: ${nextBackupDate.toISOString()} (Australia time: 1 AM)`);
    
    // Clear existing interval if any
    if (this.backupInterval) {
      clearTimeout(this.backupInterval);
    }
    
    this.backupInterval = setTimeout(() => {
      this.runBackups().finally(() => {
        // Schedule the next backup after this one completes
        this.scheduleNextBackup();
      });
    }, msUntilNext);
  }

  /**
   * Start backup scheduler
   */
  start(): void {
    console.log('[Backup] Starting backup service...');
    
    // Run initial backup if needed (check if we have a backup today)
    const today = new Date().toISOString().split('T')[0];
    const hasBackupToday = db.hasBackupToday(today);
    
    if (!hasBackupToday) {
      console.log('[Backup] No backup found for today, running initial backup...');
      this.runBackups().finally(() => {
        this.scheduleNextBackup();
      });
    } else {
      console.log('[Backup] Backup already exists for today, scheduling next backup...');
      this.scheduleNextBackup();
    }
  }

  /**
   * Stop backup scheduler
   */
  stop(): void {
    if (this.backupInterval) {
      clearTimeout(this.backupInterval);
      this.backupInterval = null;
    }
    console.log('[Backup] Backup service stopped');
  }

  /**
   * Manually trigger backup (for admin/API use)
   */
  async triggerBackup(): Promise<Array<{ app: string; result: BackupResult }>> {
    await this.runBackups();
    const today = new Date().toISOString().split('T')[0];
    return db.getBackupsByDate(today).map(b => ({
      app: b.app_name,
      result: {
        success: b.status === 'success',
        backupPath: b.backup_path || undefined,
        size: b.backup_size || undefined,
        error: b.error_message || undefined,
        timestamp: b.created_at
      }
    }));
  }

  /**
   * Get backup directory path
   */
  getBackupDir(): string {
    return this.BACKUP_DIR;
  }
}

export const backupService = new BackupService();
