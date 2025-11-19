import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Get database path from environment variable or default location.
 * @returns The database file path
 * @private
 */
function getDatabasePath(): string {
  const dbPath = process.env.DB_PATH || path.join(__dirname, '../../data/habitus.db');
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
const db = new Database(getDatabasePath());

/**
 * Enable foreign keys and WAL mode for better performance and data integrity.
 * @private
 */
function configureDatabase(): void {
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');
}

/**
 * Initialize database schema.
 * Creates all necessary tables if they don't exist.
 * @public
 */
export function initializeDatabase(): void {
  configureDatabase();
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL CHECK(length(name) <= 30),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Create index for better query performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at)
  `);
}

/**
 * Get the database instance.
 * @returns The database connection
 * @public
 */
export function getDatabase(): Database.Database {
  return db;
}

/**
 * Close the database connection.
 * Should be called when shutting down the application.
 * @public
 */
export function closeDatabase(): void {
  db.close();
}

