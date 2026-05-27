import { db } from '../src/models/database';

const analyses = db.getLogAnalyses();

console.log('\n=== Current Log Analyses ===\n');
console.log(`Total analyses: ${analyses.length}\n`);

// Group by app and group_id
const byAppAndGroup = new Map<string, Map<number, any[]>>();

analyses.forEach((a: any) => {
  const key = `${a.app_slug || 'unknown'}`;
  if (!byAppAndGroup.has(key)) {
    byAppAndGroup.set(key, new Map());
  }
  const appMap = byAppAndGroup.get(key)!;
  const groupId = a.group_id || 0;
  if (!appMap.has(groupId)) {
    appMap.set(groupId, []);
  }
  appMap.get(groupId)!.push(a);
});

byAppAndGroup.forEach((groups, appSlug) => {
  console.log(`\n${appSlug}:`);
  groups.forEach((entries, groupId) => {
    const totalOccurrences = entries.reduce((sum, e) => sum + (e.occurrence_count || 1), 0);
    const first = entries[0];
    console.log(`  Group ${groupId}: ${entries.length} entries, ${totalOccurrences} total occurrences`);
    console.log(`    Name: ${first.error_name || 'Unnamed'}`);
    console.log(`    Error: ${(first.error_log || '').substring(0, 80)}...`);
    if (entries.length > 1) {
      console.log(`    Timestamps: ${entries.map((e: any) => new Date(e.error_timestamp || e.analyzed_at).toISOString()).join(', ')}`);
    }
  });
});

console.log('\n=== Summary ===\n');
const groupStats = new Map<number, { count: number; occurrences: number }>();
analyses.forEach((a: any) => {
  const groupId = a.group_id || 0;
  if (!groupStats.has(groupId)) {
    groupStats.set(groupId, { count: 0, occurrences: 0 });
  }
  const stats = groupStats.get(groupId)!;
  stats.count++;
  stats.occurrences += (a.occurrence_count || 1);
});

console.log('Groups with multiple entries:');
groupStats.forEach((stats, groupId) => {
  if (stats.count > 1) {
    console.log(`  Group ${groupId}: ${stats.count} entries, ${stats.occurrences} total occurrences`);
  }
});

process.exit(0);


