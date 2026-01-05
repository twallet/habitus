import {
  TrackingData,
  Frequency,
  TrackingState,
  MAX_TRACKING_QUESTION_LENGTH,
} from "../types.js";

/**
 * Tracking model class for representing tracking entities.
 * Contains validation logic shared between frontend and backend.
 * @public
 */
export class Tracking {
  /**
   * Maximum allowed length for tracking questions.
   * @public
   */
  static readonly MAX_QUESTION_LENGTH: number = MAX_TRACKING_QUESTION_LENGTH;

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
   * Frequency pattern for reminder schedule (required).
   * @public
   */
  frequency: Frequency;

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
    this.frequency = data.frequency;
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
    this.frequency = Tracking.validateFrequency(this.frequency);
    this.state = Tracking.validateState(this.state);
    return this;
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
      frequency: this.frequency,
      state: this.state,
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
  }

  /**
   * Convert tracking instance to TrackingData interface (alias for toData).
   * @returns Tracking data object
   * @public
   */
  toJSON(): TrackingData {
    return this.toData();
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
      normalizedState !== TrackingState.ARCHIVED
    ) {
      throw new TypeError(
        `State must be one of: "${TrackingState.RUNNING}", "${TrackingState.PAUSED}", "${TrackingState.ARCHIVED}"`
      );
    }

    return normalizedState as TrackingState;
  }

  /**
   * Validates a state transition is allowed.
   * Allows any transition from any state to any other state, except:
   * - Cannot transition to the same state
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
   * Validates frequency pattern (required).
   * @param frequency - The frequency pattern to validate
   * @param timezone - Optional user timezone (IANA timezone) for one-time date validation
   * @returns The validated frequency pattern
   * @throws {@link TypeError} If the frequency pattern is invalid
   * @public
   */
  static validateFrequency(frequency: Frequency, timezone?: string): Frequency {
    if (frequency === null || frequency === undefined) {
      throw new TypeError("Frequency is required");
    }

    if (typeof frequency !== "object" || Array.isArray(frequency)) {
      throw new TypeError("Frequency must be an object");
    }

    if (!frequency.type) {
      throw new TypeError("Frequency type is required");
    }

    // Validate daily frequency
    if (frequency.type === "daily") {
      return frequency;
    }

    // Validate weekly frequency
    if (frequency.type === "weekly") {
      if (
        !frequency.days ||
        !Array.isArray(frequency.days) ||
        frequency.days.length === 0
      ) {
        throw new TypeError(
          "days array is required for weekly frequency and must not be empty"
        );
      }
      for (const day of frequency.days) {
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
      const uniqueDays = new Set(frequency.days);
      if (uniqueDays.size !== frequency.days.length) {
        throw new TypeError("days array must not contain duplicates");
      }
      return frequency;
    }

    // Validate monthly frequency
    if (frequency.type === "monthly") {
      if (!frequency.kind) {
        throw new TypeError("kind is required for monthly frequency");
      }
      if (
        frequency.kind !== "day_number" &&
        frequency.kind !== "last_day" &&
        frequency.kind !== "weekday_ordinal"
      ) {
        throw new TypeError(
          "kind must be one of: day_number, last_day, weekday_ordinal"
        );
      }
      if (frequency.kind === "day_number") {
        if (
          !frequency.day_numbers ||
          !Array.isArray(frequency.day_numbers) ||
          frequency.day_numbers.length === 0
        ) {
          throw new TypeError(
            "day_numbers array is required for day_number kind and must not be empty"
          );
        }
        for (const dayNum of frequency.day_numbers) {
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
      } else if (frequency.kind === "weekday_ordinal") {
        if (frequency.weekday === undefined || frequency.weekday === null) {
          throw new TypeError("weekday is required for weekday_ordinal kind");
        }
        if (
          typeof frequency.weekday !== "number" ||
          !Number.isInteger(frequency.weekday) ||
          frequency.weekday < 0 ||
          frequency.weekday > 6
        ) {
          throw new TypeError(
            "weekday must be an integer between 0 and 6 (0=Sunday, 6=Saturday)"
          );
        }
        if (frequency.ordinal === undefined || frequency.ordinal === null) {
          throw new TypeError("ordinal is required for weekday_ordinal kind");
        }
        if (
          typeof frequency.ordinal !== "number" ||
          !Number.isInteger(frequency.ordinal) ||
          frequency.ordinal < 1 ||
          frequency.ordinal > 5
        ) {
          throw new TypeError("ordinal must be an integer between 1 and 5");
        }
      }
      return frequency;
    }

    // Validate yearly frequency
    if (frequency.type === "yearly") {
      if (!frequency.kind) {
        throw new TypeError("kind is required for yearly frequency");
      }
      if (frequency.kind !== "date" && frequency.kind !== "weekday_ordinal") {
        throw new TypeError("kind must be one of: date, weekday_ordinal");
      }
      if (frequency.kind === "date") {
        if (frequency.month === undefined || frequency.month === null) {
          throw new TypeError("month is required for date kind");
        }
        if (
          typeof frequency.month !== "number" ||
          !Number.isInteger(frequency.month) ||
          frequency.month < 1 ||
          frequency.month > 12
        ) {
          throw new TypeError("month must be an integer between 1 and 12");
        }
        if (frequency.day === undefined || frequency.day === null) {
          throw new TypeError("day is required for date kind");
        }
        if (
          typeof frequency.day !== "number" ||
          !Number.isInteger(frequency.day) ||
          frequency.day < 1 ||
          frequency.day > 31
        ) {
          throw new TypeError("day must be an integer between 1 and 31");
        }
      } else if (frequency.kind === "weekday_ordinal") {
        if (frequency.weekday === undefined || frequency.weekday === null) {
          throw new TypeError("weekday is required for weekday_ordinal kind");
        }
        if (
          typeof frequency.weekday !== "number" ||
          !Number.isInteger(frequency.weekday) ||
          frequency.weekday < 0 ||
          frequency.weekday > 6
        ) {
          throw new TypeError(
            "weekday must be an integer between 0 and 6 (0=Sunday, 6=Saturday)"
          );
        }
        if (frequency.ordinal === undefined || frequency.ordinal === null) {
          throw new TypeError("ordinal is required for weekday_ordinal kind");
        }
        if (
          typeof frequency.ordinal !== "number" ||
          !Number.isInteger(frequency.ordinal) ||
          frequency.ordinal < 1 ||
          frequency.ordinal > 5
        ) {
          throw new TypeError("ordinal must be an integer between 1 and 5");
        }
      }
      return frequency;
    }

    // Validate one-time frequency
    if (frequency.type === "one-time") {
      if (!frequency.date) {
        throw new TypeError("date is required for one-time frequency");
      }
      // Validate date format (YYYY-MM-DD)
      const datePattern = /^\d{4}-\d{2}-\d{2}$/;
      if (!datePattern.test(frequency.date)) {
        throw new TypeError("date must be in YYYY-MM-DD format");
      }
      
      // Parse the date components
      const [year, month, day] = frequency.date.split("-").map(Number);
      const dateObj = new Date(year, month - 1, day);
      if (isNaN(dateObj.getTime())) {
        throw new TypeError("date must be a valid date");
      }
      
      // Validate that the date is today or in the future IN USER'S TIMEZONE
      if (timezone) {
        // Get current date in user's timezone
        const now = new Date();
        const formatter = new Intl.DateTimeFormat("en-US", {
          timeZone: timezone,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        });
        const parts = formatter.formatToParts(now);
        const userYear = parseInt(parts.find((p) => p.type === "year")!.value);
        const userMonth = parseInt(parts.find((p) => p.type === "month")!.value);
        const userDay = parseInt(parts.find((p) => p.type === "day")!.value);
        
        const userToday = new Date(userYear, userMonth - 1, userDay);
        const selectedDateOnly = new Date(year, month - 1, day);
        
        if (selectedDateOnly < userToday) {
          throw new TypeError("date must be today or in the future");
        }
      } else {
        // Fallback to server timezone if no user timezone provided
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const selectedDateOnly = new Date(year, month - 1, day);
        
        if (selectedDateOnly < today) {
          throw new TypeError("date must be today or in the future");
        }
      }
      return frequency;
    }

    throw new TypeError(
      `Invalid frequency type: ${
        (frequency as any).type
      }. Must be one of: daily, weekly, monthly, yearly, one-time`
    );
  }
}
