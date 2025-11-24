// Load environment variables from .env file
// This must be imported first before any other imports that use process.env
import "dotenv/config";
import express from "express";
import cors from "cors";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { readFileSync } from "fs";
import { Database } from "./db/database.js";
import { initializeServices } from "./services/index.js";
import usersRouter from "./routes/users.js";
import authRouter from "./routes/auth.js";
import trackingsRouter from "./routes/trackings.js";
import { getUploadsDirectory } from "./middleware/upload.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const isDevelopment = process.env.NODE_ENV !== "production";

const app = express();
const PORT = process.env.PORT || 3001;

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
 * Serve uploaded files statically.
 */
app.use("/uploads", express.static(getUploadsDirectory()));

/**
 * API routes.
 */
app.use("/api/users", usersRouter);
app.use("/api/auth", authRouter);
app.use("/api/trackings", trackingsRouter);

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
    const frontendPath = join(__dirname, "../../frontend");

    const viteServer = await createServer({
      root: frontendPath,
      configFile: join(frontendPath, "vite.config.ts"),
      server: {
        middlewareMode: true,
      },
      appType: "spa",
      logLevel: "warn",
      clearScreen: false,
    });

    // Use Vite's connect instance as middleware
    app.use(viteServer.middlewares);

    console.log(
      `[${new Date().toISOString()}] Vite dev server initialized for frontend`
    );
    return viteServer;
  } catch (error) {
    console.error("Failed to initialize Vite dev server:", error);
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
    initializeServices(db);
    console.log(
      `[${new Date().toISOString()}] Services initialized successfully`
    );

    // Initialize Vite dev server in development
    const viteServer = await initializeViteDevServer();

    // In production, serve static files from frontend build
    if (!isDevelopment) {
      const frontendBuildPath = join(__dirname, "../../frontend/dist");
      app.use(express.static(frontendBuildPath));

      // Serve React app for all non-API routes in production
      app.get("*", (_req, res) => {
        res.sendFile(join(frontendBuildPath, "index.html"));
      });
    } else if (viteServer) {
      // In development, serve React app for all non-API routes via Vite
      const frontendPath = join(__dirname, "../../frontend");
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

    const server = app.listen(PORT, () => {
      console.log(
        `[${new Date().toISOString()}] Server running on http://localhost:${PORT}`
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
    const shutdown = async (signal: string) => {
      console.log(`\n${signal} signal received: closing HTTP server`);
      server.close(async () => {
        console.log("HTTP server closed");
        if (viteServer) {
          await viteServer.close();
          console.log("Vite dev server closed");
        }
        await db.close().catch(console.error);
        console.log("Database closed");
        process.exit(0);
      });

      // Force exit after 10 seconds if cleanup takes too long
      setTimeout(() => {
        console.error("Forced shutdown after timeout");
        process.exit(1);
      }, 10000);
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
  })
  .catch((error) => {
    console.error("Failed to initialize database:", error);
    process.exit(1);
  });
