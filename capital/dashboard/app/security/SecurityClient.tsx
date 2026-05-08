"use client";

import { useEffect, useState } from "react";

type Vulnerability = {
  name: string;
  severity: "critical" | "high" | "moderate" | "low" | "info";
  isDirect: boolean;
  range: string;
  fixAvailable: boolean | { name: string; version: string; isSemVerMajor: boolean };
  via: Array<string | { title: string; url: string; severity: string }>;
};

type ComponentResult = {
  name: string;
  path: string;
  vulnerabilities: Vulnerability[];
  metadata: { info: number; low: number; moderate: number; high: number; critical: number; total: number };
  error?: string;
};

type AuditData = {
  components: ComponentResult[];
  totals: { critical: number; high: number; moderate: number; low: number; total: number };
  timestamp: string;
};

const SEVERITY_ORDER = ["critical", "high", "moderate", "low", "info"] as const;

const SEVERITY_STYLE: Record<string, { label: string; bg: string; fg: string; dot: string }> = {
  critical: { label: "Critical", bg: "bg-red-950/40", fg: "text-red-400", dot: "bg-red-400" },
  high:     { label: "High",     bg: "bg-amber-950/40", fg: "text-amber-400", dot: "bg-amber-400" },
  moderate: { label: "Moderate", bg: "bg-yellow-950/30", fg: "text-yellow-400", dot: "bg-yellow-400" },
  low:      { label: "Low",      bg: "bg-neutral-800", fg: "text-neutral-400", dot: "bg-neutral-400" },
  info:     { label: "Info",     bg: "bg-neutral-800", fg: "text-neutral-500", dot: "bg-neutral-500" },
};

