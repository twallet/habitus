// Script wrapper para ejecutar prueba SMTP antes de iniciar el servidor
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log("[START] Running SMTP test before starting server...");

// Ejecutar prueba SMTP
const testProcess = spawn("node", ["dist/test-smtp.js"], {
  cwd: __dirname,
  stdio: "inherit",
  shell: false,
});

testProcess.on("close", (code) => {
  if (code === 0) {
    console.log("[START] ✅ SMTP test passed, starting server...");
  } else {
    console.warn(
      `[START] ⚠️  SMTP test failed (code ${code}), but continuing to start server...`
    );
    console.warn(
      "[START] Check SMTP configuration in Railway environment variables"
    );
  }

  // Iniciar el servidor
  console.log("[START] Starting server...");
  const serverProcess = spawn("node", ["dist/server.js"], {
    cwd: __dirname,
    stdio: "inherit",
    shell: false,
  });

  serverProcess.on("error", (error) => {
    console.error("[START] Failed to start server:", error);
    process.exit(1);
  });

  // Pasar señales al proceso del servidor
  process.on("SIGTERM", () => {
    serverProcess.kill("SIGTERM");
  });

  process.on("SIGINT", () => {
    serverProcess.kill("SIGINT");
  });
});

testProcess.on("error", (error) => {
  console.error("[START] Failed to run SMTP test:", error);
  console.warn("[START] Continuing to start server anyway...");

  // Iniciar el servidor incluso si la prueba falla
  const serverProcess = spawn("node", ["dist/server.js"], {
    cwd: __dirname,
    stdio: "inherit",
    shell: false,
  });
});
