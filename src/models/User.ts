/**
 * User model class
 */
export class User {
  private static nextId: number = 1;
  private readonly _id: number;
  private readonly _name: string;

  /**
   * Maximum allowed length for user names
   */
  static readonly MAX_NAME_LENGTH: number = 30;

  /**
   * Creates a new User instance
   * @param name - The user's name
   * @throws {TypeError} If the name is invalid
   */
  constructor(name: string) {
    this._name = User.validateName(name);
    this._id = User.nextId++;
  }

  /**
   * Gets the user's ID
   * @returns The user ID
   */
  get id(): number {
    return this._id;
  }

  /**
   * Gets the user's name
   * @returns The user name
   */
  get name(): string {
    return this._name;
  }

  /**
   * Initialize the nextId counter based on existing users
   * @param maxId - The maximum ID from existing users
   */
  static initializeNextId(maxId: number): void {
    if (maxId >= 0) {
      User.nextId = maxId + 1;
    }
  }

  /**
   * Validates a user name
   * @param name - The name to validate
   * @returns The trimmed and validated name
   * @throws {TypeError} If the name is invalid
   */
  private static validateName(name: string): string {
    if (typeof name !== "string") {
      throw new TypeError("Player name must be a string");
    }

    if (name.length > User.MAX_NAME_LENGTH) {
      throw new TypeError(
        `Player name must be smaller than ${User.MAX_NAME_LENGTH} characters`
      );
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new TypeError("Player name must not be empty");
    }

    return trimmedName;
  }
}

/**
 * User data interface for storage
 */
export interface UserData {
  id: number;
  name: string;
}

