import Database from "better-sqlite3";
import path from "path";

export const dynamic = "force-dynamic";

const HOME = process.env.HOME!;
const STEWARD_DB = path.join(HOME, ".steward-health.db");
const MOW_DB = path.join(HOME, ".master-of-works.db");
const QM_DB = path.join(HOME, ".quartermaster.db");

type Run = {
  runId: string;
  startedAt: string;
  status: "ok" | "partial" | "failed" | "unknown";
  summary: string;
};

type Schedule = {
  id: string;
  name: string;
  agent: string;
  cron: string;
  humanSchedule: string;
  lastRun: string | null;
  lastStatus: Run["status"] | null;
  lastSummary: string | null;
  recentRuns: Run[];
  hasDetail: boolean;
};

function queryDB<T>(dbPath: string, sql: string, params: any[] = []): T[] {
  try {
    const db = new Database(dbPath, { readonly: true, fileMustExist: true });
    const rows = db.prepare(sql).all(...params) as T[];
    db.close();
    return rows;
  } catch {
    return [];
  }
}

// ── Steward: Village Health ───────────────────────────────────────────────

function stewardHealthRuns(): Run[] {
  const rows = queryDB<{ run_minute: string; total: number; healthy: number; started_at: string }>(
    STEWARD_DB,
    `SELECT strftime('%Y-%m-%dT%H:%M', timestamp) as run_minute,
            COUNT(DISTINCT service_name) as total,
            SUM(CASE WHEN status='healthy' THEN 1 ELSE 0 END) as healthy,
            MIN(timestamp) as started_at
     FROM health_snapshots
     GROUP BY run_minute
     ORDER BY run_minute DESC
     LIMIT 20`
  );
  return rows.map((r) => {
    const status: Run["status"] = r.healthy === r.total ? "ok" : r.healthy === 0 ? "failed" : "partial";
    return {
      runId: r.run_minute,
      startedAt: r.started_at,
      status,
      summary: `${r.healthy}/${r.total} healthy`,
    };
  });
}

// ── Steward: Dependency Audit ─────────────────────────────────────────────

function stewardDepsRuns(): Run[] {
  const rows = queryDB<{ run_minute: string; components: number; total_vulns: number; critical: number; started_at: string }>(
    STEWARD_DB,
    `SELECT strftime('%Y-%m-%dT%H:%M', timestamp) as run_minute,
            COUNT(DISTINCT component_name) as components,
            SUM(total) as total_vulns,
            SUM(critical) as critical,
            MIN(timestamp) as started_at
     FROM dependency_audits
     GROUP BY run_minute
     ORDER BY run_minute DESC
     LIMIT 20`
  );
  return rows.map((r) => {
    const status: Run["status"] = r.critical > 0 ? "failed" : r.total_vulns > 0 ? "partial" : "ok";
    return {
      runId: r.run_minute,
      startedAt: r.started_at,
      status,
      summary: r.total_vulns === 0 ? "All clean" : `${r.total_vulns} vulns${r.critical ? `, ${r.critical} critical` : ""}`,
    };
  });
}

// ── Master of Works: Service Check ───────────────────────────────────────

function mowRuns(): Run[] {
  const rows = queryDB<{ run_minute: string; total: number; healthy: number; started_at: string }>(
    MOW_DB,
    `SELECT strftime('%Y-%m-%dT%H:%M', timestamp) as run_minute,
            COUNT(DISTINCT service_name) as total,
            SUM(CASE WHEN is_healthy=1 THEN 1 ELSE 0 END) as healthy,
            MIN(timestamp) as started_at
     FROM service_statuses
     GROUP BY run_minute
     ORDER BY run_minute DESC
     LIMIT 20`
  );
  return rows.map((r) => {
    const status: Run["status"] = r.healthy === r.total ? "ok" : r.healthy === 0 ? "failed" : "partial";
    return {
      runId: r.run_minute,
      startedAt: r.started_at,
      status,
      summary: `${r.healthy}/${r.total} healthy`,
    };
  });
}

// ── Quartermaster: Resource Monitor ──────────────────────────────────────

