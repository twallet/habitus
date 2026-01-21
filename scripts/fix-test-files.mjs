#!/usr/bin/env node

/**
 * Script to fix all test files by replacing createTestDatabase functions
 * with better-sqlite3 synchronous implementations
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendSrc = path.join(__dirname, '..', 'backend', 'src');

// Test files that still need fixing (excluding authService and admin which are already done)
const testFiles = [
  'services/__tests__/reminderService.test.ts',
  'services/__tests__/telegramConnectionService.test.ts',
  'services/__tests__/trackingService.test.ts',
  'services/__tests__/userService.test.ts',
  'services/__tests__/base/BaseEntityService.test.ts',
  'services/__tests__/lifecycle/ReminderLifecycleManager.test.ts',
  'services/__tests__/lifecycle/TrackingLifecycleManager.test.ts',
  'services/__tests__/lifecycle/LifecycleManager.test.ts',
  'routes/__tests__/auth.test.ts',
  'routes/__tests__/reminders.test.ts',
  'routes/__tests__/trackings.test.ts',
  'routes/__tests__/users.test.ts',
  'routes/__tests__/telegram.test.ts',
  'middleware/__tests__/authMiddleware.test.ts',
  'models/__tests__/User.test.ts',
  'models/__tests__/TrackingSchedule.test.ts',
  'models/__tests__/Tracking.test.ts',
  'models/__tests__/Reminder.test.ts',
];

function fixCreateTestDatabase(content) {
  // Pattern to match the entire createTestDatabase function with callbacks
  const pattern = /async function createTestDatabase\(\): Promise<Database> \{[\s\S]*?return new Promise\((resolve, reject\) => \{[\s\S]*?\}\);[\s\S]*?\}/;
  
  // Check if already fixed (contains db.pragma instead of db.run with callbacks)
  if (content.includes('db.pragma("foreign_keys = ON");')) {
    return content; // Already fixed
  }
  
  // Extract the schema from db.exec call
  const schemaMatch = content.match(/db\.exec\(\s*`([\s\S]*?)`,?\s*\(err\)/);
  if (!schemaMatch) {
    console.error('Could not find schema in file');
    return content;
  }
  
  const schema = schemaMatch[1].trim();
  
  // Build the new function
  const newFunction = `async function createTestDatabase(): Promise<Database> {
  const db = new BetterSqlite3(":memory:");
  
  db.pragma("foreign_keys = ON");
  db.pragma("journal_mode = WAL");
  
  db.exec(\`
${schema}
  \`);
  
  const database = new Database();
  (database as any).db = db;
  return database;
}`;
  
  // Replace the function
  return content.replace(pattern, newFunction);
}

console.log('Fixing test files...\n');

for (const file of testFiles) {
  const filePath = path.join(backendSrc, file);
  
  if (!fs.existsSync(filePath)) {
    console.log(`⚠ File not found: ${file}`);
    continue;
  }
  
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const fixed = fixCreateTestDatabase(content);
    
    if (fixed !== content) {
      fs.writeFileSync(filePath, fixed, 'utf-8');
      console.log(`✓ Fixed: ${file}`);
    } else {
      console.log(`⊘ Skipped (already fixed or no changes): ${file}`);
    }
  } catch (err) {
    console.error(`✗ Error fixing ${file}:`, err.message);
  }
}

console.log('\n✓ Done!');
