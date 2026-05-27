#!/usr/bin/env ts-node
/**
 * Script to check if hits are still registering today
 * Shows recent events from today and the last few days
 */

import Database from 'better-sqlite3';
import { join } from 'path';
import { existsSync } from 'fs';

const dbPath = process.env.DB_PATH || join(__dirname, '..', '..', 'data', 'app-registry.db');

if (!existsSync(dbPath)) {
  console.error(`Database not found at: ${dbPath}`);
  process.exit(1);
}

const db = new Database(dbPath);

// Get today's date in ISO format (YYYY-MM-DD)
const today = new Date();
today.setHours(0, 0, 0, 0);
const todayISO = today.toISOString().split('T')[0];

// Get yesterday's date
const yesterday = new Date(today);
yesterday.setDate(yesterday.getDate() - 1);
const yesterdayISO = yesterday.toISOString().split('T')[0];

// Get last 7 days
const lastWeek = new Date(today);
lastWeek.setDate(lastWeek.getDate() - 7);
const lastWeekISO = lastWeek.toISOString();

console.log('\n=== Checking Today\'s Hits ===\n');
console.log(`Today: ${todayISO}`);
console.log(`Yesterday: ${yesterdayISO}\n`);

// Query today's events
const todayEvents = db.prepare(`
  SELECT 
    id,
    app_slug,
    timestamp,
    user,
    source,
    action,
    duration_ms
  FROM usage_events
  WHERE date(timestamp) = date(?)
  ORDER BY timestamp DESC
`).all(todayISO) as any[];

// Query yesterday's events for comparison
const yesterdayEvents = db.prepare(`
  SELECT COUNT(*) as count
  FROM usage_events
  WHERE date(timestamp) = date(?)
`).get(yesterdayISO) as { count: number };

// Query last 7 days breakdown
const last7Days = db.prepare(`
  SELECT 
    date(timestamp) as date,
    COUNT(*) as count,
    COUNT(DISTINCT app_slug) as apps,
    COUNT(DISTINCT user) as users
  FROM usage_events
  WHERE timestamp >= ?
  GROUP BY date(timestamp)
  ORDER BY date DESC
`).all(lastWeekISO) as any[];

// Get recent events (last 20)
const recentEvents = db.prepare(`
  SELECT 
    id,
    app_slug,
    timestamp,
    user,
    source,
    action
  FROM usage_events
  ORDER BY timestamp DESC
  LIMIT 20
`).all() as any[];

console.log(`📊 TODAY'S STATS (${todayISO}):`);
console.log(`   Total Events: ${todayEvents.length}`);
console.log(`   Apps with hits: ${new Set(todayEvents.map(e => e.app_slug)).size}`);
console.log(`   Unique users: ${new Set(todayEvents.map(e => e.user).filter(Boolean)).size}`);

console.log(`\n📊 YESTERDAY'S STATS (${yesterdayISO}):`);
console.log(`   Total Events: ${yesterdayEvents.count}`);

console.log(`\n📊 LAST 7 DAYS BREAKDOWN:`);
last7Days.forEach(day => {
  const isToday = day.date === todayISO;
  const marker = isToday ? '👉' : '  ';
  console.log(`${marker} ${day.date}: ${day.count} events (${day.apps} apps, ${day.users} users)`);
});

if (todayEvents.length > 0) {
  console.log(`\n✅ TODAY'S RECENT EVENTS (showing all ${todayEvents.length}):`);
  todayEvents.slice(0, 20).forEach((event, idx) => {
    const time = new Date(event.timestamp).toLocaleTimeString();
    const user = event.user || 'anonymous';
    const action = event.action || 'N/A';
    console.log(`   ${idx + 1}. [${time}] ${event.app_slug} | ${user} | ${action} | ${event.source}`);
  });
  if (todayEvents.length > 20) {
    console.log(`   ... and ${todayEvents.length - 20} more events today`);
  }
} else {
  console.log(`\n⚠️  NO EVENTS TODAY (${todayISO})`);
  console.log(`   This could indicate:`);
  console.log(`   - No Power Automate flows running`);
  console.log(`   - Track API endpoint not accessible`);
  console.log(`   - Authentication issues with App Proxy`);
  console.log(`   - Network connectivity issues`);
}

console.log(`\n📋 MOST RECENT EVENTS (last 20, all time):`);
recentEvents.forEach((event, idx) => {
  const date = new Date(event.timestamp);
  const dateStr = date.toISOString().split('T')[0];
  const timeStr = date.toLocaleTimeString();
  const isToday = dateStr === todayISO;
  const marker = isToday ? '👉' : '  ';
  const user = event.user || 'anonymous';
  const action = event.action || 'N/A';
  console.log(`${marker} ${idx + 1}. [${dateStr} ${timeStr}] ${event.app_slug} | ${user} | ${action} | ${event.source}`);
});

// Check if there are any events in the last hour
const oneHourAgo = new Date();
oneHourAgo.setHours(oneHourAgo.getHours() - 1);
const oneHourAgoISO = oneHourAgo.toISOString();

const lastHourEvents = db.prepare(`
  SELECT COUNT(*) as count
  FROM usage_events
  WHERE timestamp >= ?
`).get(oneHourAgoISO) as { count: number };

console.log(`\n⏰ EVENTS IN LAST HOUR: ${lastHourEvents.count}`);

if (lastHourEvents.count === 0 && todayEvents.length === 0) {
  console.log(`\n🚨 ALERT: No events in the last hour and none today!`);
  console.log(`   The tracking system may not be receiving hits.`);
  console.log(`   Check:`);
  console.log(`   1. Is the backend server running?`);
  console.log(`   2. Is /api/track endpoint accessible?`);
  console.log(`   3. Are Power Automate flows configured correctly?`);
  console.log(`   4. Check backend logs for errors`);
}

db.close();
console.log('\n');







