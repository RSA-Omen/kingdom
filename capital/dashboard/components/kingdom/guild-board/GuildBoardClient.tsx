"use client";

import { useMemo, useState } from "react";
import { GroupHeader } from "./GroupHeader";
import { Ornament } from "./Ornament";
import { QueueSidebar } from "./QueueSidebar";
import { StatsStripFromFeed } from "./StatsStripFromFeed";
import { Toast } from "./Toast";
import { TriageItem } from "./TriageItem";
import type { DeskItem, ViewFilter } from "./types";

export type GuildBoardData = {
  ok: boolean;
  generatedAt: string;
  source: {
    asanaTasksFetched: number;
    asanaTasksTriaged: number;
    incidentsFromCapital: number;
  };
  stats: {
    projects: number;
    bugs: number;
    incidents: number;
    waitingOver14: number;
    closed: number;
    active: number;
    needsAttention: number;
    closedThisQuarter: number;
  };
  ageDistribution: { fresh: number; mid: number; stale: number };
  attention: DeskItem[];
  flight: DeskItem[];
  closed: DeskItem[];
  villages: Array<{ id: string; label: string; count: number }>;
};

/* ─── filter helpers ─── */

function applyViewFilter(
  items: DeskItem[],
  view: ViewFilter,
  group: "attention" | "flight" | "closed",
) {
  if (view === "attention") return group === "attention" ? items : [];
  if (view === "closed") return group === "closed" ? items : [];
  if (view === "all") return items;
  if (view === "projects") return items.filter((i) => i.type === "project");
  if (view === "bugs") return items.filter((i) => i.type === "bug");
  if (view === "incidents") return items.filter((i) => i.type === "incident");
  return items;
}

function applyVillageFilter(
  items: DeskItem[],
  villageId: string | null,
  villages: Array<{ id: string; label: string }>,
) {
  if (!villageId) return items;
  const label = villages.find((v) => v.id === villageId)?.label;
  if (!label) return items;
  return items.filter((i) => i.village === label);
}

/* ─── page ─── */

