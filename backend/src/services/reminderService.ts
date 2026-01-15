import { Database } from "../db/database.js";
import {
  Reminder,
  type ReminderData,
  ReminderStatus,
  ReminderValue,
} from "../models/Reminder.js";
import {
  Tracking,
  type TrackingData,
  type Frequency,
} from "../models/Tracking.js";
import { TrackingSchedule } from "../models/TrackingSchedule.js";
import { User } from "../models/User.js";
import { BaseEntityService } from "./base/BaseEntityService.js";
import { ReminderLifecycleManager } from "./lifecycle/ReminderLifecycleManager.js";
import { ServiceManager } from "./index.js";
import { Logger } from "../setup/logger.js";

/**
 * Service for reminder-related database operations.
 * @public
 */
export class ReminderService extends BaseEntityService<ReminderData, Reminder> {
  private lifecycleManager: ReminderLifecycleManager;

  /**
   * Create a new ReminderService instance.
   * @param db - Database instance
   * @public
   */
  constructor(db: Database) {
    super(db);
    this.lifecycleManager = new ReminderLifecycleManager(this, db);
  }

  /**
   * Load entity model by ID.
   * @param id - The reminder ID
   * @param userId - The user ID (for authorization)
   * @returns Promise resolving to reminder model or null if not found
   * @protected
   */
  protected async loadModelById(
    id: number,
    userId: number
  ): Promise<Reminder | null> {
    return await Reminder.loadById(id, userId, this.db);
  }

  /**
   * Load all entity models for a user (active reminders only, excludes Answered).
   * @param userId - The user ID
   * @returns Promise resolving to array of reminder models (Pending and Upcoming only)
   * @protected
   */
  protected async loadModelsByUserId(userId: number): Promise<Reminder[]> {
    return await Reminder.loadActiveByUserId(userId, this.db);
  }

  /**
   * Convert entity model to data object.
   * @param model - The reminder model instance
   * @returns Reminder data object
   * @protected
   */
  protected toData(model: Reminder): ReminderData {
    return model.toData();
  }

  /**
   * Get entity name for logging purposes.
   * @returns Entity name
   * @protected
   */
  protected getEntityName(): string {
    return "REMINDER";
  }

  /**
   * Get all reminders for a user.
   * Overrides base method to include custom filtering and cleanup logic.
   * @param userId - The user ID
   * @returns Promise resolving to array of reminder data
   * @public
   */
  async getAllByUserId(userId: number): Promise<ReminderData[]> {
    Logger.debug(`REMINDER | Fetching reminders for userId: ${userId}`);

    const reminders = await this.loadModelsByUserId(userId);

    Logger.debug(
      `REMINDER | Retrieved ${reminders.length} reminders for userId: ${userId}`
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
      const reloadedReminders = await this.loadModelsByUserId(userId);
      const reloadedValidReminders = await this.filterOrphanedReminders(
        reloadedReminders
      );
      finalReminders = reloadedValidReminders;
      Logger.debug(
        `REMINDER | Reloaded reminders after creating new Upcoming reminders, now have ${finalReminders.length} reminders`
      );
    }

    // Return active reminders (Pending and Upcoming only, Answered are excluded)
    Logger.debug(
      `REMINDER | Returning ${finalReminders.length} active reminders for userId: ${userId} (Answered reminders excluded)`
    );

    return finalReminders.map((reminder) => this.toData(reminder));
  }

