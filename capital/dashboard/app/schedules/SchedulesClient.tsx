"use client";

import { useEffect, useRef, useState } from "react";

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

type RunDetail = {
  id: string;
  runId: string;
  type: string;
  rows: any[];
};

const STATUS_STYLE = {
  ok:      { dot: "bg-emerald-400", text: "text-emerald-400", badge: "bg-emerald-950/50 text-emerald-400", label: "All good" },
  partial: { dot: "bg-amber-400",   text: "text-amber-400",   badge: "bg-amber-950/50 text-amber-400",   label: "Partial" },
  failed:  { dot: "bg-red-400",     text: "text-red-400",     badge: "bg-red-950/50 text-red-400",       label: "Failed"  },
  unknown: { dot: "bg-neutral-500", text: "text-neutral-400", badge: "bg-neutral-800 text-neutral-400",  label: "—"       },
};

// ── Plain-English colour reason ────────────────────────────────────────────

function colorReason(run: Run, detail: RunDetail | null): string {
  if (!detail) return run.summary;

  if (detail.type === "health") {
    const unhealthy = detail.rows.filter((r) => r.status !== "healthy");
    if (unhealthy.length === 0) return "All services responded healthy.";
    const names = unhealthy.map((r) => r.service_name).join(", ");
    return `${unhealthy.length} service${unhealthy.length > 1 ? "s" : ""} not healthy: ${names}.`;
  }

  if (detail.type === "deps") {
    const criticalComps = detail.rows.filter((r) => r.critical > 0).map((r) => r.component_name);
    const highComps = detail.rows.filter((r) => r.high > 0 && r.critical === 0).map((r) => r.component_name);
    const totalVulns = detail.rows.reduce((s, r) => s + r.total, 0);
    if (totalVulns === 0) return "No vulnerabilities found across all components.";
    if (criticalComps.length)
      return `Critical CVEs in ${criticalComps.join(", ")}. ${totalVulns} total vulnerabilities.`;
    if (highComps.length)
      return `High-severity CVEs in ${highComps.join(", ")}. No criticals. ${totalVulns} total vulnerabilities.`;
    return `${totalVulns} moderate/low vulnerabilities. No high or critical.`;
  }

  if (detail.type === "mow") {
    const unhealthy = detail.rows.filter((r) => !r.is_healthy);
    if (unhealthy.length === 0) return "All infrastructure services healthy.";
    return `${unhealthy.map((r) => r.service_name).join(", ")} not responding.`;
  }

  if (detail.type === "quartermaster") {
    const high = detail.rows.filter((r) => r.percent_used >= 90);
    const warn = detail.rows.filter((r) => r.percent_used >= 80 && r.percent_used < 90);
    const peak = Math.max(...detail.rows.map((r) => r.percent_used));
    if (high.length) return `${high.map((r) => r.resource_name).join(", ")} at ≥90% — critically full.`;
    if (warn.length) return `${warn.map((r) => r.resource_name).join(", ")} at ≥80% — watch this.`;
    return `All mounts below 80%. Peak usage ${Math.round(peak)}%.`;
  }

  return run.summary;
}

// ── Main component ─────────────────────────────────────────────────────────

export function SchedulesClient() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{
    schedule: Schedule;
    run: Run;
    detail: RunDetail | null;
    loading: boolean;
  } | null>(null);

  useEffect(() => {
    fetch("/api/schedules")
      .then((r) => r.json())
      .then((d) => { setSchedules(d.schedules); setLoading(false); });
  }, []);

  async function openRun(schedule: Schedule, run: Run) {
    if (!schedule.hasDetail) return;
    setModal({ schedule, run, detail: null, loading: true });
    const r = await fetch(`/api/schedules/${schedule.id}/${encodeURIComponent(run.runId)}`);
    const d = await r.json();
    setModal((prev) => prev ? { ...prev, detail: d, loading: false } : null);
  }

  if (loading) {
    return (
      <div className="surface p-6">
        <p className="text-sm text-[var(--color-text-secondary)]">Loading schedules…</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {schedules.map((s) => (
          <ScheduleCard key={s.id} schedule={s} onRunClick={(run) => openRun(s, run)} />
        ))}
      </div>

      {modal && (
        <RunModal
          schedule={modal.schedule}
          run={modal.run}
          detail={modal.detail}
          loading={modal.loading}
          onClose={() => setModal(null)}
        />
      )}
    </>
  );
}

