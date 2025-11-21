// Load environment variables from .env file
// This must be imported first before any other imports that use process.env
import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { initializeDatabase, closeDatabase } from "./db/database.js";
import usersRouter from "./routes/users.js";
import authRouter from "./routes/auth.js";
import trackingsRouter from "./routes/trackings.js";
import { getUploadsDirectory } from "./middleware/upload.js";

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
 * Logs request details including method, path, IP, user agent, response status, and response time.
 */
app.use(
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const userAgent = req.get("user-agent") || "unknown";

    // Log request start
    console.log(
      `[${timestamp}] ${req.method} ${
        req.path
      } | IP: ${ip} | User-Agent: ${userAgent.substring(0, 50)}`
    );

    // Log response when finished
    res.on("finish", () => {
      const duration = Date.now() - startTime;
      const logLevel = res.statusCode >= 400 ? "ERROR" : "INFO";
      console.log(
        `[${new Date().toISOString()}] ${logLevel} | ${req.method} ${
          req.path
        } | Status: ${res.statusCode} | Duration: ${duration}ms | IP: ${ip}`
      );
    });

    next();
  }
);

/**
 * Middleware configuration.
 */
app.use(cors());
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
 * Root endpoint.
 */
app.get("/", (_req: express.Request, res: express.Response) => {
  res.json({
    message: "🌱 Habitus API",
    version: "1.0.0",
    endpoints: {
      health: "/health",
      users: "/api/users",
      auth: "/api/auth",
      trackings: "/api/trackings",
    },
  });
});

/**
 * Health check endpoint.
 */
app.get("/health", (_req: express.Request, res: express.Response) => {
  res.json({ status: "ok" });
});

/**
 * Initialize database and start server.
 */
initializeDatabase()
  .then(() => {
    console.log(
      `[${new Date().toISOString()}] Database initialized successfully`
    );
    const server = app.listen(PORT, () => {
      console.log(
        `[${new Date().toISOString()}] Server running on http://localhost:${PORT}`
      );
      console.log(
        `[${new Date().toISOString()}] Environment: ${
          process.env.NODE_ENV || "development"
        }`
      );
    });

    /**
     * Graceful shutdown.
     */
    process.on("SIGTERM", () => {
      console.log("SIGTERM signal received: closing HTTP server");
      server.close(() => {
        console.log("HTTP server closed");
        closeDatabase().catch(console.error);
      });
    });

    process.on("SIGINT", () => {
      console.log("SIGINT signal received: closing HTTP server");
      server.close(() => {
        console.log("HTTP server closed");
        closeDatabase().catch(console.error);
      });
    });
  })
  .catch((error) => {
    console.error("Failed to initialize database:", error);
    process.exit(1);
  });
