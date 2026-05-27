import { Router, Request, Response } from 'express';
import { db } from '../models/database';
import { randomUUID } from 'crypto';

const router = Router();

// POST /api/checkpoints — villages call this when work is checkpointed
router.post('/', (req: Request, res: Response) => {
  const {
    village,
    repo_path,
    branch,
    commit_sha,
    summary,
    body,
    files_changed,
    pushed,
    remote_url,
    metadata,
  } = req.body;

  if (!village || !repo_path || !branch || !commit_sha || !summary) {
    return res.status(400).json({
      error: 'village, repo_path, branch, commit_sha, and summary are required',
    });
  }

  const id = randomUUID();
  const created_at = Math.floor(Date.now() / 1000);
  const dbInstance = (db as any).getDb();

  // Idempotency: if this (village, commit_sha) pair was already recorded, return the existing row.
  const existing = dbInstance
    .prepare('SELECT * FROM checkpoint_events WHERE village = ? AND commit_sha = ?')
    .get(village, commit_sha);
  if (existing) {
    return res.status(200).json({
      id: existing.id,
      received_at: new Date(existing.created_at * 1000).toISOString(),
      duplicate: true,
    });
  }

  dbInstance
    .prepare(
      `INSERT INTO checkpoint_events
        (id, village, repo_path, branch, commit_sha, summary, body, files_changed, pushed, remote_url, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      village,
      repo_path,
      branch,
      commit_sha,
      summary,
      body || null,
      typeof files_changed === 'number' ? files_changed : 0,
      pushed ? 1 : 0,
      remote_url || null,
      metadata ? JSON.stringify(metadata) : null,
      created_at
    );

  console.log(
    JSON.stringify({
      level: 'info',
      event: 'checkpoint.received',
      id,
      village,
      commit_sha,
      branch,
      pushed: !!pushed,
      files_changed: typeof files_changed === 'number' ? files_changed : 0,
    })
  );

  res.status(201).json({
    id,
    received_at: new Date(created_at * 1000).toISOString(),
    duplicate: false,
  });
});

// GET /api/checkpoints — list checkpoint events (for The Herald and dashboards)
router.get('/', (req: Request, res: Response) => {
  const { village, since, limit = '50', offset = '0' } = req.query;
  const dbInstance = (db as any).getDb();

  let query = 'SELECT * FROM checkpoint_events WHERE 1=1';
  const params: any[] = [];

  if (village) {
    query += ' AND village = ?';
    params.push(village);
  }
  if (since) {
    // since is unix seconds
    query += ' AND created_at >= ?';
    params.push(parseInt(since as string, 10));
  }

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit as string, 10), parseInt(offset as string, 10));

  const rows = dbInstance.prepare(query).all(...params) as any[];
  const events = rows.map((row) => ({
    ...row,
    pushed: !!row.pushed,
    metadata: row.metadata ? JSON.parse(row.metadata) : null,
  }));

  res.json({ events, count: events.length });
});

export default router;
