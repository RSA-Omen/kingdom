import { Router, Request, Response } from 'express';
import { githubSyncService } from '../services/githubSync';

const router = Router();

// POST /api/todos/sync — trigger manual sync
router.post('/', async (req: Request, res: Response) => {
  try {
    const result = await githubSyncService.sync('manual');
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message || String(e) });
  }
});

// GET /api/todos/sync — last sync run summary
router.get('/', (req: Request, res: Response) => {
  const last = githubSyncService.getLastRun();
  const repos = githubSyncService.loadRepos();
  res.json({ last, repos });
});

export default router;
