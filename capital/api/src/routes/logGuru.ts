import { Router, Request, Response } from 'express';
import { logGuruService } from '../services/logGuru';
import { schedulerService } from '../services/scheduler';
import { db } from '../models/database';
import { fileService } from '../services/fileService';

const router = Router();

// GET /api/log-guru/analyses - Get all log analyses
router.get('/analyses', async (req: Request, res: Response) => {
  try {
    const appSlug = req.query.app_slug as string | undefined;
    const isRealIssue = req.query.is_real_issue !== undefined 
      ? parseInt(req.query.is_real_issue as string, 10) 
      : undefined;
    const grouped = req.query.grouped === 'true';
    
    const analyses = await logGuruService.getAnalyses(appSlug, isRealIssue, grouped);
    res.json(analyses);
  } catch (error: any) {
    console.error('Error getting log analyses:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/log-guru/analyze - Manually analyze a specific error log
router.post('/analyze', async (req: Request, res: Response) => {
  try {
    const { app_slug, error_log, context_lines } = req.body;
    
    if (!app_slug || !error_log) {
      return res.status(400).json({ error: 'app_slug and error_log are required' });
    }

    const analysis = await logGuruService.analyzeErrorLog(
      app_slug,
      error_log,
      context_lines || 10
    );
    
    res.json(analysis);
  } catch (error: any) {
    console.error('Error analyzing log:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/log-guru/scan - Automatically scan and analyze logs for an app
router.post('/scan', async (req: Request, res: Response) => {
  try {
    const { app_slug, lines } = req.body;
    
    if (!app_slug) {
      return res.status(400).json({ error: 'app_slug is required' });
    }

    const analyses = await logGuruService.scanAndAnalyzeLogs(app_slug, lines || 200);
    
    res.json({
      success: true,
      analyzed_count: analyses.length,
      analyses
    });
  } catch (error: any) {
    console.error('Error scanning logs:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/log-guru/scan-all - Scan all apps (triggers scheduler)
router.post('/scan-all', async (req: Request, res: Response) => {
  try {
    // Trigger the scheduler's log guru scan
    schedulerService.triggerLogGuruScan();
    
    res.json({
      success: true,
      message: 'Log scan initiated for all apps. Check back in a few moments.'
    });
  } catch (error: any) {
    console.error('Error triggering log scan:', error);
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/log-guru/analyses/:id - Mark analysis as real issue or false positive
router.patch('/analyses/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { is_real_issue, user_notes, error_name } = req.body;
    
    if (is_real_issue === undefined && !error_name) {
      return res.status(400).json({ error: 'is_real_issue or error_name is required' });
    }

    if (is_real_issue !== undefined && ![0, 1, 2].includes(is_real_issue)) {
      return res.status(400).json({ error: 'is_real_issue must be 0 (unknown), 1 (real issue), or 2 (false positive)' });
    }

    const analysis = await logGuruService.markAnalysis(id, is_real_issue ?? 0, user_notes, error_name);
    
    res.json(analysis);
  } catch (error: any) {
    console.error('Error updating log analysis:', error);
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/log-guru/groups/:groupId - Mark entire group as real issue or false positive
router.patch('/groups/:groupId', async (req: Request, res: Response) => {
  try {
    const groupId = parseInt(req.params.groupId, 10);
    const { is_real_issue, user_notes, error_name } = req.body;
    
    if (is_real_issue === undefined && !error_name) {
      return res.status(400).json({ error: 'is_real_issue or error_name is required' });
    }

    if (is_real_issue !== undefined && ![0, 1, 2].includes(is_real_issue)) {
      return res.status(400).json({ error: 'is_real_issue must be 0 (unknown), 1 (real issue), or 2 (false positive)' });
    }

    await logGuruService.markGroup(groupId, is_real_issue ?? 0, user_notes, error_name);
    
    res.json({ success: true, message: `Marked group ${groupId} as ${is_real_issue === 1 ? 'real issue' : is_real_issue === 2 ? 'false positive' : 'unknown'}` });
  } catch (error: any) {
    console.error('Error updating log group:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/log-guru/stats - Get statistics about log analyses
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const appSlug = req.query.app_slug as string | undefined;
    
    const allAnalyses = await logGuruService.getAnalyses(appSlug);
    const realIssues = allAnalyses.filter(a => a.is_real_issue === 1).length;
    const falsePositives = allAnalyses.filter(a => a.is_real_issue === 2).length;
    const unknown = allAnalyses.filter(a => a.is_real_issue === 0).length;
    
    res.json({
      total: allAnalyses.length,
      real_issues: realIssues,
      false_positives: falsePositives,
      unknown: unknown,
      by_app: appSlug ? undefined : (() => {
        const byApp: Record<string, { total: number; real_issues: number; false_positives: number; unknown: number }> = {};
        allAnalyses.forEach(a => {
          if (!byApp[a.app_slug]) {
            byApp[a.app_slug] = { total: 0, real_issues: 0, false_positives: 0, unknown: 0 };
          }
          byApp[a.app_slug].total++;
          if (a.is_real_issue === 1) byApp[a.app_slug].real_issues++;
          else if (a.is_real_issue === 2) byApp[a.app_slug].false_positives++;
          else byApp[a.app_slug].unknown++;
        });
        return byApp;
      })()
    });
  } catch (error: any) {
    console.error('Error getting log guru stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/log-guru/analyses/:id/fix - Generate actionable fixes for an error
// Also supports group_id in query parameter: /api/log-guru/analyses/:id/fix?group_id=123
router.post('/analyses/:id/fix', async (req: Request, res: Response) => {
  try {
    let analysisId = parseInt(req.params.id, 10);
    const groupId = req.query.group_id ? parseInt(req.query.group_id as string, 10) : undefined;
    
    // If id is invalid but we have a group_id, find the representative analysis for that group
    if (isNaN(analysisId) || analysisId === 0) {
      if (groupId) {
        // Get the first analysis from this group (the representative)
        const groupAnalyses = db.getLogAnalyses().filter((a: any) => a.group_id === groupId);
        if (groupAnalyses.length > 0) {
          // Sort by id to get the first/oldest one
          groupAnalyses.sort((a: any, b: any) => (a.id || 0) - (b.id || 0));
          analysisId = groupAnalyses[0].id;
        }
      }
      
      if (!analysisId || isNaN(analysisId)) {
        return res.status(400).json({ error: 'Invalid analysis ID. Provide either a valid ID or group_id.' });
      }
    }

    const fixResult = await logGuruService.generateFix(analysisId);
    res.json(fixResult);
  } catch (error: any) {
    console.error('Error generating fix:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/log-guru/execute-command - Execute a command safely
router.post('/execute-command', async (req: Request, res: Response) => {
  try {
    const { command, working_dir, timeout } = req.body;
    
    if (!command || typeof command !== 'string') {
      return res.status(400).json({ error: 'Command is required and must be a string' });
    }

    // Validate command isn't empty
    if (command.trim().length === 0) {
      return res.status(400).json({ error: 'Command cannot be empty' });
    }

    const result = await fileService.executeCommand(
      command,
      working_dir,
      timeout || 30000
    );

    res.json({
      success: result.exitCode === 0,
      ...result
    });
  } catch (error: any) {
    console.error('Error executing command:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/log-guru/read-file - Read a file
router.post('/read-file', async (req: Request, res: Response) => {
  try {
    const { file_path } = req.body;
    
    if (!file_path || typeof file_path !== 'string') {
      return res.status(400).json({ error: 'file_path is required and must be a string' });
    }

    const result = await fileService.readFile(file_path);
    const info = await fileService.getFileInfo(file_path);

    res.json({
      ...result,
      info
    });
  } catch (error: any) {
    console.error('Error reading file:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/log-guru/write-file - Write a file
router.post('/write-file', async (req: Request, res: Response) => {
  try {
    const { file_path, content, create_backup } = req.body;
    
    if (!file_path || typeof file_path !== 'string') {
      return res.status(400).json({ error: 'file_path is required and must be a string' });
    }

    if (typeof content !== 'string') {
      return res.status(400).json({ error: 'Content must be a string' });
    }

    const result = await fileService.writeFile(file_path, content, create_backup !== false);

    res.json(result);
  } catch (error: any) {
    console.error('Error writing file:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/log-guru/file-info - Get file info
router.post('/file-info', async (req: Request, res: Response) => {
  try {
    const { file_path } = req.body;
    
    if (!file_path || typeof file_path !== 'string') {
      return res.status(400).json({ error: 'file_path is required and must be a string' });
    }

    const info = await fileService.getFileInfo(file_path);

    if (!info) {
      return res.status(404).json({ error: 'File not found or access denied' });
    }

    res.json(info);
  } catch (error: any) {
    console.error('Error getting file info:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;

