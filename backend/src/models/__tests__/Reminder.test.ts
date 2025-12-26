import { vi } from "vitest";
import {
  Reminder,
  ReminderStatus,
  ReminderValue,
  ReminderData,
} from "../Reminder.js";
import { Database } from "../../db/database.js";
import sqlite3 from "sqlite3";

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
              name TEXT NOT NULL,
              email TEXT NOT NULL UNIQUE
            );
            CREATE TABLE IF NOT EXISTS trackings (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id INTEGER NOT NULL,
              question TEXT NOT NULL CHECK(length(question) <= 100),
              notes TEXT,
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
              value TEXT NOT NULL DEFAULT 'Dismissed' CHECK(value IN ('Completed', 'Dismissed')),
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

describe("Reminder Model", () => {
  let db: Database;
  let userId: number;
  let trackingId: number;

  beforeEach(async () => {
    db = await createTestDatabase();
    const userResult = await db.run(
      "INSERT INTO users (name, email) VALUES (?, ?)",
      ["Test User", "test@example.com"]
    );
    userId = userResult.lastID;

    const trackingResult = await db.run(
      "INSERT INTO trackings (user_id, question) VALUES (?, ?)",
      [userId, "Did I exercise?"]
    );
    trackingId = trackingResult.lastID;
  });

  afterEach(async () => {
    await db.close();
  });

  describe("constructor", () => {
    it("should create Reminder instance with provided data", () => {
      const reminderData: ReminderData = {
        id: 1,
        tracking_id: trackingId,
        user_id: userId,
        scheduled_time: "2024-01-01T10:00:00Z",
        value: ReminderValue.COMPLETED,
        notes: "Some notes",
        status: ReminderStatus.ANSWERED,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      };

      const reminder = new Reminder(reminderData);

      expect(reminder.id).toBe(1);
      expect(reminder.tracking_id).toBe(trackingId);
      expect(reminder.user_id).toBe(userId);
      expect(reminder.scheduled_time).toBe("2024-01-01T10:00:00Z");
      expect(reminder.value).toBe(ReminderValue.COMPLETED);
      expect(reminder.notes).toBe("Some notes");
      expect(reminder.status).toBe(ReminderStatus.ANSWERED);
    });

    it("should create Reminder instance with minimal data", () => {
      const reminderData: ReminderData = {
        id: 1,
        tracking_id: trackingId,
        user_id: userId,
        scheduled_time: "2024-01-01T10:00:00Z",
        status: ReminderStatus.PENDING,
      };

      const reminder = new Reminder(reminderData);

      expect(reminder.id).toBe(1);
      expect(reminder.value).toBe(ReminderValue.DISMISSED); // Default value
      expect(reminder.notes).toBeUndefined();
      expect(reminder.status).toBe(ReminderStatus.PENDING);
    });
  });

  describe("validate", () => {
    it("should validate and normalize reminder fields", () => {
      const reminder = new Reminder({
        id: 1,
        tracking_id: trackingId,
        user_id: userId,
        scheduled_time: "2024-01-01T10:00:00Z",
        value: ReminderValue.COMPLETED,
        notes: "  Some notes  ",
        status: ReminderStatus.ANSWERED,
      });

      const validated = reminder.validate();

      expect(validated.value).toBe(ReminderValue.COMPLETED);
      expect(validated.notes).toBe("Some notes");
    });

    it("should throw error for invalid scheduled_time", () => {
      const reminder = new Reminder({
        id: 1,
        tracking_id: trackingId,
        user_id: userId,
        scheduled_time: "",
        status: ReminderStatus.PENDING,
      });

      expect(() => reminder.validate()).toThrow(TypeError);
    });

    it("should throw error for invalid status", () => {
      const reminder = new Reminder({
        id: 1,
        tracking_id: trackingId,
        user_id: userId,
        scheduled_time: "2024-01-01T10:00:00Z",
        status: "Invalid" as ReminderStatus,
      });

      expect(() => reminder.validate()).toThrow(TypeError);
    });
  });

  describe("save", () => {
    it("should create new reminder when id is not set", async () => {
      const reminder = new Reminder({
        id: 0,
        tracking_id: trackingId,
        user_id: userId,
        scheduled_time: "2024-01-01T10:00:00Z",
        status: ReminderStatus.PENDING,
      });

      const saved = await reminder.save(db);

      expect(saved.id).toBeGreaterThan(0);
      expect(saved.scheduled_time).toBe("2024-01-01T10:00:00Z");
      expect(saved.status).toBe(ReminderStatus.PENDING);
    });

    it("should update existing reminder when id is set", async () => {
      const result = await db.run(
        "INSERT INTO reminders (tracking_id, user_id, scheduled_time, status) VALUES (?, ?, ?, ?)",
        [trackingId, userId, "2024-01-01T10:00:00Z", ReminderStatus.PENDING]
      );
      const reminderId = result.lastID;

      const reminder = new Reminder({
        id: reminderId,
        tracking_id: trackingId,
        user_id: userId,
        scheduled_time: "2024-01-01T11:00:00Z",
        value: ReminderValue.COMPLETED,
        status: ReminderStatus.ANSWERED,
      });

      const saved = await reminder.save(db);

      expect(saved.id).toBe(reminderId);
      expect(saved.scheduled_time).toBe("2024-01-01T11:00:00Z");
      expect(saved.value).toBe(ReminderValue.COMPLETED);
      expect(saved.status).toBe(ReminderStatus.ANSWERED);
    });
  });

  describe("loadById", () => {
    it("should load reminder by ID", async () => {
      const result = await db.run(
        "INSERT INTO reminders (tracking_id, user_id, scheduled_time, value, status) VALUES (?, ?, ?, ?, ?)",
        [
          trackingId,
          userId,
          "2024-01-01T10:00:00Z",
          ReminderValue.COMPLETED,
          ReminderStatus.ANSWERED,
        ]
      );
      const reminderId = result.lastID;

      const reminder = await Reminder.loadById(reminderId, userId, db);

      expect(reminder).not.toBeNull();
      expect(reminder!.id).toBe(reminderId);
      expect(reminder!.value).toBe(ReminderValue.COMPLETED);
      expect(reminder!.status).toBe(ReminderStatus.ANSWERED);
    });

    it("should return null if reminder not found", async () => {
      const reminder = await Reminder.loadById(999, userId, db);

      expect(reminder).toBeNull();
    });
  });

  describe("loadByUserId", () => {
    it("should load all reminders for a user", async () => {
      await db.run(
        "INSERT INTO reminders (tracking_id, user_id, scheduled_time, status) VALUES (?, ?, ?, ?)",
        [trackingId, userId, "2024-01-01T10:00:00Z", ReminderStatus.PENDING]
      );
      await db.run(
        "INSERT INTO reminders (tracking_id, user_id, scheduled_time, status) VALUES (?, ?, ?, ?)",
        [trackingId, userId, "2024-01-02T10:00:00Z", ReminderStatus.PENDING]
      );

      const reminders = await Reminder.loadByUserId(userId, db);

      expect(reminders.length).toBe(2);
      expect(reminders[0].scheduled_time).toBe("2024-01-01T10:00:00Z");
      expect(reminders[1].scheduled_time).toBe("2024-01-02T10:00:00Z");
    });
  });

  describe("loadActiveByUserId", () => {
    it("should load only active reminders (excludes Answered)", async () => {
      await db.run(
        "INSERT INTO reminders (tracking_id, user_id, scheduled_time, status) VALUES (?, ?, ?, ?)",
        [trackingId, userId, "2024-01-01T10:00:00Z", ReminderStatus.PENDING]
      );
      await db.run(
        "INSERT INTO reminders (tracking_id, user_id, scheduled_time, status) VALUES (?, ?, ?, ?)",
        [trackingId, userId, "2024-01-02T10:00:00Z", ReminderStatus.UPCOMING]
      );
      await db.run(
        "INSERT INTO reminders (tracking_id, user_id, scheduled_time, status, value) VALUES (?, ?, ?, ?, ?)",
        [
          trackingId,
          userId,
          "2024-01-03T10:00:00Z",
          ReminderStatus.ANSWERED,
          ReminderValue.COMPLETED,
        ]
      );

      const reminders = await Reminder.loadActiveByUserId(userId, db);

      expect(reminders.length).toBe(2);
      expect(reminders[0].status).toBe(ReminderStatus.PENDING);
      expect(reminders[1].status).toBe(ReminderStatus.UPCOMING);
      expect(reminders.some((r) => r.status === ReminderStatus.ANSWERED)).toBe(
        false
      );
    });
  });

  describe("loadByTrackingId", () => {
    it("should load reminder by tracking ID", async () => {
      await db.run(
        "INSERT INTO reminders (tracking_id, user_id, scheduled_time, status) VALUES (?, ?, ?, ?)",
        [trackingId, userId, "2024-01-01T10:00:00Z", ReminderStatus.PENDING]
      );

      const reminder = await Reminder.loadByTrackingId(trackingId, userId, db);

      expect(reminder).not.toBeNull();
      expect(reminder!.tracking_id).toBe(trackingId);
    });

    it("should return null if no reminder found for tracking", async () => {
      const reminder = await Reminder.loadByTrackingId(999, userId, db);

      expect(reminder).toBeNull();
    });

    it("should throw error for invalid value", () => {
      expect(() => {
        Reminder.validateValue("Invalid");
      }).toThrow(TypeError);
    });

    it("should validate valid value", () => {
      expect(Reminder.validateValue(ReminderValue.COMPLETED)).toBe(
        ReminderValue.COMPLETED
      );
      expect(Reminder.validateValue(ReminderValue.DISMISSED)).toBe(
        ReminderValue.DISMISSED
      );
    });
  });

  describe("delete", () => {
    it("should delete reminder", async () => {
      const result = await db.run(
        "INSERT INTO reminders (tracking_id, user_id, scheduled_time, status) VALUES (?, ?, ?, ?)",
        [trackingId, userId, "2024-01-01T10:00:00Z", ReminderStatus.PENDING]
      );
      const reminderId = result.lastID;

      const reminder = await Reminder.loadById(reminderId, userId, db);
      expect(reminder).not.toBeNull();

      await reminder!.delete(db);

      const deleted = await Reminder.loadById(reminderId, userId, db);
      expect(deleted).toBeNull();
    });

    it("should throw error if reminder not found", async () => {
      const reminder = new Reminder({
        id: 999,
        tracking_id: trackingId,
        user_id: userId,
        scheduled_time: "2024-01-01T10:00:00Z",
        status: ReminderStatus.PENDING,
      });

      await expect(reminder.delete(db)).rejects.toThrow("Reminder not found");
    });
  });
});
