// Fix the 2 remaining lifecycle test files
import fs from 'fs';
import path from 'path';

const testFiles = [
    'backend/src/services/lifecycle/__tests__/TrackingLifecycleManager.test.ts',
    'backend/src/services/lifecycle/__tests__/ReminderLifecycleManager.test.ts',
];

for (const file of testFiles) {
    const filePath = path.join(process.cwd(), file);

    if (!fs.existsSync(filePath)) {
        console.log(`SKIP: ${file}`);
        continue;
    }

    let content = fs.readFileSync(filePath, 'utf-8');

    // Extract schema  
    const schemaMatch = content.match(/db\.exec\(\s*`([\s\S]+?)`,?\s*\(err[:\s]*Error[^\)]*\)/);
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

    // Replace entire createTestDatabase function - match more flexibly
    const funcRegex = /async function createTestDatabase\(\)[\s\S]*?^\}/m;

    if (!funcRegex.test(content)) {
        console.log(`NO MATCH: ${file}`);
        continue;
    }

    content = content.replace(funcRegex, newFunc);
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`✓ ${file}`);
}

console.log('\nDone!');
