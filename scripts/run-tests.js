/**
 * Test runner script that filters out the "Force exiting Jest" warning message
 * Adds colors to test output for better readability
 */
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { writeFileSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, "..");

let fullOutput = "";

// Coverage table buffer
let coverageTableBuffer = [];
let inCoverageTable = false;
let coverageTableHeader = null;
let coverageTableSeparator = null;

// ANSI color codes
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  bright: "\x1b[1m",
};

/**
 * Colorize a line based on its content
 */
function colorizeLine(line) {
  // PASS in green
  if (line.includes("PASS ")) {
    return colors.green + line + colors.reset;
  }
  // FAIL in red
  if (line.includes("FAIL ")) {
    return colors.red + line + colors.reset;
  }
  // Coverage percentages - color based on value
  const coverageMatch = line.match(
    /\|\s+(\d+\.?\d*)\s+\|\s+(\d+\.?\d*)\s+\|\s+(\d+\.?\d*)\s+\|\s+(\d+\.?\d*)\s+\|/
  );
  if (coverageMatch) {
    const [, stmts, branch, funcs, lines] = coverageMatch;
    const values = [
      parseFloat(stmts),
      parseFloat(branch),
      parseFloat(funcs),
      parseFloat(lines),
    ];
    let coloredLine = line;

    // Color each percentage by replacing in the specific column positions
    const parts = line.split("|");
    if (parts.length >= 5) {
      const getColor = (val) =>
        val >= 80 ? colors.green : val >= 60 ? colors.yellow : colors.red;

      // Color each percentage column
      parts[1] = parts[1].replace(
        stmts,
        getColor(parseFloat(stmts)) + stmts + colors.reset
      );
      parts[2] = parts[2].replace(
        branch,
        getColor(parseFloat(branch)) + branch + colors.reset
      );
      parts[3] = parts[3].replace(
        funcs,
        getColor(parseFloat(funcs)) + funcs + colors.reset
      );
      parts[4] = parts[4].replace(
        lines,
        getColor(parseFloat(lines)) + lines + colors.reset
      );

      coloredLine = parts.join("|");
    }

    return coloredLine;
  }
  // Coverage summary line with percentages
  const summaryMatch = line.match(
    /All files\s+\|\s+(\d+\.?\d*)\s+\|\s+(\d+\.?\d*)\s+\|\s+(\d+\.?\d*)\s+\|\s+(\d+\.?\d*)\s+\|/
  );
  if (summaryMatch) {
    const [, stmts, branch, funcs, lines] = summaryMatch;
    const values = [
      parseFloat(stmts),
      parseFloat(branch),
      parseFloat(funcs),
      parseFloat(lines),
    ];
    let coloredLine = line;

    // Color each percentage in the summary line
    const parts = line.split("|");
    if (parts.length >= 5) {
      const getColor = (val) =>
        val >= 80 ? colors.green : val >= 60 ? colors.yellow : colors.red;

      // Color each percentage column
      parts[1] = parts[1].replace(
        stmts,
        getColor(parseFloat(stmts)) + stmts + colors.reset
      );
      parts[2] = parts[2].replace(
        branch,
        getColor(parseFloat(branch)) + branch + colors.reset
      );
      parts[3] = parts[3].replace(
        funcs,
        getColor(parseFloat(funcs)) + funcs + colors.reset
      );
      parts[4] = parts[4].replace(
        lines,
        getColor(parseFloat(lines)) + lines + colors.reset
      );

      coloredLine = parts.join("|");
    }

    return coloredLine;
  }
  // Test summary lines
  if (line.includes("Test Suites:")) {
    if (line.includes("failed")) {
      return colors.red + line + colors.reset;
    }
    return colors.green + line + colors.reset;
  }
  if (line.includes("Tests:")) {
    if (line.includes("failed")) {
      return colors.red + line + colors.reset;
    }
    return colors.green + line + colors.reset;
  }
  // Coverage threshold warnings in red
  if (line.includes("coverage threshold") || line.includes("not met")) {
    return colors.red + colors.bright + line + colors.reset;
  }
  // Table headers in cyan
  if (line.includes("File") && line.includes("% Stmts")) {
    return colors.cyan + colors.bright + line + colors.reset;
  }
  // Separator lines
  if (line.match(/^-+\|/)) {
    return colors.cyan + line + colors.reset;
  }

  return line;
}

