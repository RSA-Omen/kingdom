import { Router, Request, Response } from 'express';
import { buildFeed } from '../services/guildBoardFeed';
import { buildChain } from '../services/guildBoardChain';

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

// GET /api/guild-board/chain/:id — lifecycle chain for a single item.
// id is either an Asana task GID or "incident:{id}".
router.get('/chain/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ ok: false, error: 'id required' });
  }
  try {
    const chain = await buildChain(id);
    res.set('Cache-Control', 'public, max-age=30');
    res.json(chain);
  } catch (err: any) {
    console.error('[guild-board] chain build failed:', err);
    res.status(500).json({ ok: false, error: err.message || 'chain build failed' });
  }
});

export default router;
