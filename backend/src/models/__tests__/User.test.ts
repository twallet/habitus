import { User } from "../User.js";

describe("User Model", () => {
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

  describe("validatePassword", () => {
    it("should accept valid robust password", () => {
      expect(() => User.validatePassword("Password123!")).not.toThrow();
      expect(() => User.validatePassword("MyStr0ng@Pass")).not.toThrow();
      expect(() => User.validatePassword("Test#1234")).not.toThrow();
    });

    it("should throw TypeError for password shorter than 8 characters", () => {
      expect(() => User.validatePassword("Pass1!")).toThrow(TypeError);
      expect(() => User.validatePassword("P@ss1")).toThrow(TypeError);
    });

    it("should throw TypeError for password without uppercase letter", () => {
      expect(() => User.validatePassword("password123!")).toThrow(TypeError);
    });

    it("should throw TypeError for password without lowercase letter", () => {
      expect(() => User.validatePassword("PASSWORD123!")).toThrow(TypeError);
    });

    it("should throw TypeError for password without number", () => {
      expect(() => User.validatePassword("Password!")).toThrow(TypeError);
    });

    it("should throw TypeError for password without special character", () => {
      expect(() => User.validatePassword("Password123")).toThrow(TypeError);
    });

    it("should throw TypeError for password exceeding max length", () => {
      const longPassword = "A".repeat(129) + "1!";
      expect(() => User.validatePassword(longPassword)).toThrow(TypeError);
    });

    it("should throw TypeError for non-string password", () => {
      expect(() => User.validatePassword(null as any)).toThrow(TypeError);
      expect(() => User.validatePassword(123 as any)).toThrow(TypeError);
      expect(() => User.validatePassword(undefined as any)).toThrow(TypeError);
    });

    it("should accept password with exactly 8 characters", () => {
      expect(() => User.validatePassword("Pass1!@#")).not.toThrow();
    });

    it("should accept password with exactly 128 characters", () => {
      const password = "A".repeat(123) + "a1!@#";
      expect(() => User.validatePassword(password)).not.toThrow();
      expect(password.length).toBe(128);
    });
  });
});
