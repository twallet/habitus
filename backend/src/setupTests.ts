/**
 * Jest setup file for backend tests.
 * Suppresses console output during tests to keep test output clean.
 */

const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;

beforeAll(() => {
  // Suppress console.log and console.warn during tests
  console.log = jest.fn();
  console.warn = jest.fn();
  
  // Keep console.error but filter out our custom logging messages
  console.error = (...args: unknown[]) => {
    // Suppress our custom logging messages during tests
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('AUTH |') ||
       args[0].includes('USER |') ||
       args[0].includes('EMAIL |') ||
       args[0].includes('DATABASE |') ||
       args[0].includes('AUTH_MIDDLEWARE |') ||
       args[0].includes('AUTH_ROUTE |') ||
       args[0].includes('USER_ROUTE |') ||
       args[0].includes('RATE_LIMITER |') ||
       args[0].includes('UPLOAD |'))
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

