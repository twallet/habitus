import { vi, type Mock } from "vitest";
import request from "supertest";
import express from "express";
import sqlite3 from "sqlite3";
import fs from "fs";
import path from "path";
import { Database } from "../../db/database.js";
import { UserService } from "../../services/userService.js";
import * as servicesModule from "../../services/index.js";
import usersRouter from "../users.js";
import * as authMiddleware from "../../middleware/authMiddleware.js";
import * as uploadModule from "../../middleware/upload.js";

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

// Mock authMiddleware
vi.mock("../../middleware/authMiddleware.js", () => ({
  authenticateToken: vi.fn((req: any, _res: any, next: any) => {
    next();
  }),
  AuthRequest: {},
}));

// Mock upload middleware
vi.mock("../../middleware/upload.js", () => ({
  uploadProfilePicture: vi.fn((req: any, _res: any, next: any) => {
    next();
  }),
  getUploadsDirectory: vi.fn(() => "/test/uploads"),
  isCloudinaryStorage: vi.fn(() => false),
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

describe("Users Routes", () => {
  let app: express.Application;
  let testDb: Database;
  let userService: UserService;

  beforeEach(async () => {
    // Create a fresh in-memory database for each test
    testDb = await createTestDatabase();
    userService = new UserService(testDb);

    // Reset all mocks first to ensure clean state
    vi.restoreAllMocks();

    // Mock getUserService to return our test service
    vi.spyOn(servicesModule.ServiceManager, "getUserService").mockReturnValue(
      userService
    );

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
      await testDb.run("INSERT INTO users (name, email) VALUES (?, ?)", [
        "User 1",
        "user1@example.com",
      ]);
      await testDb.run("INSERT INTO users (name, email) VALUES (?, ?)", [
        "User 2",
        "user2@example.com",
      ]);

      const response = await request(app).get("/api/users");

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(response.body[0].name).toBe("User 1");
      expect(response.body[1].name).toBe("User 2");
    });
  });

  describe("GET /api/users", () => {
    it("should handle errors when fetching users fails", async () => {
      // Mock service to throw error
      const errorService = {
        getAllUsers: vi.fn().mockRejectedValue(new Error("Database error")),
      };
      vi.spyOn(servicesModule.ServiceManager, "getUserService").mockReturnValue(
        errorService as any
      );

      const response = await request(app).get("/api/users");

      expect(response.status).toBe(500);
      expect(response.body.error).toBe("Error fetching users");
    });
  });

  describe("GET /api/users/:id", () => {
    it("should return 400 for invalid user ID", async () => {
      const response = await request(app).get("/api/users/invalid");

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Invalid user ID");
    });

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

    it("should handle errors when fetching user fails", async () => {
      const errorService = {
        getUserById: vi.fn().mockRejectedValue(new Error("Database error")),
      };
      vi.spyOn(servicesModule.ServiceManager, "getUserService").mockReturnValue(
        errorService as any
      );

      const response = await request(app).get("/api/users/1");

      expect(response.status).toBe(500);
      expect(response.body.error).toBe("Error fetching user");
    });
  });

  describe("PUT /api/users/profile", () => {
    let userId: number;

    beforeEach(async () => {
      const result = await testDb.run(
        "INSERT INTO users (name, email) VALUES (?, ?)",
        ["Test User", "test@example.com"]
      );
      userId = result.lastID;

      // Reset and update mock to set userId
      vi.clearAllMocks();
      (authMiddleware.authenticateToken as Mock).mockImplementation(
        (req: any, _res: any, next: any) => {
          req.userId = userId;
          next();
        }
      );

      // Mock upload middleware to set req.file
      (uploadModule.uploadProfilePicture as Mock).mockImplementation(
        (req: any, _res: any, next: any) => {
          req.file = undefined;
          next();
        }
      );
    });

    it("should update user profile successfully", async () => {
      const response = await request(app).put("/api/users/profile").send({
        name: "Updated Name",
      });

      expect(response.status).toBe(200);
      expect(response.body.name).toBe("Updated Name");
      // Email should remain unchanged (email changes are handled separately)
      expect(response.body.email).toBe("test@example.com");
    });

    it("should return 400 for validation errors", async () => {
      const response = await request(app).put("/api/users/profile").send({
        name: "", // Invalid empty name
      });

      expect(response.status).toBe(400);
    });

    it("should handle errors when update fails", async () => {
      const errorService = {
        updateProfile: vi.fn().mockRejectedValue(new Error("Database error")),
      };
      vi.spyOn(servicesModule.ServiceManager, "getUserService").mockReturnValue(
        errorService as any
      );

      const response = await request(app).put("/api/users/profile").send({
        name: "Updated Name",
      });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe("Error updating profile");
    });

    it("should handle TypeError errors with 400 status", async () => {
      const errorService = {
        updateProfile: vi
          .fn()
          .mockRejectedValue(new TypeError("Invalid name format")),
      };
      vi.spyOn(servicesModule.ServiceManager, "getUserService").mockReturnValue(
        errorService as any
      );

      const response = await request(app).put("/api/users/profile").send({
        name: "Invalid",
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Invalid name format");
    });

    it("should handle Email already registered error with 409 status", async () => {
      const errorService = {
        updateProfile: vi
          .fn()
          .mockRejectedValue(new Error("Email already registered")),
      };
      vi.spyOn(servicesModule.ServiceManager, "getUserService").mockReturnValue(
        errorService as any
      );

      const response = await request(app).put("/api/users/profile").send({
        name: "Updated Name",
      });

      expect(response.status).toBe(409);
      expect(response.body.error).toBe("Email already registered");
    });

    it("should handle Only image files error with 400 status", async () => {
      const errorService = {
        updateProfile: vi
          .fn()
          .mockRejectedValue(new Error("Only image files are allowed")),
      };
      vi.spyOn(servicesModule.ServiceManager, "getUserService").mockReturnValue(
        errorService as any
      );

      const response = await request(app).put("/api/users/profile").send({
        name: "Updated Name",
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Only image files are allowed");
    });

    it("should handle file upload with cleanup on error", async () => {
      const unlinkSyncSpy = vi
        .spyOn(fs, "unlinkSync")
        .mockImplementation(() => {});
      const existsSyncSpy = vi.spyOn(fs, "existsSync").mockReturnValue(true);

      const mockFile = {
        filename: "test-file.jpg",
        originalname: "test.jpg",
        mimetype: "image/jpeg",
        size: 1024,
      };

      (uploadModule.uploadProfilePicture as Mock).mockImplementation(
        (req: any, _res: any, next: any) => {
          req.file = mockFile;
          next();
        }
      );

      const errorService = {
        updateProfile: vi.fn().mockRejectedValue(new Error("Database error")),
      };
      vi.spyOn(servicesModule.ServiceManager, "getUserService").mockReturnValue(
        errorService as any
      );

      const response = await request(app).put("/api/users/profile").send({
        name: "Updated Name",
      });

      expect(response.status).toBe(500);
      expect(existsSyncSpy).toHaveBeenCalled();
      expect(unlinkSyncSpy).toHaveBeenCalledWith(
        path.join("/test/uploads", "test-file.jpg")
      );

      unlinkSyncSpy.mockRestore();
      existsSyncSpy.mockRestore();
    });

    it("should handle removeProfilePicture set to true", async () => {
      const response = await request(app).put("/api/users/profile").send({
        name: "Updated Name",
        removeProfilePicture: true,
      });

      expect(response.status).toBe(200);
      expect(response.body.name).toBe("Updated Name");
    });

    it("should handle removeProfilePicture set to string true", async () => {
      const response = await request(app).put("/api/users/profile").send({
        name: "Updated Name",
        removeProfilePicture: "true",
      });

      expect(response.status).toBe(200);
      expect(response.body.name).toBe("Updated Name");
    });
  });

  describe("PUT /api/users/notifications", () => {
    let userId: number;

    beforeEach(async () => {
      const result = await testDb.run(
        "INSERT INTO users (name, email) VALUES (?, ?)",
        ["Test User", "test@example.com"]
      );
      userId = result.lastID;

      vi.clearAllMocks();
      (authMiddleware.authenticateToken as Mock).mockImplementation(
        (req: any, _res: any, next: any) => {
          req.userId = userId;
          next();
        }
      );
    });

    it("should update notification preferences successfully", async () => {
      const response = await request(app).put("/api/users/notifications").send({
        notificationChannel: "Email",
      });

      expect(response.status).toBe(200);
      expect(response.body.notification_channels).toBe("Email");
    });

    it("should update notification preferences with Telegram", async () => {
      const response = await request(app).put("/api/users/notifications").send({
        notificationChannel: "Telegram",
        telegramChatId: "123456789",
      });

      expect(response.status).toBe(200);
      expect(response.body.notification_channels).toBe("Telegram");
      expect(response.body.telegram_chat_id).toBe("123456789");
    });

    it("should return 400 if notificationChannel is missing", async () => {
      const response = await request(app)
        .put("/api/users/notifications")
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("notificationChannel is required");
    });

    it("should handle TypeError with 400 status", async () => {
      const errorService = {
        updateNotificationPreferences: vi
          .fn()
          .mockRejectedValue(new TypeError("Invalid notification channel")),
      };
      vi.spyOn(servicesModule.ServiceManager, "getUserService").mockReturnValue(
        errorService as any
      );

      const response = await request(app).put("/api/users/notifications").send({
        notificationChannel: "InvalidChannel",
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Invalid notification channel");
    });

    it("should handle User not found error with 404 status", async () => {
      (authMiddleware.authenticateToken as Mock).mockImplementation(
        (req: any, _res: any, next: any) => {
          req.userId = 999; // Non-existent user
          next();
        }
      );

      const response = await request(app).put("/api/users/notifications").send({
        notificationChannel: "Email",
      });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("User not found");
    });

    it("should handle errors when update fails", async () => {
      const errorService = {
        updateNotificationPreferences: vi
          .fn()
          .mockRejectedValue(new Error("Database error")),
      };
      vi.spyOn(servicesModule.ServiceManager, "getUserService").mockReturnValue(
        errorService as any
      );

      const response = await request(app).put("/api/users/notifications").send({
        notificationChannel: "Email",
      });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe(
        "Error updating notification preferences"
      );
    });
  });

  describe("DELETE /api/users/telegram", () => {
    let userId: number;

    beforeEach(async () => {
      const result = await testDb.run(
        "INSERT INTO users (name, email, telegram_chat_id, notification_channels) VALUES (?, ?, ?, ?)",
        ["Test User", "test@example.com", "123456789", "Telegram"]
      );
      userId = result.lastID;

      vi.clearAllMocks();
      (authMiddleware.authenticateToken as Mock).mockImplementation(
        (req: any, _res: any, next: any) => {
          req.userId = userId;
          next();
        }
      );
    });

    it("should disconnect Telegram successfully", async () => {
      const response = await request(app).delete("/api/users/telegram");

      expect(response.status).toBe(200);
      expect(response.body.telegram_chat_id).toBeUndefined();
      expect(response.body.notification_channels).toBe("Email");
    });

    it("should return 404 if user not found", async () => {
      (authMiddleware.authenticateToken as Mock).mockImplementation(
        (req: any, _res: any, next: any) => {
          req.userId = 999;
          next();
        }
      );

      const response = await request(app).delete("/api/users/telegram");

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("User not found");
    });

    it("should return 500 if service throws unexpected error", async () => {
      vi.spyOn(
        servicesModule.ServiceManager.getUserService(),
        "disconnectTelegram"
      ).mockRejectedValueOnce(new Error("Database error"));

      const response = await request(app).delete("/api/users/telegram");

      expect(response.status).toBe(500);
      expect(response.body.error).toBe("Error disconnecting Telegram");
    });
  });

  describe("DELETE /api/users/profile", () => {
    let userId: number;

    beforeEach(async () => {
      const result = await testDb.run(
        "INSERT INTO users (name, email) VALUES (?, ?)",
        ["Test User", "test@example.com"]
      );
      userId = result.lastID;

      // Reset and update mock to set userId
      vi.clearAllMocks();
      (authMiddleware.authenticateToken as Mock).mockImplementation(
        (req: any, _res: any, next: any) => {
          req.userId = userId;
          next();
        }
      );
    });

    it("should delete user account successfully", async () => {
      const response = await request(app).delete("/api/users/profile");

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Account deleted successfully");

      // Verify user is deleted
      const user = await userService.getUserById(userId);
      expect(user).toBeNull();
    });

    it("should return 404 if user not found", async () => {
      // Update mock to use non-existent userId
      (authMiddleware.authenticateToken as Mock).mockImplementation(
        (req: any, _res: any, next: any) => {
          req.userId = 999; // Non-existent user
          next();
        }
      );

      const response = await request(app).delete("/api/users/profile");

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("User not found");
    });

    it("should handle errors when deletion fails", async () => {
      const errorService = {
        deleteUser: vi.fn().mockRejectedValue(new Error("Database error")),
      };
      vi.spyOn(servicesModule.ServiceManager, "getUserService").mockReturnValue(
        errorService as any
      );

      const response = await request(app).delete("/api/users/profile");

      expect(response.status).toBe(500);
      expect(response.body.error).toBe("Error deleting user");
    });
  });
});
