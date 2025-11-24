import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

/**
 * Get __dirname in a way that works in both ESM and Jest.
 * @returns The directory path
 * @private
 */
function getDirname(): string {
  // Check if we're in a test environment
  if (
    typeof process !== "undefined" &&
    (process.env.NODE_ENV === "test" || process.env.JEST_WORKER_ID)
  ) {
    return path.resolve();
  }

  try {
    // Use eval to avoid TypeScript/Jest parsing issues with import.meta
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const importMeta = new Function(
      'return typeof import !== "undefined" ? import.meta : null'
    )();
    if (importMeta && importMeta.url) {
      const __filename = fileURLToPath(importMeta.url);
      return path.dirname(__filename);
    }
  } catch {
    // Fallback if import.meta is not available
  }

  return path.resolve();
}

/**
 * Upload configuration class for managing file uploads.
 * Encapsulates multer configuration and provides instance methods for upload operations.
 * @public
 */
export class UploadConfig {
  private readonly uploadsDir: string;
  private readonly maxFileSize: number;
  private readonly allowedMimeTypes: readonly string[];
  private multerInstance: multer.Multer | null = null;

  /**
   * Create a new UploadConfig instance.
   * @param customDataDir - Optional custom data directory path (defaults to database data directory)
   * @param maxFileSize - Maximum file size in bytes (default: 5MB)
   * @public
   */
  constructor(customDataDir?: string, maxFileSize: number = 5 * 1024 * 1024) {
    this.maxFileSize = maxFileSize;
    this.allowedMimeTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/webp",
    ] as const;

    // Use the same directory as the database (data folder)
    // This ensures uploads are stored in the same location as the database
    let dataDir: string;
    if (customDataDir) {
      dataDir = customDataDir;
    } else if (process.env.DB_PATH) {
      dataDir = path.dirname(process.env.DB_PATH);
    } else {
      // Resolve path relative to the backend source folder
      // From backend/src/middleware/upload.ts, go up to backend/, then to data/
      const fileDir = getDirname();
      const fileDirNormalized = path.normalize(fileDir);

      // Check if getDirname() returned the actual file directory or current working directory
      // The file directory should contain 'middleware' or 'src/middleware'
      const isActualFileDir =
        fileDirNormalized.includes("middleware") ||
        fileDirNormalized.includes(path.join("src", "middleware"));

      let resolvedDataDir: string;
      if (isActualFileDir) {
        // We have the correct file directory, resolve relative to it
        resolvedDataDir = path.resolve(fileDir, "../../data");
      } else {
        // getDirname() likely returned current working directory
        // Try to find backend folder from current working directory
        const cwd = process.cwd();
        const backendDataInCwd = path.resolve(cwd, "backend", "data");
        const backendDataInParent = path.resolve(cwd, "..", "backend", "data");

        // Prefer backend/data in current directory, then parent, then fallback to cwd/data
        if (fs.existsSync(path.resolve(cwd, "backend"))) {
          resolvedDataDir = backendDataInCwd;
        } else if (fs.existsSync(path.resolve(cwd, "..", "backend"))) {
          resolvedDataDir = backendDataInParent;
        } else {
          // Last resort: assume we're in backend folder or project root
          resolvedDataDir = path.resolve(cwd, "data");
        }
      }

      dataDir = resolvedDataDir;
    }
    this.uploadsDir = path.join(dataDir, "uploads");

    // Ensure uploads directory exists
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
  }

  /**
   * Get the uploads directory path.
   * @returns The uploads directory path
   * @public
   */
  getUploadsDirectory(): string {
    return this.uploadsDir;
  }

  /**
   * Generate a unique filename for uploaded file.
   * @param originalName - Original filename
   * @returns Generated unique filename
   * @private
   */
  private generateFilename(originalName: string): string {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(originalName);
    const name = path.basename(originalName, ext).replace(/[^a-zA-Z0-9]/g, "-");
    return `${name}-${uniqueSuffix}${ext}`;
  }

  /**
   * Configure multer storage.
   * @returns Multer disk storage configuration
   * @private
   */
  private createStorage(): multer.StorageEngine {
    return multer.diskStorage({
      destination: (_req, _file, cb) => {
        console.log(
          `[${new Date().toISOString()}] UPLOAD | Saving file to directory: ${
            this.uploadsDir
          }`
        );
        cb(null, this.uploadsDir);
      },
      filename: (_req, file, cb) => {
        const filename = this.generateFilename(file.originalname);
        console.log(
          `[${new Date().toISOString()}] UPLOAD | Generated filename: ${filename} for original: ${
            file.originalname
          }`
        );
        cb(null, filename);
      },
    });
  }

  /**
   * File filter for image uploads.
   * @param file - Uploaded file information
   * @param cb - Callback function
   * @private
   */
  private fileFilter(
    _req: Express.Request,
    file: Express.Multer.File,
    cb: multer.FileFilterCallback
  ): void {
    console.log(
      `[${new Date().toISOString()}] UPLOAD | File upload attempt: ${
        file.originalname
      }, mimetype: ${file.mimetype}, size: ${file.size} bytes`
    );

    if (this.allowedMimeTypes.includes(file.mimetype)) {
      console.log(
        `[${new Date().toISOString()}] UPLOAD | File accepted: ${
          file.originalname
        }`
      );
      cb(null, true);
    } else {
      console.warn(
        `[${new Date().toISOString()}] UPLOAD | File rejected: ${
          file.originalname
        }, invalid mimetype: ${file.mimetype}`
      );
      cb(new Error("Only image files are allowed (JPEG, PNG, GIF, WebP)"));
    }
  }

  /**
   * Get multer instance for profile picture uploads.
   * @returns Multer instance configured for single file upload
   * @public
   */
  getMulterInstance(): multer.Multer {
    if (!this.multerInstance) {
      this.multerInstance = multer({
        storage: this.createStorage(),
        fileFilter: this.fileFilter.bind(this),
        limits: {
          fileSize: this.maxFileSize,
        },
      });
    }
    return this.multerInstance;
  }

  /**
   * Get middleware for profile picture uploads.
   * Single file upload with field name "profilePicture".
   * @returns Express middleware function
   * @public
   */
  getProfilePictureMiddleware(): ReturnType<multer.Multer["single"]> {
    return this.getMulterInstance().single("profilePicture");
  }
}

// Create singleton instance
const uploadConfig = new UploadConfig();

/**
 * Multer middleware for profile picture uploads.
 * Single file upload with field name "profilePicture".
 * Max file size: 5MB
 * @public
 */
export const uploadProfilePicture = uploadConfig.getProfilePictureMiddleware();

/**
 * Get the uploads directory path.
 * @returns The uploads directory path
 * @public
 */
export function getUploadsDirectory(): string {
  return uploadConfig.getUploadsDirectory();
}
