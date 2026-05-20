"use client";

import { useState } from "react";

type Tab = "action" | "filed" | "bench";

type Source = "outlook" | "teams";
type Kind = "issue" | "opportunity" | "fyi" | "reply-needed";
type Priority = "low" | "med" | "high" | "urgent";
type Village =
  | "gekko-tracks"
  | "bender"
  | "interceptor"
  | "ap-processing"
  | "pdf-removal"
  | "kingdom"
  | "personal"
  | null;

type Draft = {
  id: string;
  source: Source;
  received_at: string;
  from_addr: string;
  subject: string;
  excerpt: string;
  village: Village;
  kind: Kind;
  priority: Priority;
  summary: string;
  rationale: string;
};

type Filed = {
  id: string;
  source: Source;
  received_at: string;
  from_addr: string;
  subject: string;
  rationale: string;
};

type CleanupProposal = {
  id: string;
  pattern: string;
  folder: string | null;
  min_age_days: number;
  reason: string;
  proposed_by: "postmaster" | "operator";
  would_match: number;
};

// ---------- Fixture data ----------

const ACTION_DRAFTS: Draft[] = [
  {
    id: "d-1",
    source: "outlook",
    received_at: "2026-05-20T08:14:00Z",
    from_addr: "sarah@acme-client.com",
    subject: "Tracks export crashes when ledger > 5k rows",
    excerpt:
      "Hey — when we try to export the ledger for May the page hangs and Chrome eventually kills the tab. Happens every time. We need this before close on Friday.",
    village: "gekko-tracks",
    kind: "issue",
    priority: "high",
    summary: "Gekko Tracks: ledger export hangs on >5k rows (client deadline Fri)",
    rationale:
      "Direct client report. Reproducible. Hard deadline mentioned. Routing to Gekko Tracks Issues.",
  },
  {
    id: "d-2",
    source: "teams",
    received_at: "2026-05-20T07:42:00Z",
    from_addr: "Pieter — Pronto Admin",
    subject: "(Teams DM)",
    excerpt:
      "Bender hung overnight again — same spot in the AP creditor screen. Can you get someone to look before month-end run?",
    village: "bender",
    kind: "issue",
    priority: "urgent",
    summary: "Bender: hang on AP creditor screen (urgent — month-end)",
    rationale:
      "Recurring failure noted by Pronto admin. Month-end window approaching. Urgent priority justifies a Telegram ping per house rule.",
  },
  {
    id: "d-3",
    source: "outlook",
    received_at: "2026-05-20T06:58:00Z",
    from_addr: "alerts@ap-processing.local",
    subject: "Batch 2026-05-20-A failed: 12 invoices held",
    excerpt:
      "AP batch 2026-05-20-A finished with 12 invoices in HELD state. Common cause: vendor codes missing. Review at /admin/batches/2026-05-20-A.",
    village: "ap-processing",
    kind: "issue",
    priority: "med",
    summary: "AP Processing: batch held 12 invoices (likely vendor-code gap)",
    rationale:
      "Automated alert. Not urgent (no hard deadline), but real signal — should be an issue, not just noise.",
  },
  {
    id: "d-4",
    source: "outlook",
    received_at: "2026-05-19T22:11:00Z",
    from_addr: "lauchlan@personal.example",
    subject: "Friday dinner — confirm?",
    excerpt:
      "Are we still on for Friday? Need to book the table by Wed.",
    village: "personal",
    kind: "reply-needed",
    priority: "low",
    summary: "Personal: confirm Friday dinner before Wed",
    rationale:
      "Personal correspondence — no village. Routing into Kingdom/TODO.md under ## Personal.",
  },
];

const FILED_FYI: Filed[] = [
  {
    id: "f-1",
    source: "outlook",
    received_at: "2026-05-20T09:02:00Z",
    from_addr: "notifications@github.com",
    subject: "[RSA-Omen/Kingdom] PR #43 merged",
    rationale: "Build / notification mail — no action needed.",
  },
  {
    id: "f-2",
    source: "outlook",
    received_at: "2026-05-20T08:30:00Z",
    from_addr: "newsletter@microsoft.com",
    subject: "What's new in Microsoft 365 — May 2026",
    rationale: "Newsletter — no village, no action.",
  },
  {
    id: "f-3",
    source: "outlook",
    received_at: "2026-05-20T06:00:00Z",
    from_addr: "ci@gekko-tracks.local",
    subject: "Nightly build #1242 — green",
    rationale: "Routine CI success notification.",
  },
];

