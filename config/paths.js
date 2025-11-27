/**
 * Centralized path configuration for the entire project.
 * This is the single source of truth for all directory paths.
 *
 * Priority order:
 * 1. Environment variables (PROJECT_ROOT, BACKEND_ROOT, FRONTEND_ROOT)
 * 2. Calculated paths based on config file location
 * 3. Fallback to process.cwd() if all else fails
 */

const path = require("path");
const fs = require("fs");

// Get the directory where this config file is located
const configDir = __dirname;

/**
 * Get the workspace root directory.
 * @returns {string} Absolute path to workspace root
 */
function getWorkspaceRoot() {
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

  // Priority 2: Calculate from config file location (config/ is one level below root)
  const calculatedRoot = path.resolve(configDir, "..");

  // Verify it's the workspace root by checking for package.json and backend/frontend dirs
  const packageJsonPath = path.join(calculatedRoot, "package.json");
  const backendDir = path.join(calculatedRoot, "backend");
  const frontendDir = path.join(calculatedRoot, "frontend");

  if (
    fs.existsSync(packageJsonPath) &&
    fs.existsSync(backendDir) &&
    fs.existsSync(frontendDir)
  ) {
    return calculatedRoot;
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

  // Last resort: use calculated root even if verification failed
  return calculatedRoot;
}

/**
 * Get the backend root directory.
 * @returns {string} Absolute path to backend directory
 */
function getBackendRoot() {
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

/**
 * Get the frontend root directory.
 * @returns {string} Absolute path to frontend directory
 */
function getFrontendRoot() {
  // Priority 1: Use environment variable if set
  if (process.env.FRONTEND_ROOT) {
    const frontendRoot = path.resolve(process.env.FRONTEND_ROOT);
    if (fs.existsSync(frontendRoot)) {
      return frontendRoot;
    }
    console.warn(
      `FRONTEND_ROOT environment variable points to non-existent path: ${frontendRoot}`
    );
  }

  // Priority 2: Calculate from workspace root
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
