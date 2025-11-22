import request from "supertest";
import express from "express";
import sqlite3 from "sqlite3";
import { Database } from "../../db/database.js";
import { UserService } from "../../services/userService.js";
import * as servicesModule from "../../services/index.js";
import usersRouter from "../users.js";

// Mock services module before importing router
jest.mock("../../services/index.js", () => ({
  getTrackingService: jest.fn(),
  getAuthService: jest.fn(),
  getUserService: jest.fn(),
  getEmailService: jest.fn(),
  initializeServices: jest.fn(),
}));

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
            CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
            CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
            CREATE INDEX IF NOT EXISTS idx_users_magic_link_token ON users(magic_link_token);
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

describe("Users Routes", () => {
  let app: express.Application;
  let testDb: Database;
  let userService: UserService;

  beforeEach(async () => {
    // Create a fresh in-memory database for each test
    testDb = await createTestDatabase();
    userService = new UserService(testDb);

    // Reset all mocks first to ensure clean state
    jest.restoreAllMocks();

    // Mock getUserService to return our test service
    jest.spyOn(servicesModule, "getUserService").mockReturnValue(userService);

    // Create Express app with routes
    app = express();
    app.use(express.json());
    app.use("/api/users", usersRouter);
  });

  afterEach(async () => {
    await testDb.close();
  });

  describe("GET /api/users", () => {
    it("should return empty array when no users exist", async () => {
      const response = await request(app).get("/api/users");

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it("should return all users", async () => {
      // Insert test data
      await testDb.run(
        "INSERT INTO users (name, email) VALUES (?, ?)",
        ["User 1", "user1@example.com"]
      );
      await testDb.run(
        "INSERT INTO users (name, email) VALUES (?, ?)",
        ["User 2", "user2@example.com"]
      );

      const response = await request(app).get("/api/users");

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(response.body[0].name).toBe("User 1");
      expect(response.body[1].name).toBe("User 2");
    });
  });

  describe("GET /api/users/:id", () => {
    it("should return 404 for non-existent user", async () => {
      const response = await request(app).get("/api/users/999");

      expect(response.status).toBe(404);
      expect(response.body.error).toContain("not found");
    });

    it("should return user for existing id", async () => {
      const result = await testDb.run(
        "INSERT INTO users (name, email) VALUES (?, ?)",
        ["Test User", "test@example.com"]
      );
      const insertedId = result.lastID;

      const response = await request(app).get(`/api/users/${insertedId}`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(insertedId);
      expect(response.body.name).toBe("Test User");
      expect(response.body.email).toBe("test@example.com");
    });
  });
});
