import { Router, Request, Response } from 'express';
import { buildFeed } from '../services/guildBoardFeed';
import { buildChain } from '../services/guildBoardChain';
import { addTaskComment } from '../services/asana';
import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = process.env.DB_PATH ?? '/data/app-registry.db';

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

// POST /api/guild-board/chain/:id/note — write a structured enrichment note.
// Always writes to chain_notes in Capital DB (so the chain view can surface it).
// For Asana task items (non-incident ids) also posts the comment to Asana.
router.post('/chain/:id/note', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { text, author } = req.body as { text?: string; author?: string };
  if (!id) return res.status(400).json({ ok: false, error: 'id required' });
  if (!text?.trim()) return res.status(400).json({ ok: false, error: 'text required' });

  const db = new Database(DB_PATH);
  try {
    // Always persist locally
    db.prepare(
      'INSERT INTO chain_notes (item_id, author, text) VALUES (?, ?, ?)'
    ).run(id, author?.trim() || 'king', text.trim());

    let asanaStoryGid: string | undefined;
    if (!id.startsWith('incident:')) {
      // Also post to Asana so it appears in the task timeline
      asanaStoryGid = await addTaskComment(id, text.trim());
    }

    return res.json({ ok: true, asanaStoryGid });
  } catch (err: any) {
    console.error('[guild-board] note post failed:', err);
    return res.status(500).json({ ok: false, error: err.message || 'note post failed' });
  } finally {
    db.close();
  }
});

export default router;
