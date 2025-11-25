/**
 * Test runner script that filters out the "Force exiting Jest" warning message
 */
import { spawn } from "child_process";

// Get all arguments passed to this script (skip node and script path)
const jestArgs = process.argv.slice(2);
if (!jestArgs.includes("--forceExit")) {
  jestArgs.push("--forceExit");
}

const jestProcess = spawn("jest", jestArgs, {
  stdio: ["inherit", "pipe", "pipe"],
  shell: false,
});

let stdoutBuffer = "";
let stderrBuffer = "";

jestProcess.stdout.on("data", (data) => {
  stdoutBuffer += data.toString();
  const lines = stdoutBuffer.split("\n");
  stdoutBuffer = lines.pop() || ""; // Keep incomplete line in buffer

  lines.forEach((line) => {
    if (line.trim() && !line.includes("Force exiting Jest")) {
      process.stdout.write(line + "\n");
    }
  });
});

jestProcess.stderr.on("data", (data) => {
  stderrBuffer += data.toString();
  const lines = stderrBuffer.split("\n");
  stderrBuffer = lines.pop() || ""; // Keep incomplete line in buffer

  lines.forEach((line) => {
    if (line.trim() && !line.includes("Force exiting Jest")) {
      process.stderr.write(line + "\n");
    }
  });
});

jestProcess.on("close", (code) => {
  // Flush remaining buffers
  if (stdoutBuffer.trim() && !stdoutBuffer.includes("Force exiting Jest")) {
    process.stdout.write(stdoutBuffer);
  }
  if (stderrBuffer.trim() && !stderrBuffer.includes("Force exiting Jest")) {
    process.stderr.write(stderrBuffer);
  }
  process.exit(code || 0);
});
