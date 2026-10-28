import path from "path";
import fs from "fs";

/**
 * Storage Provider Helper
 */

export const ensureDirectoryExists = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

/**
 * Get the URL of the uploaded file
 * @param {Object} req - Express request
 * @param {Object} file - Multer file object
 * @returns {string} - File access path
 */
export const getFileUrl = (req, file) => {
  if (!file) return null;

  const storageType = process.env.STORAGE_TYPE || "local";

  if (storageType === "cloudinary") {
    return file.path || file.secure_url;
  }

  if (storageType === "s3") {
    return file.location;
  }

  const relativeFolder = path.basename(path.dirname(file.path));
  return `/uploads/${relativeFolder}/${file.filename}`;
};

export default {
  ensureDirectoryExists,
  getFileUrl,
};
