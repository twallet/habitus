import { useState, useEffect } from "react";
import { UserData } from "../models/User";
import { ApiClient } from "../config/api";

/**
 * Authentication token storage key.
 * @private
 */
const TOKEN_KEY = "habitus_token";

/**
 * Custom hook for managing authentication state.
 * Handles passwordless authentication with magic links and token persistence.
 * @returns Object containing auth state and functions
 * @public
 */
export function useAuth() {
  const [user, setUser] = useState<UserData | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [apiClient] = useState(() => new ApiClient());

  /**
   * Load token from localStorage on mount and verify it.
   * @internal
   */
  useEffect(() => {
    const loadAuth = async () => {
      console.log(
        `[${new Date().toISOString()}] FRONTEND_AUTH | Loading authentication state from localStorage`
      );
      const storedToken = localStorage.getItem(TOKEN_KEY);
      if (storedToken) {
        console.log(
          `[${new Date().toISOString()}] FRONTEND_AUTH | Token found in localStorage, verifying with backend`
        );
        try {
          apiClient.setToken(storedToken);
          // Verify token by fetching current user
          const userData = await apiClient.getMe();
          console.log(
            `[${new Date().toISOString()}] FRONTEND_AUTH | Token verified successfully, user loaded: ${
              userData.email
            } (ID: ${userData.id})`
          );
          setUser(userData);
          setToken(storedToken);
        } catch (error) {
          // Token is invalid, remove it
          console.warn(
            `[${new Date().toISOString()}] FRONTEND_AUTH | Token verification failed, removing from localStorage`
          );
          localStorage.removeItem(TOKEN_KEY);
          apiClient.setToken(null);
        }
      } else {
        console.log(
          `[${new Date().toISOString()}] FRONTEND_AUTH | No token found in localStorage, user not authenticated`
        );
      }
      setIsLoading(false);
    };

    loadAuth();
  }, [apiClient]);

  /**
   * Request registration magic link (passwordless).
   * @param name - User's name
   * @param email - User's email
   * @param profilePicture - Optional profile picture file
   * @returns Promise resolving when magic link is sent
   * @throws Error if request fails
   * @public
   */
  const requestRegisterMagicLink = async (
    name: string,
    email: string,
    profilePicture?: File
  ): Promise<void> => {
    console.log(
      `[${new Date().toISOString()}] FRONTEND_AUTH | Requesting registration magic link for email: ${email}, name: ${name}`
    );
    await apiClient.register(name, email, profilePicture);
    console.log(
      `[${new Date().toISOString()}] FRONTEND_AUTH | Registration magic link request successful for email: ${email}`
    );
  };

  /**
   * Request login magic link (passwordless).
   * @param email - User's email
   * @returns Promise resolving to response data (includes message and optional cooldown flag)
   * @throws Error if request fails
   * @public
   */
  const requestLoginMagicLink = async (
    email: string
  ): Promise<{ message: string; cooldown?: boolean }> => {
    console.log(
      `[${new Date().toISOString()}] FRONTEND_AUTH | Requesting login magic link for email: ${email}`
    );
    const response = await apiClient.login(email);
    console.log(
      `[${new Date().toISOString()}] FRONTEND_AUTH | Login magic link request completed for email: ${email}, cooldown: ${
        response.cooldown || false
      }`
    );
    return response;
  };

  /**
   * Request email change magic link.
   * @param newEmail - New email address
   * @returns Promise resolving when magic link is sent
   * @throws Error if request fails
   * @public
   */
  const requestEmailChange = async (newEmail: string): Promise<void> => {
    if (!token) {
      console.error(
        `[${new Date().toISOString()}] FRONTEND_AUTH | Email change request failed: not authenticated`
      );
      throw new Error("Not authenticated");
    }

    console.log(
      `[${new Date().toISOString()}] FRONTEND_AUTH | Requesting email change magic link for new email: ${newEmail}`
    );
    await apiClient.requestEmailChange(newEmail);
    console.log(
      `[${new Date().toISOString()}] FRONTEND_AUTH | Email change magic link request successful for email: ${newEmail}`
    );
  };

  /**
   * Verify magic link token and log user in.
   * @param magicLinkToken - Magic link token from email
   * @returns Promise resolving to user data
   * @throws Error if verification fails
   * @public
   */
  const verifyMagicLink = async (magicLinkToken: string): Promise<UserData> => {
    console.log(
      `[${new Date().toISOString()}] FRONTEND_AUTH | Verifying magic link token (length: ${
        magicLinkToken.length
      })`
    );
    const data = await apiClient.verifyMagicLink(magicLinkToken);
    console.log(
      `[${new Date().toISOString()}] FRONTEND_AUTH | Magic link verified successfully, user authenticated: ${
        data.user.email
      } (ID: ${data.user.id})`
    );
    console.log(
      `[${new Date().toISOString()}] FRONTEND_AUTH | Storing JWT token in localStorage`
    );
    setUser(data.user);
    setToken(data.token);
    apiClient.setToken(data.token);
    localStorage.setItem(TOKEN_KEY, data.token);

    return data.user;
  };

  /**
   * Logout the current user.
   * @public
   */
  const logout = () => {
    const userEmail = user?.email || "unknown";
    console.log(
      `[${new Date().toISOString()}] FRONTEND_AUTH | Logging out user: ${userEmail}`
    );
    setUser(null);
    setToken(null);
    apiClient.setToken(null);
    localStorage.removeItem(TOKEN_KEY);
    console.log(
      `[${new Date().toISOString()}] FRONTEND_AUTH | User logged out successfully, token removed from localStorage`
    );
  };

  /**
   * Set token from callback (for magic link verification).
   * Verifies token and loads user data.
   * @param callbackToken - JWT token from magic link verification
   * @public
   */
  const setTokenFromCallback = async (callbackToken: string) => {
    console.log(
      `[${new Date().toISOString()}] FRONTEND_AUTH | Setting token from callback (length: ${
        callbackToken.length
      })`
    );
    try {
      apiClient.setToken(callbackToken);
      // Verify token by fetching current user
      const userData = await apiClient.getMe();
      console.log(
        `[${new Date().toISOString()}] FRONTEND_AUTH | Token from callback verified, user loaded: ${
          userData.email
        } (ID: ${userData.id})`
      );
      setUser(userData);
      setToken(callbackToken);
      localStorage.setItem(TOKEN_KEY, callbackToken);
    } catch (error) {
      console.error(
        `[${new Date().toISOString()}] FRONTEND_AUTH | Error setting token from callback:`,
        error
      );
      apiClient.setToken(null);
      throw error;
    }
  };

  /**
   * Update user profile.
   * @param name - Updated name
   * @param profilePicture - Optional profile picture file
   * @param removeProfilePicture - Whether to remove the profile picture
   * @returns Promise resolving to updated user data
   * @throws Error if request fails
   * @public
   */
  const updateProfile = async (
    name: string,
    profilePicture: File | null,
    removeProfilePicture?: boolean
  ): Promise<UserData> => {
    if (!token) {
      console.error(
        `[${new Date().toISOString()}] FRONTEND_AUTH | Profile update failed: not authenticated`
      );
      throw new Error("Not authenticated");
    }

    console.log(
      `[${new Date().toISOString()}] FRONTEND_AUTH | Updating profile for user ID: ${
        user?.id
      }`
    );

    const updatedUser = await apiClient.updateProfile(
      name,
      profilePicture,
      removeProfilePicture
    );
    console.log(
      `[${new Date().toISOString()}] FRONTEND_AUTH | Profile updated successfully for user ID: ${
        updatedUser.id
      }`
    );
    setUser(updatedUser);
    return updatedUser;
  };

  /**
   * Delete user account.
   * @returns Promise resolving when account is deleted
   * @throws Error if request fails
   * @public
   */
  const deleteUser = async (): Promise<void> => {
    if (!token) {
      console.error(
        `[${new Date().toISOString()}] FRONTEND_AUTH | User deletion failed: not authenticated`
      );
      throw new Error("Not authenticated");
    }

    const userId = user?.id || "unknown";
    const userEmail = user?.email || "unknown";
    console.log(
      `[${new Date().toISOString()}] FRONTEND_AUTH | Deleting user account: ID ${userId}, email: ${userEmail}`
    );

    await apiClient.deleteProfile();

    console.log(
      `[${new Date().toISOString()}] FRONTEND_AUTH | User account deleted successfully, clearing auth state`
    );
    // Clear auth state after successful deletion
    setUser(null);
    setToken(null);
    apiClient.setToken(null);
    localStorage.removeItem(TOKEN_KEY);
    console.log(
      `[${new Date().toISOString()}] FRONTEND_AUTH | Auth state cleared after user deletion`
    );
  };

  /**
   * Check if user is authenticated.
   * @returns True if user is logged in
   * @public
   */
  const isAuthenticated = user !== null && token !== null;

  return {
    user,
    token,
    isLoading,
    isAuthenticated,
    requestRegisterMagicLink,
    requestLoginMagicLink,
    requestEmailChange,
    verifyMagicLink,
    logout,
    setTokenFromCallback,
    updateProfile,
    deleteUser,
  };
}
