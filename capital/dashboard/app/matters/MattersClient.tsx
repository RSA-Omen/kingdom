"use client";

import { useRouter } from "next/navigation";
import { useTransition, useState } from "react";

type Matter = {
  id: string;
  section: string;
  priority: "P1" | "P2" | "P3" | "IDEA" | null;
  title: string;
  line_no: number;
  weight: number;
  deferred_count: number;
  deferred_until: string | null;
  overdue: boolean;
};

type Snapshot = {
  agenda: {
    generated_at: string;
    summary: {
      total_open: number;
      p1_count: number;
      p2_count: number;
      p3_count: number;
      ideas: number;
      untagged: number;
      overdue: number;
    };
    today: Matter[];
    by_section: Record<string, Matter[]>;
  };
  brief_markdown: string;
};

const PRIORITY_EMOJI: Record<string, string> = {
  P1: "🔴",
  P2: "🟡",
  P3: "🟢",
  IDEA: "💡",
};

const PRIORITY_ORDER: Record<string, number> = { P1: 0, P2: 1, P3: 2, IDEA: 3 };

function trimMd(s: string) {
  return s.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/`([^`]+)`/g, "$1");
}

export function MattersClient({ snap, error }: { snap: Snapshot | null; error: string | null }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [addText, setAddText] = useState("");
  const [addPriority, setAddPriority] = useState("P3");
  const [adding, setAdding] = useState(false);
  const [filter, setFilter] = useState<string>("all");

  const act = (payload: object) => {
    startTransition(async () => {
      await fetch("/api/hand/act", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      router.refresh();
    });
  };

  const addMatter = async () => {
    if (!addText.trim()) return;
    setAdding(true);
    await fetch("/api/hand/act", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "add", text: addText.trim(), priority: addPriority }),
    });
    setAddText("");
    setAdding(false);
    router.refresh();
  };

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader total={0} generated_at={null} />
        <div className="surface p-6">
          <p className="text-sm text-[var(--color-danger)]">{error}</p>
        </div>
      </div>
    );
  }

  if (!snap) {
    return (
      <div className="space-y-6">
        <PageHeader total={0} generated_at={null} />
        <div className="surface p-6 text-sm text-[var(--color-text-secondary)]">Loading…</div>
      </div>
    );
  }

  const { summary, today, by_section, generated_at } = snap.agenda;

  // All matters flat, sorted by weight desc then priority
  const allMatters = Object.values(by_section)
    .flat()
    .sort((a, b) => {
      const pa = PRIORITY_ORDER[a.priority ?? ""] ?? 4;
      const pb = PRIORITY_ORDER[b.priority ?? ""] ?? 4;
      if (pa !== pb) return pa - pb;
      return b.weight - a.weight;
    });

  const todayIds = new Set(today.map((m) => m.id));

  const filtered =
    filter === "all"
      ? allMatters
      : filter === "today"
        ? today
        : filter === "overdue"
          ? allMatters.filter((m) => m.overdue)
          : allMatters.filter((m) => m.priority === filter);

  return (
    <div className="space-y-8">
      <PageHeader total={summary.total_open} generated_at={generated_at} />

      {/* Summary strip */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {[
          { label: "P1", value: summary.p1_count, key: "P1", emoji: "🔴" },
          { label: "P2", value: summary.p2_count, key: "P2", emoji: "🟡" },
          { label: "P3", value: summary.p3_count, key: "P3", emoji: "🟢" },
          { label: "Ideas", value: summary.ideas, key: "IDEA", emoji: "💡" },
          { label: "Untagged", value: summary.untagged, key: "untagged", emoji: "⚪" },
          { label: "Overdue", value: summary.overdue, key: "overdue", emoji: "⏰" },
        ].map((s) => (
          <button
            key={s.key}
            onClick={() => setFilter(filter === s.key ? "all" : s.key)}
            className={`surface p-3 text-center transition-colors cursor-pointer ${
              filter === s.key ? "border-[var(--color-accent)]" : ""
            }`}
          >
            <div className="text-base">{s.emoji}</div>
            <div className="mt-1 text-lg font-bold tabular-nums text-[var(--color-text-primary)]">
              {s.value}
            </div>
            <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-tertiary)]">
              {s.label}
            </div>
          </button>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3 flex-wrap">
        {[
          { key: "all", label: `All (${summary.total_open})` },
          { key: "today", label: `Today's 3` },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded text-xs font-medium border transition-colors ${
              filter === f.key
                ? "bg-[var(--color-accent)] text-[var(--color-accent-fg)] border-[var(--color-accent)]"
                : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
            }`}
          >
            {f.label}
          </button>
        ))}
        <span className="text-xs text-[var(--color-text-tertiary)]">
          {filtered.length} showing
        </span>
      </div>

      {/* Matter list */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="surface p-6 text-sm text-[var(--color-text-secondary)] italic">
            No matters match this filter.
          </div>
        ) : (
          filtered.map((m) => (
            <MatterRow
              key={m.id}
              matter={m}
              isToday={todayIds.has(m.id)}
              isPending={isPending}
              onAct={act}
            />
          ))
        )}
      </div>

      {/* Add matter */}
      <div className="surface p-5">
        <p className="text-xs uppercase tracking-wider text-[var(--color-text-tertiary)] font-medium mb-3">
          Add a matter
        </p>
        <div className="flex gap-2 flex-wrap">
          <input
            type="text"
            value={addText}
            onChange={(e) => setAddText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addMatter()}
            placeholder="Describe the matter…"
            className="flex-1 min-w-48 px-3 py-2 rounded text-sm bg-[var(--color-bg-subtle)] border border-[var(--color-border)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-accent)]"
          />
          <select
            value={addPriority}
            onChange={(e) => setAddPriority(e.target.value)}
            className="px-3 py-2 rounded text-sm bg-[var(--color-bg-subtle)] border border-[var(--color-border)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
          >
            <option value="P1">P1 🔴</option>
            <option value="P2">P2 🟡</option>
            <option value="P3">P3 🟢</option>
            <option value="IDEA">Idea 💡</option>
          </select>
          <button
            onClick={addMatter}
            disabled={adding || !addText.trim()}
            className="px-4 py-2 rounded text-sm font-semibold bg-[var(--color-accent)] text-[var(--color-accent-fg)] hover:bg-[var(--color-accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {adding ? "Adding…" : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
}

function MatterRow({
  matter: m,
  isToday,
  isPending,
  onAct,
}: {
  matter: Matter;
  isToday: boolean;
  isPending: boolean;
  onAct: (p: object) => void;
}) {
  const base = "px-3 py-1.5 text-xs font-medium rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <div
      className={`surface p-4 flex flex-col sm:flex-row sm:items-start gap-3 ${
        isToday ? "border-[var(--color-accent)]" : ""
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2">
          <span className="text-base mt-0.5 flex-shrink-0">
            {PRIORITY_EMOJI[m.priority ?? ""] ?? "⚪"}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[var(--color-text-primary)] leading-snug">
              {trimMd(m.title)}
            </p>
            <div className="mt-1 flex items-center gap-2 flex-wrap">
              <span className="text-[10px] text-[var(--color-text-tertiary)]">{m.section}</span>
              <span className="text-[10px] text-[var(--color-text-tertiary)] font-mono">{m.id}</span>
              {isToday && (
                <span className="text-[10px] text-[var(--color-accent)] font-medium uppercase tracking-wider">
                  today
                </span>
              )}
              {m.overdue && (
                <span className="text-[10px] text-[var(--color-danger)] font-medium uppercase tracking-wider">
                  overdue
                </span>
              )}
              {m.deferred_count > 0 && (
                <span className="text-[10px] text-[var(--color-text-tertiary)]">
                  deferred {m.deferred_count}×
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="flex gap-2 sm:flex-col sm:items-stretch flex-shrink-0">
        <button
          disabled={isPending}
          onClick={() => onAct({ action: "done", id: m.id })}
          className={`${base} bg-[var(--color-accent)] text-[var(--color-accent-fg)] hover:bg-[var(--color-accent-hover)]`}
        >
          Done
        </button>
        <button
          disabled={isPending}
          onClick={() => onAct({ action: "defer", id: m.id, days: 3 })}
          className={`${base} border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-subtle)]`}
        >
          Defer 3d
        </button>
      </div>
    </div>
  );
}

function PageHeader({
  total,
  generated_at,
}: {
  total: number;
  generated_at: string | null;
}) {
  return (
    <div className="border-b border-[var(--color-border)] pb-6">
      <p className="text-xs uppercase tracking-wider text-[var(--color-text-tertiary)] font-medium">
        The Hand of the King
      </p>
      <h1 className="text-3xl font-semibold mt-2 text-[var(--color-text-primary)]">
        Matters of the Realm
      </h1>
      <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
        {total} open matters across the kingdom. Mark done or defer — the Hand updates the ledger.
      </p>
      {generated_at && (
        <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
          Ledger last read{" "}
          {new Date(generated_at).toLocaleString("en-GB", {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </p>
      )}
    </div>
  );
}
