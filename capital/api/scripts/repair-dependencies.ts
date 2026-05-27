#!/usr/bin/env ts-node

import { dependencyRepairService } from '../src/services/dependencyRepair';

async function main() {
  const dryRun = process.argv.includes('--dry-run') || process.argv.includes('-d');
  
  console.log('🔧 Starting dependency repair...');
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes will be made)' : 'LIVE (will make changes)'}`);
  console.log('');
  
  try {
    const summary = await dependencyRepairService.repairAll(dryRun);
    
    console.log('');
    console.log('═══════════════════════════════════════════════════════');
    console.log('📊 Repair Summary');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`Total Vulnerabilities: ${summary.totalVulnerabilities}`);
    console.log(`Attempted: ${summary.attempted}`);
    console.log(`✅ Succeeded: ${summary.succeeded}`);
    console.log(`❌ Failed: ${summary.failed}`);
    console.log(`⏭️  Skipped: ${summary.skipped}`);
    console.log('');
    
    if (summary.results.length > 0) {
      console.log('═══════════════════════════════════════════════════════');
      console.log('📝 Detailed Results');
      console.log('═══════════════════════════════════════════════════════');
      
      const succeeded = summary.results.filter(r => r.success);
      const failed = summary.results.filter(r => !r.success && r.action !== 'skipped');
      const skipped = summary.results.filter(r => r.action === 'skipped');
      
      if (succeeded.length > 0) {
        console.log('');
        console.log('✅ Successful Fixes:');
        succeeded.forEach((result, idx) => {
          console.log(`  ${idx + 1}. ${result.packageName} in ${result.appName}`);
          console.log(`     ${result.oldVersion} → ${result.newVersion}`);
          if (result.resolutionFile) {
            console.log(`     📄 Logged: ${result.resolutionFile}`);
          }
        });
      }
      
      if (failed.length > 0) {
        console.log('');
        console.log('❌ Failed Fixes:');
        failed.forEach((result, idx) => {
          console.log(`  ${idx + 1}. ${result.packageName} in ${result.appName}`);
          console.log(`     Error: ${result.error || 'Unknown error'}`);
        });
      }
      
      if (skipped.length > 0) {
        console.log('');
        console.log('⏭️  Skipped:');
        skipped.forEach((result, idx) => {
          console.log(`  ${idx + 1}. ${result.packageName} in ${result.appName}`);
          console.log(`     Reason: ${result.error || 'Skipped'}`);
        });
      }
    }
    
    console.log('');
    console.log('═══════════════════════════════════════════════════════');
    if (dryRun) {
      console.log('ℹ️  This was a dry run. No changes were made.');
      console.log('   Run without --dry-run to apply fixes.');
    } else {
      console.log('✨ Repair complete!');
      console.log(`   ${summary.succeeded} resolution file(s) created in admin-center/data/dependency-resolutions/`);
      console.log('   These will appear in the next weekly report.');
    }
    console.log('═══════════════════════════════════════════════════════');
    
    process.exit(summary.failed > 0 ? 1 : 0);
  } catch (error: any) {
    console.error('');
    console.error('❌ Error during repair:');
    console.error(error.message || error);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