export function GuildBoardClient({ data }: { data: GuildBoardData }) {
  const [view, setView] = useState<ViewFilter>("all");
  const [village, setVillage] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [closedOpen, setClosedOpen] = useState(false);

  const flash = (m: string) => setToast(m);

  const attention = useMemo(
    () =>
      applyVillageFilter(
        applyViewFilter(data.attention, view, "attention"),
        village,
        data.villages,
      ),
    [view, village, data.attention, data.villages],
  );
  const flight = useMemo(
    () =>
      applyVillageFilter(
        applyViewFilter(data.flight, view, "flight"),
        village,
        data.villages,
      ),
    [view, village, data.flight, data.villages],
  );
  const closedItems = useMemo(
    () =>
      applyVillageFilter(
        applyViewFilter(data.closed, view, "closed"),
        village,
        data.villages,
      ),
    [view, village, data.closed, data.villages],
  );

  const today = new Date().toISOString().slice(0, 10);
  const showClosedItems = closedOpen || view === "closed";

  // Build the view-filter counts dynamically from the data
  const viewSidebar = [
    { id: "all", label: "All open", count: data.attention.length + data.flight.length },
    {
      id: "projects",
      label: "Projects",
      count: [...data.attention, ...data.flight].filter((i) => i.type === "project").length,
    },
    {
      id: "bugs",
      label: "Bugs",
      count: [...data.attention, ...data.flight].filter((i) => i.type === "bug").length,
    },
    {
      id: "incidents",
      label: "Incidents",
      count: [...data.attention, ...data.flight].filter((i) => i.type === "incident").length,
    },
    { id: "attention", label: "Needs attention", count: data.attention.length },
    { id: "closed", label: "Closed", count: data.closed.length },
  ];

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
            {!data.ok && (
              <span
                className="font-mono"
                style={{
                  fontSize: 11,
                  color: "var(--color-danger)",
                  padding: "3px 7px",
                  border: "1px solid var(--color-danger)",
                  borderRadius: 4,
                }}
                title="The feed could not be fetched — falling back to error state"
              >
                feed degraded
              </span>
            )}
          </div>
          <div style={{ color: "var(--color-text-secondary)", fontSize: 13 }}>
            <span className="font-mono" style={{ color: "var(--color-text-primary)" }}>
              {data.stats.active}
            </span>{" "}
            active ·{" "}
            <span className="font-mono" style={{ color: "var(--color-danger)" }}>
              {data.stats.needsAttention}
            </span>{" "}
            need your attention ·{" "}
            <span className="font-mono" style={{ color: "var(--color-text-tertiary)" }}>
              {data.stats.closedThisQuarter}
            </span>{" "}
            closed this quarter
          </div>
          <div
            className="font-mono"
            style={{ fontSize: 10.5, color: "var(--color-text-tertiary)" }}
          >
            asana: {data.source.asanaTasksTriaged}/{data.source.asanaTasksFetched} triaged
            {" · "}capital incidents: {data.source.incidentsFromCapital}
            {" · "}updated {new Date(data.generatedAt).toLocaleTimeString()}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <BoardButton
            kind="bug"
            onClick={() => flash("New bug — Phase C will create an Asana task")}
          >
            + New bug
          </BoardButton>
          <BoardButton
            kind="incident"
            onClick={() => flash("New incident — Phase C will alert Telegram + open Asana")}
          >
            + New incident
          </BoardButton>
          <BoardButton
            kind="project"
            onClick={() => flash("New project — Phase C will spin up an Asana project")}
          >
            + New project
          </BoardButton>
        </div>
      </header>

      {/* ── Stats ── */}
      <StatsStripFromFeed stats={data.stats} ageDistribution={data.ageDistribution} />

      {/* ── Sidebar + Triage groups ── */}
      <div className="flex gap-7">
        <QueueSidebar
          activeView={view}
          setActiveView={(id) => setView(id as ViewFilter)}
          activeVillage={village}
          setActiveVillage={setVillage}
          viewItems={viewSidebar}
          villageItems={data.villages}
        />

        <div className="flex-1 flex flex-col gap-[18px] min-w-0">
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
                  <TriageItem
                    key={it.id}
                    item={it}
                    onClick={() =>
                      flash(`Open “${it.title}” — Phase C drills into the project chain`)
                    }
                  />
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
                  <TriageItem
                    key={it.id}
                    item={it}
                    onClick={() =>
                      flash(`Open “${it.title}” — Phase C drills into the project chain`)
                    }
                  />
                ))}
              </div>
            )}

            {/* Closed — collapsible */}
            <button
              type="button"
              onClick={() => setClosedOpen((o) => !o)}
              className="w-full flex items-center gap-3 cursor-pointer transition-colors"
              style={{
                padding: "14px 20px",
                color: "var(--color-text-secondary)",
                fontSize: 12,
                background: "rgba(0,0,0,0.18)",
                border: 0,
                textAlign: "left",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.28)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.18)")}
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
                {data.stats.closed}
              </div>
              <div className="ml-auto" style={{ color: "var(--color-text-secondary)" }}>
                this quarter ·{" "}
                {data.closed.length === 0
                  ? "no closed items yet (Phase C fetches completed)"
                  : showClosedItems
                    ? "▲ collapse"
                    : "▼ expand"}
              </div>
            </button>

            {showClosedItems && data.closed.length > 0 && (
              <div>
                {closedItems.length === 0 ? (
                  <EmptyRow message="No closed items match this filter." />
                ) : (
                  closedItems.map((it) => (
                    <TriageItem
                      key={it.id}
                      item={it}
                      onClick={() =>
                        flash(`Open “${it.title}” — Phase C shows the post-mortem chain`)
                      }
                    />
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <Toast message={toast} onClose={() => setToast(null)} />
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
  onClick,
}: {
  kind: "bug" | "incident" | "project";
  children: React.ReactNode;
  onClick?: () => void;
}) {
  if (kind === "project") {
    return (
      <button
        type="button"
        onClick={onClick}
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
        onClick={onClick}
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
          (e.currentTarget.style.background =
            "color-mix(in srgb, var(--color-danger) 8%, transparent)")
        }
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        {children}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
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
