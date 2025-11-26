// Mock for import.meta.env in Jest tests
// Read from environment variables (loaded from .env files), with minimal fallback for tests
module.exports = {
  env: {
    VITE_SERVER_URL: process.env.VITE_SERVER_URL || "http://localhost",
    VITE_PORT: process.env.VITE_PORT || "3005",
  },
};
