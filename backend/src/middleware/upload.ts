import fs from "fs";
import multer from "multer";
import path from "path";
import { PathConfig } from "../config/paths.js";

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
   * @param maxFileSize - Maximum file size in bytes (default: 5MB)
   * @public
   */
  constructor(maxFileSize: number = 5 * 1024 * 1024) {
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
    // Use the same path resolution logic as the database to ensure consistency
    let dataDir: string;
    if (process.env.DB_PATH) {
      // Resolve DB_PATH the same way as getDatabasePath does
      let resolvedDbPath: string;

      if (path.isAbsolute(process.env.DB_PATH)) {
        resolvedDbPath = process.env.DB_PATH;
      } else {
        // For relative paths, resolve relative to backend directory
        const backendRoot = PathConfig.getBackendRoot();
        resolvedDbPath = path.resolve(backendRoot, process.env.DB_PATH);
      }
      dataDir = path.dirname(resolvedDbPath);
    } else {
      // Default: backend/data (same as database default)
      const backendRoot = PathConfig.getBackendRoot();
      dataDir = path.join(backendRoot, "data");
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

// Lazy singleton instance - only created when first accessed
// This ensures environment variables are loaded before UploadConfig is instantiated
let uploadConfig: UploadConfig | null = null;

/**
 * Get the upload config singleton instance.
 * Creates the instance lazily on first access.
 * @returns The upload config instance
 * @private
 */
function getUploadConfig(): UploadConfig {
  if (!uploadConfig) {
    uploadConfig = new UploadConfig();
  }
  return uploadConfig;
}

/**
 * Multer middleware for profile picture uploads.
 * Single file upload with field name "profilePicture".
 * Max file size: 5MB
 * This is a lazy getter that creates the middleware on first access.
 * @public
 */
export const uploadProfilePicture = (() => {
  let middleware: ReturnType<multer.Multer["single"]> | null = null;
  return (
    req: Express.Request,
    res: Express.Response,
    next: Express.NextFunction
  ) => {
    if (!middleware) {
      middleware = getUploadConfig().getProfilePictureMiddleware();
    }
    return middleware(req, res, next);
  };
})();

/**
 * Get the uploads directory path.
 * @returns The uploads directory path
 * @public
 */
export function getUploadsDirectory(): string {
  return getUploadConfig().getUploadsDirectory();
}
