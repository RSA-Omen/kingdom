import { execSync } from "child_process";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const question = body.question || "";

    if (!question.trim()) {
      return Response.json(
        { error: "Question required" },
        { status: 400 }
      );
    }

    const output = execSync(`python3 -m council.the-maester ask "${question.replace(/"/g, '\\"')}"`, {
      cwd: process.env.HOME + "/Kingdom",
      encoding: "utf-8",
      timeout: 30000,
    });

    return Response.json({ answer: output });
  } catch (error) {
    return Response.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
