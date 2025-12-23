import { vi, type Mock } from "vitest";
import request from "supertest";
import express from "express";
import sqlite3 from "sqlite3";
import { Database } from "../../db/database.js";
import { TrackingService } from "../../services/trackingService.js";
import { ReminderService } from "../../services/reminderService.js";
import { AiService } from "../../services/aiService.js";
import { TrackingState } from "../../models/Tracking.js";
import * as authMiddlewareModule from "../../middleware/authMiddleware.js";
import * as servicesModule from "../../services/index.js";

// Mock authenticateToken before importing the router
vi.mock("../../middleware/authMiddleware.js", () => ({
  authenticateToken: vi.fn(),
  AuthRequest: {},
}));

// Mock services module before importing router
vi.mock("../../services/index.js", () => ({
  ServiceManager: {
    getTrackingService: vi.fn(),
    getAuthService: vi.fn(),
    getUserService: vi.fn(),
    getEmailService: vi.fn(),
    getAiService: vi.fn(),
    getReminderService: vi.fn(),
    initializeServices: vi.fn(),
  },
}));

// Import router after mocking
import trackingsRouter from "../trackings.js";

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
              question TEXT NOT NULL CHECK(length(question) <= 100),
              notes TEXT,
              icon TEXT,
              days TEXT,
              state TEXT NOT NULL DEFAULT 'Running' CHECK(state IN ('Running', 'Paused', 'Archived', 'Deleted')),
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_trackings_user_id ON trackings(user_id);
            CREATE INDEX IF NOT EXISTS idx_trackings_created_at ON trackings(created_at);
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

