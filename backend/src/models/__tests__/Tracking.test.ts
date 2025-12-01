import { Tracking, TrackingType, TrackingData } from "../Tracking.js";
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
              question TEXT NOT NULL CHECK(length(question) <= 500),
              type TEXT NOT NULL CHECK(type IN ('true_false', 'register')),
              notes TEXT,
              icon TEXT,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
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
        [
          userId,
          "Did I exercise?",
          TrackingType.TRUE_FALSE,
          "2024-01-01T00:00:00Z",
        ]
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
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      });
    });
  });

  describe("loadById", () => {
    it("should load tracking by id", async () => {
      const result = await db.run(
        "INSERT INTO trackings (user_id, question, type) VALUES (?, ?, ?)",
        [
          userId,
          "Did I exercise?",
          TrackingType.TRUE_FALSE,
          "2024-01-01T00:00:00Z",
        ]
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
        [
          otherUserId,
          "Did I exercise?",
          TrackingType.TRUE_FALSE,
          "2024-01-01T00:00:00Z",
        ]
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
});
