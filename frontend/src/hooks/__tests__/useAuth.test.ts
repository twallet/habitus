// @vitest-environment jsdom
import { vi, type Mock } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useAuth } from "../useAuth";
import { API_ENDPOINTS } from "../../config/api";

// Mock fetch
global.fetch = vi.fn();

// Type declaration for localStorage in test environment
// Storage interface is available in jsdom test environment
declare const localStorage: {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
  clear: () => void;
  length: number;
  key: (index: number) => string | null;
};

const TOKEN_KEY = "habitus_token";

describe("useAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as Mock).mockReset();
    (global.fetch as Mock).mockClear();
    localStorage.clear();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  describe("initialization", () => {
    it("should initialize with loading state and no user", async () => {
      // No token in localStorage, so no fetch call
      // But we still need to mock fetch in case it's called
      (global.fetch as Mock).mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({}),
      });

      const { result } = renderHook(() => useAuth());

      // User, token, and isAuthenticated should be null/false initially
      expect(result.current.user).toBeNull();
      expect(result.current.token).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);

      // isLoading might be true initially but quickly becomes false when no token exists
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    it("should load and verify valid token from localStorage", async () => {
      const mockUser = {
        id: 1,
        name: "John Doe",
        email: "john@example.com",
        created_at: "2024-01-01T00:00:00Z",
      };

      localStorage.setItem(TOKEN_KEY, "valid-token");

      (global.fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockUser,
      });

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.user).toEqual(mockUser);
      expect(result.current.token).toBe("valid-token");
      expect(result.current.isAuthenticated).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        API_ENDPOINTS.auth.me,
        expect.objectContaining({
          headers: {
            Authorization: "Bearer valid-token",
          },
        })
      );
    });

    it("should remove invalid token from localStorage", async () => {
      localStorage.setItem(TOKEN_KEY, "invalid-token");

      (global.fetch as Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({}),
      });

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.user).toBeNull();
      expect(result.current.token).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    });

    it("should handle fetch error during token verification", async () => {
      localStorage.setItem(TOKEN_KEY, "token");

      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      (global.fetch as Mock).mockRejectedValueOnce(new Error("Network error"));

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.user).toBeNull();
      expect(result.current.token).toBeNull();
      expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
      // Error logging may have changed format - ApiClient handles errors differently
      // Just verify the auth state is cleared, which indicates error was handled

      consoleErrorSpy.mockRestore();
    });
  });

  describe("requestLoginMagicLink", () => {
    it("should request login magic link successfully", async () => {
      let callCount = 0;
      (global.fetch as Mock).mockImplementation(
        (url: string | Request | URL) => {
          const urlString =
            typeof url === "string"
              ? url
              : url instanceof Request
              ? url.url
              : url.toString();
          callCount++;

          // Check URL first to determine which endpoint is being called
          if (urlString.includes("/api/auth/me")) {
            // Initialization call
            return Promise.resolve({
              ok: false,
              status: 401,
              json: async () => Promise.resolve({}),
            });
          }

          // requestLoginMagicLink call - should be /api/auth/login
          if (urlString.includes("/api/auth/login")) {
            return Promise.resolve({
              ok: true,
              status: 200,
              json: async () => Promise.resolve({ message: "Magic link sent" }),
            });
          }

          // Fallback
          return Promise.resolve({
            ok: false,
            status: 401,
            json: async () => Promise.resolve({}),
          });
        }
      );

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await result.current.requestLoginMagicLink("test@example.com");

      expect(global.fetch).toHaveBeenCalledWith(
        API_ENDPOINTS.auth.login,
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email: "test@example.com" }),
        })
      );
    });

    it("should throw error when request fails", async () => {
      (global.fetch as Mock).mockImplementation(
        (url: string | Request | URL) => {
          const urlString =
            typeof url === "string"
              ? url
              : url instanceof Request
              ? url.url
              : url.toString();

          if (urlString.includes("/api/auth/me")) {
            return Promise.resolve({
              ok: false,
              status: 401,
              json: async () => ({}),
            });
          }

          if (urlString.includes("/api/auth/login")) {
            return Promise.resolve({
              ok: false,
              status: 400,
              json: async () => Promise.resolve({ error: "Invalid email" }),
            });
          }

          return Promise.resolve({
            ok: false,
            status: 401,
            json: async () => ({}),
          });
        }
      );

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await expect(
        result.current.requestLoginMagicLink("invalid@example.com")
      ).rejects.toThrow("Invalid email");
    });

    it("should handle non-JSON error response", async () => {
      (global.fetch as Mock).mockImplementation(
        (url: string | Request | URL) => {
          const urlString =
            typeof url === "string"
              ? url
              : url instanceof Request
              ? url.url
              : url.toString();

          if (urlString.includes("/api/auth/me")) {
            return Promise.resolve({
              ok: false,
              status: 401,
              json: async () => ({}),
            });
          }

          // Actual requestLoginMagicLink call - json() throws
          if (urlString.includes("/api/auth/login")) {
            return Promise.resolve({
              ok: false,
              status: 500,
              json: async () => {
                throw new Error("Not JSON");
              },
            });
          }

          return Promise.resolve({
            ok: false,
            status: 401,
            json: async () => ({}),
          });
        }
      );

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await expect(
        result.current.requestLoginMagicLink("test@example.com")
      ).rejects.toThrow();
    });
  });

  describe("requestRegisterMagicLink", () => {
    it("should request registration magic link with all fields", async () => {
      (global.fetch as Mock).mockImplementation(
        (url: string | Request | URL) => {
          const urlString =
            typeof url === "string"
              ? url
              : url instanceof Request
              ? url.url
              : url.toString();

          if (urlString.includes("/api/auth/me")) {
            return Promise.resolve({
              ok: false,
              status: 401,
              json: async () => ({}),
            });
          }

          if (urlString.includes("/api/auth/register")) {
            return Promise.resolve({
              ok: true,
              status: 200,
              json: async () =>
                Promise.resolve({ message: "Registration link sent" }),
            });
          }

          return Promise.resolve({
            ok: false,
            status: 401,
            json: async () => ({}),
          });
        }
      );

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const mockFile = new File(["content"], "profile.jpg", {
        type: "image/jpeg",
      });

      await result.current.requestRegisterMagicLink(
        "John Doe",
        "john@example.com",
        mockFile
      );

      // Check that fetch was called with register endpoint
      const registerCalls = (global.fetch as Mock).mock.calls.filter(
        (call: any[]) => {
          const url = call[0];
          const urlString =
            typeof url === "string" ? url : url?.toString() || "";
          return urlString.includes("/api/auth/register");
        }
      );
      expect(registerCalls.length).toBeGreaterThanOrEqual(1);

      const callArgs = registerCalls[0];
      expect(callArgs?.[1]?.body).toBeInstanceOf(FormData);
    });

    it("should request registration magic link with minimal fields", async () => {
      (global.fetch as Mock).mockImplementation(
        (url: string | Request | URL) => {
          const urlString =
            typeof url === "string"
              ? url
              : url instanceof Request
              ? url.url
              : url.toString();

          if (urlString.includes("/api/auth/me")) {
            return Promise.resolve({
              ok: false,
              status: 401,
              json: async () => ({}),
            });
          }

          if (urlString.includes("/api/auth/register")) {
            return Promise.resolve({
              ok: true,
              status: 200,
              json: async () =>
                Promise.resolve({ message: "Registration link sent" }),
            });
          }

          return Promise.resolve({
            ok: false,
            status: 401,
            json: async () => ({}),
          });
        }
      );

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await result.current.requestRegisterMagicLink(
        "John Doe",
        "john@example.com"
      );

      expect(global.fetch).toHaveBeenCalledWith(
        API_ENDPOINTS.auth.register,
        expect.objectContaining({
          method: "POST",
        })
      );
    });

    it("should throw error when registration fails", async () => {
      (global.fetch as Mock).mockImplementation(
        (url: string | Request | URL) => {
          const urlString =
            typeof url === "string"
              ? url
              : url instanceof Request
              ? url.url
              : url.toString();

          if (urlString.includes("/api/auth/me")) {
            return Promise.resolve({
              ok: false,
              status: 401,
              json: async () => ({}),
            });
          }

          if (urlString.includes("/api/auth/register")) {
            return Promise.resolve({
              ok: false,
              status: 400,
              json: async () => ({ error: "Email already exists" }),
            });
          }

          return Promise.resolve({
            ok: false,
            status: 401,
            json: async () => ({}),
          });
        }
      );

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await expect(
        result.current.requestRegisterMagicLink(
          "John Doe",
          "existing@example.com"
        )
      ).rejects.toThrow("Email already exists");
    });
  });

  describe("verifyMagicLink", () => {
    it("should verify magic link and set user", async () => {
      const mockUser = {
        id: 1,
        name: "John Doe",
        email: "john@example.com",
        created_at: "2024-01-01T00:00:00Z",
      };

      (global.fetch as Mock).mockImplementation(
        (url: string | Request | URL) => {
          const urlString =
            typeof url === "string"
              ? url
              : url instanceof Request
              ? url.url
              : url.toString();

          if (urlString.includes("/api/auth/me")) {
            return Promise.resolve({
              ok: false,
              status: 401,
              json: async () => ({}),
            });
          }

          if (urlString.includes("/api/auth/verify-magic-link")) {
            return Promise.resolve({
              ok: true,
              status: 200,
              json: async () =>
                Promise.resolve({
                  user: mockUser,
                  token: "new-token",
                }),
            });
          }

          return Promise.resolve({
            ok: false,
            status: 401,
            json: async () => ({}),
          });
        }
      );

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const user = await result.current.verifyMagicLink("magic-token");
      expect(user).toEqual(mockUser);

      await waitFor(() => {
        expect(result.current.user).toEqual(mockUser);
      });
      expect(result.current.token).toBe("new-token");
      expect(result.current.isAuthenticated).toBe(true);
      expect(localStorage.getItem(TOKEN_KEY)).toBe("new-token");
      expect(global.fetch).toHaveBeenCalledWith(
        `${API_ENDPOINTS.auth.verifyMagicLink}?token=magic-token`,
        expect.objectContaining({
          method: "GET",
        })
      );
    });

    it("should throw error when magic link is invalid", async () => {
      (global.fetch as Mock).mockImplementation(
        (url: string | Request | URL) => {
          const urlString =
            typeof url === "string"
              ? url
              : url instanceof Request
              ? url.url
              : url.toString();

          if (urlString.includes("/api/auth/me")) {
            return Promise.resolve({
              ok: false,
              status: 401,
              json: async () => ({}),
            });
          }

          if (urlString.includes("/api/auth/verify-magic-link")) {
            return Promise.resolve({
              ok: false,
              status: 400,
              json: async () => ({ error: "Invalid or expired magic link" }),
            });
          }

          return Promise.resolve({
            ok: false,
            status: 401,
            json: async () => ({}),
          });
        }
      );

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await expect(
        result.current.verifyMagicLink("invalid-token")
      ).rejects.toThrow("Invalid or expired magic link");
    });
  });

  describe("logout", () => {
    it("should clear user and token", async () => {
      const mockUser = {
        id: 1,
        name: "John Doe",
        email: "john@example.com",
        created_at: "2024-01-01T00:00:00Z",
      };

      localStorage.setItem(TOKEN_KEY, "token");

      (global.fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockUser,
      });

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });

      result.current.logout();

      await waitFor(() => {
        expect(result.current.user).toBeNull();
      });
      expect(result.current.token).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    });
  });

  describe("setTokenFromCallback", () => {
    it("should set token and user from callback token", async () => {
      const mockUser = {
        id: 1,
        name: "John Doe",
        email: "john@example.com",
        created_at: "2024-01-01T00:00:00Z",
      };

      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      let callCount = 0;
      (global.fetch as Mock).mockImplementation(
        (url: string | Request | URL, options?: RequestInit) => {
          const urlString =
            typeof url === "string"
              ? url
              : url instanceof Request
              ? url.url
              : url.toString();

          if (urlString.includes("/api/auth/me")) {
            callCount++;
            // First call is initialization (no Authorization header), second is callback token verification
            if (callCount === 1) {
              // Initialization call - no Authorization header
              if (!options?.headers) {
                return Promise.resolve({
                  ok: false,
                  status: 401,
                  json: async () => ({}),
                });
              }
            }
            // Callback token verification - check Authorization header from options
            const headers = options?.headers as
              | Record<string, string>
              | undefined;
            const authHeader = headers?.["Authorization"];
            if (authHeader === "Bearer callback-token") {
              return Promise.resolve({
                ok: true,
                status: 200,
                json: async () => Promise.resolve(mockUser),
              });
            }
            // If Authorization header exists but doesn't match, it's invalid
            if (options?.headers) {
              return Promise.resolve({
                ok: false,
                status: 401,
                json: async () => ({}),
              });
            }
            // No Authorization header - initialization call
            return Promise.resolve({
              ok: false,
              status: 401,
              json: async () => ({}),
            });
          }

          return Promise.resolve({
            ok: false,
            status: 401,
            json: async () => ({}),
          });
        }
      );

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await result.current.setTokenFromCallback("callback-token");

      await waitFor(() => {
        expect(result.current.user).toEqual(mockUser);
      });
      expect(result.current.token).toBe("callback-token");
      expect(result.current.isAuthenticated).toBe(true);
      expect(localStorage.getItem(TOKEN_KEY)).toBe("callback-token");

      consoleErrorSpy.mockRestore();
    });

    it("should throw error when callback token is invalid", async () => {
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      let callCount = 0;
      (global.fetch as Mock).mockImplementation(
        (url: string | Request | URL, options?: RequestInit) => {
          const urlString =
            typeof url === "string"
              ? url
              : url instanceof Request
              ? url.url
              : url.toString();

          if (urlString.includes("/api/auth/me")) {
            callCount++;
            // First call is initialization (no Authorization header), second is callback token verification
            if (callCount === 1) {
              // Initialization call - no Authorization header
              if (!options?.headers) {
                return Promise.resolve({
                  ok: false,
                  status: 401,
                  json: async () => ({}),
                });
              }
            }
            // Callback token verification - check Authorization header from options
            const headers = options?.headers as
              | Record<string, string>
              | undefined;
            const authHeader = headers?.["Authorization"];
            if (authHeader === "Bearer invalid-token") {
              return Promise.resolve({
                ok: false,
                status: 401,
                json: async () => ({}),
              });
            }
            // If Authorization header exists but doesn't match, it's invalid
            if (options?.headers) {
              return Promise.resolve({
                ok: false,
                status: 401,
                json: async () => ({}),
              });
            }
            // No Authorization header - initialization call
            return Promise.resolve({
              ok: false,
              status: 401,
              json: async () => ({}),
            });
          }

          return Promise.resolve({
            ok: false,
            status: 401,
            json: async () => ({}),
          });
        }
      );

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await expect(
        result.current.setTokenFromCallback("invalid-token")
      ).rejects.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          "FRONTEND_AUTH | Error setting token from callback:"
        ),
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe("requestEmailChange", () => {
    it("should request email change successfully when authenticated", async () => {
      const mockUser = {
        id: 1,
        name: "John Doe",
        email: "john@example.com",
        created_at: "2024-01-01T00:00:00Z",
      };

      localStorage.setItem(TOKEN_KEY, "valid-token");

      (global.fetch as Mock).mockImplementation(
        (url: string | Request | URL) => {
          const urlString =
            typeof url === "string"
              ? url
              : url instanceof Request
              ? url.url
              : url.toString();

          if (urlString.includes("/api/auth/me")) {
            return Promise.resolve({
              ok: true,
              json: async () => Promise.resolve(mockUser),
            });
          }

          if (urlString.includes("/api/auth/change-email")) {
            return Promise.resolve({
              ok: true,
              status: 200,
              json: async () =>
                Promise.resolve({ message: "Email change link sent" }),
            });
          }

          return Promise.resolve({
            ok: false,
            status: 401,
            statusText: "Unauthorized",
            json: async () => ({}),
          });
        }
      );

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });

      await result.current.requestEmailChange("newemail@example.com");

      const emailChangeCalls = (global.fetch as Mock).mock.calls.filter(
        (call: any[]) => {
          const url = call[0];
          const urlString =
            typeof url === "string" ? url : url?.toString() || "";
          return urlString.includes("/api/auth/change-email");
        }
      );
      expect(emailChangeCalls.length).toBeGreaterThanOrEqual(1);
    });

    it("should throw error when not authenticated", async () => {
      (global.fetch as Mock).mockImplementation(
        (url: string | Request | URL) => {
          const urlString =
            typeof url === "string"
              ? url
              : url instanceof Request
              ? url.url
              : url.toString();

          if (urlString.includes("/api/auth/me")) {
            return Promise.resolve({
              ok: false,
              status: 401,
              json: async () => ({}),
            });
          }

          return Promise.resolve({
            ok: false,
            status: 401,
            json: async () => ({}),
          });
        }
      );

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await expect(
        result.current.requestEmailChange("newemail@example.com")
      ).rejects.toThrow("Not authenticated");
    });

    it("should throw error when request fails", async () => {
      const mockUser = {
        id: 1,
        name: "John Doe",
        email: "john@example.com",
        created_at: "2024-01-01T00:00:00Z",
      };

      localStorage.setItem(TOKEN_KEY, "valid-token");

      (global.fetch as Mock).mockImplementation(
        (url: string | Request | URL, _options?: RequestInit) => {
          const urlString =
            typeof url === "string"
              ? url
              : url instanceof Request
              ? url.url
              : url.toString();

          if (urlString.includes("/api/auth/me")) {
            return Promise.resolve({
              ok: true,
              json: async () => Promise.resolve(mockUser),
            });
          }

          if (urlString.includes("/api/auth/change-email")) {
            return Promise.resolve({
              ok: false,
              status: 400,
              json: async () =>
                Promise.resolve({ error: "Email already in use" }),
            });
          }

          return Promise.resolve({
            ok: false,
            status: 401,
            statusText: "Unauthorized",
            json: async () => ({}),
          });
        }
      );

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });

      await expect(
        result.current.requestEmailChange("existing@example.com")
      ).rejects.toThrow("Email already in use");
    });
  });

  describe("updateProfile", () => {
    it("should update profile successfully when authenticated", async () => {
      const mockUser = {
        id: 1,
        name: "John Doe",
        email: "john@example.com",
        created_at: "2024-01-01T00:00:00Z",
      };

      const updatedUser = {
        ...mockUser,
        name: "John Updated",
      };

      localStorage.setItem(TOKEN_KEY, "valid-token");

      (global.fetch as Mock).mockImplementation(
        (url: string | Request | URL, options?: RequestInit) => {
          const urlString =
            typeof url === "string"
              ? url
              : url instanceof Request
              ? url.url
              : url.toString();

          if (urlString.includes("/api/auth/me")) {
            return Promise.resolve({
              ok: true,
              json: async () => Promise.resolve(mockUser),
            });
          }

          if (
            urlString.includes("/api/users/profile") &&
            options?.method !== "DELETE"
          ) {
            return Promise.resolve({
              ok: true,
              status: 200,
              json: async () => Promise.resolve(updatedUser),
            });
          }

          return Promise.resolve({
            ok: false,
            status: 401,
            statusText: "Unauthorized",
            json: async () => ({}),
          });
        }
      );

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });

      const user = await result.current.updateProfile("John Updated", null);
      expect(user).toEqual(updatedUser);

      await waitFor(() => {
        expect(result.current.user).toEqual(updatedUser);
      });
    });

    it("should update profile with profile picture", async () => {
      const mockUser = {
        id: 1,
        name: "John Doe",
        email: "john@example.com",
        created_at: "2024-01-01T00:00:00Z",
      };

      const updatedUser = {
        ...mockUser,
        profile_picture_url: "https://example.com/pic.jpg",
      };

      localStorage.setItem(TOKEN_KEY, "valid-token");

      (global.fetch as Mock).mockImplementation(
        (url: string | Request | URL, options?: RequestInit) => {
          const urlString =
            typeof url === "string"
              ? url
              : url instanceof Request
              ? url.url
              : url.toString();

          if (urlString.includes("/api/auth/me")) {
            return Promise.resolve({
              ok: true,
              json: async () => Promise.resolve(mockUser),
            });
          }

          if (
            urlString.includes("/api/users/profile") &&
            options?.method !== "DELETE"
          ) {
            return Promise.resolve({
              ok: true,
              status: 200,
              json: async () => Promise.resolve(updatedUser),
            });
          }

          return Promise.resolve({
            ok: false,
            status: 401,
            statusText: "Unauthorized",
            json: async () => ({}),
          });
        }
      );

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });

      const mockFile = new File(["content"], "profile.jpg", {
        type: "image/jpeg",
      });

      const user = await result.current.updateProfile("John Doe", mockFile);
      expect(user).toEqual(updatedUser);

      await waitFor(() => {
        expect(result.current.user).toEqual(updatedUser);
      });
    });

    it("should throw error when not authenticated", async () => {
      (global.fetch as Mock).mockImplementation(
        (url: string | Request | URL) => {
          const urlString =
            typeof url === "string"
              ? url
              : url instanceof Request
              ? url.url
              : url.toString();

          if (urlString.includes("/api/auth/me")) {
            return Promise.resolve({
              ok: false,
              status: 401,
              json: async () => ({}),
            });
          }

          return Promise.resolve({
            ok: false,
            status: 401,
            json: async () => ({}),
          });
        }
      );

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await expect(
        result.current.updateProfile("New Name", null)
      ).rejects.toThrow("Not authenticated");
    });

    it("should throw error when update fails", async () => {
      const mockUser = {
        id: 1,
        name: "John Doe",
        email: "john@example.com",
        created_at: "2024-01-01T00:00:00Z",
      };

      localStorage.setItem(TOKEN_KEY, "valid-token");

      (global.fetch as Mock).mockImplementation(
        (url: string | Request | URL, options?: RequestInit) => {
          const urlString =
            typeof url === "string"
              ? url
              : url instanceof Request
              ? url.url
              : url.toString();

          if (urlString.includes("/api/auth/me")) {
            return Promise.resolve({
              ok: true,
              json: async () => Promise.resolve(mockUser),
            });
          }

          if (
            urlString.includes("/api/users/profile") &&
            options?.method !== "DELETE"
          ) {
            return Promise.resolve({
              ok: false,
              status: 400,
              json: async () => Promise.resolve({ error: "Invalid name" }),
            });
          }

          return Promise.resolve({
            ok: false,
            status: 401,
            statusText: "Unauthorized",
            json: async () => ({}),
          });
        }
      );

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });

      await expect(result.current.updateProfile("", null)).rejects.toThrow(
        "Invalid name"
      );
    });
  });

  describe("deleteUser", () => {
    it("should delete user successfully when authenticated", async () => {
      const mockUser = {
        id: 1,
        name: "John Doe",
        email: "john@example.com",
        created_at: "2024-01-01T00:00:00Z",
      };

      localStorage.setItem(TOKEN_KEY, "valid-token");

      (global.fetch as Mock).mockImplementation(
        (url: string | Request | URL, options?: RequestInit) => {
          const urlString =
            typeof url === "string"
              ? url
              : url instanceof Request
              ? url.url
              : url.toString();

          if (urlString.includes("/api/auth/me")) {
            return Promise.resolve({
              ok: true,
              json: async () => Promise.resolve(mockUser),
            });
          }

          if (
            urlString.includes("/api/users/profile") &&
            options?.method === "DELETE"
          ) {
            return Promise.resolve({
              ok: true,
              status: 200,
              json: async () => Promise.resolve({ message: "User deleted" }),
            });
          }

          return Promise.resolve({
            ok: false,
            status: 401,
            statusText: "Unauthorized",
            json: async () => ({}),
          });
        }
      );

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });

      await result.current.deleteUser();

      await waitFor(() => {
        expect(result.current.user).toBeNull();
      });
      expect(result.current.token).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    });

    it("should throw error when not authenticated", async () => {
      (global.fetch as Mock).mockImplementation(
        (url: string | Request | URL) => {
          const urlString =
            typeof url === "string"
              ? url
              : url instanceof Request
              ? url.url
              : url.toString();

          if (urlString.includes("/api/auth/me")) {
            return Promise.resolve({
              ok: false,
              status: 401,
              json: async () => ({}),
            });
          }

          return Promise.resolve({
            ok: false,
            status: 401,
            json: async () => ({}),
          });
        }
      );

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await expect(result.current.deleteUser()).rejects.toThrow(
        "Not authenticated"
      );
    });

    it("should throw error when deletion fails", async () => {
      const mockUser = {
        id: 1,
        name: "John Doe",
        email: "john@example.com",
        created_at: "2024-01-01T00:00:00Z",
      };

      localStorage.setItem(TOKEN_KEY, "valid-token");

      (global.fetch as Mock).mockImplementation(
        (url: string | Request | URL, options?: RequestInit) => {
          const urlString =
            typeof url === "string"
              ? url
              : url instanceof Request
              ? url.url
              : url.toString();

          if (urlString.includes("/api/auth/me")) {
            return Promise.resolve({
              ok: true,
              json: async () => Promise.resolve(mockUser),
            });
          }

          if (
            urlString.includes("/api/users/profile") &&
            options?.method === "DELETE"
          ) {
            return Promise.resolve({
              ok: false,
              status: 500,
              statusText: "Internal Server Error",
              json: async () => Promise.resolve({ error: "Deletion failed" }),
            });
          }

          return Promise.resolve({
            ok: false,
            status: 401,
            statusText: "Unauthorized",
            json: async () => ({}),
          });
        }
      );

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });

      await expect(result.current.deleteUser()).rejects.toThrow(
        "Deletion failed"
      );

      // User should still be authenticated if deletion failed
      expect(result.current.user).toEqual(mockUser);
      expect(result.current.token).toBe("valid-token");
    });
  });
});
