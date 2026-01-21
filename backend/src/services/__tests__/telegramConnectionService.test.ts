import { vi, type Mock } from "vitest";
import BetterSqlite3 from "better-sqlite3";
import { TelegramConnectionService } from "../telegramConnectionService.js";
import { Database } from "../../db/database.js";

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

describe("TelegramConnectionService", () => {
  let testDb: Database;
  let telegramConnectionService: TelegramConnectionService;

  beforeEach(async () => {
    // Create a fresh in-memory database for each test
    testDb = await createTestDatabase();
    telegramConnectionService = new TelegramConnectionService(testDb);
  });

  afterEach(async () => {
    await testDb.close();
    vi.restoreAllMocks();
  });

  describe("generateConnectionToken", () => {
    it("should generate a connection token for a user", async () => {
      // Create a test user
      await testDb.run("INSERT INTO users (name, email) VALUES (?, ?)", [
        "Test User",
        "test@example.com",
      ]);

      const token = await telegramConnectionService.generateConnectionToken(1);

      expect(token).toBeDefined();
      expect(typeof token).toBe("string");
      expect(token.length).toBeGreaterThan(0);

      // Verify token was stored in database
      const row = await testDb.get<{
        token: string;
        user_id: number;
        expires_at: string;
      }>(
        "SELECT token, user_id, expires_at FROM telegram_connection_tokens WHERE token = ?",
        [token]
      );

      expect(row).toBeDefined();
      expect(row?.user_id).toBe(1);
      expect(row?.expires_at).toBeDefined();

      // Verify expiration is approximately 10 minutes from now
      const expiresAt = new Date(row!.expires_at);
      const now = new Date();
      const tenMinutesFromNow = new Date(now.getTime() + 10 * 60 * 1000);
      const diff = Math.abs(expiresAt.getTime() - tenMinutesFromNow.getTime());
      expect(diff).toBeLessThan(60000); // Within 1 minute tolerance
    });

    it("should generate unique tokens for different calls", async () => {
      await testDb.run("INSERT INTO users (name, email) VALUES (?, ?)", [
        "Test User",
        "test@example.com",
      ]);

      const token1 = await telegramConnectionService.generateConnectionToken(1);
      const token2 = await telegramConnectionService.generateConnectionToken(1);

      expect(token1).not.toBe(token2);
    });

    it("should throw error if user does not exist", async () => {
      await expect(
        telegramConnectionService.generateConnectionToken(999)
      ).rejects.toThrow();
    });
  });

  describe("validateToken", () => {
    it("should validate a valid token and return user ID", async () => {
      await testDb.run("INSERT INTO users (name, email) VALUES (?, ?)", [
        "Test User",
        "test@example.com",
      ]);

      const token = await telegramConnectionService.generateConnectionToken(1);
      const result = await telegramConnectionService.validateToken(token);

      expect(result).toBeDefined();
      expect(result?.userId).toBe(1);
    });

    it("should return null for invalid token", async () => {
      const result = await telegramConnectionService.validateToken(
        "invalid-token"
      );

      expect(result).toBeNull();
    });

    it("should return null for expired token", async () => {
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

      const result = await telegramConnectionService.validateToken(
        "expired-token"
      );

      expect(result).toBeNull();
    });

    it("should delete token after validation", async () => {
      await testDb.run("INSERT INTO users (name, email) VALUES (?, ?)", [
        "Test User",
        "test@example.com",
      ]);

      const token = await telegramConnectionService.generateConnectionToken(1);
      await telegramConnectionService.validateToken(token);

      // Verify token was deleted
      const row = await testDb.get(
        "SELECT * FROM telegram_connection_tokens WHERE token = ?",
        [token]
      );

      expect(row).toBeUndefined();
    });
  });

  describe("cleanupExpiredTokens", () => {
    it("should remove expired tokens from database", async () => {
      await testDb.run("INSERT INTO users (name, email) VALUES (?, ?)", [
        "Test User",
        "test@example.com",
      ]);

      // Create expired tokens
      const expiredTime1 = new Date(Date.now() - 1000);
      const expiredTime2 = new Date(Date.now() - 2000);

      await testDb.run(
        "INSERT INTO telegram_connection_tokens (token, user_id, expires_at) VALUES (?, ?, ?)",
        ["expired-token-1", 1, expiredTime1.toISOString()]
      );
      await testDb.run(
        "INSERT INTO telegram_connection_tokens (token, user_id, expires_at) VALUES (?, ?, ?)",
        ["expired-token-2", 1, expiredTime2.toISOString()]
      );

      // Create a valid token
      const validToken =
        await telegramConnectionService.generateConnectionToken(1);

      // Run cleanup
      await telegramConnectionService.cleanupExpiredTokens();

      // Verify expired tokens are removed
      const expired1 = await testDb.get(
        "SELECT * FROM telegram_connection_tokens WHERE token = ?",
        ["expired-token-1"]
      );
      const expired2 = await testDb.get(
        "SELECT * FROM telegram_connection_tokens WHERE token = ?",
        ["expired-token-2"]
      );

      expect(expired1).toBeUndefined();
      expect(expired2).toBeUndefined();

      // Verify valid token still exists
      const valid = await testDb.get(
        "SELECT * FROM telegram_connection_tokens WHERE token = ?",
        [validToken]
      );
      expect(valid).toBeDefined();
    });

    it("should not remove valid tokens", async () => {
      await testDb.run("INSERT INTO users (name, email) VALUES (?, ?)", [
        "Test User",
        "test@example.com",
      ]);

      const token = await telegramConnectionService.generateConnectionToken(1);

      await telegramConnectionService.cleanupExpiredTokens();

      const row = await testDb.get(
        "SELECT * FROM telegram_connection_tokens WHERE token = ?",
        [token]
      );

      expect(row).toBeDefined();
    });
  });
});