describe("Trackings Routes", () => {
  let app: express.Application;
  let testDb: Database;
  let trackingService: TrackingService;
  let reminderService: ReminderService;
  let aiService: AiService;
  let testUserId: number;

  beforeEach(async () => {
    // Create a fresh in-memory database for each test
    testDb = await createTestDatabase();
    trackingService = new TrackingService(testDb);
    reminderService = new ReminderService(testDb);
    aiService = new AiService();

    // Create a test user
    const userResult = await testDb.run(
      "INSERT INTO users (name, email) VALUES (?, ?)",
      ["Test User", "test@example.com"]
    );
    testUserId = userResult.lastID;

    // Reset all mocks first to ensure clean state
    vi.restoreAllMocks();

    // Mock authenticateToken middleware - must be set up before routes
    vi.spyOn(authMiddlewareModule, "authenticateToken").mockImplementation(
      async (req: any, res: any, next: any) => {
        req.userId = testUserId;
        next();
      }
    );

    // Mock getTrackingService to return our test service
    vi.spyOn(
      servicesModule.ServiceManager,
      "getTrackingService"
    ).mockReturnValue(trackingService);

    // Mock getReminderService to return our test service
    vi.spyOn(
      servicesModule.ServiceManager,
      "getReminderService"
    ).mockReturnValue(reminderService);

    // Mock getAiService to return our test service
    vi.spyOn(servicesModule.ServiceManager, "getAiService").mockReturnValue(
      aiService
    );

    // Create Express app with routes
    app = express();
    app.use(express.json());
    app.use("/api/trackings", trackingsRouter);
  });

  afterEach(async () => {
    await testDb.close();
  });

  describe("GET /api/trackings", () => {
    it("should return empty array when no trackings exist", async () => {
      const response = await request(app)
        .get("/api/trackings")
        .set("Authorization", "Bearer test-token");

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it("should return all trackings for authenticated user", async () => {
      // Insert test trackings
      await testDb.run(
        "INSERT INTO trackings (user_id, question) VALUES (?, ?)",
        [testUserId, "Question 1"]
      );
      await testDb.run(
        "INSERT INTO trackings (user_id, question) VALUES (?, ?)",
        [testUserId, "Question 2"]
      );

      const response = await request(app)
        .get("/api/trackings")
        .set("Authorization", "Bearer test-token");

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      // Check that both questions are present
      const questions = response.body.map((t: any) => t.question);
      expect(questions).toContain("Question 1");
      expect(questions).toContain("Question 2");
    });

    it("should return 500 when service throws error", async () => {
      // Mock service to throw error
      vi.spyOn(
        servicesModule.ServiceManager,
        "getTrackingService"
      ).mockReturnValue({
        getAllByUserId: vi.fn().mockRejectedValue(new Error("Database error")),
      } as any);

      const response = await request(app)
        .get("/api/trackings")
        .set("Authorization", "Bearer test-token");

      expect(response.status).toBe(500);
      expect(response.body.error).toBe("Error fetching trackings");
    });
  });

  describe("GET /api/trackings/:id", () => {
    it("should return 404 for non-existent tracking", async () => {
      const response = await request(app)
        .get("/api/trackings/999")
        .set("Authorization", "Bearer test-token");

      expect(response.status).toBe(404);
      expect(response.body.error).toContain("not found");
    });

    it("should return tracking for existing id", async () => {
      const result = await testDb.run(
        "INSERT INTO trackings (user_id, question) VALUES (?, ?)",
        [testUserId, "Test Question"]
      );
      const trackingId = result.lastID;

      const response = await request(app)
        .get(`/api/trackings/${trackingId}`)
        .set("Authorization", "Bearer test-token");

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(trackingId);
      expect(response.body.question).toBe("Test Question");
    });

    it("should return 400 for invalid tracking ID", async () => {
      const response = await request(app)
        .get("/api/trackings/invalid")
        .set("Authorization", "Bearer test-token");

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Invalid tracking ID");
    });

    it("should return 500 when service throws error", async () => {
      // Mock service to throw error
      vi.spyOn(
        servicesModule.ServiceManager,
        "getTrackingService"
      ).mockReturnValue({
        getById: vi.fn().mockRejectedValue(new Error("Database error")),
      } as any);

      const response = await request(app)
        .get("/api/trackings/1")
        .set("Authorization", "Bearer test-token");

      expect(response.status).toBe(500);
      expect(response.body.error).toBe("Error fetching tracking");
    });
  });

  describe("POST /api/trackings", () => {
    it("should create a new tracking", async () => {
      const response = await request(app)
        .post("/api/trackings")
        .set("Authorization", "Bearer test-token")
        .send({
          question: "Did I exercise today?",
          schedules: [{ hour: 9, minutes: 0 }],
          days: {
            pattern_type: "interval",
            interval_value: 1,
            interval_unit: "days",
          },
        });

      expect(response.status).toBe(201);
      expect(response.body.question).toBe("Did I exercise today?");
      expect(response.body.user_id).toBe(testUserId);
      expect(response.body.schedules).toBeDefined();
      expect(response.body.schedules.length).toBe(1);
    });

    it("should create tracking with notes", async () => {
      const response = await request(app)
        .post("/api/trackings")
        .set("Authorization", "Bearer test-token")
        .send({
          question: "Did I meditate?",
          notes: "Meditation notes",
          schedules: [{ hour: 10, minutes: 30 }],
          days: {
            pattern_type: "interval",
            interval_value: 1,
            interval_unit: "days",
          },
        });

      expect(response.status).toBe(201);
      expect(response.body.notes).toBe("Meditation notes");
      expect(response.body.schedules).toBeDefined();
    });

    it("should return 400 when question is missing", async () => {
      const response = await request(app)
        .post("/api/trackings")
        .set("Authorization", "Bearer test-token")
        .send({
          schedules: [{ hour: 9, minutes: 0 }],
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("required");
    });

    it("should return 400 when schedules are missing", async () => {
      const response = await request(app)
        .post("/api/trackings")
        .set("Authorization", "Bearer test-token")
        .send({
          question: "Test question",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("schedule");
    });

    it("should return 400 when schedules are missing", async () => {
      const response = await request(app)
        .post("/api/trackings")
        .set("Authorization", "Bearer test-token")
        .send({
          question: "Test question",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("schedule");
    });

    it("should return 400 for invalid question", async () => {
      const response = await request(app)
        .post("/api/trackings")
        .set("Authorization", "Bearer test-token")
        .send({
          question: "",
          schedules: [{ hour: 9, minutes: 0 }],
        });

      expect(response.status).toBe(400);
    });

    it("should return 400 when service throws TypeError", async () => {
      // Mock service to throw TypeError
      vi.spyOn(
        servicesModule.ServiceManager,
        "getTrackingService"
      ).mockReturnValue({
        createTracking: vi
          .fn()
          .mockRejectedValue(new TypeError("Invalid input")),
      } as any);

      const response = await request(app)
        .post("/api/trackings")
        .set("Authorization", "Bearer test-token")
        .send({
          question: "Test question",
          schedules: [{ hour: 9, minutes: 0 }],
          days: {
            pattern_type: "interval",
            interval_value: 1,
            interval_unit: "days",
          },
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Invalid input");
    });

    it("should return 500 when service throws non-TypeError", async () => {
      // Mock service to throw generic error
      vi.spyOn(
        servicesModule.ServiceManager,
        "getTrackingService"
      ).mockReturnValue({
        createTracking: vi.fn().mockRejectedValue(new Error("Database error")),
      } as any);

      const response = await request(app)
        .post("/api/trackings")
        .set("Authorization", "Bearer test-token")
        .send({
          question: "Test question",
          schedules: [{ hour: 9, minutes: 0 }],
          days: {
            pattern_type: "interval",
            interval_value: 1,
            interval_unit: "days",
          },
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe("Error creating tracking");
    });
  });

  describe("PUT /api/trackings/:id", () => {
    it("should update tracking", async () => {
      const result = await testDb.run(
        "INSERT INTO trackings (user_id, question) VALUES (?, ?)",
        [testUserId, "Old Question"]
      );
      const trackingId = result.lastID;

      const response = await request(app)
        .put(`/api/trackings/${trackingId}`)
        .set("Authorization", "Bearer test-token")
        .send({
          question: "New Question",
        });

      expect(response.status).toBe(200);
      expect(response.body.question).toBe("New Question");
    });

    it("should return 404 for non-existent tracking", async () => {
      const response = await request(app)
        .put("/api/trackings/999")
        .set("Authorization", "Bearer test-token")
        .send({
          question: "New Question",
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toContain("not found");
    });

    it("should return 400 when no fields to update", async () => {
      const result = await testDb.run(
        "INSERT INTO trackings (user_id, question) VALUES (?, ?)",
        [testUserId, "Test Question"]
      );
      const trackingId = result.lastID;

      const response = await request(app)
        .put(`/api/trackings/${trackingId}`)
        .set("Authorization", "Bearer test-token")
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("No fields to update");
    });

    it("should return 400 for invalid tracking ID", async () => {
      const response = await request(app)
        .put("/api/trackings/invalid")
        .set("Authorization", "Bearer test-token")
        .send({
          question: "New Question",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Invalid tracking ID");
    });

    it("should return 400 when schedules is empty array", async () => {
      const result = await testDb.run(
        "INSERT INTO trackings (user_id, question) VALUES (?, ?)",
        [testUserId, "Test Question"]
      );
      const trackingId = result.lastID;

      const response = await request(app)
        .put(`/api/trackings/${trackingId}`)
        .set("Authorization", "Bearer test-token")
        .send({
          schedules: [],
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("non-empty array");
    });

    it("should return 400 when service throws TypeError", async () => {
      // Mock service to throw TypeError
      vi.spyOn(
        servicesModule.ServiceManager,
        "getTrackingService"
      ).mockReturnValue({
        updateTracking: vi
          .fn()
          .mockRejectedValue(new TypeError("Invalid input")),
      } as any);

      const result = await testDb.run(
        "INSERT INTO trackings (user_id, question) VALUES (?, ?)",
        [testUserId, "Test Question"]
      );
      const trackingId = result.lastID;

      const response = await request(app)
        .put(`/api/trackings/${trackingId}`)
        .set("Authorization", "Bearer test-token")
        .send({
          question: "New Question",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Invalid input");
    });

    it("should return 500 when service throws generic error", async () => {
      // Mock service to throw generic error
      vi.spyOn(
        servicesModule.ServiceManager,
        "getTrackingService"
      ).mockReturnValue({
        updateTracking: vi.fn().mockRejectedValue(new Error("Database error")),
      } as any);

      const result = await testDb.run(
        "INSERT INTO trackings (user_id, question) VALUES (?, ?)",
        [testUserId, "Test Question"]
      );
      const trackingId = result.lastID;

      const response = await request(app)
        .put(`/api/trackings/${trackingId}`)
        .set("Authorization", "Bearer test-token")
        .send({
          question: "New Question",
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe("Error updating tracking");
    });
  });

  describe("DELETE /api/trackings/:id", () => {
    it("should delete tracking", async () => {
      const result = await testDb.run(
        "INSERT INTO trackings (user_id, question) VALUES (?, ?)",
        [testUserId, "Test Question"]
      );
      const trackingId = result.lastID;

      const response = await request(app)
        .delete(`/api/trackings/${trackingId}`)
        .set("Authorization", "Bearer test-token");

      expect(response.status).toBe(200);
      expect(response.body.message).toContain("deleted successfully");

      // Verify tracking is deleted
      const checkResult = await testDb.get(
        "SELECT * FROM trackings WHERE id = ?",
        [trackingId]
      );
      expect(checkResult).toBeUndefined();
    });

    it("should return 404 for non-existent tracking", async () => {
      const response = await request(app)
        .delete("/api/trackings/999")
        .set("Authorization", "Bearer test-token");

      expect(response.status).toBe(404);
      expect(response.body.error).toContain("not found");
    });

    it("should return 400 for invalid tracking ID", async () => {
      const response = await request(app)
        .delete("/api/trackings/invalid")
        .set("Authorization", "Bearer test-token");

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Invalid tracking ID");
    });

    it("should return 500 when service throws non-404 error", async () => {
      // Mock service to throw generic error
      vi.spyOn(
        servicesModule.ServiceManager,
        "getTrackingService"
      ).mockReturnValue({
        deleteTracking: vi.fn().mockRejectedValue(new Error("Database error")),
      } as any);

      const response = await request(app)
        .delete("/api/trackings/1")
        .set("Authorization", "Bearer test-token");

      expect(response.status).toBe(500);
      expect(response.body.error).toBe("Error deleting tracking");
    });
  });

  describe("PATCH /api/trackings/:id/state", () => {
    it("should update tracking state from Running to Paused", async () => {
      const result = await testDb.run(
        "INSERT INTO trackings (user_id, question, state) VALUES (?, ?, ?)",
        [testUserId, "Test Question", "Running"]
      );
      const trackingId = result.lastID;

      const response = await request(app)
        .patch(`/api/trackings/${trackingId}/state`)
        .set("Authorization", "Bearer test-token")
        .send({ state: "Paused" });

      expect(response.status).toBe(200);
      expect(response.body.state).toBe("Paused");
      expect(response.body.id).toBe(trackingId);
    });

    it("should update tracking state from Paused to Running", async () => {
      const result = await testDb.run(
        "INSERT INTO trackings (user_id, question, state) VALUES (?, ?, ?)",
        [testUserId, "Test Question", "Paused"]
      );
      const trackingId = result.lastID;

      const response = await request(app)
        .patch(`/api/trackings/${trackingId}/state`)
        .set("Authorization", "Bearer test-token")
        .send({ state: "Running" });

      expect(response.status).toBe(200);
      expect(response.body.state).toBe("Running");
    });

    it("should update tracking state from Paused to Archived", async () => {
      const result = await testDb.run(
        "INSERT INTO trackings (user_id, question, state) VALUES (?, ?, ?)",
        [testUserId, "Test Question", "Paused"]
      );
      const trackingId = result.lastID;

      const response = await request(app)
        .patch(`/api/trackings/${trackingId}/state`)
        .set("Authorization", "Bearer test-token")
        .send({ state: "Archived" });

      expect(response.status).toBe(200);
      expect(response.body.state).toBe("Archived");
    });

    it("should update tracking state from Archived to Deleted", async () => {
      const result = await testDb.run(
        "INSERT INTO trackings (user_id, question, state) VALUES (?, ?, ?)",
        [testUserId, "Test Question", "Archived"]
      );
      const trackingId = result.lastID;

      const response = await request(app)
        .patch(`/api/trackings/${trackingId}/state`)
        .set("Authorization", "Bearer test-token")
        .send({ state: "Deleted" });

      expect(response.status).toBe(200);
      expect(response.body.state).toBe("Deleted");
    });

    it("should return 400 for same state transition", async () => {
      const result = await testDb.run(
        "INSERT INTO trackings (user_id, question, state) VALUES (?, ?, ?)",
        [testUserId, "Test Question", "Running"]
      );
      const trackingId = result.lastID;

      const response = await request(app)
        .patch(`/api/trackings/${trackingId}/state`)
        .set("Authorization", "Bearer test-token")
        .send({ state: "Running" });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("same state");
    });

    it("should return 400 when state is missing", async () => {
      const result = await testDb.run(
        "INSERT INTO trackings (user_id, question, state) VALUES (?, ?, ?)",
        [testUserId, "Test Question", "Running"]
      );
      const trackingId = result.lastID;

      const response = await request(app)
        .patch(`/api/trackings/${trackingId}/state`)
        .set("Authorization", "Bearer test-token")
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("State is required");
    });

    it("should return 400 for invalid state value", async () => {
      const result = await testDb.run(
        "INSERT INTO trackings (user_id, question, state) VALUES (?, ?, ?)",
        [testUserId, "Test Question", "Running"]
      );
      const trackingId = result.lastID;

      const response = await request(app)
        .patch(`/api/trackings/${trackingId}/state`)
        .set("Authorization", "Bearer test-token")
        .send({ state: "InvalidState" });

      expect(response.status).toBe(400);
    });

    it("should return 404 for non-existent tracking", async () => {
      const response = await request(app)
        .patch("/api/trackings/999/state")
        .set("Authorization", "Bearer test-token")
        .send({ state: "Paused" });

      expect(response.status).toBe(404);
      expect(response.body.error).toContain("not found");
    });

    it("should return 400 for invalid tracking ID", async () => {
      const response = await request(app)
        .patch("/api/trackings/invalid/state")
        .set("Authorization", "Bearer test-token")
        .send({ state: "Paused" });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("Invalid tracking ID");
    });
  });

  describe("POST /api/trackings/suggest-emoji", () => {
    beforeEach(() => {
      // Set up environment for AI service
      process.env.PERPLEXITY_API_KEY = "test-api-key";
    });

    afterEach(() => {
      delete process.env.PERPLEXITY_API_KEY;
    });

    it("should suggest emoji for valid question", async () => {
      // Mock fetch for AI service
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: "🏃" } }],
        }),
      }) as any;

      const response = await request(app)
        .post("/api/trackings/suggest-emoji")
        .set("Authorization", "Bearer test-token")
        .send({ question: "Did I exercise today?" });

      expect(response.status).toBe(200);
      expect(response.body.emoji).toBe("🏃");
    });

    it("should return 400 when question is missing", async () => {
      const response = await request(app)
        .post("/api/trackings/suggest-emoji")
        .set("Authorization", "Bearer test-token")
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Question is required");
    });

    it("should return 400 when question is empty string", async () => {
      const response = await request(app)
        .post("/api/trackings/suggest-emoji")
        .set("Authorization", "Bearer test-token")
        .send({ question: "" });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Question is required");
    });

    it("should return 400 when question is only whitespace", async () => {
      const response = await request(app)
        .post("/api/trackings/suggest-emoji")
        .set("Authorization", "Bearer test-token")
        .send({ question: "   " });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Question is required");
    });

    it("should return 400 when question is not a string", async () => {
      const response = await request(app)
        .post("/api/trackings/suggest-emoji")
        .set("Authorization", "Bearer test-token")
        .send({ question: 123 });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Question is required");
    });

    it("should return 503 when API key is not configured", async () => {
      delete process.env.PERPLEXITY_API_KEY;

      const response = await request(app)
        .post("/api/trackings/suggest-emoji")
        .set("Authorization", "Bearer test-token")
        .send({ question: "Did I exercise today?" });

      expect(response.status).toBe(503);
      expect(response.body.error).toContain("not available");
      expect(response.body.error).toContain("PERPLEXITY_API_KEY");
    });

    it("should return 500 when AI service throws generic error", async () => {
      // Mock AI service to throw error
      vi.spyOn(servicesModule.ServiceManager, "getAiService").mockReturnValue({
        suggestEmoji: vi.fn().mockRejectedValue(new Error("API error")),
      } as any);

      const response = await request(app)
        .post("/api/trackings/suggest-emoji")
        .set("Authorization", "Bearer test-token")
        .send({ question: "Did I exercise today?" });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe("API error");
    });

    it("should return 500 when AI service throws non-Error", async () => {
      // Mock AI service to throw non-Error
      vi.spyOn(servicesModule.ServiceManager, "getAiService").mockReturnValue({
        suggestEmoji: vi.fn().mockRejectedValue("String error"),
      } as any);

      const response = await request(app)
        .post("/api/trackings/suggest-emoji")
        .set("Authorization", "Bearer test-token")
        .send({ question: "Did I exercise today?" });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe("Error suggesting emoji");
    });

    it("should trim question before sending to AI service", async () => {
      const suggestEmojiSpy = vi.fn().mockResolvedValue("🏃");
      vi.spyOn(servicesModule.ServiceManager, "getAiService").mockReturnValue({
        suggestEmoji: suggestEmojiSpy,
      } as any);

      const response = await request(app)
        .post("/api/trackings/suggest-emoji")
        .set("Authorization", "Bearer test-token")
        .send({ question: "  Did I exercise today?  " });

      expect(response.status).toBe(200);
      expect(suggestEmojiSpy).toHaveBeenCalledWith("Did I exercise today?");
    });
  });
});
