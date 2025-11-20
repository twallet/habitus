import { useState, useEffect } from "react";
import { UserData } from "../models/User";
import { API_ENDPOINTS } from "../config/api";

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

  /**
   * Load token from localStorage on mount and verify it.
   * @internal
   */
  useEffect(() => {
    const loadAuth = async () => {
      const storedToken = localStorage.getItem(TOKEN_KEY);
      if (storedToken) {
        try {
          // Verify token by fetching current user
          const response = await fetch(API_ENDPOINTS.auth.me, {
            headers: {
              Authorization: `Bearer ${storedToken}`,
            },
          });

          if (response.ok) {
            const userData = await response.json();
            setUser(userData);
            setToken(storedToken);
          } else {
            // Token is invalid, remove it
            localStorage.removeItem(TOKEN_KEY);
          }
        } catch (error) {
          console.error("Error verifying token:", error);
          localStorage.removeItem(TOKEN_KEY);
        }
      }
      setIsLoading(false);
    };

    loadAuth();
  }, []);

  /**
   * Request registration magic link (passwordless).
   * @param name - User's name
   * @param email - User's email
   * @param nickname - Optional nickname
   * @param profilePicture - Optional profile picture file
   * @returns Promise resolving when magic link is sent
   * @throws Error if request fails
   * @public
   */
  const requestRegisterMagicLink = async (
    name: string,
    email: string,
    nickname?: string,
    profilePicture?: File
  ): Promise<void> => {
    const formData = new FormData();
    formData.append("name", name);
    formData.append("email", email);
    if (nickname) {
      formData.append("nickname", nickname);
    }
    if (profilePicture) {
      formData.append("profilePicture", profilePicture);
    }

    const response = await fetch(API_ENDPOINTS.auth.register, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ error: "Error requesting registration magic link" }));
      throw new Error(
        errorData.error || "Error requesting registration magic link"
      );
    }
  };

  /**
   * Request login magic link (passwordless).
   * @param email - User's email
   * @returns Promise resolving when magic link is sent
   * @throws Error if request fails
   * @public
   */
  const requestLoginMagicLink = async (email: string): Promise<void> => {
    const response = await fetch(API_ENDPOINTS.auth.login, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ error: "Error requesting login magic link" }));
      throw new Error(errorData.error || "Error requesting login magic link");
    }
  };

  /**
   * Verify magic link token and log user in.
   * @param magicLinkToken - Magic link token from email
   * @returns Promise resolving to user data
   * @throws Error if verification fails
   * @public
   */
  const verifyMagicLink = async (magicLinkToken: string): Promise<UserData> => {
    const response = await fetch(
      `${API_ENDPOINTS.auth.verifyMagicLink}?token=${encodeURIComponent(
        magicLinkToken
      )}`,
      {
        method: "GET",
      }
    );

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ error: "Invalid or expired magic link" }));
      throw new Error(errorData.error || "Invalid or expired magic link");
    }

    const data = await response.json();
    setUser(data.user);
    setToken(data.token);
    localStorage.setItem(TOKEN_KEY, data.token);

    return data.user;
  };

  /**
   * Logout the current user.
   * @public
   */
  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem(TOKEN_KEY);
  };

  /**
   * Set token from callback (for magic link verification).
   * Verifies token and loads user data.
   * @param callbackToken - JWT token from magic link verification
   * @public
   */
  const setTokenFromCallback = async (callbackToken: string) => {
    try {
      // Verify token by fetching current user
      const response = await fetch(API_ENDPOINTS.auth.me, {
        headers: {
          Authorization: `Bearer ${callbackToken}`,
        },
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
        setToken(callbackToken);
        localStorage.setItem(TOKEN_KEY, callbackToken);
      } else {
        throw new Error("Invalid token");
      }
    } catch (error) {
      console.error("Error setting token from callback:", error);
      throw error;
    }
  };

  /**
   * Update user profile.
   * @param name - Updated name (optional)
   * @param nickname - Updated nickname (optional)
   * @param email - Updated email (optional)
   * @param profilePicture - Optional profile picture file
   * @returns Promise resolving to updated user data
   * @throws Error if request fails
   * @public
   */
  const updateProfile = async (
    name: string,
    nickname: string | undefined,
    email: string,
    profilePicture: File | null
  ): Promise<UserData> => {
    if (!token) {
      throw new Error("Not authenticated");
    }

    const formData = new FormData();
    formData.append("name", name);
    formData.append("email", email);
    if (nickname) {
      formData.append("nickname", nickname);
    }
    if (profilePicture) {
      formData.append("profilePicture", profilePicture);
    }

    const response = await fetch(API_ENDPOINTS.profile.update, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ error: "Error updating profile" }));
      throw new Error(errorData.error || "Error updating profile");
    }

    const updatedUser = await response.json();
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
      throw new Error("Not authenticated");
    }

    const response = await fetch(API_ENDPOINTS.profile.delete, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ error: "Error deleting user" }));
      throw new Error(errorData.error || "Error deleting user");
    }

    // Clear auth state after successful deletion
    setUser(null);
    setToken(null);
    localStorage.removeItem(TOKEN_KEY);
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
    verifyMagicLink,
    logout,
    setTokenFromCallback,
    updateProfile,
    deleteUser,
  };
}
