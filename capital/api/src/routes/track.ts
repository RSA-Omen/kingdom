import { Router, Request, Response } from 'express';
import { usageService } from '../services/usage';
import { createApiKeyMiddleware } from '../middleware/apiKey';

const router = Router();

// Apply API key middleware (optional - if ADMIN_CENTER_API_KEY is not set, allows all requests)
const apiKeyMiddleware = createApiKeyMiddleware();
router.use(apiKeyMiddleware);

// POST /api/track (API key auth if configured, otherwise open)
router.post('/', async (req: Request, res: Response) => {
  try {
    console.log('[Track API] Received request:', {
      method: req.method,
      headers: {
        'content-type': req.headers['content-type'],
        'user-agent': req.headers['user-agent'],
        'x-api-key': req.headers['x-api-key'] ? '***' : undefined
      },
      body: req.body
    });

    // Validate required fields
    if (!req.body.app_slug) {
      console.log('[Track API] Validation failed: app_slug is required');
      return res.status(400).json({ error: 'app_slug is required' });
    }
    if (!req.body.source) {
      console.log('[Track API] Validation failed: source is required');
      return res.status(400).json({ error: 'source is required' });
    }

    const event = await usageService.trackUsage(req.body);
    
    // Get total count for this app_slug
    const totalCount = await usageService.getUsageEventsCount(req.body.app_slug);
    
    console.log('[Track API] Successfully tracked usage:', {
      event_id: event.id,
      app_slug: req.body.app_slug,
      total_count: totalCount
    });

    // Return 200 instead of 201 for better Power Automate compatibility
    res.status(200).json({ 
      success: true, 
      event_id: event.id,
      app_slug: req.body.app_slug,
      total_count: totalCount,
      message: 'Usage tracked successfully' 
    });
  } catch (error: any) {
    console.error('[Track API] Error tracking usage:', error);
    // Return 200 with error flag to prevent Power Automate retries
    // Power Automate will retry on 4xx/5xx, so we return 200 with error info
    res.status(200).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// GET /api/track/:app_slug/count - Get total count for an app
router.get('/:app_slug/count', async (req: Request, res: Response) => {
  try {
    const appSlug = req.params.app_slug;
    const since = req.query.since as string | undefined;
    
    const count = await usageService.getUsageEventsCount(appSlug, since);
    
    res.json({
      app_slug: appSlug,
      total_count: count,
      since: since || 'all time'
    });
  } catch (error: any) {
    console.error('[Track API] Error getting count:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/track/:app_slug/stats - Get stats for an app
router.get('/:app_slug/stats', async (req: Request, res: Response) => {
  try {
    const appSlug = req.params.app_slug;
    const days = req.query.days ? parseInt(req.query.days as string, 10) : 30;
    
    const stats = await usageService.getUsageStats(appSlug, days);
    
    res.json(stats);
  } catch (error: any) {
    console.error('[Track API] Error getting stats:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;

