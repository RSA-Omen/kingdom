"use client";
import { useEffect, useState, useCallback } from "react";

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

const TYPE_LABELS: Record<string, string> = {
  batch_assigned: "Assigned",
  batch_submitted: "Submitted",
  batch_approved: "Approved",
  batch_rejected: "Rejected",
};

const TYPE_COLORS: Record<string, string> = {
  batch_assigned: "#6c63ff",
  batch_submitted: "#f59e0b",
  batch_approved: "#22c55e",
  batch_rejected: "#ef4444",
};

const STATUS_COLORS: Record<string, string> = {
  sent: "#22c55e",
  failed: "#ef4444",
  pending: "#f59e0b",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("en-AU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export default function EmailLogsPage() {
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
    <div className="space-y-6">
      <header className="border-b border-[var(--color-border)] pb-6">
        <p className="text-xs uppercase tracking-wider text-[var(--color-text-tertiary)] font-medium">
          Kingdom Watch
        </p>
        <h1 className="text-2xl font-semibold mt-2 text-[var(--color-text-primary)]">
          Email Logs
        </h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Notification history from Gekko Tracks —{" "}
          {loading ? "loading…" : `${total} total${failCount > 0 ? `, ${failCount} failed` : ""}`}
        </p>
      </header>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Search by recipient email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-3 py-2 rounded border border-[var(--color-border)] bg-[var(--color-bg-subtle)] text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-accent)]"
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2 rounded border border-[var(--color-border)] bg-[var(--color-bg-subtle)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
        >
          <option value="all">All types</option>
          <option value="batch_assigned">Assigned</option>
          <option value="batch_submitted">Submitted</option>
          <option value="batch_approved">Approved</option>
          <option value="batch_rejected">Rejected</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded border border-[var(--color-border)] bg-[var(--color-bg-subtle)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
        >
          <option value="all">All statuses</option>
          <option value="sent">Sent</option>
          <option value="failed">Failed</option>
          <option value="pending">Pending</option>
        </select>
      </div>

      {/* Error state */}
      {error && (
        <div className="surface p-4 border-l-4 border-red-500">
          <p className="text-sm text-red-400">Could not reach Gekko Tracks: {error}</p>
          <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
            Is Gekko Tracks running on port 8002?
          </p>
        </div>
      )}

      {/* Table */}
      {!error && (
        <div className="surface overflow-hidden">
          {loading ? (
            <p className="px-5 py-8 text-sm text-[var(--color-text-tertiary)] text-center">
              Loading…
            </p>
          ) : logs.length === 0 ? (
            <p className="px-5 py-8 text-sm text-[var(--color-text-tertiary)] text-center">
              No emails match these filters.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  <th className="px-5 py-3 text-left text-xs uppercase tracking-wider text-[var(--color-text-tertiary)] font-medium">
                    Type
                  </th>
                  <th className="px-5 py-3 text-left text-xs uppercase tracking-wider text-[var(--color-text-tertiary)] font-medium">
                    Recipient
                  </th>
                  <th className="px-5 py-3 text-left text-xs uppercase tracking-wider text-[var(--color-text-tertiary)] font-medium hidden md:table-cell">
                    Subject
                  </th>
                  <th className="px-5 py-3 text-left text-xs uppercase tracking-wider text-[var(--color-text-tertiary)] font-medium">
                    Status
                  </th>
                  <th className="px-5 py-3 text-left text-xs uppercase tracking-wider text-[var(--color-text-tertiary)] font-medium hidden sm:table-cell">
                    Sent
                  </th>
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
                        style={{
                          background: TYPE_COLORS[log.notification_type] ?? "#888",
                        }}
                      >
                        {TYPE_LABELS[log.notification_type] ?? log.notification_type}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="text-[var(--color-text-primary)]">{log.recipient}</div>
                      {log.user_name && (
                        <div className="text-xs text-[var(--color-text-tertiary)]">
                          {log.user_name}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3 text-[var(--color-text-secondary)] hidden md:table-cell max-w-xs">
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
                      {log.error_message && (
                        <p className="text-xs text-red-400 mt-0.5 max-w-xs" title={log.error_message}>
                          {log.error_message.slice(0, 80)}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-3 text-xs text-[var(--color-text-tertiary)] hidden sm:table-cell whitespace-nowrap">
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
