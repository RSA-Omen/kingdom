type BureauData = {
  text: string;
  health: {
    total: number;
    healthy: number;
    unhealthy: number;
    unknown: number;
    healthPercent: number;
  };
  systems: Array<{
    slug: string;
    name: string;
    status: "healthy" | "unhealthy" | "unknown";
    lastCheck: string | null;
    category: string;
  }>;
  gkgpu: {
    reachable: boolean;
    error?: string;
  };
  timestamp: string;
};

export function BureauView({ data, error }: { data: BureauData | null; error: string | null }) {
  if (error) {
    return (
      <div className="surface p-6">
        <Header subtitle="Could not reach The Bureau." />
        <p className="mt-3 text-xs text-[var(--color-danger)]">{error}</p>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="surface p-6">
        <Header subtitle="Checking the Bureau systems…" />
      </div>
    );
  }

  const { health, systems, gkgpu } = data;
  const healthColor =
    health.healthPercent >= 80
      ? "text-emerald-600 dark:text-emerald-400"
      : health.healthPercent >= 50
      ? "text-amber-600 dark:text-amber-400"
      : "text-red-600 dark:text-red-400";

  return (
    <section className="surface p-6">
      <Header subtitle="The Bureau monitors the villages." />

      <div className="mt-4 grid grid-cols-4 gap-3 text-xs">
        <Stat emoji="✅" label="Healthy" value={health.healthy} />
        <Stat emoji="⚠️" label="Unhealthy" value={health.unhealthy} />
        <Stat emoji="❓" label="Unknown" value={health.unknown} />
        <div className="border border-[var(--color-border)] rounded p-2 text-center">
          <p className={`text-base font-semibold tabular-nums ${healthColor}`}>{health.healthPercent}%</p>
          <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-tertiary)]">Health</p>
        </div>
      </div>

      <h3 className="mt-6 text-sm font-semibold text-[var(--color-text-primary)]">Systems</h3>

      {systems.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--color-text-secondary)] italic">No systems registered.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {systems.map((sys) => {
            const icon = sys.status === "healthy" ? "✅" : sys.status === "unhealthy" ? "❌" : "❓";
            return (
              <li
                key={sys.slug}
                className="flex items-center justify-between text-sm border border-[var(--color-border)] rounded p-2"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-base">{icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-[var(--color-text-primary)]">{sys.name}</p>
                    <p className="text-[10px] text-[var(--color-text-tertiary)]">
                      {sys.category}
                      {sys.lastCheck && (
                        <>
                          {" "}
                          ·{" "}
                          {new Date(sys.lastCheck).toLocaleString("en-GB", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </>
                      )}
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {!gkgpu.reachable && (
        <div className="mt-4 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded text-xs">
          <p className="font-medium text-red-700 dark:text-red-400">AI Server Unreachable</p>
          <p className="text-red-600 dark:text-red-500 mt-1">
            {gkgpu.error || "The GKGPU server is not responding."}
          </p>
        </div>
      )}

      <p className="mt-5 text-[10px] text-[var(--color-text-tertiary)]">
        Last check:{" "}
        {new Date(data.timestamp).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}{" "}
        · — The Bureau
      </p>
    </section>
  );
}

function Header({ subtitle }: { subtitle?: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-[var(--color-text-tertiary)] font-medium">
        The Bureau says…
      </p>
      {subtitle && <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{subtitle}</p>}
    </div>
  );
}

function Stat({ emoji, label, value }: { emoji: string; label: string; value: number }) {
  return (
    <div className="border border-[var(--color-border)] rounded p-2 text-center">
      <p className="text-base">{emoji}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-[var(--color-text-primary)]">{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-tertiary)]">{label}</p>
    </div>
  );
}
