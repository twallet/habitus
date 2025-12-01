import sqlite3 from "sqlite3";
import path from "path";
import fs from "fs";
import { PathConfig } from "../config/paths.js";

/**
 * Get database path from environment variable or default location.
 * DB_PATH environment variable is the single source of truth.
 * If DB_PATH is not set, defaults to backend/data/habitus.db relative to workspace root.
 * @param customPath - Optional custom database path (overrides DB_PATH)
 * @returns The database file path
 * @private
 */
function getDatabasePath(customPath?: string): string {
  // Handle SQLite special identifiers (e.g., :memory:)
  if (
    customPath &&
    (customPath === ":memory:" || customPath.startsWith("file:"))
  ) {
    return customPath;
  }

  let dbPath: string;

  // Priority 1: Custom path (for testing or explicit override)
  if (customPath) {
    dbPath = path.isAbsolute(customPath)
      ? customPath
      : path.resolve(PathConfig.getBackendRoot(), customPath);
  }
  // Priority 2: DB_PATH environment variable (single source of truth)
  else if (process.env.DB_PATH) {
    if (path.isAbsolute(process.env.DB_PATH)) {
      dbPath = process.env.DB_PATH;
    } else {
      // For relative paths, resolve relative to backend directory
      // This ensures consistent behavior regardless of where the code runs from
      dbPath = path.resolve(PathConfig.getBackendRoot(), process.env.DB_PATH);
    }
  }
  // Priority 3: Default path (backend/data/habitus.db relative to workspace root)
  else {
    dbPath = path.join(PathConfig.getPaths().backendData, "habitus.db");
  }

  // Only create directory for file-based databases (not :memory: or file: URIs)
  if (!dbPath.startsWith(":") && !dbPath.startsWith("file:")) {
    const dbDir = path.dirname(dbPath);
    // Ensure data directory exists
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
  }

  return dbPath;
}

/**
 * Database class for managing SQLite database connections and operations.
 * Encapsulates database connection state and provides instance methods for database operations.
 * @public
 */
export class Database {
  private db: sqlite3.Database | null = null;
  private dbPath: string;

  /**
   * Create a new Database instance.
   * @param customPath - Optional custom database path
   * @public
   */
  constructor(customPath?: string) {
    this.dbPath = getDatabasePath(customPath);
  }

  /**
   * Initialize database schema.
   * Creates all necessary tables with clean schema.
   * @returns Promise that resolves when initialization is complete
   * @throws Error if initialization fails
   * @public
   */
  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log(
        `[${new Date().toISOString()}] DATABASE | Initializing database at: ${
          this.dbPath
        }`
      );

      this.db = new sqlite3.Database(this.dbPath, (err) => {
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
        this.db!.run("PRAGMA foreign_keys = ON", (err) => {
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

          this.db!.run("PRAGMA journal_mode = WAL", (err) => {
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

            // Create tables with complete schema
            console.log(
              `[${new Date().toISOString()}] DATABASE | Creating database schema...`
            );
            this.db!.exec(
              `
            CREATE TABLE IF NOT EXISTS users (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              name TEXT NOT NULL CHECK(length(name) <= 30),
              email TEXT NOT NULL UNIQUE,
              profile_picture_url TEXT,
              magic_link_token TEXT,
              magic_link_expires DATETIME,
              pending_email TEXT,
              email_verification_token TEXT,
              email_verification_expires DATETIME,
              last_access DATETIME,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
            CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
            CREATE INDEX IF NOT EXISTS idx_users_magic_link_token ON users(magic_link_token);
            CREATE INDEX IF NOT EXISTS idx_users_email_verification_token ON users(email_verification_token);
            CREATE TABLE IF NOT EXISTS trackings (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id INTEGER NOT NULL,
              question TEXT NOT NULL CHECK(length(question) <= 100),
              type TEXT NOT NULL CHECK(type IN ('true_false', 'register')),
              notes TEXT,
              icon TEXT,
              days TEXT,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_trackings_user_id ON trackings(user_id);
            CREATE INDEX IF NOT EXISTS idx_trackings_created_at ON trackings(created_at);
            CREATE TABLE IF NOT EXISTS tracking_schedules (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              tracking_id INTEGER NOT NULL,
              hour INTEGER NOT NULL CHECK(hour >= 0 AND hour <= 23),
              minutes INTEGER NOT NULL CHECK(minutes >= 0 AND minutes <= 59),
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (tracking_id) REFERENCES trackings(id) ON DELETE CASCADE,
              UNIQUE(tracking_id, hour, minutes)
            );
            CREATE INDEX IF NOT EXISTS idx_tracking_schedules_tracking_id ON tracking_schedules(tracking_id);
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

                // Migrate: Add days column to trackings table if it doesn't exist
                this.db!.run(
                  `ALTER TABLE trackings ADD COLUMN days TEXT`,
                  (migrationErr) => {
                    // Ignore error if column already exists
                    if (
                      migrationErr &&
                      !migrationErr.message.includes("duplicate column name")
                    ) {
                      console.error(
                        `[${new Date().toISOString()}] DATABASE | Failed to add days column:`,
                        migrationErr
                      );
                    } else if (!migrationErr) {
                      console.log(
                        `[${new Date().toISOString()}] DATABASE | Added days column to trackings table`
                      );
                    }
                    resolve();
                  }
                );
              }
            );
          });
        });
      });
    });
  }

  /**
   * Get the database connection instance.
   * @returns The database connection
   * @throws Error if database is not initialized
   * @public
   */
  getConnection(): sqlite3.Database {
    if (!this.db) {
      throw new Error("Database not initialized. Call initialize() first.");
    }
    return this.db;
  }

  /**
   * Close the database connection.
   * Should be called when shutting down the application.
   * @returns Promise that resolves when database is closed
   * @public
   */
  async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        console.log(
          `[${new Date().toISOString()}] DATABASE | Database already closed or not initialized`
        );
        resolve();
        return;
      }

      console.log(
        `[${new Date().toISOString()}] DATABASE | Closing database connection...`
      );
      this.db.close((err) => {
        if (err) {
          console.error(
            `[${new Date().toISOString()}] DATABASE | Error closing database:`,
            err
          );
          reject(err);
        } else {
          this.db = null;
          console.log(
            `[${new Date().toISOString()}] DATABASE | Database connection closed successfully`
          );
          resolve();
        }
      });
    });
  }

  /**
   * Run a SQL query.
   * @param sql - SQL query string
   * @param params - Query parameters
   * @returns Promise resolving to the result object
   * @public
   */
  async run(
    sql: string,
    params: any[] = []
  ): Promise<{ lastID: number; changes: number }> {
    return new Promise((resolve, reject) => {
      const database = this.getConnection();
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
  }

  /**
   * Get a single row.
   * @param sql - SQL query string
   * @param params - Query parameters
   * @returns Promise resolving to the row or undefined
   * @public
   */
  async get<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
      const database = this.getConnection();
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
  }

  /**
   * Get all rows.
   * @param sql - SQL query string
   * @param params - Query parameters
   * @returns Promise resolving to array of rows
   * @public
   */
  async all<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    return new Promise((resolve, reject) => {
      const database = this.getConnection();
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
  }
}
