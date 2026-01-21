import { vi } from "vitest";
import BetterSqlite3 from "better-sqlite3";
import { ReminderService } from "../reminderService.js";
import {
  Reminder,
  ReminderStatus,
  ReminderValue,
} from "../../models/Reminder.js";
import { Frequency } from "../../models/Tracking.js";
import { Database } from "../../db/database.js";
import { TrackingSchedule } from "../../models/TrackingSchedule.js";
import { ServiceManager } from "../index.js";

// Mock EmailService and TelegramService to avoid sending actual notifications during tests
const { mockFunctions } = vi.hoisted(() => ({
  mockFunctions: {
    sendReminderEmail: vi.fn().mockResolvedValue(undefined),
    sendReminderMessage: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("../emailService.js", () => {
  class EmailServiceMock {
    sendReminderEmail = mockFunctions.sendReminderEmail;
  }
  return {
    EmailService: EmailServiceMock,
  };
});

vi.mock("../telegramService.js", () => {
  class TelegramServiceMock {
    sendReminderMessage = mockFunctions.sendReminderMessage;
  }
  return {
    TelegramService: TelegramServiceMock,
  };
});

/**
 * Create an in-memory database for testing.
 * @returns Promise resolving to Database instance
 */
async function createTestDatabase(): Promise<Database> {
  return new Promise((resolve, reject) => {
    const db = new BetterSqlite3(":memory:");
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
              pending_email TEXT,
              email_verification_token TEXT,
              email_verification_expires DATETIME,
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
    // Initialize ServiceManager so that ReminderService can use mocked services
    ServiceManager.initializeServices(testDb);

    // Mock ServiceManager to return mocked services
    const emailServiceMock = {
      sendReminderEmail: mockFunctions.sendReminderEmail,
    };
    const telegramServiceMock = {
      sendReminderMessage: mockFunctions.sendReminderMessage,
    };

    vi.spyOn(ServiceManager, "getEmailService").mockImplementation(
      () => emailServiceMock as any
    );
    vi.spyOn(ServiceManager, "getTelegramService").mockImplementation(
      () => telegramServiceMock as any
    );

    reminderService = new ReminderService(testDb);

    // Clear mock calls
    mockFunctions.sendReminderEmail.mockClear();
    mockFunctions.sendReminderMessage.mockClear();

    const userResult = await testDb.run(
      "INSERT INTO users (name, email) VALUES (?, ?)",
      ["Test User", "test@example.com"]
    );
    testUserId = userResult.lastID;

    const trackingResult = await testDb.run(
      "INSERT INTO trackings (user_id, question, frequency, state) VALUES (?, ?, ?, ?)",
      [
        testUserId,
        "Did I exercise?",
        JSON.stringify({ type: "daily" }),
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
    vi.clearAllMocks();
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

  describe("getAllByUserId", () => {
    it("should delete orphaned reminders (reminders whose tracking no longer exists)", async () => {
      // Create a tracking
      const trackingResult = await testDb.run(
        "INSERT INTO trackings (user_id, question, frequency, state) VALUES (?, ?, ?, ?)",
        [
          testUserId,
          "Test Question",
          JSON.stringify({ type: "daily" }),
          "Running",
        ]
      );
      const trackingId = trackingResult.lastID;

      // Create a schedule
      await testDb.run(
        "INSERT INTO tracking_schedules (tracking_id, hour, minutes) VALUES (?, ?, ?)",
        [trackingId, 9, 0]
      );

      // Create a reminder for this tracking
      const reminder = await reminderService.createReminder(
        trackingId,
        testUserId,
        new Date().toISOString()
      );

      // Verify reminder exists
      const beforeReminder = await Reminder.loadById(
        reminder.id,
        testUserId,
        testDb
      );
      expect(beforeReminder).not.toBeNull();

      // Delete the tracking (making the reminder orphaned)
      await testDb.run("DELETE FROM trackings WHERE id = ?", [trackingId]);

      // Fetch reminders - should detect and delete orphaned reminder
      const reminders = await reminderService.getAllByUserId(testUserId);

      // Verify orphaned reminder was deleted
      const afterReminder = await Reminder.loadById(
        reminder.id,
        testUserId,
        testDb
      );
      expect(afterReminder).toBeNull();

      // Verify orphaned reminder is not in the returned list
      const orphanedInList = reminders.find((r) => r.id === reminder.id);
      expect(orphanedInList).toBeUndefined();
    });
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

      const reminders = await reminderService.getAllByUserId(testUserId);

      expect(reminders.length).toBe(2);
      expect(reminders[0].scheduled_time).toBe(scheduledTime1);
      expect(reminders[1].scheduled_time).toBe(scheduledTime2);
    });

    it("should exclude Answered reminders from results", async () => {
      const pendingTime = new Date(Date.now() - 3600000).toISOString(); // 1 hour ago
      const upcomingTime = new Date(Date.now() + 3600000).toISOString(); // 1 hour from now
      const pastTime = new Date(Date.now() - 7200000).toISOString(); // 2 hours ago

      // Create a Pending reminder
      const pendingReminder = await reminderService.createReminder(
        testTrackingId,
        testUserId,
        pendingTime
      );

      // Create an Upcoming reminder
      const upcomingReminder = await reminderService.createReminder(
        testTrackingId,
        testUserId,
        upcomingTime
      );

      // Create an Answered reminder directly in the database (simulating a completed reminder)
      const answeredReminder = new Reminder({
        id: 0,
        tracking_id: testTrackingId,
        user_id: testUserId,
        scheduled_time: pastTime,
        status: ReminderStatus.ANSWERED,
        value: ReminderValue.COMPLETED,
      });
      await answeredReminder.save(testDb);

      // Fetch reminders - should exclude Answered
      const reminders = await reminderService.getAllByUserId(testUserId);

      // Should only return Pending and Upcoming, not Answered
      expect(reminders.length).toBe(2);
      expect(reminders.some((r) => r.id === pendingReminder.id)).toBe(true);
      expect(reminders.some((r) => r.id === upcomingReminder.id)).toBe(true);
      expect(reminders.some((r) => r.id === answeredReminder.id)).toBe(false);
      expect(reminders.some((r) => r.status === ReminderStatus.ANSWERED)).toBe(
        false
      );
    });

    it("should update expired upcoming reminders to Pending and create new Upcoming reminder", async () => {
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

      // Fetch reminders - should update expired upcoming reminder to Pending and create new Upcoming reminder
      const reminders = await reminderService.getAllByUserId(testUserId);

      const updatedReminder = reminders.find((r) => r.id === created.id);
      expect(updatedReminder).not.toBeUndefined();
      expect(updatedReminder!.status).toBe(ReminderStatus.PENDING);

      // Verify a new Upcoming reminder was created for the tracking
      const upcomingReminders = reminders.filter(
        (r) =>
          r.tracking_id === testTrackingId &&
          r.status === ReminderStatus.UPCOMING &&
          r.id !== created.id
      );
      expect(upcomingReminders.length).toBe(1);
      expect(
        new Date(upcomingReminders[0].scheduled_time).getTime()
      ).toBeGreaterThan(Date.now());
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
      const reminders = await reminderService.getAllByUserId(testUserId);
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

  describe("getById", () => {
    it("should get a reminder by ID", async () => {
      const scheduledTime = new Date().toISOString();
      const created = await reminderService.createReminder(
        testTrackingId,
        testUserId,
        scheduledTime
      );

      const reminder = await reminderService.getById(created.id, testUserId);

      expect(reminder).not.toBeNull();
      expect(reminder!.id).toBe(created.id);
    });

    it("should return null if reminder not found", async () => {
      const reminder = await reminderService.getById(999, testUserId);

      expect(reminder).toBeNull();
    });

    it("should update expired upcoming reminder to Pending and create new Upcoming reminder", async () => {
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

      // Fetch reminder by ID - should update expired upcoming reminder to Pending and create new Upcoming reminder
      const reminder = await reminderService.getById(created.id, testUserId);

      expect(reminder).not.toBeNull();
      expect(reminder!.status).toBe(ReminderStatus.PENDING);

      // Verify a new Upcoming reminder was created for the tracking
      const allReminders = await reminderService.getAllByUserId(testUserId);
      const upcomingReminders = allReminders.filter(
        (r) =>
          r.tracking_id === testTrackingId &&
          r.status === ReminderStatus.UPCOMING &&
          r.id !== created.id
      );
      expect(upcomingReminders.length).toBe(1);
      expect(
        new Date(upcomingReminders[0].scheduled_time).getTime()
      ).toBeGreaterThan(Date.now());
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
          notes: "Some notes",
        }
      );

      expect(updated.notes).toBe("Some notes");
      expect(updated.status).toBe(ReminderStatus.PENDING); // Status unchanged when only updating notes
    });

    it("should create next Upcoming reminder when reminder is completed", async () => {
      const scheduledTime = new Date().toISOString();
      const created = await reminderService.createReminder(
        testTrackingId,
        testUserId,
        scheduledTime
      );

      // Verify no Upcoming reminder exists before completing
      const beforeUpcoming = await Reminder.loadUpcomingByTrackingId(
        testTrackingId,
        testUserId,
        testDb
      );
      expect(beforeUpcoming).toBeNull();

      // Complete the reminder
      const completed = await reminderService.completeReminder(
        created.id,
        testUserId
      );

      // Verify the reminder was completed
      expect(completed.status).toBe(ReminderStatus.ANSWERED);
      expect(completed.value).toBe(ReminderValue.COMPLETED);

      // Verify a new Upcoming reminder was created
      const afterUpcoming = await Reminder.loadUpcomingByTrackingId(
        testTrackingId,
        testUserId,
        testDb
      );
      expect(afterUpcoming).not.toBeNull();
      expect(afterUpcoming!.status).toBe(ReminderStatus.UPCOMING);
      expect(afterUpcoming!.scheduled_time).not.toBe(scheduledTime);
    });

    it("should throw error if reminder not found", async () => {
      await expect(
        reminderService.updateReminder(999, testUserId, {
          notes: "Some notes",
        })
      ).rejects.toThrow("Reminder not found");
    });
  });

  describe("snoozeReminder", () => {
    it("should update existing Upcoming reminder time when snoozing a Pending reminder", async () => {
      // Create a Pending reminder
      const pendingTime = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 1 hour ago
      const pendingReminder = await reminderService.createReminder(
        testTrackingId,
        testUserId,
        pendingTime
      );
      expect(pendingReminder.status).toBe(ReminderStatus.PENDING);

      // Create an existing Upcoming reminder
      const upcomingTime = new Date(
        Date.now() + 2 * 60 * 60 * 1000
      ).toISOString(); // 2 hours from now
      const existingUpcoming = await reminderService.createReminder(
        testTrackingId,
        testUserId,
        upcomingTime
      );
      expect(existingUpcoming.status).toBe(ReminderStatus.UPCOMING);

      const originalUpcomingTime = existingUpcoming.scheduled_time;

      // Snooze the Pending reminder
      const snoozed = await reminderService.snoozeReminder(
        pendingReminder.id,
        testUserId,
        30
      );

      // Verify the existing Upcoming reminder's time was updated
      expect(snoozed.id).toBe(existingUpcoming.id);
      expect(snoozed.status).toBe(ReminderStatus.UPCOMING);
      const snoozedTime = new Date(snoozed.scheduled_time);
      const now = new Date();
      const diffMinutes = (snoozedTime.getTime() - now.getTime()) / (1000 * 60);
      expect(diffMinutes).toBeGreaterThanOrEqual(29); // Should be around 30 minutes
      expect(diffMinutes).toBeLessThan(31);
      expect(snoozed.scheduled_time).not.toBe(originalUpcomingTime);

      // Verify the Pending reminder was deleted after snoozing
      const pendingAfter = await Reminder.loadById(
        pendingReminder.id,
        testUserId,
        testDb
      );
      expect(pendingAfter).toBeNull();
    });

    it("should create new Upcoming reminder when snoozing if no existing Upcoming", async () => {
      // Create a Pending reminder
      const pendingTime = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const pendingReminder = await reminderService.createReminder(
        testTrackingId,
        testUserId,
        pendingTime
      );
      expect(pendingReminder.status).toBe(ReminderStatus.PENDING);

      // Verify no Upcoming reminder exists
      const beforeUpcoming = await Reminder.loadUpcomingByTrackingId(
        testTrackingId,
        testUserId,
        testDb
      );
      expect(beforeUpcoming).toBeNull();

      // Snooze the Pending reminder
      const snoozed = await reminderService.snoozeReminder(
        pendingReminder.id,
        testUserId,
        30
      );

      // Verify a new Upcoming reminder was created
      expect(snoozed.status).toBe(ReminderStatus.UPCOMING);
      expect(snoozed.id).not.toBe(pendingReminder.id);
      const snoozedTime = new Date(snoozed.scheduled_time);
      const now = new Date();
      const diffMinutes = (snoozedTime.getTime() - now.getTime()) / (1000 * 60);
      expect(diffMinutes).toBeGreaterThanOrEqual(29);
      expect(diffMinutes).toBeLessThan(31);

      // Verify the Pending reminder was deleted after snoozing
      const pendingAfter = await Reminder.loadById(
        pendingReminder.id,
        testUserId,
        testDb
      );
      expect(pendingAfter).toBeNull();
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

      const deleted = await reminderService.getById(created.id, testUserId);
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

    it("should update existing upcoming reminder instead of deleting it", async () => {
      // Create a pending reminder to delete
      const scheduledTime = new Date(Date.now() - 3600000).toISOString(); // 1 hour ago
      const pendingReminder = await reminderService.createReminder(
        testTrackingId,
        testUserId,
        scheduledTime
      );

      // Create an upcoming reminder that should be updated
      const upcomingTime = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 minutes from now
      const upcomingReminder = new Reminder({
        id: 0,
        tracking_id: testTrackingId,
        user_id: testUserId,
        scheduled_time: upcomingTime,
        status: ReminderStatus.UPCOMING,
        value: null,
      });
      await upcomingReminder.save(testDb);
      const upcomingReminderId = upcomingReminder.id;

      // Verify upcoming reminder exists
      const beforeUpcoming = await Reminder.loadUpcomingByTrackingId(
        testTrackingId,
        testUserId,
        testDb
      );
      expect(beforeUpcoming).not.toBeNull();
      expect(beforeUpcoming!.id).toBe(upcomingReminderId);
      expect(beforeUpcoming!.scheduled_time).toBe(upcomingTime);

      // Delete the pending reminder
      await reminderService.deleteReminder(pendingReminder.id, testUserId);

      // Verify the pending reminder was deleted
      const deletedPending = await Reminder.loadById(
        pendingReminder.id,
        testUserId,
        testDb
      );
      expect(deletedPending).toBeNull();

      // Verify the upcoming reminder was updated (not deleted) with a new time
      const afterUpcoming = await Reminder.loadUpcomingByTrackingId(
        testTrackingId,
        testUserId,
        testDb
      );
      expect(afterUpcoming).not.toBeNull();
      expect(afterUpcoming!.id).toBe(upcomingReminderId); // Same ID, not deleted
      expect(afterUpcoming!.scheduled_time).not.toBe(upcomingTime); // Time was updated
      expect(afterUpcoming!.status).toBe(ReminderStatus.UPCOMING); // Status should remain UPCOMING if new time is in future
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
        "INSERT INTO trackings (user_id, question, frequency, state) VALUES (?, ?, ?, ?)",
        [
          testUserId,
          "Test tracking",
          JSON.stringify({ type: "daily" }),
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
        value: null,
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
        value: null,
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
    it("should calculate next reminder time for daily frequency", async () => {
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
        frequency: { type: "daily" } as Frequency,
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
        frequency: { type: "daily" } as Frequency,
        schedules: [],
        state: "Running" as const,
      };

      const nextTime = await reminderService.calculateNextReminderTime(
        trackingData as any
      );

      expect(nextTime).toBeNull();
    });

    it("should return null if tracking has no frequency", async () => {
      const schedules = await testDb.all(
        "SELECT * FROM tracking_schedules WHERE tracking_id = ?",
        [testTrackingId]
      );

      const trackingData = {
        id: testTrackingId,
        user_id: testUserId,
        question: "Did I exercise?",
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
        frequency: { type: "daily" } as Frequency,
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

    it("should calculate next reminder time for one-time tracking with multiple schedules", async () => {
      // Create a one-time tracking with multiple schedules
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      const dateString = futureDate.toISOString().split("T")[0]; // YYYY-MM-DD

      const oneTimeTrackingResult = await testDb.run(
        "INSERT INTO trackings (user_id, question, frequency, state) VALUES (?, ?, ?, ?)",
        [
          testUserId,
          "One-time task",
          JSON.stringify({ type: "one-time", date: dateString }),
          "Running",
        ]
      );
      const oneTimeTrackingId = oneTimeTrackingResult.lastID;

      // Create multiple schedules: 9:00, 12:00, 18:00
      const schedule1 = new TrackingSchedule({
        id: 0,
        tracking_id: oneTimeTrackingId,
        hour: 9,
        minutes: 0,
      });
      await schedule1.save(testDb);

      const schedule2 = new TrackingSchedule({
        id: 0,
        tracking_id: oneTimeTrackingId,
        hour: 12,
        minutes: 0,
      });
      await schedule2.save(testDb);

      const schedule3 = new TrackingSchedule({
        id: 0,
        tracking_id: oneTimeTrackingId,
        hour: 18,
        minutes: 0,
      });
      await schedule3.save(testDb);

      const schedules = await testDb.all(
        "SELECT * FROM tracking_schedules WHERE tracking_id = ?",
        [oneTimeTrackingId]
      );

      const trackingData = {
        id: oneTimeTrackingId,
        user_id: testUserId,
        question: "One-time task",
        frequency: { type: "one-time", date: dateString } as Frequency,
        schedules: schedules.map((s: any) => ({
          id: s.id,
          tracking_id: s.tracking_id,
          hour: s.hour,
          minutes: s.minutes,
        })),
        state: "Running" as const,
      };

      // First call should return the earliest time (9:00)
      const firstNextTime = await reminderService.calculateNextReminderTime(
        trackingData as any
      );
      expect(firstNextTime).not.toBeNull();
      const firstDate = new Date(firstNextTime!);
      expect(firstDate.getHours()).toBe(9);
      expect(firstDate.getMinutes()).toBe(0);

      // Create a reminder for 9:00
      await reminderService.createReminder(
        oneTimeTrackingId,
        testUserId,
        firstNextTime!
      );

      // Second call should return the next time (12:00)
      const secondNextTime = await reminderService.calculateNextReminderTime(
        trackingData as any
      );
      expect(secondNextTime).not.toBeNull();
      const secondDate = new Date(secondNextTime!);
      expect(secondDate.getHours()).toBe(12);
      expect(secondDate.getMinutes()).toBe(0);

      // Create a reminder for 12:00
      await reminderService.createReminder(
        oneTimeTrackingId,
        testUserId,
        secondNextTime!
      );

      // Third call should return the last time (18:00)
      const thirdNextTime = await reminderService.calculateNextReminderTime(
        trackingData as any
      );
      expect(thirdNextTime).not.toBeNull();
      const thirdDate = new Date(thirdNextTime!);
      expect(thirdDate.getHours()).toBe(18);
      expect(thirdDate.getMinutes()).toBe(0);

      // Create a reminder for 18:00
      await reminderService.createReminder(
        oneTimeTrackingId,
        testUserId,
        thirdNextTime!
      );

      // Fourth call should return null (all times used)
      const fourthNextTime = await reminderService.calculateNextReminderTime(
        trackingData as any
      );
      expect(fourthNextTime).toBeNull();
    });

    it("should exclude time when calculating next one-time reminder", async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      const dateString = futureDate.toISOString().split("T")[0];

      const oneTimeTrackingResult = await testDb.run(
        "INSERT INTO trackings (user_id, question, frequency, state) VALUES (?, ?, ?, ?)",
        [
          testUserId,
          "One-time task",
          JSON.stringify({ type: "one-time", date: dateString }),
          "Running",
        ]
      );
      const oneTimeTrackingId = oneTimeTrackingResult.lastID;

      const schedule1 = new TrackingSchedule({
        id: 0,
        tracking_id: oneTimeTrackingId,
        hour: 9,
        minutes: 0,
      });
      await schedule1.save(testDb);

      const schedule2 = new TrackingSchedule({
        id: 0,
        tracking_id: oneTimeTrackingId,
        hour: 12,
        minutes: 0,
      });
      await schedule2.save(testDb);

      const schedules = await testDb.all(
        "SELECT * FROM tracking_schedules WHERE tracking_id = ?",
        [oneTimeTrackingId]
      );

      const trackingData = {
        id: oneTimeTrackingId,
        user_id: testUserId,
        question: "One-time task",
        frequency: { type: "one-time", date: dateString } as Frequency,
        schedules: schedules.map((s: any) => ({
          id: s.id,
          tracking_id: s.tracking_id,
          hour: s.hour,
          minutes: s.minutes,
        })),
        state: "Running" as const,
      };

      // Exclude 9:00, should return 12:00
      const excludeTime = `${dateString}T09:00:00`;
      const nextTime = await reminderService.calculateNextReminderTime(
        trackingData as any,
        new Date(excludeTime).toISOString()
      );

      expect(nextTime).not.toBeNull();
      const nextDate = new Date(nextTime!);
      expect(nextDate.getHours()).toBe(12);
      expect(nextDate.getMinutes()).toBe(0);
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
        frequency: {
          type: "weekly",
          days: [1, 3, 5], // Monday, Wednesday, Friday
        } as Frequency,
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
        frequency: {
          type: "monthly",
          kind: "day_number",
          day_numbers: [nextDay],
        } as Frequency,
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
        frequency: {
          type: "monthly",
          kind: "last_day",
        } as Frequency,
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
        frequency: {
          type: "yearly",
          kind: "date",
          month: 12,
          day: 25, // December 25
        } as Frequency,
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
  });

  describe("sendReminderNotifications", () => {
    it("should send email notification when user has Email channel selected", async () => {
      // Update user to have Email notification channel
      await testDb.run(
        "UPDATE users SET notification_channels = ? WHERE id = ?",
        ["Email", testUserId]
      );

      // Create a reminder with past scheduled time (will be PENDING and trigger notifications)
      const pastTime = new Date(Date.now() - 60000).toISOString();
      await reminderService.createReminder(
        testTrackingId,
        testUserId,
        pastTime
      );

      // Verify email was sent
      expect(mockFunctions.sendReminderEmail).toHaveBeenCalledTimes(1);
      expect(mockFunctions.sendReminderMessage).not.toHaveBeenCalled();

      // Verify email was called with correct parameters
      const emailCallArgs = mockFunctions.sendReminderEmail.mock.calls[0];
      expect(emailCallArgs[0]).toBe("test@example.com");
      expect(emailCallArgs[1]).toBeGreaterThan(0); // reminder ID
      expect(emailCallArgs[2]).toBe("Did I exercise?"); // tracking question
    });

    it("should send Telegram notification when user has Telegram channel selected", async () => {
      // Update user to have Telegram notification channel and chat ID
      await testDb.run(
        "UPDATE users SET notification_channels = ?, telegram_chat_id = ? WHERE id = ?",
        ["Telegram", "123456789", testUserId]
      );

      // Create a reminder with past scheduled time (will be PENDING and trigger notifications)
      const pastTime = new Date(Date.now() - 60000).toISOString();
      await reminderService.createReminder(
        testTrackingId,
        testUserId,
        pastTime
      );

      // Verify Telegram message was sent
      expect(mockFunctions.sendReminderMessage).toHaveBeenCalledTimes(1);
      expect(mockFunctions.sendReminderEmail).not.toHaveBeenCalled();

      // Verify Telegram was called with correct parameters
      const telegramCallArgs = mockFunctions.sendReminderMessage.mock.calls[0];
      expect(telegramCallArgs[0]).toBe("123456789"); // chat ID
      expect(telegramCallArgs[1]).toBeGreaterThan(0); // reminder ID
      expect(telegramCallArgs[2]).toBe("Did I exercise?"); // tracking question
    });

    it("should default to Email when notification channel is not set", async () => {
      // User has no notification channel set (should default to Email)
      // Create a reminder with past scheduled time (will be PENDING and trigger notifications)
      const pastTime = new Date(Date.now() - 60000).toISOString();
      await reminderService.createReminder(
        testTrackingId,
        testUserId,
        pastTime
      );

      // Verify email was sent (default behavior)
      expect(mockFunctions.sendReminderEmail).toHaveBeenCalledTimes(1);
      expect(mockFunctions.sendReminderMessage).not.toHaveBeenCalled();
    });

    it("should only send to selected channel (not both)", async () => {
      // Update user to have Email channel
      await testDb.run(
        "UPDATE users SET notification_channels = ? WHERE id = ?",
        ["Email", testUserId]
      );

      // Create a reminder with past scheduled time
      const pastTime = new Date(Date.now() - 60000).toISOString();
      await reminderService.createReminder(
        testTrackingId,
        testUserId,
        pastTime
      );

      // Verify only Email was sent, not Telegram
      expect(mockFunctions.sendReminderEmail).toHaveBeenCalledTimes(1);
      expect(mockFunctions.sendReminderMessage).not.toHaveBeenCalled();

      // Clear mocks
      mockFunctions.sendReminderEmail.mockClear();
      mockFunctions.sendReminderMessage.mockClear();

      // Now switch to Telegram
      await testDb.run(
        "UPDATE users SET notification_channels = ?, telegram_chat_id = ? WHERE id = ?",
        ["Telegram", "987654321", testUserId]
      );

      // Create another reminder
      const pastTime2 = new Date(Date.now() - 60000).toISOString();
      await reminderService.createReminder(
        testTrackingId,
        testUserId,
        pastTime2
      );

      // Verify only Telegram was sent, not Email
      expect(mockFunctions.sendReminderMessage).toHaveBeenCalledTimes(1);
      expect(mockFunctions.sendReminderEmail).not.toHaveBeenCalled();
    });

    it("should not send Telegram notification when Telegram channel is selected but chat ID is missing", async () => {
      // Update user to have Telegram channel but no chat ID
      await testDb.run(
        "UPDATE users SET notification_channels = ?, telegram_chat_id = NULL WHERE id = ?",
        ["Telegram", testUserId]
      );

      // Create a reminder with past scheduled time
      const pastTime = new Date(Date.now() - 60000).toISOString();
      await reminderService.createReminder(
        testTrackingId,
        testUserId,
        pastTime
      );

      // Verify no notifications were sent
      expect(mockFunctions.sendReminderEmail).not.toHaveBeenCalled();
      expect(mockFunctions.sendReminderMessage).not.toHaveBeenCalled();
    });
  });

  describe("processExpiredReminders", () => {
    it("should update expired upcoming reminders to Pending status", async () => {
      // Create an expired upcoming reminder
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

      // Process expired reminders
      await reminderService.processExpiredReminders();

      // Verify the reminder was updated to Pending
      const reminder = await Reminder.loadById(
        created.id,
        testUserId,
        testDb
      );
      expect(reminder).not.toBeNull();
      expect(reminder!.status).toBe(ReminderStatus.PENDING);
    });

    it("should not update non-expired upcoming reminders", async () => {
      // Create a future upcoming reminder
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

      // Process expired reminders
      await reminderService.processExpiredReminders();

      // Verify the reminder remains Upcoming
      const reminder = await Reminder.loadById(
        created.id,
        testUserId,
        testDb
      );
      expect(reminder).not.toBeNull();
      expect(reminder!.status).toBe(ReminderStatus.UPCOMING);
    });

    it("should handle multiple expired reminders", async () => {
      // Create multiple expired upcoming reminders
      const pastTime1 = new Date(Date.now() - 120000).toISOString(); // 2 minutes ago
      const pastTime2 = new Date(Date.now() - 60000).toISOString(); // 1 minute ago

      const created1 = await reminderService.createReminder(
        testTrackingId,
        testUserId,
        pastTime1
      );
      const created2 = await reminderService.createReminder(
        testTrackingId,
        testUserId,
        pastTime2
      );

      // Manually set both to UPCOMING
      await testDb.run(
        "UPDATE reminders SET status = ?, scheduled_time = ? WHERE id = ?",
        [ReminderStatus.UPCOMING, pastTime1, created1.id]
      );
      await testDb.run(
        "UPDATE reminders SET status = ?, scheduled_time = ? WHERE id = ?",
        [ReminderStatus.UPCOMING, pastTime2, created2.id]
      );

      // Process expired reminders
      await reminderService.processExpiredReminders();

      // Verify both reminders were updated to Pending
      const reminder1 = await Reminder.loadById(
        created1.id,
        testUserId,
        testDb
      );
      const reminder2 = await Reminder.loadById(
        created2.id,
        testUserId,
        testDb
      );

      expect(reminder1).not.toBeNull();
      expect(reminder1!.status).toBe(ReminderStatus.PENDING);
      expect(reminder2).not.toBeNull();
      expect(reminder2!.status).toBe(ReminderStatus.PENDING);
    });

    it("should handle empty result when no expired reminders exist", async () => {
      // Create a future upcoming reminder
      const futureTime = new Date(Date.now() + 3600000).toISOString();
      await reminderService.createReminder(
        testTrackingId,
        testUserId,
        futureTime
      );

      // Process expired reminders - should not throw
      await expect(
        reminderService.processExpiredReminders()
      ).resolves.not.toThrow();
    });
  });
});



