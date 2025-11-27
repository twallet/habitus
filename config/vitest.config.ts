/**
 * Vitest configuration for running all tests (backend + frontend) together.
 * Vitest has native ES module support, so no moduleNameMapper workarounds needed!
 */

import { defineConfig } from "vitest/config";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import dotenv from "dotenv";

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, ".env") });

// Import paths configuration
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const paths = require("./paths.cjs");

export default defineConfig({
  test: {
    // Run tests in both backend and frontend
    include: [
      "backend/src/**/__tests__/**/*.ts",
      "backend/src/**/*.test.ts",
      "backend/src/**/*.spec.ts",
      "frontend/src/**/__tests__/**/*.{ts,tsx}",
      "frontend/src/**/*.test.{ts,tsx}",
      "frontend/src/**/*.spec.{ts,tsx}",
    ],
    // Exclude node_modules and dist
    exclude: ["**/node_modules/**", "**/dist/**"],
    // Coverage configuration
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json"],
      reportsDirectory: paths.coverageDir,
      include: ["backend/src/**/*.ts", "frontend/src/**/*.{ts,tsx}"],
      exclude: [
        "**/*.d.ts",
        "**/__tests__/**",
        "**/setupTests.ts",
        "backend/src/main.ts",
        "frontend/src/main.tsx",
        "frontend/src/vite-env.d.ts",
      ],
      thresholds: {
        branches: 75,
        functions: 75,
        lines: 75,
        statements: 75,
      },
    },
    // Global test timeout
    testTimeout: 10000,
    // Hook timeout
    hookTimeout: 10000,
    // Environment variables
    env: {
      VITE_SERVER_URL: process.env.VITE_SERVER_URL || "",
      VITE_PORT: process.env.VITE_PORT || "",
    },
    // Pool options for parallel execution
    pool: "threads",
    poolOptions: {
      threads: {
        singleThread: false,
        maxThreads: 2,
      },
    },
    // Use jsdom for frontend tests, node for backend
    // Vitest will automatically detect based on file location
    environmentMatchGlobs: [
      ["frontend/**", "jsdom"],
      ["backend/**", "node"],
    ],
    globals: true, // Enable global test functions (describe, it, expect, etc.)
  },
  resolve: {
    alias: {
      // Frontend path alias
      "@": paths.frontendSrc,
      // CSS mock for frontend
      "\\.(css|less|scss|sass)$": join(
        paths.frontendSrc,
        "__mocks__",
        "styleMock.js"
      ),
    },
  },
});
