import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";

export const s3 = new S3Client({
  region: process.env.AWS_REGION ?? "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export const BUCKET = process.env.AWS_S3_BUCKET!;

/**
 * Generate a presigned URL for direct browser upload to S3.
 * Returns the key and the upload URL.
 */
export async function createPresignedUploadUrl(opts: {
  contentType: string;
  filename: string;
  expiresIn?: number;
}): Promise<{ key: string; uploadUrl: string; s3Url: string }> {
  const ext = opts.filename.split(".").pop() ?? "webm";
  const key = `recordings/${randomUUID()}.${ext}`;

  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: opts.contentType,
  });

  const uploadUrl = await getSignedUrl(s3, command, {
    expiresIn: opts.expiresIn ?? 3600,
  });

  const s3Url = `https://${BUCKET}.s3.amazonaws.com/${key}`;

  return { key, uploadUrl, s3Url };
}

/**
 * Generate a presigned GET URL so Mux (or the server) can read the file.
 */
export async function createPresignedReadUrl(key: string, expiresIn = 900) {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  return getSignedUrl(s3, command, { expiresIn });
}
