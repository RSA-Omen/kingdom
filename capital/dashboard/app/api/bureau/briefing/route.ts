import { readFile } from "fs/promises";
import { homedir } from "os";
import path from "path";

export const dynamic = "force-dynamic";

/**
 * Bureau briefing — proxies admin-center but overrides the `health` block
 * with The Steward's sidecar so every surface (hexagon, /villages,
 * Master of Works) reads from the same source of truth.
 */
async function loadStewardHealth() {
  try {
    const p = path.join(homedir(), ".steward-health.json");
    const text = await readFile(p, "utf-8");
    const sidecar = JSON.parse(text);
    return {
      total: sidecar.total,
      healthy: sidecar.healthy,
      unhealthy: sidecar.unhealthy,
      unknown: 0,
      healthPercent: sidecar.total > 0
        ? Math.round((sidecar.healthy / sidecar.total) * 100)
        : 0,
      sourcedFrom: "steward",
      generatedAt: sidecar.generated_at,
    };
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const res = await fetch("http://localhost:5001/api/bureau/briefing", {
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      return Response.json(
        { error: `Bureau API returned ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();

    // Override health with Steward's canonical view if available.
    const stewardHealth = await loadStewardHealth();
    if (stewardHealth) {
      data.health = stewardHealth;
    }

    return Response.json(data);
  } catch (error) {
    return Response.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
