import { User } from '../User.js';

describe('User', () => {
  describe('validateName', () => {
    it('should return trimmed name for valid input', () => {
      expect(User.validateName('  John Doe  ')).toBe('John Doe');
      expect(User.validateName('Alice')).toBe('Alice');
    });

    it('should throw TypeError for non-string input', () => {
      expect(() => User.validateName(null as unknown as string)).toThrow(TypeError);
      expect(() => User.validateName(123 as unknown as string)).toThrow(TypeError);
      expect(() => User.validateName(undefined as unknown as string)).toThrow(TypeError);
    });

    it('should throw TypeError for empty string', () => {
      expect(() => User.validateName('')).toThrow(TypeError);
      expect(() => User.validateName('   ')).toThrow(TypeError);
    });

    it('should throw TypeError for name exceeding max length', () => {
      const longName = 'a'.repeat(User.MAX_NAME_LENGTH + 1);
      expect(() => User.validateName(longName)).toThrow(TypeError);
    });

    it('should accept name at max length', () => {
      const maxLengthName = 'a'.repeat(User.MAX_NAME_LENGTH);
      expect(User.validateName(maxLengthName)).toBe(maxLengthName);
    });

    it('should throw error message mentioning max length', () => {
      const longName = 'a'.repeat(User.MAX_NAME_LENGTH + 1);
      expect(() => User.validateName(longName)).toThrow(
        `User name must be smaller than ${User.MAX_NAME_LENGTH} characters`
      );
    });
  });

  describe('MAX_NAME_LENGTH', () => {
    it('should be 30', () => {
      expect(User.MAX_NAME_LENGTH).toBe(30);
    });
  });
});

