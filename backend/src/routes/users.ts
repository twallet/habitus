import { Router, Request, Response } from "express";
import { UserService } from "../services/userService.js";
import {
  authenticateToken,
  AuthRequest,
} from "../middleware/authMiddleware.js";
import { uploadProfilePicture } from "../middleware/upload.js";

const router = Router();

/**
 * GET /api/users
 * Get all users.
 * @route GET /api/users
 * @returns {UserData[]} Array of users
 */
router.get("/", async (_req: Request, res: Response) => {
  try {
    const users = await UserService.getAllUsers();
    res.json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Error fetching users" });
  }
});

/**
 * PUT /api/users/profile
 * Update authenticated user's profile.
 * @route PUT /api/users/profile
 * @header {string} Authorization - Bearer token
 * @body {string} name - Updated name (optional)
 * @body {string} nickname - Updated nickname (optional)
 * @body {string} email - Updated email (optional)
 * @body {File} profilePicture - Optional profile picture file (image only, max 5MB)
 * @returns {UserData} Updated user data
 */
router.put(
  "/profile",
  authenticateToken,
  uploadProfilePicture,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const { name, nickname, email } = req.body;
      const file = req.file;

      // Build profile picture URL if file was uploaded
      let profilePictureUrl: string | undefined;
      if (file) {
        const baseUrl =
          process.env.BASE_URL ||
          `http://localhost:${process.env.PORT || 3001}`;
        profilePictureUrl = `${baseUrl}/uploads/${file.filename}`;
      }

      const user = await UserService.updateProfile(
        userId,
        name,
        nickname,
        email,
        profilePictureUrl
      );

      res.json(user);
    } catch (error) {
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
      console.error("Error updating profile:", error);
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

      await UserService.deleteUser(userId);

      res.json({ message: "Account deleted successfully" });
    } catch (error) {
      if (error instanceof Error && error.message === "User not found") {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error deleting user:", error);
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

    const user = await UserService.getUserById(id);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(user);
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ error: "Error fetching user" });
  }
});

export default router;