const CLEANUP_BENCH: CleanupProposal[] = [
  {
    id: "c-1",
    pattern: "from_addr ~ '@marketing\\.|@newsletter\\.'",
    folder: "02-No-action",
    min_age_days: 7,
    reason:
      "Auto-filed marketing/newsletter mail rarely needs revisiting after a week.",
    proposed_by: "postmaster",
    would_match: 18,
  },
  {
    id: "c-2",
    pattern: "from_addr = 'notifications@github.com' AND subject ~ 'merged|closed'",
    folder: "02-No-action",
    min_age_days: 30,
    reason:
      "GitHub PR/issue close notifications older than 30 days are unlikely to be referenced.",
    proposed_by: "postmaster",
    would_match: 41,
  },
];

// ---------- Helpers ----------

const VILLAGE_LABEL: Record<Exclude<Village, null>, string> = {
  "gekko-tracks": "Gekko Tracks",
  bender: "Bender",
  interceptor: "Interceptor",
  "ap-processing": "AP Processing",
  "pdf-removal": "PDF Removal",
  kingdom: "Kingdom",
  personal: "Personal",
};

const PRIORITY_COLOR: Record<Priority, string> = {
  low: "var(--color-text-tertiary)",
  med: "var(--color-info)",
  high: "var(--color-warning)",
  urgent: "var(--color-danger)",
};

const KIND_LABEL: Record<Kind, string> = {
  issue: "issue",
  opportunity: "opportunity",
  fyi: "fyi",
  "reply-needed": "reply needed",
};

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ---------- Component ----------

export function PostmasterClient() {
  const [tab, setTab] = useState<Tab>("action");

  return (
    <div className="space-y-8">
      <header className="border-b border-[var(--color-border)] pb-8">
        <p className="text-xs uppercase tracking-wider text-[var(--color-text-tertiary)] font-medium">
          Royal Court · The Postmaster
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-[var(--color-text-primary)] leading-tight">
          The Postmaster
        </h1>
        <p className="mt-3 text-[var(--color-text-secondary)] max-w-2xl">
          Reads the Gekko M365 inbox and Teams DMs. Drafts village-tagged to-dos for anything that
          needs action. Files FYI mail to a no-action folder. Never sends, replies, or contacts
          subjects.
        </p>
      </header>

      <div
        className="surface border-l-2 px-5 py-4"
        style={{ borderLeftColor: "var(--color-warning)" }}
      >
        <p className="text-xs uppercase tracking-wider font-mono text-[var(--color-warning)] mb-1">
          v0 — stub
        </p>
        <p className="text-sm text-[var(--color-text-secondary)] m-0">
          This page is a static mock with fixture data. No Graph auth, no SQLite, no real
          classification yet. Buttons are visual-only. See{" "}
          <code className="text-[var(--color-accent)]">docs/council/the-postmaster.md</code> for the
          v1 work plan.
        </p>
      </div>

      {/* Stat strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Action needed" value={ACTION_DRAFTS.length} accent />
        <Stat label="Filed FYI today" value={FILED_FYI.length} />
        <Stat label="On cleanup bench" value={CLEANUP_BENCH.length} />
        <Stat label="Last sweep" value="—" muted />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--color-border)]">
        <TabButton active={tab === "action"} onClick={() => setTab("action")}>
          Action needed
          <span className="ml-2 text-xs text-[var(--color-text-tertiary)]">
            {ACTION_DRAFTS.length}
          </span>
        </TabButton>
        <TabButton active={tab === "filed"} onClick={() => setTab("filed")}>
          Filed FYI
          <span className="ml-2 text-xs text-[var(--color-text-tertiary)]">
            {FILED_FYI.length}
          </span>
        </TabButton>
        <TabButton active={tab === "bench"} onClick={() => setTab("bench")}>
          Cleanup bench
          <span className="ml-2 text-xs text-[var(--color-text-tertiary)]">
            {CLEANUP_BENCH.length}
          </span>
        </TabButton>
      </div>

      {/* Tab content */}
      {tab === "action" && <ActionList drafts={ACTION_DRAFTS} />}
      {tab === "filed" && <FiledList filed={FILED_FYI} />}
      {tab === "bench" && <BenchList proposals={CLEANUP_BENCH} />}
    </div>
  );
}

