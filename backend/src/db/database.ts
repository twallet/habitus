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
 * Initialize database schema.
 * Creates all necessary tables if they don't exist.
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

          // Create tables
          db!.exec(
            `
            CREATE TABLE IF NOT EXISTS users (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              name TEXT NOT NULL CHECK(length(name) <= 30),
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
          `,
            (err) => {
              if (err) {
                reject(err);
              } else {
                resolve();
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
