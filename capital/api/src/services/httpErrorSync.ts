import { randomUUID } from 'crypto';
import { db } from '../models/database';

interface HttpError {
  timestamp: string;
  status_code: number;
  app: string;
  endpoint: string;
  message: string;
  full_message: string;
}

interface SyncResult {
  errors_imported: number;
  duration_ms: number;
  errors: string[];
}

class HttpErrorSyncService {
  private readonly GRAYLOG_URL = process.env.GRAYLOG_URL || 'http://localhost:19000';
  private readonly GRAYLOG_USER = process.env.GRAYLOG_USER || 'admin';
  private readonly GRAYLOG_PASSWORD = process.env.GRAYLOG_PASSWORD || 'admin';
  private readonly TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  private readonly TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

  async sync(): Promise<SyncResult> {
    const startTime = Date.now();
    const result: SyncResult = {
      errors_imported: 0,
      errors: [],
      duration_ms: 0,
    };

    try {
      // Fetch 4xx errors
      const errors_4xx = await this.fetchHttpErrors('4');
      // Fetch 5xx errors
      const errors_5xx = await this.fetchHttpErrors('5');

      const allErrors = [...errors_4xx, ...errors_5xx];

      for (const error of allErrors) {
        const status = this.upsertHttpError(error);
        if (status === 'imported') {
          result.errors_imported++;
          // Telegram notifications disabled - errors tracked on web platform only
        }
      }

      console.log(
        `[HttpErrorSync] Sync complete — ${result.errors_imported} new HTTP errors (4xx/5xx)`
      );
    } catch (error: any) {
      const msg = error.message || String(error);
      result.errors.push(msg);
      console.error(`[HttpErrorSync] Sync failed: ${msg}`);
    }

    result.duration_ms = Date.now() - startTime;
    return result;
  }

  private async fetchHttpErrors(statusPrefix: string): Promise<HttpError[]> {
    // Fetch HTTP errors from the last 1 hour - search for 4xx or 5xx status codes
    const range = 3600;
    let url: string;

    if (statusPrefix === '4') {
      // Search for 4xx errors
      url = `${this.GRAYLOG_URL}/api/search/universal/relative?query=404&range=${range}&limit=100`;
    } else {
      // Search for 5xx errors
      url = `${this.GRAYLOG_URL}/api/search/universal/relative?query=500&range=${range}&limit=100`;
    }

    const auth = Buffer.from(`${this.GRAYLOG_USER}:${this.GRAYLOG_PASSWORD}`).toString('base64');

    const response = await fetch(url, {
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Graylog API returned ${response.status}: ${response.statusText}`);
    }

    const data = (await response.json()) as any;

    if (data.error) {
      throw new Error(`Graylog error: ${data.error}`);
    }

    const errors: HttpError[] = [];
    for (const msg of data.messages || []) {
      const httpError = this.parseHttpError(msg.message);
      if (httpError) {
        errors.push(httpError);
      }
    }

    return errors;
  }

  private parseHttpError(message: any): HttpError | null {
    // Parse log format: "172.19.0.1 - - - [07/May/2026:01:33:44 +0000] "GET /api/invalid-endpoint HTTP/1.1" 404 102 "-" "curl/8.5.0""
    const text = message.message;
    const statusMatch = text.match(/"[A-Z]+ .* HTTP\/\d\.\d" (\d{3})/);

    if (!statusMatch) {
      return null;
    }

    const statusCode = parseInt(statusMatch[1], 10);
    if (!statusCode.toString().startsWith('4') && !statusCode.toString().startsWith('5')) {
      return null;
    }

    const methodMatch = text.match(/"([A-Z]+) ([^\s]+) HTTP/);
    const method = methodMatch ? methodMatch[1] : 'UNKNOWN';
    const endpoint = methodMatch ? methodMatch[2] : '/';

    // Determine app source from the message or full message
    let app = 'unknown';
    const fullText = (message.full_message || text).toLowerCase();

    if (fullText.includes('pdf-removal')) {
      app = 'pdf-removal';
    } else if (fullText.includes('interceptor')) {
      app = 'interceptor';
    } else if (fullText.includes('gekko-tracks')) {
      app = 'gekko-tracks';
    } else if (fullText.includes('application_name')) {
      // Try to extract from Graylog's application_name field if available
      const appMatch = fullText.match(/application_name["\']?\s*[:=]\s*["\']?([a-z0-9\-]+)/);
      if (appMatch) {
        app = appMatch[1];
      }
    }

    // Use the Graylog application_name field if available and not already set
    if (app === 'unknown' && message.application_name) {
      app = message.application_name;
    }

    return {
      timestamp: message.timestamp,
      status_code: statusCode,
      app,
      endpoint,
      message: `${method} ${endpoint} returned ${statusCode}`,
      full_message: text.substring(0, 200),
    };
  }

  private upsertHttpError(error: HttpError): 'imported' | 'noop' {
    const source = `http:${error.app}:${error.status_code}:${error.endpoint}:${error.timestamp}`;
    const dbInstance = (db as any).getDb();

    const existing = dbInstance
      .prepare('SELECT id FROM errors WHERE source = ?')
      .get(source) as { id: string } | undefined;

    if (existing) {
      return 'noop';
    }

    const id = randomUUID();
    const severity = error.status_code >= 500 ? 'error' : 'warning';
    const created_at = Math.floor(new Date(error.timestamp).getTime() / 1000);

    dbInstance.prepare(
      `INSERT INTO errors (id, village, message, stack, severity, status, source, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, error.app, error.message, error.full_message, severity, 'open', source, created_at);

    return 'imported';
  }

  private async notifyTelegram(error: HttpError): Promise<void> {
    if (!this.TELEGRAM_BOT_TOKEN || !this.TELEGRAM_CHAT_ID) {
      return;
    }

    const emoji = error.status_code >= 500 ? '🔴' : '🟡';
    const timestamp = new Date(error.timestamp).toLocaleString('en-AU', { timeZone: 'Australia/Sydney' });
    const message = `${emoji} *HTTP ${error.status_code}* in ${error.app}\n\n${error.message}\n\n_${timestamp}_`;

    try {
      const response = await fetch(
        `https://api.telegram.org/bot${this.TELEGRAM_BOT_TOKEN}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: this.TELEGRAM_CHAT_ID,
            text: message,
            parse_mode: 'Markdown',
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Telegram API returned ${response.status}`);
      }
    } catch (error: any) {
      console.error(`[HttpErrorSync] Telegram send failed: ${error.message}`);
    }
  }
}

export const httpErrorSyncService = new HttpErrorSyncService();
