import jwt, { SignOptions } from "jsonwebtoken";
import crypto from "crypto";
import { Database } from "../db/database.js";
import { User, type UserData } from "../models/User.js";
import { EmailService } from "./emailService.js";
import { ServerConfig } from "../setup/constants.js";

/**
 * Get JWT secret key from environment variable (lazy loading).
 * @returns JWT secret key
 * @throws Error if JWT_SECRET is not set
 * @private
 */
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      "JWT_SECRET environment variable is required. Please set it in your .env file."
    );
  }
  return secret;
}

/**
 * Get JWT expiration time from environment variable (lazy loading).
 * @returns JWT expiration time
 * @throws Error if JWT_EXPIRES_IN is not set
 * @private
 */
function getJwtExpiresIn(): string {
  const expiresIn = process.env.JWT_EXPIRES_IN;
  if (!expiresIn) {
    throw new Error(
      "JWT_EXPIRES_IN environment variable is required. Please set it in your .env file."
    );
  }
  return expiresIn;
}

/**
 * Get magic link expiration time in minutes (lazy loading).
 * @returns Magic link expiration time in minutes
 * @throws Error if MAGIC_LINK_EXPIRY_MINUTES is not set or invalid
 * @private
 */
function getMagicLinkExpiryMinutes(): number {
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
}

/**
 * Get cooldown period in minutes before allowing another magic link request (lazy loading).
 * Prevents email spam and abuse.
 * @returns Cooldown period in minutes
 * @throws Error if MAGIC_LINK_COOLDOWN_MINUTES is not set or invalid
 * @private
 */