// ── Schedule Card ──────────────────────────────────────────────────────────

function ScheduleCard({
  schedule,
  onRunClick,
}: {
  schedule: Schedule;
  onRunClick: (run: Run) => void;
}) {
  const lastStatus = schedule.lastStatus ?? "unknown";
  const style = STATUS_STYLE[lastStatus];

  return (
    <div className="surface p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${style.dot}`} />
            <p className="text-xs uppercase tracking-wider text-[var(--color-text-tertiary)] font-medium">
              {schedule.agent}
            </p>
          </div>
          <h3 className="mt-1 text-base font-semibold text-[var(--color-text-primary)]">
            {schedule.name}
          </h3>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-xs font-mono text-[var(--color-text-tertiary)]">{schedule.cron}</p>
          <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">{schedule.humanSchedule}</p>
        </div>
      </div>

      {schedule.lastRun && (
        <div className="mt-3 flex items-center gap-3 text-xs text-[var(--color-text-secondary)]">
          <span className={`font-medium ${style.text}`}>{style.label}</span>
          <span>·</span>
          <span>{schedule.lastSummary}</span>
          <span>·</span>
          <span>{formatRelative(schedule.lastRun)}</span>
        </div>
      )}

      {schedule.recentRuns.length > 0 && (
        <div className="mt-4">
          <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-tertiary)] mb-2">
            Recent runs
          </p>
          <div className="flex gap-1 flex-wrap">
            {schedule.recentRuns.map((run) => {
              const rs = STATUS_STYLE[run.status];
              return (
                <button
                  key={run.runId}
                  onClick={() => onRunClick(run)}
                  title={`${run.startedAt.slice(0, 16).replace("T", " ")} UTC — ${run.summary}`}
                  className={`w-3 h-6 rounded-sm transition-all ${rs.dot} opacity-60 hover:opacity-100 hover:scale-110 ${
                    schedule.hasDetail ? "cursor-pointer" : "cursor-default"
                  }`}
                />
              );
            })}
          </div>
          {schedule.hasDetail && (
            <p className="mt-2 text-[10px] text-[var(--color-text-tertiary)]">
              Click a bar to see what happened
            </p>
          )}
        </div>
      )}

      {!schedule.lastRun && !schedule.recentRuns.length && (
        <p className="mt-3 text-xs text-[var(--color-text-tertiary)]">No run data available.</p>
      )}
    </div>
  );
}

// ── Modal ──────────────────────────────────────────────────────────────────

function RunModal({
  schedule,
  run,
  detail,
  loading,
  onClose,
}: {
  schedule: Schedule;
  run: Run;
  detail: RunDetail | null;
  loading: boolean;
  onClose: () => void;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const style = STATUS_STYLE[run.status];
  const reason = colorReason(run, detail);

  // Close on backdrop click
  function handleBackdrop(e: React.MouseEvent) {
    if (e.target === overlayRef.current) onClose();
  }

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      ref={overlayRef}
      onClick={handleBackdrop}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
    >
      <div className="relative w-full max-w-xl max-h-[80vh] overflow-y-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-[var(--color-surface)] border-b border-[var(--color-border)] px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-tertiary)] font-medium">
                {schedule.agent} · {schedule.name}
              </p>
              <h3 className="mt-1 text-sm font-semibold text-[var(--color-text-primary)]">
                {run.startedAt.slice(0, 16).replace("T", " ")} UTC
              </h3>
            </div>
            <button
              onClick={onClose}
              className="text-lg leading-none text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors"
              aria-label="Close"
            >
              ×
            </button>
          </div>

          {/* Status badge + plain-English reason */}
          <div className={`mt-3 flex items-start gap-3 rounded p-3 ${style.badge}`}>
            <span className={`mt-0.5 inline-block w-2 h-2 rounded-full flex-shrink-0 ${style.dot}`} />
            <p className="text-xs leading-relaxed">{loading ? "Loading details…" : reason}</p>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-4">
          {loading && (
            <p className="text-sm text-[var(--color-text-secondary)]">Fetching run data…</p>
          )}
          {detail && <DetailRows detail={detail} />}
        </div>
      </div>
    </div>
  );
}

// ── Detail tables ──────────────────────────────────────────────────────────

