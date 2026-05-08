import { execSync } from "child_process";
import Database from "better-sqlite3";
import path from "path";

export const dynamic = "force-dynamic";

type AuditVulnerability = {
  name: string;
  severity: "critical" | "high" | "moderate" | "low" | "info";
  isDirect: boolean;
  range: string;
  fixAvailable: boolean | { name: string; version: string; isSemVerMajor: boolean };
  via: Array<string | { source: number; name: string; dependency: string; title: string; url: string; severity: string }>;
};

type ComponentResult = {
  name: string;
  path: string;
  vulnerabilities: AuditVulnerability[];
  metadata: { info: number; low: number; moderate: number; high: number; critical: number; total: number };
  error?: string;
};

const STEWARD_DB = path.join(process.env.HOME!, ".steward-health.db");

const COMPONENTS = [
  { name: "Admin Center Backend", path: process.env.HOME + "/admin-center/backend" },
  { name: "Admin Center Frontend", path: process.env.HOME + "/admin-center/frontend" },
  { name: "Admin Center MCP Server", path: process.env.HOME + "/admin-center/mcp-server" },
  { name: "Kingdom Dashboard", path: process.env.HOME + "/Kingdom/capital/dashboard" },
];

function readFromSteward(): { results: ComponentResult[]; timestamp: string } | null {
  try {
    const db = new Database(STEWARD_DB, { readonly: true, fileMustExist: true });
    const rows = db.prepare(`
      SELECT component_name, component_path, critical, high, moderate, low, total, error, timestamp
      FROM dependency_audits
      WHERE id IN (SELECT MAX(id) FROM dependency_audits GROUP BY component_name)
      ORDER BY component_name
    `).all() as Array<{
      component_name: string; component_path: string;
      critical: number; high: number; moderate: number; low: number; total: number;
      error: string | null; timestamp: string;
    }>;
    db.close();

    if (rows.length === 0) return null;

    const results: ComponentResult[] = rows.map((r) => ({
      name: r.component_name,
      path: r.component_path,
      vulnerabilities: [],
      metadata: { info: 0, low: r.low, moderate: r.moderate, high: r.high, critical: r.critical, total: r.total },
      ...(r.error ? { error: r.error } : {}),
    }));

    return { results, timestamp: rows[0].timestamp };
  } catch {
    return null;
  }
}

function runLiveAudit(componentPath: string): { vulnerabilities: AuditVulnerability[]; metadata: ComponentResult["metadata"] } {
  let raw: string;
  try {
    raw = execSync("npm audit --json", {
      cwd: componentPath,
      encoding: "utf-8",
      timeout: 60000,
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch (err: any) {
    raw = err.stdout ?? "{}";
  }

  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  const json = JSON.parse(start !== -1 && end !== -1 ? raw.slice(start, end + 1) : "{}");

  const vulnerabilities: AuditVulnerability[] = Object.values(json.vulnerabilities ?? {}).map((v: any) => ({
    name: v.name,
    severity: v.severity,
    isDirect: v.isDirect ?? false,
    range: v.range ?? "",
    fixAvailable: v.fixAvailable ?? false,
    via: v.via ?? [],
  }));

  const metadata = json.metadata?.vulnerabilities ?? { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0 };
  return { vulnerabilities, metadata };
}

export async function GET() {
  // Prefer the Steward's cached results; fall back to live audit if not yet populated
  const cached = readFromSteward();

  if (cached) {
    const totals = cached.results.reduce(
      (acc, r) => ({
        critical: acc.critical + r.metadata.critical,
        high: acc.high + r.metadata.high,
        moderate: acc.moderate + r.metadata.moderate,
        low: acc.low + r.metadata.low,
        total: acc.total + r.metadata.total,
      }),
      { critical: 0, high: 0, moderate: 0, low: 0, total: 0 }
    );
    return Response.json({ components: cached.results, totals, timestamp: cached.timestamp, source: "steward" });
  }

  // Live fallback — Steward hasn't run yet
  const results: ComponentResult[] = [];
  for (const comp of COMPONENTS) {
    try {
      const { vulnerabilities, metadata } = runLiveAudit(comp.path);
      results.push({ name: comp.name, path: comp.path, vulnerabilities, metadata });
    } catch (err) {
      results.push({
        name: comp.name, path: comp.path, vulnerabilities: [],
        metadata: { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0 },
        error: String(err),
      });
    }
  }

  const totals = results.reduce(
    (acc, r) => ({
      critical: acc.critical + r.metadata.critical,
      high: acc.high + r.metadata.high,
      moderate: acc.moderate + r.metadata.moderate,
      low: acc.low + r.metadata.low,
      total: acc.total + r.metadata.total,
    }),
    { critical: 0, high: 0, moderate: 0, low: 0, total: 0 }
  );

  return Response.json({ components: results, totals, timestamp: new Date().toISOString(), source: "live" });
}
