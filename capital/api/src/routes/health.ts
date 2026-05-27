import { Router, Request, Response } from 'express';
import { db } from '../models/database';
import { healthService } from '../services/health';

const router = Router();

// GET /api/health
router.get('/', async (req: Request, res: Response) => {
  try {
    const apps = await db.getAllApps({ status: 'active' });
    const healthy = apps.filter(a => a.last_health_status === 'healthy').length;
    const unhealthy = apps.filter(a => a.last_health_status === 'unhealthy').length;
    const unknown = apps.filter(a => !a.last_health_status || a.last_health_status === 'unknown').length;

    res.json({
      total: apps.length,
      healthy,
      unhealthy,
      unknown,
      apps: apps.map(app => ({
        slug: app.slug,
        status: app.last_health_status || 'unknown',
        last_check: app.last_health_check
      }))
    });
  } catch (error: any) {
    console.error('Error fetching health:', error);
    // Return safe defaults so dashboard can still render
    res.json({
      total: 0,
      healthy: 0,
      unhealthy: 0,
      unknown: 0,
      apps: []
    });
  }
});

// GET /api/health-history/:slug
router.get('/history/:slug', async (req: Request, res: Response) => {
  try {
    const app = await db.getAppBySlug(req.params.slug);
    if (!app || !app.id) {
      return res.status(404).json({ error: 'App not found' });
    }

    const since = req.query.since as string | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;

    const history = await db.getHealthHistory(app.id, since, limit);
    res.json(history);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/health-check/:slug
router.post('/check/:slug', async (req: Request, res: Response) => {
  try {
    const app = await db.getAppBySlug(req.params.slug);
    if (!app) {
      return res.status(404).json({ error: 'App not found' });
    }

    const result = await healthService.checkAppHealth(app);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

