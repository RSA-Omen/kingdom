"use client";

import { useState } from "react";
import type { DeskItem } from "./types";
import { LifecycleBar } from "./LifecycleBar";

const TYPE_TOKENS = {
  project: {
    color: "var(--color-accent)",
    bg: "color-mix(in srgb, var(--color-accent) 10%, transparent)",
    glyph: "◆",
  },
  bug: {
    color: "var(--color-bug)",
    bg: "color-mix(in srgb, var(--color-bug) 10%, transparent)",
    glyph: "●",
  },
  incident: {
    color: "var(--color-danger)",
    bg: "color-mix(in srgb, var(--color-danger) 10%, transparent)",
    glyph: "▲",
  },
} as const;

const AGE_TONE = {
  red: "var(--color-danger)",
  amber: "var(--color-warning)",
  mid: "var(--color-text-primary)",
} as const;

type TriageItemProps = {
  item: DeskItem;
  onClick?: () => void;
};

export function TriageItem({ item, onClick }: TriageItemProps) {
  const [hover, setHover] = useState(false);
  const t = TYPE_TOKENS[item.type];

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onClick}
      className="relative cursor-pointer transition-colors"
      style={{
        display: "grid",
        gridTemplateColumns: "4px 24px minmax(0, 1fr) minmax(160px, 280px) 96px 16px",
        alignItems: "center",
        gap: 14,
        padding: "14px 16px 14px 0",
        background: hover ? "rgba(255,255,255,0.02)" : "transparent",
        borderBottom: "1px solid var(--color-border)",
      }}
    >
      {/* left accent stripe */}
      <div
        style={{
          alignSelf: "stretch",
          width: 3,
          background: t.color,
          opacity: hover ? 1 : 0.75,
          boxShadow: hover ? `0 0 12px color-mix(in srgb, ${t.color} 45%, transparent)` : "none",
          transition: "opacity .12s, box-shadow .12s",
        }}
      />

      {/* type glyph */}
      <div
        className="grid place-items-center"
        style={{
          width: 22,
          height: 22,
          background: t.bg,
          borderRadius: 4,
          color: t.color,
          fontSize: 11,
          fontFamily: "var(--font-mono)",
        }}
      >
        {t.glyph}
      </div>

      {/* title + meta */}
      <div className="flex flex-col gap-1 min-w-0">
        <div
          className="truncate"
          style={{ color: "var(--color-text-primary)", fontSize: 13.5, fontWeight: 500 }}
        >
          <span style={{ color: "var(--color-text-secondary)" }}>{item.village}</span>
          <span style={{ color: "var(--color-text-tertiary)", margin: "0 6px" }}>·</span>
          <span>{item.title}</span>
        </div>
        <div
          className="flex items-center gap-2"
          style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}
        >
          <span
            className="font-mono"
            style={{ color: t.color, opacity: 0.85 }}
          >
            {item.type.toUpperCase()}
          </span>
          <span style={{ color: "var(--color-text-tertiary)" }}>·</span>
          <span className="font-mono">{item.status}</span>
          {item.note && (
            <>
              <span style={{ color: "var(--color-text-tertiary)" }}>·</span>
              <span
                style={{
                  color:
                    item.noteTone === "red"
                      ? "var(--color-danger)"
                      : "var(--color-text-secondary)",
                }}
              >
                {item.note}
              </span>
            </>
          )}
        </div>
      </div>

      {/* lifecycle bar */}
      <div className="flex justify-start min-w-0">
        <LifecycleBar events={item.events} />
      </div>

      {/* age */}
      <div className="flex flex-col items-end gap-[3px] text-right">
        <div
          className="font-mono"
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: AGE_TONE[item.ageTone ?? "mid"],
          }}
        >
          {item.age}
        </div>
        <div
          className="font-mono uppercase"
          style={{
            fontSize: 10.5,
            color: "var(--color-text-tertiary)",
            letterSpacing: "0.06em",
          }}
        >
          {item.ageLabel}
        </div>
      </div>

      {/* chevron */}
      <div
        style={{
          color: "var(--color-text-tertiary)",
          fontSize: 16,
          opacity: hover ? 1 : 0,
          transform: hover ? "translateX(0)" : "translateX(-4px)",
          transition: "opacity .15s, transform .15s",
        }}
      >
        ›
      </div>
    </div>
  );
}
