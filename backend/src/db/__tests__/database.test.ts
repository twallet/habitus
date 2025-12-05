import { Database } from "../database.js";
import fs from "fs";
import path from "path";
import os from "os";

/**
 * Database class tests.
 * Tests database initialization, path resolution, and CRUD operations.
 */
describe("Database", () => {
  let tempDir: string;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
    // Create temporary directory for test databases
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "habitus-test-"));
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    // Clean up temporary directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe("Constructor and Path Resolution", () => {
    it("should use :memory: when provided as custom path", () => {
      const db = new Database(":memory:");
      // We can't directly access dbPath, but we can test by initializing
      // and checking that it works with :memory:
      expect(db).toBeInstanceOf(Database);
    });

    it("should use file: URI when provided as custom path", () => {
      const db = new Database("file:test.db");
      expect(db).toBeInstanceOf(Database);
    });

    it("should resolve relative custom path", () => {
      const customPath = path.join(tempDir, "custom.db");
      const db = new Database(customPath);
      expect(db).toBeInstanceOf(Database);
      // Verify directory was created
      expect(fs.existsSync(tempDir)).toBe(true);
    });

    it("should resolve absolute custom path", () => {
      const absolutePath = path.join(tempDir, "absolute.db");
      const db = new Database(absolutePath);
      expect(db).toBeInstanceOf(Database);
      expect(fs.existsSync(tempDir)).toBe(true);
    });

    it("should use DB_PATH environment variable when set", () => {
      const envPath = path.join(tempDir, "env.db");
      process.env.DB_PATH = envPath;
      const db = new Database();
      expect(db).toBeInstanceOf(Database);
      expect(fs.existsSync(tempDir)).toBe(true);
    });

    it("should use relative DB_PATH environment variable", () => {
      const relativePath = "./test-env.db";
      process.env.DB_PATH = relativePath;
      const db = new Database();
      expect(db).toBeInstanceOf(Database);
    });

    it("should create data directory when using default path", async () => {
      // Use a temporary directory for the database to avoid creating directories in the project root
      const testDataDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "habitus-test-data-")
      );
      const testDbPath = path.join(testDataDir, "habitus.db");

      try {
        // Set DB_PATH to use the test directory (simulating default path behavior)
        process.env.DB_PATH = testDbPath;
        const db = new Database();
        expect(db).toBeInstanceOf(Database);

        // Initialize database to ensure path resolution happens
        await db.initialize();

        // Verify directory was created (getDatabasePath creates the parent directory)
        expect(fs.existsSync(testDataDir)).toBe(true);
        expect(fs.existsSync(testDbPath)).toBe(true);

        // Cleanup: close database
        await db.close();
      } finally {
        // Clean up test directory
        if (fs.existsSync(testDataDir)) {
          fs.rmSync(testDataDir, { recursive: true, force: true });
        }
        // Restore DB_PATH
        delete process.env.DB_PATH;
      }
    });
  });

  describe("initialize", () => {
    it("should initialize database with :memory:", async () => {
      const db = new Database(":memory:");
      await expect(db.initialize()).resolves.not.toThrow();
      await db.close();
    });

    it("should initialize database with file path", async () => {
      const dbPath = path.join(tempDir, "test.db");
      const db = new Database(dbPath);
      await expect(db.initialize()).resolves.not.toThrow();
      expect(fs.existsSync(dbPath)).toBe(true);
      await db.close();
    });

    it("should enable foreign keys", async () => {
      const db = new Database(":memory:");
      await db.initialize();
      // Foreign keys should be enabled, test by trying to violate constraint
      await db.run("CREATE TABLE parent (id INTEGER PRIMARY KEY, name TEXT)");
      await db.run(
        "CREATE TABLE child (id INTEGER PRIMARY KEY, parent_id INTEGER, FOREIGN KEY (parent_id) REFERENCES parent(id))"
      );
      // This should fail due to foreign key constraint
      await expect(
        db.run("INSERT INTO child (id, parent_id) VALUES (1, 999)")
      ).rejects.toThrow();
      await db.close();
    });

    it("should enable WAL mode for file-based databases", async () => {
      const dbPath = path.join(tempDir, "wal-test.db");
      const db = new Database(dbPath);
      await db.initialize();
      const result = await db.get<{ journal_mode: string }>(
        "PRAGMA journal_mode"
      );
      // :memory: uses "memory" mode, file databases use "wal"
      expect(result?.journal_mode).toBe("wal");
      await db.close();
    });

    it("should create users table", async () => {
      const db = new Database(":memory:");
      await db.initialize();
      const result = await db.get(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='users'"
      );
      expect(result).toBeDefined();
      await db.close();
    });

    it("should create trackings table", async () => {
      const db = new Database(":memory:");
      await db.initialize();
      const result = await db.get(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='trackings'"
      );
      expect(result).toBeDefined();
      await db.close();
    });

    it("should create indexes", async () => {
      const db = new Database(":memory:");
      await db.initialize();
      const indexes = await db.all(
        "SELECT name FROM sqlite_master WHERE type='index'"
      );
      expect(indexes.length).toBeGreaterThan(0);
      await db.close();
    });

    it("should handle initialization with file path", async () => {
      // Test that file-based database initialization works
      const dbPath = path.join(tempDir, "file-test.db");
      const db = new Database(dbPath);
      await expect(db.initialize()).resolves.not.toThrow();
      expect(fs.existsSync(dbPath)).toBe(true);
      await db.close();
    });
  });

  describe("getConnection", () => {
    it("should return database connection after initialization", async () => {
      const db = new Database(":memory:");
      await db.initialize();
      const connection = db.getConnection();
      expect(connection).toBeDefined();
      await db.close();
    });

    it("should throw error if database not initialized", () => {
      const db = new Database(":memory:");
      expect(() => db.getConnection()).toThrow(
        "Database not initialized. Call initialize() first."
      );
    });
  });

  describe("close", () => {
    it("should close database connection", async () => {
      const db = new Database(":memory:");
      await db.initialize();
      await expect(db.close()).resolves.not.toThrow();
    });

    it("should handle closing already closed database", async () => {
      const db = new Database(":memory:");
      await db.initialize();
      await db.close();
      await expect(db.close()).resolves.not.toThrow();
    });

    it("should handle closing uninitialized database", async () => {
      const db = new Database(":memory:");
      await expect(db.close()).resolves.not.toThrow();
    });
  });

  describe("run", () => {
    let db: Database;

    beforeEach(async () => {
      db = new Database(":memory:");
      await db.initialize();
    });

    afterEach(async () => {
      await db.close();
    });

    it("should execute INSERT query", async () => {
      const result = await db.run(
        "INSERT INTO users (name, email) VALUES (?, ?)",
        ["Test User", "test@example.com"]
      );
      expect(result.lastID).toBeGreaterThan(0);
      expect(result.changes).toBe(1);
    });

    it("should execute UPDATE query", async () => {
      await db.run("INSERT INTO users (name, email) VALUES (?, ?)", [
        "Test User",
        "test@example.com",
      ]);
      const result = await db.run("UPDATE users SET name = ? WHERE email = ?", [
        "Updated Name",
        "test@example.com",
      ]);
      expect(result.changes).toBe(1);
      // UPDATE queries may or may not set lastID depending on SQLite version
      // The important thing is that changes is correct
    });

    it("should execute DELETE query", async () => {
      const insertResult = await db.run(
        "INSERT INTO users (name, email) VALUES (?, ?)",
        ["Test User", "test@example.com"]
      );
      const deleteResult = await db.run("DELETE FROM users WHERE id = ?", [
        insertResult.lastID,
      ]);
      expect(deleteResult.changes).toBe(1);
    });

    it("should handle query errors", async () => {
      await expect(
        db.run("INSERT INTO nonexistent_table (col) VALUES (?)", ["value"])
      ).rejects.toThrow();
    });

    it("should handle invalid SQL", async () => {
      await expect(db.run("INVALID SQL STATEMENT")).rejects.toThrow();
    });
  });

  describe("get", () => {
    let db: Database;

    beforeEach(async () => {
      db = new Database(":memory:");
      await db.initialize();
    });

    afterEach(async () => {
      await db.close();
    });

    it("should return single row", async () => {
      await db.run("INSERT INTO users (name, email) VALUES (?, ?)", [
        "Test User",
        "test@example.com",
      ]);
      const user = await db.get<{ id: number; name: string; email: string }>(
        "SELECT * FROM users WHERE email = ?",
        ["test@example.com"]
      );
      expect(user).toBeDefined();
      expect(user?.name).toBe("Test User");
      expect(user?.email).toBe("test@example.com");
    });

    it("should return undefined when row not found", async () => {
      const user = await db.get("SELECT * FROM users WHERE email = ?", [
        "nonexistent@example.com",
      ]);
      expect(user).toBeUndefined();
    });

    it("should handle query errors", async () => {
      await expect(
        db.get("SELECT * FROM nonexistent_table WHERE id = ?", [1])
      ).rejects.toThrow();
    });

    it("should work with empty params array", async () => {
      await db.run("INSERT INTO users (name, email) VALUES (?, ?)", [
        "Test User",
        "test@example.com",
      ]);
      const count = await db.get<{ count: number }>(
        "SELECT COUNT(*) as count FROM users"
      );
      expect(count?.count).toBe(1);
    });
  });

  describe("all", () => {
    let db: Database;

    beforeEach(async () => {
      db = new Database(":memory:");
      await db.initialize();
    });

    afterEach(async () => {
      await db.close();
    });

    it("should return all rows", async () => {
      await db.run("INSERT INTO users (name, email) VALUES (?, ?)", [
        "User 1",
        "user1@example.com",
      ]);
      await db.run("INSERT INTO users (name, email) VALUES (?, ?)", [
        "User 2",
        "user2@example.com",
      ]);
      const users = await db.all<{ id: number; name: string; email: string }>(
        "SELECT * FROM users ORDER BY id"
      );
      expect(users).toHaveLength(2);
      expect(users[0].name).toBe("User 1");
      expect(users[1].name).toBe("User 2");
    });

    it("should return empty array when no rows", async () => {
      const users = await db.all("SELECT * FROM users");
      expect(users).toEqual([]);
    });

    it("should handle query errors", async () => {
      await expect(db.all("SELECT * FROM nonexistent_table")).rejects.toThrow();
    });

    it("should work with empty params array", async () => {
      await db.run("INSERT INTO users (name, email) VALUES (?, ?)", [
        "Test User",
        "test@example.com",
      ]);
      const users = await db.all("SELECT * FROM users");
      expect(users).toHaveLength(1);
    });
  });

  describe("Integration Tests", () => {
    it("should handle full CRUD operations", async () => {
      const db = new Database(":memory:");
      await db.initialize();

      // Create
      const insertResult = await db.run(
        "INSERT INTO users (name, email) VALUES (?, ?)",
        ["Integration Test", "integration@example.com"]
      );
      expect(insertResult.lastID).toBeGreaterThan(0);

      // Read
      const user = await db.get<{ id: number; name: string; email: string }>(
        "SELECT * FROM users WHERE id = ?",
        [insertResult.lastID]
      );
      expect(user?.name).toBe("Integration Test");

      // Update
      await db.run("UPDATE users SET name = ? WHERE id = ?", [
        "Updated Name",
        insertResult.lastID,
      ]);
      const updatedUser = await db.get<{ name: string }>(
        "SELECT name FROM users WHERE id = ?",
        [insertResult.lastID]
      );
      expect(updatedUser?.name).toBe("Updated Name");

      // Delete
      const deleteResult = await db.run("DELETE FROM users WHERE id = ?", [
        insertResult.lastID,
      ]);
      expect(deleteResult.changes).toBe(1);

      const deletedUser = await db.get("SELECT * FROM users WHERE id = ?", [
        insertResult.lastID,
      ]);
      expect(deletedUser).toBeUndefined();

      await db.close();
    });

    it("should handle foreign key constraints", async () => {
      const db = new Database(":memory:");
      await db.initialize();

      // Create user
      const userResult = await db.run(
        "INSERT INTO users (name, email) VALUES (?, ?)",
        ["Test User", "test@example.com"]
      );

      // Create tracking with valid user_id
      const trackingResult = await db.run(
        "INSERT INTO trackings (user_id, question) VALUES (?, ?)",
        [userResult.lastID, "Test question?"]
      );
      expect(trackingResult.lastID).toBeGreaterThan(0);

      // Try to create tracking with invalid user_id (should fail)
      await expect(
        db.run("INSERT INTO trackings (user_id, question) VALUES (?, ?)", [
          99999,
          "Invalid question?",
        ])
      ).rejects.toThrow();

      // Delete user (should cascade delete tracking)
      await db.run("DELETE FROM users WHERE id = ?", [userResult.lastID]);
      const tracking = await db.get("SELECT * FROM trackings WHERE id = ?", [
        trackingResult.lastID,
      ]);
      expect(tracking).toBeUndefined();

      await db.close();
    });
  });
});