  /**
   * Get reminder by ID.
   * Overrides base class to add custom expired reminder handling.
   * @param id - The reminder ID
   * @param userId - The user ID (for authorization)
   * @returns Promise resolving to reminder data or null if not found
   * @public
   */
  async getById(id: number, userId: number): Promise<ReminderData | null> {
    Logger.debug(`REMINDER | Fetching reminder by ID: ${id} for userId: ${userId}`);

    const reminder = await this.loadModelById(id, userId);

    if (!reminder) {
      Logger.debug(`REMINDER | Reminder not found for ID: ${id} and userId: ${userId}`);
      return null;
    }

    // Check and update expired upcoming reminder
    await this.updateExpiredUpcomingReminders([reminder]);

    Logger.verbose(`REMINDER | Reminder found: ID ${reminder.id}`);

    return this.toData(reminder);
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
    Logger.info(`REMINDER | Creating reminder for trackingId: ${trackingId}, userId: ${userId}`);

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
      value: null,
    });

    const savedReminder = await reminder.save(this.db);

    Logger.info(
      `REMINDER | Reminder created successfully: ID ${savedReminder.id} with status ${status}`
    );

    // Send notifications if reminder is created as Pending
    // Note: Only send notifications if this is a newly created reminder with PENDING status.
    // updateExpiredUpcomingReminders handles notifications for reminders transitioning from UPCOMING to PENDING.
    if (status === ReminderStatus.PENDING) {
      try {
        await this.sendReminderNotifications(savedReminder);
      } catch (error) {
        // Log error but don't fail reminder creation
        Logger.error(
          `REMINDER | Failed to send notifications for newly created reminder ID ${savedReminder.id}:`,
          error
        );
      }
    }

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
    Logger.info(`REMINDER | Updating reminder ID: ${reminderId} for userId: ${userId}`);

    const existingReminder = await Reminder.loadById(
      reminderId,
      userId,
      this.db
    );
    if (!existingReminder) {
      Logger.warn(
        `REMINDER | Update failed: reminder not found for ID: ${reminderId} and userId: ${userId}`
      );
      throw new Error("Reminder not found");
    }

    const existingStatus = existingReminder.status;
    const newStatus =
      updates.status !== undefined ? updates.status : existingStatus;

    // Validate status transition if status is being changed
    if (newStatus !== existingStatus) {
      await this.lifecycleManager.transition(
        existingReminder.toData(),
        newStatus
      );
    }

    const updatedReminder = await existingReminder.update(updates, this.db);

    // Execute lifecycle hooks after status change if status changed
    if (newStatus !== existingStatus) {
      await this.lifecycleManager.afterStateChange(
        updatedReminder,
        existingStatus,
        newStatus
      );
    }

    Logger.info(`REMINDER | Reminder updated successfully: ID ${reminderId}`);

    return updatedReminder;
  }

  /**
   * Complete a reminder.
   * Sets status to ANSWERED and value to COMPLETED, then creates a new upcoming reminder.
   * @param reminderId - The reminder ID
   * @param userId - The user ID (for authorization)
   * @returns Promise resolving to updated reminder data
   * @throws Error if reminder not found
   * @public
   */
  async completeReminder(
    reminderId: number,
    userId: number
  ): Promise<ReminderData> {
    Logger.info(`REMINDER | Completing reminder ID: ${reminderId} for userId: ${userId}`);

    const existingReminder = await Reminder.loadById(
      reminderId,
      userId,
      this.db
    );
    if (!existingReminder) {
      Logger.warn(
        `REMINDER | Complete failed: reminder not found for ID: ${reminderId} and userId: ${userId}`
      );
      throw new Error("Reminder not found");
    }

    const existingStatus = existingReminder.status;

    // Validate status transition
    if (existingStatus !== ReminderStatus.ANSWERED) {
      await this.lifecycleManager.transition(
        existingReminder.toData(),
        ReminderStatus.ANSWERED
      );
    }

    const updatedReminder = await existingReminder.update(
      {
        status: ReminderStatus.ANSWERED,
        value: ReminderValue.COMPLETED,
      },
      this.db
    );

    // Execute lifecycle hooks after status change
    if (existingStatus !== ReminderStatus.ANSWERED) {
      await this.lifecycleManager.afterStateChange(
        updatedReminder,
        existingStatus,
        ReminderStatus.ANSWERED
      );
    }

    Logger.info(`REMINDER | Reminder completed successfully: ID ${reminderId}`);

    return updatedReminder;
  }

  /**
   * Dismiss a reminder.
   * Sets status to ANSWERED and value to DISMISSED, then creates a new upcoming reminder.
   * @param reminderId - The reminder ID
   * @param userId - The user ID (for authorization)
   * @returns Promise resolving to updated reminder data
   * @throws Error if reminder not found
   * @public
   */
  async dismissReminder(
    reminderId: number,
    userId: number
  ): Promise<ReminderData> {
    Logger.info(`REMINDER | Dismissing reminder ID: ${reminderId} for userId: ${userId}`);

    const reminder = await Reminder.loadById(reminderId, userId, this.db);
    if (!reminder) {
      Logger.warn(
        `REMINDER | Dismiss failed: reminder not found for ID: ${reminderId} and userId: ${userId}`
      );
      throw new Error("Reminder not found");
    }

    const trackingId = reminder.tracking_id;
    const dismissedTime = reminder.scheduled_time;
    const existingStatus = reminder.status;

    // Validate status transition
    if (existingStatus !== ReminderStatus.ANSWERED) {
      await this.lifecycleManager.transition(
        reminder.toData(),
        ReminderStatus.ANSWERED
      );
    }

    // Update reminder to ANSWERED with DISMISSED value
    const updatedReminder = await reminder.update(
      {
        status: ReminderStatus.ANSWERED,
        value: ReminderValue.DISMISSED,
      },
      this.db
    );

    // Note: We don't call lifecycle hook here because dismissReminder has custom logic
    // below for updating existing upcoming reminders, which is more optimized than
    // creating a new one. The lifecycle validation above ensures the transition is valid.

    // Create new upcoming reminder (same logic as deleteReminder)
    try {
      // Check if there's an existing Upcoming reminder for this tracking
      const existingUpcoming = await Reminder.loadUpcomingByTrackingId(
        trackingId,
        userId,
        this.db
      );

      if (existingUpcoming) {
        // Update the existing upcoming reminder with the new time
        const tracking = await Tracking.loadById(trackingId, userId, this.db);
        if (!tracking) {
          Logger.warn(
            `REMINDER | Tracking not found: ${trackingId}, cannot update upcoming reminder`
          );
          return updatedReminder;
        }

        // Only update if tracking is Running
        if (tracking.state !== "Running") {
          Logger.debug(
            `REMINDER | Tracking ${trackingId} is not Running, deleting upcoming reminder instead of updating`
          );
          await existingUpcoming.delete(this.db);
          return updatedReminder;
        }

        // Check if tracking has frequency (required field, but check for safety)
        const trackingData = tracking.toData();
        if (!trackingData.frequency) {
          Logger.warn(
            `REMINDER | Tracking ${trackingId} has no frequency, cannot update upcoming reminder`
          );
          return updatedReminder;
        }

        // One-time frequencies don't generate recurring reminders
        if (trackingData.frequency.type === "one-time") {
          Logger.debug(
            `REMINDER | Tracking ${trackingId} is one-time, skipping upcoming reminder update`
          );
          return updatedReminder;
        }

        const nextTime = await this.calculateNextReminderTime(
          tracking.toData(),
          dismissedTime
        );

        if (nextTime) {
          existingUpcoming.scheduled_time = nextTime;
          await existingUpcoming.save(this.db);
          Logger.info(
            `REMINDER | Updated existing Upcoming reminder with new time after dismissing reminder ID ${reminderId}`
          );
        }
      } else {
        // Create new upcoming reminder
        await this.createNextReminderForTracking(trackingId, userId);
        Logger.info(
          `REMINDER | Created new Upcoming reminder after dismissing reminder ID ${reminderId}`
        );
      }
    } catch (error) {
      // Log error but don't fail reminder update if next reminder creation fails
      Logger.error(
        `REMINDER | Failed to create/update next reminder after dismissing reminder ID ${reminderId}:`,
        error
      );
    }

    Logger.info(`REMINDER | Reminder dismissed successfully: ID ${reminderId}`);

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
    Logger.info(`REMINDER | Snoozing reminder ID: ${reminderId} for ${snoozeMinutes} minutes`);

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

    let resultReminder: ReminderData;

    if (existingUpcoming) {
      // Update the existing Upcoming reminder's time
      const updatedReminder = await existingUpcoming.update(
        {
          scheduled_time: snoozedTime.toISOString(),
        },
        this.db
      );

      Logger.info(`REMINDER | Updated existing Upcoming reminder time for tracking ${trackingId}`);

      resultReminder = updatedReminder;
    } else {
      // No existing Upcoming reminder, create a new one with the snoozed time
      const newReminder = await this.createReminder(
        trackingId,
        userId,
        snoozedTime.toISOString()
      );

      Logger.info(`REMINDER | Created new Upcoming reminder with snoozed time for tracking ${trackingId}`);

      resultReminder = newReminder;
    }

    // Delete the original reminder that was snoozed
    // This ensures pending reminders are removed when snoozed
    await reminder.delete(this.db);
    Logger.info(`REMINDER | Deleted original reminder ID ${reminderId} after snoozing`);

    return resultReminder;
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
    Logger.info(`REMINDER | Deleting reminder ID: ${reminderId} for userId: ${userId}`);

    const reminder = await Reminder.loadById(reminderId, userId, this.db);
    if (!reminder) {
      throw new Error("Reminder not found");
    }

    const trackingId = reminder.tracking_id;
    const deletedTime = reminder.scheduled_time;

    // Delete the reminder
    await reminder.delete(this.db);

    // Check if there's an existing Upcoming reminder for this tracking
    const existingUpcoming = await Reminder.loadUpcomingByTrackingId(
      trackingId,
      userId,
      this.db
    );

    if (existingUpcoming) {
      // Update the existing upcoming reminder with the new time
      const tracking = await Tracking.loadById(trackingId, userId, this.db);
      if (!tracking) {
        Logger.warn(
          `REMINDER | Tracking not found: ${trackingId}, cannot update upcoming reminder`
        );
        return;
      }

      // Only update if tracking is Running
      if (tracking.state !== "Running") {
        Logger.debug(
          `REMINDER | Tracking ${trackingId} is not Running, deleting upcoming reminder instead of updating`
        );
        await existingUpcoming.delete(this.db);
        return;
      }

      // Calculate next reminder time, excluding the deleted time
      const nextTime = await this.calculateNextReminderTime(
        tracking.toData(),
        deletedTime
      );

      if (nextTime) {
        const now = new Date();
        const nextTimeDate = new Date(nextTime);
        // Update the existing reminder's scheduled_time
        // Status should remain UPCOMING if the new time is still in the future
        const status =
          nextTimeDate > now ? ReminderStatus.UPCOMING : ReminderStatus.PENDING;

        const updatedReminder = await existingUpcoming.update(
          { scheduled_time: nextTime, status: status },
          this.db
        );

        // Send notifications if reminder was updated to PENDING
        if (status === ReminderStatus.PENDING) {
          try {
            await this.sendReminderNotifications(updatedReminder);
          } catch (error) {
            // Log error but don't fail the update
            Logger.error(
              `REMINDER | Failed to send notifications for reminder ID ${existingUpcoming.id} after deleteReminder updated it to PENDING:`,
              error
            );
          }
        }

        Logger.info(
          `REMINDER | Updated existing upcoming reminder ID ${existingUpcoming.id} with new time for tracking ${trackingId}`
        );
      } else {
        // No valid next time found, delete the upcoming reminder
        Logger.warn(
          `REMINDER | No valid next time found for tracking ${trackingId}, deleting upcoming reminder`
        );
        await existingUpcoming.delete(this.db);
      }
    } else {
      // No existing upcoming reminder, create a new one
      await this.createNextReminderForTracking(trackingId, userId, deletedTime);
    }

    Logger.info(`REMINDER | Reminder deleted and next one handled: ID ${reminderId}`);
  }

  /**
   * Calculate the next reminder time for a one-time tracking.
   * Finds the next unused schedule time on the same date.
   * @param tracking - The tracking data (must be one-time)
   * @param excludeTime - Optional time to exclude (ISO datetime string)
   * @returns Promise resolving to ISO datetime string or null if no valid time found
   * @private
   */
  private async calculateNextOneTimeReminderTime(
    tracking: TrackingData,
    excludeTime?: string
  ): Promise<string | null> {
    if (!tracking.schedules || tracking.schedules.length === 0) {
      Logger.warn(`REMINDER | One-time tracking ${tracking.id} has no schedules`);
      return null;
    }

    if (!tracking.frequency || tracking.frequency.type !== "one-time") {
      Logger.warn(
        `REMINDER | calculateNextOneTimeReminderTime called for non-one-time tracking ${tracking.id}`
      );
      return null;
    }

    // Get all existing reminders for this tracking
    const existingReminders = await this.db.all<{ scheduled_time: string }>(
      "SELECT scheduled_time FROM reminders WHERE tracking_id = ? AND user_id = ?",
      [tracking.id, tracking.user_id]
    );

    // Normalize existing times to ISO format for comparison
    const existingTimes = new Set(
      existingReminders.map((r) => new Date(r.scheduled_time).toISOString())
    );

    // Extract date from frequency.date (YYYY-MM-DD format)
    const targetDate = tracking.frequency.date;
    const now = new Date();
    const excludeDate = excludeTime ? new Date(excludeTime) : now;

    // Build candidate times for all schedule times on the target date
    const candidateTimes: Date[] = [];

    for (const schedule of tracking.schedules) {
      // Construct date explicitly in local time to avoid timezone issues
      // Parse date string (YYYY-MM-DD format) and create Date object in local timezone
      const [year, month, day] = targetDate.split("-").map(Number);
      const candidateDate = new Date(
        year,
        month - 1,
        day,
        schedule.hour,
        schedule.minutes,
        0
      );

      // Check if this time already has a reminder
      // Create the time string the same way reminders are created (local time, then normalized to ISO)
      // This matches how createReminder handles time strings like "2024-01-07T09:00:00"
      const timeString = `${targetDate}T${String(schedule.hour).padStart(2, "0")}:${String(schedule.minutes).padStart(2, "0")}:00`;
      const normalizedTime = new Date(timeString).toISOString();

      // Check if any existing reminder matches this time
      if (existingTimes.has(normalizedTime)) {
        continue; // Skip times that already have reminders
      }

      // Only include times that are after the exclude time (or current time)
      // Use the normalized time for comparison to ensure consistency
      // Normalize excludeDate to ISO string for accurate comparison
      const excludeTimeISO = excludeTime ? new Date(excludeTime).toISOString() : null;
      const normalizedCandidateDate = new Date(normalizedTime);
      const shouldInclude = excludeTimeISO
        ? normalizedTime > excludeTimeISO
        : normalizedCandidateDate > excludeDate;

      if (shouldInclude) {
        candidateTimes.push(normalizedCandidateDate);
      }
    }

    if (candidateTimes.length === 0) {
      Logger.debug(
        `REMINDER | No more schedule times available for one-time tracking ${tracking.id}`
      );
      return null;
    }

    // Return the earliest remaining time
    const earliestTime = candidateTimes.reduce((earliest, current) =>
      current < earliest ? current : earliest
    );

    return earliestTime.toISOString();
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
      Logger.warn(`REMINDER | Tracking ${tracking.id} has no schedules`);
      return null;
    }

    if (!tracking.frequency) {
      Logger.warn(`REMINDER | Tracking ${tracking.id} has no frequency`);
      return null;
    }

    // Handle one-time frequencies separately
    if (tracking.frequency.type === "one-time") {
      return await this.calculateNextOneTimeReminderTime(tracking, excludeTime);
    }

    // Fetch user's timezone from database
    const userRow = await this.db.get<{ timezone: string | null }>(
      "SELECT timezone FROM users WHERE id = ?",
      [tracking.user_id]
    );
    const userTimezone = userRow?.timezone || undefined;

    const now = new Date();
    const excludeDate = excludeTime ? new Date(excludeTime) : null;
    const candidateTimes: Date[] = [];

    // Get all schedule times
    const schedules = tracking.schedules.map((s) => ({
      hour: s.hour,
      minutes: s.minutes,
    }));

    // Calculate next occurrence for each schedule based on frequency
    for (const schedule of schedules) {
      const nextTime = this.calculateNextOccurrence(
        tracking.frequency,
        schedule.hour,
        schedule.minutes,
        now,
        excludeDate,
        userTimezone
      );
      if (nextTime) {
        candidateTimes.push(nextTime);
      }
    }

    if (candidateTimes.length === 0) {
      console.warn(
        `[${new Date().toISOString()}] REMINDER | No valid next time found for tracking ${tracking.id
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
   * Calculate next occurrence for a specific schedule time based on frequency.
   * Uses user's timezone to determine day boundaries, weekdays, etc.
   * @param frequency - The frequency pattern
   * @param hour - Hour (0-23) in user's timezone
   * @param minutes - Minutes (0-59)
   * @param fromDate - Start date to search from (UTC)
   * @param excludeDate - Optional date to exclude (UTC)
   * @param userTimezone - User's timezone (optional, defaults to UTC)
   * @returns Next occurrence date (UTC) or null if not found
   * @private
   */
  private calculateNextOccurrence(
    frequency: Frequency,
    hour: number,
    minutes: number,
    fromDate: Date,
    excludeDate: Date | null,
    userTimezone?: string
  ): Date | null {
    // Handle daily frequency - every day
    if (frequency.type === "daily") {
      // Get current date in user's timezone
      const currentDateParts = this.getDatePartsInTimezone(
        fromDate,
        userTimezone
      );

      // Create candidate date with user's current date and desired time
      let candidateUtc = this.createUtcDateFromTimezone(
        currentDateParts.year,
        currentDateParts.month,
        currentDateParts.day,
        hour,
        minutes,
        userTimezone
      );

      // If candidate is in the past, move to tomorrow (in user's timezone)
      if (candidateUtc <= fromDate) {
        candidateUtc = this.createUtcDateFromTimezone(
          currentDateParts.year,
          currentDateParts.month,
          currentDateParts.day + 1,
          hour,
          minutes,
          userTimezone
        );
      }

      // Check if this date matches the excludeDate
      if (excludeDate && candidateUtc.getTime() === excludeDate.getTime()) {
        candidateUtc = this.createUtcDateFromTimezone(
          currentDateParts.year,
          currentDateParts.month,
          currentDateParts.day + 2,
          hour,
          minutes,
          userTimezone
        );
      }

      return candidateUtc;
    }

    const maxIterations = 1000; // Prevent infinite loops
    let currentDateParts = this.getDatePartsInTimezone(fromDate, userTimezone);
    let iterations = 0;

    while (iterations < maxIterations) {
      iterations++;

      // Create candidate date with current date and desired time in user's timezone
      const candidateUtc = this.createUtcDateFromTimezone(
        currentDateParts.year,
        currentDateParts.month,
        currentDateParts.day,
        hour,
        minutes,
        userTimezone
      );

      // If candidate is in the past, move to next day
      if (candidateUtc <= fromDate) {
        currentDateParts = this.getDatePartsInTimezone(
          new Date(candidateUtc.getTime() + 24 * 60 * 60 * 1000),
          userTimezone
        );
        continue;
      }

      // Check if this date matches the excludeDate
      if (excludeDate && candidateUtc.getTime() === excludeDate.getTime()) {
        currentDateParts = this.getDatePartsInTimezone(
          new Date(candidateUtc.getTime() + 24 * 60 * 60 * 1000),
          userTimezone
        );
        continue;
      }

      // Check if this date matches the frequency pattern
      if (this.matchesFrequency(candidateUtc, frequency, userTimezone)) {
        return candidateUtc;
      }

      // Move to next day
      currentDateParts = this.getDatePartsInTimezone(
        new Date(candidateUtc.getTime() + 24 * 60 * 60 * 1000),
        userTimezone
      );
    }

    return null;
  }

  /**
   * Get date parts (year, month, day, weekday) in a specific timezone.
   * @param date - UTC date
   * @param timezone - Target timezone (optional, defaults to UTC)
   * @returns Date parts in the target timezone
   * @private
   */
  private getDatePartsInTimezone(
    date: Date,
    timezone?: string
  ): { year: number; month: number; day: number; weekday: number } {
    if (!timezone) {
      return {
        year: date.getUTCFullYear(),
        month: date.getUTCMonth() + 1,
        day: date.getUTCDate(),
        weekday: date.getUTCDay(),
      };
    }

    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
    });

    const parts = formatter.formatToParts(date);
    const year = parseInt(parts.find((p) => p.type === "year")!.value);
    const month = parseInt(parts.find((p) => p.type === "month")!.value);
    const day = parseInt(parts.find((p) => p.type === "day")!.value);
    const weekdayName = parts.find((p) => p.type === "weekday")!.value;

    // Convert weekday name to number (0=Sunday, 6=Saturday)
    const weekdayMap: { [key: string]: number } = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
    };
    const weekday = weekdayMap[weekdayName];

    return { year, month, day, weekday };
  }

  /**
   * Create a UTC date from date/time components in a specific timezone.
   * @param year - Year
   * @param month - Month (1-12)
   * @param day - Day of month
   * @param hour - Hour (0-23)
   * @param minutes - Minutes (0-59)
   * @param timezone - Source timezone (optional, defaults to UTC)
   * @returns UTC Date object
   * @private
   */
  private createUtcDateFromTimezone(
    year: number,
    month: number,
    day: number,
    hour: number,
    minutes: number,
    timezone?: string
  ): Date {
    if (!timezone) {
      return new Date(Date.UTC(year, month - 1, day, hour, minutes, 0));
    }

    // Use same approach as DateUtils.createDateTimeInTimezone
    const referenceUtc = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));

    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    const referenceParts = formatter.formatToParts(referenceUtc);
    const refLocalHour = parseInt(
      referenceParts.find((p) => p.type === "hour")!.value
    );
    const refLocalMin = parseInt(
      referenceParts.find((p) => p.type === "minute")!.value
    );

    // Calculate offset
    const offsetHours = 12 - refLocalHour;
    const offsetMinutes = 0 - refLocalMin;
    const offsetMs = (offsetHours * 60 + offsetMinutes) * 60 * 1000;

    // Create target date as if in UTC
    const targetAsUtc = new Date(
      Date.UTC(year, month - 1, day, hour, minutes, 0)
    );

    // Apply offset to convert from local time to UTC
    return new Date(targetAsUtc.getTime() + offsetMs);
  }

  /**
   * Check if a date matches the frequency pattern.
   * Uses user's timezone to determine day-of-week, day-of-month, etc.
   * @param date - The UTC date to check
   * @param frequency - The frequency pattern
   * @param userTimezone - User's timezone (optional, defaults to UTC)
   * @returns True if date matches frequency pattern
   * @private
   */
  private matchesFrequency(
    date: Date,
    frequency: Frequency,
    userTimezone?: string
  ): boolean {
    // Get date parts in user's timezone
    const dateParts = this.getDatePartsInTimezone(date, userTimezone);

    switch (frequency.type) {
      case "daily":
        // Daily matches any day
        return true;

      case "weekly":
        if (!frequency.days || frequency.days.length === 0) {
          return false;
        }
        // Use weekday from user's timezone
        return frequency.days.includes(dateParts.weekday);

      case "monthly":
        if (!frequency.kind) {
          return false;
        }
        if (frequency.kind === "day_number") {
          if (!frequency.day_numbers || frequency.day_numbers.length === 0) {
            return false;
          }
          // Use day of month from user's timezone
          return frequency.day_numbers.includes(dateParts.day);
        } else if (frequency.kind === "last_day") {
          // Check if this is the last day of the month in user's timezone
          const lastDay = this.getLastDayOfMonth(
            dateParts.year,
            dateParts.month,
            userTimezone
          );
          return dateParts.day === lastDay;
        } else if (frequency.kind === "weekday_ordinal") {
          if (
            frequency.weekday === undefined ||
            frequency.ordinal === undefined
          ) {
            return false;
          }
          return this.isNthWeekdayOfMonth(
            dateParts.year,
            dateParts.month,
            dateParts.day,
            dateParts.weekday,
            frequency.weekday,
            frequency.ordinal,
            userTimezone
          );
        }
        return false;

      case "yearly":
        if (!frequency.kind) {
          return false;
        }
        if (frequency.kind === "date") {
          if (frequency.month === undefined || frequency.day === undefined) {
            return false;
          }
          // Use month and day from user's timezone
          return (
            dateParts.month === frequency.month &&
            dateParts.day === frequency.day
          );
        } else if (frequency.kind === "weekday_ordinal") {
          if (
            frequency.weekday === undefined ||
            frequency.ordinal === undefined
          ) {
            return false;
          }
          return this.isNthWeekdayOfYear(
            dateParts.year,
            dateParts.month,
            dateParts.day,
            dateParts.weekday,
            frequency.weekday,
            frequency.ordinal,
            userTimezone
          );
        }
        return false;

      case "one-time":
        // One-time frequencies don't match here (they're handled separately)
        return false;

      default:
        return false;
    }
  }

  /**
   * Get the last day of a month in a specific timezone.
   * @param year - Year
   * @param month - Month (1-12)
   * @param timezone - Timezone (optional, defaults to UTC)
   * @returns Last day of the month
   * @private
   */
  private getLastDayOfMonth(
    year: number,
    month: number,
    timezone?: string
  ): number {
    // Create a date for the first day of the next month, then subtract one day
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const firstOfNextMonth = this.createUtcDateFromTimezone(
      nextYear,
      nextMonth,
      1,
      0,
      0,
      timezone
    );
    const lastOfMonth = new Date(
      firstOfNextMonth.getTime() - 24 * 60 * 60 * 1000
    );
    const lastDayParts = this.getDatePartsInTimezone(lastOfMonth, timezone);
    return lastDayParts.day;
  }

  /**
   * Check if a date is the nth weekday of the month.
   * @param year - Year
   * @param month - Month (1-12)
   * @param day - Day of month
   * @param actualWeekday - Actual weekday of the date (0=Sunday, 6=Saturday)
   * @param targetWeekday - Target weekday to match (0=Sunday, 6=Saturday)
   * @param ordinal - Ordinal (1-5)
   * @param timezone - Timezone (optional, defaults to UTC)
   * @returns True if date is the nth weekday of the month
   * @private
   */
  private isNthWeekdayOfMonth(
    year: number,
    month: number,
    day: number,
    actualWeekday: number,
    targetWeekday: number,
    ordinal: number,
    timezone?: string
  ): boolean {
    // Check if the actual weekday matches the target weekday
    if (actualWeekday !== targetWeekday) {
      return false;
    }

    // Get the first day of the month
    const firstDayUtc = this.createUtcDateFromTimezone(
      year,
      month,
      1,
      0,
      0,
      timezone
    );
    const firstDayParts = this.getDatePartsInTimezone(firstDayUtc, timezone);
    const firstWeekday = firstDayParts.weekday;

    // Calculate how many days until the first occurrence of the target weekday
    const daysToFirstOccurrence = (targetWeekday - firstWeekday + 7) % 7;
    const firstOccurrenceDay = 1 + daysToFirstOccurrence;

    // Calculate which occurrence this is
    const occurrenceNumber = Math.floor((day - firstOccurrenceDay) / 7) + 1;

    return occurrenceNumber === ordinal;
  }

  /**
   * Check if a date is the nth weekday of the year.
   * @param year - Year
   * @param month - Month (1-12)
   * @param day - Day of month
   * @param actualWeekday - Actual weekday of the date (0=Sunday, 6=Saturday)
   * @param targetWeekday - Target weekday to match (0=Sunday, 6=Saturday)
   * @param ordinal - Ordinal (1-5)
   * @param timezone - Timezone (optional, defaults to UTC)
   * @returns True if date is the nth weekday of the year
   * @private
   */
  private isNthWeekdayOfYear(
    year: number,
    month: number,
    day: number,
    actualWeekday: number,
    targetWeekday: number,
    ordinal: number,
    timezone?: string
  ): boolean {
    // Check if the actual weekday matches the target weekday
    if (actualWeekday !== targetWeekday) {
      return false;
    }

    // Get the first day of the year
    const firstDayOfYearUtc = this.createUtcDateFromTimezone(
      year,
      1,
      1,
      0,
      0,
      timezone
    );
    const firstDayParts = this.getDatePartsInTimezone(
      firstDayOfYearUtc,
      timezone
    );
    const firstWeekday = firstDayParts.weekday;

    // Calculate how many days until the first occurrence of the target weekday
    const daysToFirstOccurrence = (targetWeekday - firstWeekday + 7) % 7;

    // Calculate the day of year for the current date
    const currentDateUtc = this.createUtcDateFromTimezone(
      year,
      month,
      day,
      0,
      0,
      timezone
    );
    const dayOfYear = Math.floor(
      (currentDateUtc.getTime() - firstDayOfYearUtc.getTime()) /
      (1000 * 60 * 60 * 24)
    );

    // Calculate which occurrence this is
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
      `[${new Date().toISOString()}] REMINDER | Cleaning up ${reminders.length
      } orphaned reminder(s)...`
    );

    // Delete orphaned reminders directly (they're already identified as orphaned)
    for (const reminder of reminders) {
      try {
        await reminder.delete(this.db);
        console.log(
          `[${new Date().toISOString()}] REMINDER | Deleted orphaned reminder ID: ${reminder.id
          }`
        );
      } catch (error) {
        console.error(
          `[${new Date().toISOString()}] REMINDER | Error deleting orphaned reminder ID ${reminder.id
          }:`,
          error
        );
      }
    }

    console.log(
      `[${new Date().toISOString()}] REMINDER | Cleaned up ${reminders.length
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
   * Process expired Upcoming reminders for all users.
   * Checks database for expired reminders and updates them to Pending status.
   * Also creates new Upcoming reminders and sends notifications.
   * This method is called by the background polling job.
   * @returns Promise resolving when all updates are complete
   * @public
   */
  async processExpiredReminders(): Promise<void> {
    const now = new Date();
    const nowISO = now.toISOString();

    console.log(
      `[${nowISO}] REMINDER_POLL | Checking for expired Upcoming reminders (current time: ${nowISO})...`
    );

    // Fetch all UPCOMING reminders and filter in JavaScript for more reliable comparison
    // This ensures we catch all expired reminders regardless of database type or datetime format
    const upcomingReminderRows = await this.db.all<{
      id: number;
      tracking_id: number;
      user_id: number;
      scheduled_time: string;
      notes: string | null;
      status: string;
      value: string | null;
      created_at: string;
      updated_at: string;
    }>(
      `SELECT id, tracking_id, user_id, scheduled_time, notes, status, value, created_at, updated_at 
       FROM reminders 
       WHERE status = ?`,
      [ReminderStatus.UPCOMING]
    );

    console.log(
      `[${new Date().toISOString()}] REMINDER_POLL | Found ${upcomingReminderRows.length} total Upcoming reminder(s)`
    );

    if (upcomingReminderRows.length === 0) {
      console.log(
        `[${new Date().toISOString()}] REMINDER_POLL | No Upcoming reminders found, exiting`
      );
      return;
    }

    // Filter expired reminders in JavaScript for reliable datetime comparison
    const expiredReminderRows = upcomingReminderRows.filter((row) => {
      const scheduledTime = new Date(row.scheduled_time);
      const isExpired = scheduledTime <= now;
      if (!isExpired) {
        console.log(
          `[${new Date().toISOString()}] REMINDER_POLL | Reminder ID ${row.id} not expired: scheduled_time=${row.scheduled_time}, now=${nowISO}`
        );
      }
      return isExpired;
    });

    if (expiredReminderRows.length === 0) {
      console.log(
        `[${new Date().toISOString()}] REMINDER_POLL | No expired reminders found`
      );
      return;
    }

    console.log(
      `[${new Date().toISOString()}] REMINDER_POLL | Found ${expiredReminderRows.length} expired Upcoming reminder(s) out of ${upcomingReminderRows.length} total`
    );

    // Convert rows to Reminder instances
    const expiredReminders = expiredReminderRows.map((row) => {
      const reminder = new Reminder({
        id: row.id,
        tracking_id: row.tracking_id,
        user_id: row.user_id,
        scheduled_time: row.scheduled_time,
        notes: row.notes || undefined,
        status: row.status as ReminderStatus,
        value: (row.value as any) || null,
        created_at: row.created_at,
        updated_at: row.updated_at,
      });
      console.log(
        `[${new Date().toISOString()}] REMINDER_POLL | Created Reminder instance ID ${reminder.id
        } with status ${reminder.status}, scheduled_time: ${reminder.scheduled_time}`
      );
      return reminder;
    });

    await this.updateExpiredUpcomingReminders(expiredReminders, now);
  }

  /**
   * Check and update expired upcoming reminders to Pending status.
   * Also creates new Upcoming reminders for trackings whose reminders became Pending.
   * Sends email notifications when reminders become Pending.
   * @param reminders - Array of reminder instances to check
   * @param now - The current time to use for comparison (to ensure consistency)
   * @returns Promise resolving when all updates are complete
   * @private
   */
  private async updateExpiredUpcomingReminders(
    reminders: Reminder[],
    now: Date = new Date()
  ): Promise<void> {
    const updatePromises: Promise<ReminderData>[] = [];
    const remindersToEmail: Reminder[] = [];
    const trackingIdsToCreateNext: Set<number> = new Set();
    const userIdsByTrackingId: Map<number, number> = new Map();

    for (const reminder of reminders) {
      console.log(
        `[${new Date().toISOString()}] REMINDER | Processing reminder ID ${reminder.id
        }, status: ${reminder.status}, scheduled_time: ${reminder.scheduled_time}`
      );

      if (reminder.status === ReminderStatus.UPCOMING) {
        const scheduledTime = new Date(reminder.scheduled_time);
        const scheduledTimeMs = scheduledTime.getTime();
        const nowMs = now.getTime();

        console.log(
          `[${new Date().toISOString()}] REMINDER | Reminder ID ${reminder.id
          } comparison: scheduledTime=${scheduledTimeMs}, now=${nowMs}, expired=${scheduledTimeMs <= nowMs}`
        );

        if (scheduledTimeMs <= nowMs) {
          console.log(
            `[${new Date().toISOString()}] REMINDER | Updating expired upcoming reminder ID ${reminder.id
            } (scheduled_time: ${reminder.scheduled_time}) to Pending status`
          );
          try {
            // Check if this is a one-time tracking before updating
            // One-time trackings are handled by the lifecycle manager
            const tracking = await Tracking.loadById(
              reminder.tracking_id,
              reminder.user_id,
              this.db
            );
            const isOneTime = tracking?.frequency.type === "one-time";

            const updatePromise = reminder.update(
              { status: ReminderStatus.PENDING },
              this.db
            );
            updatePromises.push(updatePromise);
            remindersToEmail.push(reminder);

            // Only track for next reminder creation if NOT one-time
            // One-time trackings are handled by the lifecycle manager's handleUpcomingToPending
            if (!isOneTime) {
              trackingIdsToCreateNext.add(reminder.tracking_id);
              userIdsByTrackingId.set(reminder.tracking_id, reminder.user_id);
            }
          } catch (error) {
            console.error(
              `[${new Date().toISOString()}] REMINDER | Error updating reminder ID ${reminder.id
              }:`,
              error
            );
          }
        } else {
          console.log(
            `[${new Date().toISOString()}] REMINDER | Reminder ID ${reminder.id
            } not expired: scheduled_time=${reminder.scheduled_time} (${scheduledTimeMs}), now=${now.toISOString()} (${nowMs})`
          );
        }
      } else {
        console.log(
          `[${new Date().toISOString()}] REMINDER | Reminder ID ${reminder.id
          } is not UPCOMING (status: ${reminder.status}), skipping`
        );
      }
    }

    if (updatePromises.length > 0) {
      const updatedReminders = await Promise.all(updatePromises);
      console.log(
        `[${new Date().toISOString()}] REMINDER | Updated ${updatePromises.length
        } expired upcoming reminder(s) to Pending status`
      );

      // Verify updates were successful
      for (const updatedReminder of updatedReminders) {
        console.log(
          `[${new Date().toISOString()}] REMINDER | Verified reminder ID ${updatedReminder.id
          } is now ${updatedReminder.status}`
        );
      }

      // Send notifications for reminders that became Pending
      for (let i = 0; i < updatedReminders.length; i++) {
        const updatedReminder = updatedReminders[i];
        const originalReminder = remindersToEmail[i];
        try {
          await this.sendReminderNotifications(updatedReminder);
        } catch (error) {
          // Log error but don't fail the update process
          console.error(
            `[${new Date().toISOString()}] REMINDER | Failed to send notifications for reminder ID ${originalReminder.id
            }:`,
            error
          );
        }
      }

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
   * Send notifications when a reminder becomes Pending.
   * Sends via the selected notification channel (Email or Telegram) based on user preferences.
   * @param reminder - The reminder data
   * @returns Promise resolving when notifications are sent
   * @private
   */
  private async sendReminderNotifications(
    reminder: ReminderData
  ): Promise<void> {
    try {
      // Get user data
      const user = await User.loadById(reminder.user_id, this.db);
      if (!user) {
        console.warn(
          `[${new Date().toISOString()}] REMINDER | User not found for reminder ID ${reminder.id
          }, cannot send notifications`
        );
        return;
      }

      // Get tracking information
      const tracking = await Tracking.loadById(
        reminder.tracking_id,
        reminder.user_id,
        this.db
      );
      if (!tracking) {
        console.warn(
          `[${new Date().toISOString()}] REMINDER | Tracking not found for reminder ID ${reminder.id
          }, cannot send notifications`
        );
        return;
      }

      // Get user notification channel (default to Email if not set)
      const notificationChannel = user.notification_channels || "Email";

      // Send via selected channel
      if (notificationChannel === "Email") {
        await this.sendReminderEmail(user, reminder, tracking).catch(
          (error) => {
            console.error(
              `[${new Date().toISOString()}] REMINDER | Error sending email notification for reminder ID ${reminder.id
              }:`,
              error
            );
          }
        );
      } else if (notificationChannel === "Telegram" && user.telegram_chat_id) {
        await this.sendReminderTelegram(user, reminder, tracking).catch(
          (error) => {
            console.error(
              `[${new Date().toISOString()}] REMINDER | Error sending Telegram notification for reminder ID ${reminder.id
              }:`,
              error
            );
          }
        );
      }

      console.log(
        `[${new Date().toISOString()}] REMINDER | Notification sent for reminder ID ${reminder.id
        } via channel: ${notificationChannel}`
      );
    } catch (error) {
      // Log error but don't throw - notification sending failure shouldn't break reminder updates
      console.error(
        `[${new Date().toISOString()}] REMINDER | Error sending notifications for reminder ID ${reminder.id
        }:`,
        error
      );
    }
  }

  /**
   * Send reminder via email.
   * @param user - User instance
   * @param reminder - Reminder data
   * @param tracking - Tracking instance
   * @returns Promise resolving when email is sent
   * @private
   */
  private async sendReminderEmail(
    user: User,
    reminder: ReminderData,
    tracking: Tracking
  ): Promise<void> {
    const emailService = ServiceManager.getEmailService();
    await emailService.sendReminderEmail(
      user.email,
      reminder.id,
      tracking.question,
      reminder.scheduled_time,
      tracking.icon,
      tracking.notes,
      reminder.notes,
      user.locale,
      user.timezone
    );
    console.log(
      `[${new Date().toISOString()}] REMINDER | Email notification sent for reminder ID ${reminder.id
      } to ${user.email}`
    );
  }

  /**
   * Send reminder via Telegram.
   * @param user - User instance
   * @param reminder - Reminder data
   * @param tracking - Tracking instance
   * @returns Promise resolving when Telegram message is sent
   * @private
   */
  private async sendReminderTelegram(
    user: User,
    reminder: ReminderData,
    tracking: Tracking
  ): Promise<void> {
    if (!user.telegram_chat_id) {
      throw new Error("Telegram chat ID not configured for user");
    }

    const telegramService = ServiceManager.getTelegramService();
    await telegramService.sendReminderMessage(
      user.telegram_chat_id,
      reminder.id,
      tracking.question,
      reminder.scheduled_time,
      tracking.icon,
      tracking.notes,
      reminder.notes,
      user.locale,
      user.timezone
    );
    console.log(
      `[${new Date().toISOString()}] REMINDER | Telegram notification sent for reminder ID ${reminder.id
      } to chatId: ${user.telegram_chat_id}`
    );
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
      `[${new Date().toISOString()}] REMINDER | Next reminder created: ID ${reminder.id
      } for tracking ${trackingId}`
    );

    return reminder;
  }
}