function qmRuns(): Run[] {
  const rows = queryDB<{ run_minute: string; max_pct: number; resources: number; started_at: string }>(
    QM_DB,
    `SELECT strftime('%Y-%m-%dT%H:%M', timestamp) as run_minute,
            MAX(percent_used) as max_pct,
            COUNT(DISTINCT resource_name) as resources,
            MIN(timestamp) as started_at
     FROM usage_history
     GROUP BY run_minute
     ORDER BY run_minute DESC
     LIMIT 20`
  );
  return rows.map((r) => {
    const pct = Math.round(r.max_pct);
    const status: Run["status"] = pct >= 90 ? "failed" : pct >= 80 ? "partial" : "ok";
    return {
      runId: r.run_minute,
      startedAt: r.started_at,
      status,
      summary: `Peak ${pct}% across ${r.resources} mounts`,
    };
  });
}

// ── Static schedules (no DB) ──────────────────────────────────────────────

const STATIC_SCHEDULES: Omit<Schedule, "lastRun" | "lastStatus" | "lastSummary" | "recentRuns">[] = [
  { id: "maester-scan",    name: "Knowledge Scan",    agent: "The Maester",          cron: "30 22 * * *",  humanSchedule: "Daily at 00:30 CAT", hasDetail: false },
  { id: "herald-publish",  name: "Telegraph Publish", agent: "The Herald",           cron: "0 0 * * *",    humanSchedule: "Daily at 02:00 CAT", hasDetail: false },
  { id: "hand-snapshot",   name: "Agenda Snapshot",   agent: "The Hand of the King", cron: "*/30 * * * *", humanSchedule: "Every 30 minutes",   hasDetail: false },
  { id: "court-scan",      name: "Court Scan",        agent: "Court",                cron: "7 * * * *",    humanSchedule: "Every hour at :07",  hasDetail: false },
];

// ── Main ──────────────────────────────────────────────────────────────────

export async function GET() {
  const healthRuns = stewardHealthRuns();
  const depsRuns = stewardDepsRuns();
  const mowRuns_ = mowRuns();
  const qmRuns_ = qmRuns();

  const live: Schedule[] = [
    {
      id: "steward-health",
      name: "Village Health Check",
      agent: "The Steward",
      cron: "*/5 * * * *",
      humanSchedule: "Every 5 minutes",
      hasDetail: true,
      lastRun: healthRuns[0]?.startedAt ?? null,
      lastStatus: healthRuns[0]?.status ?? null,
      lastSummary: healthRuns[0]?.summary ?? null,
      recentRuns: healthRuns.slice(0, 10),
    },
    {
      id: "steward-deps",
      name: "Dependency Audit",
      agent: "The Steward",
      cron: "0 20 * * *",
      humanSchedule: "Daily at 22:00 CAT",
      hasDetail: true,
      lastRun: depsRuns[0]?.startedAt ?? null,
      lastStatus: depsRuns[0]?.status ?? null,
      lastSummary: depsRuns[0]?.summary ?? null,
      recentRuns: depsRuns.slice(0, 10),
    },
    {
      id: "master-of-works",
      name: "Infrastructure Check",
      agent: "The Master of Works",
      cron: "*/5 * * * *",
      humanSchedule: "Every 5 minutes",
      hasDetail: true,
      lastRun: mowRuns_[0]?.startedAt ?? null,
      lastStatus: mowRuns_[0]?.status ?? null,
      lastSummary: mowRuns_[0]?.summary ?? null,
      recentRuns: mowRuns_.slice(0, 10),
    },
    {
      id: "quartermaster",
      name: "Resource Monitor",
      agent: "The Quartermaster",
      cron: "0 * * * *",
      humanSchedule: "Every hour",
      hasDetail: true,
      lastRun: qmRuns_[0]?.startedAt ?? null,
      lastStatus: qmRuns_[0]?.status ?? null,
      lastSummary: qmRuns_[0]?.summary ?? null,
      recentRuns: qmRuns_.slice(0, 10),
    },
  ];

  const statics: Schedule[] = STATIC_SCHEDULES.map((s) => ({
    ...s,
    lastRun: null,
    lastStatus: null,
    lastSummary: null,
    recentRuns: [],
  }));

  return Response.json({ schedules: [...live, ...statics], timestamp: new Date().toISOString() });
}
