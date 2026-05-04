// ~/Kingdom/capital/dashboard/app/todos/page.tsx
"use client";
import { useEffect, useState, useCallback } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:5001";

interface Todo {
  id: string;
  village: string;
  title: string;
  description: string | null;
  source: string;
  status: string;
  created_at: number;
}

const TABS = ["All", "By Village", "Linked", "Unlinked"] as const;
type Tab = (typeof TABS)[number];

const STATUS_COLOR: Record<string, string> = {
  open: "#6c63ff",
  "in-progress": "#f59e0b",
  done: "#22c55e",
};

export default function TodosPage() {
  const [tab, setTab] = useState<Tab>("All");
  const [todos, setTodos] = useState<Todo[]>([]);

  const fetchTodos = useCallback(() => {
    const params = new URLSearchParams({ limit: "100" });
    if (tab === "Linked") params.set("linked", "true");
    if (tab === "Unlinked") params.set("linked", "false");
    fetch(`${API}/api/todos?${params}`)
      .then((r) => r.json())
      .then((d) => setTodos((d.todos || []).filter((t: Todo) => t.status !== "done")));
  }, [tab]);

  useEffect(() => { fetchTodos(); }, [fetchTodos]);

  async function updateStatus(id: string, status: string) {
    await fetch(`${API}/api/todos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    fetchTodos();
  }

  const byVillage = todos.reduce<Record<string, Todo[]>>((acc, t) => {
    (acc[t.village] = acc[t.village] || []).push(t);
    return acc;
  }, {});

  const renderTodo = (todo: Todo) => (
    <div key={todo.id} className="surface flex items-center gap-4 px-5 py-3 mb-2">
      <span
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ background: STATUS_COLOR[todo.status] || "#888" }}
      />
      <span className="text-xs text-[var(--color-text-tertiary)] w-24 flex-shrink-0 capitalize">
        {todo.village}
      </span>
      <span className="flex-1 text-sm text-[var(--color-text-secondary)]">{todo.title}</span>
      {todo.source !== "manual" && (
        <span className="text-xs bg-[var(--color-bg-subtle)] text-[var(--color-accent)] px-2 py-0.5 rounded flex-shrink-0">
          from Error
        </span>
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

  return (
    <div className="space-y-6">
      <header className="border-b border-[var(--color-border)] pb-6">
        <p className="text-xs uppercase tracking-wider text-[var(--color-text-tertiary)] font-medium">
          Kingdom Watch
        </p>
        <h1 className="text-2xl font-semibold mt-2 text-[var(--color-text-primary)]">To-Dos</h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          {todos.length} open to-do{todos.length !== 1 ? "s" : ""} across the realm
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
            No open to-dos — the realm is clear.
          </div>
        )}
      </div>
    </div>
  );
}
