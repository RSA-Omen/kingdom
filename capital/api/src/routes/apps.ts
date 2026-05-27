import { Router, Request, Response } from 'express';
import { db } from '../models/database';
import { dockerService } from '../services/docker';
import { healthService } from '../services/health';
import { readFileSync } from 'fs';
import { join } from 'path';
import axios from 'axios';

const router = Router();

// GET /api/apps
router.get('/', async (req: Request, res: Response) => {
  try {
    const filters = {
      status: req.query.status as string | undefined,
      type: req.query.type as string | undefined,
      search: req.query.search as string | undefined
    };
    const apps = await db.getAllApps(filters);
    res.json(apps);
  } catch (error: any) {
    console.error('Error fetching apps:', error);
    // Dashboard should still load even if DB is empty/broken
    res.json([]);
  }
});

// GET /api/apps/:slug
router.get('/:slug', async (req: Request, res: Response) => {
  try {
    const app = await db.getAppBySlug(req.params.slug);
    if (!app) {
      return res.status(404).json({ error: 'App not found' });
    }
    res.json(app);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/apps
router.post('/', async (req: Request, res: Response) => {
  try {
    const app = await db.createApp(req.body);
    res.status(201).json(app);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// PATCH /api/apps/:slug
router.patch('/:slug', async (req: Request, res: Response) => {
  try {
    const app = await db.updateApp(req.params.slug, req.body);
    if (!app) {
      return res.status(404).json({ error: 'App not found' });
    }
    // Reschedule health checks if interval or status changed
    if (req.body.health_check_interval_seconds !== undefined || req.body.status !== undefined) {
      healthService.rescheduleApp(app);
    }
    res.json(app);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// DELETE /api/apps/:slug
router.delete('/:slug', async (req: Request, res: Response) => {
  try {
    const success = await db.deleteApp(req.params.slug);
    if (!success) {
      return res.status(404).json({ error: 'App not found' });
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/apps/:slug/status
router.get('/:slug/status', async (req: Request, res: Response) => {
  try {
    const app = await db.getAppBySlug(req.params.slug);
    if (!app || !app.container_name) {
      return res.status(404).json({ error: 'App or container not found' });
    }

    const containerStatus = await dockerService.getContainerStatus(app.container_name);
    res.json({
      container_state: containerStatus.state,
      health_status: app.last_health_status || 'unknown',
      uptime_seconds: containerStatus.uptime || 0,
      last_health_check: app.last_health_check,
      response_time_ms: null, // Would need to get from last health check
      ...containerStatus
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/apps/:slug/logs/analyze (must be before /:slug/logs to avoid route conflict)
router.post('/:slug/logs/analyze', async (req: Request, res: Response) => {
  try {
    const app = await db.getAppBySlug(req.params.slug);
    if (!app || !app.container_name) {
      return res.status(404).json({ error: 'App or container not found' });
    }

    const { errorLog, contextLines } = req.body;
    
    if (!errorLog) {
      return res.status(400).json({ error: 'errorLog is required' });
    }

    // Get more context around the error for better analysis
    const lines = (contextLines || 50) + 20; // Get extra lines for context
    const logs = await dockerService.getContainerLogs(app.container_name, { lines });
    
    // Convert logs to string array if they're objects
    const logStrings = logs.map((log: string | { line: string; timestamp: Date }) => 
      typeof log === 'string' ? log : log.line
    );
    
    // Find the error log in the full log set and get surrounding context
    const errorIndex = logStrings.findIndex((log: string) => log.includes(errorLog.trim()));
    const startIndex = Math.max(0, errorIndex - (contextLines || 10));
    const endIndex = Math.min(logStrings.length, errorIndex + (contextLines || 10));
    const context = logStrings.slice(startIndex, endIndex).join('\n');

    // Use Groq API to analyze the error
    const groqApiKey = process.env.GROQ_API_KEY;
    if (!groqApiKey) {
      return res.status(500).json({ 
        error: 'Groq API key not configured. Please set GROQ_API_KEY environment variable.' 
      });
    }

    const analysisPrompt = `You are a DevOps engineer analyzing a log error from a Docker container. 

Application: ${app.name} (${app.slug})
Container: ${app.container_name}

Error Log Line:
${errorLog}

Context (surrounding log lines):
${context}

Please provide:
1. A brief explanation of why this error is occurring
2. A step-by-step fix or solution

Be concise and actionable. Format your response as JSON with "summary" and "fix" fields.`;

    try {
      // Call Groq API (OpenAI-compatible endpoint)
      const response = await axios.post(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          model: 'llama-3.3-70b-versatile', // Groq's fast model, can also use: mixtral-8x7b-32768, llama-3.1-70b-versatile
          messages: [
            {
              role: 'system',
              content: 'You are a helpful DevOps engineer that analyzes error logs and provides clear, actionable fixes. Always respond with valid JSON containing "summary" and "fix" fields.'
            },
            {
              role: 'user',
              content: analysisPrompt
            }
          ],
          temperature: 0.3,
          max_tokens: 1000,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${groqApiKey}`,
          },
        }
      );

      const data = response.data;
      const content = data.choices[0]?.message?.content || '{}';
      
      // Try to parse JSON response, fallback to plain text
      let analysis;
      try {
        analysis = JSON.parse(content);
      } catch {
        // If not JSON, treat as plain text summary
        analysis = {
          summary: content,
          fix: 'See summary above for details.'
        };
      }

      // Ensure we have the expected structure
      if (!analysis.summary) {
        analysis.summary = analysis.explanation || content;
      }
      if (!analysis.fix) {
        analysis.fix = analysis.solution || 'No specific fix provided.';
      }

      res.json({
        errorLog,
        appName: app.name,
        appSlug: app.slug,
        containerName: app.container_name,
        analysis: {
          summary: analysis.summary,
          fix: analysis.fix,
        },
        context: context.split('\n').slice(0, 20), // Return first 20 lines of context
      });
    } catch (aiError: any) {
      console.error('Error calling Groq API:', aiError);
      res.status(500).json({ 
        error: 'Failed to analyze error with AI', 
        details: aiError.response?.data?.error?.message || aiError.message 
      });
    }
  } catch (error: any) {
    console.error('Error analyzing log:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/apps/:slug/logs
router.get('/:slug/logs', async (req: Request, res: Response) => {
  try {
    const app = await db.getAppBySlug(req.params.slug);
    if (!app || !app.container_name) {
      return res.status(404).json({ error: 'App or container not found' });
    }

    const lines = parseInt(req.query.lines as string || '100', 10);
    const since = req.query.since as string | undefined;
    const follow = req.query.follow === 'true';

    if (follow) {
      // For streaming, we'd need Server-Sent Events or WebSocket
      // For now, just return recent logs
      const logs = await dockerService.getContainerLogs(app.container_name, { lines, since });
      res.json({ logs, container_name: app.container_name });
    } else {
      const logs = await dockerService.getContainerLogs(app.container_name, { lines, since });
      res.json({ logs, container_name: app.container_name });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/apps/:slug/restart
router.post('/:slug/restart', async (req: Request, res: Response) => {
  try {
    const app = await db.getAppBySlug(req.params.slug);
    if (!app || !app.container_name) {
      return res.status(404).json({ error: 'App or container not found' });
    }

    await dockerService.restartContainer(app.container_name);
    
    // Log event
    await db.addEvent({
      app_id: app.id!,
      event_type: 'restart',
      message: 'Container restarted via Admin Center',
      metadata: { requested_by: 'admin' }
    });

    const newStatus = await dockerService.getContainerStatus(app.container_name);
    res.json({ success: true, new_state: newStatus.state });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/apps/:slug/config
router.get('/:slug/config', async (req: Request, res: Response) => {
  try {
    const app = await db.getAppBySlug(req.params.slug);
    if (!app) {
      return res.status(404).json({ error: 'App not found' });
    }

    const configType = req.query.type as string || 'all';
    const result: any = {};

    if (configType === 'compose' || configType === 'all') {
      if (app.compose_file_path) {
        try {
          const composeContent = readFileSync(app.compose_file_path, 'utf-8');
          result.compose = composeContent;
        } catch (error) {
          result.compose = null;
          result.compose_error = 'File not found or unreadable';
        }
      } else {
        result.compose = null;
      }
    }

    if (configType === 'env' || configType === 'all') {
      // Try to find .env file in same directory as compose file
      if (app.compose_file_path) {
        const envPath = join(app.compose_file_path, '..', '.env');
        try {
          const envContent = readFileSync(envPath, 'utf-8');
          // Mask sensitive values
          const masked = envContent.split('\n').map(line => {
            if (line.includes('PASSWORD') || line.includes('SECRET') || line.includes('KEY')) {
              const [key] = line.split('=');
              return `${key}=***MASKED***`;
            }
            return line;
          }).join('\n');
          result.env = masked;
        } catch (error) {
          result.env = null;
          result.env_error = 'File not found or unreadable';
        }
      } else {
        result.env = null;
      }
    }

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

