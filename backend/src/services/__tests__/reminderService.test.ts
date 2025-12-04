import { vi } from "vitest";
import sqlite3 from "sqlite3";
import { ReminderService } from "../reminderService.js";
import { Reminder, ReminderStatus } from "../../models/Reminder.js";
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
              status TEXT NOT NULL DEFAULT 'Pending' CHECK(status IN ('Pending', 'Answered', 'Upcoming')),
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
      const scheduledTime1 = new Date(Date.now() - 3600000).toISOString(); // 1 hour ago
      const scheduledTime2 = new Date(Date.now() - 1800000).toISOString(); // 30 minutes ago

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

    it("should update expired upcoming reminders to Pending", async () => {
      // Create a reminder and snooze it to a past time
      const pastTime = new Date(Date.now() - 60000).toISOString(); // 1 minute ago
      const created = await reminderService.createReminder(
        testTrackingId,
        testUserId,
        pastTime
      );

      // Manually set status to UPCOMING with past scheduled_time
      await testDb.run(
        "UPDATE reminders SET status = ?, scheduled_time = ? WHERE id = ?",
        [ReminderStatus.UPCOMING, pastTime, created.id]
      );

      // Fetch reminders - should update expired upcoming reminder to Pending
      const reminders = await reminderService.getRemindersByUserId(testUserId);

      const updatedReminder = reminders.find((r) => r.id === created.id);
      expect(updatedReminder).not.toBeUndefined();
      expect(updatedReminder!.status).toBe(ReminderStatus.PENDING);
    });

    it("should not update non-expired upcoming reminders", async () => {
      // Create a reminder and snooze it to a future time
      const futureTime = new Date(Date.now() + 3600000).toISOString(); // 1 hour from now
      const created = await reminderService.createReminder(
        testTrackingId,
        testUserId,
        futureTime
      );

      // Manually set status to UPCOMING with future scheduled_time
      await testDb.run(
        "UPDATE reminders SET status = ?, scheduled_time = ? WHERE id = ?",
        [ReminderStatus.UPCOMING, futureTime, created.id]
      );

      // Fetch reminders - upcoming reminders should appear even if scheduled_time is in the future
      const reminders = await reminderService.getRemindersByUserId(testUserId);
      const reminder = reminders.find((r) => r.id === created.id);
      expect(reminder).not.toBeUndefined(); // Upcoming reminders should appear
      expect(reminder!.status).toBe(ReminderStatus.UPCOMING); // Should not be updated to Pending

      // Verify the reminder still exists in the database with UPCOMING status
      const reminderFromDb = await Reminder.loadById(
        created.id,
        testUserId,
        testDb
      );
      expect(reminderFromDb).not.toBeNull();
      expect(reminderFromDb!.status).toBe(ReminderStatus.UPCOMING);
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

    it("should update expired upcoming reminder to Pending", async () => {
      // Create a reminder and snooze it to a past time
      const pastTime = new Date(Date.now() - 60000).toISOString(); // 1 minute ago
      const created = await reminderService.createReminder(
        testTrackingId,
        testUserId,
        pastTime
      );

      // Manually set status to UPCOMING with past scheduled_time
      await testDb.run(
        "UPDATE reminders SET status = ?, scheduled_time = ? WHERE id = ?",
        [ReminderStatus.UPCOMING, pastTime, created.id]
      );

      // Fetch reminder by ID - should update expired upcoming reminder to Pending
      const reminder = await reminderService.getReminderById(
        created.id,
        testUserId
      );

      expect(reminder).not.toBeNull();
      expect(reminder!.status).toBe(ReminderStatus.PENDING);
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

    it("should throw error if reminder not found", async () => {
      await expect(
        reminderService.updateReminder(999, testUserId, {
          answer: "Yes",
        })
      ).rejects.toThrow("Reminder not found");
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

      expect(snoozed.status).toBe(ReminderStatus.UPCOMING);
      const snoozedTime = new Date(snoozed.scheduled_time);
      const originalTime = new Date(scheduledTime);
      const diffMinutes =
        (snoozedTime.getTime() - originalTime.getTime()) / (1000 * 60);
      expect(diffMinutes).toBeGreaterThanOrEqual(30);
    });

    it("should throw error if reminder not found", async () => {
      await expect(
        reminderService.snoozeReminder(999, testUserId, 30)
      ).rejects.toThrow("Reminder not found");
    });
  });

  describe("deleteReminder", () => {
    it("should delete reminder and create next one", async () => {
      const scheduledTime = new Date(Date.now() - 3600000).toISOString(); // 1 hour ago
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

      // Check that a new reminder was created (may be in future, so check database directly)
      const newReminder = await Reminder.loadByTrackingId(
        testTrackingId,
        testUserId,
        testDb
      );
      expect(newReminder).not.toBeNull();
      expect(newReminder!.id).not.toBe(created.id);
    });

    it("should throw error if reminder not found", async () => {
      await expect(
        reminderService.deleteReminder(999, testUserId)
      ).rejects.toThrow("Reminder not found");
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

    it("should ensure unique future reminder by deleting old one and creating new one", async () => {
      const first = await reminderService.createNextReminderForTracking(
        testTrackingId,
        testUserId
      );

      expect(first).not.toBeNull();
      const firstId = first!.id;

      const second = await reminderService.createNextReminderForTracking(
        testTrackingId,
        testUserId
      );

      // The old reminder should be deleted and a new one created to ensure uniqueness
      const oldReminder = await Reminder.loadById(firstId, testUserId, testDb);
      expect(oldReminder).toBeNull(); // Old reminder should be deleted

      // A new reminder should exist
      expect(second).not.toBeNull();
      expect(second!.id).not.toBe(firstId); // Should be a new reminder

      // Verify only one future reminder exists (should be Upcoming)
      const allReminders = await Reminder.loadByUserId(testUserId, testDb);
      const futureUpcomingReminders = allReminders.filter(
        (r) =>
          r.tracking_id === testTrackingId &&
          r.status === ReminderStatus.UPCOMING &&
          new Date(r.scheduled_time) > new Date()
      );
      expect(futureUpcomingReminders.length).toBe(1); // Only one future Upcoming reminder should exist
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

    it("should return null if tracking not found", async () => {
      const reminder = await reminderService.createNextReminderForTracking(
        999,
        testUserId
      );

      expect(reminder).toBeNull();
    });

    it("should return null if no valid time found", async () => {
      // Create tracking without schedules
      const trackingResult = await testDb.run(
        "INSERT INTO trackings (user_id, question, type, days, state) VALUES (?, ?, ?, ?, ?)",
        [
          testUserId,
          "Test tracking",
          TrackingType.TRUE_FALSE,
          JSON.stringify({
            pattern_type: DaysPatternType.INTERVAL,
            interval_value: 1,
            interval_unit: "days",
          }),
          "Running",
        ]
      );
      const trackingIdWithoutSchedule = trackingResult.lastID;

      const reminder = await reminderService.createNextReminderForTracking(
        trackingIdWithoutSchedule,
        testUserId
      );

      expect(reminder).toBeNull();
    });

    it("should exclude deleted time when creating next reminder", async () => {
      const scheduledTime = new Date(Date.now() - 3600000).toISOString(); // 1 hour ago
      const created = await reminderService.createReminder(
        testTrackingId,
        testUserId,
        scheduledTime
      );

      await reminderService.deleteReminder(created.id, testUserId);

      // The next reminder should not be at the same time as the deleted one
      // Check database directly since the new reminder might be in the future
      const newReminder = await Reminder.loadByTrackingId(
        testTrackingId,
        testUserId,
        testDb
      );
      expect(newReminder).not.toBeNull();
      expect(newReminder!.scheduled_time).not.toBe(scheduledTime);
    });

    it("should delete upcoming reminder and create new one when tracking's scheduled time arrives", async () => {
      // Create an upcoming reminder for the tracking
      const upcomingTime = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 minutes from now
      const upcomingReminder = new Reminder({
        id: 0,
        tracking_id: testTrackingId,
        user_id: testUserId,
        scheduled_time: upcomingTime,
        status: ReminderStatus.UPCOMING,
      });
      await upcomingReminder.save(testDb);

      // Verify upcoming reminder exists
      const beforeReminder = await Reminder.loadUpcomingByTrackingId(
        testTrackingId,
        testUserId,
        testDb
      );
      expect(beforeReminder).not.toBeNull();
      expect(beforeReminder!.status).toBe(ReminderStatus.UPCOMING);

      // Create next reminder (simulating tracking's scheduled time arriving)
      const newReminder = await reminderService.createNextReminderForTracking(
        testTrackingId,
        testUserId
      );

      // Verify upcoming reminder was deleted
      const deletedUpcoming = await Reminder.loadById(
        upcomingReminder.id,
        testUserId,
        testDb
      );
      expect(deletedUpcoming).toBeNull();

      // Verify new reminder was created
      expect(newReminder).not.toBeNull();
      expect(newReminder!.id).not.toBe(upcomingReminder.id);
      expect(newReminder!.status).toBe(ReminderStatus.UPCOMING);
    });

    it("should delete existing future Upcoming reminder and create new unique one", async () => {
      // Create an Upcoming reminder for the tracking
      const upcomingTime = new Date(
        Date.now() + 24 * 60 * 60 * 1000
      ).toISOString(); // Tomorrow
      const upcomingReminder = new Reminder({
        id: 0,
        tracking_id: testTrackingId,
        user_id: testUserId,
        scheduled_time: upcomingTime,
        status: ReminderStatus.UPCOMING,
      });
      await upcomingReminder.save(testDb);

      // Try to create next reminder
      const result = await reminderService.createNextReminderForTracking(
        testTrackingId,
        testUserId
      );

      // Verify the existing Upcoming reminder is deleted and a new one is created
      const oldReminder = await Reminder.loadById(
        upcomingReminder.id,
        testUserId,
        testDb
      );
      expect(oldReminder).toBeNull(); // Old reminder should be deleted

      // Verify a new reminder was created
      expect(result).not.toBeNull();
      expect(result!.id).not.toBe(upcomingReminder.id); // Should be a new reminder
      expect(result!.status).toBe(ReminderStatus.UPCOMING);
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

    it("should exclude specified time when calculating next reminder", async () => {
      const schedules = await testDb.all(
        "SELECT * FROM tracking_schedules WHERE tracking_id = ?",
        [testTrackingId]
      );

      const excludeTime = new Date();
      excludeTime.setHours(9, 0, 0, 0);
      excludeTime.setDate(excludeTime.getDate() + 1);

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
        trackingData as any,
        excludeTime.toISOString()
      );

      expect(nextTime).not.toBeNull();
      const nextDate = new Date(nextTime!);
      expect(nextDate.getTime()).not.toBe(excludeTime.getTime());
    });

    it("should calculate next reminder time for DAY_OF_WEEK pattern", async () => {
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
          pattern_type: DaysPatternType.DAY_OF_WEEK,
          days: [1, 3, 5], // Monday, Wednesday, Friday
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
      const dayOfWeek = nextDate.getDay();
      expect([1, 3, 5]).toContain(dayOfWeek);
    });

    it("should calculate next reminder time for DAY_OF_MONTH pattern with day_number", async () => {
      const schedules = await testDb.all(
        "SELECT * FROM tracking_schedules WHERE tracking_id = ?",
        [testTrackingId]
      );

      const today = new Date();
      const dayOfMonth = today.getDate();
      const nextDay = dayOfMonth <= 15 ? 15 : 1; // Use 15th or 1st of next month

      const trackingData = {
        id: testTrackingId,
        user_id: testUserId,
        question: "Did I exercise?",
        type: TrackingType.TRUE_FALSE,
        days: {
          pattern_type: DaysPatternType.DAY_OF_MONTH,
          type: "day_number" as const,
          day_numbers: [nextDay],
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
      expect(nextDate.getDate()).toBe(nextDay);
    });

    it("should calculate next reminder time for DAY_OF_MONTH pattern with last_day", async () => {
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
          pattern_type: DaysPatternType.DAY_OF_MONTH,
          type: "last_day" as const,
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
      const lastDayOfMonth = new Date(
        nextDate.getFullYear(),
        nextDate.getMonth() + 1,
        0
      ).getDate();
      expect(nextDate.getDate()).toBe(lastDayOfMonth);
    });

    it("should calculate next reminder time for DAY_OF_YEAR pattern", async () => {
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
          pattern_type: DaysPatternType.DAY_OF_YEAR,
          type: "date" as const,
          month: 12,
          day: 25, // December 25
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
      expect(nextDate.getMonth() + 1).toBe(12);
      expect(nextDate.getDate()).toBe(25);
    });

    it("should handle interval patterns with different units", async () => {
      const schedules = await testDb.all(
        "SELECT * FROM tracking_schedules WHERE tracking_id = ?",
        [testTrackingId]
      );

      const testCases = [
        { unit: "weeks" as const, value: 1 },
        { unit: "months" as const, value: 1 },
        { unit: "years" as const, value: 1 },
      ];

      for (const testCase of testCases) {
        const trackingData = {
          id: testTrackingId,
          user_id: testUserId,
          question: "Did I exercise?",
          type: TrackingType.TRUE_FALSE,
          days: {
            pattern_type: DaysPatternType.INTERVAL,
            interval_value: testCase.value,
            interval_unit: testCase.unit,
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
      }
    });

    it("should return null for invalid interval unit", async () => {
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
          interval_unit: "invalid" as any,
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

      expect(nextTime).toBeNull();
    });
  });
});
