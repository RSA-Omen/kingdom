import Database from 'better-sqlite3';
import { readFileSync, mkdirSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { existsSync } from 'fs';

const dbPath = process.env.DB_PATH || join(process.cwd(), '..', 'data', 'app-registry.db');
const dbDir = dirname(dbPath);

// Create directory if it doesn't exist
if (!existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);

console.log('Running database migrations...');

// Get all migration files in order
const migrationsDir = __dirname;
const migrationFiles = readdirSync(migrationsDir)
  .filter(file => file.endsWith('.sql'))
  .sort(); // Sort to ensure order (001, 002, etc.)

for (const file of migrationFiles) {
  console.log(`Running migration: ${file}`);
  const migrationFile = join(migrationsDir, file);
  const sql = readFileSync(migrationFile, 'utf-8');
  
  try {
    db.exec(sql);
    console.log(`✓ ${file} completed`);
  } catch (error: any) {
    // Ignore errors for columns that already exist (for idempotent migrations)
    if (error.message.includes('duplicate column') || error.message.includes('already exists')) {
      console.log(`⚠ ${file} skipped (already applied)`);
    } else {
      console.error(`✗ ${file} failed:`, error.message);
      throw error;
    }
  }
}

console.log('Migrations completed successfully!');
db.close();

