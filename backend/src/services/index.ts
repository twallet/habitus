import { Database } from "../db/database.js";
import { AuthService } from "./authService.js";
import { UserService } from "./userService.js";
import { TrackingService } from "./trackingService.js";
import { EmailService } from "./emailService.js";
import { AiService } from "./aiService.js";

/**
 * Service manager class for managing service instances.
 * Provides singleton access to all application services.
 * @public
 */
export class ServiceManager {
  private static authService: AuthService | null = null;
  private static userService: UserService | null = null;
  private static trackingService: TrackingService | null = null;
  private static emailService: EmailService | null = null;
  private static aiService: AiService | null = null;

  /**
   * Initialize all service instances.
   * Should be called after database is initialized.
   * @param db - Database instance
   * @public
   */
  static initializeServices(db: Database): void {
    this.emailService = new EmailService();
    this.authService = new AuthService(db, this.emailService);
    this.userService = new UserService(db);
    this.trackingService = new TrackingService(db);
    this.aiService = new AiService();
  }

  /**
   * Get AuthService instance.
   * @returns AuthService instance
   * @throws Error if services not initialized
   * @public
   */
  static getAuthService(): AuthService {
    if (!this.authService) {
      throw new Error(
        "Services not initialized. Call ServiceManager.initializeServices() first."
      );
    }
    return this.authService;
  }

  /**
   * Get UserService instance.
   * @returns UserService instance
   * @throws Error if services not initialized
   * @public
   */
  static getUserService(): UserService {
    if (!this.userService) {
      throw new Error(
        "Services not initialized. Call ServiceManager.initializeServices() first."
      );
    }
    return this.userService;
  }

  /**
   * Get TrackingService instance.
   * @returns TrackingService instance
   * @throws Error if services not initialized
   * @public
   */
  static getTrackingService(): TrackingService {
    if (!this.trackingService) {
      throw new Error(
        "Services not initialized. Call ServiceManager.initializeServices() first."
      );
    }
    return this.trackingService;
  }

  /**
   * Get EmailService instance.
   * @returns EmailService instance
   * @throws Error if services not initialized
   * @public
   */
  static getEmailService(): EmailService {
    if (!this.emailService) {
      throw new Error(
        "Services not initialized. Call ServiceManager.initializeServices() first."
      );
    }
    return this.emailService;
  }

  /**
   * Get AiService instance.
   * @returns AiService instance
   * @throws Error if services not initialized
   * @public
   */
  static getAiService(): AiService {
    if (!this.aiService) {
      throw new Error(
        "Services not initialized. Call ServiceManager.initializeServices() first."
      );
    }
    return this.aiService;
  }
}
