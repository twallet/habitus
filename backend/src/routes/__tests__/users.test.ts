import request from 'supertest';
import express from 'express';
import Database from 'better-sqlite3';
import usersRouter from '../users.js';
import { getDatabase } from '../../db/database.js';

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

describe('Users Routes', () => {
  let app: express.Application;
  let testDb: Database.Database;

  beforeEach(() => {
    // Create a fresh in-memory database for each test
    testDb = createTestDatabase();
    // Mock getDatabase to return our test database
    jest.spyOn(require('../../db/database.js'), 'getDatabase').mockReturnValue(testDb);
    
    // Create Express app with routes
    app = express();
    app.use(express.json());
    app.use('/api/users', usersRouter);
  });

  afterEach(() => {
    testDb.close();
    jest.restoreAllMocks();
  });

  describe('GET /api/users', () => {
    it('should return empty array when no users exist', async () => {
      const response = await request(app).get('/api/users');
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('should return all users', async () => {
      // Insert test data
      testDb.prepare('INSERT INTO users (name) VALUES (?)').run('User 1');
      testDb.prepare('INSERT INTO users (name) VALUES (?)').run('User 2');
      
      const response = await request(app).get('/api/users');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(response.body[0].name).toBe('User 1');
      expect(response.body[1].name).toBe('User 2');
    });
  });

  describe('POST /api/users', () => {
    it('should create a new user', async () => {
      const response = await request(app)
        .post('/api/users')
        .send({ name: 'John Doe' });
      
      expect(response.status).toBe(201);
      expect(response.body.name).toBe('John Doe');
      expect(response.body.id).toBeGreaterThan(0);
      expect(response.body.created_at).toBeDefined();
    });

    it('should trim whitespace from name', async () => {
      const response = await request(app)
        .post('/api/users')
        .send({ name: '  Alice  ' });
      
      expect(response.status).toBe(201);
      expect(response.body.name).toBe('Alice');
    });

    it('should return 400 for missing name', async () => {
      const response = await request(app)
        .post('/api/users')
        .send({});
      
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('required');
    });

    it('should return 400 for non-string name', async () => {
      const response = await request(app)
        .post('/api/users')
        .send({ name: 123 });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('string');
    });

    it('should return 400 for empty name', async () => {
      const response = await request(app)
        .post('/api/users')
        .send({ name: '' });
      
      expect(response.status).toBe(400);
    });

    it('should return 400 for name exceeding max length', async () => {
      const longName = 'a'.repeat(31);
      const response = await request(app)
        .post('/api/users')
        .send({ name: longName });
      
      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/users/:id', () => {
    it('should return 404 for non-existent user', async () => {
      const response = await request(app).get('/api/users/999');
      
      expect(response.status).toBe(404);
      expect(response.body.error).toContain('not found');
    });

    it('should return user for existing id', async () => {
      const insertStmt = testDb.prepare('INSERT INTO users (name) VALUES (?)');
      const result = insertStmt.run('Test User');
      const insertedId = Number(result.lastInsertRowid);
      
      const response = await request(app).get(`/api/users/${insertedId}`);
      
      expect(response.status).toBe(200);
      expect(response.body.id).toBe(insertedId);
      expect(response.body.name).toBe('Test User');
    });

    it('should return 400 for invalid id', async () => {
      const response = await request(app).get('/api/users/invalid');
      
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid user ID');
    });
  });
});

