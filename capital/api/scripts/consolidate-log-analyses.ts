import { db } from '../src/models/database';

console.log('Consolidating duplicate log analysis entries...\n');

// Get all analyses grouped by hash and app
const allAnalyses = db.getLogAnalyses();

// Group by (error_hash, app_slug)
const groups = new Map<string, any[]>();

allAnalyses.forEach((a: any) => {
  const hash = a.error_hash || 'unknown';
  const key = `${hash}_${a.app_slug}`;
  if (!groups.has(key)) {
    groups.set(key, []);
  }
  groups.get(key)!.push(a);
});

let consolidatedCount = 0;
let deletedCount = 0;

// Process each group
groups.forEach((entries, key) => {
  if (entries.length > 1) {
    // Multiple entries for same error - consolidate
    // Keep the oldest entry (first occurrence)
    entries.sort((a, b) => {
      const aTime = a.error_timestamp ? new Date(a.error_timestamp).getTime() : new Date(a.analyzed_at || 0).getTime();
      const bTime = b.error_timestamp ? new Date(b.error_timestamp).getTime() : new Date(b.analyzed_at || 0).getTime();
      return aTime - bTime;
    });
    
    const representative = entries[0]; // Oldest
    const duplicates = entries.slice(1);
    
    // Calculate total occurrences
    const totalOccurrences = entries.reduce((sum, e) => sum + (e.occurrence_count || 1), 0);
    
    // Get most recent timestamp
    const timestamps = entries
      .map(e => e.error_timestamp ? new Date(e.error_timestamp) : new Date(e.analyzed_at || 0))
      .filter(d => !isNaN(d.getTime()));
    const latestTimestamp = timestamps.length > 0 
      ? new Date(Math.max(...timestamps.map(d => d.getTime())))
      : new Date();
    
    // Update representative
    db.updateLogAnalysisRepresentative(
      representative.id!,
      latestTimestamp,
      totalOccurrences
    );
    
    // Delete duplicates
    const idsToDelete = duplicates.map(e => e.id!);
    db.deleteLogAnalyses(idsToDelete);
    
    consolidatedCount++;
    deletedCount += duplicates.length;
    
    console.log(`Consolidated ${entries.length} entries for ${representative.app_slug} (${representative.error_name || 'unnamed'}):`);
    console.log(`  Kept entry ${representative.id}, deleted ${duplicates.length} duplicates`);
    console.log(`  Total occurrences: ${totalOccurrences}`);
  }
});

console.log(`\n=== Summary ===`);
console.log(`Groups consolidated: ${consolidatedCount}`);
console.log(`Duplicate entries deleted: ${deletedCount}`);
console.log('\nConsolidation complete!');

process.exit(0);


