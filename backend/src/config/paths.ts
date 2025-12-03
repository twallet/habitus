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
 * Path configuration utility class.
 * Provides methods to access project paths from environment variables.
 * @public
 */
type PathsType = {
  readonly workspaceRoot: string;
  readonly backendRoot: string;
  readonly backendSrc: string;
  readonly backendDist: string;
  readonly backendData: string;
};

export class PathConfig {
  private static cachedWorkspaceRoot: string | null = null;
  private static cachedBackendRoot: string | null = null;
  private static cachedPaths: PathsType | null = null;

  /**
   * Get workspace root directory from PROJECT_ROOT environment variable.
   * @returns Absolute path to workspace root
   * @throws Error if PROJECT_ROOT is not set or points to non-existent path
   * @public
   */
  static getWorkspaceRoot(): string {
    if (this.cachedWorkspaceRoot === null) {
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

      this.cachedWorkspaceRoot = root;
    }
    return this.cachedWorkspaceRoot;
  }

  /**
   * Get backend root directory.
   * Constructed as absolute path from PROJECT_ROOT.
   * @returns Absolute path to backend directory
   * @public
   */
  static getBackendRoot(): string {
    if (this.cachedBackendRoot === null) {
      this.cachedBackendRoot = path.join(this.getWorkspaceRoot(), "backend");
    }
    return this.cachedBackendRoot;
  }

  /**
   * Get commonly used paths.
   * This method ensures lazy evaluation after environment variables are loaded.
   * @returns Object with commonly used paths
   * @public
   */
  static getPaths(): PathsType {
    if (this.cachedPaths === null) {
      this.cachedPaths = {
        workspaceRoot: this.getWorkspaceRoot(),
        backendRoot: this.getBackendRoot(),
        backendSrc: path.join(this.getBackendRoot(), "src"),
        backendDist: path.join(this.getBackendRoot(), "dist"),
        backendData: path.join(this.getBackendRoot(), "data"),
      } as const;
    }
    return this.cachedPaths;
  }
}
