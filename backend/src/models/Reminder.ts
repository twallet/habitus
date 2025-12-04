import { Database } from "../db/database.js";

/**
 * Reminder status enumeration.
 * @public
 */
export enum ReminderStatus {
  PENDING = "Pending",
  ANSWERED = "Answered",
  UPCOMING = "Upcoming",
}

/**
 * Reminder data interface.
 * @public
 */
export interface ReminderData {
  id: number;
  tracking_id: number;
  user_id: number;
  scheduled_time: string;
  answer?: string;
  notes?: string;
  status: ReminderStatus;
  created_at?: string;
  updated_at?: string;
}

/**
 * Reminder model class for representing reminder entities and database operations.
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
   * Optional answer (empty by default).
   * @public
   */
  answer?: string;

  /**
   * Optional notes added when answering.
   * @public
   */
  notes?: string;

  /**
   * Reminder status.
   * @public
   */
  status: ReminderStatus;

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
    this.answer = data.answer;
    this.notes = data.notes;
    this.status = data.status || ReminderStatus.PENDING;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }

  /**
   * Validate the reminder instance.
   * Validates all fields according to business rules.
   * @returns The validated reminder instance
   * @throws {@link TypeError} If validation fails
   * @public
   */
  validate(): Reminder {
    this.tracking_id = Reminder.validateTrackingId(this.tracking_id);
    this.user_id = Reminder.validateUserId(this.user_id);
    this.scheduled_time = Reminder.validateScheduledTime(this.scheduled_time);
    if (this.answer !== undefined) {
      this.answer = Reminder.validateAnswer(this.answer);
    }
    if (this.notes !== undefined) {
      this.notes = Reminder.validateNotes(this.notes);
    }
    this.status = Reminder.validateStatus(this.status);
    return this;
  }

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

    if (this.id) {
      // Update existing reminder
      const updates: string[] = [];
      const values: any[] = [];

      updates.push("scheduled_time = ?");
      values.push(this.scheduled_time);

      if (this.answer !== undefined) {
        updates.push("answer = ?");
        values.push(this.answer || null);
      }

      if (this.notes !== undefined) {
        updates.push("notes = ?");
        values.push(this.notes || null);
      }

      if (this.status !== undefined) {
        updates.push("status = ?");
        values.push(this.status);
      }

      updates.push("updated_at = CURRENT_TIMESTAMP");
      values.push(this.id, this.user_id);

      await db.run(
        `UPDATE reminders SET ${updates.join(
          ", "
        )} WHERE id = ? AND user_id = ?`,
        values
      );

      return this.toData();
    } else {
      // Create new reminder
      const result = await db.run(
        "INSERT INTO reminders (tracking_id, user_id, scheduled_time, answer, notes, status) VALUES (?, ?, ?, ?, ?, ?)",
        [
          this.tracking_id,
          this.user_id,
          this.scheduled_time,
          this.answer || null,
          this.notes || null,
          this.status || ReminderStatus.PENDING,
        ]
      );

      if (!result.lastID) {
        throw new Error("Failed to create reminder");
      }

      this.id = result.lastID;
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
    if (updates.answer !== undefined) {
      this.answer = Reminder.validateAnswer(updates.answer);
    }
    if (updates.notes !== undefined) {
      this.notes = Reminder.validateNotes(updates.notes);
    }
    if (updates.status !== undefined) {
      this.status = Reminder.validateStatus(updates.status);
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
      answer: this.answer,
      notes: this.notes,
      status: this.status,
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
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
      answer: string | null;
      notes: string | null;
      status: string;
      created_at: string;
      updated_at: string;
    }>(
      "SELECT id, tracking_id, user_id, scheduled_time, answer, notes, status, created_at, updated_at FROM reminders WHERE id = ? AND user_id = ?",
      [id, userId]
    );

    if (!row) {
      return null;
    }

    return new Reminder({
      id: row.id,
      tracking_id: row.tracking_id,
      user_id: row.user_id,
      scheduled_time: row.scheduled_time,
      answer: row.answer || undefined,
      notes: row.notes || undefined,
      status: (row.status as ReminderStatus) || ReminderStatus.PENDING,
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
      answer: string | null;
      notes: string | null;
      status: string;
      created_at: string;
      updated_at: string;
    }>(
      "SELECT id, tracking_id, user_id, scheduled_time, answer, notes, status, created_at, updated_at FROM reminders WHERE user_id = ? ORDER BY scheduled_time ASC",
      [userId]
    );

    return rows.map(
      (row) =>
        new Reminder({
          id: row.id,
          tracking_id: row.tracking_id,
          user_id: row.user_id,
          scheduled_time: row.scheduled_time,
          answer: row.answer || undefined,
          notes: row.notes || undefined,
          status: (row.status as ReminderStatus) || ReminderStatus.PENDING,
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
      answer: string | null;
      notes: string | null;
      status: string;
      created_at: string;
      updated_at: string;
    }>(
      "SELECT id, tracking_id, user_id, scheduled_time, answer, notes, status, created_at, updated_at FROM reminders WHERE tracking_id = ? AND user_id = ? ORDER BY scheduled_time ASC LIMIT 1",
      [trackingId, userId]
    );

    if (!row) {
      return null;
    }

    return new Reminder({
      id: row.id,
      tracking_id: row.tracking_id,
      user_id: row.user_id,
      scheduled_time: row.scheduled_time,
      answer: row.answer || undefined,
      notes: row.notes || undefined,
      status: (row.status as ReminderStatus) || ReminderStatus.PENDING,
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
      answer: string | null;
      notes: string | null;
      status: string;
      created_at: string;
      updated_at: string;
    }>(
      "SELECT id, tracking_id, user_id, scheduled_time, answer, notes, status, created_at, updated_at FROM reminders WHERE tracking_id = ? AND user_id = ? AND status = ? LIMIT 1",
      [trackingId, userId, ReminderStatus.UPCOMING]
    );

    if (!row) {
      return null;
    }

    return new Reminder({
      id: row.id,
      tracking_id: row.tracking_id,
      user_id: row.user_id,
      scheduled_time: row.scheduled_time,
      answer: row.answer || undefined,
      notes: row.notes || undefined,
      status: (row.status as ReminderStatus) || ReminderStatus.PENDING,
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
   * Validates answer (optional text).
   * @param answer - The answer to validate (optional)
   * @returns The validated answer or undefined if empty
   * @public
   */
  static validateAnswer(answer?: string | null): string | undefined {
    if (answer === null || answer === undefined) {
      return undefined;
    }

    if (typeof answer !== "string") {
      throw new TypeError("Answer must be a string");
    }

    const trimmedAnswer = answer.trim();
    if (!trimmedAnswer) {
      return undefined;
    }

    return trimmedAnswer;
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
}
