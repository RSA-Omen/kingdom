import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const execFileP = promisify(execFile);
const KINGDOM_DIR = process.env.KINGDOM_DIR ?? path.join(process.env.HOME ?? "", "Kingdom");
const SNAPSHOT_PATH = path.join(KINGDOM_DIR, ".hand-snapshot.json");
const HAND_BIN = path.join(KINGDOM_DIR, "bin", "hand");

export async function GET() {
  try {
    const stat = await fs.stat(SNAPSHOT_PATH).catch(() => null);
    const ageMs = stat ? Date.now() - stat.mtimeMs : Infinity;

    // If snapshot is missing or older than 5 minutes, regenerate.
    if (!stat || ageMs > 5 * 60 * 1000) {
      try {
        await execFileP(HAND_BIN, ["snapshot"], { timeout: 10_000 });
      } catch (err) {
        // Fall through — try to serve whatever's on disk.
        console.error("hand snapshot failed:", err);
      }
    }

    const raw = await fs.readFile(SNAPSHOT_PATH, "utf8");
    return NextResponse.json(JSON.parse(raw));
  } catch (err) {
    return NextResponse.json(
      {
        error: "Could not read agenda from The Hand.",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 503 },
    );
  }
}
