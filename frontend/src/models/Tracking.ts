/**
 * Tracking type enumeration.
 * @public
 */
export enum TrackingType {
  TRUE_FALSE = "true_false",
  REGISTER = "register",
}

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
  // For DAY_OF_MONTH pattern: "day_number" | "last_day" | "weekday_ordinal"
  // For DAY_OF_YEAR pattern: "date" | "weekday_ordinal"
  type?: "day_number" | "last_day" | "weekday_ordinal" | "date";
  day_numbers?: number[]; // 1-31 (for DAY_OF_MONTH)
  weekday?: number; // 0-6, where 0=Sunday
  ordinal?: number; // 1-5 (first, second, third, fourth, fifth)
  // For DAY_OF_YEAR pattern
  month?: number; // 1-12
  day?: number; // 1-31
}

/**
 * Tracking model class for representing tracking entities.
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
    this.question = Tracking.validateQuestion(this.question);
    this.type = Tracking.validateType(this.type as string);
    if (this.notes !== undefined) {
      this.notes = Tracking.validateNotes(this.notes);
    }
    return this;
  }

  /**
   * Convert tracking instance to TrackingData interface.
   * @returns Tracking data object
   * @public
   */
  toJSON(): TrackingData {
    return {
      id: this.id,
      user_id: this.user_id,
      question: this.question,
      type: this.type,
      notes: this.notes,
      icon: this.icon,
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
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
}

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
  days?: DaysPattern;
  schedules?: TrackingScheduleData[];
  created_at?: string;
  updated_at?: string;
}
