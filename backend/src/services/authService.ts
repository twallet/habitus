import jwt, { SignOptions } from "jsonwebtoken";
import crypto from "crypto";
import { Database } from "../db/database.js";
import { User, UserData } from "../models/User.js";
import { EmailService } from "./emailService.js";

/**
 * JWT secret key from environment variable (required, no default).
 * @private
 */
const JWT_SECRET = ((): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      "JWT_SECRET environment variable is required. Please set it in your .env file."
    );
  }
  return secret;
})();

/**
 * JWT expiration time from environment variable (required, no default).
 * @private
 */
const JWT_EXPIRES_IN = ((): string => {
  const expiresIn = process.env.JWT_EXPIRES_IN;
  if (!expiresIn) {
    throw new Error(
      "JWT_EXPIRES_IN environment variable is required. Please set it in your .env file."
    );
  }
  return expiresIn;
})();

/**
 * Magic link expiration time in minutes (required, no default).
 * @private
 */
const MAGIC_LINK_EXPIRY_MINUTES = ((): number => {
  const minutes = process.env.MAGIC_LINK_EXPIRY_MINUTES;
  if (!minutes) {
    throw new Error(
      "MAGIC_LINK_EXPIRY_MINUTES environment variable is required. Please set it in your .env file."
    );
  }
  const parsed = parseInt(minutes, 10);
  if (isNaN(parsed) || parsed <= 0) {
    throw new Error(
      `Invalid MAGIC_LINK_EXPIRY_MINUTES value: ${minutes}. Must be a positive number.`
    );
  }
  return parsed;
})();

/**
 * Cooldown period in minutes before allowing another magic link request for the same email.
 * Prevents email spam and abuse (required, no default).
 * @private
 */
const MAGIC_LINK_COOLDOWN_MINUTES = ((): number => {
  const minutes = process.env.MAGIC_LINK_COOLDOWN_MINUTES;
  if (!minutes) {
    throw new Error(
      "MAGIC_LINK_COOLDOWN_MINUTES environment variable is required. Please set it in your .env file."
    );
  }
  const parsed = parseInt(minutes, 10);
  if (isNaN(parsed) || parsed <= 0) {
    throw new Error(
      `Invalid MAGIC_LINK_COOLDOWN_MINUTES value: ${minutes}. Must be a positive number.`
    );
  }
  return parsed;
})();

/**
 * Service for authentication-related operations.
 * @public
 */
export class AuthService {
  private db: Database;
  private emailService: EmailService;

  /**
   * Create a new AuthService instance.
   * @param db - Database instance
   * @param emailService - EmailService instance
   * @public
   */
  constructor(db: Database, emailService: EmailService) {
    this.db = db;
    this.emailService = emailService;
  }

  /**
   * Generate a secure random token for magic links.
   * @returns A secure random token
   * @private
   */
  private generateToken(): string {
    return crypto.randomBytes(32).toString("hex");
  }

  /**
   * Check if a magic link was recently sent to an email address.
   * @param email - Email address to check
   * @returns Promise resolving to true if cooldown period hasn't passed, false otherwise
   * @private
   */
  private async checkMagicLinkCooldown(email: string): Promise<boolean> {
    const user = await this.db.get<{
      magic_link_expires: string | null;
    }>("SELECT magic_link_expires FROM users WHERE email = ?", [email]);

    if (!user || !user.magic_link_expires) {
      return false; // No recent magic link found
    }

    const expiresAt = new Date(user.magic_link_expires);
    const now = new Date();

    // If the magic link hasn't expired yet, check if it was created recently
    if (expiresAt > now) {
      // Calculate when the magic link was created (expires - expiry time)
      const createdAt = new Date(expiresAt);
      createdAt.setMinutes(createdAt.getMinutes() - MAGIC_LINK_EXPIRY_MINUTES);

      // Check if it was created within the cooldown period
      const cooldownExpires = new Date(createdAt);
      cooldownExpires.setMinutes(
        cooldownExpires.getMinutes() + MAGIC_LINK_COOLDOWN_MINUTES
      );

      return cooldownExpires > now;
    }

    return false; // Magic link expired, cooldown doesn't apply
  }

