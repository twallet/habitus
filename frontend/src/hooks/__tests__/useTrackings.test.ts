// @vitest-environment jsdom
import { vi, type Mock } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useTrackings } from "../useTrackings";
import { API_ENDPOINTS } from "../../config/api";
import { Frequency, TrackingState } from "../../models/Tracking";
import { tokenManager } from "../base/TokenManager.js";

// Mock fetch
global.fetch = vi.fn();

const TOKEN_KEY = "habitus_token";

describe("useTrackings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as Mock).mockClear();
    localStorage.clear();
    tokenManager.reset();
    localStorage.setItem(TOKEN_KEY, "test-token");
  });

  it("should initialize with empty trackings array", async () => {
    (global.fetch as Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });

    const { result } = renderHook(() => useTrackings());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.trackings).toEqual([]);
    expect(global.fetch).toHaveBeenCalledWith(
      API_ENDPOINTS.trackings,
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer test-token",
        }),
      })
    );
  });

  it("should clear trackings when no token is present", async () => {
    localStorage.removeItem(TOKEN_KEY);
    const consoleWarnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => {});

    const { result } = renderHook(() => useTrackings());

    await waitFor(() => {
      expect(result.current.trackings).toEqual([]);
    });

    expect(consoleWarnSpy).toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();

    consoleWarnSpy.mockRestore();
  });

  it("should load trackings from API on mount", async () => {
    const storedTrackings = [
      {
        id: 1,
        user_id: 1,
        question: "Did I exercise?",
      },
      {
        id: 2,
        user_id: 1,
        question: "Did I meditate?",
      },
    ];

    (global.fetch as Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => storedTrackings,
    });

    const { result } = renderHook(() => useTrackings());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.trackings).toEqual(storedTrackings);
    expect(global.fetch).toHaveBeenCalledWith(
      API_ENDPOINTS.trackings,
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer test-token",
        }),
      })
    );
  });

  it("should create a new tracking", async () => {
    (global.fetch as Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 1,
          user_id: 1,
          question: "Did I exercise?",
        }),
      });

    const { result } = renderHook(() => useTrackings());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const defaultFrequency: Frequency = {
      type: "daily",
    };
    const newTracking = await result.current.createTracking(
      "Did I exercise?",
      undefined,
      undefined,
      [{ hour: 9, minutes: 0 }],
      defaultFrequency
    );

    expect(newTracking!.question).toBe("Did I exercise?");
    await waitFor(() => {
      expect(result.current.trackings).toHaveLength(1);
    });
    expect(result.current.trackings[0].question).toBe("Did I exercise?");
  });

  it("should update a tracking", async () => {
    const existingTracking = {
      id: 1,
      user_id: 1,
      question: "Old Question",
    };

    (global.fetch as Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [existingTracking],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ...existingTracking,
          question: "New Question",
        }),
      });

    const { result } = renderHook(() => useTrackings());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const defaultFrequency: Frequency = {
      type: "daily",
    };

    await result.current.updateTracking(1, defaultFrequency, "New Question");

    await waitFor(() => {
      expect(result.current.trackings[0].question).toBe("New Question");
    });
    expect(global.fetch).toHaveBeenCalledWith(
      `${API_ENDPOINTS.trackings}/1`,
      expect.objectContaining({
        method: "PUT",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          Authorization: "Bearer test-token",
        }),
        body: expect.stringContaining('"question":"New Question"'),
      })
    );
    // Verify the body contains the expected data
    const fetchCalls = (global.fetch as Mock).mock.calls;
    const updateCall = fetchCalls.find(
      (call) =>
        call[0] === `${API_ENDPOINTS.trackings}/1` && call[1]?.method === "PUT"
    );
    expect(updateCall).toBeDefined();
    expect(updateCall![1]).toBeDefined();
    const body = JSON.parse(updateCall![1].body);
    expect(body.question).toBe("New Question");
    expect(body.frequency).toEqual(defaultFrequency);
  });

  it("should delete a tracking", async () => {
    const existingTracking = {
      id: 1,
      user_id: 1,
      question: "Question",
    };

    (global.fetch as Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [existingTracking],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

    const { result } = renderHook(() => useTrackings());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await result.current.deleteTracking(1);

    await waitFor(() => {
      expect(result.current.trackings).toHaveLength(0);
    });
    expect(global.fetch).toHaveBeenCalledWith(`${API_ENDPOINTS.trackings}/1`, {
      method: "DELETE",
      headers: {
        Authorization: "Bearer test-token",
      },
      credentials: "include",
    });
  });

  it("should handle API errors gracefully", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    (global.fetch as Mock).mockRejectedValueOnce(new Error("Network error"));

    const { result } = renderHook(() => useTrackings());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.trackings).toEqual([]);

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
        json: async () => ({ error: "Error creating tracking" }),
      });

    const { result } = renderHook(() => useTrackings());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const defaultFrequency: Frequency = {
      type: "daily",
    };
    await expect(
      result.current.createTracking(
        "Test Question",
        undefined,
        undefined,
        [{ hour: 9, minutes: 0 }],
        defaultFrequency
      )
    ).rejects.toThrow();
  });

  it("should throw error when not authenticated for createTracking", async () => {
    localStorage.removeItem(TOKEN_KEY);

    (global.fetch as Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });

    const { result } = renderHook(() => useTrackings());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const defaultFrequency: Frequency = {
      type: "daily",
    };
    await expect(
      result.current.createTracking(
        "Test Question",
        undefined,
        undefined,
        [{ hour: 9, minutes: 0 }],
        defaultFrequency
      )
    ).rejects.toThrow("Not authenticated");
  });

  it("should throw error when not authenticated for updateTracking", async () => {
    localStorage.removeItem(TOKEN_KEY);

    (global.fetch as Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });

    const { result } = renderHook(() => useTrackings());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const defaultFrequency: Frequency = {
      type: "daily",
    };
    await expect(
      result.current.updateTracking(1, defaultFrequency, "New Question")
    ).rejects.toThrow("Not authenticated");
  });

  it("should throw error when not authenticated for updateTrackingState", async () => {
    localStorage.removeItem(TOKEN_KEY);

    (global.fetch as Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });

    const { result } = renderHook(() => useTrackings());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await expect(
      result.current.updateTrackingState(1, TrackingState.PAUSED)
    ).rejects.toThrow("Not authenticated");
  });

  it("should throw error when not authenticated for deleteTracking", async () => {
    localStorage.removeItem(TOKEN_KEY);

    (global.fetch as Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });

    const { result } = renderHook(() => useTrackings());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await expect(result.current.deleteTracking(1)).rejects.toThrow(
      "Not authenticated"
    );
  });
});
