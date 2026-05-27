#!/usr/bin/env node
/**
 * Cleanup script to remove test usage events from the database.
 * 
 * This script removes events with empty metadata, which are typically
 * test calls or duplicate tracking events.
 * 
 * Usage:
 *   npm run cleanup-test-events [app-slug]
 *   or
 *   node scripts/cleanup-test-events.js [app-slug]
 */

import { db } from '../src/models/database';

function cleanupTestEvents(appSlug?: string) {
  console.log('🔍 Analyzing usage events...\n');

  // Get all events or events for specific app
  const allEvents = db.getUsageEvents(appSlug);
  const eventsWithMetadata = allEvents.filter(
    e => e.metadata && Object.keys(e.metadata).length > 0
  );
  const eventsWithoutMetadata = allEvents.filter(
    e => !e.metadata || Object.keys(e.metadata).length === 0
  );

  console.log(`📊 Statistics:`);
  console.log(`   Total events: ${allEvents.length}`);
  console.log(`   Events with metadata (real usage): ${eventsWithMetadata.length}`);
  console.log(`   Events without metadata (test/duplicate): ${eventsWithoutMetadata.length}\n`);

  if (eventsWithoutMetadata.length === 0) {
    console.log('✅ No test events found to clean up.');
    return;
  }

  // Show sample of events to be deleted
  console.log('📋 Sample events to be deleted (first 5):');
  eventsWithoutMetadata.slice(0, 5).forEach(e => {
    console.log(`   ID: ${e.id}, Timestamp: ${e.timestamp}, Action: ${e.action || 'N/A'}`);
  });
  console.log('');

  // Confirm deletion
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question(`⚠️  Delete ${eventsWithoutMetadata.length} test events? (yes/no): `, (answer: string) => {
    if (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y') {
      console.log('\n🗑️  Deleting test events...');
      
      const criteria: any = { emptyMetadata: true };
      if (appSlug) {
        criteria.appSlug = appSlug;
      }
      
      const deleted = db.deleteUsageEventsByCriteria(criteria);
      
      console.log(`✅ Successfully deleted ${deleted} test events.`);
      console.log(`📊 Remaining events: ${allEvents.length - deleted}`);
    } else {
      console.log('❌ Cleanup cancelled.');
    }
    
    rl.close();
    process.exit(0);
  });
}

// Get app slug from command line args
const appSlug = process.argv[2];

if (appSlug) {
  console.log(`🎯 Cleaning up test events for app: ${appSlug}\n`);
} else {
  console.log('🌐 Cleaning up test events for all apps\n');
}

cleanupTestEvents(appSlug);

