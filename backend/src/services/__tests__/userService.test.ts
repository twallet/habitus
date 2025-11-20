import sqlite3 from "sqlite3";
import { UserService } from "../userService.js";
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
              nickname TEXT,
              email TEXT NOT NULL UNIQUE,
              password_hash TEXT,
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
                resolve(db);
              }
            }
          );
        });
      });
    });
  });
}

describe("UserService", () => {
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

  describe("getAllUsers", () => {
    it("should return empty array when no users exist", async () => {
      const users = await UserService.getAllUsers();
      expect(users).toEqual([]);
    });

    it("should return all users ordered by id", async () => {
      // Insert test data
      await mockDbPromises.run(
        "INSERT INTO users (name, email) VALUES (?, ?)",
        ["User 1", "user1@example.com"]
      );
      await mockDbPromises.run(
        "INSERT INTO users (name, email) VALUES (?, ?)",
        ["User 2", "user2@example.com"]
      );

      const users = await UserService.getAllUsers();

      expect(users).toHaveLength(2);
      expect(users[0].name).toBe("User 1");
      expect(users[1].name).toBe("User 2");
      expect(users[0].id).toBeLessThan(users[1].id);
    });

    it("should return users with correct structure", async () => {
      await mockDbPromises.run(
        "INSERT INTO users (name, email) VALUES (?, ?)",
        ["Test User", "test@example.com"]
      );

      const users = await UserService.getAllUsers();

      expect(users[0]).toHaveProperty("id");
      expect(users[0]).toHaveProperty("name");
      expect(users[0]).toHaveProperty("email");
      expect(users[0]).toHaveProperty("created_at");
      expect(typeof users[0].id).toBe("number");
      expect(typeof users[0].name).toBe("string");
      expect(typeof users[0].email).toBe("string");
      expect(typeof users[0].created_at).toBe("string");
    });
  });

  // Note: createUser method was removed from UserService - user creation is now done via AuthService
  // These tests are kept for reference but would need to be moved to auth tests

  describe("getUserById", () => {
    it("should return null for non-existent user", async () => {
      const user = await UserService.getUserById(999);
      expect(user).toBeNull();
    });

    it("should return user for existing id", async () => {
      const result = await mockDbPromises.run(
        "INSERT INTO users (name, email) VALUES (?, ?)",
        ["Test User", "test@example.com"]
      );
      const insertedId = result.lastID;

      const user = await UserService.getUserById(insertedId);

      expect(user).not.toBeNull();
      expect(user?.id).toBe(insertedId);
      expect(user?.name).toBe("Test User");
      expect(user?.email).toBe("test@example.com");
    });

    it("should return user with correct structure", async () => {
      const result = await mockDbPromises.run(
        "INSERT INTO users (name, email) VALUES (?, ?)",
        ["Test User", "test@example.com"]
      );
      const insertedId = result.lastID;

      const user = await UserService.getUserById(insertedId);

      expect(user).toHaveProperty("id");
      expect(user).toHaveProperty("name");
      expect(user).toHaveProperty("email");
      expect(user).toHaveProperty("created_at");
      expect(typeof user?.id).toBe("number");
      expect(typeof user?.name).toBe("string");
      expect(typeof user?.email).toBe("string");
      expect(typeof user?.created_at).toBe("string");
    });
  });
});
