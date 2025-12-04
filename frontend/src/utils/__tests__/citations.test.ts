import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  CitationManager,
  citationManager,
  getDailyCitation,
  citations,
} from "../citations";

/**
 * Test suite for CitationManager class.
 * Tests the daily citation functionality including date-based selection,
 * sequential usage by day number, and edge cases like empty arrays and leap years.
 */
describe("CitationManager", () => {
  /**
   * Setup fake timers before each test.
   * This allows us to control the system time for testing date-based functionality.
   */
  beforeEach(() => {
    vi.useFakeTimers();
  });

  /**
   * Restore real timers after each test.
   * Ensures tests don't interfere with each other or the test runner.
   */
  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * Test that we have exactly 366 citations for a full year (including leap years).
   */
  it("should have exactly 366 citations", () => {
    expect(citations.length).toBe(366);
    expect(citationManager.getCitationCount()).toBe(366);
  });

  /**
   * Test that CitationManager can be instantiated with default citations.
   */
  it("should create an instance with default citations", () => {
    const manager = new CitationManager();
    expect(manager.getCitationCount()).toBe(366);
  });

  /**
   * Test that CitationManager can be instantiated with custom citations.
   */
  it("should create an instance with custom citations", () => {
    const customCitations = ["Citation 1", "Citation 2", "Citation 3"];
    const manager = new CitationManager(customCitations);
    expect(manager.getCitationCount()).toBe(3);
    expect(manager.getCitations()).toEqual(customCitations);
  });

  /**
   * Test that getDailyCitation returns a default message when citations array is empty.
   */
  it("should return a default message when no citations are provided", () => {
    const manager = new CitationManager([]);
    const result = manager.getDailyCitation();
    expect(result).toBe("Welcome to Habitus - Your daily habit tracker");
  });

  /**
   * Test that getDailyCitation returns the first citation on January 1st.
   */
  it("should return the first citation on January 1st", () => {
    const manager = new CitationManager(["First citation", "Second citation"]);
    vi.setSystemTime(new Date(2024, 0, 1, 12, 0, 0));
    const result = manager.getDailyCitation();
    expect(result).toBe("First citation");
  });

  /**
   * Test that citations are used sequentially by day number.
   */
  it("should use citations sequentially by day number", () => {
    const manager = new CitationManager([
      "Citation 0",
      "Citation 1",
      "Citation 2",
      "Citation 99",
    ]);
    const startOfYear = new Date(2024, 0, 1);
    const day100 = new Date(startOfYear);
    day100.setDate(day100.getDate() + 99);
    vi.setSystemTime(day100);
    const result = manager.getDailyCitation();
    const dayOfYear = 100;
    const expectedIndex = Math.min(
      dayOfYear - 1,
      manager.getCitationCount() - 1
    );
    expect(result).toBe(manager.getCitations()[expectedIndex]);
  });

  /**
   * Test that different days return different citations.
   */
  it("should return different citations for different days", () => {
    const manager = new CitationManager(["Citation 1", "Citation 2"]);
    vi.setSystemTime(new Date(2024, 0, 1, 12, 0, 0));
    const citation1 = manager.getDailyCitation();
    vi.setSystemTime(new Date(2024, 0, 2, 12, 0, 0));
    const citation2 = manager.getDailyCitation();
    expect(citation1).not.toBe(citation2);
  });

  /**
   * Test that leap year dates are handled correctly.
   */
  it("should handle leap years correctly", () => {
    const manager = new CitationManager(["Test citation"]);
    vi.setSystemTime(new Date(2024, 1, 29, 12, 0, 0));
    const result = manager.getDailyCitation();
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  /**
   * Test that day 365 (last day of non-leap year) uses the correct citation.
   */
  it("should return citation[364] for day 365 in a non-leap year", () => {
    const citations365 = Array.from({ length: 365 }, (_, i) => `Citation ${i}`);
    const manager = new CitationManager(citations365);
    vi.setSystemTime(new Date(2023, 11, 31, 12, 0, 0));
    const result = manager.getDailyCitation();
    expect(result).toBe(citations365[364]);
  });

  /**
   * Test that day 366 (last day of leap year) uses the correct citation.
   */
  it("should return citation[365] for day 366 in a leap year", () => {
    const citations366 = Array.from({ length: 366 }, (_, i) => `Citation ${i}`);
    const manager = new CitationManager(citations366);
    vi.setSystemTime(new Date(2024, 11, 31, 12, 0, 0));
    const result = manager.getDailyCitation();
    expect(result).toBe(citations366[365]);
  });

  /**
   * Test that all citations are valid strings.
   */
  it("should have all citations as valid non-empty strings", () => {
    const manager = new CitationManager();
    manager.getCitations().forEach((citation) => {
      expect(typeof citation).toBe("string");
      expect(citation.length).toBeGreaterThan(0);
      expect(citation.trim().length).toBeGreaterThan(0);
    });
  });

  /**
   * Test that getCitations returns a copy, not a reference.
   */
  it("should return a copy of citations array, not a reference", () => {
    const manager = new CitationManager(["Citation 1", "Citation 2"]);
    const citations1 = manager.getCitations();
    const citations2 = manager.getCitations();
    expect(citations1).not.toBe(citations2);
    expect(citations1).toEqual(citations2);
  });
});

/**
 * Test suite for backward compatibility functions.
 * Tests the convenience functions that use the default citation manager instance.
 */
describe("Backward compatibility functions", () => {
  /**
   * Setup fake timers before each test.
   */
  beforeEach(() => {
    vi.useFakeTimers();
  });

  /**
   * Restore real timers after each test.
   */
  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * Test that getDailyCitation function works with default manager.
   */
  it("should work with default citation manager", () => {
    vi.setSystemTime(new Date(2024, 0, 1, 12, 0, 0));
    const result = getDailyCitation();
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  /**
   * Test that citations export works correctly.
   */
  it("should export citations array correctly", () => {
    expect(Array.isArray(citations)).toBe(true);
    expect(citations.length).toBe(366);
  });
});
