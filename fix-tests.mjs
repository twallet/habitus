// Quick script to fix remaining test createTestDatabase functions
import fs from 'fs';
import path from 'path';

const testFiles = [
  'backend/src/services/__tests__/reminderService.test.ts',
  'backend/src/services/__tests__/telegramConnectionService.test.ts',
  'backend/src/services/__tests__/trackingService.test.ts',
  'backend/src/services/__tests__/userService.test.ts',
  'backend/src/routes/__tests__/auth.test.ts',
  'backend/src/routes/__tests__/reminders.test.ts',
  'backend/src/routes/__tests__/trackings.test.ts',
  'backend/src/routes/__tests__/users.test.ts',
  'backend/src/routes/__tests__/telegram.test.ts',
  'backend/src/middleware/__tests__/authMiddleware.test.ts',
  'backend/src/models/__tests__/User.test.ts',
  'backend/src/models/__tests__/TrackingSchedule.test.ts',
  'backend/src/models/__tests__/Tracking.test.ts',
  'backend/src/models/__tests__/Reminder.test.ts',
];

for (const file of testFiles) {
  const filePath = path.join(process.cwd(), file);
  
  if (!fs.existsSync(filePath)) {
    console.log(`Skip: ${file}`);
    continue;
  }
  
  let content = fs.readFileSync(filePath, 'utf-8');
  
  // Extract schema between db.exec(` and `,
  const schemaMatch = content.match(/db\.exec\(\s*`([\s\S]+?)`,?\s*\(err\)/);
  if (!schemaMatch) {
    console.log(`No schema found: ${file}`);
    continue;
  }
  
  const schema = schemaMatch[1].trim();
  
  // Build new function
  const newFunc = `async function createTestDatabase(): Promise<Database> {
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
  
  // Replace the entire function - match from "async function createTestDatabase" to the end of the function
  const funcPattern = /async function createTestDatabase\(\): Promise<Database> \{[\s\S]*?\n\}\n/;
  
  if (!funcPattern.test(content)) {
    console.log(`Pattern not matched: ${file}`);
    continue;
  }
  
  content = content.replace(funcPattern, newFunc + '\n\n');
  fs.writeFileSync(filePath, content, 'utf-8');
  console.log(`✓ Fixed: ${file}`);
}

console.log('Done!');
