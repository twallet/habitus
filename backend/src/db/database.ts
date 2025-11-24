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
 * @param customPath - Optional custom database path
 * @returns The database file path
 * @private
 */
function getDatabasePath(customPath?: string): string {
  const __dirname = getDirname();
  const dbPath =
    customPath ||
    process.env.DB_PATH ||
    path.join(__dirname, "../../data/habitus.db");
  const dbDir = path.dirname(dbPath);

  // Ensure data directory exists
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
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

            // Create tables with new schema
            console.log(
              `[${new Date().toISOString()}] DATABASE | Creating database schema...`
            );
            this.db!.exec(
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
            CREATE TABLE IF NOT EXISTS trackings (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id INTEGER NOT NULL,
              question TEXT NOT NULL CHECK(length(question) <= 500),
              type TEXT NOT NULL CHECK(type IN ('true_false', 'register')),
              start_tracking_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
              notes TEXT,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_trackings_user_id ON trackings(user_id);
            CREATE INDEX IF NOT EXISTS idx_trackings_start_tracking_date ON trackings(start_tracking_date);
            CREATE INDEX IF NOT EXISTS idx_trackings_created_at ON trackings(created_at);
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
