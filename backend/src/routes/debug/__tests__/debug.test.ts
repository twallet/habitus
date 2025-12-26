import { vi } from "vitest";
import request from "supertest";
import express from "express";
import sqlite3 from "sqlite3";
import { Database } from "../../../db/database.js";
import { TrackingService } from "../../../services/trackingService.js";
import { ReminderService } from "../../../services/reminderService.js";
import { UserService } from "../../../services/userService.js";
import * as authMiddlewareModule from "../../../middleware/authMiddleware.js";
import * as servicesModule from "../../../services/index.js";

// Mock authenticateToken before importing the router
vi.mock("../../../middleware/authMiddleware.js", () => ({
  authenticateToken: vi.fn(),
  authenticateTokenOptional: vi.fn(),
  AuthRequest: {},
}));

// Mock services module before importing router
vi.mock("../../../services/index.js", () => ({
  ServiceManager: {
    getTrackingService: vi.fn(),
    getReminderService: vi.fn(),
    getUserService: vi.fn(),
    initializeServices: vi.fn(),
  },
}));

// Import router after mocking
import debugRouter from "../debug.js";

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

        db.exec(
          `
          CREATE TABLE users (
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
            last_access DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          );
          CREATE TABLE trackings (
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
          CREATE TABLE tracking_schedules (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tracking_id INTEGER NOT NULL,
            hour INTEGER NOT NULL CHECK(hour >= 0 AND hour <= 23),
            minutes INTEGER NOT NULL CHECK(minutes >= 0 AND minutes <= 59),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (tracking_id) REFERENCES trackings(id) ON DELETE CASCADE,
            UNIQUE(tracking_id, hour, minutes)
          );
          CREATE TABLE reminders (
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
        `,
          (err) => {
            if (err) {
              reject(err);
              return;
            }
            // Create Database instance and manually set its internal db
            const database = new Database();
            (database as any).db = db;
            resolve(database);
          }
        );
      });
    });
  });
}

