"use client";

import { useEffect, useState } from "react";

type Stats = {
  timestamp: string;
  summary: {
    total_projects: number;
    total_repos: number;
    stale_count: number;
    by_type: Record<string, number>;
  };
  recent_activity: Array<{
    name: string;
    type: string;
    last_activity: string;
  }>;
};

export function MaesterCard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      const r = await fetch("/api/maester/stats", { cache: "no-store" });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        setError(e.error ?? `HTTP ${r.status}`);
        return;
      }
      setStats(await r.json());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 5 * 60 * 1000); // poll every 5 minutes
    return () => clearInterval(t);
  }, []);

  if (error) {
    return (
      <div className="surface p-6">
        <Header subtitle="Could not reach The Maester." />
        <p className="mt-3 text-xs text-[var(--color-danger)]">{error}</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="surface p-6">
        <Header subtitle="Reading the realm's books…" />
      </div>
    );
  }

  const { summary, recent_activity } = stats;
  const daysStale = 30;

  return (
    <section className="surface p-6">
      <Header subtitle="The Maester has indexed the realm." />

      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <Stat
          icon="📚"
          label="Projects"
          value={summary.total_projects}
        />
        <Stat
          icon="🌳"
          label="Repos"
          value={summary.total_repos}
        />
        <Stat
          icon="😴"
          label={`Stale (>${daysStale}d)`}
          value={summary.stale_count}
        />
        <Stat
          icon="📦"
          label="Apps"
          value={summary.by_type.app || 0}
        />
      </div>

      <h3 className="mt-6 text-sm font-semibold text-[var(--color-text-primary)]">
        Recently Active
      </h3>

      {recent_activity.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--color-text-secondary)] italic">
          No recent activity.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {recent_activity.map((item) => {
            const days = item.last_activity
              ? Math.floor(
                  (Date.now() - new Date(item.last_activity).getTime()) /
                    (24 * 60 * 60 * 1000)
                )
              : null;
            return (
              <li
                key={item.name}
                className="flex items-center justify-between text-sm border border-[var(--color-border)] rounded p-2"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-[var(--color-text-primary)]">
                    {item.name}
                  </p>
                  <p className="text-[10px] text-[var(--color-text-tertiary)]">
                    {item.type}
                    {days !== null && (
                      <>
                        {" "}
                        · {days === 0 ? "today" : `${days}d ago`}
                      </>
                    )}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-5 text-[10px] text-[var(--color-text-tertiary)]">
        Last indexed{" "}
        {new Date(stats.timestamp).toLocaleString("en-GB", {
          dateStyle: "medium",
          timeStyle: "short",
        })}{" "}
        · — The Maester
      </p>
    </section>
  );
}

function Header({ subtitle }: { subtitle?: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-[var(--color-text-tertiary)] font-medium">
        The Maester says…
      </p>
      {subtitle && (
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{subtitle}</p>
      )}
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: number;
}) {
  return (
    <div className="border border-[var(--color-border)] rounded p-2 text-center">
      <p className="text-base">{icon}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-[var(--color-text-primary)]">
        {value}
      </p>
      <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-tertiary)]">
        {label}
      </p>
    </div>
  );
}
