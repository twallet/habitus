import { useState, useEffect, useCallback } from "react";
import {
  TrackingData,
  TrackingType,
  TrackingState,
  DaysPattern,
} from "../models/Tracking";
import { ApiClient } from "../config/api";

/**
 * Authentication token storage key.
 * @private
 */
const TOKEN_KEY = "habitus_token";

/**
 * Custom hook for managing trackings with API persistence.
 * Handles loading, creating, updating, and deleting trackings via REST API.
 * @returns Object containing trackings array, CRUD functions, and status
 * @public
 */
export function useTrackings() {
  const [trackings, setTrackings] = useState<TrackingData[]>([]);
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
   * Load trackings from API.
   * @internal
   */
  const loadTrackings = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      console.warn(
        `[${new Date().toISOString()}] FRONTEND_TRACKINGS | No auth token found, clearing trackings`
      );
      setTrackings([]);
      setCurrentToken(null);
      return;
    }

    // Sync token with apiClient before making the request
    apiClient.setToken(token);

    setIsLoading(true);
    console.log(
      `[${new Date().toISOString()}] FRONTEND_TRACKINGS | Fetching trackings from API`
    );

    try {
      const loadedTrackings = await apiClient.getTrackings();
      console.log(
        `[${new Date().toISOString()}] FRONTEND_TRACKINGS | Loaded ${
          loadedTrackings.length
        } trackings from API`
      );
      setTrackings(loadedTrackings);
      setCurrentToken(token);
    } catch (error) {
      console.error(
        `[${new Date().toISOString()}] FRONTEND_TRACKINGS | Error loading trackings:`,
        error
      );
      setTrackings([]);
      setCurrentToken(null);
    } finally {
      setIsLoading(false);
    }
  }, [apiClient]);

  /**
   * Load trackings on mount and when token changes.
   * @internal
   */
  useEffect(() => {
    loadTrackings();
  }, [loadTrackings]);

  /**
   * Watch for token changes in localStorage (login/logout).
   * Polls localStorage to detect changes in the same tab.
   * @internal
   */
  useEffect(() => {
    const checkTokenChange = () => {
      const token = localStorage.getItem(TOKEN_KEY);
      if (token !== currentToken) {
        // Token changed, reload trackings
        loadTrackings();
      }
    };

    // Check for token changes periodically (handles same-tab login/logout)
    const interval = setInterval(checkTokenChange, 500);

    // Also listen for storage events (handles cross-tab changes)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === TOKEN_KEY) {
        loadTrackings();
      }
    };
    window.addEventListener("storage", handleStorageChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [currentToken, loadTrackings]);

  /**
   * Create a new tracking via API.
   * @param question - The tracking question
   * @param type - The tracking type (true_false or register)
   * @param notes - Optional notes (rich text)
   * @param icon - Optional icon (emoji)
   * @param schedules - Required schedules array (1-5 schedules)
   * @param days - Required days pattern for reminder frequency
   * @returns The created tracking data
   * @throws Error if API request fails
   * @public
   */
  const createTracking = async (
    question: string,
    type: TrackingType,
    notes: string | undefined,
    icon: string | undefined,
    schedules: Array<{ hour: number; minutes: number }>,
    days: DaysPattern
  ): Promise<TrackingData> => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      throw new Error("Not authenticated");
    }

    // Sync token with apiClient before making the request
    apiClient.setToken(token);

    console.log(
      `[${new Date().toISOString()}] FRONTEND_TRACKINGS | Creating new tracking with question: ${question}, type: ${type}`
    );

    try {
      const trackingData = await apiClient.createTracking(
        question,
        type,
        notes,
        icon,
        schedules,
        days
      );
      console.log(
        `[${new Date().toISOString()}] FRONTEND_TRACKINGS | Tracking created successfully: ID ${
          trackingData.id
        }`
      );
      setTrackings((prevTrackings) => [trackingData, ...prevTrackings]);
      return trackingData;
    } catch (error) {
      console.error(
        `[${new Date().toISOString()}] FRONTEND_TRACKINGS | Error creating tracking:`,
        error
      );
      throw error;
    }
  };

  /**
   * Update a tracking via API.
   * @param trackingId - The tracking ID
   * @param question - Updated question (optional)
   * @param type - Updated type (optional)
   * @param notes - Updated notes (optional)
   * @param icon - Updated icon (optional)
   * @param schedules - Updated schedules array (optional, 1-5 schedules if provided)
   * @param days - Updated days pattern (optional)
   * @returns The updated tracking data
   * @throws Error if API request fails
   * @public
   */
  const updateTracking = async (
    trackingId: number,
    days: DaysPattern,
    question?: string,
    type?: TrackingType,
    notes?: string,
    icon?: string,
    schedules?: Array<{ hour: number; minutes: number }>
  ): Promise<TrackingData> => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      throw new Error("Not authenticated");
    }

    // Sync token with apiClient before making the request
    apiClient.setToken(token);

    console.log(
      `[${new Date().toISOString()}] FRONTEND_TRACKINGS | Updating tracking ID: ${trackingId}`
    );

    try {
      const trackingData = await apiClient.updateTracking(
        trackingId,
        days,
        question,
        type,
        notes,
        icon,
        schedules
      );
      console.log(
        `[${new Date().toISOString()}] FRONTEND_TRACKINGS | Tracking updated successfully: ID ${
          trackingData.id
        }`
      );
      setTrackings((prevTrackings) =>
        prevTrackings.map((t) => (t.id === trackingId ? trackingData : t))
      );
      return trackingData;
    } catch (error) {
      console.error(
        `[${new Date().toISOString()}] FRONTEND_TRACKINGS | Error updating tracking:`,
        error
      );
      throw error;
    }
  };

  /**
   * Update tracking state via API.
   * @param trackingId - The tracking ID
   * @param state - The new state (Running, Paused, Archived, Deleted)
   * @returns Promise resolving to updated tracking data
   * @throws Error if API request fails
   * @public
   */
  const updateTrackingState = async (
    trackingId: number,
    state: TrackingState
  ): Promise<TrackingData> => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      throw new Error("Not authenticated");
    }

    // Sync token with apiClient before making the request
    apiClient.setToken(token);

    console.log(
      `[${new Date().toISOString()}] FRONTEND_TRACKINGS | Updating tracking state ID: ${trackingId} to state: ${state}`
    );

    try {
      const trackingData = await apiClient.updateTrackingState(
        trackingId,
        state
      );
      console.log(
        `[${new Date().toISOString()}] FRONTEND_TRACKINGS | Tracking state updated successfully: ID ${trackingId} to state ${state}`
      );
      // Update local state with the new tracking data
      setTrackings((prevTrackings) =>
        prevTrackings.map((t) => (t.id === trackingId ? trackingData : t))
      );
      return trackingData;
    } catch (error) {
      console.error(
        `[${new Date().toISOString()}] FRONTEND_TRACKINGS | Error updating tracking state:`,
        error
      );
      throw error;
    }
  };

  /**
   * Delete a tracking via API.
   * @param trackingId - The tracking ID to delete
   * @returns Promise resolving when tracking is deleted
   * @throws Error if API request fails
   * @public
   */
  const deleteTracking = async (trackingId: number): Promise<void> => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      throw new Error("Not authenticated");
    }

    // Sync token with apiClient before making the request
    apiClient.setToken(token);

    console.log(
      `[${new Date().toISOString()}] FRONTEND_TRACKINGS | Deleting tracking ID: ${trackingId}`
    );

    try {
      await apiClient.deleteTracking(trackingId);
      console.log(
        `[${new Date().toISOString()}] FRONTEND_TRACKINGS | Tracking deleted successfully: ID ${trackingId}`
      );
      setTrackings((prevTrackings) =>
        prevTrackings.filter((t) => t.id !== trackingId)
      );
      // Dispatch event to notify that a tracking was deleted
      // This allows other components (like App.tsx) to refresh reminders
      window.dispatchEvent(
        new CustomEvent("trackingDeleted", { detail: { trackingId } })
      );
    } catch (error) {
      console.error(
        `[${new Date().toISOString()}] FRONTEND_TRACKINGS | Error deleting tracking:`,
        error
      );
      throw error;
    }
  };

  /**
   * Refresh trackings from API.
   * @public
   */
  const refreshTrackings = useCallback(async () => {
    await loadTrackings();
  }, [loadTrackings]);

  return {
    trackings,
    isLoading,
    createTracking,
    updateTracking,
    updateTrackingState,
    deleteTracking,
    refreshTrackings,
  };
}
