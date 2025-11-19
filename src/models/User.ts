/**
 * User model class representing a user in the system.
 * @public
 */
export class User {
  private static nextId: number = 1;
  private readonly _id: number;
  private readonly _name: string;

  /**
   * Maximum allowed length for user names.
   * @public
   */
  static readonly MAX_NAME_LENGTH: number = 30;

  /**
   * Creates a new User instance.
   * @param name - The user's name (will be trimmed and validated)
   * @throws {@link TypeError} If the name is invalid (not a string, empty, or exceeds max length)
   * @public
   */
  constructor(name: string) {
    this._name = User.validateName(name);
    this._id = User.nextId++;
  }

  /**
   * Gets the user's unique identifier.
   * @returns The user ID (sequential number)
   * @public
   */
  get id(): number {
    return this._id;
  }

  /**
   * Gets the user's name.
   * @returns The user name (trimmed and validated)
   * @public
   */
  get name(): string {
    return this._name;
  }

  /**
   * Initialize the nextId counter based on existing users.
   * This prevents ID conflicts when loading users from storage.
   * @param maxId - The maximum ID from existing users
   * @public
   */
  static initializeNextId(maxId: number): void {
    if (maxId >= 0) {
      User.nextId = maxId + 1;
    }
  }

  /**
   * Validates a user name according to the rules:
   * - Must be a string
   * - Must not be empty after trimming
   * - Must not exceed MAX_NAME_LENGTH characters
   * @param name - The name to validate
   * @returns The trimmed and validated name
   * @throws {@link TypeError} If the name is invalid
   * @internal
   */
  private static validateName(name: string): string {
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
}

/**
 * User data interface for storage and serialization.
 * Used when persisting users to localStorage.
 * @public
 */
export interface UserData {
  id: number;
  name: string;
}

