"use client";

import { useMemo, useState } from "react";
import { GroupHeader } from "@/components/kingdom/guild-board/GroupHeader";
import { Ornament } from "@/components/kingdom/guild-board/Ornament";
import { QueueSidebar } from "@/components/kingdom/guild-board/QueueSidebar";
import { StatsStrip } from "@/components/kingdom/guild-board/StatsStrip";
import { TriageItem } from "@/components/kingdom/guild-board/TriageItem";
import {
  ATTENTION_ITEMS,
  FLIGHT_ITEMS,
  STATS,
  VILLAGE_SIDEBAR,
} from "@/components/kingdom/guild-board/mock-data";
import type { DeskItem, ViewFilter } from "@/components/kingdom/guild-board/types";

/* ─── filter helpers ─── */

function applyViewFilter(items: DeskItem[], view: ViewFilter, group: "attention" | "flight") {
  switch (view) {
    case "all":
      return items;
    case "projects":
      return items.filter((i) => i.type === "project");
    case "bugs":
      return items.filter((i) => i.type === "bug");
    case "incidents":
      return items.filter((i) => i.type === "incident");
    case "attention":
      return group === "attention" ? items : [];
    case "closed":
      return [];
    default:
      return items;
  }
}

function applyVillageFilter(items: DeskItem[], villageId: string | null) {
  if (!villageId) return items;
  // Map sidebar village ids to the village strings used on items.
  const labelMap = Object.fromEntries(VILLAGE_SIDEBAR.map((v) => [v.id, v.label]));
  const label = labelMap[villageId];
  if (!label) return items;
  return items.filter((i) => i.village === label);
}

/* ─── page ─── */

export default function GuildBoardPage() {
  const [view, setView] = useState<ViewFilter>("all");
  const [village, setVillage] = useState<string | null>(null);

  const attention = useMemo(
    () => applyVillageFilter(applyViewFilter(ATTENTION_ITEMS, view, "attention"), village),
    [view, village],
  );
  const flight = useMemo(
    () => applyVillageFilter(applyViewFilter(FLIGHT_ITEMS, view, "flight"), village),
    [view, village],
  );

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex flex-col gap-6">
      {/* ── Header ── */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-[6px] min-w-0">
          <div className="flex items-center gap-3">
            <h1
              className="m-0 flex flex-wrap items-center gap-3"
              style={{
                color: "var(--color-text-primary)",
                fontSize: 22,
                fontWeight: 600,
                letterSpacing: "-0.01em",
              }}
            >
              <span>The Guild Board</span>
              <Ornament />
            </h1>
            <span
              className="font-mono"
              style={{
                fontSize: 11,
                color: "var(--color-text-tertiary)",
                padding: "3px 7px",
                border: "1px solid var(--color-border)",
                borderRadius: 4,
              }}
            >
              {today}
            </span>
          </div>
          <div style={{ color: "var(--color-text-secondary)", fontSize: 13 }}>
            <span className="font-mono" style={{ color: "var(--color-text-primary)" }}>
              {STATS.active}
            </span>{" "}
            active ·{" "}
            <span className="font-mono" style={{ color: "var(--color-danger)" }}>
              {STATS.needsAttention}
            </span>{" "}
            need your attention ·{" "}
            <span className="font-mono" style={{ color: "var(--color-text-tertiary)" }}>
              {STATS.closedThisQuarter}
            </span>{" "}
            closed this quarter
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <BoardButton kind="bug">+ New bug</BoardButton>
          <BoardButton kind="incident">+ New incident</BoardButton>
          <BoardButton kind="project">+ New project</BoardButton>
        </div>
      </header>

      {/* ── Stats ── */}
      <StatsStrip />

      {/* ── Sidebar + Triage groups ── */}
      <div className="flex gap-7">
        <QueueSidebar
          activeView={view}
          setActiveView={(id) => setView(id as ViewFilter)}
          activeVillage={village}
          setActiveVillage={setVillage}
        />

        <main className="flex-1 flex flex-col gap-[18px] min-w-0">
          <div className="surface overflow-hidden p-0">
            <GroupHeader
              label="Needs attention"
              count={attention.length}
              tone="var(--color-danger)"
              sub="stale comms · awaiting reply · over threshold"
            />
            {attention.length === 0 ? (
              <EmptyRow message="Nothing in this view." />
            ) : (
              <div>
                {attention.map((it) => (
                  <TriageItem key={it.id} item={it} />
                ))}
              </div>
            )}
          </div>

          <div className="surface overflow-hidden p-0">
            <GroupHeader
              label="In flight"
              count={flight.length}
              tone="var(--color-accent)"
              sub="actively moving"
            />
            {flight.length === 0 ? (
              <EmptyRow message="Nothing in this view." />
            ) : (
              <div>
                {flight.map((it) => (
                  <TriageItem key={it.id} item={it} />
                ))}
              </div>
            )}

            {/* collapsed closed */}
            <div
              className="flex items-center gap-3"
              style={{
                padding: "14px 20px",
                color: "var(--color-text-secondary)",
                fontSize: 12,
                background: "rgba(0,0,0,0.18)",
                cursor: "not-allowed",
              }}
              title="Phase B will wire closed items"
            >
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "var(--color-text-tertiary)",
                }}
              />
              <div
                className="font-mono uppercase"
                style={{
                  fontSize: 10.5,
                  letterSpacing: "0.14em",
                  color: "var(--color-text-secondary)",
                }}
              >
                Closed
              </div>
              <div className="font-mono" style={{ color: "var(--color-text-tertiary)" }}>
                {STATS.closed}
              </div>
              <div className="ml-auto" style={{ color: "var(--color-text-secondary)" }}>
                this quarter · ▼ expand
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

/* ─── small UI bits ─── */

function EmptyRow({ message }: { message: string }) {
  return (
    <div
      style={{
        padding: "28px 20px",
        color: "var(--color-text-tertiary)",
        fontSize: 12.5,
        textAlign: "center",
      }}
    >
      {message}
    </div>
  );
}

function BoardButton({
  kind,
  children,
}: {
  kind: "bug" | "incident" | "project";
  children: React.ReactNode;
}) {
  if (kind === "project") {
    return (
      <button
        type="button"
        className="cursor-pointer transition-colors"
        style={{
          background: "var(--color-accent)",
          color: "var(--color-accent-fg)",
          border: "1px solid var(--color-accent)",
          font: "500 12px/1 var(--font-sans)",
          padding: "8px 12px",
          borderRadius: 6,
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-accent-hover)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "var(--color-accent)")}
      >
        {children}
      </button>
    );
  }
  if (kind === "incident") {
    return (
      <button
        type="button"
        className="cursor-pointer transition-colors"
        style={{
          background: "transparent",
          color: "var(--color-danger)",
          border:
            "1px solid color-mix(in srgb, var(--color-danger) 45%, transparent)",
          font: "500 12px/1 var(--font-sans)",
          padding: "8px 12px",
          borderRadius: 6,
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
        }}
        onMouseEnter={(e) =>
          (e.currentTarget.style.background = "color-mix(in srgb, var(--color-danger) 8%, transparent)")
        }
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        {children}
      </button>
    );
  }
  // bug
  return (
    <button
      type="button"
      className="cursor-pointer transition-colors"
      style={{
        background: "transparent",
        color: "var(--color-bug)",
        border: "1px solid var(--color-bug)",
        font: "500 12px/1 var(--font-sans)",
        padding: "8px 12px",
        borderRadius: 6,
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
      }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.background = "color-mix(in srgb, var(--color-bug) 8%, transparent)")
      }
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      {children}
    </button>
  );
}
