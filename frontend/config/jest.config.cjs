module.exports = {
  preset: "ts-jest",
  testEnvironment: "jsdom",
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
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};
