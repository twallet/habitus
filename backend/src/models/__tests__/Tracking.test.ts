import { vi } from "vitest";
import {
  Tracking,
  TrackingType,
  TrackingState,
  TrackingData,
} from "../Tracking.js";
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
            CREATE INDEX IF NOT EXISTS idx_tracking_schedules_tracking_id ON tracking_schedules(tracking_id);
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
        type: TrackingType.TRUE_FALSE,
        notes: "Some notes",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      };

      const tracking = new Tracking(trackingData);

      expect(tracking.id).toBe(1);
      expect(tracking.user_id).toBe(userId);
      expect(tracking.question).toBe("Did I exercise?");
      expect(tracking.type).toBe(TrackingType.TRUE_FALSE);
      expect(tracking.notes).toBe("Some notes");
    });

    it("should create Tracking instance with minimal data", () => {
      const trackingData: TrackingData = {
        id: 1,
        user_id: userId,
        question: "Did I exercise?",
        type: TrackingType.TRUE_FALSE,
      };

      const tracking = new Tracking(trackingData);

      expect(tracking.id).toBe(1);
      expect(tracking.question).toBe("Did I exercise?");
      expect(tracking.notes).toBeUndefined();
    });
  });

  describe("validate", () => {
    it("should validate and normalize tracking fields", () => {
      const tracking = new Tracking({
        id: 1,
        user_id: userId,
        question: "  Did I exercise?  ",
        type: TrackingType.TRUE_FALSE,
        notes: "  Some notes  ",
      });

      const validated = tracking.validate();

      expect(validated.question).toBe("Did I exercise?");
      expect(validated.notes).toBe("Some notes");
    });

    it("should throw error for invalid question", () => {
      const tracking = new Tracking({
        id: 1,
        user_id: userId,
        question: "",
        type: TrackingType.TRUE_FALSE,
      });

      expect(() => tracking.validate()).toThrow(TypeError);
    });

    it("should throw error for invalid type", () => {
      const tracking = new Tracking({
        id: 1,
        user_id: userId,
        question: "Did I exercise?",
        type: "invalid" as TrackingType,
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
        type: TrackingType.TRUE_FALSE,
      });

      const saved = await tracking.save(db);

      expect(saved.id).toBeGreaterThan(0);
      expect(saved.question).toBe("Did I exercise?");
      expect(saved.type).toBe(TrackingType.TRUE_FALSE);
    });

    it("should update existing tracking when id is set", async () => {
      const result = await db.run(
        "INSERT INTO trackings (user_id, question, type) VALUES (?, ?, ?)",
        [userId, "Original question", TrackingType.TRUE_FALSE]
      );
      const trackingId = result.lastID;

      const tracking = new Tracking({
        id: trackingId,
        user_id: userId,
        question: "Updated question",
        type: TrackingType.REGISTER,
      });

      const saved = await tracking.save(db);

      expect(saved.id).toBe(trackingId);
      expect(saved.question).toBe("Updated question");
      expect(saved.type).toBe(TrackingType.REGISTER);
    });

    it("should throw error if creation fails", async () => {
      const tracking = new Tracking({
        id: 0,
        user_id: userId,
        question: "Did I exercise?",
        type: TrackingType.TRUE_FALSE,
      });

      // Close database to cause failure
      await db.close();

      await expect(tracking.save(db)).rejects.toThrow();
    });
  });

  describe("update", () => {
    it("should update tracking fields", async () => {
      const result = await db.run(
        "INSERT INTO trackings (user_id, question, type) VALUES (?, ?, ?)",
        [userId, "Original question", TrackingType.TRUE_FALSE]
      );
      const trackingId = result.lastID;

      const tracking = new Tracking({
        id: trackingId,
        user_id: userId,
        question: "Original question",
        type: TrackingType.TRUE_FALSE,
      });

      const updated = await tracking.update(
        {
          question: "Updated question",
          notes: "Updated notes",
        },
        db
      );

      expect(updated.question).toBe("Updated question");
      expect(updated.notes).toBe("Updated notes");
    });

    it("should throw error if tracking has no id", async () => {
      const tracking = new Tracking({
        id: 0,
        user_id: userId,
        question: "Did I exercise?",
        type: TrackingType.TRUE_FALSE,
      });

      await expect(
        tracking.update({ question: "Updated" }, db)
      ).rejects.toThrow("Cannot update tracking without ID");
    });
  });

  describe("delete", () => {
    it("should delete tracking from database", async () => {
      const result = await db.run(
        "INSERT INTO trackings (user_id, question, type) VALUES (?, ?, ?)",
        [userId, "Did I exercise?", TrackingType.TRUE_FALSE]
      );
      const trackingId = result.lastID;

      const tracking = new Tracking({
        id: trackingId,
        user_id: userId,
        question: "Did I exercise?",
        type: TrackingType.TRUE_FALSE,
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
        type: TrackingType.TRUE_FALSE,
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
        type: TrackingType.TRUE_FALSE,
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
        type: TrackingType.TRUE_FALSE,
        notes: "Some notes",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      });

      const data = tracking.toData();

      expect(data).toEqual({
        id: 1,
        user_id: userId,
        question: "Did I exercise?",
        type: TrackingType.TRUE_FALSE,
        notes: "Some notes",
        state: TrackingState.RUNNING,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      });
    });
  });

  describe("loadById", () => {
    it("should load tracking by id", async () => {
      const result = await db.run(
        "INSERT INTO trackings (user_id, question, type) VALUES (?, ?, ?)",
        [userId, "Did I exercise?", TrackingType.TRUE_FALSE]
      );
      const trackingId = result.lastID;

      const tracking = await Tracking.loadById(trackingId, userId, db);

      expect(tracking).not.toBeNull();
      expect(tracking?.id).toBe(trackingId);
      expect(tracking?.question).toBe("Did I exercise?");
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
        "INSERT INTO trackings (user_id, question, type) VALUES (?, ?, ?)",
        [otherUserId, "Did I exercise?", TrackingType.TRUE_FALSE]
      );
      const trackingId = result.lastID;

      const tracking = await Tracking.loadById(trackingId, userId, db);
      expect(tracking).toBeNull();
    });
  });

  describe("loadByUserId", () => {
    it("should load all trackings for a user", async () => {
      const result1 = await db.run(
        "INSERT INTO trackings (user_id, question, type) VALUES (?, ?, ?)",
        [userId, "Question 1", TrackingType.TRUE_FALSE]
      );
      const id1 = result1.lastID;
      const result2 = await db.run(
        "INSERT INTO trackings (user_id, question, type) VALUES (?, ?, ?)",
        [userId, "Question 2", TrackingType.REGISTER]
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

  describe("validateType", () => {
    it("should accept valid tracking types", () => {
      expect(Tracking.validateType("true_false")).toBe(TrackingType.TRUE_FALSE);
      expect(Tracking.validateType("register")).toBe(TrackingType.REGISTER);
    });

    it("should normalize type to lowercase", () => {
      expect(Tracking.validateType("TRUE_FALSE")).toBe(TrackingType.TRUE_FALSE);
      expect(Tracking.validateType("Register")).toBe(TrackingType.REGISTER);
    });

    it("should trim whitespace", () => {
      expect(Tracking.validateType("  true_false  ")).toBe(
        TrackingType.TRUE_FALSE
      );
      expect(Tracking.validateType("  register  ")).toBe(TrackingType.REGISTER);
    });

    it("should throw TypeError for invalid type", () => {
      expect(() => Tracking.validateType("invalid")).toThrow(TypeError);
      expect(() => Tracking.validateType("boolean")).toThrow(TypeError);
      expect(() => Tracking.validateType("")).toThrow(TypeError);
    });

    it("should throw TypeError for non-string type", () => {
      expect(() => Tracking.validateType(null as any)).toThrow(TypeError);
      expect(() => Tracking.validateType(123 as any)).toThrow(TypeError);
      expect(() => Tracking.validateType(undefined as any)).toThrow(TypeError);
    });
  });

  describe("validateNotes", () => {
    it("should accept valid notes", () => {
      expect(Tracking.validateNotes("Some notes")).toBe("Some notes");
      expect(Tracking.validateNotes("  Trimmed notes  ")).toBe("Trimmed notes");
    });

    it("should return undefined for empty/null/undefined notes", () => {
      expect(Tracking.validateNotes("")).toBeUndefined();
      expect(Tracking.validateNotes("   ")).toBeUndefined();
      expect(Tracking.validateNotes(null)).toBeUndefined();
      expect(Tracking.validateNotes(undefined)).toBeUndefined();
    });

    it("should throw TypeError for non-string notes", () => {
      expect(() => Tracking.validateNotes(123 as any)).toThrow(TypeError);
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

  describe("validateDays", () => {
    it("should accept valid INTERVAL pattern", () => {
      const days = {
        pattern_type: "interval" as const,
        interval_value: 2,
        interval_unit: "days" as const,
      };
      expect(Tracking.validateDays(days)).toEqual(days);
    });

    it("should accept valid DAY_OF_WEEK pattern", () => {
      const days = {
        pattern_type: "day_of_week" as const,
        days: [0, 1, 2],
      };
      expect(Tracking.validateDays(days)).toEqual(days);
    });

    it("should accept valid DAY_OF_MONTH pattern with day_number", () => {
      const days = {
        pattern_type: "day_of_month" as const,
        type: "day_number" as const,
        day_numbers: [1, 15, 30],
      };
      expect(Tracking.validateDays(days)).toEqual(days);
    });

    it("should accept valid DAY_OF_MONTH pattern with last_day", () => {
      const days = {
        pattern_type: "day_of_month" as const,
        type: "last_day" as const,
      };
      expect(Tracking.validateDays(days)).toEqual(days);
    });

    it("should accept valid DAY_OF_MONTH pattern with weekday_ordinal", () => {
      const days = {
        pattern_type: "day_of_month" as const,
        type: "weekday_ordinal" as const,
        weekday: 1,
        ordinal: 2,
      };
      expect(Tracking.validateDays(days)).toEqual(days);
    });

    it("should accept valid DAY_OF_YEAR pattern with date", () => {
      const days = {
        pattern_type: "day_of_year" as const,
        type: "date" as const,
        month: 12,
        day: 25,
      };
      expect(Tracking.validateDays(days)).toEqual(days);
    });

    it("should accept valid DAY_OF_YEAR pattern with weekday_ordinal", () => {
      const days = {
        pattern_type: "day_of_year" as const,
        type: "weekday_ordinal" as const,
        weekday: 0,
        ordinal: 4,
      };
      expect(Tracking.validateDays(days)).toEqual(days);
    });

    it("should return undefined for null/undefined days", () => {
      expect(Tracking.validateDays(null)).toBeUndefined();
      expect(Tracking.validateDays(undefined)).toBeUndefined();
    });

    it("should throw TypeError for non-object days", () => {
      expect(() => Tracking.validateDays("invalid" as any)).toThrow(TypeError);
      expect(() => Tracking.validateDays(123 as any)).toThrow(TypeError);
      expect(() => Tracking.validateDays([] as any)).toThrow(TypeError);
    });

    it("should throw TypeError for missing pattern_type", () => {
      expect(() => Tracking.validateDays({} as any)).toThrow(TypeError);
    });

    it("should throw TypeError for invalid pattern_type", () => {
      expect(() =>
        Tracking.validateDays({ pattern_type: "invalid" } as any)
      ).toThrow(TypeError);
    });

    it("should throw TypeError for INTERVAL pattern missing interval_value", () => {
      expect(() =>
        Tracking.validateDays({
          pattern_type: "interval",
          interval_unit: "days",
        } as any)
      ).toThrow(TypeError);
    });

    it("should throw TypeError for INTERVAL pattern with invalid interval_value", () => {
      expect(() =>
        Tracking.validateDays({
          pattern_type: "interval",
          interval_value: -1,
          interval_unit: "days",
        } as any)
      ).toThrow(TypeError);
      expect(() =>
        Tracking.validateDays({
          pattern_type: "interval",
          interval_value: 0,
          interval_unit: "days",
        } as any)
      ).toThrow(TypeError);
      expect(() =>
        Tracking.validateDays({
          pattern_type: "interval",
          interval_value: 1.5,
          interval_unit: "days",
        } as any)
      ).toThrow(TypeError);
    });

    it("should throw TypeError for INTERVAL pattern missing interval_unit", () => {
      expect(() =>
        Tracking.validateDays({
          pattern_type: "interval",
          interval_value: 2,
        } as any)
      ).toThrow(TypeError);
    });

    it("should throw TypeError for INTERVAL pattern with invalid interval_unit", () => {
      expect(() =>
        Tracking.validateDays({
          pattern_type: "interval",
          interval_value: 2,
          interval_unit: "invalid",
        } as any)
      ).toThrow(TypeError);
    });

    it("should throw TypeError for DAY_OF_WEEK pattern missing days array", () => {
      expect(() =>
        Tracking.validateDays({
          pattern_type: "day_of_week",
        } as any)
      ).toThrow(TypeError);
    });

    it("should throw TypeError for DAY_OF_WEEK pattern with empty days array", () => {
      expect(() =>
        Tracking.validateDays({
          pattern_type: "day_of_week",
          days: [],
        } as any)
      ).toThrow(TypeError);
    });

    it("should throw TypeError for DAY_OF_WEEK pattern with invalid day values", () => {
      expect(() =>
        Tracking.validateDays({
          pattern_type: "day_of_week",
          days: [-1],
        } as any)
      ).toThrow(TypeError);
      expect(() =>
        Tracking.validateDays({
          pattern_type: "day_of_week",
          days: [7],
        } as any)
      ).toThrow(TypeError);
      expect(() =>
        Tracking.validateDays({
          pattern_type: "day_of_week",
          days: [1.5],
        } as any)
      ).toThrow(TypeError);
    });

    it("should throw TypeError for DAY_OF_WEEK pattern with duplicate days", () => {
      expect(() =>
        Tracking.validateDays({
          pattern_type: "day_of_week",
          days: [0, 1, 0],
        } as any)
      ).toThrow(TypeError);
    });

    it("should throw TypeError for DAY_OF_MONTH pattern missing type", () => {
      expect(() =>
        Tracking.validateDays({
          pattern_type: "day_of_month",
        } as any)
      ).toThrow(TypeError);
    });

    it("should throw TypeError for DAY_OF_MONTH pattern with invalid type", () => {
      expect(() =>
        Tracking.validateDays({
          pattern_type: "day_of_month",
          type: "invalid",
        } as any)
      ).toThrow(TypeError);
    });

    it("should throw TypeError for DAY_OF_MONTH pattern day_number missing day_numbers", () => {
      expect(() =>
        Tracking.validateDays({
          pattern_type: "day_of_month",
          type: "day_number",
        } as any)
      ).toThrow(TypeError);
    });

    it("should throw TypeError for DAY_OF_MONTH pattern day_number with invalid day_numbers", () => {
      expect(() =>
        Tracking.validateDays({
          pattern_type: "day_of_month",
          type: "day_number",
          day_numbers: [0],
        } as any)
      ).toThrow(TypeError);
      expect(() =>
        Tracking.validateDays({
          pattern_type: "day_of_month",
          type: "day_number",
          day_numbers: [32],
        } as any)
      ).toThrow(TypeError);
    });

    it("should throw TypeError for DAY_OF_MONTH pattern weekday_ordinal missing weekday", () => {
      expect(() =>
        Tracking.validateDays({
          pattern_type: "day_of_month",
          type: "weekday_ordinal",
          ordinal: 1,
        } as any)
      ).toThrow(TypeError);
    });

    it("should throw TypeError for DAY_OF_MONTH pattern weekday_ordinal with invalid weekday", () => {
      expect(() =>
        Tracking.validateDays({
          pattern_type: "day_of_month",
          type: "weekday_ordinal",
          weekday: -1,
          ordinal: 1,
        } as any)
      ).toThrow(TypeError);
      expect(() =>
        Tracking.validateDays({
          pattern_type: "day_of_month",
          type: "weekday_ordinal",
          weekday: 7,
          ordinal: 1,
        } as any)
      ).toThrow(TypeError);
    });

    it("should throw TypeError for DAY_OF_MONTH pattern weekday_ordinal missing ordinal", () => {
      expect(() =>
        Tracking.validateDays({
          pattern_type: "day_of_month",
          type: "weekday_ordinal",
          weekday: 1,
        } as any)
      ).toThrow(TypeError);
    });

    it("should throw TypeError for DAY_OF_MONTH pattern weekday_ordinal with invalid ordinal", () => {
      expect(() =>
        Tracking.validateDays({
          pattern_type: "day_of_month",
          type: "weekday_ordinal",
          weekday: 1,
          ordinal: 0,
        } as any)
      ).toThrow(TypeError);
      expect(() =>
        Tracking.validateDays({
          pattern_type: "day_of_month",
          type: "weekday_ordinal",
          weekday: 1,
          ordinal: 6,
        } as any)
      ).toThrow(TypeError);
    });

    it("should throw TypeError for DAY_OF_YEAR pattern missing type", () => {
      expect(() =>
        Tracking.validateDays({
          pattern_type: "day_of_year",
        } as any)
      ).toThrow(TypeError);
    });

    it("should throw TypeError for DAY_OF_YEAR pattern with invalid type", () => {
      expect(() =>
        Tracking.validateDays({
          pattern_type: "day_of_year",
          type: "invalid",
        } as any)
      ).toThrow(TypeError);
    });

    it("should throw TypeError for DAY_OF_YEAR pattern date missing month", () => {
      expect(() =>
        Tracking.validateDays({
          pattern_type: "day_of_year",
          type: "date",
          day: 25,
        } as any)
      ).toThrow(TypeError);
    });

    it("should throw TypeError for DAY_OF_YEAR pattern date with invalid month", () => {
      expect(() =>
        Tracking.validateDays({
          pattern_type: "day_of_year",
          type: "date",
          month: 0,
          day: 25,
        } as any)
      ).toThrow(TypeError);
      expect(() =>
        Tracking.validateDays({
          pattern_type: "day_of_year",
          type: "date",
          month: 13,
          day: 25,
        } as any)
      ).toThrow(TypeError);
    });

    it("should throw TypeError for DAY_OF_YEAR pattern date missing day", () => {
      expect(() =>
        Tracking.validateDays({
          pattern_type: "day_of_year",
          type: "date",
          month: 12,
        } as any)
      ).toThrow(TypeError);
    });

    it("should throw TypeError for DAY_OF_YEAR pattern date with invalid day", () => {
      expect(() =>
        Tracking.validateDays({
          pattern_type: "day_of_year",
          type: "date",
          month: 12,
          day: 0,
        } as any)
      ).toThrow(TypeError);
      expect(() =>
        Tracking.validateDays({
          pattern_type: "day_of_year",
          type: "date",
          month: 12,
          day: 32,
        } as any)
      ).toThrow(TypeError);
    });

    it("should throw TypeError for DAY_OF_YEAR pattern weekday_ordinal missing weekday", () => {
      expect(() =>
        Tracking.validateDays({
          pattern_type: "day_of_year",
          type: "weekday_ordinal",
          ordinal: 1,
        } as any)
      ).toThrow(TypeError);
    });

    it("should throw TypeError for DAY_OF_YEAR pattern weekday_ordinal with invalid weekday", () => {
      expect(() =>
        Tracking.validateDays({
          pattern_type: "day_of_year",
          type: "weekday_ordinal",
          weekday: -1,
          ordinal: 1,
        } as any)
      ).toThrow(TypeError);
    });

    it("should throw TypeError for DAY_OF_YEAR pattern weekday_ordinal missing ordinal", () => {
      expect(() =>
        Tracking.validateDays({
          pattern_type: "day_of_year",
          type: "weekday_ordinal",
          weekday: 1,
        } as any)
      ).toThrow(TypeError);
    });

    it("should throw TypeError for DAY_OF_YEAR pattern weekday_ordinal with invalid ordinal", () => {
      expect(() =>
        Tracking.validateDays({
          pattern_type: "day_of_year",
          type: "weekday_ordinal",
          weekday: 1,
          ordinal: 0,
        } as any)
      ).toThrow(TypeError);
    });
  });

  describe("validate with icon and days", () => {
    it("should validate icon when present", () => {
      const tracking = new Tracking({
        id: 1,
        user_id: userId,
        question: "Did I exercise?",
        type: TrackingType.TRUE_FALSE,
        icon: "  😊  ",
      });

      const validated = tracking.validate();
      expect(validated.icon).toBe("😊");
    });

    it("should validate days pattern when present", () => {
      const tracking = new Tracking({
        id: 1,
        user_id: userId,
        question: "Did I exercise?",
        type: TrackingType.TRUE_FALSE,
        days: {
          pattern_type: "interval",
          interval_value: 2,
          interval_unit: "days",
        },
      });

      const validated = tracking.validate();
      expect(validated.days).toEqual({
        pattern_type: "interval",
        interval_value: 2,
        interval_unit: "days",
      });
    });

    it("should throw error for invalid icon", () => {
      const tracking = new Tracking({
        id: 1,
        user_id: userId,
        question: "Did I exercise?",
        type: TrackingType.TRUE_FALSE,
        icon: "a".repeat(21),
      });

      expect(() => tracking.validate()).toThrow(TypeError);
    });

    it("should throw error for invalid days pattern", () => {
      const tracking = new Tracking({
        id: 1,
        user_id: userId,
        question: "Did I exercise?",
        type: TrackingType.TRUE_FALSE,
        days: {
          pattern_type: "interval",
        } as any,
      });

      expect(() => tracking.validate()).toThrow(TypeError);
    });
  });

  describe("save with optional fields", () => {
    it("should create tracking with notes, icon, and days", async () => {
      const tracking = new Tracking({
        id: 0,
        user_id: userId,
        question: "Did I exercise?",
        type: TrackingType.TRUE_FALSE,
        notes: "Some notes",
        icon: "🏃",
        days: {
          pattern_type: "interval",
          interval_value: 2,
          interval_unit: "days",
        },
      });

      const saved = await tracking.save(db);

      expect(saved.id).toBeGreaterThan(0);
      expect(saved.notes).toBe("Some notes");
      expect(saved.icon).toBe("🏃");
      expect(saved.days).toEqual({
        pattern_type: "interval",
        interval_value: 2,
        interval_unit: "days",
      });
    });

    it("should update tracking with notes, icon, and days", async () => {
      const result = await db.run(
        "INSERT INTO trackings (user_id, question, type) VALUES (?, ?, ?)",
        [userId, "Original question", TrackingType.TRUE_FALSE]
      );
      const trackingId = result.lastID;

      const tracking = new Tracking({
        id: trackingId,
        user_id: userId,
        question: "Updated question",
        type: TrackingType.REGISTER,
        notes: "Updated notes",
        icon: "✅",
        days: {
          pattern_type: "day_of_week",
          days: [0, 1, 2],
        },
      });

      const saved = await tracking.save(db);

      expect(saved.id).toBe(trackingId);
      expect(saved.notes).toBe("Updated notes");
      expect(saved.icon).toBe("✅");
      expect(saved.days).toEqual({
        pattern_type: "day_of_week",
        days: [0, 1, 2],
      });
    });

    it("should update tracking with null notes, icon, and days", async () => {
      const result = await db.run(
        "INSERT INTO trackings (user_id, question, type, notes, icon, days) VALUES (?, ?, ?, ?, ?, ?)",
        [
          userId,
          "Original question",
          TrackingType.TRUE_FALSE,
          "Original notes",
          "🏃",
          JSON.stringify({
            pattern_type: "interval",
            interval_value: 1,
            interval_unit: "days",
          }),
        ]
      );
      const trackingId = result.lastID;

      const tracking = new Tracking({
        id: trackingId,
        user_id: userId,
        question: "Updated question",
        type: TrackingType.REGISTER,
        notes: undefined,
        icon: undefined,
        days: undefined,
      });

      const saved = await tracking.save(db);

      expect(saved.id).toBe(trackingId);
      expect(saved.notes).toBeUndefined();
      expect(saved.icon).toBeUndefined();
      expect(saved.days).toBeUndefined();
    });
  });

  describe("update with all fields", () => {
    it("should update tracking with icon", async () => {
      const result = await db.run(
        "INSERT INTO trackings (user_id, question, type) VALUES (?, ?, ?)",
        [userId, "Original question", TrackingType.TRUE_FALSE]
      );
      const trackingId = result.lastID;

      const tracking = new Tracking({
        id: trackingId,
        user_id: userId,
        question: "Original question",
        type: TrackingType.TRUE_FALSE,
      });

      const updated = await tracking.update({ icon: "🏃" }, db);

      expect(updated.icon).toBe("🏃");
    });

    it("should update tracking with days pattern", async () => {
      const result = await db.run(
        "INSERT INTO trackings (user_id, question, type) VALUES (?, ?, ?)",
        [userId, "Original question", TrackingType.TRUE_FALSE]
      );
      const trackingId = result.lastID;

      const tracking = new Tracking({
        id: trackingId,
        user_id: userId,
        question: "Original question",
        type: TrackingType.TRUE_FALSE,
      });

      const daysPattern = {
        pattern_type: "day_of_week" as const,
        days: [0, 6],
      };

      const updated = await tracking.update({ days: daysPattern }, db);

      expect(updated.days).toEqual(daysPattern);
    });

    it("should update tracking with type", async () => {
      const result = await db.run(
        "INSERT INTO trackings (user_id, question, type) VALUES (?, ?, ?)",
        [userId, "Original question", TrackingType.TRUE_FALSE]
      );
      const trackingId = result.lastID;

      const tracking = new Tracking({
        id: trackingId,
        user_id: userId,
        question: "Original question",
        type: TrackingType.TRUE_FALSE,
      });

      const updated = await tracking.update(
        { type: TrackingType.REGISTER },
        db
      );

      expect(updated.type).toBe(TrackingType.REGISTER);
    });

    it("should update tracking with multiple fields", async () => {
      const result = await db.run(
        "INSERT INTO trackings (user_id, question, type) VALUES (?, ?, ?)",
        [userId, "Original question", TrackingType.TRUE_FALSE]
      );
      const trackingId = result.lastID;

      const tracking = new Tracking({
        id: trackingId,
        user_id: userId,
        question: "Original question",
        type: TrackingType.TRUE_FALSE,
      });

      const daysPattern = {
        pattern_type: "interval" as const,
        interval_value: 3,
        interval_unit: "weeks" as const,
      };

      const updated = await tracking.update(
        {
          question: "Updated question",
          type: TrackingType.REGISTER,
          notes: "Updated notes",
          icon: "✅",
          days: daysPattern,
        },
        db
      );

      expect(updated.question).toBe("Updated question");
      expect(updated.type).toBe(TrackingType.REGISTER);
      expect(updated.notes).toBe("Updated notes");
      expect(updated.icon).toBe("✅");
      expect(updated.days).toEqual(daysPattern);
    });
  });

  describe("loadById with days parsing", () => {
    it("should load tracking with valid days JSON", async () => {
      const daysPattern = {
        pattern_type: "interval",
        interval_value: 2,
        interval_unit: "days",
      };
      const result = await db.run(
        "INSERT INTO trackings (user_id, question, type, days) VALUES (?, ?, ?, ?)",
        [
          userId,
          "Did I exercise?",
          TrackingType.TRUE_FALSE,
          JSON.stringify(daysPattern),
        ]
      );
      const trackingId = result.lastID;

      const tracking = await Tracking.loadById(trackingId, userId, db);

      expect(tracking).not.toBeNull();
      expect(tracking?.days).toEqual(daysPattern);
    });

    it("should handle invalid days JSON gracefully", async () => {
      const result = await db.run(
        "INSERT INTO trackings (user_id, question, type, days) VALUES (?, ?, ?, ?)",
        [userId, "Did I exercise?", TrackingType.TRUE_FALSE, "invalid json"]
      );
      const trackingId = result.lastID;

      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const tracking = await Tracking.loadById(trackingId, userId, db);

      expect(tracking).not.toBeNull();
      expect(tracking?.days).toBeUndefined();
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it("should load tracking without days", async () => {
      const result = await db.run(
        "INSERT INTO trackings (user_id, question, type, days) VALUES (?, ?, ?, ?)",
        [userId, "Did I exercise?", TrackingType.TRUE_FALSE, null]
      );
      const trackingId = result.lastID;

      const tracking = await Tracking.loadById(trackingId, userId, db);

      expect(tracking).not.toBeNull();
      expect(tracking?.days).toBeUndefined();
    });
  });

  describe("loadByUserId with days parsing", () => {
    it("should load trackings with valid days JSON", async () => {
      const daysPattern1 = {
        pattern_type: "interval",
        interval_value: 1,
        interval_unit: "days",
      };
      const daysPattern2 = {
        pattern_type: "day_of_week",
        days: [0, 6],
      };
      await db.run(
        "INSERT INTO trackings (user_id, question, type, days) VALUES (?, ?, ?, ?)",
        [
          userId,
          "Question 1",
          TrackingType.TRUE_FALSE,
          JSON.stringify(daysPattern1),
        ]
      );
      await db.run(
        "INSERT INTO trackings (user_id, question, type, days) VALUES (?, ?, ?, ?)",
        [
          userId,
          "Question 2",
          TrackingType.REGISTER,
          JSON.stringify(daysPattern2),
        ]
      );

      const trackings = await Tracking.loadByUserId(userId, db);

      expect(trackings).toHaveLength(2);
      const daysPatterns = trackings.map((t) => t.days);
      expect(daysPatterns).toContainEqual(daysPattern1);
      expect(daysPatterns).toContainEqual(daysPattern2);
    });

    it("should handle invalid days JSON gracefully", async () => {
      await db.run(
        "INSERT INTO trackings (user_id, question, type, days) VALUES (?, ?, ?, ?)",
        [userId, "Question 1", TrackingType.TRUE_FALSE, "invalid json"]
      );
      await db.run(
        "INSERT INTO trackings (user_id, question, type, days) VALUES (?, ?, ?, ?)",
        [userId, "Question 2", TrackingType.REGISTER, null]
      );

      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const trackings = await Tracking.loadByUserId(userId, db);

      expect(trackings).toHaveLength(2);
      expect(trackings[0].days).toBeUndefined();
      expect(trackings[1].days).toBeUndefined();
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });

  describe("State validation", () => {
    it("should validate valid state values", () => {
      expect(Tracking.validateState("Running")).toBe(TrackingState.RUNNING);
      expect(Tracking.validateState("Paused")).toBe(TrackingState.PAUSED);
      expect(Tracking.validateState("Archived")).toBe(TrackingState.ARCHIVED);
      expect(Tracking.validateState("Deleted")).toBe(TrackingState.DELETED);
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
    it("should allow valid transitions from Running to Paused", () => {
      expect(() =>
        Tracking.validateStateTransition(
          TrackingState.RUNNING,
          TrackingState.PAUSED
        )
      ).not.toThrow();
    });

    it("should allow valid transitions from Paused to Running", () => {
      expect(() =>
        Tracking.validateStateTransition(
          TrackingState.PAUSED,
          TrackingState.RUNNING
        )
      ).not.toThrow();
    });

    it("should allow valid transitions from Paused to Archived", () => {
      expect(() =>
        Tracking.validateStateTransition(
          TrackingState.PAUSED,
          TrackingState.ARCHIVED
        )
      ).not.toThrow();
    });

    it("should allow valid transitions from Archived to Running", () => {
      expect(() =>
        Tracking.validateStateTransition(
          TrackingState.ARCHIVED,
          TrackingState.RUNNING
        )
      ).not.toThrow();
    });

    it("should allow valid transitions from Archived to Deleted", () => {
      expect(() =>
        Tracking.validateStateTransition(
          TrackingState.ARCHIVED,
          TrackingState.DELETED
        )
      ).not.toThrow();
    });

    it("should allow same state transition", () => {
      expect(() =>
        Tracking.validateStateTransition(
          TrackingState.RUNNING,
          TrackingState.RUNNING
        )
      ).not.toThrow();
    });

    it("should throw TypeError for invalid transition from Running to Archived", () => {
      expect(() =>
        Tracking.validateStateTransition(
          TrackingState.RUNNING,
          TrackingState.ARCHIVED
        )
      ).toThrow(TypeError);
    });

    it("should throw TypeError for invalid transition from Running to Deleted", () => {
      expect(() =>
        Tracking.validateStateTransition(
          TrackingState.RUNNING,
          TrackingState.DELETED
        )
      ).toThrow(TypeError);
    });

    it("should throw TypeError for invalid transition from Paused to Deleted", () => {
      expect(() =>
        Tracking.validateStateTransition(
          TrackingState.PAUSED,
          TrackingState.DELETED
        )
      ).toThrow(TypeError);
    });

    it("should throw TypeError for any transition from Deleted", () => {
      expect(() =>
        Tracking.validateStateTransition(
          TrackingState.DELETED,
          TrackingState.RUNNING
        )
      ).toThrow(TypeError);
      expect(() =>
        Tracking.validateStateTransition(
          TrackingState.DELETED,
          TrackingState.PAUSED
        )
      ).toThrow(TypeError);
    });

    it("should include error message in TypeError for invalid transitions", () => {
      expect(() => {
        Tracking.validateStateTransition(
          TrackingState.RUNNING,
          TrackingState.ARCHIVED
        );
      }).toThrow(TypeError);

      try {
        Tracking.validateStateTransition(
          TrackingState.RUNNING,
          TrackingState.ARCHIVED
        );
      } catch (error) {
        expect(error).toBeInstanceOf(TypeError);
        expect((error as Error).message).toContain("Invalid state transition");
        expect((error as Error).message).toContain("Running");
        expect((error as Error).message).toContain("Archived");
      }
    });
  });

  describe("loadByUserId filtering", () => {
    it("should filter out Deleted trackings", async () => {
      await db.run(
        "INSERT INTO trackings (user_id, question, type, state) VALUES (?, ?, ?, ?)",
        [userId, "Running tracking", TrackingType.TRUE_FALSE, "Running"]
      );
      await db.run(
        "INSERT INTO trackings (user_id, question, type, state) VALUES (?, ?, ?, ?)",
        [userId, "Paused tracking", TrackingType.TRUE_FALSE, "Paused"]
      );
      await db.run(
        "INSERT INTO trackings (user_id, question, type, state) VALUES (?, ?, ?, ?)",
        [userId, "Deleted tracking", TrackingType.TRUE_FALSE, "Deleted"]
      );

      const trackings = await Tracking.loadByUserId(userId, db);

      expect(trackings).toHaveLength(2);
      expect(trackings.some((t) => t.question === "Deleted tracking")).toBe(
        false
      );
      expect(trackings.some((t) => t.question === "Running tracking")).toBe(
        true
      );
      expect(trackings.some((t) => t.question === "Paused tracking")).toBe(
        true
      );
    });
  });
});
