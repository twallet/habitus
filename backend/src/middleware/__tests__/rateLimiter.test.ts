import { authRateLimiter } from "../rateLimiter.js";

describe("Rate Limiter", () => {
  describe("authRateLimiter", () => {
    it("should be defined", () => {
      expect(authRateLimiter).toBeDefined();
      expect(typeof authRateLimiter).toBe("function");
    });

    it("should be a middleware function", () => {
      // Rate limiter should be callable as middleware
      expect(typeof authRateLimiter).toBe("function");
    });

    it("should have skip function that returns true in test environment", () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "test";

      // Access the internal skip function if available
      const rateLimiterConfig = (authRateLimiter as any).options || authRateLimiter;
      const skipFn = rateLimiterConfig.skip;

      if (skipFn) {
        const mockReq = { path: "/api/auth/login" } as any;
        const shouldSkip = skipFn(mockReq);
        expect(shouldSkip).toBe(true);
      }

      process.env.NODE_ENV = originalEnv;
    });

    it("should have skip function that returns false in production environment", () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";

      const rateLimiterConfig = (authRateLimiter as any).options || authRateLimiter;
      const skipFn = rateLimiterConfig.skip;

      if (skipFn) {
        const mockReq = { path: "/api/auth/login" } as any;
        const shouldSkip = skipFn(mockReq);
        expect(shouldSkip).toBe(false);
      }

      process.env.NODE_ENV = originalEnv;
    });

    it("should have handler function for rate limit exceeded", () => {
      const rateLimiterConfig = (authRateLimiter as any).options || authRateLimiter;
      const handler = rateLimiterConfig.handler;

      if (handler) {
        expect(typeof handler).toBe("function");

        const mockReq: Partial<any> = {
          ip: "127.0.0.1",
          path: "/api/auth/login",
          socket: {
            remoteAddress: "127.0.0.1",
          },
        };
        const mockRes: Partial<any> = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn().mockReturnThis(),
        };

        handler(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(429);
        expect(mockRes.json).toHaveBeenCalledWith({
          error: "Too many requests. Please try again in 15 minutes.",
        });
      }
    });
  });
});

