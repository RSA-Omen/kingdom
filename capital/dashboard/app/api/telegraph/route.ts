import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";

const KINGDOM_DIR = process.env.KINGDOM_DIR ?? path.join(process.env.HOME ?? "", "Kingdom");
const EDITIONS_PATH = path.join(KINGDOM_DIR, "capital", "herald", "editions.json");

interface Edition {
  published_at: string;
  content: string;
  date_label: string;
}

interface Editions {
  daily?: Edition;
  brief?: Edition;
  weekly?: Edition;
}

export async function GET() {
  try {
    const raw = await fs.readFile(EDITIONS_PATH, "utf8").catch(() => "{}");
    const editions: Editions = JSON.parse(raw);
    return NextResponse.json(editions);
  } catch (err) {
    return NextResponse.json(
      { error: "Could not read Telegraph editions.", detail: String(err) },
      { status: 503 },
    );
  }
}
