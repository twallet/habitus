import { vi, type Mock } from "vitest";

// Set NODE_ENV to test before importing modules that use rate limiting
process.env.NODE_ENV = process.env.NODE_ENV || "test";

// Mock EmailService - create mock instance methods
const { mockEmailServiceInstance } = vi.hoisted(() => ({
  mockEmailServiceInstance: {
    sendMagicLink: vi.fn().mockResolvedValue(undefined),
    sendEmail: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock EmailService - path must match the import path exactly
// Mocks must be declared before imports in ES modules
// Note: Using .js extension to match the import, Vitest will resolve to .ts
vi.mock("../../services/emailService.js", () => {
  class EmailServiceMock {
    sendMagicLink = mockEmailServiceInstance.sendMagicLink;
    sendEmail = mockEmailServiceInstance.sendEmail;
  }
  return {
    EmailService: EmailServiceMock,
  };
});

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
    initializeServices: vi.fn(),
  },
}));

// Mock upload middleware
vi.mock("../../middleware/upload.js", () => ({
  uploadProfilePicture: vi.fn((req: any, _res: any, next: any) => {
    next();
  }),
  getUploadsDirectory: vi.fn(() => "/test/uploads"),
}));

import request from "supertest";
import express from "express";
import BetterSqlite3 from "better-sqlite3";
import { Database } from "../../db/database.js";
import { AuthService } from "../../services/authService.js";
import { EmailService } from "../../services/emailService.js";
import { UserService } from "../../services/userService.js";
import * as servicesModule from "../../services/index.js";
import * as authMiddlewareModule from "../../middleware/authMiddleware.js";
import * as uploadModule from "../../middleware/upload.js";
import authRouter from "../auth.js";

/**
 * Create an in-memory database for testing.
 * @returns Promise resolving to Database instance
 */
