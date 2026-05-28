import { NextResponse } from "next/server";

const BACKEND = process.env.BACKEND_URL ?? "http://localhost:5001";

export const revalidate = 30;

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const { id } = params;
  try {
    const res = await fetch(`${BACKEND}/api/guild-board/chain/${encodeURIComponent(id)}`, {
      next: { revalidate: 30 },
    });
    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { ok: false, error: `Capital API ${res.status}: ${text.slice(0, 200)}` },
        { status: 502 },
      );
    }
    const body = await res.json();
    return NextResponse.json(body);
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message ?? "Capital API unreachable" },
      { status: 502 },
    );
  }
}
