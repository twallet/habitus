import { Router, Request, Response } from "express";
import { AuthService } from "../services/authService.js";

const router = Router();

/**
 * POST /api/auth/register
 * Register a new user.
 * @route POST /api/auth/register
 * @body {string} name - The user's name
 * @body {string} email - The user's email
 * @body {string} password - The user's password (must meet robust requirements)
 * @returns {UserData} The created user (without password)
 */
router.post("/register", async (req: Request, res: Response) => {
  try {
    const { name, email, password } = req.body;

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

    if (!password || typeof password !== "string") {
      return res
        .status(400)
        .json({ error: "Password is required and must be a string" });
    }

    const user = await AuthService.register(name, email, password);
    res.status(201).json(user);
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
    console.error("Error registering user:", error);
    res.status(500).json({ error: "Error registering user" });
  }
});

/**
 * POST /api/auth/login
 * Login a user with email and password.
 * @route POST /api/auth/login
 * @body {string} email - The user's email
 * @body {string} password - The user's password
 * @returns {Object} Object containing user data and JWT token
 */
router.post("/login", async (req: Request, res: Response) => {
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
    console.error("Error logging in user:", error);
    res.status(500).json({ error: "Error logging in user" });
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
 * GET /api/auth/google
 * Initiate Google OAuth flow.
 * Redirects user to Google consent screen.
 * @route GET /api/auth/google
 */
router.get("/google", (_req: Request, res: Response) => {
  try {
    const authUrl = AuthService.getGoogleAuthUrl();
    res.redirect(authUrl);
  } catch (error) {
    console.error("Error initiating Google OAuth:", error);
    const errorMessage =
      error instanceof Error && error.message.includes("not configured")
        ? error.message
        : "Error initiating Google OAuth. Please check server configuration.";
    res.status(500).json({ error: errorMessage });
  }
});

/**
 * GET /api/auth/google/callback
 * Handle Google OAuth callback.
 * Exchanges authorization code for user info and creates/logs in user.
 * @route GET /api/auth/google/callback
 * @query {string} code - Authorization code from Google
 */
router.get("/google/callback", async (req: Request, res: Response) => {
  try {
    const { code } = req.query;

    if (!code || typeof code !== "string") {
      return res.status(400).json({ error: "Authorization code required" });
    }

    const result = await AuthService.handleGoogleCallback(code);
    res.redirect(result.redirectUrl);
  } catch (error) {
    console.error("Error handling Google OAuth callback:", error);
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    res.redirect(
      `${frontendUrl}/auth/callback?error=${encodeURIComponent(
        error instanceof Error ? error.message : "OAuth error"
      )}`
    );
  }
});

export default router;
