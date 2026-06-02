import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { db } from '../models/database';
import { getTaskDetails } from '../services/asana';
import { syncProject } from '../services/projectSync';

const router = Router();

function parseAsanaGid(input: string): string | null {
  const match = input.match(/(\d{16,})/);
  return match ? match[1] : null;
}

const TODAY = () => new Date().toISOString().split('T')[0];

// GET /api/projects — list enrolled projects with summary stats
router.get('/', (_req: Request, res: Response) => {
  const dbInstance = (db as any).getDb();
  const projects = dbInstance
    .prepare('SELECT * FROM projects ORDER BY enrolled_at DESC')
    .all() as any[];

  const result = projects.map((p) => {
    const subtasks = dbInstance
      .prepare('SELECT completed, due_on FROM project_subtasks WHERE project_id = ?')
      .all(p.id) as any[];
    const lastComment = dbInstance
      .prepare(
        'SELECT created_at, created_by, text FROM project_comments WHERE project_id = ? ORDER BY created_at DESC LIMIT 1'
      )
      .get(p.id) as any;
    const { c: attachmentCount } = dbInstance
      .prepare('SELECT COUNT(*) as c FROM project_attachments WHERE project_id = ?')
      .get(p.id) as any;

    const today = TODAY();
    const overdueCount = subtasks.filter(
      (s) => !s.completed && s.due_on && s.due_on < today
    ).length;

    return {
      id: p.id,
      asana_task_gid: p.asana_task_gid,
      name: p.name,
      completed: !!p.completed,
      enrolled_at: p.enrolled_at,
      last_synced_at: p.last_synced_at,
      subtask_total: subtasks.length,
      subtask_done: subtasks.filter((s) => s.completed).length,
      overdue_count: overdueCount,
      attachment_count: attachmentCount,
      last_comment: lastComment || null,
    };
  });

  res.json({ projects: result });
});

// GET /api/projects/:id — full project detail
router.get('/:id', (req: Request, res: Response) => {
  const dbInstance = (db as any).getDb();
  const project = dbInstance
    .prepare('SELECT * FROM projects WHERE id = ?')
    .get(req.params.id) as any;
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const subtasks = dbInstance
    .prepare(
      'SELECT * FROM project_subtasks WHERE project_id = ? ORDER BY sort_order'
    )
    .all(project.id) as any[];
  const comments = dbInstance
    .prepare(
      'SELECT * FROM project_comments WHERE project_id = ? ORDER BY created_at ASC'
    )
    .all(project.id) as any[];
  const attachments = dbInstance
    .prepare(
      'SELECT * FROM project_attachments WHERE project_id = ? ORDER BY created_at DESC'
    )
    .all(project.id) as any[];

  res.json({
    ...project,
    completed: !!project.completed,
    subtasks: subtasks.map((s) => ({ ...s, completed: !!s.completed })),
    comments,
    attachments,
  });
});

// POST /api/projects — enroll a project by Asana task URL or raw GID
router.post('/', async (req: Request, res: Response) => {
  const { asana_task_url, asana_task_gid: rawGid } = req.body;
  const input = asana_task_url || rawGid;
  if (!input) {
    return res.status(400).json({ error: 'asana_task_url or asana_task_gid required' });
  }

  const gid = parseAsanaGid(String(input));
  if (!gid) {
    return res.status(400).json({ error: 'Could not extract a valid Asana task GID from input' });
  }

  const dbInstance = (db as any).getDb();
  const existing = dbInstance
    .prepare('SELECT id FROM projects WHERE asana_task_gid = ?')
    .get(gid) as any;
  if (existing) {
    return res.status(409).json({ error: 'Project already enrolled', id: existing.id });
  }

  let task;
  try {
    task = await getTaskDetails(gid);
  } catch (err: any) {
    return res.status(502).json({ error: `Asana fetch failed: ${err.message}` });
  }

  const id = randomUUID();
  const now = Math.floor(Date.now() / 1000);
  dbInstance
    .prepare(
      `INSERT INTO projects (id, asana_task_gid, name, notes, completed, enrolled_at, asana_modified_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      gid,
      task.name,
      task.notes || null,
      task.completed ? 1 : 0,
      now,
      task.modified_at || null
    );

  // Immediate deep sync — errors are non-fatal, project is already enrolled
  try {
    await syncProject(id);
  } catch (err: any) {
    console.error(
      JSON.stringify({
        level: 'warn',
        event: 'project.enroll.sync_failed',
        id,
        error: err.message,
      })
    );
  }

  const enrolled = dbInstance.prepare('SELECT * FROM projects WHERE id = ?').get(id) as any;
  res.status(201).json({ ...enrolled, completed: !!enrolled.completed });
});

// POST /api/projects/:id/sync — manual re-sync from Asana
router.post('/:id/sync', async (req: Request, res: Response) => {
  const dbInstance = (db as any).getDb();
  const project = dbInstance
    .prepare('SELECT id FROM projects WHERE id = ?')
    .get(req.params.id) as any;
  if (!project) return res.status(404).json({ error: 'Project not found' });

  try {
    await syncProject(req.params.id);
    res.json({ synced: true, synced_at: new Date().toISOString() });
  } catch (err: any) {
    res.status(502).json({ error: err.message });
  }
});

// DELETE /api/projects/:id — unenroll (cascades to subtasks/comments/attachments)
router.delete('/:id', (req: Request, res: Response) => {
  const dbInstance = (db as any).getDb();
  const project = dbInstance
    .prepare('SELECT id FROM projects WHERE id = ?')
    .get(req.params.id) as any;
  if (!project) return res.status(404).json({ error: 'Project not found' });

  // CASCADE would handle children if FK enforcement is on, but better to be explicit
  dbInstance.prepare('DELETE FROM project_subtasks WHERE project_id = ?').run(req.params.id);
  dbInstance.prepare('DELETE FROM project_comments WHERE project_id = ?').run(req.params.id);
  dbInstance.prepare('DELETE FROM project_attachments WHERE project_id = ?').run(req.params.id);
  dbInstance.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);

  res.json({ deleted: true });
});

export default router;
