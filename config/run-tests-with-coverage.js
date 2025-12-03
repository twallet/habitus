/**
 * Wrapper script to run tests with coverage and always show the coverage report.
 * This ensures the coverage report is shown even if tests fail or coverage threshold is not met.
 */

import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { mkdirSync, existsSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const workspaceRoot = join(__dirname, "..");

// Ensure coverage directories exist
const coverageDir = join(workspaceRoot, "coverage");
const coverageTmpDir = join(coverageDir, ".tmp");
if (!existsSync(coverageTmpDir)) {
  mkdirSync(coverageTmpDir, { recursive: true });
}

// Run vitest with coverage
// Use command string format with shell: true to avoid deprecation warning
// This format doesn't trigger the security warning about unescaped arguments
const vitestProcess = spawn(
  "npx vitest run --config config/vitest.config.ts --coverage",
  {
    cwd: workspaceRoot,
    stdio: "inherit",
    shell: true,
  }
);

vitestProcess.on("close", (code) => {
  // Always run the coverage report, regardless of vitest exit code
  const coverageReportProcess = spawn("node config/coverage-report-low.js", {
    cwd: workspaceRoot,
    stdio: "inherit",
    shell: true,
  });

  coverageReportProcess.on("close", (reportCode) => {
    // Exit with the vitest code (not the report code) so test failures are still reported
    process.exit(code || 0);
  });
});
