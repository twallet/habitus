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

// Get all arguments passed to this script (skip node and script path)
const jestArgs = ["jest", ...process.argv.slice(2)];
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
      const coloredLine = colorizeLine(line);
      const outputLine = coloredLine + "\n";
      process.stdout.write(outputLine);
      fullOutput += line + "\n"; // Store original without colors
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
      const coloredLine = colorizeLine(line);
      const outputLine = coloredLine + "\n";
      process.stderr.write(outputLine);
      fullOutput += line + "\n"; // Store original without colors
    }
  });
});

jestProcess.on("close", (code) => {
  // Flush remaining buffers
  if (
    stdoutBuffer.trim() &&
    !stdoutBuffer.includes("Force exiting Jest") &&
    !stdoutBuffer.includes("DEP0190")
  ) {
    const coloredBuffer = colorizeLine(stdoutBuffer);
    process.stdout.write(coloredBuffer);
    fullOutput += stdoutBuffer;
  }
  if (
    stderrBuffer.trim() &&
    !stderrBuffer.includes("Force exiting Jest") &&
    !stderrBuffer.includes("DEP0190")
  ) {
    const coloredBuffer = colorizeLine(stderrBuffer);
    process.stderr.write(coloredBuffer);
    fullOutput += stderrBuffer;
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
