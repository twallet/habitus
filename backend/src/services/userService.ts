import { dbPromises } from '../db/database.js';
import { User, UserData } from '../models/User.js';

/**
 * Service for user-related database operations.
 * @public
 */
export class UserService {
  /**
   * Get all users from the database.
   * @returns Promise resolving to array of user data
   * @public
   */
  static async getAllUsers(): Promise<UserData[]> {
    const rows = await dbPromises.all<{ id: number; name: string; created_at: string }>(
      'SELECT id, name, created_at FROM users ORDER BY id'
    );
    
    return rows.map(row => ({
      id: row.id,
      name: row.name,
      created_at: row.created_at,
    }));
  }

  /**
   * Create a new user in the database.
   * @param name - The user's name (will be validated and trimmed)
   * @returns Promise resolving to the created user data
   * @throws {@link TypeError} If the name is invalid
   * @public
   */
  static async createUser(name: string): Promise<UserData> {
    const validatedName = User.validateName(name);
    
    const result = await dbPromises.run(
      'INSERT INTO users (name) VALUES (?)',
      [validatedName]
    );
    
    const row = await dbPromises.get<{ id: number; name: string; created_at: string }>(
      'SELECT id, name, created_at FROM users WHERE id = ?',
      [result.lastID]
    );
    
    if (!row) {
      throw new Error('Failed to retrieve created user');
    }
    
    return {
      id: row.id,
      name: row.name,
      created_at: row.created_at,
    };
  }

  /**
   * Get a user by ID.
   * @param id - The user ID
   * @returns Promise resolving to user data or null if not found
   * @public
   */
  static async getUserById(id: number): Promise<UserData | null> {
    const row = await dbPromises.get<{ id: number; name: string; created_at: string }>(
      'SELECT id, name, created_at FROM users WHERE id = ?',
      [id]
    );
    
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

