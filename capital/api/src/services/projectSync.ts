import { randomUUID } from 'crypto';
import { db } from '../models/database';
import {
  getTaskDetails,
  getTaskSubtasks,
  getTaskStories,
  getTaskAttachments,
} from './asana';

export async function syncProject(projectId: string): Promise<void> {
  const dbInstance = (db as any).getDb();
  const project = dbInstance
    .prepare('SELECT * FROM projects WHERE id = ?')
    .get(projectId) as any;
  if (!project) throw new Error(`Project ${projectId} not found`);

  const [task, subtasks, stories, attachments] = await Promise.all([
    getTaskDetails(project.asana_task_gid),
    getTaskSubtasks(project.asana_task_gid),
    getTaskStories(project.asana_task_gid),
    getTaskAttachments(project.asana_task_gid),
  ]);

  const now = Math.floor(Date.now() / 1000);

  dbInstance
    .prepare(
      `UPDATE projects
       SET name = ?, notes = ?, completed = ?, asana_modified_at = ?, last_synced_at = ?
       WHERE id = ?`
    )
    .run(
      task.name,
      task.notes || null,
      task.completed ? 1 : 0,
      task.modified_at || null,
      now,
      projectId
    );

  // Upsert subtasks
  const upsertSubtask = dbInstance.prepare(
    `INSERT INTO project_subtasks (id, project_id, asana_gid, name, completed, due_on, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(project_id, asana_gid) DO UPDATE SET
       name       = excluded.name,
       completed  = excluded.completed,
       due_on     = excluded.due_on,
       sort_order = excluded.sort_order`
  );
  subtasks.forEach((s, i) => {
    upsertSubtask.run(
      randomUUID(),
      projectId,
      s.gid,
      s.name,
      s.completed ? 1 : 0,
      s.due_on || null,
      i
    );
  });
  // Remove subtasks deleted from Asana
  if (subtasks.length > 0) {
    const placeholders = subtasks.map(() => '?').join(',');
    dbInstance
      .prepare(
        `DELETE FROM project_subtasks
         WHERE project_id = ? AND asana_gid NOT IN (${placeholders})`
      )
      .run(projectId, ...subtasks.map((s) => s.gid));
  } else {
    dbInstance
      .prepare('DELETE FROM project_subtasks WHERE project_id = ?')
      .run(projectId);
  }

  // Insert new human comment stories (ignore already-stored ones)
  const upsertComment = dbInstance.prepare(
    `INSERT OR IGNORE INTO project_comments
       (id, project_id, asana_gid, created_at, created_by, text)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  stories
    .filter((s) => s.type === 'comment')
    .forEach((s) => {
      const ts = Math.floor(new Date(s.created_at).getTime() / 1000);
      upsertComment.run(
        randomUUID(),
        projectId,
        s.gid,
        ts,
        s.created_by?.name || null,
        s.text
      );
    });

  // Insert new attachments (ignore already-stored ones)
  const upsertAttachment = dbInstance.prepare(
    `INSERT OR IGNORE INTO project_attachments
       (id, project_id, asana_gid, name, download_url, view_url, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  attachments.forEach((a) => {
    const ts = Math.floor(new Date(a.created_at).getTime() / 1000);
    upsertAttachment.run(
      randomUUID(),
      projectId,
      a.gid,
      a.name,
      a.download_url || null,
      a.view_url || null,
      ts
    );
  });

  console.log(
    JSON.stringify({
      level: 'info',
      event: 'project.synced',
      project_id: projectId,
      name: task.name,
      subtasks: subtasks.length,
      comments: stories.filter((s) => s.type === 'comment').length,
      attachments: attachments.length,
    })
  );
}

export async function syncAllProjects(): Promise<void> {
  const dbInstance = (db as any).getDb();
  const projects = dbInstance
    .prepare('SELECT id FROM projects WHERE completed = 0')
    .all() as { id: string }[];

  await Promise.all(
    projects.map((p) =>
      syncProject(p.id).catch((err) => {
        console.error(
          JSON.stringify({
            level: 'error',
            event: 'project.sync.failed',
            project_id: p.id,
            error: err.message,
          })
        );
      })
    )
  );
}

const SYNC_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
let syncInterval: NodeJS.Timeout | null = null;

export function startProjectSync(): void {
  syncAllProjects().catch(console.error);
  syncInterval = setInterval(
    () => syncAllProjects().catch(console.error),
    SYNC_INTERVAL_MS
  );
}

export function stopProjectSync(): void {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
}
