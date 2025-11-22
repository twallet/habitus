import request from "supertest";
import express from "express";
import sqlite3 from "sqlite3";
import { Database } from "../../db/database.js";
import { TrackingService } from "../../services/trackingService.js";
import { TrackingType } from "../../models/Tracking.js";
import * as authMiddlewareModule from "../../middleware/authMiddleware.js";
import * as servicesModule from "../../services/index.js";

// Mock authenticateToken before importing the router
jest.mock("../../middleware/authMiddleware.js", () => ({
  authenticateToken: jest.fn(),
  AuthRequest: {},
}));

// Mock services module before importing router
jest.mock("../../services/index.js", () => ({
  getTrackingService: jest.fn(),
  getAuthService: jest.fn(),
  getUserService: jest.fn(),
  getEmailService: jest.fn(),
  initializeServices: jest.fn(),
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
              nickname TEXT,
              email TEXT NOT NULL UNIQUE,
              password_hash TEXT,
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
              start_tracking_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
              notes TEXT,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_trackings_user_id ON trackings(user_id);
            CREATE INDEX IF NOT EXISTS idx_trackings_start_tracking_date ON trackings(start_tracking_date);
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
    jest.restoreAllMocks();

    // Mock authenticateToken middleware - must be set up before routes
    jest
      .spyOn(authMiddlewareModule, "authenticateToken")
      .mockImplementation(async (req: any, res: any, next: any) => {
        req.userId = testUserId;
        next();
      });

    // Mock getTrackingService to return our test service
    jest.spyOn(servicesModule, "getTrackingService").mockReturnValue(trackingService);

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
        });

      expect(response.status).toBe(201);
      expect(response.body.question).toBe("Did I exercise today?");
      expect(response.body.type).toBe("true_false");
      expect(response.body.user_id).toBe(testUserId);
    });

    it("should create tracking with notes", async () => {
      const response = await request(app)
        .post("/api/trackings")
        .set("Authorization", "Bearer test-token")
        .send({
          question: "Did I meditate?",
          type: "true_false",
          notes: "Meditation notes",
        });

      expect(response.status).toBe(201);
      expect(response.body.notes).toBe("Meditation notes");
    });

    it("should return 400 when question is missing", async () => {
      const response = await request(app)
        .post("/api/trackings")
        .set("Authorization", "Bearer test-token")
        .send({
          type: "true_false",
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
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("required");
    });

    it("should return 400 for invalid question", async () => {
      const response = await request(app)
        .post("/api/trackings")
        .set("Authorization", "Bearer test-token")
        .send({
          question: "",
          type: "true_false",
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
});
