import { Database } from "../db/database.js";
import { Reminder, ReminderData, ReminderStatus } from "../models/Reminder.js";
import {
  Tracking,
  TrackingData,
  DaysPattern,
  DaysPatternType,
} from "../models/Tracking.js";
import { TrackingSchedule } from "../models/TrackingSchedule.js";

/**
 * Service for reminder-related database operations.
 * @public
 */
export class ReminderService {
  private db: Database;

  /**
   * Create a new ReminderService instance.
   * @param db - Database instance
   * @public
   */
  constructor(db: Database) {
    this.db = db;
  }

  /**
   * Get all reminders for a user.
   * @param userId - The user ID
   * @returns Promise resolving to array of reminder data
   * @public
   */
  async getRemindersByUserId(userId: number): Promise<ReminderData[]> {
    console.log(
      `[${new Date().toISOString()}] REMINDER | Fetching reminders for userId: ${userId}`
    );

    const reminders = await Reminder.loadByUserId(userId, this.db);

    console.log(
      `[${new Date().toISOString()}] REMINDER | Retrieved ${
        reminders.length
      } reminders for userId: ${userId}`
    );

    // Filter out orphaned reminders first (identify and separate valid from orphaned)
    const validReminders = await this.filterOrphanedReminders(reminders);
    const orphanedReminders = reminders.filter(
      (r) => !validReminders.some((vr) => vr.id === r.id)
    );

    // Clean up orphaned reminders (delete from database)
    if (orphanedReminders.length > 0) {
      await this.cleanupOrphanedReminders(orphanedReminders, userId);
    }

    // Check and update expired upcoming reminders (only on valid reminders)
    // This may create new Upcoming reminders, so we need to reload reminders after
    const hadExpiredReminders = validReminders.some(
      (r) =>
        r.status === ReminderStatus.UPCOMING &&
        new Date(r.scheduled_time) <= new Date()
    );
    await this.updateExpiredUpcomingReminders(validReminders);

    // If we updated expired reminders and created new ones, reload all reminders to include them
    let finalReminders = validReminders;
    if (hadExpiredReminders) {
      const reloadedReminders = await Reminder.loadByUserId(userId, this.db);
      const reloadedValidReminders = await this.filterOrphanedReminders(
        reloadedReminders
      );
      finalReminders = reloadedValidReminders;
      console.log(
        `[${new Date().toISOString()}] REMINDER | Reloaded reminders after creating new Upcoming reminders, now have ${
          finalReminders.length
        } reminders`
      );
    }

    // Return all reminders (including future ones) for tooltip display
    // Frontend will filter them for display in RemindersList
    console.log(
      `[${new Date().toISOString()}] REMINDER | Returning ${
        finalReminders.length
      } valid reminders for userId: ${userId} (frontend will filter for display)`
    );

    return finalReminders.map((reminder) => reminder.toData());
  }

  /**
   * Get a reminder by ID.
   * @param reminderId - The reminder ID
   * @param userId - The user ID (for authorization)
   * @returns Promise resolving to reminder data or null if not found
   * @public
   */
  async getReminderById(
    reminderId: number,
    userId: number
  ): Promise<ReminderData | null> {
    console.log(
      `[${new Date().toISOString()}] REMINDER | Fetching reminder by ID: ${reminderId} for userId: ${userId}`
    );

    const reminder = await Reminder.loadById(reminderId, userId, this.db);

    if (!reminder) {
      console.log(
        `[${new Date().toISOString()}] REMINDER | Reminder not found for ID: ${reminderId} and userId: ${userId}`
      );
      return null;
    }

    // Check and update expired upcoming reminder
    await this.updateExpiredUpcomingReminders([reminder]);

    console.log(
      `[${new Date().toISOString()}] REMINDER | Reminder found: ID ${
        reminder.id
      }`
    );

    return reminder.toData();
  }

