import { AGE_DISTRIBUTION, STATS } from "./mock-data";

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
  return (
    <div
      className="flex-1"
      style={{ background: c, opacity: o, borderRadius: 2 }}
    />
  );
}

export function StatsStrip() {
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
        <Inline n={STATS.projects} l="Projects" c="var(--color-accent)" />
        <Sep />
        <Inline n={STATS.bugs} l="Bugs" c="var(--color-bug)" />
        <Sep />
        <Inline n={STATS.incidents} l="Incidents" c="var(--color-danger)" />
        <Sep />
        <Inline n={STATS.waitingOver14} l="Waiting >14d" c="var(--color-warning)" />
        <Sep />
        <Inline n={STATS.closed} l="Closed" c="var(--color-text-secondary)" />
      </div>

      {/* age distribution sparkbar */}
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
          {Array.from({ length: AGE_DISTRIBUTION.fresh }).map((_, i) => (
            <Cell key={`f${i}`} c="var(--color-success)" />
          ))}
          {Array.from({ length: AGE_DISTRIBUTION.mid }).map((_, i) => (
            <Cell key={`m${i}`} c="var(--color-warning)" o={0.7} />
          ))}
          {Array.from({ length: AGE_DISTRIBUTION.stale }).map((_, i) => (
            <Cell key={`s${i}`} c="var(--color-danger)" />
          ))}
        </div>
      </div>
    </div>
  );
}
