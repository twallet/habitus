import { renderHook, waitFor, act } from "@testing-library/react";
import { useAuth } from "../useAuth";
import { API_ENDPOINTS } from "../../config/api";

// Mock fetch
global.fetch = jest.fn();

const TOKEN_KEY = "habitus_token";

describe("useAuth", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockReset();
    (global.fetch as jest.Mock).mockClear();
    localStorage.clear();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe("initialization", () => {
    it("should initialize with loading state and no user", async () => {
      // No token in localStorage, so no fetch call
      // But we still need to mock fetch in case it's called
      (global.fetch as jest.Mock).mockResolvedValue({
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

      (global.fetch as jest.Mock).mockResolvedValueOnce({
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

      (global.fetch as jest.Mock).mockResolvedValueOnce({
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

      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error("Network error")
      );

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.user).toBeNull();
      expect(result.current.token).toBeNull();
      expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error verifying token:",
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe("requestLoginMagicLink", () => {
    it("should request login magic link successfully", async () => {
      let callCount = 0;
      (global.fetch as jest.Mock).mockImplementation(
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

      await act(async () => {
        await result.current.requestLoginMagicLink("test@example.com");
      });

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
      (global.fetch as jest.Mock).mockImplementation(
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
        act(async () => {
          await result.current.requestLoginMagicLink("invalid@example.com");
        })
      ).rejects.toThrow("Invalid email");
    });

    it("should handle non-JSON error response", async () => {
      (global.fetch as jest.Mock).mockImplementation(
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
        act(async () => {
          await result.current.requestLoginMagicLink("test@example.com");
        })
      ).rejects.toThrow("Error requesting login magic link");
    });
  });

  describe("requestRegisterMagicLink", () => {
    it("should request registration magic link with all fields", async () => {
      (global.fetch as jest.Mock).mockImplementation(
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

      await act(async () => {
        await result.current.requestRegisterMagicLink(
          "John Doe",
          "john@example.com",
          "johndoe",
          "password123",
          mockFile
        );
      });

      expect(global.fetch).toHaveBeenCalledWith(
        API_ENDPOINTS.auth.register,
        expect.objectContaining({
          method: "POST",
        })
      );

      const callArgs = (global.fetch as jest.Mock).mock.calls.find(
        (call: any[]) =>
          call[0]?.includes?.("/api/auth/register") ||
          (typeof call[0] === "string" &&
            call[0].includes("/api/auth/register"))
      );
      expect(callArgs?.[1]?.body).toBeInstanceOf(FormData);
    });

    it("should request registration magic link with minimal fields", async () => {
      (global.fetch as jest.Mock).mockImplementation(
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

      await act(async () => {
        await result.current.requestRegisterMagicLink(
          "John Doe",
          "john@example.com"
        );
      });

      expect(global.fetch).toHaveBeenCalledWith(
        API_ENDPOINTS.auth.register,
        expect.objectContaining({
          method: "POST",
        })
      );
    });

    it("should throw error when registration fails", async () => {
      (global.fetch as jest.Mock).mockImplementation(
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
        act(async () => {
          await result.current.requestRegisterMagicLink(
            "John Doe",
            "existing@example.com"
          );
        })
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

      (global.fetch as jest.Mock).mockImplementation(
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

      await act(async () => {
        const user = await result.current.verifyMagicLink("magic-token");
        expect(user).toEqual(mockUser);
      });

      expect(result.current.user).toEqual(mockUser);
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
      (global.fetch as jest.Mock).mockImplementation(
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
        act(async () => {
          await result.current.verifyMagicLink("invalid-token");
        })
      ).rejects.toThrow("Invalid or expired magic link");
    });
  });

  describe("loginWithPassword", () => {
    it("should login with password and set user", async () => {
      let callCount = 0;
      const mockUser = {
        id: 1,
        name: "John Doe",
        email: "john@example.com",
        created_at: "2024-01-01T00:00:00Z",
      };

      (global.fetch as jest.Mock).mockImplementation(
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

          if (urlString.includes("/api/auth/login-password")) {
            // loginWithPassword call - success
            return Promise.resolve({
              ok: true,
              status: 200,
              json: async () =>
                Promise.resolve({
                  user: mockUser,
                  token: "password-token",
                }),
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

      await act(async () => {
        const user = await result.current.loginWithPassword(
          "john@example.com",
          "password123"
        );
        expect(user).toEqual(mockUser);
      });

      expect(result.current.user).toEqual(mockUser);
      expect(result.current.token).toBe("password-token");
      expect(result.current.isAuthenticated).toBe(true);
      expect(localStorage.getItem(TOKEN_KEY)).toBe("password-token");
      expect(global.fetch).toHaveBeenCalledWith(
        API_ENDPOINTS.auth.loginPassword,
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: "john@example.com",
            password: "password123",
          }),
        })
      );
    });

    it("should throw error when password login fails", async () => {
      (global.fetch as jest.Mock).mockImplementation(
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
              json: async () => Promise.resolve({}),
            });
          }

          if (urlString.includes("/api/auth/login-password")) {
            return Promise.resolve({
              ok: false,
              status: 401,
              json: async () =>
                Promise.resolve({ error: "Invalid credentials" }),
            });
          }

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

      await expect(
        act(async () => {
          await result.current.loginWithPassword(
            "john@example.com",
            "wrong-password"
          );
        })
      ).rejects.toThrow("Invalid credentials");
    });
  });

  describe("changePassword", () => {
    it("should change password when authenticated", async () => {
      const mockUser = {
        id: 1,
        name: "John Doe",
        email: "john@example.com",
        created_at: "2024-01-01T00:00:00Z",
      };

      localStorage.setItem(TOKEN_KEY, "valid-token");

      let callCount = 0;
      (global.fetch as jest.Mock).mockImplementation(
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
            // Initial token verification
            return Promise.resolve({
              ok: true,
              status: 200,
              json: async () => Promise.resolve(mockUser),
            });
          }

          if (urlString.includes("/api/auth/change-password")) {
            // changePassword call
            return Promise.resolve({
              ok: true,
              status: 200,
              json: async () =>
                Promise.resolve({ message: "Password changed" }),
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

      await waitFor(
        () => {
          expect(result.current.isAuthenticated).toBe(true);
        },
        { timeout: 3000 }
      );

      await act(async () => {
        await result.current.changePassword("old-password", "new-password");
      });

      expect(global.fetch).toHaveBeenCalledWith(
        API_ENDPOINTS.auth.changePassword,
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer valid-token",
          },
          body: JSON.stringify({
            currentPassword: "old-password",
            newPassword: "new-password",
          }),
        })
      );
    });

    it("should throw error when not authenticated", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({}),
      });

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await expect(
        act(async () => {
          await result.current.changePassword("old-password", "new-password");
        })
      ).rejects.toThrow("Not authenticated");
    });
  });

  describe("forgotPassword", () => {
    it("should request password reset email", async () => {
      let callCount = 0;
      (global.fetch as jest.Mock).mockImplementation(
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

          if (urlString.includes("/api/auth/forgot-password")) {
            // forgotPassword call - when ok is true, json() is not called
            return Promise.resolve({
              ok: true,
              status: 200,
              json: async () =>
                Promise.resolve({ message: "Reset email sent" }),
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

      await act(async () => {
        await result.current.forgotPassword("john@example.com");
      });

      expect(global.fetch).toHaveBeenCalledWith(
        API_ENDPOINTS.auth.forgotPassword,
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email: "john@example.com" }),
        })
      );
    });
  });

  describe("resetPassword", () => {
    it("should reset password with token", async () => {
      (global.fetch as jest.Mock).mockImplementation(
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
              json: async () => Promise.resolve({}),
            });
          }

          if (urlString.includes("/api/auth/reset-password")) {
            return Promise.resolve({
              ok: true,
              status: 200,
              json: async () => Promise.resolve({ message: "Password reset" }),
            });
          }

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

      await act(async () => {
        await result.current.resetPassword("reset-token", "new-password");
      });

      expect(global.fetch).toHaveBeenCalledWith(
        API_ENDPOINTS.auth.resetPassword,
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            token: "reset-token",
            newPassword: "new-password",
          }),
        })
      );
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

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockUser,
      });

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });

      act(() => {
        result.current.logout();
      });

      expect(result.current.user).toBeNull();
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

      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

      let callCount = 0;
      (global.fetch as jest.Mock).mockImplementation(
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

      await act(async () => {
        await result.current.setTokenFromCallback("callback-token");
      });

      expect(result.current.user).toEqual(mockUser);
      expect(result.current.token).toBe("callback-token");
      expect(result.current.isAuthenticated).toBe(true);
      expect(localStorage.getItem(TOKEN_KEY)).toBe("callback-token");

      consoleErrorSpy.mockRestore();
    });

    it("should throw error when callback token is invalid", async () => {
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

      let callCount = 0;
      (global.fetch as jest.Mock).mockImplementation(
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

      await act(async () => {
        await expect(
          result.current.setTokenFromCallback("invalid-token")
        ).rejects.toThrow("Invalid token");
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error setting token from callback:",
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });
  });
});
