import { vi, type Mock, type Mocked } from "vitest";
import { Request, Response, NextFunction } from "express";
import {
  authenticateToken,
  authenticateTokenOptional,
  AuthRequest,
} from "../authMiddleware.js";
import { ServiceManager } from "../../services/index.js";
import { Database } from "../../db/database.js";
import { AuthService } from "../../services/authService.js";
import { UserService } from "../../services/userService.js";
import BetterSqlite3 from "better-sqlite3";

// Mock services
vi.mock("../../services/index.js", () => ({
  ServiceManager: {
    getAuthService: vi.fn(),
    getUserService: vi.fn(),
    initializeServices: vi.fn(),
  },
}));

/**
 * Create an in-memory database for testing.
 */
async function createTestDatabase(): Promise<Database> {
  return new Promise((resolve, reject) => {
    const db = new BetterSqlite3(":memory:");
      if (err) {
        reject(err);
        return;
      }

      db.run("PRAGMA foreign_keys = ON", (err) => {
        if (err) {
          reject(err);
          return;
        }

        db.run("PRAGMA journal_mode = WAL", (err) => {
          if (err) {
            reject(err);
            return;
          }

          db.exec(
            `
            CREATE TABLE IF NOT EXISTS users (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              name TEXT NOT NULL,
              email TEXT NOT NULL UNIQUE,
              locale TEXT DEFAULT 'en-US',
              timezone TEXT
            );
          `,
            (err) => {
              if (err) {
                reject(err);
              } else {
                const database = new Database();
                (database as any).db = db;
                resolve(database);
              }
            }
          );
        });
      });
    });
  });
}

