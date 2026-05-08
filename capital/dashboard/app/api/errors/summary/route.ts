export const dynamic = "force-dynamic";

const BACKEND = process.env.BACKEND_URL ?? "http://localhost:5001";

export async function GET() {
  try {
    const res = await fetch(`${BACKEND}/api/errors/summary`, { next: { revalidate: 0 } });
    const data = await res.json();
    return Response.json(data, { status: res.status });
  } catch (err) {
    return Response.json({ open: 0, linked: 0, new_24h: 0, error: String(err) }, { status: 500 });
  }
}
