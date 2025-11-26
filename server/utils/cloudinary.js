// utils/cloudinary.js
import { v2 as cloudinary } from "cloudinary";

import { PassThrough } from "stream";

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
  console.warn(
    "⚠️ Cloudinary credentials missing or invalid. Using mock uploader."
  );
  // Mock uploader
  cloudinary.uploader = {
    upload_stream: (options, callback) => {
      const stream = new PassThrough();
      // Simulate async upload completion
      setTimeout(() => {
        const mockUrl = `https://placehold.co/600x400?text=Mock+Image+${Date.now()}`;
        callback(null, { secure_url: mockUrl });
      }, 100);
      return stream;
    },
    destroy: (public_id, callback) => {
      if (callback) callback(null, { result: "ok" });
      return Promise.resolve({ result: "ok" });
    },
  };
}

export default cloudinary;
