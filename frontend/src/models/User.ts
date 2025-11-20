/**
 * User model class for validation purposes.
 * IDs are now managed by the database.
 * @public
 */
export class User {
  /**
   * Maximum allowed length for user names.
   * @public
   */
  static readonly MAX_NAME_LENGTH: number = 30;

  /**
   * Validates a user name according to the rules:
   * - Must be a string
   * - Must not be empty after trimming
   * - Must not exceed MAX_NAME_LENGTH characters
   * @param name - The name to validate
   * @returns The trimmed and validated name
   * @throws {@link TypeError} If the name is invalid
   * @public
   */
  static validateName(name: string): string {
    if (typeof name !== "string") {
      throw new TypeError("User name must be a string");
    }

    if (name.length > User.MAX_NAME_LENGTH) {
      throw new TypeError(
        `User name must be smaller than ${User.MAX_NAME_LENGTH} characters`
      );
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new TypeError("User name must not be empty");
    }

    return trimmedName;
  }

  /**
   * Creates a new User instance (for validation only).
   * @param name - The user's name (will be trimmed and validated)
   * @throws {@link TypeError} If the name is invalid (not a string, empty, or exceeds max length)
   * @public
   */
  constructor(name: string) {
    User.validateName(name);
  }
}

/**
 * User data interface for storage and serialization.
 * Used when persisting users to localStorage and API responses.
 * @public
 */
export interface UserData {
  id: number;
  name: string;
  email?: string;
  created_at?: string;
}
