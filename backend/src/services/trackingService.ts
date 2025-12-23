import { Database } from "../db/database.js";
import {
  Tracking,
  type TrackingData,
  TrackingState,
  type DaysPattern,
} from "../models/Tracking.js";
import { TrackingSchedule } from "../models/TrackingSchedule.js";
import { ReminderService } from "./reminderService.js";
import { BaseEntityService } from "./base/BaseEntityService.js";
import { TrackingLifecycleManager } from "./lifecycle/TrackingLifecycleManager.js";

/**
 * Service for tracking-related database operations.
 * @public
 */
export class TrackingService extends BaseEntityService<TrackingData, Tracking> {
  private reminderService: ReminderService;
  private lifecycleManager: TrackingLifecycleManager;

  /**
   * Create a new TrackingService instance.
   * @param db - Database instance
   * @public
   */
  constructor(db: Database) {
    super(db);
    this.reminderService = new ReminderService(db);
    this.lifecycleManager = new TrackingLifecycleManager(
      db,
      this.reminderService
    );
  }

  /**
   * Load entity model by ID.
   * @param id - The tracking ID
   * @param userId - The user ID (for authorization)
   * @returns Promise resolving to tracking model or null if not found
   * @protected
   */
  protected async loadModelById(
    id: number,
    userId: number
  ): Promise<Tracking | null> {
    return await Tracking.loadById(id, userId, this.db);
  }

  /**
   * Load all entity models for a user.
   * @param userId - The user ID
   * @returns Promise resolving to array of tracking models
   * @protected
   */
  protected async loadModelsByUserId(userId: number): Promise<Tracking[]> {
    return await Tracking.loadByUserId(userId, this.db);
  }

  /**
   * Convert entity model to data object.
   * @param model - The tracking model instance
   * @returns Tracking data object
   * @protected
   */
  protected toData(model: Tracking): TrackingData {
    return model.toData();
  }

  /**
   * Get entity name for logging purposes.
   * @returns Entity name
   * @protected
   */
  protected getEntityName(): string {
    return "TRACKING";
  }

