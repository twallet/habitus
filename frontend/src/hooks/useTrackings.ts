import { useState, useEffect } from "react";
import { TrackingData, TrackingType } from "../models/Tracking";
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

  /**
   * Load trackings from API.
   * @internal
   */
  const loadTrackings = async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      console.warn(
        `[${new Date().toISOString()}] FRONTEND_TRACKINGS | No auth token found, cannot load trackings`
      );
      return;
    }

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
    } catch (error) {
      console.error(
        `[${new Date().toISOString()}] FRONTEND_TRACKINGS | Error loading trackings:`,
        error
      );
      setTrackings([]);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Load trackings on mount.
   * @internal
   */
  useEffect(() => {
    loadTrackings();
  }, [apiClient]);

  /**
   * Create a new tracking via API.
   * @param question - The tracking question
   * @param type - The tracking type (true_false or register)
   * @param startTrackingDate - Optional start tracking date (ISO string, defaults to now)
   * @param notes - Optional notes (rich text)
   * @returns The created tracking data
   * @throws Error if API request fails
   * @public
   */
  const createTracking = async (
    question: string,
    type: TrackingType,
    startTrackingDate?: string,
    notes?: string
  ): Promise<TrackingData> => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      throw new Error("Not authenticated");
    }

    console.log(
      `[${new Date().toISOString()}] FRONTEND_TRACKINGS | Creating new tracking with question: ${question}, type: ${type}`
    );

    try {
      const trackingData = await apiClient.createTracking(
        question,
        type,
        startTrackingDate,
        notes
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
   * @param startTrackingDate - Updated start tracking date (optional)
   * @param notes - Updated notes (optional)
   * @returns The updated tracking data
   * @throws Error if API request fails
   * @public
   */
  const updateTracking = async (
    trackingId: number,
    question?: string,
    type?: TrackingType,
    startTrackingDate?: string,
    notes?: string
  ): Promise<TrackingData> => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      throw new Error("Not authenticated");
    }

    console.log(
      `[${new Date().toISOString()}] FRONTEND_TRACKINGS | Updating tracking ID: ${trackingId}`
    );

    try {
      const trackingData = await apiClient.updateTracking(
        trackingId,
        question,
        type,
        startTrackingDate,
        notes
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
    } catch (error) {
      console.error(
        `[${new Date().toISOString()}] FRONTEND_TRACKINGS | Error deleting tracking:`,
        error
      );
      throw error;
    }
  };

  return {
    trackings,
    isLoading,
    createTracking,
    updateTracking,
    deleteTracking,
  };
}
