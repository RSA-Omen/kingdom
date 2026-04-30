import { execSync } from "child_process";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const output = execSync("python3 -m council.the-maester index", {
      cwd: process.env.HOME + "/Kingdom",
      encoding: "utf-8",
      timeout: 30000,
    });
    const data = JSON.parse(output);
    return Response.json(data);
  } catch (error) {
    return Response.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
