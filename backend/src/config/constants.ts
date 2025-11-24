/**
 * Application constants and default values.
 * @public
 */

/**
 * Default server port for development.
 * Can be overridden via PORT environment variable.
 */
export const DEFAULT_PORT = 3001;

/**
 * Default frontend URL for development.
 * Can be overridden via FRONTEND_URL or BASE_URL environment variables.
 */
export const getDefaultFrontendUrl = (): string => {
  // Default to port 3001 for frontend URL
  // Can be overridden by FRONTEND_PORT or PORT environment variables
  const port = process.env.FRONTEND_PORT || process.env.PORT || DEFAULT_PORT;
  return `http://localhost:${port}`;
};
