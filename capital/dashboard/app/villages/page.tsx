import { readFile } from "fs/promises";
import { homedir } from "os";
import path from "path";

export const revalidate = 60;

type Village = {
  name: string;
  url: string | null;
  status: string;
  last_checked: string | null;
  uptime_7d_pct: number;
  sample_count: number;
};

type OpenIncident = {
  service_name: string;
  start_time: string;
};

type Sidecar = {
  generated_at: string;
  total: number;
  healthy: number;
  unhealthy: number;
  villages: Village[];
  open_incidents: OpenIncident[];
};

async function loadSidecar(): Promise<Sidecar | null> {
  try {
    const p = path.join(homedir(), ".steward-health.json");
    const text = await readFile(p, "utf-8");
    return JSON.parse(text) as Sidecar;
  } catch {
    return null;
  }
}

function fmtPct(n: number): string {
  return `${n.toFixed(1)}%`;
}

function fmtDuration(startIso: string): string {
  const start = new Date(startIso).getTime();
  const now = Date.now();
  const minutes = Math.floor((now - start) / 60_000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  if (hours < 24) return `${hours}h ${rem}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

function statusEmoji(status: string): string {
  if (status === "healthy") return "✅";
  if (status === "degraded") return "⚠️";
  return "❌";
}

function pctColor(pct: number, status: string): string {
  if (status !== "healthy") return "var(--color-danger, #ff6b6b)";
  if (pct >= 99) return "var(--color-success, #81e6d9)";
  if (pct >= 95) return "var(--color-warning, #f0c674)";
  return "var(--color-danger, #ff6b6b)";
}

export default async function VillagesPage() {
  const data = await loadSidecar();

  if (!data) {
    return (
      <div className="space-y-8">
        <header className="border-b border-[var(--color-border)] pb-8">
          <p className="text-xs uppercase tracking-wider text-[var(--color-text-tertiary)] font-medium">
            Kingdom Watch · Villages
          </p>
          <h1 className="mt-3 text-3xl font-semibold text-[var(--color-text-primary)] leading-tight">
            Village Uptime
          </h1>
          <p className="mt-3 text-base text-[var(--color-text-secondary)] max-w-2xl leading-relaxed">
            Waiting for the Steward&apos;s first check. The data sidecar
            <code className="mx-1 px-1.5 py-0.5 rounded bg-[var(--color-surface-alt,#0a0a18)] text-xs">
              ~/.steward-health.json
            </code>
            hasn&apos;t been written yet — the Steward refreshes it on every
            5-minute health-check cycle.
          </p>
        </header>
      </div>
    );
  }

  const updated = new Date(data.generated_at);
  const updatedStr = updated.toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className="space-y-8">
      <header className="border-b border-[var(--color-border)] pb-8">
        <p className="text-xs uppercase tracking-wider text-[var(--color-text-tertiary)] font-medium">
          Kingdom Watch · Villages
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-[var(--color-text-primary)] leading-tight">
          Village Uptime
        </h1>
        <p className="mt-3 text-base text-[var(--color-text-secondary)] max-w-2xl leading-relaxed">
          Every village&apos;s health, last 7 days. The Steward polls{" "}
          <code className="px-1.5 py-0.5 rounded bg-[var(--color-surface-alt,#0a0a18)] text-xs">
            /health
          </code>{" "}
          on each village every 5 minutes. This page reflects the same data
          that drives the action-only Telegram alerts.
        </p>
        <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-[var(--color-text-tertiary)]">
          <span>
            <strong className="text-[var(--color-text-primary)] font-medium">
              {data.healthy}
            </strong>{" "}
            of{" "}
            <strong className="text-[var(--color-text-primary)] font-medium">
              {data.total}
            </strong>{" "}
            villages healthy
          </span>
          <span>Last refresh: {updatedStr}</span>
          <span>
            Auto-revalidates every 60s · refresh the page for the latest
          </span>
        </div>
      </header>

      <section>
        <h2 className="text-sm uppercase tracking-wider font-medium text-[var(--color-text-secondary)] mb-4">
          Villages
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.villages.map((v) => {
            const healthy = v.status === "healthy";
            return (
              <div
                key={v.name}
                className={`rounded-lg border p-5 ${
                  healthy
                    ? "border-[var(--color-border)] bg-[var(--color-surface,#0a0a18)]"
                    : "border-[var(--color-danger,#ff6b6b)]/40 bg-[var(--color-danger,#ff6b6b)]/5"
                }`}
              >
                <div className="text-base font-medium text-[var(--color-text-primary)] mb-3">
                  {statusEmoji(v.status)} {v.name}
                </div>
                <div
                  className="text-3xl font-semibold leading-none tabular-nums"
                  style={{ color: pctColor(v.uptime_7d_pct, v.status) }}
                >
                  {fmtPct(v.uptime_7d_pct)}
                </div>
                <div className="mt-1 text-xs text-[var(--color-text-tertiary)]">
                  7-day uptime · {v.sample_count.toLocaleString()} samples
                </div>
                <div className="mt-3 pt-3 border-t border-[var(--color-border)] text-[10px] uppercase tracking-wider text-[var(--color-text-tertiary)]">
                  {v.status}
                </div>
                {v.url && (
                  <div className="mt-2 text-[11px] text-[var(--color-text-tertiary)] font-mono break-all">
                    {v.url}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="text-sm uppercase tracking-wider font-medium text-[var(--color-text-secondary)] mb-4">
          Open Incidents
        </h2>
        {data.open_incidents.length === 0 ? (
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface,#0a0a18)] p-5 text-[var(--color-text-tertiary)] italic">
            None — the realm is quiet.
          </div>
        ) : (
          <div className="space-y-2">
            {data.open_incidents.map((i, idx) => (
              <div
                key={idx}
                className="rounded-lg border border-[var(--color-danger,#ff6b6b)]/45 bg-[var(--color-danger,#ff6b6b)]/5 p-4"
              >
                <div className="font-medium text-[var(--color-text-primary)]">
                  {i.service_name} — down {fmtDuration(i.start_time)}
                </div>
                <div className="mt-1 text-xs text-[var(--color-text-tertiary)] font-mono">
                  Detected {new Date(i.start_time).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <footer className="pt-6 border-t border-[var(--color-border)] text-xs text-[var(--color-text-tertiary)]">
        Source: The Steward · <code>~/.steward-health.json</code> ·
        regenerated on every 5-minute check
      </footer>
    </div>
  );
}
