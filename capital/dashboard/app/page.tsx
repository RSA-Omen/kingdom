import { headers } from "next/headers";
import { HandAgendaView } from "../components/kingdom/HandAgendaView";
import { MaesterView } from "../components/kingdom/MaesterView";
import { BureauView } from "../components/kingdom/BureauView";
import { MasterOfWorksView } from "../components/kingdom/MasterOfWorksView";
import { SearchMaester } from "../components/kingdom/SearchMaester";
import { SummaryCardsView } from "../components/kingdom/SummaryCardsView";
import { ErrorFeedView } from "../components/kingdom/ErrorFeedView";

const BACKEND = process.env.BACKEND_URL || "http://localhost:5001";

export const dynamic = "force-dynamic";

async function fetchJSON<T>(url: string): Promise<{ data: T | null; error: string | null }> {
  try {
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      return { data: null, error: (e as any).error ?? `HTTP ${r.status}` };
    }
    return { data: (await r.json()) as T, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : String(err) };
  }
}

export default async function ThroneRoom() {
  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // Build self-host URL for routes that wrap CLI invocations
  const hdrs = await headers();
  const host = hdrs.get("host") ?? "localhost:3000";
  const proto = hdrs.get("x-forwarded-proto") ?? "http";
  const self = `${proto}://${host}`;

  const [hand, maester, bureau, mow, errSummary, todoSummary, errFeed] = await Promise.all([
    fetchJSON<any>(`${self}/api/hand/agenda`),
    fetchJSON<any>(`${self}/api/maester/stats`),
    fetchJSON<any>(`${self}/api/bureau/briefing`),
    fetchJSON<any>(`${self}/api/master-of-works/briefing`),
    fetchJSON<{ open: number; linked: number; new_24h: number }>(`${BACKEND}/api/errors/summary`),
    fetchJSON<{ open: number; linked: number }>(`${BACKEND}/api/todos/summary`),
    fetchJSON<{ errors: any[] }>(`${BACKEND}/api/errors?status=open&limit=5`),
  ]);

  const hexStats = [
    { value: String(bureau.data?.health?.total ?? "—"), label: "Systems", href: "/villages" },
    { value: String(errSummary.data?.open ?? "—"), label: "Open Issues", href: "/errors" },
    { value: String(todoSummary.data?.open ?? "—"), label: "Open To-Dos", href: "/todos" },
    {
      value: bureau.data?.health?.healthPercent != null
        ? `${bureau.data.health.healthPercent}%`
        : "—",
      label: "Health",
      href: "/villages",
    },
    {
      value: String(hand.data?.agenda?.summary?.total_open ?? "—"),
      label: "Matters",
      href: "/matters",
    },
  ];

  return (
    <div className="space-y-10">
      <Hero today={today} />
      <HexStatRow stats={hexStats} />

      <HandAgendaView snap={hand.data} error={hand.error} />
      <MaesterView stats={maester.data} error={maester.error} />
      <BureauView data={bureau.data} error={bureau.error} />
      <MasterOfWorksView data={mow.data} error={mow.error} />
      <SearchMaester />

      <section className="mt-10 space-y-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-[var(--color-text-tertiary)] font-medium">
            Kingdom Watch
          </p>
          <h2 className="text-xl font-semibold mt-1 text-[var(--color-text-primary)]">
            Realm at a glance
          </h2>
        </div>
        <SummaryCardsView
          openErrors={errSummary.data?.open ?? 0}
          openTodos={todoSummary.data?.open ?? 0}
          linked={errSummary.data?.linked ?? 0}
          new24h={errSummary.data?.new_24h ?? 0}
        />
        <div className="mt-6">
          <h3 className="text-sm font-medium text-[var(--color-text-secondary)] mb-3">Recent Errors</h3>
          <ErrorFeedView errors={errFeed.data?.errors ?? []} />
        </div>
      </section>

      <RealmMap />
      <RoyalCourt />
      <FromTheMasterBuilder />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────── */

function Hero({ today }: { today: string }) {
  return (
    <header className="border-b border-[var(--color-border)] pb-8">
      <p className="text-xs uppercase tracking-wider text-[var(--color-text-tertiary)] font-medium">
        Throne Room · {today}
      </p>
      <h1 className="text-3xl font-semibold mt-3 text-[var(--color-text-primary)] leading-tight">
        Welcome to the Kingdom.
      </h1>
      <p className="mt-3 text-base text-[var(--color-text-secondary)] max-w-2xl leading-relaxed">
        Gekko&apos;s realm — the Capital, the Council, the Villages, and the
        Bridges to lands beyond. A place where every system reports in and
        every agent files its briefs.
      </p>
      <div className="mt-5 flex gap-3">
        <a
          href="/errors"
          className="px-4 py-2 rounded text-sm font-semibold transition-colors"
          style={{
            background: "var(--color-accent)",
            color: "var(--color-accent-fg)",
          }}
        >
          Kingdom Watch
        </a>
        <a
          href="/telegraph"
          className="px-4 py-2 rounded text-sm font-medium border transition-colors"
          style={{
            borderColor: "var(--color-border)",
            color: "var(--color-text-secondary)",
          }}
        >
          Read Telegraph →
        </a>
      </div>
    </header>
  );
}

/* ─────────────────────────────────────────────────────────────────────── */

function HexStatRow({ stats }: { stats: { value: string; label: string; href: string }[] }) {
  return (
    <div className="flex justify-center gap-4 flex-wrap py-2">
      {stats.map((s) => (
        <HexStatCard key={s.label} value={s.value} label={s.label} href={s.href} />
      ))}
    </div>
  );
}

function HexStatCard({ value, label, href }: { value: string; label: string; href: string }) {
  return (
    <a
      href={href}
      className="relative flex items-center justify-center group"
      style={{ width: 132, height: 152 }}
    >
      <svg
        className="absolute inset-0 w-full h-full transition-all duration-200"
        viewBox="0 0 132 152"
        xmlns="http://www.w3.org/2000/svg"
      >
        <polygon
          points="66,4 128,38 128,106 66,140 4,106 4,38"
          fill="var(--color-hex-fill)"
          stroke="var(--color-accent)"
          strokeWidth="1.5"
          className="group-hover:fill-[rgba(129,230,217,0.1)] transition-all duration-200"
          style={{ filter: "drop-shadow(0 0 6px var(--color-glow))" }}
        />
      </svg>
      <div className="relative text-center" style={{ zIndex: 1 }}>
        <div
          className="text-2xl font-bold tabular-nums"
          style={{ color: "var(--color-accent)" }}
        >
          {value}
        </div>
        <div
          className="text-[10px] uppercase tracking-wider mt-1"
          style={{ color: "var(--color-text-tertiary)" }}
        >
          {label}
        </div>
      </div>
    </a>
  );
}

/* ─────────────────────────────────────────────────────────────────────── */

function RealmMap() {
  const districts: {
    name: string;
    description: string;
    state: "active" | "building" | "planned";
    href: string;
  }[] = [
    {
      name: "The Capital",
      description:
        "The seat of operation — backend, dashboard, and the Herald who delivers the morning paper.",
      state: "building",
      href: "/",
    },
    {
      name: "The Villages",
      description:
        "Every Gekko app that meets the Standard. Health, usage, errors, time saved.",
      state: "active",
      href: "/villages",
    },
    {
      name: "The Court",
      description:
        "The Royal Council of agents who watch, advise, and never act without the king's word.",
      state: "building",
      href: "/council",
    },
    {
      name: "The Bridges",
      description:
        "Crossings to lands beyond — Power Automate, Copilot Studio, Pronto Xi.",
      state: "planned",
      href: "/bridges",
    },
  ];

  return (
    <section>
      <SectionHeading
        eyebrow="The Realm"
        title="A map of the kingdom"
        subtitle="Four districts. Each plays its part."
      />
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        {districts.map((d) => (
          <a
            key={d.name}
            href={d.href}
            className="surface p-6 hover:shadow transition-shadow group"
          >
            <div className="flex items-baseline justify-between">
              <h3 className="text-base font-semibold text-[var(--color-text-primary)] group-hover:text-[var(--color-accent)] transition-colors">
                {d.name}
              </h3>
              <StateBadge state={d.state} />
            </div>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)] leading-relaxed">
              {d.description}
            </p>
          </a>
        ))}
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────── */

function RoyalCourt() {
  const roles: { title: string; beat: string; status: "summoned" | "expected" }[] = [
    { title: "The Hand of the King", beat: "The king's direct assistant. Prioritises matters, ensures nothing is dropped.", status: "summoned" },
    { title: "The Maester", beat: "Knowledge keeper. Reads everything, knows everything.", status: "summoned" },
    { title: "The Master of Works", beat: "Infrastructure. Keeps the castle standing.", status: "summoned" },
    { title: "The Quartermaster", beat: "Provisions. Watches RAM, CPU, disk, GPU memory.", status: "summoned" },
    { title: "The Master of Whisperers", beat: "Intelligence. New AI models, what the wider world is doing.", status: "expected" },
    { title: "The Steward", beat: "Day-to-day operations across every village.", status: "summoned" },
    { title: "The Captain of the Guard", beat: "First responder when something breaks.", status: "summoned" },
    { title: "The Master of Laws", beat: "Enforces the Gekko Standard.", status: "expected" },
    { title: "The Lord Chamberlain", beat: "Cares for the subjects — wellbeing, friction, complaints.", status: "expected" },
    { title: "The Castellan", beat: "Keeps the castle clean. Identifies abandoned wings.", status: "expected" },
    { title: "The Master Builder", beat: "Improves the platform itself.", status: "expected" },
    { title: "The Master of Coin", beat: "Finance — tracks costs, infrastructure spend.", status: "expected" },
    { title: "The Herald", beat: "Publishes Telegraph — composes the morning paper.", status: "summoned" },
  ];

  return (
    <section>
      <SectionHeading
        eyebrow="The Royal Court"
        title="The Council that will brief the king"
        subtitle="Each member has a beat. They are summoned one at a time, when needed."
      />
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {roles.map((r) => (
          <div key={r.title} className="surface p-5">
            <div className="flex items-baseline justify-between gap-3">
              <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">{r.title}</h4>
              <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-tertiary)]">
                {r.status === "summoned" ? "summoned" : "expected"}
              </span>
            </div>
            <p className="mt-2 text-xs text-[var(--color-text-secondary)] leading-relaxed">{r.beat}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────── */

function FromTheMasterBuilder() {
  return (
    <section className="surface p-6">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">From the Master Builder</h3>
        <span className="text-xs text-[var(--color-text-tertiary)]">Note</span>
      </div>
      <p className="mt-3 text-sm text-[var(--color-text-secondary)] leading-relaxed">
        The Kingdom is founded. The Hand reads matters and prioritises. The Maester reads
        the realm&apos;s books and keeps memory. Both now serve at the Throne Room. Next:
        the Steward will health-check every village and surface alerts. Then the Master
        Builder will draft the Gekko Standard.
      </p>
    </section>
  );
}

function SectionHeading({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-[var(--color-text-tertiary)] font-medium">
        {eyebrow}
      </p>
      <h2 className="mt-2 text-xl font-semibold text-[var(--color-text-primary)]">{title}</h2>
      {subtitle && (
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{subtitle}</p>
      )}
    </div>
  );
}

function StateBadge({ state }: { state: "active" | "building" | "planned" }) {
  const variants = {
    active: { label: "Active", bg: "bg-emerald-50 dark:bg-emerald-950/40", fg: "text-[var(--color-success)]" },
    building: { label: "Building", bg: "bg-amber-50 dark:bg-amber-950/40", fg: "text-[var(--color-warning)]" },
    planned: { label: "Planned", bg: "bg-neutral-100 dark:bg-neutral-800", fg: "text-[var(--color-text-tertiary)]" },
  };
  const v = variants[state];
  return (
    <span className={`text-[10px] uppercase tracking-wider font-medium px-2 py-0.5 rounded ${v.bg} ${v.fg}`}>
      {v.label}
    </span>
  );
}
