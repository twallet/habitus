/**
 * Root Jest configuration for running all tests (backend + frontend) together
 * This consolidates test results from both projects into a single output
 */
module.exports = {
  projects: [
    {
      displayName: "backend",
      preset: "ts-jest",
      testEnvironment: "node",
      rootDir: "<rootDir>/backend",
      roots: ["<rootDir>/src"],
      testMatch: ["**/__tests__/**/*.ts", "**/?(*.)+(spec|test).ts"],
      setupFilesAfterEnv: ["<rootDir>/src/setupTests.ts"],
      transform: {
        "^.+\\.ts$": [
          "ts-jest",
          {
            useESM: true,
            tsconfig: "<rootDir>/tsconfig.json",
          },
        ],
      },
      extensionsToTreatAsEsm: [".ts"],
      moduleNameMapper: {
        "^(\\.{1,2}/.*)\\.js$": "$1",
      },
      collectCoverageFrom: ["src/**/*.ts", "!src/**/*.d.ts"],
    },
    {
      displayName: "frontend",
      preset: "ts-jest",
      testEnvironment: "jsdom",
      rootDir: "<rootDir>/frontend",
      roots: ["<rootDir>/src"],
      testMatch: [
        "**/__tests__/**/*.ts",
        "**/__tests__/**/*.tsx",
        "**/?(*.)+(spec|test).ts",
        "**/?(*.)+(spec|test).tsx",
      ],
      moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/src/$1",
        "\\.(css|less|scss|sass)$": "<rootDir>/src/__mocks__/styleMock.js",
      },
      globals: {
        "import.meta": {
          env: {
            VITE_SERVER_URL: "http://localhost",
            VITE_PORT: "3001",
          },
        },
      },
      setupFilesAfterEnv: ["<rootDir>/src/setupTests.ts"],
      transform: {
        "^.+\\.tsx?$": [
          "ts-jest",
          {
            useESM: false,
          },
        ],
      },
      extensionsToTreatAsEsm: [],
      collectCoverageFrom: [
        "src/**/*.{ts,tsx}",
        "!src/**/*.d.ts",
        "!src/main.tsx",
        "!src/vite-env.d.ts",
      ],
    },
  ],
  collectCoverageFrom: [
    "backend/src/**/*.ts",
    "frontend/src/**/*.{ts,tsx}",
    "!**/*.d.ts",
    "!frontend/src/main.tsx",
    "!frontend/src/vite-env.d.ts",
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  forceExit: true,
  testTimeout: 10000,
  maxWorkers: 2,
  logHeapUsage: false,
};
