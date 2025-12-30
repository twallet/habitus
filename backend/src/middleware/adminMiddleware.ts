import { Response, NextFunction } from "express";
import { authenticateToken, AuthRequest } from "./authMiddleware.js";
import { ServiceManager } from "../services/index.js";

/**
 * Middleware class for admin authentication and authorization.
 * Verifies that the authenticated user is an admin by checking their email
 * against the ADMIN_EMAIL environment variable.
 * @public
 */
export class AdminMiddleware {
  /**
   * Get the admin email from environment variable.
   * Reads dynamically from process.env to support runtime configuration changes.
   * @returns Admin email address or undefined if not configured
   * @internal
   */
  private getAdminEmail(): string | undefined {
    return process.env.ADMIN_EMAIL;
  }

  /**
   * Create a new AdminMiddleware instance.
   * @public
   */
  constructor() {
    // No initialization needed - adminEmail is read dynamically
  }

  /**
   * Middleware method to verify that the authenticated user is an admin.
   * Checks that the user's email matches the ADMIN_EMAIL environment variable.
   * @param req - Express request object
   * @param res - Express response object
   * @param next - Express next function
   * @public
   */
  async requireAdmin(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    // First authenticate the token
    await authenticateToken(req, res, async () => {
      try {
        const adminEmail = this.getAdminEmail();
        if (!adminEmail) {
          console.error(
            `[${new Date().toISOString()}] ADMIN_MIDDLEWARE | ADMIN_EMAIL not configured`
          );
          res.status(500).json({ error: "Admin access not configured" });
          return;
        }

        if (!req.userId) {
          res.status(401).json({ error: "Authentication required" });
          return;
        }

        const userService = ServiceManager.getUserService();
        const user = await userService.getUserById(req.userId);

        if (!user) {
          res.status(404).json({ error: "User not found" });
          return;
        }

        if (user.email.toLowerCase() !== adminEmail.toLowerCase()) {
          console.warn(
            `[${new Date().toISOString()}] ADMIN_MIDDLEWARE | Unauthorized admin access attempt by ${
              user.email
            }`
          );
          res.status(403).json({ error: "Admin access required" });
          return;
        }

        console.log(
          `[${new Date().toISOString()}] ADMIN_MIDDLEWARE | Admin access granted to ${
            user.email
          }`
        );

        next();
      } catch (error) {
        console.error(
          `[${new Date().toISOString()}] ADMIN_MIDDLEWARE | Error:`,
          error
        );
        res.status(500).json({ error: "Admin verification failed" });
      }
    });
  }
}

/**
 * Singleton instance of AdminMiddleware.
 * @public
 */
const adminMiddleware = new AdminMiddleware();

/**
 * Middleware function to verify that the authenticated user is an admin.
 * This is a convenience wrapper around the AdminMiddleware class instance.
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 * @public
 */
export async function requireAdmin(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  return adminMiddleware.requireAdmin(req, res, next);
}
