/**
 * Script to display files with branches coverage below 75% threshold.
 * Reads the coverage JSON file and filters files that don't meet the branches coverage threshold.
 */

import { readFileSync } from "fs";
import { join, dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Calculate workspace root (two levels up from config directory)
const workspaceRoot = resolve(__dirname, "..");
const coverageDir = join(workspaceRoot, "coverage");

const THRESHOLD = 75;
const coverageFile = join(coverageDir, "coverage-final.json");

// ANSI color codes
const RED = "\x1b[31m";
const RESET = "\x1b[0m";
const supportsColor = process.stdout.isTTY;

try {
  const coverageData = JSON.parse(readFileSync(coverageFile, "utf-8"));

  const filesBelowThreshold = [];
  let totalStatements = 0;
  let coveredStatements = 0;
  let totalBranches = 0;
  let coveredBranches = 0;
  let totalFunctions = 0;
  let coveredFunctions = 0;
  let totalLines = 0;
  let coveredLines = 0;

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

    // Count statements
    if (coverage.s) {
      for (const count of Object.values(coverage.s)) {
        totalStatements++;
        if (count > 0) coveredStatements++;
      }
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

    // Count functions
    if (coverage.f) {
      for (const count of Object.values(coverage.f)) {
        totalFunctions++;
        if (count > 0) coveredFunctions++;
      }
    }

    // Count lines (from statementMap)
    if (coverage.statementMap && coverage.s) {
      const lineSet = new Set();
      const coveredLineSet = new Set();
      for (const [stmtId, stmt] of Object.entries(coverage.statementMap)) {
        if (stmt && typeof stmt.start === "object" && stmt.start.line) {
          const line = stmt.start.line;
          const numericStmtId = Number(stmtId);
          lineSet.add(line);
          // Check if statement was executed (coverage.s uses numeric keys)
          if (coverage.s[numericStmtId] > 0) {
            coveredLineSet.add(line);
          }
        }
      }
      totalLines += lineSet.size;
      coveredLines += coveredLineSet.size;
    }
  }

  // Calculate global percentages
  const globalStatements =
    totalStatements > 0 ? (coveredStatements / totalStatements) * 100 : 100;
  const globalBranches =
    totalBranches > 0 ? (coveredBranches / totalBranches) * 100 : 100;
  const globalFunctions =
    totalFunctions > 0 ? (coveredFunctions / totalFunctions) * 100 : 100;
  const globalLines = totalLines > 0 ? (coveredLines / totalLines) * 100 : 100;

  // Display global coverage summary
  console.log("\n" + "═".repeat(80));
  console.log("📊 Global Coverage Summary");
  console.log("═".repeat(80));
  console.log(
    `Statements: ${formatGlobalPercent(
      globalStatements
    )} (${coveredStatements}/${totalStatements})`
  );
  console.log(
    `Branches:   ${formatGlobalPercent(
      globalBranches
    )} (${coveredBranches}/${totalBranches})`
  );
  console.log(
    `Functions:  ${formatGlobalPercent(
      globalFunctions
    )} (${coveredFunctions}/${totalFunctions})`
  );
  console.log(
    `Lines:      ${formatGlobalPercent(
      globalLines
    )} (${coveredLines}/${totalLines})`
  );
  console.log("═".repeat(80));

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
 * Calculate coverage percentage from a coverage map.
 * @param {Object|undefined} coverageMap - Coverage map with numeric keys and execution counts as values
 * @returns {number} Coverage percentage
 */
function calculateCoveragePercentage(coverageMap) {
  if (!coverageMap || typeof coverageMap !== "object") {
    return 0;
  }

  const entries = Object.values(coverageMap);
  if (entries.length === 0) {
    return 100; // No coverage data means 100% (file not executed)
  }

  let total = 0;
  let covered = 0;

  for (const count of entries) {
    total++;
    if (count > 0) {
      covered++;
    }
  }

  if (total === 0) {
    return 100; // Nothing to cover
  }

  return Math.round((covered / total) * 100 * 100) / 100;
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