describe("authMiddleware", () => {
  let db: Database;
  let mockAuthService: Mocked<AuthService>;
  let mockUserService: Mocked<UserService>;
  let mockReq: AuthRequest;
  let mockRes: Partial<Response>;
  let mockNext: Mock<NextFunction>;

  beforeEach(async () => {
    db = await createTestDatabase();
    mockAuthService = {
      verifyToken: vi.fn(),
    } as any;
    mockUserService = {
      updateLastAccess: vi.fn().mockResolvedValue(undefined),
    } as any;

    (ServiceManager.getAuthService as Mock).mockReturnValue(mockAuthService);
    (ServiceManager.getUserService as Mock).mockReturnValue(mockUserService);

    mockReq = {
      headers: {},
      path: "/test",
    } as unknown as AuthRequest;
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    mockNext = vi.fn();
  });

  afterEach(async () => {
    await db.close();
    vi.clearAllMocks();
  });

  describe("authenticateToken", () => {
    it("should authenticate valid token and call next", async () => {
      mockReq.headers = {
        authorization: "Bearer valid-token",
      } as any;
      mockAuthService.verifyToken.mockResolvedValue(1);

      await authenticateToken(
        mockReq,
        mockRes as Response,
        mockNext as unknown as NextFunction
      );

      expect(mockAuthService.verifyToken).toHaveBeenCalledWith("valid-token");
      expect(mockReq.userId).toBe(1);
      expect(mockUserService.updateLastAccess).toHaveBeenCalledWith(1);
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it("should return 401 if no authorization header", async () => {
      mockReq.headers = {} as any;

      await authenticateToken(
        mockReq,
        mockRes as Response,
        mockNext as unknown as NextFunction
      );

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Authorization token required",
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should return 401 if authorization header does not start with Bearer", async () => {
      mockReq.headers = {
        authorization: "Invalid token",
      } as any;

      await authenticateToken(
        mockReq,
        mockRes as Response,
        mockNext as unknown as NextFunction
      );

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Authorization token required",
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should return 401 if token is invalid", async () => {
      mockReq.headers = {
        authorization: "Bearer invalid-token",
      } as any;
      mockAuthService.verifyToken.mockRejectedValue(
        new Error("Invalid or expired token")
      );

      await authenticateToken(
        mockReq,
        mockRes as Response,
        mockNext as unknown as NextFunction
      );

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Invalid or expired token",
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should return 500 for non-token errors", async () => {
      mockReq.headers = {
        authorization: "Bearer token",
      } as any;
      mockAuthService.verifyToken.mockRejectedValue(
        new Error("Database error")
      );

      await authenticateToken(
        mockReq,
        mockRes as Response,
        mockNext as unknown as NextFunction
      );

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Authentication error",
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should not fail request if updateLastAccess fails", async () => {
      mockReq.headers = {
        authorization: "Bearer valid-token",
      } as any;
      mockAuthService.verifyToken.mockResolvedValue(1);
      mockUserService.updateLastAccess.mockRejectedValue(
        new Error("Update failed")
      );

      await authenticateToken(
        mockReq,
        mockRes as Response,
        mockNext as unknown as NextFunction
      );

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.userId).toBe(1);
    });

    it("should extract token correctly from Bearer header", async () => {
      mockReq.headers = {
        authorization: "Bearer my-secret-token-123",
      } as any;
      mockAuthService.verifyToken.mockResolvedValue(42);

      await authenticateToken(
        mockReq,
        mockRes as Response,
        mockNext as unknown as NextFunction
      );

      expect(mockAuthService.verifyToken).toHaveBeenCalledWith(
        "my-secret-token-123"
      );
    });

    it("should return 401 if Bearer token is empty", async () => {
      mockReq.headers = {
        authorization: "Bearer ",
      } as any;
      mockReq.cookies = {};

      await authenticateToken(
        mockReq,
        mockRes as Response,
        mockNext as unknown as NextFunction
      );

      // With the new cookie support, empty Bearer token and no cookie should return 401 immediately
      expect(mockAuthService.verifyToken).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Authorization token required",
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should handle token with special characters", async () => {
      const specialToken = "token.with-special_chars@123";
      mockReq.headers = {
        authorization: `Bearer ${specialToken}`,
      } as any;
      mockAuthService.verifyToken.mockResolvedValue(1);

      await authenticateToken(
        mockReq,
        mockRes as Response,
        mockNext as unknown as NextFunction
      );

      expect(mockAuthService.verifyToken).toHaveBeenCalledWith(specialToken);
      expect(mockReq.userId).toBe(1);
      expect(mockNext).toHaveBeenCalled();
    });

    it("should handle error message that includes 'token' substring", async () => {
      mockReq.headers = {
        authorization: "Bearer token",
      } as any;
      mockAuthService.verifyToken.mockRejectedValue(
        new Error("Token validation failed: token expired")
      );

      await authenticateToken(
        mockReq,
        mockRes as Response,
        mockNext as unknown as NextFunction
      );

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Token validation failed: token expired",
      });
    });

    it("should handle non-Error objects thrown", async () => {
      mockReq.headers = {
        authorization: "Bearer token",
      } as any;
      mockAuthService.verifyToken.mockRejectedValue("String error");

      await authenticateToken(
        mockReq,
        mockRes as Response,
        mockNext as unknown as NextFunction
      );

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Authentication error",
      });
    });
  });

  describe("authenticateTokenOptional", () => {
    const originalEnv = process.env.NODE_ENV;

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
    });

    describe("development mode", () => {
      beforeEach(() => {
        process.env.NODE_ENV = "development";
      });

      it("should allow request without token in development", async () => {
        mockReq.headers = {} as any;

        await authenticateTokenOptional(
          mockReq,
          mockRes as Response,
          mockNext as unknown as NextFunction
        );

        expect(mockReq.userId).toBeUndefined();
        expect(mockNext).toHaveBeenCalled();
        expect(mockRes.status).not.toHaveBeenCalled();
      });

      it("should authenticate valid token in development", async () => {
        mockReq.headers = {
          authorization: "Bearer valid-token",
        } as any;
        mockAuthService.verifyToken.mockResolvedValue(1);

        await authenticateTokenOptional(
          mockReq,
          mockRes as Response,
          mockNext as unknown as NextFunction
        );

        expect(mockAuthService.verifyToken).toHaveBeenCalledWith("valid-token");
        expect(mockReq.userId).toBe(1);
        expect(mockUserService.updateLastAccess).toHaveBeenCalledWith(1);
        expect(mockNext).toHaveBeenCalled();
        expect(mockRes.status).not.toHaveBeenCalled();
      });

      it("should allow request with invalid token in development", async () => {
        mockReq.headers = {
          authorization: "Bearer invalid-token",
        } as any;
        mockAuthService.verifyToken.mockRejectedValue(
          new Error("Invalid token")
        );

        await authenticateTokenOptional(
          mockReq,
          mockRes as Response,
          mockNext as unknown as NextFunction
        );

        expect(mockReq.userId).toBeUndefined();
        expect(mockNext).toHaveBeenCalled();
        expect(mockRes.status).not.toHaveBeenCalled();
      });

      it("should allow request when authorization header does not start with Bearer in development", async () => {
        mockReq.headers = {
          authorization: "Invalid format",
        } as any;

        await authenticateTokenOptional(
          mockReq,
          mockRes as Response,
          mockNext as unknown as NextFunction
        );

        expect(mockReq.userId).toBeUndefined();
        expect(mockNext).toHaveBeenCalled();
        expect(mockRes.status).not.toHaveBeenCalled();
      });

      it("should not fail request if updateLastAccess fails in development", async () => {
        mockReq.headers = {
          authorization: "Bearer valid-token",
        } as any;
        mockAuthService.verifyToken.mockResolvedValue(1);
        mockUserService.updateLastAccess.mockRejectedValue(
          new Error("Update failed")
        );

        await authenticateTokenOptional(
          mockReq,
          mockRes as Response,
          mockNext as unknown as NextFunction
        );

        expect(mockNext).toHaveBeenCalled();
        expect(mockReq.userId).toBe(1);
        expect(mockRes.status).not.toHaveBeenCalled();
      });

      it("should handle empty Bearer token in development", async () => {
        mockReq.headers = {
          authorization: "Bearer ",
        } as any;
        mockAuthService.verifyToken.mockRejectedValue(
          new Error("Invalid token")
        );

        await authenticateTokenOptional(
          mockReq,
          mockRes as Response,
          mockNext as unknown as NextFunction
        );

        expect(mockReq.userId).toBeUndefined();
        expect(mockNext).toHaveBeenCalled();
      });
    });

    describe("production mode", () => {
      beforeEach(() => {
        process.env.NODE_ENV = "production";
      });

      it("should require authentication in production (delegates to authenticateToken)", async () => {
        mockReq.headers = {
          authorization: "Bearer valid-token",
        } as any;
        mockAuthService.verifyToken.mockResolvedValue(1);

        await authenticateTokenOptional(
          mockReq,
          mockRes as Response,
          mockNext as unknown as NextFunction
        );

        // Should behave like authenticateToken in production
        expect(mockAuthService.verifyToken).toHaveBeenCalledWith("valid-token");
        expect(mockReq.userId).toBe(1);
        expect(mockNext).toHaveBeenCalled();
      });

      it("should return 401 if no token in production", async () => {
        mockReq.headers = {} as any;

        await authenticateTokenOptional(
          mockReq,
          mockRes as Response,
          mockNext as unknown as NextFunction
        );

        // Should behave like authenticateToken in production
        expect(mockRes.status).toHaveBeenCalledWith(401);
        expect(mockRes.json).toHaveBeenCalledWith({
          error: "Authorization token required",
        });
        expect(mockNext).not.toHaveBeenCalled();
      });

      it("should return 401 if invalid token in production", async () => {
        mockReq.headers = {
          authorization: "Bearer invalid-token",
        } as any;
        mockAuthService.verifyToken.mockRejectedValue(
          new Error("Invalid or expired token")
        );

        await authenticateTokenOptional(
          mockReq,
          mockRes as Response,
          mockNext as unknown as NextFunction
        );

        expect(mockRes.status).toHaveBeenCalledWith(401);
        expect(mockRes.json).toHaveBeenCalledWith({
          error: "Invalid or expired token",
        });
        expect(mockNext).not.toHaveBeenCalled();
      });
    });

    describe("test mode", () => {
      beforeEach(() => {
        process.env.NODE_ENV = "test";
      });

      it("should allow request without token in test mode", async () => {
        mockReq.headers = {} as any;

        await authenticateTokenOptional(
          mockReq,
          mockRes as Response,
          mockNext as unknown as NextFunction
        );

        expect(mockReq.userId).toBeUndefined();
        expect(mockNext).toHaveBeenCalled();
        expect(mockRes.status).not.toHaveBeenCalled();
      });
    });
  });
});


