import { Router, Request, Response } from "express";
import { AuthService } from "../services/authService.js";
import { uploadProfilePicture } from "../middleware/upload.js";
import {
  authenticateToken,
  AuthRequest,
} from "../middleware/authMiddleware.js";

const router = Router();

/**
 * POST /api/auth/register
 * Request registration magic link (passwordless).
 * @route POST /api/auth/register
 * @body {string} name - The user's name
 * @body {string} email - The user's email
 * @body {string} nickname - Optional nickname
 * @body {string} password - Optional password (if user wants to set one)
 * @body {File} profilePicture - Optional profile picture file (image only, max 5MB)
 * @returns {Object} Success message
 */
router.post(
  "/register",
  uploadProfilePicture,
  async (req: Request, res: Response) => {
    try {
      const { name, email, nickname, password } = req.body;
      const file = req.file;

      if (!name || typeof name !== "string") {
        return res
          .status(400)
          .json({ error: "Name is required and must be a string" });
      }

      if (!email || typeof email !== "string") {
        return res
          .status(400)
          .json({ error: "Email is required and must be a string" });
      }

      // Build profile picture URL if file was uploaded
      let profilePictureUrl: string | undefined;
      if (file) {
        const baseUrl =
          process.env.BASE_URL ||
          `http://localhost:${process.env.PORT || 3001}`;
        profilePictureUrl = `${baseUrl}/uploads/${file.filename}`;
      }

      await AuthService.requestRegisterMagicLink(
        name,
        email,
        password,
        nickname,
        profilePictureUrl
      );

      res.json({
        message:
          "Registration magic link sent to your email. Please check your inbox.",
      });
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
      console.error("Error requesting registration magic link:", error);
      res
        .status(500)
        .json({ error: "Error requesting registration magic link" });
    }
  }
);

/**
 * POST /api/auth/login
 * Request login magic link (passwordless).
 * @route POST /api/auth/login
 * @body {string} email - The user's email
 * @returns {Object} Success message
 */
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email || typeof email !== "string") {
      return res
        .status(400)
        .json({ error: "Email is required and must be a string" });
    }

    await AuthService.requestLoginMagicLink(email);

    // Always return success to prevent email enumeration
    res.json({
      message:
        "If an account exists, a magic link has been sent to your email.",
    });
  } catch (error) {
    console.error("Error requesting login magic link:", error);
    // Still return success to prevent email enumeration
    res.json({
      message:
        "If an account exists, a magic link has been sent to your email.",
    });
  }
});

/**
 * POST /api/auth/login-password
 * Login a user with email and password (optional, for users who set a password).
 * @route POST /api/auth/login-password
 * @body {string} email - The user's email
 * @body {string} password - The user's password
 * @returns {Object} Object containing user data and JWT token
 */
router.post("/login-password", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || typeof email !== "string") {
      return res
        .status(400)
        .json({ error: "Email is required and must be a string" });
    }

    if (!password || typeof password !== "string") {
      return res
        .status(400)
        .json({ error: "Password is required and must be a string" });
    }

    const result = await AuthService.login(email, password);
    res.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "Invalid credentials") {
      return res.status(401).json({ error: error.message });
    }
    if (
      error instanceof Error &&
      error.message === "Password not set. Please use magic link to login."
    ) {
      return res.status(400).json({ error: error.message });
    }
    console.error("Error logging in user:", error);
    res.status(500).json({ error: "Error logging in user" });
  }
});

/**
 * GET /api/auth/verify-magic-link
 * Verify magic link token and log user in.
 * @route GET /api/auth/verify-magic-link
 * @query {string} token - Magic link token
 * @returns {Object} Object containing user data and JWT token
 */
router.get("/verify-magic-link", async (req: Request, res: Response) => {
  try {
    const { token } = req.query;

    if (!token || typeof token !== "string") {
      return res.status(400).json({ error: "Token is required" });
    }

    const result = await AuthService.verifyMagicLink(token);
    res.json(result);
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes("Invalid") || error.message.includes("expired"))
    ) {
      return res.status(400).json({ error: error.message });
    }
    console.error("Error verifying magic link:", error);
    res.status(500).json({ error: "Error verifying magic link" });
  }
});

/**
 * GET /api/auth/me
 * Get current user information from JWT token.
 * @route GET /api/auth/me
 * @header {string} Authorization - Bearer token
 * @returns {UserData} The current user data
 */
router.get("/me", async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Authorization token required" });
    }

    const token = authHeader.substring(7);
    const userId = await AuthService.verifyToken(token);
    const user = await AuthService.getUserById(userId);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(user);
  } catch (error) {
    if (error instanceof Error && error.message.includes("token")) {
      return res.status(401).json({ error: error.message });
    }
    console.error("Error fetching user:", error);
    res.status(500).json({ error: "Error fetching user" });
  }
});

/**
 * POST /api/auth/change-password
 * Change password for authenticated user.
 * @route POST /api/auth/change-password
 * @header {string} Authorization - Bearer token
 * @body {string} currentPassword - Current password (required if password is set)
 * @body {string} newPassword - New password
 * @returns {Object} Success message
 */
router.post(
  "/change-password",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const { currentPassword, newPassword } = req.body;
      const userId = req.userId!;

      if (!newPassword || typeof newPassword !== "string") {
        return res
          .status(400)
          .json({ error: "New password is required and must be a string" });
      }

      await AuthService.changePassword(
        userId,
        currentPassword || "",
        newPassword
      );

      res.json({ message: "Password changed successfully" });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "Current password is incorrect"
      ) {
        return res.status(401).json({ error: error.message });
      }
      if (error instanceof TypeError) {
        return res.status(400).json({ error: error.message });
      }
      console.error("Error changing password:", error);
      res.status(500).json({ error: "Error changing password" });
    }
  }
);

/**
 * POST /api/auth/forgot-password
 * Request password reset email.
 * @route POST /api/auth/forgot-password
 * @body {string} email - The user's email
 * @returns {Object} Success message
 */
router.post("/forgot-password", async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email || typeof email !== "string") {
      return res
        .status(400)
        .json({ error: "Email is required and must be a string" });
    }

    await AuthService.forgotPassword(email);

    // Always return success to prevent email enumeration
    res.json({
      message:
        "If an account exists, a password reset link has been sent to your email.",
    });
  } catch (error) {
    console.error("Error requesting password reset:", error);
    // Still return success to prevent email enumeration
    res.json({
      message:
        "If an account exists, a password reset link has been sent to your email.",
    });
  }
});

/**
 * POST /api/auth/reset-password
 * Reset password with token.
 * @route POST /api/auth/reset-password
 * @body {string} token - Password reset token
 * @body {string} newPassword - New password
 * @returns {Object} Success message
 */
router.post("/reset-password", async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || typeof token !== "string") {
      return res.status(400).json({ error: "Token is required" });
    }

    if (!newPassword || typeof newPassword !== "string") {
      return res
        .status(400)
        .json({ error: "New password is required and must be a string" });
    }

    await AuthService.resetPassword(token, newPassword);

    res.json({ message: "Password reset successfully" });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes("Invalid") || error.message.includes("expired"))
    ) {
      return res.status(400).json({ error: error.message });
    }
    if (error instanceof TypeError) {
      return res.status(400).json({ error: error.message });
    }
    console.error("Error resetting password:", error);
    res.status(500).json({ error: "Error resetting password" });
  }
});

export default router;
