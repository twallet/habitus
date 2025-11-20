import request from "supertest";
import express from "express";
import sqlite3 from "sqlite3";
import usersRouter from "../users.js";
import * as databaseModule from "../../db/database.js";

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
              email TEXT,
              password_hash TEXT,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
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

describe("Users Routes", () => {
  let app: express.Application;
  let testDb: sqlite3.Database;
  let mockDbPromises: typeof databaseModule.dbPromises;

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

    // Create Express app with routes
    app = express();
    app.use(express.json());
    app.use("/api/users", usersRouter);
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

  describe("GET /api/users", () => {
    it("should return empty array when no users exist", async () => {
      const response = await request(app).get("/api/users");

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it("should return all users", async () => {
      // Insert test data
      await mockDbPromises.run("INSERT INTO users (name) VALUES (?)", [
        "User 1",
      ]);
      await mockDbPromises.run("INSERT INTO users (name) VALUES (?)", [
        "User 2",
      ]);

      const response = await request(app).get("/api/users");

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(response.body[0].name).toBe("User 1");
      expect(response.body[1].name).toBe("User 2");
    });
  });

  describe("POST /api/users", () => {
    it("should create a new user", async () => {
      const response = await request(app)
        .post("/api/users")
        .send({ name: "John Doe" });

      expect(response.status).toBe(201);
      expect(response.body.name).toBe("John Doe");
      expect(response.body.id).toBeGreaterThan(0);
      expect(response.body.created_at).toBeDefined();
    });

    it("should trim whitespace from name", async () => {
      const response = await request(app)
        .post("/api/users")
        .send({ name: "  Alice  " });

      expect(response.status).toBe(201);
      expect(response.body.name).toBe("Alice");
    });

    it("should return 400 for missing name", async () => {
      const response = await request(app).post("/api/users").send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("required");
    });

    it("should return 400 for non-string name", async () => {
      const response = await request(app)
        .post("/api/users")
        .send({ name: 123 });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("string");
    });

    it("should return 400 for empty name", async () => {
      const response = await request(app).post("/api/users").send({ name: "" });

      expect(response.status).toBe(400);
    });

    it("should return 400 for name exceeding max length", async () => {
      const longName = "a".repeat(31);
      const response = await request(app)
        .post("/api/users")
        .send({ name: longName });

      expect(response.status).toBe(400);
    });
  });

  describe("GET /api/users/:id", () => {
    it("should return 404 for non-existent user", async () => {
      const response = await request(app).get("/api/users/999");

      expect(response.status).toBe(404);
      expect(response.body.error).toContain("not found");
    });

    it("should return user for existing id", async () => {
      const result = await mockDbPromises.run(
        "INSERT INTO users (name) VALUES (?)",
        ["Test User"]
      );
      const insertedId = result.lastID;

      const response = await request(app).get(`/api/users/${insertedId}`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(insertedId);
      expect(response.body.name).toBe("Test User");
    });

    it("should return 400 for invalid id", async () => {
      const response = await request(app).get("/api/users/invalid");

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("Invalid user ID");
    });
  });
});
