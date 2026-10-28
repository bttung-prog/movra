import multer from "multer";
import path from "path";
import { open, unlink } from "fs/promises";
import { fileURLToPath } from "url";

import { UPLOAD_MESSAGES } from "../constants/messages.js";

import { ensureDirectoryExists } from "../utils/storage.util.js";
import ApiError from "../utils/ApiError.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const POD_UPLOAD_DIR = path.resolve(__dirname, "../../uploads/pod");
ensureDirectoryExists(POD_UPLOAD_DIR);

const extensionByMimeType = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

const removeUpload = async (filePath) => {
  try {
    await unlink(filePath);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
};

const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    ensureDirectoryExists(POD_UPLOAD_DIR);
    cb(null, POD_UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const ext = Object.hasOwn(extensionByMimeType, file.mimetype)
      ? extensionByMimeType[file.mimetype]
      : "";
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `pod-${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  if (Object.hasOwn(extensionByMimeType, file.mimetype)) {
    cb(null, true);
  } else {
    cb(new ApiError(400, UPLOAD_MESSAGES.INVALID_IMAGE_TYPE), false);
  }
};

export const uploadPod = multer({
  storage: diskStorage,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter,
});

const isValidImageSignature = (mimeType, header) => {
  if (mimeType === "image/jpeg" || mimeType === "image/jpg") {
    return header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
  }

  if (mimeType === "image/png") {
    return header
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }

  if (mimeType === "image/webp") {
    return (
      header.toString("ascii", 0, 4) === "RIFF" &&
      header.toString("ascii", 8, 12) === "WEBP"
    );
  }

  return false;
};

export const validatePodImage = async (req, res, next) => {
  if (!req.file) return next();

  let fileHandle;
  try {
    fileHandle = await open(req.file.path, "r");
    const header = Buffer.alloc(12);
    const { bytesRead } = await fileHandle.read(header, 0, header.length, 0);
    await fileHandle.close();
    fileHandle = null;

    if (
      bytesRead < header.length ||
      !isValidImageSignature(req.file.mimetype, header)
    ) {
      await removeUpload(req.file.path);
      req.file = undefined;
      return next(new ApiError(400, UPLOAD_MESSAGES.INVALID_IMAGE_CONTENT));
    }

    return next();
  } catch (error) {
    let cleanupError;
    try {
      if (fileHandle) await fileHandle.close();
      await removeUpload(req.file.path);
    } catch (failure) {
      cleanupError = failure;
    }
    return next(cleanupError || error);
  }
};

export default {
  uploadPod,
  validatePodImage,
};