function DetailRows({ detail }: { detail: RunDetail }) {
  if (detail.rows.length === 0) {
    return <p className="text-sm text-[var(--color-text-tertiary)]">No rows found for this run window.</p>;
  }

  if (detail.type === "health") {
    return (
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-[var(--color-text-tertiary)] border-b border-[var(--color-border)]">
            <th className="pb-2 font-medium">Service</th>
            <th className="pb-2 font-medium">Status</th>
            <th className="pb-2 font-medium">Response</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border)]">
          {detail.rows.map((r: any) => (
            <tr key={r.service_name}>
              <td className="py-2.5 font-mono text-[var(--color-text-primary)]">{r.service_name}</td>
              <td className={`py-2.5 font-medium ${r.status === "healthy" ? "text-emerald-400" : "text-red-400"}`}>
                {r.status}
              </td>
              <td className="py-2.5 text-[var(--color-text-tertiary)] tabular-nums">
                {r.response_time_ms != null ? `${r.response_time_ms}ms` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  if (detail.type === "deps") {
    return (
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-[var(--color-text-tertiary)] border-b border-[var(--color-border)]">
            <th className="pb-2 font-medium">Component</th>
            <th className="pb-2 font-medium">Crit</th>
            <th className="pb-2 font-medium">High</th>
            <th className="pb-2 font-medium">Mod</th>
            <th className="pb-2 font-medium">Low</th>
            <th className="pb-2 font-medium">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border)]">
          {detail.rows.map((r: any) => (
            <tr key={r.component_name}>
              <td className="py-2.5 font-mono text-[var(--color-text-primary)]">{r.component_name}</td>
              <td className={`py-2.5 tabular-nums font-medium ${r.critical > 0 ? "text-red-400" : "text-[var(--color-text-tertiary)]"}`}>{r.critical}</td>
              <td className={`py-2.5 tabular-nums ${r.high > 0 ? "text-amber-400" : "text-[var(--color-text-tertiary)]"}`}>{r.high}</td>
              <td className={`py-2.5 tabular-nums ${r.moderate > 0 ? "text-yellow-400" : "text-[var(--color-text-tertiary)]"}`}>{r.moderate}</td>
              <td className={`py-2.5 tabular-nums ${r.low > 0 ? "text-neutral-400" : "text-[var(--color-text-tertiary)]"}`}>{r.low}</td>
              <td className="py-2.5 tabular-nums text-[var(--color-text-secondary)] font-semibold">{r.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  if (detail.type === "mow") {
    return (
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-[var(--color-text-tertiary)] border-b border-[var(--color-border)]">
            <th className="pb-2 font-medium">Service</th>
            <th className="pb-2 font-medium">Status</th>
            <th className="pb-2 font-medium">Detail</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border)]">
          {detail.rows.map((r: any, i: number) => (
            <tr key={i}>
              <td className="py-2.5 font-mono text-[var(--color-text-primary)]">{r.service_name}</td>
              <td className={`py-2.5 font-medium ${r.is_healthy ? "text-emerald-400" : "text-red-400"}`}>
                {r.is_healthy ? "healthy" : "unhealthy"}
              </td>
              <td className="py-2.5 text-[var(--color-text-tertiary)] max-w-[200px] truncate">{r.status ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  if (detail.type === "quartermaster") {
    return (
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-[var(--color-text-tertiary)] border-b border-[var(--color-border)]">
            <th className="pb-2 font-medium">Mount</th>
            <th className="pb-2 font-medium">Used</th>
            <th className="pb-2 font-medium">Free</th>
            <th className="pb-2 font-medium">%</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border)]">
          {detail.rows.map((r: any, i: number) => {
            const pct = Math.round(r.percent_used);
            const color = pct >= 90 ? "text-red-400" : pct >= 80 ? "text-amber-400" : "text-emerald-400";
            return (
              <tr key={i}>
                <td className="py-2.5 font-mono text-[var(--color-text-primary)]">{r.resource_name}</td>
                <td className="py-2.5 tabular-nums text-[var(--color-text-secondary)]">{r.used_gb.toFixed(1)} GB</td>
                <td className="py-2.5 tabular-nums text-[var(--color-text-secondary)]">{r.available_gb.toFixed(1)} GB</td>
                <td className={`py-2.5 tabular-nums font-semibold ${color}`}>{pct}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  }

  return <pre className="text-xs text-[var(--color-text-secondary)] overflow-auto">{JSON.stringify(detail.rows, null, 2)}</pre>;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
