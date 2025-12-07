/**
 * Authentication token storage key.
 * @private
 */
const TOKEN_KEY = "habitus_token";

/**
 * Event name for token change events.
 * @private
 */
const TOKEN_CHANGE_EVENT = "habitus_token_change";

/**
 * Class for centralized token management.
 * Handles localStorage operations, token change detection, and events.
 * Uses polling and storage events to detect token changes across tabs.
 * @public
 */
export class TokenManager {
  private currentToken: string | null;
  private pollInterval: NodeJS.Timeout | null = null;
  private readonly pollIntervalMs: number = 500;
  private listeners: Set<(token: string | null) => void> = new Set();

  /**
   * Create a new TokenManager instance.
   * @public
   */
  constructor() {
    this.currentToken = localStorage.getItem(TOKEN_KEY);
    this.setupStorageListener();
  }

  /**
   * Get the current token from localStorage.
   * @returns Current token or null if not found
   * @public
   */
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  /**
   * Set the token in localStorage.
   * Triggers token change event if token actually changed.
   * @param token - Token to set (or null to remove)
   * @public
   */
  setToken(token: string | null): void {
    const previousToken = this.currentToken;

    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }

    this.currentToken = token;

    // Trigger change event if token actually changed
    if (previousToken !== token) {
      this.notifyListeners(token);
      this.dispatchTokenChangeEvent(token);
    }
  }

  /**
   * Remove the token from localStorage.
   * @public
   */
  removeToken(): void {
    this.setToken(null);
  }

  /**
   * Check if a token exists.
   * @returns True if token exists
   * @public
   */
  hasToken(): boolean {
    return this.getToken() !== null;
  }

  /**
   * Register a listener for token changes.
   * Listener will be called whenever the token changes.
   * @param listener - Callback function to call on token change
   * @returns Unsubscribe function
   * @public
   */
  onTokenChange(listener: (token: string | null) => void): () => void {
    this.listeners.add(listener);

    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Start polling for token changes.
   * Useful for detecting changes in the same tab.
   * @param onTokenChange - Callback function to call when token changes
   * @returns Stop polling function
   * @public
   */
  startPolling(onTokenChange: (token: string | null) => void): () => void {
    // Clear any existing interval
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }

    // Check for token changes periodically
    this.pollInterval = setInterval(() => {
      const token = this.getToken();
      if (token !== this.currentToken) {
        this.currentToken = token;
        onTokenChange(token);
      }
    }, this.pollIntervalMs);

    // Return stop function
    return () => {
      if (this.pollInterval) {
        clearInterval(this.pollInterval);
        this.pollInterval = null;
      }
    };
  }

  /**
   * Stop polling for token changes.
   * @public
   */
  stopPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  /**
   * Reset the manager state.
   * Useful for testing.
   * @internal
   */
  reset(): void {
    this.stopPolling();
    this.currentToken = localStorage.getItem(TOKEN_KEY);
    this.listeners.clear();
  }

  /**
   * Setup storage event listener for cross-tab token changes.
   * @private
   */
  private setupStorageListener(): void {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === TOKEN_KEY) {
        const newToken = e.newValue;
        if (newToken !== this.currentToken) {
          this.currentToken = newToken;
          this.notifyListeners(newToken);
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);
  }

  /**
   * Notify all registered listeners of token change.
   * @param token - New token value
   * @private
   */
  private notifyListeners(token: string | null): void {
    for (const listener of this.listeners) {
      try {
        listener(token);
      } catch (error) {
        console.error("Error in token change listener:", error);
      }
    }
  }

  /**
   * Dispatch custom token change event.
   * @param token - New token value
   * @private
   */
  private dispatchTokenChangeEvent(token: string | null): void {
    window.dispatchEvent(
      new CustomEvent(TOKEN_CHANGE_EVENT, { detail: { token } })
    );
  }
}

/**
 * Global TokenManager instance.
 * @public
 */
export const tokenManager = new TokenManager();
