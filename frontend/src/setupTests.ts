import "@testing-library/jest-dom";

// Mock localStorage for tests
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
});

// Mock import.meta.env for Vite environment variables
// Tests will fail if VITE_SERVER_URL or VITE_PORT are not set in environment
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
Object.defineProperty(globalThis, "import", {
  value: {
    meta: {
      env: {
        VITE_SERVER_URL: process.env.VITE_SERVER_URL,
        VITE_PORT: process.env.VITE_PORT,
      },
    },
  },
});

// Suppress console output during tests (but keep errors for debugging)
const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;

beforeAll(() => {
  // Suppress console.log and console.warn during tests
  console.log = jest.fn();
  console.warn = jest.fn();

  // Keep console.error but filter out React act warnings
  console.error = (...args: unknown[]) => {
    if (
      typeof args[0] === "string" &&
      args[0].includes("Warning: An update to") &&
      args[0].includes("inside a test was not wrapped in act(...)")
    ) {
      return;
    }
    // Also suppress our custom logging messages during tests
    if (
      typeof args[0] === "string" &&
      (args[0].includes("FRONTEND_") ||
        args[0].includes("FRONTEND_AUTH") ||
        args[0].includes("FRONTEND_USERS") ||
        args[0].includes("FRONTEND_APP"))
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
