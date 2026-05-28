/**
 * Guild Board shared types.
 *
 * Phase A uses mock data shaped against these types so Phase B can swap in
 * live data from Asana (via Lord Chamberlain's classification), Capital DB
 * (errors → incidents), and GitHub (multi-repo issues) without component
 * changes.
 */

export type EntityType = "project" | "bug" | "incident";

export type EventKind =
  | "milestone" // start of phase
  | "progress" // a phase moving forward
  | "comms" // a comms event (email out, reply in)
  | "wait" // waiting state in the chain
  | "now" // current state — "you are here"
  | "future"; // not yet reached (rendered dashed/dim)

export type LifecycleEvent = {
  kind: EventKind;
  tone?: string; // CSS colour reference, e.g. "var(--color-bug)"
  title: string;
  date?: string; // ISO or human; just shown in tooltip
};

export type AgeTone = "red" | "amber" | "mid";

export type DeskItem = {
  /** Stable identifier — task GID, issue ID, etc. */
  id: string;
  type: EntityType;
  village: string;
  title: string;
  status: string;
  /** Optional one-line note shown next to status (e.g. "2 follow-ups sent") */
  note?: string;
  /** "red" makes the note red; otherwise default mid tone */
  noteTone?: "red" | "default";
  /** Compact age, e.g. "43d", "3d" */
  age: string;
  /** Trailing label under age, e.g. "waiting", "open", "since update" */
  ageLabel: string;
  ageTone?: AgeTone;
  events: LifecycleEvent[];
  /** Optional click target (route, modal id) — Phase B */
  href?: string;
};

export type ViewFilter =
  | "all"
  | "projects"
  | "bugs"
  | "incidents"
  | "attention"
  | "closed";

export type VillageFilter = string; // village id (slug)

export type SidebarItem = {
  id: string;
  label: string;
  count: number;
};

// ─── Chain view types ─────────────────────────────────────────────────────────

export type ChainNodeShape = "diamond" | "circle" | "cloud";
export type ChainNodeState = "done" | "waiting" | "comms" | "dim";

export type ChainSubtreeItem = {
  glyph?: string;
  label: string;
  date?: string;
  tone?: "comms";
};

export type ChainNode = {
  shape: ChainNodeShape;
  state: ChainNodeState;
  title: string;
  subtitle?: string;
  desc?: string;
  inlinePill?: string;
  subtree?: { label: string; items: ChainSubtreeItem[] };
};

export type ChainMeta = {
  title: string;
  type: EntityType;
  status: string;
  stakeholder?: string;
  village: string;
  started: string;
  lastComms?: string;
  stuckDays?: number;
  stuckContext?: string;
};

export type ChainData = {
  ok: boolean;
  taskGid: string;
  meta: ChainMeta;
  nodes: ChainNode[];
};
