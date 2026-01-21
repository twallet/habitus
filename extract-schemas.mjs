// Script to extract createTestDatabase schemas from test files and list them
// Run with: node extract-schemas.mjs
import fs from 'fs';
import path from 'path';

const testFiles = [
    'backend/src/middleware/__tests__/authMiddleware.test.ts',
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

    const content = fs.readFileSync(filePath, 'utf-8');

    // Extract the CREATE TABLE statements from within db.exec()
    const match = content.match(/db\.exec\(\s*`([\s\S]+?)`,?\s*\(err\)/);
    if (match) {
        console.log(`\n==== ${file} ====`);
        console.log(match[1].trim());
    } else {
        console.log(`\nNO MATCH: ${file}`);
    }
}
