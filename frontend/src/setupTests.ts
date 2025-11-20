import '@testing-library/jest-dom';

// Mock import.meta.env for Vite environment variables
Object.defineProperty(globalThis, 'import', {
  value: {
    meta: {
      env: {
        VITE_API_BASE_URL: 'http://localhost:3001',
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
      typeof args[0] === 'string' &&
      args[0].includes('Warning: An update to') &&
      args[0].includes('inside a test was not wrapped in act(...)')
    ) {
      return;
    }
    // Also suppress our custom logging messages during tests
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('FRONTEND_') || args[0].includes('FRONTEND_AUTH') || args[0].includes('FRONTEND_USERS') || args[0].includes('FRONTEND_APP'))
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

