export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const res = await fetch("http://localhost:5001/api/bureau/briefing", {
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      return Response.json(
        { error: `Bureau API returned ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return Response.json(data);
  } catch (error) {
    return Response.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
