import { vi } from "vitest";
import sqlite3 from "sqlite3";
import { TrackingService } from "../trackingService.js";
import { TrackingState, Frequency } from "../../models/Tracking.js";
import { Database } from "../../db/database.js";
import {
  Reminder,
  ReminderStatus,
  ReminderValue,
} from "../../models/Reminder.js";

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
              profile_picture_url TEXT,
              magic_link_token TEXT,
              magic_link_expires DATETIME,
              telegram_chat_id TEXT,
              notification_channels TEXT,
              locale TEXT DEFAULT 'en-US',
              timezone TEXT,
              last_access DATETIME,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS trackings (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id INTEGER NOT NULL,
              question TEXT NOT NULL CHECK(length(question) <= 100),
              details TEXT,
              icon TEXT,
              frequency TEXT NOT NULL,
              state TEXT NOT NULL DEFAULT 'Running' CHECK(state IN ('Running', 'Paused', 'Archived')),
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_trackings_user_id ON trackings(user_id);
            CREATE INDEX IF NOT EXISTS idx_trackings_created_at ON trackings(created_at);
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
            CREATE INDEX IF NOT EXISTS idx_tracking_schedules_tracking_id ON tracking_schedules(tracking_id);
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
            CREATE INDEX IF NOT EXISTS idx_reminders_user_id ON reminders(user_id);
            CREATE INDEX IF NOT EXISTS idx_reminders_tracking_id ON reminders(tracking_id);
            CREATE INDEX IF NOT EXISTS idx_reminders_scheduled_time ON reminders(scheduled_time);
            CREATE INDEX IF NOT EXISTS idx_reminders_status ON reminders(status);
          `,
            (err) => {
              if (err) {
                reject(err);
              } else {
                // Create Database instance and manually set its internal db
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

describe("TrackingService", () => {
  let testDb: Database;
  let trackingService: TrackingService;
  let testUserId: number;

  beforeEach(async () => {
    // Create a fresh in-memory database for each test
    testDb = await createTestDatabase();
    trackingService = new TrackingService(testDb);

    // Create a test user
    const userResult = await testDb.run(
      "INSERT INTO users (name, email) VALUES (?, ?)",
      ["Test User", "test@example.com"]
    );
    testUserId = userResult.lastID;
  });

  afterEach(async () => {
    await testDb.close();
    vi.restoreAllMocks();
  });

  describe("getAllByUserId", () => {
    it("should return empty array when no trackings exist", async () => {
      const trackings = await trackingService.getAllByUserId(testUserId);
      expect(trackings).toEqual([]);
    });

    it("should return all trackings for a user", async () => {
      await testDb.run(
        "INSERT INTO trackings (user_id, question, frequency) VALUES (?, ?, ?)",
        [testUserId, "Question 1", JSON.stringify({ type: "daily" })]
      );
      // Add small delay to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 10));
      await testDb.run(
        "INSERT INTO trackings (user_id, question, frequency) VALUES (?, ?, ?)",
        [testUserId, "Question 2", JSON.stringify({ type: "daily" })]
      );

      const trackings = await trackingService.getAllByUserId(testUserId);

      expect(trackings).toHaveLength(2);
      // Check that both questions are present (order may vary due to timing)
      const questions = trackings.map((t) => t.question);
      expect(questions).toContain("Question 1");
      expect(questions).toContain("Question 2");
    });

    it("should not return trackings for other users", async () => {
      const otherUserResult = await testDb.run(
        "INSERT INTO users (name, email) VALUES (?, ?)",
        ["Other User", "other@example.com"]
      );
      const otherUserId = otherUserResult.lastID;

      await testDb.run(
        "INSERT INTO trackings (user_id, question, frequency) VALUES (?, ?, ?)",
        [testUserId, "My Question", JSON.stringify({ type: "daily" })]
      );
      await testDb.run(
        "INSERT INTO trackings (user_id, question, frequency) VALUES (?, ?, ?)",
        [otherUserId, "Other Question", JSON.stringify({ type: "daily" })]
      );

      const trackings = await trackingService.getAllByUserId(testUserId);

      expect(trackings).toHaveLength(1);
      expect(trackings[0].question).toBe("My Question");
    });
  });

  describe("getById", () => {
    it("should return null for non-existent tracking", async () => {
      const tracking = await trackingService.getById(999, testUserId);
      expect(tracking).toBeNull();
    });

    it("should return tracking for existing id", async () => {
      const result = await testDb.run(
        "INSERT INTO trackings (user_id, question, frequency) VALUES (?, ?, ?)",
        [testUserId, "Test Question", JSON.stringify({ type: "daily" })]
      );
      const trackingId = result.lastID;

      const tracking = await trackingService.getById(trackingId, testUserId);

      expect(tracking).not.toBeNull();
      expect(tracking?.id).toBe(trackingId);
      expect(tracking?.question).toBe("Test Question");
    });

    it("should return null for tracking belonging to different user", async () => {
      const otherUserResult = await testDb.run(
        "INSERT INTO users (name, email) VALUES (?, ?)",
        ["Other User", "other@example.com"]
      );
      const otherUserId = otherUserResult.lastID;

      const result = await testDb.run(
        "INSERT INTO trackings (user_id, question, frequency) VALUES (?, ?, ?)",
        [otherUserId, "Other Question", JSON.stringify({ type: "daily" })]
      );
      const trackingId = result.lastID;

      const tracking = await trackingService.getById(trackingId, testUserId);

      expect(tracking).toBeNull();
    });
  });

  describe("createTracking", () => {
    it("should create a new tracking", async () => {
      const frequency: Frequency = { type: "daily" };
      const tracking = await trackingService.createTracking(
        testUserId,
        "Did I exercise today?",
        undefined,
        undefined,
        [{ hour: 9, minutes: 0 }],
        frequency
      );

      expect(tracking).not.toBeNull();
      expect(tracking.question).toBe("Did I exercise today?");
      expect(tracking.user_id).toBe(testUserId);
      expect(tracking.id).toBeGreaterThan(0);
      expect(tracking.schedules).toBeDefined();
      expect(tracking.schedules?.length).toBe(1);
      expect(tracking.schedules?.[0].hour).toBe(9);
      expect(tracking.schedules?.[0].minutes).toBe(0);
    });

    it("should create tracking with notes", async () => {
      const frequency: Frequency = { type: "daily" };
      const tracking = await trackingService.createTracking(
        testUserId,
        "Did I meditate?",
        "Meditation notes",
        undefined,
        [{ hour: 10, minutes: 30 }],
        frequency
      );

      expect(tracking.details).toBe("Meditation notes");
      expect(tracking.schedules).toBeDefined();
      expect(tracking.schedules?.length).toBe(1);
    });

    it("should throw error for invalid question", async () => {
      const frequency: Frequency = { type: "daily" };
      await expect(
        trackingService.createTracking(
          testUserId,
          "",
          undefined,
          undefined,
          [{ hour: 9, minutes: 0 }],
          frequency
        )
      ).rejects.toThrow();
    });

    it("should throw error when no schedules provided", async () => {
      const frequency: Frequency = { type: "daily" };
      await expect(
        trackingService.createTracking(
          testUserId,
          "Valid question",
          undefined,
          undefined,
          undefined, // no schedules provided
          frequency
        )
      ).rejects.toThrow("At least one schedule is required");
    });

    it("should create initial Upcoming reminder when tracking is created with times and frequency", async () => {
      const tracking = await trackingService.createTracking(
        testUserId,
        "Did I exercise today?",
        undefined,
        undefined,
        [{ hour: 9, minutes: 0 }],
        {
          type: "weekly",
          days: [1, 2, 3, 4, 5],
        }
      );

      expect(tracking).not.toBeNull();
      expect(tracking.id).toBeGreaterThan(0);

      // Verify an initial reminder was created
      const reminder = await Reminder.loadByTrackingId(
        tracking.id!,
        testUserId,
        testDb
      );
      expect(reminder).not.toBeNull();
      expect(reminder!.status).toBe(ReminderStatus.UPCOMING);
      expect(reminder!.tracking_id).toBe(tracking.id);

      // Verify the reminder time is in the future
      const scheduledTime = new Date(reminder!.scheduled_time);
      const now = new Date();
      expect(scheduledTime.getTime()).toBeGreaterThan(now.getTime());
    });

    it("should throw error when tracking is created without frequency (frequency is required)", async () => {
      await expect(
        trackingService.createTracking(
          testUserId,
          "Did I exercise today?",
          undefined,
          undefined,
          [{ hour: 9, minutes: 0 }]
          // No frequency
        )
      ).rejects.toThrow("Frequency is required");
    });

    describe("should store all frequency types correctly in database", () => {
      it("should store Daily frequency with schedules", async () => {
        const schedules = [
          { hour: 9, minutes: 0 },
          { hour: 14, minutes: 30 },
          { hour: 20, minutes: 0 },
        ];
        const frequency: Frequency = { type: "daily" };

        const tracking = await trackingService.createTracking(
          testUserId,
          "Daily tracking question",
          "Daily notes",
          "💪",
          schedules,
          frequency
        );

        expect(tracking).not.toBeNull();
        expect(tracking.question).toBe("Daily tracking question");
        expect(tracking.notes).toBe("Daily notes");
        expect(tracking.icon).toBe("💪");
        expect(tracking.frequency).toEqual(frequency);
        expect(tracking.schedules).toBeDefined();
        expect(tracking.schedules?.length).toBe(3);
        expect(
          tracking.schedules?.map((s) => ({ hour: s.hour, minutes: s.minutes }))
        ).toEqual(schedules);

        // Verify in database
        const dbRow = await testDb.get<{
          id: number;
          user_id: number;
          question: string;
          details: string | null;
          icon: string | null;
          frequency: string;
        }>(
          "SELECT id, user_id, question, details, icon, frequency FROM trackings WHERE id = ?",
          [tracking.id]
        );

        expect(dbRow).not.toBeNull();
        expect(dbRow!.question).toBe("Daily tracking question");
        expect(dbRow!.details).toBe("Daily notes");
        expect(dbRow!.icon).toBe("💪");
        expect(JSON.parse(dbRow!.frequency)).toEqual(frequency);

        // Verify schedules in database
        const scheduleRows = await testDb.all<{
          id: number;
          tracking_id: number;
          hour: number;
          minutes: number;
        }>(
          "SELECT id, tracking_id, hour, minutes FROM tracking_schedules WHERE tracking_id = ? ORDER BY hour, minutes",
          [tracking.id]
        );

        expect(scheduleRows.length).toBe(3);
        expect(
          scheduleRows.map((r) => ({ hour: r.hour, minutes: r.minutes }))
        ).toEqual(
          schedules.sort((a, b) => {
            if (a.hour !== b.hour) return a.hour - b.hour;
            return a.minutes - b.minutes;
          })
        );
      });

      it("should store Weekly frequency with schedules", async () => {
        const schedules = [{ hour: 10, minutes: 15 }];
        const frequency: Frequency = {
          type: "weekly",
          days: [1, 3, 5], // Monday, Wednesday, Friday
        };

        const tracking = await trackingService.createTracking(
          testUserId,
          "Weekly tracking question",
          undefined,
          undefined,
          schedules,
          frequency
        );

        expect(tracking).not.toBeNull();
        expect(tracking.frequency).toEqual(frequency);
        expect(tracking.schedules?.length).toBe(1);
        expect(tracking.schedules?.[0].hour).toBe(10);
        expect(tracking.schedules?.[0].minutes).toBe(15);

        // Verify in database
        const dbRow = await testDb.get<{ frequency: string }>(
          "SELECT frequency FROM trackings WHERE id = ?",
          [tracking.id]
        );
        expect(JSON.parse(dbRow!.frequency)).toEqual(frequency);
      });

      it("should store Monthly frequency (day_number kind) with schedules", async () => {
        const schedules = [
          { hour: 8, minutes: 0 },
          { hour: 18, minutes: 45 },
        ];
        const frequency: Frequency = {
          type: "monthly",
          kind: "day_number",
          day_numbers: [1, 15], // 1st and 15th of each month
        };

        const tracking = await trackingService.createTracking(
          testUserId,
          "Monthly tracking question",
          undefined,
          undefined,
          schedules,
          frequency
        );

        expect(tracking).not.toBeNull();
        expect(tracking.frequency).toEqual(frequency);
        expect(tracking.schedules?.length).toBe(2);

        // Verify in database
        const dbRow = await testDb.get<{ frequency: string }>(
          "SELECT frequency FROM trackings WHERE id = ?",
          [tracking.id]
        );
        expect(JSON.parse(dbRow!.frequency)).toEqual(frequency);
      });

      it("should store Monthly frequency (last_day kind) with schedules", async () => {
        const schedules = [{ hour: 12, minutes: 0 }];
        const frequency: Frequency = {
          type: "monthly",
          kind: "last_day",
        };

        const tracking = await trackingService.createTracking(
          testUserId,
          "Monthly last day tracking",
          undefined,
          undefined,
          schedules,
          frequency
        );

        expect(tracking).not.toBeNull();
        expect(tracking.frequency).toEqual(frequency);

        // Verify in database
        const dbRow = await testDb.get<{ frequency: string }>(
          "SELECT frequency FROM trackings WHERE id = ?",
          [tracking.id]
        );
        expect(JSON.parse(dbRow!.frequency)).toEqual(frequency);
      });

      it("should store Monthly frequency (weekday_ordinal kind) with schedules", async () => {
        const schedules = [{ hour: 9, minutes: 30 }];
        const frequency: Frequency = {
          type: "monthly",
          kind: "weekday_ordinal",
          weekday: 1, // Monday
          ordinal: 1, // First
        };

        const tracking = await trackingService.createTracking(
          testUserId,
          "Monthly first Monday tracking",
          undefined,
          undefined,
          schedules,
          frequency
        );

        expect(tracking).not.toBeNull();
        expect(tracking.frequency).toEqual(frequency);

        // Verify in database
        const dbRow = await testDb.get<{ frequency: string }>(
          "SELECT frequency FROM trackings WHERE id = ?",
          [tracking.id]
        );
        expect(JSON.parse(dbRow!.frequency)).toEqual(frequency);
      });

      it("should store Yearly frequency (date kind) with schedules", async () => {
        const schedules = [
          { hour: 0, minutes: 0 },
          { hour: 12, minutes: 0 },
        ];
        const frequency: Frequency = {
          type: "yearly",
          kind: "date",
          month: 1, // January
          day: 1, // 1st
        };

        const tracking = await trackingService.createTracking(
          testUserId,
          "Yearly tracking question",
          undefined,
          undefined,
          schedules,
          frequency
        );

        expect(tracking).not.toBeNull();
        expect(tracking.frequency).toEqual(frequency);
        expect(tracking.schedules?.length).toBe(2);

        // Verify in database
        const dbRow = await testDb.get<{ frequency: string }>(
          "SELECT frequency FROM trackings WHERE id = ?",
          [tracking.id]
        );
        expect(JSON.parse(dbRow!.frequency)).toEqual(frequency);
      });

      it("should store One-time tracking with schedules and create single reminder", async () => {
        const schedules = [
          { hour: 9, minutes: 0 },
          { hour: 14, minutes: 0 },
          { hour: 20, minutes: 0 },
        ];
        // date should be in YYYY-MM-DD format (date only, not full ISO datetime)
        // Use a future date to pass validation
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 1); // Tomorrow
        const dateStr = futureDate.toISOString().split("T")[0]; // Extract YYYY-MM-DD
        const frequency: Frequency = {
          type: "one-time",
          date: dateStr,
        };

        const tracking = await trackingService.createTracking(
          testUserId,
          "One-time tracking question",
          "One-time notes",
          "🎄",
          schedules,
          frequency
        );

        expect(tracking).not.toBeNull();
        expect(tracking.question).toBe("One-time tracking question");
        expect(tracking.details).toBe("One-time notes");
        expect(tracking.icon).toBe("🎄");
        expect(tracking.frequency).toEqual(frequency);
        expect(tracking.schedules).toBeDefined();
        expect(tracking.schedules?.length).toBe(3);

        // Verify in database - frequency should contain one-time date
        const dbRow = await testDb.get<{ frequency: string }>(
          "SELECT frequency FROM trackings WHERE id = ?",
          [tracking.id]
        );
        expect(JSON.parse(dbRow!.frequency)).toEqual(frequency);

        // Verify schedules are stored
        const scheduleRows = await testDb.all<{
          hour: number;
          minutes: number;
        }>(
          "SELECT hour, minutes FROM tracking_schedules WHERE tracking_id = ? ORDER BY hour, minutes",
          [tracking.id]
        );
        expect(scheduleRows.length).toBe(3);
        expect(
          scheduleRows.map((r) => ({ hour: r.hour, minutes: r.minutes }))
        ).toEqual(
          schedules.sort((a, b) => {
            if (a.hour !== b.hour) return a.hour - b.hour;
            return a.minutes - b.minutes;
          })
        );

        // Verify a single reminder was created for one-time tracking (using first schedule)
        const reminders = await testDb.all<{
          id: number;
          tracking_id: number;
          scheduled_time: string;
          status: string;
        }>(
          "SELECT id, tracking_id, scheduled_time, status FROM reminders WHERE tracking_id = ? ORDER BY scheduled_time",
          [tracking.id]
        );
        expect(reminders.length).toBe(1); // Single reminder for one-time
        const reminder = reminders[0];
        expect(reminder.tracking_id).toBe(tracking.id);
        // Verify the reminder date matches the frequency date
        const reminderDate = new Date(reminder.scheduled_time)
          .toISOString()
          .split("T")[0];
        expect(reminderDate).toBe(dateStr);
      });

      it("should store tracking with maximum 5 schedules for any frequency type", async () => {
        const schedules = [
          { hour: 6, minutes: 0 },
          { hour: 9, minutes: 0 },
          { hour: 12, minutes: 0 },
          { hour: 15, minutes: 0 },
          { hour: 18, minutes: 0 },
        ];
        const frequency: Frequency = { type: "daily" };

        const tracking = await trackingService.createTracking(
          testUserId,
          "Tracking with 5 schedules",
          undefined,
          undefined,
          schedules,
          frequency
        );

        expect(tracking).not.toBeNull();
        expect(tracking.schedules?.length).toBe(5);

        // Verify all schedules in database
        const scheduleRows = await testDb.all<{
          hour: number;
          minutes: number;
        }>(
          "SELECT hour, minutes FROM tracking_schedules WHERE tracking_id = ? ORDER BY hour, minutes",
          [tracking.id]
        );
        expect(scheduleRows.length).toBe(5);
      });
    });
  });

  describe("updateTracking", () => {
    it("should update tracking question", async () => {
      const result = await testDb.run(
        "INSERT INTO trackings (user_id, question, frequency) VALUES (?, ?, ?)",
        [testUserId, "Old Question", JSON.stringify({ type: "daily" })]
      );
      const trackingId = result.lastID;

      const updated = await trackingService.updateTracking(
        trackingId,
        testUserId,
        "New Question",
        undefined,
        undefined,
        undefined,
        undefined
      );

      expect(updated.question).toBe("New Question");
    });

    it("should update tracking details", async () => {
      const result = await testDb.run(
        "INSERT INTO trackings (user_id, question, frequency) VALUES (?, ?, ?)",
        [testUserId, "Question", JSON.stringify({ type: "daily" })]
      );
      const trackingId = result.lastID;

      const updated = await trackingService.updateTracking(
        trackingId,
        testUserId,
        undefined,
        "Updated notes",
        undefined,
        undefined,
        undefined
      );

      expect(updated.details).toBe("Updated notes");
    });

    it("should throw error when tracking not found", async () => {
      await expect(
        trackingService.updateTracking(
          999,
          testUserId,
          "New Question",
          undefined,
          undefined,
          undefined,
          undefined
        )
      ).rejects.toThrow("Tracking not found");
    });

    it("should throw error when updating tracking belonging to different user", async () => {
      const otherUserResult = await testDb.run(
        "INSERT INTO users (name, email) VALUES (?, ?)",
        ["Other User", "other@example.com"]
      );
      const otherUserId = otherUserResult.lastID;

      const result = await testDb.run(
        "INSERT INTO trackings (user_id, question, frequency) VALUES (?, ?, ?)",
        [otherUserId, "Question", JSON.stringify({ type: "daily" })]
      );
      const trackingId = result.lastID;

      await expect(
        trackingService.updateTracking(
          trackingId,
          testUserId,
          "New Question",
          undefined,
          undefined,
          undefined,
          undefined
        )
      ).rejects.toThrow("Tracking not found");
    });

    it("should throw error when no fields to update", async () => {
      const result = await testDb.run(
        "INSERT INTO trackings (user_id, question, frequency) VALUES (?, ?, ?)",
        [testUserId, "Question", JSON.stringify({ type: "daily" })]
      );
      const trackingId = result.lastID;

      await expect(
        trackingService.updateTracking(
          trackingId,
          testUserId,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined
        )
      ).rejects.toThrow("No fields to update");
    });

    it("should update or create Upcoming reminder when schedules change and tracking is Running", async () => {
      // Create tracking with schedule and frequency
      const trackingResult = await testDb.run(
        "INSERT INTO trackings (user_id, question, state, frequency) VALUES (?, ?, ?, ?)",
        [
          testUserId,
          "Test Question",
          "Running",
          JSON.stringify({
            type: "weekly",
            days: [1, 2, 3, 4, 5],
          }),
        ]
      );
      const trackingId = trackingResult.lastID;

      // Create initial schedule
      await testDb.run(
        "INSERT INTO tracking_schedules (tracking_id, hour, minutes) VALUES (?, ?, ?)",
        [trackingId, 9, 0]
      );

      // Create an existing Upcoming reminder
      const existingUpcoming = new Reminder({
        id: 0,
        tracking_id: trackingId,
        user_id: testUserId,
        scheduled_time: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour from now
        status: ReminderStatus.UPCOMING,
        value: null,
      });
      await existingUpcoming.save(testDb);

      // Update tracking with new schedule
      await trackingService.updateTracking(
        trackingId,
        testUserId,
        undefined,
        undefined,
        undefined,
        [{ hour: 10, minutes: 30 }] // New schedule time
      );

      // Verify the Upcoming reminder was updated or replaced
      const updatedUpcoming = await Reminder.loadUpcomingByTrackingId(
        trackingId,
        testUserId,
        testDb
      );
      expect(updatedUpcoming).not.toBeNull();
      // The time should be recalculated based on the new schedule
      expect(updatedUpcoming!.scheduled_time).not.toBe(
        existingUpcoming.scheduled_time
      );
    });

    it("should create Upcoming reminder when schedules change and no Upcoming exists", async () => {
      // Create tracking with schedule and frequency
      const trackingResult = await testDb.run(
        "INSERT INTO trackings (user_id, question, state, frequency) VALUES (?, ?, ?, ?)",
        [
          testUserId,
          "Test Question",
          "Running",
          JSON.stringify({
            type: "weekly",
            days: [1, 2, 3, 4, 5],
          }),
        ]
      );
      const trackingId = trackingResult.lastID;

      // Create initial schedule
      await testDb.run(
        "INSERT INTO tracking_schedules (tracking_id, hour, minutes) VALUES (?, ?, ?)",
        [trackingId, 9, 0]
      );

      // Verify no Upcoming reminder exists
      const beforeUpcoming = await Reminder.loadUpcomingByTrackingId(
        trackingId,
        testUserId,
        testDb
      );
      expect(beforeUpcoming).toBeNull();

      // Update tracking with new schedule
      await trackingService.updateTracking(
        trackingId,
        testUserId,
        undefined,
        undefined,
        undefined,
        [{ hour: 10, minutes: 30 }] // New schedule time
      );

      // Verify Upcoming reminder was created
      const afterUpcoming = await Reminder.loadUpcomingByTrackingId(
        trackingId,
        testUserId,
        testDb
      );
      expect(afterUpcoming).not.toBeNull();
      expect(afterUpcoming!.status).toBe(ReminderStatus.UPCOMING);
    });

    it("should update Upcoming reminder when frequency pattern changes and tracking is Running", async () => {
      // Create tracking with schedule and frequency
      const trackingResult = await testDb.run(
        "INSERT INTO trackings (user_id, question, state, frequency) VALUES (?, ?, ?, ?)",
        [
          testUserId,
          "Test Question",
          "Running",
          JSON.stringify({
            type: "weekly",
            days: [1, 2, 3, 4, 5], // Weekdays
          }),
        ]
      );
      const trackingId = trackingResult.lastID;

      // Create schedule
      await testDb.run(
        "INSERT INTO tracking_schedules (tracking_id, hour, minutes) VALUES (?, ?, ?)",
        [trackingId, 9, 0]
      );

      // Create an existing Upcoming reminder
      const existingUpcoming = new Reminder({
        id: 0,
        tracking_id: trackingId,
        user_id: testUserId,
        scheduled_time: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        status: ReminderStatus.UPCOMING,
        value: null,
      });
      await existingUpcoming.save(testDb);

      // Update tracking with new frequency pattern
      const newFrequency: Frequency = {
        type: "weekly",
        days: [0, 6], // Weekends instead
      };
      await trackingService.updateTracking(
        trackingId,
        testUserId,
        undefined,
        undefined,
        undefined,
        undefined,
        newFrequency
      );

      // Verify the Upcoming reminder was updated or replaced
      const updatedUpcoming = await Reminder.loadUpcomingByTrackingId(
        trackingId,
        testUserId,
        testDb
      );
      expect(updatedUpcoming).not.toBeNull();
    });

    it("should convert recurring tracking to one-time with frequency", async () => {
      // Create a recurring tracking
      const trackingResult = await testDb.run(
        "INSERT INTO trackings (user_id, question, state, frequency) VALUES (?, ?, ?, ?)",
        [
          testUserId,
          "Test Question",
          "Running",
          JSON.stringify({
            type: "weekly",
            days: [1, 2, 3, 4, 5],
          }),
        ]
      );
      const trackingId = trackingResult.lastID;

      // Create schedule
      await testDb.run(
        "INSERT INTO tracking_schedules (tracking_id, hour, minutes) VALUES (?, ?, ?)",
        [trackingId, 9, 0]
      );

      // Create an existing Upcoming reminder
      const existingUpcoming = new Reminder({
        id: 0,
        tracking_id: trackingId,
        user_id: testUserId,
        scheduled_time: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        status: ReminderStatus.UPCOMING,
        value: null,
      });
      await existingUpcoming.save(testDb);

      // Create Pending and Answered reminders to verify they are preserved
      const pendingReminder = new Reminder({
        id: 0,
        tracking_id: trackingId,
        user_id: testUserId,
        scheduled_time: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        status: ReminderStatus.PENDING,
        value: null,
      });
      await pendingReminder.save(testDb);

      const answeredReminder = new Reminder({
        id: 0,
        tracking_id: trackingId,
        user_id: testUserId,
        scheduled_time: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        status: ReminderStatus.ANSWERED,
        value: ReminderValue.COMPLETED,
      });
      await answeredReminder.save(testDb);

      // Convert to one-time with a future date
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      const dateStr = futureDate.toISOString().split("T")[0]; // YYYY-MM-DD format
      const oneTimeFrequency: Frequency = {
        type: "one-time",
        date: dateStr,
      };

      await trackingService.updateTracking(
        trackingId,
        testUserId,
        undefined,
        undefined,
        undefined,
        undefined,
        oneTimeFrequency
      );

      // Verify tracking is now one-time
      const updatedTracking = await trackingService.getById(
        trackingId,
        testUserId
      );
      expect(updatedTracking).not.toBeNull();
      expect(updatedTracking!.frequency).toEqual(oneTimeFrequency);

      // Verify old Upcoming reminder was deleted, but Pending and Answered are preserved
      const reminders = await testDb.all<{
        id: number;
        scheduled_time: string;
        status: string;
      }>(
        "SELECT id, scheduled_time, status FROM reminders WHERE tracking_id = ? AND user_id = ? ORDER BY scheduled_time",
        [trackingId, testUserId]
      );

      // Should have: 1 new one-time Upcoming + 1 Pending + 1 Answered = 3 total
      expect(reminders.length).toBe(3);

      // Verify Pending reminder is preserved
      const pendingReminders = reminders.filter(
        (r) => r.status === ReminderStatus.PENDING
      );
      expect(pendingReminders.length).toBe(1);
      expect(pendingReminders[0].id).toBe(pendingReminder.id);

      // Verify Answered reminder is preserved
      const answeredReminders = reminders.filter(
        (r) => r.status === ReminderStatus.ANSWERED
      );
      expect(answeredReminders.length).toBe(1);
      expect(answeredReminders[0].id).toBe(answeredReminder.id);

      // Verify new one-time Upcoming reminder was created
      const upcomingReminders = reminders.filter(
        (r) => r.status === ReminderStatus.UPCOMING
      );
      expect(upcomingReminders.length).toBe(1);
      // Verify the reminder is on the one-time date
      const reminderDate = new Date(upcomingReminders[0].scheduled_time)
        .toISOString()
        .split("T")[0];
      expect(reminderDate).toBe(dateStr);
    });

    it("should convert one-time tracking to recurring", async () => {
      // Create a one-time tracking
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      const dateStr = futureDate.toISOString().split("T")[0];

      const trackingResult = await testDb.run(
        "INSERT INTO trackings (user_id, question, state, frequency) VALUES (?, ?, ?, ?)",
        [
          testUserId,
          "Test Question",
          "Running",
          JSON.stringify({
            type: "one-time",
            date: dateStr,
          }),
        ]
      );
      const trackingId = trackingResult.lastID;

      // Create schedule
      await testDb.run(
        "INSERT INTO tracking_schedules (tracking_id, hour, minutes) VALUES (?, ?, ?)",
        [trackingId, 9, 0]
      );

      // Create one-time Upcoming reminder
      const reminder1 = new Reminder({
        id: 0,
        tracking_id: trackingId,
        user_id: testUserId,
        scheduled_time: `${dateStr}T09:00:00.000Z`,
        status: ReminderStatus.UPCOMING,
        value: null,
      });
      await reminder1.save(testDb);

      // Create Pending and Answered reminders to verify they are preserved
      const pendingReminder = new Reminder({
        id: 0,
        tracking_id: trackingId,
        user_id: testUserId,
        scheduled_time: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        status: ReminderStatus.PENDING,
        value: null,
      });
      await pendingReminder.save(testDb);

      const answeredReminder = new Reminder({
        id: 0,
        tracking_id: trackingId,
        user_id: testUserId,
        scheduled_time: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        status: ReminderStatus.ANSWERED,
        value: ReminderValue.COMPLETED,
      });
      await answeredReminder.save(testDb);

      // Convert to recurring (daily)
      const dailyFrequency: Frequency = { type: "daily" };
      await trackingService.updateTracking(
        trackingId,
        testUserId,
        undefined,
        undefined,
        undefined,
        undefined,
        dailyFrequency
      );

      // Verify tracking is now recurring (frequency is set)
      const updatedTracking = await trackingService.getById(
        trackingId,
        testUserId
      );
      expect(updatedTracking).not.toBeNull();
      expect(updatedTracking!.frequency).toBeDefined();
      expect(updatedTracking!.frequency).toEqual(dailyFrequency);

      // Verify old Upcoming reminder was deleted, but Pending and Answered are preserved
      const reminders = await testDb.all<{
        id: number;
        scheduled_time: string;
        status: string;
      }>(
        "SELECT id, scheduled_time, status FROM reminders WHERE tracking_id = ? AND user_id = ? ORDER BY scheduled_time",
        [trackingId, testUserId]
      );

      // Should have: 1 new recurring Upcoming + 1 Pending + 1 Answered = 3 total
      expect(reminders.length).toBe(3);

      // Verify Pending reminder is preserved
      const pendingReminders = reminders.filter(
        (r) => r.status === ReminderStatus.PENDING
      );
      expect(pendingReminders.length).toBe(1);
      expect(pendingReminders[0].id).toBe(pendingReminder.id);

      // Verify Answered reminder is preserved
      const answeredReminders = reminders.filter(
        (r) => r.status === ReminderStatus.ANSWERED
      );
      expect(answeredReminders.length).toBe(1);
      expect(answeredReminders[0].id).toBe(answeredReminder.id);

      // Verify new recurring Upcoming reminder was created
      const upcomingReminders = reminders.filter(
        (r) => r.status === ReminderStatus.UPCOMING
      );
      expect(upcomingReminders.length).toBe(1);
      // Verify it's a future date (recurring reminder)
      const newReminderDate = new Date(upcomingReminders[0].scheduled_time);
      expect(newReminderDate.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe("deleteTracking", () => {
    it("should delete tracking", async () => {
      const result = await testDb.run(
        "INSERT INTO trackings (user_id, question, frequency) VALUES (?, ?, ?)",
        [testUserId, "Question", JSON.stringify({ type: "daily" })]
      );
      const trackingId = result.lastID;

      await trackingService.deleteTracking(trackingId, testUserId);

      const tracking = await trackingService.getById(trackingId, testUserId);
      expect(tracking).toBeNull();
    });

    it("should throw error when tracking not found", async () => {
      await expect(
        trackingService.deleteTracking(999, testUserId)
      ).rejects.toThrow("Tracking not found");
    });

    it("should throw error when deleting tracking belonging to different user", async () => {
      const otherUserResult = await testDb.run(
        "INSERT INTO users (name, email) VALUES (?, ?)",
        ["Other User", "other@example.com"]
      );
      const otherUserId = otherUserResult.lastID;

      const result = await testDb.run(
        "INSERT INTO trackings (user_id, question, frequency) VALUES (?, ?, ?)",
        [otherUserId, "Question", JSON.stringify({ type: "daily" })]
      );
      const trackingId = result.lastID;

      await expect(
        trackingService.deleteTracking(trackingId, testUserId)
      ).rejects.toThrow("Tracking not found");
    });
  });

  describe("updateTrackingState", () => {
    it("should update tracking state from Running to Paused", async () => {
      const result = await testDb.run(
        "INSERT INTO trackings (user_id, question, state, frequency) VALUES (?, ?, ?, ?)",
        [
          testUserId,
          "Test Question",
          "Running",
          JSON.stringify({ type: "daily" }),
        ]
      );
      const trackingId = result.lastID;

      const updated = await trackingService.updateTrackingState(
        trackingId,
        testUserId,
        "Paused"
      );

      expect(updated.state).toBe(TrackingState.PAUSED);
      expect(updated.id).toBe(trackingId);
    });

    it("should update tracking state from Paused to Running", async () => {
      const result = await testDb.run(
        "INSERT INTO trackings (user_id, question, state, frequency) VALUES (?, ?, ?, ?)",
        [
          testUserId,
          "Test Question",
          "Paused",
          JSON.stringify({ type: "daily" }),
        ]
      );
      const trackingId = result.lastID;

      const updated = await trackingService.updateTrackingState(
        trackingId,
        testUserId,
        "Running"
      );

      expect(updated.state).toBe(TrackingState.RUNNING);
    });

    it("should update tracking state from Paused to Archived", async () => {
      const result = await testDb.run(
        "INSERT INTO trackings (user_id, question, state, frequency) VALUES (?, ?, ?, ?)",
        [
          testUserId,
          "Test Question",
          "Paused",
          JSON.stringify({ type: "daily" }),
        ]
      );
      const trackingId = result.lastID;

      const updated = await trackingService.updateTrackingState(
        trackingId,
        testUserId,
        "Archived"
      );

      expect(updated.state).toBe(TrackingState.ARCHIVED);
    });

    it("should throw error for same state transition", async () => {
      const result = await testDb.run(
        "INSERT INTO trackings (user_id, question, state, frequency) VALUES (?, ?, ?, ?)",
        [
          testUserId,
          "Test Question",
          "Running",
          JSON.stringify({ type: "daily" }),
        ]
      );
      const trackingId = result.lastID;

      await expect(
        trackingService.updateTrackingState(trackingId, testUserId, "Running")
      ).rejects.toThrow(TypeError);
    });

    it("should throw error when tracking not found", async () => {
      await expect(
        trackingService.updateTrackingState(999, testUserId, "Paused")
      ).rejects.toThrow("Tracking not found");
    });

    it("should throw error for tracking belonging to different user", async () => {
      const otherUserId = testUserId + 1;
      await testDb.run("INSERT INTO users (name, email) VALUES (?, ?)", [
        "Other User",
        "other@example.com",
      ]);

      const result = await testDb.run(
        "INSERT INTO trackings (user_id, question, state, frequency) VALUES (?, ?, ?, ?)",
        [
          otherUserId,
          "Other Question",
          "Running",
          JSON.stringify({ type: "daily" }),
        ]
      );
      const trackingId = result.lastID;

      await expect(
        trackingService.updateTrackingState(trackingId, testUserId, "Paused")
      ).rejects.toThrow("Tracking not found");
    });

    it("should throw error for invalid state value", async () => {
      const result = await testDb.run(
        "INSERT INTO trackings (user_id, question, state, frequency) VALUES (?, ?, ?, ?)",
        [
          testUserId,
          "Test Question",
          "Running",
          JSON.stringify({ type: "daily" }),
        ]
      );
      const trackingId = result.lastID;

      await expect(
        trackingService.updateTrackingState(
          trackingId,
          testUserId,
          "InvalidState"
        )
      ).rejects.toThrow(TypeError);
    });

    it("should delete Pending and Upcoming reminders when archiving", async () => {
      // Create tracking with schedule
      const trackingResult = await testDb.run(
        "INSERT INTO trackings (user_id, question, state, frequency) VALUES (?, ?, ?, ?)",
        [
          testUserId,
          "Test Question",
          "Running",
          JSON.stringify({
            type: "weekly",
            days: [1, 2, 3, 4, 5],
          }),
        ]
      );
      const trackingId = trackingResult.lastID;

      // Create schedule
      await testDb.run(
        "INSERT INTO tracking_schedules (tracking_id, hour, minutes) VALUES (?, ?, ?)",
        [trackingId, 10, 0]
      );

      // Create Pending reminder
      const pendingReminder = new Reminder({
        id: 0,
        tracking_id: trackingId,
        user_id: testUserId,
        scheduled_time: new Date(
          Date.now() + 24 * 60 * 60 * 1000
        ).toISOString(),
        status: ReminderStatus.PENDING,
        value: null,
      });
      await pendingReminder.save(testDb);

      // Create Upcoming reminder
      const upcomingReminder = new Reminder({
        id: 0,
        tracking_id: trackingId,
        user_id: testUserId,
        scheduled_time: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        status: ReminderStatus.UPCOMING,
        value: null,
      });
      await upcomingReminder.save(testDb);

      // Create Answered reminder (should not be deleted)
      const answeredReminder = new Reminder({
        id: 0,
        tracking_id: trackingId,
        user_id: testUserId,
        scheduled_time: new Date(
          Date.now() - 24 * 60 * 60 * 1000
        ).toISOString(),
        status: ReminderStatus.ANSWERED,
        value: ReminderValue.COMPLETED,
      });
      await answeredReminder.save(testDb);

      // Archive the tracking
      await trackingService.updateTrackingState(
        trackingId,
        testUserId,
        "Archived"
      );

      // Verify Pending and Upcoming reminders are deleted
      const pendingAfter = await Reminder.loadById(
        pendingReminder.id,
        testUserId,
        testDb
      );
      const upcomingAfter = await Reminder.loadById(
        upcomingReminder.id,
        testUserId,
        testDb
      );
      const answeredAfter = await Reminder.loadById(
        answeredReminder.id,
        testUserId,
        testDb
      );

      expect(pendingAfter).toBeNull();
      expect(upcomingAfter).toBeNull();
      expect(answeredAfter).not.toBeNull(); // Answered reminder should remain
    });

    it("should delete Upcoming reminders when pausing", async () => {
      // Create tracking with schedule
      const trackingResult = await testDb.run(
        "INSERT INTO trackings (user_id, question, state, frequency) VALUES (?, ?, ?, ?)",
        [
          testUserId,
          "Test Question",
          "Running",
          JSON.stringify({
            type: "weekly",
            days: [1, 2, 3, 4, 5],
          }),
        ]
      );
      const trackingId = trackingResult.lastID;

      // Create schedule
      await testDb.run(
        "INSERT INTO tracking_schedules (tracking_id, hour, minutes) VALUES (?, ?, ?)",
        [trackingId, 10, 0]
      );

      // Create future Pending reminder
      const pendingReminder = new Reminder({
        id: 0,
        tracking_id: trackingId,
        user_id: testUserId,
        scheduled_time: new Date(
          Date.now() + 24 * 60 * 60 * 1000
        ).toISOString(),
        status: ReminderStatus.PENDING,
        value: null,
      });
      await pendingReminder.save(testDb);

      // Create future Upcoming reminder
      const upcomingReminder = new Reminder({
        id: 0,
        tracking_id: trackingId,
        user_id: testUserId,
        scheduled_time: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        status: ReminderStatus.UPCOMING,
        value: null,
      });
      await upcomingReminder.save(testDb);

      // Create past-due Answered reminder (should be kept)
      const answeredReminder = new Reminder({
        id: 0,
        tracking_id: trackingId,
        user_id: testUserId,
        scheduled_time: new Date(
          Date.now() - 24 * 60 * 60 * 1000
        ).toISOString(),
        status: ReminderStatus.ANSWERED,
        value: ReminderValue.COMPLETED,
      });
      await answeredReminder.save(testDb);

      // Pause the tracking
      await trackingService.updateTrackingState(
        trackingId,
        testUserId,
        "Paused"
      );

      // Verify Upcoming reminders are deleted, but Pending and Answered are kept
      const pendingAfter = await Reminder.loadById(
        pendingReminder.id,
        testUserId,
        testDb
      );
      const upcomingAfter = await Reminder.loadById(
        upcomingReminder.id,
        testUserId,
        testDb
      );
      // Verify past-due Answered reminder is kept
      const answeredAfter = await Reminder.loadById(
        answeredReminder.id,
        testUserId,
        testDb
      );

      expect(upcomingAfter).toBeNull(); // Upcoming should be deleted
      expect(pendingAfter).not.toBeNull(); // Pending should remain
      expect(answeredAfter).not.toBeNull(); // Answered reminder should remain
    });

    it("should create next reminder when resuming from Paused", async () => {
      // Create tracking with schedule
      const trackingResult = await testDb.run(
        "INSERT INTO trackings (user_id, question, state, frequency) VALUES (?, ?, ?, ?)",
        [
          testUserId,
          "Test Question",
          "Paused",
          JSON.stringify({
            type: "weekly",
            days: [1, 2, 3, 4, 5],
          }),
        ]
      );
      const trackingId = trackingResult.lastID;

      // Create schedule
      await testDb.run(
        "INSERT INTO tracking_schedules (tracking_id, hour, minutes) VALUES (?, ?, ?)",
        [trackingId, 10, 0]
      );

      // Resume the tracking
      await trackingService.updateTrackingState(
        trackingId,
        testUserId,
        "Running"
      );

      // Verify a reminder was created (should be Upcoming if time is in future)
      const reminder = await Reminder.loadByTrackingId(
        trackingId,
        testUserId,
        testDb
      );
      expect(reminder).not.toBeNull();
      // The reminder should be Upcoming if scheduled time is in the future
      const scheduledTime = new Date(reminder!.scheduled_time);
      const now = new Date();
      if (scheduledTime > now) {
        expect(reminder!.status).toBe(ReminderStatus.UPCOMING);
      } else {
        expect(reminder!.status).toBe(ReminderStatus.PENDING);
      }
    });

    it("should create next reminder when unarchiving from Archived", async () => {
      // Create tracking with schedule
      const trackingResult = await testDb.run(
        "INSERT INTO trackings (user_id, question, state, frequency) VALUES (?, ?, ?, ?)",
        [
          testUserId,
          "Test Question",
          "Archived",
          JSON.stringify({
            type: "weekly",
            days: [1, 2, 3, 4, 5],
          }),
        ]
      );
      const trackingId = trackingResult.lastID;

      // Create schedule
      await testDb.run(
        "INSERT INTO tracking_schedules (tracking_id, hour, minutes) VALUES (?, ?, ?)",
        [trackingId, 10, 0]
      );

      // Unarchive the tracking
      await trackingService.updateTrackingState(
        trackingId,
        testUserId,
        "Running"
      );

      // Verify a reminder was created (should be Upcoming if time is in future)
      const reminder = await Reminder.loadByTrackingId(
        trackingId,
        testUserId,
        testDb
      );
      expect(reminder).not.toBeNull();
      // The reminder should be Upcoming if scheduled time is in the future
      const scheduledTime = new Date(reminder!.scheduled_time);
      const now = new Date();
      if (scheduledTime > now) {
        expect(reminder!.status).toBe(ReminderStatus.UPCOMING);
      } else {
        expect(reminder!.status).toBe(ReminderStatus.PENDING);
      }
    });

    it("should delete Pending and Upcoming reminders when transitioning from Running to Archived", async () => {
      // Create tracking with schedule
      const trackingResult = await testDb.run(
        "INSERT INTO trackings (user_id, question, state, frequency) VALUES (?, ?, ?, ?)",
        [
          testUserId,
          "Test Question",
          "Running",
          JSON.stringify({
            type: "weekly",
            days: [1, 2, 3, 4, 5],
          }),
        ]
      );
      const trackingId = trackingResult.lastID;

      // Create schedule
      await testDb.run(
        "INSERT INTO tracking_schedules (tracking_id, hour, minutes) VALUES (?, ?, ?)",
        [trackingId, 10, 0]
      );

      // Create Pending reminder
      const pendingReminder = new Reminder({
        id: 0,
        tracking_id: trackingId,
        user_id: testUserId,
        scheduled_time: new Date(
          Date.now() + 24 * 60 * 60 * 1000
        ).toISOString(),
        status: ReminderStatus.PENDING,
        value: null,
      });
      await pendingReminder.save(testDb);

      // Create Upcoming reminder
      const upcomingReminder = new Reminder({
        id: 0,
        tracking_id: trackingId,
        user_id: testUserId,
        scheduled_time: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        status: ReminderStatus.UPCOMING,
        value: null,
      });
      await upcomingReminder.save(testDb);

      // Create Answered reminder (should not be deleted)
      const answeredReminder = new Reminder({
        id: 0,
        tracking_id: trackingId,
        user_id: testUserId,
        scheduled_time: new Date(
          Date.now() - 24 * 60 * 60 * 1000
        ).toISOString(),
        status: ReminderStatus.ANSWERED,
        value: ReminderValue.COMPLETED,
      });
      await answeredReminder.save(testDb);

      // Archive the tracking
      await trackingService.updateTrackingState(
        trackingId,
        testUserId,
        "Archived"
      );

      // Verify Pending and Upcoming reminders are deleted
      const pendingAfter = await Reminder.loadById(
        pendingReminder.id,
        testUserId,
        testDb
      );
      const upcomingAfter = await Reminder.loadById(
        upcomingReminder.id,
        testUserId,
        testDb
      );
      const answeredAfter = await Reminder.loadById(
        answeredReminder.id,
        testUserId,
        testDb
      );

      expect(pendingAfter).toBeNull();
      expect(upcomingAfter).toBeNull();
      expect(answeredAfter).not.toBeNull(); // Answered reminder should remain
    });

    it("should delete Pending and Upcoming reminders when transitioning from Paused to Archived", async () => {
      // Create tracking with schedule
      const trackingResult = await testDb.run(
        "INSERT INTO trackings (user_id, question, state, frequency) VALUES (?, ?, ?, ?)",
        [
          testUserId,
          "Test Question",
          "Paused",
          JSON.stringify({
            type: "weekly",
            days: [1, 2, 3, 4, 5],
          }),
        ]
      );
      const trackingId = trackingResult.lastID;

      // Create schedule
      await testDb.run(
        "INSERT INTO tracking_schedules (tracking_id, hour, minutes) VALUES (?, ?, ?)",
        [trackingId, 10, 0]
      );

      // Create Pending reminder
      const pendingReminder = new Reminder({
        id: 0,
        tracking_id: trackingId,
        user_id: testUserId,
        scheduled_time: new Date(
          Date.now() + 24 * 60 * 60 * 1000
        ).toISOString(),
        status: ReminderStatus.PENDING,
        value: null,
      });
      await pendingReminder.save(testDb);

      // Create Answered reminder (should not be deleted)
      const answeredReminder = new Reminder({
        id: 0,
        tracking_id: trackingId,
        user_id: testUserId,
        scheduled_time: new Date(
          Date.now() - 24 * 60 * 60 * 1000
        ).toISOString(),
        status: ReminderStatus.ANSWERED,
        value: ReminderValue.COMPLETED,
      });
      await answeredReminder.save(testDb);

      // Archive the tracking
      await trackingService.updateTrackingState(
        trackingId,
        testUserId,
        "Archived"
      );

      // Verify Pending reminder is deleted
      const pendingAfter = await Reminder.loadById(
        pendingReminder.id,
        testUserId,
        testDb
      );
      const answeredAfter = await Reminder.loadById(
        answeredReminder.id,
        testUserId,
        testDb
      );

      expect(pendingAfter).toBeNull();
      expect(answeredAfter).not.toBeNull(); // Answered reminder should remain
    });
  });
});
