import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

/**
 * Vite configuration for frontend.
 * In development, Vite is used as middleware in Express server, so no proxy is needed.
 * @public
 */
export default defineConfig({
  plugins: [react()],
  logLevel: "warn",
  clearScreen: false,
  // Load .env from project root (parent directory) to unify environment variables
  envDir: path.resolve(__dirname, ".."),
});
