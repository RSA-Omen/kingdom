import { HandAgendaActions } from "./HandAgendaActions";

type Matter = {
  id: string;
  section: string;
  priority: "P1" | "P2" | "P3" | "IDEA" | null;
  title: string;
  weight: number;
  deferred_count: number;
  deferred_until: string | null;
  overdue: boolean;
};

type Snapshot = {
  agenda: {
    generated_at: string;
    summary: {
      total_open: number;
      p1_count: number;
      p2_count: number;
      p3_count: number;
      ideas: number;
      overdue: number;
    };
    today: Matter[];
  };
  brief_markdown: string;
};

const PRIORITY_EMOJI: Record<string, string> = {
  P1: "🔴",
  P2: "🟡",
  P3: "🟢",
  IDEA: "💡",
};

function trimMd(s: string) {
  return s.replace(/\*\*([^*]+)\*\*/g, "$1");
}

export function HandAgendaView({ snap, error }: { snap: Snapshot | null; error: string | null }) {
  if (error) {
    return (
      <div className="surface p-6">
        <Header subtitle="Could not reach The Hand." />
        <p className="mt-3 text-xs text-[var(--color-danger)]">{error}</p>
      </div>
    );
  }

  if (!snap) {
    return (
      <div className="surface p-6">
        <Header subtitle="Reading the realm's ledger…" />
      </div>
    );
  }

  const { summary, today, generated_at } = snap.agenda;

  return (
    <section className="surface p-6">
      <Header subtitle={`The Hand has read the ledger. ${summary.total_open} matters open across the realm.`} />

      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <Stat emoji="🔴" label="P1" value={summary.p1_count} />
        <Stat emoji="🟡" label="P2" value={summary.p2_count} />
        <Stat emoji="🟢" label="P3" value={summary.p3_count} />
        <Stat emoji="💡" label="Ideas" value={summary.ideas} />
      </div>

      <h3 className="mt-6 text-sm font-semibold text-[var(--color-text-primary)]">
        Today&apos;s three matters
      </h3>

      {today.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--color-text-secondary)] italic">
          The realm is at peace, Sire. No matters demand attention.
        </p>
      ) : (
        <ol className="mt-3 space-y-3">
          {today.map((m, idx) => (
            <li
              key={m.id}
              className="border border-[var(--color-border)] rounded p-3 flex flex-col sm:flex-row sm:items-start gap-3"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs text-[var(--color-text-tertiary)] tabular-nums">{idx + 1}.</span>
                  <span className="text-base">{PRIORITY_EMOJI[m.priority ?? ""] ?? "⚪"}</span>
                  <p className="text-sm font-medium text-[var(--color-text-primary)] leading-snug">
                    {trimMd(m.title)}
                  </p>
                </div>
                <p className="mt-1 ml-7 text-xs text-[var(--color-text-tertiary)]">
                  {m.section} · id <code>{m.id}</code>
                  {m.deferred_count > 0 && <> · deferred {m.deferred_count}×</>}
                  {m.overdue && <span className="ml-2 text-[var(--color-danger)] font-medium">overdue</span>}
                </p>
              </div>
              <HandAgendaActions id={m.id} />
            </li>
          ))}
        </ol>
      )}

      <p className="mt-5 text-[10px] text-[var(--color-text-tertiary)]">
        Last brief composed{" "}
        {new Date(generated_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}{" "}
        · — The Hand
      </p>
    </section>
  );
}

function Header({ subtitle }: { subtitle?: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-[var(--color-text-tertiary)] font-medium">
        The Hand of the King says…
      </p>
      {subtitle && <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{subtitle}</p>}
    </div>
  );
}

function Stat({ emoji, label, value }: { emoji: string; label: string; value: number }) {
  return (
    <div className="border border-[var(--color-border)] rounded p-2 text-center">
      <p className="text-base">{emoji}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-[var(--color-text-primary)]">{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-tertiary)]">{label}</p>
    </div>
  );
}
