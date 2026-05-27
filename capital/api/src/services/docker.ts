import Docker from 'dockerode';
import { EventEmitter } from 'events';

export interface ContainerInfo {
  id: string;
  name: string;
  state: string;
  status: string;
  image: string;
  ports: any[];
  created: number;
  startedAt?: number;
}

class DockerService extends EventEmitter {
  private docker: Docker;

  constructor() {
    super();
    const socketPath = process.env.DOCKER_SOCKET || '/var/run/docker.sock';
    this.docker = new Docker({ socketPath });
  }

  async listContainers(): Promise<ContainerInfo[]> {
    try {
      const containers = await this.docker.listContainers({ all: true });
      return containers.map((container: any) => ({
        id: container.Id,
        name: container.Names[0]?.replace('/', '') || '',
        state: container.State,
        status: container.Status,
        image: container.Image,
        ports: container.Ports,
        created: container.Created,
        startedAt: container.StartedAt ? Math.floor(new Date(container.StartedAt * 1000).getTime() / 1000) : undefined
      }));
    } catch (error) {
      console.error('Error listing containers:', error);
      throw error;
    }
  }

  async getContainer(containerName: string): Promise<Docker.Container | null> {
    try {
      const containers = await this.listContainers();
      const container = containers.find(c => c.name === containerName);
      if (!container) return null;
      return this.docker.getContainer(container.id);
    } catch (error) {
      console.error(`Error getting container ${containerName}:`, error);
      return null;
    }
  }

  async getContainerStatus(containerName: string): Promise<any> {
    try {
      const container = await this.getContainer(containerName);
      if (!container) {
        return { state: 'not_found', exists: false };
      }

      const inspect = await container.inspect();
      const stats = await container.stats({ stream: false });

      return {
        exists: true,
        state: inspect.State.Status,
        running: inspect.State.Running,
        restarting: inspect.State.Restarting,
        paused: inspect.State.Paused,
        startedAt: inspect.State.StartedAt,
        finishedAt: inspect.State.FinishedAt,
        health: inspect.State.Health?.Status || 'unknown',
        uptime: inspect.State.StartedAt 
          ? Math.floor((Date.now() - new Date(inspect.State.StartedAt).getTime()) / 1000)
          : 0,
        memory: stats.memory_stats?.usage || 0,
        cpu: this.calculateCpuPercent(stats)
      };
    } catch (error) {
      console.error(`Error getting container status ${containerName}:`, error);
      throw error;
    }
  }

  async getContainerLogs(containerName: string, options: { lines?: number; since?: string; follow?: boolean; withTimestamps?: boolean } = {}): Promise<string[] | Array<{ line: string; timestamp: Date }>> {
    try {
      const container = await this.getContainer(containerName);
      if (!container) {
        throw new Error(`Container ${containerName} not found`);
      }

      const logOptions: any = {
        stdout: true,
        stderr: true,
        tail: options.lines || 100
      };

      if (options.since) {
        logOptions.since = Math.floor(new Date(options.since).getTime() / 1000);
      }

      const logs = await container.logs(logOptions) as unknown as Buffer;
      const logLines = logs.toString().split('\n').filter((line: string) => line.trim());
      
      // Clean Docker log headers (8-byte prefix: stream type + timestamp)
      // Return both the cleaned log line and its timestamp if withTimestamps is true
      const processedLogs = logLines.map((line) => {
        let cleanedLine = line;
        let timestamp: Date | null = null;
        
        if (line.length > 8) {
          const firstChar = line.charCodeAt(0);
          // Check if first character is Docker stream type (0x01=stdout, 0x02=stderr)
          if (firstChar === 0x01 || firstChar === 0x02) {
            // Extract timestamp from bytes 1-8 (nanoseconds since epoch)
            const timestampBuffer = Buffer.from(line.substring(1, 9), 'binary');
            const nanoseconds = timestampBuffer.readBigUInt64BE(0);
            const milliseconds = Number(nanoseconds / BigInt(1000000));
            timestamp = new Date(milliseconds);
            cleanedLine = line.substring(8).replace(/^[\u0000-\u001F]+/, '');
          } else if (line.startsWith('\u0001') || line.startsWith('\u0002')) {
            const timestampBuffer = Buffer.from(line.substring(1, 9), 'binary');
            const nanoseconds = timestampBuffer.readBigUInt64BE(0);
            const milliseconds = Number(nanoseconds / BigInt(1000000));
            timestamp = new Date(milliseconds);
            cleanedLine = line.substring(8).replace(/^[\u0000-\u001F]+/, '');
          }
        }
        
        // If no timestamp extracted, try to parse from log content
        if (!timestamp) {
          // Try ISO format
          const isoMatch = cleanedLine.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
          if (isoMatch) {
            timestamp = new Date(isoMatch[0]);
          }
        }
        
        // Remove any control characters at the start
        cleanedLine = cleanedLine.replace(/^[\u0000-\u001F]+/, '');
        
        // Return with timestamps if requested, otherwise just the line
        if (options.withTimestamps) {
          return { line: cleanedLine, timestamp: timestamp || new Date() };
        }
        return cleanedLine;
      }).filter((item: any) => {
        const line = typeof item === 'string' ? item : item.line;
        return line.trim();
      });
      
      return processedLogs as string[] | Array<{ line: string; timestamp: Date }>;
    } catch (error) {
      console.error(`Error getting logs for ${containerName}:`, error);
      throw error;
    }
  }


  async restartContainer(containerName: string): Promise<boolean> {
    try {
      const container = await this.getContainer(containerName);
      if (!container) {
        throw new Error(`Container ${containerName} not found`);
      }

      await container.restart();
      return true;
    } catch (error) {
      console.error(`Error restarting container ${containerName}:`, error);
      throw error;
    }
  }

  async stopContainer(containerName: string): Promise<boolean> {
    try {
      const container = await this.getContainer(containerName);
      if (!container) {
        throw new Error(`Container ${containerName} not found`);
      }

      await container.stop();
      return true;
    } catch (error) {
      console.error(`Error stopping container ${containerName}:`, error);
      throw error;
    }
  }

  async startContainer(containerName: string): Promise<boolean> {
    try {
      const container = await this.getContainer(containerName);
      if (!container) {
        throw new Error(`Container ${containerName} not found`);
      }

      await container.start();
      return true;
    } catch (error) {
      console.error(`Error starting container ${containerName}:`, error);
      throw error;
    }
  }

  private calculateCpuPercent(stats: any): number {
    if (!stats.cpu_stats || !stats.precpu_stats) return 0;
    
    const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
    const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
    
    if (systemDelta > 0 && cpuDelta > 0) {
      return (cpuDelta / systemDelta) * stats.cpu_stats.online_cpus * 100;
    }
    return 0;
  }
}

export const dockerService = new DockerService();

