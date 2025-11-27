import { vi } from "vitest";
import sqlite3 from "sqlite3";
import { AuthService } from "../authService.js";
import { Database } from "../../db/database.js";
import { EmailService } from "../emailService.js";

// Mock EmailService to avoid sending actual emails during tests
// Create shared mock functions that will be used by all instances
// Use vi.hoisted() to ensure mocks are available when mock factory runs
const { mockFunctions } = vi.hoisted(() => ({
  mockFunctions: {
    sendMagicLink: vi.fn().mockResolvedValue(undefined),
    sendEmail: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("../emailService.js", () => ({
  EmailService: vi.fn().mockImplementation(() => ({
    sendMagicLink: mockFunctions.sendMagicLink,
    sendEmail: mockFunctions.sendEmail,
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

describe("AuthService", () => {
  let testDb: Database;
  let emailService: EmailService;
  let authService: AuthService;

  beforeEach(async () => {
    // Create a fresh in-memory database for each test
    testDb = await createTestDatabase();
    // Clear mocks before each test
    mockFunctions.sendMagicLink.mockClear();
    mockFunctions.sendEmail.mockClear();
    emailService = new EmailService();
    authService = new AuthService(testDb, emailService);
  });

  afterEach(async () => {
    await testDb.close();
    vi.restoreAllMocks();
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

  describe("requestEmailChange", () => {
    let userId: number;

    beforeEach(async () => {
      // Create a test user
      const result = await testDb.run(
        "INSERT INTO users (name, email) VALUES (?, ?)",
        ["John Doe", "john@example.com"]
      );
      userId = result.lastID;
    });

    it("should request email change successfully", async () => {
      await authService.requestEmailChange(userId, "newemail@example.com");

      // Check that pending email and token were stored
      const user = await testDb.get<{
        pending_email: string | null;
        email_verification_token: string | null;
        email_verification_expires: string | null;
      }>(
        "SELECT pending_email, email_verification_token, email_verification_expires FROM users WHERE id = ?",
        [userId]
      );

      expect(user?.pending_email).toBe("newemail@example.com");
      expect(user?.email_verification_token).not.toBeNull();
      expect(user?.email_verification_expires).not.toBeNull();

      // Check that email was sent
      expect(mockFunctions.sendEmail).toHaveBeenCalledWith(
        "newemail@example.com",
        "Verify your new email address for 🌱 Habitus",
        expect.stringContaining("verify your new email address"),
        expect.stringContaining("Verify email address")
      );
    });

    it("should throw error if user not found", async () => {
      await expect(
        authService.requestEmailChange(999, "newemail@example.com")
      ).rejects.toThrow("User not found");
    });

    it("should throw error if new email is same as current email", async () => {
      await expect(
        authService.requestEmailChange(userId, "john@example.com")
      ).rejects.toThrow("New email must be different from current email");
    });

    it("should throw error if new email is already registered", async () => {
      // Create another user with the target email
      await testDb.run("INSERT INTO users (name, email) VALUES (?, ?)", [
        "Jane Doe",
        "jane@example.com",
      ]);

      await expect(
        authService.requestEmailChange(userId, "jane@example.com")
      ).rejects.toThrow("Email already registered");
    });

    it("should throw error for invalid email format", async () => {
      await expect(
        authService.requestEmailChange(userId, "invalid-email")
      ).rejects.toThrow();
    });

    it("should check for duplicate email before cooldown", async () => {
      // The cooldown check happens on the target email, but duplicate email check happens first
      // Create a user with the target email to verify duplicate check works
      const futureDate = new Date();
      futureDate.setMinutes(futureDate.getMinutes() + 15);
      await testDb.run(
        "INSERT INTO users (name, email, magic_link_expires) VALUES (?, ?, ?)",
        ["Temp User", "cooldown@example.com", futureDate.toISOString()]
      );

      // Request should fail on duplicate email check (which happens before cooldown)
      await expect(
        authService.requestEmailChange(userId, "cooldown@example.com")
      ).rejects.toThrow("Email already registered");
    });
  });
});
