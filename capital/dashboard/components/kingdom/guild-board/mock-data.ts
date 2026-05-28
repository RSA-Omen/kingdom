/**
 * Mock data for the Guild Board.
 *
 * Phase A uses these constants directly. Phase B will replace this file with
 * server-side fetchers that pull from Asana (Lord Chamberlain classified tasks),
 * Capital DB (errors → incidents), and GitHub (multi-repo issues).
 *
 * The shape MUST match the types in ./types.ts so swapping data sources is
 * mechanical, not architectural.
 */

import type { DeskItem, SidebarItem } from "./types";

const T = {
  teal: "var(--color-accent)",
  bug: "var(--color-bug)",
  incident: "var(--color-danger)",
  waiting: "var(--color-waiting)",
  green: "var(--color-success)",
  dim: "var(--color-text-tertiary)",
};

export const ATTENTION_ITEMS: DeskItem[] = [
  {
    id: "ap-process",
    type: "project",
    village: "AP Process",
    title: "Accounts Payable Module",
    status: "WAITING",
    note: "2 follow-ups sent",
    noteTone: "red",
    age: "43d",
    ageLabel: "waiting",
    ageTone: "red",
    events: [
      { kind: "milestone", tone: T.green, title: "Kickoff", date: "2026-01-15" },
      { kind: "progress", tone: T.green, title: "Requirements", date: "2026-02-10" },
      { kind: "progress", tone: T.green, title: "Build complete", date: "2026-03-28" },
      { kind: "comms", tone: T.waiting, title: "Email delivered", date: "2026-04-01" },
      { kind: "comms", tone: T.waiting, title: "Follow-up #1", date: "2026-04-15" },
      { kind: "comms", tone: T.waiting, title: "Follow-up #2", date: "2026-05-06" },
      { kind: "now", tone: T.incident, title: "Waiting now", date: "today" },
      { kind: "future", title: "Onboarding" },
    ],
  },
  {
    id: "gt-search-stale",
    type: "bug",
    village: "Gekko Tracks",
    title: "Search returns stale results after job update",
    status: "WAITING",
    note: "Fix deployed — awaiting sign-off",
    age: "11d",
    ageLabel: "open",
    ageTone: "amber",
    events: [
      { kind: "milestone", tone: T.bug, title: "Reported", date: "2026-05-16" },
      { kind: "progress", tone: T.bug, title: "Investigating", date: "2026-05-17" },
      { kind: "progress", tone: T.green, title: "Fix deployed", date: "2026-05-21" },
      { kind: "comms", tone: T.waiting, title: "Sign-off ping", date: "2026-05-22" },
      { kind: "now", tone: T.waiting, title: "Awaiting", date: "today" },
      { kind: "future", title: "Close" },
    ],
  },
  {
    id: "gt-year-end",
    type: "project",
    village: "Gekko Tracks",
    title: "Year-end reporting pack",
    status: "WAITING",
    note: "Stakeholder unreachable since 12 May",
    noteTone: "red",
    age: "15d",
    ageLabel: "no comms",
    ageTone: "red",
    events: [
      { kind: "milestone", tone: T.green, title: "Kickoff", date: "2026-03-02" },
      { kind: "progress", tone: T.green, title: "Spec drafted", date: "2026-03-14" },
      { kind: "progress", tone: T.green, title: "Layouts approved", date: "2026-04-22" },
      { kind: "comms", tone: T.waiting, title: "Sample sent", date: "2026-05-12" },
      { kind: "now", tone: T.incident, title: "Awaiting reply", date: "today" },
      { kind: "future", title: "Sign-off" },
      { kind: "future", title: "Live" },
    ],
  },
];

