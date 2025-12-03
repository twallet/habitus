import { vi, type Mock } from "vitest";
import request from "supertest";
import express from "express";
import sqlite3 from "sqlite3";
import { Database } from "../../db/database.js";
import { ReminderService } from "../../services/reminderService.js";
import { ReminderStatus } from "../../models/Reminder.js";
import { TrackingType } from "../../models/Tracking.js";
import * as authMiddlewareModule from "../../middleware/authMiddleware.js";
import * as servicesModule from "../../services/index.js";

// Mock authenticateToken before importing the router
vi.mock("../../middleware/authMiddleware.js", () => ({
  authenticateToken: vi.fn(),
  AuthRequest: {},
}));

// Mock services module before importing router
vi.mock("../../services/index.js", () => ({
  ServiceManager: {
    getReminderService: vi.fn(),
    getTrackingService: vi.fn(),
    getAuthService: vi.fn(),
    getUserService: vi.fn(),
    getEmailService: vi.fn(),
    getAiService: vi.fn(),
    initializeServices: vi.fn(),
  },
}));

// Import router after mocking
import remindersRouter from "../reminders.js";

/**
 * Create an in-memory database for testing.
 * @returns Promise resolving to Database instance
 */
async function createTestDatabase(): Promise<Database> {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(":memory:", (err) => {
      if (err) {
        reject(err);
        return;
      }

      db.run("PRAGMA foreign_keys = ON", (err) => {
        if (err) {
          reject(err);
          return;
        }

        db.run("PRAGMA journal_mode = WAL", (err) => {
          if (err) {
            reject(err);
            return;
          }

          db.exec(
            `
            CREATE TABLE IF NOT EXISTS users (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              name TEXT NOT NULL CHECK(length(name) <= 30),
              email TEXT NOT NULL UNIQUE,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS trackings (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id INTEGER NOT NULL,
              question TEXT NOT NULL CHECK(length(question) <= 100),
              type TEXT NOT NULL CHECK(type IN ('true_false', 'register')),
              notes TEXT,
              icon TEXT,
              days TEXT,
              state TEXT NOT NULL DEFAULT 'Running' CHECK(state IN ('Running', 'Paused', 'Archived', 'Deleted')),
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            CREATE TABLE IF NOT EXISTS reminders (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              tracking_id INTEGER NOT NULL,
              user_id INTEGER NOT NULL,
              scheduled_time DATETIME NOT NULL,
              answer TEXT,
              notes TEXT,
              status TEXT NOT NULL DEFAULT 'Pending' CHECK(status IN ('Pending', 'Answered', 'Snoozed')),
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (tracking_id) REFERENCES trackings(id) ON DELETE CASCADE,
              FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_reminders_user_id ON reminders(user_id);
            CREATE INDEX IF NOT EXISTS idx_reminders_tracking_id ON reminders(tracking_id);
            CREATE INDEX IF NOT EXISTS idx_reminders_scheduled_time ON reminders(scheduled_time);
            CREATE INDEX IF NOT EXISTS idx_reminders_status ON reminders(status);
          `,
            (err) => {
              if (err) {
                reject(err);
              } else {
                const database = new Database();
                (database as any).db = db;
                resolve(database);
              }
            }
          );
        });
      });
    });
  });
}

