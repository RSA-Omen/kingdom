import { NextRequest } from "next/server";

const BACKEND = process.env.BACKEND_URL || "http://localhost:5001";

export async function POST() {
  const r = await fetch(`${BACKEND}/api/todos/sync`, { method: "POST" });
  const data = await r.json();
  return Response.json(data, { status: r.status });
}

export async function GET() {
  const r = await fetch(`${BACKEND}/api/todos/sync`, { cache: "no-store" });
  const data = await r.json();
  return Response.json(data, { status: r.status });
}
