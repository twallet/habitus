import { describe, it, expect } from "vitest";
import { DateUtils } from "@habitus/shared/utils";

describe("DateUtils.createDateTimeInTimezone", () => {
  describe("without timezone (UTC)", () => {
    it("should create a date in UTC when no timezone is provided", () => {
      const result = DateUtils.createDateTimeInTimezone(
        "2024-01-15",
        14,
        30,
        undefined
      );

      const expected = new Date(Date.UTC(2024, 0, 15, 14, 30, 0));
      expect(result).toBe(expected.toISOString());
    });

    it("should create a date in UTC at midnight when no timezone is provided", () => {
      const result = DateUtils.createDateTimeInTimezone(
        "2024-12-25",
        0,
        0,
        undefined
      );

      const expected = new Date(Date.UTC(2024, 11, 25, 0, 0, 0));
      expect(result).toBe(expected.toISOString());
    });
  });

  describe("with timezone - America/Buenos_Aires (UTC-3)", () => {
    const timezone = "America/Buenos_Aires";

    it("should convert local time to UTC correctly - afternoon time", () => {
      // Test: 14:00 in America/Buenos_Aires (UTC-3) should be 17:00 UTC
      const result = DateUtils.createDateTimeInTimezone(
        "2024-01-15",
        14,
        0,
        timezone
      );

      const resultDate = new Date(result);

      // Verify it's in UTC by checking what time it represents in the target timezone
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });

      const parts = formatter.formatToParts(resultDate);
      const resultHour = parseInt(parts.find((p) => p.type === "hour")!.value);
      const resultMinute = parseInt(
        parts.find((p) => p.type === "minute")!.value
      );
      const resultDay = parseInt(parts.find((p) => p.type === "day")!.value);

      // Should be 14:00 on the same day in the target timezone
      expect(resultHour).toBe(14);
      expect(resultMinute).toBe(0);
      expect(resultDay).toBe(15);
    });

    it("should convert local time to UTC correctly - morning time", () => {
      // Test: 9:00 in America/Buenos_Aires (UTC-3) should be 12:00 UTC
      const result = DateUtils.createDateTimeInTimezone(
        "2024-06-20",
        9,
        0,
        timezone
      );

      const resultDate = new Date(result);
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });

      const parts = formatter.formatToParts(resultDate);
      const resultHour = parseInt(parts.find((p) => p.type === "hour")!.value);
      const resultMinute = parseInt(
        parts.find((p) => p.type === "minute")!.value
      );

      expect(resultHour).toBe(9);
      expect(resultMinute).toBe(0);
    });

    it("should create a future UTC time when creating a future local time", () => {
      // This is the key test that exposes the bug:
      // If we create a reminder for tomorrow at 14:00 in the user's timezone,
      // the resulting UTC time should be in the future (UPCOMING status),
      // not in the past (PENDING status)

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().split("T")[0]; // YYYY-MM-DD

      const result = DateUtils.createDateTimeInTimezone(
        dateStr,
        14,
        0,
        timezone
      );

      const resultDate = new Date(result);
      const now = new Date();

      // The result should be in the future
      expect(resultDate.getTime()).toBeGreaterThan(now.getTime());

      // Verify it represents the correct local time
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });

      const parts = formatter.formatToParts(resultDate);
      const resultHour = parseInt(parts.find((p) => p.type === "hour")!.value);
      const resultMinute = parseInt(
        parts.find((p) => p.type === "minute")!.value
      );
      const resultYear = parseInt(parts.find((p) => p.type === "year")!.value);
      const resultMonth = parseInt(
        parts.find((p) => p.type === "month")!.value
      );
      const resultDay = parseInt(parts.find((p) => p.type === "day")!.value);

      const expectedParts = dateStr.split("-").map(Number);

      expect(resultHour).toBe(14);
      expect(resultMinute).toBe(0);
      expect(resultYear).toBe(expectedParts[0]);
      expect(resultMonth).toBe(expectedParts[1]);
      expect(resultDay).toBe(expectedParts[2]);
    });

    it("should handle minutes correctly", () => {
      const result = DateUtils.createDateTimeInTimezone(
        "2024-03-10",
        9,
        30,
        timezone
      );

      const resultDate = new Date(result);
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });

      const parts = formatter.formatToParts(resultDate);
      const resultHour = parseInt(parts.find((p) => p.type === "hour")!.value);
      const resultMinute = parseInt(
        parts.find((p) => p.type === "minute")!.value
      );

      expect(resultHour).toBe(9);
      expect(resultMinute).toBe(30);
    });
  });

  describe("with timezone - America/New_York (UTC-5 or UTC-4 with DST)", () => {
    const timezone = "America/New_York";

    it("should convert local time to UTC correctly", () => {
      const result = DateUtils.createDateTimeInTimezone(
        "2024-07-15",
        10,
        0,
        timezone
      );

      const resultDate = new Date(result);
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });

      const parts = formatter.formatToParts(resultDate);
      const resultHour = parseInt(parts.find((p) => p.type === "hour")!.value);
      const resultMinute = parseInt(
        parts.find((p) => p.type === "minute")!.value
      );
      const resultDay = parseInt(parts.find((p) => p.type === "day")!.value);

      expect(resultHour).toBe(10);
      expect(resultMinute).toBe(0);
      expect(resultDay).toBe(15);
    });

    it("should create a future UTC time when creating a future local time", () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().split("T")[0];

      const result = DateUtils.createDateTimeInTimezone(
        dateStr,
        18,
        0,
        timezone
      );

      const resultDate = new Date(result);
      const now = new Date();

      // The result should be in the future
      expect(resultDate.getTime()).toBeGreaterThan(now.getTime());
    });
  });

  describe("edge cases", () => {
    it("should handle midnight (00:00) correctly", () => {
      const result = DateUtils.createDateTimeInTimezone(
        "2024-05-20",
        0,
        0,
        "America/Buenos_Aires"
      );

      const resultDate = new Date(result);
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Buenos_Aires",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });

      const parts = formatter.formatToParts(resultDate);
      const resultHour = parseInt(parts.find((p) => p.type === "hour")!.value);
      const resultMinute = parseInt(
        parts.find((p) => p.type === "minute")!.value
      );

      expect(resultHour).toBe(0);
      expect(resultMinute).toBe(0);
    });

    it("should handle end of day (23:59) correctly", () => {
      const result = DateUtils.createDateTimeInTimezone(
        "2024-08-15",
        23,
        59,
        "America/Buenos_Aires"
      );

      const resultDate = new Date(result);
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Buenos_Aires",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });

      const parts = formatter.formatToParts(resultDate);
      const resultHour = parseInt(parts.find((p) => p.type === "hour")!.value);
      const resultMinute = parseInt(
        parts.find((p) => p.type === "minute")!.value
      );

      expect(resultHour).toBe(23);
      expect(resultMinute).toBe(59);
    });

    it("should handle date boundaries correctly (crossing UTC date)", () => {
      // When creating 23:00 in UTC-3, it becomes 02:00 UTC the next day
      const result = DateUtils.createDateTimeInTimezone(
        "2024-03-15",
        23,
        0,
        "America/Buenos_Aires"
      );

      const resultDate = new Date(result);

      // Verify the local time is correct
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Buenos_Aires",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });

      const parts = formatter.formatToParts(resultDate);
      const resultHour = parseInt(parts.find((p) => p.type === "hour")!.value);
      const resultMinute = parseInt(
        parts.find((p) => p.type === "minute")!.value
      );
      const resultDay = parseInt(parts.find((p) => p.type === "day")!.value);

      expect(resultHour).toBe(23);
      expect(resultMinute).toBe(0);
      expect(resultDay).toBe(15);
    });
  });

  describe("integration test - simulates one-time tracking creation", () => {
    it("should create a reminder that will be UPCOMING, not PENDING, for a future date", () => {
      // Simulate creating a one-time tracking reminder:
      // - User is in America/Buenos_Aires (UTC-3)
      // - Date is tomorrow
      // - Time is 14:00 local time
      // - Expected: reminder should be UPCOMING (scheduled_time > now)

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().split("T")[0];

      const scheduledTime = DateUtils.createDateTimeInTimezone(
        dateStr,
        14,
        0,
        "America/Buenos_Aires"
      );

      const scheduledDate = new Date(scheduledTime);
      const now = new Date();

      // This is the critical assertion: the scheduled time must be in the future
      // If this fails, it means the reminder would be created as PENDING instead of UPCOMING
      expect(scheduledDate.getTime()).toBeGreaterThan(now.getTime());

      // Verify it's approximately correct (should be around 17 hours from now
      // if created at 14:00 local time which is 17:00 UTC, and we're testing
      // around the same time)
      const hoursDifference =
        (scheduledDate.getTime() - now.getTime()) / (1000 * 60 * 60);

      // Should be between 17 and 41 hours (accounting for when the test runs)
      // If the date is tomorrow and time is 14:00 local (17:00 UTC),
      // and it's currently between 00:00 and 23:59 today,
      // the difference should be roughly 17-41 hours
      expect(hoursDifference).toBeGreaterThan(16);
      expect(hoursDifference).toBeLessThan(48);
    });
  });
});


