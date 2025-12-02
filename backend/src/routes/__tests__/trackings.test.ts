import { vi, type Mock } from "vitest";
import request from "supertest";
import express from "express";
import sqlite3 from "sqlite3";
import { Database } from "../../db/database.js";
import { TrackingService } from "../../services/trackingService.js";
import { TrackingType, TrackingState } from "../../models/Tracking.js";
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
              type TEXT NOT NULL CHECK(type IN ('true_false', 'register')),
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
        "INSERT INTO trackings (user_id, question, type) VALUES (?, ?, ?)",
        [testUserId, "Question 1", "true_false"]
      );
      await testDb.run(
        "INSERT INTO trackings (user_id, question, type) VALUES (?, ?, ?)",
        [testUserId, "Question 2", "register"]
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
        "INSERT INTO trackings (user_id, question, type) VALUES (?, ?, ?)",
        [testUserId, "Test Question", "true_false"]
      );
      const trackingId = result.lastID;

      const response = await request(app)
        .get(`/api/trackings/${trackingId}`)
        .set("Authorization", "Bearer test-token");

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(trackingId);
      expect(response.body.question).toBe("Test Question");
      expect(response.body.type).toBe("true_false");
    });
  });

  describe("POST /api/trackings", () => {
    it("should create a new tracking", async () => {
      const response = await request(app)
        .post("/api/trackings")
        .set("Authorization", "Bearer test-token")
        .send({
          question: "Did I exercise today?",
          type: "true_false",
          schedules: [{ hour: 9, minutes: 0 }],
        });

      expect(response.status).toBe(201);
      expect(response.body.question).toBe("Did I exercise today?");
      expect(response.body.type).toBe("true_false");
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
          type: "true_false",
          notes: "Meditation notes",
          schedules: [{ hour: 10, minutes: 30 }],
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
          type: "true_false",
          schedules: [{ hour: 9, minutes: 0 }],
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("required");
    });

    it("should return 400 when type is missing", async () => {
      const response = await request(app)
        .post("/api/trackings")
        .set("Authorization", "Bearer test-token")
        .send({
          question: "Test question",
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
          type: "true_false",
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
          type: "true_false",
          schedules: [{ hour: 9, minutes: 0 }],
        });

      expect(response.status).toBe(400);
    });

    it("should return 400 for invalid type", async () => {
      const response = await request(app)
        .post("/api/trackings")
        .set("Authorization", "Bearer test-token")
        .send({
          question: "Test question",
          type: "invalid_type",
          schedules: [{ hour: 9, minutes: 0 }],
        });

      expect(response.status).toBe(400);
    });
  });

  describe("PUT /api/trackings/:id", () => {
    it("should update tracking", async () => {
      const result = await testDb.run(
        "INSERT INTO trackings (user_id, question, type) VALUES (?, ?, ?)",
        [testUserId, "Old Question", "true_false"]
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
        "INSERT INTO trackings (user_id, question, type) VALUES (?, ?, ?)",
        [testUserId, "Test Question", "true_false"]
      );
      const trackingId = result.lastID;

      const response = await request(app)
        .put(`/api/trackings/${trackingId}`)
        .set("Authorization", "Bearer test-token")
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("No fields to update");
    });
  });

  describe("DELETE /api/trackings/:id", () => {
    it("should delete tracking", async () => {
      const result = await testDb.run(
        "INSERT INTO trackings (user_id, question, type) VALUES (?, ?, ?)",
        [testUserId, "Test Question", "true_false"]
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
  });

  describe("PATCH /api/trackings/:id/state", () => {
    it("should update tracking state from Running to Paused", async () => {
      const result = await testDb.run(
        "INSERT INTO trackings (user_id, question, type, state) VALUES (?, ?, ?, ?)",
        [testUserId, "Test Question", "true_false", "Running"]
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
        "INSERT INTO trackings (user_id, question, type, state) VALUES (?, ?, ?, ?)",
        [testUserId, "Test Question", "true_false", "Paused"]
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
        "INSERT INTO trackings (user_id, question, type, state) VALUES (?, ?, ?, ?)",
        [testUserId, "Test Question", "true_false", "Paused"]
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
        "INSERT INTO trackings (user_id, question, type, state) VALUES (?, ?, ?, ?)",
        [testUserId, "Test Question", "true_false", "Archived"]
      );
      const trackingId = result.lastID;

      const response = await request(app)
        .patch(`/api/trackings/${trackingId}/state`)
        .set("Authorization", "Bearer test-token")
        .send({ state: "Deleted" });

      expect(response.status).toBe(200);
      expect(response.body.state).toBe("Deleted");
    });

    it("should return 400 for invalid state transition", async () => {
      const result = await testDb.run(
        "INSERT INTO trackings (user_id, question, type, state) VALUES (?, ?, ?, ?)",
        [testUserId, "Test Question", "true_false", "Running"]
      );
      const trackingId = result.lastID;

      const response = await request(app)
        .patch(`/api/trackings/${trackingId}/state`)
        .set("Authorization", "Bearer test-token")
        .send({ state: "Archived" });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("Invalid state transition");
    });

    it("should return 400 when state is missing", async () => {
      const result = await testDb.run(
        "INSERT INTO trackings (user_id, question, type, state) VALUES (?, ?, ?, ?)",
        [testUserId, "Test Question", "true_false", "Running"]
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
        "INSERT INTO trackings (user_id, question, type, state) VALUES (?, ?, ?, ?)",
        [testUserId, "Test Question", "true_false", "Running"]
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
});
