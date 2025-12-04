import { Database } from "../db/database.js";
import { TrackingSchedule, TrackingScheduleData } from "./TrackingSchedule.js";

/**
 * Days pattern type enumeration.
 * @public
 */
export enum DaysPatternType {
  INTERVAL = "interval",
  DAY_OF_WEEK = "day_of_week",
  DAY_OF_MONTH = "day_of_month",
  DAY_OF_YEAR = "day_of_year",
}

/**
 * Tracking state enumeration.
 * @public
 */
export enum TrackingState {
  RUNNING = "Running",
  PAUSED = "Paused",
  ARCHIVED = "Archived",
  DELETED = "Deleted",
}

/**
 * Days pattern interface for reminder frequency.
 * @public
 */
export interface DaysPattern {
  pattern_type: DaysPatternType;
  // For INTERVAL pattern
  interval_value?: number;
  interval_unit?: "days" | "weeks" | "months" | "years";
  // For DAY_OF_WEEK pattern
  days?: number[]; // 0-6, where 0=Sunday
  // For DAY_OF_MONTH pattern
  type?: "day_number" | "last_day" | "weekday_ordinal";
  day_numbers?: number[]; // 1-31
  weekday?: number; // 0-6, where 0=Sunday
  ordinal?: number; // 1-5 (first, second, third, fourth, fifth)
  // For DAY_OF_YEAR pattern
  month?: number; // 1-12
  day?: number; // 1-31
}

/**
 * Tracking data interface.
 * @public
 */
export interface TrackingData {
  id: number;
  user_id: number;
  question: string;
  notes?: string;
  icon?: string;
  days?: DaysPattern;
  state?: TrackingState;
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
  static readonly MAX_QUESTION_LENGTH: number = 100;

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
   * Optional days pattern for reminder frequency.
   * @public
   */
  days?: DaysPattern;

  /**
   * Tracking state.
   * @public
   */
  state: TrackingState;

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
    this.notes = data.notes;
    this.icon = data.icon;
    this.days = data.days;
    this.state = data.state || TrackingState.RUNNING;
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
    if (this.notes !== undefined) {
      this.notes = Tracking.validateNotes(this.notes);
    }
    if (this.icon !== undefined) {
      this.icon = Tracking.validateIcon(this.icon);
    }
    if (this.days !== undefined) {
      this.days = Tracking.validateDays(this.days);
    }
    this.state = Tracking.validateState(this.state);
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

      if (this.notes !== undefined) {
        updates.push("notes = ?");
        values.push(this.notes || null);
      }

      if (this.icon !== undefined) {
        updates.push("icon = ?");
        values.push(this.icon || null);
      }

