#!/usr/bin/env node

/**
 * Script to batch update test files from sqlite3 to better-sqlite3
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendSrc = path.join(__dirname, '..', 'backend', 'src');

// List of test files to update (excluding already updated authService.test.ts)
const testFiles = [
  'services/__tests__/reminderService.test.ts',
  'services/__tests__/telegramConnectionService.test.ts', 
  'services/__tests__/trackingService.test.ts',
  'services/__tests__/userService.test.ts',
  'routes/__tests__/admin.test.ts',
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

function updateFile(filePath) {
  console.log(`Updating ${filePath}...`);
  
  let content = fs.readFileSync(filePath, 'utf-8');
  
  // Replace import
  content = content.replace(
    /import sqlite3 from "sqlite3";/,
    'import BetterSqlite3 from "better-sqlite3";'
  );
  
  // Replace new sqlite3.Database with BetterSqlite3
  content = content.replace(
    /new sqlite3\.Database/,
    'new BetterSqlite3'
  );
  
  // Replace db.run("PRAGMA with db.pragma
  content = content.replace(
    /db\.run\("PRAGMA foreign_keys = ON",\s*\(err\)\s*=>\s*\{[\s\S]*?\}\);/,
    'db.pragma("foreign_keys = ON");'
  );
  
  content = content.replace(
    /db\.run\("PRAGMA journal_mode = WAL",\s*\(err\)\s*=>\s*\{[\s\S]*?\}\);/,
    'db.pragma("journal_mode = WAL");'
  );
  
  fs.writeFileSync(filePath, content);
  console.log(`✓ Updated ${filePath}`);
}

// Update each file
for (const file of testFiles) {
  const filePath = path.join(backendSrc, file);
  if (fs.existsSync(filePath)) {
    try {
      updateFile(filePath);
    } catch (err) {
      console.error(`✗ Error updating ${file}:`, err.message);
    }
  } else {
    console.error(`✗ File not found: ${filePath}`);
  }
}

console.log('\nAll files updated!');
