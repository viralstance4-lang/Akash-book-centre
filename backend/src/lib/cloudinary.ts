import { v2 as cloudinary } from "cloudinary";

import env from "../config/env";

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
});

type MulterFileLike = {
  buffer: Buffer;
};

export const uploadImage = async (file: MulterFileLike, folder = "books") => {
  const result = await new Promise<{
    secure_url: string;
    public_id: string;
  }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `bookstore/${folder}`,
      },
      (error: any, uploadResult: any) => {
        if (error) {
          reject(error);
          return;
        }

        if (!uploadResult) {
          reject(new Error("Cloudinary upload failed"));
          return;
        }

        resolve(uploadResult);
      },
    );

    stream.end(file.buffer);
  });

  return {
    url: result.secure_url,
    publicId: result.public_id,
  };
};

export const deleteImage = async (publicId: string) => {
  // Seeded demo books use Open Library covers and are not Cloudinary assets.
  if (!publicId || publicId.startsWith("openlibrary_")) {
    return;
  }

  await cloudinary.uploader.destroy(publicId);
};

export default cloudinary;
