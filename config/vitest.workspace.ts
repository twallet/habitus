/**
 * Vitest workspace configuration for separate backend and frontend test environments
 * In Vitest, workspace files should export an array of config objects
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

// Export array of workspace configs
export default [
  // Backend workspace
  defineConfig({
    test: {
      name: "backend",
      include: [
        "backend/src/**/__tests__/**/*.ts",
        "backend/src/**/*.test.ts",
        "backend/src/**/*.spec.ts",
      ],
      exclude: ["**/node_modules/**", "**/dist/**"],
      environment: "node",
      setupFiles: [paths.backendSetupTests],
      globals: true,
      testTimeout: 10000,
      hookTimeout: 10000,
      env: {
        VITE_SERVER_URL: process.env.VITE_SERVER_URL || "",
        VITE_PORT: process.env.VITE_PORT || "",
      },
      coverage: {
        provider: "v8",
        reporter: ["text", "html", "json"],
        reportsDirectory: paths.coverageDir,
        include: ["backend/src/**/*.ts"],
        exclude: [
          "**/*.d.ts",
          "**/__tests__/**",
          "**/setupTests.ts",
          "backend/src/main.ts",
        ],
        thresholds: {
          branches: 75,
          functions: 75,
          lines: 75,
          statements: 75,
        },
      },
    },
  }),
  // Frontend workspace
  defineConfig({
    test: {
      name: "frontend",
      include: [
        "frontend/src/**/__tests__/**/*.{ts,tsx}",
        "frontend/src/**/*.test.{ts,tsx}",
        "frontend/src/**/*.spec.{ts,tsx}",
      ],
      exclude: ["**/node_modules/**", "**/dist/**"],
      environment: "jsdom",
      setupFiles: [paths.frontendSetupTests],
      globals: true,
      testTimeout: 10000,
      hookTimeout: 10000,
      env: {
        VITE_SERVER_URL: process.env.VITE_SERVER_URL || "",
        VITE_PORT: process.env.VITE_PORT || "",
      },
      coverage: {
        provider: "v8",
        reporter: ["text", "html", "json"],
        reportsDirectory: paths.coverageDir,
        include: ["frontend/src/**/*.{ts,tsx}"],
        exclude: [
          "**/*.d.ts",
          "**/__tests__/**",
          "**/setupTests.ts",
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
    },
    resolve: {
      alias: {
        "@": paths.frontendSrc,
        "\\.(css|less|scss|sass)$": join(
          paths.frontendSrc,
          "__mocks__",
          "styleMock.js"
        ),
      },
    },
  }),
];
