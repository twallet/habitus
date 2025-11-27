/**
 * Centralized path configuration for backend.
 * This provides TypeScript-compatible path utilities that can be used throughout the backend codebase.
 *
 * Priority order:
 * 1. Environment variables (PROJECT_ROOT, BACKEND_ROOT)
 * 2. Calculated paths based on file location
 * 3. Fallback to process.cwd() if all else fails
 */

import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

// Get the directory of this file
const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);

// Calculate paths relative to backend/src/config/
// Go up 2 levels to get backend root, then 1 more to get workspace root
const backendRoot = path.resolve(currentDir, "../..");
const workspaceRoot = path.resolve(backendRoot, "..");

/**
 * Get workspace root directory.
 * Uses environment variable if available, otherwise calculates from file location.
 * @returns Absolute path to workspace root
 */
export function getWorkspaceRoot(): string {
  // Priority 1: Use environment variable if set
  if (process.env.PROJECT_ROOT) {
    const root = path.resolve(process.env.PROJECT_ROOT);
    if (fs.existsSync(root)) {
      return root;
    }
    console.warn(
      `PROJECT_ROOT environment variable points to non-existent path: ${root}`
    );
  }

  // Priority 2: Verify calculated root
  const packageJsonPath = path.join(workspaceRoot, "package.json");
  const backendDir = path.join(workspaceRoot, "backend");
  const frontendDir = path.join(workspaceRoot, "frontend");

  if (
    fs.existsSync(packageJsonPath) &&
    fs.existsSync(backendDir) &&
    fs.existsSync(frontendDir)
  ) {
    return workspaceRoot;
  }

  // Priority 3: Fallback to process.cwd() and search upwards
  let currentDir = process.cwd();
  const root = path.parse(currentDir).root;

  while (currentDir !== root) {
    const packageJsonPath = path.join(currentDir, "package.json");
    const backendDir = path.join(currentDir, "backend");
    const frontendDir = path.join(currentDir, "frontend");

    if (
      fs.existsSync(packageJsonPath) &&
      fs.existsSync(backendDir) &&
      fs.existsSync(frontendDir)
    ) {
      return currentDir;
    }
    currentDir = path.dirname(currentDir);
  }

  // Last resort: use calculated root
  return workspaceRoot;
}

/**
 * Get backend root directory.
 * Uses environment variable if available, otherwise calculates from file location.
 * @returns Absolute path to backend directory
 */
export function getBackendRoot(): string {
  // Priority 1: Use environment variable if set
  if (process.env.BACKEND_ROOT) {
    const backendRoot = path.resolve(process.env.BACKEND_ROOT);
    if (fs.existsSync(backendRoot)) {
      return backendRoot;
    }
    console.warn(
      `BACKEND_ROOT environment variable points to non-existent path: ${backendRoot}`
    );
  }

  // Priority 2: Calculate from workspace root
  return path.join(getWorkspaceRoot(), "backend");
}

// Export commonly used paths as constants
export const PATHS = {
  workspaceRoot: getWorkspaceRoot(),
  backendRoot: getBackendRoot(),
  backendSrc: path.join(getBackendRoot(), "src"),
  backendDist: path.join(getBackendRoot(), "dist"),
  backendData: path.join(getBackendRoot(), "data"),
} as const;
