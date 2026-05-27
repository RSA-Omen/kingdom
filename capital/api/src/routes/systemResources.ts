import { Router, Request, Response } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const router = Router();

// Helper function to execute shell commands safely
async function execCommand(command: string, timeout: number = 5000): Promise<string> {
  try {
    const { stdout } = await execAsync(command, { timeout, maxBuffer: 1024 * 1024 });
    return stdout.trim();
  } catch (error: any) {
    // Log but don't throw – this endpoint should degrade gracefully and still return JSON
    console.error(`Error executing command "${command}":`, error.message);
    return '';
  }
}

// GET /api/system-resources
router.get('/', async (req: Request, res: Response) => {
  try {
    // Get system metrics in parallel
    const [
      uptime,
      memoryInfo,
      diskInfo,
      loadAverage,
      cpuInfo,
      dockerStats
    ] = await Promise.allSettled([
      execCommand('uptime'),
      execCommand('free -m'),
      execCommand('df -h /'),
      execCommand('uptime | awk -F\'load average:\' \'{print $2}\''),
      execCommand('head -1 /proc/stat'),
      execCommand('docker stats --no-stream --format "{{.Name}}|{{.CPUPerc}}|{{.MemUsage}}|{{.MemPerc}}" 2>/dev/null || echo ""')
    ]);

    // Parse memory information
    let memory: any = { total: 0, used: 0, free: 0, available: 0, usagePercent: 0 };
    if (memoryInfo.status === 'fulfilled') {
      const memLines = memoryInfo.value.split('\n');
      const memLine = memLines[1]?.split(/\s+/);
      if (memLine && memLine.length >= 7) {
        memory = {
          total: parseInt(memLine[1], 10),
          used: parseInt(memLine[2], 10),
          free: parseInt(memLine[3], 10),
          available: parseInt(memLine[6], 10),
          usagePercent: ((parseInt(memLine[2], 10) / parseInt(memLine[1], 10)) * 100).toFixed(1)
        };
      }
    }

    // Parse disk information
    let disk: any = { total: '', used: '', available: '', usagePercent: '' };
    if (diskInfo.status === 'fulfilled') {
      const diskLines = diskInfo.value.split('\n');
      const rootLine = diskLines.find((line: string) => line.includes('/'));
      if (rootLine) {
        const parts = rootLine.split(/\s+/);
        if (parts.length >= 5) {
          disk = {
            total: parts[1],
            used: parts[2],
            available: parts[3],
            usagePercent: parts[4].replace('%', '')
          };
        }
      }
    }

    // Parse load average
    let loadAvg: number[] = [0, 0, 0];
    if (loadAverage.status === 'fulfilled') {
      const loadParts = loadAverage.value.trim().split(',').map((s: string) => parseFloat(s.trim()));
      if (loadParts.length === 3) {
        loadAvg = loadParts;
      }
    }

    // Parse CPU information from /proc/stat
    let cpu: any = { user: 0, system: 0, idle: 0 };
    if (cpuInfo.status === 'fulfilled') {
      // Format: cpu  12345 678 9012 34567 890 123 456 0 0 0
      // Fields: user nice system idle iowait irq softirq steal guest guest_nice
      const parts = cpuInfo.value.trim().split(/\s+/);
      if (parts.length >= 5) {
        const user = parseInt(parts[1], 10) || 0;
        const nice = parseInt(parts[2], 10) || 0;
        const system = parseInt(parts[3], 10) || 0;
        const idle = parseInt(parts[4], 10) || 0;
        const iowait = parseInt(parts[5], 10) || 0;
        const total = user + nice + system + idle + iowait;
        
        if (total > 0) {
          cpu = {
            user: (user / total * 100),
            system: (system / total * 100),
            idle: (idle / total * 100)
          };
        }
      }
    }

    // Parse Docker container stats
    const containers: any[] = [];
    if (dockerStats.status === 'fulfilled' && dockerStats.value) {
      const lines = dockerStats.value.split('\n').filter((line: string) => line.trim());
      for (const line of lines) {
        const parts = line.split('|');
        if (parts.length >= 4) {
          const memParts = parts[2].split('/');
          containers.push({
            name: parts[0],
            cpuPercent: parseFloat(parts[1].replace('%', '')) || 0,
            memoryUsage: parts[2],
            memoryPercent: parseFloat(parts[3].replace('%', '')) || 0,
            memoryUsed: memParts[0]?.trim() || '',
            memoryLimit: memParts[1]?.trim() || ''
          });
        }
      }
      // Sort by CPU usage descending
      containers.sort((a, b) => b.cpuPercent - a.cpuPercent);
    }

    // Parse uptime
    let uptimeText = '';
    if (uptime.status === 'fulfilled') {
      uptimeText = uptime.value;
    }

    res.json({
      timestamp: new Date().toISOString(),
      uptime: uptimeText,
      memory,
      disk,
      loadAverage: loadAvg,
      cpu,
      containers: containers.slice(0, 20), // Limit to top 20 containers
      containerCount: containers.length
    });
  } catch (error: any) {
    console.error('Error fetching system resources:', error);
    // Degrade gracefully so dashboard never 500s
    res.json({
      timestamp: new Date().toISOString(),
      uptime: '',
      memory: { total: 0, used: 0, free: 0, available: 0, usagePercent: '0.0' },
      disk: { total: '', used: '', available: '', usagePercent: '' },
      loadAverage: [0, 0, 0],
      cpu: { user: 0, system: 0, idle: 100 },
      containers: [],
      containerCount: 0
    });
  }
});

export default router;
