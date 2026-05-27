import { db, App } from '../models/database';
import { dockerService } from './docker';
import { healthService } from './health';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import http from 'http';
import https from 'https';
import axios from 'axios';

const execAsync = promisify(exec);

/** Same URL as telegram_notify_service GKGPU watcher — Ollama /api/tags */
export interface GkgpuBriefingCheck {
  reachable?: boolean;
  responseTimeMs?: number | null;
  error?: string;
  checkedAt: string;
  url: string;
  skipped?: boolean;
}

async function probeGkgpuForBriefing(): Promise<GkgpuBriefingCheck> {
  const url = (process.env.GKGPU_HEALTH_URL || 'http://gkgpu-01:11434/api/tags').trim();
  const timeoutRaw = parseInt(process.env.GKGPU_BRIEFING_TIMEOUT_MS || '5000', 10);
  const timeout = Math.min(60000, Math.max(2000, Number.isFinite(timeoutRaw) ? timeoutRaw : 5000));
  const t0 = Date.now();
  try {
    await axios.get(url, {
      timeout,
      validateStatus: (s) => s === 200,
      httpAgent: new http.Agent({ family: 4 }),
      httpsAgent: new https.Agent({ family: 4 })
    });
    return {
      reachable: true,
      responseTimeMs: Date.now() - t0,
      checkedAt: new Date().toISOString(),
      url
    };
  } catch (e: any) {
    const msg = e?.response ? `HTTP ${e.response.status}` : (e?.message || String(e));
    return {
      reachable: false,
      responseTimeMs: null,
      error: msg,
      checkedAt: new Date().toISOString(),
      url
    };
  }
}

// Systems configuration - single source of truth
// This can be moved to a JSON file or database for easier management
interface SystemConfig {
  slug: string;
  name: string;
  description?: string;
  healthEndpoint?: string;
  healthPort?: number;
  containerName?: string;
  restartCommand?: string;
  logsCommand?: string;
  category: 'automation' | 'service' | 'infrastructure';
}

// Load systems config from file if it exists, otherwise use defaults
function loadSystemsConfig(): SystemConfig[] {
  const configPath = path.join(process.cwd(), '..', 'data', 'bureau-systems.json');

  try {
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.warn('Could not load bureau-systems.json, using database apps');
  }

  return []; // Return empty - will use database apps
}

// Whitelisted commands that AI agents can execute
const ALLOWED_COMMANDS: Record<string, { description: string; handler: (args?: any) => Promise<any> }> = {
  'health-check': {
    description: 'Check health status of all systems',
    handler: async () => bureauService.getHealthStatus()
  },
  'system-status': {
    description: 'Get detailed status of a specific system',
    handler: async (args) => bureauService.getSystemStatus(args?.slug)
  },
  'list-systems': {
    description: 'List all monitored systems',
    handler: async () => bureauService.getSystems()
  },
  'get-logs': {
    description: 'Get recent logs for a system',
    handler: async (args) => bureauService.getSystemLogs(args?.slug, args?.lines || 50)
  },
  'diagnose': {
    description: 'Run diagnostics on a system',
    handler: async (args) => bureauService.diagnoseSystem(args?.slug)
  },
  'docker-ps': {
    description: 'List running Docker containers',
    handler: async () => {
      try {
        const { stdout } = await execAsync('docker ps --format "table {{.Names}}\\t{{.Status}}\\t{{.Ports}}"');
        return { output: stdout };
      } catch (error: any) {
        return { error: error.message };
      }
    }
  },
  'disk-usage': {
    description: 'Check disk usage',
    handler: async () => {
      try {
        const { stdout } = await execAsync('df -h /');
        return { output: stdout };
      } catch (error: any) {
        return { error: error.message };
      }
    }
  },
  'memory-usage': {
    description: 'Check memory usage',
    handler: async () => {
      try {
        const { stdout } = await execAsync('free -h');
        return { output: stdout };
      } catch (error: any) {
        return { error: error.message };
      }
    }
  }
};

class BureauService {
  private systemsConfig: SystemConfig[] = [];

  constructor() {
    this.systemsConfig = loadSystemsConfig();
  }

