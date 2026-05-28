import { NextResponse } from "next/server";

const BACKEND = process.env.BACKEND_URL ?? "http://localhost:5001";

export const revalidate = 30; // seconds — keeps the board fresh without thrashing Asana

export async function GET() {
  try {
    const res = await fetch(`${BACKEND}/api/guild-board/feed`, {
      // Server-side fetch; mirror the Capital API's 15s cache window
      next: { revalidate: 15 },
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
