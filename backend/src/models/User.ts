import validator from "validator";
import { Database } from "../db/database.js";

/**
 * User data interface matching the frontend UserData.
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

/**
 * User data with password hash (for internal use only).
 * @public
 */
export interface UserWithPassword {
  id: number;
  name: string;
  nickname?: string;
  email: string;
  password_hash?: string;
  profile_picture_url?: string;
  last_access?: string;
  created_at?: string;
}

/**
 * User model class for representing user entities and database operations.
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
    this.email = User.validateEmail(this.email);
    if (this.nickname !== undefined) {
      this.nickname = User.validateNickname(this.nickname);
    }
    return this;
  }

  /**
   * Save the user to the database.
   * Creates a new user record if id is not set, updates existing user otherwise.
   * @param db - Database instance
   * @returns Promise resolving to the saved user data
   * @throws Error if save operation fails
   * @public
   */
  async save(db: Database): Promise<UserData> {
    this.validate();

    if (this.id) {
      // Update existing user
      const updates: string[] = [];
      const values: any[] = [];

      updates.push("name = ?");
      values.push(this.name);

      if (this.nickname !== undefined) {
        updates.push("nickname = ?");
        values.push(this.nickname || null);
      }

      updates.push("email = ?");
      values.push(this.email);

      if (this.profile_picture_url !== undefined) {
        updates.push("profile_picture_url = ?");
        values.push(this.profile_picture_url || null);
      }

      updates.push("updated_at = CURRENT_TIMESTAMP");
      values.push(this.id);

      await db.run(
        `UPDATE users SET ${updates.join(", ")} WHERE id = ?`,
        values
      );

      return this.toData();
    } else {
      // Create new user
      const result = await db.run(
        "INSERT INTO users (name, nickname, email, profile_picture_url) VALUES (?, ?, ?, ?)",
        [
          this.name,
          this.nickname || null,
          this.email,
          this.profile_picture_url || null,
        ]
      );

      if (!result.lastID) {
        throw new Error("Failed to create user");
      }

      this.id = result.lastID;
      return this.toData();
    }
  }

  /**
   * Update user fields.
   * @param updates - Partial user data with fields to update
   * @param db - Database instance
   * @returns Promise resolving to updated user data
   * @throws Error if update fails
   * @public
   */
  async update(updates: Partial<UserData>, db: Database): Promise<UserData> {
    if (!this.id) {
      throw new Error("Cannot update user without ID");
    }

    if (updates.name !== undefined) {
      this.name = User.validateName(updates.name);
    }
    if (updates.nickname !== undefined) {
      this.nickname = User.validateNickname(updates.nickname);
    }
    if (updates.email !== undefined) {
      this.email = User.validateEmail(updates.email);
    }
    if (updates.profile_picture_url !== undefined) {
      this.profile_picture_url = updates.profile_picture_url;
    }

    return this.save(db);
  }

  /**
   * Delete the user from the database.
   * @param db - Database instance
   * @returns Promise resolving when user is deleted
   * @throws Error if deletion fails
   * @public
   */
  async delete(db: Database): Promise<void> {
    if (!this.id) {
      throw new Error("Cannot delete user without ID");
    }

    const result = await db.run("DELETE FROM users WHERE id = ?", [this.id]);

    if (result.changes === 0) {
      throw new Error("User not found");
    }
  }

  /**
   * Convert user instance to UserData interface.
   * @returns User data object
   * @public
   */
  toData(): UserData {
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
   * Load user from database by ID.
   * @param id - User ID
   * @param db - Database instance
   * @returns Promise resolving to User instance or null if not found
   * @public
   */
  static async loadById(id: number, db: Database): Promise<User | null> {
    const row = await db.get<{
      id: number;
      name: string;
      nickname: string | null;
      email: string;
      profile_picture_url: string | null;
      last_access: string | null;
      created_at: string;
    }>(
      "SELECT id, name, nickname, email, profile_picture_url, last_access, created_at FROM users WHERE id = ?",
      [id]
    );

    if (!row) {
      return null;
    }

    return new User({
      id: row.id,
      name: row.name,
      nickname: row.nickname || undefined,
      email: row.email,
      profile_picture_url: row.profile_picture_url || undefined,
      last_access: row.last_access || undefined,
      created_at: row.created_at,
    });
  }

  /**
   * Load user from database by email.
   * @param email - User email
   * @param db - Database instance
   * @returns Promise resolving to User instance or null if not found
   * @public
   */
  static async loadByEmail(email: string, db: Database): Promise<User | null> {
    const validatedEmail = User.validateEmail(email);
    const row = await db.get<{
      id: number;
      name: string;
      nickname: string | null;
      email: string;
      profile_picture_url: string | null;
      last_access: string | null;
      created_at: string;
    }>(
      "SELECT id, name, nickname, email, profile_picture_url, last_access, created_at FROM users WHERE email = ?",
      [validatedEmail]
    );

    if (!row) {
      return null;
    }

    return new User({
      id: row.id,
      name: row.name,
      nickname: row.nickname || undefined,
      email: row.email,
      profile_picture_url: row.profile_picture_url || undefined,
      last_access: row.last_access || undefined,
      created_at: row.created_at,
    });
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

  /**
   * Validates an email address.
   * @param email - The email to validate
   * @returns The normalized email (lowercase, trimmed)
   * @throws {@link TypeError} If the email is invalid
   * @public
   */
  static validateEmail(email: string): string {
    if (typeof email !== "string") {
      throw new TypeError("Email must be a string");
    }

    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail) {
      throw new TypeError("Email must not be empty");
    }

    if (!validator.isEmail(trimmedEmail)) {
      throw new TypeError("Invalid email format");
    }

    if (trimmedEmail.length > 255) {
      throw new TypeError("Email must not exceed 255 characters");
    }

    return trimmedEmail;
  }
}
