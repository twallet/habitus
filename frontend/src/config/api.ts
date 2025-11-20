/**
 * API configuration.
 * Uses import.meta.env in Vite, defaults to localhost in tests.
 * @public
 */
const getEnvValue = (): string => {
  // In Jest tests, import.meta is mocked via setupTests.ts as a global property
  const globalImport = (
    globalThis as {
      import?: { meta?: { env?: { VITE_API_BASE_URL?: string } } };
    }
  ).import;
  if (globalImport?.meta?.env?.VITE_API_BASE_URL) {
    return globalImport.meta.env.VITE_API_BASE_URL;
  }

  // In Vite runtime, access import.meta.env via eval to avoid syntax errors in Jest
  // This is safe because Vite transforms this at build time
  try {
    const viteEnv = new Function(
      "return import.meta?.env?.VITE_API_BASE_URL"
    )();
    if (viteEnv) {
      return viteEnv;
    }
  } catch {
    // Ignore errors in test environment where import.meta is not available
  }

  // Fallback for tests or Node.js environment
  return (
    (typeof process !== "undefined" && process.env?.VITE_API_BASE_URL) ||
    "http://localhost:3001"
  );
};

export const API_BASE_URL = getEnvValue();

/**
 * API endpoints.
 * @public
 */
export const API_ENDPOINTS = {
  users: `${API_BASE_URL}/api/users`,
  auth: {
    register: `${API_BASE_URL}/api/auth/register`,
    login: `${API_BASE_URL}/api/auth/login`,
    me: `${API_BASE_URL}/api/auth/me`,
  },
} as const;
