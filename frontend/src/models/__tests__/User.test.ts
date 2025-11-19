import { User } from '../User';

describe('User', () => {
  describe('constructor', () => {
    it('should validate a user with valid name', () => {
      expect(() => {
        new User('John Doe');
      }).not.toThrow();
    });

    it('should trim whitespace from name during validation', () => {
      const trimmedName = User.validateName('  Jane Smith  ');
      expect(trimmedName).toBe('Jane Smith');
    });
  });

  describe('validateName', () => {
    it('should throw TypeError if name is not a string', () => {
      expect(() => {
        // @ts-expect-error Testing invalid input
        User.validateName(123);
      }).toThrow(TypeError);
      expect(() => {
        // @ts-expect-error Testing invalid input
        User.validateName(null);
      }).toThrow(TypeError);
      expect(() => {
        // @ts-expect-error Testing invalid input
        User.validateName(undefined);
      }).toThrow(TypeError);
    });

    it('should throw TypeError if name is empty after trim', () => {
      expect(() => User.validateName('')).toThrow(TypeError);
      expect(() => User.validateName('   ')).toThrow(TypeError);
      expect(() => User.validateName('\t\n')).toThrow(TypeError);
    });

    it('should throw TypeError if name exceeds MAX_NAME_LENGTH', () => {
      const longName = 'a'.repeat(User.MAX_NAME_LENGTH + 1);
      expect(() => User.validateName(longName)).toThrow(TypeError);
      expect(() => User.validateName(longName)).toThrow(
        `User name must be smaller than ${User.MAX_NAME_LENGTH} characters`
      );
    });

    it('should accept name with exactly MAX_NAME_LENGTH characters', () => {
      const maxLengthName = 'a'.repeat(User.MAX_NAME_LENGTH);
      const validatedName = User.validateName(maxLengthName);
      expect(validatedName).toBe(maxLengthName);
    });
  });

  describe('MAX_NAME_LENGTH', () => {
    it('should be 30', () => {
      expect(User.MAX_NAME_LENGTH).toBe(30);
    });
  });
});

