import { vi } from "vitest";
import {
  Tracking,
  TrackingState,
  TrackingData,
  Frequency,
} from "../Tracking.js";
import { Database } from "../../db/database.js";
import BetterSqlite3 from "better-sqlite3";

/**
 * Create an in-memory database for testing.
 * @returns Promise resolving to Database instance
 */
async function createTestDatabase(): Promise<Database> {
  const db = new BetterSqlite3(":memory:");
  
  db.pragma("foreign_keys = ON");
  db.pragma("journal_mode = WAL");
  
  db.exec(`
CREATE TABLE IF NOT EXISTS users (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              name TEXT NOT NULL,
              email TEXT NOT NULL UNIQUE,
              locale TEXT DEFAULT 'en-US',
              timezone TEXT
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
            CREATE INDEX IF NOT EXISTS idx_tracking_schedules_tracking_id ON tracking_schedules(tracking_id);
  `);
  
  const database = new Database();
  (database as any).db = db;
  return database;
}

describe("Tracking Model", () => {
  let db: Database;
  let userId: number;

  beforeEach(async () => {
    db = await createTestDatabase();
    const result = await db.run(
      "INSERT INTO users (name, email) VALUES (?, ?)",
      ["Test User", "test@example.com"]
    );
    userId = result.lastID;
  });

  afterEach(async () => {
    await db.close();
  });

  describe("constructor", () => {
    it("should create Tracking instance with provided data", () => {
      const trackingData: TrackingData = {
        id: 1,
        user_id: userId,
        question: "Did I exercise?",
        frequency: { type: "daily" },
        details: "Some details",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      };

      const tracking = new Tracking(trackingData);

      expect(tracking.id).toBe(1);
      expect(tracking.user_id).toBe(userId);
      expect(tracking.question).toBe("Did I exercise?");
      expect(tracking.details).toBe("Some details");
      expect(tracking.frequency).toEqual({ type: "daily" });
    });

    it("should create Tracking instance with minimal data", () => {
      const trackingData: TrackingData = {
        id: 1,
        user_id: userId,
        question: "Did I exercise?",
        frequency: { type: "daily" },
      };

      const tracking = new Tracking(trackingData);

      expect(tracking.id).toBe(1);
      expect(tracking.question).toBe("Did I exercise?");
      expect(tracking.details).toBeUndefined();
      expect(tracking.frequency).toEqual({ type: "daily" });
    });
  });

  describe("validate", () => {
    it("should validate and normalize tracking fields", () => {
      const tracking = new Tracking({
        id: 1,
        user_id: userId,
        question: "  Did I exercise?  ",
        frequency: { type: "daily" },
        details: "  Some details  ",
      });

      const validated = tracking.validate();

      expect(validated.question).toBe("Did I exercise?");
      expect(validated.details).toBe("Some details");
    });

    it("should throw error for invalid question", () => {
      const tracking = new Tracking({
        id: 1,
        user_id: userId,
        question: "",
        frequency: { type: "daily" },
      });

      expect(() => tracking.validate()).toThrow(TypeError);
    });
  });

  describe("save", () => {
    it("should create new tracking when id is not set", async () => {
      const tracking = new Tracking({
        id: 0,
        user_id: userId,
        question: "Did I exercise?",
        frequency: { type: "daily" },
      });

      const saved = await tracking.save(db);

      expect(saved.id).toBeGreaterThan(0);
      expect(saved.question).toBe("Did I exercise?");
      expect(saved.frequency).toEqual({ type: "daily" });
    });

    it("should update existing tracking when id is set", async () => {
      const result = await db.run(
        "INSERT INTO trackings (user_id, question, frequency) VALUES (?, ?, ?)",
        [userId, "Original question", JSON.stringify({ type: "daily" })]
      );
      const trackingId = result.lastID;

      const tracking = new Tracking({
        id: trackingId,
        user_id: userId,
        question: "Updated question",
        frequency: { type: "weekly", days: [0, 1] },
      });

      const saved = await tracking.save(db);

      expect(saved.id).toBe(trackingId);
      expect(saved.question).toBe("Updated question");
      expect(saved.frequency).toEqual({ type: "weekly", days: [0, 1] });
    });

    it("should throw error if creation fails", async () => {
      const tracking = new Tracking({
        id: 0,
        user_id: userId,
        question: "Did I exercise?",
        frequency: { type: "daily" },
      });

      // Close database to cause failure
      await db.close();

      await expect(tracking.save(db)).rejects.toThrow();
    });
  });

  describe("update", () => {
    it("should update tracking fields", async () => {
      const result = await db.run(
        "INSERT INTO trackings (user_id, question, frequency) VALUES (?, ?, ?)",
        [userId, "Original question", JSON.stringify({ type: "daily" })]
      );
      const trackingId = result.lastID;

      const tracking = new Tracking({
        id: trackingId,
        user_id: userId,
        question: "Original question",
        frequency: { type: "daily" },
      });

      const updated = await tracking.update(
        {
          question: "Updated question",
          details: "Updated details",
        },
        db
      );

      expect(updated.question).toBe("Updated question");
      expect(updated.details).toBe("Updated details");
    });

    it("should throw error if tracking has no id", async () => {
      const tracking = new Tracking({
        id: 0,
        user_id: userId,
        question: "Did I exercise?",
        frequency: { type: "daily" },
      });

      await expect(
        tracking.update({ question: "Updated" }, db)
      ).rejects.toThrow("Cannot update tracking without ID");
    });
  });

  describe("delete", () => {
    it("should delete tracking from database", async () => {
      const result = await db.run(
        "INSERT INTO trackings (user_id, question, frequency) VALUES (?, ?, ?)",
        [userId, "Did I exercise?", JSON.stringify({ type: "daily" })]
      );
      const trackingId = result.lastID;

      const tracking = new Tracking({
        id: trackingId,
        user_id: userId,
        question: "Did I exercise?",
        frequency: { type: "daily" },
      });

      await tracking.delete(db);

      const deleted = await db.get("SELECT id FROM trackings WHERE id = ?", [
        trackingId,
      ]);
      expect(deleted).toBeUndefined();
    });

    it("should throw error if tracking has no id", async () => {
      const tracking = new Tracking({
        id: 0,
        user_id: userId,
        question: "Did I exercise?",
        frequency: { type: "daily" },
      });

      await expect(tracking.delete(db)).rejects.toThrow(
        "Cannot delete tracking without ID"
      );
    });

    it("should throw error if tracking not found", async () => {
      const tracking = new Tracking({
        id: 999,
        user_id: userId,
        question: "Did I exercise?",
        frequency: { type: "daily" },
      });

      await expect(tracking.delete(db)).rejects.toThrow("Tracking not found");
    });
  });

  describe("toData", () => {
    it("should convert tracking instance to TrackingData", () => {
      const tracking = new Tracking({
        id: 1,
        user_id: userId,
        question: "Did I exercise?",
        frequency: { type: "daily" },
        details: "Some details",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      });

      const data = tracking.toData();

      expect(data).toEqual({
        id: 1,
        user_id: userId,
        question: "Did I exercise?",
        frequency: { type: "daily" },
        details: "Some details",
        state: TrackingState.RUNNING,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      });
    });
  });

  describe("loadById", () => {
    it("should load tracking by id", async () => {
      const result = await db.run(
        "INSERT INTO trackings (user_id, question, frequency) VALUES (?, ?, ?)",
        [userId, "Did I exercise?", JSON.stringify({ type: "daily" })]
      );
      const trackingId = result.lastID;

      const tracking = await Tracking.loadById(trackingId, userId, db);

      expect(tracking).not.toBeNull();
      expect(tracking?.id).toBe(trackingId);
      expect(tracking?.question).toBe("Did I exercise?");
      expect(tracking?.frequency).toEqual({ type: "daily" });
    });

    it("should return null for non-existent tracking", async () => {
      const tracking = await Tracking.loadById(999, userId, db);
      expect(tracking).toBeNull();
    });

    it("should return null for tracking belonging to different user", async () => {
      const otherUserResult = await db.run(
        "INSERT INTO users (name, email) VALUES (?, ?)",
        ["Other User", "other@example.com"]
      );
      const otherUserId = otherUserResult.lastID;

      const result = await db.run(
        "INSERT INTO trackings (user_id, question, frequency) VALUES (?, ?, ?)",
        [otherUserId, "Did I exercise?", JSON.stringify({ type: "daily" })]
      );
      const trackingId = result.lastID;

      const tracking = await Tracking.loadById(trackingId, userId, db);
      expect(tracking).toBeNull();
    });
  });

  describe("loadByUserId", () => {
    it("should load all trackings for a user", async () => {
      const result1 = await db.run(
        "INSERT INTO trackings (user_id, question, frequency) VALUES (?, ?, ?)",
        [userId, "Question 1", JSON.stringify({ type: "daily" })]
      );
      const id1 = result1.lastID;
      const result2 = await db.run(
        "INSERT INTO trackings (user_id, question, frequency) VALUES (?, ?, ?)",
        [userId, "Question 2", JSON.stringify({ type: "weekly", days: [0] })]
      );
      const id2 = result2.lastID;

      const trackings = await Tracking.loadByUserId(userId, db);

      expect(trackings).toHaveLength(2);
      const questions = trackings.map((t) => t.question);
      const ids = trackings.map((t) => t.id);
      expect(questions).toContain("Question 1");
      expect(questions).toContain("Question 2");
      expect(ids).toContain(id1);
      expect(ids).toContain(id2);
      // Should be ordered by created_at DESC (newest first)
      // Since both have same timestamp, order may vary, so just check both exist
      expect(trackings.length).toBe(2);
    });

    it("should return empty array when user has no trackings", async () => {
      const trackings = await Tracking.loadByUserId(userId, db);
      expect(trackings).toEqual([]);
    });
  });
  describe("validateQuestion", () => {
    it("should accept valid questions", () => {
      expect(Tracking.validateQuestion("Did I drink water today?")).toBe(
        "Did I drink water today?"
      );
      expect(Tracking.validateQuestion("Did I exercise?")).toBe(
        "Did I exercise?"
      );
    });

    it("should trim whitespace", () => {
      expect(Tracking.validateQuestion("  Did I meditate?  ")).toBe(
        "Did I meditate?"
      );
    });

    it("should throw TypeError for empty question", () => {
      expect(() => Tracking.validateQuestion("")).toThrow(TypeError);
      expect(() => Tracking.validateQuestion("   ")).toThrow(TypeError);
    });

    it("should throw TypeError for non-string question", () => {
      expect(() => Tracking.validateQuestion(null as any)).toThrow(TypeError);
      expect(() => Tracking.validateQuestion(123 as any)).toThrow(TypeError);
      expect(() => Tracking.validateQuestion(undefined as any)).toThrow(
        TypeError
      );
    });

    it("should throw TypeError for question exceeding max length", () => {
      const longQuestion = "a".repeat(Tracking.MAX_QUESTION_LENGTH + 1);
      expect(() => Tracking.validateQuestion(longQuestion)).toThrow(TypeError);
    });

    it("should accept question with exactly MAX_QUESTION_LENGTH characters", () => {
      const maxLengthQuestion = "a".repeat(Tracking.MAX_QUESTION_LENGTH);
      expect(Tracking.validateQuestion(maxLengthQuestion)).toBe(
        maxLengthQuestion
      );
    });
  });

  describe("validateDetails", () => {
    it("should accept valid details", () => {
      expect(Tracking.validateDetails("Some details")).toBe("Some details");
      expect(Tracking.validateDetails("  Trimmed details  ")).toBe("Trimmed details");
    });

    it("should return undefined for empty/null/undefined details", () => {
      expect(Tracking.validateDetails("")).toBeUndefined();
      expect(Tracking.validateDetails("   ")).toBeUndefined();
      expect(Tracking.validateDetails(null)).toBeUndefined();
      expect(Tracking.validateDetails(undefined)).toBeUndefined();
    });

    it("should throw TypeError for non-string details", () => {
      expect(() => Tracking.validateDetails(123 as any)).toThrow(TypeError);
    });
  });

  describe("validateUserId", () => {
    it("should accept valid user IDs", () => {
      expect(Tracking.validateUserId(1)).toBe(1);
      expect(Tracking.validateUserId(100)).toBe(100);
    });

    it("should throw TypeError for invalid user ID format", () => {
      expect(() => Tracking.validateUserId(0)).toThrow(TypeError);
      expect(() => Tracking.validateUserId(-1)).toThrow(TypeError);
      expect(() => Tracking.validateUserId(1.5)).toThrow(TypeError);
    });

    it("should throw TypeError for non-number user ID", () => {
      expect(() => Tracking.validateUserId(null as any)).toThrow(TypeError);
      expect(() => Tracking.validateUserId("1" as any)).toThrow(TypeError);
      expect(() => Tracking.validateUserId(undefined as any)).toThrow(
        TypeError
      );
    });

    it("should throw TypeError for NaN", () => {
      expect(() => Tracking.validateUserId(NaN)).toThrow(TypeError);
    });
  });

  describe("validateIcon", () => {
    it("should accept valid icons", () => {
      expect(Tracking.validateIcon("😊")).toBe("😊");
      expect(Tracking.validateIcon("🏃")).toBe("🏃");
      expect(Tracking.validateIcon("✅")).toBe("✅");
    });

    it("should trim whitespace", () => {
      expect(Tracking.validateIcon("  😊  ")).toBe("😊");
      expect(Tracking.validateIcon("  🏃  ")).toBe("🏃");
    });

    it("should return undefined for empty/null/undefined icons", () => {
      expect(Tracking.validateIcon("")).toBeUndefined();
      expect(Tracking.validateIcon("   ")).toBeUndefined();
      expect(Tracking.validateIcon(null)).toBeUndefined();
      expect(Tracking.validateIcon(undefined)).toBeUndefined();
    });

    it("should throw TypeError for non-string icons", () => {
      expect(() => Tracking.validateIcon(123 as any)).toThrow(TypeError);
      expect(() => Tracking.validateIcon({} as any)).toThrow(TypeError);
    });

    it("should throw TypeError for icon exceeding max length", () => {
      const longIcon = "a".repeat(21);
      expect(() => Tracking.validateIcon(longIcon)).toThrow(TypeError);
    });

    it("should accept icon with exactly max length", () => {
      const maxLengthIcon = "a".repeat(20);
      expect(Tracking.validateIcon(maxLengthIcon)).toBe(maxLengthIcon);
    });
  });

  describe("validateFrequency", () => {
    it("should accept valid daily frequency", () => {
      const frequency: Frequency = { type: "daily" };
      expect(Tracking.validateFrequency(frequency)).toEqual(frequency);
    });

    it("should accept valid weekly frequency", () => {
      const frequency: Frequency = {
        type: "weekly",
        days: [0, 1, 2],
      };
      expect(Tracking.validateFrequency(frequency)).toEqual(frequency);
    });

    it("should accept valid monthly frequency with day_number kind", () => {
      const frequency: Frequency = {
        type: "monthly",
        kind: "day_number",
        day_numbers: [1, 15, 30],
      };
      expect(Tracking.validateFrequency(frequency)).toEqual(frequency);
    });

    it("should accept valid monthly frequency with last_day kind", () => {
      const frequency: Frequency = {
        type: "monthly",
        kind: "last_day",
      };
      expect(Tracking.validateFrequency(frequency)).toEqual(frequency);
    });

    it("should accept valid monthly frequency with weekday_ordinal kind", () => {
      const frequency: Frequency = {
        type: "monthly",
        kind: "weekday_ordinal",
        weekday: 1,
        ordinal: 2,
      };
      expect(Tracking.validateFrequency(frequency)).toEqual(frequency);
    });

    it("should accept valid yearly frequency with date kind", () => {
      const frequency: Frequency = {
        type: "yearly",
        kind: "date",
        month: 12,
        day: 25,
      };
      expect(Tracking.validateFrequency(frequency)).toEqual(frequency);
    });

    it("should accept valid yearly frequency with weekday_ordinal kind", () => {
      const frequency: Frequency = {
        type: "yearly",
        kind: "weekday_ordinal",
        weekday: 0,
        ordinal: 4,
      };
      expect(Tracking.validateFrequency(frequency)).toEqual(frequency);
    });

    it("should accept valid one-time frequency", () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().split("T")[0];
      const frequency: Frequency = {
        type: "one-time",
        date: dateStr,
      };
      expect(Tracking.validateFrequency(frequency)).toEqual(frequency);
    });

    it("should throw TypeError for null/undefined frequency", () => {
      expect(() => Tracking.validateFrequency(null as any)).toThrow(TypeError);
      expect(() => Tracking.validateFrequency(undefined as any)).toThrow(
        TypeError
      );
    });

    it("should throw TypeError for non-object frequency", () => {
      expect(() => Tracking.validateFrequency("invalid" as any)).toThrow(
        TypeError
      );
      expect(() => Tracking.validateFrequency(123 as any)).toThrow(TypeError);
      expect(() => Tracking.validateFrequency([] as any)).toThrow(TypeError);
    });

    it("should throw TypeError for missing frequency type", () => {
      expect(() => Tracking.validateFrequency({} as any)).toThrow(TypeError);
    });

    it("should throw TypeError for invalid frequency type", () => {
      expect(() =>
        Tracking.validateFrequency({ type: "invalid" } as any)
      ).toThrow(TypeError);
    });

    it("should throw TypeError for weekly frequency missing days array", () => {
      expect(() =>
        Tracking.validateFrequency({ type: "weekly" } as any)
      ).toThrow(TypeError);
    });

    it("should throw TypeError for weekly frequency with empty days array", () => {
      expect(() =>
        Tracking.validateFrequency({ type: "weekly", days: [] } as any)
      ).toThrow(TypeError);
    });

    it("should throw TypeError for weekly frequency with invalid day values", () => {
      expect(() =>
        Tracking.validateFrequency({ type: "weekly", days: [-1] } as any)
      ).toThrow(TypeError);
      expect(() =>
        Tracking.validateFrequency({ type: "weekly", days: [7] } as any)
      ).toThrow(TypeError);
      expect(() =>
        Tracking.validateFrequency({ type: "weekly", days: [1.5] } as any)
      ).toThrow(TypeError);
    });

    it("should throw TypeError for weekly frequency with duplicate days", () => {
      expect(() =>
        Tracking.validateFrequency({
          type: "weekly",
          days: [0, 1, 0],
        } as any)
      ).toThrow(TypeError);
    });

    it("should throw TypeError for monthly frequency missing kind", () => {
      expect(() =>
        Tracking.validateFrequency({ type: "monthly" } as any)
      ).toThrow(TypeError);
    });

    it("should throw TypeError for monthly frequency with invalid kind", () => {
      expect(() =>
        Tracking.validateFrequency({
          type: "monthly",
          kind: "invalid",
        } as any)
      ).toThrow(TypeError);
    });

    it("should throw TypeError for monthly frequency day_number missing day_numbers", () => {
      expect(() =>
        Tracking.validateFrequency({
          type: "monthly",
          kind: "day_number",
        } as any)
      ).toThrow(TypeError);
    });

    it("should throw TypeError for monthly frequency day_number with invalid day_numbers", () => {
      expect(() =>
        Tracking.validateFrequency({
          type: "monthly",
          kind: "day_number",
          day_numbers: [0],
        } as any)
      ).toThrow(TypeError);
      expect(() =>
        Tracking.validateFrequency({
          type: "monthly",
          kind: "day_number",
          day_numbers: [32],
        } as any)
      ).toThrow(TypeError);
    });

    it("should throw TypeError for monthly frequency weekday_ordinal missing weekday", () => {
      expect(() =>
        Tracking.validateFrequency({
          type: "monthly",
          kind: "weekday_ordinal",
          ordinal: 1,
        } as any)
      ).toThrow(TypeError);
    });

    it("should throw TypeError for monthly frequency weekday_ordinal with invalid weekday", () => {
      expect(() =>
        Tracking.validateFrequency({
          type: "monthly",
          kind: "weekday_ordinal",
          weekday: -1,
          ordinal: 1,
        } as any)
      ).toThrow(TypeError);
      expect(() =>
        Tracking.validateFrequency({
          type: "monthly",
          kind: "weekday_ordinal",
          weekday: 7,
          ordinal: 1,
        } as any)
      ).toThrow(TypeError);
    });

    it("should throw TypeError for monthly frequency weekday_ordinal missing ordinal", () => {
      expect(() =>
        Tracking.validateFrequency({
          type: "monthly",
          kind: "weekday_ordinal",
          weekday: 1,
        } as any)
      ).toThrow(TypeError);
    });

    it("should throw TypeError for monthly frequency weekday_ordinal with invalid ordinal", () => {
      expect(() =>
        Tracking.validateFrequency({
          type: "monthly",
          kind: "weekday_ordinal",
          weekday: 1,
          ordinal: 0,
        } as any)
      ).toThrow(TypeError);
      expect(() =>
        Tracking.validateFrequency({
          type: "monthly",
          kind: "weekday_ordinal",
          weekday: 1,
          ordinal: 6,
        } as any)
      ).toThrow(TypeError);
    });

    it("should throw TypeError for yearly frequency missing kind", () => {
      expect(() =>
        Tracking.validateFrequency({ type: "yearly" } as any)
      ).toThrow(TypeError);
    });

    it("should throw TypeError for yearly frequency with invalid kind", () => {
      expect(() =>
        Tracking.validateFrequency({
          type: "yearly",
          kind: "invalid",
        } as any)
      ).toThrow(TypeError);
    });

    it("should throw TypeError for yearly frequency date kind missing month", () => {
      expect(() =>
        Tracking.validateFrequency({
          type: "yearly",
          kind: "date",
          day: 25,
        } as any)
      ).toThrow(TypeError);
    });

    it("should throw TypeError for yearly frequency date kind with invalid month", () => {
      expect(() =>
        Tracking.validateFrequency({
          type: "yearly",
          kind: "date",
          month: 0,
          day: 25,
        } as any)
      ).toThrow(TypeError);
      expect(() =>
        Tracking.validateFrequency({
          type: "yearly",
          kind: "date",
          month: 13,
          day: 25,
        } as any)
      ).toThrow(TypeError);
    });

    it("should throw TypeError for yearly frequency date kind missing day", () => {
      expect(() =>
        Tracking.validateFrequency({
          type: "yearly",
          kind: "date",
          month: 12,
        } as any)
      ).toThrow(TypeError);
    });

    it("should throw TypeError for yearly frequency date kind with invalid day", () => {
      expect(() =>
        Tracking.validateFrequency({
          type: "yearly",
          kind: "date",
          month: 12,
          day: 0,
        } as any)
      ).toThrow(TypeError);
      expect(() =>
        Tracking.validateFrequency({
          type: "yearly",
          kind: "date",
          month: 12,
          day: 32,
        } as any)
      ).toThrow(TypeError);
    });

    it("should throw TypeError for yearly frequency weekday_ordinal kind missing weekday", () => {
      expect(() =>
        Tracking.validateFrequency({
          type: "yearly",
          kind: "weekday_ordinal",
          ordinal: 1,
        } as any)
      ).toThrow(TypeError);
    });

    it("should throw TypeError for yearly frequency weekday_ordinal kind with invalid weekday", () => {
      expect(() =>
        Tracking.validateFrequency({
          type: "yearly",
          kind: "weekday_ordinal",
          weekday: -1,
          ordinal: 1,
        } as any)
      ).toThrow(TypeError);
      expect(() =>
        Tracking.validateFrequency({
          type: "yearly",
          kind: "weekday_ordinal",
          weekday: 7,
          ordinal: 1,
        } as any)
      ).toThrow(TypeError);
    });

    it("should throw TypeError for yearly frequency weekday_ordinal kind missing ordinal", () => {
      expect(() =>
        Tracking.validateFrequency({
          type: "yearly",
          kind: "weekday_ordinal",
          weekday: 1,
        } as any)
      ).toThrow(TypeError);
    });

    it("should throw TypeError for yearly frequency weekday_ordinal kind with invalid ordinal", () => {
      expect(() =>
        Tracking.validateFrequency({
          type: "yearly",
          kind: "weekday_ordinal",
          weekday: 1,
          ordinal: 0,
        } as any)
      ).toThrow(TypeError);
      expect(() =>
        Tracking.validateFrequency({
          type: "yearly",
          kind: "weekday_ordinal",
          weekday: 1,
          ordinal: 6,
        } as any)
      ).toThrow(TypeError);
    });

    it("should throw TypeError for one-time frequency missing date", () => {
      expect(() =>
        Tracking.validateFrequency({ type: "one-time" } as any)
      ).toThrow(TypeError);
    });

    it("should throw TypeError for one-time frequency with invalid date format", () => {
      expect(() =>
        Tracking.validateFrequency({
          type: "one-time",
          date: "invalid",
        } as any)
      ).toThrow(TypeError);
      expect(() =>
        Tracking.validateFrequency({
          type: "one-time",
          date: "2024-1-1",
        } as any)
      ).toThrow(TypeError);
    });

    it("should throw TypeError for one-time frequency with past date", () => {
      // Create a date for yesterday in local timezone to avoid timezone issues
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      // Format as YYYY-MM-DD in local timezone
      const year = yesterday.getFullYear();
      const month = String(yesterday.getMonth() + 1).padStart(2, "0");
      const day = String(yesterday.getDate()).padStart(2, "0");
      const dateStr = `${year}-${month}-${day}`;
      expect(() =>
        Tracking.validateFrequency({
          type: "one-time",
          date: dateStr,
        } as any)
      ).toThrow(TypeError);
    });
  });

  describe("validate with icon and frequency", () => {
    it("should validate icon when present", () => {
      const tracking = new Tracking({
        id: 1,
        user_id: userId,
        question: "Did I exercise?",
        frequency: { type: "daily" },
        icon: "  😊  ",
      });

      const validated = tracking.validate();
      expect(validated.icon).toBe("😊");
    });

    it("should validate frequency pattern when present", () => {
      const tracking = new Tracking({
        id: 1,
        user_id: userId,
        question: "Did I exercise?",
        frequency: { type: "weekly", days: [0, 1, 2] },
      });

      const validated = tracking.validate();
      expect(validated.frequency).toEqual({
        type: "weekly",
        days: [0, 1, 2],
      });
    });

    it("should throw error for invalid icon", () => {
      const tracking = new Tracking({
        id: 1,
        user_id: userId,
        question: "Did I exercise?",
        frequency: { type: "daily" },
        icon: "a".repeat(21),
      });

      expect(() => tracking.validate()).toThrow(TypeError);
    });

    it("should throw error for invalid frequency pattern", () => {
      const tracking = new Tracking({
        id: 1,
        user_id: userId,
        question: "Did I exercise?",
        frequency: { type: "weekly" } as any,
      });

      expect(() => tracking.validate()).toThrow(TypeError);
    });
  });

  describe("save with optional fields", () => {
    it("should create tracking with details, icon, and frequency", async () => {
      const tracking = new Tracking({
        id: 0,
        user_id: userId,
        question: "Did I exercise?",
        frequency: { type: "weekly", days: [0, 1] },
        details: "Some details",
        icon: "🏃",
      });

      const saved = await tracking.save(db);

      expect(saved.id).toBeGreaterThan(0);
      expect(saved.details).toBe("Some details");
      expect(saved.icon).toBe("🏃");
      expect(saved.frequency).toEqual({
        type: "weekly",
        days: [0, 1],
      });
    });

    it("should update tracking with details, icon, and frequency", async () => {
      const result = await db.run(
        "INSERT INTO trackings (user_id, question, frequency) VALUES (?, ?, ?)",
        [userId, "Original question", JSON.stringify({ type: "daily" })]
      );
      const trackingId = result.lastID;

      const tracking = new Tracking({
        id: trackingId,
        user_id: userId,
        question: "Updated question",
        frequency: { type: "weekly", days: [0, 1, 2] },
        details: "Updated details",
        icon: "✅",
      });

      const saved = await tracking.save(db);

      expect(saved.id).toBe(trackingId);
      expect(saved.details).toBe("Updated details");
      expect(saved.icon).toBe("✅");
      expect(saved.frequency).toEqual({
        type: "weekly",
        days: [0, 1, 2],
      });
    });

    it("should update tracking with null details and icon (frequency is required)", async () => {
      const result = await db.run(
        "INSERT INTO trackings (user_id, question, details, icon, frequency) VALUES (?, ?, ?, ?, ?)",
        [
          userId,
          "Original question",
          "Original details",
          "🏃",
          JSON.stringify({ type: "daily" }),
        ]
      );
      const trackingId = result.lastID;

      const tracking = new Tracking({
        id: trackingId,
        user_id: userId,
        question: "Updated question",
        frequency: { type: "daily" },
        details: undefined,
        icon: undefined,
      });

      const saved = await tracking.save(db);

      expect(saved.id).toBe(trackingId);
      expect(saved.details).toBeUndefined();
      expect(saved.icon).toBeUndefined();
      expect(saved.frequency).toEqual({ type: "daily" });
    });
  });

  describe("update with all fields", () => {
    it("should update tracking with icon", async () => {
      const result = await db.run(
        "INSERT INTO trackings (user_id, question, frequency) VALUES (?, ?, ?)",
        [userId, "Original question", JSON.stringify({ type: "daily" })]
      );
      const trackingId = result.lastID;

      const tracking = new Tracking({
        id: trackingId,
        user_id: userId,
        question: "Original question",
        frequency: { type: "daily" },
      });

      const updated = await tracking.update({ icon: "🏃" }, db);

      expect(updated.icon).toBe("🏃");
    });

    it("should update tracking with frequency pattern", async () => {
      const result = await db.run(
        "INSERT INTO trackings (user_id, question, frequency) VALUES (?, ?, ?)",
        [userId, "Original question", JSON.stringify({ type: "daily" })]
      );
      const trackingId = result.lastID;

      const tracking = new Tracking({
        id: trackingId,
        user_id: userId,
        question: "Original question",
        frequency: { type: "daily" },
      });

      const frequency: Frequency = { type: "weekly", days: [0, 6] };

      const updated = await tracking.update({ frequency }, db);

      expect(updated.frequency).toEqual(frequency);
    });

    it("should update tracking with details", async () => {
      const result = await db.run(
        "INSERT INTO trackings (user_id, question, frequency) VALUES (?, ?, ?)",
        [userId, "Original question", JSON.stringify({ type: "daily" })]
      );
      const trackingId = result.lastID;

      const tracking = new Tracking({
        id: trackingId,
        user_id: userId,
        question: "Original question",
        frequency: { type: "daily" },
      });

      const updated = await tracking.update({ details: "Updated details" }, db);

      expect(updated.details).toBe("Updated details");
    });

    it("should update tracking with multiple fields", async () => {
      const result = await db.run(
        "INSERT INTO trackings (user_id, question, frequency) VALUES (?, ?, ?)",
        [userId, "Original question", JSON.stringify({ type: "daily" })]
      );
      const trackingId = result.lastID;

      const tracking = new Tracking({
        id: trackingId,
        user_id: userId,
        question: "Original question",
        frequency: { type: "daily" },
      });

      const frequency: Frequency = {
        type: "monthly",
        kind: "day_number",
        day_numbers: [1, 15],
      };

      const updated = await tracking.update(
        {
          question: "Updated question",
          details: "Updated details",
          icon: "✅",
          frequency,
        },
        db
      );

      expect(updated.question).toBe("Updated question");
      expect(updated.details).toBe("Updated details");
      expect(updated.icon).toBe("✅");
      expect(updated.frequency).toEqual(frequency);
    });
  });

  describe("loadById with frequency parsing", () => {
    it("should load tracking with valid frequency JSON", async () => {
      const frequency: Frequency = { type: "weekly", days: [0, 1, 2] };
      const result = await db.run(
        "INSERT INTO trackings (user_id, question, frequency) VALUES (?, ?, ?)",
        [userId, "Did I exercise?", JSON.stringify(frequency)]
      );
      const trackingId = result.lastID;

      const tracking = await Tracking.loadById(trackingId, userId, db);

      expect(tracking).not.toBeNull();
      expect(tracking?.frequency).toEqual(frequency);
    });

    it("should handle invalid frequency JSON gracefully", async () => {
      const result = await db.run(
        "INSERT INTO trackings (user_id, question, frequency) VALUES (?, ?, ?)",
        [userId, "Did I exercise?", "invalid json"]
      );
      const trackingId = result.lastID;

      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => { });

      await expect(Tracking.loadById(trackingId, userId, db)).rejects.toThrow();

      consoleErrorSpy.mockRestore();
    });
  });

  describe("loadByUserId with frequency parsing", () => {
    it("should load trackings with valid frequency JSON", async () => {
      const frequency1: Frequency = { type: "daily" };
      const frequency2: Frequency = { type: "weekly", days: [0, 6] };
      await db.run(
        "INSERT INTO trackings (user_id, question, frequency) VALUES (?, ?, ?)",
        [userId, "Question 1", JSON.stringify(frequency1)]
      );
      await db.run(
        "INSERT INTO trackings (user_id, question, frequency) VALUES (?, ?, ?)",
        [userId, "Question 2", JSON.stringify(frequency2)]
      );

      const trackings = await Tracking.loadByUserId(userId, db);

      expect(trackings).toHaveLength(2);
      const frequencies = trackings.map((t) => t.frequency);
      expect(frequencies).toContainEqual(frequency1);
      expect(frequencies).toContainEqual(frequency2);
    });
  });

  describe("State validation", () => {
    it("should validate valid state values", () => {
      expect(Tracking.validateState("Running")).toBe(TrackingState.RUNNING);
      expect(Tracking.validateState("Paused")).toBe(TrackingState.PAUSED);
      expect(Tracking.validateState("Archived")).toBe(TrackingState.ARCHIVED);
    });

    it("should throw TypeError for invalid state", () => {
      expect(() => Tracking.validateState("Invalid")).toThrow(TypeError);
      expect(() => Tracking.validateState("")).toThrow(TypeError);
      expect(() => Tracking.validateState("running")).toThrow(TypeError);
    });

    it("should throw TypeError for non-string state", () => {
      expect(() => Tracking.validateState(123 as any)).toThrow(TypeError);
      expect(() => Tracking.validateState(null as any)).toThrow(TypeError);
      expect(() => Tracking.validateState(undefined as any)).toThrow(TypeError);
    });
  });

  describe("State transitions", () => {
    it("should allow transition from Running to Paused", () => {
      expect(() =>
        Tracking.validateStateTransition(
          TrackingState.RUNNING,
          TrackingState.PAUSED
        )
      ).not.toThrow();
    });

    it("should allow transition from Running to Archived", () => {
      expect(() =>
        Tracking.validateStateTransition(
          TrackingState.RUNNING,
          TrackingState.ARCHIVED
        )
      ).not.toThrow();
    });

    it("should allow transition from Paused to Running", () => {
      expect(() =>
        Tracking.validateStateTransition(
          TrackingState.PAUSED,
          TrackingState.RUNNING
        )
      ).not.toThrow();
    });

    it("should allow transition from Paused to Archived", () => {
      expect(() =>
        Tracking.validateStateTransition(
          TrackingState.PAUSED,
          TrackingState.ARCHIVED
        )
      ).not.toThrow();
    });

    it("should allow transition from Archived to Running", () => {
      expect(() =>
        Tracking.validateStateTransition(
          TrackingState.ARCHIVED,
          TrackingState.RUNNING
        )
      ).not.toThrow();
    });

    it("should allow transition from Archived to Paused", () => {
      expect(() =>
        Tracking.validateStateTransition(
          TrackingState.ARCHIVED,
          TrackingState.PAUSED
        )
      ).not.toThrow();
    });

    it("should throw TypeError for same state transition", () => {
      expect(() =>
        Tracking.validateStateTransition(
          TrackingState.RUNNING,
          TrackingState.RUNNING
        )
      ).toThrow(TypeError);
      expect(() =>
        Tracking.validateStateTransition(
          TrackingState.PAUSED,
          TrackingState.PAUSED
        )
      ).toThrow(TypeError);
      expect(() =>
        Tracking.validateStateTransition(
          TrackingState.ARCHIVED,
          TrackingState.ARCHIVED
        )
      ).toThrow(TypeError);
    });

    it("should include error message in TypeError for same state transition", () => {
      try {
        Tracking.validateStateTransition(
          TrackingState.RUNNING,
          TrackingState.RUNNING
        );
      } catch (error) {
        expect(error).toBeInstanceOf(TypeError);
        expect((error as Error).message).toContain("same state");
      }
    });
  });
});



