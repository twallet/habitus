import { Database } from "../db/database.js";
import { User, type UserData } from "../models/User.js";
import { getUploadsDirectory } from "../middleware/upload.js";
import { EmailService } from "./emailService.js";
import { Logger } from "../setup/logger.js";
import fs from "fs";
import path from "path";

/**
 * Service for user-related database operations.
 * @public
 */
export class UserService {
  private db: Database;

  /**
   * Create a new UserService instance.
   * @param db - Database instance
   * @public
   */
  constructor(db: Database) {
    this.db = db;
  }

  /**
   * Get all users from the database.
   * @returns Promise resolving to array of user data
   * @public
   */
  async getAllUsers(): Promise<UserData[]> {
    Logger.debug("USER | Fetching all users");

    const rows = await this.db.all<{
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
      "SELECT id, name, email, profile_picture_url, telegram_chat_id, notification_channels, locale, timezone, last_access, created_at FROM users ORDER BY id"
    );

    Logger.debug(`USER | Retrieved ${rows.length} users from database`);

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      profile_picture_url: row.profile_picture_url || undefined,
      telegram_chat_id: row.telegram_chat_id || undefined,
      notification_channels: row.notification_channels || undefined,
      locale: row.locale || undefined,
      timezone: row.timezone || undefined,
      last_access: row.last_access || undefined,
      created_at: row.created_at,
    }));
  }

  /**
   * Get a user by ID.
   * @param id - The user ID
   * @returns Promise resolving to user data or null if not found
   * @public
   */
  async getUserById(id: number): Promise<UserData | null> {
    Logger.debug(`USER | Fetching user by ID: ${id}`);

    const row = await this.db.get<{
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
      Logger.debug(`USER | User not found for ID: ${id}`);
      return null;
    }

    Logger.verbose(`USER | User found: ID ${row.id}, email: ${row.email}`);

    return {
      id: row.id,
      name: row.name,
      email: row.email,
      profile_picture_url: row.profile_picture_url || undefined,
      telegram_chat_id: row.telegram_chat_id || undefined,
      notification_channels: row.notification_channels || undefined,
      locale: row.locale || undefined,
      timezone: row.timezone || undefined,
      last_access: row.last_access || undefined,
      created_at: row.created_at,
    };
  }

  /**
   * Get a user by Telegram chat ID.
   * @param chatId - The Telegram chat ID
   * @returns Promise resolving to user data or null if not found
   * @public
   */
  async getUserByTelegramChatId(chatId: string): Promise<UserData | null> {
    Logger.debug(`USER | Fetching user by Telegram chat ID: ${chatId}`);

    const row = await this.db.get<{
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
      "SELECT id, name, email, profile_picture_url, telegram_chat_id, notification_channels, locale, timezone, last_access, created_at FROM users WHERE telegram_chat_id = ?",
      [chatId]
    );

    if (!row) {
      Logger.debug(`USER | User not found for Telegram chat ID: ${chatId}`);
      return null;
    }

    Logger.verbose(`USER | User found: ID ${row.id}, Telegram chat ID: ${row.telegram_chat_id}`);

    return {
      id: row.id,
      name: row.name,
      email: row.email,
      profile_picture_url: row.profile_picture_url || undefined,
      telegram_chat_id: row.telegram_chat_id || undefined,
      notification_channels: row.notification_channels || undefined,
      locale: row.locale || undefined,
      timezone: row.timezone || undefined,
      last_access: row.last_access || undefined,
      created_at: row.created_at,
    };
  }

  /**
   * Update user profile.
   * @param userId - The user ID
   * @param name - Updated name (optional)
   * @param profilePictureUrl - Updated profile picture URL (optional). Use null to remove, undefined to keep unchanged, or string to set new URL
   * @returns Promise resolving to updated user data
   * @throws Error if user not found or validation fails
   * @public
   */
  async updateProfile(
    userId: number,
    name?: string,
    profilePictureUrl?: string | null
  ): Promise<UserData> {
    Logger.info(`USER | Updating profile for userId: ${userId}`);

    // Get current user data before updating to retrieve old profile picture URL
    const currentUser = await this.getUserById(userId);
    if (!currentUser) {
      Logger.warn(`USER | Update failed: user not found for userId: ${userId}`);
      throw new Error("User not found");
    }

    // Delete old profile picture file if a new one is being uploaded or if explicitly removing
    // profilePictureUrl can be: undefined (no change), null (remove), or string (new file)
    if (profilePictureUrl !== undefined && currentUser.profile_picture_url) {
      try {
        // Extract filename from URL (e.g., "${VITE_SERVER_URL}:${VITE_PORT}/uploads/filename.jpg" -> "filename.jpg")
        const urlParts = currentUser.profile_picture_url.split("/uploads/");
        if (urlParts.length === 2) {
          // Extract filename and remove query parameters and fragments (e.g., "filename.jpg?v=1#section" -> "filename.jpg")
          let filename = urlParts[1].split("?")[0].split("#")[0];
          // Remove any path traversal attempts for security
          filename = path.basename(filename);

          const uploadsDir = getUploadsDirectory();
          const filePath = path.join(uploadsDir, filename);

          // Check if file exists and delete it
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            Logger.info(`USER | Deleted old profile picture file: ${filename} for userId: ${userId}`);
          } else {
            Logger.warn(`USER | Old profile picture file not found: ${filePath} for userId: ${userId}`);
          }
        } else {
          console.warn(
            `[${new Date().toISOString()}] USER | Invalid old profile picture URL format: ${currentUser.profile_picture_url
            } for userId: ${userId}`
          );
        }
      } catch (error) {
        // Log error but don't fail profile update if file deletion fails
        console.error(
          `[${new Date().toISOString()}] USER | Error deleting old profile picture file for userId: ${userId}:`,
          error
        );
      }
    }

    // Build update fields
    const updates: string[] = [];
    const values: any[] = [];

    if (name !== undefined) {
      const validatedName = User.validateName(name);
      updates.push("name = ?");
      values.push(validatedName);
    }

    if (profilePictureUrl !== undefined) {
      updates.push("profile_picture_url = ?");
      values.push(profilePictureUrl || null);
    }

    if (updates.length === 0) {
      Logger.warn(`USER | Profile update failed: no fields to update for userId: ${userId}`);
      throw new Error("No fields to update");
    }

    // Add updated_at timestamp
    updates.push("updated_at = CURRENT_TIMESTAMP");
    values.push(userId);

    Logger.debug(`USER | Executing profile update query for userId: ${userId}`);

    // Update user
    await this.db.run(
      `UPDATE users SET ${updates.join(", ")} WHERE id = ?`,
      values
    );

    // Retrieve updated user
    const user = await this.getUserById(userId);
    if (!user) {
      Logger.error(`USER | Failed to retrieve updated user for userId: ${userId}`);
      throw new Error("Failed to retrieve updated user");
    }

    Logger.info(`USER | Profile updated successfully for userId: ${userId}`);

    return user;
  }

  /**
   * Update notification preferences for a user.
   * @param userId - The user ID
   * @param notificationChannel - Single notification channel (e.g., "Email" or "Telegram")
   * @param telegramChatId - Optional Telegram chat ID (required if Telegram is selected)
   * @returns Promise resolving to updated user data
   * @throws Error if user not found or validation fails
   * @public
   */
  async updateNotificationPreferences(
    userId: number,
    notificationChannel: string,
    telegramChatId?: string
  ): Promise<UserData> {
    Logger.info(`USER | Updating notification preferences for userId: ${userId}`);

    // Validate notification channel
    const validChannels = ["Email", "Telegram"];
    if (!validChannels.includes(notificationChannel)) {
      throw new TypeError(
        `Invalid notification channel: ${notificationChannel}. Valid channels are: ${validChannels.join(
          ", "
        )}`
      );
    }

    // Get current user
    const user = await User.loadById(userId, this.db);
    if (!user) {
      Logger.warn(`USER | Update notification preferences failed: user not found for userId: ${userId}`);
      throw new Error("User not found");
    }

    // Validate that Telegram chat ID is available if Telegram is enabled
    // Either a new one must be provided, or an existing one must be present
    if (notificationChannel === "Telegram") {
      const hasTelegramChatId =
        (telegramChatId && telegramChatId.trim() !== "") ||
        (user.telegram_chat_id && user.telegram_chat_id.trim() !== "");

      if (!hasTelegramChatId) {
        throw new TypeError(
          "Telegram chat ID is required when Telegram notifications are enabled"
        );
      }
    }

    // Update notification preferences
    // If Telegram is selected, use provided telegramChatId or keep existing
    // If Email is selected, keep the existing telegram_chat_id (don't clear it)
    // This allows users to switch between Email and Telegram without losing their connection
    const updates: Partial<UserData> = {
      notification_channels: notificationChannel,
    };

    // Only update telegram_chat_id if Telegram is selected and a new ID is provided
    if (notificationChannel === "Telegram" && telegramChatId) {
      updates.telegram_chat_id = telegramChatId;
    }

    await user.update(updates, this.db);

    // Retrieve updated user
    const updatedUser = await this.getUserById(userId);
    if (!updatedUser) {
      Logger.error(`USER | Failed to retrieve updated user for userId: ${userId}`);
      throw new Error("Failed to retrieve updated user");
    }

    Logger.info(`USER | Notification preferences updated successfully for userId: ${userId}`);

    return updatedUser;
  }

  /**
   * Disconnect Telegram account for a user.
   * Clears the telegram_chat_id and switches to Email notifications.
   * @param userId - The user ID
   * @returns Promise resolving to updated user data
   * @throws Error if user not found
   * @public
   */
  async disconnectTelegram(userId: number): Promise<UserData> {
    Logger.info(`USER | Disconnecting Telegram for userId: ${userId}`);

    // Get current user
    const user = await User.loadById(userId, this.db);
    if (!user) {
      Logger.warn(`USER | Disconnect Telegram failed: user not found for userId: ${userId}`);
      throw new Error("User not found");
    }

    // Clear Telegram connection and switch to Email
    await user.update(
      {
        telegram_chat_id: "",
        notification_channels: "Email",
      },
      this.db
    );

    // Retrieve updated user
    const updatedUser = await this.getUserById(userId);
    if (!updatedUser) {
      Logger.error(`USER | Failed to retrieve updated user after disconnecting Telegram for userId: ${userId}`);
      throw new Error("Failed to retrieve updated user");
    }

    Logger.info(`USER | Telegram disconnected successfully for userId: ${userId}`);

    return updatedUser;
  }

  /**
   * Update locale and timezone preferences for a user.
   * @param userId - The user ID
   * @param locale - Optional locale (BCP 47 format like 'en-US', 'es-AR')
   * @param timezone - Optional timezone (IANA timezone like 'America/Buenos_Aires')
   * @returns Promise resolving to updated user data
   * @throws Error if user not found
   * @public
   */
  async updateLocaleAndTimezone(
    userId: number,
    locale?: string,
    timezone?: string
  ): Promise<UserData> {
    Logger.info(`USER | Updating locale/timezone for userId: ${userId}`);

    // Get current user
    const user = await User.loadById(userId, this.db);
    if (!user) {
      Logger.warn(`USER | Update locale/timezone failed: user not found for userId: ${userId}`);
      throw new Error("User not found");
    }

    // Build update object
    // Use type assertion to allow null values for clearing fields
    const updates = {} as Partial<UserData> & {
      locale?: string | null;
      timezone?: string | null;
    };
    if (locale !== undefined) {
      // Convert empty string to null to explicitly clear the field
      (updates as any).locale = locale === "" ? null : locale || undefined;
    }
    if (timezone !== undefined) {
      // Convert empty string to null to explicitly clear the field
      (updates as any).timezone =
        timezone === "" ? null : timezone || undefined;
    }

    if (Object.keys(updates).length === 0) {
      console.warn(
        `[${new Date().toISOString()}] USER | Update locale/timezone failed: no fields to update for userId: ${userId}`
      );
      throw new Error("No fields to update");
    }

    // Update user
    await user.update(updates, this.db);

    // Retrieve updated user
    const updatedUser = await this.getUserById(userId);
    if (!updatedUser) {
      Logger.error(`USER | Failed to retrieve updated user for userId: ${userId}`);
      throw new Error("Failed to retrieve updated user");
    }

    Logger.info(`USER | Locale/timezone updated successfully for userId: ${userId}`);

    return updatedUser;
  }

  /**
   * Verify email change using verification token.
   * Updates user's email from pending_email to email if token is valid.
   * @param token - Email verification token
   * @returns Promise resolving to updated user data
   * @throws Error if token is invalid or expired
   * @public
   */
  async verifyEmailChange(token: string): Promise<UserData> {
    Logger.info("USER | Verifying email change with token");

    // Find user with this verification token
    const user = await this.db.get<{
      id: number;
      pending_email: string | null;
      email_verification_expires: string | null;
    }>(
      "SELECT id, pending_email, email_verification_expires FROM users WHERE email_verification_token = ?",
      [token]
    );

    if (!user || !user.pending_email) {
      Logger.warn("USER | Email verification failed: invalid token");
      throw new Error("Invalid verification token");
    }

    // Check if token has expired
    if (user.email_verification_expires) {
      const expiresAt = new Date(user.email_verification_expires);
      const now = new Date();
      if (expiresAt < now) {
        Logger.warn(`USER | Email verification failed: token expired for userId: ${user.id}`);
        // Clear expired token
        await this.db.run(
          "UPDATE users SET pending_email = NULL, email_verification_token = NULL, email_verification_expires = NULL WHERE id = ?",
          [user.id]
        );
        throw new Error("Verification token has expired");
      }
    }

    // Check if pending email is already taken
    const existingUser = await this.db.get<{ id: number }>(
      "SELECT id FROM users WHERE email = ? AND id != ?",
      [user.pending_email, user.id]
    );

    if (existingUser) {
      Logger.warn(`USER | Email verification failed: email already registered for userId: ${user.id}`);
      // Clear pending email
      await this.db.run(
        "UPDATE users SET pending_email = NULL, email_verification_token = NULL, email_verification_expires = NULL WHERE id = ?",
        [user.id]
      );
      throw new Error("Email already registered");
    }

    // Update email and clear verification fields
    await this.db.run(
      "UPDATE users SET email = ?, pending_email = NULL, email_verification_token = NULL, email_verification_expires = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [user.pending_email, user.id]
    );

    Logger.info(
      `USER | Email verified and updated for userId: ${user.id}, new email: ${user.pending_email}`
    );

    // Retrieve updated user
    const updatedUser = await this.getUserById(user.id);
    if (!updatedUser) {
      throw new Error("Failed to retrieve updated user");
    }

    return updatedUser;
  }

  /**
   * Delete a user by ID.
   * Also deletes the user's profile picture file if it exists.
   * @param userId - The user ID to delete
   * @returns Promise resolving when user is deleted
   * @throws Error if user not found
   * @public
   */
  async deleteUser(userId: number): Promise<void> {
    Logger.info(`USER | Deleting user account for userId: ${userId}`);

    // Get user data before deletion to retrieve profile picture URL
    const user = await this.getUserById(userId);
    if (!user) {
      Logger.warn(`USER | Delete failed: user not found for userId: ${userId}`);
      throw new Error("User not found");
    }

    // Delete profile picture file if it exists
    if (user.profile_picture_url) {
      try {
        // Extract filename from URL (e.g., "${VITE_SERVER_URL}:${VITE_PORT}/uploads/filename.jpg" -> "filename.jpg")
        const urlParts = user.profile_picture_url.split("/uploads/");
        if (urlParts.length === 2) {
          // Extract filename and remove query parameters and fragments (e.g., "filename.jpg?v=1#section" -> "filename.jpg")
          let filename = urlParts[1].split("?")[0].split("#")[0];
          // Remove any path traversal attempts for security
          filename = path.basename(filename);

          const uploadsDir = getUploadsDirectory();
          const filePath = path.join(uploadsDir, filename);

          // Check if file exists and delete it
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            Logger.info(`USER | Deleted profile picture file: ${filename} for userId: ${userId}`);
          } else {
            Logger.warn(`USER | Profile picture file not found: ${filePath} for userId: ${userId}`);
          }
        } else {
          console.warn(
            `[${new Date().toISOString()}] USER | Invalid profile picture URL format: ${user.profile_picture_url
            } for userId: ${userId}`
          );
        }
      } catch (error) {
        // Log error but don't fail user deletion if file deletion fails
        console.error(
          `[${new Date().toISOString()}] USER | Error deleting profile picture file for userId: ${userId}:`,
          error
        );
      }
    }

    // Delete user from database
    const result = await this.db.run("DELETE FROM users WHERE id = ?", [
      userId,
    ]);

    if (result.changes === 0) {
      Logger.warn(`USER | Delete failed: user not found for userId: ${userId}`);
      throw new Error("User not found");
    }

    Logger.info(`USER | User account deleted successfully for userId: ${userId}`);
  }

  /**
   * Update last access timestamp for a user.
   * @param userId - The user ID
   * @returns Promise resolving when last access is updated
   * @public
   */
  async updateLastAccess(userId: number): Promise<void> {
    await this.db.run(
      "UPDATE users SET last_access = CURRENT_TIMESTAMP WHERE id = ?",
      [userId]
    );
    Logger.debug(`USER | Updated last_access timestamp for userId: ${userId}`);
  }
}