function getMagicLinkCooldownMinutes(): number {
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
}

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
   * Allows resending if the previous link has expired or is close to expiring.
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

    // If the magic link has expired, allow resending
    if (expiresAt <= now) {
      return false; // Magic link expired, cooldown doesn't apply
    }

    // Calculate when the magic link was created (expires - expiry time)
    const createdAt = new Date(expiresAt);
    createdAt.setMinutes(createdAt.getMinutes() - getMagicLinkExpiryMinutes());

    // Check if it was created within the cooldown period
    const cooldownExpires = new Date(createdAt);
    cooldownExpires.setMinutes(
      cooldownExpires.getMinutes() + getMagicLinkCooldownMinutes()
    );

    // Allow resending if the link is close to expiring (within 5 minutes)
    // This helps users who didn't receive the email or need a fresh link
    const minutesUntilExpiry =
      (expiresAt.getTime() - now.getTime()) / (1000 * 60);
    const allowResendIfExpiringSoon = minutesUntilExpiry <= 5;

    // If link is expiring soon, allow resend even if within cooldown
    if (allowResendIfExpiringSoon) {
      console.log(
        `[${new Date().toISOString()}] AUTH | Allowing magic link resend for ${email} - previous link expires in ${Math.round(
          minutesUntilExpiry
        )} minutes`
      );
      return false;
    }

    return cooldownExpires > now;
  }

  /**
   * Request registration magic link.
   * Creates user if doesn't exist, sends magic link email.
   * @param name - User's name
   * @param email - User's email
   * @param profilePictureUrl - Optional profile picture URL
   * @returns Promise resolving when magic link is sent
   * @throws Error if validation fails or email sending fails
   * @public
   */
  async requestRegisterMagicLink(
    name: string,
    email: string,
    profilePictureUrl?: string
  ): Promise<void> {
    console.log(
      `[${new Date().toISOString()}] AUTH | Registration magic link requested for email: ${email}`
    );

    // Validate inputs
    const validatedName = User.validateName(name);
    const validatedEmail = User.validateEmail(email);

    // Check cooldown period first (takes precedence over duplicate email check)
    if (await this.checkMagicLinkCooldown(validatedEmail)) {
      console.warn(
        `[${new Date().toISOString()}] AUTH | Registration magic link cooldown active for email: ${validatedEmail}`
      );
      throw new Error(
        `Please wait ${getMagicLinkCooldownMinutes()} minutes before requesting another registration link.`
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
    expiresAt.setMinutes(expiresAt.getMinutes() + getMagicLinkExpiryMinutes());

    console.log(
      `[${new Date().toISOString()}] AUTH | Creating new user account for email: ${validatedEmail}, name: ${validatedName}`
    );

    // Create user with magic link token
    await this.db.run(
      "INSERT INTO users (name, email, profile_picture_url, magic_link_token, magic_link_expires) VALUES (?, ?, ?, ?, ?)",
      [
        validatedName,
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
        `Please wait ${getMagicLinkCooldownMinutes()} minutes before requesting another login link.`
      );
    }

    // Generate magic link token
    const token = this.generateToken();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + getMagicLinkExpiryMinutes());

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
   * Request email change magic link.
   * Sends magic link email to new email address for verification.
   * @param userId - The user ID requesting email change
   * @param newEmail - New email address
   * @returns Promise resolving when magic link is sent
   * @throws Error if validation fails or email sending fails
   * @public
   */
  async requestEmailChange(userId: number, newEmail: string): Promise<void> {
    console.log(
      `[${new Date().toISOString()}] AUTH | Email change requested for userId: ${userId}, new email: ${newEmail}`
    );

    // Validate email format
    const validatedEmail = User.validateEmail(newEmail);

    // Get current user
    const currentUser = await this.db.get<{ email: string }>(
      "SELECT email FROM users WHERE id = ?",
      [userId]
    );

    if (!currentUser) {
      throw new Error("User not found");
    }

    // Check if email is the same
    if (validatedEmail === currentUser.email) {
      throw new Error("New email must be different from current email");
    }

    // Check if new email is already taken by another user
    const existingUser = await this.db.get<{ id: number }>(
      "SELECT id FROM users WHERE email = ? AND id != ?",
      [validatedEmail, userId]
    );

    if (existingUser) {
      console.warn(
        `[${new Date().toISOString()}] AUTH | Email change failed: email already registered for userId: ${userId}`
      );
      throw new Error("Email already registered");
    }

    // Check cooldown period
    if (await this.checkMagicLinkCooldown(validatedEmail)) {
      console.warn(
        `[${new Date().toISOString()}] AUTH | Email change cooldown active for email: ${validatedEmail}`
      );
      throw new Error(
        `Please wait ${getMagicLinkCooldownMinutes()} minutes before requesting another email update confirmation link.`
      );
    }

    // Generate magic link token for email change
    const token = this.generateToken();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + getMagicLinkExpiryMinutes());

    // Store pending email and token
    await this.db.run(
      "UPDATE users SET pending_email = ?, email_verification_token = ?, email_verification_expires = ? WHERE id = ?",
      [validatedEmail, token, expiresAt.toISOString(), userId]
    );

    console.log(
      `[${new Date().toISOString()}] AUTH | Sending email change magic link to: ${validatedEmail}`
    );

    // Send magic link email with special subject for email change
    const serverUrl = ServerConfig.getServerUrl();
    const port = ServerConfig.getPort();
    const magicLink = `${serverUrl}:${port}/api/auth/verify-email-change?token=${token}`;
    const expiryMinutes = getMagicLinkExpiryMinutes();
    const text = `Please click the following link to verify your new email address: ${magicLink}\n\nThis link will expire in ${expiryMinutes} minutes. If you didn't request this, please ignore this email.`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #ffffff;">
        <table role="presentation" style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 40px 30px; text-align: left;">
              <h2 style="color: #333; text-align: left; margin: 0 0 16px 0; font-size: 24px; font-weight: bold;">Verify your new email address</h2>
              <p style="text-align: left; margin: 0 0 16px 0; font-size: 16px; line-height: 1.5; color: #333;">
                Click the button below to verify your new email address for 🌱 Habitus:
              </p>
              <p style="margin: 30px 0; text-align: left;">
                <a href="${magicLink}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; text-align: center;">
                  Verify email address
                </a>
              </p>
              <p style="color: #666; font-size: 14px; text-align: left; margin: 0 0 8px 0; line-height: 1.5;">This link will expire in ${expiryMinutes} minutes. If you didn't request this, please ignore this email.</p>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    await this.emailService.sendEmail(
      validatedEmail,
      "Verify your new email address for 🌱 Habitus",
      text,
      html
    );

    console.log(
      `[${new Date().toISOString()}] AUTH | Email change magic link sent successfully to: ${validatedEmail}`
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
    // Trim whitespace in case of encoding issues
    const trimmedToken = token?.trim();
    
    console.log(
      `[${new Date().toISOString()}] AUTH | Magic link verification attempted (token length: ${
        trimmedToken?.length || 0
      }, first 10 chars: ${trimmedToken?.substring(0, 10) || 'none'})`
    );

    if (!trimmedToken || typeof trimmedToken !== "string") {
      console.warn(
        `[${new Date().toISOString()}] AUTH | Invalid magic link token format`
      );
      throw new Error("Invalid link token");
    }

    // Find user with this token
    const user = await this.db.get<
      UserData & {
        magic_link_expires: string;
      }
    >(
      "SELECT id, name, email, profile_picture_url, last_access, created_at, magic_link_expires FROM users WHERE magic_link_token = ?",
      [trimmedToken]
    );

    if (!user) {
      console.warn(
        `[${new Date().toISOString()}] AUTH | Magic link verification failed: token not found (searched for token starting with: ${trimmedToken.substring(0, 10)})`
      );
      throw new Error("Invalid or expired link");
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
      throw new Error("Link has expired");
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
      getJwtSecret(),
      {
        expiresIn: getJwtExpiresIn(),
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
      const decoded = jwt.verify(token, getJwtSecret()) as {
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
      email: string;
      profile_picture_url: string | null;
      last_access: string | null;
      created_at: string;
    }>(
      "SELECT id, name, email, profile_picture_url, last_access, created_at FROM users WHERE id = ?",
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
      email: row.email,
      profile_picture_url: row.profile_picture_url || undefined,
      last_access: row.last_access || undefined,
      created_at: row.created_at,
    };
  }
}
