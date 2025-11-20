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
 * Creates all necessary tables with clean schema.
 * @returns Promise that resolves when initialization is complete
 * @public
 */
export function initializeDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const dbPath = getDatabasePath();
    console.log(
      `[${new Date().toISOString()}] DATABASE | Initializing database at: ${dbPath}`
    );

    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error(
          `[${new Date().toISOString()}] DATABASE | Failed to open database:`,
          err
        );
        reject(err);
        return;
      }

      console.log(
        `[${new Date().toISOString()}] DATABASE | Database connection opened successfully`
      );

      // Enable foreign keys and WAL mode
      db!.run("PRAGMA foreign_keys = ON", (err) => {
        if (err) {
          console.error(
            `[${new Date().toISOString()}] DATABASE | Failed to enable foreign keys:`,
            err
          );
          reject(err);
          return;
        }

        console.log(
          `[${new Date().toISOString()}] DATABASE | Foreign keys enabled`
        );

        db!.run("PRAGMA journal_mode = WAL", (err) => {
          if (err) {
            console.error(
              `[${new Date().toISOString()}] DATABASE | Failed to enable WAL mode:`,
              err
            );
            reject(err);
            return;
          }

          console.log(
            `[${new Date().toISOString()}] DATABASE | WAL mode enabled`
          );

          // Create tables with new schema
          console.log(
            `[${new Date().toISOString()}] DATABASE | Creating database schema...`
          );
          db!.exec(
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
                console.error(
                  `[${new Date().toISOString()}] DATABASE | Failed to create schema:`,
                  err
                );
                reject(err);
                return;
              }
              console.log(
                `[${new Date().toISOString()}] DATABASE | Database schema created successfully`
              );
              resolve();
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
      console.log(
        `[${new Date().toISOString()}] DATABASE | Database already closed or not initialized`
      );
      resolve();
      return;
    }

    console.log(
      `[${new Date().toISOString()}] DATABASE | Closing database connection...`
    );
    db.close((err) => {
      if (err) {
        console.error(
          `[${new Date().toISOString()}] DATABASE | Error closing database:`,
          err
        );
        reject(err);
      } else {
        db = null;
        console.log(
          `[${new Date().toISOString()}] DATABASE | Database connection closed successfully`
        );
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
          console.error(
            `[${new Date().toISOString()}] DATABASE | Query execution failed:`,
            sql.substring(0, 100),
            err
          );
          reject(err);
        } else {
          console.log(
            `[${new Date().toISOString()}] DATABASE | Query executed successfully, changes: ${
              this.changes
            }, lastID: ${this.lastID}`
          );
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
          console.error(
            `[${new Date().toISOString()}] DATABASE | Query execution failed:`,
            sql.substring(0, 100),
            err
          );
          reject(err);
        } else {
          const found = row ? "found" : "not found";
          console.log(
            `[${new Date().toISOString()}] DATABASE | Query executed successfully, row ${found}`
          );
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
          console.error(
            `[${new Date().toISOString()}] DATABASE | Query execution failed:`,
            sql.substring(0, 100),
            err
          );
          reject(err);
        } else {
          console.log(
            `[${new Date().toISOString()}] DATABASE | Query executed successfully, returned ${
              rows.length
            } rows`
          );
          resolve(rows as T[]);
        }
      });
    });
  },
};
