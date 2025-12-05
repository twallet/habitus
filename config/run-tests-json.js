/**
 * Run tests with JSON reporter and format the output for visibility.
 * This approach captures structured test results that can be reliably displayed.
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

console.log("Running tests with JSON reporter...\n");

try {
  // Run vitest with JSON reporter - this should be more reliably capturable
  const output = execSync(
    "npx vitest run --config config/vitest.config.ts --reporter=json --reporter=verbose",
    {
      cwd: workspaceRoot,
      encoding: "utf8",
      env: { ...process.env, FORCE_COLOR: "0" },
      maxBuffer: 50 * 1024 * 1024,
    }
  );

  // Output the verbose reporter output (which should be in stderr for JSON mode)
  console.log(output);
} catch (error) {
  // execSync throws on non-zero exit, but output is available
  if (error.stdout) {
    console.log(error.stdout);
  }
  if (error.stderr) {
    // stderr contains the verbose output when using JSON reporter
    console.error(error.stderr);
  }

  // Try to parse JSON if available
  try {
    const jsonOutput = error.stdout || error.stderr;
    const jsonMatch = jsonOutput.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const results = JSON.parse(jsonMatch[0]);
      console.log("\n=== Test Results Summary ===");
      console.log(`Total: ${results.numTotalTests || 0}`);
      console.log(`Passed: ${results.numPassedTests || 0}`);
      console.log(`Failed: ${results.numFailedTests || 0}`);
      console.log(`Skipped: ${results.numSkippedTests || 0}`);

      if (results.testResults && results.testResults.length > 0) {
        console.log("\n=== Failed Tests ===");
        results.testResults.forEach((testFile) => {
          if (testFile.status === "failed") {
            console.log(`\n${testFile.name}:`);
            testFile.assertionResults?.forEach((test) => {
              if (test.status === "failed") {
                console.log(`  ✗ ${test.fullName || test.title}`);
                if (test.failureMessages && test.failureMessages.length > 0) {
                  test.failureMessages.forEach((msg) => {
                    console.log(`    ${msg.split("\n").join("\n    ")}`);
                  });
                }
              }
            });
          }
        });
      }
    }
  } catch (parseError) {
    // JSON parsing failed, just show raw output
  }

  process.exit(error.status || 1);
}
