/**
 * The Guild Board feed — aggregates Asana (Lord Chamberlain triaged tasks)
 * and Capital DB (errors → incidents) into the DeskItem shape the dashboard
 * already renders.
 *
 * Read-only. Phase B scope: no writes back to Asana or Capital.
 */

import { db } from '../models/database';
import { getMyRecentlyAssigned, checkPat, type AsanaTask } from './asana';

// ─── Constants (mirror council/lord-chamberlain/constants.py) ─────────────

const LC_TAG_NAME = 'lc-triaged';

const SECTION_NAMES: Record<string, string> = {
  '1200527647096291': 'Inbox',
  '1203308202412854': 'Customer Support',
  '1211583322141287': 'Internal System Automations',
  '1210783271964117': 'OLGA Defects and Improvements',
  '1208821439698421': 'Carbon Scout Mk6',
  '1210746791091336': 'Inline Leach Reactors',
  '1213197771245521': 'Gaia Biodigester Improvements',
  '1212234392758835': 'Parking Lot',
  '1200470842604593': 'New Requests',
};

const PROJECT_NAMES: Record<string, string> = {
  '1200457408099570': 'Digital',
  '1200470842604591': 'IT Support Request',
};

// section GID → display village name for the board
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

// ─── DeskItem types (mirror dashboard's types.ts) ─────────────────────────

export type EntityType = 'project' | 'bug' | 'incident';
export type AgeTone = 'red' | 'amber' | 'mid';

export type LifecycleEvent = {
  kind: 'milestone' | 'progress' | 'comms' | 'wait' | 'now' | 'future';
  tone?: string;
  title: string;
  date?: string;
};

export type DeskItem = {
  id: string;
  type: EntityType;
  village: string;
  title: string;
  status: string;
  note?: string;
  noteTone?: 'red' | 'default';
  age: string;
  ageLabel: string;
  ageTone?: AgeTone;
  events: LifecycleEvent[];
};

export type FeedResponse = {
  ok: boolean;
  generatedAt: string;
  source: {
    asanaTasksFetched: number;
    asanaTasksTriaged: number;
    incidentsFromCapital: number;
  };
  stats: {
    projects: number;
    bugs: number;
    incidents: number;
    waitingOver14: number;
    closed: number;
    active: number;
    needsAttention: number;
    closedThisQuarter: number;
  };
  ageDistribution: { fresh: number; mid: number; stale: number };
  attention: DeskItem[];
  flight: DeskItem[];
  closed: DeskItem[];
  villages: Array<{ id: string; label: string; count: number }>;
};

// ─── Tone palette (CSS vars consumed by the dashboard) ────────────────────

const T = {
  teal: 'var(--color-accent)',
  bug: 'var(--color-bug)',
  incident: 'var(--color-danger)',
  waiting: 'var(--color-waiting)',
  green: 'var(--color-success)',
  dim: 'var(--color-text-tertiary)',
};

// ─── Helpers ──────────────────────────────────────────────────────────────

function hasLcTag(task: AsanaTask): boolean {
  return (task.tags || []).some((t) => t.name?.toLowerCase() === LC_TAG_NAME);
}

/**
 * Extract the section GID for the membership in the relevant project (Digital
 * or IT Support). If a task is in both, prefer Digital.
 */
function sectionGidOf(task: AsanaTask): string | null {
  const memberships = task.memberships || [];
  const digital = memberships.find((m) => m.project?.gid === '1200457408099570');
  if (digital?.section?.gid) return digital.section.gid;
  const it = memberships.find((m) => m.project?.gid === '1200470842604591');
  if (it?.section?.gid) return it.section.gid;
  return memberships[0]?.section?.gid ?? null;
}

function projectGidOf(task: AsanaTask): string | null {
  const memberships = task.memberships || [];
  return memberships[0]?.project?.gid ?? null;
}

function statusValueOf(task: AsanaTask): string | null {
  const status = (task.custom_fields || []).find((f) => f.name === 'Task Status');
  return status?.enum_value?.name ?? null;
}

function priorityValueOf(task: AsanaTask): string | null {
  const prio = (task.custom_fields || []).find((f) => f.name === 'Priority');
  return prio?.enum_value?.name ?? null;
}

/** Classification stored by Lord Chamberlain in the Capital DB. */
function fetchTriageMap(): Map<string, { classification: string; processedAt: number; confidence: string }> {
  const map = new Map<string, { classification: string; processedAt: number; confidence: string }>();
  try {
    const rows = (db as any)
      .getDb()
      .prepare(
        'SELECT task_gid, classification, processed_at, confidence FROM lord_chamberlain_processed',
      )
      .all() as Array<{ task_gid: string; classification: string; processed_at: number; confidence: string }>;
    for (const r of rows) {
      map.set(r.task_gid, {
        classification: r.classification,
        processedAt: r.processed_at,
        confidence: r.confidence,
      });
    }
  } catch (err) {
    // Table may not exist yet — that's fine, returns empty map
    console.warn('[guild-board] lord_chamberlain_processed query failed:', err);
  }
  return map;
}