export const FLIGHT_ITEMS: DeskItem[] = [
  {
    id: "interceptor-routing",
    type: "incident",
    village: "Interceptor",
    title: "NextCloud routing broken on new URL format",
    status: "IN PROGRESS",
    note: "Hot-patch on staging",
    age: "3d",
    ageLabel: "open",
    ageTone: "mid",
    events: [
      { kind: "milestone", tone: T.incident, title: "Reported", date: "2026-05-24" },
      { kind: "progress", tone: T.incident, title: "Triage", date: "2026-05-24" },
      { kind: "progress", tone: T.incident, title: "Repro found", date: "2026-05-25" },
      { kind: "now", tone: T.incident, title: "Patching", date: "today" },
      { kind: "future", title: "Deploy" },
      { kind: "future", title: "Close" },
    ],
  },
  {
    id: "timesheet-double-submit",
    type: "bug",
    village: "Timesheet Bot",
    title: "Double-submit on slow connection",
    status: "IN PROGRESS",
    note: "Race condition isolated",
    age: "6d",
    ageLabel: "open",
    ageTone: "mid",
    events: [
      { kind: "milestone", tone: T.bug, title: "Reported", date: "2026-05-21" },
      { kind: "progress", tone: T.bug, title: "Repro", date: "2026-05-22" },
      { kind: "progress", tone: T.bug, title: "Root cause", date: "2026-05-25" },
      { kind: "now", tone: T.bug, title: "Fix in progress", date: "today" },
      { kind: "future", title: "Deploy" },
    ],
  },
  {
    id: "gt-receipt-jpg",
    type: "bug",
    village: "Gekko Tracks",
    title: "Receipt import fails on JPG files",
    status: "OPEN",
    note: "Investigating",
    age: "3d",
    ageLabel: "open",
    ageTone: "mid",
    events: [
      { kind: "milestone", tone: T.bug, title: "Reported", date: "2026-05-24" },
      { kind: "now", tone: T.bug, title: "Investigating", date: "today" },
      { kind: "future", title: "Fix" },
      { kind: "future", title: "Deploy" },
      { kind: "future", title: "Close" },
    ],
  },
  {
    id: "bender-pronto-phase2",
    type: "project",
    village: "Bender",
    title: "Pronto XI integration · Phase 2",
    status: "IN PROGRESS",
    note: "Procurement entity sync",
    age: "5d",
    ageLabel: "since update",
    ageTone: "mid",
    events: [
      { kind: "milestone", tone: T.green, title: "Kickoff", date: "2026-05-04" },
      { kind: "progress", tone: T.green, title: "Schema mapped", date: "2026-05-12" },
      { kind: "progress", tone: T.green, title: "Endpoints stubbed", date: "2026-05-19" },
      { kind: "now", tone: T.teal, title: "Building", date: "today" },
      { kind: "future", title: "QA" },
      { kind: "future", title: "Live" },
    ],
  },
];

export const VIEW_SIDEBAR: SidebarItem[] = [
  { id: "all", label: "All open", count: 12 },
  { id: "projects", label: "Projects", count: 6 },
  { id: "bugs", label: "Bugs", count: 4 },
  { id: "incidents", label: "Incidents", count: 2 },
  { id: "attention", label: "Needs attention", count: 3 },
  { id: "closed", label: "Closed", count: 26 },
];

export const VILLAGE_SIDEBAR: SidebarItem[] = [
  { id: "gekko", label: "Gekko Tracks", count: 6 },
  { id: "ap", label: "AP Process", count: 2 },
  { id: "bender", label: "Bender", count: 3 },
  { id: "interceptor", label: "Interceptor", count: 3 },
  { id: "timesheet", label: "Timesheet Bot", count: 2 },
];

export const STATS = {
  projects: 6,
  bugs: 4,
  incidents: 2,
  waitingOver14: 3,
  closed: 26,
  active: 12,
  needsAttention: 3,
  closedThisQuarter: 26,
};

/** Age distribution buckets for the sparkbar: [fresh, mid, stale] counts. */
export const AGE_DISTRIBUTION = {
  fresh: 4, // 0-7d
  mid: 5, // 7-14d
  stale: 3, // >14d
};
