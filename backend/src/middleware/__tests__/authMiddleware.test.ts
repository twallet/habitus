import { Request, Response, NextFunction } from "express";
import { authenticateToken, AuthRequest } from "../authMiddleware.js";
import { getAuthService, getUserService, initializeServices } from "../../services/index.js";
import { Database } from "../../db/database.js";
import { AuthService } from "../../services/authService.js";
import { UserService } from "../../services/userService.js";
import { EmailService } from "../../services/emailService.js";
import sqlite3 from "sqlite3";

// Mock services
jest.mock("../../services/index.js", () => ({
  getAuthService: jest.fn(),
  getUserService: jest.fn(),
  initializeServices: jest.fn(),
}));

/**
 * Create an in-memory database for testing.
 */
async function createTestDatabase(): Promise<Database> {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(":memory:", (err) => {
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
              email TEXT NOT NULL UNIQUE
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
  let mockAuthService: jest.Mocked<AuthService>;
  let mockUserService: jest.Mocked<UserService>;
  let mockReq: Partial<AuthRequest>;
  let mockRes: Partial<Response>;
  let mockNext: jest.Mock<NextFunction>;

  beforeEach(async () => {
    db = await createTestDatabase();
    mockAuthService = {
      verifyToken: jest.fn(),
    } as any;
    mockUserService = {
      updateLastAccess: jest.fn().mockResolvedValue(undefined),
    } as any;

    (getAuthService as jest.Mock).mockReturnValue(mockAuthService);
    (getUserService as jest.Mock).mockReturnValue(mockUserService);

    mockReq = {
      headers: {},
      path: "/test",
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
  });

  afterEach(async () => {
    await db.close();
    jest.clearAllMocks();
  });

  describe("authenticateToken", () => {
    it("should authenticate valid token and call next", async () => {
      mockReq.headers = {
        authorization: "Bearer valid-token",
      };
      mockAuthService.verifyToken.mockResolvedValue(1);

      await authenticateToken(
        mockReq as AuthRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockAuthService.verifyToken).toHaveBeenCalledWith("valid-token");
      expect(mockReq.userId).toBe(1);
      expect(mockUserService.updateLastAccess).toHaveBeenCalledWith(1);
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it("should return 401 if no authorization header", async () => {
      mockReq.headers = {};

      await authenticateToken(
        mockReq as AuthRequest,
        mockRes as Response,
        mockNext
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
      };

      await authenticateToken(
        mockReq as AuthRequest,
        mockRes as Response,
        mockNext
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
      };
      mockAuthService.verifyToken.mockRejectedValue(
        new Error("Invalid or expired token")
      );

      await authenticateToken(
        mockReq as AuthRequest,
        mockRes as Response,
        mockNext
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
      };
      mockAuthService.verifyToken.mockRejectedValue(
        new Error("Database error")
      );

      await authenticateToken(
        mockReq as AuthRequest,
        mockRes as Response,
        mockNext
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
      };
      mockAuthService.verifyToken.mockResolvedValue(1);
      mockUserService.updateLastAccess.mockRejectedValue(
        new Error("Update failed")
      );

      await authenticateToken(
        mockReq as AuthRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.userId).toBe(1);
    });

    it("should extract token correctly from Bearer header", async () => {
      mockReq.headers = {
        authorization: "Bearer my-secret-token-123",
      };
      mockAuthService.verifyToken.mockResolvedValue(42);

      await authenticateToken(
        mockReq as AuthRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockAuthService.verifyToken).toHaveBeenCalledWith(
        "my-secret-token-123"
      );
    });
  });
});