/** "bug" classification → board bug. Everything else → project. */
function entityTypeFromClassification(classification: string | undefined): EntityType {
  if (classification === 'bug') return 'bug';
  return 'project';
}

/** Tone palette for the type. */
function toneOf(type: EntityType): string {
  if (type === 'bug') return T.bug;
  if (type === 'incident') return T.incident;
  return T.teal;
}

/** Convert seconds to a compact age string + tone. */
function compactAge(seconds: number): { age: string; ageLabel: string; ageTone: AgeTone } {
  const days = Math.floor(seconds / 86400);
  let age: string;
  if (days < 1) age = '<1d';
  else if (days < 60) age = `${days}d`;
  else age = `${Math.floor(days / 30)}mo`;

  let ageTone: AgeTone = 'mid';
  if (days >= 14) ageTone = 'red';
  else if (days >= 7) ageTone = 'amber';

  return { age, ageLabel: 'open', ageTone };
}

function ageSeconds(isoOrUnix: string | number | undefined): number {
  if (!isoOrUnix) return 0;
  let then: number;
  if (typeof isoOrUnix === 'number') then = isoOrUnix * 1000;
  else then = new Date(isoOrUnix).getTime();
  if (Number.isNaN(then)) return 0;
  return Math.max(0, Math.floor((Date.now() - then) / 1000));
}

// ─── DeskItem builders ────────────────────────────────────────────────────

function buildAsanaDeskItem(
  task: AsanaTask,
  classification: string | undefined,
  processedAt: number | undefined,
): DeskItem {
  const sectionGid = sectionGidOf(task);
  const village = (sectionGid && SECTION_TO_VILLAGE[sectionGid]) || 'Unrouted';
  const type = entityTypeFromClassification(classification);
  const status = (statusValueOf(task) || 'OPEN').toUpperCase();
  const priority = priorityValueOf(task);

  const created = task.created_at;
  const modified = task.modified_at;
  const isWaiting = status.startsWith('WAITING');

  // Age is based on most recent activity — modified time
  const seconds = ageSeconds(modified || created);
  const { age, ageTone } = compactAge(seconds);
  const ageLabel = isWaiting ? 'waiting' : 'open';

  // Note: surface priority as a hint when set
  const note = priority ? `${priority} priority` : undefined;
  const noteTone: 'red' | 'default' | undefined =
    seconds >= 14 * 86400 && isWaiting ? 'red' : undefined;

  // Lifecycle: created → triaged → now → future
  const events: LifecycleEvent[] = [];
  if (created) {
    events.push({
      kind: 'milestone',
      tone: toneOf(type),
      title: 'Created',
      date: new Date(created).toISOString().slice(0, 10),
    });
  }
  if (processedAt) {
    events.push({
      kind: 'progress',
      tone: T.green,
      title: 'Triaged',
      date: new Date(processedAt * 1000).toISOString().slice(0, 10),
    });
  }
  events.push({
    kind: 'now',
    tone: isWaiting ? T.waiting : toneOf(type),
    title: status,
    date: 'today',
  });
  events.push({ kind: 'future', title: 'Done' });

  return {
    id: task.gid,
    type,
    village,
    title: task.name,
    status,
    note,
    noteTone,
    age,
    ageLabel,
    ageTone,
    events,
  };
}

function buildIncidentDeskItem(row: {
  id: string;
  village: string;
  message: string;
  severity: string;
  created_at: number;
  status: string;
}): DeskItem {
  const seconds = ageSeconds(row.created_at);
  const { age, ageTone } = compactAge(seconds);

  const events: LifecycleEvent[] = [
    {
      kind: 'milestone',
      tone: T.incident,
      title: 'Reported',
      date: new Date(row.created_at * 1000).toISOString().slice(0, 10),
    },
    { kind: 'now', tone: T.incident, title: row.status.toUpperCase(), date: 'today' },
    { kind: 'future', title: 'Resolved' },
  ];

  return {
    id: `incident:${row.id}`,
    type: 'incident',
    village: row.village,
    title: row.message.slice(0, 120),
    status: row.status.toUpperCase(),
    note: row.severity,
    noteTone: row.severity === 'critical' ? 'red' : undefined,
    age,
    ageLabel: 'open',
    ageTone,
    events,
  };
}

// ─── Bucketing rules ──────────────────────────────────────────────────────

function isAttention(item: DeskItem): boolean {
  // Incidents always need attention while open
  if (item.type === 'incident') return true;
  // Waiting status + >7d → attention
  const statusLooksWaiting =
    item.status.includes('WAITING') || item.status === 'REVIEW';
  if (statusLooksWaiting && item.ageTone === 'red') return true;
  // Anything red (>=14d) regardless of status
  if (item.ageTone === 'red') return true;
  return false;
}

// ─── Stats derivation ─────────────────────────────────────────────────────

