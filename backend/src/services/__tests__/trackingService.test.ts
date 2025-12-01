import { vi } from "vitest";
import sqlite3 from "sqlite3";
import { TrackingService } from "../trackingService.js";
import { TrackingType } from "../../models/Tracking.js";
import { Database } from "../../db/database.js";

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
              question TEXT NOT NULL CHECK(length(question) <= 500),
              type TEXT NOT NULL CHECK(type IN ('true_false', 'register')),
              notes TEXT,
              icon TEXT,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_trackings_user_id ON trackings(user_id);
            CREATE INDEX IF NOT EXISTS idx_trackings_created_at ON trackings(created_at);
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
        TrackingType.TRUE_FALSE
      );

      expect(tracking).not.toBeNull();
      expect(tracking.question).toBe("Did I exercise today?");
      expect(tracking.type).toBe(TrackingType.TRUE_FALSE);
      expect(tracking.user_id).toBe(testUserId);
      expect(tracking.id).toBeGreaterThan(0);
    });

    it("should create tracking with notes", async () => {
      const tracking = await trackingService.createTracking(
        testUserId,
        "Did I meditate?",
        TrackingType.TRUE_FALSE,
        "Meditation notes"
      );

      expect(tracking.notes).toBe("Meditation notes");
    });

    it("should throw error for invalid question", async () => {
      await expect(
        trackingService.createTracking(testUserId, "", TrackingType.TRUE_FALSE)
      ).rejects.toThrow();
    });

    it("should throw error for invalid type", async () => {
      await expect(
        trackingService.createTracking(
          testUserId,
          "Valid question",
          "invalid_type"
        )
      ).rejects.toThrow();
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
});