  /**
   * Request registration magic link.
   * Creates user if doesn't exist, sends magic link email.
   * @param name - User's name
   * @param email - User's email
   * @param nickname - Optional nickname
   * @param profilePictureUrl - Optional profile picture URL
   * @returns Promise resolving when magic link is sent
   * @throws Error if validation fails or email sending fails
   * @public
   */
  async requestRegisterMagicLink(
    name: string,
    email: string,
    nickname?: string,
    profilePictureUrl?: string
  ): Promise<void> {
    console.log(
      `[${new Date().toISOString()}] AUTH | Registration magic link requested for email: ${email}`
    );

    // Validate inputs
    const validatedName = User.validateName(name);
    const validatedEmail = User.validateEmail(email);
    const validatedNickname = User.validateNickname(nickname);

    // Check cooldown period first (takes precedence over duplicate email check)
    if (await this.checkMagicLinkCooldown(validatedEmail)) {
      console.warn(
        `[${new Date().toISOString()}] AUTH | Registration magic link cooldown active for email: ${validatedEmail}`
      );
      throw new Error(
        `Please wait ${MAGIC_LINK_COOLDOWN_MINUTES} minutes before requesting another magic link.`
      );
    }

    // Check if user with email already exists
    const existingUser = await this.db.get<{ id: number }>(
      "SELECT id FROM users WHERE email = ?",
      [validatedEmail]
    );

    if (existingUser) {
      console.warn(
        `[${new Date().toISOString()}] AUTH | Registration attempt with already registered email: ${validatedEmail}`
      );
      throw new Error("Email already registered");
    }

    // Generate magic link token
    const token = this.generateToken();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + MAGIC_LINK_EXPIRY_MINUTES);

    console.log(
      `[${new Date().toISOString()}] AUTH | Creating new user account for email: ${validatedEmail}, name: ${validatedName}`
    );

    // Create user with magic link token
    await this.db.run(
      "INSERT INTO users (name, nickname, email, profile_picture_url, magic_link_token, magic_link_expires) VALUES (?, ?, ?, ?, ?, ?)",
      [
        validatedName,
        validatedNickname || null,
        validatedEmail,
        profilePictureUrl || null,
        token,
        expiresAt.toISOString(),
      ]
    );

    console.log(
      `[${new Date().toISOString()}] AUTH | User account created, sending registration magic link email to: ${validatedEmail}`
    );

    // Send magic link email
    await this.emailService.sendMagicLink(validatedEmail, token, true);

