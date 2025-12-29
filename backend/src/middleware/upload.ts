import fs from "fs";
import multer from "multer";
import path from "path";
import { v2 as cloudinary } from "cloudinary";
import { PathConfig } from "../config/paths.js";
import { Request, Response, NextFunction } from "express";

/**
 * Storage type enum.
 * @private
 */
enum StorageType {
  LOCAL = "local",
  CLOUDINARY = "cloudinary",
}

/**
 * Get storage type based on environment variables.
 * Checks for Cloudinary credentials, falls back to local storage.
 * @returns Storage type
 * @private
 */
function getStorageType(): StorageType {
  if (
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  ) {
    return StorageType.CLOUDINARY;
  }
  return StorageType.LOCAL;
}

/**
 * Upload configuration class for managing file uploads.
 * Supports both local filesystem (development) and Cloudinary (production).
 * Encapsulates multer configuration and provides instance methods for upload operations.
 * @public
 */
export class UploadConfig {
  private readonly uploadsDir: string;
  private readonly maxFileSize: number;
  private readonly allowedMimeTypes: readonly string[];
  private readonly storageType: StorageType;
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
    this.storageType = getStorageType();

    // Initialize Cloudinary if using Cloudinary storage
    if (this.storageType === StorageType.CLOUDINARY) {
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
        api_key: process.env.CLOUDINARY_API_KEY!,
        api_secret: process.env.CLOUDINARY_API_SECRET!,
      });
    }

    // Use the same directory as the database (data folder) for local storage
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

    // Ensure uploads directory exists (only for local storage)
    if (this.storageType === StorageType.LOCAL) {
      if (!fs.existsSync(this.uploadsDir)) {
        fs.mkdirSync(this.uploadsDir, { recursive: true });
      }
    }
  }

  /**
   * Get the uploads directory path (for local storage only).
   * @returns The uploads directory path
   * @public
   */
  getUploadsDirectory(): string {
    return this.uploadsDir;
  }

  /**
   * Get storage type.
   * @returns Storage type (local or cloudinary)
   * @public
   */
  getStorageType(): StorageType {
    return this.storageType;
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
   * @returns Multer disk storage configuration (for local storage)
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
    _req: Request,
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
   * Get multer instance for profile picture uploads (local storage).
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
   * Get middleware for profile picture uploads (local storage).
   * Single file upload with field name "profilePicture".
   * @returns Express middleware function
   * @public
   */
  getProfilePictureMiddleware(): ReturnType<multer.Multer["single"]> {
    return this.getMulterInstance().single("profilePicture");
  }

  /**
   * Upload file to Cloudinary.
   * @param fileBuffer - File buffer
   * @param originalName - Original filename
   * @param mimetype - File MIME type
   * @returns Promise resolving to Cloudinary upload result with secure URL
   * @public
   */
  async uploadToCloudinary(
    fileBuffer: Buffer,
    originalName: string,
    mimetype: string
  ): Promise<{ url: string; publicId: string }> {
    if (this.storageType !== StorageType.CLOUDINARY) {
      throw new Error("Cloudinary is not configured");
    }

    return new Promise((resolve, reject) => {
      const uploadOptions = {
        folder: "habitus/profile-pictures",
        resource_type: "image" as const,
        allowed_formats: ["jpg", "jpeg", "png", "gif", "webp"],
      };

      const uploadStream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (error: Error | undefined, result: any) => {
          if (error) {
            console.error(
              `[${new Date().toISOString()}] UPLOAD | Cloudinary upload failed:`,
              error
            );
            reject(error);
            return;
          }

          if (!result || !result.secure_url) {
            reject(new Error("Cloudinary upload failed: No URL returned"));
            return;
          }

          console.log(
            `[${new Date().toISOString()}] UPLOAD | File uploaded to Cloudinary: ${
              result.secure_url
            }`
          );

          resolve({
            url: result.secure_url,
            publicId: result.public_id,
          });
        }
      );

      uploadStream.end(fileBuffer);
    });
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
 * Supports both local storage (development) and Cloudinary (production).
 * Single file upload with field name "profilePicture".
 * Max file size: 5MB
 * This is a lazy getter that creates the middleware on first access.
 * @public
 */
export const uploadProfilePicture = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const config = getUploadConfig();
  const storageType = config.getStorageType();

  if (storageType === StorageType.CLOUDINARY) {
    // Use Cloudinary upload
    const multerMemory = multer({
      storage: multer.memoryStorage(),
      fileFilter: (req, file, cb) => {
        const allowedMimeTypes = [
          "image/jpeg",
          "image/jpg",
          "image/png",
          "image/gif",
          "image/webp",
        ] as const;

        if (allowedMimeTypes.includes(file.mimetype as any)) {
          cb(null, true);
        } else {
          cb(new Error("Only image files are allowed (JPEG, PNG, GIF, WebP)"));
        }
      },
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
      },
    });

    multerMemory.single("profilePicture")(req, res, async (err) => {
      if (err) {
        return next(err);
      }

      const file = req.file;
      if (!file) {
        return next();
      }

      try {
        // Upload to Cloudinary
        const result = await config.uploadToCloudinary(
          file.buffer,
          file.originalname,
          file.mimetype
        );

        // Create a mock file object with Cloudinary URL
        // This maintains compatibility with existing code that expects req.file
        (req.file as any).filename = result.url;
        (req.file as any).cloudinaryUrl = result.url;
        (req.file as any).cloudinaryPublicId = result.publicId;

        next();
      } catch (error) {
        console.error(
          `[${new Date().toISOString()}] UPLOAD | Error uploading to Cloudinary:`,
          error
        );
        next(error);
      }
    });
  } else {
    // Use local storage (development)
    const middleware = config.getProfilePictureMiddleware();
    middleware(req, res, next);
  }
};

/**
 * Get the uploads directory path.
 * @returns The uploads directory path (for local storage only)
 * @public
 */
export function getUploadsDirectory(): string {
  return getUploadConfig().getUploadsDirectory();
}

/**
 * Check if Cloudinary is being used for storage.
 * @returns True if Cloudinary is configured, false otherwise
 * @public
 */
export function isCloudinaryStorage(): boolean {
  return getUploadConfig().getStorageType() === StorageType.CLOUDINARY;
}