async function createTestDatabase(): Promise<Database> {
  return new Promise((resolve, reject) => {
    const db = new BetterSqlite3(":memory:");
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
              pending_email TEXT,
              email_verification_token TEXT,
              email_verification_expires DATETIME,
              telegram_chat_id TEXT,
              notification_channels TEXT,
              locale TEXT DEFAULT 'en-US',
              timezone TEXT,
              last_access DATETIME,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
    // The route calls ServiceManager.getAuthService() at module load time, so we need to ensure
    // the mock returns our test service. Since vi.mock() is called before import,
    // we just need to update the mock implementation here.
    (servicesModule.ServiceManager.getAuthService as Mock).mockReturnValue(
      authService
    );
    (servicesModule.ServiceManager.getUserService as Mock).mockReturnValue(
      userService
    );

    // Mock authenticateToken middleware - must be set up before routes
    vi.spyOn(authMiddlewareModule, "authenticateToken").mockImplementation(
      async (req: any, res: any, next: any) => {
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
      }
    );

    // Reset upload middleware mock
    (uploadModule.uploadProfilePicture as Mock).mockImplementation(
      (req: any, _res: any, next: any) => {
        next();
      }
    );

    // Create Express app with routes
    app = express();
    app.use(express.json());
    app.use("/api/auth", authRouter);
    // Add error handler middleware to catch errors from route handlers
    app.use(
      (
        err: Error,
        _req: express.Request,
        res: express.Response,
        _next: express.NextFunction
      ) => {
        // This will be caught by route handler's catch block if it's in the try-catch
        // But for middleware errors, we need this handler
        if (err.message.includes("Only image files")) {
          return res.status(400).json({ error: err.message });
        }
        res.status(500).json({ error: err.message });
      }
    );
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
      expect(response.body.message.toLowerCase()).toContain(
        "registration link"
      );
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

    it("should handle profile picture upload", async () => {
      const mockFile = {
        filename: "test-profile-123.jpg",
        originalname: "test.jpg",
        mimetype: "image/jpeg",
        size: 1024,
      };

      // Mock upload middleware to set req.file
      (uploadModule.uploadProfilePicture as Mock).mockImplementation(
        (req: any, _res: any, next: any) => {
          req.file = mockFile;
          next();
        }
      );

      const response = await request(app).post("/api/auth/register").send({
        name: "John Doe",
        email: "john@example.com",
      });

      expect(response.status).toBe(200);
      expect(response.body.message.toLowerCase()).toContain(
        "registration link"
      );
      // Verify that the service was called with profile picture URL
      expect(emailService.sendMagicLink).toHaveBeenCalled();
    });

    it("should return 400 for 'Only image files' error", async () => {
      // Mock upload middleware to throw error
      (uploadModule.uploadProfilePicture as Mock).mockImplementation(
        (_req: any, _res: any, next: any) => {
          const error = new Error("Only image files are allowed");
          next(error);
        }
      );

      const response = await request(app).post("/api/auth/register").send({
        name: "John Doe",
        email: "john@example.com",
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("Only image files");
    });

    it("should return 400 for TypeError", async () => {
      // Reset upload mock first
      (uploadModule.uploadProfilePicture as Mock).mockImplementation(
        (req: any, _res: any, next: any) => {
          next();
        }
      );

      // Mock service to throw TypeError
      const errorService = {
        requestRegisterMagicLink: vi
          .fn()
          .mockRejectedValue(new TypeError("Invalid input type")),
      };
      (servicesModule.ServiceManager.getAuthService as Mock).mockReturnValue(
        errorService
      );

      const response = await request(app).post("/api/auth/register").send({
        name: "John Doe",
        email: "john@example.com",
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Invalid input type");
    });

    it("should return 500 for generic error", async () => {
      // Reset upload mock first
      (uploadModule.uploadProfilePicture as Mock).mockImplementation(
        (req: any, _res: any, next: any) => {
          next();
        }
      );

      // Mock service to throw unexpected error
      const errorService = {
        requestRegisterMagicLink: vi
          .fn()
          .mockRejectedValue(new Error("Database connection failed")),
      };
      (servicesModule.ServiceManager.getAuthService as Mock).mockReturnValue(
        errorService
      );

      const response = await request(app).post("/api/auth/register").send({
        name: "John Doe",
        email: "john@example.com",
      });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe("Error requesting registration link");
    });

    it("should return 400 for non-string name", async () => {
      // Reset upload mock first
      (uploadModule.uploadProfilePicture as Mock).mockImplementation(
        (req: any, _res: any, next: any) => {
          next();
        }
      );

      const response = await request(app).post("/api/auth/register").send({
        name: 123,
        email: "john@example.com",
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("Name");
    });

    it("should return 400 for non-string email", async () => {
      // Reset upload mock first
      (uploadModule.uploadProfilePicture as Mock).mockImplementation(
        (req: any, _res: any, next: any) => {
          next();
        }
      );

      const response = await request(app)
        .post("/api/auth/register")
        .send({
          name: "John Doe",
          email: { invalid: "email" },
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("Email");
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
      // Clear any existing magic link token from registration
      await testDb.run(
        "UPDATE users SET magic_link_token = NULL, magic_link_expires = NULL WHERE email = ?",
        [testEmail]
      );

      const response = await request(app).post("/api/auth/login").send({
        email: testEmail,
      });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain("login link");
      expect(response.body.cooldown).toBeUndefined(); // No cooldown on first request
    });

    it("should return 400 for missing email", async () => {
      const response = await request(app).post("/api/auth/login").send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("Email");
    });

    it("should enforce cooldown period but still return success for login (to prevent email enumeration)", async () => {
      // Mock service to throw cooldown error
      const errorService = {
        requestLoginMagicLink: vi
          .fn()
          .mockRejectedValue(
            new Error("Please wait 5 minutes before requesting another link")
          ),
      };
      (servicesModule.ServiceManager.getAuthService as Mock).mockReturnValue(
        errorService
      );

      // Login request with cooldown should still return success (to prevent email enumeration)
      const response = await request(app).post("/api/auth/login").send({
        email: testEmail,
      });

      expect(response.status).toBe(200);
      expect(response.body.cooldown).toBe(true); // Cooldown should be set
      expect(response.body.message).toContain("wait");
    });

    it("should return 200 for generic error (to prevent email enumeration)", async () => {
      // Mock service to throw unexpected error
      const errorService = {
        requestLoginMagicLink: vi
          .fn()
          .mockRejectedValue(new Error("Database connection failed")),
      };
      (servicesModule.ServiceManager.getAuthService as Mock).mockReturnValue(
        errorService
      );

      const response = await request(app).post("/api/auth/login").send({
        email: testEmail,
      });

      // Should still return 200 to prevent email enumeration
      expect(response.status).toBe(200);
      expect(response.body.message).toContain("If an account exists");
    });
  });

  describe("GET /api/auth/verify-magic-link", () => {
    let magicLinkToken: string;
    let userId: number;

    beforeEach(async () => {
      // Create a user with a magic link token
      const result = await testDb.run(
        "INSERT INTO users (name, email) VALUES (?, ?)",
        ["John Doe", "john@example.com"]
      );
      userId = result.lastID;

      magicLinkToken = "test-magic-link-token-123";
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 15);
      await testDb.run(
        "UPDATE users SET magic_link_token = ?, magic_link_expires = ? WHERE id = ?",
        [magicLinkToken, expiresAt.toISOString(), userId]
      );
    });

    it("should verify magic link and return user data with JWT token", async () => {
      const response = await request(app).get(
        `/api/auth/verify-magic-link?token=${magicLinkToken}`
      );

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("user");
      expect(response.body).toHaveProperty("token");
      expect(response.body.user.email).toBe("john@example.com");
      expect(response.body.user.name).toBe("John Doe");
    });

    it("should return 400 for missing token", async () => {
      const response = await request(app).get("/api/auth/verify-magic-link");

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Token is required");
    });

    it("should return 400 for non-string token", async () => {
      const response = await request(app).get(
        "/api/auth/verify-magic-link?token[]=invalid"
      );

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Token is required");
    });

    it("should return 400 for invalid token", async () => {
      const response = await request(app).get(
        "/api/auth/verify-magic-link?token=invalid-token"
      );

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/Invalid|invalid/);
    });

    it("should return 400 for expired token", async () => {
      // Set token to expired
      const pastDate = new Date();
      pastDate.setMinutes(pastDate.getMinutes() - 1);
      await testDb.run("UPDATE users SET magic_link_expires = ? WHERE id = ?", [
        pastDate.toISOString(),
        userId,
      ]);

      const response = await request(app).get(
        `/api/auth/verify-magic-link?token=${magicLinkToken}`
      );

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/expired|Expired/);
    });

    it("should return 500 for generic error", async () => {
      // Mock service to throw unexpected error
      const errorService = {
        verifyMagicLink: vi
          .fn()
          .mockRejectedValue(new Error("Database connection failed")),
      };
      (servicesModule.ServiceManager.getAuthService as Mock).mockReturnValue(
        errorService
      );

      const response = await request(app).get(
        `/api/auth/verify-magic-link?token=${magicLinkToken}`
      );

      expect(response.status).toBe(500);
      expect(response.body.error).toBe("Error verifying link");
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

    it("should return 404 when user is not found", async () => {
      // Create a token for a non-existent user
      const jwt = require("jsonwebtoken");
      const invalidToken = jwt.sign(
        { userId: 99999, email: "nonexistent@example.com" },
        process.env.JWT_SECRET || "your-secret-key-change-in-production",
        { expiresIn: "7d" }
      );

      const response = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${invalidToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("User not found");
    });

    it("should return 500 for generic error", async () => {
      // Get userId from token
      const jwt = require("jsonwebtoken");
      const decoded = jwt.decode(authToken) as { userId: number };
      const testUserId = decoded.userId;

      // Mock service to throw unexpected error
      const errorService = {
        verifyToken: vi.fn().mockResolvedValue(testUserId),
        getUserById: vi
          .fn()
          .mockRejectedValue(new Error("Database connection failed")),
      };
      (servicesModule.ServiceManager.getAuthService as Mock).mockReturnValue(
        errorService
      );

      const response = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(500);
      expect(response.body.error).toBe("Error fetching user");
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
      expect(response.body.message).toContain(
        "verification link has been sent"
      );

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

    it("should return 400 for TypeError", async () => {
      // Mock service to throw TypeError
      const errorService = {
        requestEmailChange: vi
          .fn()
          .mockRejectedValue(new TypeError("Invalid email format")),
      };
      (servicesModule.ServiceManager.getAuthService as Mock).mockReturnValue(
        errorService
      );

      const response = await request(app)
        .post("/api/auth/change-email")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ email: "newemail@example.com" });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Invalid email format");
    });

    it("should return 400 for cooldown error", async () => {
      // Mock service to throw cooldown error
      const errorService = {
        requestEmailChange: vi
          .fn()
          .mockRejectedValue(
            new Error("Please wait 5 minutes before requesting another link")
          ),
      };
      (servicesModule.ServiceManager.getAuthService as Mock).mockReturnValue(
        errorService
      );

      const response = await request(app)
        .post("/api/auth/change-email")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ email: "newemail@example.com" });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("wait");
      expect(response.body.error).toContain("minutes");
    });

    it("should return 500 for generic error", async () => {
      // Mock service to throw unexpected error
      const errorService = {
        requestEmailChange: vi
          .fn()
          .mockRejectedValue(new Error("Database connection failed")),
      };
      (servicesModule.ServiceManager.getAuthService as Mock).mockReturnValue(
        errorService
      );

      const response = await request(app)
        .post("/api/auth/change-email")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ email: "newemail@example.com" });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe("Error requesting email change");
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

    it("should redirect with error for 'Failed to retrieve' error", async () => {
      // Mock service to throw error with "Failed to retrieve" message
      const errorService = {
        verifyEmailChange: vi
          .fn()
          .mockRejectedValue(new Error("Failed to retrieve user data")),
      };
      (servicesModule.ServiceManager.getUserService as Mock).mockReturnValue(
        errorService
      );

      const response = await request(app).get(
        `/api/auth/verify-email-change?token=${verificationToken}`
      );

      expect(response.status).toBe(302);
      expect(response.headers.location).toContain("emailChangeVerified=false");
      const location = decodeURIComponent(response.headers.location);
      expect(location).toContain("Failed to retrieve user data");
    });

    it("should redirect with error for generic 500 error", async () => {
      // Mock service to throw unexpected error
      const errorService = {
        verifyEmailChange: vi
          .fn()
          .mockRejectedValue(new Error("Database connection failed")),
      };
      (servicesModule.ServiceManager.getUserService as Mock).mockReturnValue(
        errorService
      );

      const response = await request(app).get(
        `/api/auth/verify-email-change?token=${verificationToken}`
      );

      expect(response.status).toBe(302);
      expect(response.headers.location).toContain("emailChangeVerified=false");
      const location = decodeURIComponent(response.headers.location);
      expect(location).toContain("Error verifying email change");
    });
  });
});