  /**
   * Create a new reminder.
   * @param trackingId - The tracking ID
   * @param userId - The user ID
   * @param scheduledTime - The scheduled time (ISO datetime string)
   * @returns Promise resolving to created reminder data
   * @throws Error if validation fails
   * @public
   */
  async createReminder(
    trackingId: number,
    userId: number,
    scheduledTime: string
  ): Promise<ReminderData> {
    console.log(
      `[${new Date().toISOString()}] REMINDER | Creating reminder for trackingId: ${trackingId}, userId: ${userId}`
    );

    // Determine status based on scheduled time
    const now = new Date();
    const scheduledDate = new Date(scheduledTime);
    const status =
      scheduledDate > now ? ReminderStatus.UPCOMING : ReminderStatus.PENDING;

    const reminder = new Reminder({
      id: 0,
      tracking_id: trackingId,
      user_id: userId,
      scheduled_time: scheduledTime,
      status: status,
    });

    const savedReminder = await reminder.save(this.db);

    console.log(
      `[${new Date().toISOString()}] REMINDER | Reminder created successfully: ID ${
        savedReminder.id
      } with status ${status}`
    );

    return savedReminder;
  }

  /**
   * Update a reminder.
   * @param reminderId - The reminder ID
   * @param userId - The user ID (for authorization)
   * @param updates - Partial reminder data with fields to update
   * @returns Promise resolving to updated reminder data
   * @throws Error if reminder not found or validation fails
   * @public
   */
  async updateReminder(
    reminderId: number,
    userId: number,
    updates: Partial<ReminderData>
  ): Promise<ReminderData> {
    console.log(
      `[${new Date().toISOString()}] REMINDER | Updating reminder ID: ${reminderId} for userId: ${userId}`
    );

    const existingReminder = await Reminder.loadById(
      reminderId,
      userId,
      this.db
    );
    if (!existingReminder) {
      console.warn(
        `[${new Date().toISOString()}] REMINDER | Update failed: reminder not found for ID: ${reminderId} and userId: ${userId}`
      );
      throw new Error("Reminder not found");
    }

    const trackingId = existingReminder.tracking_id;
    const isBeingAnswered =
      updates.status === ReminderStatus.ANSWERED &&
      existingReminder.status !== ReminderStatus.ANSWERED;

    const updatedReminder = await existingReminder.update(updates, this.db);

    // If reminder was answered, create new Upcoming reminder
    if (isBeingAnswered) {
      try {
        await this.createNextReminderForTracking(trackingId, userId);
        console.log(
          `[${new Date().toISOString()}] REMINDER | Created new Upcoming reminder after answering reminder ID ${reminderId}`
        );
      } catch (error) {
        // Log error but don't fail reminder update if next reminder creation fails
        console.error(
          `[${new Date().toISOString()}] REMINDER | Failed to create next reminder after answering reminder ID ${reminderId}:`,
          error
        );
      }
    }

    console.log(
      `[${new Date().toISOString()}] REMINDER | Reminder updated successfully: ID ${reminderId}`
    );

    return updatedReminder;
  }

  /**
   * Snooze a reminder.
   * @param reminderId - The reminder ID
   * @param userId - The user ID (for authorization)
   * @param snoozeMinutes - Minutes to snooze
   * @returns Promise resolving to updated reminder data
   * @throws Error if reminder not found
   * @public
   */
  async snoozeReminder(
    reminderId: number,
    userId: number,
    snoozeMinutes: number
  ): Promise<ReminderData> {
    console.log(
      `[${new Date().toISOString()}] REMINDER | Snoozing reminder ID: ${reminderId} for ${snoozeMinutes} minutes`
    );

    const reminder = await Reminder.loadById(reminderId, userId, this.db);
    if (!reminder) {
      throw new Error("Reminder not found");
    }

    const now = new Date();
    const snoozedTime = new Date(now.getTime() + snoozeMinutes * 60 * 1000);
    const trackingId = reminder.tracking_id;

    // Find existing Upcoming reminder for this tracking
    const existingUpcoming = await Reminder.loadUpcomingByTrackingId(
      trackingId,
      userId,
      this.db
    );

    if (existingUpcoming) {
      // Update the existing Upcoming reminder's time
      const updatedReminder = await existingUpcoming.update(
        {
          scheduled_time: snoozedTime.toISOString(),
        },
        this.db
      );

      console.log(
        `[${new Date().toISOString()}] REMINDER | Updated existing Upcoming reminder time for tracking ${trackingId}`
      );

      return updatedReminder;
    } else {
      // No existing Upcoming reminder, create a new one with the snoozed time
      const newReminder = await this.createReminder(
        trackingId,
        userId,
        snoozedTime.toISOString()
      );

      console.log(
        `[${new Date().toISOString()}] REMINDER | Created new Upcoming reminder with snoozed time for tracking ${trackingId}`
      );

      return newReminder;
    }
  }

