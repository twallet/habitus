import { Database } from "../db/database.js";
import {
  Tracking,
  TrackingData,
  TrackingType,
  DaysPattern,
} from "../models/Tracking.js";
import {
  TrackingSchedule,
  TrackingScheduleData,
} from "../models/TrackingSchedule.js";

/**
 * Service for tracking-related database operations.
 * @public
 */
export class TrackingService {
  private db: Database;

  /**
   * Create a new TrackingService instance.
   * @param db - Database instance
   * @public
   */
  constructor(db: Database) {
    this.db = db;
  }

  /**
   * Get all trackings for a user.
   * @param userId - The user ID
   * @returns Promise resolving to array of tracking data
   * @public
   */
  async getTrackingsByUserId(userId: number): Promise<TrackingData[]> {
    console.log(
      `[${new Date().toISOString()}] TRACKING | Fetching trackings for userId: ${userId}`
    );

    const trackings = await Tracking.loadByUserId(userId, this.db);

    console.log(
      `[${new Date().toISOString()}] TRACKING | Retrieved ${
        trackings.length
      } trackings for userId: ${userId}`
    );

    return trackings.map((tracking) => tracking.toData());
  }

  /**
   * Get a tracking by ID.
   * @param trackingId - The tracking ID
   * @param userId - The user ID (for authorization)
   * @returns Promise resolving to tracking data or null if not found
   * @public
   */
  async getTrackingById(
    trackingId: number,
    userId: number
  ): Promise<TrackingData | null> {
    console.log(
      `[${new Date().toISOString()}] TRACKING | Fetching tracking by ID: ${trackingId} for userId: ${userId}`
    );

    const tracking = await Tracking.loadById(trackingId, userId, this.db);

    if (!tracking) {
      console.log(
        `[${new Date().toISOString()}] TRACKING | Tracking not found for ID: ${trackingId} and userId: ${userId}`
      );
      return null;
    }

    console.log(
      `[${new Date().toISOString()}] TRACKING | Tracking found: ID ${
        tracking.id
      }, question: ${tracking.question}`
    );

    return tracking.toData();
  }

  /**
   * Create a new tracking.
   * @param userId - The user ID
   * @param question - The tracking question
   * @param type - The tracking type (true_false or register)
   * @param notes - Optional notes (rich text)
   * @param icon - Optional icon (emoji)
   * @param schedules - Array of schedules (required, 1-5 schedules)
   * @param days - Optional days pattern for reminder frequency
   * @returns Promise resolving to created tracking data
   * @throws Error if validation fails
   * @public
   */
  async createTracking(
    userId: number,
    question: string,
    type: string,
    notes?: string,
    icon?: string,
    schedules?: Array<{ hour: number; minutes: number }>,
    days?: import("../models/Tracking.js").DaysPattern
  ): Promise<TrackingData> {
    console.log(
      `[${new Date().toISOString()}] TRACKING | Creating tracking for userId: ${userId}`
    );

    // Validate inputs
    const validatedUserId = Tracking.validateUserId(userId);
    const validatedQuestion = Tracking.validateQuestion(question);
    const validatedType = Tracking.validateType(type);
    const validatedNotes = Tracking.validateNotes(notes);
    const validatedIcon = Tracking.validateIcon(icon);
    const validatedDays = Tracking.validateDays(days);

    // Validate schedules
    if (!schedules || schedules.length === 0) {
      throw new TypeError("At least one schedule is required");
    }
    const validatedSchedules = TrackingSchedule.validateSchedules(schedules, 0); // trackingId will be set after creation

    // Insert tracking
    const result = await this.db.run(
      "INSERT INTO trackings (user_id, question, type, notes, icon, days) VALUES (?, ?, ?, ?, ?, ?)",
      [
        validatedUserId,
        validatedQuestion,
        validatedType,
        validatedNotes || null,
        validatedIcon || null,
        validatedDays ? JSON.stringify(validatedDays) : null,
      ]
    );

    if (!result.lastID) {
      console.error(
        `[${new Date().toISOString()}] TRACKING | Failed to create tracking for userId: ${userId}`
      );
      throw new Error("Failed to create tracking");
    }

    // Create schedules
    for (const schedule of validatedSchedules) {
      const scheduleInstance = new TrackingSchedule({
        id: 0,
        tracking_id: result.lastID,
        hour: schedule.hour,
        minutes: schedule.minutes,
      });
      await scheduleInstance.save(this.db);
    }

    // Retrieve created tracking
    const tracking = await this.getTrackingById(result.lastID, validatedUserId);
    if (!tracking) {
      console.error(
        `[${new Date().toISOString()}] TRACKING | Failed to retrieve created tracking for userId: ${userId}`
      );
      throw new Error("Failed to retrieve created tracking");
    }

    console.log(
      `[${new Date().toISOString()}] TRACKING | Tracking created successfully: ID ${
        tracking.id
      }`
    );

    return tracking;
  }

