import axios from 'axios';
import { db, App, HealthHistory } from '../models/database';
import { dockerService } from './docker';

export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy' | 'unknown' | 'timeout' | 'error';
  responseTime: number;
  error?: string;
  checkedAt: string;
}

class HealthService {
  private checkIntervals: Map<number, NodeJS.Timeout> = new Map();
  private defaultIntervalMs: number;

  constructor() {
    // Default to 5 minutes (300000ms) - health checks don't need to run constantly
    this.defaultIntervalMs = parseInt(process.env.HEALTH_CHECK_INTERVAL || '300000', 10);
  }

  private getIntervalMs(app: App): number {
    // Use app-specific interval if set, otherwise use default
    if (app.health_check_interval_seconds) {
      return app.health_check_interval_seconds * 1000;
    }
    return this.defaultIntervalMs;
  }

  async checkAppHealth(app: App): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const checkedAt = new Date().toISOString();

    try {
      // Check if container is running (only if container_name is set)
      let containerStatus = { exists: false, running: false };
      let skipContainerCheck = false;
      
      if (app.container_name) {
        containerStatus = await dockerService.getContainerStatus(app.container_name);
        
        // If container doesn't exist, but we have a health endpoint, try HTTP check anyway
        // (app might be running via systemd or other means)
        if (!containerStatus.exists && app.health_endpoint) {
          skipContainerCheck = true; // Skip container check, proceed to HTTP health check
        } else if (!containerStatus.exists || !containerStatus.running) {
          // Only return early if we don't have a health endpoint to fall back to
          if (!app.health_endpoint) {
            const result: HealthCheckResult = {
              status: 'unknown',
              responseTime: 0,
              error: 'Container not running',
              checkedAt
            };
            await this.recordHealthCheck(app.id!, result);
            return result;
          }
          // If we have a health endpoint, proceed to HTTP check even if container is down
          skipContainerCheck = true;
        }
      }

      // If no health endpoint configured, just check container state
      if (!app.health_endpoint) {
        const result: HealthCheckResult = {
          status: containerStatus.running ? 'healthy' : 'unhealthy',
          responseTime: Date.now() - startTime,
          checkedAt
        };
        await this.recordHealthCheck(app.id!, result);
        return result;
      }

      // Perform HTTP health check
      const port = app.health_port || app.main_port || 80;
      const protocol = port === 443 ? 'https' : 'http';
      // Determine host: use container name only if container is running and on same network
      // Otherwise use HOST_IP (Docker gateway) or localhost to reach host services
      let host: string = 'localhost';
      const containerName = app.container_name;
      const canUseContainerName = containerName && 
                                   containerStatus.exists && 
                                   containerStatus.running && 
                                   !skipContainerCheck;
      
      if (canUseContainerName) {
        host = containerName; // TypeScript now knows containerName is defined
      } else if (process.env.HOST_IP) {
        host = process.env.HOST_IP; // Use Docker gateway IP to reach host
      }
      
      // host is guaranteed to be a string (initialized to 'localhost' and only reassigned to strings)
      
      const healthUrl = `${protocol}://${host}:${port}${app.health_endpoint}`;

      try {
        const response = await axios.get(healthUrl, {
          timeout: 10000, // Increased to 10 seconds to handle slower services
          validateStatus: () => true, // Don't throw on any status
          maxRedirects: 5 // Follow redirects (default is 5, but explicit for clarity)
        });

        const responseTime = Date.now() - startTime;
        // Consider 2xx and 3xx status codes as healthy (service is responding)
        // Also check if response data explicitly indicates healthy status
        const isHealthy = (response.status >= 200 && response.status < 400) || 
          (response.data?.status === 'healthy');

        const result: HealthCheckResult = {
          status: isHealthy ? 'healthy' : 'unhealthy',
          responseTime,
          error: isHealthy ? undefined : `HTTP ${response.status}`,
          checkedAt
        };

        await this.recordHealthCheck(app.id!, result);
        return result;
      } catch (error: any) {
        const responseTime = Date.now() - startTime;
        const result: HealthCheckResult = {
          status: error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' ? 'timeout' : 'error',
          responseTime,
          error: error.message,
          checkedAt
        };
        await this.recordHealthCheck(app.id!, result);
        return result;
      }
    } catch (error: any) {
      const result: HealthCheckResult = {
        status: 'error',
        responseTime: Date.now() - startTime,
        error: error.message,
        checkedAt
      };
      await this.recordHealthCheck(app.id!, result);
      return result;
    }
  }

  private async recordHealthCheck(appId: number, result: HealthCheckResult): Promise<void> {
    // Record in health_history
    await db.addHealthHistory({
      app_id: appId,
      status: result.status,
      response_time_ms: result.responseTime,
      checked_at: result.checkedAt,
      error_message: result.error
    });

    // Update app's last health check
    const app = await db.getAppById(appId);
    if (app) {
      await db.updateApp(app.slug, {
        last_health_check: result.checkedAt,
        last_health_status: result.status
      });

      // Create alert event if unhealthy
      if (result.status === 'unhealthy' || result.status === 'error') {
        await db.addEvent({
          app_id: appId,
          event_type: 'alert',
          message: `Health check failed: ${result.error || result.status}`,
          metadata: { healthCheck: result }
        });
      }
    }
  }

  async checkAllApps(): Promise<void> {
    const apps = await db.getAllApps({ status: 'active' });
    
    for (const app of apps) {
      if ((app.container_name || app.health_endpoint) && app.id) {
        try {
          await this.checkAppHealth(app);
        } catch (error) {
          console.error(`Error checking health for ${app.name}:`, error);
        }
      }
    }
  }

  private scheduleAppCheck(app: App): void {
    if (!app.id || (!app.container_name && !app.health_endpoint)) return;

    // Clear existing interval for this app
    const existing = this.checkIntervals.get(app.id);
    if (existing) {
      clearInterval(existing);
    }

    const intervalMs = this.getIntervalMs(app);
    
    // Initial check
    this.checkAppHealth(app).catch(err => {
      console.error(`Error in initial health check for ${app.name}:`, err);
    });

    // Schedule periodic checks for this app
    const interval = setInterval(() => {
      this.checkAppHealth(app).catch(err => {
        console.error(`Error in periodic health check for ${app.name}:`, err);
      });
    }, intervalMs);

    this.checkIntervals.set(app.id, interval);
  }

  startPeriodicChecks(): void {
    // Stop all existing intervals
    this.stopPeriodicChecks();

    // Load all apps and schedule individual checks
    const apps = db.getAllApps({ status: 'active' });
    for (const app of apps) {
      if (app.container_name || app.health_endpoint) {
        this.scheduleAppCheck(app);
      }
    }
    console.log(`Health checks started for ${apps.length} apps with per-app intervals`);
  }

  stopPeriodicChecks(): void {
    for (const interval of this.checkIntervals.values()) {
      clearInterval(interval);
    }
    this.checkIntervals.clear();
  }

  // Call this when an app is updated to reschedule its checks
  rescheduleApp(app: App): void {
    if (app.status === 'active' && app.container_name) {
      this.scheduleAppCheck(app);
    } else {
      // Remove interval if app is inactive
      if (app.id) {
        const existing = this.checkIntervals.get(app.id);
        if (existing) {
          clearInterval(existing);
          this.checkIntervals.delete(app.id);
        }
      }
    }
  }
}

export const healthService = new HealthService();

