/**
 * Script to display files with branches coverage below 75% threshold.
 * Reads the coverage JSON file and filters files that don't meet the branches coverage threshold.
 */

import { readFileSync, existsSync } from "fs";
import { join, dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Calculate workspace root (two levels up from config directory)
const workspaceRoot = resolve(__dirname, "..");
const coverageDir = join(workspaceRoot, "coverage");

const THRESHOLD = 75;
const coverageFile = join(coverageDir, "coverage-final.json");
const testResultsFile =
  process.argv[2] || join(coverageDir, "test-results.json");

// ANSI color codes
const RED = "\x1b[31m";
const RESET = "\x1b[0m";
const supportsColor = process.stdout.isTTY;

try {
  const coverageData = JSON.parse(readFileSync(coverageFile, "utf-8"));

  const filesBelowThreshold = [];
  let totalBranches = 0;
  let coveredBranches = 0;

  // Process each file in the coverage data
  for (const [filePath, coverage] of Object.entries(coverageData)) {
    if (!coverage || typeof coverage !== "object") continue;

    // Calculate branches coverage percentage only
    const branches = calculateBranchPercentage(coverage.b);

    // Check if branches coverage is below threshold
    if (branches < THRESHOLD) {
      filesBelowThreshold.push({
        file: filePath,
        branches,
      });
    }

    // Count branches
    if (coverage.b) {
      for (const branchPaths of Object.values(coverage.b)) {
        if (Array.isArray(branchPaths)) {
          for (const pathCount of branchPaths) {
            totalBranches++;
            if (pathCount > 0) coveredBranches++;
          }
        }
      }
    }
  }

  // Calculate global branches percentage
  const globalBranches =
    totalBranches > 0 ? (coveredBranches / totalBranches) * 100 : 100;

  // Display global branches coverage
  console.log(
    `\n📊 Global Branches Coverage: ${formatGlobalPercent(
      globalBranches
    )} (${coveredBranches}/${totalBranches})`
  );

  // Display failed test suites
  displayFailedTestSuites();

  // Display results
  if (filesBelowThreshold.length === 0) {
    console.log("\n✅ All files meet the 75% branches coverage threshold!\n");
  } else {
    console.log(`\n⚠️  Files with branches coverage below ${THRESHOLD}%:\n`);
    console.log("─".repeat(80));
    console.log("File".padEnd(60) + "Branches");
    console.log("─".repeat(80));

    // Sort by lowest branches coverage first
    filesBelowThreshold.sort((a, b) => a.branches - b.branches);

    for (const file of filesBelowThreshold) {
      const fileDisplay =
        file.file.length > 58 ? "..." + file.file.slice(-55) : file.file;

      const branchesStat = formatPercent(file.branches);

      console.log(fileDisplay.padEnd(60) + branchesStat);
    }

    console.log("─".repeat(80));
    console.log(
      `\nTotal: ${filesBelowThreshold.length} file(s) below branches coverage threshold`
    );
  }
} catch (error) {
  if (error.code === "ENOENT") {
    console.error(`\n❌ Coverage file not found: ${coverageFile}`);
    console.error("Please run tests with coverage first: npm test\n");
  } else {
    console.error(`\n❌ Error reading coverage file: ${error.message}\n`);
  }
  process.exit(1);
}

/**
 * Calculate branch coverage percentage from branch map.
 * Branches in v8 format are arrays where each element represents execution count for a branch path.
 * @param {Object|undefined} branchMap - Branch map with numeric keys and arrays of execution counts as values
 * @returns {number} Branch coverage percentage
 */
function calculateBranchPercentage(branchMap) {
  if (!branchMap || typeof branchMap !== "object") {
    return 0;
  }

  const entries = Object.values(branchMap);
  if (entries.length === 0) {
    return 100; // No coverage data means 100% (file not executed)
  }

  let totalBranches = 0;
  let coveredBranches = 0;

  // Each entry is an array representing different branch paths
  for (const branchPaths of entries) {
    if (!Array.isArray(branchPaths)) {
      continue;
    }

    // Count total branch paths and covered ones
    for (const pathCount of branchPaths) {
      totalBranches++;
      if (pathCount > 0) {
        coveredBranches++;
      }
    }
  }

  if (totalBranches === 0) {
    return 100; // No branches to cover
  }

  return Math.round((coveredBranches / totalBranches) * 100 * 100) / 100;
}

/**
 * Display failed test suites from test results JSON file.
 */
function displayFailedTestSuites() {
  if (!existsSync(testResultsFile)) {
    return; // No test results file available
  }

  try {
    const testResultsData = readFileSync(testResultsFile, "utf-8");
    const testResults = JSON.parse(testResultsData);
    const failedFiles = new Set();

    // Vitest JSON reporter can output different formats
    // Handle array format or object with testFiles property
    const testFiles = Array.isArray(testResults)
      ? testResults
      : testResults?.testFiles || testResults?.files || [];

    // Process test results to find failed test files
    for (const testFile of testFiles) {
      const numFailed =
        testFile.numFailedTests ||
        testFile.numFailingTests ||
        testFile.tasks?.filter((t) => t.result?.state === "fail").length ||
        0;

      if (numFailed > 0) {
        // Extract relative path from workspace root
        const filePath =
          testFile.file ||
          testFile.filepath ||
          testFile.name ||
          testFile.path ||
          "";
        if (filePath) {
          const normalizedWorkspace = workspaceRoot.replace(/\\/g, "/");
          const normalizedPath = filePath.replace(/\\/g, "/");
          let relativePath = normalizedPath;
          if (normalizedPath.startsWith(normalizedWorkspace)) {
            relativePath = normalizedPath.slice(normalizedWorkspace.length + 1);
          }
          if (relativePath) {
            failedFiles.add(relativePath);
          }
        }
      }
    }

    if (failedFiles.size > 0) {
      console.log(`\n❌ Failed Test Suites (${failedFiles.size}):`);
      const sortedFiles = Array.from(failedFiles).sort();
      for (const file of sortedFiles) {
        const displayPath = file.length > 75 ? "..." + file.slice(-72) : file;
        console.log(`   ${displayPath}`);
      }
    }
  } catch (error) {
    // Silently ignore errors reading test results
  }
}

/**
 * Format global percentage with color indicators.
 * @param {number} percent - Percentage value
 * @returns {string} Formatted percentage string with ANSI colors
 */
function formatGlobalPercent(percent) {
  const value = percent.toFixed(2) + "%";
  if (percent < THRESHOLD && supportsColor) {
    return RED + value + RESET;
  }
  return value;
}

/**
 * Format percentage with color indicators.
 * @param {number} percent - Percentage value
 * @returns {string} Formatted percentage string with ANSI colors if below threshold
 */
function formatPercent(percent) {
  const value = percent.toFixed(2) + "%";
  if (percent < THRESHOLD && supportsColor) {
    return RED + value + RESET;
  }
  return value;
}