export function SecurityClient() {
  const [data, setData] = useState<AuditData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      const r = await fetch("/api/security/audit", { cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setData(await r.json());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  if (loading && !data) {
    return (
      <div className="surface p-6">
        <p className="text-sm text-[var(--color-text-secondary)]">Running audit across all components…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="surface p-6">
        <p className="text-sm text-[var(--color-danger)]">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  const { components, totals } = data;
  const isClean = totals.total === 0;

  return (
    <div className="space-y-8">
      {/* Summary strip */}
      <div className="surface p-6">
        <div className="flex items-baseline justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-[var(--color-text-tertiary)] font-medium">
              Dependency Security
            </p>
            <h2 className="mt-1 text-xl font-semibold text-[var(--color-text-primary)]">
              {isClean ? "All clear." : `${totals.total} vulnerabilit${totals.total === 1 ? "y" : "ies"} found`}
            </h2>
          </div>
          <button
            onClick={refresh}
            className="text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors border border-[var(--color-border)] rounded px-3 py-1.5"
          >
            Refresh
          </button>
        </div>

        {!isClean && (
          <div className="mt-5 grid grid-cols-4 gap-3">
            {(["critical", "high", "moderate", "low"] as const).map((sev) => {
              const count = totals[sev];
              const style = SEVERITY_STYLE[sev];
              return (
                <div
                  key={sev}
                  className={`rounded p-4 text-center ${style.bg}`}
                >
                  <p className={`text-2xl font-semibold tabular-nums ${style.fg}`}>{count}</p>
                  <p className={`mt-1 text-[10px] uppercase tracking-wider ${style.fg} opacity-80`}>
                    {style.label}
                  </p>
                </div>
              );
            })}
          </div>
        )}

        <p className="mt-4 text-[10px] text-[var(--color-text-tertiary)]">
          Audited: admin-center backend · frontend · mcp-server · kingdom dashboard ·{" "}
          {new Date(data.timestamp).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
        </p>
      </div>

      {/* Per-component breakdown */}
      {components.map((comp) => (
        <ComponentSection key={comp.name} comp={comp} />
      ))}
    </div>
  );
}

function ComponentSection({ comp }: { comp: ComponentResult }) {
  const [expanded, setExpanded] = useState(comp.metadata.total > 0);

  if (comp.error) {
    return (
      <div className="surface p-6">
        <ComponentHeader comp={comp} onToggle={() => setExpanded(!expanded)} expanded={expanded} />
        <p className="mt-3 text-xs text-[var(--color-danger)]">{comp.error}</p>
      </div>
    );
  }

  const sorted = [...comp.vulnerabilities].sort(
    (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity)
  );

  return (
    <div className="surface p-6">
      <ComponentHeader comp={comp} onToggle={() => setExpanded(!expanded)} expanded={expanded} />

      {comp.metadata.total === 0 && (
        <p className="mt-3 text-sm text-[var(--color-text-secondary)]">No vulnerabilities.</p>
      )}

      {expanded && sorted.length > 0 && (
        <ul className="mt-4 space-y-2">
          {sorted.map((v, i) => (
            <VulnerabilityRow key={`${v.name}-${i}`} v={v} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ComponentHeader({
  comp,
  onToggle,
  expanded,
}: {
  comp: ComponentResult;
  onToggle: () => void;
  expanded: boolean;
}) {
  const { metadata } = comp;
  return (
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs uppercase tracking-wider text-[var(--color-text-tertiary)] font-medium">
          {comp.name}
        </p>
        <div className="mt-1 flex items-center gap-3">
          {metadata.total === 0 ? (
            <span className="text-sm text-emerald-400">Clean</span>
          ) : (
            ["critical", "high", "moderate", "low"].map((sev) => {
              const count = metadata[sev as keyof typeof metadata] as number;
              if (!count) return null;
              const style = SEVERITY_STYLE[sev];
              return (
                <span key={sev} className={`text-xs font-medium ${style.fg}`}>
                  {count} {style.label}
                </span>
              );
            })
          )}
        </div>
      </div>
      {metadata.total > 0 && (
        <button
          onClick={onToggle}
          className="text-[10px] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors"
        >
          {expanded ? "Collapse" : "Expand"}
        </button>
      )}
    </div>
  );
}

function VulnerabilityRow({ v }: { v: Vulnerability }) {
  const style = SEVERITY_STYLE[v.severity] ?? SEVERITY_STYLE.info;
  const canFix = v.fixAvailable === true;
  const breakingFix = typeof v.fixAvailable === "object" && v.fixAvailable.isSemVerMajor;

  const title = v.via.find((x) => typeof x === "object" && "title" in x);
  const advisoryUrl = typeof title === "object" && "url" in title ? title.url : null;
  const titleText = typeof title === "object" && "title" in title ? title.title : null;

  return (
    <li className="border border-[var(--color-border)] rounded p-3 text-xs">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0">
          <span className={`mt-0.5 inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${style.dot}`} />
          <div className="min-w-0">
            <span className="font-mono font-medium text-[var(--color-text-primary)]">{v.name}</span>
            {v.range && (
              <span className="ml-2 text-[var(--color-text-tertiary)]">{v.range}</span>
            )}
            {titleText && (
              <p className="mt-1 text-[var(--color-text-secondary)] leading-relaxed">{titleText}</p>
            )}
          </div>
        </div>
        <div className="flex-shrink-0 flex items-center gap-2">
          {v.isDirect && (
            <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-tertiary)] border border-[var(--color-border)] rounded px-1.5 py-0.5">
              direct
            </span>
          )}
          <span className={`text-[10px] uppercase tracking-wider font-medium px-1.5 py-0.5 rounded ${style.bg} ${style.fg}`}>
            {style.label}
          </span>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-3">
        {canFix && (
          <span className="text-emerald-400">✓ fixable via npm audit fix</span>
        )}
        {breakingFix && (
          <span className="text-amber-400">⚠ fix requires breaking change</span>
        )}
        {!canFix && !breakingFix && v.fixAvailable === false && (
          <span className="text-[var(--color-text-tertiary)]">no auto-fix available</span>
        )}
        {advisoryUrl && (
          <a
            href={advisoryUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--color-accent)] hover:underline"
          >
            Advisory ↗
          </a>
        )}
      </div>
    </li>
  );
}
