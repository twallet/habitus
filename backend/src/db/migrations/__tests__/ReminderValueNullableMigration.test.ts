import { describe, it, expect, beforeEach, afterEach } from "vitest";
import sqlite3 from "sqlite3";
import { Database } from "../../database.js";
import { ReminderValueNullableMigration } from "../ReminderValueNullableMigration.js";
import { ReminderStatus, ReminderValue } from "../../../models/Reminder.js";

/**
 * Create an in-memory database for testing.
 * @returns Promise resolving to Database instance
 */
async function createTestDatabase(): Promise<Database> {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(":memory:", (err) => {
      if (err) {
        reject(err);
        return;
      }

      db.run("PRAGMA foreign_keys = ON", (err) => {
        if (err) {
          reject(err);
          return;
        }

        db.run("PRAGMA journal_mode = WAL", (err) => {
          if (err) {
            reject(err);
            return;
          }

          db.exec(
            `
            CREATE TABLE IF NOT EXISTS users (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              name TEXT NOT NULL,
              email TEXT NOT NULL UNIQUE
            );
            CREATE TABLE IF NOT EXISTS trackings (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id INTEGER NOT NULL,
              question TEXT NOT NULL,
              FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            CREATE TABLE IF NOT EXISTS reminders (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              tracking_id INTEGER NOT NULL,
              user_id INTEGER NOT NULL,
              scheduled_time DATETIME NOT NULL,
              status TEXT NOT NULL DEFAULT 'Pending',
              value TEXT NOT NULL DEFAULT 'Dismissed' CHECK(value IN ('Completed', 'Dismissed')),
              FOREIGN KEY (tracking_id) REFERENCES trackings(id) ON DELETE CASCADE,
              FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
          `,
            (err) => {
              if (err) {
                reject(err);
              } else {
                const database = new Database();
                (database as any).db = db;
                resolve(database);
              }
            }
          );
        });
      });
    });
  });
}

describe("ReminderValueNullableMigration", () => {
  let db: Database;
  let userId: number;
  let trackingId: number;

  beforeEach(async () => {
    db = await createTestDatabase();
    const userResult = await db.run(
      "INSERT INTO users (name, email) VALUES (?, ?)",
      ["Test User", "test@example.com"]
    );
    userId = userResult.lastID!;

    const trackingResult = await db.run(
      "INSERT INTO trackings (user_id, question) VALUES (?, ?)",
      [userId, "Test tracking"]
    );
    trackingId = trackingResult.lastID!;
  });

  afterEach(async () => {
    await db.close();
  });

  it("should update existing PENDING reminders to have null value", async () => {
    // Create reminder with old schema (value = 'Dismissed')
    await db.run(
      "INSERT INTO reminders (tracking_id, user_id, scheduled_time, status, value) VALUES (?, ?, ?, ?, ?)",
      [
        trackingId,
        userId,
        "2024-01-01T10:00:00Z",
        ReminderStatus.PENDING,
        ReminderValue.DISMISSED,
      ]
    );

    // Run migration
    const migration = new ReminderValueNullableMigration(db);
    await migration.execute();

    // Verify value is now null
    const row = await db.get<{ value: string | null }>(
      "SELECT value FROM reminders WHERE status = ?",
      [ReminderStatus.PENDING]
    );
    expect(row?.value).toBeNull();
  });

  it("should preserve value for ANSWERED reminders", async () => {
    // Create answered reminder
    await db.run(
      "INSERT INTO reminders (tracking_id, user_id, scheduled_time, status, value) VALUES (?, ?, ?, ?, ?)",
      [
        trackingId,
        userId,
        "2024-01-01T10:00:00Z",
        ReminderStatus.ANSWERED,
        ReminderValue.COMPLETED,
      ]
    );

    // Run migration
    const migration = new ReminderValueNullableMigration(db);
    await migration.execute();

    // Verify value is preserved
    const row = await db.get<{ value: string | null }>(
      "SELECT value FROM reminders WHERE status = ?",
      [ReminderStatus.ANSWERED]
    );
    expect(row?.value).toBe(ReminderValue.COMPLETED);
  });

  it("should allow null values for new PENDING reminders after migration", async () => {
    // Run migration
    const migration = new ReminderValueNullableMigration(db);
    await migration.execute();

    // Create new reminder with null value
    await db.run(
      "INSERT INTO reminders (tracking_id, user_id, scheduled_time, status, value) VALUES (?, ?, ?, ?, ?)",
      [trackingId, userId, "2024-01-01T10:00:00Z", ReminderStatus.PENDING, null]
    );

    const row = await db.get<{ value: string | null }>(
      "SELECT value FROM reminders WHERE status = ?",
      [ReminderStatus.PENDING]
    );
    expect(row?.value).toBeNull();
  });

  it("should enforce value is required for ANSWERED reminders after migration", async () => {
    // Run migration
    const migration = new ReminderValueNullableMigration(db);
    await migration.execute();

    // Try to create answered reminder with null value (should fail due to CHECK constraint)
    await expect(
      db.run(
        "INSERT INTO reminders (tracking_id, user_id, scheduled_time, status, value) VALUES (?, ?, ?, ?, ?)",
        [
          trackingId,
          userId,
          "2024-01-01T10:00:00Z",
          ReminderStatus.ANSWERED,
          null,
        ]
      )
    ).rejects.toThrow();
  });
});
