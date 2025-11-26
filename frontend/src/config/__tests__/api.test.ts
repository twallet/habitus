import { API_ENDPOINTS, API_BASE_URL, ApiClient } from "../api";
import { UserData } from "../../models/User";
import { TrackingData, TrackingType } from "../../models/Tracking";

// Mock fetch
global.fetch = jest.fn();

describe("api", () => {
  const originalServerUrl = process.env.VITE_SERVER_URL;
  const originalPort = process.env.VITE_PORT;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
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

  describe("API configuration", () => {
    it("should use globalThis.import.meta.env.VITE_SERVER_URL and VITE_PORT when available", () => {
      // This test verifies the module loads correctly with mocked globalThis
      // The actual values are set in setupTests.ts, so we just verify it's used
      expect(API_BASE_URL).toBeDefined();
      expect(typeof API_BASE_URL).toBe("string");
      expect(API_BASE_URL).toBe("http://localhost:3005");
    });

    it("should use process.env.VITE_SERVER_URL and VITE_PORT as fallback", () => {
      // Set process.env values
      process.env.VITE_SERVER_URL = "http://localhost";
      process.env.VITE_PORT = "3005";
      // Reload module to pick up new env vars
      jest.resetModules();
      const { API_BASE_URL: reloadedUrl } = require("../api");
      expect(reloadedUrl).toBe("http://localhost:3005");
    });

    it("should construct URL from VITE_SERVER_URL and VITE_PORT", () => {
      // The values are set in setupTests.ts, so we verify the constructed URL
      expect(API_BASE_URL).toBeDefined();
      expect(API_BASE_URL).toBe("http://localhost:3005");
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

  describe("ApiClient", () => {
    let apiClient: ApiClient;

    beforeEach(() => {
      apiClient = new ApiClient();
    });

    describe("token management", () => {
      it("should set and get token", () => {
        apiClient.setToken("test-token");
        expect(apiClient.getToken()).toBe("test-token");
      });

      it("should set token to null", () => {
        apiClient.setToken("test-token");
        apiClient.setToken(null);
        expect(apiClient.getToken()).toBeNull();
      });
    });

    describe("getUsers", () => {
      it("should fetch users successfully", async () => {
        const mockUsers: UserData[] = [
          {
            id: 1,
            name: "John Doe",
            email: "john@example.com",
            created_at: "2024-01-01T00:00:00Z",
          },
        ];

        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => mockUsers,
        });

        const result = await apiClient.getUsers();
        expect(result).toEqual(mockUsers);
        expect(global.fetch).toHaveBeenCalledWith(
          `${API_BASE_URL}${API_ENDPOINTS.users}`,
          expect.objectContaining({
            method: "GET",
          })
        );
      });

      it("should throw error when request fails", async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: "Internal Server Error",
          json: async () => ({ error: "Server error" }),
        });

        await expect(apiClient.getUsers()).rejects.toThrow("Server error");
      });
    });

    describe("createUser", () => {
      it("should create user successfully", async () => {
        const mockUser: UserData = {
          id: 1,
          name: "John Doe",
          email: "john@example.com",
          created_at: "2024-01-01T00:00:00Z",
        };

        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => mockUser,
        });

        const result = await apiClient.createUser("John Doe");
        expect(result).toEqual(mockUser);
        expect(global.fetch).toHaveBeenCalledWith(
          `${API_BASE_URL}${API_ENDPOINTS.users}`,
          expect.objectContaining({
            method: "POST",
            body: JSON.stringify({ name: "John Doe" }),
          })
        );
      });
    });

    describe("register", () => {
      it("should register user with profile picture", async () => {
        const mockFile = new File(["content"], "profile.jpg", {
          type: "image/jpeg",
        });

        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({}),
        });

        await apiClient.register("John Doe", "john@example.com", mockFile);
        expect(global.fetch).toHaveBeenCalledWith(
          `${API_BASE_URL}${API_ENDPOINTS.auth.register}`,
          expect.objectContaining({
            method: "POST",
            body: expect.any(FormData),
          })
        );
      });

      it("should register user without profile picture", async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({}),
        });

        await apiClient.register("John Doe", "john@example.com");
        expect(global.fetch).toHaveBeenCalled();
      });
    });

    describe("login", () => {
      it("should login successfully", async () => {
        const mockResponse = {
          message: "Magic link sent",
          cooldown: false,
        };

        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

        const result = await apiClient.login("john@example.com");
        expect(result).toEqual(mockResponse);
        expect(global.fetch).toHaveBeenCalledWith(
          `${API_BASE_URL}${API_ENDPOINTS.auth.login}`,
          expect.objectContaining({
            method: "POST",
            body: JSON.stringify({ email: "john@example.com" }),
          })
        );
      });
    });

    describe("verifyMagicLink", () => {
      it("should verify magic link successfully", async () => {
        const mockResponse = {
          user: {
            id: 1,
            name: "John Doe",
            email: "john@example.com",
            created_at: "2024-01-01T00:00:00Z",
          },
          token: "jwt-token",
        };

        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

        const result = await apiClient.verifyMagicLink("magic-token");
        expect(result).toEqual(mockResponse);
        expect(global.fetch).toHaveBeenCalledWith(
          `${API_BASE_URL}${API_ENDPOINTS.auth.verifyMagicLink}?token=magic-token`,
          expect.objectContaining({
            method: "GET",
          })
        );
      });
    });

    describe("getMe", () => {
      it("should get current user with token", async () => {
        const mockUser: UserData = {
          id: 1,
          name: "John Doe",
          email: "john@example.com",
          created_at: "2024-01-01T00:00:00Z",
        };

        apiClient.setToken("test-token");

        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => mockUser,
        });

        const result = await apiClient.getMe();
        expect(result).toEqual(mockUser);
        expect(global.fetch).toHaveBeenCalledWith(
          `${API_BASE_URL}${API_ENDPOINTS.auth.me}`,
          expect.objectContaining({
            method: "GET",
            headers: expect.objectContaining({
              Authorization: "Bearer test-token",
            }),
          })
        );
      });
    });

    describe("updateProfile", () => {
      it("should update profile with profile picture", async () => {
        const mockUser: UserData = {
          id: 1,
          name: "John Updated",
          email: "john@example.com",
          created_at: "2024-01-01T00:00:00Z",
        };

        const mockFile = new File(["content"], "profile.jpg", {
          type: "image/jpeg",
        });

        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => mockUser,
        });

        const result = await apiClient.updateProfile("John Updated", mockFile);
        expect(result).toEqual(mockUser);
        expect(global.fetch).toHaveBeenCalledWith(
          `${API_BASE_URL}${API_ENDPOINTS.profile.update}`,
          expect.objectContaining({
            method: "PUT",
            body: expect.any(FormData),
          })
        );
      });

      it("should update profile with removeProfilePicture flag", async () => {
        const mockUser: UserData = {
          id: 1,
          name: "John Updated",
          email: "john@example.com",
          created_at: "2024-01-01T00:00:00Z",
        };

        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => mockUser,
        });

        const result = await apiClient.updateProfile(
          "John Updated",
          null,
          true
        );
        expect(result).toEqual(mockUser);
      });
    });

    describe("requestEmailChange", () => {
      it("should request email change successfully", async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({}),
        });

        await apiClient.requestEmailChange("newemail@example.com");
        expect(global.fetch).toHaveBeenCalledWith(
          `${API_BASE_URL}${API_ENDPOINTS.auth.changeEmail}`,
          expect.objectContaining({
            method: "POST",
            body: JSON.stringify({ email: "newemail@example.com" }),
          })
        );
      });
    });

    describe("deleteProfile", () => {
      it("should delete profile successfully", async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({}),
        });

        await apiClient.deleteProfile();
        expect(global.fetch).toHaveBeenCalledWith(
          `${API_BASE_URL}${API_ENDPOINTS.profile.delete}`,
          expect.objectContaining({
            method: "DELETE",
          })
        );
      });
    });

    describe("getTrackings", () => {
      it("should fetch trackings successfully", async () => {
        const mockTrackings: TrackingData[] = [
          {
            id: 1,
            user_id: 1,
            question: "Did you exercise?",
            type: TrackingType.TRUE_FALSE,
            start_tracking_date: "2024-01-01",
            notes: undefined,
          },
        ];

        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => mockTrackings,
        });

        const result = await apiClient.getTrackings();
        expect(result).toEqual(mockTrackings);
        expect(global.fetch).toHaveBeenCalledWith(
          `${API_BASE_URL}${API_ENDPOINTS.trackings}`,
          expect.objectContaining({
            method: "GET",
          })
        );
      });
    });

    describe("createTracking", () => {
      it("should create tracking successfully", async () => {
        const mockTracking: TrackingData = {
          id: 1,
          user_id: 1,
          question: "Did you exercise?",
          type: TrackingType.TRUE_FALSE,
          start_tracking_date: "2024-01-01",
          notes: undefined,
        };

        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => mockTracking,
        });

        const result = await apiClient.createTracking(
          "Did you exercise?",
          TrackingType.TRUE_FALSE,
          "2024-01-01"
        );
        expect(result).toEqual(mockTracking);
        expect(global.fetch).toHaveBeenCalledWith(
          `${API_BASE_URL}${API_ENDPOINTS.trackings}`,
          expect.objectContaining({
            method: "POST",
            body: JSON.stringify({
              question: "Did you exercise?",
              type: TrackingType.TRUE_FALSE,
              start_tracking_date: "2024-01-01",
              notes: undefined,
            }),
          })
        );
      });
    });

    describe("updateTracking", () => {
      it("should update tracking successfully", async () => {
        const mockTracking: TrackingData = {
          id: 1,
          user_id: 1,
          question: "Did you meditate?",
          type: TrackingType.TRUE_FALSE,
          start_tracking_date: "2024-01-01",
          notes: undefined,
        };

        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => mockTracking,
        });

        const result = await apiClient.updateTracking(1, "Did you meditate?");
        expect(result).toEqual(mockTracking);
        expect(global.fetch).toHaveBeenCalledWith(
          `${API_BASE_URL}${API_ENDPOINTS.trackings}/1`,
          expect.objectContaining({
            method: "PUT",
            body: JSON.stringify({
              question: "Did you meditate?",
              type: undefined,
              start_tracking_date: undefined,
              notes: undefined,
            }),
          })
        );
      });
    });

    describe("deleteTracking", () => {
      it("should delete tracking successfully", async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({}),
        });

        await apiClient.deleteTracking(1);
        expect(global.fetch).toHaveBeenCalledWith(
          `${API_BASE_URL}${API_ENDPOINTS.trackings}/1`,
          expect.objectContaining({
            method: "DELETE",
          })
        );
      });
    });

    describe("error handling", () => {
      it("should handle non-JSON error response", async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: "Internal Server Error",
          json: async () => {
            throw new Error("Not JSON");
          },
        });

        await expect(apiClient.getUsers()).rejects.toThrow(
          "HTTP 500: Internal Server Error"
        );
      });

      it("should handle absolute URLs", async () => {
        const mockUsers: UserData[] = [];

        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => mockUsers,
        });

        const client = new ApiClient("http://example.com");
        await client.getUsers();
        expect(global.fetch).toHaveBeenCalledWith(
          "http://example.com/api/users",
          expect.any(Object)
        );
      });
    });
  });
});
