import { Router, Request, Response } from 'express';
import { db } from '../models/database';

const router = Router();

// GET /api/events
router.get('/', async (req: Request, res: Response) => {
  try {
    const appId = req.query.app_id ? parseInt(req.query.app_id as string, 10) : undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;

    const events = await db.getEvents(appId, limit);
    res.json(events);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

