import rateLimit, { RateLimitRequestHandler } from "express-rate-limit";
import { Request, Response, NextFunction } from "express";

/**
 * Rate limiter for authentication endpoints (login and register).
 * Prevents abuse by limiting the number of requests per IP address.
 *
 * Configuration:
 * - Window: 15 minutes
 * - Max requests: 5 per window
 * - Message: User-friendly error message
 *
 * @public
 */
const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: {
    error: "Too many requests. Please try again in 15 minutes.",
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // Skip rate limiting in test environment
  skip: (req) => process.env.NODE_ENV === "test",
});

/**
 * Wrapper middleware that adds logging for rate limit hits.
 * @public
 */
export const authRateLimiter: RateLimitRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Log before rate limiter runs
  const ip = req.ip || req.socket.remoteAddress || "unknown";

  // Check if rate limit would be exceeded by checking headers after limiter runs
  rateLimiter(req, res, (err) => {
    if (res.statusCode === 429) {
      console.warn(
        `[${new Date().toISOString()}] RATE_LIMITER | Rate limit exceeded for IP: ${ip} on ${
          req.path
        }`
      );
    }
    if (err) {
      return next(err);
    }
    next();
  });
};
