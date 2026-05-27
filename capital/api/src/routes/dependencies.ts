import { Router, Request, Response } from 'express';
import { dependenciesService } from '../services/dependencies';
import { dependencyRepairService } from '../services/dependencyRepair';

type DependenciesSummary = Awaited<ReturnType<typeof dependenciesService.getSummary>>;

const router = Router();

// GET /api/dependencies - Get all projects and their dependencies
router.get('/', async (req: Request, res: Response) => {
  try {
    const forceRefresh = req.query.refresh === 'true';
    console.log(`Starting dependency scan (forceRefresh: ${forceRefresh})...`);
    const summary = await dependenciesService.getSummary(forceRefresh);
    console.log(`Scan complete. Found ${summary.totalProjects} projects with ${summary.totalVulnerabilities} vulnerabilities.`);
    res.json(summary);
  } catch (error: any) {
    console.error('Error fetching dependencies:', error);
    console.error('Stack:', error.stack);
    res.status(500).json({ 
      error: error.message || 'Failed to fetch dependencies',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// GET /api/dependencies/projects - Get all projects
router.get('/projects', async (req: Request, res: Response) => {
  try {
    const projects = await dependenciesService.scanAllProjects();
    res.json(projects);
  } catch (error: any) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch projects' });
  }
});

// GET /api/dependencies/progress - Get current scan progress
router.get('/progress', async (req: Request, res: Response) => {
  try {
    const progress = dependenciesService.getProgress();
    res.json(progress);
  } catch (error: any) {
    console.error('Error fetching progress:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch progress' });
  }
});

// GET /api/dependencies/project/:path - Get specific project (path encoded)
router.get('/project/*', async (req: Request, res: Response) => {
  try {
    const projectPath = req.params[0];
    if (!projectPath) {
      return res.status(400).json({ error: 'Project path is required' });
    }
    
    const decodedPath = decodeURIComponent(projectPath);
    const project = await dependenciesService.scanProject(decodedPath);
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found or not a React project' });
    }
    
    res.json(project);
  } catch (error: any) {
    console.error('Error fetching project:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch project' });
  }
});

// POST /api/dependencies/repair - Attempt to repair all vulnerabilities
router.post('/repair', async (req: Request, res: Response) => {
  try {
    const dryRun = req.query.dryRun === 'true' || req.body.dryRun === true;
    console.log(`Starting dependency repair (dryRun: ${dryRun})...`);
    
    const summary = await dependencyRepairService.repairAll(dryRun);

    let freshSummary: DependenciesSummary | undefined;
    if (!dryRun) {
      freshSummary = await dependenciesService.getSummary(true);
    }

    console.log(`Repair complete. Attempted: ${summary.attempted}, Succeeded: ${summary.succeeded}, Failed: ${summary.failed}`);

    res.json({
      success: true,
      dryRun,
      summary,
      freshSummary,
      message: dryRun
        ? `Dry run complete. Would attempt ${summary.attempted} repairs.`
        : `Repair complete. ${summary.succeeded} succeeded, ${summary.failed} failed.`
    });
  } catch (error: any) {
    console.error('Error repairing dependencies:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to repair dependencies',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

export default router;