  /**
   * Get all monitored systems with their configuration
   */
  async getSystems(): Promise<any[]> {
    // Get apps from database
    const apps = db.getAllApps({ status: 'active' });

    // Merge with any config-only systems
    const configSlugs = new Set(this.systemsConfig.map(s => s.slug));
    const dbSystems = apps.map(app => ({
      slug: app.slug,
      name: app.name,
      description: app.description,
      healthEndpoint: app.health_endpoint,
      healthPort: app.health_port,
      containerName: app.container_name,
      category: app.project_type || 'service',
      status: app.last_health_status || 'unknown',
      lastCheck: app.last_health_check,
      dashboardUrl: app.dashboard_url
    }));

    // Add any config-only systems not in DB
    const configOnlySystems = this.systemsConfig
      .filter(s => !apps.find(a => a.slug === s.slug))
      .map(s => ({
        ...s,
        status: 'unknown',
        lastCheck: null
      }));

    return [...dbSystems, ...configOnlySystems];
  }

  /**
   * Get aggregated health status
   */
  async getHealthStatus(): Promise<any> {
    const apps = db.getAllApps({ status: 'active' });

    const healthy = apps.filter(a => a.last_health_status === 'healthy').length;
    const unhealthy = apps.filter(a => a.last_health_status === 'unhealthy').length;
    const unknown = apps.filter(a => !a.last_health_status || a.last_health_status === 'unknown').length;

    return {
      timestamp: new Date().toISOString(),
      summary: {
        total: apps.length,
        healthy,
        unhealthy,
        unknown,
        healthPercent: apps.length > 0 ? Math.round((healthy / apps.length) * 100) : 0
      },
      systems: apps.map(app => ({
        slug: app.slug,
        name: app.name,
        status: app.last_health_status || 'unknown',
        lastCheck: app.last_health_check,
        category: app.project_type
      }))
    };
  }

  /**
   * Get detailed status for a specific system
   */
  async getSystemStatus(slug: string): Promise<any | null> {
    const app = db.getAppBySlug(slug);
    if (!app) return null;

    // Get container status if applicable
    let containerStatus = null;
    if (app.container_name) {
      containerStatus = await dockerService.getContainerStatus(app.container_name);
    }

    // Get recent health history
    const healthHistory = app.id ? db.getHealthHistory(app.id, undefined, 10) : [];

    // Get recent events
    const events = app.id ? db.getEvents(app.id, 5) : [];

    return {
      slug: app.slug,
      name: app.name,
      description: app.description,
      status: app.last_health_status || 'unknown',
      lastCheck: app.last_health_check,
      container: containerStatus,
      healthHistory: healthHistory.map(h => ({
        status: h.status,
        responseTime: h.response_time_ms,
        checkedAt: h.checked_at,
        error: h.error_message
      })),
      recentEvents: events.map(e => ({
        type: e.event_type,
        message: e.message,
        timestamp: e.created_at
      })),
      config: {
        healthEndpoint: app.health_endpoint,
        healthPort: app.health_port,
        containerName: app.container_name,
        dashboardUrl: app.dashboard_url
      }
    };
  }

