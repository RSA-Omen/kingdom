"use client";
import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Todo {
  id: string;
  village: string;
  title: string;
  description: string | null;
  source: string;
  status: string;
  created_at: number;
  external_url: string | null;
  external_state: string | null;
}

interface SyncRun {
  started_at: number;
  finished_at: number | null;
  trigger: string;
  repos_synced: number;
  issues_imported: number;
  issues_updated: number;
  issues_closed: number;
  error_message: string | null;
}

type Tab = "all" | "village" | "linked" | "unlinked";

const TABS: { key: Tab; label: string; href: string }[] = [
  { key: "all", label: "All", href: "/todos" },
  { key: "village", label: "By Village", href: "/todos?tab=village" },
  { key: "linked", label: "Linked", href: "/todos?tab=linked" },
  { key: "unlinked", label: "Unlinked", href: "/todos?tab=unlinked" },
];

const STATUS_COLOR: Record<string, string> = {
  open: "#6c63ff",
  "in-progress": "#f59e0b",
  done: "#22c55e",
};

function timeAgoUnix(unix: number): string {
  const diff = Math.floor(Date.now() / 1000) - unix;
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function badgeForSource(source: string): { label: string; isExternal: boolean } | null {
  if (source === "manual") return null;
  if (source.startsWith("github:")) return { label: "GitHub", isExternal: true };
  return { label: "from Error", isExternal: false };
}

export default function TodosClient({
  todos: initialTodos,
  tab,
  lastSync,
}: {
  todos: Todo[];
  tab: Tab;
  lastSync: SyncRun | null;
}) {
  const router = useRouter();
  const [todos, setTodos] = useState<Todo[]>(initialTodos);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    setTodos(initialTodos);
  }, [initialTodos]);
  const [, startTransition] = useTransition();
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  async function syncNow() {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const r = await fetch("/api/todos/sync", { method: "POST" });
      const data = await r.json();
      if (data.error) {
        setSyncMessage(`Sync failed: ${data.error}`);
      } else {
        setSyncMessage(
          `Synced ${data.repos_synced} repos — ${data.issues_imported} new, ${data.issues_updated} updated${data.issues_closed ? `, ${data.issues_closed} closed` : ""}`
        );
        // Refresh server-rendered data
        startTransition(() => router.refresh());
      }
    } catch (e: any) {
      setSyncMessage(`Sync failed: ${e.message || "unknown error"}`);
    } finally {
      setSyncing(false);
    }
  }

  async function updateStatus(id: string, status: string) {
    await fetch(`/api/todos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (status === "done") {
      setTodos((prev) => prev.filter((t) => t.id !== id));
    } else {
      setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)));
    }
  }

  const byVillage = todos.reduce<Record<string, Todo[]>>((acc, t) => {
    (acc[t.village] = acc[t.village] || []).push(t);
    return acc;
  }, {});

  const renderTodo = (todo: Todo) => {
    const badge = badgeForSource(todo.source);
    return (
      <div key={todo.id} className="surface flex items-center gap-4 px-5 py-3 mb-2">
        <span
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ background: STATUS_COLOR[todo.status] || "#888" }}
        />
        <span className="text-xs text-[var(--color-text-tertiary)] w-28 flex-shrink-0 capitalize">
          {todo.village}
        </span>
        <span className="flex-1 text-sm text-[var(--color-text-secondary)] truncate">
          {todo.title}
        </span>
        {badge && (
          <span className="text-xs bg-[var(--color-bg-subtle)] text-[var(--color-accent)] px-2 py-0.5 rounded flex-shrink-0">
            {badge.label}
          </span>
        )}
        {todo.external_url && (
          <a
            href={todo.external_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-accent)] underline flex-shrink-0"
            title="Open on GitHub"
          >
            ↗
          </a>
        )}
        <select
          value={todo.status}
          onChange={(e) => updateStatus(todo.id, e.target.value)}
          className="text-xs border border-[var(--color-border)] rounded px-2 py-1 bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)]"
        >
          <option value="open">Open</option>
          <option value="in-progress">In Progress</option>
          <option value="done">Done</option>
        </select>
      </div>
    );
  };

  const lastSyncLabel = lastSync?.finished_at
    ? `Last sync ${timeAgoUnix(lastSync.finished_at)}`
    : "Never synced";

  return (
    <div className="space-y-6">
      <header className="border-b border-[var(--color-border)] pb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-[var(--color-text-tertiary)] font-medium">
              Kingdom Watch
            </p>
            <h1 className="text-2xl font-semibold mt-2 text-[var(--color-text-primary)]">
              To-Dos
            </h1>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              {todos.length} open to-do{todos.length !== 1 ? "s" : ""} across the realm
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <button
              onClick={syncNow}
              disabled={syncing}
              className="text-xs px-3 py-1.5 rounded bg-[var(--color-accent)] text-white hover:opacity-80 disabled:opacity-50"
            >
              {syncing ? "Syncing…" : "Sync GitHub"}
            </button>
            <span className="text-xs text-[var(--color-text-tertiary)]">
              {lastSyncLabel}
            </span>
          </div>
        </div>
        {syncMessage && (
          <div className="mt-3 text-xs text-[var(--color-text-secondary)]">
            {syncMessage}
          </div>
        )}
      </header>

      <div className="flex gap-1 border-b border-[var(--color-border)]">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={t.href as unknown as "/todos"}
            className={`px-4 py-2 text-sm transition-colors border-b-2 -mb-px ${
              tab === t.key
                ? "border-[var(--color-accent)] text-[var(--color-text-primary)]"
                : "border-transparent text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <div>
        {tab === "village"
          ? Object.entries(byVillage).map(([village, items]) => (
              <div key={village} className="mb-6">
                <h3 className="text-xs uppercase tracking-wider text-[var(--color-text-tertiary)] mb-2 capitalize">
                  {village} ({items.length})
                </h3>
                {items.map(renderTodo)}
              </div>
            ))
          : todos.map(renderTodo)}
        {todos.length === 0 && (
          <div className="text-center py-12 text-sm text-[var(--color-text-tertiary)]">
            {tab === "linked"
              ? "No todos linked to a source yet."
              : tab === "unlinked"
              ? "No manual todos yet."
              : "No open to-dos — the realm is clear."}
          </div>
        )}
      </div>
    </div>
  );
}
