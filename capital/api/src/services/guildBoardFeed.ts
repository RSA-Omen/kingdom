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
  const isTriaged = !!processedAt;
  const type = entityTypeFromClassification(classification);
  const rawStatus = statusValueOf(task);
  const status = isTriaged ? (rawStatus || 'OPEN').toUpperCase() : 'UNTRIAGED';
  const priority = priorityValueOf(task);

  const created = task.created_at;
  const modified = task.modified_at;
  const isWaiting = status.startsWith('WAITING');

  // Age is based on most recent activity — modified time
  const seconds = ageSeconds(modified || created);
  const { age, ageTone } = compactAge(seconds);
  const ageLabel = isWaiting ? 'waiting' : isTriaged ? 'open' : 'awaiting triage';

  // Note: for triaged tasks surface priority; for untriaged surface a clear flag
  let note: string | undefined;
  let noteTone: 'red' | 'default' | undefined;
  if (!isTriaged) {
    note = 'awaiting Lord Chamberlain — needs triage';
    noteTone = 'red';
  } else if (priority) {
    note = `${priority} priority`;
    noteTone = priority === 'High' ? 'red' : undefined;
  }

  // Lifecycle: created → (triaged) → now → future
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
    tone: isWaiting ? T.waiting : isTriaged ? toneOf(type) : T.waiting,
    title: status,
    date: 'today',
  });
  events.push({ kind: 'future', title: isTriaged ? 'Done' : 'Triage' });

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
    ageTone: !isTriaged && seconds > 3600 ? 'amber' : ageTone,
    events,
  };
}

type IncidentRow = {
  id: string;
  village: string;
  message: string;
  severity: string;
  created_at: number;
  status: string;
};

type IncidentGroup = {
  representative: IncidentRow;
  count: number;
  firstSeen: number; // unix seconds — oldest occurrence
  lastSeen: number; // unix seconds — most recent
  worstSeverity: string;
};

/**
 * Normalize an error message into a fingerprint so the same error reported
 * multiple times collapses into one row.
 *
 * Strips numbers/IDs/timestamps and trims to first 60 chars.
 */
function fingerprint(village: string, message: string): string {
  const norm = message
    .toLowerCase()
    .replace(/[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}/g, '<uuid>')
    .replace(/\b\d{3,}\b/g, '<n>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
  return `${village}::${norm}`;
}

function severityRank(s: string): number {
  return { critical: 3, error: 2, warning: 1, info: 0 }[s] ?? 0;
}

function groupIncidents(rows: IncidentRow[]): IncidentGroup[] {
  const groups = new Map<string, IncidentGroup>();
  for (const r of rows) {
    const fp = fingerprint(r.village, r.message);
    const existing = groups.get(fp);
    if (!existing) {
      groups.set(fp, {
        representative: r,
        count: 1,
        firstSeen: r.created_at,
        lastSeen: r.created_at,
        worstSeverity: r.severity,
      });
    } else {
      existing.count += 1;
      existing.firstSeen = Math.min(existing.firstSeen, r.created_at);
      existing.lastSeen = Math.max(existing.lastSeen, r.created_at);
      if (severityRank(r.severity) > severityRank(existing.worstSeverity)) {
        existing.worstSeverity = r.severity;
        existing.representative = r;
      }
    }
  }
  return Array.from(groups.values());
}

function buildIncidentDeskItem(group: IncidentGroup): DeskItem {
  const { representative: row, count, lastSeen, firstSeen, worstSeverity } = group;
  const seconds = ageSeconds(lastSeen);
  const { age, ageTone } = compactAge(seconds);
  const isCritical = worstSeverity === 'critical';
  const isFrequent = count >= 3;

  // Note: severity + count (e.g. "error · ×3")
  const note = count > 1 ? `${worstSeverity} · ×${count}` : worstSeverity;
  const noteTone: 'red' | 'default' | undefined =
    isCritical || isFrequent ? 'red' : undefined;

  // Age tone: red if frequent or critical, else default
  const tone: AgeTone = isCritical || isFrequent ? 'red' : ageTone;

  const events: LifecycleEvent[] = [
    {
      kind: 'milestone',
      tone: T.incident,
      title: count > 1 ? `First seen (×${count})` : 'Reported',
      date: new Date(firstSeen * 1000).toISOString().slice(0, 10),
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
    note,
    noteTone,
    age,
    ageLabel: 'open',
    ageTone: tone,
    events,
  };
}

// ─── Bucketing rules ──────────────────────────────────────────────────────

/**
 * Attention rules (the king's "do these first" list):
 *
 *   Asana:
 *     - UNTRIAGED + older than ~1h → attention (Lord Chamberlain dropped it)
 *     - High priority → attention
 *     - WAITING + age red (>14d) → attention
 *     - REVIEW status → attention
 *
 *   Incidents (already deduped):
 *     - worstSeverity = critical → attention
 *     - count ≥ 3 → attention (frequent = louder than once-off)
 *     - everything else → flight
 */
function isAttention(item: DeskItem): boolean {
  // Untriaged Asana — the king needs to know LC is behind
  if (item.status === 'UNTRIAGED' && item.ageTone !== 'mid') return true;

  // High-priority Asana
  if (item.note?.startsWith('High priority')) return true;

  // Incidents: critical or frequent (red noteTone is set when so)
  if (item.type === 'incident') {
    return item.noteTone === 'red';
  }

  // Waiting-style status + old
  const statusLooksWaiting =
    item.status.includes('WAITING') || item.status === 'REVIEW';
  if (statusLooksWaiting && item.ageTone === 'red') return true;

  // Anything aged out
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

  // We pull ALL incomplete tasks from Recently Assigned, not just lc-triaged.
  // Untriaged tasks should still surface — they're work the king needs to see
  // even before Lord Chamberlain has classified them.
  const triageMap = fetchTriageMap();
  const asanaItems: DeskItem[] = asanaTasks.map((task) => {
    const tr = triageMap.get(task.gid);
    return buildAsanaDeskItem(task, tr?.classification, tr?.processedAt);
  });
  const triagedCount = asanaTasks.filter(hasLcTag).length;

  // 3. Capital DB errors → incidents (critical + error severity, open, last 7 days)
  let incidentItems: DeskItem[] = [];
  let rawIncidentCount = 0;
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
         LIMIT 200`,
      )
      .all(sevenDaysAgo) as IncidentRow[];
    rawIncidentCount = rows.length;
    incidentItems = groupIncidents(rows).map(buildIncidentDeskItem);
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
      asanaTasksTriaged: triagedCount,
      incidentsFromCapital: rawIncidentCount,
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
