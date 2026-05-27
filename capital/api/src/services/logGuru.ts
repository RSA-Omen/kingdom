import { db } from '../models/database';
import { dockerService } from './docker';
import axios from 'axios';
import { createHash } from 'crypto';

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
  is_real_issue: number; // 0 = unknown, 1 = real issue, 2 = false positive
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
  // Try to extract meaningful information from the error
  const lowerLog = errorLog.toLowerCase();
  
  // Common patterns to extract
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
  
  // Fallback: use first meaningful words from error
  const words = errorLog.split(/\s+/).filter(w => w.length > 3).slice(0, 3);
  const fallback = words.length > 0 ? words.join(' ') : 'Error';
  return appName ? `${appName} → ${fallback}` : fallback;
}

/**
 * Create a hash/fingerprint of an error log for grouping duplicates
 * Normalizes the error by removing timestamps, IDs, and other variable data
 * Groups similar errors together (e.g., all 302 redirects together, regardless of endpoint)
 */
function createErrorHash(errorLog: string): string {
  const lowerLog = errorLog.toLowerCase();
  
  // First, identify the error TYPE/CLASS - this is the primary grouping factor
  // For HTTP errors, group by status code only (not specific endpoint)
  // For application errors, group by error type/pattern
  
  let errorType = '';
  let normalized = lowerLog;
  
  // Check for authentication redirect warnings first (these are related to 302 redirects)
  if (lowerLog.includes('user not authenticated') && lowerLog.includes('redirecting to login')) {
    errorType = 'auth_redirect_warning';
    normalized = 'auth_redirect_warning';
  }
  // Extract and normalize HTTP status codes - GROUP BY STATUS CODE ONLY
  else {
    // Try multiple patterns to catch different log formats
    let statusCode: string | null = null;
    
    // Pattern 1: "HTTP/1.1" 302
    const pattern1 = lowerLog.match(/"\s+(\d{3})(\s|$)/);
    if (pattern1) {
      statusCode = pattern1[1];
    }
    
    // Pattern 2: 302 redirect/found/moved
    if (!statusCode) {
      const pattern2 = lowerLog.match(/\b(302|301|307|308)\s+(redirect|found|moved|permanent|temporary|see other)/i);
      if (pattern2) {
        statusCode = pattern2[1];
      }
    }
    
    // Pattern 3: Just "302" as a standalone number in HTTP context
    if (!statusCode && lowerLog.includes('302') && (lowerLog.includes('http') || lowerLog.includes('get') || lowerLog.includes('post'))) {
      statusCode = '302';
    }
    
    if (statusCode) {
      // For redirects and HTTP errors, group by status code only (ignore endpoint)
      if (['302', '301', '307', '308'].includes(statusCode)) {
        errorType = `http_redirect_${statusCode}`;
        // For redirects, normalize to just status code - ignore path, IP, etc.
        normalized = `http_redirect_${statusCode}`;
      } else if (['400', '401', '403', '404', '500', '502', '503', '504'].includes(statusCode)) {
        errorType = `http_error_${statusCode}`;
        normalized = `http_error_${statusCode}`;
      }
    }
  }
  
  // If we have an error type, use it directly for grouping
  // BUT: Auth redirect warnings should be grouped with 302 redirects (they're the same issue)
  if (errorType === 'auth_redirect_warning') {
    // Group auth warnings with 302 redirects - same root cause
    errorType = 'http_redirect_302';
  }
  
  if (errorType) {
    return createHash('sha256').update(errorType).digest('hex').substring(0, 16);
  }
  
  // For non-HTTP errors, normalize more carefully
  normalized = normalized
    // Remove timestamps (various formats)
    .replace(/\d{4}-\d{2}-\d{2}[t ]\d{2}:\d{2}:\d{2}[.\d]*[z]?/g, '')
    .replace(/\[\d{2}\/\w{3}\/\d{4}:\d{2}:\d{2}:\d{2}[^\]]*\]/g, '')
    // Remove UUIDs
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '')
    // Remove numeric IDs (standalone numbers)
    .replace(/\b\d{5,}\b/g, '')
    // Remove IP addresses
    .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '')
    // For authentication-related warnings, normalize to pattern
    .replace(/user not authenticated.*redirecting to login/gi, 'auth_redirect_warning')
    .replace(/redirecting to login/gi, 'auth_redirect')
    // Normalize HTTP paths to patterns (but only if not already handled above)
    .replace(/(get|post|put|delete|patch)\s+\/api\/[^\s]+/gi, '$1 /api/path')
    // Normalize worker/process IDs
    .replace(/worker\s+\(pid:\d+\)/gi, 'worker (pid:id)')
    .replace(/pid:\d+/gi, 'pid:id')
    // Remove file paths
    .replace(/\/[^\s:]+/g, (match) => {
      const parts = match.split('/');
      return parts[parts.length - 1] || match;
    })
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 300);

  // Extract key error keywords for grouping similar errors
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
  
  // Use keywords if found, otherwise use normalized text
  const hashInput = errorKeywords.length > 0 
    ? errorKeywords.join('_')
    : normalized;

  return createHash('sha256').update(hashInput).digest('hex').substring(0, 16);
}

