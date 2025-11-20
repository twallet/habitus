import request from "supertest";
import express from "express";
import sqlite3 from "sqlite3";
import trackingsRouter from "../trackings.js";
import * as databaseModule from "../../db/database.js";
import * as authMiddlewareModule from "../../middleware/authMiddleware.js";

/**
 * Create an in-memory database for testing.
 * @returns Promise resolving to Database instance
 */
function createTestDatabase(): Promise<sqlite3.Database> {
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
                resolve(db);
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
  let testDb: sqlite3.Database;
  let mockDbPromises: typeof databaseModule.dbPromises;
  let testUserId: number;

  beforeEach(async () => {
    // Create a fresh in-memory database for each test
    testDb = await createTestDatabase();
    // Create mock dbPromises that use our test database
    mockDbPromises = {
      run: (sql: string, params: any[] = []) => {
        return new Promise((resolve, reject) => {
          testDb.run(sql, params, function (err) {
            if (err) {
              reject(err);
            } else {
              resolve({ lastID: this.lastID, changes: this.changes });
            }
          });
        });
      },
      get: <T = any>(
        sql: string,
        params: any[] = []
      ): Promise<T | undefined> => {
        return new Promise((resolve, reject) => {
          testDb.get(sql, params, (err, row) => {
            if (err) {
              reject(err);
            } else {
              resolve(row as T);
            }
          });
        });
      },
      all: <T = any>(sql: string, params: any[] = []): Promise<T[]> => {
        return new Promise((resolve, reject) => {
          testDb.all(sql, params, (err, rows) => {
            if (err) {
              reject(err);
            } else {
              resolve(rows as T[]);
            }
          });
        });
      },
    };
    // Mock dbPromises module
    Object.defineProperty(databaseModule, "dbPromises", {
      value: mockDbPromises,
      writable: true,
      configurable: true,
    });

    // Create a test user
    const userResult = await mockDbPromises.run(
      "INSERT INTO users (name, email) VALUES (?, ?)",
      ["Test User", "test@example.com"]
    );
    testUserId = userResult.lastID;

    // Mock authenticateToken middleware
    jest
      .spyOn(authMiddlewareModule, "authenticateToken")
      .mockImplementation(async (req: any, res: any, next: any) => {
        req.userId = testUserId;
        next();
      });

    // Create Express app with routes
    app = express();
    app.use(express.json());
    app.use("/api/trackings", trackingsRouter);
  });

  afterEach((done) => {
    testDb.close((err) => {
      if (err) {
        done(err);
      } else {
        jest.restoreAllMocks();
        done();
      }
    });
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
      await mockDbPromises.run(
        "INSERT INTO trackings (user_id, question, type) VALUES (?, ?, ?)",
        [testUserId, "Question 1", "true_false"]
      );
      await mockDbPromises.run(
        "INSERT INTO trackings (user_id, question, type) VALUES (?, ?, ?)",
        [testUserId, "Question 2", "register"]
      );

      const response = await request(app)
        .get("/api/trackings")
        .set("Authorization", "Bearer test-token");

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(response.body[0].question).toBe("Question 2");
      expect(response.body[1].question).toBe("Question 1");
    });

    it("should return 401 without authorization token", async () => {
      // Temporarily override the mock to return 401
      jest
        .spyOn(authMiddlewareModule, "authenticateToken")
        .mockImplementationOnce(async (req: any, res: any, next: any) => {
          res.status(401).json({ error: "Authorization token required" });
        });

      const response = await request(app).get("/api/trackings");

      expect(response.status).toBe(401);
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
      const result = await mockDbPromises.run(
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

    it("should return 400 for invalid id", async () => {
      const response = await request(app)
        .get("/api/trackings/invalid")
        .set("Authorization", "Bearer test-token");

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("Invalid tracking ID");
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
      expect(response.body.id).toBeGreaterThan(0);
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
      const result = await mockDbPromises.run(
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
      const result = await mockDbPromises.run(
        "INSERT INTO trackings (user_id, question, type) VALUES (?, ?, ?)",
        [testUserId, "Question", "true_false"]
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
      const result = await mockDbPromises.run(
        "INSERT INTO trackings (user_id, question, type) VALUES (?, ?, ?)",
        [testUserId, "Question", "true_false"]
      );
      const trackingId = result.lastID;

      const response = await request(app)
        .delete(`/api/trackings/${trackingId}`)
        .set("Authorization", "Bearer test-token");

      expect(response.status).toBe(200);
      expect(response.body.message).toContain("deleted successfully");

      // Verify tracking is deleted
      const getResponse = await request(app)
        .get(`/api/trackings/${trackingId}`)
        .set("Authorization", "Bearer test-token");
      expect(getResponse.status).toBe(404);
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
