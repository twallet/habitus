import { useState, useEffect } from "react";
import { UserData } from "../models/User";
import { ApiClient } from "../config/api";

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
  const [apiClient] = useState(() => new ApiClient());

  /**
   * Load users from API on component mount.
   * @internal
   */
  useEffect(() => {
    const fetchUsers = async () => {
      console.log(
        `[${new Date().toISOString()}] FRONTEND_USERS | Fetching users from API`
      );
      try {
        const loadedUsers = await apiClient.getUsers();
        console.log(
          `[${new Date().toISOString()}] FRONTEND_USERS | Loaded ${
            loadedUsers.length
          } users from API`
        );
        setUsers(loadedUsers);
        setIsInitialized(true);
        setError(null);
      } catch (error) {
        console.error(
          `[${new Date().toISOString()}] FRONTEND_USERS | Error loading users:`,
          error
        );
        setError(
          error instanceof Error ? error.message : "Error loading users"
        );
        setUsers([]);
        setIsInitialized(true);
      }
    };

    fetchUsers();
  }, [apiClient]);

  /**
   * Create a new user via API.
   * @param name - The user's name (max 30 characters, will be trimmed)
   * @returns The created user data
   * @throws {@link TypeError} If the name is invalid
   * @throws {@link Error} If API request fails
   * @public
   */
  const createUser = async (name: string): Promise<UserData> => {
    console.log(
      `[${new Date().toISOString()}] FRONTEND_USERS | Creating new user with name: ${name}`
    );
    try {
      const userData = await apiClient.createUser(name);
      console.log(
        `[${new Date().toISOString()}] FRONTEND_USERS | User created successfully: ID ${
          userData.id
        }, name: ${userData.name}`
      );
      setUsers((prevUsers) => [...prevUsers, userData]);
      setError(null);
      return userData;
    } catch (error) {
      console.error(
        `[${new Date().toISOString()}] FRONTEND_USERS | Error creating user:`,
        error
      );
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
