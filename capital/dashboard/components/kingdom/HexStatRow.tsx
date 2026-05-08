"use client";

import { useEffect, useState } from "react";

type Stat = { value: string; label: string; href: string; color?: string; glow?: string; hoverFill?: string };

export function HexStatRow() {
  const [stats, setStats] = useState<Stat[]>([
    { value: "—", label: "Systems", href: "/villages" },
    { value: "—", label: "Open Issues", href: "/errors" },
    { value: "—", label: "Open To-Dos", href: "/todos" },
    { value: "—", label: "Health", href: "/villages" },
    { value: "—", label: "Matters", href: "/matters" },
    { value: "—", label: "Vulns", href: "/security" },
  ]);

  useEffect(() => {
    Promise.allSettled([
      fetch("/api/bureau/briefing").then((r) => r.json()),
      fetch("/api/errors/summary").then((r) => r.json()),
      fetch("/api/todos/summary").then((r) => r.json()),
      fetch("/api/hand/agenda").then((r) => r.json()),
      fetch("/api/security/audit").then((r) => r.json()),
    ]).then(([bureau, errors, todos, hand, security]) => {
      const b = bureau.status === "fulfilled" ? bureau.value : null;
      const e = errors.status === "fulfilled" ? errors.value : null;
      const t = todos.status === "fulfilled" ? todos.value : null;
      const h = hand.status === "fulfilled" ? hand.value : null;
      const s = security.status === "fulfilled" ? security.value : null;

      const vulnTotal = s?.totals?.total ?? null;
      const hasCritical = (s?.totals?.critical ?? 0) > 0;
      const hasHigh = (s?.totals?.high ?? 0) > 0;
      const vulnColor = hasCritical ? "#f87171" : hasHigh ? "#fbbf24" : vulnTotal === 0 ? "#4ade80" : "var(--color-accent)";
      const vulnGlow = hasCritical ? "rgba(248,113,113,0.35)" : hasHigh ? "rgba(251,191,36,0.35)" : vulnTotal === 0 ? "rgba(74,222,128,0.35)" : "var(--color-glow)";
      const vulnHover = hasCritical ? "rgba(248,113,113,0.1)" : hasHigh ? "rgba(251,191,36,0.1)" : "rgba(74,222,128,0.1)";

      setStats([
        { value: String(b?.health?.total ?? "—"), label: "Systems", href: "/villages" },
        { value: String(e?.open ?? "—"), label: "Open Issues", href: "/errors" },
        { value: String(t?.open ?? "—"), label: "Open To-Dos", href: "/todos" },
        {
          value: b?.health?.healthPercent != null ? `${b.health.healthPercent}%` : "—",
          label: "Health",
          href: "/villages",
        },
        {
          value: String(h?.agenda?.summary?.total_open ?? "—"),
          label: "Matters",
          href: "/matters",
        },
        {
          value: vulnTotal !== null ? String(vulnTotal) : "—",
          label: "Vulns",
          href: "/security",
          color: vulnColor,
          glow: vulnGlow,
          hoverFill: vulnHover,
        },
      ]);
    });
  }, []);

  return (
    <div className="flex justify-center gap-4 flex-wrap py-2">
      {stats.map((s) => (
        <HexStatCard key={s.label} {...s} />
      ))}
    </div>
  );
}

function HexStatCard({ value, label, href, color, glow, hoverFill }: Stat) {
  const stroke = color ?? "var(--color-accent)";
  const textColor = color ?? "var(--color-accent)";
  const shadowColor = glow ?? "var(--color-glow)";
  const hoverColor = hoverFill ?? "rgba(129,230,217,0.1)";

  return (
    <a
      href={href}
      className="relative flex items-center justify-center group"
      style={{ width: 132, height: 152 }}
    >
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 132 152"
        xmlns="http://www.w3.org/2000/svg"
      >
        <polygon
          points="66,4 128,38 128,106 66,140 4,106 4,38"
          fill="var(--color-hex-fill)"
          stroke={stroke}
          strokeWidth="1.5"
          style={{ filter: `drop-shadow(0 0 6px ${shadowColor})`, transition: "fill 0.2s" }}
          onMouseEnter={(ev) => ((ev.target as SVGPolygonElement).style.fill = hoverColor)}
          onMouseLeave={(ev) => ((ev.target as SVGPolygonElement).style.fill = "var(--color-hex-fill)")}
        />
      </svg>
      <div className="relative text-center" style={{ zIndex: 1 }}>
        <div className="text-2xl font-bold tabular-nums" style={{ color: textColor }}>
          {value}
        </div>
        <div className="mt-1 text-[10px] uppercase tracking-wider" style={{ color: "var(--color-text-tertiary)" }}>
          {label}
        </div>
      </div>
    </a>
  );
}