  /**
   * Delete a reminder and create the next one for its tracking.
   * @param reminderId - The reminder ID to delete
   * @param userId - The user ID (for authorization)
   * @returns Promise resolving when reminder is deleted and next one is created
   * @throws Error if reminder not found
   * @public
   */
  async deleteReminder(reminderId: number, userId: number): Promise<void> {
    console.log(
      `[${new Date().toISOString()}] REMINDER | Deleting reminder ID: ${reminderId} for userId: ${userId}`
    );

    const reminder = await Reminder.loadById(reminderId, userId, this.db);
    if (!reminder) {
      throw new Error("Reminder not found");
    }

    const trackingId = reminder.tracking_id;
    const deletedTime = reminder.scheduled_time;

    // Delete the reminder
    await reminder.delete(this.db);

    // Delete any existing Upcoming reminder for this tracking
    await Reminder.deleteUpcomingByTrackingId(trackingId, userId, this.db);

    // Create next reminder, excluding the deleted time
    await this.createNextReminderForTracking(trackingId, userId, deletedTime);

    console.log(
      `[${new Date().toISOString()}] REMINDER | Reminder deleted and next one created: ID ${reminderId}`
    );
  }

  /**
   * Calculate the next reminder time based on tracking schedules and days pattern.
   * @param tracking - The tracking data
   * @param excludeTime - Optional time to exclude (ISO datetime string)
   * @returns Promise resolving to ISO datetime string or null if no valid time found
   * @public
   */
  async calculateNextReminderTime(
    tracking: TrackingData,
    excludeTime?: string
  ): Promise<string | null> {
    if (!tracking.schedules || tracking.schedules.length === 0) {
      console.warn(
        `[${new Date().toISOString()}] REMINDER | Tracking ${
          tracking.id
        } has no schedules`
      );
      return null;
    }

    if (!tracking.days) {
      console.warn(
        `[${new Date().toISOString()}] REMINDER | Tracking ${
          tracking.id
        } has no days pattern`
      );
      return null;
    }

    const now = new Date();
    const excludeDate = excludeTime ? new Date(excludeTime) : null;
    const candidateTimes: Date[] = [];

    // Get all schedule times
    const schedules = tracking.schedules.map((s) => ({
      hour: s.hour,
      minutes: s.minutes,
    }));

    // Calculate next occurrence for each schedule based on days pattern
    for (const schedule of schedules) {
      const nextTime = this.calculateNextOccurrence(
        tracking.days,
        schedule.hour,
        schedule.minutes,
        now,
        excludeDate
      );
      if (nextTime) {
        candidateTimes.push(nextTime);
      }
    }

    if (candidateTimes.length === 0) {
      console.warn(
        `[${new Date().toISOString()}] REMINDER | No valid next time found for tracking ${
          tracking.id
        }`
      );
      return null;
    }

    // Return the earliest time
    const earliestTime = candidateTimes.reduce((earliest, current) =>
      current < earliest ? current : earliest
    );

    return earliestTime.toISOString();
  }

