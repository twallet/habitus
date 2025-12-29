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
    // Small delay to ensure coverage file is written
    setTimeout(() => resolve(), 100);
  });

  vitestProcess.on("error", (error) => {
    console.error("Error running vitest:", error.message);
    vitestExitCode = 1;
    resolve();
  });
});

// Always run the coverage report, regardless of vitest exit code
// Wait a bit longer to ensure coverage file is written
await new Promise((resolve) => setTimeout(resolve, 1000));

// Check for coverage file (may be in different locations)
// Vitest v8 coverage provider writes to coverage/coverage-final.json
const possibleCoverageFiles = [
  join(coverageDir, "coverage-final.json"),
  join(coverageDir, "coverage", "coverage-final.json"),
  join(coverageDir, ".tmp", "coverage-final.json"),
  join(coverageDir, ".tmp", "v8", "coverage-final.json"),
];

// Also check if there's a nested structure
let coverageFile = null;
for (const file of possibleCoverageFiles) {
  if (existsSync(file)) {
    coverageFile = file;
    break;
  }
}

// If still not found, search recursively
if (!coverageFile) {
  const { readdirSync, statSync } = await import("fs");
  function findCoverageFile(dir) {
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        if (entry.isFile() && entry.name === "coverage-final.json") {
          return fullPath;
        }
        if (entry.isDirectory() && !entry.name.startsWith(".")) {
          const found = findCoverageFile(fullPath);
          if (found) return found;
        }
      }
    } catch (err) {
      // Ignore errors
    }
    return null;
  }
  coverageFile = findCoverageFile(coverageDir);
}

// Always run the coverage report script (it will handle missing coverage file gracefully)
if (existsSync(testResultsFile)) {
  try {
    // Pass both test results file and coverage file (if found) as environment variables
    const env = {
      ...process.env,
      FORCE_COLOR: "0",
      COVERAGE_FILE: coverageFile || "",
    };
    execSync(`node config/coverage-report-low.js "${testResultsFile}"`, {
      cwd: workspaceRoot,
      stdio: "inherit",
      shell: true,
      env,
    });
  } catch (reportError) {
    // Coverage report errors shouldn't fail the test run
    // Only log if it's a real error, not just missing coverage
    if (!reportError.message.includes("Coverage file not found")) {
      console.error("Error generating coverage report:", reportError.message);
    }
  }
}

// Exit with the vitest code so test failures are still reported
process.exit(vitestExitCode);
