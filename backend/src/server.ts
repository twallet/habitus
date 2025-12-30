// Load environment variables from .env file
// This must be imported first before any other imports that use process.env
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// Load .env from config folder BEFORE importing constants
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, "../../config/.env") });

// Now import everything else (constants will read from process.env)
import express from "express";
import cors from "cors";
import { readFileSync, existsSync } from "fs";
import { Database } from "./db/database.js";
import { ServiceManager } from "./services/index.js";
import usersRouter from "./routes/users.js";
import authRouter from "./routes/auth.js";
import trackingsRouter from "./routes/trackings.js";
import remindersRouter from "./routes/reminders.js";
import adminRouter from "./routes/admin/admin.js";
import {
  getUploadsDirectory,
  isCloudinaryStorage,
} from "./middleware/upload.js";
import { ServerConfig } from "./setup/constants.js";
import { PathConfig } from "./config/paths.js";

const isDevelopment = process.env.NODE_ENV !== "production";

const app = express();

/**
 * Trust proxy configuration for rate limiting.
 * Set TRUST_PROXY=true in production when behind a reverse proxy (nginx, etc.)
 */
if (process.env.TRUST_PROXY === "true") {
  app.set("trust proxy", true);
}

/**
 * Request logging middleware.
 * In development, only logs errors (status >= 400) to reduce console noise.
 * In production, logs all requests for monitoring.
 * Set VERBOSE_LOGGING=true to enable full request logging in development.
 */
const verboseLogging = process.env.VERBOSE_LOGGING === "true";

app.use(
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const userAgent = req.get("user-agent") || "unknown";

    // Skip logging for Vite HMR routes in development
    const isViteRoute =
      isDevelopment &&
      (req.path.startsWith("/@") ||
        req.path.startsWith("/node_modules/") ||
        req.path.startsWith("/src/") ||
        req.path.endsWith(".ts") ||
        req.path.endsWith(".tsx") ||
        req.path.endsWith(".jsx") ||
        req.path.endsWith(".css") ||
        req.path.endsWith(".map"));

    // In development, skip verbose logging unless VERBOSE_LOGGING is enabled
    const shouldLogRequest = (!isDevelopment || verboseLogging) && !isViteRoute;

    if (shouldLogRequest) {
      // Log request start
      console.log(
        `[${timestamp}] ${req.method} ${
          req.path
        } | IP: ${ip} | User-Agent: ${userAgent.substring(0, 50)}`
      );
    }

    // Log response when finished
    res.on("finish", () => {
      const duration = Date.now() - startTime;
      const logLevel = res.statusCode >= 400 ? "ERROR" : "INFO";

      // Always log errors (except Vite routes), or log all in production/verbose mode
      if (
        (res.statusCode >= 400 || !isDevelopment || verboseLogging) &&
        !isViteRoute
      ) {
        console.log(
          `[${new Date().toISOString()}] ${logLevel} | ${req.method} ${
            req.path
          } | Status: ${res.statusCode} | Duration: ${duration}ms | IP: ${ip}`
        );
      }
    });

    next();
  }
);

/**
 * Middleware configuration.
 * In development, CORS is simplified since frontend and backend are on same origin.
 */
if (isDevelopment) {
  // In development, same origin so CORS is not needed, but keep it for API testing
  app.use(cors({ origin: true }));
} else {
  app.use(cors());
}
app.use(express.json());

/**
 * Serve uploaded files statically (local storage only).
 * When using Cloudinary, files are served from Cloudinary CDN, so this route is not needed.
 */
if (!isCloudinaryStorage()) {
  app.use("/uploads", express.static(getUploadsDirectory()));
}

/**
 * API routes.
 */
app.use("/api/users", usersRouter);
app.use("/api/auth", authRouter);
app.use("/api/trackings", trackingsRouter);
app.use("/api/reminders", remindersRouter);
app.use("/api/admin", adminRouter);

/**
 * Health check endpoint.
 * Available at /health for monitoring and health checks.
 */
app.get("/health", (_req: express.Request, res: express.Response) => {
  res.json({ status: "ok" });
});

/**
 * Initialize Vite dev server for development mode.
 * This serves the React frontend with Hot Module Replacement (HMR) support.
 * @returns Promise resolving to Vite dev server instance or null in production
 */
async function initializeViteDevServer() {
  if (!isDevelopment) {
    return null;
  }

  try {
    const { createServer } = await import("vite");
    const workspaceRoot = PathConfig.getWorkspaceRoot();
    const frontendPath = join(workspaceRoot, "frontend");

    // Get HMR port from environment variable or use a default
    // Vite's default HMR port is 24678, but we'll use a configurable one
    const hmrPort = process.env.VITE_HMR_PORT
      ? parseInt(process.env.VITE_HMR_PORT, 10)
      : 24679; // Use a different default port to avoid conflicts

    // Extract hostname from server URL for HMR
    let hmrHost: string | undefined;
    if (process.env.VITE_SERVER_URL) {
      try {
        const url = new URL(
          process.env.VITE_SERVER_URL.startsWith("http")
            ? process.env.VITE_SERVER_URL
            : `http://${process.env.VITE_SERVER_URL}`
        );
        hmrHost = url.hostname;
      } catch {
        // If URL parsing fails, use localhost
        hmrHost = "localhost";
      }
    } else {
      hmrHost = "localhost";
    }

    const viteServer = await createServer({
      root: frontendPath,
      configFile: join(frontendPath, "vite.config.ts"),
      server: {
        middlewareMode: true,
        hmr: {
          port: hmrPort,
          host: hmrHost,
        },
      },
      appType: "spa",
      logLevel: "warn",
      clearScreen: false,
    });

    // Use Vite's connect instance as middleware
    app.use(viteServer.middlewares);

    console.log(
      `[${new Date().toISOString()}] Vite dev server initialized for frontend (HMR port: ${hmrPort})`
    );
    return viteServer;
  } catch (error) {
    console.error("Failed to initialize Vite dev server:", error);
    // If it's a port conflict, provide helpful error message
    if (
      error instanceof Error &&
      error.message.includes("Port") &&
      error.message.includes("already in use")
    ) {
      console.error("\nTip: If the HMR port is already in use, you can:");
      console.error(
        "1. Set VITE_HMR_PORT environment variable to use a different port"
      );
      console.error(
        "2. Kill the process using the port, or restart your dev server"
      );
    }
    throw error;
  }
}

