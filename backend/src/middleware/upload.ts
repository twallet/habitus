import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

/**
 * Get __dirname in ES modules.
 * @returns The directory path
 * @private
 */
function getDirname(): string {
  try {
    const importMeta = new Function(
      'return typeof import !== "undefined" ? import.meta : null'
    )();
    if (importMeta && importMeta.url) {
      const __filename = fileURLToPath(importMeta.url);
      return path.dirname(__filename);
    }
  } catch {
    // Fallback
  }
  return path.resolve();
}

/**
 * Get uploads directory path.
 * @returns The uploads directory path
 * @private
 */
function getUploadsDir(): string {
  const __dirname = getDirname();
  const uploadsDir = path.join(__dirname, "../../uploads");

  // Ensure uploads directory exists
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  return uploadsDir;
}

/**
 * Configure multer storage.
 * Stores files in uploads directory with original filename and timestamp.
 */
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const uploadsDir = getUploadsDir();
    console.log(
      `[${new Date().toISOString()}] UPLOAD | Saving file to directory: ${uploadsDir}`
    );
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    const name = path
      .basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9]/g, "-");
    const filename = `${name}-${uniqueSuffix}${ext}`;
    console.log(
      `[${new Date().toISOString()}] UPLOAD | Generated filename: ${filename} for original: ${
        file.originalname
      }`
    );
    cb(null, filename);
  },
});

/**
 * File filter for image uploads.
 * Only allows image files.
 */
const fileFilter = (
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowedMimes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
  ];

  console.log(
    `[${new Date().toISOString()}] UPLOAD | File upload attempt: ${
      file.originalname
    }, mimetype: ${file.mimetype}, size: ${file.size} bytes`
  );

  if (allowedMimes.includes(file.mimetype)) {
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
};

/**
 * Multer middleware for profile picture uploads.
 * Single file upload with field name "profilePicture".
 * Max file size: 5MB
 */
export const uploadProfilePicture = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
}).single("profilePicture");

/**
 * Get the uploads directory path.
 * @returns The uploads directory path
 * @public
 */
export function getUploadsDirectory(): string {
  return getUploadsDir();
}
