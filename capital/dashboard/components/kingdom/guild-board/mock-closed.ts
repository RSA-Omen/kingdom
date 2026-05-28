import type { DeskItem } from "./types";

const T = {
  teal: "var(--color-accent)",
  bug: "var(--color-bug)",
  incident: "var(--color-danger)",
  waiting: "var(--color-waiting)",
  green: "var(--color-success)",
  dim: "var(--color-text-tertiary)",
};

export const CLOSED_ITEMS: DeskItem[] = [
  {
    id: "closed-1",
    type: "bug",
    village: "Gekko Tracks",
    title: "Daily summary email had wrong totals on month rollover",
    status: "RESOLVED",
    note: "Fixed by Lauchlan",
    age: "21d",
    ageLabel: "ago",
    ageTone: "mid",
    events: [
      { kind: "milestone", tone: T.bug, title: "Reported", date: "2026-05-01" },
      { kind: "progress", tone: T.green, title: "Fixed", date: "2026-05-07" },
      { kind: "now", tone: T.green, title: "Closed", date: "2026-05-07" },
    ],
  },
  {
    id: "closed-2",
    type: "project",
    village: "Bender",
    title: "Pronto XI integration · Phase 1",
    status: "LIVE",
    note: "Shipped to production",
    age: "1mo",
    ageLabel: "ago",
    ageTone: "mid",
    events: [
      { kind: "milestone", tone: T.green, title: "Kickoff", date: "2026-03-15" },
      { kind: "progress", tone: T.green, title: "Built", date: "2026-04-10" },
      { kind: "progress", tone: T.green, title: "QA", date: "2026-04-22" },
      { kind: "now", tone: T.green, title: "Live", date: "2026-04-28" },
    ],
  },
  {
    id: "closed-3",
    type: "incident",
    village: "Interceptor",
    title: "NextCloud auth expired across all users",
    status: "RESOLVED",
    note: "Token rotated · 12 min outage",
    age: "2mo",
    ageLabel: "ago",
    ageTone: "mid",
    events: [
      { kind: "milestone", tone: T.incident, title: "Detected", date: "2026-03-20" },
      { kind: "progress", tone: T.incident, title: "Patched", date: "2026-03-20" },
      { kind: "now", tone: T.green, title: "Closed", date: "2026-03-20" },
    ],
  },
];
