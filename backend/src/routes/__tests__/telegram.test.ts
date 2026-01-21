import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import express from "express";
import BetterSqlite3 from "better-sqlite3";
import { Database } from "../../db/database.js";
import { ServiceManager } from "../../services/index.js";
import * as authMiddlewareModule from "../../middleware/authMiddleware.js";
import telegramRouter from "../telegram.js";

/**
 * Create an in-memory database for testing.
 * @returns Promise resolving to Database instance
 */
async function createTestDatabase(): Promise<Database> {
  const db = new BetterSqlite3(":memory:");

  db.pragma("foreign_keys = ON");
  db.pragma("journal_mode = WAL");

  db.exec(`
CREATE TABLE IF NOT EXISTS users (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              name TEXT NOT NULL CHECK(length(name) <= 30),
              email TEXT NOT NULL UNIQUE,
              profile_picture_url TEXT,
              magic_link_token TEXT,
              magic_link_expires DATETIME,
              telegram_chat_id TEXT,
              notification_channels TEXT,
              locale TEXT DEFAULT 'en-US',
              timezone TEXT,
              last_access DATETIME,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              pending_email TEXT,
              email_verification_token TEXT,
              email_verification_expires DATETIME
            );
            CREATE TABLE IF NOT EXISTS telegram_connection_tokens (
              token TEXT PRIMARY KEY,
              user_id INTEGER NOT NULL,
              expires_at DATETIME NOT NULL,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_telegram_connection_tokens_user_id ON telegram_connection_tokens(user_id);
            CREATE INDEX IF NOT EXISTS idx_telegram_connection_tokens_expires_at ON telegram_connection_tokens(expires_at);
  `);

  db.exec(`
            CREATE TABLE IF NOT EXISTS trackings (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id INTEGER NOT NULL,
              question TEXT NOT NULL,
              frequency TEXT NOT NULL,
              icon TEXT,
              details TEXT,
              status TEXT DEFAULT 'ACTIVE',
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            CREATE TABLE IF NOT EXISTS reminders (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              tracking_id INTEGER NOT NULL,
              scheduled_time DATETIME NOT NULL,
              status TEXT NOT NULL DEFAULT 'UPCOMING',
              notes TEXT,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (tracking_id) REFERENCES trackings(id) ON DELETE CASCADE
            );
  `);

  const database = new Database();
  (database as any).db = db;
  return database;
}

