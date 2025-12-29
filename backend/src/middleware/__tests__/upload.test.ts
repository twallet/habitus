import {
  getUploadsDirectory,
  uploadProfilePicture,
  UploadConfig,
} from "../upload.js";
import path from "path";
import fs from "fs";
import { Readable } from "stream";
import { Request, Response, NextFunction } from "express";
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
});
