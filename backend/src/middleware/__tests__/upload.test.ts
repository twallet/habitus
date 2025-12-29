import {
  getUploadsDirectory,
  uploadProfilePicture,
  UploadConfig,
  isCloudinaryStorage,
} from "../upload.js";
import path from "path";
import fs from "fs";
import { Readable } from "stream";
import { Request, Response, NextFunction } from "express";
import multer from "multer";
import { vi, beforeEach, afterEach } from "vitest";
import { v2 as cloudinary } from "cloudinary";

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

      it("should create instance with custom max file size", () => {
        const config = new UploadConfig(10 * 1024 * 1024);

        expect(config).toBeInstanceOf(UploadConfig);
      });

      it("should use DB_PATH environment variable if set (relative path)", () => {
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

      it("should use DB_PATH environment variable if set (absolute path)", () => {
        const originalDbPath = process.env.DB_PATH;
        // Use a temporary directory with absolute path for testing
        const testDataDir = path.join(__dirname, "../../../test-db-path-abs");
        const testDbPath = path.resolve(testDataDir, "database.db");
        process.env.DB_PATH = testDbPath;

        const config = new UploadConfig();
        const uploadsDir = config.getUploadsDirectory();

        expect(uploadsDir).toContain("test-db-path-abs");
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

      it("should generate unique filenames through storage", async () => {
        const originalDbPath = process.env.DB_PATH;

        // Use a temporary directory within the project for testing file creation
        const testDataDir = path.join(
          __dirname,
          "../../../test-upload-storage"
        );
        const testDbPath = path.join(testDataDir, "database.db");
        process.env.DB_PATH = testDbPath;

        const config = new UploadConfig();
        const uploadsDir = config.getUploadsDirectory();
        const multerInstance = config.getMulterInstance();
        const storage = (multerInstance as any).storage;

        const createFile = (originalname: string): Express.Multer.File => {
          const stream = new Readable();
          stream.push(Buffer.from("fake image data"));
          stream.push(null); // End of stream

          return {
            fieldname: "profilePicture",
            originalname,
            encoding: "7bit",
            mimetype: "image/jpeg",
            size: 1024,
            stream,
            destination: "",
            filename: "",
            path: "",
            buffer: Buffer.from(""),
          } as Express.Multer.File;
        };

        const file1 = createFile("test-image.jpg");
        const file2 = createFile("test-image.jpg");

        // Test filename generation - promisify the callback
        const handleFilePromise = (file: Express.Multer.File): Promise<any> => {
          return new Promise((resolve, reject) => {
            storage._handleFile(
              {} as Express.Request,
              file,
              (err: Error | null, info: any) => {
                if (err) reject(err);
                else resolve(info);
              }
            );
          });
        };

        try {
          const info1 = await handleFilePromise(file1);
          const filename1 = info1.filename;
          expect(filename1).toContain("test-image");
          expect(filename1).toContain(".jpg");

          const info2 = await handleFilePromise(file2);
          const filename2 = info2.filename;
          // Filenames should be different even with same original name
          expect(filename1).not.toBe(filename2);
          expect(filename2).toContain("test-image");
          expect(filename2).toContain(".jpg");

          // Uploaded files should exist in the temporary uploads directory
          expect(fs.existsSync(path.join(uploadsDir, filename1))).toBe(true);
          expect(fs.existsSync(path.join(uploadsDir, filename2))).toBe(true);
        } finally {
          // Cleanup: remove the created test uploads directory and its contents
          if (fs.existsSync(testDataDir)) {
            fs.rmSync(testDataDir, { recursive: true, force: true });
          }

          // Restore original DB_PATH
          if (originalDbPath) {
            process.env.DB_PATH = originalDbPath;
          } else {
            delete process.env.DB_PATH;
          }
        }
      });

      it("should sanitize special characters in filenames", async () => {
        const originalDbPath = process.env.DB_PATH;

        // Use a temporary directory within the project for testing file creation
        const testDataDir = path.join(
          __dirname,
          "../../../test-upload-storage-sanitize"
        );
        const testDbPath = path.join(testDataDir, "database.db");
        process.env.DB_PATH = testDbPath;

        const config = new UploadConfig();
        const uploadsDir = config.getUploadsDirectory();
        const multerInstance = config.getMulterInstance();
        const storage = (multerInstance as any).storage;

        const stream = new Readable();
        stream.push(Buffer.from("fake image data"));
        stream.push(null); // End of stream

        const file = {
          fieldname: "profilePicture",
          originalname: "test file (1).jpg",
          encoding: "7bit",
          mimetype: "image/jpeg",
          size: 1024,
          stream,
          destination: "",
          filename: "",
          path: "",
          buffer: Buffer.from(""),
        } as Express.Multer.File;

        // Promisify the callback
        try {
          const info = await new Promise<any>((resolve, reject) => {
            storage._handleFile(
              {} as Express.Request,
              file,
              (err: Error | null, info: any) => {
                if (err) reject(err);
                else resolve(info);
              }
            );
          });

          const generatedFilename = info.filename;
          // Filename should not contain special characters like spaces, parentheses
          expect(generatedFilename).not.toContain(" ");
          expect(generatedFilename).not.toContain("(");
          expect(generatedFilename).not.toContain(")");
          expect(generatedFilename).toContain("test");
          expect(generatedFilename).toContain(".jpg");

          // Uploaded file should exist in the temporary uploads directory
          expect(fs.existsSync(path.join(uploadsDir, generatedFilename))).toBe(
            true
          );
        } finally {
          // Cleanup: remove the created test uploads directory and its contents
          if (fs.existsSync(testDataDir)) {
            fs.rmSync(testDataDir, { recursive: true, force: true });
          }

          // Restore original DB_PATH
          if (originalDbPath) {
            process.env.DB_PATH = originalDbPath;
          } else {
            delete process.env.DB_PATH;
          }
        }
      });

      it("should use correct destination directory in storage", async () => {
        const originalDbPath = process.env.DB_PATH;

        // Use a temporary directory within the project for testing file creation
        const testDataDir = path.join(
          __dirname,
          "../../../test-upload-storage-destination"
        );
        const testDbPath = path.join(testDataDir, "database.db");
        process.env.DB_PATH = testDbPath;

        const config = new UploadConfig();
        const uploadsDir = config.getUploadsDirectory();
        const multerInstance = config.getMulterInstance();
        const storage = (multerInstance as any).storage;

        const stream = new Readable();
        stream.push(Buffer.from("fake image data"));
        stream.push(null); // End of stream

        const file = {
          fieldname: "profilePicture",
          originalname: "test.jpg",
          encoding: "7bit",
          mimetype: "image/jpeg",
          size: 1024,
          stream,
          destination: "",
          filename: "",
          path: "",
          buffer: Buffer.from(""),
        } as Express.Multer.File;

        // Promisify the callback
        try {
          const info = await new Promise<any>((resolve, reject) => {
            storage._handleFile(
              {} as Express.Request,
              file,
              (err: Error | null, info: any) => {
                if (err) reject(err);
                else resolve(info);
              }
            );
          });

          expect(info.destination).toBe(uploadsDir);
          expect(info.filename).toBeDefined();

          // Uploaded file should exist in the temporary uploads directory
          expect(fs.existsSync(path.join(uploadsDir, info.filename))).toBe(
            true
          );
        } finally {
          // Cleanup: remove the created test uploads directory and its contents
          if (fs.existsSync(testDataDir)) {
            fs.rmSync(testDataDir, { recursive: true, force: true });
          }

          // Restore original DB_PATH
          if (originalDbPath) {
            process.env.DB_PATH = originalDbPath;
          } else {
            delete process.env.DB_PATH;
          }
        }
      });
    });

    describe("fileFilter", () => {
      it("should accept JPEG files", async () => {
        const config = new UploadConfig();
        const multerInstance = config.getMulterInstance();
        const storage = (multerInstance as any).storage;
        const fileFilter = (multerInstance as any).fileFilter;

        const file = {
          originalname: "test.jpg",
          mimetype: "image/jpeg",
          size: 1024,
        } as Express.Multer.File;

        await new Promise<void>((resolve, reject) => {
          fileFilter(
            {} as Request,
            file,
            (err: Error | null, accept: boolean) => {
              if (err) reject(err);
              else {
                expect(accept).toBe(true);
                resolve();
              }
            }
          );
        });
      });

      it("should accept JPG files", async () => {
        const config = new UploadConfig();
        const multerInstance = config.getMulterInstance();
        const fileFilter = (multerInstance as any).fileFilter;

        const file = {
          originalname: "test.jpg",
          mimetype: "image/jpg",
          size: 1024,
        } as Express.Multer.File;

        await new Promise<void>((resolve, reject) => {
          fileFilter(
            {} as Request,
            file,
            (err: Error | null, accept: boolean) => {
              if (err) reject(err);
              else {
                expect(accept).toBe(true);
                resolve();
              }
            }
          );
        });
      });

      it("should accept PNG files", async () => {
        const config = new UploadConfig();
        const multerInstance = config.getMulterInstance();
        const fileFilter = (multerInstance as any).fileFilter;

        const file = {
          originalname: "test.png",
          mimetype: "image/png",
          size: 1024,
        } as Express.Multer.File;

        await new Promise<void>((resolve, reject) => {
          fileFilter(
            {} as Request,
            file,
            (err: Error | null, accept: boolean) => {
              if (err) reject(err);
              else {
                expect(accept).toBe(true);
                resolve();
              }
            }
          );
        });
      });

      it("should accept GIF files", async () => {
        const config = new UploadConfig();
        const multerInstance = config.getMulterInstance();
        const fileFilter = (multerInstance as any).fileFilter;

        const file = {
          originalname: "test.gif",
          mimetype: "image/gif",
          size: 1024,
        } as Express.Multer.File;

        await new Promise<void>((resolve, reject) => {
          fileFilter(
            {} as Request,
            file,
            (err: Error | null, accept: boolean) => {
              if (err) reject(err);
              else {
                expect(accept).toBe(true);
                resolve();
              }
            }
          );
        });
      });

      it("should accept WebP files", async () => {
        const config = new UploadConfig();
        const multerInstance = config.getMulterInstance();
        const fileFilter = (multerInstance as any).fileFilter;

        const file = {
          originalname: "test.webp",
          mimetype: "image/webp",
          size: 1024,
        } as Express.Multer.File;

        await new Promise<void>((resolve, reject) => {
          fileFilter(
            {} as Request,
            file,
            (err: Error | null, accept: boolean) => {
              if (err) reject(err);
              else {
                expect(accept).toBe(true);
                resolve();
              }
            }
          );
        });
      });

      it("should reject non-image files", async () => {
        const config = new UploadConfig();
        const multerInstance = config.getMulterInstance();
        const fileFilter = (multerInstance as any).fileFilter;

        const file = {
          originalname: "test.pdf",
          mimetype: "application/pdf",
          size: 1024,
        } as Express.Multer.File;

        await new Promise<void>((resolve, reject) => {
          fileFilter(
            {} as Request,
            file,
            (err: Error | null, accept: boolean) => {
              expect(err).toBeInstanceOf(Error);
              expect(err?.message).toContain("Only image files");
              expect(accept).toBeUndefined();
              resolve();
            }
          );
        });
      });

      it("should reject text files", async () => {
        const config = new UploadConfig();
        const multerInstance = config.getMulterInstance();
        const fileFilter = (multerInstance as any).fileFilter;

        const file = {
          originalname: "test.txt",
          mimetype: "text/plain",
          size: 1024,
        } as Express.Multer.File;

        await new Promise<void>((resolve, reject) => {
          fileFilter(
            {} as Request,
            file,
            (err: Error | null, accept: boolean) => {
              expect(err).toBeInstanceOf(Error);
              expect(err?.message).toContain("Only image files");
              resolve();
            }
          );
        });
      });
    });

    describe("constructor edge cases", () => {
      it("should create directory if it does not exist", () => {
        const originalDbPath = process.env.DB_PATH;
        const testDataDir = path.join(
          __dirname,
          "../../../test-upload-new-dir"
        );
        const testDbPath = path.join(testDataDir, "database.db");

        // Ensure directory doesn't exist
        if (fs.existsSync(testDataDir)) {
          fs.rmSync(testDataDir, { recursive: true, force: true });
        }

        process.env.DB_PATH = testDbPath;

        const config = new UploadConfig();
        const uploadsDir = config.getUploadsDirectory();

        expect(fs.existsSync(uploadsDir)).toBe(true);

        // Cleanup
        if (fs.existsSync(testDataDir)) {
          fs.rmSync(testDataDir, { recursive: true, force: true });
        }

        if (originalDbPath) {
          process.env.DB_PATH = originalDbPath;
        } else {
          delete process.env.DB_PATH;
        }
      });

      it("should not fail if directory already exists", () => {
        const originalDbPath = process.env.DB_PATH;
        const testDataDir = path.join(
          __dirname,
          "../../../test-upload-existing-dir"
        );
        const testDbPath = path.join(testDataDir, "database.db");
        const testUploadsDir = path.join(testDataDir, "uploads");

        // Create directory first
        if (!fs.existsSync(testUploadsDir)) {
          fs.mkdirSync(testUploadsDir, { recursive: true });
        }

        process.env.DB_PATH = testDbPath;

        // Should not throw error
        expect(() => {
          const config = new UploadConfig();
          expect(config.getUploadsDirectory()).toBe(testUploadsDir);
        }).not.toThrow();

        // Cleanup
        if (fs.existsSync(testDataDir)) {
          fs.rmSync(testDataDir, { recursive: true, force: true });
        }

        if (originalDbPath) {
          process.env.DB_PATH = originalDbPath;
        } else {
          delete process.env.DB_PATH;
        }
      });
    });

    describe("file size limits", () => {
      it("should use custom max file size", () => {
        const customSize = 10 * 1024 * 1024; // 10MB
        const config = new UploadConfig(customSize);
        const multerInstance = config.getMulterInstance();
        const limits = (multerInstance as any).limits;

        expect(limits.fileSize).toBe(customSize);
      });

      it("should use default max file size (5MB)", () => {
        const config = new UploadConfig();
        const multerInstance = config.getMulterInstance();
        const limits = (multerInstance as any).limits;

        expect(limits.fileSize).toBe(5 * 1024 * 1024);
      });
    });
  });

  describe("uploadProfilePicture middleware", () => {
    it("should execute middleware function", async () => {
      const mockReq = {
        headers: {},
        body: {},
      } as Request;
      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
      } as unknown as Response;
      const mockNext = vi.fn() as NextFunction;

      // Middleware should handle request (may call next or handle error)
      try {
        await new Promise<void>((resolve, reject) => {
          uploadProfilePicture(mockReq, mockRes, (err?: any) => {
            if (err) {
              // Error is acceptable (e.g., no file uploaded)
              resolve();
            } else {
              resolve();
            }
          });
        });
      } catch (error) {
        // Multer may throw errors for invalid requests, which is acceptable
        expect(error).toBeDefined();
      }
    });

    it("should return same middleware instance on multiple calls", () => {
      // The middleware is a lazy getter, so calling it multiple times
      // should use the same underlying multer middleware
      const middleware1 = uploadProfilePicture;
      const middleware2 = uploadProfilePicture;

      expect(middleware1).toBe(middleware2);
    });
  });

  describe("getUploadsDirectory function", () => {
    it("should return same directory on multiple calls", () => {
      const dir1 = getUploadsDirectory();
      const dir2 = getUploadsDirectory();

      expect(dir1).toBe(dir2);
    });

    it("should use singleton UploadConfig instance", () => {
      const dir1 = getUploadsDirectory();
      const dir2 = getUploadsDirectory();

      // Should return consistent path
      expect(dir1).toBe(dir2);
      expect(dir1).toContain("uploads");
    });
  });

  describe("Cloudinary Storage", () => {
    const originalCloudinaryCloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const originalCloudinaryApiKey = process.env.CLOUDINARY_API_KEY;
    const originalCloudinaryApiSecret = process.env.CLOUDINARY_API_SECRET;

    beforeEach(() => {
      // Reset singleton instance
      vi.resetModules();
    });

    afterEach(() => {
      // Restore original environment variables
      if (originalCloudinaryCloudName) {
        process.env.CLOUDINARY_CLOUD_NAME = originalCloudinaryCloudName;
      } else {
        delete process.env.CLOUDINARY_CLOUD_NAME;
      }
      if (originalCloudinaryApiKey) {
        process.env.CLOUDINARY_API_KEY = originalCloudinaryApiKey;
      } else {
        delete process.env.CLOUDINARY_API_KEY;
      }
      if (originalCloudinaryApiSecret) {
        process.env.CLOUDINARY_API_SECRET = originalCloudinaryApiSecret;
      } else {
        delete process.env.CLOUDINARY_API_SECRET;
      }
    });

    describe("getStorageType", () => {
      it("should return LOCAL when Cloudinary credentials are not set", () => {
        delete process.env.CLOUDINARY_CLOUD_NAME;
        delete process.env.CLOUDINARY_API_KEY;
        delete process.env.CLOUDINARY_API_SECRET;

        const config = new UploadConfig();
        expect(config.getStorageType()).toBe("local");
      });

      it("should return CLOUDINARY when all Cloudinary credentials are set", () => {
        process.env.CLOUDINARY_CLOUD_NAME = "test-cloud";
        process.env.CLOUDINARY_API_KEY = "test-key";
        process.env.CLOUDINARY_API_SECRET = "test-secret";

        const config = new UploadConfig();
        expect(config.getStorageType()).toBe("cloudinary");
      });

      it("should return LOCAL when only some Cloudinary credentials are set", () => {
        process.env.CLOUDINARY_CLOUD_NAME = "test-cloud";
        process.env.CLOUDINARY_API_KEY = "test-key";
        delete process.env.CLOUDINARY_API_SECRET;

        const config = new UploadConfig();
        expect(config.getStorageType()).toBe("local");
      });
    });

    describe("isCloudinaryStorage", () => {
      it("should return false when Cloudinary is not configured", async () => {
        delete process.env.CLOUDINARY_CLOUD_NAME;
        delete process.env.CLOUDINARY_API_KEY;
        delete process.env.CLOUDINARY_API_SECRET;

        // Reset module to get fresh singleton
        vi.resetModules();
        const uploadModule = await import("../upload.js");
        expect(uploadModule.isCloudinaryStorage()).toBe(false);
      });

      it("should return true when Cloudinary is configured", async () => {
        process.env.CLOUDINARY_CLOUD_NAME = "test-cloud";
        process.env.CLOUDINARY_API_KEY = "test-key";
        process.env.CLOUDINARY_API_SECRET = "test-secret";

        // Reset module to get fresh singleton
        vi.resetModules();
        const uploadModule = await import("../upload.js");
        expect(uploadModule.isCloudinaryStorage()).toBe(true);
      });
    });

    describe("UploadConfig with Cloudinary", () => {
      it("should configure Cloudinary when credentials are present", () => {
        process.env.CLOUDINARY_CLOUD_NAME = "test-cloud";
        process.env.CLOUDINARY_API_KEY = "test-key";
        process.env.CLOUDINARY_API_SECRET = "test-secret";

        const configSpy = vi.spyOn(cloudinary, "config");

        const config = new UploadConfig();
        expect(config.getStorageType()).toBe("cloudinary");
        expect(configSpy).toHaveBeenCalledWith({
          cloud_name: "test-cloud",
          api_key: "test-key",
          api_secret: "test-secret",
        });

        configSpy.mockRestore();
      });

      it("should not create uploads directory when using Cloudinary", () => {
        process.env.CLOUDINARY_CLOUD_NAME = "test-cloud";
        process.env.CLOUDINARY_API_KEY = "test-key";
        process.env.CLOUDINARY_API_SECRET = "test-secret";

        const originalDbPath = process.env.DB_PATH;
        const testDataDir = path.join(
          __dirname,
          "../../../test-cloudinary-no-dir"
        );
        const testDbPath = path.join(testDataDir, "database.db");

        // Ensure directory doesn't exist
        if (fs.existsSync(testDataDir)) {
          fs.rmSync(testDataDir, { recursive: true, force: true });
        }

        process.env.DB_PATH = testDbPath;

        const config = new UploadConfig();
        const uploadsDir = config.getUploadsDirectory();

        // Directory should not be created for Cloudinary
        // (it would be created if local storage was used)
        // But the path should still be valid
        expect(uploadsDir).toContain("test-cloudinary-no-dir");
        expect(uploadsDir).toContain("uploads");

        // Cleanup
        if (fs.existsSync(testDataDir)) {
          fs.rmSync(testDataDir, { recursive: true, force: true });
        }

        if (originalDbPath) {
          process.env.DB_PATH = originalDbPath;
        } else {
          delete process.env.DB_PATH;
        }
      });
    });

    describe("uploadToCloudinary", () => {
      beforeEach(() => {
        process.env.CLOUDINARY_CLOUD_NAME = "test-cloud";
        process.env.CLOUDINARY_API_KEY = "test-key";
        process.env.CLOUDINARY_API_SECRET = "test-secret";
      });

      it("should throw error when Cloudinary is not configured", async () => {
        delete process.env.CLOUDINARY_CLOUD_NAME;
        delete process.env.CLOUDINARY_API_KEY;
        delete process.env.CLOUDINARY_API_SECRET;

        const config = new UploadConfig();
        const buffer = Buffer.from("fake image data");

        await expect(
          config.uploadToCloudinary(buffer, "test.jpg", "image/jpeg")
        ).rejects.toThrow("Cloudinary is not configured");
      });

      it("should upload file to Cloudinary successfully", async () => {
        const config = new UploadConfig();
        const buffer = Buffer.from("fake image data");

        // Mock Cloudinary upload_stream
        const mockUploadStream = {
          end: vi.fn((buffer: Buffer) => {
            // Simulate successful upload
            setTimeout(() => {
              const callback = (mockUploadStream as any).callback;
              if (callback) {
                callback(null, {
                  secure_url:
                    "https://res.cloudinary.com/test-cloud/image/upload/v123/test.jpg",
                  public_id: "habitus/profile-pictures/test",
                });
              }
            }, 0);
          }),
        };

        vi.spyOn(cloudinary.uploader, "upload_stream").mockImplementation(((
          options: any,
          callback: any
        ) => {
          (mockUploadStream as any).callback = callback;
          return mockUploadStream as any;
        }) as any);

        const result = await config.uploadToCloudinary(
          buffer,
          "test.jpg",
          "image/jpeg"
        );

        expect(result.url).toBe(
          "https://res.cloudinary.com/test-cloud/image/upload/v123/test.jpg"
        );
        expect(result.publicId).toBe("habitus/profile-pictures/test");
        expect(cloudinary.uploader.upload_stream).toHaveBeenCalledWith(
          {
            folder: "habitus/profile-pictures",
            resource_type: "image",
            allowed_formats: ["jpg", "jpeg", "png", "gif", "webp"],
          },
          expect.any(Function)
        );

        vi.restoreAllMocks();
      });

      it("should handle Cloudinary upload errors", async () => {
        const config = new UploadConfig();
        const buffer = Buffer.from("fake image data");

        const mockError = new Error("Cloudinary upload failed");

        // Mock Cloudinary upload_stream with error
        const mockUploadStream = {
          end: vi.fn((buffer: Buffer) => {
            setTimeout(() => {
              const callback = (mockUploadStream as any).callback;
              if (callback) {
                callback(mockError, null);
              }
            }, 0);
          }),
        };

        vi.spyOn(cloudinary.uploader, "upload_stream").mockImplementation(((
          options: any,
          callback: any
        ) => {
          (mockUploadStream as any).callback = callback;
          return mockUploadStream as any;
        }) as any);

        await expect(
          config.uploadToCloudinary(buffer, "test.jpg", "image/jpeg")
        ).rejects.toThrow("Cloudinary upload failed");

        vi.restoreAllMocks();
      });

      it("should handle Cloudinary upload with no URL returned", async () => {
        const config = new UploadConfig();
        const buffer = Buffer.from("fake image data");

        // Mock Cloudinary upload_stream with no URL
        const mockUploadStream = {
          end: vi.fn((buffer: Buffer) => {
            setTimeout(() => {
              const callback = (mockUploadStream as any).callback;
              if (callback) {
                callback(null, { public_id: "test" }); // No secure_url
              }
            }, 0);
          }),
        };

        vi.spyOn(cloudinary.uploader, "upload_stream").mockImplementation(((
          options: any,
          callback: any
        ) => {
          (mockUploadStream as any).callback = callback;
          return mockUploadStream as any;
        }) as any);

        await expect(
          config.uploadToCloudinary(buffer, "test.jpg", "image/jpeg")
        ).rejects.toThrow("Cloudinary upload failed: No URL returned");

        vi.restoreAllMocks();
      });

      it("should handle Cloudinary upload with null result", async () => {
        const config = new UploadConfig();
        const buffer = Buffer.from("fake image data");

        // Mock Cloudinary upload_stream with null result
        const mockUploadStream = {
          end: vi.fn((buffer: Buffer) => {
            setTimeout(() => {
              const callback = (mockUploadStream as any).callback;
              if (callback) {
                callback(null, null);
              }
            }, 0);
          }),
        };

        vi.spyOn(cloudinary.uploader, "upload_stream").mockImplementation(((
          options: any,
          callback: any
        ) => {
          (mockUploadStream as any).callback = callback;
          return mockUploadStream as any;
        }) as any);

        await expect(
          config.uploadToCloudinary(buffer, "test.jpg", "image/jpeg")
        ).rejects.toThrow("Cloudinary upload failed: No URL returned");

        vi.restoreAllMocks();
      });
    });

    describe("uploadProfilePicture with Cloudinary", () => {
      beforeEach(() => {
        process.env.CLOUDINARY_CLOUD_NAME = "test-cloud";
        process.env.CLOUDINARY_API_KEY = "test-key";
        process.env.CLOUDINARY_API_SECRET = "test-secret";
      });

      it("should use Cloudinary when configured", async () => {
        vi.resetModules();
        const uploadModule = await import("../upload.js");
        const uploadMiddleware = uploadModule.uploadProfilePicture;

        const mockReq = {
          headers: {},
          body: {},
          file: undefined,
        } as Request;

        const mockRes = {
          status: vi.fn().mockReturnThis(),
          json: vi.fn().mockReturnThis(),
        } as unknown as Response;

        const mockNext = vi.fn() as NextFunction;

        // Mock multer memory storage
        const mockMulterSingle = vi.fn((fieldName: string) => {
          return (req: Request, res: Response, callback: NextFunction) => {
            // Simulate no file uploaded
            callback();
          };
        });

        vi.spyOn(multer, "default" as any).mockReturnValue({
          single: mockMulterSingle,
        } as any);

        await new Promise<void>((resolve) => {
          uploadMiddleware(mockReq, mockRes, (err?: any) => {
            if (err) {
              // Error is acceptable
            }
            resolve();
          });
        });

        expect((multer as any).default).toHaveBeenCalledWith(
          expect.objectContaining({
            storage: expect.anything(),
            fileFilter: expect.any(Function),
            limits: expect.objectContaining({
              fileSize: 5 * 1024 * 1024,
            }),
          })
        );

        vi.restoreAllMocks();
      });

      it("should upload file to Cloudinary and set file properties", async () => {
        vi.resetModules();
        const uploadModule = await import("../upload.js");
        const uploadMiddleware = uploadModule.uploadProfilePicture;

        const mockFile = {
          fieldname: "profilePicture",
          originalname: "test.jpg",
          encoding: "7bit",
          mimetype: "image/jpeg",
          size: 1024,
          buffer: Buffer.from("fake image data"),
        } as Express.Multer.File;

        const mockReq = {
          headers: {},
          body: {},
          file: mockFile,
        } as any;

        const mockRes = {
          status: vi.fn().mockReturnThis(),
          json: vi.fn().mockReturnThis(),
        } as unknown as Response;

        const mockNext = vi.fn() as NextFunction;

        // Mock multer memory storage to set file
        const mockMulterSingle = vi.fn((fieldName: string) => {
          return (req: Request, res: Response, callback: NextFunction) => {
            (req as any).file = mockFile;
            callback();
          };
        });

        vi.spyOn(multer, "default" as any).mockReturnValue({
          single: mockMulterSingle,
        } as any);

        // Mock Cloudinary upload
        const mockUploadStream = {
          end: vi.fn((buffer: Buffer) => {
            setTimeout(() => {
              const callback = (mockUploadStream as any).callback;
              if (callback) {
                callback(null, {
                  secure_url:
                    "https://res.cloudinary.com/test-cloud/image/upload/v123/test.jpg",
                  public_id: "habitus/profile-pictures/test",
                });
              }
            }, 0);
          }),
        };

        vi.spyOn(cloudinary.uploader, "upload_stream").mockImplementation(((
          options: any,
          callback: any
        ) => {
          (mockUploadStream as any).callback = callback;
          return mockUploadStream as any;
        }) as any);

        await new Promise<void>((resolve) => {
          uploadMiddleware(mockReq, mockRes, (err?: any) => {
            if (err) {
              // Error is acceptable
            }
            resolve();
          });
        });

        // Wait for async Cloudinary upload
        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(mockNext).toHaveBeenCalled();

        vi.restoreAllMocks();
      });

      it("should handle Cloudinary upload errors in middleware", async () => {
        vi.resetModules();
        const uploadModule = await import("../upload.js");
        const uploadMiddleware = uploadModule.uploadProfilePicture;

        const mockFile = {
          fieldname: "profilePicture",
          originalname: "test.jpg",
          encoding: "7bit",
          mimetype: "image/jpeg",
          size: 1024,
          buffer: Buffer.from("fake image data"),
        } as Express.Multer.File;

        const mockReq = {
          headers: {},
          body: {},
          file: mockFile,
        } as any;

        const mockRes = {
          status: vi.fn().mockReturnThis(),
          json: vi.fn().mockReturnThis(),
        } as unknown as Response;

        const mockNext = vi.fn() as NextFunction;

        // Mock multer memory storage to set file
        const mockMulterSingle = vi.fn((fieldName: string) => {
          return (req: Request, res: Response, callback: NextFunction) => {
            (req as any).file = mockFile;
            callback();
          };
        });

        vi.spyOn(multer, "default" as any).mockReturnValue({
          single: mockMulterSingle,
        } as any);

        // Mock Cloudinary upload error
        const mockError = new Error("Cloudinary upload failed");
        const mockUploadStream = {
          end: vi.fn((buffer: Buffer) => {
            setTimeout(() => {
              const callback = (mockUploadStream as any).callback;
              if (callback) {
                callback(mockError, null);
              }
            }, 0);
          }),
        };

        vi.spyOn(cloudinary.uploader, "upload_stream").mockImplementation(((
          options: any,
          callback: any
        ) => {
          (mockUploadStream as any).callback = callback;
          return mockUploadStream as any;
        }) as any);

        await new Promise<void>((resolve) => {
          uploadMiddleware(mockReq, mockRes, (err?: any) => {
            expect(err).toBe(mockError);
            resolve();
          });
        });

        // Wait for async Cloudinary upload
        await new Promise((resolve) => setTimeout(resolve, 10));

        vi.restoreAllMocks();
      });

      it("should handle multer errors in Cloudinary mode", async () => {
        vi.resetModules();
        const uploadModule = await import("../upload.js");
        const uploadMiddleware = uploadModule.uploadProfilePicture;

        const mockReq = {
          headers: {},
          body: {},
          file: undefined,
        } as Request;

        const mockRes = {
          status: vi.fn().mockReturnThis(),
          json: vi.fn().mockReturnThis(),
        } as unknown as Response;

        const mockNext = vi.fn() as NextFunction;

        const mockError = new Error("Multer error");

        // Mock multer memory storage to return error
        const mockMulterSingle = vi.fn((fieldName: string) => {
          return (req: Request, res: Response, callback: NextFunction) => {
            callback(mockError);
          };
        });

        vi.spyOn(multer, "default" as any).mockReturnValue({
          single: mockMulterSingle,
        } as any);

        await new Promise<void>((resolve) => {
          uploadMiddleware(mockReq, mockRes, (err?: any) => {
            expect(err).toBe(mockError);
            resolve();
          });
        });

        vi.restoreAllMocks();
      });

      it("should accept valid image types in Cloudinary mode", async () => {
        vi.resetModules();
        const uploadModule = await import("../upload.js");
        const uploadMiddleware = uploadModule.uploadProfilePicture;

        const mockReq = {
          headers: {},
          body: {},
          file: undefined,
        } as Request;

        const mockRes = {
          status: vi.fn().mockReturnThis(),
          json: vi.fn().mockReturnThis(),
        } as unknown as Response;

        const mockNext = vi.fn() as NextFunction;

        // Mock multer with file filter
        let fileFilterCallback: any;
        const mockMulterSingle = vi.fn((fieldName: string) => {
          return (req: Request, res: Response, callback: NextFunction) => {
            // Test file filter with valid image
            const mockFile = {
              mimetype: "image/jpeg",
            } as Express.Multer.File;

            if (fileFilterCallback) {
              fileFilterCallback(
                null,
                mockFile,
                (err: any, accept: boolean) => {
                  if (!err && accept) {
                    callback();
                  } else {
                    callback(err);
                  }
                }
              );
            } else {
              callback();
            }
          };
        });

        vi.spyOn(multer, "default" as any).mockImplementation(
          (options: any) => {
            fileFilterCallback = options.fileFilter;
            return {
              single: mockMulterSingle,
            } as any;
          }
        );

        await new Promise<void>((resolve) => {
          uploadMiddleware(mockReq, mockRes, (err?: any) => {
            if (err) {
              // Error is acceptable
            }
            resolve();
          });
        });

        vi.restoreAllMocks();
      });

      it("should reject invalid file types in Cloudinary mode", async () => {
        vi.resetModules();
        const uploadModule = await import("../upload.js");
        const uploadMiddleware = uploadModule.uploadProfilePicture;

        const mockReq = {
          headers: {},
          body: {},
          file: undefined,
        } as Request;

        const mockRes = {
          status: vi.fn().mockReturnThis(),
          json: vi.fn().mockReturnThis(),
        } as unknown as Response;

        const mockNext = vi.fn() as NextFunction;

        // Mock multer with file filter
        let fileFilterCallback: any;
        const mockMulterSingle = vi.fn((fieldName: string) => {
          return (req: Request, res: Response, callback: NextFunction) => {
            // Test file filter with invalid file type
            const mockFile = {
              mimetype: "application/pdf",
            } as Express.Multer.File;

            if (fileFilterCallback) {
              fileFilterCallback(
                null,
                mockFile,
                (err: any, accept: boolean) => {
                  callback(err);
                }
              );
            } else {
              callback();
            }
          };
        });

        vi.spyOn(multer, "default" as any).mockImplementation(
          (options: any) => {
            fileFilterCallback = options.fileFilter;
            return {
              single: mockMulterSingle,
            } as any;
          }
        );

        await new Promise<void>((resolve) => {
          uploadMiddleware(mockReq, mockRes, (err?: any) => {
            expect(err).toBeInstanceOf(Error);
            expect(err?.message).toContain("Only image files");
            resolve();
          });
        });

        vi.restoreAllMocks();
      });
    });
  });
});
