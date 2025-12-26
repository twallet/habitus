import { Database } from "../../db/database.js";
import {
  TrackingData,
  TrackingState,
  Tracking,
} from "../../models/Tracking.js";
import { ReminderService } from "../reminderService.js";
import { LifecycleManager } from "./LifecycleManager.js";

/**
 * Tracking lifecycle manager for managing tracking state transitions.
 * Handles reminder creation and deletion based on tracking state changes.
 * @public
 */
export class TrackingLifecycleManager extends LifecycleManager<
  TrackingData,
  TrackingState
> {
  private db: Database;
  private reminderService: ReminderService;

  /**
   * Create a new TrackingLifecycleManager instance.
   * @param db - Database instance
   * @param reminderService - ReminderService instance for reminder operations
   * @public
   */
  constructor(db: Database, reminderService: ReminderService) {
    super();
    this.db = db;
    this.reminderService = reminderService;

    // Register state transition handlers
    this.setupStateTransitionHandlers();

    // Register onCreate handler for initial reminder creation
    this.registerOnCreate(async (tracking) => {
      if (tracking.state === TrackingState.RUNNING) {
        try {
          await this.reminderService.createNextReminderForTracking(
            tracking.id,
            tracking.user_id
          );
          console.log(
            `[${new Date().toISOString()}] TRACKING_LIFECYCLE | Created initial reminder for new tracking ${
              tracking.id
            }`
          );
        } catch (error) {
          // Log error but don't fail tracking creation if reminder creation fails
          console.error(
            `[${new Date().toISOString()}] TRACKING_LIFECYCLE | Failed to create initial reminder for tracking ${
              tracking.id
            }:`,
            error
          );
        }
      }
    });
  }

  /**
   * Get current state from tracking entity.
   * @param entity - The tracking entity
   * @returns Current tracking state
   * @protected
   */
  protected getCurrentState(entity: TrackingData): TrackingState {
    return entity.state || TrackingState.RUNNING;
  }

  /**
   * Validate if a state transition is allowed.
   * Uses Tracking model's validation logic.
   * @param fromState - Current state
   * @param toState - Target state
   * @throws Error if transition is invalid
   * @protected
   */
  protected validateTransition(
    fromState: TrackingState,
    toState: TrackingState
  ): void {
    Tracking.validateStateTransition(fromState, toState);
  }

  /**
   * Setup state transition handlers for reminder management.
   * @private
   */
  private setupStateTransitionHandlers(): void {
    // Register handler for when tracking is paused
    this.registerOnAfterStateChange(async (tracking, fromState, toState) => {
      if (toState === TrackingState.PAUSED) {
        await this.handlePaused(tracking);
      }
    });

    // Register handler for when tracking is archived
    this.registerOnAfterStateChange(async (tracking, fromState, toState) => {
      if (toState === TrackingState.ARCHIVED) {
        await this.handleArchived(tracking);
      }
    });

    // Register handler for when tracking is resumed or unarchived
    this.registerOnAfterStateChange(async (tracking, fromState, toState) => {
      if (
        toState === TrackingState.RUNNING &&
        (fromState === TrackingState.PAUSED ||
          fromState === TrackingState.ARCHIVED)
      ) {
        await this.handleResumed(tracking);
      }
    });
  }

  /**
   * Handle tracking paused state transition.
   * Deletes Upcoming reminders (keeps Pending and Answered).
   * @param tracking - The tracking entity
   * @private
   */
  private async handlePaused(tracking: TrackingData): Promise<void> {
    const { Reminder } = await import("../../models/Reminder.js");
    const deletedCount = await Reminder.deleteUpcomingByTrackingId(
      tracking.id,
      tracking.user_id,
      this.db
    );

    if (deletedCount > 0) {
      console.log(
        `[${new Date().toISOString()}] TRACKING_LIFECYCLE | Deleted ${deletedCount} Upcoming reminder(s) for paused tracking ${
          tracking.id
        }`
      );
    }
  }

  /**
   * Handle tracking archived state transition.
   * Deletes Upcoming and Pending reminders (keeps Answered).
   * @param tracking - The tracking entity
   * @private
   */
  private async handleArchived(tracking: TrackingData): Promise<void> {
    const { Reminder, ReminderStatus } = await import(
      "../../models/Reminder.js"
    );

    // Delete all Upcoming reminders
    const deletedUpcoming = await Reminder.deleteUpcomingByTrackingId(
      tracking.id,
      tracking.user_id,
      this.db
    );

    // Delete all Pending reminders
    const result = await this.db.run(
      `DELETE FROM reminders 
       WHERE tracking_id = ? 
       AND user_id = ? 
       AND status = ?`,
      [tracking.id, tracking.user_id, ReminderStatus.PENDING]
    );

    const totalDeleted = deletedUpcoming + result.changes;
    if (totalDeleted > 0) {
      console.log(
        `[${new Date().toISOString()}] TRACKING_LIFECYCLE | Deleted ${totalDeleted} Upcoming/Pending reminder(s) for archived tracking ${
          tracking.id
        }`
      );
    }
  }

  /**
   * Handle tracking resumed or unarchived state transition.
   * Creates next reminder for the tracking.
   * For one-time frequencies, creates a single reminder if the date is in the future.
   * @param tracking - The tracking entity
   * @private
   */
  private async handleResumed(tracking: TrackingData): Promise<void> {
    try {
      // For one-time frequencies, create a single reminder if date is in the future
      if (tracking.frequency.type === "one-time") {
        const dateObj = new Date(tracking.frequency.date + "T00:00:00");
        const now = new Date();
        const today = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate()
        );
        const selectedDateOnly = new Date(
          dateObj.getFullYear(),
          dateObj.getMonth(),
          dateObj.getDate()
        );

        // Only create reminder if date is in the future
        if (
          selectedDateOnly >= today &&
          tracking.schedules &&
          tracking.schedules.length > 0
        ) {
          // Find the earliest schedule time
          const sortedSchedules = [...tracking.schedules].sort((a, b) => {
            if (a.hour !== b.hour) return a.hour - b.hour;
            return a.minutes - b.minutes;
          });
          const earliestSchedule = sortedSchedules[0];

          const dateTimeString = `${tracking.frequency.date}T${String(
            earliestSchedule.hour
          ).padStart(2, "0")}:${String(earliestSchedule.minutes).padStart(
            2,
            "0"
          )}:00`;
          const dateTime = new Date(dateTimeString);
          const isoDateTimeString = dateTime.toISOString();

          await this.reminderService.createReminder(
            tracking.id,
            tracking.user_id,
            isoDateTimeString
          );
          console.log(
            `[${new Date().toISOString()}] TRACKING_LIFECYCLE | Created one-time reminder for resumed/unarchived tracking ${
              tracking.id
            }`
          );
        }
      } else {
        // For recurring frequencies, use the standard method
        await this.reminderService.createNextReminderForTracking(
          tracking.id,
          tracking.user_id
        );
        console.log(
          `[${new Date().toISOString()}] TRACKING_LIFECYCLE | Created next reminder for resumed/unarchived tracking ${
            tracking.id
          }`
        );
      }
    } catch (error) {
      // Log error but don't fail state update if reminder creation fails
      console.error(
        `[${new Date().toISOString()}] TRACKING_LIFECYCLE | Failed to create reminder for tracking ${
          tracking.id
        } after state transition:`,
        error
      );
    }
  }
}
