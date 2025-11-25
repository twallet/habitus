import {
  getUploadsDirectory,
  uploadProfilePicture,
  UploadConfig,
} from "../upload.js";
import path from "path";
import fs from "fs";
import multer from "multer";

describe("Upload Middleware", () => {
  describe("getUploadsDirectory", () => {
    it("should return uploads directory path", () => {
      const uploadsDir = getUploadsDirectory();

      expect(typeof uploadsDir).toBe("string");
      expect(uploadsDir).toContain("uploads");
    });

    it("should create uploads directory if it does not exist", () => {
      const uploadsDir = getUploadsDirectory();

      // Directory should exist after calling the function
      expect(fs.existsSync(uploadsDir)).toBe(true);
    });
  });

  describe("uploadProfilePicture", () => {
    it("should be a function", () => {
      expect(typeof uploadProfilePicture).toBe("function");
    });
  });

  describe("UploadConfig", () => {
    describe("constructor", () => {
      it("should create instance with default settings", () => {
        const config = new UploadConfig();

        expect(config).toBeInstanceOf(UploadConfig);
        expect(config.getUploadsDirectory()).toContain("uploads");
      });

      it("should create instance with custom data directory", () => {
        const customDir = path.join(__dirname, "../../../test-data");
        const config = new UploadConfig(customDir);

        const uploadsDir = config.getUploadsDirectory();
        expect(uploadsDir).toContain("test-data");
        expect(uploadsDir).toContain("uploads");

        // Cleanup
        if (fs.existsSync(customDir)) {
          fs.rmSync(customDir, { recursive: true, force: true });
        }
      });

      it("should create instance with custom max file size", () => {
        const config = new UploadConfig(undefined, 10 * 1024 * 1024);

        expect(config).toBeInstanceOf(UploadConfig);
      });

      it("should use DB_PATH environment variable if set", () => {
        const originalDbPath = process.env.DB_PATH;
        // Use a temporary directory within the project for testing
        const testDataDir = path.join(__dirname, "../../../test-db-path");
        const testDbPath = path.join(testDataDir, "database.db");
        process.env.DB_PATH = testDbPath;

        const config = new UploadConfig();
        const uploadsDir = config.getUploadsDirectory();

        expect(uploadsDir).toContain("test-db-path");
        expect(uploadsDir).toContain("uploads");

        // Cleanup: remove the created directory
        if (fs.existsSync(testDataDir)) {
          fs.rmSync(testDataDir, { recursive: true, force: true });
        }

        // Restore
        if (originalDbPath) {
          process.env.DB_PATH = originalDbPath;
        } else {
          delete process.env.DB_PATH;
        }
      });
    });

    describe("getUploadsDirectory", () => {
      it("should return the uploads directory path", () => {
        const config = new UploadConfig();
        const uploadsDir = config.getUploadsDirectory();

        expect(typeof uploadsDir).toBe("string");
        expect(uploadsDir).toContain("uploads");
      });

      it("should return consistent path for same instance", () => {
        const config = new UploadConfig();
        const dir1 = config.getUploadsDirectory();
        const dir2 = config.getUploadsDirectory();

        expect(dir1).toBe(dir2);
      });
    });

    describe("getMulterInstance", () => {
      it("should return multer instance", () => {
        const config = new UploadConfig();
        const multer = config.getMulterInstance();

        expect(multer).toBeDefined();
        expect(typeof multer.single).toBe("function");
      });

      it("should return same instance on multiple calls", () => {
        const config = new UploadConfig();
        const multer1 = config.getMulterInstance();
        const multer2 = config.getMulterInstance();

        expect(multer1).toBe(multer2);
      });
    });

    describe("getProfilePictureMiddleware", () => {
      it("should return middleware function", () => {
        const config = new UploadConfig();
        const middleware = config.getProfilePictureMiddleware();

        expect(typeof middleware).toBe("function");
      });
    });

    describe("multer configuration", () => {
      it("should create multer instance with storage configured", () => {
        const config = new UploadConfig();
        const multerInstance = config.getMulterInstance();

        expect(multerInstance).toBeDefined();
        expect(typeof multerInstance.single).toBe("function");
      });

      it("should create middleware function", () => {
        const config = new UploadConfig();
        const middleware = config.getProfilePictureMiddleware();

        expect(typeof middleware).toBe("function");
      });

      it("should use configured uploads directory", () => {
        const config = new UploadConfig();
        const expectedDir = config.getUploadsDirectory();

        // Verify directory is set correctly and exists
        expect(expectedDir).toContain("uploads");
        expect(fs.existsSync(expectedDir)).toBe(true);
      });

      it("should return same multer instance on multiple calls", () => {
        const config = new UploadConfig();
        const multer1 = config.getMulterInstance();
        const multer2 = config.getMulterInstance();

        expect(multer1).toBe(multer2);
      });
    });
  });
});
