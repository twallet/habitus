import { Router, Request, Response } from "express";
import { ServiceManager } from "../services/index.js";
import {
  authenticateToken,
  AuthRequest,
} from "../middleware/authMiddleware.js";
import {
  uploadProfilePicture,
  getUploadsDirectory,
  isCloudinaryStorage,
} from "../middleware/upload.js";
import { ServerConfig } from "../setup/constants.js";
import fs from "fs";
import path from "path";

const router = Router();
// Lazy-load service to allow dependency injection in tests
const getUserServiceInstance = () => ServiceManager.getUserService();

/**
 * GET /api/users
 * Get all users.
 * @route GET /api/users
 * @returns {UserData[]} Array of users
 */
router.get("/", async (_req: Request, res: Response) => {
  try {
    const users = await getUserServiceInstance().getAllUsers();
    res.json(users);
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] USER_ROUTE | Error fetching users:`,
      error
    );
    res.status(500).json({ error: "Error fetching users" });
  }
});

/**
 * PUT /api/users/profile
 * Update authenticated user's profile.
 * @route PUT /api/users/profile
 * @header {string} Authorization - Bearer token
 * @body {string} name - Updated name (optional)
 * @body {File} profilePicture - Optional profile picture file (image only, max 5MB)
 * @returns {UserData} Updated user data
 */
router.put(
  "/profile",
  authenticateToken,
  uploadProfilePicture,
  async (req: AuthRequest, res: Response) => {
    const file = req.file;
    let uploadedFilePath: string | null = null;

    try {
      const userId = req.userId!;
      const { name, removeProfilePicture } = req.body;

      // Store uploaded file path for cleanup in case of error (local storage only)
      if (file && !isCloudinaryStorage()) {
        const uploadsDir = getUploadsDirectory();
        uploadedFilePath = path.join(uploadsDir, file.filename);
      }

      // Build profile picture URL if file was uploaded, or set to null if removing
      let profilePictureUrl: string | null | undefined;
      if (removeProfilePicture === "true" || removeProfilePicture === true) {
        // Explicitly set to null to indicate removal
        profilePictureUrl = null;
      } else if (file) {
        // Check if it's a Cloudinary URL (starts with https://res.cloudinary.com)
        // or if cloudinaryUrl property exists (set by upload middleware)
        if (
          file.filename.startsWith("https://res.cloudinary.com") ||
          (file as any).cloudinaryUrl
        ) {
          // Use Cloudinary URL directly
          profilePictureUrl = (file as any).cloudinaryUrl || file.filename;
        } else {
          // Use local file URL
          profilePictureUrl = `${ServerConfig.getServerUrl()}:${ServerConfig.getPort()}/uploads/${
            file.filename
          }`;
        }
      }
      // If neither file nor removeProfilePicture, profilePictureUrl remains undefined (no change)

      const user = await getUserServiceInstance().updateProfile(
        userId,
        name,
        profilePictureUrl
      );

      res.json(user);
    } catch (error) {
      // Clean up uploaded file if update failed
      if (uploadedFilePath) {
        try {
          if (fs.existsSync(uploadedFilePath)) {
            fs.unlinkSync(uploadedFilePath);
            console.log(
              `[${new Date().toISOString()}] USER_ROUTE | Cleaned up uploaded file after error: ${uploadedFilePath}`
            );
          }
        } catch (cleanupError) {
          console.error(
            `[${new Date().toISOString()}] USER_ROUTE | Error cleaning up uploaded file:`,
            cleanupError
          );
        }
      }

      if (error instanceof TypeError) {
        return res.status(400).json({ error: error.message });
      }
      if (
        error instanceof Error &&
        error.message === "Email already registered"
      ) {
        return res.status(409).json({ error: error.message });
      }
      if (
        error instanceof Error &&
        error.message.includes("Only image files")
      ) {
        return res.status(400).json({ error: error.message });
      }
      console.error(
        `[${new Date().toISOString()}] USER_ROUTE | Error updating profile:`,
        error
      );
      res.status(500).json({ error: "Error updating profile" });
    }
  }
);

/**
 * DELETE /api/users/profile
 * Delete authenticated user's account.
 * @route DELETE /api/users/profile
 * @header {string} Authorization - Bearer token
 * @returns {Object} Success message
 */
router.delete(
  "/profile",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;

      await getUserServiceInstance().deleteUser(userId);

      res.json({ message: "Account deleted successfully" });
    } catch (error) {
      if (error instanceof Error && error.message === "User not found") {
        return res.status(404).json({ error: error.message });
      }
      console.error(
        `[${new Date().toISOString()}] USER_ROUTE | Error deleting user:`,
        error
      );
      res.status(500).json({ error: "Error deleting user" });
    }
  }
);

/**
 * PUT /api/users/notifications
 * Update authenticated user's notification preferences.
 * @route PUT /api/users/notifications
 * @header {string} Authorization - Bearer token
 * @body {string} notificationChannel - Single notification channel (e.g., "Email" or "Telegram")
 * @body {string} telegramChatId - Optional Telegram chat ID (required if Telegram is selected)
 * @returns {UserData} Updated user data
 */
router.put(
  "/notifications",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const { notificationChannel, telegramChatId } = req.body;

      if (!notificationChannel) {
        return res
          .status(400)
          .json({ error: "notificationChannel is required" });
      }

      const user = await getUserServiceInstance().updateNotificationPreferences(
        userId,
        notificationChannel,
        telegramChatId
      );

      res.json(user);
    } catch (error) {
      if (error instanceof TypeError) {
        return res.status(400).json({ error: error.message });
      }
      if (error instanceof Error && error.message === "User not found") {
        return res.status(404).json({ error: error.message });
      }
      console.error(
        `[${new Date().toISOString()}] USER_ROUTE | Error updating notification preferences:`,
        error
      );
      res
        .status(500)
        .json({ error: "Error updating notification preferences" });
    }
  }
);

/**
 * PUT /api/users/preferences
 * Update authenticated user's locale and timezone preferences.
 * @route PUT /api/users/preferences
 * @header {string} Authorization - Bearer token
 * @body {string} locale - Optional locale (BCP 47 format like 'en-US', 'es-AR')
 * @body {string} timezone - Optional timezone (IANA timezone like 'America/Buenos_Aires')
 * @returns {UserData} Updated user data
 */
router.put(
  "/preferences",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const { locale, timezone } = req.body;

      const user = await getUserServiceInstance().updateLocaleAndTimezone(
        userId,
        locale,
        timezone
      );

      res.json(user);
    } catch (error) {
      if (error instanceof Error && error.message === "User not found") {
        return res.status(404).json({ error: error.message });
      }
      if (error instanceof Error && error.message === "No fields to update") {
        return res.status(400).json({ error: error.message });
      }
      console.error(
        `[${new Date().toISOString()}] USER_ROUTE | Error updating preferences:`,
        error
      );
      res.status(500).json({ error: "Error updating preferences" });
    }
  }
);

/**
 * GET /api/users/:id
 * Get a user by ID.
 * @route GET /api/users/:id
 * @param {number} id - The user ID
 * @returns {UserData} The user data
 */
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);

    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid user ID" });
    }

    const user = await getUserServiceInstance().getUserById(id);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(user);
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] USER_ROUTE | Error fetching user:`,
      error
    );
    res.status(500).json({ error: "Error fetching user" });
  }
});

export default router;
