import jwt, { SignOptions } from "jsonwebtoken";
import crypto from "crypto";
import { dbPromises } from "../db/database.js";
import { User, UserData, UserWithPassword } from "../models/User.js";
import { EmailService } from "./emailService.js";

/**
 * JWT secret key from environment variable or default.
 * @private
 */
const JWT_SECRET =
  process.env.JWT_SECRET || "your-secret-key-change-in-production";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

/**
 * Magic link expiration time in minutes.
 * @private
 */
const MAGIC_LINK_EXPIRY_MINUTES = parseInt(
  process.env.MAGIC_LINK_EXPIRY_MINUTES || "15",
  10
);

/**
 * Service for authentication-related operations.
 * @public
 */
export class AuthService {
  /**
   * Generate a secure random token for magic links.
   * @returns A secure random token
   * @private
   */
  private static generateToken(): string {
    return crypto.randomBytes(32).toString("hex");
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
  static async requestRegisterMagicLink(
    name: string,
    email: string,
    nickname?: string,
    profilePictureUrl?: string
  ): Promise<void> {
    // Validate inputs
    const validatedName = User.validateName(name);
    const validatedEmail = User.validateEmail(email);
    const validatedNickname = User.validateNickname(nickname);

    // Check if user with email already exists
    const existingUser = await dbPromises.get<UserWithPassword>(
      "SELECT id FROM users WHERE email = ?",
      [validatedEmail]
    );

    if (existingUser) {
      throw new Error("Email already registered");
    }

    // Generate magic link token
    const token = AuthService.generateToken();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + MAGIC_LINK_EXPIRY_MINUTES);

    // Create user with magic link token
    await dbPromises.run(
      "INSERT INTO users (name, nickname, email, password_hash, profile_picture_url, magic_link_token, magic_link_expires) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        validatedName,
        validatedNickname || null,
        validatedEmail,
        null,
        profilePictureUrl || null,
        token,
        expiresAt.toISOString(),
      ]
    );

    // Send magic link email
    await EmailService.sendMagicLink(validatedEmail, token, true);
  }

  /**
   * Request login magic link.
   * Sends magic link email to existing user.
   * @param email - User's email
   * @returns Promise resolving when magic link is sent
   * @throws Error if user doesn't exist or email sending fails
   * @public
   */
  static async requestLoginMagicLink(email: string): Promise<void> {
    // Validate email format
    const validatedEmail = User.validateEmail(email);

    // Check if user exists
    const user = await dbPromises.get<UserWithPassword>(
      "SELECT id FROM users WHERE email = ?",
      [validatedEmail]
    );

    if (!user) {
      // Don't reveal if user exists or not for security
      // Still return success to prevent email enumeration
      return;
    }

    // Generate magic link token
    const token = AuthService.generateToken();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + MAGIC_LINK_EXPIRY_MINUTES);

    // Update user with magic link token
    await dbPromises.run(
      "UPDATE users SET magic_link_token = ?, magic_link_expires = ? WHERE email = ?",
      [token, expiresAt.toISOString(), validatedEmail]
    );

    // Send magic link email
    await EmailService.sendMagicLink(validatedEmail, token, false);
  }

  /**
   * Verify magic link token and log user in.
   * @param token - Magic link token
   * @returns Promise resolving to an object with user data and JWT token
   * @throws Error if token is invalid or expired
   * @public
   */
  static async verifyMagicLink(token: string): Promise<{
    user: UserData;
    token: string;
  }> {
    if (!token || typeof token !== "string") {
      throw new Error("Invalid magic link token");
    }

    // Find user with this token
    const user = await dbPromises.get<
      UserWithPassword & {
        magic_link_expires: string;
      }
    >(
      "SELECT id, name, nickname, email, password_hash, profile_picture_url, last_access, created_at, magic_link_expires FROM users WHERE magic_link_token = ?",
      [token]
    );

    if (!user) {
      throw new Error("Invalid or expired magic link");
    }

    // Check if token is expired
    const expiresAt = new Date(user.magic_link_expires);
    if (expiresAt < new Date()) {
      throw new Error("Magic link has expired");
    }

    // Clear magic link token
    await dbPromises.run(
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
  static async verifyToken(token: string): Promise<number> {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as {
        userId: number;
        email: string;
      };
      return decoded.userId;
    } catch (error) {
      throw new Error("Invalid or expired token");
    }
  }

  /**
   * Get user by ID (for use with verified tokens).
   * @param id - User ID
   * @returns Promise resolving to user data or null if not found
   * @public
   */
  static async getUserById(id: number): Promise<UserData | null> {
    const row = await dbPromises.get<{
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
