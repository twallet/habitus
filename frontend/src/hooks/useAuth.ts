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
      console.log(
        `[${new Date().toISOString()}] FRONTEND_AUTH | Loading authentication state from localStorage`
      );
      const storedToken = localStorage.getItem(TOKEN_KEY);
      if (storedToken) {
        console.log(
          `[${new Date().toISOString()}] FRONTEND_AUTH | Token found in localStorage, verifying with backend`
        );
        try {
          // Verify token by fetching current user
          const response = await fetch(API_ENDPOINTS.auth.me, {
            headers: {
              Authorization: `Bearer ${storedToken}`,
            },
          });

          if (response.ok) {
            const userData = await response.json();
            console.log(
              `[${new Date().toISOString()}] FRONTEND_AUTH | Token verified successfully, user loaded: ${
                userData.email
              } (ID: ${userData.id})`
            );
            setUser(userData);
            setToken(storedToken);
          } else {
            // Token is invalid, remove it
            console.warn(
              `[${new Date().toISOString()}] FRONTEND_AUTH | Token verification failed (status: ${
                response.status
              }), removing from localStorage`
            );
            localStorage.removeItem(TOKEN_KEY);
          }
        } catch (error) {
          console.error(
            `[${new Date().toISOString()}] FRONTEND_AUTH | Error verifying token:`,
            error
          );
          localStorage.removeItem(TOKEN_KEY);
        }
      } else {
        console.log(
          `[${new Date().toISOString()}] FRONTEND_AUTH | No token found in localStorage, user not authenticated`
        );
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
    console.log(
      `[${new Date().toISOString()}] FRONTEND_AUTH | Requesting registration magic link for email: ${email}, name: ${name}`
    );

    const formData = new FormData();
    formData.append("name", name);
    formData.append("email", email);
    if (nickname) {
      formData.append("nickname", nickname);
      console.log(
        `[${new Date().toISOString()}] FRONTEND_AUTH | Registration includes nickname: ${nickname}`
      );
    }
    if (profilePicture) {
      formData.append("profilePicture", profilePicture);
      console.log(
        `[${new Date().toISOString()}] FRONTEND_AUTH | Registration includes profile picture: ${
          profilePicture.name
        } (${profilePicture.size} bytes)`
      );
    }

    console.log(
      `[${new Date().toISOString()}] FRONTEND_AUTH | Sending registration request to: ${
        API_ENDPOINTS.auth.register
      }`
    );
    const startTime = Date.now();

    const response = await fetch(API_ENDPOINTS.auth.register, {
      method: "POST",
      body: formData,
    });

    const duration = Date.now() - startTime;
    console.log(
      `[${new Date().toISOString()}] FRONTEND_AUTH | Registration request completed in ${duration}ms, status: ${
        response.status
      }`
    );

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ error: "Error requesting registration magic link" }));
      console.error(
        `[${new Date().toISOString()}] FRONTEND_AUTH | Registration request failed:`,
        errorData.error
      );
      throw new Error(
        errorData.error || "Error requesting registration magic link"
      );
    }

    console.log(
      `[${new Date().toISOString()}] FRONTEND_AUTH | Registration magic link request successful for email: ${email}`
    );
  };

  /**
   * Request login magic link (passwordless).
   * @param email - User's email
   * @returns Promise resolving when magic link is sent
   * @throws Error if request fails
   * @public
   */
  const requestLoginMagicLink = async (email: string): Promise<void> => {
    console.log(
      `[${new Date().toISOString()}] FRONTEND_AUTH | Requesting login magic link for email: ${email}`
    );
    console.log(
      `[${new Date().toISOString()}] FRONTEND_AUTH | Sending login request to: ${
        API_ENDPOINTS.auth.login
      }`
    );
    const startTime = Date.now();

    const response = await fetch(API_ENDPOINTS.auth.login, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email }),
    });

    const duration = Date.now() - startTime;
    console.log(
      `[${new Date().toISOString()}] FRONTEND_AUTH | Login request completed in ${duration}ms, status: ${
        response.status
      }`
    );

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ error: "Error requesting login magic link" }));
      console.error(
        `[${new Date().toISOString()}] FRONTEND_AUTH | Login request failed:`,
        errorData.error
      );
      throw new Error(errorData.error || "Error requesting login magic link");
    }

    console.log(
      `[${new Date().toISOString()}] FRONTEND_AUTH | Login magic link request successful for email: ${email}`
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
    const verifyUrl = `${
      API_ENDPOINTS.auth.verifyMagicLink
    }?token=${encodeURIComponent(magicLinkToken)}`;
    console.log(
      `[${new Date().toISOString()}] FRONTEND_AUTH | Sending verification request to: ${
        API_ENDPOINTS.auth.verifyMagicLink
      }`
    );
    const startTime = Date.now();

    const response = await fetch(verifyUrl, {
      method: "GET",
    });

    const duration = Date.now() - startTime;
    console.log(
      `[${new Date().toISOString()}] FRONTEND_AUTH | Magic link verification completed in ${duration}ms, status: ${
        response.status
      }`
    );

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ error: "Invalid or expired magic link" }));
      console.error(
        `[${new Date().toISOString()}] FRONTEND_AUTH | Magic link verification failed:`,
        errorData.error
      );
      throw new Error(errorData.error || "Invalid or expired magic link");
    }

    const data = await response.json();
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
      // Verify token by fetching current user
      const response = await fetch(API_ENDPOINTS.auth.me, {
        headers: {
          Authorization: `Bearer ${callbackToken}`,
        },
      });

      if (response.ok) {
        const userData = await response.json();
        console.log(
          `[${new Date().toISOString()}] FRONTEND_AUTH | Token from callback verified, user loaded: ${
            userData.email
          } (ID: ${userData.id})`
        );
        setUser(userData);
        setToken(callbackToken);
        localStorage.setItem(TOKEN_KEY, callbackToken);
      } else {
        console.error(
          `[${new Date().toISOString()}] FRONTEND_AUTH | Token from callback verification failed (status: ${
            response.status
          })`
        );
        throw new Error("Invalid token");
      }
    } catch (error) {
      console.error(
        `[${new Date().toISOString()}] FRONTEND_AUTH | Error setting token from callback:`,
        error
      );
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
      console.error(
        `[${new Date().toISOString()}] FRONTEND_AUTH | Profile update failed: not authenticated`
      );
      throw new Error("Not authenticated");
    }

    console.log(
      `[${new Date().toISOString()}] FRONTEND_AUTH | Updating profile for user ID: ${
        user?.id
      }, email: ${email}`
    );

    const formData = new FormData();
    formData.append("name", name);
    formData.append("email", email);
    if (nickname) {
      formData.append("nickname", nickname);
      console.log(
        `[${new Date().toISOString()}] FRONTEND_AUTH | Profile update includes nickname: ${nickname}`
      );
    }
    if (profilePicture) {
      formData.append("profilePicture", profilePicture);
      console.log(
        `[${new Date().toISOString()}] FRONTEND_AUTH | Profile update includes profile picture: ${
          profilePicture.name
        } (${profilePicture.size} bytes)`
      );
    }

    console.log(
      `[${new Date().toISOString()}] FRONTEND_AUTH | Sending profile update request to: ${
        API_ENDPOINTS.profile.update
      }`
    );
    const startTime = Date.now();

    const response = await fetch(API_ENDPOINTS.profile.update, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    const duration = Date.now() - startTime;
    console.log(
      `[${new Date().toISOString()}] FRONTEND_AUTH | Profile update request completed in ${duration}ms, status: ${
        response.status
      }`
    );

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ error: "Error updating profile" }));
      console.error(
        `[${new Date().toISOString()}] FRONTEND_AUTH | Profile update failed:`,
        errorData.error
      );
      throw new Error(errorData.error || "Error updating profile");
    }

    const updatedUser = await response.json();
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
    console.log(
      `[${new Date().toISOString()}] FRONTEND_AUTH | Sending delete request to: ${
        API_ENDPOINTS.profile.delete
      }`
    );
    const startTime = Date.now();

    const response = await fetch(API_ENDPOINTS.profile.delete, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const duration = Date.now() - startTime;
    console.log(
      `[${new Date().toISOString()}] FRONTEND_AUTH | User deletion request completed in ${duration}ms, status: ${
        response.status
      }`
    );

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ error: "Error deleting user" }));
      console.error(
        `[${new Date().toISOString()}] FRONTEND_AUTH | User deletion failed:`,
        errorData.error
      );
      throw new Error(errorData.error || "Error deleting user");
    }

    console.log(
      `[${new Date().toISOString()}] FRONTEND_AUTH | User account deleted successfully, clearing auth state`
    );
    // Clear auth state after successful deletion
    setUser(null);
    setToken(null);
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
    verifyMagicLink,
    logout,
    setTokenFromCallback,
    updateProfile,
    deleteUser,
  };
}