      if (this.days !== undefined) {
        updates.push("days = ?");
        values.push(this.days ? JSON.stringify(this.days) : null);
      }

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
        "INSERT INTO trackings (user_id, question, notes, icon, days, state) VALUES (?, ?, ?, ?, ?, ?)",
        [
          this.user_id,
          this.question,
          this.notes || null,
          this.icon || null,
          this.days ? JSON.stringify(this.days) : null,
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
    if (updates.notes !== undefined) {
      this.notes = Tracking.validateNotes(updates.notes);
    }
    if (updates.icon !== undefined) {
      this.icon = Tracking.validateIcon(updates.icon);
    }
    if (updates.days !== undefined) {
      this.days = Tracking.validateDays(updates.days);
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
      notes: this.notes,
      icon: this.icon,
      days: this.days,
      state: this.state,
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
      notes: string | null;
      icon: string | null;
      days: string | null;
      state: string;
      created_at: string;
      updated_at: string;
    }>(
      "SELECT id, user_id, question, notes, icon, days, state, created_at, updated_at FROM trackings WHERE id = ? AND user_id = ?",
      [id, userId]
    );

    if (!row) {
      return null;
    }

    let daysPattern: DaysPattern | undefined;
    if (row.days) {
      try {
        daysPattern = JSON.parse(row.days) as DaysPattern;
      } catch (err) {
        console.error(
          `[${new Date().toISOString()}] TRACKING | Failed to parse days JSON for tracking ${id}:`,
          err
        );
      }
    }

    const tracking = new Tracking({
      id: row.id,
      user_id: row.user_id,
      question: row.question,
      notes: row.notes || undefined,
      icon: row.icon || undefined,
      days: daysPattern,
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
      notes: string | null;
      icon: string | null;
      days: string | null;
      state: string;
      created_at: string;
      updated_at: string;
    }>(
      "SELECT id, user_id, question, notes, icon, days, state, created_at, updated_at FROM trackings WHERE user_id = ? AND state != 'Deleted' ORDER BY created_at DESC",
      [userId]
    );

    const trackings = await Promise.all(
      rows.map(async (row) => {
        let daysPattern: DaysPattern | undefined;
        if (row.days) {
          try {
            daysPattern = JSON.parse(row.days) as DaysPattern;
          } catch (err) {
            console.error(
              `[${new Date().toISOString()}] TRACKING | Failed to parse days JSON for tracking ${
                row.id
              }:`,
              err
            );
          }
        }

        const tracking = new Tracking({
          id: row.id,
          user_id: row.user_id,
          question: row.question,
          notes: row.notes || undefined,
          icon: row.icon || undefined,
          days: daysPattern,
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
   * Validates a tracking state.
   * @param state - The state to validate
   * @returns The validated tracking state
   * @throws {@link TypeError} If the state is invalid
   * @public
   */
  static validateState(state: string | TrackingState): TrackingState {
    if (typeof state !== "string") {
      throw new TypeError("State must be a string");
    }

    const normalizedState = state.trim();
    if (
      normalizedState !== TrackingState.RUNNING &&
      normalizedState !== TrackingState.PAUSED &&
      normalizedState !== TrackingState.ARCHIVED &&
      normalizedState !== TrackingState.DELETED
    ) {
      throw new TypeError(
        `State must be one of: "${TrackingState.RUNNING}", "${TrackingState.PAUSED}", "${TrackingState.ARCHIVED}", "${TrackingState.DELETED}"`
      );
    }

    return normalizedState as TrackingState;
  }

  /**
   * Validates a state transition is allowed.
   * Allows any transition from any state to any other state, except:
   * - Cannot transition to the same state
   * - Cannot transition from DELETED state
   * @param currentState - The current state
   * @param newState - The new state to transition to
   * @throws {@link TypeError} If the transition is not allowed
   * @public
   */
  static validateStateTransition(
    currentState: TrackingState,
    newState: TrackingState
  ): void {
    if (currentState === newState) {
      throw new TypeError(
        "Cannot transition to the same state. The tracking is already in this state."
      );
    }

    if (currentState === TrackingState.DELETED) {
      throw new TypeError(
        "Cannot transition from Deleted state. Deleted trackings cannot be changed."
      );
    }
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

  /**
   * Validates days pattern (optional).
   * @param days - The days pattern to validate (optional)
   * @returns The validated days pattern or undefined if empty
   * @throws {@link TypeError} If the days pattern is invalid
   * @public
   */
  static validateDays(days?: DaysPattern | null): DaysPattern | undefined {
    if (days === null || days === undefined) {
      return undefined;
    }

    if (typeof days !== "object" || Array.isArray(days)) {
      throw new TypeError("Days must be an object");
    }

    if (!days.pattern_type) {
      throw new TypeError("Days pattern_type is required");
    }

    const patternType = days.pattern_type;
    if (
      patternType !== DaysPatternType.INTERVAL &&
      patternType !== DaysPatternType.DAY_OF_WEEK &&
      patternType !== DaysPatternType.DAY_OF_MONTH &&
      patternType !== DaysPatternType.DAY_OF_YEAR
    ) {
      throw new TypeError(
        `Invalid pattern_type: ${patternType}. Must be one of: interval, day_of_week, day_of_month, day_of_year`
      );
    }

    // Validate INTERVAL pattern
    if (patternType === DaysPatternType.INTERVAL) {
      if (days.interval_value === undefined || days.interval_value === null) {
        throw new TypeError("interval_value is required for INTERVAL pattern");
      }
      if (
        typeof days.interval_value !== "number" ||
        !Number.isInteger(days.interval_value) ||
        days.interval_value <= 0
      ) {
        throw new TypeError("interval_value must be a positive integer");
      }
      if (!days.interval_unit) {
        throw new TypeError("interval_unit is required for INTERVAL pattern");
      }
      if (
        days.interval_unit !== "days" &&
        days.interval_unit !== "weeks" &&
        days.interval_unit !== "months" &&
        days.interval_unit !== "years"
      ) {
        throw new TypeError(
          "interval_unit must be one of: days, weeks, months, years"
        );
      }
    }

    // Validate DAY_OF_WEEK pattern
    if (patternType === DaysPatternType.DAY_OF_WEEK) {
      if (!days.days || !Array.isArray(days.days) || days.days.length === 0) {
        throw new TypeError(
          "days array is required for DAY_OF_WEEK pattern and must not be empty"
        );
      }
      for (const day of days.days) {
        if (
          typeof day !== "number" ||
          !Number.isInteger(day) ||
          day < 0 ||
          day > 6
        ) {
          throw new TypeError(
            "days array must contain integers between 0 and 6 (0=Sunday, 6=Saturday)"
          );
        }
      }
      // Check for duplicates
      const uniqueDays = new Set(days.days);
      if (uniqueDays.size !== days.days.length) {
        throw new TypeError("days array must not contain duplicates");
      }
    }

    // Validate DAY_OF_MONTH pattern
    if (patternType === DaysPatternType.DAY_OF_MONTH) {
      if (!days.type) {
        throw new TypeError("type is required for DAY_OF_MONTH pattern");
      }
      if (
        days.type !== "day_number" &&
        days.type !== "last_day" &&
        days.type !== "weekday_ordinal"
      ) {
        throw new TypeError(
          "type must be one of: day_number, last_day, weekday_ordinal"
        );
      }
      if (days.type === "day_number") {
        if (
          !days.day_numbers ||
          !Array.isArray(days.day_numbers) ||
          days.day_numbers.length === 0
        ) {
          throw new TypeError(
            "day_numbers array is required for day_number type and must not be empty"
          );
        }
        for (const dayNum of days.day_numbers) {
          if (
            typeof dayNum !== "number" ||
            !Number.isInteger(dayNum) ||
            dayNum < 1 ||
            dayNum > 31
          ) {
            throw new TypeError(
              "day_numbers must contain integers between 1 and 31"
            );
          }
        }
      } else if (days.type === "weekday_ordinal") {
        if (days.weekday === undefined || days.weekday === null) {
          throw new TypeError("weekday is required for weekday_ordinal type");
        }
        if (
          typeof days.weekday !== "number" ||
          !Number.isInteger(days.weekday) ||
          days.weekday < 0 ||
          days.weekday > 6
        ) {
          throw new TypeError(
            "weekday must be an integer between 0 and 6 (0=Sunday, 6=Saturday)"
          );
        }
        if (days.ordinal === undefined || days.ordinal === null) {
          throw new TypeError("ordinal is required for weekday_ordinal type");
        }
        if (
          typeof days.ordinal !== "number" ||
          !Number.isInteger(days.ordinal) ||
          days.ordinal < 1 ||
          days.ordinal > 5
        ) {
          throw new TypeError("ordinal must be an integer between 1 and 5");
        }
      }
    }

    // Validate DAY_OF_YEAR pattern
    if (patternType === DaysPatternType.DAY_OF_YEAR) {
      if (!days.type) {
        throw new TypeError("type is required for DAY_OF_YEAR pattern");
      }
      const dayOfYearType = days.type as "date" | "weekday_ordinal";
      if (dayOfYearType !== "date" && dayOfYearType !== "weekday_ordinal") {
        throw new TypeError("type must be one of: date, weekday_ordinal");
      }
      if (dayOfYearType === "date") {
        if (days.month === undefined || days.month === null) {
          throw new TypeError("month is required for date type");
        }
        if (
          typeof days.month !== "number" ||
          !Number.isInteger(days.month) ||
          days.month < 1 ||
          days.month > 12
        ) {
          throw new TypeError("month must be an integer between 1 and 12");
        }
        if (days.day === undefined || days.day === null) {
          throw new TypeError("day is required for date type");
        }
        if (
          typeof days.day !== "number" ||
          !Number.isInteger(days.day) ||
          days.day < 1 ||
          days.day > 31
        ) {
          throw new TypeError("day must be an integer between 1 and 31");
        }
      } else if (dayOfYearType === "weekday_ordinal") {
        if (days.weekday === undefined || days.weekday === null) {
          throw new TypeError("weekday is required for weekday_ordinal type");
        }
        if (
          typeof days.weekday !== "number" ||
          !Number.isInteger(days.weekday) ||
          days.weekday < 0 ||
          days.weekday > 6
        ) {
          throw new TypeError(
            "weekday must be an integer between 0 and 6 (0=Sunday, 6=Saturday)"
          );
        }
        if (days.ordinal === undefined || days.ordinal === null) {
          throw new TypeError("ordinal is required for weekday_ordinal type");
        }
        if (
          typeof days.ordinal !== "number" ||
          !Number.isInteger(days.ordinal) ||
          days.ordinal < 1 ||
          days.ordinal > 5
        ) {
          throw new TypeError("ordinal must be an integer between 1 and 5");
        }
      }
    }

    return days;
  }
}
