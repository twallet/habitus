import sqlite3 from "sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

/**
 * Get __dirname in a way that works in both ESM and Jest.
 * @returns The directory path
 * @private
 */
function getDirname(): string {
  // Check if we're in a test environment
  if (
    typeof process !== "undefined" &&
    (process.env.NODE_ENV === "test" || process.env.JEST_WORKER_ID)
  ) {
    return path.resolve();
  }

  try {
    // Use eval to avoid TypeScript/Jest parsing issues with import.meta
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const importMeta = new Function(
      'return typeof import !== "undefined" ? import.meta : null'
    )();
    if (importMeta && importMeta.url) {
      const __filename = fileURLToPath(importMeta.url);
      return path.dirname(__filename);
    }
  } catch {
    // Fallback if import.meta is not available
  }

  return path.resolve();
}

/**
 * Get database path from environment variable or default location.
 * @returns The database file path
 * @private
 */
function getDatabasePath(): string {
  const __dirname = getDirname();
  const dbPath =
    process.env.DB_PATH || path.join(__dirname, "../../data/habitus.db");
  const dbDir = path.dirname(dbPath);

  // Ensure data directory exists
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  return dbPath;
}

/**
 * Database connection instance.
 * Uses SQLite for data persistence.
 * @public
 */
let db: sqlite3.Database | null = null;

/**
 * Check if a table exists.
 * @param tableName - Name of the table
 * @returns Promise resolving to true if table exists, false otherwise
 * @private
 */
function tableExists(tableName: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error("Database not initialized"));
      return;
    }

    db.get(
      `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
      [tableName],
      (err, row: { name: string } | undefined) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(!!row);
      }
    );
  });
}

/**
 * Check if a column exists in a table.
 * @param tableName - Name of the table
 * @param columnName - Name of the column
 * @returns Promise resolving to true if column exists, false otherwise
 * @private
 */
function columnExists(tableName: string, columnName: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error("Database not initialized"));
      return;
    }

    db.all(
      `PRAGMA table_info(${tableName})`,
      [],
      (err, rows: Array<{ name: string }>) => {
        if (err) {
          // If table doesn't exist, return false
          resolve(false);
          return;
        }
        const exists = rows.some((row) => row.name === columnName);
        resolve(exists);
      }
    );
  });
}

/**
 * Migrate existing database schema to add email and password_hash columns.
 * @returns Promise that resolves when migration is complete
 * @private
 */
async function migrateDatabase(): Promise<void> {
  if (!db) {
    throw new Error("Database not initialized");
  }

  // Check if users table exists
  const usersTableExists = await tableExists("users");
  if (!usersTableExists) {
    // Table doesn't exist, no migration needed
    return;
  }

  // Check if email column exists
  const emailExists = await columnExists("users", "email");
  const passwordHashExists = await columnExists("users", "password_hash");

  // Add email column if it doesn't exist
  if (!emailExists) {
    await new Promise<void>((resolve, reject) => {
      db!.run(`ALTER TABLE users ADD COLUMN email TEXT`, (err) => {
        // Ignore error if column already exists (race condition)
        if (err && !err.message.includes("duplicate column")) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  // Add password_hash column if it doesn't exist
  if (!passwordHashExists) {
    await new Promise<void>((resolve, reject) => {
      db!.run(`ALTER TABLE users ADD COLUMN password_hash TEXT`, (err) => {
        // Ignore error if column already exists (race condition)
        if (err && !err.message.includes("duplicate column")) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  // Create unique index on email if it doesn't exist
  await new Promise<void>((resolve, reject) => {
    db!.run(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique ON users(email) WHERE email IS NOT NULL`,
      (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      }
    );
  });
}

/**
 * Initialize database schema.
 * Creates all necessary tables if they don't exist.
 * Migrates existing databases to add new columns.
 * @returns Promise that resolves when initialization is complete
 * @public
 */
export function initializeDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const dbPath = getDatabasePath();

    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        reject(err);
        return;
      }

      // Enable foreign keys and WAL mode
      db!.run("PRAGMA foreign_keys = ON", (err) => {
        if (err) {
          reject(err);
          return;
        }

        db!.run("PRAGMA journal_mode = WAL", (err) => {
          if (err) {
            reject(err);
            return;
          }

          // Create tables with new schema
          db!.exec(
            `
            CREATE TABLE IF NOT EXISTS users (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              name TEXT NOT NULL CHECK(length(name) <= 30),
              email TEXT,
              password_hash TEXT,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
            CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
          `,
            async (err) => {
              if (err) {
                reject(err);
                return;
              }

              try {
                // Migrate existing database if needed
                await migrateDatabase();
                resolve();
              } catch (migrationError) {
                reject(migrationError);
              }
            }
          );
        });
      });
    });
  });
}

/**
 * Get the database instance.
 * @returns The database connection
 * @throws Error if database is not initialized
 * @public
 */
export function getDatabase(): sqlite3.Database {
  if (!db) {
    throw new Error(
      "Database not initialized. Call initializeDatabase() first."
    );
  }
  return db;
}

/**
 * Close the database connection.
 * Should be called when shutting down the application.
 * @returns Promise that resolves when database is closed
 * @public
 */
export function closeDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!db) {
      resolve();
      return;
    }

    db.close((err) => {
      if (err) {
        reject(err);
      } else {
        db = null;
        resolve();
      }
    });
  });
}

/**
 * Promisified database methods for easier async/await usage.
 * @public
 */
export const dbPromises = {
  /**
   * Run a SQL query.
   * @param sql - SQL query string
   * @param params - Query parameters
   * @returns Promise resolving to the result object
   */
  run: (
    sql: string,
    params: any[] = []
  ): Promise<{ lastID: number; changes: number }> => {
    return new Promise((resolve, reject) => {
      const database = getDatabase();
      database.run(sql, params, function (err) {
        if (err) {
          reject(err);
        } else {
          resolve({ lastID: this.lastID, changes: this.changes });
        }
      });
    });
  },

  /**
   * Get a single row.
   * @param sql - SQL query string
   * @param params - Query parameters
   * @returns Promise resolving to the row or undefined
   */
  get: <T = any>(sql: string, params: any[] = []): Promise<T | undefined> => {
    return new Promise((resolve, reject) => {
      const database = getDatabase();
      database.get(sql, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row as T);
        }
      });
    });
  },

  /**
   * Get all rows.
   * @param sql - SQL query string
   * @param params - Query parameters
   * @returns Promise resolving to array of rows
   */
  all: <T = any>(sql: string, params: any[] = []): Promise<T[]> => {
    return new Promise((resolve, reject) => {
      const database = getDatabase();
      database.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows as T[]);
        }
      });
    });
  },
};
