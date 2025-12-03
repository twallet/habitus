import { Router, Request, Response } from "express";
import { ServiceManager } from "../services/index.js";
import {
  authenticateToken,
  AuthRequest,
} from "../middleware/authMiddleware.js";
import {
  uploadProfilePicture,
  getUploadsDirectory,
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

      // Store uploaded file path for cleanup in case of error
      if (file) {
        const uploadsDir = getUploadsDirectory();
        uploadedFilePath = path.join(uploadsDir, file.filename);
      }

      // Build profile picture URL if file was uploaded, or set to null if removing
      let profilePictureUrl: string | null | undefined;
      if (removeProfilePicture === "true" || removeProfilePicture === true) {
        // Explicitly set to null to indicate removal
        profilePictureUrl = null;
      } else if (file) {
        profilePictureUrl = `${ServerConfig.getServerUrl()}:${ServerConfig.getPort()}/uploads/${
          file.filename
        }`;
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
