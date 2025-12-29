import { User, UserData } from "../User.js";
import { Database } from "../../db/database.js";
import sqlite3 from "sqlite3";

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
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
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

describe("User Model", () => {
  let db: Database;

  beforeEach(async () => {
    db = await createTestDatabase();
  });

  afterEach(async () => {
    await db.close();
  });

  describe("constructor", () => {
    it("should create User instance with provided data", () => {
      const userData: UserData = {
        id: 1,
        name: "Test User",
        email: "test@example.com",
        profile_picture_url: "http://example.com/pic.jpg",
        last_access: "2024-01-01T00:00:00Z",
        created_at: "2024-01-01T00:00:00Z",
      };

      const user = new User(userData);

      expect(user.id).toBe(1);
      expect(user.name).toBe("Test User");
      expect(user.email).toBe("test@example.com");
      expect(user.profile_picture_url).toBe("http://example.com/pic.jpg");
    });

    it("should create User instance with minimal data", () => {
      const userData: UserData = {
        id: 1,
        name: "Test User",
        email: "test@example.com",
      };

      const user = new User(userData);

      expect(user.id).toBe(1);
      expect(user.name).toBe("Test User");
      expect(user.email).toBe("test@example.com");
    });
  });

  describe("validate", () => {
    it("should validate and normalize user fields", () => {
      const user = new User({
        id: 1,
        name: "  Test User  ",
        email: "  TEST@EXAMPLE.COM  ",
      });

      const validated = user.validate();

      expect(validated.name).toBe("Test User");
      expect(validated.email).toBe("test@example.com");
    });

    it("should throw error for invalid name", () => {
      const user = new User({
        id: 1,
        name: "",
        email: "test@example.com",
      });

      expect(() => user.validate()).toThrow(TypeError);
    });

    it("should throw error for invalid email", () => {
      const user = new User({
        id: 1,
        name: "Test User",
        email: "invalid-email",
      });

      expect(() => user.validate()).toThrow(TypeError);
    });
  });

  describe("save", () => {
    it("should create new user when id is not set", async () => {
      const user = new User({
        id: 0,
        name: "New User",
        email: "new@example.com",
      });

      const saved = await user.save(db);

      expect(saved.id).toBeGreaterThan(0);
      expect(saved.name).toBe("New User");
      expect(saved.email).toBe("new@example.com");
    });

    it("should update existing user when id is set", async () => {
      const result = await db.run(
        "INSERT INTO users (name, email) VALUES (?, ?)",
        ["Original Name", "original@example.com"]
      );
      const userId = result.lastID;

      const user = new User({
        id: userId,
        name: "Updated Name",
        email: "updated@example.com",
      });

      const saved = await user.save(db);

      expect(saved.id).toBe(userId);
      expect(saved.name).toBe("Updated Name");
      expect(saved.email).toBe("updated@example.com");
    });

    it("should throw error if creation fails", async () => {
      const user = new User({
        id: 0,
        name: "New User",
        email: "new@example.com",
      });

      // Close database to cause failure
      await db.close();

      await expect(user.save(db)).rejects.toThrow();
    });
  });

  describe("update", () => {
    it("should update user fields", async () => {
      const result = await db.run(
        "INSERT INTO users (name, email) VALUES (?, ?)",
        ["Original Name", "original@example.com"]
      );
      const userId = result.lastID;

      const user = new User({
        id: userId,
        name: "Original Name",
        email: "original@example.com",
      });

      const updated = await user.update(
        {
          name: "Updated Name",
        },
        db
      );

      expect(updated.name).toBe("Updated Name");
    });

    it("should throw error if user has no id", async () => {
      const user = new User({
        id: 0,
        name: "Test User",
        email: "test@example.com",
      });

      await expect(user.update({ name: "Updated" }, db)).rejects.toThrow(
        "Cannot update user without ID"
      );
    });
  });

  describe("delete", () => {
    it("should delete user from database", async () => {
      const result = await db.run(
        "INSERT INTO users (name, email) VALUES (?, ?)",
        ["Test User", "test@example.com"]
      );
      const userId = result.lastID;

      const user = new User({
        id: userId,
        name: "Test User",
        email: "test@example.com",
      });

      await user.delete(db);

      const deleted = await db.get("SELECT id FROM users WHERE id = ?", [
        userId,
      ]);
      expect(deleted).toBeUndefined();
    });

    it("should throw error if user has no id", async () => {
      const user = new User({
        id: 0,
        name: "Test User",
        email: "test@example.com",
      });

      await expect(user.delete(db)).rejects.toThrow(
        "Cannot delete user without ID"
      );
    });

    it("should throw error if user not found", async () => {
      const user = new User({
        id: 999,
        name: "Test User",
        email: "test@example.com",
      });

      await expect(user.delete(db)).rejects.toThrow("User not found");
    });
  });

  describe("toData", () => {
    it("should convert user instance to UserData", () => {
      const user = new User({
        id: 1,
        name: "Test User",
        email: "test@example.com",
        profile_picture_url: "http://example.com/pic.jpg",
        last_access: "2024-01-01T00:00:00Z",
        created_at: "2024-01-01T00:00:00Z",
      });

      const data = user.toData();

      expect(data).toEqual({
        id: 1,
        name: "Test User",
        email: "test@example.com",
        profile_picture_url: "http://example.com/pic.jpg",
        last_access: "2024-01-01T00:00:00Z",
        created_at: "2024-01-01T00:00:00Z",
      });
    });
  });

  describe("loadById", () => {
    it("should load user by id", async () => {
      const result = await db.run(
        "INSERT INTO users (name, email) VALUES (?, ?)",
        ["Test User", "test@example.com"]
      );
      const userId = result.lastID;

      const user = await User.loadById(userId, db);

      expect(user).not.toBeNull();
      expect(user?.id).toBe(userId);
      expect(user?.name).toBe("Test User");
      expect(user?.email).toBe("test@example.com");
    });

    it("should return null for non-existent user", async () => {
      const user = await User.loadById(999, db);
      expect(user).toBeNull();
    });
  });

  describe("loadByEmail", () => {
    it("should load user by email", async () => {
      await db.run("INSERT INTO users (name, email) VALUES (?, ?)", [
        "Test User",
        "test@example.com",
      ]);

      const user = await User.loadByEmail("test@example.com", db);

      expect(user).not.toBeNull();
      expect(user?.email).toBe("test@example.com");
    });

    it("should normalize email when loading", async () => {
      await db.run("INSERT INTO users (name, email) VALUES (?, ?)", [
        "Test User",
        "test@example.com",
      ]);

      const user = await User.loadByEmail("  TEST@EXAMPLE.COM  ", db);

      expect(user).not.toBeNull();
      expect(user?.email).toBe("test@example.com");
    });

    it("should return null for non-existent email", async () => {
      const user = await User.loadByEmail("nonexistent@example.com", db);
      expect(user).toBeNull();
    });
  });
  describe("validateName", () => {
    it("should accept valid names", () => {
      expect(User.validateName("John Doe")).toBe("John Doe");
      expect(User.validateName("Alice")).toBe("Alice");
    });

    it("should trim whitespace", () => {
      expect(User.validateName("  Jane Smith  ")).toBe("Jane Smith");
    });

    it("should throw TypeError for invalid name format", () => {
      expect(() => User.validateName("")).toThrow(TypeError);
      expect(() => User.validateName("   ")).toThrow(TypeError);
    });

    it("should throw TypeError for non-string name", () => {
      expect(() => User.validateName(null as any)).toThrow(TypeError);
      expect(() => User.validateName(123 as any)).toThrow(TypeError);
      expect(() => User.validateName(undefined as any)).toThrow(TypeError);
    });

    it("should throw TypeError for name exceeding max length", () => {
      const longName = "a".repeat(User.MAX_NAME_LENGTH + 1);
      expect(() => User.validateName(longName)).toThrow(TypeError);
    });

    it("should accept name with exactly MAX_NAME_LENGTH characters", () => {
      const maxLengthName = "a".repeat(User.MAX_NAME_LENGTH);
      expect(User.validateName(maxLengthName)).toBe(maxLengthName);
    });
  });

  describe("validateEmail", () => {
    it("should accept valid email addresses", () => {
      expect(User.validateEmail("test@example.com")).toBe("test@example.com");
      expect(User.validateEmail("user.name@example.co.uk")).toBe(
        "user.name@example.co.uk"
      );
      expect(User.validateEmail("test+tag@example.com")).toBe(
        "test+tag@example.com"
      );
    });

    it("should normalize email to lowercase", () => {
      expect(User.validateEmail("TEST@EXAMPLE.COM")).toBe("test@example.com");
      expect(User.validateEmail("Test@Example.Com")).toBe("test@example.com");
    });

    it("should trim whitespace", () => {
      expect(User.validateEmail("  test@example.com  ")).toBe(
        "test@example.com"
      );
    });

    it("should throw TypeError for invalid email format", () => {
      expect(() => User.validateEmail("invalid-email")).toThrow(TypeError);
      expect(() => User.validateEmail("@example.com")).toThrow(TypeError);
      expect(() => User.validateEmail("test@")).toThrow(TypeError);
      expect(() => User.validateEmail("test@example")).toThrow(TypeError);
    });

    it("should throw TypeError for empty email", () => {
      expect(() => User.validateEmail("")).toThrow(TypeError);
      expect(() => User.validateEmail("   ")).toThrow(TypeError);
    });

    it("should throw TypeError for non-string email", () => {
      expect(() => User.validateEmail(null as any)).toThrow(TypeError);
      expect(() => User.validateEmail(123 as any)).toThrow(TypeError);
      expect(() => User.validateEmail(undefined as any)).toThrow(TypeError);
    });

    it("should throw TypeError for email exceeding max length", () => {
      const longEmail = "a".repeat(250) + "@example.com";
      expect(() => User.validateEmail(longEmail)).toThrow(TypeError);
    });
  });
});