  /**
   * Create a new tracking.
   * @param userId - The user ID
   * @param question - The tracking question
   * @param notes - Optional notes (rich text)
   * @param icon - Optional icon (emoji)
   * @param schedules - Array of schedules (required, 1-5 schedules)
   * @param days - Optional days pattern for reminder frequency (required for recurring trackings)
   * @param oneTimeDate - Optional date/time for one-time tracking (ISO datetime string)
   * @returns Promise resolving to created tracking data
   * @throws Error if validation fails
   * @public
   */
  async createTracking(
    userId: number,
    question: string,
    notes?: string,
    icon?: string,
    schedules?: Array<{ hour: number; minutes: number }>,
    days?: import("../models/Tracking.js").DaysPattern,
    oneTimeDate?: string
  ): Promise<TrackingData> {
    console.log(
      `[${new Date().toISOString()}] TRACKING | Creating tracking for userId: ${userId}`
    );

    // Validate inputs
    const validatedUserId = Tracking.validateUserId(userId);
    const validatedQuestion = Tracking.validateQuestion(question);
    const validatedNotes = Tracking.validateNotes(notes);
    const validatedIcon = Tracking.validateIcon(icon);
    const validatedDays = Tracking.validateDays(days);

    // Validate schedules
    if (!schedules || schedules.length === 0) {
      throw new TypeError("At least one schedule is required");
    }
    const validatedSchedules = TrackingSchedule.validateSchedules(schedules, 0); // trackingId will be set after creation

    // Insert tracking with Running state by default
    const result = await this.db.run(
      "INSERT INTO trackings (user_id, question, notes, icon, days, state) VALUES (?, ?, ?, ?, ?, ?)",
      [
        validatedUserId,
        validatedQuestion,
        validatedNotes || null,
        validatedIcon || null,
        validatedDays ? JSON.stringify(validatedDays) : null,
        "Running",
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
    const tracking = await this.getById(result.lastID, validatedUserId);
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

    // For one-time trackings, create reminder directly with the specified date
    if (oneTimeDate) {
      try {
        await this.reminderService.createReminder(
          tracking.id,
          validatedUserId,
          oneTimeDate
        );
        console.log(
          `[${new Date().toISOString()}] TRACKING | Created one-time reminder for tracking ${
            tracking.id
          } at ${oneTimeDate}`
        );
      } catch (error) {
        // Log error but don't fail tracking creation if reminder creation fails
        console.error(
          `[${new Date().toISOString()}] TRACKING | Failed to create one-time reminder for tracking ${
            tracking.id
          }:`,
          error
        );
      }
    } else {
      // Execute onCreate lifecycle hooks (creates initial reminder for recurring trackings)
      await this.lifecycleManager.onCreate(tracking);
    }

    return tracking;
  }

  /**
   * Update a tracking.
   * @param trackingId - The tracking ID
   * @param userId - The user ID (for authorization)
   * @param question - Updated question (optional)
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
    notes?: string,
    icon?: string,
    schedules?: Array<{ hour: number; minutes: number }>,
    days?: DaysPattern
  ): Promise<TrackingData> {
    console.log(
      `[${new Date().toISOString()}] TRACKING | Updating tracking ID: ${trackingId} for userId: ${userId}`
    );

    // Verify tracking exists and belongs to user
    const existingTracking = await this.getById(trackingId, userId);
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
    const tracking = await this.getById(trackingId, userId);
    if (!tracking) {
      console.error(
        `[${new Date().toISOString()}] TRACKING | Failed to retrieve updated tracking for ID: ${trackingId}`
      );
      throw new Error("Failed to retrieve updated tracking");
    }

    // If schedules or days pattern changed, update Upcoming reminder if needed
    const schedulesChanged = schedules !== undefined;
    const daysChanged = days !== undefined;
    if ((schedulesChanged || daysChanged) && tracking.state === "Running") {
      try {
        const { Reminder, ReminderStatus } = await import(
          "../models/Reminder.js"
        );
        // Check if Upcoming reminder exists
        const existingUpcoming = await Reminder.loadUpcomingByTrackingId(
          trackingId,
          userId,
          this.db
        );

        // Calculate new next time
        const nextTime = await this.reminderService.calculateNextReminderTime(
          tracking
        );

        if (nextTime) {
          if (existingUpcoming) {
            // If Upcoming exists, check if the new time differs
            if (existingUpcoming.scheduled_time !== nextTime) {
              // Update or replace the Upcoming reminder
              // Delete existing Upcoming first to ensure only one
              await Reminder.deleteUpcomingByTrackingId(
                trackingId,
                userId,
                this.db
              );
              // Create new Upcoming reminder with updated time
              await this.reminderService.createNextReminderForTracking(
                trackingId,
                userId
              );
              console.log(
                `[${new Date().toISOString()}] TRACKING | Updated Upcoming reminder for tracking ${trackingId} with new time`
              );
            }
          } else {
            // No Upcoming reminder exists, create one
            await this.reminderService.createNextReminderForTracking(
              trackingId,
              userId
            );
            console.log(
              `[${new Date().toISOString()}] TRACKING | Created Upcoming reminder for tracking ${trackingId}`
            );
          }
        }
      } catch (error) {
        // Log error but don't fail tracking update if reminder update fails
        console.error(
          `[${new Date().toISOString()}] TRACKING | Failed to update reminder for tracking ${trackingId}:`,
          error
        );
      }
    }

    console.log(
      `[${new Date().toISOString()}] TRACKING | Tracking updated successfully: ID ${
        tracking.id
      }`
    );

    return tracking;
  }

  /**
   * Update tracking state.
   * Validates state transition and updates only the state field.
   * @param trackingId - The tracking ID
   * @param userId - The user ID (for authorization)
   * @param newState - The new state to transition to
   * @returns Promise resolving to updated tracking data
   * @throws Error if tracking not found or transition is invalid
   * @public
   */
  async updateTrackingState(
    trackingId: number,
    userId: number,
    newState: string
  ): Promise<TrackingData> {
    console.log(
      `[${new Date().toISOString()}] TRACKING | Updating tracking state ID: ${trackingId} for userId: ${userId} to state: ${newState}`
    );

    // Verify tracking exists and belongs to user
    const existingTracking = await this.getById(trackingId, userId);
    if (!existingTracking) {
      console.warn(
        `[${new Date().toISOString()}] TRACKING | Update state failed: tracking not found for ID: ${trackingId} and userId: ${userId}`
      );
      throw new Error("Tracking not found");
    }

    // Validate new state
    const validatedNewState = Tracking.validateState(newState);

    // Validate state transition using lifecycle manager
    const currentState = existingTracking.state || TrackingState.RUNNING;
    await this.lifecycleManager.transition(existingTracking, validatedNewState);

    // Update state in database
    await this.db.run(
      "UPDATE trackings SET state = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?",
      [validatedNewState, trackingId, userId]
    );

    // Retrieve updated tracking
    const tracking = await this.getById(trackingId, userId);
    if (!tracking) {
      console.error(
        `[${new Date().toISOString()}] TRACKING | Failed to retrieve updated tracking for ID: ${trackingId}`
      );
      throw new Error("Failed to retrieve updated tracking");
    }

    // Execute lifecycle hooks after state change with updated tracking
    await this.lifecycleManager.afterStateChange(
      tracking,
      currentState as TrackingState,
      validatedNewState
    );

    console.log(
      `[${new Date().toISOString()}] TRACKING | Tracking state updated successfully: ID ${trackingId} to state ${validatedNewState}`
    );

    return tracking;
  }

  /**
   * Delete a tracking by ID.
   * Also deletes all associated reminders to prevent orphaned data.
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

    // Verify tracking exists and belongs to user before deleting
    const existingTracking = await this.getById(trackingId, userId);
    if (!existingTracking) {
      console.warn(
        `[${new Date().toISOString()}] TRACKING | Delete failed: tracking not found for ID: ${trackingId} and userId: ${userId}`
      );
      throw new Error("Tracking not found");
    }

    // Explicitly delete all reminders associated with this tracking
    // This ensures data consistency even if foreign key constraints fail
    const reminderDeleteResult = await this.db.run(
      "DELETE FROM reminders WHERE tracking_id = ? AND user_id = ?",
      [trackingId, userId]
    );
    console.log(
      `[${new Date().toISOString()}] TRACKING | Deleted ${
        reminderDeleteResult.changes
      } reminder(s) for tracking ID: ${trackingId}`
    );

    // Delete the tracking
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