// ---------- Sub-components ----------

function Stat({
  label,
  value,
  accent,
  muted,
}: {
  label: string;
  value: number | string;
  accent?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="surface px-4 py-3">
      <p className="text-xs uppercase tracking-wider font-mono text-[var(--color-text-tertiary)] mb-1">
        {label}
      </p>
      <p
        className="text-2xl font-mono font-semibold"
        style={{
          color: accent
            ? "var(--color-accent)"
            : muted
              ? "var(--color-text-tertiary)"
              : "var(--color-text-primary)",
        }}
      >
        {value}
      </p>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="px-4 py-2 text-sm border-b-2 -mb-px transition-colors"
      style={{
        borderColor: active ? "var(--color-accent)" : "transparent",
        color: active ? "var(--color-text-primary)" : "var(--color-text-secondary)",
      }}
    >
      {children}
    </button>
  );
}

function StubButton({
  children,
  variant = "default",
}: {
  children: React.ReactNode;
  variant?: "default" | "accent" | "danger";
}) {
  const colors = {
    default: {
      bg: "transparent",
      border: "var(--color-border)",
      color: "var(--color-text-secondary)",
    },
    accent: {
      bg: "var(--color-bg-subtle)",
      border: "var(--color-accent)",
      color: "var(--color-accent)",
    },
    danger: {
      bg: "transparent",
      border: "rgba(248,113,113,0.3)",
      color: "var(--color-danger)",
    },
  }[variant];
  return (
    <button
      disabled
      title="Stub — no API wired yet"
      className="px-3 py-1.5 rounded text-xs font-mono uppercase tracking-wider cursor-not-allowed opacity-60 border"
      style={{
        backgroundColor: colors.bg,
        borderColor: colors.border,
        color: colors.color,
      }}
    >
      {children}
    </button>
  );
}

function VillageBadge({ village }: { village: Village }) {
  if (village === null) {
    return (
      <span className="px-2 py-0.5 rounded-sm text-[10px] font-mono uppercase tracking-wider border border-[var(--color-border)] text-[var(--color-text-tertiary)]">
        no-action
      </span>
    );
  }
  return (
    <span className="px-2 py-0.5 rounded-sm text-[10px] font-mono uppercase tracking-wider border border-[var(--color-accent)]/30 text-[var(--color-accent)]">
      {VILLAGE_LABEL[village]}
    </span>
  );
}

function SourceBadge({ source }: { source: Source }) {
  const label = source === "outlook" ? "Outlook" : "Teams DM";
  return (
    <span className="px-2 py-0.5 rounded-sm text-[10px] font-mono uppercase tracking-wider border border-[var(--color-border)] text-[var(--color-text-secondary)]">
      {label}
    </span>
  );
}

