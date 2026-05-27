import { Router, Request, Response } from 'express';
import { bureauService } from '../services/bureau';
import * as https from 'https';
import * as http from 'http';

const router = Router();

async function sendChartToTelegram(chartImageUrl: string): Promise<{ ok: boolean; error?: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID || '5871848434';
  if (!token) {
    return { ok: false, error: 'TELEGRAM_BOT_TOKEN not set' };
  }

  const chartBuffer = await new Promise<Buffer>((resolve, reject) => {
    const url = new URL(chartImageUrl);
    const client = url.protocol === 'https:' ? https : http;
    client.get(chartImageUrl, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });

  if (chartBuffer.length < 100) {
    return { ok: false, error: 'Chart download too small' };
  }

  const boundary = '----form' + Math.random().toString(36).slice(2);
  const bodyParts: Buffer[] = [];
  const encoder = (s: string) => Buffer.from(s, 'utf8');

  bodyParts.push(encoder(`--${boundary}\r\nContent-Disposition: form-data; name="chat_id"\r\n\r\n${chatId}\r\n`));
  bodyParts.push(encoder(`--${boundary}\r\nContent-Disposition: form-data; name="photo"; filename="chart.png"\r\nContent-Type: image/png\r\n\r\n`));
  bodyParts.push(chartBuffer);
  bodyParts.push(encoder(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="caption"\r\n\r\nTime Saved This Week\r\n--${boundary}--\r\n`));

  const body = Buffer.concat(bodyParts);

  const result = await new Promise<{ ok: boolean; error?: string }>((resolve) => {
    const req = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${token}/sendPhoto`,
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length.toString()
      }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const j = JSON.parse(data);
          resolve(j.ok ? { ok: true } : { ok: false, error: j.description || data });
        } catch {
          resolve({ ok: false, error: data });
        }
      });
    });
    req.on('error', (e) => resolve({ ok: false, error: e.message }));
    req.write(body);
    req.end();
  });

  return result;
}

/**
 * GET /api/bureau/systems
 * List all monitored systems with their configuration
 * Used by: n8n, Open WebUI, AI agents
 */
router.get('/systems', async (req: Request, res: Response) => {
  try {
    const systems = await bureauService.getSystems();
    res.json(systems);
  } catch (error: any) {
    console.error('Error fetching systems:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/bureau/health
 * Get aggregated health status of all systems
 * Used by: n8n daily briefing, Open WebUI queries
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const health = await bureauService.getHealthStatus();
    res.json(health);
  } catch (error: any) {
    console.error('Error fetching health:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/bureau/status/:slug
 * Get detailed status for a specific system
 */
router.get('/status/:slug', async (req: Request, res: Response) => {
  try {
    const status = await bureauService.getSystemStatus(req.params.slug);
    if (!status) {
      return res.status(404).json({ error: 'System not found' });
    }
    res.json(status);
  } catch (error: any) {
    console.error('Error fetching system status:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/bureau/diagnose/:slug
 * Run diagnostics on a system (logs, resource usage, etc.)
 */
router.post('/diagnose/:slug', async (req: Request, res: Response) => {
  try {
    const diagnosis = await bureauService.diagnoseSystem(req.params.slug);
    if (!diagnosis) {
      return res.status(404).json({ error: 'System not found' });
    }
    res.json(diagnosis);
  } catch (error: any) {
    console.error('Error diagnosing system:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/bureau/restart/:slug
 * Restart a system (requires confirmation)
 */
router.post('/restart/:slug', async (req: Request, res: Response) => {
  try {
    const { confirmed } = req.body;
    if (!confirmed) {
      return res.status(400).json({
        error: 'Restart requires confirmation',
        message: 'Set confirmed: true in request body to proceed'
      });
    }

    const result = await bureauService.restartSystem(req.params.slug);
    if (!result.success) {
      return res.status(result.notFound ? 404 : 500).json({ error: result.error });
    }
    res.json(result);
  } catch (error: any) {
    console.error('Error restarting system:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/bureau/logs/:slug
 * Get recent logs for a system
 */
router.get('/logs/:slug', async (req: Request, res: Response) => {
  try {
    const lines = parseInt(req.query.lines as string) || 50;
    const logs = await bureauService.getSystemLogs(req.params.slug, lines);
    if (logs === null) {
      return res.status(404).json({ error: 'System not found' });
    }
    res.json({ logs });
  } catch (error: any) {
    console.error('Error fetching logs:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/bureau/command
 * Execute a safe command (for AI agents)
 * Only allows whitelisted commands
 */
router.post('/command', async (req: Request, res: Response) => {
  try {
    const { command, args } = req.body;

    if (!command) {
      return res.status(400).json({ error: 'Command is required' });
    }

    const result = await bureauService.executeCommand(command, args);
    res.json(result);
  } catch (error: any) {
    console.error('Error executing command:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/bureau/capabilities
 * List available capabilities for AI agents
 */
router.get('/capabilities', async (req: Request, res: Response) => {
  try {
    const capabilities = bureauService.getCapabilities();
    res.json(capabilities);
  } catch (error: any) {
    console.error('Error fetching capabilities:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/bureau/send-chart
 * Send a chart image to Telegram by URL. Downloads the image and posts to Telegram API.
 * Used by n8n daily briefing workflow.
 * Requires: TELEGRAM_BOT_TOKEN (and optionally TELEGRAM_CHAT_ID, default 5871848434)
 */
router.post('/send-chart', async (req: Request, res: Response) => {
  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        return res.status(400).json({ error: 'Invalid JSON body' });
      }
    }
    const { chartImageUrl } = body;
    if (!chartImageUrl || typeof chartImageUrl !== 'string') {
      return res.status(400).json({ error: 'chartImageUrl is required' });
    }
    const result = await sendChartToTelegram(chartImageUrl);
    if (!result.ok) {
      return res.status(500).json({ error: result.error });
    }
    res.json({ ok: true });
  } catch (error: any) {
    console.error('[Bureau send-chart]', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/bureau/briefing
 * Get a formatted briefing (for Telegram/notifications)
 */
router.get('/briefing', async (req: Request, res: Response) => {
  try {
    const includeKpis = req.query.kpis !== 'false';
    const briefing = await bureauService.generateBriefing(includeKpis);
    res.json(briefing);
  } catch (error: any) {
    console.error('Error generating briefing:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
