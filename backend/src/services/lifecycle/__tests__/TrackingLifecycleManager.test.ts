import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Database } from "../../../db/database.js";
import { TrackingLifecycleManager } from "../TrackingLifecycleManager.js";
import { ReminderService } from "../../reminderService.js";
import { TrackingData, TrackingState } from "../../../models/Tracking.js";
import { ReminderStatus } from "../../../models/Reminder.js";

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
              notes TEXT,
              icon TEXT,
              days TEXT,
              state TEXT NOT NULL DEFAULT 'Running' CHECK(state IN ('Running', 'Paused', 'Archived', 'Deleted')),
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            CREATE TABLE IF NOT EXISTS tracking_schedules (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              tracking_id INTEGER NOT NULL,
              hour INTEGER NOT NULL CHECK(hour >= 0 AND hour <= 23),
              minutes INTEGER NOT NULL CHECK(minutes >= 0 AND minutes <= 59),
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (tracking_id) REFERENCES trackings(id) ON DELETE CASCADE,
              UNIQUE(tracking_id, hour, minutes)
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

describe("TrackingLifecycleManager", () => {
  let testDb: Database;
  let lifecycleManager: TrackingLifecycleManager;
  let reminderService: ReminderService;
  let testUserId: number;
  let testTrackingId: number;

  beforeEach(async () => {
    testDb = await createTestDatabase();
    reminderService = new ReminderService(testDb);
    lifecycleManager = new TrackingLifecycleManager(testDb, reminderService);

    // Create a test user
    const userResult = await testDb.run(
      "INSERT INTO users (name, email) VALUES (?, ?)",
      ["Test User", "test@example.com"]
    );
    testUserId = userResult.lastID!;

    // Create a test tracking
    const trackingResult = await testDb.run(
      "INSERT INTO trackings (user_id, question, state) VALUES (?, ?, ?)",
      [testUserId, "Test tracking", "Running"]
    );
    testTrackingId = trackingResult.lastID!;
  });

  afterEach(async () => {
    await testDb.close();
    vi.restoreAllMocks();
  });

  describe("state transitions", () => {
    it("should validate valid transition", async () => {
      const tracking: TrackingData = {
        id: testTrackingId,
        user_id: testUserId,
        question: "Test",
        state: TrackingState.RUNNING,
      };

      await expect(
        lifecycleManager.transition(tracking, TrackingState.PAUSED)
      ).resolves.not.toThrow();
    });

    it("should reject invalid transition from DELETED", async () => {
      await testDb.run("UPDATE trackings SET state = ? WHERE id = ?", [
        "Deleted",
        testTrackingId,
      ]);

      const tracking: TrackingData = {
        id: testTrackingId,
        user_id: testUserId,
        question: "Test",
        state: TrackingState.DELETED,
      };

      await expect(
        lifecycleManager.transition(tracking, TrackingState.RUNNING)
      ).rejects.toThrow();
    });

    it("should handle paused state transition and delete upcoming reminders", async () => {
      // Create an upcoming reminder
      const futureTime = new Date();
      futureTime.setHours(futureTime.getHours() + 1);
      await testDb.run(
        "INSERT INTO reminders (tracking_id, user_id, scheduled_time, status) VALUES (?, ?, ?, ?)",
        [
          testTrackingId,
          testUserId,
          futureTime.toISOString(),
          ReminderStatus.UPCOMING,
        ]
      );

      const tracking: TrackingData = {
        id: testTrackingId,
        user_id: testUserId,
        question: "Test",
        state: TrackingState.RUNNING,
      };

      await lifecycleManager.transition(tracking, TrackingState.PAUSED);

      // Execute after state change hooks
      const pausedTracking: TrackingData = {
        ...tracking,
        state: TrackingState.PAUSED,
      };
      await lifecycleManager.afterStateChange(
        pausedTracking,
        TrackingState.RUNNING,
        TrackingState.PAUSED
      );

      // Check that upcoming reminder was deleted
      const reminders = await testDb.all(
        "SELECT * FROM reminders WHERE tracking_id = ? AND status = ?",
        [testTrackingId, ReminderStatus.UPCOMING]
      );
      expect(reminders.length).toBe(0);
    });
  });
});
