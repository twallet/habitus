import { User } from '../User';

describe('User', () => {
  beforeEach(() => {
    // Reset the static nextId counter before each test
    User.initializeNextId(0);
  });

  describe('constructor', () => {
    it('should create a user with valid name', () => {
      const user = new User('John Doe');
      expect(user.name).toBe('John Doe');
      expect(user.id).toBe(1);
    });

    it('should trim whitespace from name', () => {
      const user = new User('  Jane Smith  ');
      expect(user.name).toBe('Jane Smith');
    });

    it('should assign sequential IDs', () => {
      const user1 = new User('User 1');
      const user2 = new User('User 2');
      const user3 = new User('User 3');

      expect(user1.id).toBe(1);
      expect(user2.id).toBe(2);
      expect(user3.id).toBe(3);
    });
  });

  describe('validation', () => {
    it('should throw TypeError if name is not a string', () => {
      expect(() => {
        // @ts-expect-error Testing invalid input
        new User(123);
      }).toThrow(TypeError);
      expect(() => {
        // @ts-expect-error Testing invalid input
        new User(null);
      }).toThrow(TypeError);
      expect(() => {
        // @ts-expect-error Testing invalid input
        new User(undefined);
      }).toThrow(TypeError);
    });

    it('should throw TypeError if name is empty after trim', () => {
      expect(() => new User('')).toThrow(TypeError);
      expect(() => new User('   ')).toThrow(TypeError);
      expect(() => new User('\t\n')).toThrow(TypeError);
    });

    it('should throw TypeError if name exceeds MAX_NAME_LENGTH', () => {
      const longName = 'a'.repeat(User.MAX_NAME_LENGTH + 1);
      expect(() => new User(longName)).toThrow(TypeError);
      expect(() => new User(longName)).toThrow(
        `User name must be smaller than ${User.MAX_NAME_LENGTH} characters`
      );
    });

    it('should accept name with exactly MAX_NAME_LENGTH characters', () => {
      const maxLengthName = 'a'.repeat(User.MAX_NAME_LENGTH);
      const user = new User(maxLengthName);
      expect(user.name).toBe(maxLengthName);
    });
  });

  describe('MAX_NAME_LENGTH', () => {
    it('should be 30', () => {
      expect(User.MAX_NAME_LENGTH).toBe(30);
    });
  });

  describe('initializeNextId', () => {
    it('should initialize nextId to maxId + 1', () => {
      User.initializeNextId(5);
      const user = new User('Test User');
      expect(user.id).toBe(6);
    });

    it('should not change nextId if maxId is negative', () => {
      User.initializeNextId(0);
      const user1 = new User('User 1');
      expect(user1.id).toBe(1);

      User.initializeNextId(-1);
      const user2 = new User('User 2');
      expect(user2.id).toBe(2); // Should continue from previous value
    });

    it('should handle zero maxId', () => {
      User.initializeNextId(0);
      const user = new User('Test User');
      expect(user.id).toBe(1);
    });
  });

  describe('getters', () => {
    it('should return correct id', () => {
      const user = new User('Test User');
      expect(user.id).toBeGreaterThan(0);
      expect(typeof user.id).toBe('number');
    });

    it('should return correct name', () => {
      const userName = 'Test User Name';
      const user = new User(userName);
      expect(user.name).toBe(userName);
      expect(typeof user.name).toBe('string');
    });
  });
});

