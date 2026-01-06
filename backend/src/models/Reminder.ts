import { Database } from "../db/database.js";
import {
  Reminder as BaseReminder,
  ReminderData,
  ReminderStatus,
  ReminderValue,
} from "@habitus/shared";

export type { ReminderData };
export { ReminderStatus, ReminderValue };

/**
 * Normalize scheduled_time to ISO string format.
 * Handles Date objects and strings from database queries.
 * @param scheduledTime - The scheduled time value (Date, string, or other)
 * @returns ISO string representation of the scheduled time
 * @private
 */
function normalizeScheduledTime(scheduledTime: any): string {
  if (scheduledTime instanceof Date) {
    return scheduledTime.toISOString();
  }
  if (typeof scheduledTime === "string") {
    // Validate and normalize to ISO format
    const date = new Date(scheduledTime);
    if (isNaN(date.getTime())) {
      throw new TypeError(
        `Invalid scheduled_time value: cannot parse "${scheduledTime}" as a date`
      );
    }
    return date.toISOString();
  }
  // Fallback: convert to string and try to parse
  const date = new Date(String(scheduledTime));
  if (isNaN(date.getTime())) {
    throw new TypeError(
      `Invalid scheduled_time value: cannot parse "${scheduledTime}" as a date`
    );
  }
  return date.toISOString();
}

/**
 * Backend Reminder model with database operations.
 * Extends the shared Reminder class with persistence methods.
 * @public
 */
export class Reminder extends BaseReminder {
  /**
   * Save the reminder to the database.
   * Creates a new reminder record if id is not set, updates existing reminder otherwise.
   * @param db - Database instance
   * @returns Promise resolving to the saved reminder data
   * @throws Error if save operation fails
   * @public
   */
  async save(db: Database): Promise<ReminderData> {
    this.validate();

    // Ensure scheduled_time is always an ISO string for database operations
    // This handles cases where PostgreSQL returns Date objects
    const scheduledTimeStr = normalizeScheduledTime(this.scheduled_time);

    if (this.id) {
      // Update existing reminder
      const updates: string[] = [];
      const values: any[] = [];

      updates.push("scheduled_time = ?");
      values.push(scheduledTimeStr);

      if (this.notes !== undefined) {
        updates.push("notes = ?");
        values.push(this.notes || null);
      }

      if (this.status !== undefined) {
        updates.push("status = ?");
        values.push(this.status);
      }

      // Handle nullable value
      if (this.value !== undefined) {
        if (this.value !== null) {
          updates.push("value = ?");
          values.push(this.value);
        } else {
          updates.push("value = NULL");
        }
      }

      updates.push("updated_at = CURRENT_TIMESTAMP");
      values.push(this.id, this.user_id);

      await db.run(
        `UPDATE reminders SET ${updates.join(
          ", "
        )} WHERE id = ? AND user_id = ?`,
        values
      );

      // Update the instance's scheduled_time to the normalized ISO string
      this.scheduled_time = scheduledTimeStr;

      return this.toData();
    } else {
      // Create new reminder
      const result = await db.run(
        "INSERT INTO reminders (tracking_id, user_id, scheduled_time, notes, status, value) VALUES (?, ?, ?, ?, ?, ?)",
        [
          this.tracking_id,
          this.user_id,
          scheduledTimeStr,
          this.notes || null,
          this.status || ReminderStatus.PENDING,
          this.value ?? null,
        ]
      );

      if (!result.lastID) {
        throw new Error("Failed to create reminder");
      }

      this.id = result.lastID;
      // Update the instance's scheduled_time to the normalized ISO string
      this.scheduled_time = scheduledTimeStr;
      return this.toData();
    }
  }

  /**
   * Update reminder fields.
   * @param updates - Partial reminder data with fields to update
   * @param db - Database instance
   * @returns Promise resolving to updated reminder data
   * @throws Error if update fails
   * @public
   */
  async update(
    updates: Partial<ReminderData>,
    db: Database
  ): Promise<ReminderData> {
    if (!this.id) {
      throw new Error("Cannot update reminder without ID");
    }

    if (updates.scheduled_time !== undefined) {
      this.scheduled_time = Reminder.validateScheduledTime(
        updates.scheduled_time
      );
    }
    if (updates.notes !== undefined) {
      this.notes = Reminder.validateNotes(updates.notes);
    }
    if (updates.status !== undefined) {
      this.status = Reminder.validateStatus(updates.status);
    }
    if (updates.value !== undefined) {
      this.value = Reminder.validateValue(updates.value);
    }

    return this.save(db);
  }

  /**
   * Delete the reminder from the database.
   * @param db - Database instance
   * @returns Promise resolving when reminder is deleted
   * @throws Error if deletion fails
   * @public
   */
  async delete(db: Database): Promise<void> {
    if (!this.id) {
      throw new Error("Cannot delete reminder without ID");
    }

    const result = await db.run(
      "DELETE FROM reminders WHERE id = ? AND user_id = ?",
      [this.id, this.user_id]
    );

    if (result.changes === 0) {
      throw new Error("Reminder not found");
    }
  }

