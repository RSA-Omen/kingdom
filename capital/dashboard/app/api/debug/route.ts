export async function GET() {
  return Response.json({
    apiBase: process.env.NEXT_PUBLIC_API_BASE || "NOT SET",
    nodeEnv: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
}
