export const dynamic = "force-dynamic";

const GEKKO_TRACKS = process.env.GEKKO_TRACKS_URL ?? "http://localhost:8002";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const upstream = new URL(`${GEKKO_TRACKS}/api/notifications/logs`);
  searchParams.forEach((v, k) => upstream.searchParams.set(k, v));
  try {
    const res = await fetch(upstream.toString(), { next: { revalidate: 0 } });
    const data = await res.json();
    return Response.json(data, { status: res.status });
  } catch (err) {
    return Response.json({ logs: [], total: 0, error: String(err) }, { status: 500 });
  }
}
