import { useState, useEffect, useCallback } from "react";
import { flushSync } from "react-dom";
import {
  ReminderData,
  ReminderStatus,
  ReminderValue,
} from "../models/Reminder";
import { ApiClient } from "../config/api";
import { tokenManager } from "./base/TokenManager.js";

/**
 * Custom hook for managing reminders with API persistence.
 * Handles loading, updating, snoozing, and deleting reminders via REST API.
 * @returns Object containing reminders array, CRUD functions, and status
 * @public
 */
export function useReminders() {
  const [reminders, setReminders] = useState<ReminderData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [apiClient] = useState(() => {
    const client = new ApiClient();
    // Set token from tokenManager if available
    const token = tokenManager.getToken();
    if (token) {
      client.setToken(token);
    }
    return client;
  });

  /**
   * Load reminders from API.
   * @internal
   */
  const fetchReminders = useCallback(async () => {
    const token = tokenManager.getToken();
    if (!token) {
      console.warn(
        `[${new Date().toISOString()}] FRONTEND_REMINDERS | No auth token found, clearing reminders`
      );
      setReminders([]);
      return;
    }

    // Sync token with apiClient before making the request
    apiClient.setToken(token);

    setIsLoading(true);
    console.log(
      `[${new Date().toISOString()}] FRONTEND_REMINDERS | Fetching reminders from API`
    );

    try {
      const loadedReminders = await apiClient.getReminders();
      console.log(
        `[${new Date().toISOString()}] FRONTEND_REMINDERS | Loaded ${
          loadedReminders.length
        } reminders from API`
      );
      setReminders(loadedReminders);
    } catch (error) {
      console.error(
        `[${new Date().toISOString()}] FRONTEND_REMINDERS | Error loading reminders:`,
        error
      );
      setReminders([]);
    } finally {
      setIsLoading(false);
    }
  }, [apiClient]);

  /**
   * Load reminders on mount and when token changes.
   * @internal
   */
  useEffect(() => {
    fetchReminders();
  }, [fetchReminders]);

  /**
   * Watch for token changes using TokenManager.
   * @internal
   */
  useEffect(() => {
    // Poll for token changes (handles same-tab login/logout)
    const stopPolling = tokenManager.startPolling(() => {
      fetchReminders();
    });

    // Listen for storage events (handles cross-tab changes)
    const unsubscribe = tokenManager.onTokenChange(() => {
      fetchReminders();
    });

    return () => {
      stopPolling();
      unsubscribe();
    };
  }, [fetchReminders]);

  /**
   * Automatically refresh reminders periodically to detect when scheduled times are reached.
   * Polls every 30 seconds to check for reminders that have reached their scheduled time.
   * Pauses polling when the page is hidden to save resources.
   * @internal
   */
  useEffect(() => {
    if (!tokenManager.hasToken()) {
      // Don't poll if not authenticated
      return;
    }

    let pollInterval: NodeJS.Timeout | null = null;

    const pollReminders = () => {
      // Don't poll if page is hidden
      if (document.hidden) {
        return;
      }

      const token = tokenManager.getToken();
      if (!token) {
        // Token removed, stop polling
        return;
      }
      // Refresh reminders to get any that have reached their scheduled time
      fetchReminders();
    };

    const startPolling = () => {
      // Clear any existing interval
      if (pollInterval) {
        clearInterval(pollInterval);
      }
      // Poll every 30 seconds to check for reminders that have reached their scheduled time
      pollInterval = setInterval(pollReminders, 30000);
    };

    const stopPolling = () => {
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
    };

    // Start polling initially
    startPolling();

    // Handle page visibility changes
    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        // Page became visible, refresh immediately and resume polling
        pollReminders();
        startPolling();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchReminders]);

  /**
   * Update a reminder via API.
   * @param reminderId - The reminder ID
   * @param notes - Updated notes (optional)
   * @param status - Updated status (optional)
   * @returns The updated reminder data
   * @throws Error if API request fails
   * @public
   */
  const updateReminder = async (
    reminderId: number,
    notes?: string,
    status?: ReminderStatus
  ): Promise<ReminderData> => {
    const token = tokenManager.getToken();
    if (!token) {
      throw new Error("Not authenticated");
    }

    // Sync token with apiClient before making the request
    apiClient.setToken(token);

    console.log(
      `[${new Date().toISOString()}] FRONTEND_REMINDERS | Updating reminder ID: ${reminderId}`
    );

    // Optimistically update the reminder in state immediately for instant UI feedback
    // Use flushSync to ensure the state update triggers an immediate re-render
    flushSync(() => {
      setReminders((prevReminders) =>
        prevReminders.map((r) => {
          if (r.id === reminderId) {
            return {
              ...r,
              notes: notes !== undefined ? notes : r.notes,
              status: status !== undefined ? status : r.status,
            };
          }
          return r;
        })
      );
    });

    try {
      const reminderData = await apiClient.updateReminder(
        reminderId,
        notes,
        status
      );
      console.log(
        `[${new Date().toISOString()}] FRONTEND_REMINDERS | Reminder updated successfully: ID ${
          reminderData.id
        }`
      );
      // Update with server response to ensure consistency
      // Use flushSync to ensure the Next Reminder column in TrackingsList updates immediately
      flushSync(() => {
        setReminders((prevReminders) =>
          prevReminders.map((r) => (r.id === reminderId ? reminderData : r))
        );
      });
      return reminderData;
    } catch (error) {
      console.error(
        `[${new Date().toISOString()}] FRONTEND_REMINDERS | Error updating reminder:`,
        error
      );
      // On error, refresh to restore correct state
      await fetchReminders();
      throw error;
    }
  };

  /**
   * Complete a reminder via API.
   * @param reminderId - The reminder ID
   * @returns The updated reminder data
   * @throws Error if API request fails
   * @public
   */
  const completeReminder = async (
    reminderId: number
  ): Promise<ReminderData> => {
    const token = tokenManager.getToken();
    if (!token) {
      throw new Error("Not authenticated");
    }

    // Sync token with apiClient before making the request
    apiClient.setToken(token);

    console.log(
      `[${new Date().toISOString()}] FRONTEND_REMINDERS | Completing reminder ID: ${reminderId}`
    );

    // Optimistically update the reminder in state immediately for instant UI feedback
    // This ensures the badge count and Next Reminder column in TrackingsList update immediately
    // when completing a reminder (status changes to ANSWERED, removing it from next reminder calculation)
    // Use flushSync to ensure the state update triggers an immediate re-render
    flushSync(() => {
      setReminders((prevReminders) =>
        prevReminders.map((r) => {
          if (r.id === reminderId) {
            return {
              ...r,
              status: ReminderStatus.ANSWERED,
              value: ReminderValue.COMPLETED,
            };
          }
          return r;
        })
      );
    });

    try {
      const reminderData = await apiClient.completeReminder(reminderId);
      console.log(
        `[${new Date().toISOString()}] FRONTEND_REMINDERS | Reminder completed successfully: ID ${
          reminderData.id
        }`
      );
      // Update with server response to ensure consistency
      // Use flushSync to ensure the Next Reminder column in TrackingsList updates immediately
      flushSync(() => {
        setReminders((prevReminders) =>
          prevReminders.map((r) => (r.id === reminderId ? reminderData : r))
        );
      });
      return reminderData;
    } catch (error) {
      console.error(
        `[${new Date().toISOString()}] FRONTEND_REMINDERS | Error completing reminder:`,
        error
      );
      // On error, refresh to restore correct state
      await fetchReminders();
      throw error;
    }
  };

  /**
   * Dismiss a reminder via API.
   * @param reminderId - The reminder ID
   * @returns The updated reminder data
   * @throws Error if API request fails
   * @public
   */
  const dismissReminder = async (reminderId: number): Promise<ReminderData> => {
    const token = tokenManager.getToken();
    if (!token) {
      throw new Error("Not authenticated");
    }

    // Sync token with apiClient before making the request
    apiClient.setToken(token);

    console.log(
      `[${new Date().toISOString()}] FRONTEND_REMINDERS | Dismissing reminder ID: ${reminderId}`
    );

    // Optimistically update the reminder in state immediately for instant UI feedback
    // This ensures the badge count and Next Reminder column in TrackingsList update immediately
    // when dismissing a reminder (status changes to ANSWERED, removing it from next reminder calculation)
    // Use flushSync to ensure the state update triggers an immediate re-render
    flushSync(() => {
      setReminders((prevReminders) =>
        prevReminders.map((r) => {
          if (r.id === reminderId) {
            return {
              ...r,
              status: ReminderStatus.ANSWERED,
              value: ReminderValue.DISMISSED,
            };
          }
          return r;
        })
      );
    });

    try {
      const reminderData = await apiClient.dismissReminder(reminderId);
      console.log(
        `[${new Date().toISOString()}] FRONTEND_REMINDERS | Reminder dismissed successfully: ID ${
          reminderData.id
        }`
      );
      // Update with server response to ensure consistency
      // Use flushSync to ensure the Next Reminder column in TrackingsList updates immediately
      flushSync(() => {
        setReminders((prevReminders) =>
          prevReminders.map((r) => (r.id === reminderId ? reminderData : r))
        );
      });
      return reminderData;
    } catch (error) {
      console.error(
        `[${new Date().toISOString()}] FRONTEND_REMINDERS | Error dismissing reminder:`,
        error
      );
      // On error, refresh to restore correct state
      await fetchReminders();
      throw error;
    }
  };

  /**
   * Snooze a reminder via API.
   * @param reminderId - The reminder ID
   * @param minutes - Minutes to snooze
   * @returns The updated reminder data
   * @throws Error if API request fails
   * @public
   */
  const snoozeReminder = async (
    reminderId: number,
    minutes: number
  ): Promise<ReminderData> => {
    const token = tokenManager.getToken();
    if (!token) {
      throw new Error("Not authenticated");
    }

    // Sync token with apiClient before making the request
    apiClient.setToken(token);

    console.log(
      `[${new Date().toISOString()}] FRONTEND_REMINDERS | Snoozing reminder ID: ${reminderId} for ${minutes} minutes`
    );

    // Find the original reminder to get tracking_id
    const originalReminder = reminders.find((r) => r.id === reminderId);
    if (!originalReminder) {
      throw new Error("Reminder not found");
    }

    // Calculate the new scheduled time optimistically
    const now = new Date();
    const snoozedTime = new Date(now.getTime() + minutes * 60 * 1000);
    const optimisticReminder: ReminderData = {
      ...originalReminder,
      id: originalReminder.id, // Keep same ID for now, will be updated with server response
      scheduled_time: snoozedTime.toISOString(),
      status: ReminderStatus.UPCOMING,
    };

    // Optimistically update the reminder in state immediately for instant UI feedback
    // This ensures the Next Reminder column in TrackingsList updates immediately
    // Use flushSync to ensure the state update triggers an immediate re-render
    flushSync(() => {
      setReminders((prevReminders) => {
        // Remove the original reminder
        const filtered = prevReminders.filter((r) => r.id !== reminderId);
        // Add the optimistic Upcoming reminder with updated scheduled_time
        return [...filtered, optimisticReminder];
      });
    });

    try {
      const reminderData = await apiClient.snoozeReminder(reminderId, minutes);
      console.log(
        `[${new Date().toISOString()}] FRONTEND_REMINDERS | Reminder snoozed successfully: ID ${
          reminderData.id
        }`
      );
      // Update with server response to ensure consistency
      // Use flushSync to ensure the Next Reminder column in TrackingsList updates immediately
      flushSync(() => {
        setReminders((prevReminders) => {
          // Remove the optimistic reminder and any existing reminder with the server's ID
          const filtered = prevReminders.filter(
            (r) => r.id !== reminderId && r.id !== reminderData.id
          );
          // Add the actual Upcoming reminder from server with correct ID
          return [...filtered, reminderData];
        });
      });
      return reminderData;
    } catch (error) {
      console.error(
        `[${new Date().toISOString()}] FRONTEND_REMINDERS | Error snoozing reminder:`,
        error
      );
      // On error, refresh to restore correct state
      await fetchReminders();
      throw error;
    }
  };

  /**
   * Delete a reminder via API.
   * @param reminderId - The reminder ID to delete
   * @returns Promise resolving when reminder is deleted
   * @throws Error if API request fails
   * @public
   */
  const deleteReminder = async (reminderId: number): Promise<void> => {
    const token = tokenManager.getToken();
    if (!token) {
      throw new Error("Not authenticated");
    }

    // Sync token with apiClient before making the request
    apiClient.setToken(token);

    console.log(
      `[${new Date().toISOString()}] FRONTEND_REMINDERS | Deleting reminder ID: ${reminderId}`
    );

    // Optimistically remove the reminder from state immediately for instant UI feedback
    // Use flushSync to ensure the Next Reminder column in TrackingsList updates immediately
    flushSync(() => {
      setReminders((prevReminders) =>
        prevReminders.filter((r) => r.id !== reminderId)
      );
    });

    try {
      await apiClient.deleteReminder(reminderId);
      console.log(
        `[${new Date().toISOString()}] FRONTEND_REMINDERS | Reminder deleted successfully: ID ${reminderId}`
      );
      // Don't refresh immediately - the optimistic update already provides instant feedback
      // The polling mechanism will refresh reminders soon enough to get any new reminder created by the backend
    } catch (error) {
      console.error(
        `[${new Date().toISOString()}] FRONTEND_REMINDERS | Error deleting reminder:`,
        error
      );
      // On error, refresh to restore correct state
      await fetchReminders();
      throw error;
    }
  };

  /**
   * Refresh reminders from API.
   * @public
   */
  const refreshReminders = useCallback(async () => {
    await fetchReminders();
  }, [fetchReminders]);

  /**
   * Optimistically remove reminders for a deleted tracking.
   * This provides immediate UI feedback while the backend cleans up orphaned reminders.
   * @param trackingId - The tracking ID whose reminders should be removed
   * @public
   */
  const removeRemindersForTracking = useCallback((trackingId: number) => {
    setReminders((prevReminders) =>
      prevReminders.filter((r) => r.tracking_id !== trackingId)
    );
  }, []);

  /**
   * Optimistically remove reminders for a tracking that match specific statuses.
   * This provides immediate UI feedback when tracking state changes affect reminders.
   * @param trackingId - The tracking ID whose reminders should be filtered
   * @param statusesToRemove - Array of reminder statuses to remove
   * @public
   */
  const removeRemindersForTrackingByStatus = useCallback(
    (trackingId: number, statusesToRemove: ReminderStatus[]) => {
      const statusSet = new Set(statusesToRemove);
      setReminders((prevReminders) =>
        prevReminders.filter(
          (r) => !(r.tracking_id === trackingId && statusSet.has(r.status))
        )
      );
    },
    []
  );

  return {
    reminders,
    isLoading,
    updateReminder,
    completeReminder,
    dismissReminder,
    snoozeReminder,
    deleteReminder,
    refreshReminders,
    removeRemindersForTracking,
    removeRemindersForTrackingByStatus,
  };
}