  /**
   * Calculate next occurrence for a specific schedule time based on days pattern.
   * @param daysPattern - The days pattern
   * @param hour - Hour (0-23)
   * @param minutes - Minutes (0-59)
   * @param fromDate - Start date to search from
   * @param excludeDate - Optional date to exclude
   * @returns Next occurrence date or null if not found
   * @private
   */
  private calculateNextOccurrence(
    daysPattern: DaysPattern,
    hour: number,
    minutes: number,
    fromDate: Date,
    excludeDate: Date | null
  ): Date | null {
    // Handle INTERVAL pattern separately
    if (daysPattern.pattern_type === DaysPatternType.INTERVAL) {
      return this.calculateNextIntervalOccurrence(
        daysPattern,
        hour,
        minutes,
        fromDate,
        excludeDate
      );
    }

    const maxIterations = 1000; // Prevent infinite loops
    let currentDate = new Date(fromDate);
    let iterations = 0;

    while (iterations < maxIterations) {
      iterations++;

      // Set the time for this date
      const candidateDate = new Date(currentDate);
      candidateDate.setHours(hour, minutes, 0, 0);

      // If candidate is in the past or equals excludeDate, move to next day
      if (candidateDate <= fromDate) {
        currentDate = new Date(currentDate);
        currentDate.setDate(currentDate.getDate() + 1);
        continue;
      }

      // Check if this date matches the excludeDate
      if (excludeDate && candidateDate.getTime() === excludeDate.getTime()) {
        currentDate = new Date(currentDate);
        currentDate.setDate(currentDate.getDate() + 1);
        continue;
      }

      // Check if this date matches the days pattern
      if (this.matchesDaysPattern(candidateDate, daysPattern)) {
        return candidateDate;
      }

      // Move to next day
      currentDate = new Date(currentDate);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return null;
  }

  /**
   * Calculate next occurrence for INTERVAL pattern.
   * @param daysPattern - The days pattern (must be INTERVAL type)
   * @param hour - Hour (0-23)
   * @param minutes - Minutes (0-59)
   * @param fromDate - Start date to search from
   * @param excludeDate - Optional date to exclude
   * @returns Next occurrence date or null if not found
   * @private
   */
  private calculateNextIntervalOccurrence(
    daysPattern: DaysPattern,
    hour: number,
    minutes: number,
    fromDate: Date,
    excludeDate: Date | null
  ): Date | null {
    if (!daysPattern.interval_value || !daysPattern.interval_unit) {
      return null;
    }

    // Calculate interval in milliseconds
    let intervalMs = 0;
    switch (daysPattern.interval_unit) {
      case "days":
        intervalMs = daysPattern.interval_value * 24 * 60 * 60 * 1000;
        break;
      case "weeks":
        intervalMs = daysPattern.interval_value * 7 * 24 * 60 * 60 * 1000;
        break;
      case "months":
        // Approximate months as 30 days
        intervalMs = daysPattern.interval_value * 30 * 24 * 60 * 60 * 1000;
        break;
      case "years":
        // Approximate years as 365 days
        intervalMs = daysPattern.interval_value * 365 * 24 * 60 * 60 * 1000;
        break;
      default:
        return null;
    }

    // Start from the base date with the schedule time
    const baseDate = new Date(fromDate);
    baseDate.setHours(hour, minutes, 0, 0);

    // If base date is in the past, add one interval
    if (baseDate <= fromDate) {
      baseDate.setTime(baseDate.getTime() + intervalMs);
    }

    // Check if base date matches excludeDate, if so add one more interval
    if (excludeDate && baseDate.getTime() === excludeDate.getTime()) {
      baseDate.setTime(baseDate.getTime() + intervalMs);
    }

    return baseDate;
  }

  /**
   * Check if a date matches the days pattern.
   * @param date - The date to check
   * @param pattern - The days pattern
   * @returns True if date matches pattern
   * @private
   */
  private matchesDaysPattern(date: Date, pattern: DaysPattern): boolean {
    switch (pattern.pattern_type) {
      case DaysPatternType.INTERVAL:
        // For interval patterns, we check if enough time has passed
        // This is handled in calculateNextOccurrence by advancing days
        return true;

      case DaysPatternType.DAY_OF_WEEK:
        if (!pattern.days || pattern.days.length === 0) {
          return false;
        }
        const dayOfWeek = date.getDay(); // 0=Sunday, 6=Saturday
        return pattern.days.includes(dayOfWeek);

      case DaysPatternType.DAY_OF_MONTH:
        if (!pattern.type) {
          return false;
        }
        if (pattern.type === "day_number") {
          if (!pattern.day_numbers || pattern.day_numbers.length === 0) {
            return false;
          }
          const dayOfMonth = date.getDate();
          return pattern.day_numbers.includes(dayOfMonth);
        } else if (pattern.type === "last_day") {
          const lastDayOfMonth = new Date(
            date.getFullYear(),
            date.getMonth() + 1,
            0
          ).getDate();
          return date.getDate() === lastDayOfMonth;
        } else if (pattern.type === "weekday_ordinal") {
          if (pattern.weekday === undefined || pattern.ordinal === undefined) {
            return false;
          }
          return this.isNthWeekdayOfMonth(
            date,
            pattern.weekday,
            pattern.ordinal
          );
        }
        return false;

      case DaysPatternType.DAY_OF_YEAR:
        if (!pattern.type) {
          return false;
        }
        // TypeScript doesn't narrow properly, so we check the string value
        const dayOfYearType = pattern.type as "date" | "weekday_ordinal";
        if (dayOfYearType === "date") {
          if (pattern.month === undefined || pattern.day === undefined) {
            return false;
          }
          return (
            date.getMonth() + 1 === pattern.month &&
            date.getDate() === pattern.day
          );
        } else if (dayOfYearType === "weekday_ordinal") {
          if (pattern.weekday === undefined || pattern.ordinal === undefined) {
            return false;
          }
          return this.isNthWeekdayOfYear(
            date,
            pattern.weekday,
            pattern.ordinal
          );
        }
        return false;

      default:
        return false;
    }
  }

  /**
   * Check if a date is the nth weekday of the month.
   * @param date - The date to check
   * @param weekday - Weekday (0=Sunday, 6=Saturday)
   * @param ordinal - Ordinal (1-5)
   * @returns True if date is the nth weekday of the month
   * @private
   */
  private isNthWeekdayOfMonth(
    date: Date,
    weekday: number,
    ordinal: number
  ): boolean {
    if (date.getDay() !== weekday) {
      return false;
    }

    const firstDayOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    const firstWeekday = firstDayOfMonth.getDay();
    const daysToFirstOccurrence = (weekday - firstWeekday + 7) % 7;
    const firstOccurrence = new Date(firstDayOfMonth);
    firstOccurrence.setDate(firstDayOfMonth.getDate() + daysToFirstOccurrence);

    const occurrenceNumber =
      Math.floor((date.getDate() - firstOccurrence.getDate()) / 7) + 1;

    return occurrenceNumber === ordinal;
  }

  /**
   * Check if a date is the nth weekday of the year.
   * @param date - The date to check
   * @param weekday - Weekday (0=Sunday, 6=Saturday)
   * @param ordinal - Ordinal (1-5)
   * @returns True if date is the nth weekday of the year
   * @private
   */
  private isNthWeekdayOfYear(
    date: Date,
    weekday: number,
    ordinal: number
  ): boolean {
    if (date.getDay() !== weekday) {
      return false;
    }

    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const firstWeekday = firstDayOfYear.getDay();
    const daysToFirstOccurrence = (weekday - firstWeekday + 7) % 7;
    const firstOccurrence = new Date(firstDayOfYear);
    firstOccurrence.setDate(firstDayOfYear.getDate() + daysToFirstOccurrence);

    const dayOfYear = Math.floor(
      (date.getTime() - firstDayOfYear.getTime()) / (1000 * 60 * 60 * 24)
    );
    const occurrenceNumber =
      Math.floor((dayOfYear - daysToFirstOccurrence) / 7) + 1;

    return occurrenceNumber === ordinal;
  }

  /**
   * Clean up orphaned reminders (reminders whose tracking no longer exists).
   * @param reminders - Array of reminder instances that are already identified as orphaned
   * @param userId - The user ID
   * @returns Promise resolving when cleanup is complete
   * @private
   */
  private async cleanupOrphanedReminders(
    reminders: Reminder[],
    userId: number
  ): Promise<void> {
    if (reminders.length === 0) {
      return;
    }

    console.log(
      `[${new Date().toISOString()}] REMINDER | Cleaning up ${
        reminders.length
      } orphaned reminder(s)...`
    );

    // Delete orphaned reminders directly (they're already identified as orphaned)
    for (const reminder of reminders) {
      try {
        await reminder.delete(this.db);
        console.log(
          `[${new Date().toISOString()}] REMINDER | Deleted orphaned reminder ID: ${
            reminder.id
          }`
        );
      } catch (error) {
        console.error(
          `[${new Date().toISOString()}] REMINDER | Error deleting orphaned reminder ID ${
            reminder.id
          }:`,
          error
        );
      }
    }

    console.log(
      `[${new Date().toISOString()}] REMINDER | Cleaned up ${
        reminders.length
      } orphaned reminder(s)`
    );
  }

  /**
   * Filter out orphaned reminders (reminders whose tracking no longer exists).
   * @param reminders - Array of reminder instances to filter
   * @returns Promise resolving to array of valid reminders
   * @private
   */
  private async filterOrphanedReminders(
    reminders: Reminder[]
  ): Promise<Reminder[]> {
    const validReminders: Reminder[] = [];

    for (const reminder of reminders) {
      const tracking = await Tracking.loadById(
        reminder.tracking_id,
        reminder.user_id,
        this.db
      );
      if (tracking) {
        validReminders.push(reminder);
      }
    }

    return validReminders;
  }

  /**
   * Check and update expired upcoming reminders to Pending status.
   * Also creates new Upcoming reminders for trackings whose reminders became Pending.
   * @param reminders - Array of reminder instances to check
   * @returns Promise resolving when all updates are complete
   * @private
   */
  private async updateExpiredUpcomingReminders(
    reminders: Reminder[]
  ): Promise<void> {
    const now = new Date();
    const updatePromises: Promise<ReminderData>[] = [];
    const trackingIdsToCreateNext: Set<number> = new Set();
    const userIdsByTrackingId: Map<number, number> = new Map();

    for (const reminder of reminders) {
      if (reminder.status === ReminderStatus.UPCOMING) {
        const scheduledTime = new Date(reminder.scheduled_time);
        if (scheduledTime <= now) {
          console.log(
            `[${new Date().toISOString()}] REMINDER | Updating expired upcoming reminder ID ${
              reminder.id
            } to Pending status`
          );
          updatePromises.push(
            reminder.update({ status: ReminderStatus.PENDING }, this.db)
          );
          // Track which trackings need a new Upcoming reminder created
          trackingIdsToCreateNext.add(reminder.tracking_id);
          userIdsByTrackingId.set(reminder.tracking_id, reminder.user_id);
        }
      }
    }

    if (updatePromises.length > 0) {
      await Promise.all(updatePromises);
      console.log(
        `[${new Date().toISOString()}] REMINDER | Updated ${
          updatePromises.length
        } expired upcoming reminder(s) to Pending status`
      );

      // Create new Upcoming reminders for trackings whose reminders became Pending
      for (const trackingId of trackingIdsToCreateNext) {
        const userId = userIdsByTrackingId.get(trackingId);
        if (userId) {
          try {
            await this.createNextReminderForTracking(trackingId, userId);
            console.log(
              `[${new Date().toISOString()}] REMINDER | Created new Upcoming reminder for tracking ${trackingId} after expired reminder became Pending`
            );
          } catch (error) {
            // Log error but don't fail the update process
            console.error(
              `[${new Date().toISOString()}] REMINDER | Failed to create next reminder for tracking ${trackingId} after expired reminder became Pending:`,
              error
            );
          }
        }
      }
    }
  }

  /**
   * Create the next reminder for a tracking.
   * @param trackingId - The tracking ID
   * @param userId - The user ID
   * @param excludeTime - Optional time to exclude (ISO datetime string)
   * @returns Promise resolving to created reminder data or null if no valid time found
   * @public
   */
  async createNextReminderForTracking(
    trackingId: number,
    userId: number,
    excludeTime?: string
  ): Promise<ReminderData | null> {
    console.log(
      `[${new Date().toISOString()}] REMINDER | Creating next reminder for trackingId: ${trackingId}`
    );

    // Load tracking first to check state
    const tracking = await Tracking.loadById(trackingId, userId, this.db);
    if (!tracking) {
      console.warn(
        `[${new Date().toISOString()}] REMINDER | Tracking not found: ${trackingId}`
      );
      return null;
    }

    // Only create reminder for Running trackings
    if (tracking.state !== "Running") {
      console.log(
        `[${new Date().toISOString()}] REMINDER | Tracking ${trackingId} is not Running, skipping reminder creation`
      );
      return null;
    }

    // Calculate next reminder time first
    const nextTime = await this.calculateNextReminderTime(
      tracking.toData(),
      excludeTime
    );

    if (!nextTime) {
      console.warn(
        `[${new Date().toISOString()}] REMINDER | No valid next time found for tracking ${trackingId}`
      );
      return null;
    }

    // Delete any existing Upcoming reminders for this tracking to ensure only one
    const deletedCount = await Reminder.deleteUpcomingByTrackingId(
      trackingId,
      userId,
      this.db
    );

    if (deletedCount > 0) {
      console.log(
        `[${new Date().toISOString()}] REMINDER | Deleted ${deletedCount} existing Upcoming reminder(s) for trackingId: ${trackingId} to ensure uniqueness`
      );
    }

    // Create the new unique future reminder (will be created with UPCOMING status if time is in future)
    const reminder = await this.createReminder(trackingId, userId, nextTime);

    console.log(
      `[${new Date().toISOString()}] REMINDER | Next reminder created: ID ${
        reminder.id
      } for tracking ${trackingId}`
    );

    return reminder;
  }
}
