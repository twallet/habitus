import { Database } from "../../db/database.js";
import { ReminderData, ReminderStatus } from "../../models/Reminder.js";
import { ReminderService } from "../reminderService.js";
import { LifecycleManager } from "./LifecycleManager.js";

/**
 * Reminder lifecycle manager for managing reminder status transitions.
 * Handles creation of next upcoming reminder when a reminder is answered.
 * @public
 */
export class ReminderLifecycleManager extends LifecycleManager<
  ReminderData,
  ReminderStatus
> {
  private reminderService: ReminderService;

  /**
   * Create a new ReminderLifecycleManager instance.
   * @param reminderService - ReminderService instance for reminder operations
   * @public
   */
  constructor(reminderService: ReminderService) {
    super();
    this.reminderService = reminderService;

    // Register status transition handlers
    this.setupStatusTransitionHandlers();
  }

  /**
   * Get current state from reminder entity.
   * @param entity - The reminder entity
   * @returns Current reminder status
   * @protected
   */
  protected getCurrentState(entity: ReminderData): ReminderStatus {
    return entity.status;
  }

  /**
   * Validate if a status transition is allowed.
   * Reminders can transition to ANSWERED from PENDING or UPCOMING.
   * UPCOMING can transition to PENDING when scheduled time is reached.
   * @param fromStatus - Current status
   * @param toStatus - Target status
   * @throws Error if transition is invalid
   * @protected
   */
  protected validateTransition(
    fromStatus: ReminderStatus,
    toStatus: ReminderStatus
  ): void {
    if (fromStatus === toStatus) {
      throw new TypeError(
        "Cannot transition to the same status. The reminder is already in this status."
      );
    }

    // PENDING or UPCOMING can transition to ANSWERED
    if (
      toStatus === ReminderStatus.ANSWERED &&
      (fromStatus === ReminderStatus.PENDING ||
        fromStatus === ReminderStatus.UPCOMING)
    ) {
      return;
    }

    // UPCOMING can transition to PENDING when time is reached
    if (
      toStatus === ReminderStatus.PENDING &&
      fromStatus === ReminderStatus.UPCOMING
    ) {
      return;
    }

    // ANSWERED is a terminal state - cannot transition from it
    if (fromStatus === ReminderStatus.ANSWERED) {
      throw new TypeError(
        "Cannot transition from Answered status. Answered reminders cannot be changed."
      );
    }

    // All other transitions are invalid
    throw new TypeError(
      `Invalid status transition from ${fromStatus} to ${toStatus}`
    );
  }

  /**
   * Setup status transition handlers for next reminder creation.
   * @private
   */
  private setupStatusTransitionHandlers(): void {
    // Register handler for when reminder is answered
    this.registerOnAfterStateChange(async (reminder, fromStatus, toStatus) => {
      if (
        toStatus === ReminderStatus.ANSWERED &&
        fromStatus !== ReminderStatus.ANSWERED
      ) {
        await this.handleAnswered(reminder);
      }
    });
  }

  /**
   * Handle reminder answered status transition.
   * Creates next upcoming reminder for the tracking.
   * @param reminder - The reminder entity
   * @private
   */
  private async handleAnswered(reminder: ReminderData): Promise<void> {
    try {
      await this.reminderService.createNextReminderForTracking(
        reminder.tracking_id,
        reminder.user_id
      );
      console.log(
        `[${new Date().toISOString()}] REMINDER_LIFECYCLE | Created new Upcoming reminder after answering reminder ID ${
          reminder.id
        }`
      );
    } catch (error) {
      // Log error but don't fail reminder update if next reminder creation fails
      console.error(
        `[${new Date().toISOString()}] REMINDER_LIFECYCLE | Failed to create next reminder after answering reminder ID ${
          reminder.id
        }:`,
        error
      );
    }
  }
}
