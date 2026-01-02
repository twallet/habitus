import { UserData, MAX_USER_NAME_LENGTH } from "../types.js";

/**
 * User model class for representing user entities.
 * Contains validation logic shared between frontend and backend.
 * @public
 */
export class User {
  /**
   * Maximum allowed length for user names.
   * @public
   */
  static readonly MAX_NAME_LENGTH: number = MAX_USER_NAME_LENGTH;

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
   * Telegram chat ID (optional).
   * @public
   */
  telegram_chat_id?: string;

  /**
   * Notification channel (optional).
   * @public
   */
  notification_channels?: string;

  /**
   * User locale (optional, BCP 47 format like 'en-US', 'es-AR', 'fr-FR').
   * @public
   */
  locale?: string;

  /**
   * User timezone (optional, IANA timezone like 'America/Buenos_Aires', 'Europe/London').
   * @public
   */
  timezone?: string;

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
    this.email = data.email;
    this.profile_picture_url = data.profile_picture_url;
    this.telegram_chat_id = data.telegram_chat_id;
    this.notification_channels = data.notification_channels;
    this.locale = data.locale;
    this.timezone = data.timezone;
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
    return this;
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
      email: this.email,
      profile_picture_url: this.profile_picture_url,
      telegram_chat_id: this.telegram_chat_id,
      notification_channels: this.notification_channels,
      locale: this.locale,
      timezone: this.timezone,
      last_access: this.last_access,
      created_at: this.created_at,
    };
  }

  /**
   * Convert user instance to UserData interface (alias for toData).
   * @returns User data object
   * @public
   */
  toJSON(): UserData {
    return this.toData();
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
   * Validates an email address format (basic validation).
   * For more robust validation, backend should use validator library.
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

    if (trimmedEmail.length > 255) {
      throw new TypeError("Email must not exceed 255 characters");
    }

    // Basic email format validation (contains @ and at least one dot after @)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      throw new TypeError("Invalid email format");
    }

    return trimmedEmail;
  }
}
