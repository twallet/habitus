import { Database } from "../db/database.js";
import { User, UserData } from "../models/User.js";
import { getUploadsDirectory } from "../middleware/upload.js";
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
      nickname: string | null;
      email: string;
      profile_picture_url: string | null;
      last_access: string | null;
      created_at: string;
    }>(
      "SELECT id, name, nickname, email, profile_picture_url, last_access, created_at FROM users ORDER BY id"
    );

    console.log(
      `[${new Date().toISOString()}] USER | Retrieved ${
        rows.length
      } users from database`
    );

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      nickname: row.nickname || undefined,
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
      nickname: row.nickname || undefined,
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
   * @param nickname - Updated nickname (optional)
   * @param email - Updated email (optional)
   * @param profilePictureUrl - Updated profile picture URL (optional)
   * @returns Promise resolving to updated user data
   * @throws Error if user not found or validation fails
   * @public
   */
  async updateProfile(
    userId: number,
    name?: string,
    nickname?: string,
    email?: string,
    profilePictureUrl?: string
  ): Promise<UserData> {
    console.log(
      `[${new Date().toISOString()}] USER | Updating profile for userId: ${userId}, fields: ${JSON.stringify(
        {
          name: name !== undefined,
          nickname: nickname !== undefined,
          email: email !== undefined,
          profilePicture: profilePictureUrl !== undefined,
        }
      )}`
    );

    // Build update fields
    const updates: string[] = [];
    const values: any[] = [];

    if (name !== undefined) {
      const validatedName = User.validateName(name);
      updates.push("name = ?");
      values.push(validatedName);
    }

    if (nickname !== undefined) {
      const validatedNickname = User.validateNickname(nickname);
      updates.push("nickname = ?");
      values.push(validatedNickname || null);
    }

    if (email !== undefined) {
      const validatedEmail = User.validateEmail(email);

      // Check if email is already taken by another user
      const existingUser = await this.db.get<{ id: number }>(
        "SELECT id FROM users WHERE email = ? AND id != ?",
        [validatedEmail, userId]
      );

      if (existingUser) {
        console.warn(
          `[${new Date().toISOString()}] USER | Profile update failed: email already registered for userId: ${userId}`
        );
        throw new Error("Email already registered");
      }

      updates.push("email = ?");
      values.push(validatedEmail);
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
        // Extract filename from URL (e.g., "http://localhost:3001/uploads/filename.jpg" or "${SERVER_URL}:${PORT}/uploads/filename.jpg" -> "filename.jpg")
        const urlParts = user.profile_picture_url.split("/uploads/");
        if (urlParts.length === 2) {
          const filename = urlParts[1];
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
