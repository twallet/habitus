import { useCallback } from "react";
import { flushSync } from "react-dom";
import { useTrackings } from "./useTrackings";
import { useReminders } from "./useReminders";
import { TrackingState, Frequency, TrackingData } from "../models/Tracking";
import { ReminderStatus } from "../models/Reminder";

/**
 * Coordinated entities hook that wraps useTrackings and useReminders.
 * Provides cross-entity optimistic updates to keep reminders and trackings in sync.
 *
 * Coordination behavior:
 * - When a tracking changes state, reminders are optimistically updated:
 *   - Paused: Upcoming reminders are removed (Pending and Answered remain)
 *   - Archived: Pending and Upcoming reminders are removed (Answered remain)
 *   - Running: Reminders are refreshed to get newly created ones
 *
 * - When a tracking is created or updated, reminders are refreshed to get newly created ones.
 *
 * - When a reminder is completed/dismissed, reminders are refreshed to get the newly created next reminder.
 *
 * @returns Combined object with trackings, reminders, and coordinated operations
 * @public
 */
export function useCoordinatedEntities() {
  const trackingsHook = useTrackings();
  const remindersHook = useReminders();

  /**
   * Create a tracking and refresh reminders to get newly created ones.
   * @param question - The tracking question
   * @param details - Optional details (rich text)
   * @param icon - Optional icon (emoji)
   * @param schedules - Required schedules array (1-5 schedules)
   * @param frequency - Required frequency for reminder schedule
   * @returns Promise resolving to created tracking data
   * @public
   */
  const createTracking = useCallback(
    async (
      question: string,
      details: string | undefined,
      icon: string | undefined,
      schedules: Array<{ hour: number; minutes: number }>,
      frequency: Frequency
    ): Promise<TrackingData> => {
      try {
        const result = await trackingsHook.createTracking(
          question,
          details,
          icon,
          schedules,
          frequency
        );

        // Refresh reminders to get newly created ones for this tracking
        // The backend creates reminders when a tracking is created
        await remindersHook.refreshReminders();

        return result;
      } catch (error) {
        // On error, refresh reminders to ensure consistency
        await remindersHook.refreshReminders();
        throw error;
      }
    },
    [trackingsHook, remindersHook]
  );

  /**
   * Update a tracking and refresh reminders to get updated ones.
   * @param trackingId - The tracking ID
   * @param frequency - Required frequency for reminder schedule
   * @param question - Updated question (optional)
   * @param notes - Updated details (optional)
   * @param icon - Updated icon (optional)
   * @param schedules - Updated schedules array (optional, 1-5 schedules if provided)
   * @returns Promise resolving to updated tracking data
   * @public
   */
  const updateTracking = useCallback(
    async (
      trackingId: number,
      frequency: Frequency,
      question?: string,
      details?: string,
      icon?: string,
      schedules?: Array<{ hour: number; minutes: number }>
    ): Promise<TrackingData> => {
      try {
        const result = await trackingsHook.updateTracking(
          trackingId,
          frequency,
          question,
          details,
          icon,
          schedules
        );

        // Refresh reminders to get updated ones (schedules/frequency changes may affect reminders)
        // The backend updates reminders when tracking schedules or frequency change
        await remindersHook.refreshReminders();

        return result;
      } catch (error) {
        // On error, refresh reminders to ensure consistency
        await remindersHook.refreshReminders();
        throw error;
      }
    },
    [trackingsHook, remindersHook]
  );

  /**
   * Update tracking state with optimistic reminder updates.
   * @param trackingId - The tracking ID
   * @param state - The new state
   * @returns Promise resolving to updated tracking data
   * @public
   */
  const updateTrackingState = useCallback(
    async (
      trackingId: number,
      state: TrackingState
    ): Promise<
      Awaited<ReturnType<typeof trackingsHook.updateTrackingState>>
    > => {
      // Optimistically update reminders based on state change before API call
      // This provides immediate UI feedback
      if (state === TrackingState.PAUSED) {
        // Remove only Upcoming reminders (keep Pending and Answered)
        flushSync(() => {
          remindersHook.removeRemindersForTrackingByStatus(trackingId, [
            ReminderStatus.UPCOMING,
          ]);
        });
      } else if (state === TrackingState.ARCHIVED) {
        // Remove Pending and Upcoming reminders (keep Answered)
        flushSync(() => {
          remindersHook.removeRemindersForTrackingByStatus(trackingId, [
            ReminderStatus.PENDING,
            ReminderStatus.UPCOMING,
          ]);
        });
      }

      try {
        // Call the underlying hook's method
        const result = await trackingsHook.updateTrackingState(
          trackingId,
          state
        );

        // Refresh reminders to get accurate state from server
        // The backend will have already removed/updated reminders, so this ensures consistency
        // Also handles the case when resuming from Paused to Running (new reminders may be created)
        await remindersHook.refreshReminders();

        return result;
      } catch (error) {
        // On error, refresh reminders to restore correct state
        await remindersHook.refreshReminders();
        throw error;
      }
    },
    [trackingsHook, remindersHook]
  );

  /**
   * Complete a reminder and refresh to get the newly created next reminder.
   * This ensures the "Next Reminder" column in TrackingsList updates immediately.
   * @param reminderId - The reminder ID
   * @returns Promise resolving to updated reminder data
   * @public
   */
  const completeReminder = useCallback(
    async (
      reminderId: number
    ): Promise<Awaited<ReturnType<typeof remindersHook.completeReminder>>> => {
      const result = await remindersHook.completeReminder(reminderId);
      // Refresh reminders to get the newly created upcoming reminder from the backend
      // This ensures the "Next Reminder" column in TrackingsList updates immediately
      await remindersHook.refreshReminders();
      return result;
    },
    [remindersHook]
  );

  /**
   * Dismiss a reminder and refresh to get the newly created next reminder.
   * This ensures the "Next Reminder" column in TrackingsList updates immediately.
   * @param reminderId - The reminder ID
   * @returns Promise resolving to updated reminder data
   * @public
   */
  const dismissReminder = useCallback(
    async (
      reminderId: number
    ): Promise<Awaited<ReturnType<typeof remindersHook.dismissReminder>>> => {
      const result = await remindersHook.dismissReminder(reminderId);
      // Refresh reminders to get the newly created upcoming reminder from the backend
      // This ensures the "Next Reminder" column in TrackingsList updates immediately
      await remindersHook.refreshReminders();
      return result;
    },
    [remindersHook]
  );

  // Return all properties from both hooks, overriding specific methods with coordinated versions
  // Note: isLoading from remindersHook will overwrite trackingsHook's isLoading when spreading
  // We expose both loading states separately for clarity
  return {
    ...trackingsHook,
    ...remindersHook, // This will set isLoading to remindersHook.isLoading
    createTracking,
    updateTracking,
    updateTrackingState,
    completeReminder,
    dismissReminder,
    // Expose trackings loading state separately to avoid conflict
    trackingsLoading: trackingsHook.isLoading,
    remindersLoading: remindersHook.isLoading,
    // Keep isLoading for backward compatibility (points to reminders loading)
    isLoading: remindersHook.isLoading,
  };
}
