// utils/cloudinary.js
import { v2 as cloudinary } from "cloudinary";

import AppError from "./appError.js";

const cloud_name = process.env.CLOUDINARY_CLOUD_NAME;
const api_key = process.env.CLOUDINARY_API_KEY;
const api_secret = process.env.CLOUDINARY_API_SECRET;

const isConfigValid =
  cloud_name &&
  api_key &&
  api_secret &&
  cloud_name !== "xxxx" &&
  api_key !== "xxxx" &&
  api_secret !== "xxxx";

if (isConfigValid) {
  cloudinary.config({
    cloud_name,
    api_key,
    api_secret,
  });
} else {
  // Missing infrastructure must never create pretend production image records.
  cloudinary.uploader.upload_stream = () => { throw new AppError("Image uploads are unavailable. Configure Cloudinary before uploading.", 503); };
  cloudinary.uploader.destroy = async () => { throw new AppError("Image storage is unavailable.", 503); };
}

export default cloudinary;
