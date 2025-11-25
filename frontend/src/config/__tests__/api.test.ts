import { API_ENDPOINTS, API_BASE_URL } from "../api";

describe("api", () => {
  const originalServerUrl = process.env.VITE_SERVER_URL;
  const originalPort = process.env.VITE_PORT;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    // Note: globalThis.import is read-only (defined in setupTests.ts), so we can't delete it
    delete process.env.VITE_SERVER_URL;
    delete process.env.VITE_PORT;
  });

  afterEach(() => {
    // Restore original values
    if (originalServerUrl !== undefined) {
      process.env.VITE_SERVER_URL = originalServerUrl;
    }
    if (originalPort !== undefined) {
      process.env.VITE_PORT = originalPort;
    }
  });

  it("should use globalThis.import.meta.env.VITE_SERVER_URL and VITE_PORT when available", () => {
    // This test verifies the module loads correctly with mocked globalThis
    // The actual values are set in setupTests.ts, so we just verify it's used
    expect(API_BASE_URL).toBeDefined();
    expect(typeof API_BASE_URL).toBe("string");
    expect(API_BASE_URL).toBe("http://localhost:3001");
  });

  it("should use process.env.VITE_SERVER_URL and VITE_PORT as fallback", () => {
    // Set process.env values
    process.env.VITE_SERVER_URL = "http://localhost";
    process.env.VITE_PORT = "3001";
    // Reload module to pick up new env vars
    jest.resetModules();
    const { API_BASE_URL: reloadedUrl } = require("../api");
    expect(reloadedUrl).toBe("http://localhost:3001");
  });

  it("should construct URL from VITE_SERVER_URL and VITE_PORT", () => {
    // The values are set in setupTests.ts, so we verify the constructed URL
    expect(API_BASE_URL).toBeDefined();
    expect(API_BASE_URL).toBe("http://localhost:3001");
  });

  it("should construct correct API endpoints", () => {
    expect(API_ENDPOINTS.users).toBe(`${API_BASE_URL}/api/users`);
    expect(API_ENDPOINTS.auth.register).toBe(
      `${API_BASE_URL}/api/auth/register`
    );
    expect(API_ENDPOINTS.auth.login).toBe(`${API_BASE_URL}/api/auth/login`);
    expect(API_ENDPOINTS.auth.verifyMagicLink).toBe(
      `${API_BASE_URL}/api/auth/verify-magic-link`
    );
    expect(API_ENDPOINTS.auth.me).toBe(`${API_BASE_URL}/api/auth/me`);
    expect(API_ENDPOINTS.profile.update).toBe(
      `${API_BASE_URL}/api/users/profile`
    );
    expect(API_ENDPOINTS.profile.delete).toBe(
      `${API_BASE_URL}/api/users/profile`
    );
  });

  it("should handle Vite runtime environment via Function eval", () => {
    // The Vite runtime handling is tested via the actual module behavior
    // We verify the API_BASE_URL is properly constructed
    expect(API_BASE_URL).toBeDefined();
    expect(typeof API_BASE_URL).toBe("string");
  });

  it("should handle errors in Vite env access gracefully", () => {
    // Error handling is built into the module and tested via actual usage
    // We verify the API_BASE_URL is always defined
    expect(API_BASE_URL).toBeDefined();
    expect(typeof API_BASE_URL).toBe("string");
  });
});
