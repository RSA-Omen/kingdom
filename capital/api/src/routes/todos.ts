import { Router, Request, Response } from 'express';
import { db } from '../models/database';
import { randomUUID } from 'crypto';

const router = Router();

// POST /api/todos — create a todo (manual or from an error)
router.post('/', (req: Request, res: Response) => {
  const { village, title, description, source = 'manual' } = req.body;

  if (!village || !title) {
    return res.status(400).json({ error: 'village and title are required' });
  }

  const id = randomUUID();
  const created_at = Math.floor(Date.now() / 1000);

  (db as any).getDb().prepare(
    'INSERT INTO todos (id, village, title, description, source, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(id, village, title, description || null, source, 'open', created_at);

  // If created from an error, link it back on the error record
  if (source !== 'manual') {
    const error = (db as any).getDb().prepare('SELECT * FROM errors WHERE id = ?').get(source);
    if (error) {
      (db as any).getDb().prepare('UPDATE errors SET linked_todo_id = ? WHERE id = ?').run(id, source);
    }
  }

  res.status(201).json({ id });
});

// GET /api/todos — fetch todos with optional filters
router.get('/', (req: Request, res: Response) => {
  const { village, status, linked, tier, limit = '50', offset = '0' } = req.query;

  let query = 'SELECT * FROM todos WHERE 1=1';
  const params: any[] = [];

  if (village) { query += ' AND village = ?'; params.push(village); }
  if (status) { query += ' AND status = ?'; params.push(status); }
  if (linked === 'true') { query += " AND source != 'manual'"; }
  if (linked === 'false') { query += " AND source = 'manual'"; }
  if (tier === 'unclassified') { query += ' AND tier IS NULL'; }
  else if (tier !== undefined) { query += ' AND tier = ?'; params.push(parseInt(tier as string)); }

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit as string), parseInt(offset as string));

  const todos = (db as any).getDb().prepare(query).all(...params);
  const total = (db as any).getDb().prepare('SELECT COUNT(*) as count FROM todos WHERE 1=1').get();

  res.json({ todos, total: total.count });
});

// GET /api/todos/summary — counts for dashboard cards
// IMPORTANT: defined BEFORE /:id to avoid route conflicts
router.get('/summary', (req: Request, res: Response) => {
  const dbInstance = (db as any).getDb();
  const open = dbInstance.prepare("SELECT COUNT(*) as count FROM todos WHERE status != 'done'").get();
  const linked = dbInstance.prepare("SELECT COUNT(*) as count FROM todos WHERE source != 'manual' AND status != 'done'").get();
  const byTier = dbInstance.prepare(
    "SELECT tier, COUNT(*) as count FROM todos WHERE status != 'done' GROUP BY tier"
  ).all() as Array<{ tier: number | null; count: number }>;

  const tierCounts: Record<string, number> = { t0: 0, t1: 0, t2: 0, unclassified: 0 };
  for (const row of byTier) {
    if (row.tier === 0) tierCounts.t0 = row.count;
    else if (row.tier === 1) tierCounts.t1 = row.count;
    else if (row.tier === 2) tierCounts.t2 = row.count;
    else tierCounts.unclassified = row.count;
  }

  res.json({ open: open.count, linked: linked.count, by_tier: tierCounts });
});

// PATCH /api/todos/:id — update status, title, description, or tier
router.patch('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, title, description, tier } = req.body;

  const todo = (db as any).getDb().prepare('SELECT * FROM todos WHERE id = ?').get(id);
  if (!todo) return res.status(404).json({ error: 'Todo not found' });

  if (status && !['open', 'in-progress', 'done'].includes(status)) {
    return res.status(400).json({ error: 'status must be open, in-progress, or done' });
  }
  if (tier !== undefined && tier !== null && ![0, 1, 2].includes(Number(tier))) {
    return res.status(400).json({ error: 'tier must be 0, 1, 2, or null' });
  }

  const updates: string[] = [];
  const params: any[] = [];
  if (status) { updates.push('status = ?'); params.push(status); }
  if (title) { updates.push('title = ?'); params.push(title); }
  if (description !== undefined) { updates.push('description = ?'); params.push(description); }
  if (tier !== undefined) { updates.push('tier = ?'); params.push(tier === null ? null : Number(tier)); }

  if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

  params.push(id);
  (db as any).getDb().prepare(`UPDATE todos SET ${updates.join(', ')} WHERE id = ?`).run(...params);

  const updated = (db as any).getDb().prepare('SELECT * FROM todos WHERE id = ?').get(id);
  res.json(updated);
});

export default router;
