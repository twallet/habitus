// Mock for import.meta.env in Jest tests
module.exports = {
  env: {
    VITE_SERVER_URL: "http://localhost",
    VITE_PORT: "3001",
  },
};
