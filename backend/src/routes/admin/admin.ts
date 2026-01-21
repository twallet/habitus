import { Router, Response } from "express";
import { ServiceManager } from "../../services/index.js";
import { requireAdmin } from "../../middleware/adminMiddleware.js";
import { AuthRequest } from "../../middleware/authMiddleware.js";
import { Database } from "../../db/database.js";
import {
  TrackingSchedule,
  type TrackingScheduleData,
} from "../../models/TrackingSchedule.js";

/**
 * Controller class for admin operations.
 * Handles admin-specific endpoints for viewing and managing application data.
 * @public
 */
export class AdminController {
  /**
   * Get the user service instance.
   * @returns UserService instance
   * @internal
   */
  private getUserService() {
    return ServiceManager.getUserService();
  }

  /**
   * Get the tracking service instance.
   * @returns TrackingService instance
   * @internal
   */
  private getTrackingService() {
    return ServiceManager.getTrackingService();
  }

  /**
   * Get the database instance from the tracking service.
   * @returns Database instance
   * @internal
   */
  private getDatabase(): Database {
    const trackingService = this.getTrackingService();
    return (trackingService as any).db as Database;
  }

  /**
   * Format a date string to a specific timezone.
   * SQLite stores dates as UTC strings without timezone info, so we need to
   * explicitly treat them as UTC before converting to the target timezone.
   * @param dateString - ISO date string or date string from database (UTC, no timezone)
   * @param timezone - Target timezone (optional, defaults to UTC)
   * @returns Formatted date string in YYYY-MM-DD HH:mm:ss format
   * @internal
   */
  private formatDateInTimezone(
    dateString: string | null | undefined,
    timezone?: string
  ): string {
    if (!dateString) {
      return "null";
    }
    try {
      // SQLite stores dates as UTC in format "YYYY-MM-DD HH:MM:SS" without timezone
      // Convert to ISO format and mark as UTC by appending 'Z'
      let utcString = dateString.trim();

      // Check if it's SQLite format: "YYYY-MM-DD HH:MM:SS" (has space, no T, no Z, no timezone offset)
      if (
        utcString.includes(" ") &&
        !utcString.includes("T") &&
        !utcString.includes("Z")
      ) {
        // Check if it has a timezone offset (like +03:00 or -03:00)
        const hasTimezoneOffset = /[+-]\d{2}:\d{2}$/.test(utcString);
        if (!hasTimezoneOffset) {
          // SQLite format: convert space to T and add Z to indicate UTC
          utcString = utcString.replace(" ", "T") + "Z";
        }
      } else if (
        utcString.includes("T") &&
        !utcString.includes("Z") &&
        !utcString.match(/[+-]\d{2}:\d{2}$/)
      ) {
        // ISO format without timezone - assume UTC
        utcString = utcString + "Z";
      }

      const date = new Date(utcString);

      // Check if date is valid
      if (isNaN(date.getTime())) {
        return dateString; // Return original if invalid
      }

      // Convert to target timezone (defaults to UTC if not specified)
      const targetTimezone = timezone || "UTC";
      const formatted = date.toLocaleString("en-US", {
        timeZone: targetTimezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });
      // Convert from MM/DD/YYYY, HH:mm:ss to YYYY-MM-DD HH:mm:ss
      const [datePart, timePart] = formatted.split(", ");
      const [month, day, year] = datePart.split("/");
      return `${year}-${month.padStart(2, "0")}-${day.padStart(
        2,
        "0"
      )} ${timePart}`;
    } catch {
      return dateString;
    }
  }

  /**
   * Get all trackings from database.
   * @returns Promise resolving to array of tracking data
   * @internal
   */
  private async getAllTrackings(): Promise<any[]> {
    const db = this.getDatabase();
    const rows = await db.all<{
      id: number;
      user_id: number;
      question: string;
      details: string | null;
      icon: string | null;
      frequency: string;
      state: string;
      created_at: string;
      updated_at: string;
    }>(
      "SELECT id, user_id, question, details, icon, frequency, state, created_at, updated_at FROM trackings ORDER BY created_at DESC"
    );

    const trackings = await Promise.all(
      rows.map(async (row) => {
        let frequency: any;
        try {
          frequency = JSON.parse(row.frequency);
        } catch (err) {
          console.error(
            `[${new Date().toISOString()}] ADMIN_CONTROLLER | Failed to parse frequency JSON for tracking ${row.id
            }:`,
            err
          );
        }

        const tracking = {
          id: row.id,
          user_id: row.user_id,
          question: row.question,
          details: row.details || undefined,
          icon: row.icon || undefined,
          frequency: frequency,
          state: row.state,
          created_at: row.created_at,
          updated_at: row.updated_at,
        };

        // Load schedules for each tracking
        const schedules = await TrackingSchedule.loadByTrackingId(row.id, db);
        (tracking as any).schedules = schedules.map((s) => s.toData());

        return tracking;
      })
    );

    return trackings;
  }

