import crypto from "crypto";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

import env from "../config/env";

const s3 = new S3Client({
  region: env.AWS_REGION,
  credentials: env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY
    ? { accessKeyId: env.AWS_ACCESS_KEY_ID, secretAccessKey: env.AWS_SECRET_ACCESS_KEY }
    : undefined,
});

type MulterFileLike = {
  buffer:       Buffer;
  originalname: string;
  mimetype?:    string;
};

/**
 * Uploads a print-order PDF to S3 and returns the same shape cloudinary.ts's
 * uploadImage() returns, so call sites can treat the two providers uniformly.
 * The bucket is fully private (Block Public Access on) — `url` here is not a
 * client-reachable link, only an internal S3 key used later by getFile().
 */
export const uploadFile = async (file: MulterFileLike, folder = "print-orders") => {
  const ext = (file.originalname.split(".").pop() || "pdf").toLowerCase();
  const key = `${folder}/${crypto.randomUUID()}.${ext}`;

  await s3.send(new PutObjectCommand({
    Bucket:      env.AWS_S3_BUCKET,
    Key:         key,
    Body:        file.buffer,
    ContentType: file.mimetype || "application/pdf",
  }));

  return {
    url:      key, // S3 key, not a public URL — bucket is private
    publicId: key, // mirrors Cloudinary's { url, publicId } shape; same value here since S3 has no separate id
  };
};

/** Streams an object's bytes back for the authenticated pdf.controller.ts proxy. */
export const getFile = async (key: string): Promise<Buffer> => {
  const result = await s3.send(new GetObjectCommand({
    Bucket: env.AWS_S3_BUCKET,
    Key:    key,
  }));
  const chunks: Buffer[] = [];
  // @ts-expect-error — Body is a Node Readable stream at runtime in this SDK's Node build
  for await (const chunk of result.Body) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
};

export const deleteFile = async (key: string): Promise<void> => {
  if (!key) return;
  try {
    await s3.send(new DeleteObjectCommand({ Bucket: env.AWS_S3_BUCKET, Key: key }));
  } catch {
    // Best-effort cleanup — mirrors cloudinary.ts's deleteImage swallow-on-failure behavior.
  }
};
