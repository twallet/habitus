import { Router, Request, Response } from "express";
import { ServiceManager } from "../services/index.js";
import {
  authenticateToken,
  AuthRequest,
} from "../middleware/authMiddleware.js";

const router = Router();
// Lazy-load service to allow dependency injection in tests
const getReminderServiceInstance = () => ServiceManager.getReminderService();

/**
 * GET /api/reminders
 * Get all reminders for the authenticated user.
 * @route GET /api/reminders
 * @header {string} Authorization - Bearer token
 * @returns {ReminderData[]} Array of reminders
 */
router.get("/", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const reminders = await getReminderServiceInstance().getAllByUserId(userId);
    res.json(reminders);
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] REMINDER_ROUTE | Error fetching reminders:`,
      error
    );
    res.status(500).json({ error: "Error fetching reminders" });
  }
});

/**
 * GET /api/reminders/:id
 * Get a reminder by ID.
 * @route GET /api/reminders/:id
 * @header {string} Authorization - Bearer token
 * @param {number} id - The reminder ID
 * @returns {ReminderData} The reminder data
 */
router.get(
  "/:id",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const reminderId = parseInt(req.params.id, 10);
      const userId = req.userId!;

      if (isNaN(reminderId)) {
        return res.status(400).json({ error: "Invalid reminder ID" });
      }

      const reminder = await getReminderServiceInstance().getById(
        reminderId,
        userId
      );

      if (!reminder) {
        return res.status(404).json({ error: "Reminder not found" });
      }

      res.json(reminder);
    } catch (error) {
      console.error(
        `[${new Date().toISOString()}] REMINDER_ROUTE | Error fetching reminder:`,
        error
      );
      res.status(500).json({ error: "Error fetching reminder" });
    }
  }
);

/**
 * POST /api/reminders
 * Create a new reminder (for testing/manual creation).
 * @route POST /api/reminders
 * @header {string} Authorization - Bearer token
 * @body {number} tracking_id - The tracking ID
 * @body {string} scheduled_time - The scheduled time (ISO datetime string)
 * @returns {ReminderData} Created reminder data
 */
router.post("/", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { tracking_id, scheduled_time } = req.body;

    if (!tracking_id || !scheduled_time) {
      return res
        .status(400)
        .json({ error: "tracking_id and scheduled_time are required" });
    }

    const reminder = await getReminderServiceInstance().createReminder(
      tracking_id,
      userId,
      scheduled_time
    );

    res.status(201).json(reminder);
  } catch (error) {
    if (error instanceof TypeError) {
      return res.status(400).json({ error: error.message });
    }
    console.error(
      `[${new Date().toISOString()}] REMINDER_ROUTE | Error creating reminder:`,
      error
    );
    res.status(500).json({ error: "Error creating reminder" });
  }
});

/**
 * PUT /api/reminders/:id
 * Update a reminder.
 * @route PUT /api/reminders/:id
 * @header {string} Authorization - Bearer token
 * @param {number} id - The reminder ID
 * @body {string} notes - Updated notes (optional)
 * @body {string} status - Updated status (optional)
 * @body {string} scheduled_time - Updated scheduled time (optional)
 * @returns {ReminderData} Updated reminder data
 */
router.put(
  "/:id",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const reminderId = parseInt(req.params.id, 10);
      const userId = req.userId!;
      const { notes, status, scheduled_time } = req.body;

      if (isNaN(reminderId)) {
        return res.status(400).json({ error: "Invalid reminder ID" });
      }

      const updates: any = {};
      if (notes !== undefined) {
        updates.notes = notes;
      }
      if (status !== undefined) {
        updates.status = status;
      }
      if (scheduled_time !== undefined) {
        updates.scheduled_time = scheduled_time;
      }

      const reminder = await getReminderServiceInstance().updateReminder(
        reminderId,
        userId,
        updates
      );

      res.json(reminder);
    } catch (error) {
      if (error instanceof TypeError) {
        return res.status(400).json({ error: error.message });
      }
      if (error instanceof Error && error.message === "Reminder not found") {
        return res.status(404).json({ error: error.message });
      }
      console.error(
        `[${new Date().toISOString()}] REMINDER_ROUTE | Error updating reminder:`,
        error
      );
      res.status(500).json({ error: "Error updating reminder" });
    }
  }
);

/**
 * PATCH /api/reminders/:id/snooze
 * Snooze a reminder.
 * @route PATCH /api/reminders/:id/snooze
 * @header {string} Authorization - Bearer token
 * @param {number} id - The reminder ID
 * @body {number} minutes - Minutes to snooze
 * @returns {ReminderData} Updated reminder data
 */
router.patch(
  "/:id/snooze",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const reminderId = parseInt(req.params.id, 10);
      const userId = req.userId!;
      const { minutes } = req.body;

      if (isNaN(reminderId)) {
        return res.status(400).json({ error: "Invalid reminder ID" });
      }

      if (!minutes || typeof minutes !== "number" || minutes <= 0) {
        return res.status(400).json({ error: "Valid minutes is required" });
      }

      const reminder = await getReminderServiceInstance().snoozeReminder(
        reminderId,
        userId,
        minutes
      );

      res.json(reminder);
    } catch (error) {
      if (error instanceof TypeError) {
        return res.status(400).json({ error: error.message });
      }
      if (error instanceof Error && error.message === "Reminder not found") {
        return res.status(404).json({ error: error.message });
      }
      console.error(
        `[${new Date().toISOString()}] REMINDER_ROUTE | Error snoozing reminder:`,
        error
      );
      res.status(500).json({ error: "Error snoozing reminder" });
    }
  }
);

/**
 * PATCH /api/reminders/:id/complete
 * Complete a reminder.
 * @route PATCH /api/reminders/:id/complete
 * @header {string} Authorization - Bearer token
 * @param {number} id - The reminder ID
 * @returns {ReminderData} Updated reminder data
 */
router.patch(
  "/:id/complete",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const reminderId = parseInt(req.params.id, 10);
      const userId = req.userId!;

      if (isNaN(reminderId)) {
        return res.status(400).json({ error: "Invalid reminder ID" });
      }

      const reminder = await getReminderServiceInstance().completeReminder(
        reminderId,
        userId
      );

      res.json(reminder);
    } catch (error) {
      if (error instanceof TypeError) {
        return res.status(400).json({ error: error.message });
      }
      if (error instanceof Error && error.message === "Reminder not found") {
        return res.status(404).json({ error: error.message });
      }
      console.error(
        `[${new Date().toISOString()}] REMINDER_ROUTE | Error completing reminder:`,
        error
      );
      res.status(500).json({ error: "Error completing reminder" });
    }
  }
);

/**
 * PATCH /api/reminders/:id/dismiss
 * Dismiss a reminder.
 * @route PATCH /api/reminders/:id/dismiss
 * @header {string} Authorization - Bearer token
 * @param {number} id - The reminder ID
 * @returns {ReminderData} Updated reminder data
 */
router.patch(
  "/:id/dismiss",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const reminderId = parseInt(req.params.id, 10);
      const userId = req.userId!;

      if (isNaN(reminderId)) {
        return res.status(400).json({ error: "Invalid reminder ID" });
      }

      const reminder = await getReminderServiceInstance().dismissReminder(
        reminderId,
        userId
      );

      res.json(reminder);
    } catch (error) {
      if (error instanceof TypeError) {
        return res.status(400).json({ error: error.message });
      }
      if (error instanceof Error && error.message === "Reminder not found") {
        return res.status(404).json({ error: error.message });
      }
      console.error(
        `[${new Date().toISOString()}] REMINDER_ROUTE | Error dismissing reminder:`,
        error
      );
      res.status(500).json({ error: "Error dismissing reminder" });
    }
  }
);

/**
 * DELETE /api/reminders/:id
 * Delete a reminder (creates next one automatically).
 * @route DELETE /api/reminders/:id
 * @header {string} Authorization - Bearer token
 * @param {number} id - The reminder ID
 * @returns {Object} Success message
 */
router.delete(
  "/:id",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const reminderId = parseInt(req.params.id, 10);
      const userId = req.userId!;

      if (isNaN(reminderId)) {
        return res.status(400).json({ error: "Invalid reminder ID" });
      }

      await getReminderServiceInstance().deleteReminder(reminderId, userId);

      res.json({ message: "Reminder deleted successfully" });
    } catch (error) {
      if (error instanceof Error && error.message === "Reminder not found") {
        return res.status(404).json({ error: error.message });
      }
      console.error(
        `[${new Date().toISOString()}] REMINDER_ROUTE | Error deleting reminder:`,
        error
      );
      res.status(500).json({ error: "Error deleting reminder" });
    }
  }
);

/**
 * PATCH /api/reminders/:id/add-note
 * Add or update note for a reminder.
 * @route PATCH /api/reminders/:id/add-note
 * @header {string} Authorization - Bearer token
 * @param {number} id - The reminder ID
 * @body {string} notes - Notes to add
 * @returns {ReminderData} Updated reminder data
 */
router.patch(
  "/:id/add-note",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const reminderId = parseInt(req.params.id, 10);
      const userId = req.userId!;
      const { notes } = req.body;

      if (isNaN(reminderId)) {
        return res.status(400).json({ error: "Invalid reminder ID" });
      }

      if (!notes || typeof notes !== "string" || !notes.trim()) {
        return res.status(400).json({ error: "Valid notes is required" });
      }

      const reminder = await getReminderServiceInstance().addNote(
        reminderId,
        userId,
        notes.trim()
      );

      res.json(reminder);
    } catch (error) {
      if (error instanceof TypeError) {
        return res.status(400).json({ error: error.message });
      }
      if (error instanceof Error && error.message === "Reminder not found") {
        return res.status(404).json({ error: error.message });
      }
      console.error(
        `[${new Date().toISOString()}] REMINDER_ROUTE | Error adding note to reminder:`,
        error
      );
      res.status(500).json({ error: "Error adding note to reminder" });
    }
  }
);

export default router;
