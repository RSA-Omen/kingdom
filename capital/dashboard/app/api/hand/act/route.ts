import { NextRequest, NextResponse } from "next/server";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const execFileP = promisify(execFile);
const KINGDOM_DIR = process.env.KINGDOM_DIR ?? path.join(process.env.HOME ?? "", "Kingdom");
const HAND_BIN = path.join(KINGDOM_DIR, "bin", "hand");

type Action = "done" | "defer" | "add";
const ALLOWED_ACTIONS: Action[] = ["done", "defer", "add"];

export async function POST(req: NextRequest) {
  let body: { action: string; id?: string; days?: number; text?: string; priority?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!ALLOWED_ACTIONS.includes(body.action as Action)) {
    return NextResponse.json(
      { error: `action must be one of ${ALLOWED_ACTIONS.join(", ")}` },
      { status: 400 },
    );
  }

  const args: string[] = [body.action];
  if (body.action === "done") {
    if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });
    args.push(body.id);
  } else if (body.action === "defer") {
    if (!body.id || typeof body.days !== "number") {
      return NextResponse.json({ error: "id and days required" }, { status: 400 });
    }
    args.push(body.id, String(body.days));
  } else if (body.action === "add") {
    if (!body.text) return NextResponse.json({ error: "text required" }, { status: 400 });
    args.push(body.text);
    if (body.priority) args.push("--priority", body.priority);
  }

  try {
    const { stdout } = await execFileP(HAND_BIN, args, { timeout: 10_000 });
    // Refresh the snapshot so subsequent agenda reads are current
    await execFileP(HAND_BIN, ["snapshot"], { timeout: 10_000 }).catch(() => {});
    return NextResponse.json({ ok: true, message: stdout.trim() });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
