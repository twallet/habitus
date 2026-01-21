import { vi } from "vitest";
import { Database } from "../../db/database.js";
import { ServiceManager } from "../index.js";

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
      ServiceManager.initializeServices(db);

      expect(ServiceManager.getAuthService()).toBeDefined();
      expect(ServiceManager.getUserService()).toBeDefined();
      expect(ServiceManager.getTrackingService()).toBeDefined();
      expect(ServiceManager.getEmailService()).toBeDefined();
      expect(ServiceManager.getAiService()).toBeDefined();
      expect(ServiceManager.getTelegramService()).toBeDefined();
      expect(ServiceManager.getReminderService()).toBeDefined();
    });

    it("should create EmailService instance", () => {
      ServiceManager.initializeServices(db);
      const emailService = ServiceManager.getEmailService();
      expect(emailService).toBeDefined();
      expect(typeof emailService.sendMagicLink).toBe("function");
    });

    it("should create AuthService with database and emailService", () => {
      ServiceManager.initializeServices(db);
      const authService = ServiceManager.getAuthService();
      expect(authService).toBeDefined();
      expect(typeof authService.requestRegisterMagicLink).toBe("function");
    });

    it("should create UserService with database", () => {
      ServiceManager.initializeServices(db);
      const userService = ServiceManager.getUserService();
      expect(userService).toBeDefined();
      expect(typeof userService.getAllUsers).toBe("function");
    });

    it("should create TrackingService with database", () => {
      ServiceManager.initializeServices(db);
      const trackingService = ServiceManager.getTrackingService();
      expect(trackingService).toBeDefined();
      expect(typeof trackingService.getAllByUserId).toBe("function");
    });

    it("should create AiService instance", () => {
      ServiceManager.initializeServices(db);
      const aiService = ServiceManager.getAiService();
      expect(aiService).toBeDefined();
      expect(typeof aiService.suggestEmoji).toBe("function");
    });

    it("should create TelegramService instance", () => {
      ServiceManager.initializeServices(db);
      const telegramService = ServiceManager.getTelegramService();
      expect(telegramService).toBeDefined();
      expect(typeof telegramService.sendReminderMessage).toBe("function");
    });

    it("should create ReminderService with database", () => {
      ServiceManager.initializeServices(db);
      const reminderService = ServiceManager.getReminderService();
      expect(reminderService).toBeDefined();
      expect(typeof reminderService.getAllByUserId).toBe("function");
    });
  });

  describe("getAuthService", () => {
    it("should return AuthService instance after initialization", () => {
      ServiceManager.initializeServices(db);
      const service = ServiceManager.getAuthService();
      expect(service).toBeDefined();
      expect(typeof service.verifyToken).toBe("function");
    });

    it("should throw error if services not initialized", async () => {
      // Reset modules to get fresh state
      vi.resetModules();
      const freshModule = await import("../index.js");
      expect(() => freshModule.ServiceManager.getAuthService()).toThrow(
        /Services not initialized. Call (ServiceManager\.)?initializeServices\(\) first\./
      );
    });
  });

  describe("getUserService", () => {
    it("should return UserService instance after initialization", () => {
      ServiceManager.initializeServices(db);
      const service = ServiceManager.getUserService();
      expect(service).toBeDefined();
      expect(typeof service.getUserById).toBe("function");
    });

    it("should throw error if services not initialized", async () => {
      // Reset modules to get fresh state
      vi.resetModules();
      const freshModule = await import("../index.js");
      expect(() => freshModule.ServiceManager.getUserService()).toThrow(
        /Services not initialized. Call (ServiceManager\.)?initializeServices\(\) first\./
      );
    });
  });

  describe("getTrackingService", () => {
    it("should return TrackingService instance after initialization", () => {
      ServiceManager.initializeServices(db);
      const service = ServiceManager.getTrackingService();
      expect(service).toBeDefined();
      expect(typeof service.createTracking).toBe("function");
    });

    it("should throw error if services not initialized", async () => {
      // Reset modules to get fresh state
      vi.resetModules();
      const freshModule = await import("../index.js");
      expect(() => freshModule.ServiceManager.getTrackingService()).toThrow(
        /Services not initialized. Call (ServiceManager\.)?initializeServices\(\) first\./
      );
    });
  });

  describe("getEmailService", () => {
    it("should return EmailService instance after initialization", () => {
      ServiceManager.initializeServices(db);
      const service = ServiceManager.getEmailService();
      expect(service).toBeDefined();
      expect(typeof service.sendMagicLink).toBe("function");
    });

    it("should throw error if services not initialized", async () => {
      // Reset modules to get fresh state
      vi.resetModules();
      const freshModule = await import("../index.js");
      expect(() => freshModule.ServiceManager.getEmailService()).toThrow(
        /Services not initialized. Call (ServiceManager\.)?initializeServices\(\) first\./
      );
    });
  });

  describe("getAiService", () => {
    it("should return AiService instance after initialization", () => {
      ServiceManager.initializeServices(db);
      const service = ServiceManager.getAiService();
      expect(service).toBeDefined();
      expect(typeof service.suggestEmoji).toBe("function");
    });

    it("should throw error if services not initialized", async () => {
      // Reset modules to get fresh state
      vi.resetModules();
      const freshModule = await import("../index.js");
      expect(() => freshModule.ServiceManager.getAiService()).toThrow(
        /Services not initialized. Call (ServiceManager\.)?initializeServices\(\) first\./
      );
    });
  });

  describe("getTelegramService", () => {
    it("should return TelegramService instance after initialization", () => {
      ServiceManager.initializeServices(db);
      const service = ServiceManager.getTelegramService();
      expect(service).toBeDefined();
      expect(typeof service.sendReminderMessage).toBe("function");
    });

    it("should throw error if services not initialized", async () => {
      // Reset modules to get fresh state
      vi.resetModules();
      const freshModule = await import("../index.js");
      expect(() => freshModule.ServiceManager.getTelegramService()).toThrow(
        /Services not initialized. Call (ServiceManager\.)?initializeServices\(\) first\./
      );
    });
  });

  describe("getReminderService", () => {
    it("should return ReminderService instance after initialization", () => {
      ServiceManager.initializeServices(db);
      const service = ServiceManager.getReminderService();
      expect(service).toBeDefined();
      expect(typeof service.getAllByUserId).toBe("function");
    });

    it("should throw error if services not initialized", async () => {
      // Reset modules to get fresh state
      vi.resetModules();
      const freshModule = await import("../index.js");
      expect(() => freshModule.ServiceManager.getReminderService()).toThrow(
        /Services not initialized. Call (ServiceManager\.)?initializeServices\(\) first\./
      );
    });
  });
});

