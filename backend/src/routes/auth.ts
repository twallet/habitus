import { Router, Request, Response } from "express";
import { getAuthService } from "../services/index.js";
import { uploadProfilePicture } from "../middleware/upload.js";
import { authRateLimiter } from "../middleware/rateLimiter.js";
import { SERVER_URL, PORT } from "../config/constants.js";

const router = Router();
// Lazy-load service to allow dependency injection in tests
const getAuthServiceInstance = () => getAuthService();

/**
 * POST /api/auth/register
 * Request registration magic link (passwordless).
 * @route POST /api/auth/register
 * @body {string} name - The user's name
 * @body {string} email - The user's email
 * @body {string} nickname - Optional nickname
 * @body {File} profilePicture - Optional profile picture file (image only, max 5MB)
 * @returns {Object} Success message
 */
router.post(
  "/register",
  authRateLimiter,
  uploadProfilePicture,
  async (req: Request, res: Response) => {
    try {
      const { name, email, nickname } = req.body;
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
        profilePictureUrl = `${SERVER_URL}:${PORT}/uploads/${file.filename}`;
      }

      await getAuthServiceInstance().requestRegisterMagicLink(
        name,
        email,
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
      if (
        error instanceof Error &&
        error.message.includes("wait") &&
        error.message.includes("minutes")
      ) {
        return res.status(400).json({ error: error.message });
      }
      console.error(
        `[${new Date().toISOString()}] AUTH_ROUTE | Error requesting registration magic link:`,
        error
      );
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
router.post("/login", authRateLimiter, async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email || typeof email !== "string") {
      return res
        .status(400)
        .json({ error: "Email is required and must be a string" });
    }

    await getAuthServiceInstance().requestLoginMagicLink(email);

    // Always return success to prevent email enumeration
    // Message doesn't reveal whether email exists or not
    res.json({
      message:
        "If an account exists for this email, a magic link has been sent. Please check your inbox and spam folder.",
    });
  } catch (error) {
    // Check if it's a cooldown error - log it but still return success
    // to prevent email enumeration attacks
    if (
      error instanceof Error &&
      error.message.includes("wait") &&
      error.message.includes("minutes")
    ) {
      console.warn(
        `[${new Date().toISOString()}] AUTH_ROUTE | Magic link cooldown active for email: ${
          req.body.email
        }`,
        error.message
      );
      // Still return success to prevent email enumeration
      res.json({
        message:
          "If an account exists for this email, a magic link has been sent. Please check your inbox and spam folder.",
      });
      return;
    }

    console.error(
      `[${new Date().toISOString()}] AUTH_ROUTE | Error requesting login magic link:`,
      error
    );
    // Still return success to prevent email enumeration
    // Message doesn't reveal whether email exists or not
    res.json({
      message:
        "If an account exists for this email, a magic link has been sent. Please check your inbox and spam folder.",
    });
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

    const result = await getAuthServiceInstance().verifyMagicLink(token);
    res.json(result);
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes("Invalid") || error.message.includes("expired"))
    ) {
      return res.status(400).json({ error: error.message });
    }
    console.error(
      `[${new Date().toISOString()}] AUTH_ROUTE | Error verifying magic link:`,
      error
    );
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
    const authServiceInstance = getAuthServiceInstance();
    const userId = await authServiceInstance.verifyToken(token);
    const user = await authServiceInstance.getUserById(userId);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(user);
  } catch (error) {
    if (error instanceof Error && error.message.includes("token")) {
      return res.status(401).json({ error: error.message });
    }
    console.error(
      `[${new Date().toISOString()}] AUTH_ROUTE | Error fetching user:`,
      error
    );
    res.status(500).json({ error: "Error fetching user" });
  }
});

export default router;
