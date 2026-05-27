import { Router, Request, Response } from 'express';
import { backupService } from '../services/backup';
import { db } from '../models/database';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const router = Router();

// Helper to ensure backup tables exist
function ensureBackupTables(): void {
  try {
    const dbInstance = db.getDb();
    const tableExists = dbInstance.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='backup_records'
    `).get();
    
    if (!tableExists) {
      console.log('[Backups] Creating backup tables...');
      // Try multiple possible paths for migrations directory
      const possiblePaths = [
        join(__dirname, '..', 'migrations', '010_backup_system.sql'),
        join(process.cwd(), 'src', 'migrations', '010_backup_system.sql'),
        join(process.cwd(), 'backend', 'src', 'migrations', '010_backup_system.sql'),
      ];
      
      let migrationPath: string | null = null;
      for (const path of possiblePaths) {
        if (existsSync(path)) {
          migrationPath = path;
          break;
        }
      }
      
      if (migrationPath) {
        const migrationSQL = readFileSync(migrationPath, 'utf-8');
        dbInstance.exec(migrationSQL);
        console.log('[Backups] Backup tables created successfully');
      } else {
        // Create tables directly if migration file not found
        console.log('[Backups] Migration file not found, creating tables directly...');
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
        console.log('[Backups] Backup tables created directly');
      }
    }
  } catch (error: any) {
    console.error('[Backups] Error ensuring backup tables:', error);
    // Don't throw - let the route handle it gracefully
  }
}

// Ensure tables exist on first route access
ensureBackupTables();

// GET /api/backups - Get all backups
router.get('/', async (req: Request, res: Response) => {
  try {
    ensureBackupTables(); // Ensure tables exist
    const limit = parseInt(req.query.limit as string) || 50;
    const appName = req.query.app as string | undefined;
    
    let backups = db.getBackups(limit, appName) || [];

    // If there are no rows in backup_records yet, fall back to latest backup report
    if (!backups.length) {
      const reports = db.getBackupReports(1);
      if (reports && reports.length > 0) {
        const latest = reports[0].report_data || reports[0];
        const reportBackups = (latest.backups || []) as any[];

        backups = reportBackups.map((b, idx) => ({
          id: reports[0].id ? reports[0].id * 100 + idx : idx,
          app_name: b.app,
          backup_path: b.path || null,
          backup_size: b.size || 0,
          backup_type: b.app === 'admin-center'
            ? 'sqlite'
            : (process.env.CCC_DB_URL?.startsWith('postgresql://') ? 'postgresql' : 'sqlite'),
          status: b.success ? 'success' : 'failed',
          error_message: b.error || null,
          created_at: latest.timestamp || reports[0].created_at || new Date().toISOString()
        }));
      }
    }

    res.json({ data: backups });
  } catch (error: any) {
    console.error('Error fetching backups:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch backups' });
  }
});

// GET /api/backups/reports - Get backup reports
router.get('/reports', async (req: Request, res: Response) => {
  try {
    ensureBackupTables();
    const limit = parseInt(req.query.limit as string) || 30;
    const reports = db.getBackupReports(limit);
    res.json({ data: reports });
  } catch (error: any) {
    console.error('Error fetching backup reports:', error);
    // Return empty array instead of 500
    res.json({ data: [] });
  }
});

// GET /api/backups/reports/:date - Get backup report for specific date
router.get('/reports/:date', async (req: Request, res: Response) => {
  try {
    ensureBackupTables();
    const { date } = req.params;
    const report = db.getBackupReportByDate(date);
    
    if (!report) {
      return res.status(404).json({ error: 'Report not found for this date' });
    }
    
    res.json({ data: report });
  } catch (error: any) {
    console.error('Error fetching backup report:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch backup report' });
  }
});

// POST /api/backups/trigger - Manually trigger backup
router.post('/trigger', async (req: Request, res: Response) => {
  try {
    ensureBackupTables();
    const results = await backupService.triggerBackup();
    res.json({ 
      message: 'Backup triggered successfully',
      data: results 
    });
  } catch (error: any) {
    console.error('Error triggering backup:', error);
    res.status(500).json({ error: error.message || 'Failed to trigger backup' });
  }
});

// GET /api/backups/stats - Get backup statistics
router.get('/stats', async (req: Request, res: Response) => {
  try {
    ensureBackupTables();
    let allBackups: any[] = [];
    
    try {
      allBackups = db.getBackups(1000) || [];
    } catch (err) {
      console.warn('Error getting backups from records, trying reports fallback:', err);
    }

    // If no rows in backup_records yet, fall back to latest backup report
    if (allBackups.length === 0) {
      try {
        const reports = db.getBackupReports(1);
        if (reports && reports.length > 0) {
          const latest = reports[0].report_data || reports[0];
          const summary = latest.summary || { total: 0, successful: 0, failed: 0, totalSize: 0 };
          const backups = latest.backups || [];

          const statsByApp = backups.map((b: any) => ({
            app: b.app,
            total: 1,
            successful: b.success ? 1 : 0,
            failed: b.success ? 0 : 1,
            totalSize: b.size || 0
          }));

          return res.json({
            data: {
              total: summary.total,
              successful: summary.successful,
              failed: summary.failed,
              totalSize: summary.totalSize || 0,
              byApp: statsByApp
            }
          });
        }
      } catch (reportErr) {
        console.warn('Error getting backup reports, using empty stats:', reportErr);
      }
    }

    const successful = allBackups.filter((b: any) => b.status === 'success');
    const failed = allBackups.filter((b: any) => b.status === 'failed');
    const totalSize = successful.reduce((sum: number, b: any) => sum + (b.backup_size || 0), 0);
    
    const apps = [...new Set(allBackups.map((b: any) => b.app_name))];
    const statsByApp = apps.map((app: string) => {
      const appBackups = allBackups.filter((b: any) => b.app_name === app);
      const appSuccessful = appBackups.filter((b: any) => b.status === 'success');
      return {
        app,
        total: appBackups.length,
        successful: appSuccessful.length,
        failed: appBackups.length - appSuccessful.length,
        totalSize: appSuccessful.reduce((sum: number, b: any) => sum + (b.backup_size || 0), 0)
      };
    });
    
    res.json({
      data: {
        total: allBackups.length,
        successful: successful.length,
        failed: failed.length,
        totalSize,
        byApp: statsByApp
      }
    });
  } catch (error: any) {
    console.error('Error fetching backup stats:', error);
    // Return empty stats instead of 500 error
    res.json({
      data: {
        total: 0,
        successful: 0,
        failed: 0,
        totalSize: 0,
        byApp: []
      }
    });
  }
});

export default router;
