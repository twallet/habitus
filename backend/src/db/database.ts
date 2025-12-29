import sqlite3 from "sqlite3";
import { Pool, Client } from "pg";
import path from "path";
import fs from "fs";
import { PathConfig } from "../config/paths.js";

/**
 * Database type enum.
 * @private
 */
enum DatabaseType {
  SQLITE = "sqlite",
  POSTGRESQL = "postgresql",
}

/**
 * Get database type based on environment variables.
 * Checks for DATABASE_URL (PostgreSQL) or falls back to SQLite.
 * @returns Database type
 * @private
 */
function getDatabaseType(): DatabaseType {
  if (process.env.DATABASE_URL) {
    return DatabaseType.POSTGRESQL;
  }
  return DatabaseType.SQLITE;
}

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
 * PostgreSQL schema creation SQL.
 * @private
 */
const POSTGRESQL_SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL CHECK(length(name) <= 30),
  email TEXT NOT NULL UNIQUE,
  profile_picture_url TEXT,
  magic_link_token TEXT,
  magic_link_expires TIMESTAMP,
  pending_email TEXT,
  email_verification_token TEXT,
  email_verification_expires TIMESTAMP,
  telegram_chat_id TEXT,
  notification_channels TEXT,
  locale TEXT DEFAULT 'es-AR',
  timezone TEXT,
  last_access TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_magic_link_token ON users(magic_link_token);
