/**
 * Root Jest configuration for running all tests (backend + frontend) together
 * This consolidates test results from both projects into a single output
 */

// Load environment variables from .env file before importing paths
// This ensures VITE_SERVER_URL and VITE_PORT are available when the config is evaluated
require("dotenv").config({ path: require("path").join(__dirname, ".env") });

// Import centralized path configuration
// This is the single source of truth for all directory paths
const paths = require("./paths.cjs");

module.exports = {
  projects: [
    {
      displayName: "backend",
      preset: "ts-jest",
      testEnvironment: "node",
      rootDir: paths.backendRoot,
      testMatch: ["**/__tests__/**/*.ts", "**/?(*.)+(spec|test).ts"],
      setupFilesAfterEnv: [paths.backendSetupTests],
      // Configure module name mapping FIRST - this is critical for jest.mock() calls
      // The moduleNameMapper must be applied before Jest tries to resolve modules
      moduleNameMapper: {
        // Match relative paths with .js extension and map to .ts files
        // This handles all relative imports: ./path.js, ../path.js, ../../path.js, ../../../path.js, etc.
        // Pattern: matches one or more sequences of ./ or ../, followed by any path, ending with .js
        // Replaces with the same path without .js extension (Jest will then resolve to .ts via moduleFileExtensions)
        // The key is to preserve the relative path structure so Jest can resolve it correctly
        // IMPORTANT: This pattern must match jest.mock() paths as well as import statements
        // Note: Jest hoists jest.mock() calls early, so moduleNameMapper must work at that stage
        // Use a more explicit pattern that ensures matching
        "^((?:\\.\\.?/)+.*)\\.js$": "$1",
        // Also handle paths without leading ./ or ../ for absolute resolution
        "^src/(.*)\\.js$": "<rootDir>/src/$1",
      },
      transform: {
        "^.+\\.ts$": [
          "ts-jest",
          {
            useESM: true,
            tsconfig: paths.backendTsconfig,
          },
        ],
      },
      extensionsToTreatAsEsm: [".ts"],
      moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
      // Ensure Jest can resolve modules from the src directory
      moduleDirectories: ["node_modules", "<rootDir>/src"],
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
      rootDir: paths.frontendRoot,
      testMatch: [
        "**/__tests__/**/*.ts",
        "**/__tests__/**/*.tsx",
        "**/?(*.)+(spec|test).ts",
        "**/?(*.)+(spec|test).tsx",
      ],
      moduleNameMapper: {
        "^@/(.*)$": require("path").join(paths.frontendSrc, "$1"),
        "\\.(css|less|scss|sass)$": require("path").join(
          paths.frontendSrc,
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
      setupFilesAfterEnv: [paths.frontendSetupTests],
      transform: {
        "^.+\\.tsx?$": [
          "ts-jest",
          {
            useESM: false,
            tsconfig: paths.frontendTsconfig,
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
  coverageDirectory: paths.coverageDir,
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
