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
   * Maximum allowed length for user nicknames.
   * @public
   */
  static readonly MAX_NICKNAME_LENGTH: number = 30;

  /**
   * User ID.
   * @public
   */
  id: number;

  /**
   * User's name.
   * @public
   */
  name: string;

  /**
   * User's nickname (optional).
   * @public
   */
  nickname?: string;

  /**
   * User's email address.
   * @public
   */
  email: string;

  /**
   * Profile picture URL (optional).
   * @public
   */
  profile_picture_url?: string;

  /**
   * Last access timestamp (optional).
   * @public
   */
  last_access?: string;

  /**
   * Creation timestamp (optional).
   * @public
   */
  created_at?: string;

  /**
   * Create a new User instance.
   * @param data - User data to initialize the instance
   * @public
   */
  constructor(data: UserData) {
    this.id = data.id;
    this.name = data.name;
    this.nickname = data.nickname;
    this.email = data.email;
    this.profile_picture_url = data.profile_picture_url;
    this.last_access = data.last_access;
    this.created_at = data.created_at;
  }

  /**
   * Validate the user instance.
   * Validates all fields according to business rules.
   * @returns The validated user instance
   * @throws {@link TypeError} If validation fails
   * @public
   */
  validate(): User {
    this.name = User.validateName(this.name);
    if (this.nickname !== undefined) {
      this.nickname = User.validateNickname(this.nickname);
    }
    return this;
  }

  /**
   * Convert user instance to UserData interface.
   * @returns User data object
   * @public
   */
  toJSON(): UserData {
    return {
      id: this.id,
      name: this.name,
      nickname: this.nickname,
      email: this.email,
      profile_picture_url: this.profile_picture_url,
      last_access: this.last_access,
      created_at: this.created_at,
    };
  }

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
      throw new TypeError("Name must be a string");
    }

    if (name.length > User.MAX_NAME_LENGTH) {
      throw new TypeError(
        `Name must be smaller than ${User.MAX_NAME_LENGTH} characters`
      );
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new TypeError("Name must not be empty");
    }

    return trimmedName;
  }

  /**
   * Validates a user nickname according to the rules:
   * - Must be a string (if provided)
   * - Must not exceed MAX_NICKNAME_LENGTH characters if provided
   * - Can be empty/null/undefined (optional field)
   * @param nickname - The nickname to validate (optional)
   * @returns The trimmed nickname or undefined if empty
   * @throws {@link TypeError} If the nickname is invalid
   * @public
   */
  static validateNickname(nickname?: string | null): string | undefined {
    if (nickname === null || nickname === undefined) {
      return undefined;
    }

    if (typeof nickname !== "string") {
      throw new TypeError("Nickname must be a string");
    }

    const trimmedNickname = nickname.trim();
    if (!trimmedNickname) {
      return undefined;
    }

    if (trimmedNickname.length > User.MAX_NICKNAME_LENGTH) {
      throw new TypeError(
        `Nickname must be smaller than ${User.MAX_NICKNAME_LENGTH} characters`
      );
    }

    return trimmedNickname;
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
  nickname?: string;
  email: string;
  profile_picture_url?: string;
  last_access?: string;
  created_at?: string;
}
