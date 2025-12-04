import { Database } from "../db/database.js";
import {
  Tracking,
  TrackingData,
  TrackingState,
  DaysPattern,
} from "../models/Tracking.js";
import { TrackingSchedule } from "../models/TrackingSchedule.js";
import { ReminderService } from "./reminderService.js";

/**
 * Service for tracking-related database operations.
 * @public
 */
export class TrackingService {
  private db: Database;
  private reminderService: ReminderService;

  /**
   * Create a new TrackingService instance.
   * @param db - Database instance
   * @public
   */
  constructor(db: Database) {
    this.db = db;
    this.reminderService = new ReminderService(db);
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

    // Create initial reminder for the tracking
    try {
      await this.reminderService.createNextReminderForTracking(
        tracking.id,
        validatedUserId
      );
    } catch (error) {
      // Log error but don't fail tracking creation if reminder creation fails
      console.error(
        `[${new Date().toISOString()}] TRACKING | Failed to create reminder for tracking ${
          tracking.id
        }:`,
        error
      );
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
    const existingTracking = await this.getTrackingById(trackingId, userId);
    if (!existingTracking) {
      console.warn(
        `[${new Date().toISOString()}] TRACKING | Update state failed: tracking not found for ID: ${trackingId} and userId: ${userId}`
      );
      throw new Error("Tracking not found");
    }

    // Validate new state
    const validatedNewState = Tracking.validateState(newState);

    // Validate state transition
    const currentState = existingTracking.state || TrackingState.RUNNING;
    Tracking.validateStateTransition(
      currentState as TrackingState,
      validatedNewState
    );

    // Update state in database
    await this.db.run(
      "UPDATE trackings SET state = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?",
      [validatedNewState, trackingId, userId]
    );

    // Handle reminder cleanup and creation based on state transition
    const { Reminder } = await import("../models/Reminder.js");
    if (validatedNewState === TrackingState.PAUSED) {
      // When pausing: Delete Upcoming reminders (keep Pending and Answered)
      const deletedCount = await Reminder.deleteUpcomingByTrackingId(
        trackingId,
        userId,
        this.db
      );

      if (deletedCount > 0) {
        console.log(
          `[${new Date().toISOString()}] TRACKING | Deleted ${deletedCount} Upcoming reminder(s) for paused tracking ${trackingId}`
        );
      }
    } else if (validatedNewState === TrackingState.ARCHIVED) {
      // When archiving: Delete Upcoming and Pending reminders (keep Answered)
      const { ReminderStatus } = await import("../models/Reminder.js");
      const now = new Date().toISOString();

      // Delete all Upcoming reminders
      const deletedUpcoming = await Reminder.deleteUpcomingByTrackingId(
        trackingId,
        userId,
        this.db
      );

      // Delete all Pending reminders
      const result = await this.db.run(
        `DELETE FROM reminders 
         WHERE tracking_id = ? 
         AND user_id = ? 
         AND status = ?`,
        [trackingId, userId, ReminderStatus.PENDING]
      );

      const totalDeleted = deletedUpcoming + result.changes;
      if (totalDeleted > 0) {
        console.log(
          `[${new Date().toISOString()}] TRACKING | Deleted ${totalDeleted} Upcoming/Pending reminder(s) for archived tracking ${trackingId}`
        );
      }
    } else if (
      validatedNewState === TrackingState.RUNNING &&
      (currentState === TrackingState.PAUSED ||
        currentState === TrackingState.ARCHIVED)
    ) {
      // When resuming (Paused → Running) or unarchiving (Archived → Running):
      // Create next reminder (only if time is in future, handled by createNextReminderForTracking)
      try {
        await this.reminderService.createNextReminderForTracking(
          trackingId,
          userId
        );
        console.log(
          `[${new Date().toISOString()}] TRACKING | Created next reminder for resumed/unarchived tracking ${trackingId}`
        );
      } catch (error) {
        // Log error but don't fail state update if reminder creation fails
        console.error(
          `[${new Date().toISOString()}] TRACKING | Failed to create reminder for tracking ${trackingId} after state transition:`,
          error
        );
      }
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
    const existingTracking = await this.getTrackingById(trackingId, userId);
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
