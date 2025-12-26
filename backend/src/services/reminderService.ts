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
    this.lifecycleManager = new ReminderLifecycleManager(this);
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
    console.log(
      `[${new Date().toISOString()}] REMINDER | Fetching reminders for userId: ${userId}`
    );

    const reminders = await this.loadModelsByUserId(userId);

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
      const reloadedReminders = await this.loadModelsByUserId(userId);
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

    // Return active reminders (Pending and Upcoming only, Answered are excluded)
    console.log(
      `[${new Date().toISOString()}] REMINDER | Returning ${
        finalReminders.length
      } active reminders for userId: ${userId} (Answered reminders excluded)`
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
    console.log(
      `[${new Date().toISOString()}] REMINDER | Fetching reminder by ID: ${id} for userId: ${userId}`
    );

    const reminder = await this.loadModelById(id, userId);

    if (!reminder) {
      console.log(
        `[${new Date().toISOString()}] REMINDER | Reminder not found for ID: ${id} and userId: ${userId}`
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

    // Send notifications if reminder is created as Pending
    // Note: Only send notifications if this is a newly created reminder with PENDING status.
    // updateExpiredUpcomingReminders handles notifications for reminders transitioning from UPCOMING to PENDING.
    if (status === ReminderStatus.PENDING) {
      try {
        await this.sendReminderNotifications(savedReminder);
      } catch (error) {
        // Log error but don't fail reminder creation
        console.error(
          `[${new Date().toISOString()}] REMINDER | Failed to send notifications for newly created reminder ID ${
            savedReminder.id
          }:`,
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

    console.log(
      `[${new Date().toISOString()}] REMINDER | Reminder updated successfully: ID ${reminderId}`
    );

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
    console.log(
      `[${new Date().toISOString()}] REMINDER | Completing reminder ID: ${reminderId} for userId: ${userId}`
    );

    const existingReminder = await Reminder.loadById(
      reminderId,
      userId,
      this.db
    );
    if (!existingReminder) {
      console.warn(
        `[${new Date().toISOString()}] REMINDER | Complete failed: reminder not found for ID: ${reminderId} and userId: ${userId}`
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

    console.log(
      `[${new Date().toISOString()}] REMINDER | Reminder completed successfully: ID ${reminderId}`
    );

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
    console.log(
      `[${new Date().toISOString()}] REMINDER | Dismissing reminder ID: ${reminderId} for userId: ${userId}`
    );

    const reminder = await Reminder.loadById(reminderId, userId, this.db);
    if (!reminder) {
      console.warn(
        `[${new Date().toISOString()}] REMINDER | Dismiss failed: reminder not found for ID: ${reminderId} and userId: ${userId}`
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
          console.warn(
            `[${new Date().toISOString()}] REMINDER | Tracking not found: ${trackingId}, cannot update upcoming reminder`
          );
          return updatedReminder;
        }

        // Only update if tracking is Running
        if (tracking.state !== "Running") {
          console.log(
            `[${new Date().toISOString()}] REMINDER | Tracking ${trackingId} is not Running, deleting upcoming reminder instead of updating`
          );
          await existingUpcoming.delete(this.db);
          return updatedReminder;
        }

        // Check if tracking has frequency (required field, but check for safety)
        // Type assertion: frequency is required in TrackingData but TypeScript may not recognize it
        // due to type resolution issues with the shared package dist
        const trackingData = tracking.toData();
        const frequency = (
          trackingData as TrackingData & { frequency: Frequency }
        ).frequency;
        if (!frequency) {
          console.warn(
            `[${new Date().toISOString()}] REMINDER | Tracking ${trackingId} has no frequency, cannot update upcoming reminder`
          );
          return updatedReminder;
        }

        // One-time frequencies don't generate recurring reminders
        if (frequency.type === "one-time") {
          console.log(
            `[${new Date().toISOString()}] REMINDER | Tracking ${trackingId} is one-time, skipping upcoming reminder update`
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
          console.log(
            `[${new Date().toISOString()}] REMINDER | Updated existing Upcoming reminder with new time after dismissing reminder ID ${reminderId}`
          );
        }
      } else {
        // Create new upcoming reminder
        await this.createNextReminderForTracking(trackingId, userId);
        console.log(
          `[${new Date().toISOString()}] REMINDER | Created new Upcoming reminder after dismissing reminder ID ${reminderId}`
        );
      }
    } catch (error) {
      // Log error but don't fail reminder update if next reminder creation fails
      console.error(
        `[${new Date().toISOString()}] REMINDER | Failed to create/update next reminder after dismissing reminder ID ${reminderId}:`,
        error
      );
    }

    console.log(
      `[${new Date().toISOString()}] REMINDER | Reminder dismissed successfully: ID ${reminderId}`
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

    let resultReminder: ReminderData;

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

      resultReminder = updatedReminder;
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

      resultReminder = newReminder;
    }

    // Delete the original reminder that was snoozed
    // This ensures pending reminders are removed when snoozed
    await reminder.delete(this.db);
    console.log(
      `[${new Date().toISOString()}] REMINDER | Deleted original reminder ID ${reminderId} after snoozing`
    );

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
        console.warn(
          `[${new Date().toISOString()}] REMINDER | Tracking not found: ${trackingId}, cannot update upcoming reminder`
        );
        return;
      }

      // Only update if tracking is Running
      if (tracking.state !== "Running") {
        console.log(
          `[${new Date().toISOString()}] REMINDER | Tracking ${trackingId} is not Running, deleting upcoming reminder instead of updating`
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
            console.error(
              `[${new Date().toISOString()}] REMINDER | Failed to send notifications for reminder ID ${
                existingUpcoming.id
              } after deleteReminder updated it to PENDING:`,
              error
            );
          }
        }

        console.log(
          `[${new Date().toISOString()}] REMINDER | Updated existing upcoming reminder ID ${
            existingUpcoming.id
          } with new time for tracking ${trackingId}`
        );
      } else {
        // No valid next time found, delete the upcoming reminder
        console.warn(
          `[${new Date().toISOString()}] REMINDER | No valid next time found for tracking ${trackingId}, deleting upcoming reminder`
        );
        await existingUpcoming.delete(this.db);
      }
    } else {
      // No existing upcoming reminder, create a new one
      await this.createNextReminderForTracking(trackingId, userId, deletedTime);
    }

    console.log(
      `[${new Date().toISOString()}] REMINDER | Reminder deleted and next one handled: ID ${reminderId}`
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

    // Type assertion: frequency is required in TrackingData but TypeScript may not recognize it
    // due to type resolution issues with the shared package dist
    const frequency = (tracking as TrackingData & { frequency: Frequency })
      .frequency;
    if (!frequency) {
      console.warn(
        `[${new Date().toISOString()}] REMINDER | Tracking ${
          tracking.id
        } has no frequency`
      );
      return null;
    }

    // One-time frequencies don't generate recurring reminders
    if (frequency.type === "one-time") {
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

    // Calculate next occurrence for each schedule based on frequency
    for (const schedule of schedules) {
      const nextTime = this.calculateNextOccurrence(
        frequency,
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
   * Calculate next occurrence for a specific schedule time based on frequency.
   * @param frequency - The frequency pattern
   * @param hour - Hour (0-23)
   * @param minutes - Minutes (0-59)
   * @param fromDate - Start date to search from
   * @param excludeDate - Optional date to exclude
   * @returns Next occurrence date or null if not found
   * @private
   */
  private calculateNextOccurrence(
    frequency: Frequency,
    hour: number,
    minutes: number,
    fromDate: Date,
    excludeDate: Date | null
  ): Date | null {
    // Handle daily frequency - every day
    if (frequency.type === "daily") {
      const candidateDate = new Date(fromDate);
      candidateDate.setHours(hour, minutes, 0, 0);

      // If candidate is in the past, move to tomorrow
      if (candidateDate <= fromDate) {
        candidateDate.setDate(candidateDate.getDate() + 1);
      }

      // Check if this date matches the excludeDate
      if (excludeDate && candidateDate.getTime() === excludeDate.getTime()) {
        candidateDate.setDate(candidateDate.getDate() + 1);
      }

      return candidateDate;
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

      // Check if this date matches the frequency pattern
      if (this.matchesFrequency(candidateDate, frequency)) {
        return candidateDate;
      }

      // Move to next day
      currentDate = new Date(currentDate);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return null;
  }

  /**
   * Check if a date matches the frequency pattern.
   * @param date - The date to check
   * @param frequency - The frequency pattern
   * @returns True if date matches frequency pattern
   * @private
   */
  private matchesFrequency(date: Date, frequency: Frequency): boolean {
    switch (frequency.type) {
      case "daily":
        // Daily matches any day
        return true;

      case "weekly":
        if (!frequency.days || frequency.days.length === 0) {
          return false;
        }
        const dayOfWeek = date.getDay(); // 0=Sunday, 6=Saturday
        return frequency.days.includes(dayOfWeek);

      case "monthly":
        if (!frequency.kind) {
          return false;
        }
        if (frequency.kind === "day_number") {
          if (!frequency.day_numbers || frequency.day_numbers.length === 0) {
            return false;
          }
          const dayOfMonth = date.getDate();
          return frequency.day_numbers.includes(dayOfMonth);
        } else if (frequency.kind === "last_day") {
          const lastDayOfMonth = new Date(
            date.getFullYear(),
            date.getMonth() + 1,
            0
          ).getDate();
          return date.getDate() === lastDayOfMonth;
        } else if (frequency.kind === "weekday_ordinal") {
          if (
            frequency.weekday === undefined ||
            frequency.ordinal === undefined
          ) {
            return false;
          }
          return this.isNthWeekdayOfMonth(
            date,
            frequency.weekday,
            frequency.ordinal
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
          return (
            date.getMonth() + 1 === frequency.month &&
            date.getDate() === frequency.day
          );
        } else if (frequency.kind === "weekday_ordinal") {
          if (
            frequency.weekday === undefined ||
            frequency.ordinal === undefined
          ) {
            return false;
          }
          return this.isNthWeekdayOfYear(
            date,
            frequency.weekday,
            frequency.ordinal
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
   * Sends email notifications when reminders become Pending.
   * @param reminders - Array of reminder instances to check
   * @returns Promise resolving when all updates are complete
   * @private
   */
  private async updateExpiredUpcomingReminders(
    reminders: Reminder[]
  ): Promise<void> {
    const now = new Date();
    const updatePromises: Promise<ReminderData>[] = [];
    const remindersToEmail: Reminder[] = [];
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
          remindersToEmail.push(reminder);
          // Track which trackings need a new Upcoming reminder created
          trackingIdsToCreateNext.add(reminder.tracking_id);
          userIdsByTrackingId.set(reminder.tracking_id, reminder.user_id);
        }
      }
    }

    if (updatePromises.length > 0) {
      const updatedReminders = await Promise.all(updatePromises);
      console.log(
        `[${new Date().toISOString()}] REMINDER | Updated ${
          updatePromises.length
        } expired upcoming reminder(s) to Pending status`
      );

      // Send notifications for reminders that became Pending
      for (let i = 0; i < updatedReminders.length; i++) {
        const updatedReminder = updatedReminders[i];
        const originalReminder = remindersToEmail[i];
        try {
          await this.sendReminderNotifications(updatedReminder);
        } catch (error) {
          // Log error but don't fail the update process
          console.error(
            `[${new Date().toISOString()}] REMINDER | Failed to send notifications for reminder ID ${
              originalReminder.id
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
   * Sends via all enabled channels (Email, Telegram) based on user preferences.
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
          `[${new Date().toISOString()}] REMINDER | User not found for reminder ID ${
            reminder.id
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
          `[${new Date().toISOString()}] REMINDER | Tracking not found for reminder ID ${
            reminder.id
          }, cannot send notifications`
        );
        return;
      }

      // Get user notification preferences (default to Email if not set)
      const notificationChannels =
        user.notification_channels && user.notification_channels.length > 0
          ? user.notification_channels
          : ["Email"];

      // Send via all enabled channels
      const sendPromises: Promise<void>[] = [];

      // Send email if enabled
      if (notificationChannels.includes("Email")) {
        sendPromises.push(
          this.sendReminderEmail(user, reminder, tracking).catch((error) => {
            console.error(
              `[${new Date().toISOString()}] REMINDER | Error sending email notification for reminder ID ${
                reminder.id
              }:`,
              error
            );
          })
        );
      }

      // Send Telegram if enabled
      if (notificationChannels.includes("Telegram") && user.telegram_chat_id) {
        sendPromises.push(
          this.sendReminderTelegram(user, reminder, tracking).catch((error) => {
            console.error(
              `[${new Date().toISOString()}] REMINDER | Error sending Telegram notification for reminder ID ${
                reminder.id
              }:`,
              error
            );
          })
        );
      }

      // Wait for all notifications to be sent (errors are caught individually)
      await Promise.allSettled(sendPromises);

      console.log(
        `[${new Date().toISOString()}] REMINDER | Notifications sent for reminder ID ${
          reminder.id
        } via channels: ${notificationChannels.join(", ")}`
      );
    } catch (error) {
      // Log error but don't throw - notification sending failure shouldn't break reminder updates
      console.error(
        `[${new Date().toISOString()}] REMINDER | Error sending notifications for reminder ID ${
          reminder.id
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
      reminder.notes
    );
    console.log(
      `[${new Date().toISOString()}] REMINDER | Email notification sent for reminder ID ${
        reminder.id
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
      reminder.notes
    );
    console.log(
      `[${new Date().toISOString()}] REMINDER | Telegram notification sent for reminder ID ${
        reminder.id
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
      `[${new Date().toISOString()}] REMINDER | Next reminder created: ID ${
        reminder.id
      } for tracking ${trackingId}`
    );

    return reminder;
  }
}
