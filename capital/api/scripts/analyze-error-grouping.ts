import { db } from '../src/models/database';
import { createHash } from 'crypto';

const analyses = db.getLogAnalyses();

console.log('\n=== Analyzing Error Grouping ===\n');

// Group by app and check hash patterns
const byApp = new Map<string, any[]>();

analyses.forEach((a: any) => {
  const appSlug = a.app_slug || 'unknown';
  if (!byApp.has(appSlug)) {
    byApp.set(appSlug, []);
  }
  byApp.get(appSlug)!.push(a);
});

byApp.forEach((entries, appSlug) => {
  console.log(`\n${appSlug}:`);
  
  // Show 302-related errors
  const redirectErrors = entries.filter((e: any) => 
    e.error_log && (e.error_log.includes('302') || e.error_log.toLowerCase().includes('redirect'))
  );
  
  if (redirectErrors.length > 0) {
    console.log(`  Found ${redirectErrors.length} redirect-related errors:`);
    redirectErrors.forEach((e: any, idx: number) => {
      console.log(`    [${idx + 1}] Group ${e.group_id}, Hash: ${(e.error_hash || 'none').substring(0, 8)}`);
      console.log(`        Occurrences: ${e.occurrence_count || 1}`);
      console.log(`        Error: ${e.error_log.substring(0, 150)}...`);
      console.log('');
    });
    
    // Check if they should be grouped together
    const uniqueHashes = new Set(redirectErrors.map((e: any) => e.error_hash));
    const uniqueGroups = new Set(redirectErrors.map((e: any) => e.group_id));
    console.log(`    Analysis: ${redirectErrors.length} redirect errors, ${uniqueHashes.size} unique hashes, ${uniqueGroups.size} unique groups`);
    if (uniqueGroups.size > 1) {
      console.log(`    ⚠️  WARNING: These should probably be in the same group (they're all 302 redirects)`);
    }
  }
});

process.exit(0);

