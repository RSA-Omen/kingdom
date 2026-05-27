import { randomUUID } from 'crypto';
import { db } from '../models/database';

interface GraylogMessage {
  message: string;
  timestamp: string;
  level: number;
  source: string;
  _id: string;
}

interface GraylogSearchResponse {
  total: number;
  messages: Array<{ message: GraylogMessage }>;
  query: string;
  range: number;
  error?: string;
}

interface SyncResult {
  errors_imported: number;
  errors_updated: number;
  errors: string[];
  duration_ms: number;
}

class GraylogSyncService {
  private readonly GRAYLOG_URL = process.env.GRAYLOG_URL || 'http://localhost:19000';
  private readonly GRAYLOG_USER = process.env.GRAYLOG_USER || 'admin';
  private readonly GRAYLOG_PASSWORD = process.env.GRAYLOG_PASSWORD || 'admin';
  private readonly TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  private readonly TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
  // Syslog levels: 0=Emergency 1=Alert 2=Critical 3=Error 4=Warning 5=Notice 6=Info 7=Debug
  // Fetch levels 0–4 (Emergency through Warning) — broader than just ERROR
  private readonly GRAYLOG_LEVEL_RANGE = '[0 TO 4]';

  async sync(): Promise<SyncResult> {
    const startTime = Date.now();
    const result: SyncResult = {
      errors_imported: 0,
      errors_updated: 0,
      errors: [],
      duration_ms: 0,
    };

    try {
      const errors = await this.fetchRecentErrors();

      for (const error of errors) {
        const status = this.upsertError(error);
        if (status === 'imported') {
          result.errors_imported++;
          // Telegram notifications disabled - errors tracked on web platform only
        } else if (status === 'updated') {
          result.errors_updated++;
        }
      }

      console.log(
        `[GraylogSync] Sync complete — ${result.errors_imported} new, ${result.errors_updated} updated`
      );
    } catch (error: any) {
      const msg = error.message || String(error);
      result.errors.push(msg);
      console.error(`[GraylogSync] Sync failed: ${msg}`);
    }

    result.duration_ms = Date.now() - startTime;
    return result;
  }

  private async fetchRecentErrors(): Promise<GraylogMessage[]> {
    const query = `level:${this.GRAYLOG_LEVEL_RANGE}`;
    const range = 86400;
    const url = `${this.GRAYLOG_URL}/api/search/universal/relative?query=${encodeURIComponent(query)}&range=${range}&limit=100&sort=timestamp:desc`;

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

    const data = (await response.json()) as GraylogSearchResponse;

    if (data.error) {
      throw new Error(`Graylog error: ${data.error}`);
    }

    return data.messages?.map(m => m.message) || [];
  }

  private upsertError(graylogMessage: GraylogMessage): 'imported' | 'updated' | 'noop' | 'skipped' {
    const severity = this.resolveSeverity(graylogMessage);

    // INFO messages are not actionable — skip entirely
    if (severity === 'info') return 'skipped';

    const source = `graylog:${graylogMessage._id}`;
    const dbInstance = (db as any).getDb();

    const existing = dbInstance
      .prepare('SELECT id FROM errors WHERE source = ?')
      .get(source) as { id: string } | undefined;

    if (existing) return 'noop';

    const created_at = Math.floor(new Date(graylogMessage.timestamp).getTime() / 1000);
    const id = randomUUID();
    dbInstance.prepare(
      `INSERT INTO errors (id, village, message, stack, severity, status, source, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, graylogMessage.source || 'unknown', graylogMessage.message, null, severity, 'open', source, created_at);

    return 'imported';
  }

  // Parse severity from message text first (more reliable than syslog level for apps
  // like Gunicorn that emit all log levels at syslog level 3), then fall back to
  // the syslog level field.
  private resolveSeverity(msg: GraylogMessage): string {
    const text = msg.message.toUpperCase();

    // Match both [LEVEL] and - LEVEL - formats used by different app loggers
    const isCritical = /(\[CRITICAL\]|\[EMERG\]|\[ALERT\]| - CRITICAL - | - EMERG - | - ALERT - )/.test(text);
    const isError    = /(\[ERROR\]| - ERROR - )/.test(text);
    const isWarning  = /(\[WARNING\]|\[WARN\]| - WARNING - | - WARN - )/.test(text);
    const isInfo     = /(\[INFO\]|\[DEBUG\]|\[NOTICE\]| - INFO - | - DEBUG - | - NOTICE - )/.test(text);

    if (isCritical) return 'critical';
    if (isError)    return 'error';
    if (isWarning)  return 'warning';
    if (isInfo)     return 'info';

    // Syslog fallback: lower number = more severe
    if (msg.level <= 2) return 'critical';
    if (msg.level === 3) return 'error';
    if (msg.level === 4) return 'warning';
    return 'info';
  }

  private async notifyTelegram(error: GraylogMessage): Promise<void> {
    if (!this.TELEGRAM_BOT_TOKEN || !this.TELEGRAM_CHAT_ID) {
      return; // Telegram not configured, skip silently
    }

    const timestamp = new Date(error.timestamp).toLocaleString('en-AU', { timeZone: 'Australia/Sydney' });
    const message = `🚨 *ERROR in ${error.source}*\n\n${error.message.substring(0, 200)}\n\n_${timestamp}_`;

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
      console.error(`[GraylogSync] Telegram send failed: ${error.message}`);
    }
  }
}

export const graylogSyncService = new GraylogSyncService();
