import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Database } from "../../../db/database.js";
import { BaseEntityService } from "../BaseEntityService.js";
import { Tracking, TrackingData } from "../../../models/Tracking.js";

/**
 * Concrete implementation of BaseEntityService for testing.
 */
class TestEntityService extends BaseEntityService<TrackingData, Tracking> {
  protected async loadModelById(
    id: number,
    userId: number
  ): Promise<Tracking | null> {
    return await Tracking.loadById(id, userId, this.db);
  }

  protected async loadModelsByUserId(userId: number): Promise<Tracking[]> {
    return await Tracking.loadByUserId(userId, this.db);
  }

  protected toData(model: Tracking): TrackingData {
    return model.toData();
  }

  protected getEntityName(): string {
    return "TRACKING";
  }
}

/**
 * Create an in-memory database for testing.
 */
async function createTestDatabase(): Promise<Database> {
  return new Promise((resolve, reject) => {
    const sqlite3 = require("sqlite3");
    const db = new sqlite3.Database(":memory:", (err: Error | null) => {
      if (err) {
        reject(err);
        return;
      }

      db.run("PRAGMA foreign_keys = ON", (err: Error | null) => {
        if (err) {
          reject(err);
          return;
        }

        db.run("PRAGMA journal_mode = WAL", (err: Error | null) => {
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
              last_access DATETIME,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
          `,
            (err: Error | null) => {
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

describe("BaseEntityService", () => {
  let testDb: Database;
  let testService: TestEntityService;
  let testUserId: number;

  beforeEach(async () => {
    testDb = await createTestDatabase();
    testService = new TestEntityService(testDb);

    // Create a test user
    const userResult = await testDb.run(
      "INSERT INTO users (name, email) VALUES (?, ?)",
      ["Test User", "test@example.com"]
    );
    testUserId = userResult.lastID!;
  });

  afterEach(async () => {
    await testDb.close();
    vi.restoreAllMocks();
  });

  describe("getById", () => {
    it("should return null when entity does not exist", async () => {
      const entity = await testService.getById(999, testUserId);
      expect(entity).toBeNull();
    });

    it("should return entity when it exists", async () => {
      const result = await testDb.run(
        "INSERT INTO trackings (user_id, question) VALUES (?, ?)",
        [testUserId, "Test question"]
      );
      const trackingId = result.lastID!;

      const entity = await testService.getById(trackingId, testUserId);
      expect(entity).not.toBeNull();
      expect(entity?.id).toBe(trackingId);
      expect(entity?.question).toBe("Test question");
    });
  });

  describe("getAllByUserId", () => {
    it("should return empty array when no entities exist", async () => {
      const entities = await testService.getAllByUserId(testUserId);
      expect(entities).toEqual([]);
    });

    it("should return all entities for a user", async () => {
      await testDb.run(
        "INSERT INTO trackings (user_id, question) VALUES (?, ?)",
        [testUserId, "Question 1"]
      );
      await testDb.run(
        "INSERT INTO trackings (user_id, question) VALUES (?, ?)",
        [testUserId, "Question 2"]
      );

      const entities = await testService.getAllByUserId(testUserId);
      expect(entities.length).toBe(2);
      expect(entities.map((e) => e.question)).toContain("Question 1");
      expect(entities.map((e) => e.question)).toContain("Question 2");
    });
  });
});
