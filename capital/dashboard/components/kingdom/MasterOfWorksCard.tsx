"use client";

import { useEffect, useState } from "react";

type MasterOfWorksData = {
  text: string;
  resources?: {
    cpu?: number;
    memory?: number;
    disk?: number;
    gpu?: number;
    load?: {
      one: number;
      five: number;
      fifteen: number;
    };
  };
  services: Array<{
    emoji: string;
    name: string;
    status: string;
    isHealthy: boolean;
  }>;
  timestamp: string;
};

export function MasterOfWorksCard() {
  const [data, setData] = useState<MasterOfWorksData | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      const r = await fetch("/api/master-of-works/briefing", {
        cache: "no-store",
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        setError(e.error ?? `HTTP ${r.status}`);
        return;
      }
      setData(await r.json());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, []);

  if (error) {
    return (
      <div className="surface p-6">
        <Header subtitle="Could not reach The Master of Works." />
        <p className="mt-3 text-xs text-[var(--color-danger)]">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="surface p-6">
        <Header subtitle="Checking infrastructure…" />
      </div>
    );
  }

  const { resources, services } = data;
  const healthyServices = services.filter((s) => s.isHealthy).length;
  const totalServices = services.length;
  const healthPercent =
    totalServices > 0 ? Math.round((healthyServices / totalServices) * 100) : 0;

  const getResourceColor = (value: number | undefined, warn: number, crit: number) => {
    if (value === undefined) return "text-[var(--color-text-secondary)]";
    if (value >= crit) return "text-red-600 dark:text-red-400";
    if (value >= warn) return "text-amber-600 dark:text-amber-400";
    return "text-emerald-600 dark:text-emerald-400";
  };

  return (
    <section className="surface p-6">
      <Header subtitle="The Master of Works monitors the castle." />

      {resources && (
        <>
          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            {resources.cpu !== undefined && (
              <ResourceStat
                emoji="⚙️"
                label="CPU"
                value={resources.cpu}
                percent={true}
                color={getResourceColor(resources.cpu, 80, 95)}
              />
            )}
            {resources.memory !== undefined && (
              <ResourceStat
                emoji="💾"
                label="Memory"
                value={resources.memory}
                percent={true}
                color={getResourceColor(resources.memory, 80, 95)}
              />
            )}
            {resources.disk !== undefined && (
              <ResourceStat
                emoji="💿"
                label="Disk"
                value={resources.disk}
                percent={true}
                color={getResourceColor(resources.disk, 80, 90)}
              />
            )}
            {resources.gpu !== undefined && (
              <ResourceStat
                emoji="🎮"
                label="GPU"
                value={resources.gpu}
                percent={true}
                color={getResourceColor(resources.gpu, 85, 95)}
              />
            )}
          </div>

          {resources.load && (
            <div className="mt-4 p-3 border border-[var(--color-border)] rounded text-xs">
              <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-tertiary)]">
                Load Average
              </p>
              <p className="mt-1 font-mono text-[var(--color-text-primary)]">
                {resources.load.one.toFixed(2)} {resources.load.five.toFixed(2)}{" "}
                {resources.load.fifteen.toFixed(2)}
              </p>
            </div>
          )}
        </>
      )}

      <h3 className="mt-6 text-sm font-semibold text-[var(--color-text-primary)]">
        Services ({healthyServices}/{totalServices})
      </h3>

      {services.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--color-text-secondary)] italic">
          No services checked.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {services.map((service) => (
            <li
              key={service.name}
              className="flex items-center justify-between text-sm border border-[var(--color-border)] rounded p-2"
            >
              <div className="flex items-center gap-2">
                <span className="text-base">{service.emoji}</span>
                <div>
                  <p className="text-xs font-medium text-[var(--color-text-primary)]">
                    {service.name}
                  </p>
                  <p className="text-[10px] text-[var(--color-text-tertiary)]">
                    {service.status}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-5 text-[10px] text-[var(--color-text-tertiary)]">
        Last check:{" "}
        {new Date(data.timestamp).toLocaleString("en-GB", {
          dateStyle: "medium",
          timeStyle: "short",
        })}{" "}
        · — The Master of Works
      </p>
    </section>
  );
}

function Header({ subtitle }: { subtitle?: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-[var(--color-text-tertiary)] font-medium">
        The Castle Status
      </p>
      {subtitle && (
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          {subtitle}
        </p>
      )}
    </div>
  );
}

function ResourceStat({
  emoji,
  label,
  value,
  percent,
  color,
}: {
  emoji: string;
  label: string;
  value: number;
  percent?: boolean;
  color: string;
}) {
  return (
    <div className="border border-[var(--color-border)] rounded p-2 text-center">
      <p className="text-base">{emoji}</p>
      <p className={`mt-1 text-lg font-semibold tabular-nums ${color}`}>
        {value.toFixed(1)}
        {percent ? "%" : ""}
      </p>
      <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-tertiary)]">
        {label}
      </p>
    </div>
  );
}
