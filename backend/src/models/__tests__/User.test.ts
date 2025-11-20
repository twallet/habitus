import { User } from "../User.js";

describe("User Model", () => {
  describe("validateName", () => {
    it("should accept valid names", () => {
      expect(User.validateName("John Doe")).toBe("John Doe");
      expect(User.validateName("Alice")).toBe("Alice");
    });

    it("should trim whitespace", () => {
      expect(User.validateName("  Jane Smith  ")).toBe("Jane Smith");
    });

    it("should throw TypeError for invalid name format", () => {
      expect(() => User.validateName("")).toThrow(TypeError);
      expect(() => User.validateName("   ")).toThrow(TypeError);
    });

    it("should throw TypeError for non-string name", () => {
      expect(() => User.validateName(null as any)).toThrow(TypeError);
      expect(() => User.validateName(123 as any)).toThrow(TypeError);
      expect(() => User.validateName(undefined as any)).toThrow(TypeError);
    });

    it("should throw TypeError for name exceeding max length", () => {
      const longName = "a".repeat(User.MAX_NAME_LENGTH + 1);
      expect(() => User.validateName(longName)).toThrow(TypeError);
    });

    it("should accept name with exactly MAX_NAME_LENGTH characters", () => {
      const maxLengthName = "a".repeat(User.MAX_NAME_LENGTH);
      expect(User.validateName(maxLengthName)).toBe(maxLengthName);
    });
  });

  describe("validateNickname", () => {
    it("should accept valid nicknames", () => {
      expect(User.validateNickname("CoolNick")).toBe("CoolNick");
      expect(User.validateNickname("  Trimmed  ")).toBe("Trimmed");
    });

    it("should return undefined for empty/null/undefined nickname", () => {
      expect(User.validateNickname("")).toBeUndefined();
      expect(User.validateNickname("   ")).toBeUndefined();
      expect(User.validateNickname(null)).toBeUndefined();
      expect(User.validateNickname(undefined)).toBeUndefined();
    });

    it("should throw TypeError for non-string nickname", () => {
      expect(() => User.validateNickname(123 as any)).toThrow(TypeError);
    });

    it("should throw TypeError for nickname exceeding max length", () => {
      const longNickname = "a".repeat(User.MAX_NICKNAME_LENGTH + 1);
      expect(() => User.validateNickname(longNickname)).toThrow(TypeError);
    });

    it("should accept nickname with exactly MAX_NICKNAME_LENGTH characters", () => {
      const maxLengthNickname = "a".repeat(User.MAX_NICKNAME_LENGTH);
      expect(User.validateNickname(maxLengthNickname)).toBe(maxLengthNickname);
    });
  });

  describe("validateEmail", () => {
    it("should accept valid email addresses", () => {
      expect(User.validateEmail("test@example.com")).toBe("test@example.com");
      expect(User.validateEmail("user.name@example.co.uk")).toBe(
        "user.name@example.co.uk"
      );
      expect(User.validateEmail("test+tag@example.com")).toBe(
        "test+tag@example.com"
      );
    });

    it("should normalize email to lowercase", () => {
      expect(User.validateEmail("TEST@EXAMPLE.COM")).toBe("test@example.com");
      expect(User.validateEmail("Test@Example.Com")).toBe("test@example.com");
    });

    it("should trim whitespace", () => {
      expect(User.validateEmail("  test@example.com  ")).toBe(
        "test@example.com"
      );
    });

    it("should throw TypeError for invalid email format", () => {
      expect(() => User.validateEmail("invalid-email")).toThrow(TypeError);
      expect(() => User.validateEmail("@example.com")).toThrow(TypeError);
      expect(() => User.validateEmail("test@")).toThrow(TypeError);
      expect(() => User.validateEmail("test@example")).toThrow(TypeError);
    });

    it("should throw TypeError for empty email", () => {
      expect(() => User.validateEmail("")).toThrow(TypeError);
      expect(() => User.validateEmail("   ")).toThrow(TypeError);
    });

    it("should throw TypeError for non-string email", () => {
      expect(() => User.validateEmail(null as any)).toThrow(TypeError);
      expect(() => User.validateEmail(123 as any)).toThrow(TypeError);
      expect(() => User.validateEmail(undefined as any)).toThrow(TypeError);
    });

    it("should throw TypeError for email exceeding max length", () => {
      const longEmail = "a".repeat(250) + "@example.com";
      expect(() => User.validateEmail(longEmail)).toThrow(TypeError);
    });
  });
});
