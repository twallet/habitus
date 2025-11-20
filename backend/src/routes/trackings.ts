import { Router, Request, Response } from "express";
import { TrackingService } from "../services/trackingService.js";
import {
  authenticateToken,
  AuthRequest,
} from "../middleware/authMiddleware.js";

const router = Router();

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
    const trackings = await TrackingService.getTrackingsByUserId(userId);
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

      const tracking = await TrackingService.getTrackingById(
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
 * @body {string} type - The tracking type ("true_false" or "register")
 * @body {string} start_tracking_date - Optional start tracking date (ISO string, defaults to now)
 * @body {string} notes - Optional notes (rich text)
 * @returns {TrackingData} Created tracking data
 */
router.post("/", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { question, type, start_tracking_date, notes } = req.body;

    if (!question || !type) {
      return res.status(400).json({ error: "Question and type are required" });
    }

    const tracking = await TrackingService.createTracking(
      userId,
      question,
      type,
      start_tracking_date,
      notes
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
 * @body {string} type - Updated type (optional)
 * @body {string} start_tracking_date - Updated start tracking date (optional)
 * @body {string} notes - Updated notes (optional)
 * @returns {TrackingData} Updated tracking data
 */
router.put(
  "/:id",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const trackingId = parseInt(req.params.id, 10);
      const userId = req.userId!;
      const { question, type, start_tracking_date, notes } = req.body;

      if (isNaN(trackingId)) {
        return res.status(400).json({ error: "Invalid tracking ID" });
      }

      const tracking = await TrackingService.updateTracking(
        trackingId,
        userId,
        question,
        type,
        start_tracking_date,
        notes
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

      await TrackingService.deleteTracking(trackingId, userId);

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

export default router;
