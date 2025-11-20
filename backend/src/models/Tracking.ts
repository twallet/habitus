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
  start_tracking_date: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * Tracking model for database operations.
 * @public
 */
export class Tracking {
  /**
   * Maximum allowed length for tracking questions.
   * @public
   */
  static readonly MAX_QUESTION_LENGTH: number = 500;

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
}
