import { Router, Response } from "express";
import { ServiceManager } from "../../services/index.js";
import {
  authenticateToken,
  AuthRequest,
} from "../../middleware/authMiddleware.js";

const router = Router();

/**
 * Format a date string to GMT-3 (Buenos Aires timezone).
 * SQLite stores dates as UTC strings without timezone info, so we need to
 * explicitly treat them as UTC before converting to Buenos Aires timezone.
 * @param dateString - ISO date string or date string from database (UTC, no timezone)
 * @returns Formatted date string in YYYY-MM-DD HH:mm:ss format (GMT-3)
 * @internal
 */
function formatDateGMT3(dateString: string | null | undefined): string {
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

    // Convert to Buenos Aires timezone (GMT-3, handles DST automatically)
    const formatted = date.toLocaleString("en-US", {
      timeZone: "America/Buenos_Aires",
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
 * GET /api/debug
 * Get formatted debug log output showing all users, trackings and their reminders.
 * All dates are displayed in GMT-3 (Buenos Aires timezone).
 * @route GET /api/debug
 * @header {string} Authorization - Bearer token
 * @returns {Object} Object with formatted log text
 */
router.get("/", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const userService = ServiceManager.getUserService();
    const trackingService = ServiceManager.getTrackingService();
    const reminderService = ServiceManager.getReminderService();

    const users = await userService.getAllUsers();
    const trackings = await trackingService.getAllByUserId(userId);
    const reminders = await reminderService.getAllByUserId(userId);

    // Group reminders by tracking_id
    const remindersByTracking = new Map<number, typeof reminders>();
    reminders.forEach((reminder) => {
      const trackingReminders =
        remindersByTracking.get(reminder.tracking_id) || [];
      trackingReminders.push(reminder);
      remindersByTracking.set(reminder.tracking_id, trackingReminders);
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

        const userAttrs = [
          `ID=${user.id}`,
          `Name=${user.name}`,
          `Email=${user.email}`,
          `ProfilePicture=${user.profile_picture_url || "null"}`,
          `LastAccess=${formatDateGMT3(user.last_access)}`,
          `Created=${formatDateGMT3(user.created_at)}`,
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

        // Format schedules
        const schedulesStr =
          tracking.schedules && tracking.schedules.length > 0
            ? tracking.schedules
                .map(
                  (s) =>
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
          `Days=${tracking.days || "null"}`,
          `Schedules=[${schedulesStr}]`,
          `Notes=${tracking.notes || "null"}`,
          `Created=${formatDateGMT3(tracking.created_at)}`,
          `Updated=${formatDateGMT3(tracking.updated_at)}`,
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
            // Format scheduled time in GMT-3
            const scheduledTime = formatDateGMT3(reminder.scheduled_time);

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
              `Created=${formatDateGMT3(reminder.created_at)}`,
              `Updated=${formatDateGMT3(reminder.updated_at)}`,
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

    res.json({ log: lines.join("\n") });
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] DEBUG_ROUTE | Error generating debug log:`,
      error
    );
    res.status(500).json({ error: "Error generating debug log" });
  }
});

export default router;
