import { vi } from "vitest";
import sqlite3 from "sqlite3";
import { TrackingService } from "../trackingService.js";
import {
  TrackingType,
  TrackingState,
  DaysPatternType,
} from "../../models/Tracking.js";
import { Database } from "../../db/database.js";
import { Reminder, ReminderStatus } from "../../models/Reminder.js";

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
              last_access DATETIME,
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

  describe("getTrackingsByUserId", () => {
    it("should return empty array when no trackings exist", async () => {
      const trackings = await trackingService.getTrackingsByUserId(testUserId);
      expect(trackings).toEqual([]);
    });

    it("should return all trackings for a user", async () => {
      await testDb.run(
        "INSERT INTO trackings (user_id, question, type) VALUES (?, ?, ?)",
        [testUserId, "Question 1", TrackingType.TRUE_FALSE]
      );
      // Add small delay to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 10));
      await testDb.run(
        "INSERT INTO trackings (user_id, question, type) VALUES (?, ?, ?)",
        [testUserId, "Question 2", TrackingType.REGISTER]
      );

      const trackings = await trackingService.getTrackingsByUserId(testUserId);

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
        "INSERT INTO trackings (user_id, question, type) VALUES (?, ?, ?)",
        [testUserId, "My Question", TrackingType.TRUE_FALSE]
      );
      await testDb.run(
        "INSERT INTO trackings (user_id, question, type) VALUES (?, ?, ?)",
        [otherUserId, "Other Question", TrackingType.TRUE_FALSE]
      );

      const trackings = await trackingService.getTrackingsByUserId(testUserId);

      expect(trackings).toHaveLength(1);
      expect(trackings[0].question).toBe("My Question");
    });
  });

  describe("getTrackingById", () => {
    it("should return null for non-existent tracking", async () => {
      const tracking = await trackingService.getTrackingById(999, testUserId);
      expect(tracking).toBeNull();
    });

    it("should return tracking for existing id", async () => {
      const result = await testDb.run(
        "INSERT INTO trackings (user_id, question, type) VALUES (?, ?, ?)",
        [testUserId, "Test Question", TrackingType.TRUE_FALSE]
      );
      const trackingId = result.lastID;

      const tracking = await trackingService.getTrackingById(
        trackingId,
        testUserId
      );

      expect(tracking).not.toBeNull();
      expect(tracking?.id).toBe(trackingId);
      expect(tracking?.question).toBe("Test Question");
      expect(tracking?.type).toBe(TrackingType.TRUE_FALSE);
    });

    it("should return null for tracking belonging to different user", async () => {
      const otherUserResult = await testDb.run(
        "INSERT INTO users (name, email) VALUES (?, ?)",
        ["Other User", "other@example.com"]
      );
      const otherUserId = otherUserResult.lastID;

      const result = await testDb.run(
        "INSERT INTO trackings (user_id, question, type) VALUES (?, ?, ?)",
        [otherUserId, "Other Question", TrackingType.TRUE_FALSE]
      );
      const trackingId = result.lastID;

      const tracking = await trackingService.getTrackingById(
        trackingId,
        testUserId
      );

      expect(tracking).toBeNull();
    });
  });

  describe("createTracking", () => {
    it("should create a new tracking", async () => {
      const tracking = await trackingService.createTracking(
        testUserId,
        "Did I exercise today?",
        TrackingType.TRUE_FALSE,
        undefined,
        undefined,
        [{ hour: 9, minutes: 0 }]
      );

      expect(tracking).not.toBeNull();
      expect(tracking.question).toBe("Did I exercise today?");
      expect(tracking.type).toBe(TrackingType.TRUE_FALSE);
      expect(tracking.user_id).toBe(testUserId);
      expect(tracking.id).toBeGreaterThan(0);
      expect(tracking.schedules).toBeDefined();
      expect(tracking.schedules?.length).toBe(1);
      expect(tracking.schedules?.[0].hour).toBe(9);
      expect(tracking.schedules?.[0].minutes).toBe(0);
    });

    it("should create tracking with notes", async () => {
      const tracking = await trackingService.createTracking(
        testUserId,
        "Did I meditate?",
        TrackingType.TRUE_FALSE,
        "Meditation notes",
        undefined,
        [{ hour: 10, minutes: 30 }]
      );

      expect(tracking.notes).toBe("Meditation notes");
      expect(tracking.schedules).toBeDefined();
      expect(tracking.schedules?.length).toBe(1);
    });

    it("should throw error for invalid question", async () => {
      await expect(
        trackingService.createTracking(
          testUserId,
          "",
          TrackingType.TRUE_FALSE,
          undefined,
          undefined,
          [{ hour: 9, minutes: 0 }]
        )
      ).rejects.toThrow();
    });

    it("should throw error for invalid type", async () => {
      await expect(
        trackingService.createTracking(
          testUserId,
          "Valid question",
          "invalid_type",
          undefined,
          undefined,
          [{ hour: 9, minutes: 0 }]
        )
      ).rejects.toThrow();
    });

    it("should throw error when no schedules provided", async () => {
      await expect(
        trackingService.createTracking(
          testUserId,
          "Valid question",
          TrackingType.TRUE_FALSE
        )
      ).rejects.toThrow("At least one schedule is required");
    });

    it("should create initial Upcoming reminder when tracking is created with times and days pattern", async () => {
      const tracking = await trackingService.createTracking(
        testUserId,
        "Did I exercise today?",
        TrackingType.TRUE_FALSE,
        undefined,
        undefined,
        [{ hour: 9, minutes: 0 }],
        {
          pattern_type: DaysPatternType.DAY_OF_WEEK,
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

    it("should not create reminder when tracking is created without days pattern", async () => {
      const tracking = await trackingService.createTracking(
        testUserId,
        "Did I exercise today?",
        TrackingType.TRUE_FALSE,
        undefined,
        undefined,
        [{ hour: 9, minutes: 0 }]
        // No days pattern
      );

      expect(tracking).not.toBeNull();

      // Verify no reminder was created
      const reminder = await Reminder.loadByTrackingId(
        tracking.id!,
        testUserId,
        testDb
      );
      expect(reminder).toBeNull();
    });
  });

  describe("updateTracking", () => {
    it("should update tracking question", async () => {
      const result = await testDb.run(
        "INSERT INTO trackings (user_id, question, type) VALUES (?, ?, ?)",
        [testUserId, "Old Question", TrackingType.TRUE_FALSE]
      );
      const trackingId = result.lastID;

      const updated = await trackingService.updateTracking(
        trackingId,
        testUserId,
        "New Question"
      );

      expect(updated.question).toBe("New Question");
    });

    it("should update tracking type", async () => {
      const result = await testDb.run(
        "INSERT INTO trackings (user_id, question, type) VALUES (?, ?, ?)",
        [testUserId, "Question", TrackingType.TRUE_FALSE]
      );
      const trackingId = result.lastID;

      const updated = await trackingService.updateTracking(
        trackingId,
        testUserId,
        undefined,
        TrackingType.REGISTER
      );

      expect(updated.type).toBe(TrackingType.REGISTER);
    });

    it("should throw error when tracking not found", async () => {
      await expect(
        trackingService.updateTracking(999, testUserId, "New Question")
      ).rejects.toThrow("Tracking not found");
    });

    it("should throw error when updating tracking belonging to different user", async () => {
      const otherUserResult = await testDb.run(
        "INSERT INTO users (name, email) VALUES (?, ?)",
        ["Other User", "other@example.com"]
      );
      const otherUserId = otherUserResult.lastID;

      const result = await testDb.run(
        "INSERT INTO trackings (user_id, question, type) VALUES (?, ?, ?)",
        [otherUserId, "Question", TrackingType.TRUE_FALSE]
      );
      const trackingId = result.lastID;

      await expect(
        trackingService.updateTracking(trackingId, testUserId, "New Question")
      ).rejects.toThrow("Tracking not found");
    });

    it("should throw error when no fields to update", async () => {
      const result = await testDb.run(
        "INSERT INTO trackings (user_id, question, type) VALUES (?, ?, ?)",
        [testUserId, "Question", TrackingType.TRUE_FALSE]
      );
      const trackingId = result.lastID;

      await expect(
        trackingService.updateTracking(trackingId, testUserId)
      ).rejects.toThrow("No fields to update");
    });

    it("should update or create Upcoming reminder when schedules change and tracking is Running", async () => {
      // Create tracking with schedule and days pattern
      const trackingResult = await testDb.run(
        "INSERT INTO trackings (user_id, question, type, state, days) VALUES (?, ?, ?, ?, ?)",
        [
          testUserId,
          "Test Question",
          TrackingType.TRUE_FALSE,
          "Running",
          JSON.stringify({
            pattern_type: "day_of_week",
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
      });
      await existingUpcoming.save(testDb);

      // Update tracking with new schedule
      await trackingService.updateTracking(
        trackingId,
        testUserId,
        undefined,
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
      // Create tracking with schedule and days pattern
      const trackingResult = await testDb.run(
        "INSERT INTO trackings (user_id, question, type, state, days) VALUES (?, ?, ?, ?, ?)",
        [
          testUserId,
          "Test Question",
          TrackingType.TRUE_FALSE,
          "Running",
          JSON.stringify({
            pattern_type: "day_of_week",
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

    it("should update Upcoming reminder when days pattern changes and tracking is Running", async () => {
      // Create tracking with schedule and days pattern
      const trackingResult = await testDb.run(
        "INSERT INTO trackings (user_id, question, type, state, days) VALUES (?, ?, ?, ?, ?)",
        [
          testUserId,
          "Test Question",
          TrackingType.TRUE_FALSE,
          "Running",
          JSON.stringify({
            pattern_type: "day_of_week",
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
      });
      await existingUpcoming.save(testDb);

      // Update tracking with new days pattern
      await trackingService.updateTracking(
        trackingId,
        testUserId,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        {
          pattern_type: DaysPatternType.DAY_OF_WEEK,
          days: [0, 6], // Weekends instead
        }
      );

      // Verify the Upcoming reminder was updated or replaced
      const updatedUpcoming = await Reminder.loadUpcomingByTrackingId(
        trackingId,
        testUserId,
        testDb
      );
      expect(updatedUpcoming).not.toBeNull();
    });
  });

  describe("deleteTracking", () => {
    it("should delete tracking", async () => {
      const result = await testDb.run(
        "INSERT INTO trackings (user_id, question, type) VALUES (?, ?, ?)",
        [testUserId, "Question", TrackingType.TRUE_FALSE]
      );
      const trackingId = result.lastID;

      await trackingService.deleteTracking(trackingId, testUserId);

      const tracking = await trackingService.getTrackingById(
        trackingId,
        testUserId
      );
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
        "INSERT INTO trackings (user_id, question, type) VALUES (?, ?, ?)",
        [otherUserId, "Question", TrackingType.TRUE_FALSE]
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
        "INSERT INTO trackings (user_id, question, type, state) VALUES (?, ?, ?, ?)",
        [testUserId, "Test Question", TrackingType.TRUE_FALSE, "Running"]
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
        "INSERT INTO trackings (user_id, question, type, state) VALUES (?, ?, ?, ?)",
        [testUserId, "Test Question", TrackingType.TRUE_FALSE, "Paused"]
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
        "INSERT INTO trackings (user_id, question, type, state) VALUES (?, ?, ?, ?)",
        [testUserId, "Test Question", TrackingType.TRUE_FALSE, "Paused"]
      );
      const trackingId = result.lastID;

      const updated = await trackingService.updateTrackingState(
        trackingId,
        testUserId,
        "Archived"
      );

      expect(updated.state).toBe(TrackingState.ARCHIVED);
    });

    it("should update tracking state from Archived to Deleted", async () => {
      const result = await testDb.run(
        "INSERT INTO trackings (user_id, question, type, state) VALUES (?, ?, ?, ?)",
        [testUserId, "Test Question", TrackingType.TRUE_FALSE, "Archived"]
      );
      const trackingId = result.lastID;

      const updated = await trackingService.updateTrackingState(
        trackingId,
        testUserId,
        "Deleted"
      );

      expect(updated.state).toBe(TrackingState.DELETED);
    });

    it("should throw error for same state transition", async () => {
      const result = await testDb.run(
        "INSERT INTO trackings (user_id, question, type, state) VALUES (?, ?, ?, ?)",
        [testUserId, "Test Question", TrackingType.TRUE_FALSE, "Running"]
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
        "INSERT INTO trackings (user_id, question, type, state) VALUES (?, ?, ?, ?)",
        [otherUserId, "Other Question", TrackingType.TRUE_FALSE, "Running"]
      );
      const trackingId = result.lastID;

      await expect(
        trackingService.updateTrackingState(trackingId, testUserId, "Paused")
      ).rejects.toThrow("Tracking not found");
    });

    it("should throw error for invalid state value", async () => {
      const result = await testDb.run(
        "INSERT INTO trackings (user_id, question, type, state) VALUES (?, ?, ?, ?)",
        [testUserId, "Test Question", TrackingType.TRUE_FALSE, "Running"]
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
        "INSERT INTO trackings (user_id, question, type, state, days) VALUES (?, ?, ?, ?, ?)",
        [
          testUserId,
          "Test Question",
          TrackingType.TRUE_FALSE,
          "Running",
          JSON.stringify({
            pattern_type: "day_of_week",
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
      });
      await pendingReminder.save(testDb);

      // Create Upcoming reminder
      const upcomingReminder = new Reminder({
        id: 0,
        tracking_id: trackingId,
        user_id: testUserId,
        scheduled_time: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        status: ReminderStatus.UPCOMING,
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
        "INSERT INTO trackings (user_id, question, type, state, days) VALUES (?, ?, ?, ?, ?)",
        [
          testUserId,
          "Test Question",
          TrackingType.TRUE_FALSE,
          "Running",
          JSON.stringify({
            pattern_type: "day_of_week",
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
      });
      await pendingReminder.save(testDb);

      // Create future Upcoming reminder
      const upcomingReminder = new Reminder({
        id: 0,
        tracking_id: trackingId,
        user_id: testUserId,
        scheduled_time: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        status: ReminderStatus.UPCOMING,
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
        answer: "Yes",
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
        "INSERT INTO trackings (user_id, question, type, state, days) VALUES (?, ?, ?, ?, ?)",
        [
          testUserId,
          "Test Question",
          TrackingType.TRUE_FALSE,
          "Paused",
          JSON.stringify({
            pattern_type: "day_of_week",
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
        "INSERT INTO trackings (user_id, question, type, state, days) VALUES (?, ?, ?, ?, ?)",
        [
          testUserId,
          "Test Question",
          TrackingType.TRUE_FALSE,
          "Archived",
          JSON.stringify({
            pattern_type: "day_of_week",
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
        "INSERT INTO trackings (user_id, question, type, state, days) VALUES (?, ?, ?, ?, ?)",
        [
          testUserId,
          "Test Question",
          TrackingType.TRUE_FALSE,
          "Running",
          JSON.stringify({
            pattern_type: "day_of_week",
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
      });
      await pendingReminder.save(testDb);

      // Create Upcoming reminder
      const upcomingReminder = new Reminder({
        id: 0,
        tracking_id: trackingId,
        user_id: testUserId,
        scheduled_time: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        status: ReminderStatus.UPCOMING,
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
        answer: "Yes",
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
        "INSERT INTO trackings (user_id, question, type, state, days) VALUES (?, ?, ?, ?, ?)",
        [
          testUserId,
          "Test Question",
          TrackingType.TRUE_FALSE,
          "Paused",
          JSON.stringify({
            pattern_type: "day_of_week",
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
        answer: "Yes",
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
