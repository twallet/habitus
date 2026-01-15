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
import cookieParser from "cookie-parser";
import { readFileSync, existsSync } from "fs";
import { Database } from "./db/database.js";
import { ServiceManager } from "./services/index.js";
import usersRouter from "./routes/users.js";
import authRouter from "./routes/auth.js";
import trackingsRouter from "./routes/trackings.js";
import remindersRouter from "./routes/reminders.js";
import adminRouter from "./routes/admin/admin.js";
import telegramRouter from "./routes/telegram.js";
import {
  getUploadsDirectory,
  isCloudinaryStorage,
} from "./middleware/upload.js";
import { ServerConfig } from "./setup/constants.js";
import { PathConfig } from "./config/paths.js";
import { ReminderStatus } from "./models/Reminder.js";
import { Logger } from "./setup/logger.js";

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
      Logger.verbose(
        `${req.method} ${req.path
        } | IP: ${ip} | User-Agent: ${userAgent.substring(0, 50)}`
      );
    }

    // Log response when finished
    res.on("finish", () => {
      const duration = Date.now() - startTime;

      // In production, only log request summaries if it's an error or if summary logging is enabled
      // In development, log based on shouldLogRequest (which depends on VERBOSE_LOGGING)
      const isError = res.statusCode >= 400;

      if ((isError || shouldLogRequest) && !isViteRoute) {
        const logLevel = isError ? "warn" : "info";
        // If it's a 500 error, use error level
        const level = res.statusCode >= 500 ? "error" : logLevel;

        (Logger as any)[level](
          `${req.method} ${req.path} | Status: ${res.statusCode} | Duration: ${duration}ms | IP: ${ip}`
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
  // Enable credentials for cookie authentication
  app.use(cors({ origin: true, credentials: true }));
} else {
  // In production, enable credentials for cookie-based authentication
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  app.use(cors({ origin: frontendUrl, credentials: true }));
}
app.use(express.json());
app.use(cookieParser());

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
app.use("/api/telegram", telegramRouter);

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

    Logger.info(
      `Vite dev server initialized for frontend (HMR port: ${hmrPort})`
    );
    return viteServer;
  } catch (error) {
    Logger.error("Failed to initialize Vite dev server:", error);
    // If it's a port conflict, provide helpful error message
    if (
      error instanceof Error &&
      error.message.includes("Port") &&
      error.message.includes("already in use")
    ) {
      Logger.error("\nTip: If the HMR port is already in use, you can:");
      Logger.error(
        "1. Set VITE_HMR_PORT environment variable to use a different port"
      );
      Logger.error(
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
let reminderPollTimeout: NodeJS.Timeout | null = null;

/**
 * Schedule the next reminder poll to run at :01 seconds of the next minute.
 * Checks for expired Upcoming reminders and transitions them to Pending status.
 * @internal
 */
const scheduleNextReminderPoll = () => {
  const now = new Date();
  const nextMinute = new Date(now);
  nextMinute.setMinutes(now.getMinutes() + 1);
  nextMinute.setSeconds(1);
  nextMinute.setMilliseconds(0);

  const delay = nextMinute.getTime() - now.getTime();

  reminderPollTimeout = setTimeout(async () => {
    try {
      // Use verbose level for regular poll checks to avoid log flooding
      Logger.verbose("REMINDER_POLL | Checking for expired Upcoming reminders...");

      // Use the service method to process expired reminders
      const reminderService = ServiceManager.getReminderService();
      await reminderService.processExpiredReminders();
    } catch (error) {
      Logger.error("REMINDER_POLL | Error in polling job:", error);
    }

    // Schedule the next poll
    scheduleNextReminderPoll();
  }, delay);
};

db.initialize()
  .then(async () => {
    Logger.info("Database initialized successfully");
    ServiceManager.initializeServices(db);
    Logger.info("Services initialized successfully");

    // Start reminder polling job (runs at :01 seconds each minute)
    Logger.info(
      "Starting reminder polling job (runs at :01 seconds each minute)..."
    );
    scheduleNextReminderPoll();
    Logger.info("Reminder polling job scheduled");

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
        Logger.error(`Error handling ${req.method} ${req.path}:`, err);

        // Return appropriate error response
        res.status(500).json({
          error: "Internal server error",
          message: isDevelopment ? err.message : undefined,
        });
      }
    );

    const server = app.listen(ServerConfig.getPort(), async () => {
      Logger.info(
        `Server running on ${ServerConfig.getServerUrl()}:${ServerConfig.getPort()}`
      );
      Logger.info(
        `Environment: ${process.env.NODE_ENV || "development"}`
      );
      if (isDevelopment) {
        Logger.info("Frontend served via Vite with HMR");
      }

      // Automatically set up Telegram webhook in production
      if (!isDevelopment && process.env.TELEGRAM_BOT_TOKEN) {
        try {
          const serverUrl = ServerConfig.getServerUrl();
          // Ensure URL is HTTPS for production
          const webhookBaseUrl = serverUrl.startsWith("https://")
            ? serverUrl
            : `https://${serverUrl}`;

          const webhookUrl = `${webhookBaseUrl}/api/telegram/webhook`;
          const botToken = process.env.TELEGRAM_BOT_TOKEN;

          Logger.info(
            `TELEGRAM_SETUP | Attempting to set webhook to: ${webhookUrl}`
          );

          const response = await fetch(
            `https://api.telegram.org/bot${botToken}/setWebhook`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                url: webhookUrl,
              }),
            }
          );

          const data = (await response.json()) as {
            ok: boolean;
            result?: boolean;
            description?: string;
          };

          if (response.ok && data.ok) {
            Logger.info(
              `TELEGRAM_SETUP | Webhook set successfully: ${webhookUrl}`
            );

            // Verify webhook was actually set by checking webhook info
            try {
              const verifyResponse = await fetch(
                `https://api.telegram.org/bot${botToken}/getWebhookInfo`
              );
              const verifyData = (await verifyResponse.json()) as {
                ok: boolean;
                result?: {
                  url?: string;
                  pending_update_count?: number;
                  last_error_message?: string;
                };
              };
              if (verifyData.ok && verifyData.result) {
                Logger.info(
                  `TELEGRAM_SETUP | Webhook verification: URL=${verifyData.result.url
                  }, Pending updates=${verifyData.result.pending_update_count || 0
                  }${verifyData.result.last_error_message
                    ? `, Last error: ${verifyData.result.last_error_message}`
                    : ""
                  }`
                );
              }
            } catch (error) {
              // Ignore verification errors
            }
          } else {
            console.warn(
              `[${new Date().toISOString()}] TELEGRAM_SETUP | Failed to set webhook automatically: ${data.description || "Unknown error"
              }. You can set it manually using POST /api/telegram/set-webhook`
            );
          }
        } catch (error) {
          Logger.warn("TELEGRAM_SETUP | Error setting webhook automatically:", error);
          Logger.warn(
            "TELEGRAM_SETUP | You can set the webhook manually using POST /api/telegram/set-webhook"
          );
        }
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

      Logger.info(`${signal} signal received: closing HTTP server`);

      try {
        // Close HTTP server
        await new Promise<void>((resolve, reject) => {
          server.close((err) => {
            if (err) {
              Logger.error("Error closing HTTP server:", err);
              reject(err);
            } else {
              Logger.info("HTTP server closed");
              resolve();
            }
          });
        });

        // Close Vite server
        if (viteServer) {
          try {
            await viteServer.close();
            Logger.info("Vite dev server closed");
          } catch (error) {
            Logger.error("Error closing Vite server:", error);
          }
        }

        // Clear reminder polling timeout
        if (reminderPollTimeout) {
          clearTimeout(reminderPollTimeout);
          Logger.info("Reminder polling job stopped");
        }

        // Close database
        try {
          await db.close();
          Logger.info("Database closed");
        } catch (error) {
          Logger.error("Error closing database:", error);
        }

        // Exit gracefully - let tsx watch handle the exit
        process.exit(0);
      } catch (error) {
        Logger.error("Error during shutdown:", error);
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
    Logger.error("Failed to initialize database:", error);
    process.exit(1);
  });
