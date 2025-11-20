import { renderHook, act, waitFor } from "@testing-library/react";
import { useTrackings } from "../useTrackings";
import { API_ENDPOINTS } from "../../config/api";
import { TrackingType } from "../../models/Tracking";

// Mock fetch
global.fetch = jest.fn();

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
});

describe("useTrackings", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
    localStorageMock.getItem.mockReturnValue("test-token");
  });

  it("should initialize with empty trackings array", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });

    const { result } = renderHook(() => useTrackings());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.trackings).toEqual([]);
    expect(global.fetch).toHaveBeenCalledWith(API_ENDPOINTS.trackings, {
      headers: {
        Authorization: "Bearer test-token",
      },
    });
  });

  it("should load trackings from API on mount", async () => {
    const storedTrackings = [
      {
        id: 1,
        user_id: 1,
        question: "Did I exercise?",
        type: TrackingType.TRUE_FALSE,
        start_tracking_date: "2024-01-01T10:00:00Z",
      },
      {
        id: 2,
        user_id: 1,
        question: "Did I meditate?",
        type: TrackingType.REGISTER,
        start_tracking_date: "2024-01-01T11:00:00Z",
      },
    ];

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => storedTrackings,
    });

    const { result } = renderHook(() => useTrackings());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.trackings).toEqual(storedTrackings);
    expect(global.fetch).toHaveBeenCalledWith(API_ENDPOINTS.trackings, {
      headers: {
        Authorization: "Bearer test-token",
      },
    });
  });

  it("should create a new tracking", async () => {
    (global.fetch as jest.Mock)
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
          start_tracking_date: "2024-01-01T10:00:00Z",
        }),
      });

    const { result } = renderHook(() => useTrackings());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    let newTracking: any;
    await act(async () => {
      newTracking = await result.current.createTracking(
        "Did I exercise?",
        TrackingType.TRUE_FALSE
      );
    });

    expect(newTracking!.question).toBe("Did I exercise?");
    expect(newTracking!.type).toBe(TrackingType.TRUE_FALSE);
    expect(result.current.trackings).toHaveLength(1);
    expect(result.current.trackings[0].question).toBe("Did I exercise?");
  });

  it("should update a tracking", async () => {
    const existingTracking = {
      id: 1,
      user_id: 1,
      question: "Old Question",
      type: TrackingType.TRUE_FALSE,
      start_tracking_date: "2024-01-01T10:00:00Z",
    };

    (global.fetch as jest.Mock)
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

    await act(async () => {
      await result.current.updateTracking(1, "New Question");
    });

    expect(result.current.trackings[0].question).toBe("New Question");
    expect(global.fetch).toHaveBeenCalledWith(`${API_ENDPOINTS.trackings}/1`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-token",
      },
      body: JSON.stringify({
        question: "New Question",
      }),
    });
  });

  it("should delete a tracking", async () => {
    const existingTracking = {
      id: 1,
      user_id: 1,
      question: "Question",
      type: TrackingType.TRUE_FALSE,
      start_tracking_date: "2024-01-01T10:00:00Z",
    };

    (global.fetch as jest.Mock)
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

    await act(async () => {
      await result.current.deleteTracking(1);
    });

    expect(result.current.trackings).toHaveLength(0);
    expect(global.fetch).toHaveBeenCalledWith(`${API_ENDPOINTS.trackings}/1`, {
      method: "DELETE",
      headers: {
        Authorization: "Bearer test-token",
      },
    });
  });

  it("should handle API errors gracefully", async () => {
    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    (global.fetch as jest.Mock).mockRejectedValueOnce(
      new Error("Network error")
    );

    const { result } = renderHook(() => useTrackings());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.trackings).toEqual([]);

    consoleErrorSpy.mockRestore();
  });

  it("should throw error when API request fails", async () => {
    (global.fetch as jest.Mock)
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

    await expect(async () => {
      await act(async () => {
        await result.current.createTracking(
          "Test Question",
          TrackingType.TRUE_FALSE
        );
      });
    }).rejects.toThrow();
  });

  it("should throw error when not authenticated", async () => {
    localStorageMock.getItem.mockReturnValue(null);

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });

    const { result } = renderHook(() => useTrackings());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await expect(async () => {
      await act(async () => {
        await result.current.createTracking(
          "Test Question",
          TrackingType.TRUE_FALSE
        );
      });
    }).rejects.toThrow("Not authenticated");
  });
});
