import { Router, Request, Response } from 'express';
import { usageService } from '../services/usage';

const router = Router();

// GET /api/usage/top - Must come before /:slug route
router.get('/top', async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
    const days = req.query.days ? parseInt(req.query.days as string, 10) : 7;
    const topApps = await usageService.getTopApps(limit, days);
    res.json(topApps);
  } catch (error: any) {
    console.error('Error fetching top apps:', error);
    // Return empty array so dashboard doesn't break
    res.json([]);
  }
});

// GET /api/usage/:slug/events - Get all usage events for an app
router.get('/:slug/events', async (req: Request, res: Response) => {
  try {
    const appSlug = req.params.slug;
    const since = req.query.since as string | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;
    
    const events = await usageService.getUsageEvents(appSlug, since, limit, offset);
    const total = await usageService.getUsageEventsCount(appSlug, since);
    
    res.json({
      events,
      total,
      limit: limit || null,
      offset
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/usage/:slug
router.get('/:slug', async (req: Request, res: Response) => {
  try {
    const days = req.query.days ? parseInt(req.query.days as string, 10) : 30;
    const stats = await usageService.getUsageStats(req.params.slug, days);
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

