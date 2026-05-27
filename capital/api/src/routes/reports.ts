import { Router, Request, Response } from 'express';
import { reportsService } from '../services/reports';
import { schedulerService } from '../services/scheduler';

const router = Router();

// GET /api/reports/weekly - Get weekly report data (JSON)
router.get('/weekly', async (req: Request, res: Response) => {
  try {
    const weekStart = req.query.weekStart 
      ? new Date(req.query.weekStart as string)
      : undefined;
    
    const reportData = await reportsService.getWeeklyReportData(weekStart);
    res.json(reportData);
  } catch (error: any) {
    console.error('Error generating weekly report:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/reports/weekly/pdf - Generate and download weekly PDF report
router.get('/weekly/pdf', async (req: Request, res: Response) => {
  try {
    const weekStart = req.query.weekStart 
      ? new Date(req.query.weekStart as string)
      : undefined;
    
    const pdfBuffer = await reportsService.generateWeeklyPDF(weekStart);
    
    // Set headers for PDF download
    const weekStartDate = weekStart || new Date();
    const weekStartStr = weekStartDate.toISOString().split('T')[0];
    const filename = `weekly-usage-report-${weekStartStr}.pdf`;
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length.toString());
    
    res.send(pdfBuffer);
  } catch (error: any) {
    console.error('Error generating PDF report:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/reports/daily - Get daily report data (JSON)
router.get('/daily', async (req: Request, res: Response) => {
  try {
    const date = req.query.date 
      ? new Date(req.query.date as string)
      : undefined;
    
    const reportData = await reportsService.getDailyReportData(date);
    res.json(reportData);
  } catch (error: any) {
    console.error('Error generating daily report:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/reports/daily/email - Send daily report via email (optional)
router.post('/daily/email', async (req: Request, res: Response) => {
  try {
    const date = req.body.date ? new Date(req.body.date as string) : undefined;
    const recipients = req.body.recipients as string[] | undefined;
    
    await reportsService.sendDailyReportEmail(date, recipients);
    res.json({ message: 'Daily report sent via email' });
  } catch (error: any) {
    console.error('Error sending daily report email:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/reports/daily/slack - Send daily report via Slack (optional)
router.post('/daily/slack', async (req: Request, res: Response) => {
  try {
    const date = req.body.date ? new Date(req.body.date as string) : undefined;
    const webhookUrl = req.body.webhookUrl as string | undefined;
    
    await reportsService.sendDailyReportSlack(date, webhookUrl);
    res.json({ message: 'Daily report sent via Slack' });
  } catch (error: any) {
    console.error('Error sending daily report to Slack:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/reports/dependencies/refresh - Manually trigger dependency cache refresh
router.post('/dependencies/refresh', async (req: Request, res: Response) => {
  try {
    await schedulerService.triggerDependencyCheck();
    res.json({ 
      message: 'Dependency cache refreshed successfully',
      cachedAt: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error refreshing dependency cache:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/reports/daily/export - Export detailed usage data (CSV or JSON)
router.get('/daily/export', async (req: Request, res: Response) => {
  try {
    const date = req.query.date ? new Date(req.query.date as string) : undefined;
    const format = (req.query.format as string) || 'json'; // 'json' or 'csv'
    
    const reportData = await reportsService.getDailyReportData(date);
    
    if (!reportData.detailedUsage) {
      return res.status(404).json({ error: 'Detailed usage data not available' });
    }
    
    if (format === 'csv') {
      // Generate CSV
      const csvRows: string[] = [];
      
      // Header
      csvRows.push('App Slug,App Name,Events,Unique Users,Total Duration (ms),Avg Duration (ms),Time Saved (hours)');
      
      // Data rows
      reportData.detailedUsage.eventsByApp.forEach(app => {
        csvRows.push([
          app.appSlug,
          `"${app.appName.replace(/"/g, '""')}"`,
          app.events,
          app.uniqueUsers,
          app.totalDuration,
          app.avgDuration,
          app.timeSaved || ''
        ].join(','));
      });
      
      // Events by source
      csvRows.push('');
      csvRows.push('Source,Events');
      reportData.detailedUsage.eventsBySource.forEach(item => {
        csvRows.push([item.source, item.events].join(','));
      });
      
      // Events by hour
      csvRows.push('');
      csvRows.push('Hour,Events');
      reportData.detailedUsage.eventsByHour.forEach(item => {
        csvRows.push([item.hour, item.events].join(','));
      });
      
      const csv = csvRows.join('\n');
      const dateStr = date ? new Date(date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="daily-usage-${dateStr}.csv"`);
      res.send(csv);
    } else {
      // Return JSON
      const dateStr = date ? new Date(date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="daily-usage-${dateStr}.json"`);
      res.json(reportData.detailedUsage);
    }
  } catch (error: any) {
    console.error('Error exporting daily report:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;










