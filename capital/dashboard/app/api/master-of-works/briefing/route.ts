import { execSync } from "child_process";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const output = execSync(
      "python3 -m council.the-master-of-works check",
      {
        cwd: process.env.HOME + "/Kingdom",
        encoding: "utf-8",
        timeout: 10000,
      }
    );

    const lines = output.trim().split("\n");
    const text = output;

    let resources = null;
    let services = [];

    const resourceMatch = text.match(
      /\*\*System Resources:\*\*\n([\s\S]*?)(?:\*\*Services:\*\*|\z)/
    );
    if (resourceMatch) {
      const resourceLines = resourceMatch[1].trim().split("\n");
      resources = {};

      for (const line of resourceLines) {
        const cpuMatch = line.match(/CPU: ([\d.]+)%/);
        if (cpuMatch) resources.cpu = parseFloat(cpuMatch[1]);

        const memMatch = line.match(/Memory: ([\d.]+)%/);
        if (memMatch) resources.memory = parseFloat(memMatch[1]);

        const diskMatch = line.match(/Disk: ([\d.]+)%/);
        if (diskMatch) resources.disk = parseFloat(diskMatch[1]);

        const gpuMatch = line.match(/GPU Memory: ([\d.]+)%/);
        if (gpuMatch) resources.gpu = parseFloat(gpuMatch[1]);

        const loadMatch = line.match(/Load: ([\d.]+) ([\d.]+) ([\d.]+)/);
        if (loadMatch) {
          resources.load = {
            one: parseFloat(loadMatch[1]),
            five: parseFloat(loadMatch[2]),
            fifteen: parseFloat(loadMatch[3]),
          };
        }
      }
    }

    const servicesMatch = text.match(/\*\*Services:\*\*\n([\s\S]*?)$/);
    if (servicesMatch) {
      const serviceLines = servicesMatch[1].trim().split("\n");
      for (const line of serviceLines) {
        const serviceMatch = line.match(
          /(✅|❌)\s+(.+?):\s+(.+?)(?:\s|$)/
        );
        if (serviceMatch) {
          services.push({
            emoji: serviceMatch[1],
            name: serviceMatch[2],
            status: serviceMatch[3],
            isHealthy: serviceMatch[1] === "✅",
          });
        }
      }
    }

    return Response.json({
      text,
      resources,
      services,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json(
      {
        error: String(error),
        text: "Master of Works is unavailable",
      },
      { status: 500 }
    );
  }
}
