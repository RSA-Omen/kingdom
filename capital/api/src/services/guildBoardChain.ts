/**
 * Guild Board Chain — builds the project lifecycle chain for a single item.
 *
 * For Asana tasks: fetches the task + stories and synthesises chain nodes
 * from section changes, comments, and current status.
 *
 * For Capital DB incidents (id prefixed "incident:"): synthesises a simple
 * chain from the error record.
 *
 * Read-only. Phase C: write-back (Log comms, Set reminder) is deferred.
 */

import { db } from '../models/database';
import { getTaskDetails, getTaskStories, type AsanaTask, type AsanaStory } from './asana';

// ─── Constants (mirror guildBoardFeed.ts) ────────────────────────────────────

const SECTION_TO_VILLAGE: Record<string, string> = {
  '1210783271964117': 'OLGA',
  '1208821439698421': 'Carbon Scout',
  '1210746791091336': 'ILR',
  '1213197771245521': 'Gaia',
  '1211583322141287': 'Internal Systems',
  '1203308202412854': 'Customer Support',
  '1212234392758835': 'R&D',
  '1200527647096291': 'Inbox',
  '1200470842604593': 'IT',
};

// ─── Chain types (consumed by dashboard) ─────────────────────────────────────

export type ChainNodeShape = 'diamond' | 'circle' | 'cloud';
export type ChainNodeState = 'done' | 'waiting' | 'comms' | 'dim';

export type ChainSubtreeItem = {
  glyph?: string;
  label: string;
  date?: string;
  tone?: 'comms';
};

export type ChainNode = {
  shape: ChainNodeShape;
  state: ChainNodeState;
  title: string;
  subtitle?: string;
  desc?: string;
  inlinePill?: string;
  subtree?: { label: string; items: ChainSubtreeItem[] };
};

export type ChainMeta = {
  title: string;
  type: 'project' | 'bug' | 'incident';
  status: string;
  stakeholder?: string;
  village: string;
  started: string;    // ISO date yyyy-mm-dd
  lastComms?: string; // ISO date yyyy-mm-dd
  stuckDays?: number;
  stuckContext?: string;
};

