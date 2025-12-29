import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { TrackingSchedule, TrackingScheduleData } from "../TrackingSchedule.js";
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
              email TEXT NOT NULL UNIQUE,
              locale TEXT DEFAULT 'en-US',
              timezone TEXT
            );
            CREATE TABLE IF NOT EXISTS trackings (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id INTEGER NOT NULL,
              question TEXT NOT NULL CHECK(length(question) <= 100),
              notes TEXT,
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

describe("TrackingSchedule Model", () => {
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
      "INSERT INTO trackings (user_id, question, frequency) VALUES (?, ?, ?)",
      [userId, "Did I exercise?", JSON.stringify({ type: "daily" })]
    );
    trackingId = trackingResult.lastID;
  });

  afterEach(async () => {
    await db.close();
  });

  describe("constructor", () => {
    it("should create TrackingSchedule instance with provided data", () => {
      const scheduleData: TrackingScheduleData = {
        id: 1,
        tracking_id: trackingId,
        hour: 9,
        minutes: 0,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      };

      const schedule = new TrackingSchedule(scheduleData);

      expect(schedule.id).toBe(1);
      expect(schedule.tracking_id).toBe(trackingId);
      expect(schedule.hour).toBe(9);
      expect(schedule.minutes).toBe(0);
      expect(schedule.created_at).toBe("2024-01-01T00:00:00Z");
      expect(schedule.updated_at).toBe("2024-01-01T00:00:00Z");
    });

    it("should create TrackingSchedule instance with minimal data", () => {
      const scheduleData: TrackingScheduleData = {
        id: 1,
        tracking_id: trackingId,
        hour: 10,
        minutes: 30,
      };

      const schedule = new TrackingSchedule(scheduleData);

      expect(schedule.id).toBe(1);
      expect(schedule.tracking_id).toBe(trackingId);
      expect(schedule.hour).toBe(10);
      expect(schedule.minutes).toBe(30);
      expect(schedule.created_at).toBeUndefined();
      expect(schedule.updated_at).toBeUndefined();
    });
  });

  describe("validate", () => {
    it("should validate valid schedule", () => {
      const schedule = new TrackingSchedule({
        id: 1,
        tracking_id: trackingId,
        hour: 9,
        minutes: 0,
      });

      const validated = schedule.validate();

      expect(validated.hour).toBe(9);
      expect(validated.minutes).toBe(0);
    });

    it("should throw error for invalid hour (too low)", () => {
      const schedule = new TrackingSchedule({
        id: 1,
        tracking_id: trackingId,
        hour: -1,
        minutes: 0,
      });

      expect(() => schedule.validate()).toThrow(TypeError);
    });

    it("should throw error for invalid hour (too high)", () => {
      const schedule = new TrackingSchedule({
        id: 1,
        tracking_id: trackingId,
        hour: 24,
        minutes: 0,
      });

      expect(() => schedule.validate()).toThrow(TypeError);
    });

    it("should throw error for invalid minutes (too low)", () => {
      const schedule = new TrackingSchedule({
        id: 1,
        tracking_id: trackingId,
        hour: 9,
        minutes: -1,
      });

      expect(() => schedule.validate()).toThrow(TypeError);
    });

    it("should throw error for invalid minutes (too high)", () => {
      const schedule = new TrackingSchedule({
        id: 1,
        tracking_id: trackingId,
        hour: 9,
        minutes: 60,
      });

      expect(() => schedule.validate()).toThrow(TypeError);
    });
  });

  describe("save", () => {
    it("should create new schedule when id is not set", async () => {
      const schedule = new TrackingSchedule({
        id: 0,
        tracking_id: trackingId,
        hour: 9,
        minutes: 0,
      });

      const saved = await schedule.save(db);

      expect(saved.id).toBeGreaterThan(0);
      expect(saved.tracking_id).toBe(trackingId);
      expect(saved.hour).toBe(9);
      expect(saved.minutes).toBe(0);
      expect(schedule.id).toBe(saved.id);
    });

    it("should update existing schedule when id is set", async () => {
      // Create a schedule first
      const createResult = await db.run(
        "INSERT INTO tracking_schedules (tracking_id, hour, minutes) VALUES (?, ?, ?)",
        [trackingId, 9, 0]
      );
      const scheduleId = createResult.lastID;

      const schedule = new TrackingSchedule({
        id: scheduleId,
        tracking_id: trackingId,
        hour: 10,
        minutes: 30,
      });

      const saved = await schedule.save(db);

      expect(saved.id).toBe(scheduleId);
      expect(saved.hour).toBe(10);
      expect(saved.minutes).toBe(30);

      // Verify it was updated in the database
      const dbRow = await db.get<{ hour: number; minutes: number }>(
        "SELECT hour, minutes FROM tracking_schedules WHERE id = ?",
        [scheduleId]
      );
      expect(dbRow?.hour).toBe(10);
      expect(dbRow?.minutes).toBe(30);
    });

    it("should throw error if validation fails", async () => {
      const schedule = new TrackingSchedule({
        id: 0,
        tracking_id: trackingId,
        hour: 25, // Invalid hour
        minutes: 0,
      });

      await expect(schedule.save(db)).rejects.toThrow();
    });
  });

  describe("delete", () => {
    it("should delete schedule from database", async () => {
      // Create a schedule first
      const createResult = await db.run(
        "INSERT INTO tracking_schedules (tracking_id, hour, minutes) VALUES (?, ?, ?)",
        [trackingId, 9, 0]
      );
      const scheduleId = createResult.lastID;

      const schedule = new TrackingSchedule({
        id: scheduleId,
        tracking_id: trackingId,
        hour: 9,
        minutes: 0,
      });

      await schedule.delete(db);

      // Verify it was deleted
      const dbRow = await db.get(
        "SELECT * FROM tracking_schedules WHERE id = ?",
        [scheduleId]
      );
      expect(dbRow).toBeUndefined();
    });

    it("should throw error if schedule has no id", async () => {
      const schedule = new TrackingSchedule({
        id: 0,
        tracking_id: trackingId,
        hour: 9,
        minutes: 0,
      });

      await expect(schedule.delete(db)).rejects.toThrow(
        "Cannot delete schedule without ID"
      );
    });

    it("should throw error if schedule not found", async () => {
      const schedule = new TrackingSchedule({
        id: 99999,
        tracking_id: trackingId,
        hour: 9,
        minutes: 0,
      });

      await expect(schedule.delete(db)).rejects.toThrow(
        "Tracking schedule not found"
      );
    });
  });

  describe("loadByTrackingId", () => {
    it("should load all schedules for a tracking", async () => {
      // Create multiple schedules
      await db.run(
        "INSERT INTO tracking_schedules (tracking_id, hour, minutes) VALUES (?, ?, ?)",
        [trackingId, 14, 30]
      );
      await db.run(
        "INSERT INTO tracking_schedules (tracking_id, hour, minutes) VALUES (?, ?, ?)",
        [trackingId, 9, 0]
      );
      await db.run(
        "INSERT INTO tracking_schedules (tracking_id, hour, minutes) VALUES (?, ?, ?)",
        [trackingId, 20, 0]
      );

      const schedules = await TrackingSchedule.loadByTrackingId(trackingId, db);

      expect(schedules.length).toBe(3);
      // Should be sorted by hour, then minutes
      expect(schedules[0].hour).toBe(9);
      expect(schedules[0].minutes).toBe(0);
      expect(schedules[1].hour).toBe(14);
      expect(schedules[1].minutes).toBe(30);
      expect(schedules[2].hour).toBe(20);
      expect(schedules[2].minutes).toBe(0);
    });

    it("should return empty array when no schedules exist", async () => {
      const schedules = await TrackingSchedule.loadByTrackingId(trackingId, db);

      expect(schedules).toEqual([]);
    });

    it("should load schedules with timestamps", async () => {
      await db.run(
        "INSERT INTO tracking_schedules (tracking_id, hour, minutes) VALUES (?, ?, ?)",
        [trackingId, 9, 0]
      );

      const schedules = await TrackingSchedule.loadByTrackingId(trackingId, db);

      expect(schedules.length).toBe(1);
      expect(schedules[0].created_at).toBeDefined();
      expect(schedules[0].updated_at).toBeDefined();
    });

    it("should only load schedules for the specified tracking", async () => {
      // Create another tracking
      const tracking2Result = await db.run(
        "INSERT INTO trackings (user_id, question, frequency) VALUES (?, ?, ?)",
        [userId, "Another question?", JSON.stringify({ type: "daily" })]
      );
      const tracking2Id = tracking2Result.lastID;

      // Create schedules for both trackings
      await db.run(
        "INSERT INTO tracking_schedules (tracking_id, hour, minutes) VALUES (?, ?, ?)",
        [trackingId, 9, 0]
      );
      await db.run(
        "INSERT INTO tracking_schedules (tracking_id, hour, minutes) VALUES (?, ?, ?)",
        [tracking2Id, 10, 0]
      );

      const schedules1 = await TrackingSchedule.loadByTrackingId(
        trackingId,
        db
      );
      const schedules2 = await TrackingSchedule.loadByTrackingId(
        tracking2Id,
        db
      );

      expect(schedules1.length).toBe(1);
      expect(schedules1[0].hour).toBe(9);
      expect(schedules2.length).toBe(1);
      expect(schedules2[0].hour).toBe(10);
    });
  });

  describe("toData", () => {
    it("should convert schedule instance to data object", () => {
      const schedule = new TrackingSchedule({
        id: 1,
        tracking_id: trackingId,
        hour: 9,
        minutes: 0,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      });

      const data = schedule.toData();

      expect(data.id).toBe(1);
      expect(data.tracking_id).toBe(trackingId);
      expect(data.hour).toBe(9);
      expect(data.minutes).toBe(0);
      expect(data.created_at).toBe("2024-01-01T00:00:00Z");
      expect(data.updated_at).toBe("2024-01-01T00:00:00Z");
    });

    it("should convert schedule without timestamps to data object", () => {
      const schedule = new TrackingSchedule({
        id: 1,
        tracking_id: trackingId,
        hour: 10,
        minutes: 30,
      });

      const data = schedule.toData();

      expect(data.id).toBe(1);
      expect(data.tracking_id).toBe(trackingId);
      expect(data.hour).toBe(10);
      expect(data.minutes).toBe(30);
      expect(data.created_at).toBeUndefined();
      expect(data.updated_at).toBeUndefined();
    });
  });
});
