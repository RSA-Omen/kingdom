import { db } from '../models/database';
import { dockerService } from './docker';
import { createHash } from 'crypto';
import Anthropic from '@anthropic-ai/sdk';

export interface LogAnalysis {
  id?: number;
  app_id: number;
  app_slug: string;
  error_log: string;
  error_name?: string;
  context_before?: string;
  context_after?: string;
  analysis_summary?: string;
  analysis_fix?: string;
  is_real_issue: number;
  user_notes?: string;
  analyzed_at?: string;
  marked_at?: string;
  created_at?: string;
  updated_at?: string;
  error_hash?: string;
  group_id?: number;
  occurrence_count?: number;
  error_timestamp?: Date | string;
  first_occurrence_time?: Date | string;
  last_occurrence_time?: Date | string;
  burst_count?: number;
}

/**
 * Generate a descriptive name from an error log
 */
function generateErrorName(errorLog: string, appName?: string): string {
  const lowerLog = errorLog.toLowerCase();

  const patterns = [
    { regex: /(\d{3})\s+(redirect|found|moved|permanent|temporary)/i, name: (m: any) => `${m[1]} Redirect` },
    { regex: /connection\s+(refused|timeout|failed|reset)/i, name: (m: any) => `Connection ${m[1]}` },
    { regex: /timeout/i, name: () => 'Timeout Error' },
    { regex: /unauthorized|401/i, name: () => '401 Unauthorized' },
    { regex: /forbidden|403/i, name: () => '403 Forbidden' },
    { regex: /not found|404/i, name: () => '404 Not Found' },
    { regex: /internal server error|500/i, name: () => '500 Internal Server Error' },
    { regex: /bad request|400/i, name: () => '400 Bad Request' },
    { regex: /database|db|sql/i, name: () => 'Database Error' },
    { regex: /permission denied/i, name: () => 'Permission Denied' },
    { regex: /file not found/i, name: () => 'File Not Found' },
    { regex: /memory|oom/i, name: () => 'Out of Memory' },
    { regex: /exception/i, name: () => 'Exception' },
    { regex: /error/i, name: () => 'Error' },
  ];

  for (const pattern of patterns) {
    const match = errorLog.match(pattern.regex);
    if (match) {
      const name = typeof pattern.name === 'function' ? pattern.name(match) : pattern.name;
      return appName ? `${appName} → ${name}` : name;
    }
  }

  const words = errorLog.split(/\s+/).filter(w => w.length > 3).slice(0, 3);
  const fallback = words.length > 0 ? words.join(' ') : 'Error';
  return appName ? `${appName} → ${fallback}` : fallback;
}

/**
 * Create a hash/fingerprint of an error log for grouping duplicates
 */
function createErrorHash(errorLog: string): string {
  const lowerLog = errorLog.toLowerCase();

  let errorType = '';
  let normalized = lowerLog;

  if (lowerLog.includes('user not authenticated') && lowerLog.includes('redirecting to login')) {
    errorType = 'auth_redirect_warning';
    normalized = 'auth_redirect_warning';
  } else {
    let statusCode: string | null = null;

    const pattern1 = lowerLog.match(/"\s+(\d{3})(\s|$)/);
    if (pattern1) {
      statusCode = pattern1[1];
    }

    if (!statusCode) {
      const pattern2 = lowerLog.match(/\b(302|301|307|308)\s+(redirect|found|moved|permanent|temporary|see other)/i);
      if (pattern2) {
        statusCode = pattern2[1];
      }
    }

    if (!statusCode && lowerLog.includes('302') && (lowerLog.includes('http') || lowerLog.includes('get') || lowerLog.includes('post'))) {
      statusCode = '302';
    }

    if (statusCode) {
      if (['302', '301', '307', '308'].includes(statusCode)) {
        errorType = `http_redirect_${statusCode}`;
        normalized = `http_redirect_${statusCode}`;
      } else if (['400', '401', '403', '404', '500', '502', '503', '504'].includes(statusCode)) {
        errorType = `http_error_${statusCode}`;
        normalized = `http_error_${statusCode}`;
      }
    }
  }

  if (errorType === 'auth_redirect_warning') {
    errorType = 'http_redirect_302';
  }

  if (errorType) {
    return createHash('sha256').update(errorType).digest('hex').substring(0, 16);
  }

  normalized = normalized
    .replace(/\d{4}-\d{2}-\d{2}[t ]\d{2}:\d{2}:\d{2}[.\d]*[z]?/g, '')
    .replace(/\[\d{2}\/\w{3}\/\d{4}:\d{2}:\d{2}:\d{2}[^\]]*\]/g, '')
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '')
    .replace(/\b\d{5,}\b/g, '')
    .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '')
    .replace(/user not authenticated.*redirecting to login/gi, 'auth_redirect_warning')
    .replace(/redirecting to login/gi, 'auth_redirect')
    .replace(/(get|post|put|delete|patch)\s+\/api\/[^\s]+/gi, '$1 /api/path')
    .replace(/worker\s+\(pid:\d+\)/gi, 'worker (pid:id)')
    .replace(/pid:\d+/gi, 'pid:id')
    .replace(/\/[^\s:]+/g, (match) => {
      const parts = match.split('/');
      return parts[parts.length - 1] || match;
    })
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 300);

  const errorKeywords: string[] = [];
  const keywordPatterns = [
    { regex: /connection.*refused/i, keyword: 'connection_refused' },
    { regex: /connection.*timeout/i, keyword: 'connection_timeout' },
    { regex: /worker timeout/i, keyword: 'worker_timeout' },
    { regex: /sigkill/i, keyword: 'sigkill' },
    { regex: /traceback/i, keyword: 'python_traceback' },
    { regex: /error handling request/i, keyword: 'request_error' },
    { regex: /no uri read/i, keyword: 'no_uri_read' },
  ];

  keywordPatterns.forEach(p => {
    if (p.regex.test(errorLog)) {
      errorKeywords.push(p.keyword);
    }
  });

  const hashInput = errorKeywords.length > 0
    ? errorKeywords.join('_')
    : normalized;

  return createHash('sha256').update(hashInput).digest('hex').substring(0, 16);
}

