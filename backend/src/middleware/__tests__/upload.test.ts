import {
  getUploadsDirectory,
  uploadProfilePicture,
  UploadConfig,
} from "../upload.js";
import path from "path";
import fs from "fs";
import { Readable } from "stream";

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
        const config = new UploadConfig();
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
      });

      it("should sanitize special characters in filenames", async () => {
        const config = new UploadConfig();
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
      });

      it("should use correct destination directory in storage", async () => {
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
      });
    });
  });
});
