import { Database } from "../db/database.js";

/**
 * Tracking schedule data interface.
 * @public
 */
export interface TrackingScheduleData {
  id: number;
  tracking_id: number;
  hour: number;
  minutes: number;
  created_at?: string;
  updated_at?: string;
}

/**
 * Tracking schedule model class for representing schedule entities and database operations.
 * @public
 */
export class TrackingSchedule {
  /**
   * Maximum allowed number of schedules per tracking.
   * @public
   */
  static readonly MAX_SCHEDULES_PER_TRACKING: number = 5;

  /**
   * Schedule ID.
   * @public
   */
  id: number;

  /**
   * Tracking ID this schedule belongs to.
   * @public
   */
  tracking_id: number;

  /**
   * Hour (0-23).
   * @public
   */
  hour: number;

  /**
   * Minutes (0-59).
   * @public
   */
  minutes: number;

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
   * Create a new TrackingSchedule instance.
   * @param data - Schedule data to initialize the instance
   * @public
   */
  constructor(data: TrackingScheduleData) {
    this.id = data.id;
    this.tracking_id = data.tracking_id;
    this.hour = data.hour;
    this.minutes = data.minutes;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }

  /**
   * Validate the schedule instance.
   * Validates all fields according to business rules.
   * @returns The validated schedule instance
   * @throws {@link TypeError} If validation fails
   * @public
   */
  validate(): TrackingSchedule {
    this.tracking_id = TrackingSchedule.validateTrackingId(this.tracking_id);
    this.hour = TrackingSchedule.validateHour(this.hour);
    this.minutes = TrackingSchedule.validateMinutes(this.minutes);
    return this;
  }

  /**
   * Save the schedule to the database.
   * Creates a new schedule record if id is not set, updates existing schedule otherwise.
   * @param db - Database instance
   * @returns Promise resolving to the saved schedule data
   * @throws Error if save operation fails
   * @public
   */
  async save(db: Database): Promise<TrackingScheduleData> {
    this.validate();

    if (this.id) {
      // Update existing schedule
      await db.run(
        `UPDATE tracking_schedules SET hour = ?, minutes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND tracking_id = ?`,
        [this.hour, this.minutes, this.id, this.tracking_id]
      );

      return this.toData();
    } else {
      // Create new schedule
      const result = await db.run(
        "INSERT INTO tracking_schedules (tracking_id, hour, minutes) VALUES (?, ?, ?)",
        [this.tracking_id, this.hour, this.minutes]
      );

      if (!result.lastID) {
        throw new Error("Failed to create tracking schedule");
      }

      this.id = result.lastID;
      return this.toData();
    }
  }

  /**
   * Delete the schedule from the database.
   * @param db - Database instance
   * @returns Promise resolving when schedule is deleted
   * @throws Error if deletion fails
   * @public
   */
  async delete(db: Database): Promise<void> {
    if (!this.id) {
      throw new Error("Cannot delete schedule without ID");
    }

    const result = await db.run(
      "DELETE FROM tracking_schedules WHERE id = ? AND tracking_id = ?",
      [this.id, this.tracking_id]
    );

    if (result.changes === 0) {
      throw new Error("Tracking schedule not found");
    }
  }

  /**
   * Convert schedule instance to TrackingScheduleData interface.
   * @returns Schedule data object
   * @public
   */
  toData(): TrackingScheduleData {
    return {
      id: this.id,
      tracking_id: this.tracking_id,
      hour: this.hour,
      minutes: this.minutes,
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
  }

  /**
   * Load all schedules for a tracking from database.
   * @param trackingId - Tracking ID
   * @param db - Database instance
   * @returns Promise resolving to array of TrackingSchedule instances
   * @public
   */
  static async loadByTrackingId(
    trackingId: number,
    db: Database
  ): Promise<TrackingSchedule[]> {
    const rows = await db.all<{
      id: number;
      tracking_id: number;
      hour: number;
      minutes: number;
      created_at: string;
      updated_at: string;
    }>(
      "SELECT id, tracking_id, hour, minutes, created_at, updated_at FROM tracking_schedules WHERE tracking_id = ? ORDER BY hour, minutes",
      [trackingId]
    );

    return rows.map(
      (row) =>
        new TrackingSchedule({
          id: row.id,
          tracking_id: row.tracking_id,
          hour: row.hour,
          minutes: row.minutes,
          created_at: row.created_at,
          updated_at: row.updated_at,
        })
    );
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
   * Validates an hour value.
   * @param hour - The hour to validate (0-23)
   * @returns The validated hour
   * @throws {@link TypeError} If the hour is invalid
   * @public
   */
  static validateHour(hour: number): number {
    if (typeof hour !== "number" || isNaN(hour)) {
      throw new TypeError("Hour must be a valid number");
    }

    if (!Number.isInteger(hour)) {
      throw new TypeError("Hour must be an integer");
    }

    if (hour < 0 || hour > 23) {
      throw new TypeError("Hour must be between 0 and 23");
    }

    return hour;
  }

  /**
   * Validates a minutes value.
   * @param minutes - The minutes to validate (0-59)
   * @returns The validated minutes
   * @throws {@link TypeError} If the minutes is invalid
   * @public
   */
  static validateMinutes(minutes: number): number {
    if (typeof minutes !== "number" || isNaN(minutes)) {
      throw new TypeError("Minutes must be a valid number");
    }

    if (!Number.isInteger(minutes)) {
      throw new TypeError("Minutes must be an integer");
    }

    if (minutes < 0 || minutes > 59) {
      throw new TypeError("Minutes must be between 0 and 59");
    }

    return minutes;
  }

  /**
   * Validates an array of schedules for a tracking.
   * Ensures at least one schedule, maximum 5, and no duplicates.
   * @param schedules - Array of schedule data to validate
   * @param trackingId - The tracking ID
   * @returns The validated array of schedules
   * @throws {@link TypeError} If validation fails
   * @public
   */
  static validateSchedules(
    schedules: Array<{ hour: number; minutes: number }>,
    trackingId: number
  ): Array<{ hour: number; minutes: number }> {
    if (!Array.isArray(schedules)) {
      throw new TypeError("Schedules must be an array");
    }

    if (schedules.length === 0) {
      throw new TypeError("At least one schedule is required");
    }

    if (schedules.length > TrackingSchedule.MAX_SCHEDULES_PER_TRACKING) {
      throw new TypeError(
        `Maximum ${TrackingSchedule.MAX_SCHEDULES_PER_TRACKING} schedules allowed per tracking`
      );
    }

    // Validate each schedule and check for duplicates
    const validatedSchedules: Array<{ hour: number; minutes: number }> = [];
    const timeSet = new Set<string>();

    for (const schedule of schedules) {
      const hour = TrackingSchedule.validateHour(schedule.hour);
      const minutes = TrackingSchedule.validateMinutes(schedule.minutes);
      const timeKey = `${hour}:${minutes}`;

      if (timeSet.has(timeKey)) {
        throw new TypeError(
          `Duplicate schedule found: ${String(hour).padStart(2, "0")}:${String(
            minutes
          ).padStart(2, "0")}`
        );
      }

      timeSet.add(timeKey);
      validatedSchedules.push({ hour, minutes });
    }

    return validatedSchedules;
  }
}
