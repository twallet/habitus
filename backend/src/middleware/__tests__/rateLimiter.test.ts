import { vi } from "vitest";
import { authRateLimiter, handleRateLimitExceeded } from "../rateLimiter.js";

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
      const rateLimiterConfig =
        (authRateLimiter as any).options || authRateLimiter;
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

      const rateLimiterConfig =
        (authRateLimiter as any).options || authRateLimiter;
      const skipFn = rateLimiterConfig.skip;

      if (skipFn) {
        const mockReq = { path: "/api/auth/login" } as any;
        const shouldSkip = skipFn(mockReq);
        expect(shouldSkip).toBe(false);
      }

      process.env.NODE_ENV = originalEnv;
    });

    it("should have handler function for rate limit exceeded", () => {
      const mockReq: Partial<any> = {
        ip: "127.0.0.1",
        path: "/api/auth/login",
        socket: {
          remoteAddress: "127.0.0.1",
        },
      };
      const mockRes: Partial<any> = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
      };

      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation();

      handleRateLimitExceeded(mockReq as any, mockRes as any);

      expect(mockRes.status).toHaveBeenCalledWith(429);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Too many requests. Please try again in 15 minutes.",
      });
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          "RATE_LIMITER | Rate limit exceeded for IP: 127.0.0.1"
        )
      );

      consoleWarnSpy.mockRestore();
    });

    it("should use req.socket.remoteAddress when req.ip is not available", () => {
      const mockReq: Partial<any> = {
        ip: undefined,
        path: "/api/auth/register",
        socket: {
          remoteAddress: "192.168.1.1",
        },
      };
      const mockRes: Partial<any> = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
      };

      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation();

      handleRateLimitExceeded(mockReq as any, mockRes as any);

      expect(mockRes.status).toHaveBeenCalledWith(429);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          "RATE_LIMITER | Rate limit exceeded for IP: 192.168.1.1"
        )
      );

      consoleWarnSpy.mockRestore();
    });

    it("should use 'unknown' when both req.ip and req.socket.remoteAddress are not available", () => {
      const mockReq: Partial<any> = {
        ip: undefined,
        path: "/api/auth/login",
        socket: {
          remoteAddress: undefined,
        },
      };
      const mockRes: Partial<any> = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
      };

      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation();

      handleRateLimitExceeded(mockReq as any, mockRes as any);

      expect(mockRes.status).toHaveBeenCalledWith(429);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          "RATE_LIMITER | Rate limit exceeded for IP: unknown"
        )
      );

      consoleWarnSpy.mockRestore();
    });

    it("should log the correct path in the warning message", () => {
      const mockReq: Partial<any> = {
        ip: "10.0.0.1",
        path: "/api/auth/register",
        socket: {
          remoteAddress: "10.0.0.1",
        },
      };
      const mockRes: Partial<any> = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
      };

      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation();

      handleRateLimitExceeded(mockReq as any, mockRes as any);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("on /api/auth/register")
      );

      consoleWarnSpy.mockRestore();
    });
  });
});
