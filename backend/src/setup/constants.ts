/**
 * Application constants and default values.
 * @public
 */

/**
 * Get server port from environment variable (lazy loading).
 * @returns Server port number
 * @throws Error if VITE_PORT is not set or invalid
 * @public
 */
export function getPort(): number {
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
  return parsedPort;
}

/**
 * Get base URL for the server from environment variable (lazy loading).
 * Used for constructing absolute URLs.
 * @returns Server base URL
 * @throws Error if VITE_SERVER_URL is not set
 * @public
 */
export function getServerUrl(): string {
  const url = process.env.VITE_SERVER_URL;
  if (!url) {
    throw new Error(
      "VITE_SERVER_URL environment variable is required. Please set it in your .env file."
    );
  }
  return url;
}
