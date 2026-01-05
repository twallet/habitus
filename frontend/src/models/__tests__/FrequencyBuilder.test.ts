import { describe, it, expect, beforeEach } from "vitest";
import { FrequencyBuilder } from "../FrequencyBuilder";
import { Frequency } from "../Tracking";

describe("FrequencyBuilder", () => {
  let builder: FrequencyBuilder;

  beforeEach(() => {
    builder = new FrequencyBuilder();
  });

  describe("constructor", () => {
    it("should initialize with default values when no frequency provided", () => {
      const newBuilder = new FrequencyBuilder();
      expect(newBuilder.getPreset()).toBe("daily");
      expect(newBuilder.getSelectedDays()).toEqual([1]); // Default to Monday for weekly
    });

    it("should initialize from existing daily frequency", () => {
      const frequency: Frequency = {
        type: "daily",
      };
      const newBuilder = new FrequencyBuilder(frequency);
      expect(newBuilder.getPreset()).toBe("daily");
    });

    it("should detect weekly preset from weekly frequency", () => {
      const frequency: Frequency = {
        type: "weekly",
        days: [1, 2, 3, 4, 5], // Monday to Friday
      };
      const newBuilder = new FrequencyBuilder(frequency);
      expect(newBuilder.getPreset()).toBe("weekly");
    });

    it("should detect weekly preset from weekly frequency pattern", () => {
      const frequency: Frequency = {
        type: "weekly",
        days: [1, 3, 5], // Monday, Wednesday, Friday
      };
      const newBuilder = new FrequencyBuilder(frequency);
      expect(newBuilder.getPreset()).toBe("weekly");
    });

    it("should detect monthly preset from monthly frequency", () => {
      const frequency: Frequency = {
        type: "monthly",
        kind: "day_number",
        day_numbers: [15],
      };
      const newBuilder = new FrequencyBuilder(frequency);
      expect(newBuilder.getPreset()).toBe("monthly");
    });

    it("should detect yearly preset from yearly frequency", () => {
      const frequency: Frequency = {
        type: "yearly",
        kind: "date",
        month: 3,
        day: 15,
      };
      const newBuilder = new FrequencyBuilder(frequency);
      expect(newBuilder.getPreset()).toBe("yearly");
    });
  });

  describe("preset management", () => {
    it("should get and set preset", () => {
      builder.setPreset("weekly");
      expect(builder.getPreset()).toBe("weekly");
    });
  });

  describe("weekly pattern", () => {
    it("should get and set selected days", () => {
      builder.setSelectedDays([1, 3, 5]);
      expect(builder.getSelectedDays()).toEqual([1, 3, 5]);
    });

    it("should toggle day", () => {
      builder.setSelectedDays([1, 3]);
      builder.toggleDay(5);
      expect(builder.getSelectedDays()).toEqual([1, 3, 5]);
      builder.toggleDay(1);
      expect(builder.getSelectedDays()).toEqual([3, 5]);
    });

    it("should build weekly frequency", () => {
      builder.setPreset("weekly");
      builder.setSelectedDays([1, 3, 5]);
      const frequency = builder.buildFrequency();
      expect(frequency).toEqual({
        type: "weekly",
        days: [1, 3, 5],
      });
    });

    it("should throw error when no days selected", () => {
      builder.setPreset("weekly");
      builder.setSelectedDays([]);
      expect(() => builder.buildFrequency()).toThrow(
        "Please select at least one day of the week"
      );
    });
  });

  describe("monthly pattern", () => {
    it("should get and set monthly day", () => {
      builder.setMonthlyDay(15);
      expect(builder.getMonthlyDay()).toBe(15);
    });

    it("should get and set monthly type", () => {
      builder.setMonthlyType("last");
      expect(builder.getMonthlyType()).toBe("last");
    });

    it("should build monthly frequency with day number", () => {
      builder.setPreset("monthly");
      builder.setMonthlyType("day");
      builder.setMonthlyDay(15);
      const frequency = builder.buildFrequency();
      expect(frequency).toEqual({
        type: "monthly",
        kind: "day_number",
        day_numbers: [15],
      });
    });

    it("should build monthly frequency with last day", () => {
      builder.setPreset("monthly");
      builder.setMonthlyType("last");
      const frequency = builder.buildFrequency();
      expect(frequency).toEqual({
        type: "monthly",
        kind: "last_day",
      });
    });

    it("should build monthly frequency with weekday ordinal", () => {
      builder.setPreset("monthly");
      builder.setMonthlyType("weekday");
      builder.setWeekday(1); // Monday
      builder.setOrdinal(1); // First
      const frequency = builder.buildFrequency();
      expect(frequency).toEqual({
        type: "monthly",
        kind: "weekday_ordinal",
        weekday: 1,
        ordinal: 1,
      });
    });
  });

  describe("yearly pattern", () => {
    it("should get and set yearly month", () => {
      builder.setYearlyMonth(3);
      expect(builder.getYearlyMonth()).toBe(3);
    });

    it("should get and set yearly day", () => {
      builder.setYearlyDay(15);
      expect(builder.getYearlyDay()).toBe(15);
    });

    it("should build yearly frequency", () => {
      builder.setPreset("yearly");
      builder.setYearlyMonth(3);
      builder.setYearlyDay(15);
      const frequency = builder.buildFrequency();
      expect(frequency).toEqual({
        type: "yearly",
        kind: "date",
        month: 3,
        day: 15,
      });
    });
  });

  describe("daily frequency", () => {
    it("should return daily frequency for daily preset", () => {
      builder.setPreset("daily");
      const frequency = builder.buildFrequency();
      expect(frequency).toEqual({
        type: "daily",
      });
    });
  });

  describe("validation", () => {
    it("should return null for valid frequency", () => {
      builder.setPreset("daily");
      expect(builder.validate()).toBeNull();
    });

    it("should return error message for invalid frequency", () => {
      builder.setPreset("weekly");
      builder.setSelectedDays([]);
      expect(builder.validate()).toBe(
        "Please select at least one day of the week"
      );
    });

    it("should return error message for weekly frequency without days", () => {
      builder.setPreset("weekly");
      builder.setSelectedDays([]);
      expect(builder.validate()).toBe(
        "Please select at least one day of the week"
      );
    });
  });

  describe("detectPresetFromFrequency (via constructor)", () => {
    it("should detect daily from daily frequency", () => {
      const frequency: Frequency = {
        type: "daily",
      };
      const newBuilder = new FrequencyBuilder(frequency);
      expect(newBuilder.getPreset()).toBe("daily");
    });

    it("should detect weekly from weekly frequency", () => {
      const frequency: Frequency = {
        type: "weekly",
        days: [1, 2, 3, 4, 5],
      };
      const newBuilder = new FrequencyBuilder(frequency);
      expect(newBuilder.getPreset()).toBe("weekly");
    });

    it("should detect weekly from other weekly frequencies", () => {
      const frequency: Frequency = {
        type: "weekly",
        days: [0, 6], // Sunday and Saturday
      };
      const newBuilder = new FrequencyBuilder(frequency);
      expect(newBuilder.getPreset()).toBe("weekly");
    });

    it("should detect monthly from monthly frequency", () => {
      const frequency: Frequency = {
        type: "monthly",
        kind: "day_number",
        day_numbers: [1, 15, 30], // Multiple days
      };
      const newBuilder = new FrequencyBuilder(frequency);
      expect(newBuilder.getPreset()).toBe("monthly");
    });
  });

  describe("setPreset with weekly", () => {
    it("should default to Monday when switching to weekly with empty days", () => {
      builder.setSelectedDays([]);
      builder.setPreset("weekly");
      expect(builder.getSelectedDays()).toEqual([1]);
    });

    it("should not change selectedDays when switching to weekly with existing days", () => {
      builder.setSelectedDays([2, 3]); // Tuesday, Wednesday
      builder.setPreset("weekly");
      expect(builder.getSelectedDays()).toEqual([2, 3]);
    });
  });

  describe("toggleDay", () => {
    it("should add day when not in selection", () => {
      builder.setSelectedDays([1, 2]);
      builder.toggleDay(3);
      expect(builder.getSelectedDays()).toEqual([1, 2, 3]);
    });

    it("should remove day when already in selection", () => {
      builder.setSelectedDays([1, 2, 3]);
      builder.toggleDay(2);
      expect(builder.getSelectedDays()).toEqual([1, 3]);
    });
  });

  describe("validate error handling", () => {
    it("should return error message for weekly frequency without days", () => {
      builder.setPreset("weekly");
      builder.setSelectedDays([]);
      const error = builder.validate();
      expect(error).toBe("Please select at least one day of the week");
    });

    it("should return null for valid daily frequency", () => {
      builder.setPreset("daily");
      expect(builder.validate()).toBeNull();
    });

    it("should return null for valid weekly frequency", () => {
      builder.setPreset("weekly");
      builder.setSelectedDays([1, 3, 5]);
      expect(builder.validate()).toBeNull();
    });

    it("should return null for valid monthly frequency", () => {
      builder.setPreset("monthly");
      builder.setMonthlyType("day");
      builder.setMonthlyDay(15);
      expect(builder.validate()).toBeNull();
    });

    it("should return null for valid yearly frequency", () => {
      builder.setPreset("yearly");
      builder.setYearlyMonth(3);
      builder.setYearlyDay(15);
      expect(builder.validate()).toBeNull();
    });
  });

  describe("validateScheduledTime", () => {
    it("should return error when one-time scheduled time is in the past", () => {
      // Get today's date
      const today = new Date();
      const dateStr = `${today.getFullYear()}-${String(
        today.getMonth() + 1
      ).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

      builder.setPreset("one-time");
      builder.setOneTimeDate(dateStr);

      // Schedule for an hour ago
      const pastHour = today.getHours() - 1;
      const schedules = [{ hour: pastHour < 0 ? 23 : pastHour, minutes: 0 }];

      const error = builder.validateScheduledTime(schedules);
      expect(error).toBe("At least one scheduled time must be in the future");
    });

    it("should return null when one-time scheduled time is in the future", () => {
      // Get tomorrow's date
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = `${tomorrow.getFullYear()}-${String(
        tomorrow.getMonth() + 1
      ).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;

      builder.setPreset("one-time");
      builder.setOneTimeDate(dateStr);

      const schedules = [{ hour: 14, minutes: 0 }];

      const error = builder.validateScheduledTime(schedules);
      expect(error).toBeNull();
    });

    it("should return null when at least one scheduled time is in the future", () => {
      // Use tomorrow to avoid timezone/hour wrapping issues
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = `${tomorrow.getFullYear()}-${String(
        tomorrow.getMonth() + 1
      ).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;

      builder.setPreset("one-time");
      builder.setOneTimeDate(dateStr);

      // Mix of early and later times (all will be in the future since it's tomorrow)
      const schedules = [
        { hour: 0, minutes: 0 }, // Midnight tomorrow
        { hour: 14, minutes: 0 }, // 2 PM tomorrow
      ];

      const error = builder.validateScheduledTime(schedules);
      expect(error).toBeNull();
    });

    it("should return null for non-one-time frequencies", () => {
      builder.setPreset("daily");

      const schedules = [{ hour: 0, minutes: 0 }];

      const error = builder.validateScheduledTime(schedules);
      expect(error).toBeNull();
    });
  });
});
