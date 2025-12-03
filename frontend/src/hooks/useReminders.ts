import { useState, useEffect, useCallback } from "react";
import { ReminderData, ReminderStatus } from "../models/Reminder";
import { ApiClient } from "../config/api";

/**
 * Authentication token storage key.
 * @private
 */
const TOKEN_KEY = "habitus_token";

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
    // Set token from localStorage if available
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      client.setToken(token);
    }
    return client;
  });
  // Track token to detect authentication state changes
  const [currentToken, setCurrentToken] = useState<string | null>(() =>
    localStorage.getItem(TOKEN_KEY)
  );

  /**
   * Load reminders from API.
   * @internal
   */
  const fetchReminders = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      console.warn(
        `[${new Date().toISOString()}] FRONTEND_REMINDERS | No auth token found, clearing reminders`
      );
      setReminders([]);
      setCurrentToken(null);
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
      setCurrentToken(token);
    } catch (error) {
      console.error(
        `[${new Date().toISOString()}] FRONTEND_REMINDERS | Error loading reminders:`,
        error
      );
      setReminders([]);
      setCurrentToken(null);
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
   * Watch for token changes in localStorage (login/logout).
   * Polls localStorage to detect changes in the same tab.
   * @internal
   */
  useEffect(() => {
    const checkTokenChange = () => {
      const token = localStorage.getItem(TOKEN_KEY);
      if (token !== currentToken) {
        // Token changed, reload reminders
        fetchReminders();
      }
    };

    // Check for token changes periodically (handles same-tab login/logout)
    const interval = setInterval(checkTokenChange, 500);

    // Also listen for storage events (handles cross-tab changes)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === TOKEN_KEY) {
        fetchReminders();
      }
    };
    window.addEventListener("storage", handleStorageChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [currentToken, fetchReminders]);

  /**
   * Update a reminder via API.
   * @param reminderId - The reminder ID
   * @param answer - Updated answer (optional)
   * @param notes - Updated notes (optional)
   * @param status - Updated status (optional)
   * @returns The updated reminder data
   * @throws Error if API request fails
   * @public
   */
  const updateReminder = async (
    reminderId: number,
    answer?: string,
    notes?: string,
    status?: ReminderStatus
  ): Promise<ReminderData> => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      throw new Error("Not authenticated");
    }

    // Sync token with apiClient before making the request
    apiClient.setToken(token);

    console.log(
      `[${new Date().toISOString()}] FRONTEND_REMINDERS | Updating reminder ID: ${reminderId}`
    );

    try {
      const reminderData = await apiClient.updateReminder(
        reminderId,
        answer,
        notes,
        status
      );
      console.log(
        `[${new Date().toISOString()}] FRONTEND_REMINDERS | Reminder updated successfully: ID ${
          reminderData.id
        }`
      );
      setReminders((prevReminders) =>
        prevReminders.map((r) => (r.id === reminderId ? reminderData : r))
      );
      return reminderData;
    } catch (error) {
      console.error(
        `[${new Date().toISOString()}] FRONTEND_REMINDERS | Error updating reminder:`,
        error
      );
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
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      throw new Error("Not authenticated");
    }

    // Sync token with apiClient before making the request
    apiClient.setToken(token);

    console.log(
      `[${new Date().toISOString()}] FRONTEND_REMINDERS | Snoozing reminder ID: ${reminderId} for ${minutes} minutes`
    );

    try {
      const reminderData = await apiClient.snoozeReminder(reminderId, minutes);
      console.log(
        `[${new Date().toISOString()}] FRONTEND_REMINDERS | Reminder snoozed successfully: ID ${
          reminderData.id
        }`
      );
      setReminders((prevReminders) =>
        prevReminders.map((r) => (r.id === reminderId ? reminderData : r))
      );
      return reminderData;
    } catch (error) {
      console.error(
        `[${new Date().toISOString()}] FRONTEND_REMINDERS | Error snoozing reminder:`,
        error
      );
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
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      throw new Error("Not authenticated");
    }

    // Sync token with apiClient before making the request
    apiClient.setToken(token);

    console.log(
      `[${new Date().toISOString()}] FRONTEND_REMINDERS | Deleting reminder ID: ${reminderId}`
    );

    try {
      await apiClient.deleteReminder(reminderId);
      console.log(
        `[${new Date().toISOString()}] FRONTEND_REMINDERS | Reminder deleted successfully: ID ${reminderId}`
      );
      // Refresh reminders to get the new one created by the backend
      await fetchReminders();
    } catch (error) {
      console.error(
        `[${new Date().toISOString()}] FRONTEND_REMINDERS | Error deleting reminder:`,
        error
      );
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

  return {
    reminders,
    isLoading,
    updateReminder,
    snoozeReminder,
    deleteReminder,
    refreshReminders,
  };
}
