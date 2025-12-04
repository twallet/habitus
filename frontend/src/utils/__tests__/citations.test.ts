import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getDailyCitation, citations } from "../citations";

/**
 * Test suite for citations utility module.
 * Tests the daily citation functionality including date-based selection,
 * modulo cycling, and edge cases like empty arrays and leap years.
 */
describe("citations", () => {
  /**
   * Store original citations array once at the start of the test suite.
   * This ensures we always restore to the original state, even if tests mutate the array.
   */
  const originalCitations = [...citations];

  /**
   * Setup fake timers before each test.
   * This allows us to control the system time for testing date-based functionality.
   */
  beforeEach(() => {
    vi.useFakeTimers();
  });

  /**
   * Restore real timers and citations array after each test.
   * Ensures tests don't interfere with each other or the test runner.
   */
  afterEach(() => {
    vi.useRealTimers();
    // Restore citations array to original state from the start of the suite
    citations.length = 0;
    citations.push(...originalCitations);
  });

  /**
   * Test that getDailyCitation returns a default message when citations array is empty.
   * This test temporarily clears the citations array to verify the fallback behavior.
   * Restoration is handled automatically in afterEach hook.
   */
  it("should return a default message when no citations are provided", () => {
    // Clear citations array to test empty state
    citations.length = 0;

    const result = getDailyCitation();
    expect(result).toBe("Welcome to Habitus - Your daily habit tracker");
  });

  /**
   * Test that getDailyCitation returns the first citation on January 1st.
   * Assumes citations array is not empty (returns early if empty to avoid failures).
   */
  it("should return the first citation on January 1st", () => {
    // Early return if no citations available (graceful skip)
    if (citations.length === 0) {
      return;
    }

    // Set date to January 1st, 2024 (local timezone, matching getDailyCitation implementation)
    vi.setSystemTime(new Date(2024, 0, 1, 12, 0, 0));

    const result = getDailyCitation();
    expect(result).toBe(citations[0]);
  });

  /**
   * Test that citations cycle correctly using modulo operation.
   * Verifies that day 100 returns the expected citation based on modulo calculation.
   */
  it("should cycle through citations using modulo", () => {
    // Early return if no citations available (graceful skip)
    if (citations.length === 0) {
      return;
    }

    // Set date to day 100 of the year using local timezone (matching getDailyCitation implementation)
    // January 1st is day 1, so day 100 is January 1st + 99 days
    const startOfYear = new Date(2024, 0, 1); // Local timezone, month 0 = January
    const day100 = new Date(startOfYear);
    day100.setDate(day100.getDate() + 99); // This makes it day 100 (1-indexed)

    vi.setSystemTime(day100);

    const result = getDailyCitation();
    // Calculate expected index: dayOfYear is 100, so index = (100 - 1) % citations.length
    const dayOfYear = 100;
    const expectedIndex = (dayOfYear - 1) % citations.length;
    expect(result).toBe(citations[expectedIndex]);
  });

  /**
   * Test that different days return different citations.
   * Verifies that the date-based selection works correctly for consecutive days.
   */
  it("should return different citations for different days", () => {
    // Early return if not enough citations available (graceful skip)
    if (citations.length < 2) {
      return;
    }

    // Test day 1 (local timezone, matching getDailyCitation implementation)
    vi.setSystemTime(new Date(2024, 0, 1, 12, 0, 0));
    const citation1 = getDailyCitation();

    // Test day 2 (local timezone, matching getDailyCitation implementation)
    vi.setSystemTime(new Date(2024, 0, 2, 12, 0, 0));
    const citation2 = getDailyCitation();

    expect(citation1).not.toBe(citation2);
  });

  /**
   * Test that leap year dates are handled correctly.
   * Verifies that February 29th in a leap year returns a valid citation.
   */
  it("should handle leap years correctly", () => {
    // Early return if no citations available (graceful skip)
    if (citations.length === 0) {
      return;
    }

    // Test February 29th in a leap year (2024 is a leap year, local timezone)
    vi.setSystemTime(new Date(2024, 1, 29, 12, 0, 0)); // Month 1 = February
    const result = getDailyCitation();

    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });
});
