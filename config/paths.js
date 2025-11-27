/**
 * Centralized path configuration for the entire project.
 * This is the single source of truth for all directory paths.
 *
 * All paths are constructed as absolute paths from PROJECT_ROOT environment variable.
 * PROJECT_ROOT must be defined in config/.env file.
 */

const path = require("path");
const fs = require("fs");

// Get the directory where this config file is located
const configDir = __dirname;

/**
 * Get the workspace root directory from PROJECT_ROOT environment variable.
 * @returns {string} Absolute path to workspace root
 * @throws {Error} If PROJECT_ROOT is not set or points to non-existent path
 */
function getWorkspaceRoot() {
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
 * Get the backend root directory.
 * Constructed as absolute path from PROJECT_ROOT.
 * @returns {string} Absolute path to backend directory
 */
function getBackendRoot() {
  return path.join(getWorkspaceRoot(), "backend");
}

/**
 * Get the frontend root directory.
 * Constructed as absolute path from PROJECT_ROOT.
 * @returns {string} Absolute path to frontend directory
 */
function getFrontendRoot() {
  return path.join(getWorkspaceRoot(), "frontend");
}

// Calculate and export paths
const workspaceRoot = getWorkspaceRoot();
const backendRoot = getBackendRoot();
const frontendRoot = getFrontendRoot();

module.exports = {
  // Root directories
  workspaceRoot,
  backendRoot,
  frontendRoot,
  configDir,

  // Helper functions (in case paths need to be recalculated)
  getWorkspaceRoot,
  getBackendRoot,
  getFrontendRoot,

  // Common subdirectories (for convenience)
  backendSrc: path.join(backendRoot, "src"),
  backendDist: path.join(backendRoot, "dist"),
  backendData: path.join(backendRoot, "data"),
  frontendSrc: path.join(frontendRoot, "src"),
  frontendDist: path.join(frontendRoot, "dist"),

  // Config files
  backendTsconfig: path.join(backendRoot, "tsconfig.json"),
  frontendTsconfig: path.join(frontendRoot, "tsconfig.json"),
  backendSetupTests: path.join(backendRoot, "src", "setup", "setupTests.ts"),
  frontendSetupTests: path.join(frontendRoot, "src", "setupTests.ts"),

  // Coverage directory
  coverageDir: path.join(workspaceRoot, "coverage"),
};
