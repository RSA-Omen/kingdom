import { execSync } from "child_process";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const output = execSync("python3 -m council.the-maester index", {
      cwd: process.env.HOME + "/Kingdom",
      encoding: "utf-8",
      timeout: 30000,
    });
    const data = JSON.parse(output);
    const { projects, repos, summary } = data;

    // Count by type
    const byType: Record<string, number> = {};
    projects.forEach((p: any) => {
      byType[p.type] = (byType[p.type] || 0) + 1;
    });

    // Count stale
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const staleCount = projects.filter(
      (p: any) =>
        p.last_activity &&
        new Date(p.last_activity) < thirtyDaysAgo
    ).length;

    // Find most recently updated
    const recent = [...projects]
      .filter((p: any) => p.last_activity)
      .sort(
        (a: any, b: any) =>
          new Date(b.last_activity).getTime() -
          new Date(a.last_activity).getTime()
      )
      .slice(0, 5);

    return Response.json({
      timestamp: data.timestamp,
      summary: {
        total_projects: summary.total_projects,
        total_repos: summary.total_repos,
        stale_count: staleCount,
        by_type: byType,
      },
      recent_activity: recent.map((p: any) => ({
        name: p.name,
        type: p.type,
        last_activity: p.last_activity,
      })),
    });
  } catch (error) {
    return Response.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