/**
 * Check if a line is part of the coverage table
 */
function isCoverageTableLine(line) {
  // Header line
  if (line.includes("File") && line.includes("% Stmts")) {
    return "header";
  }
  // Separator line
  if (line.match(/^-+\|/)) {
    return "separator";
  }
  // "All files" summary line
  if (line.match(/All files\s+\|/)) {
    return "all-files";
  }
  // Regular file row (has percentages)
  if (
    line.match(
      /\|\s+(\d+\.?\d*)\s+\|\s+(\d+\.?\d*)\s+\|\s+(\d+\.?\d*)\s+\|\s+(\d+\.?\d*)\s+\|/
    )
  ) {
    return "file-row";
  }
  return false;
}

/**
 * Process and output buffered coverage table with "All files" at the end
 */
function outputCoverageTable() {
  // Separate lines by type
  const header = coverageTableHeader;
  const separator = coverageTableSeparator;
  const allFilesLine = coverageTableBuffer.find(
    (item) => item.type === "all-files"
  );
  const fileRows = coverageTableBuffer.filter(
    (item) => item.type === "file-row"
  );

  // Only output if we have at least a header or some content
  if (!header && coverageTableBuffer.length === 0) return;

  // Output in order: header, separator, file rows, "All files"
  if (header) {
    const coloredLine = colorizeLine(header.line);
    process.stdout.write(coloredLine + "\n");
    fullOutput += header.line + "\n";
  }
  if (separator) {
    const coloredLine = colorizeLine(separator.line);
    process.stdout.write(coloredLine + "\n");
    fullOutput += separator.line + "\n";
  }
  // Output file rows
  fileRows.forEach((item) => {
    const coloredLine = colorizeLine(item.line);
    process.stdout.write(coloredLine + "\n");
    fullOutput += item.line + "\n";
  });
  // Output "All files" at the end
  if (allFilesLine) {
    const coloredLine = colorizeLine(allFilesLine.line);
    process.stdout.write(coloredLine + "\n");
    fullOutput += allFilesLine.line + "\n";
  }

  // Reset buffer
  coverageTableBuffer = [];
  coverageTableHeader = null;
  coverageTableSeparator = null;
  inCoverageTable = false;
}

// Get all arguments passed to this script (skip node and script path)
const jestArgs = [
  "jest",
  "--config",
  "config/jest.config.cjs",
  ...process.argv.slice(2),
];
if (!jestArgs.includes("--forceExit")) {
  jestArgs.push("--forceExit");
}

// Use npx to run jest (works cross-platform)
const jestProcess = spawn("npx", jestArgs, {
  stdio: ["inherit", "pipe", "pipe"],
  shell: true,
  cwd: rootDir,
});

let stdoutBuffer = "";
let stderrBuffer = "";

jestProcess.stdout.on("data", (data) => {
  stdoutBuffer += data.toString();
  const lines = stdoutBuffer.split("\n");
  stdoutBuffer = lines.pop() || ""; // Keep incomplete line in buffer

  lines.forEach((line) => {
    if (
      line.trim() &&
      !line.includes("Force exiting Jest") &&
      !line.includes("DEP0190")
    ) {
      const tableLineType = isCoverageTableLine(line);

      if (tableLineType) {
        // We're in a coverage table
        if (tableLineType === "header") {
          // Start of new table - output previous table if any
          if (inCoverageTable) {
            outputCoverageTable();
          }
          inCoverageTable = true;
          coverageTableHeader = { line, type: "header" };
        } else if (tableLineType === "separator") {
          coverageTableSeparator = { line, type: "separator" };
        } else {
          // "All files" or file row
          coverageTableBuffer.push({ line, type: tableLineType });
        }
      } else {
        // Not a table line
        if (inCoverageTable) {
          // End of table - output buffered table
          outputCoverageTable();
        }
        // Output regular line
        const coloredLine = colorizeLine(line);
        const outputLine = coloredLine + "\n";
        process.stdout.write(outputLine);
        fullOutput += line + "\n"; // Store original without colors
      }
    } else if (!line.trim() && inCoverageTable) {
      // Empty line might indicate end of table
      // But wait for next non-empty line to confirm
    }
  });
});

