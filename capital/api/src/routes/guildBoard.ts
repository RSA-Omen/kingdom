import { Router, Request, Response } from 'express';
import { buildFeed } from '../services/guildBoardFeed';

const router = Router();

// GET /api/guild-board/feed — aggregated Asana + Capital DB feed for the
// Kingdom dashboard's Guild Board page. Read-only.
router.get('/feed', async (_req: Request, res: Response) => {
  try {
    const feed = await buildFeed();
    // Tell upstream caches it's safe to share briefly — 15s smooths bursts
    // from the dashboard's revalidate cadence without going stale.
    res.set('Cache-Control', 'public, max-age=15');
    res.json(feed);
  } catch (err: any) {
    console.error('[guild-board] feed build failed:', err);
    res.status(500).json({ ok: false, error: err.message || 'feed build failed' });
  }
});

export default router;
