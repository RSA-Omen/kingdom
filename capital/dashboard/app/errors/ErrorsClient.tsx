"use client";
import { useState } from "react";
type KingdomError = {
  id: string;
  village: string;
  message: string;
  stack: string | null;
  severity: string;
  status: string;
  linked_todo_id: string | null;
  created_at: number;
};

const API = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:5001";

type FilterTab = "new" | "in-todo" | "resolved" | "all" | "by-village";

const SEVERITY_COLOR: Record<string, string> = {
  error: "#ef4444",
  warning: "#f59e0b",
  info: "#6c63ff",
};

function errorState(err: KingdomError): "new" | "in-todo" | "resolved" {
  if (err.status === "resolved") return "resolved";
  if (err.linked_todo_id) return "in-todo";
  return "new";
}

const STATE_BADGE: Record<string, { label: string; bg: string; text: string }> = {
  new:       { label: "New",      bg: "bg-blue-50",   text: "text-blue-600" },
  "in-todo": { label: "In Todo",  bg: "bg-amber-50",  text: "text-amber-700" },
  resolved:  { label: "Resolved", bg: "bg-green-50",  text: "text-green-700" },
};

function timeAgo(unix: number): string {
  const diff = Math.floor(Date.now() / 1000) - unix;
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const TABS: { id: FilterTab; label: string }[] = [
  { id: "new",        label: "New" },
  { id: "in-todo",    label: "In Todo" },
  { id: "resolved",   label: "Resolved" },
  { id: "all",        label: "All" },
  { id: "by-village", label: "By Village" },
];

export default function ErrorsClient({ errors: initialErrors }: { errors: KingdomError[] }) {
  const [tab, setTab] = useState<FilterTab>("new");
  const [errors, setErrors] = useState<KingdomError[]>(initialErrors);
  const [expanded, setExpanded] = useState<string | null>(null);

  const counts = {
    new:       errors.filter((e) => errorState(e) === "new").length,
    "in-todo": errors.filter((e) => errorState(e) === "in-todo").length,
    resolved:  errors.filter((e) => errorState(e) === "resolved").length,
    all:       errors.length,
  };

  const filtered = errors.filter((e) => {
    const state = errorState(e);
    if (tab === "new") return state === "new";
    if (tab === "in-todo") return state === "in-todo";
    if (tab === "resolved") return state === "resolved";
    return true;
  });

  const byVillage = filtered.reduce<Record<string, KingdomError[]>>((acc, e) => {
    (acc[e.village] = acc[e.village] || []).push(e);
    return acc;
  }, {});

  async function createTodo(error: KingdomError) {
    const title = prompt(`To-Do title for: ${error.message}`);
    if (!title) return;
    const res = await fetch(`${API}/api/todos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ village: error.village, title, source: error.id }),
    });
    const todo = await res.json();
    await fetch(`${API}/api/errors/${error.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ linked_todo_id: todo.id }),
    });
    setErrors((prev) =>
      prev.map((e) => (e.id === error.id ? { ...e, linked_todo_id: todo.id || "linked" } : e))
    );
  }

  async function resolve(id: string) {
    await fetch(`${API}/api/errors/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "resolved" }),
    });
    setErrors((prev) =>
      prev.map((e) => (e.id === id ? { ...e, status: "resolved" } : e))
    );
  }

  const renderError = (err: KingdomError) => {
    const state = errorState(err);
    const badge = STATE_BADGE[state];
    return (
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
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${badge.bg} ${badge.text}`}
          >
            {badge.label}
          </span>
          <span className="text-xs text-[var(--color-text-tertiary)] w-14 text-right flex-shrink-0">
            {timeAgo(err.created_at)}
          </span>
        </div>
        {expanded === err.id && (
          <div className="border-t border-[var(--color-border)] px-5 py-4 bg-[var(--color-bg-subtle)]">
            {err.stack && (
              <pre className="text-xs text-[var(--color-text-tertiary)] overflow-x-auto mb-4 max-h-40">
                {err.stack}
              </pre>
            )}
            <div className="flex gap-3">
              {state === "new" && (
                <button
                  onClick={(e) => { e.stopPropagation(); createTodo(err); }}
                  className="text-xs px-3 py-1.5 rounded bg-[var(--color-accent)] text-white hover:opacity-80"
                >
                  Create To-Do
                </button>
              )}
              {state !== "resolved" && (
                <button
                  onClick={(e) => { e.stopPropagation(); resolve(err.id); }}
                  className="text-xs px-3 py-1.5 rounded border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-subtle)]"
                >
                  Mark Resolved
                </button>
              )}
              {state === "resolved" && (
                <span className="text-xs text-green-600">✓ Resolved</span>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

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
          {counts.new} new · {counts["in-todo"]} in todo · {counts.resolved} resolved
        </p>
      </header>

      <div className="flex gap-1 border-b border-[var(--color-border)]">
        {TABS.map((t) => {
          const count = t.id !== "by-village" ? counts[t.id as keyof typeof counts] : undefined;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 text-sm transition-colors border-b-2 -mb-px flex items-center gap-1.5 ${
                tab === t.id
                  ? "border-[var(--color-accent)] text-[var(--color-text-primary)]"
                  : "border-transparent text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]"
              }`}
            >
              {t.label}
              {count !== undefined && (
                <span className="text-xs bg-[var(--color-bg-subtle)] px-1.5 py-0.5 rounded-full">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div>
        {tab === "by-village"
          ? Object.entries(byVillage).map(([village, errs]) => (
              <div key={village} className="mb-6">
                <h3 className="text-xs uppercase tracking-wider text-[var(--color-text-tertiary)] mb-2 capitalize">
                  {village} ({errs.length})
                </h3>
                {errs.map(renderError)}
              </div>
            ))
          : filtered.map(renderError)}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-sm text-[var(--color-text-tertiary)]">
            {tab === "new" ? "No new errors — the realm is quiet." : "Nothing here."}
          </div>
        )}
      </div>
    </div>
  );
}
