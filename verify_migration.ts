
import sqlite3 from "sqlite3";
import { Database } from "./backend/src/db/database.js";
import { PathConfig } from "./backend/src/config/paths.js";
import fs from "fs";
import path from "path";

// Mock PathConfig to return basic paths
const tempDbPath = path.resolve("./temp_migration_test.db");

// Force SQLite for this test
process.env.DATABASE_URL = "";

async function runTest() {
    console.log("Setting up test database...");
    if (fs.existsSync(tempDbPath)) {
        fs.unlinkSync(tempDbPath);
    }

    // 1. Create a "legacy" database with 'notes' column manually
    console.log("Creating legacy schema...");
    const legacyDb = new sqlite3.Database(tempDbPath);

    await new Promise<void>((resolve, reject) => {
        legacyDb.serialize(() => {
            legacyDb.run(`
        CREATE TABLE trackings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          notes TEXT -- Old column name
        );
      `);
            legacyDb.run(`INSERT INTO trackings (user_id, notes) VALUES (1, 'test note')`, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    });

    await new Promise<void>((resolve) => legacyDb.close(() => resolve()));

    // 2. Initialize the Database class, which should trigger migration
    console.log("Initializing Database class (this triggers migration)...");
    const db = new Database(tempDbPath);
    await db.initialize();

    // 3. Verify 'notes' is gone and 'details' exists and has data
    console.log("Verifying migration...");
    const row: any = await db.get("SELECT * FROM trackings WHERE id = 1");
    console.log("Row:", row);

    if (row.details === 'test note') {
        console.log("SUCCESS: 'notes' was renamed to 'details' and data preserved.");
    } else {
        console.error("FAILURE: Data migration failed.");
        process.exit(1);
    }

    // 4. Verify 'details' column exists in schema
    const tableInfo = await db.all("PRAGMA table_info(trackings)");
    const hasDetails = tableInfo.some((c: any) => c.name === 'details');
    const hasNotes = tableInfo.some((c: any) => c.name === 'notes');

    if (hasDetails && !hasNotes) {
        console.log("SUCCESS: Schema has 'details' and not 'notes'.");
    } else {
        console.error("FAILURE: Schema incorrect.", { hasDetails, hasNotes });
        process.exit(1);
    }

    await db.close();
    fs.unlinkSync(tempDbPath);
}

runTest().catch(console.error);
