
import sqlite3 from "sqlite3";
import fs from "fs";
import path from "path";

const tempDbPath = path.resolve("./temp_migration_test_isolated.db");

// Re-implementing the logger for the test
const Logger = {
    info: console.log,
    error: console.error,
};

// logic to test
async function migrateSQLite(db: sqlite3.Database): Promise<void> {
    return new Promise((resolve, reject) => {
        db.all("PRAGMA table_info(trackings)", (err, rows: any[]) => {
            if (err) {
                Logger.error("DATABASE | Failed to check table info:", err);
                resolve();
                return;
            }

            const hasDetails = rows.some((r: any) => r.name === "details");
            const hasNotes = rows.some((r: any) => r.name === "notes");

            if (!hasDetails) {
                if (hasNotes) {
                    Logger.info("DATABASE | Renaming 'notes' column to 'details'...");
                    db.run(
                        "ALTER TABLE trackings RENAME COLUMN notes TO details",
                        (err) => {
                            if (err) {
                                Logger.error("DATABASE | Migration failed:", err);
                            } else {
                                Logger.info("DATABASE | Migration successful");
                            }
                            resolve();
                        }
                    );
                } else {
                    Logger.info("DATABASE | Adding 'details' column...");
                    db.run("ALTER TABLE trackings ADD COLUMN details TEXT", (err) => {
                        if (err) {
                            Logger.error("DATABASE | Migration failed:", err);
                        } else {
                            Logger.info("DATABASE | Column added successfully");
                        }
                        resolve();
                    });
                }
            } else {
                resolve();
            }
        });
    });
}

async function runTest() {
    console.log("Setting up test database...");
    if (fs.existsSync(tempDbPath)) {
        fs.unlinkSync(tempDbPath);
    }

    // 1. Create a "legacy" database with 'notes' column
    const db = new sqlite3.Database(tempDbPath);

    await new Promise<void>((resolve, reject) => {
        db.serialize(() => {
            db.run(`
        CREATE TABLE trackings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          notes TEXT
        );
      `);
            db.run(`INSERT INTO trackings (user_id, notes) VALUES (1, 'legacy note')`, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    });

    // 2. Run migration logic
    console.log("Running migration...");
    await migrateSQLite(db);

    // 3. Verify
    const row: any = await new Promise((resolve, reject) => {
        db.get("SELECT * FROM trackings WHERE id = 1", (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });

    console.log("Row after migration:", row);

    if (row.details === 'legacy note') {
        console.log("SUCCESS: 'notes' renamed to 'details'.");
    } else {
        console.error("FAILURE: Data lost or column missing.");
        process.exit(1);
    }

    // Double check schema
    const tableInfo: any[] = await new Promise((resolve, reject) => {
        db.all("PRAGMA table_info(trackings)", (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });

    const hasDetails = tableInfo.some(c => c.name === 'details');
    const hasNotes = tableInfo.some(c => c.name === 'notes');

    if (hasDetails && !hasNotes) {
        console.log("SUCCESS: Schema correct.");
    } else {
        console.error("FAILURE: Schema incorrect.", { hasDetails, hasNotes });
        process.exit(1);
    }

    db.close();
    fs.unlinkSync(tempDbPath);
}

runTest().catch(console.error);
