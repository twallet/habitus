import { vi } from "vitest";
import sqlite3 from "sqlite3";
import { ReminderService } from "../reminderService.js";
import { ReminderStatus } from "../../models/Reminder.js";
import { TrackingType, DaysPatternType } from "../../models/Tracking.js";
import { Database } from "../../db/database.js";
import { TrackingSchedule } from "../../models/TrackingSchedule.js";

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
              name TEXT NOT NULL CHECK(length(name) <= 30),
              email TEXT NOT NULL UNIQUE,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS trackings (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id INTEGER NOT NULL,
              question TEXT NOT NULL CHECK(length(question) <= 100),
              type TEXT NOT NULL CHECK(type IN ('true_false', 'register')),
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
              answer TEXT,
              notes TEXT,
              status TEXT NOT NULL DEFAULT 'Pending' CHECK(status IN ('Pending', 'Answered', 'Snoozed')),
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (tracking_id) REFERENCES trackings(id) ON DELETE CASCADE,
              FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_reminders_user_id ON reminders(user_id);
            CREATE INDEX IF NOT EXISTS idx_reminders_tracking_id ON reminders(tracking_id);
            CREATE INDEX IF NOT EXISTS idx_reminders_scheduled_time ON reminders(scheduled_time);
            CREATE INDEX IF NOT EXISTS idx_reminders_status ON reminders(status);
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

describe("ReminderService", () => {
  let testDb: Database;
  let reminderService: ReminderService;
  let testUserId: number;
  let testTrackingId: number;

  beforeEach(async () => {
    testDb = await createTestDatabase();
    reminderService = new ReminderService(testDb);

    const userResult = await testDb.run(
      "INSERT INTO users (name, email) VALUES (?, ?)",
      ["Test User", "test@example.com"]
    );
    testUserId = userResult.lastID;

    const trackingResult = await testDb.run(
      "INSERT INTO trackings (user_id, question, type, days, state) VALUES (?, ?, ?, ?, ?)",
      [
        testUserId,
        "Did I exercise?",
        TrackingType.TRUE_FALSE,
        JSON.stringify({
          pattern_type: DaysPatternType.INTERVAL,
          interval_value: 1,
          interval_unit: "days",
        }),
        "Running",
      ]
    );
    testTrackingId = trackingResult.lastID;

    // Create a schedule
    const schedule = new TrackingSchedule({
      id: 0,
      tracking_id: testTrackingId,
      hour: 9,
      minutes: 0,
    });
    await schedule.save(testDb);
  });

  afterEach(async () => {
    await testDb.close();
  });

  describe("createReminder", () => {
    it("should create a new reminder", async () => {
      const scheduledTime = new Date().toISOString();
      const reminder = await reminderService.createReminder(
        testTrackingId,
        testUserId,
        scheduledTime
      );

      expect(reminder.id).toBeGreaterThan(0);
      expect(reminder.tracking_id).toBe(testTrackingId);
      expect(reminder.user_id).toBe(testUserId);
      expect(reminder.scheduled_time).toBe(scheduledTime);
      expect(reminder.status).toBe(ReminderStatus.PENDING);
    });
  });

  describe("getRemindersByUserId", () => {
    it("should get all reminders for a user", async () => {
      const scheduledTime1 = new Date().toISOString();
      const scheduledTime2 = new Date(Date.now() + 3600000).toISOString();

      await reminderService.createReminder(
        testTrackingId,
        testUserId,
        scheduledTime1
      );
      await reminderService.createReminder(
        testTrackingId,
        testUserId,
        scheduledTime2
      );

      const reminders = await reminderService.getRemindersByUserId(testUserId);

      expect(reminders.length).toBe(2);
      expect(reminders[0].scheduled_time).toBe(scheduledTime1);
      expect(reminders[1].scheduled_time).toBe(scheduledTime2);
    });
  });

  describe("getReminderById", () => {
    it("should get a reminder by ID", async () => {
      const scheduledTime = new Date().toISOString();
      const created = await reminderService.createReminder(
        testTrackingId,
        testUserId,
        scheduledTime
      );

      const reminder = await reminderService.getReminderById(
        created.id,
        testUserId
      );

      expect(reminder).not.toBeNull();
      expect(reminder!.id).toBe(created.id);
    });

    it("should return null if reminder not found", async () => {
      const reminder = await reminderService.getReminderById(999, testUserId);

      expect(reminder).toBeNull();
    });
  });

  describe("updateReminder", () => {
    it("should update reminder", async () => {
      const scheduledTime = new Date().toISOString();
      const created = await reminderService.createReminder(
        testTrackingId,
        testUserId,
        scheduledTime
      );

      const updated = await reminderService.updateReminder(
        created.id,
        testUserId,
        {
          answer: "Yes",
          notes: "Some notes",
          status: ReminderStatus.ANSWERED,
        }
      );

      expect(updated.answer).toBe("Yes");
      expect(updated.notes).toBe("Some notes");
      expect(updated.status).toBe(ReminderStatus.ANSWERED);
    });
  });

  describe("snoozeReminder", () => {
    it("should snooze a reminder", async () => {
      const scheduledTime = new Date().toISOString();
      const created = await reminderService.createReminder(
        testTrackingId,
        testUserId,
        scheduledTime
      );

      const snoozed = await reminderService.snoozeReminder(
        created.id,
        testUserId,
        30
      );

      expect(snoozed.status).toBe(ReminderStatus.SNOOZED);
      const snoozedTime = new Date(snoozed.scheduled_time);
      const originalTime = new Date(scheduledTime);
      const diffMinutes =
        (snoozedTime.getTime() - originalTime.getTime()) / (1000 * 60);
      expect(diffMinutes).toBeGreaterThanOrEqual(30);
    });
  });

  describe("deleteReminder", () => {
    it("should delete reminder and create next one", async () => {
      const scheduledTime = new Date().toISOString();
      const created = await reminderService.createReminder(
        testTrackingId,
        testUserId,
        scheduledTime
      );

      await reminderService.deleteReminder(created.id, testUserId);

      const deleted = await reminderService.getReminderById(
        created.id,
        testUserId
      );
      expect(deleted).toBeNull();

      // Check that a new reminder was created
      const reminders = await reminderService.getRemindersByUserId(testUserId);
      expect(reminders.length).toBe(1);
      expect(reminders[0].id).not.toBe(created.id);
    });
  });

  describe("createNextReminderForTracking", () => {
    it("should create next reminder for tracking", async () => {
      const reminder = await reminderService.createNextReminderForTracking(
        testTrackingId,
        testUserId
      );

      expect(reminder).not.toBeNull();
      expect(reminder!.tracking_id).toBe(testTrackingId);
      expect(reminder!.user_id).toBe(testUserId);
    });

    it("should not create reminder if one already exists", async () => {
      const first = await reminderService.createNextReminderForTracking(
        testTrackingId,
        testUserId
      );

      const second = await reminderService.createNextReminderForTracking(
        testTrackingId,
        testUserId
      );

      expect(second!.id).toBe(first!.id);
    });

    it("should not create reminder for non-Running tracking", async () => {
      await testDb.run("UPDATE trackings SET state = ? WHERE id = ?", [
        "Paused",
        testTrackingId,
      ]);

      const reminder = await reminderService.createNextReminderForTracking(
        testTrackingId,
        testUserId
      );

      expect(reminder).toBeNull();
    });
  });

  describe("calculateNextReminderTime", () => {
    it("should calculate next reminder time for interval pattern", async () => {
      const tracking = await testDb.get(
        "SELECT * FROM trackings WHERE id = ?",
        [testTrackingId]
      );
      const schedules = await testDb.all(
        "SELECT * FROM tracking_schedules WHERE tracking_id = ?",
        [testTrackingId]
      );

      const trackingData = {
        id: testTrackingId,
        user_id: testUserId,
        question: "Did I exercise?",
        type: TrackingType.TRUE_FALSE,
        days: {
          pattern_type: DaysPatternType.INTERVAL,
          interval_value: 1,
          interval_unit: "days" as const,
        },
        schedules: schedules.map((s: any) => ({
          id: s.id,
          tracking_id: s.tracking_id,
          hour: s.hour,
          minutes: s.minutes,
        })),
        state: "Running" as const,
      };

      const nextTime = await reminderService.calculateNextReminderTime(
        trackingData as any
      );

      expect(nextTime).not.toBeNull();
      const nextDate = new Date(nextTime!);
      const now = new Date();
      expect(nextDate.getTime()).toBeGreaterThan(now.getTime());
    });

    it("should return null if tracking has no schedules", async () => {
      const trackingData = {
        id: testTrackingId,
        user_id: testUserId,
        question: "Did I exercise?",
        type: TrackingType.TRUE_FALSE,
        days: {
          pattern_type: DaysPatternType.INTERVAL,
          interval_value: 1,
          interval_unit: "days" as const,
        },
        schedules: [],
        state: "Running" as const,
      };

      const nextTime = await reminderService.calculateNextReminderTime(
        trackingData as any
      );

      expect(nextTime).toBeNull();
    });

    it("should return null if tracking has no days pattern", async () => {
      const schedules = await testDb.all(
        "SELECT * FROM tracking_schedules WHERE tracking_id = ?",
        [testTrackingId]
      );

      const trackingData = {
        id: testTrackingId,
        user_id: testUserId,
        question: "Did I exercise?",
        type: TrackingType.TRUE_FALSE,
        schedules: schedules.map((s: any) => ({
          id: s.id,
          tracking_id: s.tracking_id,
          hour: s.hour,
          minutes: s.minutes,
        })),
        state: "Running" as const,
      };

      const nextTime = await reminderService.calculateNextReminderTime(
        trackingData as any
      );

      expect(nextTime).toBeNull();
    });
  });
});
