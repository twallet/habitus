/**
 * Wrapper script to run tests with coverage and always show the coverage report.
 * This ensures the coverage report is shown even if tests fail or coverage threshold is not met.
 */

import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const workspaceRoot = join(__dirname, "..");

// Run vitest with coverage
const vitestProcess = spawn(
  "npx",
  ["vitest", "run", "--config", "config/vitest.config.ts", "--coverage"],
  {
    cwd: workspaceRoot,
    stdio: "inherit",
    shell: true,
  }
);

vitestProcess.on("close", (code) => {
  // Always run the coverage report, regardless of vitest exit code
  const coverageReportProcess = spawn(
    "node",
    ["config/coverage-report-low.js"],
    {
      cwd: workspaceRoot,
      stdio: "inherit",
      shell: true,
    }
  );

  coverageReportProcess.on("close", (reportCode) => {
    // Exit with the vitest code (not the report code) so test failures are still reported
    process.exit(code || 0);
  });
});
