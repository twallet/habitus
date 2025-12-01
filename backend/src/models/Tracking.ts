import { Database } from "../db/database.js";
import { TrackingSchedule, TrackingScheduleData } from "./TrackingSchedule.js";

/**
 * Tracking type enumeration.
 * @public
 */
export enum TrackingType {
  TRUE_FALSE = "true_false",
  REGISTER = "register",
}

/**
 * Tracking data interface.
 * @public
 */
export interface TrackingData {
  id: number;
  user_id: number;
  question: string;
  type: TrackingType;
  notes?: string;
  icon?: string;
  schedules?: TrackingScheduleData[];
  created_at?: string;
  updated_at?: string;
}

/**
 * Tracking model class for representing tracking entities and database operations.
 * @public
 */
export class Tracking {
  /**
   * Maximum allowed length for tracking questions.
   * @public
   */
  static readonly MAX_QUESTION_LENGTH: number = 500;

  /**
   * Tracking ID.
   * @public
   */
  id: number;

  /**
   * User ID who owns this tracking.
   * @public
   */
  user_id: number;

  /**
   * Tracking question.
   * @public
   */
  question: string;

  /**
   * Tracking type.
   * @public
   */
  type: TrackingType;

  /**
   * Optional notes (rich text).
   * @public
   */
  notes?: string;

  /**
   * Optional icon (emoji).
   * @public
   */
  icon?: string;

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
   * Create a new Tracking instance.
   * @param data - Tracking data to initialize the instance
   * @public
   */
  constructor(data: TrackingData) {
    this.id = data.id;
    this.user_id = data.user_id;
    this.question = data.question;
    this.type = data.type;
    this.notes = data.notes;
    this.icon = data.icon;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }

  /**
   * Validate the tracking instance.
   * Validates all fields according to business rules.
   * @returns The validated tracking instance
   * @throws {@link TypeError} If validation fails
   * @public
   */
  validate(): Tracking {
    this.user_id = Tracking.validateUserId(this.user_id);
    this.question = Tracking.validateQuestion(this.question);
    this.type = Tracking.validateType(this.type as string);
    if (this.notes !== undefined) {
      this.notes = Tracking.validateNotes(this.notes);
    }
    if (this.icon !== undefined) {
      this.icon = Tracking.validateIcon(this.icon);
    }
    return this;
  }

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

      updates.push("type = ?");
      values.push(this.type);

      if (this.notes !== undefined) {
        updates.push("notes = ?");
        values.push(this.notes || null);
      }

      if (this.icon !== undefined) {
        updates.push("icon = ?");
        values.push(this.icon || null);
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
        "INSERT INTO trackings (user_id, question, type, notes, icon) VALUES (?, ?, ?, ?, ?)",
        [
          this.user_id,
          this.question,
          this.type,
          this.notes || null,
          this.icon || null,
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
    if (updates.type !== undefined) {
      this.type = Tracking.validateType(updates.type as string);
    }
    if (updates.notes !== undefined) {
      this.notes = Tracking.validateNotes(updates.notes);
    }
    if (updates.icon !== undefined) {
      this.icon = Tracking.validateIcon(updates.icon);
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
   * @returns Tracking data object
   * @public
   */
  toData(): TrackingData {
    return {
      id: this.id,
      user_id: this.user_id,
      question: this.question,
      type: this.type,
      notes: this.notes,
      icon: this.icon,
      schedules: (this as any).schedules,
      created_at: this.created_at,
      updated_at: this.updated_at,
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
      type: string;
      notes: string | null;
      icon: string | null;
      created_at: string;
      updated_at: string;
    }>(
      "SELECT id, user_id, question, type, notes, icon, created_at, updated_at FROM trackings WHERE id = ? AND user_id = ?",
      [id, userId]
    );

    if (!row) {
      return null;
    }

    const tracking = new Tracking({
      id: row.id,
      user_id: row.user_id,
      question: row.question,
      type: row.type as TrackingType,
      notes: row.notes || undefined,
      icon: row.icon || undefined,
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
      type: string;
      notes: string | null;
      icon: string | null;
      created_at: string;
      updated_at: string;
    }>(
      "SELECT id, user_id, question, type, notes, icon, created_at, updated_at FROM trackings WHERE user_id = ? ORDER BY created_at DESC",
      [userId]
    );

    const trackings = await Promise.all(
      rows.map(async (row) => {
        const tracking = new Tracking({
          id: row.id,
          user_id: row.user_id,
          question: row.question,
          type: row.type as TrackingType,
          notes: row.notes || undefined,
          icon: row.icon || undefined,
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

  /**
   * Validates a tracking question.
   * @param question - The question to validate
   * @returns The trimmed and validated question
   * @throws {@link TypeError} If the question is invalid
   * @public
   */
  static validateQuestion(question: string): string {
    if (typeof question !== "string") {
      throw new TypeError("Question must be a string");
    }

    const trimmedQuestion = question.trim();
    if (!trimmedQuestion) {
      throw new TypeError("Question must not be empty");
    }

    if (trimmedQuestion.length > Tracking.MAX_QUESTION_LENGTH) {
      throw new TypeError(
        `Question must not exceed ${Tracking.MAX_QUESTION_LENGTH} characters`
      );
    }

    return trimmedQuestion;
  }

  /**
   * Validates a tracking type.
   * @param type - The type to validate
   * @returns The validated tracking type
   * @throws {@link TypeError} If the type is invalid
   * @public
   */
  static validateType(type: string): TrackingType {
    if (typeof type !== "string") {
      throw new TypeError("Type must be a string");
    }

    const normalizedType = type.toLowerCase().trim();
    if (
      normalizedType !== TrackingType.TRUE_FALSE &&
      normalizedType !== TrackingType.REGISTER
    ) {
      throw new TypeError(
        `Type must be either "${TrackingType.TRUE_FALSE}" or "${TrackingType.REGISTER}"`
      );
    }

    return normalizedType as TrackingType;
  }

  /**
   * Validates notes (optional rich text content).
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
   * Validates icon (optional emoji).
   * @param icon - The icon to validate (optional)
   * @returns The validated icon or undefined if empty
   * @throws {@link TypeError} If the icon is invalid
   * @public
   */
  static validateIcon(icon?: string | null): string | undefined {
    if (icon === null || icon === undefined) {
      return undefined;
    }

    if (typeof icon !== "string") {
      throw new TypeError("Icon must be a string");
    }

    const trimmedIcon = icon.trim();
    if (!trimmedIcon) {
      return undefined;
    }

    // Emojis can be up to ~10 characters (some complex emojis are longer)
    if (trimmedIcon.length > 20) {
      throw new TypeError("Icon must not exceed 20 characters");
    }

    return trimmedIcon;
  }
}
