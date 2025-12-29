/**
 * Wrapper script to run tests with coverage and always show the coverage report.
 * This ensures the coverage report is shown even if tests fail or coverage threshold is not met.
 * Uses execSync with stdio: "inherit" to ensure output is directly visible and capturable.
 * This matches the original working approach that was able to show test outputs.
 */

import { execSync } from "child_process";
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

const testResultsFile = join(coverageDir, "test-results.json");

//console.log("Running tests with coverage...\n");

let vitestExitCode = 0;

try {
  // Run vitest with verbose and JSON reporters
  // JSON reporter will write to the outputFile automatically
  execSync(
    `npx vitest run --config config/vitest.config.ts --coverage --reporter=verbose --reporter=json --outputFile=${testResultsFile}`,
    {
      cwd: workspaceRoot,
      stdio: "inherit", // Direct inheritance - child writes directly to parent's streams
      shell: true, // Required on Windows to find npx in PATH
      env: { ...process.env, FORCE_COLOR: "0" },
    }
  );
} catch (error) {
  // execSync throws on non-zero exit, but output was already displayed via stdio: "inherit"
  vitestExitCode = error.status || 1;
}

// Always run the coverage report, regardless of vitest exit code
// But only if the coverage file exists (tests may have failed before generating coverage)
const coverageFile = join(coverageDir, "coverage-final.json");
if (existsSync(coverageFile)) {
  //console.log("\nGenerating coverage report...\n");

  try {
    execSync(`node config/coverage-report-low.js "${testResultsFile}"`, {
      cwd: workspaceRoot,
      stdio: "inherit", // Direct inheritance for visibility
      shell: true,
      env: { ...process.env, FORCE_COLOR: "0" },
    });
  } catch (reportError) {
    // Coverage report errors shouldn't fail the test run
    console.error("Error generating coverage report:", reportError.message);
  }
} else {
  /*console.log("\n⚠️  Coverage file not found. Skipping coverage report.\n");
  console.log(
    "   (This may happen if tests failed before coverage was generated)\n"
  );*/
}

// Exit with the vitest code so test failures are still reported
process.exit(vitestExitCode);
