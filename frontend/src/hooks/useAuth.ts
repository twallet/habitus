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
 * Handles login, register, logout, and token persistence.
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
   * Register a new user.
   * @param name - User's name
   * @param email - User's email
   * @param password - User's password
   * @param profilePicture - Optional profile picture file
   * @returns Promise resolving to user data
   * @throws Error if registration fails
   * @public
   */
  const register = async (
    name: string,
    email: string,
    password: string,
    profilePicture?: File
  ): Promise<UserData> => {
    // Use FormData if profile picture is provided, otherwise use JSON
    const formData = new FormData();
    formData.append("name", name);
    formData.append("email", email);
    formData.append("password", password);

    if (profilePicture) {
      formData.append("profilePicture", profilePicture);
    }

    const headers: HeadersInit = {};
    // Don't set Content-Type header when using FormData - browser will set it with boundary
    if (!profilePicture) {
      headers["Content-Type"] = "application/json";
    }

    const response = await fetch(API_ENDPOINTS.auth.register, {
      method: "POST",
      headers,
      body: profilePicture
        ? formData
        : JSON.stringify({ name, email, password }),
    });

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ error: "Error registering user" }));
      throw new Error(errorData.error || "Error registering user");
    }

    const userData = await response.json();

    // After registration, automatically log in
    const loginResponse = await fetch(API_ENDPOINTS.auth.login, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    if (!loginResponse.ok) {
      throw new Error("Registration successful but login failed");
    }

    const loginData = await loginResponse.json();
    setUser(loginData.user);
    setToken(loginData.token);
    localStorage.setItem(TOKEN_KEY, loginData.token);

    return userData;
  };

  /**
   * Login with email and password.
   * @param email - User's email
   * @param password - User's password
   * @returns Promise resolving to user data
   * @throws Error if login fails
   * @public
   */
  const login = async (email: string, password: string): Promise<UserData> => {
    const response = await fetch(API_ENDPOINTS.auth.login, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ error: "Error logging in" }));
      throw new Error(errorData.error || "Error logging in");
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
   * Set token from OAuth callback.
   * Verifies token and loads user data.
   * @param callbackToken - JWT token from OAuth callback
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
    register,
    login,
    logout,
    setTokenFromCallback,
  };
}
