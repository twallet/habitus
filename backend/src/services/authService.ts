import bcrypt from "bcrypt";
import jwt, { SignOptions } from "jsonwebtoken";
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
}
