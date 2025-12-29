// @vitest-environment jsdom
import { vi, type Mock } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCoordinatedEntities } from "../useCoordinatedEntities";
import { useTrackings } from "../useTrackings";
import { useReminders } from "../useReminders";
import {
  TrackingState,
  Frequency,
  type TrackingData,
} from "../../models/Tracking";
import {
  ReminderStatus,
  ReminderValue,
  type ReminderData,
} from "../../models/Reminder";

// Mock the hooks
vi.mock("../useTrackings");
vi.mock("../useReminders");

const mockUseTrackings = vi.mocked(useTrackings);
const mockUseReminders = vi.mocked(useReminders);

describe("useCoordinatedEntities", () => {
  let mockTrackingsHook: ReturnType<typeof useTrackings>;
  let mockRemindersHook: ReturnType<typeof useReminders>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mock implementations
    mockTrackingsHook = {
      trackings: [],
      isLoading: false,
      createTracking: vi.fn(),
      updateTracking: vi.fn(),
      updateTrackingState: vi.fn(),
      deleteTracking: vi.fn(),
      refreshTrackings: vi.fn(),
    };

    mockRemindersHook = {
      reminders: [],
      isLoading: false,
      updateReminder: vi.fn(),
      completeReminder: vi.fn(),
      dismissReminder: vi.fn(),
      snoozeReminder: vi.fn(),
      deleteReminder: vi.fn(),
      refreshReminders: vi.fn(),
      removeRemindersForTracking: vi.fn(),
      removeRemindersForTrackingByStatus: vi.fn(),
    };

    mockUseTrackings.mockReturnValue(mockTrackingsHook);
    mockUseReminders.mockReturnValue(mockRemindersHook);
  });

  describe("initialization", () => {
    it("should return properties from both hooks", () => {
      const mockTrackings: TrackingData[] = [
        {
          id: 1,
          user_id: 1,
          question: "Test tracking",
          state: TrackingState.RUNNING,
          frequency: { type: "daily" },
          schedules: [{ id: 1, tracking_id: 1, hour: 9, minutes: 0 }],
        },
      ];

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

      mockTrackingsHook.trackings = mockTrackings;
      mockRemindersHook.reminders = mockReminders;
      mockRemindersHook.isLoading = true;

      const { result } = renderHook(() => useCoordinatedEntities());

      expect(result.current.trackings).toEqual(mockTrackings);
      expect(result.current.reminders).toEqual(mockReminders);
      expect(result.current.isLoading).toBe(true); // Should be reminders loading
      expect(result.current.trackingsLoading).toBe(false);
      expect(result.current.remindersLoading).toBe(true);
    });

    it("should expose all methods from both hooks", () => {
      const { result } = renderHook(() => useCoordinatedEntities());

      // Methods from useTrackings
      expect(result.current.deleteTracking).toBe(
        mockTrackingsHook.deleteTracking
      );
      expect(result.current.refreshTrackings).toBe(
        mockTrackingsHook.refreshTrackings
      );

      // Methods from useReminders
      expect(result.current.updateReminder).toBe(
        mockRemindersHook.updateReminder
      );
      expect(result.current.snoozeReminder).toBe(
        mockRemindersHook.snoozeReminder
      );
      expect(result.current.deleteReminder).toBe(
        mockRemindersHook.deleteReminder
      );
      expect(result.current.refreshReminders).toBe(
        mockRemindersHook.refreshReminders
      );
      expect(result.current.removeRemindersForTracking).toBe(
        mockRemindersHook.removeRemindersForTracking
      );
      expect(result.current.removeRemindersForTrackingByStatus).toBe(
        mockRemindersHook.removeRemindersForTrackingByStatus
      );

      // Coordinated methods should be different functions
      expect(result.current.createTracking).not.toBe(
        mockTrackingsHook.createTracking
      );
      expect(result.current.updateTracking).not.toBe(
        mockTrackingsHook.updateTracking
      );
      expect(result.current.updateTrackingState).not.toBe(
        mockTrackingsHook.updateTrackingState
      );
      expect(result.current.completeReminder).not.toBe(
        mockRemindersHook.completeReminder
      );
      expect(result.current.dismissReminder).not.toBe(
        mockRemindersHook.dismissReminder
      );
    });
  });

  describe("createTracking", () => {
    it("should create tracking and refresh reminders on success", async () => {
      const mockTracking: TrackingData = {
        id: 1,
        user_id: 1,
        question: "New tracking",
        state: TrackingState.RUNNING,
        frequency: { type: "daily" },
        schedules: [{ id: 1, tracking_id: 1, hour: 9, minutes: 0 }],
      };

      const frequency: Frequency = { type: "daily" };
      const schedules = [{ id: 1, tracking_id: 1, hour: 9, minutes: 0 }];

      mockTrackingsHook.createTracking = vi
        .fn()
        .mockResolvedValue(mockTracking);
      mockRemindersHook.refreshReminders = vi.fn().mockResolvedValue(undefined);

      const { result } = renderHook(() => useCoordinatedEntities());

      await act(async () => {
        const created = await result.current.createTracking(
          "New tracking",
          undefined,
          undefined,
          schedules,
          frequency
        );
        expect(created).toEqual(mockTracking);
      });

      expect(mockTrackingsHook.createTracking).toHaveBeenCalledWith(
        "New tracking",
        undefined,
        undefined,
        schedules,
        frequency
      );
      expect(mockRemindersHook.refreshReminders).toHaveBeenCalled();
    });

    it("should refresh reminders on error", async () => {
      const error = new Error("Failed to create tracking");
      const frequency: Frequency = { type: "daily" };
      const schedules = [{ id: 1, tracking_id: 1, hour: 9, minutes: 0 }];

      mockTrackingsHook.createTracking = vi.fn().mockRejectedValue(error);
      mockRemindersHook.refreshReminders = vi.fn().mockResolvedValue(undefined);

      const { result } = renderHook(() => useCoordinatedEntities());

      await act(async () => {
        await expect(
          result.current.createTracking(
            "New tracking",
            undefined,
            undefined,
            schedules,
            frequency
          )
        ).rejects.toThrow("Failed to create tracking");
      });

      expect(mockTrackingsHook.createTracking).toHaveBeenCalled();
      expect(mockRemindersHook.refreshReminders).toHaveBeenCalled();
    });
  });

  describe("updateTracking", () => {
    it("should update tracking and refresh reminders on success", async () => {
      const mockTracking: TrackingData = {
        id: 1,
        user_id: 1,
        question: "Updated tracking",
        state: TrackingState.RUNNING,
        frequency: { type: "weekly", days: [1] },
        schedules: [{ id: 1, tracking_id: 1, hour: 10, minutes: 30 }],
      };

      const frequency: Frequency = { type: "weekly", days: [1] };

      mockTrackingsHook.updateTracking = vi
        .fn()
        .mockResolvedValue(mockTracking);
      mockRemindersHook.refreshReminders = vi.fn().mockResolvedValue(undefined);

      const { result } = renderHook(() => useCoordinatedEntities());

      await act(async () => {
        const updated = await result.current.updateTracking(
          1,
          frequency,
          "Updated tracking"
        );
        expect(updated).toEqual(mockTracking);
      });

      expect(mockTrackingsHook.updateTracking).toHaveBeenCalledWith(
        1,
        frequency,
        "Updated tracking",
        undefined,
        undefined,
        undefined
      );
      expect(mockRemindersHook.refreshReminders).toHaveBeenCalled();
    });

    it("should refresh reminders on error", async () => {
      const error = new Error("Failed to update tracking");
      const frequency: Frequency = { type: "daily" };

      mockTrackingsHook.updateTracking = vi.fn().mockRejectedValue(error);
      mockRemindersHook.refreshReminders = vi.fn().mockResolvedValue(undefined);

      const { result } = renderHook(() => useCoordinatedEntities());

      await act(async () => {
        await expect(
          result.current.updateTracking(1, frequency, "Updated tracking")
        ).rejects.toThrow("Failed to update tracking");
      });

      expect(mockTrackingsHook.updateTracking).toHaveBeenCalled();
      expect(mockRemindersHook.refreshReminders).toHaveBeenCalled();
    });
  });

  describe("updateTrackingState", () => {
    it("should optimistically remove upcoming reminders when pausing tracking", async () => {
      const mockTracking: TrackingData = {
        id: 1,
        user_id: 1,
        question: "Test tracking",
        state: TrackingState.PAUSED,
        frequency: { type: "daily" },
        schedules: [{ id: 1, tracking_id: 1, hour: 9, minutes: 0 }],
      };

      mockTrackingsHook.updateTrackingState = vi
        .fn()
        .mockResolvedValue(mockTracking);
      mockRemindersHook.refreshReminders = vi.fn().mockResolvedValue(undefined);
      mockRemindersHook.removeRemindersForTrackingByStatus = vi.fn();

      const { result } = renderHook(() => useCoordinatedEntities());

      await act(async () => {
        await result.current.updateTrackingState(1, TrackingState.PAUSED);
      });

      expect(
        mockRemindersHook.removeRemindersForTrackingByStatus
      ).toHaveBeenCalledWith(1, [ReminderStatus.UPCOMING]);
      expect(mockTrackingsHook.updateTrackingState).toHaveBeenCalledWith(
        1,
        TrackingState.PAUSED
      );
      expect(mockRemindersHook.refreshReminders).toHaveBeenCalled();
    });

    it("should optimistically remove pending and upcoming reminders when archiving tracking", async () => {
      const mockTracking: TrackingData = {
        id: 1,
        user_id: 1,
        question: "Test tracking",
        state: TrackingState.ARCHIVED,
        frequency: { type: "daily" },
        schedules: [{ id: 1, tracking_id: 1, hour: 9, minutes: 0 }],
      };

      mockTrackingsHook.updateTrackingState = vi
        .fn()
        .mockResolvedValue(mockTracking);
      mockRemindersHook.refreshReminders = vi.fn().mockResolvedValue(undefined);
      mockRemindersHook.removeRemindersForTrackingByStatus = vi.fn();

      const { result } = renderHook(() => useCoordinatedEntities());

      await act(async () => {
        await result.current.updateTrackingState(1, TrackingState.ARCHIVED);
      });

      expect(
        mockRemindersHook.removeRemindersForTrackingByStatus
      ).toHaveBeenCalledWith(1, [
        ReminderStatus.PENDING,
        ReminderStatus.UPCOMING,
      ]);
      expect(mockTrackingsHook.updateTrackingState).toHaveBeenCalledWith(
        1,
        TrackingState.ARCHIVED
      );
      expect(mockRemindersHook.refreshReminders).toHaveBeenCalled();
    });

    it("should not optimistically update reminders when resuming to running state", async () => {
      const mockTracking: TrackingData = {
        id: 1,
        user_id: 1,
        question: "Test tracking",
        state: TrackingState.RUNNING,
        frequency: { type: "daily" },
        schedules: [{ id: 1, tracking_id: 1, hour: 9, minutes: 0 }],
      };

      mockTrackingsHook.updateTrackingState = vi
        .fn()
        .mockResolvedValue(mockTracking);
      mockRemindersHook.refreshReminders = vi.fn().mockResolvedValue(undefined);
      mockRemindersHook.removeRemindersForTrackingByStatus = vi.fn();

      const { result } = renderHook(() => useCoordinatedEntities());

      await act(async () => {
        await result.current.updateTrackingState(1, TrackingState.RUNNING);
      });

      expect(
        mockRemindersHook.removeRemindersForTrackingByStatus
      ).not.toHaveBeenCalled();
      expect(mockTrackingsHook.updateTrackingState).toHaveBeenCalledWith(
        1,
        TrackingState.RUNNING
      );
      expect(mockRemindersHook.refreshReminders).toHaveBeenCalled();
    });

    it("should refresh reminders on error", async () => {
      const error = new Error("Failed to update tracking state");

      mockTrackingsHook.updateTrackingState = vi.fn().mockRejectedValue(error);
      mockRemindersHook.refreshReminders = vi.fn().mockResolvedValue(undefined);
      mockRemindersHook.removeRemindersForTrackingByStatus = vi.fn();

      const { result } = renderHook(() => useCoordinatedEntities());

      await act(async () => {
        await expect(
          result.current.updateTrackingState(1, TrackingState.PAUSED)
        ).rejects.toThrow("Failed to update tracking state");
      });

      expect(
        mockRemindersHook.removeRemindersForTrackingByStatus
      ).toHaveBeenCalled();
      expect(mockTrackingsHook.updateTrackingState).toHaveBeenCalled();
      expect(mockRemindersHook.refreshReminders).toHaveBeenCalled();
    });
  });

  describe("completeReminder", () => {
    it("should complete reminder and refresh reminders", async () => {
      const mockReminder: ReminderData = {
        id: 1,
        tracking_id: 1,
        user_id: 1,
        scheduled_time: "2024-01-01T10:00:00Z",
        status: ReminderStatus.ANSWERED,
        value: ReminderValue.COMPLETED,
      };

      mockRemindersHook.completeReminder = vi
        .fn()
        .mockResolvedValue(mockReminder);
      mockRemindersHook.refreshReminders = vi.fn().mockResolvedValue(undefined);

      const { result } = renderHook(() => useCoordinatedEntities());

      await act(async () => {
        const completed = await result.current.completeReminder(1);
        expect(completed).toEqual(mockReminder);
      });

      expect(mockRemindersHook.completeReminder).toHaveBeenCalledWith(1);
      expect(mockRemindersHook.refreshReminders).toHaveBeenCalled();
    });

    it("should refresh reminders even if completeReminder succeeds", async () => {
      const mockReminder: ReminderData = {
        id: 1,
        tracking_id: 1,
        user_id: 1,
        scheduled_time: "2024-01-01T10:00:00Z",
        status: ReminderStatus.ANSWERED,
        value: ReminderValue.COMPLETED,
      };

      mockRemindersHook.completeReminder = vi
        .fn()
        .mockResolvedValue(mockReminder);
      mockRemindersHook.refreshReminders = vi.fn().mockResolvedValue(undefined);

      const { result } = renderHook(() => useCoordinatedEntities());

      await act(async () => {
        await result.current.completeReminder(1);
      });

      // Verify refresh is called after complete
      const calls = (mockRemindersHook.refreshReminders as Mock).mock.calls;
      expect(calls.length).toBeGreaterThan(0);
    });
  });

  describe("dismissReminder", () => {
    it("should dismiss reminder and refresh reminders", async () => {
      const mockReminder: ReminderData = {
        id: 1,
        tracking_id: 1,
        user_id: 1,
        scheduled_time: "2024-01-01T10:00:00Z",
        status: ReminderStatus.ANSWERED,
        value: ReminderValue.DISMISSED,
      };

      mockRemindersHook.dismissReminder = vi
        .fn()
        .mockResolvedValue(mockReminder);
      mockRemindersHook.refreshReminders = vi.fn().mockResolvedValue(undefined);

      const { result } = renderHook(() => useCoordinatedEntities());

      await act(async () => {
        const dismissed = await result.current.dismissReminder(1);
        expect(dismissed).toEqual(mockReminder);
      });

      expect(mockRemindersHook.dismissReminder).toHaveBeenCalledWith(1);
      expect(mockRemindersHook.refreshReminders).toHaveBeenCalled();
    });

    it("should refresh reminders even if dismissReminder succeeds", async () => {
      const mockReminder: ReminderData = {
        id: 1,
        tracking_id: 1,
        user_id: 1,
        scheduled_time: "2024-01-01T10:00:00Z",
        status: ReminderStatus.ANSWERED,
        value: ReminderValue.DISMISSED,
      };

      mockRemindersHook.dismissReminder = vi
        .fn()
        .mockResolvedValue(mockReminder);
      mockRemindersHook.refreshReminders = vi.fn().mockResolvedValue(undefined);

      const { result } = renderHook(() => useCoordinatedEntities());

      await act(async () => {
        await result.current.dismissReminder(1);
      });

      // Verify refresh is called after dismiss
      const calls = (mockRemindersHook.refreshReminders as Mock).mock.calls;
      expect(calls.length).toBeGreaterThan(0);
    });
  });

  describe("loading states", () => {
    it("should expose separate loading states for trackings and reminders", () => {
      mockTrackingsHook.isLoading = true;
      mockRemindersHook.isLoading = false;

      const { result } = renderHook(() => useCoordinatedEntities());

      expect(result.current.trackingsLoading).toBe(true);
      expect(result.current.remindersLoading).toBe(false);
      expect(result.current.isLoading).toBe(false); // Should be reminders loading
    });

    it("should set isLoading to reminders loading state", () => {
      mockTrackingsHook.isLoading = false;
      mockRemindersHook.isLoading = true;

      const { result } = renderHook(() => useCoordinatedEntities());

      expect(result.current.isLoading).toBe(true);
      expect(result.current.remindersLoading).toBe(true);
    });
  });
});
