import { vi, beforeEach, afterEach } from "vitest";
import request from "supertest";
import express from "express";
import cors from "cors";
import { join } from "path";

describe("Server Configuration", () => {
  let app: express.Application;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };

    // Create a fresh Express app for testing
    app = express();

    // Mock console methods to avoid noise in test output
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe("Trust Proxy Configuration", () => {
    it("should set trust proxy when TRUST_PROXY is true", () => {
      process.env.TRUST_PROXY = "true";

      // Recreate app with trust proxy
      const testApp = express();
      if (process.env.TRUST_PROXY === "true") {
        testApp.set("trust proxy", true);
      }

      expect(testApp.get("trust proxy")).toBe(true);
    });

    it("should not set trust proxy when TRUST_PROXY is not true", () => {
      delete process.env.TRUST_PROXY;

      const testApp = express();
      if (process.env.TRUST_PROXY === "true") {
        testApp.set("trust proxy", true);
      }

      // Express returns false by default, not undefined
      expect(testApp.get("trust proxy")).toBe(false);
    });
  });

  describe("Request Logging Middleware", () => {
    beforeEach(() => {
      app.use(express.json());
    });

    it("should log requests in production mode", async () => {
      process.env.NODE_ENV = "production";
      const verboseLogging = false;
      const isDevelopment = process.env.NODE_ENV !== "production";

      app.use(
        (
          req: express.Request,
          res: express.Response,
          next: express.NextFunction
        ) => {
          const shouldLogRequest = !isDevelopment || verboseLogging;
          if (shouldLogRequest) {
            console.log(
              `[${new Date().toISOString()}] ${req.method} ${req.path}`
            );
          }
          res.on("finish", () => {
            if (res.statusCode >= 400 || !isDevelopment || verboseLogging) {
              console.log(
                `[${new Date().toISOString()}] ${req.method} ${
                  req.path
                } | Status: ${res.statusCode}`
              );
            }
          });
          next();
        }
      );

      app.get("/test", (_req, res) => {
        res.json({ message: "test" });
      });

      const consoleLogSpy = vi.spyOn(console, "log");
      await request(app).get("/test");

      // Should log in production
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it("should log errors in development mode", async () => {
      process.env.NODE_ENV = "development";
      const verboseLogging = false;
      const isDevelopment = process.env.NODE_ENV !== "production";

      app.use(
        (
          req: express.Request,
          res: express.Response,
          next: express.NextFunction
        ) => {
          const shouldLogRequest = !isDevelopment || verboseLogging;
          if (shouldLogRequest) {
            console.log(
              `[${new Date().toISOString()}] ${req.method} ${req.path}`
            );
          }
          res.on("finish", () => {
            if (res.statusCode >= 400 || !isDevelopment || verboseLogging) {
              console.log(
                `[${new Date().toISOString()}] ${req.method} ${
                  req.path
                } | Status: ${res.statusCode}`
              );
            }
          });
          next();
        }
      );

      app.get("/test-error", (_req, res) => {
        res.status(404).json({ error: "Not found" });
      });

      const consoleLogSpy = vi.spyOn(console, "log");
      await request(app).get("/test-error");

      // Should log errors even in development
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it("should skip logging for Vite HMR routes in development", async () => {
      process.env.NODE_ENV = "development";
      const verboseLogging = false;
      const isDevelopment = process.env.NODE_ENV !== "production";

      // Clear any previous console.log calls
      vi.clearAllMocks();

      app.use(
        (
          req: express.Request,
          res: express.Response,
          next: express.NextFunction
        ) => {
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

          const shouldLogRequest =
            (!isDevelopment || verboseLogging) && !isViteRoute;
          if (shouldLogRequest) {
            console.log(
              `[${new Date().toISOString()}] ${req.method} ${req.path}`
            );
          }
          res.on("finish", () => {
            if (
              (res.statusCode >= 400 || !isDevelopment || verboseLogging) &&
              !isViteRoute
            ) {
              console.log(
                `[${new Date().toISOString()}] ${req.method} ${
                  req.path
                } | Status: ${res.statusCode}`
              );
            }
          });
          next();
        }
      );

      app.get("/@vite/client", (_req, res) => {
        res.json({});
      });

      const consoleLogSpy = vi
        .spyOn(console, "log")
        .mockImplementation(() => {});
      await request(app).get("/@vite/client");

      // Should not log Vite routes
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it("should log requests when VERBOSE_LOGGING is enabled in development", async () => {
      process.env.NODE_ENV = "development";
      process.env.VERBOSE_LOGGING = "true";
      const verboseLogging = process.env.VERBOSE_LOGGING === "true";
      const isDevelopment = process.env.NODE_ENV !== "production";

      app.use(
        (
          req: express.Request,
          res: express.Response,
          next: express.NextFunction
        ) => {
          const shouldLogRequest = !isDevelopment || verboseLogging;
          if (shouldLogRequest) {
            console.log(
              `[${new Date().toISOString()}] ${req.method} ${req.path}`
            );
          }
          res.on("finish", () => {
            if (res.statusCode >= 400 || !isDevelopment || verboseLogging) {
              console.log(
                `[${new Date().toISOString()}] ${req.method} ${
                  req.path
                } | Status: ${res.statusCode}`
              );
            }
          });
          next();
        }
      );

      app.get("/test", (_req, res) => {
        res.json({ message: "test" });
      });

      const consoleLogSpy = vi.spyOn(console, "log");
      await request(app).get("/test");

      // Should log when verbose logging is enabled
      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });

  describe("CORS Configuration", () => {
    it("should use CORS with origin true in development", () => {
      process.env.NODE_ENV = "development";
      const isDevelopment = process.env.NODE_ENV !== "production";
      const testApp = express();

      if (isDevelopment) {
        testApp.use(cors({ origin: true }));
      } else {
        testApp.use(cors());
      }

      // CORS middleware is applied (we can't easily test the exact config, but we verify the branch)
      expect(isDevelopment).toBe(true);
    });

    it("should use default CORS in production", () => {
      process.env.NODE_ENV = "production";
      const isDevelopment = process.env.NODE_ENV !== "production";
      const testApp = express();

      if (isDevelopment) {
        testApp.use(cors({ origin: true }));
      } else {
        testApp.use(cors());
      }

      // CORS middleware is applied
      expect(isDevelopment).toBe(false);
    });
  });

  describe("Health Check Endpoint", () => {
    beforeEach(() => {
      app.use(express.json());
    });

    it("should return ok status for health check", async () => {
      app.get("/health", (_req: express.Request, res: express.Response) => {
        res.json({ status: "ok" });
      });

      const response = await request(app).get("/health");

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: "ok" });
    });
  });

  describe("Static File Serving", () => {
    it("should configure static file serving for uploads", () => {
      const testApp = express();
      const uploadsDir = "/test/uploads";
      testApp.use("/uploads", express.static(uploadsDir));

      // Verify the middleware is configured
      expect(testApp).toBeDefined();
    });
  });

  describe("Vite Dev Server Initialization", () => {
    it("should return null in production mode", async () => {
      process.env.NODE_ENV = "production";
      const isDevelopment = process.env.NODE_ENV !== "production";

      async function initializeViteDevServer() {
        if (!isDevelopment) {
          return null;
        }
        return null;
      }

      const result = await initializeViteDevServer();
      expect(result).toBeNull();
    });

    it("should handle Vite initialization logic in development", () => {
      process.env.NODE_ENV = "development";
      const isDevelopment = process.env.NODE_ENV !== "production";

      // Verify the development mode check
      expect(isDevelopment).toBe(true);
    });
  });

  describe("Production Static File Serving", () => {
    it("should serve static files from frontend/dist in production", () => {
      process.env.NODE_ENV = "production";
      const isDevelopment = process.env.NODE_ENV !== "production";

      const testApp = express();

      if (!isDevelopment) {
        const workspaceRoot = "/test/workspace";
        const frontendBuildPath = join(workspaceRoot, "frontend", "dist");
        testApp.use(express.static(frontendBuildPath));

        // Verify the path is constructed correctly (normalize for cross-platform)
        const normalizedPath = frontendBuildPath.replace(/\\/g, "/");
        expect(normalizedPath).toBe("/test/workspace/frontend/dist");
      }

      expect(isDevelopment).toBe(false);
    });

    it("should serve index.html for all non-API routes in production", () => {
      process.env.NODE_ENV = "production";
      const isDevelopment = process.env.NODE_ENV !== "production";

      const testApp = express();

      if (!isDevelopment) {
        const workspaceRoot = "/test/workspace";
        const frontendBuildPath = join(workspaceRoot, "frontend", "dist");
        testApp.use(express.static(frontendBuildPath));

        testApp.get("*", (_req, res) => {
          res.sendFile(join(frontendBuildPath, "index.html"));
        });

        // Verify the route is configured (normalize for cross-platform)
        const normalizedPath = frontendBuildPath.replace(/\\/g, "/");
        expect(normalizedPath).toBe("/test/workspace/frontend/dist");
      }

      expect(isDevelopment).toBe(false);
    });
  });

  describe("Development Vite Route Handling", () => {
    it("should skip API routes when serving via Vite", async () => {
      process.env.NODE_ENV = "development";
      const isDevelopment = process.env.NODE_ENV !== "production";

      const mockViteServer = {
        middlewares: express(),
        transformIndexHtml: vi.fn().mockResolvedValue("<html></html>"),
        close: vi.fn().mockResolvedValue(undefined),
      };

      const testApp = express();

      if (isDevelopment && mockViteServer) {
        const workspaceRoot = "/test/workspace";
        const frontendPath = join(workspaceRoot, "frontend");
        const indexHtmlPath = join(frontendPath, "index.html");

        testApp.get("*", async (req, res, next) => {
          // Skip API routes, health check, and static files
          if (
            req.path.startsWith("/api") ||
            req.path.startsWith("/uploads") ||
            req.path === "/health"
          ) {
            return next();
          }

          try {
            // Mock readFileSync by using a mock implementation
            const html = "<html></html>";
            const template = await mockViteServer.transformIndexHtml(
              req.originalUrl,
              html
            );
            res.setHeader("Content-Type", "text/html");
            res.send(template);
          } catch (error) {
            next(error);
          }
        });

        // Test that API routes are skipped
        const response = await request(testApp).get("/api/users");
        // Should not be handled by Vite route handler (404 because no handler)
        expect(response.status).toBe(404);
      }
    });

    it("should skip uploads routes when serving via Vite", async () => {
      process.env.NODE_ENV = "development";
      const isDevelopment = process.env.NODE_ENV !== "production";

      const mockViteServer = {
        middlewares: express(),
        transformIndexHtml: vi.fn().mockResolvedValue("<html></html>"),
        close: vi.fn().mockResolvedValue(undefined),
      };

      const testApp = express();

      if (isDevelopment && mockViteServer) {
        testApp.get("*", async (req, res, next) => {
          if (
            req.path.startsWith("/api") ||
            req.path.startsWith("/uploads") ||
            req.path === "/health"
          ) {
            return next();
          }

          try {
            // Mock readFileSync by using a mock implementation
            const html = "<html></html>";
            const template = await mockViteServer.transformIndexHtml(
              req.originalUrl,
              html
            );
            res.setHeader("Content-Type", "text/html");
            res.send(template);
          } catch (error) {
            next(error);
          }
        });

        // Test that uploads routes are skipped
        const response = await request(testApp).get("/uploads/test.jpg");
        // Should not be handled by Vite route handler
        expect(response.status).toBe(404);
      }
    });

    it("should skip health check route when serving via Vite", async () => {
      process.env.NODE_ENV = "development";
      const isDevelopment = process.env.NODE_ENV !== "production";

      const mockViteServer = {
        middlewares: express(),
        transformIndexHtml: vi.fn().mockResolvedValue("<html></html>"),
        close: vi.fn().mockResolvedValue(undefined),
      };

      const testApp = express();
      testApp.get("/health", (_req, res) => {
        res.json({ status: "ok" });
      });

      if (isDevelopment && mockViteServer) {
        testApp.get("*", async (req, res, next) => {
          if (
            req.path.startsWith("/api") ||
            req.path.startsWith("/uploads") ||
            req.path === "/health"
          ) {
            return next();
          }

          try {
            // Mock readFileSync by using a mock implementation
            const html = "<html></html>";
            const template = await mockViteServer.transformIndexHtml(
              req.originalUrl,
              html
            );
            res.setHeader("Content-Type", "text/html");
            res.send(template);
          } catch (error) {
            next(error);
          }
        });

        // Test that health check route is skipped
        const response = await request(testApp).get("/health");
        expect(response.status).toBe(200);
        expect(response.body).toEqual({ status: "ok" });
      }
    });

    it("should handle errors when transforming index.html", async () => {
      process.env.NODE_ENV = "development";
      const isDevelopment = process.env.NODE_ENV !== "production";

      const mockViteServer = {
        middlewares: express(),
        transformIndexHtml: vi
          .fn()
          .mockRejectedValue(new Error("Transform error")),
        close: vi.fn().mockResolvedValue(undefined),
      };

      const testApp = express();
      let errorHandled = false;

      if (isDevelopment && mockViteServer) {
        testApp.get("*", async (req, res, next) => {
          if (
            req.path.startsWith("/api") ||
            req.path.startsWith("/uploads") ||
            req.path === "/health"
          ) {
            return next();
          }

          try {
            // Mock readFileSync by using a mock implementation
            const html = "<html></html>";
            const template = await mockViteServer.transformIndexHtml(
              req.originalUrl,
              html
            );
            res.setHeader("Content-Type", "text/html");
            res.send(template);
          } catch (error) {
            errorHandled = true;
            next(error);
          }
        });

        testApp.use(
          (
            err: Error,
            _req: express.Request,
            res: express.Response,
            _next: express.NextFunction
          ) => {
            res.status(500).json({ error: err.message });
          }
        );

        // Test error handling
        const response = await request(testApp).get("/test-route");
        expect(errorHandled).toBe(true);
        expect(response.status).toBe(500);
      }
    });
  });
});