function buildStats(
  attention: DeskItem[],
  flight: DeskItem[],
  closed: DeskItem[],
) {
  const all = [...attention, ...flight, ...closed];
  return {
    projects: all.filter((i) => i.type === 'project').length,
    bugs: all.filter((i) => i.type === 'bug').length,
    incidents: all.filter((i) => i.type === 'incident').length,
    waitingOver14: all.filter((i) => i.ageTone === 'red').length,
    closed: closed.length,
    active: attention.length + flight.length,
    needsAttention: attention.length,
    closedThisQuarter: closed.length,
  };
}

function buildAgeDistribution(items: DeskItem[]) {
  let fresh = 0;
  let mid = 0;
  let stale = 0;
  for (const i of items) {
    if (i.ageTone === 'red') stale++;
    else if (i.ageTone === 'amber') mid++;
    else fresh++;
  }
  return { fresh, mid, stale };
}

function buildVillages(items: DeskItem[]) {
  const counts = new Map<string, number>();
  for (const i of items) counts.set(i.village, (counts.get(i.village) || 0) + 1);
  return Array.from(counts.entries())
    .map(([label, count]) => ({
      id: label.toLowerCase().replace(/\s+/g, '-'),
      label,
      count,
    }))
    .sort((a, b) => b.count - a.count);
}

// ─── Main ─────────────────────────────────────────────────────────────────

const ASANA_MY_TASKS_GID = process.env.ASANA_MY_TASKS_GID || '1211518294083562';

export async function buildFeed(): Promise<FeedResponse> {
  // 1. PAT health — if broken, return empty but ok=false
  const patOk = await checkPat();
  if (!patOk) {
    return emptyFeed('asana-pat-invalid');
  }

  // 2. Asana fetch (only triaged tasks make it onto the board)
  let asanaTasks: AsanaTask[] = [];
  try {
    asanaTasks = await getMyRecentlyAssigned(ASANA_MY_TASKS_GID);
  } catch (err) {
    console.error('[guild-board] Asana fetch failed:', err);
    return emptyFeed('asana-fetch-error');
  }

  const triagedTasks = asanaTasks.filter(hasLcTag);
  const triageMap = fetchTriageMap();

  const asanaItems: DeskItem[] = triagedTasks.map((task) => {
    const tr = triageMap.get(task.gid);
    return buildAsanaDeskItem(task, tr?.classification, tr?.processedAt);
  });

  // 3. Capital DB errors → incidents (critical + error severity, open, last 7 days)
  let incidentItems: DeskItem[] = [];
  try {
    const sevenDaysAgo = Math.floor(Date.now() / 1000) - 7 * 86400;
    const rows = (db as any)
      .getDb()
      .prepare(
        `SELECT id, village, message, severity, status, created_at
         FROM errors
         WHERE status = 'open'
           AND severity IN ('critical', 'error')
           AND created_at > ?
         ORDER BY created_at DESC
         LIMIT 20`,
      )
      .all(sevenDaysAgo) as Array<{
      id: string;
      village: string;
      message: string;
      severity: string;
      status: string;
      created_at: number;
    }>;
    incidentItems = rows.map(buildIncidentDeskItem);
  } catch (err) {
    console.warn('[guild-board] errors query failed:', err);
  }

  // 4. Bucket all items
  const allOpen = [...asanaItems, ...incidentItems];
  const attention = allOpen.filter(isAttention);
  const attentionIds = new Set(attention.map((i) => i.id));
  const flight = allOpen.filter((i) => !attentionIds.has(i.id));
  // Phase B: no closed items yet (would require fetching completed Asana tasks)
  const closed: DeskItem[] = [];

  // 5. Stats + age distribution + village list
  const stats = buildStats(attention, flight, closed);
  const ageDistribution = buildAgeDistribution([...attention, ...flight]);
  const villages = buildVillages([...attention, ...flight]);

  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    source: {
      asanaTasksFetched: asanaTasks.length,
      asanaTasksTriaged: triagedTasks.length,
      incidentsFromCapital: incidentItems.length,
    },
    stats,
    ageDistribution,
    attention,
    flight,
    closed,
    villages,
  };
}

function emptyFeed(reason: string): FeedResponse {
  return {
    ok: false,
    generatedAt: new Date().toISOString(),
    source: { asanaTasksFetched: 0, asanaTasksTriaged: 0, incidentsFromCapital: 0 },
    stats: {
      projects: 0, bugs: 0, incidents: 0, waitingOver14: 0,
      closed: 0, active: 0, needsAttention: 0, closedThisQuarter: 0,
    },
    ageDistribution: { fresh: 0, mid: 0, stale: 0 },
    attention: [
      {
        id: `error:${reason}`,
        type: 'incident',
        village: 'Capital',
        title: `Guild Board feed unavailable: ${reason}`,
        status: 'ERROR',
        age: 'now',
        ageLabel: 'failed',
        ageTone: 'red',
        events: [
          { kind: 'milestone', tone: T.incident, title: 'Failure', date: 'today' },
          { kind: 'now', tone: T.incident, title: 'Investigating', date: 'today' },
        ],
      },
    ],
    flight: [],
    closed: [],
    villages: [],
  };
}
