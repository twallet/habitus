import { useState, useEffect, useCallback } from "react";
import { UserData } from "../models/User";
import { ApiClient } from "../config/api";
import { DateUtils } from "@habitus/shared/utils";

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
   * Sync user's locale and timezone from browser to database if not already set.
   * @param currentUser - Current user data
   * @param currentToken - Current authentication token (optional, falls back to state token)
   * @internal
   */
  const syncLocaleAndTimezoneIfNeeded = useCallback(
    async (currentUser: UserData, currentToken?: string | null) => {
      const tokenToUse = currentToken !== undefined ? currentToken : token;
      if (!currentUser || !tokenToUse) {
        return;
      }

      const detectedLocale = DateUtils.getDefaultLocale();
      const detectedTimezone = DateUtils.getDefaultTimezone();

      // Check if locale or timezone needs to be updated
      const needsLocaleUpdate =
        !currentUser.locale || currentUser.locale !== detectedLocale;
      const needsTimezoneUpdate =
        !currentUser.timezone || currentUser.timezone !== detectedTimezone;

      // Only update if locale or timezone is not set or different from detected values
      if (needsLocaleUpdate || needsTimezoneUpdate) {
        try {
          console.log(
            `[${new Date().toISOString()}] FRONTEND_AUTH | Syncing locale/timezone: locale=${detectedLocale}, timezone=${detectedTimezone} for user ID: ${
              currentUser.id
            }`
          );
          // Ensure token is set in API client for this call
          apiClient.setToken(tokenToUse);
          const updatedUser = await apiClient.updateUserPreferences(
            needsLocaleUpdate ? detectedLocale : undefined,
            needsTimezoneUpdate ? detectedTimezone : undefined
          );
          setUser(updatedUser);
          console.log(
            `[${new Date().toISOString()}] FRONTEND_AUTH | Locale/timezone synced successfully: locale=${detectedLocale}, timezone=${detectedTimezone}`
          );
        } catch (error) {
          // Log error but don't fail authentication
          console.warn(
            `[${new Date().toISOString()}] FRONTEND_AUTH | Failed to sync locale/timezone:`,
            error
          );
        }
      }
    },
    [apiClient, token]
  );

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
          // Sync locale and timezone if needed (pass token explicitly since state hasn't updated yet)
          await syncLocaleAndTimezoneIfNeeded(userData, storedToken);
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
  }, [apiClient, syncLocaleAndTimezoneIfNeeded]);

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
  const verifyMagicLink = useCallback(
    async (magicLinkToken: string): Promise<UserData> => {
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
      // Set token in localStorage first (synchronous operation)
      localStorage.setItem(TOKEN_KEY, data.token);

      // Update state and API client
      setUser(data.user);
      setToken(data.token);
      apiClient.setToken(data.token);

      // Sync locale and timezone if needed (pass token explicitly since state hasn't updated yet)
      await syncLocaleAndTimezoneIfNeeded(data.user, data.token);

      return data.user;
    },
    [apiClient, syncLocaleAndTimezoneIfNeeded]
  );

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
      // Set token in localStorage first (synchronous operation)
      localStorage.setItem(TOKEN_KEY, callbackToken);

      // Update state
      setUser(userData);
      setToken(callbackToken);

      // Sync locale and timezone if needed (pass token explicitly since state hasn't updated yet)
      await syncLocaleAndTimezoneIfNeeded(userData, callbackToken);
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
   * Update notification preferences.
   * @param notificationChannel - Single notification channel (e.g., "Email", "Telegram")
   * @param telegramChatId - Optional Telegram chat ID (required if Telegram is selected)
   * @returns Promise resolving to updated user data
   * @throws Error if request fails
   * @public
   */
  const updateNotificationPreferences = async (
    notificationChannel: string,
    telegramChatId?: string
  ): Promise<UserData> => {
    if (!token) {
      console.error(
        `[${new Date().toISOString()}] FRONTEND_AUTH | Notification preferences update failed: not authenticated`
      );
      throw new Error("Not authenticated");
    }

    console.log(
      `[${new Date().toISOString()}] FRONTEND_AUTH | Updating notification preferences for user ID: ${
        user?.id
      }`
    );

    const updatedUser = await apiClient.updateNotificationPreferences(
      notificationChannel,
      telegramChatId
    );
    console.log(
      `[${new Date().toISOString()}] FRONTEND_AUTH | Notification preferences updated successfully for user ID: ${
        updatedUser.id
      }`
    );
    setUser(updatedUser);
    return updatedUser;
  };

  /**
   * Get Telegram bot start link for connecting Telegram account.
   * @returns Promise resolving to object with link and token
   * @throws Error if request fails
   * @public
   */
  const getTelegramStartLink = async (): Promise<{
    link: string;
    token: string;
  }> => {
    if (!token) {
      throw new Error("Not authenticated");
    }
    return apiClient.getTelegramStartLink();
  };

  /**
   * Get Telegram connection status for the authenticated user.
   * @returns Promise resolving to object with connected status and telegramChatId
   * @throws Error if request fails
   * @public
   */
  const getTelegramStatus = async (): Promise<{
    connected: boolean;
    telegramChatId: string | null;
  }> => {
    if (!token) {
      throw new Error("Not authenticated");
    }
    return apiClient.getTelegramStatus();
  };

  /**
   * Update locale and timezone preferences.
   * @param locale - Optional locale (BCP 47 format like 'en-US', 'es-AR')
   * @param timezone - Optional timezone (IANA timezone like 'America/Buenos_Aires')
   * @returns Promise resolving to updated user data
   * @throws Error if request fails
   * @public
   */
  const updateUserPreferences = async (
    locale?: string,
    timezone?: string
  ): Promise<UserData> => {
    if (!token) {
      console.error(
        `[${new Date().toISOString()}] FRONTEND_AUTH | User preferences update failed: not authenticated`
      );
      throw new Error("Not authenticated");
    }

    console.log(
      `[${new Date().toISOString()}] FRONTEND_AUTH | Updating user preferences for user ID: ${
        user?.id
      }`
    );

    const updatedUser = await apiClient.updateUserPreferences(locale, timezone);
    console.log(
      `[${new Date().toISOString()}] FRONTEND_AUTH | User preferences updated successfully for user ID: ${
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
    updateNotificationPreferences,
    getTelegramStartLink,
    getTelegramStatus,
    updateUserPreferences,
    deleteUser,
  };
}
