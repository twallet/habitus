/**
 * Days pattern type enumeration.
 * @public
 */
import {
  TrackingData,
  DaysPattern,
  DaysPatternType,
  TrackingState,
  MAX_TRACKING_QUESTION_LENGTH,
  TrackingScheduleData,
} from "@habitus/shared";

export type { TrackingData, DaysPattern, TrackingScheduleData };
export { DaysPatternType, TrackingState, MAX_TRACKING_QUESTION_LENGTH };




/**
 * Tracking model class for representing tracking entities.
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

