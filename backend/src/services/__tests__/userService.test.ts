import sqlite3 from "sqlite3";
import { UserService } from "../userService.js";
import { Database } from "../../db/database.js";

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
                // Use reflection to set private db property for testing
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

describe("UserService", () => {
  let testDb: Database;
  let userService: UserService;

  beforeEach(async () => {
    // Create a fresh in-memory database for each test
    testDb = await createTestDatabase();
    userService = new UserService(testDb);
  });

  afterEach(async () => {
    await testDb.close();
    jest.restoreAllMocks();
  });

  describe("getAllUsers", () => {
    it("should return empty array when no users exist", async () => {
      const users = await userService.getAllUsers();
      expect(users).toEqual([]);
    });

    it("should return all users ordered by id", async () => {
      // Insert test data
      await testDb.run("INSERT INTO users (name, email) VALUES (?, ?)", [
        "User 1",
        "user1@example.com",
      ]);
      await testDb.run("INSERT INTO users (name, email) VALUES (?, ?)", [
        "User 2",
        "user2@example.com",
      ]);

      const users = await userService.getAllUsers();

      expect(users).toHaveLength(2);
      expect(users[0].name).toBe("User 1");
      expect(users[1].name).toBe("User 2");
      expect(users[0].id).toBeLessThan(users[1].id);
    });

    it("should return users with correct structure", async () => {
      await testDb.run("INSERT INTO users (name, email) VALUES (?, ?)", [
        "Test User",
        "test@example.com",
      ]);

      const users = await userService.getAllUsers();

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
      const user = await userService.getUserById(999);
      expect(user).toBeNull();
    });

    it("should return user for existing id", async () => {
      const result = await testDb.run(
        "INSERT INTO users (name, email) VALUES (?, ?)",
        ["Test User", "test@example.com"]
      );
      const insertedId = result.lastID;

      const user = await userService.getUserById(insertedId);

      expect(user).not.toBeNull();
      expect(user?.id).toBe(insertedId);
      expect(user?.name).toBe("Test User");
      expect(user?.email).toBe("test@example.com");
    });

    it("should return user with correct structure", async () => {
      const result = await testDb.run(
        "INSERT INTO users (name, email) VALUES (?, ?)",
        ["Test User", "test@example.com"]
      );
      const insertedId = result.lastID;

      const user = await userService.getUserById(insertedId);

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

  describe("updateProfile", () => {
    let userId: number;

    beforeEach(async () => {
      const result = await testDb.run(
        "INSERT INTO users (name, email) VALUES (?, ?)",
        ["Test User", "test@example.com"]
      );
      userId = result.lastID;
    });

    it("should update user name", async () => {
      const updatedUser = await userService.updateProfile(userId, "New Name");

      expect(updatedUser.name).toBe("New Name");
      expect(updatedUser.email).toBe("test@example.com");
    });

    it("should update user nickname", async () => {
      const updatedUser = await userService.updateProfile(
        userId,
        undefined,
        "nickname"
      );

      expect(updatedUser.nickname).toBe("nickname");
    });

    it("should update user email", async () => {
      const updatedUser = await userService.updateProfile(
        userId,
        undefined,
        undefined,
        "newemail@example.com"
      );

      expect(updatedUser.email).toBe("newemail@example.com");
    });

    it("should update profile picture URL", async () => {
      const updatedUser = await userService.updateProfile(
        userId,
        undefined,
        undefined,
        undefined,
        "http://example.com/pic.jpg"
      );

      expect(updatedUser.profile_picture_url).toBe(
        "http://example.com/pic.jpg"
      );
    });

    it("should update multiple fields at once", async () => {
      const updatedUser = await userService.updateProfile(
        userId,
        "New Name",
        "New Nickname",
        "newemail@example.com",
        "http://example.com/pic.jpg"
      );

      expect(updatedUser.name).toBe("New Name");
      expect(updatedUser.nickname).toBe("New Nickname");
      expect(updatedUser.email).toBe("newemail@example.com");
      expect(updatedUser.profile_picture_url).toBe(
        "http://example.com/pic.jpg"
      );
    });

    it("should throw error if email is already taken by another user", async () => {
      await testDb.run("INSERT INTO users (name, email) VALUES (?, ?)", [
        "Other User",
        "other@example.com",
      ]);

      await expect(
        userService.updateProfile(
          userId,
          undefined,
          undefined,
          "other@example.com"
        )
      ).rejects.toThrow("Email already registered");
    });

    it("should throw error if no fields to update", async () => {
      await expect(userService.updateProfile(userId)).rejects.toThrow(
        "No fields to update"
      );
    });

    it("should throw error if user not found after update", async () => {
      // Delete user before update to simulate race condition
      await testDb.run("DELETE FROM users WHERE id = ?", [userId]);

      await expect(
        userService.updateProfile(userId, "New Name")
      ).rejects.toThrow("Failed to retrieve updated user");
    });

    it("should clear nickname when set to null", async () => {
      // First set a nickname
      await userService.updateProfile(userId, undefined, "nickname");

      // Then clear it
      const updatedUser = await userService.updateProfile(
        userId,
        undefined,
        ""
      );

      expect(updatedUser.nickname).toBeUndefined();
    });
  });

  describe("deleteUser", () => {
    it("should delete user successfully", async () => {
      const result = await testDb.run(
        "INSERT INTO users (name, email) VALUES (?, ?)",
        ["Test User", "test@example.com"]
      );
      const userId = result.lastID;

      await userService.deleteUser(userId);

      const user = await userService.getUserById(userId);
      expect(user).toBeNull();
    });

    it("should throw error if user not found", async () => {
      await expect(userService.deleteUser(999)).rejects.toThrow(
        "User not found"
      );
    });
  });

  describe("updateLastAccess", () => {
    it("should update last access timestamp", async () => {
      const result = await testDb.run(
        "INSERT INTO users (name, email) VALUES (?, ?)",
        ["Test User", "test@example.com"]
      );
      const userId = result.lastID;

      await userService.updateLastAccess(userId);

      const user = await userService.getUserById(userId);
      expect(user?.last_access).toBeDefined();
      expect(typeof user?.last_access).toBe("string");
    });

    it("should not throw error for non-existent user", async () => {
      // Should not throw, just silently fail
      await expect(userService.updateLastAccess(999)).resolves.not.toThrow();
    });
  });
});
