import sqlite3 from "sqlite3";
import { UserService } from "../userService.js";
import { Database } from "../../db/database.js";
import fs from "fs";
import path from "path";

// Mock the upload module
jest.mock("../../middleware/upload.js", () => ({
  getUploadsDirectory: jest.fn(),
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

    it("should update profile picture URL", async () => {
      const updatedUser = await userService.updateProfile(
        userId,
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
        "http://example.com/pic.jpg"
      );

      expect(updatedUser.name).toBe("New Name");
      // Email should remain unchanged (email changes are handled separately)
      expect(updatedUser.email).toBe("test@example.com");
      expect(updatedUser.profile_picture_url).toBe(
        "http://example.com/pic.jpg"
      );
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

    it("should delete profile picture file when user has profile picture URL", async () => {
      const { getUploadsDirectory } = require("../../middleware/upload.js");
      const result = await testDb.run(
        "INSERT INTO users (name, email, profile_picture_url) VALUES (?, ?, ?)",
        [
          "Test User",
          "test@example.com",
          `${process.env.SERVER_URL || "http://localhost"}:${
            process.env.PORT || "3001"
          }/uploads/test-image-123.jpg`,
        ]
      );
      const userId = result.lastID;

      // Mock fs and getUploadsDirectory
      const mockUnlinkSync = jest.spyOn(fs, "unlinkSync").mockImplementation();
      const mockExistsSync = jest.spyOn(fs, "existsSync").mockReturnValue(true);
      (getUploadsDirectory as jest.Mock).mockReturnValue("/test/uploads");
      const mockPathJoin = jest
        .spyOn(path, "join")
        .mockReturnValue("/test/uploads/test-image-123.jpg");

      await userService.deleteUser(userId);

      // Verify file deletion was attempted
      expect(getUploadsDirectory).toHaveBeenCalled();
      expect(mockPathJoin).toHaveBeenCalledWith(
        "/test/uploads",
        "test-image-123.jpg"
      );
      expect(mockExistsSync).toHaveBeenCalledWith(
        "/test/uploads/test-image-123.jpg"
      );
      expect(mockUnlinkSync).toHaveBeenCalledWith(
        "/test/uploads/test-image-123.jpg"
      );

      // Verify user was deleted
      const user = await userService.getUserById(userId);
      expect(user).toBeNull();

      // Cleanup mocks
      mockUnlinkSync.mockRestore();
      mockExistsSync.mockRestore();
      (getUploadsDirectory as jest.Mock).mockClear();
      mockPathJoin.mockRestore();
    });

    it("should handle missing profile picture file gracefully", async () => {
      const { getUploadsDirectory } = require("../../middleware/upload.js");
      const result = await testDb.run(
        "INSERT INTO users (name, email, profile_picture_url) VALUES (?, ?, ?)",
        [
          "Test User",
          "test@example.com",
          `${process.env.SERVER_URL || "http://localhost"}:${
            process.env.PORT || "3001"
          }/uploads/missing-image.jpg`,
        ]
      );
      const userId = result.lastID;

      // Mock fs and getUploadsDirectory - file doesn't exist
      const mockUnlinkSync = jest.spyOn(fs, "unlinkSync");
      const mockExistsSync = jest
        .spyOn(fs, "existsSync")
        .mockReturnValue(false);
      (getUploadsDirectory as jest.Mock).mockReturnValue("/test/uploads");

      await userService.deleteUser(userId);

      // Verify file existence was checked but deletion was not attempted
      expect(mockExistsSync).toHaveBeenCalled();
      expect(mockUnlinkSync).not.toHaveBeenCalled();

      // Verify user was still deleted
      const user = await userService.getUserById(userId);
      expect(user).toBeNull();

      // Cleanup mocks
      mockUnlinkSync.mockRestore();
      mockExistsSync.mockRestore();
      (getUploadsDirectory as jest.Mock).mockClear();
    });

    it("should handle invalid profile picture URL format gracefully", async () => {
      const { getUploadsDirectory } = require("../../middleware/upload.js");
      const result = await testDb.run(
        "INSERT INTO users (name, email, profile_picture_url) VALUES (?, ?, ?)",
        ["Test User", "test@example.com", "invalid-url-format"]
      );
      const userId = result.lastID;

      // Mock getUploadsDirectory (should not be called for invalid URL)
      (getUploadsDirectory as jest.Mock).mockReturnValue("/test/uploads");

      await userService.deleteUser(userId);

      // Verify getUploadsDirectory was not called for invalid URL
      expect(getUploadsDirectory).not.toHaveBeenCalled();

      // Verify user was still deleted
      const user = await userService.getUserById(userId);
      expect(user).toBeNull();

      // Cleanup mocks
      (getUploadsDirectory as jest.Mock).mockClear();
    });

    it("should handle file deletion errors gracefully and still delete user", async () => {
      const { getUploadsDirectory } = require("../../middleware/upload.js");
      const result = await testDb.run(
        "INSERT INTO users (name, email, profile_picture_url) VALUES (?, ?, ?)",
        [
          "Test User",
          "test@example.com",
          `${process.env.SERVER_URL || "http://localhost"}:${
            process.env.PORT || "3001"
          }/uploads/test-image.jpg`,
        ]
      );
      const userId = result.lastID;

      // Mock fs to throw error on unlinkSync
      const mockUnlinkSync = jest
        .spyOn(fs, "unlinkSync")
        .mockImplementation(() => {
          throw new Error("File system error");
        });
      const mockExistsSync = jest.spyOn(fs, "existsSync").mockReturnValue(true);
      (getUploadsDirectory as jest.Mock).mockReturnValue("/test/uploads");

      // Should not throw error, user deletion should succeed
      await expect(userService.deleteUser(userId)).resolves.not.toThrow();

      // Verify user was still deleted despite file deletion error
      const user = await userService.getUserById(userId);
      expect(user).toBeNull();

      // Cleanup mocks
      mockUnlinkSync.mockRestore();
      mockExistsSync.mockRestore();
      (getUploadsDirectory as jest.Mock).mockClear();
    });

    it("should delete user without profile picture URL", async () => {
      const { getUploadsDirectory } = require("../../middleware/upload.js");
      const result = await testDb.run(
        "INSERT INTO users (name, email) VALUES (?, ?)",
        ["Test User", "test@example.com"]
      );
      const userId = result.lastID;

      // Mock getUploadsDirectory (should not be called when no profile picture)
      (getUploadsDirectory as jest.Mock).mockReturnValue("/test/uploads");

      await userService.deleteUser(userId);

      // Verify getUploadsDirectory was not called
      expect(getUploadsDirectory).not.toHaveBeenCalled();

      // Verify user was deleted
      const user = await userService.getUserById(userId);
      expect(user).toBeNull();

      // Cleanup mocks
      (getUploadsDirectory as jest.Mock).mockClear();
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
