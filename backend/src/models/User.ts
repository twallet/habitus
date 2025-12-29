import validator from "validator";
import { Database } from "../db/database.js";
import {
  User as BaseUser,
  UserData,
  MAX_USER_NAME_LENGTH,
} from "@habitus/shared";

export type { UserData };
export { MAX_USER_NAME_LENGTH };

/**
 * Backend User model with database operations.
 * Extends the shared User class with persistence methods and enhanced email validation.
 * @public
 */
export class User extends BaseUser {
  /**
   * Validate the user instance.
   * Validates all fields according to business rules.
   * Uses enhanced email validation with validator library.
   * @returns The validated user instance
   * @throws {@link TypeError} If validation fails
   * @public
   */
  validate(): User {
    this.name = User.validateName(this.name);
    this.email = User.validateEmail(this.email);
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

      updates.push("email = ?");
      values.push(this.email);

      if (this.profile_picture_url !== undefined) {
        updates.push("profile_picture_url = ?");
        values.push(this.profile_picture_url || null);
      }

      if (this.telegram_chat_id !== undefined) {
        updates.push("telegram_chat_id = ?");
        values.push(this.telegram_chat_id || null);
      }

      if (this.notification_channels !== undefined) {
        updates.push("notification_channels = ?");
        values.push(
          this.notification_channels.length > 0
            ? JSON.stringify(this.notification_channels)
            : null
        );
      }

      if (this.locale !== undefined) {
        updates.push("locale = ?");
        values.push(this.locale || null);
      }

      if (this.timezone !== undefined) {
        updates.push("timezone = ?");
        values.push(this.timezone || null);
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
        "INSERT INTO users (name, email, profile_picture_url) VALUES (?, ?, ?)",
        [this.name, this.email, this.profile_picture_url || null]
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
    if (updates.email !== undefined) {
      this.email = User.validateEmail(updates.email);
    }
    if (updates.profile_picture_url !== undefined) {
      this.profile_picture_url = updates.profile_picture_url;
    }
    if (updates.telegram_chat_id !== undefined) {
      this.telegram_chat_id = updates.telegram_chat_id;
    }
    if (updates.notification_channels !== undefined) {
      this.notification_channels = updates.notification_channels;
    }
    if (updates.locale !== undefined) {
      // Keep null as null to allow clearing the field in database
      // TypeScript allows null assignment here due to the intersection type
      (this as any).locale = updates.locale;
    }
    if (updates.timezone !== undefined) {
      // Keep null as null to allow clearing the field in database
      // TypeScript allows null assignment here due to the intersection type
      (this as any).timezone = updates.timezone;
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
      email: string;
      profile_picture_url: string | null;
      telegram_chat_id: string | null;
      notification_channels: string | null;
      locale: string | null;
      timezone: string | null;
      last_access: string | null;
      created_at: string;
    }>(
      "SELECT id, name, email, profile_picture_url, telegram_chat_id, notification_channels, locale, timezone, last_access, created_at FROM users WHERE id = ?",
      [id]
    );

    if (!row) {
      return null;
    }

    return new User({
      id: row.id,
      name: row.name,
      email: row.email,
      profile_picture_url: row.profile_picture_url || undefined,
      telegram_chat_id: row.telegram_chat_id || undefined,
      notification_channels: row.notification_channels
        ? JSON.parse(row.notification_channels)
        : undefined,
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
      email: string;
      profile_picture_url: string | null;
      telegram_chat_id: string | null;
      notification_channels: string | null;
      locale: string | null;
      timezone: string | null;
      last_access: string | null;
      created_at: string;
    }>(
      "SELECT id, name, email, profile_picture_url, telegram_chat_id, notification_channels, locale, timezone, last_access, created_at FROM users WHERE email = ?",
      [validatedEmail]
    );

    if (!row) {
      return null;
    }

    return new User({
      id: row.id,
      name: row.name,
      email: row.email,
      profile_picture_url: row.profile_picture_url || undefined,
      telegram_chat_id: row.telegram_chat_id || undefined,
      notification_channels: row.notification_channels
        ? JSON.parse(row.notification_channels)
        : undefined,
      last_access: row.last_access || undefined,
      created_at: row.created_at,
    });
  }

  /**
   * Validates an email address using validator library for robust validation.
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
