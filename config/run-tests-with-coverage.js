/**
 * Wrapper script to run tests with coverage and always show the coverage report.
 * This ensures the coverage report is shown even if tests fail or coverage threshold is not met.
 * Uses spawn to filter out "JSON report written to..." messages from Vitest output.
 */

import { spawn, execSync } from "child_process";
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

// Run vitest with verbose and JSON reporters
// Filter out "JSON report written to..." message
await new Promise((resolve) => {
  const vitestProcess = spawn(
    "npx",
    [
      "vitest",
      "run",
      "--config",
      "config/vitest.config.ts",
      "--coverage",
      "--reporter=verbose",
      "--reporter=json",
      `--outputFile=${testResultsFile}`,
    ],
    {
      cwd: workspaceRoot,
      shell: true, // Required on Windows to find npx in PATH
      env: { ...process.env, FORCE_COLOR: "0" },
      stdio: ["inherit", "pipe", "pipe"],
    }
  );

  // Buffer for incomplete lines
  let stdoutBuffer = "";
  let stderrBuffer = "";

  // Filter stdout to remove "JSON report written to..." messages
  vitestProcess.stdout.on("data", (data) => {
    stdoutBuffer += data.toString();
    const lines = stdoutBuffer.split("\n");
    stdoutBuffer = lines.pop() || ""; // Keep incomplete line in buffer

    for (const line of lines) {
      if (!line.includes("JSON report written to")) {
        process.stdout.write(line + "\n");
      }
    }
  });

  // Filter stderr to remove "JSON report written to..." messages
  vitestProcess.stderr.on("data", (data) => {
    stderrBuffer += data.toString();
    const lines = stderrBuffer.split("\n");
    stderrBuffer = lines.pop() || ""; // Keep incomplete line in buffer

    for (const line of lines) {
      if (!line.includes("JSON report written to")) {
        process.stderr.write(line + "\n");
      }
    }
  });

  // Flush remaining buffers and handle close
  vitestProcess.on("close", (code) => {
    // Flush remaining buffers
    if (stdoutBuffer && !stdoutBuffer.includes("JSON report written to")) {
      process.stdout.write(stdoutBuffer);
    }
    if (stderrBuffer && !stderrBuffer.includes("JSON report written to")) {
      process.stderr.write(stderrBuffer);
    }
    vitestExitCode = code || 0;
    resolve();
  });

  vitestProcess.on("error", (error) => {
    console.error("Error running vitest:", error.message);
    vitestExitCode = 1;
    resolve();
  });
});

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