function isErrorLog(log: string): boolean {
  const lowerLog = log.toLowerCase();
  const errorPatterns = [
    /error/i,
    /err/i,
    /failed/i,
    /fail/i,
    /exception/i,
    /stack/i,
    /trace/i,
    /warn/i,
    /warning/i,
    /critical/i,
    /fatal/i,
    /panic/i,
    /\b4\d{2}\b/,
    /\b5\d{2}\b/,
    /timeout/i,
    /connection.*refused/i,
    /connection.*failed/i,
    /unauthorized/i,
    /forbidden/i,
    /not found/i,
    /bad request/i,
    /internal server error/i,
  ];

  return errorPatterns.some(pattern => pattern.test(lowerLog));
}

class LogGuruService {
  private client: Anthropic;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }
    this.client = new Anthropic({ apiKey });
  }

  /**
   * Analyze a single error log with Claude AI
   */
  async analyzeErrorLog(
    appSlug: string,
    errorLog: string,
    contextLines: number = 10,
    errorTimestamp?: Date
  ): Promise<LogAnalysis> {
    const app = await db.getAppBySlug(appSlug);
    if (!app || !app.container_name) {
      throw new Error('App or container not found');
    }

    const lines = contextLines + 20;
    const logEntries = await dockerService.getContainerLogs(app.container_name, { lines, withTimestamps: true }) as Array<{ line: string; timestamp: Date }>;

    const logs = logEntries.map(entry => entry.line);
    const timestamps = logEntries.map(entry => entry.timestamp);

    const errorIndex = logs.findIndex((log: string) => log.includes(errorLog.trim()));
    const startIndex = Math.max(0, errorIndex - contextLines);
    const endIndex = Math.min(logs.length, errorIndex + contextLines);

    const contextBefore = logs.slice(startIndex, errorIndex).join('\n');
    const contextAfter = logs.slice(errorIndex + 1, endIndex).join('\n');
    const fullContext = logs.slice(startIndex, endIndex).join('\n');

    let finalTimestamp = errorTimestamp;
    if (!finalTimestamp && errorIndex >= 0 && errorIndex < timestamps.length) {
      finalTimestamp = timestamps[errorIndex];
    }
    if (!finalTimestamp) {
      finalTimestamp = new Date();
    }

    const analysisPrompt = `You are a DevOps engineer analyzing a log error from a Docker container.

Application: ${app.name} (${app.slug})
Container: ${app.container_name}

Error Log Line:
${errorLog}

Context (surrounding log lines):
${fullContext}

IMPORTANT: You must provide TWO separate, detailed responses:

1. "summary" field: Explain WHY this error is occurring. Include:
   - Root cause analysis
   - What conditions led to this error
   - What the error means in context
   - Technical details about the failure
   - DO NOT include fix instructions here

2. "fix" field: Provide a step-by-step solution on HOW TO FIX this error. Include:
   - Specific actionable steps
   - Code changes or configuration updates if needed
   - Commands to run if applicable
   - Verification steps
   - Be detailed and specific - do NOT say "see summary above"

Format your response as valid JSON with exactly these two fields: "summary" and "fix".
Both fields must be substantial (at least 2-3 sentences each).`;

    try {
      // Call Claude API
      const response = await this.client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: analysisPrompt
          }
        ],
      });

      let content = response.content[0].type === 'text' ? response.content[0].text : '{}';

      // Clean up the response
      content = content.trim();
      if (content.startsWith('```json')) {
        content = content.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (content.startsWith('```')) {
        content = content.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      let analysis;
      try {
        analysis = JSON.parse(content);
      } catch (parseError) {
        console.warn('Failed to parse JSON response:', parseError);
        const summaryMatch = content.match(/"summary"\s*:\s*"([^"]+)"/i) ||
                           content.match(/summary["\s:]+([^"}\n]+)/i);
        const fixMatch = content.match(/"fix"\s*:\s*"([^"]+)"/i) ||
                        content.match(/fix["\s:]+([^"}\n]+)/i);

        analysis = {
          summary: summaryMatch ? summaryMatch[1] : content.split('\n')[0] || 'Unable to parse summary',
          fix: fixMatch ? fixMatch[1] : (content.split('\n').slice(1).join('\n') || 'Unable to parse fix.')
        };
      }

      if (!analysis.summary || analysis.summary.trim().length < 10) {
        analysis.summary = 'Error analysis: This error requires investigation. Review the error log and context above.';
      }

      if (!analysis.fix || analysis.fix.trim().length < 10 ||
          analysis.fix.toLowerCase().includes('see summary') ||
          analysis.fix.toLowerCase().includes('see above')) {
        analysis.fix = 'To fix this error:\n1. Review the error message and context\n2. Check application logs for related errors\n3. Verify configuration and dependencies\n4. Check system resources\n5. Review recent changes\n6. Consult application documentation';
      }

      const errorHash = createErrorHash(errorLog);
      const existingGroupAnalyses = db.getLogAnalysesByHashAndGroup(errorHash, app.slug);

      if (existingGroupAnalyses.length > 0) {
        const representative = existingGroupAnalyses[existingGroupAnalyses.length - 1];
        const totalOccurrences = existingGroupAnalyses.reduce((sum, a) => sum + (a.occurrence_count || 1), 0) + 1;

        const TIME_WINDOW_MS = 20 * 1000;
        const lastOccurrenceTime = representative.last_occurrence_time
          ? new Date(representative.last_occurrence_time)
          : (representative.error_timestamp
            ? new Date(representative.error_timestamp)
            : new Date(representative.analyzed_at || 0));
        const timeSinceLast = Math.abs(finalTimestamp.getTime() - lastOccurrenceTime.getTime());
        const isBurst = timeSinceLast <= TIME_WINDOW_MS;

        const firstOccurrence = representative.first_occurrence_time
          ? new Date(representative.first_occurrence_time)
          : (representative.error_timestamp
            ? new Date(representative.error_timestamp)
            : new Date(representative.analyzed_at || 0));

        db.updateLogAnalysisRepresentative(
          representative.id!,
          finalTimestamp,
          totalOccurrences,
          firstOccurrence,
          isBurst ? (representative.burst_count || 0) + 1 : (representative.burst_count || 0)
        );

        if (existingGroupAnalyses.length > 1) {
          const idsToDelete = existingGroupAnalyses
            .filter(a => a.id !== representative.id)
            .map(a => a.id!);
          if (idsToDelete.length > 0) {
            db.deleteLogAnalyses(idsToDelete);
          }
        }

        return db.getLogAnalysisById(representative.id!);
      }

      const groupId = db.getOrCreateErrorGroup(errorHash, app.slug);
      const errorName = generateErrorName(errorLog, app.name);

      const logAnalysis: LogAnalysis = {
        app_id: app.id!,
        app_slug: app.slug,
        error_log: errorLog,
        error_name: errorName,
        context_before: contextBefore,
        context_after: contextAfter,
        analysis_summary: analysis.summary,
        analysis_fix: analysis.fix,
        is_real_issue: 0,
        error_hash: errorHash,
        group_id: groupId,
        occurrence_count: 1,
        error_timestamp: finalTimestamp,
        first_occurrence_time: finalTimestamp,
        last_occurrence_time: finalTimestamp,
        burst_count: 0
      };

      const result = db.saveLogAnalysis(logAnalysis);
      return result;
    } catch (error: any) {
      console.error('Error calling Claude API:', error);
      throw error;
    }
  }

  /**
   * Batch analyze multiple error logs
   */
  async analyzeMultiple(appSlug: string, errorLogs: string[]): Promise<LogAnalysis[]> {
    const results: LogAnalysis[] = [];
    for (const errorLog of errorLogs) {
      try {
        const analysis = await this.analyzeErrorLog(appSlug, errorLog);
        results.push(analysis);
      } catch (error) {
        console.error(`Failed to analyze error log: ${errorLog}`, error);
      }
    }
    return results;
  }

  /**
   * Get analysis for an error (from cache or analyze if new)
   */
  async getOrAnalyzeError(appSlug: string, errorLog: string): Promise<LogAnalysis | null> {
    const errorHash = createErrorHash(errorLog);
    const app = await db.getAppBySlug(appSlug);

    if (!app) {
      throw new Error('App not found');
    }

    const existing = db.getLogAnalysisByHash(errorHash, appSlug);
    if (existing) {
      return existing;
    }

    return await this.analyzeErrorLog(appSlug, errorLog);
  }
}

export const logGuruService = new LogGuruService();
