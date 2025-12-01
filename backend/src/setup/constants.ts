/**
 * Application constants and default values.
 * @public
 */

/**
 * Server configuration utility class.
 * Provides methods to access server configuration from environment variables.
 * @public
 */
export class ServerConfig {
  private static cachedPort: number | null = null;
  private static cachedServerUrl: string | null = null;

  /**
   * Get server port from environment variable (lazy loading with caching).
   * @returns Server port number
   * @throws Error if VITE_PORT is not set or invalid
   * @public
   */
  static getPort(): number {
    if (this.cachedPort === null) {
      const port = process.env.VITE_PORT;
      if (!port) {
        throw new Error(
          "VITE_PORT environment variable is required. Please set it in your .env file."
        );
      }
      const parsedPort = parseInt(port, 10);
      if (isNaN(parsedPort) || parsedPort <= 0) {
        throw new Error(
          `Invalid VITE_PORT value: ${port}. VITE_PORT must be a positive number.`
        );
      }
      this.cachedPort = parsedPort;
    }
    return this.cachedPort;
  }

  /**
   * Get base URL for the server from environment variable (lazy loading with caching).
   * Used for constructing absolute URLs.
   * @returns Server base URL
   * @throws Error if VITE_SERVER_URL is not set
   * @public
   */
  static getServerUrl(): string {
    if (this.cachedServerUrl === null) {
      const url = process.env.VITE_SERVER_URL;
      if (!url) {
        throw new Error(
          "VITE_SERVER_URL environment variable is required. Please set it in your .env file."
        );
      }
      this.cachedServerUrl = url;
    }
    return this.cachedServerUrl;
  }
}

/**
 * AI Service constants.
 * These are non-secret configuration values used by the AI service.
 * @public
 */

/**
 * Default model name for Perplexity API.
 * Used when PERPLEXITY_MODEL environment variable is not set.
 * @public
 */
export const PERPLEXITY_DEFAULT_MODEL = "sonar";

/**
 * Perplexity API endpoint URL.
 * @public
 */
export const PERPLEXITY_API_URL = "https://api.perplexity.ai/chat/completions";

/**
 * Default fallback emoji used when AI emoji suggestion fails.
 * @public
 */
export const AI_DEFAULT_EMOJI = "📝";
