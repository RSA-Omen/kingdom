import { db } from '../src/models/database';
import { createHash } from 'crypto';

// Recreate the hash function (same as in logGuru.ts)
function createErrorHash(errorLog: string): string {
  const lowerLog = errorLog.toLowerCase();
  
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
      if (['302', '301', '307', '308'].includes(statusCode)) {
        errorType = `http_redirect_${statusCode}`;
        normalized = `http_redirect_${statusCode}`;
      } else if (['400', '401', '403', '404', '500', '502', '503', '504'].includes(statusCode)) {
        errorType = `http_error_${statusCode}`;
        normalized = `http_error_${statusCode}`;
      }
    }
  }
  
  // Auth redirect warnings should be grouped with 302 redirects
  if (errorType === 'auth_redirect_warning') {
    errorType = 'http_redirect_302';
  }
  
  if (errorType) {
    return createHash('sha256').update(errorType).digest('hex').substring(0, 16);
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
  
  const hashInput = errorKeywords.length > 0 ? errorKeywords.join('_') : normalized;
  return createHash('sha256').update(hashInput).digest('hex').substring(0, 16);
}

console.log('Re-hashing and re-grouping log analyses...\n');

// Get all analyses
const allAnalyses = db.getLogAnalyses();

// Re-hash all entries
const updates: Array<{ id: number; newHash: string; appSlug: string }> = [];

allAnalyses.forEach((a: any) => {
  const newHash = createErrorHash(a.error_log);
  if (a.error_hash !== newHash) {
    updates.push({ id: a.id, newHash, appSlug: a.app_slug });
  }
});

console.log(`Found ${updates.length} entries that need re-hashing\n`);

// Update hashes
updates.forEach(update => {
  const stmt = db.getDb().prepare('UPDATE log_analyses SET error_hash = ? WHERE id = ?');
  stmt.run(update.newHash, update.id);
});

console.log(`Updated ${updates.length} hashes\n`);

// Now re-group: same hash + same app = same group
// First, fetch all analyses again to get updated hashes
const updatedAnalyses = db.getLogAnalyses();

const hashToGroupId = new Map<string, number>();
let nextGroupId = 1;

// Get max group_id
const maxGroup = db.getDb().prepare('SELECT MAX(group_id) as max_id FROM log_analyses').get() as any;
nextGroupId = (maxGroup?.max_id || 0) + 1;

// Group by (hash, app_slug) - entries with same hash+app should have same group_id
updatedAnalyses.forEach((a: any) => {
  const hash = a.error_hash || createErrorHash(a.error_log);
  const key = `${hash}_${a.app_slug}`;
  
  if (!hashToGroupId.has(key)) {
    hashToGroupId.set(key, nextGroupId++);
  }
  
  const newGroupId = hashToGroupId.get(key)!;
  if (a.group_id !== newGroupId) {
    const stmt = db.getDb().prepare('UPDATE log_analyses SET group_id = ? WHERE id = ?');
    stmt.run(newGroupId, a.id);
  }
});

console.log(`Re-grouped entries into ${hashToGroupId.size} groups\n`);

// Now consolidate duplicates (use updated analyses with new group IDs)
const byHashAndApp = new Map<string, any[]>();
const finalAnalyses = db.getLogAnalyses(); // Fetch again after re-grouping

finalAnalyses.forEach((a: any) => {
  const hash = a.error_hash || createErrorHash(a.error_log);
  const key = `${hash}_${a.app_slug}`;
  if (!byHashAndApp.has(key)) {
    byHashAndApp.set(key, []);
  }
  byHashAndApp.get(key)!.push(a);
});

let consolidated = 0;
let deleted = 0;

byHashAndApp.forEach((entries, key) => {
  if (entries.length > 1) {
    // Sort by timestamp (oldest first)
    entries.sort((a, b) => {
      const aTime = a.error_timestamp ? new Date(a.error_timestamp).getTime() : new Date(a.analyzed_at || 0).getTime();
      const bTime = b.error_timestamp ? new Date(b.error_timestamp).getTime() : new Date(b.analyzed_at || 0).getTime();
      return aTime - bTime;
    });
    
    const representative = entries[0];
    const duplicates = entries.slice(1);
    
    const totalOccurrences = entries.reduce((sum, e) => sum + (e.occurrence_count || 1), 0);
    const timestamps = entries
      .map(e => e.error_timestamp ? new Date(e.error_timestamp) : new Date(e.analyzed_at || 0))
      .filter(d => !isNaN(d.getTime()));
    const firstOccurrence = timestamps.length > 0 ? new Date(Math.min(...timestamps.map(d => d.getTime()))) : new Date();
    const lastOccurrence = timestamps.length > 0 ? new Date(Math.max(...timestamps.map(d => d.getTime()))) : new Date();
    
    // Update representative
    const updateStmt = db.getDb().prepare(`
      UPDATE log_analyses 
      SET occurrence_count = ?,
          first_occurrence_time = ?,
          last_occurrence_time = ?,
          error_timestamp = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    updateStmt.run(
      totalOccurrences,
      firstOccurrence.toISOString(),
      lastOccurrence.toISOString(),
      lastOccurrence.toISOString(),
      representative.id
    );
    
    // Delete duplicates
    const idsToDelete = duplicates.map(e => e.id!);
    const deleteStmt = db.getDb().prepare(`DELETE FROM log_analyses WHERE id IN (${idsToDelete.map(() => '?').join(',')})`);
    deleteStmt.run(...idsToDelete);
    
    consolidated++;
    deleted += duplicates.length;
    
    console.log(`Consolidated ${entries.length} entries (hash: ${representative.error_hash?.substring(0, 8)}, app: ${representative.app_slug}):`);
    console.log(`  Kept entry ${representative.id}, deleted ${duplicates.length} duplicates`);
    console.log(`  Total occurrences: ${totalOccurrences}`);
  }
});

console.log(`\n=== Summary ===`);
console.log(`Groups consolidated: ${consolidated}`);
console.log(`Duplicate entries deleted: ${deleted}`);
console.log('\nRe-hashing and consolidation complete!');

process.exit(0);

