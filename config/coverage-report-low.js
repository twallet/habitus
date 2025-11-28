/**
 * Script to display files with coverage below 75% threshold.
 * Reads the coverage JSON file and filters files that don't meet the threshold.
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

// ANSI color codes
const RED = "\x1b[31m";
const RESET = "\x1b[0m";
const supportsColor = process.stdout.isTTY;

try {
  const coverageData = JSON.parse(readFileSync(coverageFile, "utf-8"));

  const filesBelowThreshold = [];

  // Process each file in the coverage data
  for (const [filePath, coverage] of Object.entries(coverageData)) {
    if (!coverage || typeof coverage !== "object") continue;

    // Calculate coverage percentages
    const statements = calculatePercentage(coverage.s);
    const branches = calculateBranchPercentage(coverage.b);
    const functions = calculatePercentage(coverage.f);
    // Lines coverage is calculated from statements in v8 coverage format
    const lines = statements; // Use statements as proxy for lines

    // Check if any metric is below threshold
    if (
      statements < THRESHOLD ||
      branches < THRESHOLD ||
      functions < THRESHOLD ||
      lines < THRESHOLD
    ) {
      filesBelowThreshold.push({
        file: filePath,
        statements,
        branches,
        functions,
        lines,
      });
    }
  }

  // Display results
  if (filesBelowThreshold.length === 0) {
    console.log("\n✅ All files meet the 75% coverage threshold!\n");
  } else {
    console.log(`\n⚠️  Files with coverage below ${THRESHOLD}%:\n`);
    console.log("─".repeat(100));
    console.log(
      "File".padEnd(60) +
        "Statements".padEnd(12) +
        "Branches".padEnd(12) +
        "Functions".padEnd(12) +
        "Lines"
    );
    console.log("─".repeat(100));

    // Sort by lowest coverage first
    filesBelowThreshold.sort((a, b) => {
      const aMin = Math.min(a.statements, a.branches, a.functions, a.lines);
      const bMin = Math.min(b.statements, b.branches, b.functions, b.lines);
      return aMin - bMin;
    });

    for (const file of filesBelowThreshold) {
      const fileDisplay =
        file.file.length > 58 ? "..." + file.file.slice(-55) : file.file;

      const stats = [
        formatPercent(file.statements),
        formatPercent(file.branches),
        formatPercent(file.functions),
        formatPercent(file.lines),
      ];

      // Calculate padding considering ANSI codes don't add to string length
      const statsPadded = stats.map((stat) => {
        // Remove ANSI codes for length calculation
        const cleanStat = stat.replace(/\x1b\[[0-9;]*m/g, "");
        const padding = 12 - cleanStat.length;
        return stat + " ".repeat(Math.max(0, padding));
      });

      console.log(
        fileDisplay.padEnd(60) +
          statsPadded[0] +
          statsPadded[1] +
          statsPadded[2] +
          statsPadded[3]
      );
    }

    console.log("─".repeat(100));
    console.log(
      `\nTotal: ${filesBelowThreshold.length} file(s) below threshold`
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
 * Calculate coverage percentage from coverage map.
 * @param {Object|undefined} coverageMap - Coverage map with numeric keys and execution counts as values
 * @returns {number} Coverage percentage
 */
function calculatePercentage(coverageMap) {
  if (!coverageMap || typeof coverageMap !== "object") {
    return 0;
  }

  const entries = Object.values(coverageMap);
  if (entries.length === 0) {
    return 100; // No coverage data means 100% (file not executed)
  }

  // Count how many entries have been executed (value > 0)
  const covered = entries.filter((count) => count > 0).length;
  return Math.round((covered / entries.length) * 100 * 100) / 100;
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
