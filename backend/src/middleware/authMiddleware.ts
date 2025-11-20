import { Request, Response, NextFunction } from "express";
import { AuthService } from "../services/authService.js";
import { UserService } from "../services/userService.js";

/**
 * Extended Express Request interface with user ID.
 * @public
 */
export interface AuthRequest extends Request {
  userId?: number;
}

/**
 * Middleware to authenticate requests using JWT tokens.
 * Adds userId to the request object if token is valid.
 * Updates last_access timestamp on each authenticated request.
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 * @public
 */
export async function authenticateToken(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ error: "Authorization token required" });
      return;
    }

    const token = authHeader.substring(7);
    const userId = await AuthService.verifyToken(token);
    req.userId = userId;

    // Update last access timestamp (fire and forget, don't wait for it)
    UserService.updateLastAccess(userId).catch((err) => {
      console.error("Error updating last access:", err);
      // Don't fail the request if this fails
    });

    next();
  } catch (error) {
    if (error instanceof Error && error.message.includes("token")) {
      res.status(401).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: "Authentication error" });
  }
}
