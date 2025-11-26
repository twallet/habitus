import { UserData } from "../models/User.js";
import { TrackingData, TrackingType } from "../models/Tracking.js";

/**
 * Get Vite environment variables.
 * This function abstracts access to import.meta.env to make it Jest-compatible.
 * In Jest, we use globalThis.import.meta.env (mocked in setupTests.ts).
 * In browser/Vite, we use import.meta.env directly (Vite replaces it at build/dev time).
 * @returns Object with VITE_SERVER_URL and VITE_PORT, or undefined if not available
 * @private
 */
function getViteEnv():
  | {
      VITE_SERVER_URL?: string;
      VITE_PORT?: string;
    }
  | undefined {
  // First, try to get from globalThis.import.meta.env (works in both Jest and browser)
  // In Jest, this is mocked in setupTests.ts
  // In browser, Vite also exposes it here sometimes, but primarily uses import.meta.env
  const globalImport = (
    globalThis as {
      import?: {
        meta?: {
          env?: {
            VITE_SERVER_URL?: string;
            VITE_PORT?: string;
          };
        };
      };
    }
  ).import;

  if (globalImport?.meta?.env) {
    return globalImport.meta.env;
  }

  // If globalThis doesn't have it, try import.meta.env (browser/Vite only)
  // Jest will fail to parse import.meta directly, so we use eval to avoid parsing at module load time
  // This is safe because:
  // 1. We only reach here if globalThis.import.meta.env is not available (i.e., not in Jest)
  // 2. In browser/Vite, import.meta.env is available and Vite replaces it at build/dev time
  // eslint-disable-next-line no-eval
  try {
    // Access import.meta.env dynamically to avoid Jest parsing errors
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const env = eval("import.meta.env");
    if (env && (env.VITE_SERVER_URL || env.VITE_PORT)) {
      return env;
    }
  } catch {
    // If eval fails or import.meta is not available, return undefined
  }

  return undefined;
}

/**
 * API configuration.
 * Constructs API base URL from VITE_SERVER_URL and VITE_PORT environment variables.
 * Uses relative URLs when served from same origin (development with single server).
 * @public
 */
const getApiBaseUrl = (): string => {
  let serverUrl: string | undefined;
  let port: string | undefined;

  // Get environment variables from Vite or Jest mock
  const viteEnv = getViteEnv();
  if (viteEnv) {
    serverUrl = viteEnv.VITE_SERVER_URL;
    port = viteEnv.VITE_PORT;
  }

  // Fallback to process.env for tests (Node.js environment)
  if (!serverUrl || !port) {
    if (typeof process !== "undefined" && process.env) {
      serverUrl = serverUrl || process.env.VITE_SERVER_URL;
      port = port || process.env.VITE_PORT;
    }
  }

  // In development with single server, use relative URLs (same origin)
  // If we're in a browser, we can detect same origin and use relative URLs
  if (typeof window !== "undefined") {
    // If we have env vars, check if they match current origin
    if (serverUrl && port) {
      const currentOrigin = `${window.location.protocol}//${window.location.host}`;
      const apiUrl = `${serverUrl}:${port}`;
      if (currentOrigin === apiUrl) {
        return ""; // Use relative URL (same origin)
      }
      // Return full URL from env vars
      return `${serverUrl}:${port}`;
    }
    // If env vars are not available but we're in browser, use relative URLs
    // This works because frontend and backend are served from same origin in development
    return "";
  }

  // Validate required environment variables for non-browser environments
  if (!serverUrl) {
    throw new Error(
      "VITE_SERVER_URL environment variable is required. Please set it in your .env file."
    );
  }
  if (!port) {
    throw new Error(
      "VITE_PORT environment variable is required. Please set it in your .env file."
    );
  }

  // Return full URL
  return `${serverUrl}:${port}`;
};

/**
 * Cached API base URL (lazy loaded).
 * @private
 */
let cachedApiBaseUrl: string | null = null;

/**
 * Get API base URL (lazy loading with caching).
 * @returns API base URL
 * @public
 */
function getApiBaseUrlLazy(): string {
  if (cachedApiBaseUrl === null) {
    cachedApiBaseUrl = getApiBaseUrl();
  }
  return cachedApiBaseUrl;
}

/**
 * API base URL (lazy loaded - only evaluated when first accessed).
 * @public
 */
export const API_BASE_URL = getApiBaseUrlLazy();

/**
 * API endpoints type.
 * @private
 */
type API_ENDPOINTS_TYPE = {
  readonly users: string;
  readonly auth: {
    readonly register: string;
    readonly login: string;
    readonly verifyMagicLink: string;
    readonly changeEmail: string;
    readonly me: string;
  };
  readonly profile: {
    readonly update: string;
    readonly delete: string;
  };
  readonly trackings: string;
};

/**
 * Cached API endpoints (lazy loaded).
 * @private
 */
let cachedApiEndpoints: API_ENDPOINTS_TYPE | null = null;

