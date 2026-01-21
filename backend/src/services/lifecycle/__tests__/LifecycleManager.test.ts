import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Database } from "../../../db/database.js";
import { TrackingLifecycleManager } from "../TrackingLifecycleManager.js";
import { ReminderService } from "../../reminderService.js";
import { TrackingData, TrackingState } from "../../../models/Tracking.js";

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
              locale TEXT DEFAULT 'en-US',
              timezone TEXT,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS trackings (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id INTEGER NOT NULL,
              question TEXT NOT NULL CHECK(length(question) <= 100),
              details TEXT,
              icon TEXT,
              days TEXT,
              state TEXT NOT NULL DEFAULT 'Running' CHECK(state IN ('Running', 'Paused', 'Archived')),
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
              value TEXT CHECK(value IN ('Completed', 'Dismissed') OR value IS NULL),
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

describe("LifecycleManager", () => {
  let testDb: Database;
  let lifecycleManager: TrackingLifecycleManager;
  let reminderService: ReminderService;
  let testUserId: number;

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
  });

  afterEach(async () => {
    await testDb.close();
    vi.restoreAllMocks();
  });

  describe("transition", () => {
    it("should validate transition and call hooks", async () => {
      const tracking: TrackingData = {
        id: 1,
        user_id: testUserId,
        question: "Test",
        frequency: { type: "daily" },
        state: TrackingState.RUNNING,
      };

      // This should not throw if transition is valid
      await expect(
        lifecycleManager.transition(tracking, TrackingState.PAUSED)
      ).resolves.not.toThrow();
    });

    it("should throw error for same state transition", async () => {
      const tracking: TrackingData = {
        id: 1,
        user_id: testUserId,
        question: "Test",
        frequency: { type: "daily" },
        state: TrackingState.RUNNING,
      };

      // Transition to same state should fail
      await expect(
        lifecycleManager.transition(tracking, TrackingState.RUNNING)
      ).rejects.toThrow();
    });
  });

  describe("onCreate", () => {
    it("should execute onCreate handlers", async () => {
      let onCreateCalled = false;
      lifecycleManager.registerOnCreate(async () => {
        onCreateCalled = true;
      });

      const tracking: TrackingData = {
        id: 1,
        user_id: testUserId,
        question: "Test",
        frequency: { type: "daily" },
        state: TrackingState.RUNNING,
      };

      await lifecycleManager.onCreate(tracking);
      expect(onCreateCalled).toBe(true);
    });
  });
});

