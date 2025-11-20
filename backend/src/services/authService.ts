import bcrypt from "bcrypt";
import jwt, { SignOptions } from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import { dbPromises } from "../db/database.js";
import { User, UserData, UserWithPassword } from "../models/User.js";

/**
 * JWT secret key from environment variable or default.
 * @private
 */
const JWT_SECRET =
  process.env.JWT_SECRET || "your-secret-key-change-in-production";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

/**
 * Google OAuth 2.0 client configuration.
 * @private
 */
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const GOOGLE_REDIRECT_URI =
  process.env.GOOGLE_REDIRECT_URI ||
  "http://localhost:3001/api/auth/google/callback";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

/**
 * Get or create Google OAuth 2.0 client instance.
 * Validates that credentials are configured.
 * @returns OAuth2Client instance
 * @throws Error if Google OAuth credentials are not configured
 * @private
 */
function getGoogleOAuthClient(): OAuth2Client {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new Error(
      "Google OAuth credentials not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables."
    );
  }
  return new OAuth2Client(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
  );
}

/**
 * Service for authentication-related operations.
 * @public
 */
export class AuthService {
  /**
   * Register a new user.
   * @param name - User's name
   * @param email - User's email
   * @param password - User's password (will be hashed)
   * @returns Promise resolving to the created user data (without password)
   * @throws Error if email already exists or validation fails
   * @public
   */
  static async register(
    name: string,
    email: string,
    password: string
  ): Promise<UserData> {
    // Validate inputs
    const validatedName = User.validateName(name);
    const validatedEmail = User.validateEmail(email);
    User.validatePassword(password);

    // Check if user with email already exists
    const existingUser = await dbPromises.get<UserWithPassword>(
      "SELECT id FROM users WHERE email = ?",
      [validatedEmail]
    );

    if (existingUser) {
      throw new Error("Email already registered");
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user
    const result = await dbPromises.run(
      "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)",
      [validatedName, validatedEmail, passwordHash]
    );

    // Retrieve created user
    const row = await dbPromises.get<{
      id: number;
      name: string;
      email: string;
      created_at: string;
    }>("SELECT id, name, email, created_at FROM users WHERE id = ?", [
      result.lastID,
    ]);

    if (!row) {
      throw new Error("Failed to retrieve created user");
    }

    return {
      id: row.id,
      name: row.name,
      email: row.email,
      created_at: row.created_at,
    };
  }

  /**
   * Login a user with email and password.
   * @param email - User's email
   * @param password - User's password
   * @returns Promise resolving to an object with user data and JWT token
   * @throws Error if credentials are invalid
   * @public
   */
  static async login(
    email: string,
    password: string
  ): Promise<{ user: UserData; token: string }> {
    // Validate email format
    const validatedEmail = User.validateEmail(email);

    if (typeof password !== "string" || !password) {
      throw new Error("Invalid credentials");
    }

    // Find user by email
    const user = await dbPromises.get<UserWithPassword>(
      "SELECT id, name, email, password_hash, created_at FROM users WHERE email = ?",
      [validatedEmail]
    );

    if (!user) {
      throw new Error("Invalid credentials");
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      throw new Error("Invalid credentials");
    }

    // Generate JWT token
    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    } as SignOptions);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        created_at: user.created_at,
      },
      token,
    };
  }

  /**
   * Verify a JWT token and return the user ID.
   * @param token - JWT token to verify
   * @returns Promise resolving to the user ID from the token
   * @throws Error if token is invalid
   * @public
   */
  static async verifyToken(token: string): Promise<number> {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as {
        userId: number;
        email: string;
      };
      return decoded.userId;
    } catch (error) {
      throw new Error("Invalid or expired token");
    }
  }

  /**
   * Get user by ID (for use with verified tokens).
   * @param id - User ID
   * @returns Promise resolving to user data or null if not found
   * @public
   */
  static async getUserById(id: number): Promise<UserData | null> {
    const row = await dbPromises.get<{
      id: number;
      name: string;
      email: string;
      created_at: string;
    }>("SELECT id, name, email, created_at FROM users WHERE id = ?", [id]);

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      name: row.name,
      email: row.email,
      created_at: row.created_at,
    };
  }

  /**
   * Get Google OAuth authorization URL.
   * @returns The authorization URL to redirect users to
   * @throws Error if Google OAuth credentials are not configured
   * @public
   */
  static getGoogleAuthUrl(): string {
    const client = getGoogleOAuthClient();
    const scopes = [
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile",
    ];

    return client.generateAuthUrl({
      access_type: "offline",
      scope: scopes,
      prompt: "consent",
    });
  }

  /**
   * Handle Google OAuth callback and create/login user.
   * @param code - Authorization code from Google
   * @returns Promise resolving to an object with user data, JWT token, and redirect URL
   * @throws Error if OAuth flow fails or credentials are not configured
   * @public
   */
  static async handleGoogleCallback(
    code: string
  ): Promise<{ user: UserData; token: string; redirectUrl: string }> {
    try {
      const client = getGoogleOAuthClient();

      // Exchange code for tokens
      const { tokens } = await client.getToken(code);
      client.setCredentials(tokens);

      // Get user info from Google
      const ticket = await client.verifyIdToken({
        idToken: tokens.id_token!,
        audience: GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();
      if (!payload) {
        throw new Error("Failed to get user info from Google");
      }

      const googleEmail = payload.email;
      const googleName = payload.name || payload.given_name || "User";
      const googleId = payload.sub;

      if (!googleEmail) {
        throw new Error("Email not provided by Google");
      }

      // Validate email format
      const validatedEmail = User.validateEmail(googleEmail);
      const validatedName = User.validateName(googleName);

      // Check if user already exists
      let user = await dbPromises.get<UserWithPassword>(
        "SELECT id, name, email, password_hash, created_at FROM users WHERE email = ?",
        [validatedEmail]
      );

      if (user) {
        // User exists, generate token
        const token = jwt.sign(
          { userId: user.id, email: user.email },
          JWT_SECRET,
          {
            expiresIn: JWT_EXPIRES_IN,
          } as SignOptions
        );

        return {
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            created_at: user.created_at,
          },
          token,
          redirectUrl: `${FRONTEND_URL}/auth/callback?token=${token}`,
        };
      }

      // Create new user (no password for OAuth users)
      const result = await dbPromises.run(
        "INSERT INTO users (name, email, password_hash) VALUES (?, ?, NULL)",
        [validatedName, validatedEmail]
      );

      // Retrieve created user
      const row = await dbPromises.get<{
        id: number;
        name: string;
        email: string;
        created_at: string;
      }>("SELECT id, name, email, created_at FROM users WHERE id = ?", [
        result.lastID,
      ]);

      if (!row) {
        throw new Error("Failed to retrieve created user");
      }

      // Generate token
      const token = jwt.sign({ userId: row.id, email: row.email }, JWT_SECRET, {
        expiresIn: JWT_EXPIRES_IN,
      } as SignOptions);

      return {
        user: {
          id: row.id,
          name: row.name,
          email: row.email,
          created_at: row.created_at,
        },
        token,
        redirectUrl: `${FRONTEND_URL}/auth/callback?token=${token}`,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Google OAuth error: ${error.message}`);
      }
      throw new Error("Google OAuth error: Unknown error");
    }
  }
}