/**
 * Get API endpoints (lazy loading).
 * @returns API endpoints object
 * @private
 */
function getApiEndpointsLazy(): API_ENDPOINTS_TYPE {
  if (cachedApiEndpoints === null) {
    const baseUrl = getApiBaseUrlLazy();
    cachedApiEndpoints = {
      users: `${baseUrl}/api/users`,
      auth: {
        register: `${baseUrl}/api/auth/register`,
        login: `${baseUrl}/api/auth/login`,
        verifyMagicLink: `${baseUrl}/api/auth/verify-magic-link`,
        changeEmail: `${baseUrl}/api/auth/change-email`,
        me: `${baseUrl}/api/auth/me`,
      },
      profile: {
        update: `${baseUrl}/api/users/profile`,
        delete: `${baseUrl}/api/users/profile`,
      },
      trackings: `${baseUrl}/api/trackings`,
    } as const;
  }
  return cachedApiEndpoints;
}

/**
 * API endpoints (lazy loaded - only evaluated when first accessed).
 * @public
 */
export const API_ENDPOINTS = getApiEndpointsLazy();

/**
 * API Client class for making HTTP requests to the backend API.
 * Encapsulates all API communication logic and provides instance methods for each endpoint.
 * @public
 */
export class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  /**
   * Create a new ApiClient instance.
   * @param baseUrl - Base URL for the API (optional, defaults to API_BASE_URL)
   * @public
   */
  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || API_BASE_URL;
  }

  /**
   * Set the authentication token.
   * @param token - JWT token string
   * @public
   */
  setToken(token: string | null): void {
    this.token = token;
  }

  /**
   * Get the current authentication token.
   * @returns The current token or null
   * @public
   */
  getToken(): string | null {
    return this.token;
  }

  /**
   * Make a GET request.
   * @param url - Request URL (relative or absolute)
   * @param options - Optional fetch options
   * @returns Promise resolving to the response JSON
   * @throws Error if request fails
   * @private
   */
  private async get<T>(url: string, options?: RequestInit): Promise<T> {
    const response = await this.request(url, { ...options, method: "GET" });
    return response.json();
  }

  /**
   * Make a POST request.
   * @param url - Request URL (relative or absolute)
   * @param body - Request body (will be JSON stringified)
   * @param options - Optional fetch options
   * @returns Promise resolving to the response JSON
   * @throws Error if request fails
   * @private
   */
  private async post<T>(
    url: string,
    body?: any,
    options?: RequestInit
  ): Promise<T> {
    const response = await this.request(url, {
      ...options,
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });
    return response.json();
  }

  /**
   * Make a PUT request.
   * @param url - Request URL (relative or absolute)
   * @param body - Request body (will be JSON stringified or FormData)
   * @param options - Optional fetch options
   * @returns Promise resolving to the response JSON
   * @throws Error if request fails
   * @private
   */
  private async put<T>(
    url: string,
    body?: any,
    options?: RequestInit
  ): Promise<T> {
    const isFormData = body instanceof FormData;
    const response = await this.request(url, {
      ...options,
      method: "PUT",
      body: isFormData ? body : body ? JSON.stringify(body) : undefined,
      headers: isFormData
        ? options?.headers
        : {
            "Content-Type": "application/json",
            ...options?.headers,
          },
    });
    return response.json();
  }

  /**
   * Make a DELETE request.
   * @param url - Request URL (relative or absolute)
   * @param options - Optional fetch options
   * @returns Promise resolving to the response JSON
   * @throws Error if request fails
   * @private
   */
  private async delete<T>(url: string, options?: RequestInit): Promise<T> {
    const response = await this.request(url, {
      ...options,
      method: "DELETE",
    });
    return response.json();
  }

  /**
   * Make an HTTP request with authentication headers.
   * @param url - Request URL (relative or absolute)
   * @param options - Fetch options
   * @returns Promise resolving to the Response object
   * @throws Error if request fails
   * @private
   */
  private async request(
    url: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const fullUrl = url.startsWith("http") ? url : `${this.baseUrl}${url}`;
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }

    const response = await fetch(fullUrl, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({
        error: `HTTP ${response.status}: ${response.statusText}`,
      }));
      throw new Error(
        errorData.error || `HTTP ${response.status}: ${response.statusText}`
      );
    }

    return response;
  }

  /**
   * Get all users.
   * @returns Promise resolving to array of user data
   * @throws Error if request fails
   * @public
   */
  async getUsers(): Promise<UserData[]> {
    return this.get<UserData[]>(API_ENDPOINTS.users);
  }

  /**
   * Create a new user.
   * @param name - User's name
   * @returns Promise resolving to created user data
   * @throws Error if request fails
   * @public
   */
  async createUser(name: string): Promise<UserData> {
    return this.post<UserData>(API_ENDPOINTS.users, { name });
  }

  /**
   * Request registration magic link.
   * @param name - User's name
   * @param email - User's email
   * @param profilePicture - Optional profile picture file
   * @returns Promise resolving when magic link is sent
   * @throws Error if request fails
   * @public
   */
  async register(
    name: string,
    email: string,
    profilePicture?: File
  ): Promise<void> {
    const formData = new FormData();
    formData.append("name", name);
    formData.append("email", email);
    if (profilePicture) {
      formData.append("profilePicture", profilePicture);
    }

    await this.request(API_ENDPOINTS.auth.register, {
      method: "POST",
      body: formData,
    });
  }

  /**
   * Request login magic link.
   * @param email - User's email
   * @returns Promise resolving to response data (includes message and optional cooldown flag)
   * @throws Error if request fails
   * @public
   */
  async login(email: string): Promise<{ message: string; cooldown?: boolean }> {
    const response = await this.request(API_ENDPOINTS.auth.login, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email }),
    });
    return response.json();
  }

  /**
   * Verify magic link token and log user in.
   * @param token - Magic link token from email
   * @returns Promise resolving to object with user data and JWT token
   * @throws Error if verification fails
   * @public
   */
  async verifyMagicLink(token: string): Promise<{
    user: UserData;
    token: string;
  }> {
    const url = `${
      API_ENDPOINTS.auth.verifyMagicLink
    }?token=${encodeURIComponent(token)}`;
    return this.get<{ user: UserData; token: string }>(url);
  }

  /**
   * Get current user information from JWT token.
   * @returns Promise resolving to user data
   * @throws Error if request fails
   * @public
   */
  async getMe(): Promise<UserData> {
    return this.get<UserData>(API_ENDPOINTS.auth.me);
  }

  /**
   * Update user profile.
   * @param name - Updated name
   * @param profilePicture - Optional profile picture file
   * @param removeProfilePicture - Whether to remove the profile picture
   * @returns Promise resolving to updated user data
   * @throws Error if request fails
   * @public
   */
  async updateProfile(
    name: string,
    profilePicture: File | null,
    removeProfilePicture?: boolean
  ): Promise<UserData> {
    const formData = new FormData();
    formData.append("name", name);
    if (profilePicture) {
      formData.append("profilePicture", profilePicture);
    }
    if (removeProfilePicture) {
      formData.append("removeProfilePicture", "true");
    }

    return this.put<UserData>(API_ENDPOINTS.profile.update, formData);
  }

  /**
   * Request email change magic link.
   * @param newEmail - New email address
   * @returns Promise resolving when magic link is sent
   * @throws Error if request fails
   * @public
   */
  async requestEmailChange(newEmail: string): Promise<void> {
    await this.post<void>(`${API_ENDPOINTS.auth.changeEmail}`, {
      email: newEmail,
    });
  }

  /**
   * Delete user account.
   * @returns Promise resolving when account is deleted
   * @throws Error if request fails
   * @public
   */
  async deleteProfile(): Promise<void> {
    await this.delete(API_ENDPOINTS.profile.delete);
  }

  /**
   * Get all trackings for the authenticated user.
   * @returns Promise resolving to array of tracking data
   * @throws Error if request fails
   * @public
   */
  async getTrackings(): Promise<TrackingData[]> {
    return this.get<TrackingData[]>(API_ENDPOINTS.trackings);
  }

  /**
   * Create a new tracking.
   * @param question - The tracking question
   * @param type - The tracking type (true_false or register)
   * @param startTrackingDate - Optional start tracking date (ISO string, defaults to now)
   * @param notes - Optional notes (rich text)
   * @returns Promise resolving to created tracking data
   * @throws Error if request fails
   * @public
   */
  async createTracking(
    question: string,
    type: TrackingType,
    startTrackingDate?: string,
    notes?: string
  ): Promise<TrackingData> {
    return this.post<TrackingData>(API_ENDPOINTS.trackings, {
      question,
      type,
      start_tracking_date: startTrackingDate,
      notes,
    });
  }

  /**
   * Update a tracking.
   * @param trackingId - The tracking ID
   * @param question - Updated question (optional)
   * @param type - Updated type (optional)
   * @param startTrackingDate - Updated start tracking date (optional)
   * @param notes - Updated notes (optional)
   * @returns Promise resolving to updated tracking data
   * @throws Error if request fails
   * @public
   */
  async updateTracking(
    trackingId: number,
    question?: string,
    type?: TrackingType,
    startTrackingDate?: string,
    notes?: string
  ): Promise<TrackingData> {
    return this.put<TrackingData>(`${API_ENDPOINTS.trackings}/${trackingId}`, {
      question,
      type,
      start_tracking_date: startTrackingDate,
      notes,
    });
  }

  /**
   * Delete a tracking.
   * @param trackingId - The tracking ID to delete
   * @returns Promise resolving when tracking is deleted
   * @throws Error if request fails
   * @public
   */
  async deleteTracking(trackingId: number): Promise<void> {
    await this.delete(`${API_ENDPOINTS.trackings}/${trackingId}`);
  }
}
