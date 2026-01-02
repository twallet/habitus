import { vi, type Mock } from "vitest";
import request from "supertest";
import express, { Express } from "express";
import sqlite3 from "sqlite3";
import { Database } from "../../db/database.js";
import { ServiceManager } from "../../services/index.js";
import { TelegramConnectionService } from "../../services/telegramConnectionService.js";
import { UserService } from "../../services/userService.js";
import { TelegramService } from "../../services/telegramService.js";
import { EmailService } from "../../services/emailService.js";
import telegramRouter from "../telegram.js";

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
});
