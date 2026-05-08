import Database from "better-sqlite3";
import path from "path";

export const dynamic = "force-dynamic";

const HOME = process.env.HOME!;
const STEWARD_DB = path.join(HOME, ".steward-health.db");
const MOW_DB = path.join(HOME, ".master-of-works.db");
const QM_DB = path.join(HOME, ".quartermaster.db");

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

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; runId: string }> }
) {
  const { id, runId } = await params;
  // runId is "YYYY-MM-DDTHH:MM" — match all rows in that minute window
  const minuteStart = `${runId}:00`;
  const minuteEnd = `${runId}:59`;

  if (id === "steward-health") {
    const rows = queryDB<{ service_name: string; status: string; response_time_ms: number | null; details: string | null; timestamp: string }>(
      STEWARD_DB,
      `SELECT service_name, status, response_time_ms, details, timestamp
       FROM health_snapshots
       WHERE timestamp >= ? AND timestamp <= ?
       ORDER BY service_name`,
      [minuteStart, minuteEnd]
    );
    return Response.json({ id, runId, type: "health", rows });
  }

  if (id === "steward-deps") {
    const rows = queryDB<{ component_name: string; component_path: string; critical: number; high: number; moderate: number; low: number; total: number; error: string | null; timestamp: string }>(
      STEWARD_DB,
      `SELECT component_name, component_path, critical, high, moderate, low, total, error, timestamp
       FROM dependency_audits
       WHERE timestamp >= ? AND timestamp <= ?
       ORDER BY component_name`,
      [minuteStart, minuteEnd]
    );
    return Response.json({ id, runId, type: "deps", rows });
  }

  if (id === "master-of-works") {
    const rows = queryDB<{ service_name: string; is_healthy: number; status: string; details: string | null; timestamp: string }>(
      MOW_DB,
      `SELECT service_name, is_healthy, status, details, timestamp
       FROM service_statuses
       WHERE timestamp >= ? AND timestamp <= ?
       ORDER BY service_name`,
      [minuteStart, minuteEnd]
    );
    return Response.json({ id, runId, type: "mow", rows });
  }

  if (id === "quartermaster") {
    const rows = queryDB<{ resource_name: string; used_gb: number; available_gb: number; percent_used: number; timestamp: string }>(
      QM_DB,
      `SELECT resource_name, used_gb, available_gb, percent_used, timestamp
       FROM usage_history
       WHERE timestamp >= ? AND timestamp <= ?
       ORDER BY resource_name`,
      [minuteStart, minuteEnd]
    );
    return Response.json({ id, runId, type: "quartermaster", rows });
  }

  return Response.json({ error: "Unknown schedule id" }, { status: 404 });
}
