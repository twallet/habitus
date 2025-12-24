import { Request, Response, NextFunction } from "express";
import { ServiceManager } from "../services/index.js";

/**
 * Extended Express Request interface with user ID.
 * @public
 */
export interface AuthRequest extends Request {
  userId?: number;
}

/**
 * Optional authentication middleware that allows requests without auth in development mode.
 * In production, requires authentication. In development, authentication is optional.
 * Adds userId to the request object if token is valid, otherwise leaves it undefined.
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 * @public
 */
export async function authenticateTokenOptional(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const isDevelopment = process.env.NODE_ENV !== "production";

  // In production, require authentication
  if (!isDevelopment) {
    return authenticateToken(req, res, next);
  }

  // In development, authentication is optional
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      // No token provided - allow request to proceed without userId
      console.log(
        `[${new Date().toISOString()}] AUTH_MIDDLEWARE | Optional auth: no token provided for ${
          req.path
        } (dev mode)`
      );
      req.userId = undefined;
      next();
      return;
    }

    const token = authHeader.substring(7);
    const authService = ServiceManager.getAuthService();
    const userId = await authService.verifyToken(token);
    req.userId = userId;

    console.log(
      `[${new Date().toISOString()}] AUTH_MIDDLEWARE | Optional auth: authenticated userId ${userId} on ${
        req.path
      } (dev mode)`
    );

    // Update last access timestamp (fire and forget, don't wait for it)
    const userService = ServiceManager.getUserService();
    userService.updateLastAccess(userId).catch((err) => {
      console.error(
        `[${new Date().toISOString()}] AUTH_MIDDLEWARE | Error updating last access for userId ${userId}:`,
        err
      );
    });

    next();
  } catch (error) {
    // In dev mode, if token is invalid, allow request to proceed without userId
    console.log(
      `[${new Date().toISOString()}] AUTH_MIDDLEWARE | Optional auth: invalid token for ${
        req.path
      }, proceeding without auth (dev mode)`
    );
    req.userId = undefined;
    next();
  }
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
      console.warn(
        `[${new Date().toISOString()}] AUTH_MIDDLEWARE | Authentication failed: no Bearer token in request to ${
          req.path
        }`
      );
      res.status(401).json({ error: "Authorization token required" });
      return;
    }

    const token = authHeader.substring(7);
    console.log(
      `[${new Date().toISOString()}] AUTH_MIDDLEWARE | Authenticating request to ${
        req.path
      } with token`
    );

    const authService = ServiceManager.getAuthService();
    const userId = await authService.verifyToken(token);
    req.userId = userId;

    console.log(
      `[${new Date().toISOString()}] AUTH_MIDDLEWARE | Authentication successful for userId: ${userId} on ${
        req.path
      }`
    );

    // Update last access timestamp (fire and forget, don't wait for it)
    const userService = ServiceManager.getUserService();
    userService.updateLastAccess(userId).catch((err) => {
      console.error(
        `[${new Date().toISOString()}] AUTH_MIDDLEWARE | Error updating last access for userId ${userId}:`,
        err
      );
      // Don't fail the request if this fails
    });

    next();
  } catch (error) {
    if (error instanceof Error && error.message.includes("token")) {
      console.warn(
        `[${new Date().toISOString()}] AUTH_MIDDLEWARE | Authentication failed for ${
          req.path
        }: ${error.message}`
      );
      res.status(401).json({ error: error.message });
      return;
    }
    console.error(
      `[${new Date().toISOString()}] AUTH_MIDDLEWARE | Authentication error on ${
        req.path
      }:`,
      error
    );
    res.status(500).json({ error: "Authentication error" });
  }
}
