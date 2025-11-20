import validator from "validator";

/**
 * User data interface matching the frontend UserData.
 * @public
 */
export interface UserData {
  id: number;
  name: string;
  email?: string;
  created_at?: string;
}

/**
 * User data with password hash (for internal use only).
 * @public
 */
export interface UserWithPassword {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  created_at?: string;
}

/**
 * User model for database operations.
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

  /**
   * Validates a password according to robust security rules:
   * - Minimum 8 characters
   * - At least one uppercase letter
   * - At least one lowercase letter
   * - At least one number
   * - At least one special character
   * @param password - The password to validate
   * @throws {@link TypeError} If the password is invalid
   * @public
   */
  static validatePassword(password: string): void {
    if (typeof password !== "string") {
      throw new TypeError("Password must be a string");
    }

    if (password.length < 8) {
      throw new TypeError("Password must be at least 8 characters long");
    }

    if (password.length > 128) {
      throw new TypeError("Password must not exceed 128 characters");
    }

    if (!/[A-Z]/.test(password)) {
      throw new TypeError(
        "Password must contain at least one uppercase letter"
      );
    }

    if (!/[a-z]/.test(password)) {
      throw new TypeError(
        "Password must contain at least one lowercase letter"
      );
    }

    if (!/[0-9]/.test(password)) {
      throw new TypeError("Password must contain at least one number");
    }

    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      throw new TypeError(
        "Password must contain at least one special character"
      );
    }
  }
}
