import { Database } from "../db/database.js";
import { Tracking, TrackingData, TrackingType } from "../models/Tracking.js";

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

    const rows = await this.db.all<{
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

    console.log(
      `[${new Date().toISOString()}] TRACKING | Retrieved ${
        rows.length
      } trackings for userId: ${userId}`
    );

    return rows.map((row) => ({
      id: row.id,
      user_id: row.user_id,
      question: row.question,
      type: row.type as TrackingType,
      notes: row.notes || undefined,
      icon: row.icon || undefined,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));
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

    const row = await this.db.get<{
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
      [trackingId, userId]
    );

    if (!row) {
      console.log(
        `[${new Date().toISOString()}] TRACKING | Tracking not found for ID: ${trackingId} and userId: ${userId}`
      );
      return null;
    }

    console.log(
      `[${new Date().toISOString()}] TRACKING | Tracking found: ID ${
        row.id
      }, question: ${row.question}`
    );

    return {
      id: row.id,
      user_id: row.user_id,
      question: row.question,
      type: row.type as TrackingType,
      notes: row.notes || undefined,
      icon: row.icon || undefined,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  /**
   * Create a new tracking.
   * @param userId - The user ID
   * @param question - The tracking question
   * @param type - The tracking type (true_false or register)
   * @param notes - Optional notes (rich text)
   * @param icon - Optional icon (emoji)
   * @returns Promise resolving to created tracking data
   * @throws Error if validation fails
   * @public
   */
  async createTracking(
    userId: number,
    question: string,
    type: string,
    notes?: string,
    icon?: string
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

    // Insert tracking
    const result = await this.db.run(
      "INSERT INTO trackings (user_id, question, type, notes, icon) VALUES (?, ?, ?, ?, ?)",
      [
        validatedUserId,
        validatedQuestion,
        validatedType,
        validatedNotes || null,
        validatedIcon || null,
      ]
    );

    if (!result.lastID) {
      console.error(
        `[${new Date().toISOString()}] TRACKING | Failed to create tracking for userId: ${userId}`
      );
      throw new Error("Failed to create tracking");
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
    icon?: string
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

    if (updates.length === 0) {
      console.warn(
        `[${new Date().toISOString()}] TRACKING | Update failed: no fields to update for tracking ID: ${trackingId}`
      );
      throw new Error("No fields to update");
    }

    // Add updated_at timestamp
    updates.push("updated_at = CURRENT_TIMESTAMP");
    values.push(trackingId, userId);

    console.log(
      `[${new Date().toISOString()}] TRACKING | Executing tracking update query for ID: ${trackingId}`
    );

    // Update tracking
    await this.db.run(
      `UPDATE trackings SET ${updates.join(", ")} WHERE id = ? AND user_id = ?`,
      values
    );

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
