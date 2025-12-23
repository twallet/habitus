import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import path from "path";
import fs from "fs";
import { PathConfig } from "../paths.js";

describe("PathConfig", () => {
  const originalEnv = process.env;
  const originalExistsSync = fs.existsSync;
  let mockExistsSync: ReturnType<typeof vi.fn<typeof fs.existsSync>>;

  beforeEach(() => {
    // Reset environment variables to original state
    process.env = { ...originalEnv };
    // Reset PathConfig cache
    (PathConfig as any).cachedWorkspaceRoot = null;
    (PathConfig as any).cachedBackendRoot = null;
    (PathConfig as any).cachedPaths = null;

    // Mock fs.existsSync
    mockExistsSync = vi.fn<typeof fs.existsSync>().mockReturnValue(true);
    fs.existsSync = mockExistsSync;
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    // Restore original fs.existsSync
    fs.existsSync = originalExistsSync;
    // Reset PathConfig cache
    (PathConfig as any).cachedWorkspaceRoot = null;
    (PathConfig as any).cachedBackendRoot = null;
    (PathConfig as any).cachedPaths = null;
  });

  describe("getWorkspaceRoot", () => {
    it("should return workspace root from PROJECT_ROOT environment variable", () => {
      const testRoot = "/test/workspace";
      process.env.PROJECT_ROOT = testRoot;
      mockExistsSync.mockReturnValue(true);

      const result = PathConfig.getWorkspaceRoot();

      expect(result).toBe(path.resolve(testRoot));
      expect(mockExistsSync).toHaveBeenCalledWith(path.resolve(testRoot));
    });

    it("should throw error when PROJECT_ROOT is not set", () => {
      delete process.env.PROJECT_ROOT;

      expect(() => PathConfig.getWorkspaceRoot()).toThrow(
        "PROJECT_ROOT environment variable is required. Please set it in config/.env file."
      );
    });

    it("should throw error when PROJECT_ROOT points to non-existent path", () => {
      const testRoot = "/non/existent/path";
      process.env.PROJECT_ROOT = testRoot;
      mockExistsSync.mockReturnValue(false);

      expect(() => PathConfig.getWorkspaceRoot()).toThrow(
        `PROJECT_ROOT environment variable points to non-existent path: ${path.resolve(
          testRoot
        )}`
      );
      expect(mockExistsSync).toHaveBeenCalledWith(path.resolve(testRoot));
    });

    it("should cache workspace root after first call", () => {
      const testRoot = "/test/workspace";
      process.env.PROJECT_ROOT = testRoot;
      mockExistsSync.mockReturnValue(true);

      const result1 = PathConfig.getWorkspaceRoot();
      const result2 = PathConfig.getWorkspaceRoot();

      expect(result1).toBe(result2);
      // existsSync should only be called once (during first call)
      expect(mockExistsSync).toHaveBeenCalledTimes(1);
    });

    it("should resolve relative PROJECT_ROOT to absolute path", () => {
      const testRoot = "./test/workspace";
      process.env.PROJECT_ROOT = testRoot;
      mockExistsSync.mockReturnValue(true);

      const result = PathConfig.getWorkspaceRoot();

      expect(result).toBe(path.resolve(testRoot));
      expect(path.isAbsolute(result)).toBe(true);
    });
  });

  describe("getBackendRoot", () => {
    it("should return backend root directory", () => {
      const testRoot = "/test/workspace";
      process.env.PROJECT_ROOT = testRoot;
      mockExistsSync.mockReturnValue(true);

      const result = PathConfig.getBackendRoot();

      expect(result).toBe(path.join(path.resolve(testRoot), "backend"));
    });

    it("should cache backend root after first call", () => {
      const testRoot = "/test/workspace";
      process.env.PROJECT_ROOT = testRoot;
      mockExistsSync.mockReturnValue(true);

      const result1 = PathConfig.getBackendRoot();
      const result2 = PathConfig.getBackendRoot();

      expect(result1).toBe(result2);
      // getWorkspaceRoot should only be called once (cached after first call)
    });

    it("should use cached workspace root when available", () => {
      const testRoot = "/test/workspace";
      process.env.PROJECT_ROOT = testRoot;
      mockExistsSync.mockReturnValue(true);

      // First, get workspace root to cache it
      PathConfig.getWorkspaceRoot();
      const initialCallCount = mockExistsSync.mock.calls.length;

      // Then get backend root
      PathConfig.getBackendRoot();

      // existsSync should not be called again
      expect(mockExistsSync).toHaveBeenCalledTimes(initialCallCount);
    });
  });

  describe("getPaths", () => {
    it("should return all paths object", () => {
      const testRoot = "/test/workspace";
      process.env.PROJECT_ROOT = testRoot;
      mockExistsSync.mockReturnValue(true);

      const paths = PathConfig.getPaths();

      expect(paths).toHaveProperty("workspaceRoot");
      expect(paths).toHaveProperty("backendRoot");
      expect(paths).toHaveProperty("backendSrc");
      expect(paths).toHaveProperty("backendDist");
      expect(paths).toHaveProperty("backendData");
    });

    it("should return correct path values", () => {
      const testRoot = "/test/workspace";
      process.env.PROJECT_ROOT = testRoot;
      mockExistsSync.mockReturnValue(true);

      const paths = PathConfig.getPaths();
      const expectedWorkspaceRoot = path.resolve(testRoot);
      const expectedBackendRoot = path.join(expectedWorkspaceRoot, "backend");

      expect(paths.workspaceRoot).toBe(expectedWorkspaceRoot);
      expect(paths.backendRoot).toBe(expectedBackendRoot);
      expect(paths.backendSrc).toBe(path.join(expectedBackendRoot, "src"));
      expect(paths.backendDist).toBe(path.join(expectedBackendRoot, "dist"));
      expect(paths.backendData).toBe(path.join(expectedBackendRoot, "data"));
    });

    it("should cache paths after first call", () => {
      const testRoot = "/test/workspace";
      process.env.PROJECT_ROOT = testRoot;
      mockExistsSync.mockReturnValue(true);

      const paths1 = PathConfig.getPaths();
      const paths2 = PathConfig.getPaths();

      expect(paths1).toBe(paths2);
      expect(paths1.workspaceRoot).toBe(paths2.workspaceRoot);
      expect(paths1.backendRoot).toBe(paths2.backendRoot);
    });

    it("should return readonly paths object", () => {
      const testRoot = "/test/workspace";
      process.env.PROJECT_ROOT = testRoot;
      mockExistsSync.mockReturnValue(true);

      const paths = PathConfig.getPaths();

      // TypeScript should prevent modification, but we can verify the structure
      expect(Object.keys(paths)).toEqual([
        "workspaceRoot",
        "backendRoot",
        "backendSrc",
        "backendDist",
        "backendData",
      ]);
    });

    it("should use cached workspace and backend root when available", () => {
      const testRoot = "/test/workspace";
      process.env.PROJECT_ROOT = testRoot;
      mockExistsSync.mockReturnValue(true);

      // Pre-populate caches
      PathConfig.getWorkspaceRoot();
      PathConfig.getBackendRoot();
      const initialCallCount = mockExistsSync.mock.calls.length;

      // Get paths
      PathConfig.getPaths();

      // existsSync should not be called again
      expect(mockExistsSync).toHaveBeenCalledTimes(initialCallCount);
    });
  });

  describe("integration", () => {
    it("should work correctly when all methods are called in sequence", () => {
      const testRoot = "/test/workspace";
      process.env.PROJECT_ROOT = testRoot;
      mockExistsSync.mockReturnValue(true);

      const workspaceRoot = PathConfig.getWorkspaceRoot();
      const backendRoot = PathConfig.getBackendRoot();
      const paths = PathConfig.getPaths();

      expect(paths.workspaceRoot).toBe(workspaceRoot);
      expect(paths.backendRoot).toBe(backendRoot);
      expect(paths.backendSrc).toBe(path.join(backendRoot, "src"));
      expect(paths.backendDist).toBe(path.join(backendRoot, "dist"));
      expect(paths.backendData).toBe(path.join(backendRoot, "data"));
    });

    it("should handle empty string PROJECT_ROOT", () => {
      process.env.PROJECT_ROOT = "";

      // Empty string is falsy, so it should throw "required" error
      expect(() => PathConfig.getWorkspaceRoot()).toThrow(
        "PROJECT_ROOT environment variable is required. Please set it in config/.env file."
      );
    });

    it("should throw error when getPaths is called without PROJECT_ROOT", () => {
      delete process.env.PROJECT_ROOT;

      expect(() => PathConfig.getPaths()).toThrow(
        "PROJECT_ROOT environment variable is required"
      );
    });
  });
});
