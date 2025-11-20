import { useState, useEffect } from "react";
import { UserData } from "../models/User";
import { API_ENDPOINTS } from "../config/api";

/**
 * Custom hook for managing users with API persistence.
 * Handles loading, saving, and creating users via REST API.
 * @returns Object containing users array, createUser function, and initialization status
 * @public
 */
export function useUsers() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Load users from API on component mount.
   * @internal
   */
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await fetch(API_ENDPOINTS.users);
        if (!response.ok) {
          throw new Error("Failed to fetch users");
        }
        const loadedUsers = await response.json();
        setUsers(loadedUsers);
        setIsInitialized(true);
        setError(null);
      } catch (error) {
        console.error("Error loading users:", error);
        setError(
          error instanceof Error ? error.message : "Error loading users"
        );
        setUsers([]);
        setIsInitialized(true);
      }
    };

    fetchUsers();
  }, []);

  /**
   * Create a new user via API.
   * @param name - The user's name (max 30 characters, will be trimmed)
   * @returns The created user data
   * @throws {@link TypeError} If the name is invalid
   * @throws {@link Error} If API request fails
   * @public
   */
  const createUser = async (name: string): Promise<UserData> => {
    try {
      const response = await fetch(API_ENDPOINTS.users, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name }),
      });

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: "Error creating user" }));
        throw new Error(errorData.error || "Error creating user");
      }

      const userData = await response.json();
      setUsers((prevUsers) => [...prevUsers, userData]);
      setError(null);
      return userData;
    } catch (error) {
      setError(error instanceof Error ? error.message : "Error creating user");
      throw error;
    }
  };

  return {
    users,
    createUser,
    isInitialized,
    error,
  };
}
