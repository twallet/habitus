import { getUploadsDirectory } from "../upload.js";
import path from "path";
import fs from "fs";

describe("Upload Middleware", () => {
  describe("getUploadsDirectory", () => {
    it("should return uploads directory path", () => {
      const uploadsDir = getUploadsDirectory();

      expect(typeof uploadsDir).toBe("string");
      expect(uploadsDir).toContain("uploads");
    });

    it("should create uploads directory if it does not exist", () => {
      // This test verifies the directory creation logic
      // The actual directory creation happens in getUploadsDir()
      const uploadsDir = getUploadsDirectory();

      // Directory should exist after calling the function
      expect(fs.existsSync(uploadsDir)).toBe(true);
    });
  });
});

