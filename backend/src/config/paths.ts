/**
 * Centralized path configuration for backend.
 * This provides TypeScript-compatible path utilities that can be used throughout the backend codebase.
 *
 * All paths are constructed as absolute paths from PROJECT_ROOT environment variable.
 * PROJECT_ROOT must be defined in config/.env file.
 */

import path from "path";
import fs from "fs";

/**
 * Get workspace root directory from PROJECT_ROOT environment variable.
 * @returns Absolute path to workspace root
 * @throws Error if PROJECT_ROOT is not set or points to non-existent path
 */
export function getWorkspaceRoot(): string {
  if (!process.env.PROJECT_ROOT) {
    throw new Error(
      "PROJECT_ROOT environment variable is required. Please set it in config/.env file."
    );
  }

  const root = path.resolve(process.env.PROJECT_ROOT);

  if (!fs.existsSync(root)) {
    throw new Error(
      `PROJECT_ROOT environment variable points to non-existent path: ${root}`
    );
  }

  return root;
}

/**
 * Get backend root directory.
 * Constructed as absolute path from PROJECT_ROOT.
 * @returns Absolute path to backend directory
 */
export function getBackendRoot(): string {
  return path.join(getWorkspaceRoot(), "backend");
}

/**
 * Get commonly used paths.
 * This is a function to ensure lazy evaluation after environment variables are loaded.
 * @returns Object with commonly used paths
 */
export function getPaths() {
  return {
    workspaceRoot: getWorkspaceRoot(),
    backendRoot: getBackendRoot(),
    backendSrc: path.join(getBackendRoot(), "src"),
    backendDist: path.join(getBackendRoot(), "dist"),
    backendData: path.join(getBackendRoot(), "data"),
  } as const;
}

/**
 * Export commonly used paths as a constant.
 * Note: This is evaluated lazily via getter to ensure environment variables are loaded first.
 * @deprecated Use getPaths() function instead for better control over when paths are evaluated.
 */
export const PATHS = new Proxy({} as ReturnType<typeof getPaths>, {
  get(_target, prop) {
    return getPaths()[prop as keyof ReturnType<typeof getPaths>];
  },
});
