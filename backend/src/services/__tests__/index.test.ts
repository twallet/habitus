import { vi } from "vitest";
import { Database } from "../../db/database.js";
import {
  initializeServices,
  getAuthService,
  getUserService,
  getTrackingService,
  getEmailService,
} from "../index.js";

describe("Services Index", () => {
  let db: Database;

  beforeEach(async () => {
    db = new Database(":memory:");
    await db.initialize();
  });

  afterEach(async () => {
    await db.close();
  });

  describe("initializeServices", () => {
    it("should initialize all services with database", () => {
      initializeServices(db);

      expect(getAuthService()).toBeDefined();
      expect(getUserService()).toBeDefined();
      expect(getTrackingService()).toBeDefined();
      expect(getEmailService()).toBeDefined();
    });

    it("should create EmailService instance", () => {
      initializeServices(db);
      const emailService = getEmailService();
      expect(emailService).toBeDefined();
      expect(typeof emailService.sendMagicLink).toBe("function");
    });

    it("should create AuthService with database and emailService", () => {
      initializeServices(db);
      const authService = getAuthService();
      expect(authService).toBeDefined();
      expect(typeof authService.requestRegisterMagicLink).toBe("function");
    });

    it("should create UserService with database", () => {
      initializeServices(db);
      const userService = getUserService();
      expect(userService).toBeDefined();
      expect(typeof userService.getAllUsers).toBe("function");
    });

    it("should create TrackingService with database", () => {
      initializeServices(db);
      const trackingService = getTrackingService();
      expect(trackingService).toBeDefined();
      expect(typeof trackingService.getTrackingsByUserId).toBe("function");
    });
  });

  describe("getAuthService", () => {
    it("should return AuthService instance after initialization", () => {
      initializeServices(db);
      const service = getAuthService();
      expect(service).toBeDefined();
      expect(typeof service.verifyToken).toBe("function");
    });

    it("should throw error if services not initialized", async () => {
      // Reset modules to get fresh state
      vi.resetModules();
      const freshModule = await import("../index.js");
      expect(() => freshModule.getAuthService()).toThrow(
        "Services not initialized. Call initializeServices() first."
      );
    });
  });

  describe("getUserService", () => {
    it("should return UserService instance after initialization", () => {
      initializeServices(db);
      const service = getUserService();
      expect(service).toBeDefined();
      expect(typeof service.getUserById).toBe("function");
    });

    it("should throw error if services not initialized", async () => {
      // Reset modules to get fresh state
      vi.resetModules();
      const freshModule = await import("../index.js");
      expect(() => freshModule.getUserService()).toThrow(
        "Services not initialized. Call initializeServices() first."
      );
    });
  });

  describe("getTrackingService", () => {
    it("should return TrackingService instance after initialization", () => {
      initializeServices(db);
      const service = getTrackingService();
      expect(service).toBeDefined();
      expect(typeof service.createTracking).toBe("function");
    });

    it("should throw error if services not initialized", async () => {
      // Reset modules to get fresh state
      vi.resetModules();
      const freshModule = await import("../index.js");
      expect(() => freshModule.getTrackingService()).toThrow(
        "Services not initialized. Call initializeServices() first."
      );
    });
  });

  describe("getEmailService", () => {
    it("should return EmailService instance after initialization", () => {
      initializeServices(db);
      const service = getEmailService();
      expect(service).toBeDefined();
      expect(typeof service.sendMagicLink).toBe("function");
    });

    it("should throw error if services not initialized", async () => {
      // Reset modules to get fresh state
      vi.resetModules();
      const freshModule = await import("../index.js");
      expect(() => freshModule.getEmailService()).toThrow(
        "Services not initialized. Call initializeServices() first."
      );
    });
  });
});
