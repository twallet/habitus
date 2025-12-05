import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Database } from "../../../db/database.js";
import { ReminderLifecycleManager } from "../ReminderLifecycleManager.js";
import { ReminderService } from "../../reminderService.js";
import { ReminderData, ReminderStatus } from "../../../models/Reminder.js";

/**
 * Create an in-memory database for testing.
 */
async function createTestDatabase(): Promise<Database> {
  return new Promise((resolve, reject) => {
    const sqlite3 = require("sqlite3");
    const db = new sqlite3.Database(":memory:", (err: Error | null) => {
      if (err) {
        reject(err);
        return;
      }

      db.run("PRAGMA foreign_keys = ON", (err: Error | null) => {
        if (err) {
          reject(err);
          return;
        }

        db.run("PRAGMA journal_mode = WAL", (err: Error | null) => {
          if (err) {
            reject(err);
            return;
          }

          db.exec(
            `
            CREATE TABLE IF NOT EXISTS users (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              name TEXT NOT NULL CHECK(length(name) <= 30),
              email TEXT NOT NULL UNIQUE,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS trackings (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id INTEGER NOT NULL,
              question TEXT NOT NULL CHECK(length(question) <= 100),
              state TEXT NOT NULL DEFAULT 'Running' CHECK(state IN ('Running', 'Paused', 'Archived', 'Deleted')),
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            CREATE TABLE IF NOT EXISTS reminders (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              tracking_id INTEGER NOT NULL,
              user_id INTEGER NOT NULL,
              scheduled_time DATETIME NOT NULL,
              notes TEXT,
              status TEXT NOT NULL DEFAULT 'Pending' CHECK(status IN ('Pending', 'Answered', 'Upcoming')),
              value TEXT NOT NULL DEFAULT 'Dismissed' CHECK(value IN ('Completed', 'Dismissed')),
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (tracking_id) REFERENCES trackings(id) ON DELETE CASCADE,
              FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
          `,
            (err: Error | null) => {
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

describe("ReminderLifecycleManager", () => {
  let testDb: Database;
  let lifecycleManager: ReminderLifecycleManager;
  let reminderService: ReminderService;
  let testUserId: number;

  beforeEach(async () => {
    testDb = await createTestDatabase();
    reminderService = new ReminderService(testDb);
    lifecycleManager = new ReminderLifecycleManager(reminderService);

    // Create a test user
    const userResult = await testDb.run(
      "INSERT INTO users (name, email) VALUES (?, ?)",
      ["Test User", "test@example.com"]
    );
    testUserId = userResult.lastID!;
  });

  afterEach(async () => {
    await testDb.close();
    vi.restoreAllMocks();
  });

  describe("status transitions", () => {
    it("should validate valid transition from PENDING to ANSWERED", async () => {
      const reminder: ReminderData = {
        id: 1,
        tracking_id: 1,
        user_id: testUserId,
        scheduled_time: new Date().toISOString(),
        status: ReminderStatus.PENDING,
        value: "Dismissed" as any,
      };

      await expect(
        lifecycleManager.transition(reminder, ReminderStatus.ANSWERED)
      ).resolves.not.toThrow();
    });

    it("should reject transition from ANSWERED", async () => {
      const reminder: ReminderData = {
        id: 1,
        tracking_id: 1,
        user_id: testUserId,
        scheduled_time: new Date().toISOString(),
        status: ReminderStatus.ANSWERED,
        value: "Dismissed" as any,
      };

      await expect(
        lifecycleManager.transition(reminder, ReminderStatus.PENDING)
      ).rejects.toThrow();
    });

    it("should reject transition to same status", async () => {
      const reminder: ReminderData = {
        id: 1,
        tracking_id: 1,
        user_id: testUserId,
        scheduled_time: new Date().toISOString(),
        status: ReminderStatus.PENDING,
        value: "Dismissed" as any,
      };

      await expect(
        lifecycleManager.transition(reminder, ReminderStatus.PENDING)
      ).rejects.toThrow();
    });
  });
});
