/**
 * Test runner that captures and displays output explicitly.
 * This version buffers output and ensures it's visible.
 */

import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const workspaceRoot = join(__dirname, "..");

let outputBuffer = "";
let errorBuffer = "";

console.log("Starting test run...\n");

const vitestProcess = spawn(
  "npx",
  [
    "vitest",
    "run",
    "--config",
    "config/vitest.config.ts",
    "--reporter=verbose",
    "--no-coverage",
  ],
  {
    cwd: workspaceRoot,
    stdio: ["inherit", "pipe", "pipe"],
    env: { ...process.env, FORCE_COLOR: "0" },
  }
);

vitestProcess.stdout.setEncoding("utf8");
vitestProcess.stderr.setEncoding("utf8");

vitestProcess.stdout.on("data", (data) => {
  const text = String(data);
  outputBuffer += text;
  // Write immediately to ensure it's visible
  process.stdout.write(text);
});

vitestProcess.stderr.on("data", (data) => {
  const text = String(data);
  errorBuffer += text;
  // Write immediately to ensure it's visible
  process.stderr.write(text);
});

vitestProcess.on("close", (code) => {
  // Ensure all output is flushed
  if (outputBuffer) {
    console.log("\n--- Captured stdout ---");
    console.log(outputBuffer);
  }
  if (errorBuffer) {
    console.error("\n--- Captured stderr ---");
    console.error(errorBuffer);
  }

  console.log(`\nTest process exited with code: ${code}`);
  process.exit(code || 0);
});

vitestProcess.on("error", (error) => {
  console.error("Error spawning test process:", error);
  process.exit(1);
});
