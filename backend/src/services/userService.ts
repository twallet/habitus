import { Database } from "../db/database.js";
import { User, type UserData } from "../models/User.js";
import { getUploadsDirectory } from "../middleware/upload.js";
import { EmailService } from "./emailService.js";
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
    console.log(`[${new Date().toISOString()}] USER | Fetching all users`);

    const rows = await this.db.all<{
      id: number;
      name: string;
      email: string;
      profile_picture_url: string | null;
      last_access: string | null;
      created_at: string;
    }>(
      "SELECT id, name, email, profile_picture_url, last_access, created_at FROM users ORDER BY id"
    );

    console.log(
      `[${new Date().toISOString()}] USER | Retrieved ${
        rows.length
      } users from database`
    );

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      profile_picture_url: row.profile_picture_url || undefined,
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
    console.log(
      `[${new Date().toISOString()}] USER | Fetching user by ID: ${id}`
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
        `[${new Date().toISOString()}] USER | User not found for ID: ${id}`
      );
      return null;
    }

    console.log(
      `[${new Date().toISOString()}] USER | User found: ID ${row.id}, email: ${
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
    console.log(
      `[${new Date().toISOString()}] USER | Updating profile for userId: ${userId}, fields: ${JSON.stringify(
        {
          name: name !== undefined,
          profilePicture: profilePictureUrl !== undefined,
        }
      )}`
    );

    // Get current user data before updating to retrieve old profile picture URL
    const currentUser = await this.getUserById(userId);
    if (!currentUser) {
      console.warn(
        `[${new Date().toISOString()}] USER | Update failed: user not found for userId: ${userId}`
      );
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
            console.log(
              `[${new Date().toISOString()}] USER | Deleted old profile picture file: ${filename} for userId: ${userId}`
            );
          } else {
            console.warn(
              `[${new Date().toISOString()}] USER | Old profile picture file not found: ${filePath} for userId: ${userId}`
            );
          }
        } else {
          console.warn(
            `[${new Date().toISOString()}] USER | Invalid old profile picture URL format: ${
              currentUser.profile_picture_url
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
      console.warn(
        `[${new Date().toISOString()}] USER | Profile update failed: no fields to update for userId: ${userId}`
      );
      throw new Error("No fields to update");
    }

    // Add updated_at timestamp
    updates.push("updated_at = CURRENT_TIMESTAMP");
    values.push(userId);

    console.log(
      `[${new Date().toISOString()}] USER | Executing profile update query for userId: ${userId}`
    );

    // Update user
    await this.db.run(
      `UPDATE users SET ${updates.join(", ")} WHERE id = ?`,
      values
    );

    // Retrieve updated user
    const user = await this.getUserById(userId);
    if (!user) {
      console.error(
        `[${new Date().toISOString()}] USER | Failed to retrieve updated user for userId: ${userId}`
      );
      throw new Error("Failed to retrieve updated user");
    }

    console.log(
      `[${new Date().toISOString()}] USER | Profile updated successfully for userId: ${userId}`
    );

    return user;
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
    console.log(
      `[${new Date().toISOString()}] USER | Verifying email change with token`
    );

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
      console.warn(
        `[${new Date().toISOString()}] USER | Email verification failed: invalid token`
      );
      throw new Error("Invalid verification token");
    }

    // Check if token has expired
    if (user.email_verification_expires) {
      const expiresAt = new Date(user.email_verification_expires);
      const now = new Date();
      if (expiresAt < now) {
        console.warn(
          `[${new Date().toISOString()}] USER | Email verification failed: token expired for userId: ${
            user.id
          }`
        );
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
      console.warn(
        `[${new Date().toISOString()}] USER | Email verification failed: email already registered for userId: ${
          user.id
        }`
      );
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

    console.log(
      `[${new Date().toISOString()}] USER | Email verified and updated for userId: ${
        user.id
      }, new email: ${user.pending_email}`
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
    console.log(
      `[${new Date().toISOString()}] USER | Deleting user account for userId: ${userId}`
    );

    // Get user data before deletion to retrieve profile picture URL
    const user = await this.getUserById(userId);
    if (!user) {
      console.warn(
        `[${new Date().toISOString()}] USER | Delete failed: user not found for userId: ${userId}`
      );
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
            console.log(
              `[${new Date().toISOString()}] USER | Deleted profile picture file: ${filename} for userId: ${userId}`
            );
          } else {
            console.warn(
              `[${new Date().toISOString()}] USER | Profile picture file not found: ${filePath} for userId: ${userId}`
            );
          }
        } else {
          console.warn(
            `[${new Date().toISOString()}] USER | Invalid profile picture URL format: ${
              user.profile_picture_url
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
      console.warn(
        `[${new Date().toISOString()}] USER | Delete failed: user not found for userId: ${userId}`
      );
      throw new Error("User not found");
    }

    console.log(
      `[${new Date().toISOString()}] USER | User account deleted successfully for userId: ${userId}`
    );
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
    console.log(
      `[${new Date().toISOString()}] USER | Updated last_access timestamp for userId: ${userId}`
    );
  }
}
