import { Router, Request, Response } from 'express';
import { db } from '../models/database';
import { randomUUID } from 'crypto';

const router = Router();

// POST /api/errors — villages call this to report an error
router.post('/', (req: Request, res: Response) => {
  const { village, message, stack, severity = 'error' } = req.body;

  if (!village || !message) {
    return res.status(400).json({ error: 'village and message are required' });
  }

  if (!['critical', 'error', 'warning', 'info'].includes(severity)) {
    return res.status(400).json({ error: 'severity must be critical, error, warning, or info' });
  }

  const now = Math.floor(Date.now() / 1000);
  const dbInstance = (db as any).getDb();

  const existing = dbInstance.prepare(
    "SELECT id FROM errors WHERE village = ? AND message = ? AND status = 'open' LIMIT 1"
  ).get(village, message) as { id: string } | undefined;

  if (existing) {
    dbInstance.prepare(
      'UPDATE errors SET occurrence_count = occurrence_count + 1, last_seen_at = ? WHERE id = ?'
    ).run(now, existing.id);
    return res.status(200).json({ id: existing.id, received_at: new Date(now * 1000).toISOString(), deduplicated: true });
  }

  const id = randomUUID();
  dbInstance.prepare(
    'INSERT INTO errors (id, village, message, stack, severity, status, created_at, occurrence_count, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(id, village, message, stack || null, severity, 'open', now, 1, now);

  res.status(201).json({ id, received_at: new Date(now * 1000).toISOString() });
});

// GET /api/errors — fetch errors with optional filters
router.get('/', (req: Request, res: Response) => {
  const { village, status, severity, tag, limit = '50', offset = '0' } = req.query;

  let query = 'SELECT * FROM errors WHERE 1=1';
  const params: any[] = [];

  if (village) { query += ' AND village = ?'; params.push(village); }
  if (status) { query += ' AND status = ?'; params.push(status); }
  if (severity) { query += ' AND severity = ?'; params.push(severity); }
  if (tag === 'ralph') { query += " AND tag LIKE 'ralph:%'"; }
  else if (tag) { query += ' AND tag = ?'; params.push(tag); }

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit as string), parseInt(offset as string));

  const errors = (db as any).getDb().prepare(query).all(...params);
  const total = (db as any).getDb().prepare('SELECT COUNT(*) as count FROM errors WHERE 1=1').get();

  res.json({ errors, total: total.count });
});

// GET /api/errors/summary — counts for dashboard cards
// IMPORTANT: This route must be defined BEFORE /:id to avoid route conflicts
router.get('/summary', (req: Request, res: Response) => {
  const dbInstance = (db as any).getDb();

  // "Actionable" = only warning/error/critical (info is noise, not an issue)
  const actionableOpen = dbInstance.prepare(
    "SELECT COUNT(*) as count FROM errors WHERE status = 'open' AND severity IN ('critical','error','warning')"
  ).get();

  const linked = dbInstance.prepare(
    "SELECT COUNT(*) as count FROM errors WHERE linked_todo_id IS NOT NULL AND status = 'open' AND severity IN ('critical','error','warning')"
  ).get();

  const since24h = dbInstance.prepare(
    "SELECT COUNT(*) as count FROM errors WHERE created_at > ? AND status = 'open' AND severity IN ('critical','error','warning')"
  ).get(Math.floor(Date.now() / 1000) - 86400);

  const byVillage = dbInstance.prepare(
    "SELECT village, COUNT(*) as count FROM errors WHERE status = 'open' AND severity IN ('critical','error','warning') GROUP BY village"
  ).all();

  // Per-severity breakdown (all statuses, last 24h)
  const bySeverity = dbInstance.prepare(
    "SELECT severity, COUNT(*) as count FROM errors WHERE status = 'open' GROUP BY severity"
  ).all();

  const severityMap: Record<string, number> = { critical: 0, error: 0, warning: 0, info: 0 };
  for (const row of bySeverity as Array<{ severity: string; count: number }>) {
    if (row.severity in severityMap) severityMap[row.severity] = row.count;
  }

  res.json({
    open: actionableOpen.count,
    linked: linked.count,
    new_24h: since24h.count,
    by_village: byVillage,
    by_severity: severityMap,
  });
});

// PATCH /api/errors/:id — update status, tag, or link a todo
router.patch('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, linked_todo_id, tag } = req.body;

  const error = (db as any).getDb().prepare('SELECT * FROM errors WHERE id = ?').get(id);
  if (!error) return res.status(404).json({ error: 'Error not found' });

  if (status && !['open', 'resolved'].includes(status)) {
    return res.status(400).json({ error: 'status must be open or resolved' });
  }

  const updates: string[] = [];
  const params: any[] = [];
  if (status) { updates.push('status = ?'); params.push(status); }
  if (linked_todo_id !== undefined) { updates.push('linked_todo_id = ?'); params.push(linked_todo_id); }
  if (tag !== undefined) { updates.push('tag = ?'); params.push(tag); }

  if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

  params.push(id);
  (db as any).getDb().prepare(`UPDATE errors SET ${updates.join(', ')} WHERE id = ?`).run(...params);

  const updated = (db as any).getDb().prepare('SELECT * FROM errors WHERE id = ?').get(id);
  res.json(updated);
});

export default router;