describe("Telegram Webhook Routes", () => {
  let app: express.Application;
  let testDb: Database;

  beforeEach(async () => {
    testDb = await createTestDatabase();
    ServiceManager.initializeServices(testDb);

    // Mock authenticateToken middleware
    vi.spyOn(authMiddlewareModule, "authenticateToken").mockImplementation(
      async (req: any, res: any, next: any) => {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          return res
            .status(401)
            .json({ error: "Authorization token required" });
        }
        const token = authHeader.substring(7);
        try {
          // Simple token validation - extract userId from token
          const jwt = require("jsonwebtoken");
          const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET || "your-secret-key-change-in-production"
          ) as { userId: number };
          req.userId = decoded.userId;
          next();
        } catch (error) {
          return res.status(401).json({ error: "Invalid or expired token" });
        }
      }
    );

    // Mock fetch for getBotUsername
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        result: { username: "test_bot" },
      }),
    });

    app = express();
    app.use(express.json());
    app.use("/api/telegram", telegramRouter);
  });

  afterEach(async () => {
    await testDb.close();
    vi.restoreAllMocks();
  });

  describe("POST /api/telegram/webhook", () => {
    it("should handle /start command with valid token and update user telegram_chat_id", async () => {
      // Create a test user
      await testDb.run("INSERT INTO users (name, email) VALUES (?, ?)", [
        "Test User",
        "test@example.com",
      ]);

      // Get TelegramConnectionService to generate a token
      const telegramConnectionService =
        ServiceManager.getTelegramConnectionService();
      const token = await telegramConnectionService.generateConnectionToken(1);

      // Mock TelegramService.sendWelcomeMessage to avoid actual API calls
      const telegramService = ServiceManager.getTelegramService();
      const sendWelcomeMessageSpy = vi
        .spyOn(telegramService as any, "sendWelcomeMessage")
        .mockResolvedValue(undefined);

      // Create Telegram webhook update payload
      const update = {
        update_id: 123456789,
        message: {
          message_id: 1,
          from: {
            id: 987654321,
            is_bot: false,
            first_name: "Test",
            username: "testuser",
          },
          chat: {
            id: 987654321,
            type: "private",
            first_name: "Test",
            username: "testuser",
          },
          date: Math.floor(Date.now() / 1000),
          text: `/start ${token} 1`,
        },
      };

      const response = await request(app)
        .post("/api/telegram/webhook")
        .send(update)
        .expect(200);

      expect(response.body).toEqual({ ok: true });

      // Wait for async processing to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify user's telegram_chat_id was updated
      const user = await testDb.get<{ telegram_chat_id: string }>(
        "SELECT telegram_chat_id FROM users WHERE id = ?",
        [1]
      );

      expect(user?.telegram_chat_id).toBe("987654321");

      // Verify welcome message was sent
      expect(sendWelcomeMessageSpy).toHaveBeenCalledWith(
        "987654321",
        1,
        expect.any(String) // frontendUrl
      );

      // Verify token was deleted (single-use)
      const tokenRow = await testDb.get(
        "SELECT * FROM telegram_connection_tokens WHERE token = ?",
        [token]
      );
      expect(tokenRow).toBeUndefined();

      // Verify notification_channels was updated to "Telegram"
      const userChannels = await testDb.get<{ notification_channels: string }>(
        "SELECT notification_channels FROM users WHERE id = ?",
        [1]
      );
      expect(userChannels?.notification_channels).toBe("Telegram");
    });

    it("should return 200 but not update user if user ID in command does not match token's user", async () => {
      // Create two test users
      await testDb.run("INSERT INTO users (name, email) VALUES (?, ?)", [
        "Test User 1",
        "test1@example.com",
      ]);
      await testDb.run("INSERT INTO users (name, email) VALUES (?, ?)", [
        "Test User 2",
        "test2@example.com",
      ]);

      // Generate token for user 1
      const telegramConnectionService =
        ServiceManager.getTelegramConnectionService();
      const token = await telegramConnectionService.generateConnectionToken(1);

      const update = {
        update_id: 123456789,
        message: {
          message_id: 1,
          from: {
            id: 987654321,
            is_bot: false,
            first_name: "Test",
          },
          chat: {
            id: 987654321,
            type: "private",
          },
          date: Math.floor(Date.now() / 1000),
          text: `/start ${token} 2`, // Token belongs to user 1, but command specifies user 2
        },
      };

      const response = await request(app)
        .post("/api/telegram/webhook")
        .send(update)
        .expect(200);

      expect(response.body).toEqual({ ok: true });

      // Wait for async processing to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify neither user's telegram_chat_id was updated
      const user1 = await testDb.get<{ telegram_chat_id: string | null }>(
        "SELECT telegram_chat_id FROM users WHERE id = ?",
        [1]
      );
      const user2 = await testDb.get<{ telegram_chat_id: string | null }>(
        "SELECT telegram_chat_id FROM users WHERE id = ?",
        [2]
      );

      expect(user1?.telegram_chat_id).toBeNull();
      expect(user2?.telegram_chat_id).toBeNull();
    });

    it("should return 200 but not update user if token is invalid", async () => {
      const update = {
        update_id: 123456789,
        message: {
          message_id: 1,
          from: {
            id: 987654321,
            is_bot: false,
            first_name: "Test",
          },
          chat: {
            id: 987654321,
            type: "private",
          },
          date: Math.floor(Date.now() / 1000),
          text: "/start invalid-token 1",
        },
      };

      const response = await request(app)
        .post("/api/telegram/webhook")
        .send(update)
        .expect(200);

      expect(response.body).toEqual({ ok: true });

      // Verify user's telegram_chat_id was not updated
      const user = await testDb.get<{ telegram_chat_id: string }>(
        "SELECT telegram_chat_id FROM users WHERE id = ?",
        [1]
      );

      expect(user).toBeUndefined();
    });

    it("should return 200 but not update user if token is expired", async () => {
      // Create a test user
      await testDb.run("INSERT INTO users (name, email) VALUES (?, ?)", [
        "Test User",
        "test@example.com",
      ]);

      // Create an expired token manually
      const expiredTime = new Date(Date.now() - 1000); // 1 second ago
      await testDb.run(
        "INSERT INTO telegram_connection_tokens (token, user_id, expires_at) VALUES (?, ?, ?)",
        ["expired-token", 1, expiredTime.toISOString()]
      );

      const update = {
        update_id: 123456789,
        message: {
          message_id: 1,
          from: {
            id: 987654321,
            is_bot: false,
            first_name: "Test",
          },
          chat: {
            id: 987654321,
            type: "private",
          },
          date: Math.floor(Date.now() / 1000),
          text: "/start expired-token 1",
        },
      };

      const response = await request(app)
        .post("/api/telegram/webhook")
        .send(update)
        .expect(200);

      expect(response.body).toEqual({ ok: true });

      // Wait for async processing to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify user's telegram_chat_id was not updated
      const user = await testDb.get<{ telegram_chat_id: string | null }>(
        "SELECT telegram_chat_id FROM users WHERE id = ?",
        [1]
      );

      expect(user?.telegram_chat_id).toBeNull();
    });

    it("should return 200 for non-/start messages", async () => {
      const update = {
        update_id: 123456789,
        message: {
          message_id: 1,
          from: {
            id: 987654321,
            is_bot: false,
            first_name: "Test",
          },
          chat: {
            id: 987654321,
            type: "private",
          },
          date: Math.floor(Date.now() / 1000),
          text: "Hello, bot!",
        },
      };

      const response = await request(app)
        .post("/api/telegram/webhook")
        .send(update)
        .expect(200);

      expect(response.body).toEqual({ ok: true });
    });

    it("should return 200 for updates without message", async () => {
      const update = {
        update_id: 123456789,
      };

      const response = await request(app)
        .post("/api/telegram/webhook")
        .send(update)
        .expect(200);

      expect(response.body).toEqual({ ok: true });
    });

    it("should handle /start command with token but missing user ID", async () => {
      // Create a test user
      await testDb.run("INSERT INTO users (name, email) VALUES (?, ?)", [
        "Test User",
        "test@example.com",
      ]);

      const telegramConnectionService =
        ServiceManager.getTelegramConnectionService();
      const token = await telegramConnectionService.generateConnectionToken(1);

      const update = {
        update_id: 123456789,
        message: {
          message_id: 1,
          from: {
            id: 987654321,
            is_bot: false,
            first_name: "Test",
          },
          chat: {
            id: 987654321,
            type: "private",
          },
          date: Math.floor(Date.now() / 1000),
          text: `/start ${token}`, // Missing user ID
        },
      };

      const response = await request(app)
        .post("/api/telegram/webhook")
        .send(update)
        .expect(200);

      expect(response.body).toEqual({ ok: true });

      // Wait for async processing to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify user's telegram_chat_id was not updated
      const user = await testDb.get<{ telegram_chat_id: string | null }>(
        "SELECT telegram_chat_id FROM users WHERE id = ?",
        [1]
      );

      expect(user?.telegram_chat_id).toBeNull();
    });
  });

  describe("GET /api/telegram/start-link", () => {
    let authToken: string;

    beforeEach(async () => {
      // Create a user and generate a token manually for testing
      await testDb.run("INSERT INTO users (name, email) VALUES (?, ?)", [
        "Test User",
        "test@example.com",
      ]);

      // Generate a test token
      const jwt = require("jsonwebtoken");
      authToken = jwt.sign(
        { userId: 1, email: "test@example.com" },
        process.env.JWT_SECRET || "your-secret-key-change-in-production",
        { expiresIn: "7d" }
      );
    });

    it("should generate start link with token for authenticated user", async () => {
      const response = await request(app)
        .get("/api/telegram/start-link")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty("link");
      expect(response.body).toHaveProperty("token");
      expect(response.body).toHaveProperty("userId");
      expect(response.body.link).toContain("t.me/");
      expect(response.body.link).not.toContain("?start="); // Link should not contain start parameter
      expect(response.body.userId).toBe(1);

      // Verify token was created in database
      const tokenRow = await testDb.get(
        "SELECT * FROM telegram_connection_tokens WHERE token = ?",
        [response.body.token]
      );
      expect(tokenRow).toBeDefined();
      expect(tokenRow?.user_id).toBe(1);
    });

    it("should return 401 for missing authorization header", async () => {
      const response = await request(app)
        .get("/api/telegram/start-link")
        .expect(401);

      expect(response.body.error).toContain("token");
    });

    it("should return 401 for invalid token", async () => {
      const response = await request(app)
        .get("/api/telegram/start-link")
        .set("Authorization", "Bearer invalid.token.here")
        .expect(401);

      expect(response.body.error).toContain("token");
    });
  });

  describe("GET /api/telegram/status", () => {
    let authToken: string;

    beforeEach(async () => {
      // Create a user and generate a token manually for testing
      await testDb.run("INSERT INTO users (name, email) VALUES (?, ?)", [
        "Test User",
        "test@example.com",
      ]);

      // Generate a test token
      const jwt = require("jsonwebtoken");
      authToken = jwt.sign(
        { userId: 1, email: "test@example.com" },
        process.env.JWT_SECRET || "your-secret-key-change-in-production",
        { expiresIn: "7d" }
      );
    });

    it("should return connected status when user has telegram_chat_id", async () => {
      // Set telegram_chat_id for user
      await testDb.run("UPDATE users SET telegram_chat_id = ? WHERE id = ?", [
        "123456789",
        1,
      ]);

      const response = await request(app)
        .get("/api/telegram/status")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toEqual({
        connected: true,
        telegramChatId: "123456789",
        telegramUsername: "test_bot",
        hasActiveToken: false,
      });
    });

    it("should return not connected status when user has no telegram_chat_id", async () => {
      const response = await request(app)
        .get("/api/telegram/status")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toEqual({
        connected: false,
        telegramChatId: null,
        telegramUsername: null,
        hasActiveToken: false,
      });
    });

    it("should return 401 for missing authorization header", async () => {
      const response = await request(app)
        .get("/api/telegram/status")
        .expect(401);

      expect(response.body.error).toContain("token");
    });

    it("should return 401 for invalid token", async () => {
      const response = await request(app)
        .get("/api/telegram/status")
        .set("Authorization", "Bearer invalid.token.here")
        .expect(401);

      expect(response.body.error).toContain("token");
    });
  });
});



