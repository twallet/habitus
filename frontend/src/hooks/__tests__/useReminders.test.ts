// @vitest-environment jsdom
import { vi, type Mock } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useReminders } from "../useReminders";
import {
  ReminderData,
  ReminderStatus,
  ReminderValue,
} from "../../models/Reminder";
import { API_ENDPOINTS } from "../../config/api";
import { tokenManager } from "../base/TokenManager.js";

// Mock fetch
global.fetch = vi.fn();

// Type declaration for localStorage in test environment
declare const localStorage: {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
  clear: () => void;
  length: number;
  key: (index: number) => string | null;
};

const TOKEN_KEY = "habitus_token";

describe("useReminders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as Mock).mockReset();
    (global.fetch as Mock).mockClear();
    localStorage.clear();
    // Stop any existing polling and reset TokenManager state
    tokenManager.stopPolling();
    // Reset document.hidden
    Object.defineProperty(document, "hidden", {
      writable: true,
      configurable: true,
      value: false,
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  describe("initialization", () => {
    it("should initialize with empty reminders when no token", async () => {
      (global.fetch as Mock).mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({}),
      });

      const { result } = renderHook(() => useReminders());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.reminders).toEqual([]);
    });

    it("should load reminders when token exists", async () => {
      const mockReminders: ReminderData[] = [
        {
          id: 1,
          tracking_id: 1,
          user_id: 1,
          scheduled_time: "2024-01-01T10:00:00Z",
          status: ReminderStatus.PENDING,
          value: ReminderValue.COMPLETED,
        },
      ];

      localStorage.setItem(TOKEN_KEY, "valid-token");

      (global.fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockReminders,
      });

      const { result } = renderHook(() => useReminders());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.reminders).toEqual(mockReminders);
      expect(global.fetch).toHaveBeenCalledWith(
        API_ENDPOINTS.reminders,
        expect.objectContaining({
          headers: {
            Authorization: "Bearer valid-token",
          },
        })
      );
    });

    it("should handle fetch error and clear reminders", async () => {
      localStorage.setItem(TOKEN_KEY, "valid-token");

      (global.fetch as Mock).mockRejectedValueOnce(new Error("Network error"));

      const { result } = renderHook(() => useReminders());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.reminders).toEqual([]);
    });
  });

  describe("token watching", () => {
    it("should detect token changes via storage event", async () => {
      localStorage.setItem(TOKEN_KEY, "token1");

      (global.fetch as Mock).mockResolvedValue({
        ok: true,
        json: async () => [],
      });

      const { result } = renderHook(() => useReminders());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const initialCallCount = (global.fetch as Mock).mock.calls.length;

      // Simulate storage event
      act(() => {
        const event = new StorageEvent("storage", {
          key: TOKEN_KEY,
          newValue: "token2",
        });
        window.dispatchEvent(event);
      });

      await waitFor(() => {
        expect((global.fetch as Mock).mock.calls.length).toBeGreaterThan(
          initialCallCount
        );
      });
    });

    it("should ignore storage events for other keys", async () => {
      localStorage.setItem(TOKEN_KEY, "token1");

      (global.fetch as Mock).mockResolvedValue({
        ok: true,
        json: async () => [],
      });

      const { result } = renderHook(() => useReminders());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const initialCallCount = (global.fetch as Mock).mock.calls.length;

      // Simulate storage event for different key
      act(() => {
        const event = new StorageEvent("storage", {
          key: "other_key",
          newValue: "value",
        });
        window.dispatchEvent(event);
      });

      // Wait a bit to ensure no additional calls
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect((global.fetch as Mock).mock.calls.length).toBe(initialCallCount);
    });

    it("should detect token changes via polling interval", async () => {
      localStorage.setItem(TOKEN_KEY, "token1");

      (global.fetch as Mock).mockResolvedValue({
        ok: true,
        json: async () => [],
      });

      const { result } = renderHook(() => useReminders());

      // Wait for initial load with real timers first
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Now switch to fake timers for the polling test
      // This ensures the TokenManager polling interval will be controlled by fake timers
      vi.useFakeTimers();

      // Advance timer to trigger first polling check and sync TokenManager state
      // This ensures currentToken is set to "token1" before we change it
      await act(async () => {
        vi.advanceTimersByTime(500);
        // Process all microtasks to ensure the polling callback completes
        await Promise.resolve();
        await Promise.resolve();
      });

      // Capture call count after initial polling sync
      // Note: initialCallCount might be 1 (initial fetch) or 2 (if polling triggered a fetch)
      const initialCallCount = (global.fetch as Mock).mock.calls.length;

      // Change token in localStorage
      // This change will be detected by the next polling check
      act(() => {
        localStorage.setItem(TOKEN_KEY, "token2");
      });

      // Advance timer to trigger the polling interval check
      // The polling interval fires every 500ms, so advancing by 500ms should trigger it
      await act(async () => {
        // Advance to exactly when the interval should fire (500ms from last check)
        vi.advanceTimersByTime(500);
        // Process microtasks to allow the interval callback to execute
        await Promise.resolve();
        await Promise.resolve();
        // Advance a bit more to ensure any scheduled operations complete
        vi.advanceTimersByTime(10);
        // Process microtasks again to ensure the fetch promise resolves
        await Promise.resolve();
        await Promise.resolve();
      });

      // Switch to real timers for waitFor
      vi.useRealTimers();

      // Wait for fetch to complete
      await waitFor(
        () => {
          expect((global.fetch as Mock).mock.calls.length).toBeGreaterThan(
            initialCallCount
          );
        },
        { timeout: 2000 }
      );
    });

    it("should not poll when no token exists", async () => {
      (global.fetch as Mock).mockResolvedValue({
        ok: true,
        json: async () => [],
      });

      const { result } = renderHook(() => useReminders());

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      vi.useFakeTimers();
      const initialCallCount = (global.fetch as Mock).mock.calls.length;

      // Advance timer significantly - should not poll without token
      await act(async () => {
        vi.advanceTimersByTime(30000);
        await vi.runAllTimersAsync();
      });

      // Should not have made additional calls
      expect((global.fetch as Mock).mock.calls.length).toBe(initialCallCount);

      vi.useRealTimers();
    });
  });

  describe("updateReminder", () => {
    it("should update reminder successfully", async () => {
      const mockReminder: ReminderData = {
        id: 1,
        tracking_id: 1,
        user_id: 1,
        scheduled_time: "2024-01-01T10:00:00Z",
        status: ReminderStatus.PENDING,
        value: ReminderValue.COMPLETED,
      };

      const updatedReminder: ReminderData = {
        ...mockReminder,
        notes: "Some notes",
        status: ReminderStatus.ANSWERED,
      };

      localStorage.setItem(TOKEN_KEY, "valid-token");

      (global.fetch as Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [mockReminder],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => updatedReminder,
        });

      const { result } = renderHook(() => useReminders());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await result.current.updateReminder(
        1,
        "Some notes",
        ReminderStatus.ANSWERED
      );

      await waitFor(() => {
        expect(result.current.reminders[0].status).toBe(
          ReminderStatus.ANSWERED
        );
      });
    });

    it("should throw error when not authenticated", async () => {
      (global.fetch as Mock).mockResolvedValue({
        ok: true,
        json: async () => [],
      });

      const { result } = renderHook(() => useReminders());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await expect(result.current.updateReminder(1)).rejects.toThrow(
        "Not authenticated"
      );
    });

    it("should handle update error", async () => {
      const mockReminder: ReminderData = {
        id: 1,
        tracking_id: 1,
        user_id: 1,
        scheduled_time: "2024-01-01T10:00:00Z",
        status: ReminderStatus.PENDING,
        value: ReminderValue.COMPLETED,
      };

      localStorage.setItem(TOKEN_KEY, "valid-token");

      (global.fetch as Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [mockReminder],
        })
        .mockRejectedValueOnce(new Error("Update failed"));

      const { result } = renderHook(() => useReminders());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await expect(
        result.current.updateReminder(1, "Some notes")
      ).rejects.toThrow("Update failed");
    });
  });

  describe("snoozeReminder", () => {
    it("should snooze reminder successfully", async () => {
      const mockReminder: ReminderData = {
        id: 1,
        tracking_id: 1,
        user_id: 1,
        scheduled_time: "2024-01-01T10:00:00Z",
        status: ReminderStatus.PENDING,
        value: ReminderValue.COMPLETED,
      };

      const upcomingReminder: ReminderData = {
        ...mockReminder,
        status: ReminderStatus.UPCOMING,
        scheduled_time: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      };

      localStorage.setItem(TOKEN_KEY, "valid-token");

      (global.fetch as Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [mockReminder],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => upcomingReminder,
        });

      const { result } = renderHook(() => useReminders());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await result.current.snoozeReminder(1, 30);

      await waitFor(() => {
        expect(result.current.reminders[0].status).toBe(
          ReminderStatus.UPCOMING
        );
      });
    });

    it("should throw error when not authenticated", async () => {
      (global.fetch as Mock).mockResolvedValue({
        ok: true,
        json: async () => [],
      });

      const { result } = renderHook(() => useReminders());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await expect(result.current.snoozeReminder(1, 30)).rejects.toThrow(
        "Not authenticated"
      );
    });

    it("should handle snooze error", async () => {
      const mockReminder: ReminderData = {
        id: 1,
        tracking_id: 1,
        user_id: 1,
        scheduled_time: "2024-01-01T10:00:00Z",
        status: ReminderStatus.PENDING,
        value: ReminderValue.COMPLETED,
      };

      localStorage.setItem(TOKEN_KEY, "valid-token");

      (global.fetch as Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [mockReminder],
        })
        .mockRejectedValueOnce(new Error("Snooze failed"));

      const { result } = renderHook(() => useReminders());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await expect(result.current.snoozeReminder(1, 30)).rejects.toThrow(
        "Snooze failed"
      );
    });
  });

  describe("deleteReminder", () => {
    it("should delete reminder and refresh list", async () => {
      const mockReminder: ReminderData = {
        id: 1,
        tracking_id: 1,
        user_id: 1,
        scheduled_time: "2024-01-01T10:00:00Z",
        status: ReminderStatus.PENDING,
        value: ReminderValue.COMPLETED,
      };

      localStorage.setItem(TOKEN_KEY, "valid-token");

      (global.fetch as Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [mockReminder],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({}),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [],
        });

      const { result } = renderHook(() => useReminders());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await result.current.deleteReminder(1);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          `${API_ENDPOINTS.reminders}/1`,
          expect.objectContaining({
            method: "DELETE",
          })
        );
      });
    });

    it("should throw error when not authenticated", async () => {
      (global.fetch as Mock).mockResolvedValue({
        ok: true,
        json: async () => [],
      });

      const { result } = renderHook(() => useReminders());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await expect(result.current.deleteReminder(1)).rejects.toThrow(
        "Not authenticated"
      );
    });

    it("should handle delete error and refresh reminders", async () => {
      const mockReminder: ReminderData = {
        id: 1,
        tracking_id: 1,
        user_id: 1,
        scheduled_time: "2024-01-01T10:00:00Z",
        status: ReminderStatus.PENDING,
        value: ReminderValue.COMPLETED,
      };

      localStorage.setItem(TOKEN_KEY, "valid-token");

      (global.fetch as Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [mockReminder],
        })
        .mockRejectedValueOnce(new Error("Delete failed"))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [mockReminder],
        });

      const { result } = renderHook(() => useReminders());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Optimistically removes from state
      await expect(result.current.deleteReminder(1)).rejects.toThrow(
        "Delete failed"
      );

      // Should refresh to restore state
      await waitFor(() => {
        expect(result.current.reminders).toEqual([mockReminder]);
      });
    });
  });

  describe("refreshReminders", () => {
    it("should refresh reminders list", async () => {
      const mockReminders: ReminderData[] = [
        {
          id: 1,
          tracking_id: 1,
          user_id: 1,
          scheduled_time: "2024-01-01T10:00:00Z",
          status: ReminderStatus.PENDING,
          value: ReminderValue.COMPLETED,
        },
      ];

      localStorage.setItem(TOKEN_KEY, "valid-token");

      (global.fetch as Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockReminders,
        });

      const { result } = renderHook(() => useReminders());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await result.current.refreshReminders();

      await waitFor(() => {
        expect(result.current.reminders).toEqual(mockReminders);
      });
    });
  });

  describe("removeRemindersForTracking", () => {
    it("should remove reminders for a tracking", async () => {
      const mockReminders: ReminderData[] = [
        {
          id: 1,
          tracking_id: 1,
          user_id: 1,
          scheduled_time: "2024-01-01T10:00:00Z",
          status: ReminderStatus.PENDING,
          value: ReminderValue.COMPLETED,
        },
        {
          id: 2,
          tracking_id: 2,
          user_id: 1,
          scheduled_time: "2024-01-01T11:00:00Z",
          status: ReminderStatus.PENDING,
          value: ReminderValue.COMPLETED,
        },
      ];

      localStorage.setItem(TOKEN_KEY, "valid-token");

      (global.fetch as Mock).mockResolvedValue({
        ok: true,
        json: async () => mockReminders,
      });

      const { result } = renderHook(() => useReminders());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.reminders).toHaveLength(2);

      act(() => {
        result.current.removeRemindersForTracking(1);
      });

      expect(result.current.reminders).toHaveLength(1);
      expect(result.current.reminders[0].tracking_id).toBe(2);
    });
  });

  describe("reminder polling", () => {
    it("should not poll when no token exists", async () => {
      (global.fetch as Mock).mockResolvedValue({
        ok: true,
        json: async () => [],
      });

      const { result } = renderHook(() => useReminders());

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      vi.useFakeTimers();
      const initialCallCount = (global.fetch as Mock).mock.calls.length;

      // Advance timer significantly - should not poll without token
      await act(async () => {
        vi.advanceTimersByTime(30000);
        await vi.runAllTimersAsync();
      });

      // Should not have made additional calls
      expect((global.fetch as Mock).mock.calls.length).toBe(initialCallCount);

      vi.useRealTimers();
    });

    it("should not poll when page is hidden", async () => {
      localStorage.setItem(TOKEN_KEY, "valid-token");

      Object.defineProperty(document, "hidden", {
        writable: true,
        configurable: true,
        value: true,
      });

      (global.fetch as Mock).mockResolvedValue({
        ok: true,
        json: async () => [],
      });

      const { result } = renderHook(() => useReminders());

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      vi.useFakeTimers();
      const initialCallCount = (global.fetch as Mock).mock.calls.length;

      // Advance timer - should not poll when hidden
      await act(async () => {
        vi.advanceTimersByTime(30000);
        await vi.runAllTimersAsync();
      });

      // Should not have made additional calls
      expect((global.fetch as Mock).mock.calls.length).toBe(initialCallCount);

      vi.useRealTimers();
    });

    it("should stop polling when token is removed during polling", async () => {
      localStorage.setItem(TOKEN_KEY, "valid-token");

      (global.fetch as Mock).mockResolvedValue({
        ok: true,
        json: async () => [],
      });

      const { result } = renderHook(() => useReminders());

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      vi.useFakeTimers();
      const initialCallCount = (global.fetch as Mock).mock.calls.length;

      // Remove token
      act(() => {
        localStorage.removeItem(TOKEN_KEY);
      });

      // Advance timer - should not poll without token
      await act(async () => {
        vi.advanceTimersByTime(30000);
        await vi.runAllTimersAsync();
      });

      // Should not have made additional calls
      expect((global.fetch as Mock).mock.calls.length).toBe(initialCallCount);

      vi.useRealTimers();
    });

    it("should refresh reminders when token changes during polling", async () => {
      localStorage.setItem(TOKEN_KEY, "token1");

      (global.fetch as Mock).mockResolvedValue({
        ok: true,
        json: async () => [],
      });

      const { result } = renderHook(() => useReminders());

      // Wait for initial load with real timers first
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Now switch to fake timers for the polling test
      // This ensures the TokenManager polling interval will be controlled by fake timers
      vi.useFakeTimers();

      // Advance timer to trigger first polling check and sync TokenManager state
      // This ensures currentToken is set to "token1" before we change it
      await act(async () => {
        vi.advanceTimersByTime(500);
        // Process all microtasks to ensure the polling callback completes
        await Promise.resolve();
        await Promise.resolve();
      });

      // Capture call count after initial polling sync
      // Note: initialCallCount might be 1 (initial fetch) or 2 (if polling triggered a fetch)
      const initialCallCount = (global.fetch as Mock).mock.calls.length;

      // Change token - this should be detected by polling
      // This change will be detected by the next polling check
      act(() => {
        localStorage.setItem(TOKEN_KEY, "token2");
      });

      // Advance timer to trigger the polling interval check
      // The polling interval fires every 500ms, so advancing by 500ms should trigger it
      await act(async () => {
        // Advance to exactly when the interval should fire (500ms from last check)
        vi.advanceTimersByTime(500);
        // Process microtasks to allow the interval callback to execute
        await Promise.resolve();
        await Promise.resolve();
        // Advance a bit more to ensure any scheduled operations complete
        vi.advanceTimersByTime(10);
        // Process microtasks again to ensure the fetch promise resolves
        await Promise.resolve();
        await Promise.resolve();
      });

      // Switch to real timers for waitFor
      vi.useRealTimers();

      // Wait for fetch to complete - token change should trigger a new fetch
      await waitFor(
        () => {
          expect((global.fetch as Mock).mock.calls.length).toBeGreaterThan(
            initialCallCount
          );
        },
        { timeout: 2000 }
      );
    });

    it("should handle visibility change - stop polling when hidden", async () => {
      localStorage.setItem(TOKEN_KEY, "valid-token");

      Object.defineProperty(document, "hidden", {
        writable: true,
        configurable: true,
        value: false,
      });

      (global.fetch as Mock).mockResolvedValue({
        ok: true,
        json: async () => [],
      });

      const { result } = renderHook(() => useReminders());

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      vi.useFakeTimers();
      const initialCallCount = (global.fetch as Mock).mock.calls.length;

      // Simulate page becoming hidden
      act(() => {
        Object.defineProperty(document, "hidden", {
          writable: true,
          configurable: true,
          value: true,
        });
        const event = new Event("visibilitychange");
        document.dispatchEvent(event);
      });

      // Advance timer - should not poll when hidden
      await act(async () => {
        vi.advanceTimersByTime(30000);
        await vi.runAllTimersAsync();
      });

      // Should not have made additional calls
      expect((global.fetch as Mock).mock.calls.length).toBe(initialCallCount);

      vi.useRealTimers();
    });

    it("should handle visibility change - resume polling when visible", async () => {
      localStorage.setItem(TOKEN_KEY, "valid-token");

      Object.defineProperty(document, "hidden", {
        writable: true,
        configurable: true,
        value: true,
      });

      (global.fetch as Mock).mockResolvedValue({
        ok: true,
        json: async () => [],
      });

      const { result } = renderHook(() => useReminders());

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const initialCallCount = (global.fetch as Mock).mock.calls.length;

      // Simulate page becoming visible
      await act(async () => {
        Object.defineProperty(document, "hidden", {
          writable: true,
          configurable: true,
          value: false,
        });
        const event = new Event("visibilitychange");
        document.dispatchEvent(event);
        // Flush promises
        await Promise.resolve();
      });

      // Should immediately refresh
      await waitFor(
        () => {
          expect((global.fetch as Mock).mock.calls.length).toBeGreaterThan(
            initialCallCount
          );
        },
        { timeout: 2000 }
      );
    });

    it("should handle multiple startPolling calls correctly", async () => {
      localStorage.setItem(TOKEN_KEY, "valid-token");

      (global.fetch as Mock).mockResolvedValue({
        ok: true,
        json: async () => [],
      });

      const { result } = renderHook(() => useReminders());

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Simulate visibility change to trigger startPolling multiple times
      await act(async () => {
        Object.defineProperty(document, "hidden", {
          writable: true,
          configurable: true,
          value: false,
        });
        const event = new Event("visibilitychange");
        document.dispatchEvent(event);
        // Flush promises
        await Promise.resolve();
      });

      // Wait for refresh
      await waitFor(
        () => {
          expect((global.fetch as Mock).mock.calls.length).toBeGreaterThan(1);
        },
        { timeout: 2000 }
      );
    });
  });
});