  /**
   * Load reminder from database by ID.
   * @param id - Reminder ID
   * @param userId - User ID (for authorization)
   * @param db - Database instance
   * @returns Promise resolving to Reminder instance or null if not found
   * @public
   */
  static async loadById(
    id: number,
    userId: number,
    db: Database
  ): Promise<Reminder | null> {
    const row = await db.get<{
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
      "SELECT id, tracking_id, user_id, scheduled_time, notes, status, value, created_at, updated_at FROM reminders WHERE id = ? AND user_id = ?",
      [id, userId]
    );

    if (!row) {
      return null;
    }

    return new Reminder({
      id: row.id,
      tracking_id: row.tracking_id,
      user_id: row.user_id,
      scheduled_time: normalizeScheduledTime(row.scheduled_time),
      notes: row.notes || undefined,
      status: (row.status as ReminderStatus) || ReminderStatus.PENDING,
      value: (row.value as ReminderValue) || null,
      created_at: row.created_at,
      updated_at: row.updated_at,
    });
  }

  /**
   * Load all reminders for a user from database.
   * @param userId - User ID
   * @param db - Database instance
   * @returns Promise resolving to array of Reminder instances
   * @public
   */
  static async loadByUserId(userId: number, db: Database): Promise<Reminder[]> {
    const rows = await db.all<{
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
      "SELECT id, tracking_id, user_id, scheduled_time, notes, status, value, created_at, updated_at FROM reminders WHERE user_id = ? ORDER BY scheduled_time ASC",
      [userId]
    );

    return rows.map(
      (row) =>
        new Reminder({
          id: row.id,
          tracking_id: row.tracking_id,
          user_id: row.user_id,
          scheduled_time: normalizeScheduledTime(row.scheduled_time),
          notes: row.notes || undefined,
          status: (row.status as ReminderStatus) || ReminderStatus.PENDING,
          value: (row.value as ReminderValue) || null,
          created_at: row.created_at,
          updated_at: row.updated_at,
        })
    );
  }

  /**
   * Load active reminders for a user from database (excludes Answered reminders).
   * Only returns Pending and Upcoming reminders, which are the ones needed for frontend display.
   * @param userId - User ID
   * @param db - Database instance
   * @returns Promise resolving to array of Reminder instances (Pending and Upcoming only)
   * @public
   */
  static async loadActiveByUserId(
    userId: number,
    db: Database
  ): Promise<Reminder[]> {
    const rows = await db.all<{
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
      "SELECT id, tracking_id, user_id, scheduled_time, notes, status, value, created_at, updated_at FROM reminders WHERE user_id = ? AND status != ? ORDER BY scheduled_time ASC",
      [userId, ReminderStatus.ANSWERED]
    );

    return rows.map(
      (row) =>
        new Reminder({
          id: row.id,
          tracking_id: row.tracking_id,
          user_id: row.user_id,
          scheduled_time: normalizeScheduledTime(row.scheduled_time),
          notes: row.notes || undefined,
          status: (row.status as ReminderStatus) || ReminderStatus.PENDING,
          value: (row.value as ReminderValue) || null,
          created_at: row.created_at,
          updated_at: row.updated_at,
        })
    );
  }

  /**
   * Load reminder by tracking ID for a user.
   * @param trackingId - Tracking ID
   * @param userId - User ID (for authorization)
   * @param db - Database instance
   * @returns Promise resolving to Reminder instance or null if not found
   * @public
   */
  static async loadByTrackingId(
    trackingId: number,
    userId: number,
    db: Database
  ): Promise<Reminder | null> {
    const row = await db.get<{
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
      "SELECT id, tracking_id, user_id, scheduled_time, notes, status, value, created_at, updated_at FROM reminders WHERE tracking_id = ? AND user_id = ? ORDER BY scheduled_time ASC LIMIT 1",
      [trackingId, userId]
    );

    if (!row) {
      return null;
    }

    return new Reminder({
      id: row.id,
      tracking_id: row.tracking_id,
      user_id: row.user_id,
      scheduled_time: normalizeScheduledTime(row.scheduled_time),
      notes: row.notes || undefined,
      status: (row.status as ReminderStatus) || ReminderStatus.PENDING,
      value: (row.value as ReminderValue) || null,
      created_at: row.created_at,
      updated_at: row.updated_at,
    });
  }

  /**
   * Load Upcoming reminder by tracking ID for a user.
   * @param trackingId - Tracking ID
   * @param userId - User ID (for authorization)
   * @param db - Database instance
   * @returns Promise resolving to Reminder instance or null if not found
   * @public
   */
  static async loadUpcomingByTrackingId(
    trackingId: number,
    userId: number,
    db: Database
  ): Promise<Reminder | null> {
    const row = await db.get<{
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
      "SELECT id, tracking_id, user_id, scheduled_time, notes, status, value, created_at, updated_at FROM reminders WHERE tracking_id = ? AND user_id = ? AND status = ? LIMIT 1",
      [trackingId, userId, ReminderStatus.UPCOMING]
    );

    if (!row) {
      return null;
    }

    return new Reminder({
      id: row.id,
      tracking_id: row.tracking_id,
      user_id: row.user_id,
      scheduled_time: normalizeScheduledTime(row.scheduled_time),
      notes: row.notes || undefined,
      status: (row.status as ReminderStatus) || ReminderStatus.PENDING,
      value: (row.value as ReminderValue) || null,
      created_at: row.created_at,
      updated_at: row.updated_at,
    });
  }

  /**
   * Delete all Upcoming reminders for a tracking.
   * @param trackingId - Tracking ID
   * @param userId - User ID (for authorization)
   * @param db - Database instance
   * @returns Promise resolving to number of deleted reminders
   * @public
   */
  static async deleteUpcomingByTrackingId(
    trackingId: number,
    userId: number,
    db: Database
  ): Promise<number> {
    const result = await db.run(
      "DELETE FROM reminders WHERE tracking_id = ? AND user_id = ? AND status = ?",
      [trackingId, userId, ReminderStatus.UPCOMING]
    );

    return result.changes;
  }
}
