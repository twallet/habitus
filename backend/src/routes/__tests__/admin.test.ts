import { vi, type Mock } from "vitest";
import request from "supertest";
import express from "express";
import sqlite3 from "sqlite3";
import { Database } from "../../db/database.js";
import { UserService } from "../../services/userService.js";
import { TrackingService } from "../../services/trackingService.js";
import * as adminMiddlewareModule from "../../middleware/adminMiddleware.js";
import * as servicesModule from "../../services/index.js";

// Mock requireAdmin middleware before importing the router
vi.mock("../../middleware/adminMiddleware.js", () => ({
  requireAdmin: vi.fn(),
  AdminMiddleware: vi.fn(),
}));

// Mock services module before importing router
vi.mock("../../services/index.js", () => ({
  ServiceManager: {
    getUserService: vi.fn(),
    getTrackingService: vi.fn(),
    initializeServices: vi.fn(),
  },
}));

// Import router after mocking
import adminRouter from "../admin/admin.js";

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

describe("Admin Routes", () => {
  let app: express.Application;
  let testDb: Database;
  let userService: UserService;
  let trackingService: TrackingService;
  let adminUserId: number;
  const originalEnv = process.env.ADMIN_EMAIL;

  beforeEach(async () => {
    // Create a fresh in-memory database for each test
    testDb = await createTestDatabase();
    userService = new UserService(testDb);
    trackingService = new TrackingService(testDb);

    // Create an admin user
    const adminResult = await testDb.run(
      "INSERT INTO users (name, email) VALUES (?, ?)",
      ["Admin User", "admin@example.com"]
    );
    adminUserId = adminResult.lastID;

    // Set ADMIN_EMAIL for tests
    process.env.ADMIN_EMAIL = "admin@example.com";

    // Reset all mocks first to ensure clean state
    vi.restoreAllMocks();

    // Mock requireAdmin middleware - must be set up before routes
    vi.spyOn(adminMiddlewareModule, "requireAdmin").mockImplementation(
      async (req: any, res: any, next: any) => {
        req.userId = adminUserId;
        next();
      }
    );

    // Mock getUserService to return our test service
    vi.spyOn(servicesModule.ServiceManager, "getUserService").mockReturnValue(
      userService
    );

    // Mock getTrackingService to return our test service
    vi.spyOn(
      servicesModule.ServiceManager,
      "getTrackingService"
    ).mockReturnValue(trackingService);

    // Create Express app with routes
    app = express();
    app.use(express.json());
    app.use("/api/admin", adminRouter);
  });

  afterEach(async () => {
    await testDb.close();
    vi.clearAllMocks();
    // Restore original env
    if (originalEnv) {
      process.env.ADMIN_EMAIL = originalEnv;
    } else {
      delete process.env.ADMIN_EMAIL;
    }
  });

  describe("GET /api/admin", () => {
    it("should return admin log with empty data when no data exists", async () => {
      // Delete the admin user created in beforeEach to test empty database
      await testDb.run("DELETE FROM users WHERE id = ?", [adminUserId]);

      const response = await request(app)
        .get("/api/admin")
        .set("Authorization", "Bearer admin-token");

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("log");
      expect(response.body.log).toContain("No users found in the database.");
      expect(response.body.log).toContain(
        "No trackings found in the database."
      );
    });

    it("should return admin log with users data", async () => {
      // Create a test user
      await testDb.run("INSERT INTO users (name, email) VALUES (?, ?)", [
        "Test User",
        "test@example.com",
      ]);

      const response = await request(app)
        .get("/api/admin")
        .set("Authorization", "Bearer admin-token");

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("log");
      expect(response.body.log).toContain("=== USERS ===");
      expect(response.body.log).toContain("Test User");
      expect(response.body.log).toContain("test@example.com");
    });

    it("should return admin log with trackings and reminders", async () => {
      // Create a test user
      const userResult = await testDb.run(
        "INSERT INTO users (name, email) VALUES (?, ?)",
        ["Test User", "test@example.com"]
      );
      const userId = userResult.lastID;

      // Create a tracking
      const trackingResult = await testDb.run(
        "INSERT INTO trackings (user_id, question, frequency) VALUES (?, ?, ?)",
        [userId, "Test Question", JSON.stringify({ type: "daily" })]
      );
      const trackingId = trackingResult.lastID;

      // Create a schedule
      await testDb.run(
        "INSERT INTO tracking_schedules (tracking_id, hour, minutes) VALUES (?, ?, ?)",
        [trackingId, 9, 0]
      );

      // Create a reminder
      await testDb.run(
        "INSERT INTO reminders (tracking_id, user_id, scheduled_time, status) VALUES (?, ?, ?, ?)",
        [trackingId, userId, new Date().toISOString(), "Pending"]
      );

      const response = await request(app)
        .get("/api/admin")
        .set("Authorization", "Bearer admin-token");

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("log");
      expect(response.body.log).toContain("=== TRACKINGS ===");
      expect(response.body.log).toContain("Test Question");
      expect(response.body.log).toContain("REMINDER");
    });

    it("should return 500 when service throws error", async () => {
      // Mock getUserService to throw error
      vi.spyOn(
        servicesModule.ServiceManager,
        "getUserService"
      ).mockImplementation(() => {
        throw new Error("Service error");
      });

      const response = await request(app)
        .get("/api/admin")
        .set("Authorization", "Bearer admin-token");

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toBe("Error generating admin log");
    });

    it("should return admin log with users having optional fields", async () => {
      // Create a user with all optional fields
      await testDb.run(
        "INSERT INTO users (name, email, profile_picture_url, telegram_chat_id, notification_channels, locale, timezone, last_access) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [
          "Full User",
          "full@example.com",
          "https://example.com/pic.jpg",
          "12345",
          JSON.stringify(["email", "telegram"]),
          "es-ES",
          "Europe/Madrid",
          new Date().toISOString(),
        ]
      );

      const response = await request(app)
        .get("/api/admin")
        .set("Authorization", "Bearer admin-token");

      expect(response.status).toBe(200);
      expect(response.body.log).toContain("Full User");
      expect(response.body.log).toContain("full@example.com");
      expect(response.body.log).toContain("https://example.com/pic.jpg");
      expect(response.body.log).toContain("12345");
      expect(response.body.log).toContain("email, telegram");
      expect(response.body.log).toContain("es-ES");
      expect(response.body.log).toContain("Europe/Madrid");
    });

    it("should return admin log with trackings in different states", async () => {
      const userResult = await testDb.run(
        "INSERT INTO users (name, email) VALUES (?, ?)",
        ["Test User", "test@example.com"]
      );
      const userId = userResult.lastID;

      // Create trackings in different states
      await testDb.run(
        "INSERT INTO trackings (user_id, question, frequency, state) VALUES (?, ?, ?, ?)",
        [
          userId,
          "Running Tracking",
          JSON.stringify({ type: "daily" }),
          "Running",
        ]
      );
      await testDb.run(
        "INSERT INTO trackings (user_id, question, frequency, state) VALUES (?, ?, ?, ?)",
        [userId, "Paused Tracking", JSON.stringify({ type: "daily" }), "Paused"]
      );
      await testDb.run(
        "INSERT INTO trackings (user_id, question, frequency, state) VALUES (?, ?, ?, ?)",
        [
          userId,
          "Archived Tracking",
          JSON.stringify({ type: "daily" }),
          "Archived",
        ]
      );

      const response = await request(app)
        .get("/api/admin")
        .set("Authorization", "Bearer admin-token");

      expect(response.status).toBe(200);
      expect(response.body.log).toContain("Running Tracking");
      expect(response.body.log).toContain("Paused Tracking");
      expect(response.body.log).toContain("Archived Tracking");
    });

    it("should return admin log with trackings without schedules", async () => {
      const userResult = await testDb.run(
        "INSERT INTO users (name, email) VALUES (?, ?)",
        ["Test User", "test@example.com"]
      );
      const userId = userResult.lastID;

      await testDb.run(
        "INSERT INTO trackings (user_id, question, frequency) VALUES (?, ?, ?)",
        [userId, "No Schedule Tracking", JSON.stringify({ type: "daily" })]
      );

      const response = await request(app)
        .get("/api/admin")
        .set("Authorization", "Bearer admin-token");

      expect(response.status).toBe(200);
      expect(response.body.log).toContain("No Schedule Tracking");
      expect(response.body.log).toContain("Schedules=[None]");
    });

    it("should return admin log with trackings without reminders", async () => {
      const userResult = await testDb.run(
        "INSERT INTO users (name, email) VALUES (?, ?)",
        ["Test User", "test@example.com"]
      );
      const userId = userResult.lastID;

      const trackingResult = await testDb.run(
        "INSERT INTO trackings (user_id, question, frequency) VALUES (?, ?, ?)",
        [userId, "No Reminder Tracking", JSON.stringify({ type: "daily" })]
      );
      const trackingId = trackingResult.lastID;

      await testDb.run(
        "INSERT INTO tracking_schedules (tracking_id, hour, minutes) VALUES (?, ?, ?)",
        [trackingId, 9, 0]
      );

      const response = await request(app)
        .get("/api/admin")
        .set("Authorization", "Bearer admin-token");

      expect(response.status).toBe(200);
      expect(response.body.log).toContain("No Reminder Tracking");
      expect(response.body.log).toContain("REMINDERS: None");
    });

    it("should return admin log with reminders in different statuses", async () => {
      const userResult = await testDb.run(
        "INSERT INTO users (name, email) VALUES (?, ?)",
        ["Test User", "test@example.com"]
      );
      const userId = userResult.lastID;

      const trackingResult = await testDb.run(
        "INSERT INTO trackings (user_id, question, frequency) VALUES (?, ?, ?)",
        [userId, "Test Tracking", JSON.stringify({ type: "daily" })]
      );
      const trackingId = trackingResult.lastID;

      // Create reminders with different statuses
      await testDb.run(
        "INSERT INTO reminders (tracking_id, user_id, scheduled_time, status, value) VALUES (?, ?, ?, ?, ?)",
        [trackingId, userId, new Date().toISOString(), "Pending", null]
      );
      await testDb.run(
        "INSERT INTO reminders (tracking_id, user_id, scheduled_time, status, value) VALUES (?, ?, ?, ?, ?)",
        [trackingId, userId, new Date().toISOString(), "Answered", "Completed"]
      );
      await testDb.run(
        "INSERT INTO reminders (tracking_id, user_id, scheduled_time, status, value) VALUES (?, ?, ?, ?, ?)",
        [trackingId, userId, new Date().toISOString(), "Upcoming", null]
      );

      const response = await request(app)
        .get("/api/admin")
        .set("Authorization", "Bearer admin-token");

      expect(response.status).toBe(200);
      expect(response.body.log).toContain("Status=Pending");
      expect(response.body.log).toContain("Status=Answered");
      expect(response.body.log).toContain("Status=Upcoming");
      expect(response.body.log).toContain("Answer=Completed");
    });

    it("should return admin log with reminders having notes", async () => {
      const userResult = await testDb.run(
        "INSERT INTO users (name, email) VALUES (?, ?)",
        ["Test User", "test@example.com"]
      );
      const userId = userResult.lastID;

      const trackingResult = await testDb.run(
        "INSERT INTO trackings (user_id, question, frequency) VALUES (?, ?, ?)",
        [userId, "Test Tracking", JSON.stringify({ type: "daily" })]
      );
      const trackingId = trackingResult.lastID;

      await testDb.run(
        "INSERT INTO reminders (tracking_id, user_id, scheduled_time, status, notes) VALUES (?, ?, ?, ?, ?)",
        [
          trackingId,
          userId,
          new Date().toISOString(),
          "Pending",
          "Test reminder notes",
        ]
      );

      const response = await request(app)
        .get("/api/admin")
        .set("Authorization", "Bearer admin-token");

      expect(response.status).toBe(200);
      expect(response.body.log).toContain("Notes=Test reminder notes");
    });

    it("should return admin log with trackings having notes and icon", async () => {
      const userResult = await testDb.run(
        "INSERT INTO users (name, email) VALUES (?, ?)",
        ["Test User", "test@example.com"]
      );
      const userId = userResult.lastID;

      await testDb.run(
        "INSERT INTO trackings (user_id, question, notes, icon, frequency) VALUES (?, ?, ?, ?, ?)",
        [
          userId,
          "Test Tracking",
          "Tracking notes",
          "🌱",
          JSON.stringify({ type: "daily" }),
        ]
      );

      const response = await request(app)
        .get("/api/admin")
        .set("Authorization", "Bearer admin-token");

      expect(response.status).toBe(200);
      expect(response.body.log).toContain("Tracking notes");
      expect(response.body.log).toContain("Icon=🌱");
    });

    it("should handle JSON parse errors in tracking frequency gracefully", async () => {
      const userResult = await testDb.run(
        "INSERT INTO users (name, email) VALUES (?, ?)",
        ["Test User", "test@example.com"]
      );
      const userId = userResult.lastID;

      // Insert tracking with invalid JSON frequency
      await testDb.run(
        "INSERT INTO trackings (user_id, question, frequency) VALUES (?, ?, ?)",
        [userId, "Invalid JSON Tracking", "invalid json{"]
      );

      const response = await request(app)
        .get("/api/admin")
        .set("Authorization", "Bearer admin-token");

      // Should still return 200 and include the tracking, even with parse error
      expect(response.status).toBe(200);
      expect(response.body.log).toContain("Invalid JSON Tracking");
    });

    it("should return admin log with multiple schedules for a tracking", async () => {
      const userResult = await testDb.run(
        "INSERT INTO users (name, email) VALUES (?, ?)",
        ["Test User", "test@example.com"]
      );
      const userId = userResult.lastID;

      const trackingResult = await testDb.run(
        "INSERT INTO trackings (user_id, question, frequency) VALUES (?, ?, ?)",
        [userId, "Multi Schedule Tracking", JSON.stringify({ type: "daily" })]
      );
      const trackingId = trackingResult.lastID;

      // Create multiple schedules
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
        .get("/api/admin")
        .set("Authorization", "Bearer admin-token");

      expect(response.status).toBe(200);
      expect(response.body.log).toContain("Multi Schedule Tracking");
      expect(response.body.log).toContain("09:00");
      expect(response.body.log).toContain("14:30");
      expect(response.body.log).toContain("20:15");
    });

    it("should return 500 when getAllTrackings throws error", async () => {
      // Create user
      await testDb.run("INSERT INTO users (name, email) VALUES (?, ?)", [
        "Test User",
        "test@example.com",
      ]);

      // Mock database.all to throw error
      const originalAll = testDb.all.bind(testDb);
      vi.spyOn(testDb, "all").mockImplementationOnce(async () => {
        throw new Error("Database query error");
      });

      const response = await request(app)
        .get("/api/admin")
        .set("Authorization", "Bearer admin-token");

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toBe("Error generating admin log");

      // Restore original method
      vi.restoreAllMocks();
    });

    it("should return 500 when getAllReminders throws error", async () => {
      // Create user
      await testDb.run("INSERT INTO users (name, email) VALUES (?, ?)", [
        "Test User",
        "test@example.com",
      ]);

      // Mock database.all to throw error on second call (reminders query)
      let callCount = 0;
      const originalAll = testDb.all.bind(testDb);
      vi.spyOn(testDb, "all").mockImplementation(async (sql: string) => {
        if (sql.includes("FROM reminders")) {
          throw new Error("Reminders query error");
        }
        return originalAll(sql);
      });

      const response = await request(app)
        .get("/api/admin")
        .set("Authorization", "Bearer admin-token");

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toBe("Error generating admin log");

      // Restore original method
      vi.restoreAllMocks();
    });
  });

  describe("POST /api/admin/clear-db", () => {
    it("should clear all data from database", async () => {
      // Create test data
      const userResult = await testDb.run(
        "INSERT INTO users (name, email) VALUES (?, ?)",
        ["Test User", "test@example.com"]
      );
      const userId = userResult.lastID;

      const trackingResult = await testDb.run(
        "INSERT INTO trackings (user_id, question, frequency) VALUES (?, ?, ?)",
        [userId, "Test Question", JSON.stringify({ type: "daily" })]
      );
      const trackingId = trackingResult.lastID;

      await testDb.run(
        "INSERT INTO tracking_schedules (tracking_id, hour, minutes) VALUES (?, ?, ?)",
        [trackingId, 9, 0]
      );

      await testDb.run(
        "INSERT INTO reminders (tracking_id, user_id, scheduled_time, status) VALUES (?, ?, ?, ?)",
        [trackingId, userId, new Date().toISOString(), "Pending"]
      );

      // Verify data exists
      const usersBefore = await testDb.all("SELECT * FROM users");
      const trackingsBefore = await testDb.all("SELECT * FROM trackings");
      const remindersBefore = await testDb.all("SELECT * FROM reminders");
      const schedulesBefore = await testDb.all(
        "SELECT * FROM tracking_schedules"
      );

      expect(usersBefore.length).toBeGreaterThan(0);
      expect(trackingsBefore.length).toBeGreaterThan(0);
      expect(remindersBefore.length).toBeGreaterThan(0);
      expect(schedulesBefore.length).toBeGreaterThan(0);

      // Clear database
      const response = await request(app)
        .post("/api/admin/clear-db")
        .set("Authorization", "Bearer admin-token");

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("message");
      expect(response.body.message).toBe("Database cleared successfully");

      // Verify all data is deleted
      const usersAfter = await testDb.all("SELECT * FROM users");
      const trackingsAfter = await testDb.all("SELECT * FROM trackings");
      const remindersAfter = await testDb.all("SELECT * FROM reminders");
      const schedulesAfter = await testDb.all(
        "SELECT * FROM tracking_schedules"
      );

      expect(usersAfter.length).toBe(0);
      expect(trackingsAfter.length).toBe(0);
      expect(remindersAfter.length).toBe(0);
      expect(schedulesAfter.length).toBe(0);
    });

    it("should return 500 when database operation fails", async () => {
      // Mock getTrackingService to return a service with a broken database
      const brokenDb = {
        run: vi.fn().mockRejectedValue(new Error("Database error")),
      } as any;
      const brokenService = {
        db: brokenDb,
      } as any;

      vi.spyOn(
        servicesModule.ServiceManager,
        "getTrackingService"
      ).mockReturnValue(brokenService);

      const response = await request(app)
        .post("/api/admin/clear-db")
        .set("Authorization", "Bearer admin-token");

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toBe("Error clearing database");
    });

    it("should handle error when deleting reminders fails", async () => {
      // Mock database.run to fail on reminders delete
      const originalRun = testDb.run.bind(testDb);
      let callCount = 0;
      vi.spyOn(testDb, "run").mockImplementation(async (sql: string) => {
        if (sql.includes("DELETE FROM reminders")) {
          throw new Error("Failed to delete reminders");
        }
        return originalRun(sql);
      });

      const response = await request(app)
        .post("/api/admin/clear-db")
        .set("Authorization", "Bearer admin-token");

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toBe("Error clearing database");

      vi.restoreAllMocks();
    });

    it("should handle error when deleting schedules fails", async () => {
      // Mock database.run to fail on schedules delete
      const originalRun = testDb.run.bind(testDb);
      vi.spyOn(testDb, "run").mockImplementation(async (sql: string) => {
        if (sql.includes("DELETE FROM tracking_schedules")) {
          throw new Error("Failed to delete schedules");
        }
        return originalRun(sql);
      });

      const response = await request(app)
        .post("/api/admin/clear-db")
        .set("Authorization", "Bearer admin-token");

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toBe("Error clearing database");

      vi.restoreAllMocks();
    });

    it("should handle error when deleting trackings fails", async () => {
      // Mock database.run to fail on trackings delete
      const originalRun = testDb.run.bind(testDb);
      vi.spyOn(testDb, "run").mockImplementation(async (sql: string) => {
        if (sql.includes("DELETE FROM trackings")) {
          throw new Error("Failed to delete trackings");
        }
        return originalRun(sql);
      });

      const response = await request(app)
        .post("/api/admin/clear-db")
        .set("Authorization", "Bearer admin-token");

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toBe("Error clearing database");

      vi.restoreAllMocks();
    });

    it("should handle error when deleting users fails", async () => {
      // Mock database.run to fail on users delete
      const originalRun = testDb.run.bind(testDb);
      vi.spyOn(testDb, "run").mockImplementation(async (sql: string) => {
        if (sql.includes("DELETE FROM users")) {
          throw new Error("Failed to delete users");
        }
        return originalRun(sql);
      });

      const response = await request(app)
        .post("/api/admin/clear-db")
        .set("Authorization", "Bearer admin-token");

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toBe("Error clearing database");

      vi.restoreAllMocks();
    });

    it("should clear empty database successfully", async () => {
      // Don't create any test data, just clear the admin user
      await testDb.run("DELETE FROM users WHERE id = ?", [adminUserId]);

      const response = await request(app)
        .post("/api/admin/clear-db")
        .set("Authorization", "Bearer admin-token");

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("message");
      expect(response.body.message).toBe("Database cleared successfully");
    });
  });
});
