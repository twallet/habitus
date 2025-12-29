import rateLimit, {
  RateLimitRequestHandler,
  ipKeyGenerator,
} from "express-rate-limit";
import { Request, Response } from "express";

/**
 * Handler function for rate limit exceeded.
 * Logs the violation and sends a 429 response.
 *
 * @param req - Express request object
 * @param res - Express response object
 * @public
 */
export function handleRateLimitExceeded(req: Request, res: Response): void {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  console.warn(
    `[${new Date().toISOString()}] RATE_LIMITER | Rate limit exceeded for IP: ${ip} on ${
      req.path
    }`
  );
  res.status(429).json({
    error: "Too many requests. Please try again in 15 minutes.",
  });
}

/**
 * Rate limiter for authentication endpoints (login and register).
 * Prevents abuse by limiting the number of requests per IP address.
 * Includes logging for rate limit violations.
 *
 * Configuration:
 * - Window: 15 minutes
 * - Max requests: 5 per window
 * - Message: User-friendly error message
 *
 * @public
 */
export const authRateLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: {
    error: "Too many requests. Please try again in 15 minutes.",
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // Skip rate limiting in test environment
  skip: (req) => process.env.NODE_ENV === "test",
  handler: handleRateLimitExceeded,
  // Use the built-in ipKeyGenerator helper which properly handles IPv6 and proxy headers
  // This is required when TRUST_PROXY=true to prevent IPv6 bypass issues
  // ipKeyGenerator takes the IP string and returns a normalized key
  keyGenerator: (req) => {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    // Use ipKeyGenerator helper to properly handle IPv6 addresses
    return ipKeyGenerator(ip);
  },
});
