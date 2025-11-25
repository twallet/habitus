// Set NODE_ENV to test before importing modules that use rate limiting
process.env.NODE_ENV = process.env.NODE_ENV || "test";

import request from "supertest";
import express from "express";
import sqlite3 from "sqlite3";
import { Database } from "../../db/database.js";
import { AuthService } from "../../services/authService.js";
import { EmailService } from "../../services/emailService.js";
import { UserService } from "../../services/userService.js";
import * as servicesModule from "../../services/index.js";
import * as authMiddlewareModule from "../../middleware/authMiddleware.js";
import authRouter from "../auth.js";

// Mock EmailService
jest.mock("../../services/emailService.js", () => ({
  EmailService: jest.fn().mockImplementation(() => ({
    sendMagicLink: jest.fn().mockResolvedValue(undefined),
    sendEmail: jest.fn().mockResolvedValue(undefined),
  })),
}));

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
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              pending_email TEXT,
              email_verification_token TEXT,
              email_verification_expires DATETIME
            );
            CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
            CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
            CREATE INDEX IF NOT EXISTS idx_users_magic_link_token ON users(magic_link_token);
            CREATE INDEX IF NOT EXISTS idx_users_email_verification_token ON users(email_verification_token);
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

describe("Auth Routes", () => {
  let app: express.Application;
  let testDb: Database;
  let emailService: EmailService;
  let authService: AuthService;
  let userService: UserService;

  beforeEach(async () => {
    // Create a fresh in-memory database for each test
    testDb = await createTestDatabase();
    emailService = new EmailService();
    authService = new AuthService(testDb, emailService);
    userService = new UserService(testDb);

    // Mock getAuthService to return our test service
    // The route calls getAuthService() at module load time, so we need to ensure
    // the mock returns our test service. Since jest.mock() is called before import,
    // we just need to update the mock implementation here.
    (servicesModule.getAuthService as jest.Mock).mockReturnValue(authService);
    (servicesModule.getUserService as jest.Mock).mockReturnValue(userService);

    // Mock authenticateToken middleware - must be set up before routes
    jest
      .spyOn(authMiddlewareModule, "authenticateToken")
      .mockImplementation(async (req: any, res: any, next: any) => {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          return res.status(401).json({ error: "Token required" });
        }
        const token = authHeader.substring(7);
        try {
          const userId = await authService.verifyToken(token);
          req.userId = userId;
          next();
        } catch (error) {
          return res.status(401).json({ error: "Invalid or expired token" });
        }
      });

    // Create Express app with routes
    app = express();
    app.use(express.json());
    app.use("/api/auth", authRouter);
  });

  afterEach(async () => {
    await testDb.close();
  });

  describe("POST /api/auth/register", () => {
    it("should request registration magic link", async () => {
      const response = await request(app).post("/api/auth/register").send({
        name: "John Doe",
        email: "john@example.com",
      });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain("magic link");
      expect(emailService.sendMagicLink).toHaveBeenCalled();
    });

    it("should return 400 for missing name", async () => {
      const response = await request(app).post("/api/auth/register").send({
        email: "john@example.com",
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("Name");
    });

    it("should return 400 for missing email", async () => {
      const response = await request(app).post("/api/auth/register").send({
        name: "John Doe",
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("Email");
    });

    it("should return 400 for invalid email format", async () => {
      const response = await request(app).post("/api/auth/register").send({
        name: "John Doe",
        email: "invalid-email",
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("email");
    });

    it("should return 409 for duplicate email", async () => {
      await request(app).post("/api/auth/register").send({
        name: "John Doe",
        email: "john@example.com",
      });

      // Clear magic link to avoid cooldown check
      await testDb.run(
        "UPDATE users SET magic_link_expires = NULL WHERE email = ?",
        ["john@example.com"]
      );

      const response = await request(app).post("/api/auth/register").send({
        name: "Jane Doe",
        email: "john@example.com",
      });

      expect(response.status).toBe(409);
      expect(response.body.error).toContain("already registered");
    });

    it("should enforce cooldown period for registration magic link requests", async () => {
      const testEmail = "cooldown@example.com";

      // First registration request
      const firstResponse = await request(app).post("/api/auth/register").send({
        name: "Test User",
        email: testEmail,
      });

      expect(firstResponse.status).toBe(200);

      // Simulate cooldown by setting recent magic_link_expires
      // Set magic_link_expires to a future time (simulating a recent request)
      const futureDate = new Date();
      futureDate.setMinutes(futureDate.getMinutes() + 15); // 15 minutes from now

      await testDb.run(
        "UPDATE users SET magic_link_expires = ? WHERE email = ?",
        [futureDate.toISOString(), testEmail]
      );

      // Second registration request should be blocked by cooldown (even though user exists)
      const secondResponse = await request(app)
        .post("/api/auth/register")
        .send({
          name: "Another User",
          email: testEmail,
        });

      expect(secondResponse.status).toBe(400);
      expect(secondResponse.body.error).toContain("wait");
      expect(secondResponse.body.error).toContain("minutes");
    });
  });

  describe("POST /api/auth/login", () => {
    const testEmail = "john@example.com";

    beforeEach(async () => {
      // Register a test user via magic link
      await request(app).post("/api/auth/register").send({
        name: "John Doe",
        email: testEmail,
      });
    });

    it("should request login magic link", async () => {
      const response = await request(app).post("/api/auth/login").send({
        email: testEmail,
      });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain("magic link");
    });

    it("should return 400 for missing email", async () => {
      const response = await request(app).post("/api/auth/login").send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("Email");
    });

    it("should enforce cooldown period but still return success for login (to prevent email enumeration)", async () => {
      // Request login magic link (first call)
      const firstResponse = await request(app).post("/api/auth/login").send({
        email: testEmail,
      });

      expect(firstResponse.status).toBe(200);

      // Get the call count after first request
      const callsAfterFirst = (emailService.sendMagicLink as jest.Mock).mock
        .calls.length;
      expect(callsAfterFirst).toBeGreaterThanOrEqual(1);

      // Simulate cooldown by setting recent magic_link_expires
      const futureDate = new Date();
      futureDate.setMinutes(futureDate.getMinutes() + 15); // 15 minutes from now

      await testDb.run(
        "UPDATE users SET magic_link_expires = ? WHERE email = ?",
        [futureDate.toISOString(), testEmail]
      );

      // Clear mock to track only second call
      (emailService.sendMagicLink as jest.Mock).mockClear();

      // Second login request should still return success (to prevent email enumeration)
      // but the cooldown is enforced internally
      const secondResponse = await request(app).post("/api/auth/login").send({
        email: testEmail,
      });

      expect(secondResponse.status).toBe(200);
      expect(secondResponse.body.message).toContain("magic link");
      // Verify that email service was not called again (cooldown prevented it)
      const callsAfterSecond = (emailService.sendMagicLink as jest.Mock).mock
        .calls.length;
      expect(callsAfterSecond).toBe(0); // No additional calls due to cooldown
    });
  });

  describe("GET /api/auth/me", () => {
    let authToken: string;

    beforeEach(async () => {
      // Create a user and generate a token manually for testing
      const result = await testDb.run(
        "INSERT INTO users (name, email) VALUES (?, ?)",
        ["John Doe", "john@example.com"]
      );

      // Generate a test token (simplified for testing)
      const jwt = require("jsonwebtoken");
      authToken = jwt.sign(
        { userId: result.lastID, email: "john@example.com" },
        process.env.JWT_SECRET || "your-secret-key-change-in-production",
        { expiresIn: "7d" }
      );
    });

    it("should return user data with valid token", async () => {
      const response = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.email).toBe("john@example.com");
      expect(response.body.name).toBe("John Doe");
      expect(response.body).not.toHaveProperty("password");
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

  describe("POST /api/auth/change-email", () => {
    let authToken: string;
    let userId: number;

    beforeEach(async () => {
      // Create a user and generate a token manually for testing
      const result = await testDb.run(
        "INSERT INTO users (name, email) VALUES (?, ?)",
        ["John Doe", "john@example.com"]
      );
      userId = result.lastID;

      // Generate a test token
      const jwt = require("jsonwebtoken");
      authToken = jwt.sign(
        { userId: result.lastID, email: "john@example.com" },
        process.env.JWT_SECRET || "your-secret-key-change-in-production",
        { expiresIn: "7d" }
      );
    });

    it("should request email change successfully", async () => {
      const response = await request(app)
        .post("/api/auth/change-email")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ email: "newemail@example.com" });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain("verification link sent");

      // Check that email was sent
      expect(emailService.sendEmail).toHaveBeenCalled();
    });

    it("should return 400 for missing email", async () => {
      const response = await request(app)
        .post("/api/auth/change-email")
        .set("Authorization", `Bearer ${authToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("Email is required");
    });

    it("should return 400 for invalid email format", async () => {
      const response = await request(app)
        .post("/api/auth/change-email")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ email: "invalid-email" });

      expect(response.status).toBe(400);
    });

    it("should return 400 if new email is same as current email", async () => {
      const response = await request(app)
        .post("/api/auth/change-email")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ email: "john@example.com" });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("different");
    });

    it("should return 400 if email is already registered", async () => {
      // Create another user
      await testDb.run("INSERT INTO users (name, email) VALUES (?, ?)", [
        "Jane Doe",
        "jane@example.com",
      ]);

      const response = await request(app)
        .post("/api/auth/change-email")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ email: "jane@example.com" });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("already registered");
    });

    it("should return 401 for missing authorization", async () => {
      const response = await request(app)
        .post("/api/auth/change-email")
        .send({ email: "newemail@example.com" });

      expect(response.status).toBe(401);
    });
  });

  describe("GET /api/auth/verify-email-change", () => {
    let verificationToken: string;
    let userId: number;

    beforeEach(async () => {
      // Create a user with pending email change
      const result = await testDb.run(
        "INSERT INTO users (name, email) VALUES (?, ?)",
        ["John Doe", "john@example.com"]
      );
      userId = result.lastID;

      verificationToken = "test-verification-token-123";
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 15);
      await testDb.run(
        "UPDATE users SET pending_email = ?, email_verification_token = ?, email_verification_expires = ? WHERE id = ?",
        [
          "newemail@example.com",
          verificationToken,
          expiresAt.toISOString(),
          userId,
        ]
      );
    });

    it("should verify email change and redirect with success", async () => {
      const response = await request(app).get(
        `/api/auth/verify-email-change?token=${verificationToken}`
      );

      expect(response.status).toBe(302);
      expect(response.headers.location).toContain("emailChangeVerified=true");

      // Check that email was updated
      const user = await testDb.get<{ email: string }>(
        "SELECT email FROM users WHERE id = ?",
        [userId]
      );
      expect(user?.email).toBe("newemail@example.com");
    });

    it("should handle URL-encoded error messages correctly", async () => {
      const response = await request(app).get("/api/auth/verify-email-change");

      expect(response.status).toBe(302);
      const location = decodeURIComponent(response.headers.location);
      expect(location).toContain("Token is required");
    });

    it("should redirect with error for missing token", async () => {
      const response = await request(app).get("/api/auth/verify-email-change");

      expect(response.status).toBe(302);
      expect(response.headers.location).toContain("emailChangeVerified=false");
      const location = decodeURIComponent(response.headers.location);
      expect(location).toContain("Token is required");
    });

    it("should redirect with error for invalid token", async () => {
      const response = await request(app).get(
        "/api/auth/verify-email-change?token=invalid-token"
      );

      expect(response.status).toBe(302);
      expect(response.headers.location).toContain("emailChangeVerified=false");
      const location = decodeURIComponent(response.headers.location);
      expect(location).toContain("Invalid verification token");
    });

    it("should redirect with error for expired token", async () => {
      // Set token to expired
      const pastDate = new Date();
      pastDate.setMinutes(pastDate.getMinutes() - 1);
      await testDb.run(
        "UPDATE users SET email_verification_expires = ? WHERE id = ?",
        [pastDate.toISOString(), userId]
      );

      const response = await request(app).get(
        `/api/auth/verify-email-change?token=${verificationToken}`
      );

      expect(response.status).toBe(302);
      expect(response.headers.location).toContain("emailChangeVerified=false");
      const location = decodeURIComponent(response.headers.location);
      expect(location).toContain("expired");
    });

    it("should redirect with error if email is already taken", async () => {
      // Create another user with the pending email
      await testDb.run("INSERT INTO users (name, email) VALUES (?, ?)", [
        "Jane Doe",
        "newemail@example.com",
      ]);

      const response = await request(app).get(
        `/api/auth/verify-email-change?token=${verificationToken}`
      );

      expect(response.status).toBe(302);
      expect(response.headers.location).toContain("emailChangeVerified=false");
      const location = decodeURIComponent(response.headers.location);
      expect(location).toMatch(/already.*registered/i);
    });
  });
});
