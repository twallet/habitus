/**
 * Vitest setup file for backend tests.
 * Suppresses console output during tests to keep test output clean.
 */

import { beforeAll, afterAll, vi } from "vitest";
import path from "path";
import os from "os";
import fs from "fs";

// Set required environment variables for tests before any modules are imported
// These are required by constants.ts which is evaluated at module load time
// Tests will fail if required variables are not set in environment

// PROJECT_ROOT is required for path resolution
if (!process.env.PROJECT_ROOT) {
  // In test environment, try to use current working directory as fallback
  // This allows tests to run without explicit PROJECT_ROOT in some cases
  // but it's better to set it explicitly
  const cwd = process.cwd();
  // Check if cwd looks like a project root (has package.json, backend/, frontend/)
  const hasPackageJson = fs.existsSync(path.join(cwd, "package.json"));
  const hasBackend = fs.existsSync(path.join(cwd, "backend"));
  const hasFrontend = fs.existsSync(path.join(cwd, "frontend"));

  if (hasPackageJson && hasBackend && hasFrontend) {
    process.env.PROJECT_ROOT = cwd;
  } else {
    throw new Error(
      "PROJECT_ROOT environment variable is required for tests. Please set it in your .env file or test environment."
    );
  }
}

if (!process.env.VITE_SERVER_URL) {
  throw new Error(
    "VITE_SERVER_URL environment variable is required for tests. Please set it in your .env file or test environment."
  );
}
if (!process.env.VITE_PORT) {
  throw new Error(
    "VITE_PORT environment variable is required for tests. Please set it in your .env file or test environment."
  );
}
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = "test-jwt-secret";
}
if (!process.env.JWT_EXPIRES_IN) {
  process.env.JWT_EXPIRES_IN = "7d";
}
if (!process.env.MAGIC_LINK_EXPIRY_MINUTES) {
  process.env.MAGIC_LINK_EXPIRY_MINUTES = "15";
}
if (!process.env.MAGIC_LINK_COOLDOWN_MINUTES) {
  process.env.MAGIC_LINK_COOLDOWN_MINUTES = "5";
}
// Set ADMIN_EMAIL for admin middleware tests
// This must be set before adminMiddleware module is imported so the singleton has the correct value
if (!process.env.ADMIN_EMAIL) {
  process.env.ADMIN_EMAIL = "admin@example.com";
}
// Set DB_PATH for tests to use a test-specific location (can be overridden in individual tests)
// Use absolute path to avoid issues with different working directories
if (!process.env.DB_PATH) {
  process.env.DB_PATH = path.join(os.tmpdir(), "habitus-test.db");
}

const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;

beforeAll(() => {
  // Suppress console.log and console.warn during tests
  console.log = vi.fn();
  console.warn = vi.fn();

  // Keep console.error but filter out our custom logging messages
  console.error = (...args: unknown[]) => {
    // Suppress our custom logging messages during tests
    if (
      typeof args[0] === "string" &&
      (args[0].includes("AUTH |") ||
        args[0].includes("USER |") ||
        args[0].includes("EMAIL |") ||
        args[0].includes("DATABASE |") ||
        args[0].includes("AUTH_MIDDLEWARE |") ||
        args[0].includes("AUTH_ROUTE |") ||
        args[0].includes("USER_ROUTE |") ||
        args[0].includes("RATE_LIMITER |") ||
        args[0].includes("UPLOAD |") ||
        args[0].includes("AI_SERVICE |"))
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.log = originalLog;
  console.warn = originalWarn;
  console.error = originalError;
});
