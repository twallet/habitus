/**
 * Simple test runner that ensures output is visible and capturable.
 * This version explicitly flushes output and uses synchronous execution.
 */

import { execSync } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const workspaceRoot = join(__dirname, "..");

// Force output to be visible
process.stdout.setEncoding("utf8");
process.stderr.setEncoding("utf8");

// Disable buffering for immediate output
if (process.stdout._handle) {
  process.stdout._handle.setBlocking(true);
}
if (process.stderr._handle) {
  process.stderr._handle.setBlocking(true);
}

console.log("=".repeat(80));
console.log("Running tests...");
console.log("=".repeat(80));
console.log("");

try {
  // Run vitest with explicit output
  execSync(
    "npx vitest run --config config/vitest.config.ts --reporter=verbose --no-coverage",
    {
      cwd: workspaceRoot,
      stdio: "inherit",
      env: {
        ...process.env,
        FORCE_COLOR: "1",
        NODE_ENV: "test",
      },
    }
  );

  console.log("");
  console.log("=".repeat(80));
  console.log("Tests completed successfully!");
  console.log("=".repeat(80));
} catch (error) {
  console.error("");
  console.error("=".repeat(80));
  console.error("Tests failed with exit code:", error.status || 1);
  console.error("=".repeat(80));
  process.exit(error.status || 1);
}
