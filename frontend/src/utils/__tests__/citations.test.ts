import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getDailyCitation, citations } from "../citations";

describe("citations", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should return a default message when no citations are provided", () => {
    // Mock empty citations array
    const originalCitations = [...citations];
    citations.length = 0;

    const result = getDailyCitation();
    expect(result).toBe("Welcome to Habitus - Your daily habit tracker");

    // Restore citations
    citations.length = originalCitations.length;
    citations.push(...originalCitations);
  });

  it("should return the first citation on January 1st", () => {
    if (citations.length === 0) {
      // Skip test if no citations provided
      return;
    }

    // Set date to January 1st, 2024
    vi.setSystemTime(new Date("2024-01-01T12:00:00Z"));

    const result = getDailyCitation();
    expect(result).toBe(citations[0]);
  });

  it("should cycle through citations using modulo", () => {
    if (citations.length === 0) {
      // Skip test if no citations provided
      return;
    }

    // Set date to day 100
    const startOfYear = new Date("2024-01-01T00:00:00Z");
    const day100 = new Date(startOfYear);
    day100.setDate(day100.getDate() + 99); // Day 100 (0-indexed)
    vi.setSystemTime(day100);

    const result = getDailyCitation();
    const expectedIndex = 99 % citations.length;
    expect(result).toBe(citations[expectedIndex]);
  });

  it("should return different citations for different days", () => {
    if (citations.length < 2) {
      // Skip test if not enough citations
      return;
    }

    // Test day 1
    vi.setSystemTime(new Date("2024-01-01T12:00:00Z"));
    const citation1 = getDailyCitation();

    // Test day 2
    vi.setSystemTime(new Date("2024-01-02T12:00:00Z"));
    const citation2 = getDailyCitation();

    expect(citation1).not.toBe(citation2);
  });

  it("should handle leap years correctly", () => {
    if (citations.length === 0) {
      return;
    }

    // Test February 29th in a leap year
    vi.setSystemTime(new Date("2024-02-29T12:00:00Z"));
    const result = getDailyCitation();
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });
});
