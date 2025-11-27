/**
 * Root Jest configuration for running all tests (backend + frontend) together
 * This consolidates test results from both projects into a single output
 */

// Load environment variables from .env file before config evaluation
// This ensures VITE_SERVER_URL and VITE_PORT are available when the config is evaluated
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

// Compute absolute paths relative to this config file
// This config is in config/, so we go up one level to get the workspace root
const rootDir = path.join(__dirname, "..");
const backendDir = path.join(rootDir, "backend");
const frontendDir = path.join(rootDir, "frontend");

module.exports = {
  projects: [
    {
      displayName: "backend",
      preset: "ts-jest",
      testEnvironment: "node",
      rootDir: backendDir,
      testMatch: ["**/__tests__/**/*.ts", "**/?(*.)+(spec|test).ts"],
      setupFilesAfterEnv: [
        path.join(backendDir, "src", "setup", "setupTests.ts"),
      ],
      transform: {
        "^.+\\.ts$": [
          "ts-jest",
          {
            useESM: true,
            tsconfig: path.join(backendDir, "tsconfig.json"),
          },
        ],
      },
      extensionsToTreatAsEsm: [".ts"],
      moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
      moduleNameMapper: {
        // Match relative paths with any number of ../ or ./
        // This pattern handles: ./path.js, ../path.js, ../../path.js, ../../../path.js, etc.
        // Pattern explanation:
        // - ^ - start of string
        // - ((?:\\.\\.?/)+.*) - capture group: one or more sequences of ./ or ../, followed by any characters
        // - \\.js$ - literal .js at end of string
        // - $1 - replacement: the captured path without .js extension
        "^((?:\\.\\.?/)+.*)\\.js$": "$1",
        // Also handle paths without leading ./ or ../ for absolute resolution
        "^src/(.*)\\.js$": "<rootDir>/src/$1",
      },
      collectCoverageFrom: [
        "src/**/*.ts",
        "!src/**/*.d.ts",
        "!src/**/__tests__/**",
      ],
    },
    {
      displayName: "frontend",
      preset: "ts-jest",
      testEnvironment: "jsdom",
      rootDir: frontendDir,
      testMatch: [
        "**/__tests__/**/*.ts",
        "**/__tests__/**/*.tsx",
        "**/?(*.)+(spec|test).ts",
        "**/?(*.)+(spec|test).tsx",
      ],
      moduleNameMapper: {
        "^@/(.*)$": path.join(frontendDir, "src", "$1"),
        "\\.(css|less|scss|sass)$": path.join(
          frontendDir,
          "src",
          "__mocks__",
          "styleMock.js"
        ),
      },
      globals: (() => {
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
        return {
          "import.meta": {
            env: {
              VITE_SERVER_URL: process.env.VITE_SERVER_URL,
              VITE_PORT: process.env.VITE_PORT,
            },
          },
        };
      })(),
      setupFilesAfterEnv: [path.join(frontendDir, "src", "setupTests.ts")],
      transform: {
        "^.+\\.tsx?$": [
          "ts-jest",
          {
            useESM: false,
            tsconfig: path.join(frontendDir, "tsconfig.json"),
          },
        ],
      },
      extensionsToTreatAsEsm: [],
      collectCoverageFrom: [
        "src/**/*.{ts,tsx}",
        "!src/**/*.d.ts",
        "!src/main.tsx",
        "!src/vite-env.d.ts",
        "!src/**/__tests__/**",
      ],
    },
  ],
  coverageDirectory: path.join(rootDir, "coverage"),
  coverageThreshold: {
    global: {
      branches: 75,
      functions: 75,
      lines: 75,
      statements: 75,
    },
  },
  forceExit: true,
  testTimeout: 10000,
  maxWorkers: 2,
  logHeapUsage: false,
};
