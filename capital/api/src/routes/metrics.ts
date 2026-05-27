import { Router, Request, Response } from 'express';
import { db } from '../models/database';
import { dockerService } from '../services/docker';
import { usageService } from '../services/usage';

const router = Router();

// GET /api/metrics
router.get('/', async (req: Request, res: Response) => {
  try {
    const apps = await db.getAllApps();
    const containers = await dockerService.listContainers();
    const runningContainers = containers.filter(c => c.state === 'running').length;

    // Calculate average response time from recent health checks
    const recentEvents = await db.getEvents(undefined, 100);
    const healthEvents = recentEvents.filter(e => e.event_type === 'alert');
    
    // Get recent usage stats
    const topApps = await usageService.getTopApps(5, 7);

    res.json({
      total_apps: apps.length,
      running_containers: runningContainers,
      avg_response_time: null, // Would need to calculate from health_history
      uptime_percentage: null, // Would need to calculate from container uptimes
      recent_events: recentEvents.slice(0, 10),
      top_apps: topApps
    });
  } catch (error: any) {
    console.error('Error fetching metrics:', error);
    // Return safe defaults so dashboard widgets don't break
    res.json({
      total_apps: 0,
      running_containers: 0,
      avg_response_time: null,
      uptime_percentage: null,
      recent_events: [],
      top_apps: []
    });
  }
});

export default router;

