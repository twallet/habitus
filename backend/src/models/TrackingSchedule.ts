import { Database } from "../db/database.js";
import {
  TrackingSchedule as BaseTrackingSchedule,
  TrackingScheduleData,
  MAX_SCHEDULES_PER_TRACKING,
} from "@habitus/shared";

export type { TrackingScheduleData };
export { MAX_SCHEDULES_PER_TRACKING };

/**
 * Backend TrackingSchedule model with database operations.
 * Extends the shared TrackingSchedule class with persistence methods.
 * @public
 */
export class TrackingSchedule extends BaseTrackingSchedule {
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
}
