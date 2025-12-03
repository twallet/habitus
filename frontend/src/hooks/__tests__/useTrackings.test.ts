// @vitest-environment jsdom
import { vi, type Mock } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useTrackings } from "../useTrackings";
import { API_ENDPOINTS } from "../../config/api";
import { TrackingType, DaysPatternType } from "../../models/Tracking";

// Mock fetch
global.fetch = vi.fn();

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
});

describe("useTrackings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as Mock).mockClear();
    localStorageMock.getItem.mockReturnValue("test-token");
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

  it("should load trackings from API on mount", async () => {
    const storedTrackings = [
      {
        id: 1,
        user_id: 1,
        question: "Did I exercise?",
        type: TrackingType.TRUE_FALSE,
      },
      {
        id: 2,
        user_id: 1,
        question: "Did I meditate?",
        type: TrackingType.REGISTER,
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
          type: TrackingType.TRUE_FALSE,
        }),
      });

    const { result } = renderHook(() => useTrackings());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const defaultDays = {
      pattern_type: DaysPatternType.INTERVAL,
      interval_value: 1,
      interval_unit: "days" as const,
    };
    const newTracking = await result.current.createTracking(
      "Did I exercise?",
      TrackingType.TRUE_FALSE,
      undefined,
      undefined,
      [{ hour: 9, minutes: 0 }],
      defaultDays
    );

    expect(newTracking!.question).toBe("Did I exercise?");
    expect(newTracking!.type).toBe(TrackingType.TRUE_FALSE);
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
      type: TrackingType.TRUE_FALSE,
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

    const defaultDays = {
      pattern_type: DaysPatternType.INTERVAL,
      interval_value: 1,
      interval_unit: "days" as const,
    };

    await result.current.updateTracking(1, defaultDays, "New Question");

    await waitFor(() => {
      expect(result.current.trackings[0].question).toBe("New Question");
    });
    expect(global.fetch).toHaveBeenCalledWith(`${API_ENDPOINTS.trackings}/1`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-token",
      },
      body: JSON.stringify({
        question: "New Question",
        days: defaultDays,
      }),
    });
  });

  it("should delete a tracking", async () => {
    const existingTracking = {
      id: 1,
      user_id: 1,
      question: "Question",
      type: TrackingType.TRUE_FALSE,
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

    const defaultDays = {
      pattern_type: DaysPatternType.INTERVAL,
      interval_value: 1,
      interval_unit: "days" as const,
    };
    await expect(
      result.current.createTracking(
        "Test Question",
        TrackingType.TRUE_FALSE,
        undefined,
        undefined,
        [{ hour: 9, minutes: 0 }],
        defaultDays
      )
    ).rejects.toThrow();
  });

  it("should throw error when not authenticated", async () => {
    localStorageMock.getItem.mockReturnValue(null);

    (global.fetch as Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });

    const { result } = renderHook(() => useTrackings());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const defaultDays = {
      pattern_type: DaysPatternType.INTERVAL,
      interval_value: 1,
      interval_unit: "days" as const,
    };
    await expect(
      result.current.createTracking(
        "Test Question",
        TrackingType.TRUE_FALSE,
        undefined,
        undefined,
        [{ hour: 9, minutes: 0 }],
        defaultDays
      )
    ).rejects.toThrow("Not authenticated");
  });
});
