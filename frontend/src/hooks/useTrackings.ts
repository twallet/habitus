import { useState, useEffect } from "react";
import { TrackingData, TrackingType } from "../models/Tracking";
import { API_ENDPOINTS } from "../config/api";

/**
 * Authentication token storage key.
 * @private
 */
const TOKEN_KEY = "habitus_token";

/**
 * Get authentication token from localStorage.
 * @returns Token string or null
 * @private
 */
const getAuthToken = (): string | null => {
  return localStorage.getItem(TOKEN_KEY);
};

/**
 * Custom hook for managing trackings with API persistence.
 * Handles loading, creating, updating, and deleting trackings via REST API.
 * @returns Object containing trackings array, CRUD functions, and status
 * @public
 */
export function useTrackings() {
  const [trackings, setTrackings] = useState<TrackingData[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Load trackings from API.
   * @internal
   */
  const loadTrackings = async () => {
    const token = getAuthToken();
    if (!token) {
      console.warn(
        `[${new Date().toISOString()}] FRONTEND_TRACKINGS | No auth token found, cannot load trackings`
      );
      return;
    }

    setIsLoading(true);
    console.log(
      `[${new Date().toISOString()}] FRONTEND_TRACKINGS | Fetching trackings from API: ${
        API_ENDPOINTS.trackings
      }`
    );
    const startTime = Date.now();

    try {
      const response = await fetch(API_ENDPOINTS.trackings, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const duration = Date.now() - startTime;
      console.log(
        `[${new Date().toISOString()}] FRONTEND_TRACKINGS | Trackings fetch completed in ${duration}ms, status: ${
          response.status
        }`
      );

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: "Failed to fetch trackings" }));
        throw new Error(errorData.error || "Failed to fetch trackings");
      }

      const loadedTrackings = await response.json();
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
  }, []);

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
    const token = getAuthToken();
    if (!token) {
      throw new Error("Not authenticated");
    }

    console.log(
      `[${new Date().toISOString()}] FRONTEND_TRACKINGS | Creating new tracking with question: ${question}, type: ${type}`
    );
    const startTime = Date.now();

    try {
      const response = await fetch(API_ENDPOINTS.trackings, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          question,
          type,
          start_tracking_date: startTrackingDate,
          notes,
        }),
      });

      const duration = Date.now() - startTime;
      console.log(
        `[${new Date().toISOString()}] FRONTEND_TRACKINGS | Create tracking request completed in ${duration}ms, status: ${
          response.status
        }`
      );

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: "Error creating tracking" }));
        throw new Error(errorData.error || "Error creating tracking");
      }

      const trackingData = await response.json();
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
    const token = getAuthToken();
    if (!token) {
      throw new Error("Not authenticated");
    }

    console.log(
      `[${new Date().toISOString()}] FRONTEND_TRACKINGS | Updating tracking ID: ${trackingId}`
    );
    const startTime = Date.now();

    try {
      const response = await fetch(`${API_ENDPOINTS.trackings}/${trackingId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          question,
          type,
          start_tracking_date: startTrackingDate,
          notes,
        }),
      });

      const duration = Date.now() - startTime;
      console.log(
        `[${new Date().toISOString()}] FRONTEND_TRACKINGS | Update tracking request completed in ${duration}ms, status: ${
          response.status
        }`
      );

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: "Error updating tracking" }));
        throw new Error(errorData.error || "Error updating tracking");
      }

      const trackingData = await response.json();
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
    const token = getAuthToken();
    if (!token) {
      throw new Error("Not authenticated");
    }

    console.log(
      `[${new Date().toISOString()}] FRONTEND_TRACKINGS | Deleting tracking ID: ${trackingId}`
    );
    const startTime = Date.now();

    try {
      const response = await fetch(`${API_ENDPOINTS.trackings}/${trackingId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const duration = Date.now() - startTime;
      console.log(
        `[${new Date().toISOString()}] FRONTEND_TRACKINGS | Delete tracking request completed in ${duration}ms, status: ${
          response.status
        }`
      );

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: "Error deleting tracking" }));
        throw new Error(errorData.error || "Error deleting tracking");
      }

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
