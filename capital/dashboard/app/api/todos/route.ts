export const dynamic = "force-dynamic";

const BACKEND = process.env.BACKEND_URL ?? "http://localhost:5001";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const upstream = new URL(`${BACKEND}/api/todos`);
  searchParams.forEach((v, k) => upstream.searchParams.set(k, v));
  try {
    const res = await fetch(upstream.toString(), { next: { revalidate: 0 } });
    const data = await res.json();
    return Response.json(data, { status: res.status });
  } catch (err) {
    return Response.json({ todos: [], error: String(err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const res = await fetch(`${BACKEND}/api/todos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return Response.json(data, { status: res.status });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
