"use client";
import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";

interface Edition {
  published_at: string;
  content: string;
  date_label: string;
}

interface Editions {
  daily?: Edition;
  brief?: Edition;
  weekly?: Edition;
}

type EditionKey = "daily" | "brief" | "weekly";

const EDITIONS: { key: EditionKey; label: string; schedule: string; audience: string }[] = [
  { key: "daily", label: "Daily", schedule: "Every day at 06:00 CAT", audience: "The king" },
  { key: "brief", label: "Brief", schedule: "Every day at 06:00 CAT", audience: "Barry" },
  { key: "weekly", label: "Weekly", schedule: "Every Monday at 06:00 CAT", audience: "The whole team" },
];

function nextEditionTime(key: EditionKey): string {
  const now = new Date();
  const next = new Date(now);

  if (key === "weekly") {
    // Next Monday 04:00 UTC
    const daysUntilMonday = (8 - now.getUTCDay()) % 7 || 7;
    next.setUTCDate(now.getUTCDate() + daysUntilMonday);
    next.setUTCHours(4, 0, 0, 0);
  } else {
    // Next day 04:00 UTC
    next.setUTCDate(now.getUTCDate() + 1);
    next.setUTCHours(4, 0, 0, 0);
    if (now.getUTCHours() < 4) {
      next.setUTCDate(now.getUTCDate());
    }
  }

  const diffMs = next.getTime() - now.getTime();
  const diffH = Math.floor(diffMs / 3_600_000);
  const diffM = Math.floor((diffMs % 3_600_000) / 60_000);
  if (diffH >= 24) return `${Math.floor(diffH / 24)}d`;
  if (diffH > 0) return `${diffH}h ${diffM}m`;
  return `${diffM}m`;
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function telegramToHtml(raw: string): string {
  // The content uses Telegram HTML: <b>, \n only. Convert newlines to <br> for web.
  return raw.replace(/\n/g, "<br>");
}

function EditionContent({ edition, editionKey }: { edition: Edition | undefined; editionKey: EditionKey }) {
  const [copied, setCopied] = useState(false);

  const copyLink = useCallback(() => {
    const url = `${window.location.origin}/telegraph?edition=${editionKey}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [editionKey]);

  const meta = EDITIONS.find((e) => e.key === editionKey)!;

  if (!edition) {
    return (
      <div className="surface p-8 text-center">
        <p className="text-sm font-medium text-[var(--color-text-secondary)]">
          {meta.label} edition not yet published
        </p>
        <p className="mt-2 text-xs text-[var(--color-text-tertiary)]">
          {meta.key === "brief"
            ? "Set BARRY_CHAT_ID in ~/.kingdom.env to activate."
            : meta.key === "weekly"
            ? "Set SUBJECTS_CHAT_ID in ~/.kingdom.env to activate."
            : "Will publish at the next scheduled run."}
        </p>
        <p className="mt-3 text-xs text-[var(--color-text-tertiary)]">
          Next edition in <span className="font-medium">{nextEditionTime(editionKey)}</span>
        </p>
      </div>
    );
  }

  return (
    <div className="surface">
      {/* Edition header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
        <div>
          <p className="text-xs uppercase tracking-wider text-[var(--color-text-tertiary)] font-medium">
            {meta.label} edition · {meta.audience}
          </p>
          <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">
            {edition.date_label}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-[var(--color-text-tertiary)]">
            Published {timeAgo(edition.published_at)} · Next in {nextEditionTime(editionKey)}
          </span>
          <button
            onClick={copyLink}
            className="text-xs px-3 py-1.5 rounded border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-accent)] transition-colors"
          >
            {copied ? "Copied!" : "Copy link"}
          </button>
        </div>
      </div>

      {/* Edition body */}
      <div
        className="px-6 py-6 text-sm text-[var(--color-text-primary)] leading-relaxed"
        style={{ whiteSpace: "pre-wrap", fontFamily: "inherit" }}
        dangerouslySetInnerHTML={{ __html: telegramToHtml(edition.content) }}
      />
    </div>
  );
}

function TelegraphInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [editions, setEditions] = useState<Editions>({});
  const [loading, setLoading] = useState(true);

  const activeKey = (searchParams.get("edition") as EditionKey) || "daily";

  useEffect(() => {
    fetch("/api/telegraph")
      .then((r) => r.json())
      .then((d) => setEditions(d))
      .finally(() => setLoading(false));
  }, []);

  function setTab(key: EditionKey) {
    router.replace(`/telegraph?edition=${key}`, { scroll: false });
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="border-b border-[var(--color-border)] pb-6">
        <p className="text-xs uppercase tracking-wider text-[var(--color-text-tertiary)] font-medium">
          The Herald
        </p>
        <h1 className="text-3xl font-semibold mt-2 text-[var(--color-text-primary)]">
          Telegraph
        </h1>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)] max-w-xl">
          The kingdom&apos;s daily paper — three editions for three audiences, composed each morning
          from the Royal Court&apos;s briefings.
        </p>
      </div>

      {/* Edition tabs */}
      <div className="flex gap-1 border-b border-[var(--color-border)]">
        {EDITIONS.map((e) => {
          const isActive = activeKey === e.key;
          const hasContent = !!editions[e.key];
          return (
            <button
              key={e.key}
              onClick={() => setTab(e.key)}
              className={[
                "px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
                isActive
                  ? "border-[var(--color-accent)] text-[var(--color-accent)]"
                  : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]",
              ].join(" ")}
            >
              {e.label}
              {!hasContent && !loading && (
                <span className="ml-1.5 text-[10px] text-[var(--color-text-tertiary)]">—</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Schedule strip */}
      <div className="flex gap-6">
        {EDITIONS.map((e) => (
          <div key={e.key} className={activeKey === e.key ? "opacity-100" : "opacity-40"}>
            <p className="text-xs text-[var(--color-text-tertiary)]">
              <span className="font-medium text-[var(--color-text-secondary)]">{e.label}</span>
              {" — "}
              {e.schedule}
            </p>
          </div>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="surface p-8 text-center text-sm text-[var(--color-text-tertiary)]">
          Loading editions…
        </div>
      ) : (
        <EditionContent edition={editions[activeKey]} editionKey={activeKey} />
      )}
    </div>
  );
}

export default function TelegraphPage() {
  return (
    <Suspense fallback={<div className="text-sm text-[var(--color-text-tertiary)]">Loading…</div>}>
      <TelegraphInner />
    </Suspense>
  );
}