CREATE INDEX IF NOT EXISTS idx_users_email_verification_token ON users(email_verification_token);
CREATE TABLE IF NOT EXISTS trackings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  question TEXT NOT NULL CHECK(length(question) <= 100),
  notes TEXT,
  icon TEXT,
  frequency TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'Running' CHECK(state IN ('Running', 'Paused', 'Archived')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_trackings_user_id ON trackings(user_id);
CREATE INDEX IF NOT EXISTS idx_trackings_created_at ON trackings(created_at);
CREATE TABLE IF NOT EXISTS tracking_schedules (
  id SERIAL PRIMARY KEY,
  tracking_id INTEGER NOT NULL,
  hour INTEGER NOT NULL CHECK(hour >= 0 AND hour <= 23),
  minutes INTEGER NOT NULL CHECK(minutes >= 0 AND minutes <= 59),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tracking_id) REFERENCES trackings(id) ON DELETE CASCADE,
  UNIQUE(tracking_id, hour, minutes)
);
CREATE INDEX IF NOT EXISTS idx_tracking_schedules_tracking_id ON tracking_schedules(tracking_id);
CREATE TABLE IF NOT EXISTS reminders (
  id SERIAL PRIMARY KEY,
  tracking_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  scheduled_time TIMESTAMP NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'Pending' CHECK(status IN ('Pending', 'Answered', 'Upcoming')),
  value TEXT CHECK(value IN ('Completed', 'Dismissed') OR value IS NULL),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tracking_id) REFERENCES trackings(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CHECK(
    (status = 'Answered' AND value IS NOT NULL) OR
    (status != 'Answered' AND value IS NULL)
  )
);
CREATE INDEX IF NOT EXISTS idx_reminders_user_id ON reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_reminders_tracking_id ON reminders(tracking_id);
CREATE INDEX IF NOT EXISTS idx_reminders_scheduled_time ON reminders(scheduled_time);
CREATE INDEX IF NOT EXISTS idx_reminders_status ON reminders(status);
`;

/**
 * SQLite schema creation SQL.
 * @private
 */
const SQLITE_SCHEMA = `
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
  telegram_chat_id TEXT,
  notification_channels TEXT,
  locale TEXT DEFAULT 'es-AR',
  timezone TEXT,
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
  notes TEXT,
  icon TEXT,
  frequency TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'Running' CHECK(state IN ('Running', 'Paused', 'Archived')),
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
CREATE TABLE IF NOT EXISTS reminders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tracking_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  scheduled_time DATETIME NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'Pending' CHECK(status IN ('Pending', 'Answered', 'Upcoming')),
  value TEXT CHECK(value IN ('Completed', 'Dismissed') OR value IS NULL),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tracking_id) REFERENCES trackings(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CHECK(
    (status = 'Answered' AND value IS NOT NULL) OR
    (status != 'Answered' AND value IS NULL)
  )
);
CREATE INDEX IF NOT EXISTS idx_reminders_user_id ON reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_reminders_tracking_id ON reminders(tracking_id);
CREATE INDEX IF NOT EXISTS idx_reminders_scheduled_time ON reminders(scheduled_time);
CREATE INDEX IF NOT EXISTS idx_reminders_status ON reminders(status);
`;

/**
 * Convert SQLite placeholders (?) to PostgreSQL placeholders ($1, $2, etc.).
 * @param sql - SQL query string with SQLite placeholders
 * @returns SQL query string with PostgreSQL placeholders
 * @private
 */
function convertPlaceholdersToPostgreSQL(sql: string): string {
  let paramIndex = 1;
  return sql.replace(/\?/g, () => `$${paramIndex++}`);
}

/**
 * Database class for managing database connections and operations.
 * Supports both SQLite (development) and PostgreSQL (production).
 * Automatically detects database type based on DATABASE_URL environment variable.
 * @public
 */
export class Database {
  private db: sqlite3.Database | null = null;
  private pgPool: Pool | null = null;
  private dbPath: string;
  private dbType: DatabaseType;

  /**
   * Create a new Database instance.
   * @param customPath - Optional custom database path (for SQLite only)
   * @public
   */
  constructor(customPath?: string) {
    this.dbType = getDatabaseType();
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
    if (this.dbType === DatabaseType.POSTGRESQL) {
      return this.initializePostgreSQL();
    } else {
      return this.initializeSQLite();
    }
  }

  /**
   * Initialize PostgreSQL database.
   * @returns Promise that resolves when initialization is complete
   * @throws Error if initialization fails
   * @private
   */
  private async initializePostgreSQL(): Promise<void> {
    try {
      const databaseUrl = process.env.DATABASE_URL;
      if (!databaseUrl) {
        throw new Error(
          "DATABASE_URL environment variable is required for PostgreSQL"
        );
      }

      console.log(
        `[${new Date().toISOString()}] DATABASE | Initializing PostgreSQL database`
      );

      // Create connection pool
      this.pgPool = new Pool({
        connectionString: databaseUrl,
        ssl:
          process.env.NODE_ENV === "production"
            ? { rejectUnauthorized: false }
            : false,
      });

      // Test connection
      const client = await this.pgPool.connect();
      console.log(
        `[${new Date().toISOString()}] DATABASE | PostgreSQL connection opened successfully`
      );
      client.release();

      // Create schema
      console.log(
        `[${new Date().toISOString()}] DATABASE | Creating PostgreSQL schema...`
      );
      await this.pgPool.query(POSTGRESQL_SCHEMA);

      console.log(
        `[${new Date().toISOString()}] DATABASE | PostgreSQL schema created successfully`
      );
    } catch (error) {
      console.error(
        `[${new Date().toISOString()}] DATABASE | Failed to initialize PostgreSQL:`,
        error
      );
      throw error;
    }
  }

  /**
   * Initialize SQLite database.
   * @returns Promise that resolves when initialization is complete
   * @throws Error if initialization fails
   * @private
   */
  private async initializeSQLite(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log(
        `[${new Date().toISOString()}] DATABASE | Initializing SQLite database at: ${
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
            this.db!.exec(SQLITE_SCHEMA, (err) => {
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
            });
          });
        });
      });
    });
  }

  /**
   * Get the database connection instance.
   * For SQLite, returns the sqlite3.Database instance.
   * For PostgreSQL, throws an error (use query methods directly).
   * @returns The database connection (SQLite only)
   * @throws Error if database is not initialized or if using PostgreSQL
   * @public
   */
  getConnection(): sqlite3.Database {
    if (this.dbType === DatabaseType.POSTGRESQL) {
      throw new Error(
        "getConnection() is not available for PostgreSQL. Use run(), get(), or all() methods instead."
      );
    }
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
    if (this.dbType === DatabaseType.POSTGRESQL) {
      if (this.pgPool) {
        console.log(
          `[${new Date().toISOString()}] DATABASE | Closing PostgreSQL connection pool...`
        );
        await this.pgPool.end();
        this.pgPool = null;
        console.log(
          `[${new Date().toISOString()}] DATABASE | PostgreSQL connection pool closed successfully`
        );
      }
      return;
    }

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
   * Run a SQL query (INSERT, UPDATE, DELETE).
   * @param sql - SQL query string
   * @param params - Query parameters
   * @returns Promise resolving to the result object with lastID and changes
   * @public
   */
  async run(
    sql: string,
    params: any[] = []
  ): Promise<{ lastID: number; changes: number }> {
    if (this.dbType === DatabaseType.POSTGRESQL) {
      return this.runPostgreSQL(sql, params);
    } else {
      return this.runSQLite(sql, params);
    }
  }

  /**
   * Run a SQL query on PostgreSQL.
   * Automatically adds RETURNING id to INSERT statements if not present.
   * @param sql - SQL query string
   * @param params - Query parameters
   * @returns Promise resolving to the result object
   * @private
   */
  private async runPostgreSQL(
    sql: string,
    params: any[] = []
  ): Promise<{ lastID: number; changes: number }> {
    if (!this.pgPool) {
      throw new Error("Database not initialized. Call initialize() first.");
    }

    try {
      const sqlUpper = sql.toUpperCase().trim();
      const isInsert = sqlUpper.startsWith("INSERT");
      const hasReturning = sqlUpper.includes("RETURNING");

      // Convert SQLite placeholders (?) to PostgreSQL placeholders ($1, $2, etc.)
      let convertedSql = convertPlaceholdersToPostgreSQL(sql);

      // For INSERT statements, automatically add RETURNING id if not present
      let finalSql = convertedSql;
      if (isInsert && !hasReturning) {
        // Add RETURNING id before any semicolon or at the end
        if (convertedSql.trim().endsWith(";")) {
          finalSql = convertedSql.trim().slice(0, -1) + " RETURNING id;";
        } else {
          finalSql = convertedSql.trim() + " RETURNING id";
        }
      }

      // Execute query
      const result = await this.pgPool.query(finalSql, params);

      // For INSERT with RETURNING, extract the ID
      if (isInsert && (hasReturning || finalSql.includes("RETURNING"))) {
        const lastID = result.rows[0]?.id || 0;
        console.log(
          `[${new Date().toISOString()}] DATABASE | Query executed successfully, changes: ${
            result.rowCount
          }, lastID: ${lastID}`
        );
        return { lastID, changes: result.rowCount || 0 };
      }

      // For other queries, execute and return result
      console.log(
        `[${new Date().toISOString()}] DATABASE | Query executed successfully, changes: ${
          result.rowCount
        }`
      );
      return { lastID: 0, changes: result.rowCount || 0 };
    } catch (error) {
      console.error(
        `[${new Date().toISOString()}] DATABASE | Query execution failed:`,
        sql.substring(0, 100),
        error
      );
      throw error;
    }
  }

  /**
   * Run a SQL query on SQLite.
   * @param sql - SQL query string
   * @param params - Query parameters
   * @returns Promise resolving to the result object
   * @private
   */
  private async runSQLite(
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
    if (this.dbType === DatabaseType.POSTGRESQL) {
      return this.getPostgreSQL<T>(sql, params);
    } else {
      return this.getSQLite<T>(sql, params);
    }
  }

  /**
   * Get a single row from PostgreSQL.
   * @param sql - SQL query string
   * @param params - Query parameters
   * @returns Promise resolving to the row or undefined
   * @private
   */
  private async getPostgreSQL<T = any>(
    sql: string,
    params: any[] = []
  ): Promise<T | undefined> {
    if (!this.pgPool) {
      throw new Error("Database not initialized. Call initialize() first.");
    }

    try {
      // Convert SQLite placeholders (?) to PostgreSQL placeholders ($1, $2, etc.)
      const convertedSql = convertPlaceholdersToPostgreSQL(sql);
      const result = await this.pgPool.query(convertedSql, params);
      const found = result.rows.length > 0 ? "found" : "not found";
      console.log(
        `[${new Date().toISOString()}] DATABASE | Query executed successfully, row ${found}`
      );
      return result.rows[0] as T | undefined;
    } catch (error) {
      console.error(
        `[${new Date().toISOString()}] DATABASE | Query execution failed:`,
        sql.substring(0, 100),
        error
      );
      throw error;
    }
  }

  /**
   * Get a single row from SQLite.
   * @param sql - SQL query string
   * @param params - Query parameters
   * @returns Promise resolving to the row or undefined
   * @private
   */
  private async getSQLite<T = any>(
    sql: string,
    params: any[] = []
  ): Promise<T | undefined> {
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
    if (this.dbType === DatabaseType.POSTGRESQL) {
      return this.allPostgreSQL<T>(sql, params);
    } else {
      return this.allSQLite<T>(sql, params);
    }
  }

  /**
   * Get all rows from PostgreSQL.
   * @param sql - SQL query string
   * @param params - Query parameters
   * @returns Promise resolving to array of rows
   * @private
   */
  private async allPostgreSQL<T = any>(
    sql: string,
    params: any[] = []
  ): Promise<T[]> {
    if (!this.pgPool) {
      throw new Error("Database not initialized. Call initialize() first.");
    }

    try {
      // Convert SQLite placeholders (?) to PostgreSQL placeholders ($1, $2, etc.)
      const convertedSql = convertPlaceholdersToPostgreSQL(sql);
      const result = await this.pgPool.query(convertedSql, params);
      console.log(
        `[${new Date().toISOString()}] DATABASE | Query executed successfully, returned ${
          result.rows.length
        } rows`
      );
      return result.rows as T[];
    } catch (error) {
      console.error(
        `[${new Date().toISOString()}] DATABASE | Query execution failed:`,
        sql.substring(0, 100),
        error
      );
      throw error;
    }
  }

  /**
   * Get all rows from SQLite.
   * @param sql - SQL query string
   * @param params - Query parameters
   * @returns Promise resolving to array of rows
   * @private
   */
  private async allSQLite<T = any>(
    sql: string,
    params: any[] = []
  ): Promise<T[]> {
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
