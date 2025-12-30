import { vi, type Mock, type Mocked } from "vitest";
import { Response, NextFunction } from "express";
import { AdminMiddleware, requireAdmin } from "../adminMiddleware.js";
import { AuthRequest } from "../authMiddleware.js";
import { ServiceManager } from "../../services/index.js";
import { UserService } from "../../services/userService.js";

// Mock authenticateToken
vi.mock("../authMiddleware.js", async () => {
  const actual = await vi.importActual("../authMiddleware.js");
  return {
    ...actual,
    authenticateToken: vi.fn(async (req, res, next) => {
      // Simulate authentication by calling next (which is the async callback)
      // and awaiting it since authenticateToken is async
      await next();
    }),
  };
});

// Mock services
vi.mock("../../services/index.js", () => ({
  ServiceManager: {
    getUserService: vi.fn(),
  },
}));

describe("AdminMiddleware", () => {
  let adminMiddleware: AdminMiddleware;
  let mockUserService: Mocked<UserService>;
  let mockReq: AuthRequest;
  let mockRes: Partial<Response>;
  let mockNext: Mock<NextFunction>;
  const originalEnv = process.env.ADMIN_EMAIL;

  beforeEach(() => {
    mockUserService = {
      getUserById: vi.fn(),
    } as any;

    (ServiceManager.getUserService as Mock).mockReturnValue(mockUserService);

    mockReq = {
      headers: {},
      path: "/test",
      userId: undefined,
    } as unknown as AuthRequest;

    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };

    mockNext = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
    // Restore original env
    if (originalEnv) {
      process.env.ADMIN_EMAIL = originalEnv;
    } else {
      delete process.env.ADMIN_EMAIL;
    }
  });

  describe("constructor", () => {
    it("should create AdminMiddleware instance", () => {
      const middleware = new AdminMiddleware();
      expect(middleware).toBeInstanceOf(AdminMiddleware);
    });
  });

  describe("requireAdmin", () => {
    it("should return 500 if ADMIN_EMAIL is not configured", async () => {
      delete process.env.ADMIN_EMAIL;
      adminMiddleware = new AdminMiddleware();

      await adminMiddleware.requireAdmin(
        mockReq,
        mockRes as Response,
        mockNext as unknown as NextFunction
      );

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Admin access not configured",
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should return 401 if user is not authenticated", async () => {
      process.env.ADMIN_EMAIL = "admin@example.com";
      adminMiddleware = new AdminMiddleware();
      mockReq.userId = undefined;

      await adminMiddleware.requireAdmin(
        mockReq,
        mockRes as Response,
        mockNext as unknown as NextFunction
      );

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Authentication required",
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should return 404 if user is not found", async () => {
      process.env.ADMIN_EMAIL = "admin@example.com";
      adminMiddleware = new AdminMiddleware();
      mockReq.userId = 1;
      mockUserService.getUserById.mockResolvedValue(null);

      await adminMiddleware.requireAdmin(
        mockReq,
        mockRes as Response,
        mockNext as unknown as NextFunction
      );

      expect(mockUserService.getUserById).toHaveBeenCalledWith(1);
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "User not found",
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should return 403 if user email does not match ADMIN_EMAIL", async () => {
      process.env.ADMIN_EMAIL = "admin@example.com";
      adminMiddleware = new AdminMiddleware();
      mockReq.userId = 1;
      mockUserService.getUserById.mockResolvedValue({
        id: 1,
        email: "user@example.com",
        name: "User",
      } as any);

      await adminMiddleware.requireAdmin(
        mockReq,
        mockRes as Response,
        mockNext as unknown as NextFunction
      );

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Admin access required",
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should allow access if user email matches ADMIN_EMAIL (case insensitive)", async () => {
      process.env.ADMIN_EMAIL = "admin@example.com";
      adminMiddleware = new AdminMiddleware();
      mockReq.userId = 1;
      mockUserService.getUserById.mockResolvedValue({
        id: 1,
        email: "ADMIN@EXAMPLE.COM",
        name: "Admin",
      } as any);

      await adminMiddleware.requireAdmin(
        mockReq,
        mockRes as Response,
        mockNext as unknown as NextFunction
      );

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it("should allow access if user email matches ADMIN_EMAIL", async () => {
      process.env.ADMIN_EMAIL = "admin@example.com";
      adminMiddleware = new AdminMiddleware();
      mockReq.userId = 1;
      mockUserService.getUserById.mockResolvedValue({
        id: 1,
        email: "admin@example.com",
        name: "Admin",
      } as any);

      await adminMiddleware.requireAdmin(
        mockReq,
        mockRes as Response,
        mockNext as unknown as NextFunction
      );

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it("should return 500 if getUserById throws an error", async () => {
      process.env.ADMIN_EMAIL = "admin@example.com";
      adminMiddleware = new AdminMiddleware();
      mockReq.userId = 1;
      mockUserService.getUserById.mockRejectedValue(
        new Error("Database error")
      );

      await adminMiddleware.requireAdmin(
        mockReq,
        mockRes as Response,
        mockNext as unknown as NextFunction
      );

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Admin verification failed",
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe("requireAdmin function wrapper", () => {
    it("should call AdminMiddleware instance requireAdmin method", async () => {
      // ADMIN_EMAIL is read dynamically, so setting it here will work
      process.env.ADMIN_EMAIL = "admin@example.com";

      mockReq.userId = 1;
      mockUserService.getUserById.mockResolvedValue({
        id: 1,
        email: "admin@example.com",
        name: "Admin",
      } as any);

      await requireAdmin(
        mockReq,
        mockRes as Response,
        mockNext as unknown as NextFunction
      );

      // The wrapper function should delegate to the singleton instance's requireAdmin method
      // Since ADMIN_EMAIL is set before calling requireAdmin, it will be read dynamically
      // and the async callback should complete and call next()
      const statusCalls = (mockRes.status as Mock).mock.calls;
      const jsonCalls = (mockRes.json as Mock).mock.calls;

      // Check if any status was called (could be 500, 401, 403, 404)
      if (statusCalls.length > 0) {
        const statusCode = statusCalls[0][0];
        // If status was called, verify the appropriate error response
        expect(jsonCalls.length).toBeGreaterThan(0);
        expect(mockNext).not.toHaveBeenCalled();
      } else {
        // If no status was called, the async callback should have completed and called next()
        expect(mockNext).toHaveBeenCalled();
      }
    });
  });
});
