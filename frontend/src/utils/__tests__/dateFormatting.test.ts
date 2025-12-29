// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  formatUserDateTime,
  formatUserDate,
  formatUserTime,
} from "../dateFormatting";
import { DateUtils } from "@habitus/shared/utils";
import type { UserData } from "../../models/User";

// Mock DateUtils
vi.mock("@habitus/shared/utils", () => ({
  DateUtils: {
    formatDate: vi.fn(),
    formatTime: vi.fn(),
    getDefaultLocale: vi.fn(() => "en-US"),
    getDefaultTimezone: vi.fn(() => "America/New_York"),
  },
}));

describe("dateFormatting", () => {
  const mockDate = "2024-01-15T14:30:00Z";
  const mockUser: UserData = {
    id: 1,
    name: "John Doe",
    email: "john@example.com",
    locale: "es-AR",
    timezone: "America/Buenos_Aires",
    created_at: "2024-01-01T00:00:00Z",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (DateUtils.formatDate as ReturnType<typeof vi.fn>).mockReturnValue(
      "15/1/2024"
    );
    (DateUtils.formatTime as ReturnType<typeof vi.fn>).mockReturnValue("11:30");
  });

  describe("formatUserDateTime", () => {
    it("should format date and time with user preferences", () => {
      const result = formatUserDateTime(mockDate, mockUser);

      expect(DateUtils.formatDate).toHaveBeenCalledWith(
        mockDate,
        "es-AR",
        "America/Buenos_Aires"
      );
      expect(DateUtils.formatTime).toHaveBeenCalledWith(
        mockDate,
        "es-AR",
        "America/Buenos_Aires"
      );
      expect(result).toBe("15/1/2024 11:30");
    });

    it("should use default locale and timezone when user is not provided", () => {
      const result = formatUserDateTime(mockDate);

      expect(DateUtils.formatDate).toHaveBeenCalledWith(
        mockDate,
        "en-US",
        "America/New_York"
      );
      expect(DateUtils.formatTime).toHaveBeenCalledWith(
        mockDate,
        "en-US",
        "America/New_York"
      );
      expect(result).toBe("15/1/2024 11:30");
    });

    it("should use default locale and timezone when user is null", () => {
      const result = formatUserDateTime(mockDate, null);

      expect(DateUtils.formatDate).toHaveBeenCalledWith(
        mockDate,
        "en-US",
        "America/New_York"
      );
      expect(DateUtils.formatTime).toHaveBeenCalledWith(
        mockDate,
        "en-US",
        "America/New_York"
      );
      expect(result).toBe("15/1/2024 11:30");
    });

    it("should use default locale when user locale is missing", () => {
      const userWithoutLocale: UserData = {
        ...mockUser,
        locale: undefined,
      };
      const result = formatUserDateTime(mockDate, userWithoutLocale);

      expect(DateUtils.formatDate).toHaveBeenCalledWith(
        mockDate,
        "en-US",
        "America/Buenos_Aires"
      );
      expect(DateUtils.formatTime).toHaveBeenCalledWith(
        mockDate,
        "en-US",
        "America/Buenos_Aires"
      );
      expect(result).toBe("15/1/2024 11:30");
    });

    it("should use default timezone when user timezone is missing", () => {
      const userWithoutTimezone: UserData = {
        ...mockUser,
        timezone: undefined,
      };
      const result = formatUserDateTime(mockDate, userWithoutTimezone);

      expect(DateUtils.formatDate).toHaveBeenCalledWith(
        mockDate,
        "es-AR",
        "America/New_York"
      );
      expect(DateUtils.formatTime).toHaveBeenCalledWith(
        mockDate,
        "es-AR",
        "America/New_York"
      );
      expect(result).toBe("15/1/2024 11:30");
    });
  });

  describe("formatUserDate", () => {
    it("should format date with user preferences", () => {
      const result = formatUserDate(mockDate, mockUser);

      expect(DateUtils.formatDate).toHaveBeenCalledWith(
        mockDate,
        "es-AR",
        "America/Buenos_Aires"
      );
      expect(DateUtils.formatDate).toHaveBeenCalledTimes(1);
      expect(result).toBe("15/1/2024");
    });

    it("should use default locale and timezone when user is not provided", () => {
      const result = formatUserDate(mockDate);

      expect(DateUtils.formatDate).toHaveBeenCalledWith(
        mockDate,
        "en-US",
        "America/New_York"
      );
      expect(result).toBe("15/1/2024");
    });

    it("should use default locale and timezone when user is null", () => {
      const result = formatUserDate(mockDate, null);

      expect(DateUtils.formatDate).toHaveBeenCalledWith(
        mockDate,
        "en-US",
        "America/New_York"
      );
      expect(result).toBe("15/1/2024");
    });

    it("should use default locale when user locale is missing", () => {
      const userWithoutLocale: UserData = {
        ...mockUser,
        locale: undefined,
      };
      const result = formatUserDate(mockDate, userWithoutLocale);

      expect(DateUtils.formatDate).toHaveBeenCalledWith(
        mockDate,
        "en-US",
        "America/Buenos_Aires"
      );
      expect(result).toBe("15/1/2024");
    });

    it("should use default timezone when user timezone is missing", () => {
      const userWithoutTimezone: UserData = {
        ...mockUser,
        timezone: undefined,
      };
      const result = formatUserDate(mockDate, userWithoutTimezone);

      expect(DateUtils.formatDate).toHaveBeenCalledWith(
        mockDate,
        "es-AR",
        "America/New_York"
      );
      expect(result).toBe("15/1/2024");
    });
  });

  describe("formatUserTime", () => {
    it("should format time with user preferences", () => {
      const result = formatUserTime(mockDate, mockUser);

      expect(DateUtils.formatTime).toHaveBeenCalledWith(
        mockDate,
        "es-AR",
        "America/Buenos_Aires"
      );
      expect(DateUtils.formatTime).toHaveBeenCalledTimes(1);
      expect(result).toBe("11:30");
    });

    it("should use default locale and timezone when user is not provided", () => {
      const result = formatUserTime(mockDate);

      expect(DateUtils.formatTime).toHaveBeenCalledWith(
        mockDate,
        "en-US",
        "America/New_York"
      );
      expect(result).toBe("11:30");
    });

    it("should use default locale and timezone when user is null", () => {
      const result = formatUserTime(mockDate, null);

      expect(DateUtils.formatTime).toHaveBeenCalledWith(
        mockDate,
        "en-US",
        "America/New_York"
      );
      expect(result).toBe("11:30");
    });

    it("should use default locale when user locale is missing", () => {
      const userWithoutLocale: UserData = {
        ...mockUser,
        locale: undefined,
      };
      const result = formatUserTime(mockDate, userWithoutLocale);

      expect(DateUtils.formatTime).toHaveBeenCalledWith(
        mockDate,
        "en-US",
        "America/Buenos_Aires"
      );
      expect(result).toBe("11:30");
    });

    it("should use default timezone when user timezone is missing", () => {
      const userWithoutTimezone: UserData = {
        ...mockUser,
        timezone: undefined,
      };
      const result = formatUserTime(mockDate, userWithoutTimezone);

      expect(DateUtils.formatTime).toHaveBeenCalledWith(
        mockDate,
        "es-AR",
        "America/New_York"
      );
      expect(result).toBe("11:30");
    });
  });
});
