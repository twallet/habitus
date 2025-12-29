import { ReminderData, ReminderStatus, ReminderValue } from "../types.js";

/**
 * Reminder model class for representing reminder entities.
 * Contains validation logic shared between frontend and backend.
 * @public
 */
export class Reminder {
  /**
   * Reminder ID.
   * @public
   */
  id: number;

  /**
   * Tracking ID this reminder belongs to.
   * @public
   */
  tracking_id: number;

  /**
   * User ID who owns this reminder.
   * @public
   */
  user_id: number;

  /**
   * Scheduled time when reminder should appear (ISO datetime string).
   * @public
   */
  scheduled_time: string;

  /**
   * Optional notes.
   * @public
   */
  notes?: string;

  /**
   * Reminder status.
   * @public
   */
  status: ReminderStatus;

  /**
   * Reminder value (Completed or Dismissed).
   * null when status is PENDING or UPCOMING, required when status is ANSWERED.
   * @public
   */
  value: ReminderValue | null;

  /**
   * Creation timestamp (optional).
   * @public
   */
  created_at?: string;

  /**
   * Last update timestamp (optional).
   * @public
   */
  updated_at?: string;

  /**
   * Create a new Reminder instance.
   * @param data - Reminder data to initialize the instance
   * @public
   */
  constructor(data: ReminderData) {
    this.id = data.id;
    this.tracking_id = data.tracking_id;
    this.user_id = data.user_id;
    this.scheduled_time = data.scheduled_time;
    this.notes = data.notes;
    this.status = data.status || ReminderStatus.PENDING;
    this.value = data.value ?? null;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }

  /**
   * Validate the reminder instance.
   * Validates all fields according to business rules.
   * Enforces that value is null for non-answered reminders and required for answered reminders.
   * @returns The validated reminder instance
   * @throws {@link TypeError} If validation fails
   * @public
   */
  validate(): Reminder {
    this.tracking_id = Reminder.validateTrackingId(this.tracking_id);
    this.user_id = Reminder.validateUserId(this.user_id);
    this.scheduled_time = Reminder.validateScheduledTime(this.scheduled_time);
    if (this.notes !== undefined) {
      this.notes = Reminder.validateNotes(this.notes);
    }
    this.status = Reminder.validateStatus(this.status);

    // Validate value based on status
    if (this.status === ReminderStatus.ANSWERED) {
      if (this.value === null || this.value === undefined) {
        throw new TypeError(
          "Value must be set (Completed or Dismissed) when status is Answered"
        );
      }
      this.value = Reminder.validateValue(this.value);
    } else {
      // For non-answered reminders, value must be null
      if (this.value !== null && this.value !== undefined) {
        throw new TypeError(
          `Value must be null when status is ${this.status}. Value can only be set when status is Answered.`
        );
      }
      this.value = null;
    }

    return this;
  }

  /**
   * Convert reminder instance to ReminderData interface.
   * @returns Reminder data object
   * @public
   */
  toData(): ReminderData {
    return {
      id: this.id,
      tracking_id: this.tracking_id,
      user_id: this.user_id,
      scheduled_time: this.scheduled_time,
      notes: this.notes,
      status: this.status,
      value: this.value,
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
  }

  /**
   * Validates a tracking ID.
   * @param trackingId - The tracking ID to validate
   * @returns The validated tracking ID
   * @throws {@link TypeError} If the tracking ID is invalid
   * @public
   */
  static validateTrackingId(trackingId: number): number {
    if (typeof trackingId !== "number" || isNaN(trackingId)) {
      throw new TypeError("Tracking ID must be a valid number");
    }

    if (trackingId <= 0 || !Number.isInteger(trackingId)) {
      throw new TypeError("Tracking ID must be a positive integer");
    }

    return trackingId;
  }

  /**
   * Validates a user ID.
   * @param userId - The user ID to validate
   * @returns The validated user ID
   * @throws {@link TypeError} If the user ID is invalid
   * @public
   */
  static validateUserId(userId: number): number {
    if (typeof userId !== "number" || isNaN(userId)) {
      throw new TypeError("User ID must be a valid number");
    }

    if (userId <= 0 || !Number.isInteger(userId)) {
      throw new TypeError("User ID must be a positive integer");
    }

    return userId;
  }

  /**
   * Validates scheduled time (ISO datetime string).
   * @param scheduledTime - The scheduled time to validate
   * @returns The validated scheduled time
   * @throws {@link TypeError} If the scheduled time is invalid
   * @public
   */
  static validateScheduledTime(scheduledTime: string): string {
    if (typeof scheduledTime !== "string") {
      throw new TypeError("Scheduled time must be a string");
    }

    const trimmedTime = scheduledTime.trim();
    if (!trimmedTime) {
      throw new TypeError("Scheduled time must not be empty");
    }

    // Validate ISO datetime format
    const date = new Date(trimmedTime);
    if (isNaN(date.getTime())) {
      throw new TypeError("Scheduled time must be a valid ISO datetime string");
    }

    return trimmedTime;
  }

  /**
   * Validates notes (optional text).
   * @param notes - The notes to validate (optional)
   * @returns The validated notes or undefined if empty
   * @public
   */
  static validateNotes(notes?: string | null): string | undefined {
    if (notes === null || notes === undefined) {
      return undefined;
    }

    if (typeof notes !== "string") {
      throw new TypeError("Notes must be a string");
    }

    const trimmedNotes = notes.trim();
    if (!trimmedNotes) {
      return undefined;
    }

    return trimmedNotes;
  }

  /**
   * Validates a reminder status.
   * @param status - The status to validate
   * @returns The validated reminder status
   * @throws {@link TypeError} If the status is invalid
   * @public
   */
  static validateStatus(status: string | ReminderStatus): ReminderStatus {
    if (typeof status !== "string") {
      throw new TypeError("Status must be a string");
    }

    const normalizedStatus = status.trim();
    if (
      normalizedStatus !== ReminderStatus.PENDING &&
      normalizedStatus !== ReminderStatus.ANSWERED &&
      normalizedStatus !== ReminderStatus.UPCOMING
    ) {
      throw new TypeError(
        `Status must be one of: "${ReminderStatus.PENDING}", "${ReminderStatus.ANSWERED}", "${ReminderStatus.UPCOMING}"`
      );
    }

    return normalizedStatus as ReminderStatus;
  }

  /**
   * Validates a reminder value.
   * @param value - The value to validate (must not be null)
   * @returns The validated reminder value
   * @throws {@link TypeError} If the value is invalid or null
   * @public
   */
  static validateValue(value: string | ReminderValue | null): ReminderValue {
    if (value === null || value === undefined) {
      throw new TypeError("Value must be a string (Completed or Dismissed)");
    }

    if (typeof value !== "string") {
      throw new TypeError("Value must be a string");
    }

    const normalizedValue = value.trim();
    if (
      normalizedValue !== ReminderValue.COMPLETED &&
      normalizedValue !== ReminderValue.DISMISSED
    ) {
      throw new TypeError(
        `Value must be one of: "${ReminderValue.COMPLETED}", "${ReminderValue.DISMISSED}"`
      );
    }

    return normalizedValue as ReminderValue;
  }
}