  /**
   * Update a tracking.
   * @param trackingId - The tracking ID
   * @param userId - The user ID (for authorization)
   * @param question - Updated question (optional)
   * @param type - Updated type (optional)
   * @param notes - Updated notes (optional)
   * @param icon - Updated icon (optional)
   * @param schedules - Updated schedules array (optional, 1-5 schedules if provided)
   * @param days - Updated days pattern (optional)
   * @returns Promise resolving to updated tracking data
   * @throws Error if tracking not found or validation fails
   * @public
   */
  async updateTracking(
    trackingId: number,
    userId: number,
    question?: string,
    type?: string,
    notes?: string,
    icon?: string,
    schedules?: Array<{ hour: number; minutes: number }>,
    days?: DaysPattern
  ): Promise<TrackingData> {
    console.log(
      `[${new Date().toISOString()}] TRACKING | Updating tracking ID: ${trackingId} for userId: ${userId}`
    );

    // Verify tracking exists and belongs to user
    const existingTracking = await this.getTrackingById(trackingId, userId);
    if (!existingTracking) {
      console.warn(
        `[${new Date().toISOString()}] TRACKING | Update failed: tracking not found for ID: ${trackingId} and userId: ${userId}`
      );
      throw new Error("Tracking not found");
    }

    // Build update fields
    const updates: string[] = [];
    const values: any[] = [];

    if (question !== undefined) {
      const validatedQuestion = Tracking.validateQuestion(question);
      updates.push("question = ?");
      values.push(validatedQuestion);
    }

    if (type !== undefined) {
      const validatedType = Tracking.validateType(type);
      updates.push("type = ?");
      values.push(validatedType);
    }

    if (notes !== undefined) {
      const validatedNotes = Tracking.validateNotes(notes);
      updates.push("notes = ?");
      values.push(validatedNotes || null);
    }

    if (icon !== undefined) {
      const validatedIcon = Tracking.validateIcon(icon);
      updates.push("icon = ?");
      values.push(validatedIcon || null);
    }

    if (days !== undefined) {
      const validatedDays = Tracking.validateDays(days);
      updates.push("days = ?");
      values.push(validatedDays ? JSON.stringify(validatedDays) : null);
    }

    // Update schedules if provided
    if (schedules !== undefined) {
      const validatedSchedules = TrackingSchedule.validateSchedules(
        schedules,
        trackingId
      );

      // Delete existing schedules
      await this.db.run(
        "DELETE FROM tracking_schedules WHERE tracking_id = ?",
        [trackingId]
      );

      // Create new schedules
      for (const schedule of validatedSchedules) {
        const scheduleInstance = new TrackingSchedule({
          id: 0,
          tracking_id: trackingId,
          hour: schedule.hour,
          minutes: schedule.minutes,
        });
        await scheduleInstance.save(this.db);
      }
    }

    if (updates.length === 0 && schedules === undefined) {
      console.warn(
        `[${new Date().toISOString()}] TRACKING | Update failed: no fields to update for tracking ID: ${trackingId}`
      );
      throw new Error("No fields to update");
    }

    // Add updated_at timestamp if there are field updates
    if (updates.length > 0) {
      updates.push("updated_at = CURRENT_TIMESTAMP");
      values.push(trackingId, userId);

      console.log(
        `[${new Date().toISOString()}] TRACKING | Executing tracking update query for ID: ${trackingId}`
      );

      // Update tracking
      await this.db.run(
        `UPDATE trackings SET ${updates.join(
          ", "
        )} WHERE id = ? AND user_id = ?`,
        values
      );
    }

    // Retrieve updated tracking
    const tracking = await this.getTrackingById(trackingId, userId);
    if (!tracking) {
      console.error(
        `[${new Date().toISOString()}] TRACKING | Failed to retrieve updated tracking for ID: ${trackingId}`
      );
      throw new Error("Failed to retrieve updated tracking");
    }

    console.log(
      `[${new Date().toISOString()}] TRACKING | Tracking updated successfully: ID ${
        tracking.id
      }`
    );

    return tracking;
  }

  /**
   * Delete a tracking by ID.
   * @param trackingId - The tracking ID to delete
   * @param userId - The user ID (for authorization)
   * @returns Promise resolving when tracking is deleted
   * @throws Error if tracking not found
   * @public
   */
  async deleteTracking(trackingId: number, userId: number): Promise<void> {
    console.log(
      `[${new Date().toISOString()}] TRACKING | Deleting tracking ID: ${trackingId} for userId: ${userId}`
    );

    const result = await this.db.run(
      "DELETE FROM trackings WHERE id = ? AND user_id = ?",
      [trackingId, userId]
    );

    if (result.changes === 0) {
      console.warn(
        `[${new Date().toISOString()}] TRACKING | Delete failed: tracking not found for ID: ${trackingId} and userId: ${userId}`
      );
      throw new Error("Tracking not found");
    }

    console.log(
      `[${new Date().toISOString()}] TRACKING | Tracking deleted successfully: ID ${trackingId}`
    );
  }
}
