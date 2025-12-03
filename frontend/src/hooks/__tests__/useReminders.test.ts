// @vitest-environment jsdom
import { vi, type Mock } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useReminders } from "../useReminders";
import { ReminderData, ReminderStatus } from "../../models/Reminder";
import { API_ENDPOINTS } from "../../config/api";

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
  });

  describe("updateReminder", () => {
    it("should update reminder successfully", async () => {
      const mockReminder: ReminderData = {
        id: 1,
        tracking_id: 1,
        user_id: 1,
        scheduled_time: "2024-01-01T10:00:00Z",
        status: ReminderStatus.PENDING,
      };

      const updatedReminder: ReminderData = {
        ...mockReminder,
        answer: "Yes",
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

      await act(async () => {
        await result.current.updateReminder(
          1,
          "Yes",
          "Some notes",
          ReminderStatus.ANSWERED
        );
      });

      await waitFor(() => {
        expect(result.current.reminders[0].answer).toBe("Yes");
        expect(result.current.reminders[0].status).toBe(
          ReminderStatus.ANSWERED
        );
      });
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
      };

      const snoozedReminder: ReminderData = {
        ...mockReminder,
        status: ReminderStatus.SNOOZED,
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
          json: async () => snoozedReminder,
        });

      const { result } = renderHook(() => useReminders());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.snoozeReminder(1, 30);
      });

      await waitFor(() => {
        expect(result.current.reminders[0].status).toBe(ReminderStatus.SNOOZED);
      });
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

      await act(async () => {
        await result.current.deleteReminder(1);
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          `${API_ENDPOINTS.reminders}/1`,
          expect.objectContaining({
            method: "DELETE",
          })
        );
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

      await act(async () => {
        await result.current.refreshReminders();
      });

      await waitFor(() => {
        expect(result.current.reminders).toEqual(mockReminders);
      });
    });
  });
});