  /**
   * Run diagnostics on a system
   */
  async diagnoseSystem(slug: string): Promise<any | null> {
    const app = db.getAppBySlug(slug);
    if (!app) return null;

    const diagnosis: any = {
      slug,
      name: app.name,
      timestamp: new Date().toISOString(),
      checks: []
    };

    // Check 1: Health endpoint
    if (app.health_endpoint && app.health_port) {
      try {
        const healthResult = await healthService.checkAppHealth(app);
        diagnosis.checks.push({
          name: 'Health Endpoint',
          status: healthResult.status === 'healthy' ? 'pass' : 'fail',
          details: {
            responseTime: healthResult.responseTime,
            error: healthResult.error
          }
        });
      } catch (error: any) {
        diagnosis.checks.push({
          name: 'Health Endpoint',
          status: 'error',
          details: { error: error.message }
        });
      }
    }

    // Check 2: Container status
    if (app.container_name) {
      try {
        const containerStatus = await dockerService.getContainerStatus(app.container_name);
        diagnosis.checks.push({
          name: 'Container Status',
          status: containerStatus.running ? 'pass' : 'fail',
          details: containerStatus
        });

        // Check 3: Container resource usage
        if (containerStatus.running) {
          try {
            const { stdout } = await execAsync(`docker stats ${app.container_name} --no-stream --format "{{.CPUPerc}}|{{.MemUsage}}"`);
            const [cpu, mem] = stdout.trim().split('|');
            diagnosis.checks.push({
              name: 'Resource Usage',
              status: 'info',
              details: { cpu, memory: mem }
            });
          } catch (e) {
            // Ignore stats errors
          }
        }
      } catch (error: any) {
        diagnosis.checks.push({
          name: 'Container Status',
          status: 'error',
          details: { error: error.message }
        });
      }
    }

    // Check 4: Recent errors
    if (app.id) {
      const recentEvents = db.getEvents(app.id, 10);
      const errorEvents = recentEvents.filter(e => e.event_type === 'alert' || e.event_type === 'error');
      diagnosis.checks.push({
        name: 'Recent Errors',
        status: errorEvents.length === 0 ? 'pass' : 'warn',
        details: {
          count: errorEvents.length,
          errors: errorEvents.slice(0, 3).map(e => ({
            message: e.message,
            timestamp: e.created_at
          }))
        }
      });
    }

    // Overall status
    const failedChecks = diagnosis.checks.filter((c: any) => c.status === 'fail' || c.status === 'error');
    diagnosis.overallStatus = failedChecks.length === 0 ? 'healthy' : 'issues_detected';
    diagnosis.summary = failedChecks.length === 0
      ? 'All checks passed'
      : `${failedChecks.length} check(s) failed: ${failedChecks.map((c: any) => c.name).join(', ')}`;

    return diagnosis;
  }

  /**
   * Restart a system
   */
  async restartSystem(slug: string): Promise<{ success: boolean; error?: string; notFound?: boolean }> {
    const app = db.getAppBySlug(slug);
    if (!app) {
      return { success: false, error: 'System not found', notFound: true };
    }

    // Try Docker restart first
    if (app.container_name) {
      try {
        await execAsync(`docker restart ${app.container_name}`);

        // Log the event
        if (app.id) {
          db.addEvent({
            app_id: app.id,
            event_type: 'restart',
            message: `System restarted via Bureau API`
          });
        }

        return { success: true };
      } catch (error: any) {
        return { success: false, error: `Docker restart failed: ${error.message}` };
      }
    }

    // Check for custom restart command in config
    const configSystem = this.systemsConfig.find(s => s.slug === slug);
    if (configSystem?.restartCommand) {
      try {
        await execAsync(configSystem.restartCommand);
        return { success: true };
      } catch (error: any) {
        return { success: false, error: `Restart command failed: ${error.message}` };
      }
    }

    return { success: false, error: 'No restart method available for this system' };
  }

  /**
   * Get system logs
   */
  async getSystemLogs(slug: string, lines: number = 50): Promise<string | null> {
    const app = db.getAppBySlug(slug);
    if (!app) return null;

    if (app.container_name) {
      try {
        const { stdout } = await execAsync(`docker logs ${app.container_name} --tail ${lines} 2>&1`);
        return stdout;
      } catch (error: any) {
        return `Error fetching logs: ${error.message}`;
      }
    }

    // Check for custom logs command
    const configSystem = this.systemsConfig.find(s => s.slug === slug);
    if (configSystem?.logsCommand) {
      try {
        const { stdout } = await execAsync(configSystem.logsCommand);
        return stdout;
      } catch (error: any) {
        return `Error fetching logs: ${error.message}`;
      }
    }

    return 'No logs available for this system';
  }

  /**
   * Execute a whitelisted command
   */
  async executeCommand(command: string, args?: any): Promise<any> {
    const allowedCommand = ALLOWED_COMMANDS[command];

    if (!allowedCommand) {
      return {
        success: false,
        error: `Unknown command: ${command}`,
        availableCommands: Object.keys(ALLOWED_COMMANDS)
      };
    }

    try {
      const result = await allowedCommand.handler(args);
      return {
        success: true,
        command,
        result
      };
    } catch (error: any) {
      return {
        success: false,
        command,
        error: error.message
      };
    }
  }