describe("Debug Routes", () => {
  let app: express.Application;
  let testDb: Database;
  const testUserId = 1;

  beforeEach(async () => {
    testDb = await createTestDatabase();

    // Insert test user
    await testDb.run("INSERT INTO users (id, name, email) VALUES (?, ?, ?)", [
      testUserId,
      "Test User",
      "test@example.com",
    ]);

    // Setup service mocks
    const userService = new UserService(testDb);
    const trackingService = new TrackingService(testDb);
    const reminderService = new ReminderService(testDb);

    vi.spyOn(servicesModule.ServiceManager, "getUserService").mockReturnValue(
      userService
    );
    vi.spyOn(
      servicesModule.ServiceManager,
      "getTrackingService"
    ).mockReturnValue(trackingService);
    vi.spyOn(
      servicesModule.ServiceManager,
      "getReminderService"
    ).mockReturnValue(reminderService);

    // Mock authenticateToken to set userId
    (authMiddlewareModule.authenticateToken as any).mockImplementation(
      (req: any, res: any, next: any) => {
        req.userId = testUserId;
        next();
      }
    );

    // Mock authenticateTokenOptional to set userId
    (authMiddlewareModule.authenticateTokenOptional as any).mockImplementation(
      (req: any, res: any, next: any) => {
        req.userId = testUserId;
        next();
      }
    );

    app = express();
    app.use(express.json());
    app.use("/api/debug", debugRouter);
  });

  afterEach(async () => {
    vi.clearAllMocks();
    if (testDb) {
      await testDb.close();
    }
  });

  describe("GET /api/debug", () => {
    it("should return debug log with no trackings", async () => {
      const response = await request(app)
        .get("/api/debug")
        .set("Authorization", "Bearer test-token");

      expect(response.status).toBe(200);
      expect(response.body.log).toContain("=== USERS ===");
      expect(response.body.log).toContain("USER #1");
      expect(response.body.log).toContain("ID=1");
      expect(response.body.log).toContain("Name=Test User");
      expect(response.body.log).toContain("Email=test@example.com");
      expect(response.body.log).toContain("=== TRACKINGS ===");
      expect(response.body.log).toContain(
        "No trackings found in the database."
      );
    });

    it("should return debug log with trackings and no reminders", async () => {
      const result = await testDb.run(
        "INSERT INTO trackings (user_id, question, icon, days, notes) VALUES (?, ?, ?, ?, ?)",
        [testUserId, "Test Question", "🏃", "1111111", "Test notes"]
      );
      const trackingId = result.lastID;

      // Insert schedule
      await testDb.run(
        "INSERT INTO tracking_schedules (tracking_id, hour, minutes) VALUES (?, ?, ?)",
        [trackingId, 9, 0]
      );

      const response = await request(app)
        .get("/api/debug")
        .set("Authorization", "Bearer test-token");

      expect(response.status).toBe(200);
      expect(response.body.log).toContain("TRACKING #1");
      expect(response.body.log).toContain(`ID=${trackingId}`);
      expect(response.body.log).toContain("Question=Test Question");
      expect(response.body.log).toContain("Icon=🏃");
      expect(response.body.log).toContain("Days=1111111");
      expect(response.body.log).toContain("Notes=Test notes");
      expect(response.body.log).toContain("Schedules=[09:00]");
      expect(response.body.log).toContain("REMINDERS: None");
    });

    it("should return debug log with trackings and reminders", async () => {
      const result = await testDb.run(
        "INSERT INTO trackings (user_id, question) VALUES (?, ?)",
        [testUserId, "Test Question"]
      );
      const trackingId = result.lastID;

      // Insert schedule
      await testDb.run(
        "INSERT INTO tracking_schedules (tracking_id, hour, minutes) VALUES (?, ?, ?)",
        [trackingId, 9, 0]
      );

      // Insert reminder (use Pending status since getAllByUserId filters out Answered reminders)
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 1);
      const reminderResult = await testDb.run(
        "INSERT INTO reminders (tracking_id, user_id, scheduled_time, notes, status, value) VALUES (?, ?, ?, ?, ?, ?)",
        [
          trackingId,
          testUserId,
          futureDate.toISOString().slice(0, 19).replace("T", " "),
          "Reminder notes",
          "Pending",
          "Dismissed",
        ]
      );
      const reminderId = reminderResult.lastID;

      const response = await request(app)
        .get("/api/debug")
        .set("Authorization", "Bearer test-token");

      expect(response.status).toBe(200);
      expect(response.body.log).toContain("TRACKING #1");
      expect(response.body.log).toContain("REMINDER");
      expect(response.body.log).toContain(`ID=${reminderId}`);
      expect(response.body.log).toContain(`TrackingID=${trackingId}`);
      expect(response.body.log).toContain(`UserID=${testUserId}`);
      expect(response.body.log).toContain("Answer=null");
      expect(response.body.log).toContain("Notes=Reminder notes");
      expect(response.body.log).toContain("Status=Pending");
    });

    it("should return debug log with multiple trackings and reminders", async () => {
      // Insert first tracking
      const result1 = await testDb.run(
        "INSERT INTO trackings (user_id, question) VALUES (?, ?)",
        [testUserId, "Question 1"]
      );
      const trackingId1 = result1.lastID;

      await testDb.run(
        "INSERT INTO tracking_schedules (tracking_id, hour, minutes) VALUES (?, ?, ?)",
        [trackingId1, 9, 0]
      );

      // Insert second tracking
      const result2 = await testDb.run(
        "INSERT INTO trackings (user_id, question) VALUES (?, ?)",
        [testUserId, "Question 2"]
      );
      const trackingId2 = result2.lastID;

      await testDb.run(
        "INSERT INTO tracking_schedules (tracking_id, hour, minutes) VALUES (?, ?, ?)",
        [trackingId2, 10, 30]
      );

      // Insert reminder for first tracking
      await testDb.run(
        "INSERT INTO reminders (tracking_id, user_id, scheduled_time, status) VALUES (?, ?, ?, ?)",
        [trackingId1, testUserId, "2024-01-01 09:00:00", "Pending"]
      );

      const response = await request(app)
        .get("/api/debug")
        .set("Authorization", "Bearer test-token");

      expect(response.status).toBe(200);
      expect(response.body.log).toContain("TRACKING #1");
      expect(response.body.log).toContain("TRACKING #2");
      expect(response.body.log).toContain("Question 1");
      expect(response.body.log).toContain("Question 2");
    });

    it("should handle trackings with null icon, days, and notes", async () => {
      const result = await testDb.run(
        "INSERT INTO trackings (user_id, question) VALUES (?, ?)",
        [testUserId, "Test Question"]
      );
      const trackingId = result.lastID;

      await testDb.run(
        "INSERT INTO tracking_schedules (tracking_id, hour, minutes) VALUES (?, ?, ?)",
        [trackingId, 9, 0]
      );

      const response = await request(app)
        .get("/api/debug")
        .set("Authorization", "Bearer test-token");

      expect(response.status).toBe(200);
      expect(response.body.log).toContain("Icon=null");
      expect(response.body.log).toContain("Days=null");
      expect(response.body.log).toContain("Notes=null");
    });

    it("should handle trackings with multiple schedules", async () => {
      const result = await testDb.run(
        "INSERT INTO trackings (user_id, question) VALUES (?, ?)",
        [testUserId, "Test Question"]
      );
      const trackingId = result.lastID;

      await testDb.run(
        "INSERT INTO tracking_schedules (tracking_id, hour, minutes) VALUES (?, ?, ?)",
        [trackingId, 9, 0]
      );
      await testDb.run(
        "INSERT INTO tracking_schedules (tracking_id, hour, minutes) VALUES (?, ?, ?)",
        [trackingId, 14, 30]
      );
      await testDb.run(
        "INSERT INTO tracking_schedules (tracking_id, hour, minutes) VALUES (?, ?, ?)",
        [trackingId, 20, 15]
      );

      const response = await request(app)
        .get("/api/debug")
        .set("Authorization", "Bearer test-token");

      expect(response.status).toBe(200);
      expect(response.body.log).toContain("Schedules=[09:00, 14:30, 20:15]");
    });

    it("should handle reminders with null notes", async () => {
      const result = await testDb.run(
        "INSERT INTO trackings (user_id, question) VALUES (?, ?)",
        [testUserId, "Test Question"]
      );
      const trackingId = result.lastID;

      await testDb.run(
        "INSERT INTO tracking_schedules (tracking_id, hour, minutes) VALUES (?, ?, ?)",
        [trackingId, 9, 0]
      );

      await testDb.run(
        "INSERT INTO reminders (tracking_id, user_id, scheduled_time, notes, status, value) VALUES (?, ?, ?, ?, ?, ?)",
        [
          trackingId,
          testUserId,
          "2024-01-01 09:00:00",
          null,
          "Pending",
          "Dismissed",
        ]
      );

      const response = await request(app)
        .get("/api/debug")
        .set("Authorization", "Bearer test-token");

      expect(response.status).toBe(200);
      expect(response.body.log).toContain("REMINDER");
      expect(response.body.log).toContain("Answer=null");
      expect(response.body.log).toContain("Notes=null");
    });

    it("should return debug log with multiple users", async () => {
      // Insert additional test user
      await testDb.run("INSERT INTO users (id, name, email) VALUES (?, ?, ?)", [
        2,
        "Another User",
        "another@example.com",
      ]);

      const response = await request(app)
        .get("/api/debug")
        .set("Authorization", "Bearer test-token");

      expect(response.status).toBe(200);
      expect(response.body.log).toContain("=== USERS ===");
      expect(response.body.log).toContain("USER #1");
      expect(response.body.log).toContain("Name=Test User");
      expect(response.body.log).toContain("Email=test@example.com");
      expect(response.body.log).toContain("USER #2");
      expect(response.body.log).toContain("Name=Another User");
      expect(response.body.log).toContain("Email=another@example.com");
    });

    it("should display notification settings for users", async () => {
      // Update test user with notification settings
      await testDb.run(
        "UPDATE users SET notification_channels = ?, telegram_chat_id = ? WHERE id = ?",
        [JSON.stringify(["Email", "Telegram"]), "123456789", testUserId]
      );

      const response = await request(app)
        .get("/api/debug")
        .set("Authorization", "Bearer test-token");

      expect(response.status).toBe(200);
      expect(response.body.log).toContain(
        "NotificationChannels=[Email, Telegram]"
      );
      expect(response.body.log).toContain("TelegramChatID=123456789");
    });

    it("should display None for notification channels when not set", async () => {
      // Ensure notification_channels is null
      await testDb.run(
        "UPDATE users SET notification_channels = NULL, telegram_chat_id = NULL WHERE id = ?",
        [testUserId]
      );

      const response = await request(app)
        .get("/api/debug")
        .set("Authorization", "Bearer test-token");

      expect(response.status).toBe(200);
      expect(response.body.log).toContain("NotificationChannels=[None]");
      expect(response.body.log).toContain("TelegramChatID=null");
    });

    it("should return 500 when service throws error", async () => {
      // Mock services to throw error
      vi.spyOn(servicesModule.ServiceManager, "getUserService").mockReturnValue(
        {
          getAllUsers: vi.fn().mockRejectedValue(new Error("Database error")),
        } as any
      );
      vi.spyOn(
        servicesModule.ServiceManager,
        "getTrackingService"
      ).mockReturnValue({
        getAllByUserId: vi.fn().mockRejectedValue(new Error("Database error")),
      } as any);

      const response = await request(app)
        .get("/api/debug")
        .set("Authorization", "Bearer test-token");

      expect(response.status).toBe(500);
      expect(response.body.error).toBe("Error generating debug log");
    });
  });
});
