/**
 * Application constants and default values.
 * @public
 */

/**
 * Server port used by the application.
 * Reads from PORT environment variable (required, no default).
 * @public
 */
export const PORT = ((): number => {
  const port = process.env.PORT;
  if (!port) {
    throw new Error(
      "PORT environment variable is required. Please set it in your .env file."
    );
  }
  const parsedPort = parseInt(port, 10);
  if (isNaN(parsedPort) || parsedPort <= 0) {
    throw new Error(
      `Invalid PORT value: ${port}. PORT must be a positive number.`
    );
  }
  return parsedPort;
})();

/**
 * Base URL for the server (used for constructing absolute URLs).
 * Reads from SERVER_URL environment variable (required, no default).
 * @public
 */
export const SERVER_URL = ((): string => {
  const url = process.env.SERVER_URL;
  if (!url) {
    throw new Error(
      "SERVER_URL environment variable is required. Please set it in your .env file."
    );
  }
  return url;
})();