  /**
   * Get all reminders from database.
   * @returns Promise resolving to array of reminder data
   * @internal
   */
  private async getAllReminders(): Promise<any[]> {
    const db = this.getDatabase();
    const rows = await db.all<{
      id: number;
      tracking_id: number;
      user_id: number;
      scheduled_time: string;
      notes: string | null;
      status: string;
      value: string;
      created_at: string;
      updated_at: string;
    }>(
      "SELECT id, tracking_id, user_id, scheduled_time, notes, status, value, created_at, updated_at FROM reminders ORDER BY scheduled_time ASC"
    );

    return rows.map((row) => ({
      id: row.id,
      tracking_id: row.tracking_id,
      user_id: row.user_id,
      scheduled_time: row.scheduled_time,
      notes: row.notes || undefined,
      status: row.status,
      value: row.value,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));
  }

  /**
   * Generate formatted admin log output showing all users, trackings and their reminders.
   * Dates are displayed in each user's configured timezone.
   * @returns Promise resolving to formatted log text
   * @internal
   */
  private async generateAdminLog(): Promise<string> {
    const userService = this.getUserService();
    const users = await userService.getAllUsers();
    const trackings = await this.getAllTrackings();
    const reminders = await this.getAllReminders();

    // Group reminders by tracking_id
    const remindersByTracking = new Map<number, typeof reminders>();
    reminders.forEach((reminder) => {
      const trackingReminders =
        remindersByTracking.get(reminder.tracking_id) || [];
      trackingReminders.push(reminder);
      remindersByTracking.set(reminder.tracking_id, trackingReminders);
    });

    // Create a map of user_id to user timezone
    const userTimezones = new Map<number, string | undefined>();
    users.forEach((user) => {
      userTimezones.set(user.id, user.timezone || undefined);
    });

    // ANSI color codes matching PowerShell colors
    const ANSI_RESET = "\x1b[0m";
    const ANSI_GREEN = "\x1b[32m";
    const ANSI_YELLOW = "\x1b[33m";
    const ANSI_BLUE = "\x1b[34m";
    const ANSI_MAGENTA = "\x1b[35m";
    const ANSI_CYAN = "\x1b[36m";
    const ANSI_WHITE = "\x1b[37m";
    const ANSI_GRAY = "\x1b[90m";
    const ANSI_BRIGHT_YELLOW = "\x1b[93m";

    // Format output similar to PowerShell script with ANSI color codes
    const lines: string[] = [];

    // Add users section
    if (users.length === 0) {
      lines.push(`${ANSI_YELLOW}No users found in the database.${ANSI_RESET}`);
    } else {
      lines.push(`${ANSI_CYAN}=== USERS ===${ANSI_RESET}`);
      users.forEach((user, index) => {
        if (index > 0) {
          lines.push("");
        }

        // Format notification channels
        const notificationChannelsStr = user.notification_channels || "None";

        // Format telegram chat ID
        const telegramChatIdStr = user.telegram_chat_id || "null";

        // Use user's timezone for formatting their dates
        const userTimezone = user.timezone || undefined;

        const userAttrs = [
          `ID=${user.id}`,
          `Name=${user.name}`,
          `Email=${user.email}`,
          `ProfilePicture=${user.profile_picture_url || "null"}`,
          `NotificationChannels=[${notificationChannelsStr}]`,
          `TelegramChatID=${telegramChatIdStr}`,
          `Locale=${user.locale || "null"}`,
          `Timezone=${user.timezone || "null"}`,
          `LastAccess=${this.formatDateInTimezone(
            user.last_access,
            userTimezone
          )}`,
          `Created=${this.formatDateInTimezone(user.created_at, userTimezone)}`,
        ];

        lines.push(
          `${ANSI_CYAN}USER #${index + 1} : ${userAttrs.join(
            " | "
          )}${ANSI_RESET}`
        );
      });
    }

    // Add separator between users and trackings
    if (users.length > 0) {
      lines.push("");
    }
    lines.push(`${ANSI_GRAY}=== TRACKINGS ===${ANSI_RESET}`);
    lines.push("");

    if (trackings.length === 0) {
      lines.push(
        `${ANSI_YELLOW}No trackings found in the database.${ANSI_RESET}`
      );
    } else {
      trackings.forEach((tracking, index) => {
        if (index > 0) {
          lines.push("");
        }

        // Get user's timezone for this tracking
        const userTimezone = userTimezones.get(tracking.user_id);

        // Format schedules
        const schedulesStr =
          tracking.schedules && tracking.schedules.length > 0
            ? tracking.schedules
              .map(
                (s: TrackingScheduleData) =>
                  `${String(s.hour).padStart(2, "0")}:${String(
                    s.minutes
                  ).padStart(2, "0")}`
              )
              .join(", ")
            : "None";

        // Build tracking attributes
        const trackingAttrs = [
          `ID=${tracking.id}`,
          `UserID=${tracking.user_id}`,
          `Question=${tracking.question}`,
          `State=${tracking.state}`,
          `Icon=${tracking.icon || "null"}`,
          `Frequency=${tracking.frequency ? JSON.stringify(tracking.frequency) : "null"
          }`,
          `Schedules=[${schedulesStr}]`,
          `Details=${tracking.details || "null"}`,
          `Created=${this.formatDateInTimezone(
            tracking.created_at,
            userTimezone
          )}`,
          `Updated=${this.formatDateInTimezone(
            tracking.updated_at,
            userTimezone
          )}`,
        ];

        // Determine color based on tracking state
        // Use different colors from reminder statuses to avoid conflicts
        const stateColor =
          tracking.state === "Running"
            ? ANSI_BLUE
            : tracking.state === "Paused"
              ? ANSI_BRIGHT_YELLOW
              : ANSI_WHITE;

        lines.push(
          `${stateColor}TRACKING #${index + 1} : ${trackingAttrs.join(
            " | "
          )}${ANSI_RESET}`
        );

        // Display reminders
        const trackingReminders = remindersByTracking.get(tracking.id) || [];
        if (trackingReminders.length > 0) {
          trackingReminders.forEach((reminder) => {
            // Format scheduled time in user's timezone
            const scheduledTime = this.formatDateInTimezone(
              reminder.scheduled_time,
              userTimezone
            );

            // Format notes
            const notesStr = reminder.notes || "null";

            // Format value (Answer) - null for Pending status, otherwise show the value
            const answerStr =
              reminder.status === "Pending" ? "null" : reminder.value || "null";

            const reminderAttrs = [
              `ID=${reminder.id}`,
              `TrackingID=${reminder.tracking_id}`,
              `UserID=${reminder.user_id}`,
              `ScheduledTime=${scheduledTime}`,
              `Status=${reminder.status}`,
              `Answer=${answerStr}`,
              `Notes=${notesStr}`,
              `Created=${this.formatDateInTimezone(
                reminder.created_at,
                userTimezone
              )}`,
              `Updated=${this.formatDateInTimezone(
                reminder.updated_at,
                userTimezone
              )}`,
            ];

            // Determine color based on reminder status
            const statusColor =
              reminder.status === "Pending"
                ? ANSI_YELLOW
                : reminder.status === "Answered"
                  ? ANSI_GREEN
                  : reminder.status === "Upcoming"
                    ? ANSI_MAGENTA
                    : ANSI_GRAY;

            lines.push(
              `${statusColor}  -> REMINDER : ${reminderAttrs.join(
                " | "
              )}${ANSI_RESET}`
            );
          });
        } else {
          lines.push(`${ANSI_GRAY}  -> REMINDERS: None${ANSI_RESET}`);
        }
      });
    }

    return lines.join("\n");
  }

  /**
   * Handle GET /api/admin request.
   * Get formatted admin log output showing all users, trackings and their reminders.
   * Dates are displayed in each user's configured timezone.
   * Requires admin authentication (email must match ADMIN_EMAIL).
   * @param req - Express request object
   * @param res - Express response object
   * @public
   */
  async getAdminLog(req: AuthRequest, res: Response): Promise<void> {
    try {
      const log = await this.generateAdminLog();
      res.json({ log });
    } catch (error) {
      console.error(
        `[${new Date().toISOString()}] ADMIN_CONTROLLER | Error generating admin log:`,
        error
      );
      res.status(500).json({ error: "Error generating admin log" });
    }
  }

  /**
   * Handle POST /api/admin/clear-db request.
   * Clear all data from the database (users, trackings, reminders, schedules).
   * Requires admin authentication.
   * @param req - Express request object
   * @param res - Express response object
   * @public
   */
  async clearDatabase(req: AuthRequest, res: Response): Promise<void> {
    try {
      const db = this.getDatabase();

      // Delete all data (order matters due to foreign keys)
      await db.run("DELETE FROM reminders");
      await db.run("DELETE FROM tracking_schedules");
      await db.run("DELETE FROM trackings");
      await db.run("DELETE FROM users");

      console.log(
        `[${new Date().toISOString()}] ADMIN_CONTROLLER | Database cleared by admin user ${req.userId
        }`
      );

      res.json({ message: "Database cleared successfully" });
    } catch (error) {
      console.error(
        `[${new Date().toISOString()}] ADMIN_CONTROLLER | Error clearing database:`,
        error
      );
      res.status(500).json({ error: "Error clearing database" });
    }
  }
}

/**
 * Create router and register admin routes.
 * @public
 */
const router = Router();
const adminController = new AdminController();

/**
 * GET /api/admin
 * Get formatted admin log output showing all users, trackings and their reminders.
 * All dates are displayed in GMT-3 (Buenos Aires timezone).
 * Requires admin authentication (email must match ADMIN_EMAIL).
 * @route GET /api/admin
 * @header {string} Authorization - Bearer token
 * @returns {Object} Object with formatted log text
 */
/**
 * POST /api/admin/process-expired-reminders
 * Manually trigger processing of expired reminders (for testing/debugging).
 * @route POST /api/admin/process-expired-reminders
 * @header {string} Authorization - Bearer token
 * @returns {object} Result of processing
 */
router.post(
  "/process-expired-reminders",
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const reminderService = ServiceManager.getReminderService();
      await reminderService.processExpiredReminders();
      res.json({
        success: true,
        message: "Processed expired reminders",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error(
        `[${new Date().toISOString()}] ADMIN | Error processing expired reminders:`,
        error
      );
      res.status(500).json({
        error: "Error processing expired reminders",
        message:
          error instanceof Error ? error.message : String(error),
      });
    }
  }
);

router.get("/", requireAdmin, async (req: AuthRequest, res: Response) => {
  await adminController.getAdminLog(req, res);
});

/**
 * POST /api/admin/clear-db
 * Clear all data from the database (users, trackings, reminders, schedules).
 * Requires admin authentication.
 * @route POST /api/admin/clear-db
 * @header {string} Authorization - Bearer token
 * @returns {Object} Success message
 */
router.post(
  "/clear-db",
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    await adminController.clearDatabase(req, res);
  }
);

