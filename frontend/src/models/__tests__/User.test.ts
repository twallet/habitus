import { User, UserData } from "../User";

describe("User", () => {
  describe("constructor", () => {
    it("should create a User instance with all properties", () => {
      const data: UserData = {
        id: 1,
        name: "John Doe",
        email: "john@example.com",
        profile_picture_url: "https://example.com/pic.jpg",
        last_access: "2024-01-01T00:00:00Z",
        created_at: "2024-01-01T00:00:00Z",
      };

      const user = new User(data);

      expect(user.id).toBe(1);
      expect(user.name).toBe("John Doe");
      expect(user.email).toBe("john@example.com");
      expect(user.profile_picture_url).toBe("https://example.com/pic.jpg");
      expect(user.last_access).toBe("2024-01-01T00:00:00Z");
      expect(user.created_at).toBe("2024-01-01T00:00:00Z");
    });

    it("should create a User instance with optional properties undefined", () => {
      const data: UserData = {
        id: 1,
        name: "John Doe",
        email: "john@example.com",
      };

      const user = new User(data);

      expect(user.id).toBe(1);
      expect(user.name).toBe("John Doe");
      expect(user.email).toBe("john@example.com");
      expect(user.profile_picture_url).toBeUndefined();
      expect(user.last_access).toBeUndefined();
      expect(user.created_at).toBeUndefined();
    });
  });

  describe("validate", () => {
    it("should validate and trim name", () => {
      const user = new User({
        id: 1,
        name: "  John Doe  ",
        email: "john@example.com",
      });

      const validated = user.validate();

      expect(validated.name).toBe("John Doe");
      expect(validated).toBe(user);
    });

    it("should throw TypeError if name is invalid", () => {
      const user = new User({
        id: 1,
        name: "",
        email: "john@example.com",
      });

      expect(() => user.validate()).toThrow(TypeError);
    });
  });

  describe("toJSON", () => {
    it("should convert User instance to UserData", () => {
      const user = new User({
        id: 1,
        name: "John Doe",
        email: "john@example.com",
        profile_picture_url: "https://example.com/pic.jpg",
        last_access: "2024-01-01T00:00:00Z",
        created_at: "2024-01-01T00:00:00Z",
      });

      const json = user.toJSON();

      expect(json).toEqual({
        id: 1,
        name: "John Doe",
        email: "john@example.com",
        profile_picture_url: "https://example.com/pic.jpg",
        last_access: "2024-01-01T00:00:00Z",
        created_at: "2024-01-01T00:00:00Z",
      });
    });

    it("should convert User instance with optional properties", () => {
      const user = new User({
        id: 1,
        name: "John Doe",
        email: "john@example.com",
      });

      const json = user.toJSON();

      expect(json).toEqual({
        id: 1,
        name: "John Doe",
        email: "john@example.com",
        profile_picture_url: undefined,
        last_access: undefined,
        created_at: undefined,
      });
    });
  });

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

  describe("MAX_NAME_LENGTH", () => {
    it("should be 30", () => {
      expect(User.MAX_NAME_LENGTH).toBe(30);
    });
  });
});
