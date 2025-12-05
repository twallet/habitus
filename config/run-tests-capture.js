/**
 * Run tests and capture output to a file, then read and display it.
 * This ensures we can see the output even if the terminal tool has limitations.
 */

import { execSync } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import {
  mkdirSync,
  existsSync,
  writeFileSync,
  readFileSync,
  unlinkSync,
} from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const workspaceRoot = join(__dirname, "..");

// Ensure coverage directories exist
const coverageDir = join(workspaceRoot, "coverage");
const coverageTmpDir = join(coverageDir, ".tmp");
if (!existsSync(coverageTmpDir)) {
  mkdirSync(coverageTmpDir, { recursive: true });
}

const outputFile = join(coverageTmpDir, "test-output.txt");

console.log("Running tests and capturing output...\n");

try {
  // Run vitest and capture all output to file
  execSync(
    `npx vitest run --config config/vitest.config.ts --coverage > "${outputFile}" 2>&1`,
    {
      cwd: workspaceRoot,
      shell: true,
      env: { ...process.env, FORCE_COLOR: "0" },
    }
  );

  // Read and display the output
  const output = readFileSync(outputFile, "utf8");
  console.log(output);

  // Clean up
  unlinkSync(outputFile);
} catch (error) {
  // Read output even if command failed
  if (existsSync(outputFile)) {
    const output = readFileSync(outputFile, "utf8");
    console.log(output);
    unlinkSync(outputFile);
  }

  // Always run the coverage report
  try {
    console.log("\nGenerating coverage report...\n");
    const coverageOutput = execSync("node config/coverage-report-low.js", {
      cwd: workspaceRoot,
      encoding: "utf8",
      env: { ...process.env, FORCE_COLOR: "0" },
    });
    console.log(coverageOutput);
  } catch (reportError) {
    if (reportError.stdout) console.log(reportError.stdout);
    if (reportError.stderr) console.error(reportError.stderr);
  }

  process.exit(error.status || 1);
}

// Run coverage report
try {
  console.log("\nGenerating coverage report...\n");
  const coverageOutput = execSync("node config/coverage-report-low.js", {
    cwd: workspaceRoot,
    encoding: "utf8",
    env: { ...process.env, FORCE_COLOR: "0" },
  });
  console.log(coverageOutput);
} catch (reportError) {
  if (reportError.stdout) console.log(reportError.stdout);
  if (reportError.stderr) console.error(reportError.stderr);
}
