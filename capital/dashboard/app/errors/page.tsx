// ~/Kingdom/capital/dashboard/app/errors/page.tsx
"use client";
import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:5001";

interface KingdomError {
  id: string;
  village: string;
  message: string;
  stack: string | null;
  severity: string;
  status: string;
  linked_todo_id: string | null;
  created_at: number;
}

const TABS = ["All", "By Village", "Linked to To-Do"] as const;
type Tab = (typeof TABS)[number];

const SEVERITY_COLOR: Record<string, string> = {
  error: "#ef4444",
  warning: "#f59e0b",
  info: "#6c63ff",
};

function timeAgo(unix: number): string {
  const diff = Math.floor(Date.now() / 1000) - unix;
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function ErrorsPage() {
  const [tab, setTab] = useState<Tab>("All");
  const [errors, setErrors] = useState<KingdomError[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams({ status: "open", limit: "100" });
    if (tab === "Linked to To-Do") params.set("linked", "true");
    fetch(`${API}/api/errors?${params}`)
      .then((r) => r.json())
      .then((d) => setErrors(d.errors || []));
  }, [tab]);

  const byVillage = errors.reduce<Record<string, KingdomError[]>>((acc, e) => {
    (acc[e.village] = acc[e.village] || []).push(e);
    return acc;
  }, {});

  async function createTodo(error: KingdomError) {
    const title = prompt(`To-Do title for: ${error.message}`);
    if (!title) return;
    await fetch(`${API}/api/todos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ village: error.village, title, source: error.id }),
    });
    setErrors((prev) =>
      prev.map((e) => (e.id === error.id ? { ...e, linked_todo_id: "pending" } : e))
    );
  }

  async function resolve(id: string) {
    await fetch(`${API}/api/errors/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "resolved" }),
    });
    setErrors((prev) => prev.filter((e) => e.id !== id));
  }

  const renderError = (err: KingdomError) => (
    <div key={err.id} className="surface mb-2 overflow-hidden">
      <div
        className="flex items-center gap-4 px-5 py-3 cursor-pointer hover:bg-[var(--color-bg-subtle)]"
        onClick={() => setExpanded(expanded === err.id ? null : err.id)}
      >
        <span
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ background: SEVERITY_COLOR[err.severity] || "#888" }}
        />
        <span className="text-xs text-[var(--color-text-tertiary)] w-24 flex-shrink-0 capitalize">
          {err.village}
        </span>
        <span className="flex-1 text-sm text-[var(--color-text-secondary)] truncate">
          {err.message}
        </span>
        {err.linked_todo_id && (
          <span className="text-xs bg-[var(--color-bg-subtle)] text-[var(--color-accent)] px-2 py-0.5 rounded">
            → TODO
          </span>
        )}
        <span className="text-xs text-[var(--color-text-tertiary)]">{timeAgo(err.created_at)}</span>
      </div>
      {expanded === err.id && (
        <div className="border-t border-[var(--color-border)] px-5 py-4 bg-[var(--color-bg-subtle)]">
          {err.stack && (
            <pre className="text-xs text-[var(--color-text-tertiary)] overflow-x-auto mb-4 max-h-40">
              {err.stack}
            </pre>
          )}
          <div className="flex gap-3">
            {!err.linked_todo_id && (
              <button
                onClick={() => createTodo(err)}
                className="text-xs px-3 py-1.5 rounded bg-[var(--color-accent)] text-white hover:opacity-80"
              >
                Create To-Do
              </button>
            )}
            <button
              onClick={() => resolve(err.id)}
              className="text-xs px-3 py-1.5 rounded border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-subtle)]"
            >
              Mark Resolved
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <header className="border-b border-[var(--color-border)] pb-6">
        <p className="text-xs uppercase tracking-wider text-[var(--color-text-tertiary)] font-medium">
          Kingdom Watch
        </p>
        <h1 className="text-2xl font-semibold mt-2 text-[var(--color-text-primary)]">
          Errors
        </h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          {errors.length} open error{errors.length !== 1 ? "s" : ""} across the realm
        </p>
      </header>

      <div className="flex gap-1 border-b border-[var(--color-border)]">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm transition-colors border-b-2 -mb-px ${
              tab === t
                ? "border-[var(--color-accent)] text-[var(--color-text-primary)]"
                : "border-transparent text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div>
        {tab === "By Village"
          ? Object.entries(byVillage).map(([village, errs]) => (
              <div key={village} className="mb-6">
                <h3 className="text-xs uppercase tracking-wider text-[var(--color-text-tertiary)] mb-2 capitalize">
                  {village} ({errs.length})
                </h3>
                {errs.map(renderError)}
              </div>
            ))
          : errors.map(renderError)}
        {errors.length === 0 && (
          <div className="text-center py-12 text-sm text-[var(--color-text-tertiary)]">
            No open errors — the realm is quiet.
          </div>
        )}
      </div>
    </div>
  );
}
