/**
 * The Guild Board — server component shell.
 *
 * Fetches the live feed from the Capital API on every request (Next.js
 * revalidates this segment every 30s), then hands the data to the
 * GuildBoardClient subtree for filtering, hover, and toast.
 *
 * The whole page is read-only by design (Phase B). Writes live in Phase C.
 */

import { GuildBoardClient, type GuildBoardData } from "@/components/kingdom/guild-board/GuildBoardClient";

// Refresh the server-rendered tree every 30s. Within that window, multiple
// loads share the same response — keeps Asana calls down.
export const revalidate = 30;

const BACKEND = process.env.BACKEND_URL ?? "http://localhost:5001";

async function loadFeed(): Promise<GuildBoardData> {
  try {
    const res = await fetch(`${BACKEND}/api/guild-board/feed`, {
      next: { revalidate: 15 },
    });
    if (!res.ok) {
      return errorFeed(`Capital API returned ${res.status}`);
    }
    return (await res.json()) as GuildBoardData;
  } catch (err: any) {
    return errorFeed(err?.message ?? "Capital API unreachable");
  }
}

function errorFeed(reason: string): GuildBoardData {
  return {
    ok: false,
    generatedAt: new Date().toISOString(),
    source: { asanaTasksFetched: 0, asanaTasksTriaged: 0, incidentsFromCapital: 0 },
    stats: {
      projects: 0, bugs: 0, incidents: 0, waitingOver14: 0,
      closed: 0, active: 0, needsAttention: 0, closedThisQuarter: 0,
    },
    ageDistribution: { fresh: 0, mid: 0, stale: 0 },
    attention: [
      {
        id: "fetch-error",
        type: "incident",
        village: "Capital",
        title: `Guild Board feed unavailable: ${reason}`,
        status: "ERROR",
        age: "now",
        ageLabel: "failed",
        ageTone: "red",
        events: [
          { kind: "milestone", tone: "var(--color-danger)", title: "Failure", date: "today" },
          { kind: "now", tone: "var(--color-danger)", title: "Investigating", date: "today" },
        ],
      },
    ],
    flight: [],
    closed: [],
    villages: [],
  };
}

export default async function GuildBoardPage() {
  const data = await loadFeed();
  return <GuildBoardClient data={data} />;
}
