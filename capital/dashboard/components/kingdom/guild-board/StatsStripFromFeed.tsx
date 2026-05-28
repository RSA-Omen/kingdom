/**
 * StatsStrip variant that reads from the live feed instead of mock-data.
 * Same visual contract as StatsStrip.tsx — only the data source differs.
 */

function Inline({ n, l, c }: { n: number | string; l: string; c: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="font-mono font-semibold" style={{ fontSize: 17, color: c }}>
        {n}
      </span>
      <span style={{ color: "var(--color-text-secondary)", fontSize: 11.5 }}>{l}</span>
    </div>
  );
}

function Sep() {
  return <div style={{ width: 1, height: 18, background: "var(--color-border)" }} />;
}

function Cell({ c, o = 1 }: { c: string; o?: number }) {
  return <div className="flex-1" style={{ background: c, opacity: o, borderRadius: 2 }} />;
}

type Props = {
  stats: {
    projects: number;
    bugs: number;
    incidents: number;
    waitingOver14: number;
    closed: number;
  };
  ageDistribution: { fresh: number; mid: number; stale: number };
};

export function StatsStripFromFeed({ stats, ageDistribution }: Props) {
  return (
    <div
      className="surface"
      style={{
        padding: "14px 18px",
        display: "grid",
        gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 1fr)",
        gap: 22,
        alignItems: "center",
      }}
    >
      <div className="flex flex-wrap items-center gap-[22px]">
        <Inline n={stats.projects} l="Projects" c="var(--color-accent)" />
        <Sep />
        <Inline n={stats.bugs} l="Bugs" c="var(--color-bug)" />
        <Sep />
        <Inline n={stats.incidents} l="Incidents" c="var(--color-danger)" />
        <Sep />
        <Inline n={stats.waitingOver14} l="Waiting >14d" c="var(--color-warning)" />
        <Sep />
        <Inline n={stats.closed} l="Closed" c="var(--color-text-secondary)" />
      </div>

      <div className="flex flex-col gap-[6px]">
        <div className="flex justify-between">
          <div
            className="font-mono uppercase"
            style={{
              fontSize: 10.5,
              letterSpacing: "0.08em",
              color: "var(--color-text-tertiary)",
            }}
          >
            Age distribution
          </div>
          <div
            className="font-mono"
            style={{ fontSize: 10.5, color: "var(--color-text-tertiary)" }}
          >
            fresh ← → stale
          </div>
        </div>
        <div className="flex gap-[2px]" style={{ height: 10 }}>
          {Array.from({ length: Math.max(1, ageDistribution.fresh) }).map((_, i) => (
            <Cell
              key={`f${i}`}
              c="var(--color-success)"
              o={ageDistribution.fresh ? 1 : 0.15}
            />
          ))}
          {Array.from({ length: Math.max(1, ageDistribution.mid) }).map((_, i) => (
            <Cell
              key={`m${i}`}
              c="var(--color-warning)"
              o={ageDistribution.mid ? 0.7 : 0.15}
            />
          ))}
          {Array.from({ length: Math.max(1, ageDistribution.stale) }).map((_, i) => (
            <Cell
              key={`s${i}`}
              c="var(--color-danger)"
              o={ageDistribution.stale ? 1 : 0.15}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