export type ChainData = {
  ok: boolean;
  taskGid: string;
  meta: ChainMeta;
  nodes: ChainNode[];
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(iso: string | undefined): string {
  if (!iso) return '';
  return iso.slice(0, 10);
}

function truncate(text: string, max = 120): string {
  if (!text) return '';
  return text.length > max ? text.slice(0, max) + '…' : text;
}

function sectionGidOf(task: AsanaTask): string | null {
  const memberships = task.memberships || [];
  const digital = memberships.find((m) => m.project?.gid === '1200457408099570');
  if (digital?.section?.gid) return digital.section.gid;
  const it = memberships.find((m) => m.project?.gid === '1200470842604591');
  if (it?.section?.gid) return it.section.gid;
  return memberships[0]?.section?.gid ?? null;
}

function statusValueOf(task: AsanaTask): string | null {
  const f = (task.custom_fields || []).find((f) => f.name === 'Task Status');
  return f?.enum_value?.name ?? null;
}

function stakeholderOf(task: AsanaTask): string | undefined {
  const candidates = ['Stakeholder', 'Contact', 'Client', 'Requestor', 'Requester'];
  for (const name of candidates) {
    const f = (task.custom_fields || []).find((cf) => cf.name === name);
    const val = f?.enum_value?.name || f?.display_value;
    if (val) return val;
  }
  // Fall back to email in notes
  const match = task.notes?.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (match) return match[0];
  return undefined;
}

function classificationOf(taskGid: string): { classification?: string } {
  try {
    const row = (db as any)
      .getDb()
      .prepare(
        'SELECT classification FROM lord_chamberlain_processed WHERE task_gid = ?',
      )
      .get(taskGid) as { classification: string } | undefined;
    return { classification: row?.classification };
  } catch {
    return {};
  }
}

/** Extract the destination section name from a section_changed story text. */
function extractSectionName(text: string): string | null {
  // "moved to Section Name" or "moved this Task from X to Section Name"
  const toMatch = text.match(/ to (.+)$/i);
  if (toMatch) return toMatch[1].trim();
  return null;
}

/** Collapse runs of comments into a single cloud node with optional subtree. */
function buildCommsNode(stories: AsanaStory[]): ChainNode {
  const items: ChainSubtreeItem[] = stories.map((s) => ({
    glyph: '☁',
    tone: 'comms' as const,
    label: truncate(s.text || '(empty)', 80),
    date: fmtDate(s.created_at),
  }));

  if (stories.length === 1) {
    return {
      shape: 'cloud',
      state: 'comms',
      title: truncate(stories[0].text || 'Comment', 90),
      subtitle: [
        fmtDate(stories[0].created_at),
        stories[0].created_by?.name,
      ]
        .filter(Boolean)
        .join(' · '),
    };
  }

  return {
    shape: 'cloud',
    state: 'comms',
    title: `${stories.length} comments`,
    subtitle: `${fmtDate(stories[0].created_at)} → ${fmtDate(stories[stories.length - 1].created_at)}`,
    subtree: { label: `${stories.length} comments`, items },
  };
}

// ─── Asana chain builder ──────────────────────────────────────────────────────

async function buildAsanaChain(taskGid: string): Promise<ChainData> {
  const [task, stories] = await Promise.all([
    getTaskDetails(taskGid),
    getTaskStories(taskGid),
  ]);

  const sectionGid = sectionGidOf(task);
  const village = (sectionGid && SECTION_TO_VILLAGE[sectionGid]) || 'Unrouted';
  const rawStatus = statusValueOf(task);
  const { classification } = classificationOf(taskGid);
  const type = classification === 'bug' ? 'bug' : 'project';
  const status = (rawStatus || 'OPEN').toUpperCase();
  const isWaiting = status.includes('WAITING') || status === 'REVIEW';

  // Last comms = most recent comment story
  const commentStories = stories.filter(
    (s) => s.type === 'comment' && s.resource_subtype === 'comment_added',
  );
  const lastCommentStory = commentStories[commentStories.length - 1];
  const lastComms = lastCommentStory?.created_at;

  // Stuck days = days since last modification (or last section change)
  const lastModified = task.modified_at || task.created_at || '';
  const stuckDays =
    isWaiting && lastModified
      ? Math.max(
          0,
          Math.round((Date.now() - new Date(lastModified).getTime()) / 86400000),
        )
      : undefined;

  const stuckContext = lastCommentStory?.text
    ? truncate(lastCommentStory.text, 100)
    : 'Awaiting response';

  const meta: ChainMeta = {
    title: task.name,
    type,
    status,
    stakeholder: stakeholderOf(task),
    village,
    started: fmtDate(task.created_at || new Date().toISOString()),
    lastComms: lastComms ? fmtDate(lastComms) : undefined,
    stuckDays: isWaiting ? stuckDays : undefined,
    stuckContext: isWaiting ? stuckContext : undefined,
  };

  // ── Build chain nodes ──
  const nodes: ChainNode[] = [];

  // First node: Created milestone
  nodes.push({
    shape: 'diamond',
    state: 'done',
    title: 'Created',
    subtitle: fmtDate(task.created_at || ''),
    desc: task.notes ? truncate(task.notes, 160) : undefined,
  });

  // Walk stories: section changes delimit phases; comments bucket into cloud nodes
  const commentBucket: AsanaStory[] = [];

  for (const story of stories) {
    if (story.resource_subtype === 'section_changed') {
      // Flush comment bucket first
      if (commentBucket.length > 0) {
        nodes.push(buildCommsNode([...commentBucket]));
        commentBucket.length = 0;
      }
      const name = extractSectionName(story.text) || story.text;
      nodes.push({
        shape: 'circle',
        state: 'done',
        title: name,
        subtitle: fmtDate(story.created_at),
      });
    } else if (story.type === 'comment' && story.resource_subtype === 'comment_added') {
      commentBucket.push(story);
    }
    // Other system events (assigned, custom_field_changed, etc.) skipped
  }

  // Flush remaining comments
  if (commentBucket.length > 0) {
    nodes.push(buildCommsNode([...commentBucket]));
  }

  // Current state node
  if (isWaiting) {
    const pill =
      stuckDays && stuckDays > 14 ? `⚠ ${stuckDays}d — no response` : undefined;
    nodes.push({
      shape: 'circle',
      state: 'waiting',
      title: status,
      subtitle: lastModified ? `${fmtDate(lastModified)} → …` : undefined,
      inlinePill: pill,
    });
    nodes.push({ shape: 'diamond', state: 'dim', title: 'Done', subtitle: 'not reached' });
  } else if (task.completed) {
    nodes.push({
      shape: 'diamond',
      state: 'done',
      title: 'Completed',
      subtitle: fmtDate(lastModified),
    });
  } else {
    // Active / in-progress
    nodes.push({
      shape: 'circle',
      state: 'waiting', // "waiting" state in the design = amber glow for "now" node
      title: status,
      subtitle: lastModified ? fmtDate(lastModified) : undefined,
    });
    nodes.push({ shape: 'diamond', state: 'dim', title: 'Done', subtitle: 'not reached' });
  }

  return { ok: true, taskGid, meta, nodes };
}

// ─── Incident chain builder (Capital DB) ─────────────────────────────────────

type IncidentRow = {
  id: string;
  village: string;
  message: string;
  severity: string;
  created_at: number;
  status: string;
};

function buildIncidentChain(incidentId: string): ChainData {
  let row: IncidentRow | undefined;
  try {
    row = (db as any)
      .getDb()
      .prepare('SELECT id, village, message, severity, created_at, status FROM errors WHERE id = ?')
      .get(incidentId) as IncidentRow | undefined;
  } catch {
    // DB not ready
  }

  if (!row) {
    return {
      ok: false,
      taskGid: `incident:${incidentId}`,
      meta: {
        title: 'Incident not found',
        type: 'incident',
        status: 'ERROR',
        village: 'Capital',
        started: fmtDate(new Date().toISOString()),
      },
      nodes: [
        { shape: 'diamond', state: 'dim', title: 'Unknown incident', subtitle: incidentId },
      ],
    };
  }

  const started = fmtDate(new Date(row.created_at * 1000).toISOString());
  const isClosed = row.status !== 'open';
  const stuckDays = !isClosed
    ? Math.max(0, Math.round((Date.now() - row.created_at * 1000) / 86400000))
    : undefined;

  const nodes: ChainNode[] = [
    {
      shape: 'diamond',
      state: 'done',
      title: 'Reported',
      subtitle: started,
      desc: truncate(row.message, 160),
    },
    {
      shape: 'circle',
      state: isClosed ? 'done' : 'waiting',
      title: row.status.toUpperCase(),
      subtitle: `${row.severity} severity`,
      inlinePill:
        !isClosed && stuckDays && stuckDays > 1 ? `⚠ ${stuckDays}d open` : undefined,
    },
    isClosed
      ? { shape: 'diamond', state: 'done', title: 'Resolved', subtitle: started }
      : { shape: 'diamond', state: 'dim', title: 'Resolved', subtitle: 'not reached' },
  ];

  return {
    ok: true,
    taskGid: `incident:${incidentId}`,
    meta: {
      title: truncate(row.message, 100),
      type: 'incident',
      status: row.status.toUpperCase(),
      village: row.village,
      started,
      stuckDays: !isClosed ? stuckDays : undefined,
      stuckContext: truncate(row.message, 120),
    },
    nodes,
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export async function buildChain(id: string): Promise<ChainData> {
  if (id.startsWith('incident:')) {
    return buildIncidentChain(id.slice('incident:'.length));
  }
  return buildAsanaChain(id);
}
