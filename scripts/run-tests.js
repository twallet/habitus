/**
 * Test runner script that filters out the "Force exiting Jest" warning message
 */
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, "..");

// Get all arguments passed to this script (skip node and script path)
const jestArgs = ["jest", ...process.argv.slice(2)];
if (!jestArgs.includes("--forceExit")) {
  jestArgs.push("--forceExit");
}

// Suppress Node.js deprecation warnings
process.env.NODE_NO_WARNINGS = "1";

// Use npx to run jest (works cross-platform)
const jestProcess = spawn("npx", jestArgs, {
  stdio: ["inherit", "pipe", "pipe"],
  shell: true,
  cwd: rootDir,
  env: { ...process.env, NODE_NO_WARNINGS: "1" },
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
      process.stdout.write(line + "\n");
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
      process.stderr.write(line + "\n");
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
    process.stdout.write(stdoutBuffer);
  }
  if (
    stderrBuffer.trim() &&
    !stderrBuffer.includes("Force exiting Jest") &&
    !stderrBuffer.includes("DEP0190")
  ) {
    process.stderr.write(stderrBuffer);
  }
  process.exit(code || 0);
});

jestProcess.on("error", (error) => {
  console.error("Error spawning jest process:", error);
  process.exit(1);
});
