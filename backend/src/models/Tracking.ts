import { Database } from "../db/database.js";
import { TrackingSchedule } from "./TrackingSchedule.js";
import {
  Tracking as BaseTracking,
  TrackingData,
  Frequency,
  TrackingState,
  MAX_TRACKING_QUESTION_LENGTH,
  TrackingScheduleData,
} from "@habitus/shared";

export type { TrackingData, Frequency, TrackingScheduleData };
export { TrackingState, MAX_TRACKING_QUESTION_LENGTH };

/**
 * Backend Tracking model with database operations.
 * Extends the shared Tracking class with persistence methods.
 * @public
 */
export class Tracking extends BaseTracking {
  /**
   * Save the tracking to the database.
   * Creates a new tracking record if id is not set, updates existing tracking otherwise.
   * @param db - Database instance
   * @returns Promise resolving to the saved tracking data
   * @throws Error if save operation fails
   * @public
   */
  async save(db: Database): Promise<TrackingData> {
    this.validate();

    if (this.id) {
      // Update existing tracking
      const updates: string[] = [];
      const values: any[] = [];

      updates.push("question = ?");
      values.push(this.question);

      if (this.details !== undefined) {
        updates.push("details = ?");
        values.push(this.details || null);
      }

      if (this.icon !== undefined) {
        updates.push("icon = ?");
        values.push(this.icon || null);
      }

      updates.push("frequency = ?");
      values.push(JSON.stringify(this.frequency));

      if (this.state !== undefined) {
        updates.push("state = ?");
        values.push(this.state);
      }

      updates.push("updated_at = CURRENT_TIMESTAMP");
      values.push(this.id, this.user_id);

      await db.run(
        `UPDATE trackings SET ${updates.join(
          ", "
        )} WHERE id = ? AND user_id = ?`,
        values
      );

      return this.toData();
    } else {
      // Create new tracking
      const result = await db.run(
        "INSERT INTO trackings (user_id, question, details, icon, frequency, state) VALUES (?, ?, ?, ?, ?, ?)",
        [
          this.user_id,
          this.question,
          this.details || null,
          this.icon || null,
          JSON.stringify(this.frequency),
          this.state || TrackingState.RUNNING,
        ]
      );

      if (!result.lastID) {
        throw new Error("Failed to create tracking");
      }

      this.id = result.lastID;
      return this.toData();
    }
  }

  /**
   * Update tracking fields.
   * @param updates - Partial tracking data with fields to update
   * @param db - Database instance
   * @returns Promise resolving to updated tracking data
   * @throws Error if update fails
   * @public
   */
  async update(
    updates: Partial<TrackingData>,
    db: Database
  ): Promise<TrackingData> {
    if (!this.id) {
      throw new Error("Cannot update tracking without ID");
    }

    if (updates.question !== undefined) {
      this.question = Tracking.validateQuestion(updates.question);
    }
    if (updates.details !== undefined) {
      this.details = Tracking.validateDetails(updates.details);
    }
    if (updates.icon !== undefined) {
      this.icon = Tracking.validateIcon(updates.icon);
    }
    if (updates.frequency !== undefined) {
      this.frequency = Tracking.validateFrequency(updates.frequency);
    }

    return this.save(db);
  }

  /**
   * Delete the tracking from the database.
   * @param db - Database instance
   * @returns Promise resolving when tracking is deleted
   * @throws Error if deletion fails
   * @public
   */
  async delete(db: Database): Promise<void> {
    if (!this.id) {
      throw new Error("Cannot delete tracking without ID");
    }

    const result = await db.run(
      "DELETE FROM trackings WHERE id = ? AND user_id = ?",
      [this.id, this.user_id]
    );

    if (result.changes === 0) {
      throw new Error("Tracking not found");
    }
  }

  /**
   * Convert tracking instance to TrackingData interface.
   * Includes schedules if loaded.
   * @returns Tracking data object
   * @public
   */
  toData(): TrackingData {
    const data = super.toData();
    return {
      ...data,
      schedules: (this as any).schedules,
    };
  }

  /**
   * Load tracking from database by ID.
   * @param id - Tracking ID
   * @param userId - User ID (for authorization)
   * @param db - Database instance
   * @returns Promise resolving to Tracking instance or null if not found
   * @public
   */
  static async loadById(
    id: number,
    userId: number,
    db: Database
  ): Promise<Tracking | null> {
    const row = await db.get<{
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
      "SELECT id, user_id, question, details, icon, frequency, state, created_at, updated_at FROM trackings WHERE id = ? AND user_id = ?",
      [id, userId]
    );

    if (!row) {
      return null;
    }

    let frequency: Frequency;
    try {
      frequency = JSON.parse(row.frequency) as Frequency;
    } catch (err) {
      console.error(
        `[${new Date().toISOString()}] TRACKING | Failed to parse frequency JSON for tracking ${id}:`,
        err
      );
      throw new Error(`Invalid frequency data for tracking ${id}`);
    }

    const tracking = new Tracking({
      id: row.id,
      user_id: row.user_id,
      question: row.question,
      details: row.details || undefined,
      icon: row.icon || undefined,
      frequency: frequency,
      state: (row.state as TrackingState) || TrackingState.RUNNING,
      created_at: row.created_at,
      updated_at: row.updated_at,
    });

    // Load schedules
    const schedules = await TrackingSchedule.loadByTrackingId(id, db);
    (tracking as any).schedules = schedules.map((s) => s.toData());

    return tracking;
  }

  /**
   * Load all trackings for a user from database.
   * @param userId - User ID
   * @param db - Database instance
   * @returns Promise resolving to array of Tracking instances
   * @public
   */
  static async loadByUserId(userId: number, db: Database): Promise<Tracking[]> {
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
      "SELECT id, user_id, question, details, icon, frequency, state, created_at, updated_at FROM trackings WHERE user_id = ? ORDER BY created_at DESC",
      [userId]
    );

    const trackings = await Promise.all(
      rows.map(async (row) => {
        let frequency: Frequency;
        try {
          frequency = JSON.parse(row.frequency) as Frequency;
        } catch (err) {
          console.error(
            `[${new Date().toISOString()}] TRACKING | Failed to parse frequency JSON for tracking ${row.id
            }:`,
            err
          );
          throw new Error(`Invalid frequency data for tracking ${row.id}`);
        }

        const tracking = new Tracking({
          id: row.id,
          user_id: row.user_id,
          question: row.question,
          details: row.details || undefined,
          icon: row.icon || undefined,
          frequency: frequency,
          state: (row.state as TrackingState) || TrackingState.RUNNING,
          created_at: row.created_at,
          updated_at: row.updated_at,
        });

        // Load schedules for each tracking
        const schedules = await TrackingSchedule.loadByTrackingId(row.id, db);
        (tracking as any).schedules = schedules.map((s) => s.toData());

        return tracking;
      })
    );

    return trackings;
  }
}