  /**
   * Get available capabilities for AI agents
   */
  getCapabilities(): any {
    return {
      commands: Object.entries(ALLOWED_COMMANDS).map(([name, config]) => ({
        name,
        description: config.description
      })),
      endpoints: [
        { method: 'GET', path: '/api/bureau/systems', description: 'List all monitored systems' },
        { method: 'GET', path: '/api/bureau/health', description: 'Get aggregated health status' },
        { method: 'GET', path: '/api/bureau/status/:slug', description: 'Get detailed system status' },
        { method: 'POST', path: '/api/bureau/diagnose/:slug', description: 'Run system diagnostics' },
        { method: 'POST', path: '/api/bureau/restart/:slug', description: 'Restart a system' },
        { method: 'GET', path: '/api/bureau/logs/:slug', description: 'Get system logs' },
        { method: 'POST', path: '/api/bureau/command', description: 'Execute a safe command' },
        { method: 'GET', path: '/api/bureau/briefing', description: 'Get formatted briefing' }
      ]
    };
  }

  /**
   * Generate a formatted briefing for notifications
   */
  async generateBriefing(includeKpis: boolean = true): Promise<any> {
    const health = await this.getHealthStatus();

    let text = "🏛️ THE BUREAU - Daily Briefing\n\n";
    text += "📡 System Health:\n";

    for (const system of health.systems) {
      const icon = system.status === 'healthy' ? '✅' :
                   system.status === 'unhealthy' ? '❌' :
                   system.status === 'error' ? '❌' :
                   system.status === 'stale' ? '⚠️' : '⚪';
      const statusText = system.status === 'healthy' ? 'Online' :
                        system.status === 'unhealthy' ? 'DOWN' :
                        system.status === 'error' ? 'Error' :
                        system.status === 'stale' ? 'Stale' : 'Unknown';
      text += `${icon} ${system.name} - ${statusText}\n`;
    }

    let gkgpu: GkgpuBriefingCheck;
    if (process.env.GKGPU_BRIEFING_ENABLED === 'false') {
      gkgpu = {
        skipped: true,
        checkedAt: new Date().toISOString(),
        url: (process.env.GKGPU_HEALTH_URL || 'http://gkgpu-01:11434/api/tags').trim()
      };
      text += `\n🖥️ AI server (GKGPU) — daily check: skipped (GKGPU_BRIEFING_ENABLED=false)\n`;
    } else {
      gkgpu = await probeGkgpuForBriefing();
      const gkgpuLabel = (process.env.GKGPU_BRIEFING_LABEL || 'Company AI server (GKGPU)').trim();
      text += `\n🖥️ ${gkgpuLabel} — daily status:\n`;
      if (gkgpu.reachable) {
        text += `✅ Up — responded in about ${gkgpu.responseTimeMs} ms\n`;
      } else {
        text += `❌ Not reachable — AI-assisted features may be affected until this is resolved.\n`;
        if (gkgpu.error) {
          const short = gkgpu.error.length > 140 ? `${gkgpu.error.slice(0, 137)}…` : gkgpu.error;
          text += `   (${short})\n`;
        }
      }
    }

    text += `\n📊 Summary: ${health.summary.healthy}/${health.summary.total} healthy`;
    if (health.summary.unhealthy > 0) text += `, ${health.summary.unhealthy} down`;
    if (health.summary.unknown > 0) text += `, ${health.summary.unknown} unknown`;
    text += "\n";

    if (health.summary.unhealthy > 0) {
      text += "\n⚠️ Attention required on failing systems.";
    } else if (health.summary.unknown > 0) {
      text += "\n⚪ Some systems have unknown status.";
    } else {
      text += "\nAll systems operational, Director.";
    }

    return {
      text,
      health: health.summary,
      systems: health.systems,
      gkgpu,
      timestamp: new Date().toISOString()
    };
  }
}

export const bureauService = new BureauService();
