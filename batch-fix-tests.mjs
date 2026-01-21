// Batch fix remaining test files - converts createTestDatabase to better-sqlite3 sync API
import fs from 'fs';
import path from 'path';

const testFiles = [
    'backend/src/models/__tests__/Reminder.test.ts',
    'backend/src/models/__tests__/Tracking.test.ts',
    'backend/src/models/__tests__/TrackingSchedule.test.ts',
    'backend/src/models/__tests__/User.test.ts',
    'backend/src/routes/__tests__/auth.test.ts',
    'backend/src/routes/__tests__/reminders.test.ts',
    'backend/src/routes/__tests__/telegram.test.ts',
    'backend/src/routes/__tests__/trackings.test.ts',
    'backend/src/routes/__tests__/users.test.ts',
    'backend/src/services/__tests__/reminderService.test.ts',
    'backend/src/services/__tests__/telegramConnectionService.test.ts',
    'backend/src/services/__tests__/trackingService.test.ts',
];

for (const file of testFiles) {
    const filePath = path.join(process.cwd(), file);

    if (!fs.existsSync(filePath)) {
        console.log(`SKIP: ${file}`);
        continue;
    }

    let content = fs.readFileSync(filePath, 'utf-8');

    // Extract schema
    const schemaMatch = content.match(/db\.exec\(\s*`([\s\S]+?)`,?\s*\(err\)/);
    if (!schemaMatch) {
        console.log(`NO SCHEMA: ${file}`);
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

    // Replace entire createTestDatabase function
    // Match from "async function createTestDatabase" through the closing brace and newline
    const funcRegex = /async function createTestDatabase\(\): Promise<Database> \{[\s\S]*?^\}/m;

    if (!funcRegex.test(content)) {
        console.log(`NO MATCH: ${file}`);
        continue;
    }

    content = content.replace(funcRegex, newFunc);
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`✓ ${file}`);
}

console.log('\nDone!');
