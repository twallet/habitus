import crypto from "crypto";
import { Database } from "../db/database.js";

/**
 * Service for managing Telegram bot connection tokens.
 * Handles token generation, validation, and cleanup for secure Telegram bot connections.
 * @public
 */
export class TelegramConnectionService {
  private db: Database;
  private readonly TOKEN_EXPIRY_MINUTES = 10;

  /**
   * Create a new TelegramConnectionService instance.
   * @param db - Database instance
   * @public
   */
  constructor(db: Database) {
    this.db = db;
  }

  /**
   * Generate a secure connection token for a user.
   * Token expires in 10 minutes.
   * @param userId - The user ID to generate token for
   * @returns Promise resolving to the generated token
   * @throws Error if user does not exist or token generation fails
   * @public
   */
  async generateConnectionToken(userId: number): Promise<string> {
    // Verify user exists
    const user = await this.db.get<{ id: number }>(
      "SELECT id FROM users WHERE id = ?",
      [userId]
    );

    if (!user) {
      throw new Error(`User with ID ${userId} not found`);
    }

    // Generate secure random token
    const token = crypto.randomBytes(32).toString("hex");

    // Calculate expiration time (10 minutes from now)
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + this.TOKEN_EXPIRY_MINUTES);

    // Store token in database
    await this.db.run(
      "INSERT INTO telegram_connection_tokens (token, user_id, expires_at) VALUES (?, ?, ?)",
      [token, userId, expiresAt.toISOString()]
    );

    console.log(
      `[${new Date().toISOString()}] TELEGRAM_CONNECTION | Generated connection token for userId: ${userId}, expires at: ${expiresAt.toISOString()}`
    );

    return token;
  }

  /**
   * Validate a connection token and return the associated user ID.
   * Token is deleted after validation (single-use).
   * @param token - The token to validate
   * @returns Promise resolving to user ID if token is valid, null otherwise
   * @public
   */
  async validateToken(token: string): Promise<{ userId: number } | null> {
    const row = await this.db.get<{
      token: string;
      user_id: number;
      expires_at: string;
    }>(
      "SELECT token, user_id, expires_at FROM telegram_connection_tokens WHERE token = ?",
      [token]
    );

    if (!row) {
      console.log(
        `[${new Date().toISOString()}] TELEGRAM_CONNECTION | Token validation failed: token not found`
      );
      return null;
    }

    // Check if token is expired
    const expiresAt = new Date(row.expires_at);
    const now = new Date();

    if (now > expiresAt) {
      console.log(
        `[${new Date().toISOString()}] TELEGRAM_CONNECTION | Token validation failed: token expired at ${expiresAt.toISOString()}`
      );
      // Delete expired token
      await this.db.run(
        "DELETE FROM telegram_connection_tokens WHERE token = ?",
        [token]
      );
      return null;
    }

    // Token is valid - delete it (single-use) and return user ID
    await this.db.run(
      "DELETE FROM telegram_connection_tokens WHERE token = ?",
      [token]
    );

    console.log(
      `[${new Date().toISOString()}] TELEGRAM_CONNECTION | Token validated successfully for userId: ${
        row.user_id
      }`
    );

    return { userId: row.user_id };
  }

  /**
   * Check if user has an active (non-expired) connection token.
   * @param userId - The user ID to check
   * @returns Promise resolving to true if user has active token, false otherwise
   * @public
   */
  async hasActiveToken(userId: number): Promise<boolean> {
    const now = new Date().toISOString();
    const result = await this.db.get<{ count: number }>(
      "SELECT COUNT(*) as count FROM telegram_connection_tokens WHERE user_id = ? AND expires_at > ?",
      [userId, now]
    );
    return (result?.count ?? 0) > 0;
  }

  /**
   * Cancel all active connection tokens for a user.
   * Used when user cancels the connection process.
   * @param userId - The user ID to cancel tokens for
   * @returns Promise resolving when cancellation is complete
   * @public
   */
  async cancelActiveTokens(userId: number): Promise<void> {
    const now = new Date().toISOString();

    const result = await this.db.run(
      "DELETE FROM telegram_connection_tokens WHERE user_id = ? AND expires_at > ?",
      [userId, now]
    );

    if (result.changes > 0) {
      console.log(
        `[${new Date().toISOString()}] TELEGRAM_CONNECTION | Cancelled ${
          result.changes
        } active token(s) for userId: ${userId}`
      );
    }
  }

  /**
   * Clean up expired tokens from the database.
   * Should be called periodically to prevent database bloat.
   * @returns Promise resolving when cleanup is complete
   * @public
   */
  async cleanupExpiredTokens(): Promise<void> {
    const now = new Date().toISOString();

    const result = await this.db.run(
      "DELETE FROM telegram_connection_tokens WHERE expires_at < ?",
      [now]
    );

    if (result.changes > 0) {
      console.log(
        `[${new Date().toISOString()}] TELEGRAM_CONNECTION | Cleaned up ${
          result.changes
        } expired token(s)`
      );
    }
  }
}
