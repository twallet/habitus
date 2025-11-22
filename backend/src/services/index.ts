import { Database, getDatabaseInstance } from "../db/database.js";
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
 * @public
 */
export function initializeServices(): void {
  const db = getDatabaseInstance();
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
    initializeServices();
  }
  return authService!;
}

/**
 * Get UserService instance.
 * @returns UserService instance
 * @throws Error if services not initialized
 * @public
 */
export function getUserService(): UserService {
  if (!userService) {
    initializeServices();
  }
  return userService!;
}

/**
 * Get TrackingService instance.
 * @returns TrackingService instance
 * @throws Error if services not initialized
 * @public
 */
export function getTrackingService(): TrackingService {
  if (!trackingService) {
    initializeServices();
  }
  return trackingService!;
}

/**
 * Get EmailService instance.
 * @returns EmailService instance
 * @throws Error if services not initialized
 * @public
 */
export function getEmailService(): EmailService {
  if (!emailService) {
    initializeServices();
  }
  return emailService!;
}

