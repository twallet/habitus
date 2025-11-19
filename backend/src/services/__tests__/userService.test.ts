import Database from 'better-sqlite3';
import { UserService } from '../userService.js';
import { initializeDatabase, getDatabase, closeDatabase } from '../../db/database.js';

/**
 * Create an in-memory database for testing.
 * @returns Database instance
 */
function createTestDatabase(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL CHECK(length(name) <= 30),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  return db;
}

describe('UserService', () => {
  let testDb: Database.Database;
  
  beforeEach(() => {
    // Create a fresh in-memory database for each test
    testDb = createTestDatabase();
    // Mock getDatabase to return our test database
    jest.spyOn(require('../../db/database.js'), 'getDatabase').mockReturnValue(testDb);
  });

  afterEach(() => {
    testDb.close();
    jest.restoreAllMocks();
  });

  describe('getAllUsers', () => {
    it('should return empty array when no users exist', () => {
      const users = UserService.getAllUsers();
      expect(users).toEqual([]);
    });

    it('should return all users ordered by id', () => {
      // Insert test data
      testDb.prepare('INSERT INTO users (name) VALUES (?)').run('User 1');
      testDb.prepare('INSERT INTO users (name) VALUES (?)').run('User 2');
      
      const users = UserService.getAllUsers();
      
      expect(users).toHaveLength(2);
      expect(users[0].name).toBe('User 1');
      expect(users[1].name).toBe('User 2');
      expect(users[0].id).toBeLessThan(users[1].id);
    });

    it('should return users with correct structure', () => {
      testDb.prepare('INSERT INTO users (name) VALUES (?)').run('Test User');
      
      const users = UserService.getAllUsers();
      
      expect(users[0]).toHaveProperty('id');
      expect(users[0]).toHaveProperty('name');
      expect(users[0]).toHaveProperty('created_at');
      expect(typeof users[0].id).toBe('number');
      expect(typeof users[0].name).toBe('string');
      expect(typeof users[0].created_at).toBe('string');
    });
  });

  describe('createUser', () => {
    it('should create a new user with valid name', () => {
      const user = UserService.createUser('John Doe');
      
      expect(user.name).toBe('John Doe');
      expect(user.id).toBeGreaterThan(0);
      expect(user.created_at).toBeDefined();
    });

    it('should trim whitespace from name', () => {
      const user = UserService.createUser('  Alice  ');
      
      expect(user.name).toBe('Alice');
    });

    it('should throw TypeError for invalid name', () => {
      expect(() => UserService.createUser('')).toThrow(TypeError);
      expect(() => UserService.createUser('   ')).toThrow(TypeError);
    });

    it('should throw TypeError for name exceeding max length', () => {
      const longName = 'a'.repeat(31);
      expect(() => UserService.createUser(longName)).toThrow(TypeError);
    });

    it('should persist user to database', () => {
      const user = UserService.createUser('Test User');
      
      const stmt = testDb.prepare('SELECT * FROM users WHERE id = ?');
      const row = stmt.get(user.id) as { id: number; name: string } | undefined;
      
      expect(row).toBeDefined();
      expect(row?.name).toBe('Test User');
    });
  });

  describe('getUserById', () => {
    it('should return null for non-existent user', () => {
      const user = UserService.getUserById(999);
      expect(user).toBeNull();
    });

    it('should return user for existing id', () => {
      const insertStmt = testDb.prepare('INSERT INTO users (name) VALUES (?)');
      const result = insertStmt.run('Test User');
      const insertedId = Number(result.lastInsertRowid);
      
      const user = UserService.getUserById(insertedId);
      
      expect(user).not.toBeNull();
      expect(user?.id).toBe(insertedId);
      expect(user?.name).toBe('Test User');
    });

    it('should return user with correct structure', () => {
      const insertStmt = testDb.prepare('INSERT INTO users (name) VALUES (?)');
      const result = insertStmt.run('Test User');
      const insertedId = Number(result.lastInsertRowid);
      
      const user = UserService.getUserById(insertedId);
      
      expect(user).toHaveProperty('id');
      expect(user).toHaveProperty('name');
      expect(user).toHaveProperty('created_at');
      expect(typeof user?.id).toBe('number');
      expect(typeof user?.name).toBe('string');
      expect(typeof user?.created_at).toBe('string');
    });
  });
});