function ActionList({ drafts }: { drafts: Draft[] }) {
  return (
    <div className="space-y-3">
      {drafts.map((d) => (
        <div key={d.id} className="surface p-5">
          <div className="flex items-start justify-between gap-4 mb-2">
            <div className="flex items-center gap-2 flex-wrap">
              <VillageBadge village={d.village} />
              <SourceBadge source={d.source} />
              <span
                className="px-2 py-0.5 rounded-sm text-[10px] font-mono uppercase tracking-wider border"
                style={{
                  color: PRIORITY_COLOR[d.priority],
                  borderColor: PRIORITY_COLOR[d.priority] + "4d",
                }}
              >
                {d.priority}
              </span>
              <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-tertiary)]">
                {KIND_LABEL[d.kind]}
              </span>
            </div>
            <span className="text-xs font-mono text-[var(--color-text-tertiary)] whitespace-nowrap">
              {timeAgo(d.received_at)}
            </span>
          </div>

          <h3 className="text-base font-semibold text-[var(--color-text-primary)] mb-1">
            {d.summary}
          </h3>
          <p className="text-xs font-mono text-[var(--color-text-tertiary)] mb-3">
            from {d.from_addr} · {d.subject}
          </p>
          <p className="text-sm text-[var(--color-text-secondary)] mb-3 line-clamp-2">
            {d.excerpt}
          </p>
          <p className="text-xs italic text-[var(--color-text-tertiary)] mb-4">
            <span className="font-mono uppercase tracking-wider mr-2">why:</span>
            {d.rationale}
          </p>

          <div className="flex gap-2">
            <StubButton variant="accent">Approve</StubButton>
            <StubButton>Edit</StubButton>
            <StubButton variant="danger">Reject</StubButton>
            <StubButton>Open original</StubButton>
          </div>
        </div>
      ))}
    </div>
  );
}

function FiledList({ filed }: { filed: Filed[] }) {
  return (
    <div className="space-y-2">
      <p className="text-sm text-[var(--color-text-secondary)] mb-4">
        Auto-filed to <code className="text-[var(--color-accent)]">Postmaster/02-No-action</code>.
        Review to catch mis-filings; otherwise no action required.
      </p>
      {filed.map((f) => (
        <div key={f.id} className="surface flex items-center gap-4 px-4 py-3">
          <SourceBadge source={f.source} />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-[var(--color-text-primary)] truncate">{f.subject}</p>
            <p className="text-xs font-mono text-[var(--color-text-tertiary)] truncate">
              from {f.from_addr} · {f.rationale}
            </p>
          </div>
          <span className="text-xs font-mono text-[var(--color-text-tertiary)] whitespace-nowrap">
            {timeAgo(f.received_at)}
          </span>
          <StubButton>Re-classify</StubButton>
        </div>
      ))}
    </div>
  );
}

function BenchList({ proposals }: { proposals: CleanupProposal[] }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--color-text-secondary)] mb-4">
        Cleanup rules The Postmaster has proposed. None apply until approved. <strong>Archive-only
        in v1</strong> — no hard-delete code exists.
      </p>
      {proposals.map((p) => (
        <div key={p.id} className="surface p-5">
          <div className="flex items-start justify-between gap-4 mb-3">
            <span className="px-2 py-0.5 rounded-sm text-[10px] font-mono uppercase tracking-wider border border-[var(--color-border)] text-[var(--color-text-secondary)]">
              proposed by {p.proposed_by}
            </span>
            <span className="text-xs font-mono text-[var(--color-text-tertiary)] whitespace-nowrap">
              would match {p.would_match} items
            </span>
          </div>

          <pre className="text-xs font-mono mb-3 px-3 py-2 rounded bg-[var(--color-bg-surface-elevated)] border border-[var(--color-border)] overflow-x-auto">
            <code className="text-[var(--color-accent)]">{p.pattern}</code>
          </pre>

          <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-xs font-mono mb-4">
            <dt className="text-[var(--color-text-tertiary)] uppercase tracking-wider">folder</dt>
            <dd className="text-[var(--color-text-primary)]">{p.folder ?? "(any)"}</dd>
            <dt className="text-[var(--color-text-tertiary)] uppercase tracking-wider">min age</dt>
            <dd className="text-[var(--color-text-primary)]">{p.min_age_days} days</dd>
            <dt className="text-[var(--color-text-tertiary)] uppercase tracking-wider">action</dt>
            <dd className="text-[var(--color-text-primary)]">archive (move to 03-Archive)</dd>
          </dl>

          <p className="text-sm text-[var(--color-text-secondary)] mb-4">
            <span className="text-[var(--color-text-tertiary)] font-mono uppercase tracking-wider text-xs mr-2">
              reason:
            </span>
            {p.reason}
          </p>

          <div className="flex gap-2">
            <StubButton variant="accent">Approve</StubButton>
            <StubButton>Dry run</StubButton>
            <StubButton variant="danger">Reject</StubButton>
          </div>
        </div>
      ))}
    </div>
  );
}
