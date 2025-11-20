import { User } from "../User";

describe("User", () => {
  describe("validateName", () => {
    it("should trim whitespace from name during validation", () => {
      const trimmedName = User.validateName("  Jane Smith  ");
      expect(trimmedName).toBe("Jane Smith");
    });
    it("should throw TypeError if name is not a string", () => {
      expect(() => {
        // @ts-expect-error Testing invalid input
        User.validateName(123);
      }).toThrow(TypeError);
      expect(() => {
        // @ts-expect-error Testing invalid input
        User.validateName(null);
      }).toThrow(TypeError);
      expect(() => {
        // @ts-expect-error Testing invalid input
        User.validateName(undefined);
      }).toThrow(TypeError);
    });

    it("should throw TypeError if name is empty after trim", () => {
      expect(() => User.validateName("")).toThrow(TypeError);
      expect(() => User.validateName("   ")).toThrow(TypeError);
      expect(() => User.validateName("\t\n")).toThrow(TypeError);
    });

    it("should throw TypeError if name exceeds MAX_NAME_LENGTH", () => {
      const longName = "a".repeat(User.MAX_NAME_LENGTH + 1);
      expect(() => User.validateName(longName)).toThrow(TypeError);
      expect(() => User.validateName(longName)).toThrow(
        `Name must be smaller than ${User.MAX_NAME_LENGTH} characters`
      );
    });

    it("should accept name with exactly MAX_NAME_LENGTH characters", () => {
      const maxLengthName = "a".repeat(User.MAX_NAME_LENGTH);
      const validatedName = User.validateName(maxLengthName);
      expect(validatedName).toBe(maxLengthName);
    });
  });

  describe("validateNickname", () => {
    it("should accept valid nickname", () => {
      expect(User.validateNickname("CoolNick")).toBe("CoolNick");
      expect(User.validateNickname("  Trimmed  ")).toBe("Trimmed");
    });

    it("should return undefined for empty/null/undefined nickname", () => {
      expect(User.validateNickname("")).toBeUndefined();
      expect(User.validateNickname("   ")).toBeUndefined();
      expect(User.validateNickname(null)).toBeUndefined();
      expect(User.validateNickname(undefined)).toBeUndefined();
    });

    it("should throw TypeError if nickname exceeds MAX_NICKNAME_LENGTH", () => {
      const longNickname = "a".repeat(User.MAX_NICKNAME_LENGTH + 1);
      expect(() => User.validateNickname(longNickname)).toThrow(TypeError);
    });

    it("should accept nickname with exactly MAX_NICKNAME_LENGTH characters", () => {
      const maxLengthNickname = "a".repeat(User.MAX_NICKNAME_LENGTH);
      expect(User.validateNickname(maxLengthNickname)).toBe(maxLengthNickname);
    });
  });

  describe("MAX_NAME_LENGTH", () => {
    it("should be 30", () => {
      expect(User.MAX_NAME_LENGTH).toBe(30);
    });
  });

  describe("MAX_NICKNAME_LENGTH", () => {
    it("should be 30", () => {
      expect(User.MAX_NICKNAME_LENGTH).toBe(30);
    });
  });
});