describe("Reminders Routes", () => {
  let app: express.Application;
  let testDb: Database;
  let reminderService: ReminderService;
  let testUserId: number;
  let testTrackingId: number;

  beforeEach(async () => {
    testDb = await createTestDatabase();
    reminderService = new ReminderService(testDb);

    const userResult = await testDb.run(
      "INSERT INTO users (name, email) VALUES (?, ?)",
      ["Test User", "test@example.com"]
    );
    testUserId = userResult.lastID;

    const trackingResult = await testDb.run(
      "INSERT INTO trackings (user_id, question, type) VALUES (?, ?, ?)",
      [testUserId, "Did I exercise?", TrackingType.TRUE_FALSE]
    );
    testTrackingId = trackingResult.lastID;

    vi.restoreAllMocks();

    vi.spyOn(authMiddlewareModule, "authenticateToken").mockImplementation(
      async (req: any, res: any, next: any) => {
        req.userId = testUserId;
        next();
      }
    );

    vi.spyOn(
      servicesModule.ServiceManager,
      "getReminderService"
    ).mockReturnValue(reminderService);

    app = express();
    app.use(express.json());
    app.use("/api/reminders", remindersRouter);
  });

  afterEach(async () => {
    await testDb.close();
  });

  describe("GET /api/reminders", () => {
    it("should get all reminders for authenticated user", async () => {
      const scheduledTime = new Date().toISOString();
      await reminderService.createReminder(
        testTrackingId,
        testUserId,
        scheduledTime
      );

      const response = await request(app).get("/api/reminders").expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBe(1);
      expect(response.body[0].tracking_id).toBe(testTrackingId);
    });
  });

  describe("GET /api/reminders/:id", () => {
    it("should get a reminder by ID", async () => {
      const scheduledTime = new Date().toISOString();
      const created = await reminderService.createReminder(
        testTrackingId,
        testUserId,
        scheduledTime
      );

      const response = await request(app)
        .get(`/api/reminders/${created.id}`)
        .expect(200);

      expect(response.body.id).toBe(created.id);
      expect(response.body.tracking_id).toBe(testTrackingId);
    });

    it("should return 404 if reminder not found", async () => {
      await request(app).get("/api/reminders/999").expect(404);
    });

    it("should return 400 for invalid reminder ID", async () => {
      await request(app).get("/api/reminders/invalid").expect(400);
    });
  });

  describe("POST /api/reminders", () => {
    it("should create a new reminder", async () => {
      const scheduledTime = new Date().toISOString();

      const response = await request(app)
        .post("/api/reminders")
        .send({
          tracking_id: testTrackingId,
          scheduled_time: scheduledTime,
        })
        .expect(201);

      expect(response.body.id).toBeGreaterThan(0);
      expect(response.body.tracking_id).toBe(testTrackingId);
      expect(response.body.scheduled_time).toBe(scheduledTime);
    });

    it("should return 400 if tracking_id is missing", async () => {
      await request(app)
        .post("/api/reminders")
        .send({
          scheduled_time: new Date().toISOString(),
        })
        .expect(400);
    });
  });

  describe("PUT /api/reminders/:id", () => {
    it("should update a reminder", async () => {
      const scheduledTime = new Date().toISOString();
      const created = await reminderService.createReminder(
        testTrackingId,
        testUserId,
        scheduledTime
      );

      const response = await request(app)
        .put(`/api/reminders/${created.id}`)
        .send({
          answer: "Yes",
          notes: "Some notes",
          status: ReminderStatus.ANSWERED,
        })
        .expect(200);

      expect(response.body.answer).toBe("Yes");
      expect(response.body.notes).toBe("Some notes");
      expect(response.body.status).toBe(ReminderStatus.ANSWERED);
    });

    it("should return 404 if reminder not found", async () => {
      await request(app)
        .put("/api/reminders/999")
        .send({
          answer: "Yes",
        })
        .expect(404);
    });
  });

  describe("PATCH /api/reminders/:id/snooze", () => {
    it("should snooze a reminder", async () => {
      const scheduledTime = new Date().toISOString();
      const created = await reminderService.createReminder(
        testTrackingId,
        testUserId,
        scheduledTime
      );

      const response = await request(app)
        .patch(`/api/reminders/${created.id}/snooze`)
        .send({
          minutes: 30,
        })
        .expect(200);

      expect(response.body.status).toBe(ReminderStatus.SNOOZED);
    });

    it("should return 400 for invalid minutes", async () => {
      const scheduledTime = new Date().toISOString();
      const created = await reminderService.createReminder(
        testTrackingId,
        testUserId,
        scheduledTime
      );

      await request(app)
        .patch(`/api/reminders/${created.id}/snooze`)
        .send({
          minutes: -1,
        })
        .expect(400);
    });
  });

  describe("DELETE /api/reminders/:id", () => {
    it("should delete a reminder", async () => {
      const scheduledTime = new Date().toISOString();
      const created = await reminderService.createReminder(
        testTrackingId,
        testUserId,
        scheduledTime
      );

      await request(app).delete(`/api/reminders/${created.id}`).expect(200);

      const reminder = await reminderService.getReminderById(
        created.id,
        testUserId
      );
      expect(reminder).toBeNull();
    });

    it("should return 404 if reminder not found", async () => {
      await request(app).delete("/api/reminders/999").expect(404);
    });
  });
});