/**
 * Initialize database and start server.
 */
const db = new Database();
db.initialize()
  .then(async () => {
    console.log(
      `[${new Date().toISOString()}] Database initialized successfully`
    );
    ServiceManager.initializeServices(db);
    console.log(
      `[${new Date().toISOString()}] Services initialized successfully`
    );

    // Initialize Vite dev server in development
    const viteServer = await initializeViteDevServer();

    // In production, serve static files from frontend build
    if (!isDevelopment) {
      const workspaceRoot = PathConfig.getWorkspaceRoot();
      const frontendBuildPath = join(workspaceRoot, "frontend", "dist");
      app.use(express.static(frontendBuildPath));

      // 404 handler for API routes that don't exist
      app.use("/api", (req, res) => {
        res.status(404).json({ error: "Not found" });
      });

      // Serve React app for all non-API routes in production
      app.get("*", (req, res, next) => {
        // Skip API routes - they should have been handled above
        if (req.path.startsWith("/api")) {
          return next();
        }

        const indexPath = join(frontendBuildPath, "index.html");
        // Check if index.html exists before trying to serve it
        if (existsSync(indexPath)) {
          try {
            const html = readFileSync(indexPath, "utf-8");
            res.setHeader("Content-Type", "text/html");
            res.send(html);
          } catch (err) {
            // If reading file fails, return 404
            res.status(404).json({ error: "Not found" });
          }
        } else {
          // If index.html doesn't exist, return 404
          res.status(404).json({ error: "Not found" });
        }
      });
    } else if (viteServer) {
      // In development, serve React app for all non-API routes via Vite
      const workspaceRoot = PathConfig.getWorkspaceRoot();
      const frontendPath = join(workspaceRoot, "frontend");
      const indexHtmlPath = join(frontendPath, "index.html");

      app.get("*", async (req, res, next) => {
        // Skip API routes, health check, and static files
        if (
          req.path.startsWith("/api") ||
          req.path.startsWith("/uploads") ||
          req.path === "/health"
        ) {
          return next();
        }

        try {
          const html = readFileSync(indexHtmlPath, "utf-8");
          const template = await viteServer.transformIndexHtml(
            req.originalUrl,
            html
          );
          res.setHeader("Content-Type", "text/html");
          res.send(template);
        } catch (error) {
          next(error);
        }
      });
    }

    // Error handler middleware (must be after all routes)
    app.use(
      (
        err: Error,
        req: express.Request,
        res: express.Response,
        next: express.NextFunction
      ) => {
        // If response was already sent, delegate to default error handler
        if (res.headersSent) {
          return next(err);
        }

        // Log the error
        console.error(`Error handling ${req.method} ${req.path}:`, err);

        // Return appropriate error response
        res.status(500).json({
          error: "Internal server error",
          message: isDevelopment ? err.message : undefined,
        });
      }
    );

    const server = app.listen(ServerConfig.getPort(), () => {
      console.log(
        `[${new Date().toISOString()}] Server running on ${ServerConfig.getServerUrl()}:${ServerConfig.getPort()}`
      );
      console.log(
        `[${new Date().toISOString()}] Environment: ${
          process.env.NODE_ENV || "development"
        }`
      );
      if (isDevelopment) {
        console.log(
          `[${new Date().toISOString()}] Frontend served via Vite with HMR`
        );
      }
    });

    /**
     * Graceful shutdown.
     */
    let isShuttingDown = false;
    const shutdown = async (signal: string) => {
      if (isShuttingDown) {
        return;
      }
      isShuttingDown = true;

      console.log(`\n${signal} signal received: closing HTTP server`);

      try {
        // Close HTTP server
        await new Promise<void>((resolve, reject) => {
          server.close((err) => {
            if (err) {
              console.error("Error closing HTTP server:", err);
              reject(err);
            } else {
              console.log("HTTP server closed");
              resolve();
            }
          });
        });

        // Close Vite server
        if (viteServer) {
          try {
            await viteServer.close();
            console.log("Vite dev server closed");
          } catch (error) {
            console.error("Error closing Vite server:", error);
          }
        }

        // Close database
        try {
          await db.close();
          console.log("Database closed");
        } catch (error) {
          console.error("Error closing database:", error);
        }

        // Exit gracefully - let tsx watch handle the exit
        process.exit(0);
      } catch (error) {
        console.error("Error during shutdown:", error);
        process.exit(1);
      }
    };

    // Handle shutdown signals - use once to prevent multiple handlers
    process.once("SIGTERM", () => {
      shutdown("SIGTERM").catch(() => {
        process.exit(1);
      });
    });

    process.once("SIGINT", () => {
      shutdown("SIGINT").catch(() => {
        process.exit(1);
      });
    });
  })
  .catch((error) => {
    console.error("Failed to initialize database:", error);
    process.exit(1);
  });
