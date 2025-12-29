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

describe("ReminderLifecycleManager", () => {
  let testDb: Database;
  let lifecycleManager: ReminderLifecycleManager;
  let reminderService: ReminderService;
  let testUserId: number;

  beforeEach(async () => {
    testDb = await createTestDatabase();
    reminderService = new ReminderService(testDb);
    lifecycleManager = new ReminderLifecycleManager(reminderService, testDb);

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

  describe("one-time tracking archiving", () => {
    it("should archive one-time tracking when last reminder is answered", async () => {
      const { Tracking, TrackingState } = await import(
        "../../../models/Tracking.js"
      );
      const { TrackingSchedule } = await import(
        "../../../models/TrackingSchedule.js"
      );

      // Create a one-time tracking
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      const dateString = futureDate.toISOString().split("T")[0];

      const tracking = new Tracking({
        id: 0,
        user_id: testUserId,
        question: "One-time task",
        frequency: { type: "one-time", date: dateString },
        state: TrackingState.RUNNING,
      });
      const trackingData = await tracking.save(testDb);

      // Create a single schedule
      const schedule = new TrackingSchedule({
        id: 0,
        tracking_id: trackingData.id,
        hour: 9,
        minutes: 0,
      });
      await schedule.save(testDb);

      // Create the first (and only) reminder
      const reminderTime = `${dateString}T09:00:00`;
      const reminder = await reminderService.createReminder(
        trackingData.id,
        testUserId,
        reminderTime
      );

      // Answer the reminder (which should trigger archiving)
      await reminderService.updateReminder(reminder.id, testUserId, {
        status: ReminderStatus.ANSWERED,
        value: "Completed" as any,
      });

      // Verify tracking was archived
      const updatedTracking = await Tracking.loadById(
        trackingData.id,
        testUserId,
        testDb
      );
      expect(updatedTracking).not.toBeNull();
      expect(updatedTracking!.state).toBe(TrackingState.ARCHIVED);
    });

    it("should create next reminder for one-time tracking when not last", async () => {
      const { Tracking, TrackingState } = await import(
        "../../../models/Tracking.js"
      );
      const { TrackingSchedule } = await import(
        "../../../models/TrackingSchedule.js"
      );

      // Create a one-time tracking with multiple schedules
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      const dateString = futureDate.toISOString().split("T")[0];

      const tracking = new Tracking({
        id: 0,
        user_id: testUserId,
        question: "One-time task",
        frequency: { type: "one-time", date: dateString },
        state: TrackingState.RUNNING,
      });
      const trackingData = await tracking.save(testDb);

      // Create two schedules: 9:00 and 12:00
      const schedule1 = new TrackingSchedule({
        id: 0,
        tracking_id: trackingData.id,
        hour: 9,
        minutes: 0,
      });
      await schedule1.save(testDb);

      const schedule2 = new TrackingSchedule({
        id: 0,
        tracking_id: trackingData.id,
        hour: 12,
        minutes: 0,
      });
      await schedule2.save(testDb);

      // Create the first reminder
      const reminderTime = `${dateString}T09:00:00`;
      const reminder = await reminderService.createReminder(
        trackingData.id,
        testUserId,
        reminderTime
      );

      // Answer the reminder (should create next reminder, not archive)
      await reminderService.updateReminder(reminder.id, testUserId, {
        status: ReminderStatus.ANSWERED,
        value: "Completed" as any,
      });

      // Verify tracking is still Running
      const updatedTracking = await Tracking.loadById(
        trackingData.id,
        testUserId,
        testDb
      );
      expect(updatedTracking).not.toBeNull();
      expect(updatedTracking!.state).toBe(TrackingState.RUNNING);

      // Verify next reminder was created
      const reminders = await reminderService.getAllByUserId(testUserId);
      const upcomingReminders = reminders.filter(
        (r) => r.status === ReminderStatus.UPCOMING
      );
      expect(upcomingReminders.length).toBe(1);
      const nextReminder = upcomingReminders[0];
      const nextReminderDate = new Date(nextReminder.scheduled_time);
      expect(nextReminderDate.getHours()).toBe(12);
      expect(nextReminderDate.getMinutes()).toBe(0);
    });
  });
});
