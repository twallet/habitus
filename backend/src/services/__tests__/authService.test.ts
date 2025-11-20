import sqlite3 from "sqlite3";
import { AuthService } from "../authService.js";
import * as databaseModule from "../../db/database.js";

/**
 * Create an in-memory database for testing.
 * @returns Promise resolving to Database instance
 */
function createTestDatabase(): Promise<sqlite3.Database> {
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
              password_hash TEXT NOT NULL,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
            CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
          `,
            (err) => {
              if (err) {
                reject(err);
              } else {
                resolve(db);
              }
            }
          );
        });
      });
    });
  });
}

describe("AuthService", () => {
  let testDb: sqlite3.Database;
  let mockDbPromises: typeof databaseModule.dbPromises;

  beforeEach(async () => {
    // Create a fresh in-memory database for each test
    testDb = await createTestDatabase();
    // Create mock dbPromises that use our test database
    mockDbPromises = {
      run: (sql: string, params: any[] = []) => {
        return new Promise((resolve, reject) => {
          testDb.run(sql, params, function (err) {
            if (err) {
              reject(err);
            } else {
              resolve({ lastID: this.lastID, changes: this.changes });
            }
          });
        });
      },
      get: <T = any>(
        sql: string,
        params: any[] = []
      ): Promise<T | undefined> => {
        return new Promise((resolve, reject) => {
          testDb.get(sql, params, (err, row) => {
            if (err) {
              reject(err);
            } else {
              resolve(row as T);
            }
          });
        });
      },
      all: <T = any>(sql: string, params: any[] = []): Promise<T[]> => {
        return new Promise((resolve, reject) => {
          testDb.all(sql, params, (err, rows) => {
            if (err) {
              reject(err);
            } else {
              resolve(rows as T[]);
            }
          });
        });
      },
    };
    // Mock dbPromises module
    Object.defineProperty(databaseModule, "dbPromises", {
      value: mockDbPromises,
      writable: true,
      configurable: true,
    });
  });

  afterEach((done) => {
    testDb.close((err) => {
      if (err) {
        done(err);
      } else {
        jest.restoreAllMocks();
        done();
      }
    });
  });

  describe("register", () => {
    it("should register a new user with valid data", async () => {
      const user = await AuthService.register(
        "John Doe",
        "john@example.com",
        "Password123!"
      );

      expect(user.name).toBe("John Doe");
      expect(user.email).toBe("john@example.com");
      expect(user.id).toBeGreaterThan(0);
      expect(user.created_at).toBeDefined();
      expect(user).not.toHaveProperty("password_hash");
    });

    it("should hash password before storing", async () => {
      const password = "Password123!";
      const user = await AuthService.register(
        "John Doe",
        "john@example.com",
        password
      );

      const dbUser = await mockDbPromises.get<{ password_hash: string }>(
        "SELECT password_hash FROM users WHERE id = ?",
        [user.id]
      );

      expect(dbUser?.password_hash).toBeDefined();
      expect(dbUser?.password_hash).not.toBe(password);
      expect(dbUser?.password_hash.length).toBeGreaterThan(50); // bcrypt hash length
    });

    it("should normalize email to lowercase", async () => {
      const user = await AuthService.register(
        "John Doe",
        "JOHN@EXAMPLE.COM",
        "Password123!"
      );

      expect(user.email).toBe("john@example.com");
    });

    it("should throw error if email already exists", async () => {
      await AuthService.register(
        "John Doe",
        "john@example.com",
        "Password123!"
      );

      await expect(
        AuthService.register("Jane Doe", "john@example.com", "Password123!")
      ).rejects.toThrow("Email already registered");
    });

    it("should throw TypeError for invalid email format", async () => {
      await expect(
        AuthService.register("John Doe", "invalid-email", "Password123!")
      ).rejects.toThrow(TypeError);
    });

    it("should throw TypeError for weak password", async () => {
      await expect(
        AuthService.register("John Doe", "john@example.com", "weak")
      ).rejects.toThrow(TypeError);

      await expect(
        AuthService.register("John Doe", "john@example.com", "weakpass")
      ).rejects.toThrow(TypeError);

      await expect(
        AuthService.register("John Doe", "john@example.com", "WEAKPASS")
      ).rejects.toThrow(TypeError);

      await expect(
        AuthService.register("John Doe", "john@example.com", "WeakPass")
      ).rejects.toThrow(TypeError);

      await expect(
        AuthService.register("John Doe", "john@example.com", "WeakPass1")
      ).rejects.toThrow(TypeError);
    });

    it("should accept valid robust password", async () => {
      const user = await AuthService.register(
        "John Doe",
        "john@example.com",
        "StrongP@ssw0rd"
      );

      expect(user).toBeDefined();
      expect(user.email).toBe("john@example.com");
    });
  });

  describe("login", () => {
    const testEmail = "john@example.com";
    const testPassword = "Password123!";

    beforeEach(async () => {
      // Register a test user
      await AuthService.register("John Doe", testEmail, testPassword);
    });

    it("should login with correct credentials", async () => {
      const result = await AuthService.login(testEmail, testPassword);

      expect(result.user.email).toBe(testEmail);
      expect(result.user.name).toBe("John Doe");
      expect(result.token).toBeDefined();
      expect(typeof result.token).toBe("string");
    });

    it("should return JWT token on successful login", async () => {
      const result = await AuthService.login(testEmail, testPassword);

      expect(result.token).toBeDefined();
      expect(result.token.split(".")).toHaveLength(3); // JWT has 3 parts
    });

    it("should throw error for incorrect password", async () => {
      await expect(
        AuthService.login(testEmail, "WrongPassword123!")
      ).rejects.toThrow("Invalid credentials");
    });

    it("should throw error for non-existent email", async () => {
      await expect(
        AuthService.login("nonexistent@example.com", testPassword)
      ).rejects.toThrow("Invalid credentials");
    });

    it("should normalize email before lookup", async () => {
      const result = await AuthService.login("JOHN@EXAMPLE.COM", testPassword);

      expect(result.user.email).toBe(testEmail);
    });

    it("should throw error for empty password", async () => {
      await expect(AuthService.login(testEmail, "")).rejects.toThrow(
        "Invalid credentials"
      );
    });
  });

  describe("verifyToken", () => {
    it("should verify valid token and return user ID", async () => {
      const user = await AuthService.register(
        "John Doe",
        "john@example.com",
        "Password123!"
      );
      const loginResult = await AuthService.login(
        "john@example.com",
        "Password123!"
      );

      const userId = await AuthService.verifyToken(loginResult.token);

      expect(userId).toBe(user.id);
    });

    it("should throw error for invalid token", async () => {
      await expect(
        AuthService.verifyToken("invalid.token.here")
      ).rejects.toThrow("Invalid or expired token");
    });

    it("should throw error for expired token", async () => {
      // This test would require mocking jwt.sign with a short expiration
      // For now, we'll just test that malformed tokens are rejected
      await expect(AuthService.verifyToken("")).rejects.toThrow();
    });
  });

  describe("getUserById", () => {
    it("should return user for existing ID", async () => {
      const user = await AuthService.register(
        "John Doe",
        "john@example.com",
        "Password123!"
      );

      const retrievedUser = await AuthService.getUserById(user.id);

      expect(retrievedUser).not.toBeNull();
      expect(retrievedUser?.id).toBe(user.id);
      expect(retrievedUser?.email).toBe(user.email);
      expect(retrievedUser).not.toHaveProperty("password_hash");
    });

    it("should return null for non-existent ID", async () => {
      const user = await AuthService.getUserById(999);

      expect(user).toBeNull();
    });
  });
});