    console.log(
      `[${new Date().toISOString()}] AUTH | Registration magic link email sent successfully to: ${validatedEmail}`
    );
  }

  /**
   * Request login magic link.
   * Sends magic link email to existing user.
   * @param email - User's email
   * @returns Promise resolving when magic link is sent
   * @throws Error if user doesn't exist or email sending fails
   * @public
   */
  async requestLoginMagicLink(email: string): Promise<void> {
    console.log(
      `[${new Date().toISOString()}] AUTH | Login magic link requested for email: ${email}`
    );

    // Validate email format
    const validatedEmail = User.validateEmail(email);

    // Check if user exists
    const user = await this.db.get<{ id: number }>(
      "SELECT id FROM users WHERE email = ?",
      [validatedEmail]
    );

    if (!user) {
      // Don't reveal if user exists or not for security
      // Still return success to prevent email enumeration
      console.log(
        `[${new Date().toISOString()}] AUTH | Login magic link requested for non-existent email (security: returning success): ${validatedEmail}`
      );
      return;
    }

    console.log(
      `[${new Date().toISOString()}] AUTH | User found for login request, userId: ${
        user.id
      }`
    );

    // Check cooldown period for this email
    if (await this.checkMagicLinkCooldown(validatedEmail)) {
      console.warn(
        `[${new Date().toISOString()}] AUTH | Login magic link cooldown active for email: ${validatedEmail}`
      );
      throw new Error(
        `Please wait ${MAGIC_LINK_COOLDOWN_MINUTES} minutes before requesting another magic link.`
      );
    }

    // Generate magic link token
    const token = this.generateToken();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + MAGIC_LINK_EXPIRY_MINUTES);

    console.log(
      `[${new Date().toISOString()}] AUTH | Updating magic link token for userId: ${
        user.id
      }`
    );

    // Update user with magic link token
    await this.db.run(
      "UPDATE users SET magic_link_token = ?, magic_link_expires = ? WHERE email = ?",
      [token, expiresAt.toISOString(), validatedEmail]
    );

    console.log(
      `[${new Date().toISOString()}] AUTH | Sending login magic link email to: ${validatedEmail}`
    );

    // Send magic link email
    await this.emailService.sendMagicLink(validatedEmail, token, false);

    console.log(
      `[${new Date().toISOString()}] AUTH | Login magic link email sent successfully to: ${validatedEmail}`
    );
  }

  /**
   * Verify magic link token and log user in.
   * @param token - Magic link token
   * @returns Promise resolving to an object with user data and JWT token
   * @throws Error if token is invalid or expired
   * @public
   */
  async verifyMagicLink(token: string): Promise<{
    user: UserData;
    token: string;
  }> {
    console.log(
      `[${new Date().toISOString()}] AUTH | Magic link verification attempted (token length: ${
        token?.length || 0
      })`
    );

    if (!token || typeof token !== "string") {
      console.warn(
        `[${new Date().toISOString()}] AUTH | Invalid magic link token format`
      );
      throw new Error("Invalid magic link token");
    }

    // Find user with this token
    const user = await this.db.get<
      UserData & {
        magic_link_expires: string;
      }
    >(
      "SELECT id, name, nickname, email, profile_picture_url, last_access, created_at, magic_link_expires FROM users WHERE magic_link_token = ?",
      [token]
    );

    if (!user) {
      console.warn(
        `[${new Date().toISOString()}] AUTH | Magic link verification failed: token not found`
      );
      throw new Error("Invalid or expired magic link");
    }

    console.log(
      `[${new Date().toISOString()}] AUTH | Magic link token found for userId: ${
        user.id
      }, email: ${user.email}`
    );

    // Check if token is expired
    const expiresAt = new Date(user.magic_link_expires);
    if (expiresAt < new Date()) {
      console.warn(
        `[${new Date().toISOString()}] AUTH | Magic link verification failed: token expired for userId: ${
          user.id
        }`
      );
      throw new Error("Magic link has expired");
    }

    console.log(
      `[${new Date().toISOString()}] AUTH | Magic link valid, clearing token and updating last_access for userId: ${
        user.id
      }`
    );

    // Clear magic link token
    await this.db.run(
      "UPDATE users SET magic_link_token = NULL, magic_link_expires = NULL, last_access = CURRENT_TIMESTAMP WHERE id = ?",
      [user.id]
    );

    // Generate JWT token
    const jwtToken = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      {
        expiresIn: JWT_EXPIRES_IN,
      } as SignOptions
    );

    console.log(
      `[${new Date().toISOString()}] AUTH | Magic link verified successfully, JWT token generated for userId: ${
        user.id
      }`
    );

    return {
      user: {
        id: user.id,
        name: user.name,
        nickname: user.nickname,
        email: user.email,
        profile_picture_url: user.profile_picture_url || undefined,
        last_access: user.last_access || undefined,
        created_at: user.created_at || undefined,
      },
      token: jwtToken,
    };
  }

  /**
   * Verify a JWT token and return the user ID.
   * @param token - JWT token to verify
   * @returns Promise resolving to the user ID from the token
   * @throws Error if token is invalid
   * @public
   */
  async verifyToken(token: string): Promise<number> {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as {
        userId: number;
        email: string;
      };
      console.log(
        `[${new Date().toISOString()}] AUTH | JWT token verified successfully for userId: ${
          decoded.userId
        }`
      );
      return decoded.userId;
    } catch (error) {
      console.warn(
        `[${new Date().toISOString()}] AUTH | JWT token verification failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      throw new Error("Invalid or expired token");
    }
  }

  /**
   * Get user by ID (for use with verified tokens).
   * @param id - User ID
   * @returns Promise resolving to user data or null if not found
   * @public
   */
  async getUserById(id: number): Promise<UserData | null> {
    console.log(
      `[${new Date().toISOString()}] AUTH | Fetching user by ID: ${id}`
    );

    const row = await this.db.get<{
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
      console.log(
        `[${new Date().toISOString()}] AUTH | User not found for ID: ${id}`
      );
      return null;
    }

    console.log(
      `[${new Date().toISOString()}] AUTH | User found: ID ${row.id}, email: ${
        row.email
      }`
    );

    return {
      id: row.id,
      name: row.name,
      nickname: row.nickname || undefined,
      email: row.email,
      profile_picture_url: row.profile_picture_url || undefined,
      last_access: row.last_access || undefined,
      created_at: row.created_at,
    };
  }
}
