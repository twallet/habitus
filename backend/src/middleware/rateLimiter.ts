import rateLimit, { RateLimitRequestHandler } from "express-rate-limit";

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
});
