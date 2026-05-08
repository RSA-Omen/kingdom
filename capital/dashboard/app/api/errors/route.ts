export const dynamic = "force-dynamic";

const BACKEND = process.env.BACKEND_URL ?? "http://localhost:5001";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const upstream = new URL(`${BACKEND}/api/errors`);
  searchParams.forEach((v, k) => upstream.searchParams.set(k, v));
  try {
    const res = await fetch(upstream.toString(), { next: { revalidate: 0 } });
    const data = await res.json();
    return Response.json(data, { status: res.status });
  } catch (err) {
    return Response.json({ errors: [], error: String(err) }, { status: 500 });
  }
}
