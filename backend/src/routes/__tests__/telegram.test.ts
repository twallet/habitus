import { vi, type Mock } from "vitest";
import request from "supertest";
import express, { Express } from "express";
import sqlite3 from "sqlite3";
import jwt from "jsonwebtoken";
import { Database } from "../../db/database.js";
import { ServiceManager } from "../../services/index.js";
import { TelegramConnectionService } from "../../services/telegramConnectionService.js";
import { UserService } from "../../services/userService.js";
import { TelegramService } from "../../services/telegramService.js";
import { EmailService } from "../../services/emailService.js";
import { AuthService } from "../../services/authService.js";
import telegramRouter from "../telegram.js";
import * as authMiddleware from "../../middleware/authMiddleware.js";

// Mock authMiddleware
vi.mock("../../middleware/authMiddleware.js", () => ({
  authenticateToken: vi.fn((req: any, _res: any, next: any) => {
    // Extract userId from token if present
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      try {
        const decoded = jwt.verify(
          token,
          process.env.JWT_SECRET || "test-secret"
        ) as {
          userId: number;
        };
        req.userId = decoded.userId;
      } catch {
        // Invalid token
      }
    }
    next();
  }),
  AuthRequest: {},
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
          `,
            (err) => {
              if (err) {
                reject(err);
              } else {
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

describe("Telegram Webhook Routes", () => {
  let app: Express;
  let testDb: Database;
  let telegramConnectionService: TelegramConnectionService;
  let userService: UserService;
  let telegramService: TelegramService;

  beforeEach(async () => {
    testDb = await createTestDatabase();
    const emailService = new EmailService();
    userService = new UserService(testDb);
    telegramService = new TelegramService();
    telegramConnectionService = new TelegramConnectionService(testDb);
    const authService = new AuthService(testDb, emailService);

    // Set JWT_SECRET for token generation
    process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

    // Initialize services
    ServiceManager.initializeServices(testDb);

    // Create Express app for testing
    app = express();
    app.use(express.json());
    app.use("/api/telegram", telegramRouter);
  });

  afterEach(async () => {
    await testDb.close();
    vi.restoreAllMocks();
  });

  describe("POST /api/telegram/webhook", () => {
    it("should handle /start command with valid token and associate chat ID", async () => {
      // Create a test user
      await testDb.run("INSERT INTO users (name, email) VALUES (?, ?)", [
        "Test User",
        "test@example.com",
      ]);

      // Generate a connection token
      const token = await telegramConnectionService.generateConnectionToken(1);

      // Mock TelegramService.sendMessage for welcome message
      const sendMessageSpy = vi
        .spyOn(telegramService, "sendMessage")
        .mockResolvedValue(undefined);

      // Simulate Telegram webhook update
      const webhookUpdate = {
        message: {
          message_id: 123,
          from: {
            id: 987654321,
            is_bot: false,
            first_name: "Test",
            username: "testuser",
          },
          chat: {
            id: 987654321,
            type: "private",
          },
          date: Math.floor(Date.now() / 1000),
          text: `/start ${token} 1`,
        },
      };

      const response = await request(app)
        .post("/api/telegram/webhook")
        .send(webhookUpdate)
        .expect(200);

      expect(response.body).toEqual({ ok: true });

      // Verify telegram_chat_id was set
      const user = await testDb.get<{ telegram_chat_id: string }>(
        "SELECT telegram_chat_id FROM users WHERE id = ?",
        [1]
      );
      expect(user?.telegram_chat_id).toBe("987654321");

      // Verify token was deleted (single-use)
      const tokenRow = await testDb.get(
        "SELECT * FROM telegram_connection_tokens WHERE token = ?",
        [token]
      );
      expect(tokenRow).toBeUndefined();
    });

    it("should return 200 and ignore non-/start messages", async () => {
      const webhookUpdate = {
        message: {
          message_id: 124,
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
          text: "Hello bot!",
        },
      };

      const response = await request(app)
        .post("/api/telegram/webhook")
        .send(webhookUpdate)
        .expect(200);

      expect(response.body).toEqual({ ok: true });
    });

    it("should return 200 and ignore /start without token", async () => {
      const webhookUpdate = {
        message: {
          message_id: 125,
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
          text: "/start",
        },
      };

      const response = await request(app)
        .post("/api/telegram/webhook")
        .send(webhookUpdate)
        .expect(200);

      expect(response.body).toEqual({ ok: true });
    });

    it("should return 200 and ignore invalid token", async () => {
      const webhookUpdate = {
        message: {
          message_id: 126,
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
        .send(webhookUpdate)
        .expect(200);

      expect(response.body).toEqual({ ok: true });

      // Verify telegram_chat_id was NOT set
      const user = await testDb.get<{ telegram_chat_id: string }>(
        "SELECT telegram_chat_id FROM users WHERE id = ?",
        [1]
      );
      expect(user).toBeUndefined();
    });

    it("should return 200 and ignore expired token", async () => {
      // Create a test user
      await testDb.run("INSERT INTO users (name, email) VALUES (?, ?)", [
        "Test User",
        "test@example.com",
      ]);

      // Create an expired token manually
      const expiredTime = new Date(Date.now() - 1000);
      await testDb.run(
        "INSERT INTO telegram_connection_tokens (token, user_id, expires_at) VALUES (?, ?, ?)",
        ["expired-token", 1, expiredTime.toISOString()]
      );

      const webhookUpdate = {
        message: {
          message_id: 127,
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
        .send(webhookUpdate)
        .expect(200);

      expect(response.body).toEqual({ ok: true });

      // Verify telegram_chat_id was NOT set
      const user = await testDb.get<{ telegram_chat_id: string | null }>(
        "SELECT telegram_chat_id FROM users WHERE id = ?",
        [1]
      );
      expect(user?.telegram_chat_id).toBeNull();
    });

    it("should handle updates without message field", async () => {
      const webhookUpdate = {
        update_id: 123456,
      };

      const response = await request(app)
        .post("/api/telegram/webhook")
        .send(webhookUpdate)
        .expect(200);

      expect(response.body).toEqual({ ok: true });
    });
  });

  describe("GET /api/telegram/start-link", () => {
    it("should generate a start link with token and user ID", async () => {
      // Create a test user
      await testDb.run("INSERT INTO users (name, email) VALUES (?, ?)", [
        "Test User",
        "test@example.com",
      ]);

      // Set TELEGRAM_BOT_USERNAME for the test
      process.env.TELEGRAM_BOT_USERNAME = "test_bot";

      const token = await telegramConnectionService.generateConnectionToken(1);

      const response = await request(app)
        .get("/api/telegram/start-link")
        .set("Authorization", `Bearer ${generateTestToken(1)}`)
        .expect(200);

      expect(response.body).toHaveProperty("url");
      expect(response.body.url).toContain("https://t.me/test_bot?start=");
      // Token is URL-encoded in the URL, so decode it to check
      const decodedUrl = decodeURIComponent(response.body.url);
      expect(decodedUrl).toContain(token);
      expect(decodedUrl).toContain("1");

      // Cleanup
      delete process.env.TELEGRAM_BOT_USERNAME;
    });

    it("should return 401 if not authenticated", async () => {
      // Mock authenticateToken to return 401
      vi.mocked(authMiddleware.authenticateToken).mockImplementation(
        (req: any, res: any, _next: any) => {
          res.status(401).json({ error: "Authorization token required" });
        }
      );

      const response = await request(app)
        .get("/api/telegram/start-link")
        .expect(401);

      expect(response.body).toHaveProperty("error");
    });

    it("should return 500 if bot username is not configured", async () => {
      await testDb.run("INSERT INTO users (name, email) VALUES (?, ?)", [
        "Test User",
        "test@example.com",
      ]);

      // Ensure TELEGRAM_BOT_USERNAME is not set
      delete process.env.TELEGRAM_BOT_USERNAME;

      const response = await request(app)
        .get("/api/telegram/start-link")
        .set("Authorization", `Bearer ${generateTestToken(1)}`)
        .expect(500);

      expect(response.body).toHaveProperty("error");
    });
  });

  describe("GET /api/telegram/status", () => {
    it("should return connected status when user has telegram_chat_id", async () => {
      // Create a test user with telegram_chat_id
      await testDb.run(
        "INSERT INTO users (name, email, telegram_chat_id, notification_channels) VALUES (?, ?, ?, ?)",
        ["Test User", "test@example.com", "123456789", "Telegram"]
      );

      const response = await request(app)
        .get("/api/telegram/status")
        .set("Authorization", `Bearer ${generateTestToken(1)}`)
        .expect(200);

      expect(response.body).toEqual({
        connected: true,
        chatId: "123456789",
      });
    });

    it("should return not connected status when user has no telegram_chat_id", async () => {
      // Create a test user without telegram_chat_id
      await testDb.run("INSERT INTO users (name, email) VALUES (?, ?)", [
        "Test User",
        "test@example.com",
      ]);

      const response = await request(app)
        .get("/api/telegram/status")
        .set("Authorization", `Bearer ${generateTestToken(1)}`)
        .expect(200);

      expect(response.body).toEqual({
        connected: false,
      });
    });

    it("should return 401 if not authenticated", async () => {
      // Mock authenticateToken to return 401
      vi.mocked(authMiddleware.authenticateToken).mockImplementation(
        (req: any, res: any, _next: any) => {
          res.status(401).json({ error: "Authorization token required" });
        }
      );

      const response = await request(app)
        .get("/api/telegram/status")
        .expect(401);

      expect(response.body).toHaveProperty("error");
    });
  });
});

/**
 * Helper function to generate a test JWT token.
 */
function generateTestToken(userId: number): string {
  const secret = process.env.JWT_SECRET || "test-secret";
  return jwt.sign({ userId }, secret, { expiresIn: "1h" });
}
