"use client";
import { useEffect, useState, useCallback } from "react";
import { Select } from "@/components/kingdom/Select";

// ── Types ────────────────────────────────────────────────────────────────────

interface EmailLog {
  id: number;
  notification_type: string;
  channel: string;
  recipient: string;
  subject: string | null;
  batch_id: number | null;
  status: string;
  error_message: string | null;
  sent_at: string | null;
  user_name: string | null;
}

interface MonthCell {
  batches: number;
  emails: number;
}

interface CardholderRow {
  name: string;
  email: string;
  months: Record<string, MonthCell>;
}

interface CadenceData {
  months: string[];
  cardholders: CardholderRow[];
}

// ── Constants ────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  batch_assigned: "Assigned",
  batch_submitted: "Submitted",
  batch_approved: "Approved",
  batch_rejected: "Rejected",
  eloise_manager_approved: "Mgr Approved →Eloise",
};

const TYPE_COLORS: Record<string, string> = {
  batch_assigned: "#6c63ff",
  batch_submitted: "#f59e0b",
  batch_approved: "#22c55e",
  batch_rejected: "#ef4444",
  eloise_manager_approved: "#0ea5e9",
};

const STATUS_COLORS: Record<string, string> = {
  sent: "#22c55e",
  failed: "#ef4444",
  pending: "#f59e0b",
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-AU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

// ── Sub-components ───────────────────────────────────────────────────────────

function LogsTab() {
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ limit: "200" });
    if (search) params.set("recipient", search);
    if (typeFilter !== "all") params.set("notification_type", typeFilter);
    if (statusFilter !== "all") params.set("status", statusFilter);
    try {
      const res = await fetch(`/api/email-logs?${params}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setLogs(data.logs ?? []);
      setTotal(data.total ?? 0);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [search, typeFilter, statusFilter]);

  useEffect(() => {
    const t = setTimeout(fetchLogs, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [fetchLogs, search]);

  const failCount = logs.filter((l) => l.status === "failed").length;

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--color-text-secondary)]">
        {loading ? "Loading…" : `${total} total${failCount > 0 ? `, ${failCount} failed` : ""}`}
      </p>

      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Search by recipient email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-3 py-2 rounded border border-[var(--color-border)] bg-[var(--color-bg-subtle)] text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-accent)]"
        />
        <Select
          value={typeFilter}
          onChange={setTypeFilter}
          className="w-48"
          options={[
            { value: "all", label: "All types" },
            { value: "batch_assigned", label: "Assigned" },
            { value: "batch_submitted", label: "Submitted" },
            { value: "batch_approved", label: "Approved" },
            { value: "batch_rejected", label: "Rejected" },
            { value: "eloise_manager_approved", label: "Mgr Approved →Eloise" },
          ]}
        />
        <Select
          value={statusFilter}
          onChange={setStatusFilter}
          className="w-36"
          options={[
            { value: "all", label: "All statuses" },
            { value: "sent", label: "Sent" },
            { value: "failed", label: "Failed" },
            { value: "pending", label: "Pending" },
          ]}
        />
      </div>

      {error && (
        <div className="surface p-4 border-l-4 border-red-500">
          <p className="text-sm text-red-400">Could not reach Gekko Tracks: {error}</p>
        </div>
      )}

      {!error && (
        <div className="surface overflow-hidden">
          {loading ? (
            <p className="px-5 py-8 text-sm text-[var(--color-text-tertiary)] text-center">Loading…</p>
          ) : logs.length === 0 ? (
            <p className="px-5 py-8 text-sm text-[var(--color-text-tertiary)] text-center">
              No emails match these filters.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  {["Type", "Recipient", "Subject", "Status", "Sent"].map((h) => (
                    <th
                      key={h}
                      className="px-5 py-3 text-left text-xs uppercase tracking-wider text-[var(--color-text-tertiary)] font-medium"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map((log, i) => (
                  <tr
                    key={log.id}
                    className={`border-b border-[var(--color-border)] last:border-0 ${
                      log.status === "failed"
                        ? "bg-red-950/20"
                        : i % 2 === 1
                        ? "bg-[var(--color-bg-subtle)]/30"
                        : ""
                    }`}
                  >
                    <td className="px-5 py-3">
                      <span
                        className="inline-block px-2 py-0.5 rounded text-xs font-medium text-white"
                        style={{ background: TYPE_COLORS[log.notification_type] ?? "#888" }}
                      >
                        {TYPE_LABELS[log.notification_type] ?? log.notification_type}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="text-[var(--color-text-primary)]">{log.recipient}</div>
                      {log.user_name && (
                        <div className="text-xs text-[var(--color-text-tertiary)]">{log.user_name}</div>
                      )}
                    </td>
                    <td className="px-5 py-3 text-[var(--color-text-secondary)] max-w-xs">
                      <span className="truncate block" title={log.subject ?? ""}>
                        {log.subject ?? "—"}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className="inline-flex items-center gap-1.5 text-xs"
                        style={{ color: STATUS_COLORS[log.status] ?? "#888" }}
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                          style={{ background: STATUS_COLORS[log.status] ?? "#888" }}
                        />
                        {log.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-[var(--color-text-tertiary)] whitespace-nowrap">
                      {formatDate(log.sent_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {!loading && !error && total > logs.length && (
        <p className="text-xs text-[var(--color-text-tertiary)] text-center">
          Showing {logs.length} of {total} — refine your search to narrow results.
        </p>
      )}
    </div>
  );
}

function CadenceTab() {
  const [data, setData] = useState<CadenceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/email-logs?view=cadence&months=6")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setData(d);
      })
      .catch((err) => setError(String(err)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-[var(--color-text-tertiary)] py-8 text-center">Loading…</p>;
  if (error)
    return (
      <div className="surface p-4 border-l-4 border-red-500">
        <p className="text-sm text-red-400">Could not reach Gekko Tracks: {error}</p>
      </div>
    );
  if (!data) return null;

  // Summary counts
  let missedTotal = 0;
  let coveredTotal = 0;
  let noDataTotal = 0;
  for (const ch of data.cardholders) {
    for (const month of data.months) {
      const cell = ch.months[month];
      if (!cell || cell.batches === 0) { noDataTotal++; continue; }
      if (cell.emails > 0) coveredTotal++;
      else missedTotal++;
    }
  }

  return (
    <div className="space-y-4">
      {/* Legend + summary */}
      <div className="flex items-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <span className="w-5 h-5 rounded flex items-center justify-center bg-emerald-900/60 text-emerald-400 text-xs">✓</span>
          <span className="text-[var(--color-text-secondary)]">Email sent ({coveredTotal})</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-5 h-5 rounded flex items-center justify-center bg-red-900/60 text-red-400 text-xs">✗</span>
          <span className="text-[var(--color-text-secondary)]">Missed ({missedTotal})</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-5 h-5 rounded flex items-center justify-center bg-[var(--color-bg-subtle)] text-[var(--color-text-tertiary)] text-xs">—</span>
          <span className="text-[var(--color-text-secondary)]">No batch</span>
        </div>
      </div>

      {missedTotal > 0 && (
        <div className="surface p-3 border-l-4 border-amber-500">
          <p className="text-sm text-amber-400 font-medium">
            {missedTotal} batch{missedTotal !== 1 ? "es" : ""} assigned without a notification email
          </p>
          <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
            Red cells below — cardholder had a batch that month but no email was logged.
          </p>
        </div>
      )}

      {/* Matrix */}
      <div className="surface overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)]">
              <th className="px-5 py-3 text-left text-xs uppercase tracking-wider text-[var(--color-text-tertiary)] font-medium sticky left-0 bg-[var(--color-bg-surface)] min-w-[160px]">
                Cardholder
              </th>
              {data.months.map((m) => (
                <th
                  key={m}
                  className="px-3 py-3 text-center text-xs uppercase tracking-wider text-[var(--color-text-tertiary)] font-medium min-w-[80px]"
                >
                  {m}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.cardholders.map((ch, i) => {
              const rowHasMiss = data.months.some((m) => {
                const cell = ch.months[m];
                return cell && cell.batches > 0 && cell.emails === 0;
              });
              return (
                <tr
                  key={ch.email}
                  className={`border-b border-[var(--color-border)] last:border-0 ${
                    i % 2 === 1 ? "bg-[var(--color-bg-subtle)]/30" : ""
                  }`}
                >
                  <td className="px-5 py-2.5 sticky left-0 bg-inherit">
                    <div
                      className={`text-sm font-medium ${
                        rowHasMiss ? "text-amber-400" : "text-[var(--color-text-primary)]"
                      }`}
                    >
                      {ch.name}
                    </div>
                    <div className="text-xs text-[var(--color-text-tertiary)]">{ch.email}</div>
                  </td>
                  {data.months.map((m) => {
                    const cell = ch.months[m] ?? { batches: 0, emails: 0 };
                    if (cell.batches === 0) {
                      return (
                        <td key={m} className="px-3 py-2.5 text-center">
                          <span className="text-[var(--color-text-tertiary)] text-xs">—</span>
                        </td>
                      );
                    }
                    const ok = cell.emails > 0;
                    return (
                      <td key={m} className="px-3 py-2.5 text-center">
                        <span
                          className={`inline-flex items-center justify-center w-7 h-7 rounded text-sm font-bold ${
                            ok
                              ? "bg-emerald-900/60 text-emerald-400"
                              : "bg-red-900/60 text-red-400"
                          }`}
                          title={
                            ok
                              ? `${cell.emails} email(s) sent`
                              : `Batch exists, no email sent`
                          }
                        >
                          {ok ? "✓" : "✗"}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-[var(--color-text-tertiary)]">
        Showing last 6 months. Only batch_assigned emails counted — this is the monthly notification cardholders receive when their batch is ready to classify.
      </p>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

type Tab = "logs" | "cadence";

export default function EmailLogsPage() {
  const [tab, setTab] = useState<Tab>("cadence");

  return (
    <div className="space-y-6">
      <header className="border-b border-[var(--color-border)] pb-6">
        <p className="text-xs uppercase tracking-wider text-[var(--color-text-tertiary)] font-medium">
          Kingdom Watch · Gekko Tracks
        </p>
        <h1 className="text-2xl font-semibold mt-2 text-[var(--color-text-primary)]">Email Logs</h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Notification history — who got what, and whether monthly assignments are firing.
        </p>
      </header>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--color-border)]">
        {(["cadence", "logs"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t
                ? "border-[var(--color-accent)] text-[var(--color-accent)]"
                : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            }`}
          >
            {t === "cadence" ? "Monthly Cadence" : "All Logs"}
          </button>
        ))}
      </div>

      {tab === "cadence" ? <CadenceTab /> : <LogsTab />}
    </div>
  );
}
