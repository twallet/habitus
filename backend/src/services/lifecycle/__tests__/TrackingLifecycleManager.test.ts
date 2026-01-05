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
              locale TEXT DEFAULT 'en-US',
              timezone TEXT,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS trackings (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id INTEGER NOT NULL,
              question TEXT NOT NULL CHECK(length(question) <= 100),
              notes TEXT,
              icon TEXT,
              frequency TEXT NOT NULL,
              state TEXT NOT NULL DEFAULT 'Running' CHECK(state IN ('Running', 'Paused', 'Archived')),
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
      "INSERT INTO trackings (user_id, question, state, frequency) VALUES (?, ?, ?, ?)",
      [
        testUserId,
        "Test tracking",
        "Running",
        JSON.stringify({ type: "daily" }),
      ]
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
        frequency: { type: "daily" },
        state: TrackingState.RUNNING,
      };

      await expect(
        lifecycleManager.transition(tracking, TrackingState.PAUSED)
      ).resolves.not.toThrow();
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
        frequency: { type: "daily" },
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

  describe("archived state reminder handling", () => {
    it("should preserve Pending reminders for one-time trackings when archived", async () => {
      const { Reminder, ReminderValue } = await import(
        "../../../models/Reminder.js"
      );

      // Create a one-time tracking
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      const dateString = futureDate.toISOString().split("T")[0];

      const trackingResult = await testDb.run(
        "INSERT INTO trackings (user_id, question, state, frequency) VALUES (?, ?, ?, ?)",
        [
          testUserId,
          "One-time task",
          "Running",
          JSON.stringify({ type: "one-time", date: dateString }),
        ]
      );
      const oneTimeTrackingId = trackingResult.lastID!;

      // Create reminders in different statuses
      const upcomingReminder = new Reminder({
        id: 0,
        tracking_id: oneTimeTrackingId,
        user_id: testUserId,
        scheduled_time: new Date(Date.now() + 3600000).toISOString(),
        status: ReminderStatus.UPCOMING,
        value: null,
      });
      await upcomingReminder.save(testDb);

      const pendingReminder = new Reminder({
        id: 0,
        tracking_id: oneTimeTrackingId,
        user_id: testUserId,
        scheduled_time: new Date(Date.now() - 3600000).toISOString(),
        status: ReminderStatus.PENDING,
        value: null,
      });
      await pendingReminder.save(testDb);

      const answeredReminder = new Reminder({
        id: 0,
        tracking_id: oneTimeTrackingId,
        user_id: testUserId,
        scheduled_time: new Date(Date.now() - 7200000).toISOString(),
        status: ReminderStatus.ANSWERED,
        value: ReminderValue.COMPLETED,
      });
      await answeredReminder.save(testDb);

      // Archive the tracking
      const tracking: TrackingData = {
        id: oneTimeTrackingId,
        user_id: testUserId,
        question: "One-time task",
        frequency: { type: "one-time", date: dateString },
        state: TrackingState.RUNNING,
      };

      await lifecycleManager.transition(tracking, TrackingState.ARCHIVED);

      const archivedTracking: TrackingData = {
        ...tracking,
        state: TrackingState.ARCHIVED,
      };
      await lifecycleManager.afterStateChange(
        archivedTracking,
        TrackingState.RUNNING,
        TrackingState.ARCHIVED
      );

      // Verify Upcoming reminder was deleted
      const upcomingAfter = await Reminder.loadById(
        upcomingReminder.id,
        testUserId,
        testDb
      );
      expect(upcomingAfter).toBeNull();

      // Verify Pending reminder was preserved
      const pendingAfter = await Reminder.loadById(
        pendingReminder.id,
        testUserId,
        testDb
      );
      expect(pendingAfter).not.toBeNull();
      expect(pendingAfter!.status).toBe(ReminderStatus.PENDING);

      // Verify Answered reminder was preserved
      const answeredAfter = await Reminder.loadById(
        answeredReminder.id,
        testUserId,
        testDb
      );
      expect(answeredAfter).not.toBeNull();
      expect(answeredAfter!.status).toBe(ReminderStatus.ANSWERED);
    });

    it("should delete Pending reminders for recurring trackings when archived", async () => {
      const { Reminder, ReminderValue } = await import(
        "../../../models/Reminder.js"
      );

      // Create a recurring tracking
      const trackingResult = await testDb.run(
        "INSERT INTO trackings (user_id, question, state, frequency) VALUES (?, ?, ?, ?)",
        [testUserId, "Daily task", "Running", JSON.stringify({ type: "daily" })]
      );
      const recurringTrackingId = trackingResult.lastID!;

      // Create reminders in different statuses
      const upcomingReminder = new Reminder({
        id: 0,
        tracking_id: recurringTrackingId,
        user_id: testUserId,
        scheduled_time: new Date(Date.now() + 3600000).toISOString(),
        status: ReminderStatus.UPCOMING,
        value: null,
      });
      await upcomingReminder.save(testDb);

      const pendingReminder = new Reminder({
        id: 0,
        tracking_id: recurringTrackingId,
        user_id: testUserId,
        scheduled_time: new Date(Date.now() - 3600000).toISOString(),
        status: ReminderStatus.PENDING,
        value: null,
      });
      await pendingReminder.save(testDb);

      const answeredReminder = new Reminder({
        id: 0,
        tracking_id: recurringTrackingId,
        user_id: testUserId,
        scheduled_time: new Date(Date.now() - 7200000).toISOString(),
        status: ReminderStatus.ANSWERED,
        value: ReminderValue.COMPLETED,
      });
      await answeredReminder.save(testDb);

      // Archive the tracking
      const tracking: TrackingData = {
        id: recurringTrackingId,
        user_id: testUserId,
        question: "Daily task",
        frequency: { type: "daily" },
        state: TrackingState.RUNNING,
      };

      await lifecycleManager.transition(tracking, TrackingState.ARCHIVED);

      const archivedTracking: TrackingData = {
        ...tracking,
        state: TrackingState.ARCHIVED,
      };
      await lifecycleManager.afterStateChange(
        archivedTracking,
        TrackingState.RUNNING,
        TrackingState.ARCHIVED
      );

      // Verify Upcoming reminder was deleted
      const upcomingAfter = await Reminder.loadById(
        upcomingReminder.id,
        testUserId,
        testDb
      );
      expect(upcomingAfter).toBeNull();

      // Verify Pending reminder was deleted (for recurring trackings)
      const pendingAfter = await Reminder.loadById(
        pendingReminder.id,
        testUserId,
        testDb
      );
      expect(pendingAfter).toBeNull();

      // Verify Answered reminder was preserved
      const answeredAfter = await Reminder.loadById(
        answeredReminder.id,
        testUserId,
        testDb
      );
      expect(answeredAfter).not.toBeNull();
      expect(answeredAfter!.status).toBe(ReminderStatus.ANSWERED);
    });
  });
});