jestProcess.stderr.on("data", (data) => {
  stderrBuffer += data.toString();
  const lines = stderrBuffer.split("\n");
  stderrBuffer = lines.pop() || ""; // Keep incomplete line in buffer

  lines.forEach((line) => {
    if (
      line.trim() &&
      !line.includes("Force exiting Jest") &&
      !line.includes("DEP0190")
    ) {
      const tableLineType = isCoverageTableLine(line);

      if (tableLineType) {
        // We're in a coverage table
        if (tableLineType === "header") {
          // Start of new table - output previous table if any
          if (inCoverageTable) {
            outputCoverageTable();
          }
          inCoverageTable = true;
          coverageTableHeader = { line, type: "header" };
        } else if (tableLineType === "separator") {
          coverageTableSeparator = { line, type: "separator" };
        } else {
          // "All files" or file row
          coverageTableBuffer.push({ line, type: tableLineType });
        }
      } else {
        // Not a table line
        if (inCoverageTable) {
          // End of table - output buffered table
          outputCoverageTable();
        }
        // Output regular line
        const coloredLine = colorizeLine(line);
        const outputLine = coloredLine + "\n";
        process.stderr.write(outputLine);
        fullOutput += line + "\n"; // Store original without colors
      }
    } else if (!line.trim() && inCoverageTable) {
      // Empty line might indicate end of table
      // But wait for next non-empty line to confirm
    }
  });
});

jestProcess.on("close", (code) => {
  // Flush any remaining coverage table
  if (inCoverageTable) {
    outputCoverageTable();
  }

  // Flush remaining buffers
  if (
    stdoutBuffer.trim() &&
    !stdoutBuffer.includes("Force exiting Jest") &&
    !stdoutBuffer.includes("DEP0190")
  ) {
    const tableLineType = isCoverageTableLine(stdoutBuffer);
    if (tableLineType) {
      // Handle as table line
      if (tableLineType === "header") {
        coverageTableHeader = { line: stdoutBuffer, type: "header" };
        inCoverageTable = true;
      } else if (tableLineType === "separator") {
        coverageTableSeparator = { line: stdoutBuffer, type: "separator" };
      } else {
        coverageTableBuffer.push({ line: stdoutBuffer, type: tableLineType });
      }
      if (inCoverageTable) {
        outputCoverageTable();
      }
    } else {
      const coloredBuffer = colorizeLine(stdoutBuffer);
      process.stdout.write(coloredBuffer);
      fullOutput += stdoutBuffer;
    }
  }
  if (
    stderrBuffer.trim() &&
    !stderrBuffer.includes("Force exiting Jest") &&
    !stderrBuffer.includes("DEP0190")
  ) {
    const tableLineType = isCoverageTableLine(stderrBuffer);
    if (tableLineType) {
      // Handle as table line
      if (tableLineType === "header") {
        coverageTableHeader = { line: stderrBuffer, type: "header" };
        inCoverageTable = true;
      } else if (tableLineType === "separator") {
        coverageTableSeparator = { line: stderrBuffer, type: "separator" };
      } else {
        coverageTableBuffer.push({ line: stderrBuffer, type: tableLineType });
      }
      if (inCoverageTable) {
        outputCoverageTable();
      }
    } else {
      const coloredBuffer = colorizeLine(stderrBuffer);
      process.stderr.write(coloredBuffer);
      fullOutput += stderrBuffer;
    }
  }
  // Write full output to file for debugging
  try {
    writeFileSync(join(rootDir, "test-output.log"), fullOutput, "utf8");
  } catch (err) {
    // Ignore file write errors
  }
  process.exit(code || 0);
});

jestProcess.on("error", (error) => {
  console.error("Error spawning jest process:", error);
  process.exit(1);
});
