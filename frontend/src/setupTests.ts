/// <reference types="vitest/globals" />
import "@testing-library/jest-dom";
import { beforeAll, afterAll, vi } from "vitest";

// Mock virtual PWA module for tests
vi.mock("virtual:pwa-register/react", () => ({
  useRegisterSW: vi.fn(() => ({
    offlineReady: [false, vi.fn()],
    needUpdate: [false, vi.fn()],
    updateServiceWorker: vi.fn(),
  })),
}));

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

// Only set up window.localStorage if window exists (jsdom environment)
if (typeof window !== "undefined") {
  Object.defineProperty(window, "localStorage", {
    value: localStorageMock,
  });
}

// Also define on globalThis for global access (TypeScript expects this)
Object.defineProperty(globalThis, "localStorage", {
  value: localStorageMock,
});

// Mock ResizeObserver for tests
global.ResizeObserver = class ResizeObserver {
  observe() {
    // Mock implementation
  }
  unobserve() {
    // Mock implementation
  }
  disconnect() {
    // Mock implementation
  }
} as typeof ResizeObserver;

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
        // Set DEV to false in tests to test production behavior
        DEV: false,
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
  console.log = vi.fn();
  console.warn = vi.fn();

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