// Helper function to detect if a log line is "bad" (error, warning, failure, etc.)
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
    /\b4\d{2}\b/, // HTTP 4xx errors
    /\b5\d{2}\b/, // HTTP 5xx errors
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
  /**
   * Analyze a single error log with Groq AI
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

    // Get more context around the error for better analysis
    const lines = contextLines + 20; // Get extra lines for context
    const logEntries = await dockerService.getContainerLogs(app.container_name, { lines, withTimestamps: true }) as Array<{ line: string; timestamp: Date }>;
    
    // Convert log entries to strings for context extraction
    const logs = logEntries.map(entry => entry.line);
    const timestamps = logEntries.map(entry => entry.timestamp);
    
    // Find the error log in the full log set and get surrounding context
    const errorIndex = logs.findIndex((log: string) => log.includes(errorLog.trim()));
    const startIndex = Math.max(0, errorIndex - contextLines);
    const endIndex = Math.min(logs.length, errorIndex + contextLines);
    
    const contextBefore = logs.slice(startIndex, errorIndex).join('\n');
    const contextAfter = logs.slice(errorIndex + 1, endIndex).join('\n');
    const fullContext = logs.slice(startIndex, endIndex).join('\n');
    
    // Use provided timestamp or extract from log entry
    let finalTimestamp = errorTimestamp;
    if (!finalTimestamp && errorIndex >= 0 && errorIndex < timestamps.length) {
      finalTimestamp = timestamps[errorIndex];
    }
    if (!finalTimestamp) {
      finalTimestamp = new Date();
    }

    // Use Groq API to analyze the error
    const groqApiKey = process.env.GROQ_API_KEY;
    if (!groqApiKey) {
      throw new Error('Groq API key not configured. Please set GROQ_API_KEY environment variable.');
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
      // Call Groq API
      const response = await axios.post(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          model: 'llama-3.3-70b-versatile',
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
      let content = data.choices[0]?.message?.content || '{}';
      
      // Clean up the response - sometimes JSON is wrapped in markdown code blocks
      content = content.trim();
      if (content.startsWith('```json')) {
        content = content.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (content.startsWith('```')) {
        content = content.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      // Try to parse JSON response
      let analysis;
      try {
        analysis = JSON.parse(content);
      } catch (parseError) {
        console.warn('Failed to parse JSON response, attempting to extract fields:', parseError);
        // Try to extract summary and fix from text if JSON parsing fails
        const summaryMatch = content.match(/"summary"\s*:\s*"([^"]+)"/i) || 
                           content.match(/summary["\s:]+([^"}\n]+)/i);
        const fixMatch = content.match(/"fix"\s*:\s*"([^"]+)"/i) || 
                        content.match(/fix["\s:]+([^"}\n]+)/i);
        
        analysis = {
          summary: summaryMatch ? summaryMatch[1] : content.split('\n')[0] || 'Unable to parse summary',
          fix: fixMatch ? fixMatch[1] : (content.split('\n').slice(1).join('\n') || 'Unable to parse fix. Please review the error log and context manually.')
        };
      }

      // Ensure we have the expected structure with meaningful content
      if (!analysis.summary || analysis.summary.trim().length < 10) {
        analysis.summary = analysis.explanation || analysis.reason || 
                          'Error analysis: This error requires investigation. Review the error log and context above.';
      }
      
      if (!analysis.fix || analysis.fix.trim().length < 10 || 
          analysis.fix.toLowerCase().includes('see summary') ||
          analysis.fix.toLowerCase().includes('see above')) {
        // If fix is missing or generic, try to generate a better one
        analysis.fix = analysis.solution || analysis.steps || 
                      'To fix this error:\n1. Review the error message and context above\n2. Check application logs for related errors\n3. Verify configuration and dependencies\n4. Check system resources (memory, disk, network)\n5. Review recent changes to the application or infrastructure\n6. Consult application documentation or support resources';
      }

      // Create error hash for grouping
      const errorHash = createErrorHash(errorLog);
      
      // Check if we already have this error analyzed (same hash = same problem, regardless of time)
      // Get all existing entries for this error hash
      const existingGroupAnalyses = db.getLogAnalysesByHashAndGroup(errorHash, app.slug);
      
      if (existingGroupAnalyses.length > 0) {
        // Same error pattern exists - consolidate to ONE entry per group
        // Use the oldest entry as the "representative" (keeps original analysis and first occurrence time)
        const representative = existingGroupAnalyses[existingGroupAnalyses.length - 1]; // Oldest entry
        
        // Calculate total occurrences from all existing entries plus this new one
        const totalOccurrences = existingGroupAnalyses.reduce((sum, a) => sum + (a.occurrence_count || 1), 0) + 1;
        
        // Determine if this is a burst (within 20 seconds of last occurrence)
        const TIME_WINDOW_MS = 20 * 1000;
        const lastOccurrenceTime = representative.last_occurrence_time
          ? new Date(representative.last_occurrence_time)
          : (representative.error_timestamp 
            ? new Date(representative.error_timestamp)
            : new Date(representative.analyzed_at || 0));
        const timeSinceLast = Math.abs(finalTimestamp.getTime() - lastOccurrenceTime.getTime());
        const isBurst = timeSinceLast <= TIME_WINDOW_MS;
        
        // Get first occurrence time (preserve original first occurrence)
        const firstOccurrence = representative.first_occurrence_time
          ? new Date(representative.first_occurrence_time)
          : (representative.error_timestamp 
            ? new Date(representative.error_timestamp)
            : new Date(representative.analyzed_at || 0));
        
        // Update the representative entry:
        // - Update timestamp to most recent occurrence (so we know when it last happened)
        // - Update occurrence count to total
        // - Track first and last occurrence times
        // - Increment burst count if this is a burst
        db.updateLogAnalysisRepresentative(
          representative.id!,
          finalTimestamp, // Most recent timestamp (last_occurrence_time)
          totalOccurrences,
          firstOccurrence, // First occurrence time
          isBurst ? (representative.burst_count || 0) + 1 : (representative.burst_count || 0)
        );
        
        // If there are duplicate entries, delete them (keep only the representative)
        if (existingGroupAnalyses.length > 1) {
          const idsToDelete = existingGroupAnalyses
            .filter(a => a.id !== representative.id)
            .map(a => a.id!);
          if (idsToDelete.length > 0) {
            db.deleteLogAnalyses(idsToDelete);
          }
        }
        
        // Return the updated representative
        return db.getLogAnalysisById(representative.id!);
      }
      
      // New error pattern - create new group and entry
      const groupId = db.getOrCreateErrorGroup(errorHash, app.slug);
      
      // Generate a descriptive name for the error
      const errorName = generateErrorName(errorLog, app.name);
      
      // Save analysis to database (new error pattern)
      const logAnalysis: LogAnalysis = {
        app_id: app.id!,
        app_slug: app.slug,
        error_log: errorLog,
        error_name: errorName,
        context_before: contextBefore,
        context_after: contextAfter,
        analysis_summary: analysis.summary,
        analysis_fix: analysis.fix,
        is_real_issue: 0, // Unknown by default
        error_hash: errorHash,
        group_id: groupId,
        occurrence_count: 1,
        error_timestamp: finalTimestamp,
        first_occurrence_time: finalTimestamp,
        last_occurrence_time: finalTimestamp,
        burst_count: 0,
      };

      return db.saveLogAnalysis(logAnalysis);
    } catch (aiError: any) {
      console.error('Error calling Groq API:', aiError);
      throw new Error(`Failed to analyze error with AI: ${aiError.response?.data?.error?.message || aiError.message}`);
    }
  }

  /**
   * Generate actionable fixes for an error using AI
   * Includes code changes, configuration updates, and step-by-step instructions
   */
  async generateFix(analysisId: number): Promise<{
    analysis: any;
    app: any;
    fixes: Array<{
      type: 'code' | 'config' | 'command' | 'documentation';
      title: string;
      description: string;
      file?: string;
      code?: string;
      language?: string;
      steps: string[];
      verification?: string;
    }>;
    explanation: string;
  }> {
    // Get the analysis
    const analysis = db.getLogAnalysisById(analysisId);
    if (!analysis) {
      throw new Error(`Analysis ${analysisId} not found`);
    }

    // Get app info
    const app = db.getAppBySlug(analysis.app_slug);
    if (!app) {
      throw new Error(`App ${analysis.app_slug} not found`);
    }

    // Build context for AI
    const errorContext = `
Error Log:
${analysis.error_log}

Error Summary:
${analysis.analysis_summary || 'No summary available'}

Current Fix Suggestion:
${analysis.analysis_fix || 'No fix suggestion available'}

Application: ${app.name} (${app.slug})
Container: ${app.container_name || 'N/A'}
Project Type: ${app.project_type || 'Unknown'}
Repository: ${app.repository_url || 'N/A'}
    `.trim();

    // Call Groq API for fix generation
    const groqApiKey = process.env.GROQ_API_KEY;
    if (!groqApiKey) {
      throw new Error('GROQ_API_KEY not configured');
    }

    const fixPrompt = `You are an expert DevOps engineer helping to fix a production error. Based on the error details below, generate ACTUAL, ACTIONABLE fixes.

${errorContext}

You must respond with valid JSON only (no markdown, no code blocks, no explanatory text). Use this exact structure:

{
  "explanation": "Brief overview of the root cause and approach to fix",
  "fixes": [
    {
      "type": "code",
      "title": "Short descriptive title",
      "description": "What this fix does and why",
      "file": "path/to/file",
      "code": "Actual code changes",
      "language": "javascript",
      "steps": ["Step 1: Specific actionable instruction", "Step 2: Next specific action"],
      "verification": "How to verify this fix works"
    }
  ]
}

IMPORTANT GUIDELINES:
1. Provide ACTUAL code changes, not just descriptions
2. Include specific file paths when applicable
3. For configuration changes, provide the exact config snippets
4. For code changes, show before/after or the complete fixed code block
5. Break down fixes into clear, actionable steps
6. Include verification steps to confirm the fix works
7. Consider the application type (${app.project_type || 'general'}) when suggesting fixes
8. If multiple fixes are needed, provide them all in priority order

Be specific, practical, and ready-to-implement. 

CRITICAL: Your response must be valid JSON only. Do not include any markdown formatting, code blocks, or explanatory text. Start with { and end with }.`;

    try {
      const response = await axios.post(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          model: 'llama-3.3-70b-versatile',
          messages: [
            {
              role: 'system',
              content: 'You are an expert DevOps engineer specializing in fixing production errors. Always provide specific, actionable fixes with actual code when possible.'
            },
            {
              role: 'user',
              content: fixPrompt
            }
          ],
          temperature: 0.3,
          max_tokens: 4096
          // Note: response_format not supported by all Groq models - we'll parse JSON from response
        },
        {
          headers: {
            'Authorization': `Bearer ${groqApiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const aiResponse = response.data.choices[0].message.content;
      let fixData;
      
      try {
        fixData = JSON.parse(aiResponse);
      } catch (parseError) {
        // Try to extract JSON from markdown code blocks
        const jsonMatch = aiResponse.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
        if (jsonMatch) {
          fixData = JSON.parse(jsonMatch[1]);
        } else {
          throw new Error('Failed to parse AI response as JSON');
        }
      }

      // Ensure fixes array exists
      if (!fixData.fixes || !Array.isArray(fixData.fixes)) {
        fixData.fixes = [];
      }

      // Ensure explanation exists
      if (!fixData.explanation) {
        fixData.explanation = 'AI-generated fix suggestions';
      }

      return {
        analysis,
        app,
        fixes: fixData.fixes,
        explanation: fixData.explanation
      };
    } catch (aiError: any) {
      console.error('Error calling Groq API for fix generation:', aiError);
      if (aiError.response?.data) {
        console.error('Full error response:', JSON.stringify(aiError.response.data, null, 2));
      }
      
      // Provide more detailed error message
      const errorMessage = aiError.response?.data?.error?.message || aiError.message;
      const errorDetails = aiError.response?.data?.error?.details || '';
      const errorCode = aiError.response?.data?.error?.code || '';
      
      // If it's a JSON generation error, provide helpful message
      if (errorMessage?.includes('JSON') || errorCode === 'failed_generation') {
        throw new Error(`AI model failed to generate valid JSON response. This may be due to prompt complexity or model limitations. Please try again or simplify the error context. Error: ${errorMessage}`);
      }
      
      throw new Error(`Failed to generate fixes with AI: ${errorMessage}${errorDetails ? `. Details: ${errorDetails}` : ''}`);
    }
  }

  /**
   * Automatically scan logs for errors and analyze them
   */
  async scanAndAnalyzeLogs(appSlug: string, lines: number = 200): Promise<LogAnalysis[]> {
    const app = await db.getAppBySlug(appSlug);
    if (!app || !app.container_name) {
      throw new Error('App or container not found');
    }

    // Get recent logs with timestamps
    const logEntries = await dockerService.getContainerLogs(app.container_name, { lines, withTimestamps: true }) as Array<{ line: string; timestamp: Date }>;
    
    // Find all error lines with their timestamps
    const errorEntries: Array<{ line: string; timestamp: Date }> = [];
    
    for (const entry of logEntries) {
      if (isErrorLog(entry.line)) {
        errorEntries.push({ line: entry.line, timestamp: entry.timestamp });
      }
    }

    // Group errors by hash only (same error pattern = same problem, regardless of time)
    const errorGroups = new Map<string, Array<{ line: string; timestamp: Date }>>();
    
    for (const entry of errorEntries) {
      const errorHash = createErrorHash(entry.line);
      
      if (!errorGroups.has(errorHash)) {
        errorGroups.set(errorHash, []);
      }
      
      // Always add to the same group if it's the same hash (same error pattern)
      errorGroups.get(errorHash)!.push(entry);
    }

    // Check which errors we've already analyzed (by hash only - same error = same problem)
    const existingAnalyses = await db.getLogAnalysesByApp(appSlug);
    const existingHashes = new Set<string>();
    existingAnalyses.forEach(a => {
      const hash = a.error_hash || createErrorHash(a.error_log);
      existingHashes.add(hash);
    });

    // Find errors that need to be processed
    // Strategy: Same error pattern = always same group, regardless of time
    // Track when errors happen within 20 seconds to identify bursts
    const newErrors: Array<{ line: string; timestamp: Date; hash: string }> = [];
    const TIME_WINDOW_MS = 20 * 1000; // 20 seconds for burst detection
    
    for (const [hash, entries] of errorGroups.entries()) {
      // Sort entries by timestamp (oldest first)
      entries.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      
      if (!existingHashes.has(hash)) {
        // New error pattern - analyze using the first occurrence (oldest)
        // This gives us the full context from when it first happened
        const firstEntry = entries[0];
        newErrors.push({ ...firstEntry, hash });
      } else {
        // Existing error pattern - check if we have new occurrences
        const existingGroupAnalyses = db.getLogAnalysesByHashAndGroup(hash, appSlug);
        
        if (existingGroupAnalyses.length > 0) {
          // Get the representative entry (oldest one, which we keep)
          const representative = existingGroupAnalyses[existingGroupAnalyses.length - 1]; // Oldest (representative)
          const lastKnownTimestamp = representative.last_occurrence_time 
            ? new Date(representative.last_occurrence_time)
            : (representative.error_timestamp ? new Date(representative.error_timestamp) : new Date(representative.analyzed_at || 0));
          
          // Find entries that occurred after the last known occurrence
          const newEntries = entries.filter(e => 
            e.timestamp.getTime() > lastKnownTimestamp.getTime()
          );
          
          if (newEntries.length > 0) {
            // We have new occurrences - process them to update the group
            // Use the most recent new occurrence to update the representative
            newEntries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
            const latestNewEntry = newEntries[0];
            
            // Count how many new occurrences are bursts (within 20 seconds of each other)
            let burstCount = 0;
            for (let i = 0; i < newEntries.length; i++) {
              if (i === 0 || (newEntries[i].timestamp.getTime() - newEntries[i-1].timestamp.getTime() <= TIME_WINDOW_MS)) {
                burstCount++;
              }
            }
            
            // Update the existing entry (will be handled in analyzeErrorLog)
            newErrors.push({ ...latestNewEntry, hash });
          }
        }
      }
    }

    // Analyze new errors (limit to 5 at a time to avoid rate limits)
    const analyses: LogAnalysis[] = [];
    for (const errorEntry of newErrors.slice(0, 5)) {
      try {
        const analysis = await this.analyzeErrorLog(appSlug, errorEntry.line, 10, errorEntry.timestamp);
        analyses.push(analysis);
        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error: any) {
        console.error(`Failed to analyze error: ${errorEntry.line.substring(0, 100)}`, error.message);
      }
    }

    return analyses;
  }

  /**
   * Get all analyses for an app
   */
  async getAnalyses(appSlug?: string, isRealIssue?: number, grouped: boolean = false): Promise<LogAnalysis[]> {
    // If explicitly filtering for false positives (isRealIssue === 2), don't exclude them
    const excludeFalsePositives = isRealIssue !== 2;
    
    if (grouped) {
      return db.getGroupedAnalyses(appSlug, excludeFalsePositives);
    }
    return db.getLogAnalyses(appSlug, isRealIssue, excludeFalsePositives);
  }

  /**
   * Mark an analysis as real issue or false positive
   */
  async markAnalysis(analysisId: number, isRealIssue: number, userNotes?: string, errorName?: string): Promise<LogAnalysis> {
    return db.updateLogAnalysis(analysisId, { is_real_issue: isRealIssue, user_notes: userNotes, error_name: errorName });
  }

  /**
   * Mark an entire group of errors as real issue or false positive
   */
  async markGroup(groupId: number, isRealIssue: number, userNotes?: string, errorName?: string): Promise<void> {
    db.markGroupAnalysis(groupId, isRealIssue, userNotes, errorName);
  }
}

export const logGuruService = new LogGuruService();

