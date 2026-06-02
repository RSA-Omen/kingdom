import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createAuthMiddleware } from './middleware/auth';
import { azureAuthMiddleware } from './middleware/azureAuth';
import appsRouter from './routes/apps';
import healthRouter from './routes/health';
import metricsRouter from './routes/metrics';
import usageRouter from './routes/usage';
import eventsRouter from './routes/events';
import reportsRouter from './routes/reports';
import authRouter from './routes/auth';
import dependenciesRouter from './routes/dependencies';
import logGuruRouter from './routes/logGuru';
import systemResourcesRouter from './routes/systemResources';
import backupsRouter from './routes/backups';
import bureauRouter from './routes/bureau';
import errorsRouter from './routes/errors';
import checkpointsRouter from './routes/checkpoints';
import todosRouter from './routes/todos';
import githubSyncRouter from './routes/githubSync';
import guildBoardRouter from './routes/guildBoard';
import projectsRouter from './routes/projects';
import { healthService } from './services/health';
import { schedulerService } from './services/scheduler';
import { startProjectSync, stopProjectSync } from './services/projectSync';
import { db } from './models/database';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: true, // Allow all origins (or specify your frontend URL)
  credentials: true, // Allow credentials
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  exposedHeaders: ['Content-Type', 'Cache-Control', 'Connection']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint (no auth required)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Authentication routes (no auth required for login/callback)
app.use('/api/auth', authRouter);

// Health endpoint (no auth required - for monitoring systems like n8n)
app.use('/api/health', healthRouter);

// API routes with authentication
const authMiddleware = createAuthMiddleware();
app.use('/api/apps', authMiddleware, appsRouter);
app.use('/api/metrics', authMiddleware, metricsRouter);
app.use('/api/usage', authMiddleware, usageRouter);
app.use('/api/events', authMiddleware, eventsRouter);
app.use('/api/dependencies', authMiddleware, dependenciesRouter);
app.use('/api/log-guru', authMiddleware, logGuruRouter);
app.use('/api/system-resources', authMiddleware, systemResourcesRouter);
app.use('/api/backups', authMiddleware, backupsRouter);

// Auth-protected user info endpoint
app.get('/api/auth/me', azureAuthMiddleware as any, (req, res) => {
  const user = (req as any).user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
  });
});

// Track endpoint (no auth for external services, but could add API key auth)
import trackRouter from './routes/track';
app.use('/api/track', trackRouter);

// Reception flow endpoint - alternative path for App Proxy passthrough
// This allows /reception/usage to be configured with passthrough in App Proxy
app.use('/reception/usage', trackRouter);

// Reports endpoint (no auth required - public stats like health check)
app.use('/api/reports', reportsRouter);

// Errors endpoint (no auth required - for villages to report errors)
app.use('/api/errors', errorsRouter);

// Checkpoints endpoint (no auth required - for villages to push checkpoint events)
app.use('/api/checkpoints', checkpointsRouter);

// GitHub sync endpoint (no auth required - for syncing GitHub Issues)
// Mounted before /api/todos to avoid the /:id catch in todosRouter
app.use('/api/todos/sync', githubSyncRouter);

// Todos endpoint (no auth required - for managing tasks)
app.use('/api/todos', todosRouter);

// Bureau endpoint (no auth required - for n8n, Open WebUI, AI agents)
app.use('/api/bureau', bureauRouter);

// Guild Board feed (no auth required - read-only aggregation for the king's dashboard)
app.use('/api/guild-board', guildBoardRouter);

// Projects registry (no auth required - king's internal project tracker)
app.use('/api/projects', projectsRouter);

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Admin Center Backend running on port ${PORT}`);
  
  // Initialize database
  const dbInstance = db.getDb();
  console.log('Database connected');

  // Run migrations
  schedulerService.runMigrations();

  // Start health check service
  healthService.startPeriodicChecks();
  
  // Start scheduler service (for dependency checks)
  schedulerService.start();

  // Start project sync (15-minute Asana deep-sync for enrolled projects)
  startProjectSync();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  healthService.stopPeriodicChecks();
  schedulerService.stop();
  stopProjectSync();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  healthService.stopPeriodicChecks();
  schedulerService.stop();
  stopProjectSync();
  process.exit(0);
});

