// @vitest-environment jsdom
import { vi, type Mock } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useUsers } from "../useUsers";

// Mock fetch
global.fetch = vi.fn();

describe("useUsers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as Mock).mockClear();
  });

  it("should initialize with empty users array", async () => {
    (global.fetch as Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });

    const { result } = renderHook(() => useUsers());

    await waitFor(() => {
      expect(result.current.isInitialized).toBe(true);
    });

    expect(result.current.users).toEqual([]);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/users"),
      expect.objectContaining({
        method: "GET",
        headers: expect.any(Object),
      })
    );
  });

  it("should load users from API on mount", async () => {
    const storedUsers = [
      { id: 1, name: "User 1" },
      { id: 2, name: "User 2" },
    ];

    (global.fetch as Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => storedUsers,
    });

    const { result } = renderHook(() => useUsers());

    await waitFor(() => {
      expect(result.current.isInitialized).toBe(true);
    });

    expect(result.current.users).toEqual(storedUsers);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/users"),
      expect.objectContaining({
        method: "GET",
        headers: expect.any(Object),
      })
    );
  });

  it("should create a new user", async () => {
    (global.fetch as Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 1, name: "New User" }),
      });

    const { result } = renderHook(() => useUsers());

    await waitFor(() => {
      expect(result.current.isInitialized).toBe(true);
    });

    const newUser = await result.current.createUser("New User");

    expect(newUser!.name).toBe("New User");
    expect(newUser!.id).toBe(1);
    await waitFor(() => {
      expect(result.current.users).toHaveLength(1);
    });
    expect(result.current.users[0].name).toBe("New User");
    expect(result.current.users[0].id).toBe(1);
  });

  it("should save users to API when creating", async () => {
    (global.fetch as Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 1, name: "Test User" }),
      });

    const { result } = renderHook(() => useUsers());

    await waitFor(() => {
      expect(result.current.isInitialized).toBe(true);
    });

    await result.current.createUser("Test User");

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/users"),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({ name: "Test User" }),
      })
    );
    await waitFor(() => {
      expect(result.current.users).toHaveLength(1);
    });
    expect(result.current.users[0].name).toBe("Test User");
  });

  it("should handle multiple users", async () => {
    (global.fetch as Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 1, name: "User 1" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 2, name: "User 2" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 3, name: "User 3" }),
      });

    const { result } = renderHook(() => useUsers());

    await waitFor(() => {
      expect(result.current.isInitialized).toBe(true);
    });

    await result.current.createUser("User 1");
    await result.current.createUser("User 2");
    await result.current.createUser("User 3");

    await waitFor(() => {
      expect(result.current.users).toHaveLength(3);
    });
    expect(result.current.users[0].name).toBe("User 1");
    expect(result.current.users[1].name).toBe("User 2");
    expect(result.current.users[2].name).toBe("User 3");
  });

  it("should handle API errors gracefully", async () => {
    // Suppress console.error for this test since we're testing error handling
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    (global.fetch as Mock).mockRejectedValueOnce(new Error("Network error"));

    const { result } = renderHook(() => useUsers());

    await waitFor(() => {
      expect(result.current.isInitialized).toBe(true);
    });

    expect(result.current.users).toEqual([]);
    expect(result.current.error).toBeTruthy();

    // Restore console.error
    consoleErrorSpy.mockRestore();
  });

  it("should throw error when API request fails", async () => {
    (global.fetch as Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "Error creating user" }),
      });

    const { result } = renderHook(() => useUsers());

    await waitFor(() => {
      expect(result.current.isInitialized).toBe(true);
    });

    await expect(result.current.createUser("Test User")).rejects.toThrow();
  });

  it("should handle API error responses", async () => {
    (global.fetch as Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: "Name is required" }),
      });

    const { result } = renderHook(() => useUsers());

    await waitFor(() => {
      expect(result.current.isInitialized).toBe(true);
    });

    await expect(result.current.createUser("")).rejects.toThrow(
      "Name is required"
    );
  });

  it("should handle error when error is not an Error instance in createUser", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    (global.fetch as Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })
      .mockRejectedValueOnce("String error"); // Non-Error value

    const { result } = renderHook(() => useUsers());

    await waitFor(() => {
      expect(result.current.isInitialized).toBe(true);
    });

    await expect(result.current.createUser("Test User")).rejects.toBe(
      "String error"
    );

    await waitFor(() => {
      expect(result.current.error).toBe("Error creating user");
    });

    consoleErrorSpy.mockRestore();
  });

  it("should handle error when error is not an Error instance in useEffect", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    (global.fetch as Mock).mockRejectedValueOnce("String error");

    const { result } = renderHook(() => useUsers());

    await waitFor(() => {
      expect(result.current.isInitialized).toBe(true);
    });

    expect(result.current.users).toEqual([]);
    expect(result.current.error).toBe("Error loading users");

    consoleErrorSpy.mockRestore();
  });

  it("should clear error when createUser succeeds after previous error", async () => {
    (global.fetch as Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })
      .mockRejectedValueOnce(new Error("First error"))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 1, name: "Success User" }),
      });

    const { result } = renderHook(() => useUsers());

    await waitFor(() => {
      expect(result.current.isInitialized).toBe(true);
    });

    // First call fails
    await expect(result.current.createUser("Test")).rejects.toThrow();
    expect(result.current.error).toBeTruthy();

    // Second call succeeds
    await result.current.createUser("Success User");

    await waitFor(() => {
      expect(result.current.error).toBeNull();
    });
  });
});
