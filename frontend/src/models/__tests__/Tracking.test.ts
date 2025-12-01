import { Tracking, TrackingType, TrackingData } from "../Tracking";

describe("Tracking", () => {
  describe("constructor", () => {
    it("should create a Tracking instance with all properties", () => {
      const data: TrackingData = {
        id: 1,
        user_id: 10,
        question: "Did you exercise today?",
        type: TrackingType.TRUE_FALSE,
        notes: "Some notes",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-02T00:00:00Z",
      };

      const tracking = new Tracking(data);

      expect(tracking.id).toBe(1);
      expect(tracking.user_id).toBe(10);
      expect(tracking.question).toBe("Did you exercise today?");
      expect(tracking.type).toBe(TrackingType.TRUE_FALSE);
      expect(tracking.notes).toBe("Some notes");
      expect(tracking.created_at).toBe("2024-01-01T00:00:00Z");
      expect(tracking.updated_at).toBe("2024-01-02T00:00:00Z");
    });

    it("should create a Tracking instance with optional properties undefined", () => {
      const data: TrackingData = {
        id: 1,
        user_id: 10,
        question: "Did you exercise today?",
        type: TrackingType.REGISTER,
      };

      const tracking = new Tracking(data);

      expect(tracking.id).toBe(1);
      expect(tracking.user_id).toBe(10);
      expect(tracking.question).toBe("Did you exercise today?");
      expect(tracking.type).toBe(TrackingType.REGISTER);
      expect(tracking.notes).toBeUndefined();
      expect(tracking.created_at).toBeUndefined();
      expect(tracking.updated_at).toBeUndefined();
    });
  });

  describe("validate", () => {
    it("should validate and trim question", () => {
      const tracking = new Tracking({
        id: 1,
        user_id: 10,
        question: "  Did you exercise?  ",
        type: TrackingType.TRUE_FALSE,
      });

      const validated = tracking.validate();

      expect(validated.question).toBe("Did you exercise?");
      expect(validated).toBe(tracking);
    });

    it("should validate and normalize type", () => {
      const tracking = new Tracking({
        id: 1,
        user_id: 10,
        question: "Did you exercise?",
        type: "TRUE_FALSE" as TrackingType,
      });

      const validated = tracking.validate();

      expect(validated.type).toBe(TrackingType.TRUE_FALSE);
    });

    it("should validate and trim notes when provided", () => {
      const tracking = new Tracking({
        id: 1,
        user_id: 10,
        question: "Did you exercise?",
        type: TrackingType.TRUE_FALSE,
        notes: "  Some notes  ",
      });

      const validated = tracking.validate();

      expect(validated.notes).toBe("Some notes");
    });

    it("should handle undefined notes", () => {
      const tracking = new Tracking({
        id: 1,
        user_id: 10,
        question: "Did you exercise?",
        type: TrackingType.TRUE_FALSE,
      });

      const validated = tracking.validate();

      expect(validated.notes).toBeUndefined();
    });
  });

  describe("toJSON", () => {
    it("should convert Tracking instance to TrackingData", () => {
      const tracking = new Tracking({
        id: 1,
        user_id: 10,
        question: "Did you exercise?",
        type: TrackingType.TRUE_FALSE,
        notes: "Some notes",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-02T00:00:00Z",
      });

      const json = tracking.toJSON();

      expect(json).toEqual({
        id: 1,
        user_id: 10,
        question: "Did you exercise?",
        type: TrackingType.TRUE_FALSE,
        notes: "Some notes",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-02T00:00:00Z",
      });
    });

    it("should convert Tracking instance with optional properties", () => {
      const tracking = new Tracking({
        id: 1,
        user_id: 10,
        question: "Did you exercise?",
        type: TrackingType.REGISTER,
      });

      const json = tracking.toJSON();

      expect(json).toEqual({
        id: 1,
        user_id: 10,
        question: "Did you exercise?",
        type: TrackingType.REGISTER,
        notes: undefined,
        created_at: undefined,
        updated_at: undefined,
      });
    });
  });

  describe("validateQuestion", () => {
    it("should trim and return valid question", () => {
      const question = Tracking.validateQuestion("  Did you exercise?  ");
      expect(question).toBe("Did you exercise?");
    });

    it("should throw TypeError if question is not a string", () => {
      expect(() => {
        // @ts-expect-error Testing invalid input
        Tracking.validateQuestion(123);
      }).toThrow(TypeError);
      expect(() => {
        // @ts-expect-error Testing invalid input
        Tracking.validateQuestion(null);
      }).toThrow(TypeError);
      expect(() => {
        // @ts-expect-error Testing invalid input
        Tracking.validateQuestion(undefined);
      }).toThrow(TypeError);
    });

    it("should throw TypeError if question is empty after trim", () => {
      expect(() => Tracking.validateQuestion("")).toThrow(TypeError);
      expect(() => Tracking.validateQuestion("   ")).toThrow(TypeError);
      expect(() => Tracking.validateQuestion("\t\n")).toThrow(TypeError);
    });

    it("should throw TypeError if question exceeds MAX_QUESTION_LENGTH", () => {
      const longQuestion = "a".repeat(Tracking.MAX_QUESTION_LENGTH + 1);
      expect(() => Tracking.validateQuestion(longQuestion)).toThrow(TypeError);
      expect(() => Tracking.validateQuestion(longQuestion)).toThrow(
        `Question must not exceed ${Tracking.MAX_QUESTION_LENGTH} characters`
      );
    });

    it("should accept question with exactly MAX_QUESTION_LENGTH characters", () => {
      const maxLengthQuestion = "a".repeat(Tracking.MAX_QUESTION_LENGTH);
      const validated = Tracking.validateQuestion(maxLengthQuestion);
      expect(validated).toBe(maxLengthQuestion);
    });
  });

  describe("validateType", () => {
    it("should return TRUE_FALSE for valid true_false type", () => {
      const type = Tracking.validateType("true_false");
      expect(type).toBe(TrackingType.TRUE_FALSE);
    });

    it("should return REGISTER for valid register type", () => {
      const type = Tracking.validateType("register");
      expect(type).toBe(TrackingType.REGISTER);
    });

    it("should normalize case and trim whitespace", () => {
      expect(Tracking.validateType("  TRUE_FALSE  ")).toBe(
        TrackingType.TRUE_FALSE
      );
      expect(Tracking.validateType("  REGISTER  ")).toBe(TrackingType.REGISTER);
      expect(Tracking.validateType("True_False")).toBe(TrackingType.TRUE_FALSE);
      expect(Tracking.validateType("Register")).toBe(TrackingType.REGISTER);
    });

    it("should throw TypeError if type is not a string", () => {
      expect(() => {
        // @ts-expect-error Testing invalid input
        Tracking.validateType(123);
      }).toThrow(TypeError);
      expect(() => {
        // @ts-expect-error Testing invalid input
        Tracking.validateType(null);
      }).toThrow(TypeError);
      expect(() => {
        // @ts-expect-error Testing invalid input
        Tracking.validateType(undefined);
      }).toThrow(TypeError);
    });

    it("should throw TypeError for invalid type", () => {
      expect(() => Tracking.validateType("invalid")).toThrow(TypeError);
      expect(() => Tracking.validateType("invalid")).toThrow(
        `Type must be either "${TrackingType.TRUE_FALSE}" or "${TrackingType.REGISTER}"`
      );
    });
  });

  describe("validateNotes", () => {
    it("should return undefined for null or undefined", () => {
      expect(Tracking.validateNotes(null)).toBeUndefined();
      expect(Tracking.validateNotes(undefined)).toBeUndefined();
    });

    it("should trim and return valid notes", () => {
      const notes = Tracking.validateNotes("  Some notes  ");
      expect(notes).toBe("Some notes");
    });

    it("should return undefined for empty string after trim", () => {
      expect(Tracking.validateNotes("")).toBeUndefined();
      expect(Tracking.validateNotes("   ")).toBeUndefined();
      expect(Tracking.validateNotes("\t\n")).toBeUndefined();
    });

    it("should throw TypeError if notes is not a string", () => {
      expect(() => {
        // @ts-expect-error Testing invalid input
        Tracking.validateNotes(123);
      }).toThrow(TypeError);
      expect(() => {
        // @ts-expect-error Testing invalid input
        Tracking.validateNotes({});
      }).toThrow(TypeError);
    });

    it("should return trimmed notes for valid string", () => {
      const notes = Tracking.validateNotes("  Valid notes  ");
      expect(notes).toBe("Valid notes");
    });
  });

  describe("MAX_QUESTION_LENGTH", () => {
    it("should be 100", () => {
      expect(Tracking.MAX_QUESTION_LENGTH).toBe(100);
    });
  });
});
