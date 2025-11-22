import { Database } from "../db/database.js";
import { AuthService } from "./authService.js";
import { UserService } from "./userService.js";
import { TrackingService } from "./trackingService.js";
import { EmailService } from "./emailService.js";

/**
 * Service instances singleton.
 * Initializes all services with their dependencies.
 * @public
 */
let authService: AuthService | null = null;
let userService: UserService | null = null;
let trackingService: TrackingService | null = null;
let emailService: EmailService | null = null;

/**
 * Initialize all service instances.
 * Should be called after database is initialized.
 * @param db - Database instance
 * @public
 */
export function initializeServices(db: Database): void {
  emailService = new EmailService();
  authService = new AuthService(db, emailService);
  userService = new UserService(db);
  trackingService = new TrackingService(db);
}

/**
 * Get AuthService instance.
 * @returns AuthService instance
 * @throws Error if services not initialized
 * @public
 */
export function getAuthService(): AuthService {
  if (!authService) {
    throw new Error(
      "Services not initialized. Call initializeServices() first."
    );
  }
  return authService;
}

/**
 * Get UserService instance.
 * @returns UserService instance
 * @throws Error if services not initialized
 * @public
 */
export function getUserService(): UserService {
  if (!userService) {
    throw new Error(
      "Services not initialized. Call initializeServices() first."
    );
  }
  return userService;
}

/**
 * Get TrackingService instance.
 * @returns TrackingService instance
 * @throws Error if services not initialized
 * @public
 */
export function getTrackingService(): TrackingService {
  if (!trackingService) {
    throw new Error(
      "Services not initialized. Call initializeServices() first."
    );
  }
  return trackingService;
}

/**
 * Get EmailService instance.
 * @returns EmailService instance
 * @throws Error if services not initialized
 * @public
 */
export function getEmailService(): EmailService {
  if (!emailService) {
    throw new Error(
      "Services not initialized. Call initializeServices() first."
    );
  }
  return emailService;
}
