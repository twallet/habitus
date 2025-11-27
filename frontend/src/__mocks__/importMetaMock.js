// Mock for import.meta.env in Jest tests
// Tests will fail if VITE_SERVER_URL or VITE_PORT are not set in environment
if (!process.env.VITE_SERVER_URL) {
  throw new Error(
    "VITE_SERVER_URL environment variable is required for tests. Please set it in your .env file or test environment."
  );
}
if (!process.env.VITE_PORT) {
  throw new Error(
    "VITE_PORT environment variable is required for tests. Please set it in your .env file or test environment."
  );
}
module.exports = {
  env: {
    VITE_SERVER_URL: process.env.VITE_SERVER_URL,
    VITE_PORT: process.env.VITE_PORT,
  },
};
