/**
 * Backend Jest configuration
 * Moved from backend/jest.config.cjs to centralize config files
 */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  rootDir: "<rootDir>/backend",
  roots: ["src"],
  testMatch: ["**/__tests__/**/*.ts", "**/?(*.)+(spec|test).ts"],
  setupFilesAfterEnv: ["<rootDir>/backend/src/setupTests.ts"],
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        useESM: true,
        tsconfig: "<rootDir>/backend/tsconfig.json",
      },
    ],
  },
  extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  collectCoverageFrom: ["src/**/*.ts", "!src/**/*.d.ts"],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};

