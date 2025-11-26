/**
 * Jest setup file for backend tests.
 * Suppresses console output during tests to keep test output clean.
 */

import path from "path";
import os from "os";

// Set required environment variables for tests before any modules are imported
// These are required by constants.ts which is evaluated at module load time
if (!process.env.SERVER_URL) {
  process.env.SERVER_URL = "http://localhost";
}
if (!process.env.PORT) {
  process.env.PORT = "3005";
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
  console.log = jest.fn();
  console.warn = jest.fn();

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
        args[0].includes("UPLOAD |"))
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
