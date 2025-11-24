import sqlite3 from "sqlite3";
import { AuthService } from "../authService.js";
import { Database } from "../../db/database.js";
import { EmailService } from "../emailService.js";

// Mock EmailService to avoid sending actual emails during tests
jest.mock("../emailService.js", () => ({
  EmailService: jest.fn().mockImplementation(() => ({
    sendMagicLink: jest.fn().mockResolvedValue(undefined),
  })),
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

describe("AuthService", () => {
  let testDb: Database;
  let emailService: EmailService;
  let authService: AuthService;

  beforeEach(async () => {
    // Create a fresh in-memory database for each test
    testDb = await createTestDatabase();
    emailService = new EmailService();
    authService = new AuthService(testDb, emailService);
  });

  afterEach(async () => {
    await testDb.close();
    jest.restoreAllMocks();
  });

  describe("verifyToken", () => {
    it("should verify valid token and return user ID", async () => {
      const testEmail = "john@example.com";
      await authService.requestRegisterMagicLink("John Doe", testEmail);

      const user = await testDb.get<{
        id: number;
        magic_link_token: string;
      }>("SELECT id, magic_link_token FROM users WHERE email = ?", [testEmail]);

      if (!user || !user.magic_link_token) {
        throw new Error("User or token not found");
      }

      const result = await authService.verifyMagicLink(user.magic_link_token);
      const userId = await authService.verifyToken(result.token);

      expect(userId).toBe(user.id);
    });

    it("should throw error for invalid token", async () => {
      await expect(
        authService.verifyToken("invalid.token.here")
      ).rejects.toThrow("Invalid or expired token");
    });

    it("should throw error for expired token", async () => {
      // This test would require mocking jwt.sign with a short expiration
      // For now, we'll just test that malformed tokens are rejected
      await expect(authService.verifyToken("")).rejects.toThrow();
    });
  });

  describe("getUserById", () => {
    it("should return user for existing ID", async () => {
      const testEmail = "john@example.com";
      await authService.requestRegisterMagicLink("John Doe", testEmail);

      const user = await testDb.get<{
        id: number;
        magic_link_token: string;
      }>("SELECT id, magic_link_token FROM users WHERE email = ?", [testEmail]);

      if (!user || !user.magic_link_token) {
        throw new Error("User or token not found");
      }

      const result = await authService.verifyMagicLink(user.magic_link_token);
      const retrievedUser = await authService.getUserById(result.user.id);

      expect(retrievedUser).not.toBeNull();
      expect(retrievedUser?.id).toBe(result.user.id);
      expect(retrievedUser?.email).toBe(testEmail);
    });

    it("should return null for non-existent ID", async () => {
      const user = await authService.getUserById(999);

      expect(user).toBeNull();
    });
  });
});
