import { Router, Request, Response } from "express";
import { ServiceManager } from "../services/index.js";
import {
  authenticateToken,
  AuthRequest,
} from "../middleware/authMiddleware.js";

const router = Router();
// Lazy-load service to allow dependency injection in tests
const getTrackingServiceInstance = () => ServiceManager.getTrackingService();

/**
 * GET /api/trackings
 * Get all trackings for the authenticated user.
 * @route GET /api/trackings
 * @header {string} Authorization - Bearer token
 * @returns {TrackingData[]} Array of trackings
 */
router.get("/", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const trackings = await getTrackingServiceInstance().getAllByUserId(userId);
    res.json(trackings);
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] TRACKING_ROUTE | Error fetching trackings:`,
      error
    );
    res.status(500).json({ error: "Error fetching trackings" });
  }
});

/**
 * GET /api/trackings/:id
 * Get a tracking by ID.
 * @route GET /api/trackings/:id
 * @header {string} Authorization - Bearer token
 * @param {number} id - The tracking ID
 * @returns {TrackingData} The tracking data
 */
router.get(
  "/:id",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const trackingId = parseInt(req.params.id, 10);
      const userId = req.userId!;

      if (isNaN(trackingId)) {
        return res.status(400).json({ error: "Invalid tracking ID" });
      }

      const tracking = await getTrackingServiceInstance().getById(
        trackingId,
        userId
      );

      if (!tracking) {
        return res.status(404).json({ error: "Tracking not found" });
      }

      res.json(tracking);
    } catch (error) {
      console.error(
        `[${new Date().toISOString()}] TRACKING_ROUTE | Error fetching tracking:`,
        error
      );
      res.status(500).json({ error: "Error fetching tracking" });
    }
  }
);

/**
 * POST /api/trackings
 * Create a new tracking.
 * @route POST /api/trackings
 * @header {string} Authorization - Bearer token
 * @body {string} question - The tracking question
 * @body {string} notes - Optional notes (rich text)
 * @body {string} icon - Optional icon (emoji)
 * @body {Array<{hour: number, minutes: number}>} schedules - Required schedules array (1-5 schedules)
 * @body {DaysPattern} days - Optional days pattern for reminder frequency (required for recurring trackings)
 * @body {string} oneTimeDate - Optional date for one-time tracking (ISO date string YYYY-MM-DD)
 * @returns {TrackingData} Created tracking data
 */
router.post("/", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { question, notes, icon, schedules, days, oneTimeDate } = req.body;

    if (!question) {
      return res.status(400).json({ error: "Question is required" });
    }

    if (!schedules || !Array.isArray(schedules) || schedules.length === 0) {
      return res
        .status(400)
        .json({ error: "At least one schedule is required" });
    }

    // Validate that either days or oneTimeDate is provided, but not both
    if (!days && !oneTimeDate) {
      return res
        .status(400)
        .json({ error: "Either days pattern or oneTimeDate must be provided" });
    }

    if (days && oneTimeDate) {
      return res
        .status(400)
        .json({ error: "Cannot provide both days pattern and oneTimeDate" });
    }

    // Validate oneTimeDate if provided
    if (oneTimeDate) {
      // Validate date format (YYYY-MM-DD)
      const datePattern = /^\d{4}-\d{2}-\d{2}$/;
      if (!datePattern.test(oneTimeDate)) {
        return res
          .status(400)
          .json({ error: "Invalid oneTimeDate format. Expected YYYY-MM-DD" });
      }

      const oneTimeDateObj = new Date(oneTimeDate + "T00:00:00");
      if (isNaN(oneTimeDateObj.getTime())) {
        return res.status(400).json({ error: "Invalid oneTimeDate format" });
      }

      // Validate that the date is today or in the future
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const selectedDateOnly = new Date(
        oneTimeDateObj.getFullYear(),
        oneTimeDateObj.getMonth(),
        oneTimeDateObj.getDate()
      );

      if (selectedDateOnly < today) {
        return res
          .status(400)
          .json({ error: "oneTimeDate must be today or in the future" });
      }

      // If it's today, validate that all schedules are in the future
      if (selectedDateOnly.getTime() === today.getTime()) {
        const currentHour = now.getHours();
        const currentMinutes = now.getMinutes();

        for (const schedule of schedules) {
          if (
            schedule.hour < currentHour ||
            (schedule.hour === currentHour &&
              schedule.minutes <= currentMinutes)
          ) {
            return res.status(400).json({
              error:
                "If the date is today, all times must be after the current time",
            });
          }
        }
      }
    }

    const tracking = await getTrackingServiceInstance().createTracking(
      userId,
      question,
      notes,
      icon,
      schedules,
      days,
      oneTimeDate
    );

    res.status(201).json(tracking);
  } catch (error) {
    if (error instanceof TypeError) {
      return res.status(400).json({ error: error.message });
    }
    console.error(
      `[${new Date().toISOString()}] TRACKING_ROUTE | Error creating tracking:`,
      error
    );
    res.status(500).json({ error: "Error creating tracking" });
  }
});

/**
 * PUT /api/trackings/:id
 * Update a tracking.
 * @route PUT /api/trackings/:id
 * @header {string} Authorization - Bearer token
 * @param {number} id - The tracking ID
 * @body {string} question - Updated question (optional)
 * @body {string} notes - Updated notes (optional)
 * @body {string} icon - Updated icon (optional)
 * @body {Array<{hour: number, minutes: number}>} schedules - Updated schedules array (optional, 1-5 schedules if provided)
 * @body {DaysPattern} days - Updated days pattern (optional)
 * @returns {TrackingData} Updated tracking data
 */
router.put(
  "/:id",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const trackingId = parseInt(req.params.id, 10);
      const userId = req.userId!;
      const { question, notes, icon, schedules, days } = req.body;

      if (isNaN(trackingId)) {
        return res.status(400).json({ error: "Invalid tracking ID" });
      }

      if (
        schedules !== undefined &&
        (!Array.isArray(schedules) || schedules.length === 0)
      ) {
        return res
          .status(400)
          .json({ error: "If provided, schedules must be a non-empty array" });
      }

      const tracking = await getTrackingServiceInstance().updateTracking(
        trackingId,
        userId,
        question,
        notes,
        icon,
        schedules,
        days
      );

      res.json(tracking);
    } catch (error) {
      if (error instanceof TypeError) {
        return res.status(400).json({ error: error.message });
      }
      if (error instanceof Error && error.message === "Tracking not found") {
        return res.status(404).json({ error: error.message });
      }
      if (error instanceof Error && error.message === "No fields to update") {
        return res.status(400).json({ error: error.message });
      }
      console.error(
        `[${new Date().toISOString()}] TRACKING_ROUTE | Error updating tracking:`,
        error
      );
      res.status(500).json({ error: "Error updating tracking" });
    }
  }
);

/**
 * PATCH /api/trackings/:id/state
 * Update tracking state.
 * @route PATCH /api/trackings/:id/state
 * @header {string} Authorization - Bearer token
 * @param {number} id - The tracking ID
 * @body {string} state - The new state (Running, Paused, Archived, Deleted)
 * @returns {TrackingData} Updated tracking data
 */
router.patch(
  "/:id/state",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const trackingId = parseInt(req.params.id, 10);
      const userId = req.userId!;
      const { state } = req.body;

      if (isNaN(trackingId)) {
        return res.status(400).json({ error: "Invalid tracking ID" });
      }

      if (!state || typeof state !== "string") {
        return res.status(400).json({ error: "State is required" });
      }

      const tracking = await getTrackingServiceInstance().updateTrackingState(
        trackingId,
        userId,
        state
      );

      res.json(tracking);
    } catch (error) {
      if (error instanceof TypeError) {
        return res.status(400).json({ error: error.message });
      }
      if (error instanceof Error && error.message === "Tracking not found") {
        return res.status(404).json({ error: error.message });
      }
      console.error(
        `[${new Date().toISOString()}] TRACKING_ROUTE | Error updating tracking state:`,
        error
      );
      res.status(500).json({ error: "Error updating tracking state" });
    }
  }
);

/**
 * DELETE /api/trackings/:id
 * Delete a tracking.
 * @route DELETE /api/trackings/:id
 * @header {string} Authorization - Bearer token
 * @param {number} id - The tracking ID
 * @returns {Object} Success message
 */
router.delete(
  "/:id",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const trackingId = parseInt(req.params.id, 10);
      const userId = req.userId!;

      if (isNaN(trackingId)) {
        return res.status(400).json({ error: "Invalid tracking ID" });
      }

      await getTrackingServiceInstance().deleteTracking(trackingId, userId);

      res.json({ message: "Tracking deleted successfully" });
    } catch (error) {
      if (error instanceof Error && error.message === "Tracking not found") {
        return res.status(404).json({ error: error.message });
      }
      console.error(
        `[${new Date().toISOString()}] TRACKING_ROUTE | Error deleting tracking:`,
        error
      );
      res.status(500).json({ error: "Error deleting tracking" });
    }
  }
);

/**
 * POST /api/trackings/suggest-emoji
 * Suggest an emoji based on a tracking question.
 * @route POST /api/trackings/suggest-emoji
 * @header {string} Authorization - Bearer token
 * @body {string} question - The tracking question
 * @returns {Object} Object with suggested emoji
 */
router.post(
  "/suggest-emoji",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const { question } = req.body;

      if (!question || typeof question !== "string" || !question.trim()) {
        return res.status(400).json({ error: "Question is required" });
      }

      const aiService = ServiceManager.getAiService();
      const emoji = await aiService.suggestEmoji(question.trim());

      res.json({ emoji });
    } catch (error) {
      console.error(
        `[${new Date().toISOString()}] TRACKING_ROUTE | Error suggesting emoji:`,
        error
      );
      if (error instanceof Error) {
        if (
          error.message.includes("API key") ||
          error.message.includes("not configured")
        ) {
          return res.status(503).json({
            error:
              "AI emoji suggestion is not available. Please configure PERPLEXITY_API_KEY in your environment variables.",
          });
        }
        return res.status(500).json({ error: error.message });
      }
      res.status(500).json({ error: "Error suggesting emoji" });
    }
  }
);

export default router;