/**
 * POST /api/admin/migrate-notes-to-details
 * TEMPORARY: Migrate 'notes' column to 'details' in trackings table (PostgreSQL only).
 * This endpoint can be removed after the migration is complete.
 * Requires admin authentication.
 * @route POST /api/admin/migrate-notes-to-details
 * @header {string} Authorization - Bearer token
 * @returns {Object} Migration result
 */
router.post(
  "/migrate-notes-to-details",
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const trackingService = ServiceManager.getTrackingService();
      const db = (trackingService as any).db as Database;

      // Check if we're using PostgreSQL
      const isPostgreSQL = process.env.DATABASE_URL !== undefined;

      if (!isPostgreSQL) {
        return res.status(400).json({
          error: "This migration is only for PostgreSQL databases",
          message: "SQLite migrations are handled automatically",
        });
      }

      // Check if details column already exists
      const checkDetails = await db.all(
        "SELECT column_name FROM information_schema.columns WHERE table_name='trackings' AND column_name='details'"
      );

      if (checkDetails.length > 0) {
        return res.json({
          success: true,
          message: "Migration already complete - 'details' column exists",
          alreadyMigrated: true,
        });
      }

      // Check if notes column exists
      const checkNotes = await db.all(
        "SELECT column_name FROM information_schema.columns WHERE table_name='trackings' AND column_name='notes'"
      );

      if (checkNotes.length > 0) {
        // Rename notes to details
        await db.run("ALTER TABLE trackings RENAME COLUMN notes TO details");
        return res.json({
          success: true,
          message: "Successfully renamed 'notes' column to 'details'",
          action: "renamed",
        });
      } else {
        // Neither exists, add the column
        await db.run("ALTER TABLE trackings ADD COLUMN details TEXT");
        return res.json({
          success: true,
          message: "Successfully added 'details' column",
          action: "added",
        });
      }
    } catch (error) {
      console.error(
        `[${new Date().toISOString()}] ADMIN | Error during migration:`,
        error
      );
      res.status(500).json({
        error: "Migration failed",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
);

export default router;
