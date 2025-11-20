import request from "supertest";
import express from "express";
import sqlite3 from "sqlite3";
import authRouter from "../auth.js";
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
              email TEXT NOT NULL UNIQUE,
              password_hash TEXT NOT NULL,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
            CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
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

describe("Auth Routes", () => {
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
    app.use("/api/auth", authRouter);
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

  describe("POST /api/auth/register", () => {
    it("should register a new user", async () => {
      const response = await request(app).post("/api/auth/register").send({
        name: "John Doe",
        email: "john@example.com",
        password: "Password123!",
      });

      expect(response.status).toBe(201);
      expect(response.body.name).toBe("John Doe");
      expect(response.body.email).toBe("john@example.com");
      expect(response.body.id).toBeGreaterThan(0);
      expect(response.body.created_at).toBeDefined();
      expect(response.body).not.toHaveProperty("password");
      expect(response.body).not.toHaveProperty("password_hash");
    });

    it("should return 400 for missing name", async () => {
      const response = await request(app).post("/api/auth/register").send({
        email: "john@example.com",
        password: "Password123!",
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("Name");
    });

    it("should return 400 for missing email", async () => {
      const response = await request(app).post("/api/auth/register").send({
        name: "John Doe",
        password: "Password123!",
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("Email");
    });

    it("should return 400 for missing password", async () => {
      const response = await request(app).post("/api/auth/register").send({
        name: "John Doe",
        email: "john@example.com",
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("Password");
    });

    it("should return 400 for invalid email format", async () => {
      const response = await request(app).post("/api/auth/register").send({
        name: "John Doe",
        email: "invalid-email",
        password: "Password123!",
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("email");
    });

    it("should return 400 for weak password", async () => {
      const response = await request(app).post("/api/auth/register").send({
        name: "John Doe",
        email: "john@example.com",
        password: "weak",
      });

      expect(response.status).toBe(400);
    });

    it("should return 409 for duplicate email", async () => {
      await request(app).post("/api/auth/register").send({
        name: "John Doe",
        email: "john@example.com",
        password: "Password123!",
      });

      const response = await request(app).post("/api/auth/register").send({
        name: "Jane Doe",
        email: "john@example.com",
        password: "Password123!",
      });

      expect(response.status).toBe(409);
      expect(response.body.error).toContain("already registered");
    });
  });

  describe("POST /api/auth/login", () => {
    const testEmail = "john@example.com";
    const testPassword = "Password123!";

    beforeEach(async () => {
      // Register a test user
      await request(app).post("/api/auth/register").send({
        name: "John Doe",
        email: testEmail,
        password: testPassword,
      });
    });

    it("should login with correct credentials", async () => {
      const response = await request(app).post("/api/auth/login").send({
        email: testEmail,
        password: testPassword,
      });

      expect(response.status).toBe(200);
      expect(response.body.user.email).toBe(testEmail);
      expect(response.body.user.name).toBe("John Doe");
      expect(response.body.token).toBeDefined();
      expect(typeof response.body.token).toBe("string");
    });

    it("should return 400 for missing email", async () => {
      const response = await request(app).post("/api/auth/login").send({
        password: testPassword,
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("Email");
    });

    it("should return 400 for missing password", async () => {
      const response = await request(app).post("/api/auth/login").send({
        email: testEmail,
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("Password");
    });

    it("should return 401 for incorrect password", async () => {
      const response = await request(app).post("/api/auth/login").send({
        email: testEmail,
        password: "WrongPassword123!",
      });

      expect(response.status).toBe(401);
      expect(response.body.error).toContain("Invalid credentials");
    });

    it("should return 401 for non-existent email", async () => {
      const response = await request(app).post("/api/auth/login").send({
        email: "nonexistent@example.com",
        password: testPassword,
      });

      expect(response.status).toBe(401);
      expect(response.body.error).toContain("Invalid credentials");
    });
  });

  describe("GET /api/auth/me", () => {
    let authToken: string;

    beforeEach(async () => {
      // Register and login to get a token
      await request(app).post("/api/auth/register").send({
        name: "John Doe",
        email: "john@example.com",
        password: "Password123!",
      });

      const loginResponse = await request(app).post("/api/auth/login").send({
        email: "john@example.com",
        password: "Password123!",
      });

      authToken = loginResponse.body.token;
    });

    it("should return user data with valid token", async () => {
      const response = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.email).toBe("john@example.com");
      expect(response.body.name).toBe("John Doe");
      expect(response.body).not.toHaveProperty("password");
      expect(response.body).not.toHaveProperty("password_hash");
    });

    it("should return 401 for missing authorization header", async () => {
      const response = await request(app).get("/api/auth/me");

      expect(response.status).toBe(401);
      expect(response.body.error).toContain("token required");
    });

    it("should return 401 for invalid token", async () => {
      const response = await request(app)
        .get("/api/auth/me")
        .set("Authorization", "Bearer invalid.token.here");

      expect(response.status).toBe(401);
      expect(response.body.error).toContain("token");
    });

    it("should return 401 for malformed authorization header", async () => {
      const response = await request(app)
        .get("/api/auth/me")
        .set("Authorization", "InvalidFormat token");

      expect(response.status).toBe(401);
    });
  });
});
