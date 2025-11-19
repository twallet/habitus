import { getDatabase } from '../db/database.js';
import { User, UserData } from '../models/User.js';

/**
 * Service for user-related database operations.
 * @public
 */
export class UserService {
  /**
   * Get all users from the database.
   * @returns Array of user data
   * @public
   */
  static getAllUsers(): UserData[] {
    const db = getDatabase();
    const stmt = db.prepare('SELECT id, name, created_at FROM users ORDER BY id');
    const rows = stmt.all() as Array<{ id: number; name: string; created_at: string }>;
    
    return rows.map(row => ({
      id: row.id,
      name: row.name,
      created_at: row.created_at,
    }));
  }

  /**
   * Create a new user in the database.
   * @param name - The user's name (will be validated and trimmed)
   * @returns The created user data
   * @throws {@link TypeError} If the name is invalid
   * @public
   */
  static createUser(name: string): UserData {
    const validatedName = User.validateName(name);
    const db = getDatabase();
    
    const stmt = db.prepare('INSERT INTO users (name) VALUES (?)');
    const result = stmt.run(validatedName);
    
    const selectStmt = db.prepare('SELECT id, name, created_at FROM users WHERE id = ?');
    const row = selectStmt.get(result.lastInsertRowid) as { id: number; name: string; created_at: string };
    
    return {
      id: row.id,
      name: row.name,
      created_at: row.created_at,
    };
  }

  /**
   * Get a user by ID.
   * @param id - The user ID
   * @returns User data or null if not found
   * @public
   */
  static getUserById(id: number): UserData | null {
    const db = getDatabase();
    const stmt = db.prepare('SELECT id, name, created_at FROM users WHERE id = ?');
    const row = stmt.get(id) as { id: number; name: string; created_at: string } | undefined;
    
    if (!row) {
      return null;
    }
    
    return {
      id: row.id,
      name: row.name,
      created_at: row.created_at,
    };
  }
}

