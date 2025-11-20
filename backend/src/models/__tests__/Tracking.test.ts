import { Tracking, TrackingType } from "../Tracking.js";

describe("Tracking Model", () => {
  describe("validateQuestion", () => {
    it("should accept valid questions", () => {
      expect(Tracking.validateQuestion("Did I drink water today?")).toBe(
        "Did I drink water today?"
      );
      expect(Tracking.validateQuestion("Did I exercise?")).toBe(
        "Did I exercise?"
      );
    });

    it("should trim whitespace", () => {
      expect(Tracking.validateQuestion("  Did I meditate?  ")).toBe(
        "Did I meditate?"
      );
    });

    it("should throw TypeError for empty question", () => {
      expect(() => Tracking.validateQuestion("")).toThrow(TypeError);
      expect(() => Tracking.validateQuestion("   ")).toThrow(TypeError);
    });

    it("should throw TypeError for non-string question", () => {
      expect(() => Tracking.validateQuestion(null as any)).toThrow(TypeError);
      expect(() => Tracking.validateQuestion(123 as any)).toThrow(TypeError);
      expect(() => Tracking.validateQuestion(undefined as any)).toThrow(
        TypeError
      );
    });

    it("should throw TypeError for question exceeding max length", () => {
      const longQuestion = "a".repeat(Tracking.MAX_QUESTION_LENGTH + 1);
      expect(() => Tracking.validateQuestion(longQuestion)).toThrow(TypeError);
    });

    it("should accept question with exactly MAX_QUESTION_LENGTH characters", () => {
      const maxLengthQuestion = "a".repeat(Tracking.MAX_QUESTION_LENGTH);
      expect(Tracking.validateQuestion(maxLengthQuestion)).toBe(
        maxLengthQuestion
      );
    });
  });

  describe("validateType", () => {
    it("should accept valid tracking types", () => {
      expect(Tracking.validateType("true_false")).toBe(TrackingType.TRUE_FALSE);
      expect(Tracking.validateType("register")).toBe(TrackingType.REGISTER);
    });

    it("should normalize type to lowercase", () => {
      expect(Tracking.validateType("TRUE_FALSE")).toBe(TrackingType.TRUE_FALSE);
      expect(Tracking.validateType("Register")).toBe(TrackingType.REGISTER);
    });

    it("should trim whitespace", () => {
      expect(Tracking.validateType("  true_false  ")).toBe(
        TrackingType.TRUE_FALSE
      );
      expect(Tracking.validateType("  register  ")).toBe(TrackingType.REGISTER);
    });

    it("should throw TypeError for invalid type", () => {
      expect(() => Tracking.validateType("invalid")).toThrow(TypeError);
      expect(() => Tracking.validateType("boolean")).toThrow(TypeError);
      expect(() => Tracking.validateType("")).toThrow(TypeError);
    });

    it("should throw TypeError for non-string type", () => {
      expect(() => Tracking.validateType(null as any)).toThrow(TypeError);
      expect(() => Tracking.validateType(123 as any)).toThrow(TypeError);
      expect(() => Tracking.validateType(undefined as any)).toThrow(TypeError);
    });
  });

  describe("validateNotes", () => {
    it("should accept valid notes", () => {
      expect(Tracking.validateNotes("Some notes")).toBe("Some notes");
      expect(Tracking.validateNotes("  Trimmed notes  ")).toBe("Trimmed notes");
    });

    it("should return undefined for empty/null/undefined notes", () => {
      expect(Tracking.validateNotes("")).toBeUndefined();
      expect(Tracking.validateNotes("   ")).toBeUndefined();
      expect(Tracking.validateNotes(null)).toBeUndefined();
      expect(Tracking.validateNotes(undefined)).toBeUndefined();
    });

    it("should throw TypeError for non-string notes", () => {
      expect(() => Tracking.validateNotes(123 as any)).toThrow(TypeError);
    });
  });

  describe("validateUserId", () => {
    it("should accept valid user IDs", () => {
      expect(Tracking.validateUserId(1)).toBe(1);
      expect(Tracking.validateUserId(100)).toBe(100);
    });

    it("should throw TypeError for invalid user ID format", () => {
      expect(() => Tracking.validateUserId(0)).toThrow(TypeError);
      expect(() => Tracking.validateUserId(-1)).toThrow(TypeError);
      expect(() => Tracking.validateUserId(1.5)).toThrow(TypeError);
    });

    it("should throw TypeError for non-number user ID", () => {
      expect(() => Tracking.validateUserId(null as any)).toThrow(TypeError);
      expect(() => Tracking.validateUserId("1" as any)).toThrow(TypeError);
      expect(() => Tracking.validateUserId(undefined as any)).toThrow(
        TypeError
      );
    });

    it("should throw TypeError for NaN", () => {
      expect(() => Tracking.validateUserId(NaN)).toThrow(TypeError);
    });
  });
});
