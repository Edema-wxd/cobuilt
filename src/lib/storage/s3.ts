import {
  S3Client,
  DeleteObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'node:crypto';
import { env } from '../env';
import { logger } from '../logger';
import { badRequest } from '../http/errors';

/**
 * Object storage for 3D tour assets and documents (§7).
 *
 * Uploads are presigned rather than proxied: a 50 MB .glb through a Next.js
 * API route would occupy a worker for the whole transfer and hit the 4 MB
 * default body limit. The browser PUTs straight to storage and then calls back
 * to register the tour.
 */

declare global {
  var __cobuiltS3: S3Client | undefined;
}

export function s3(): S3Client {
  globalThis.__cobuiltS3 ??= new S3Client({
    region: env.S3_REGION,
    // Set for DigitalOcean Spaces or a Nigerian S3-compatible store.
    endpoint: env.S3_ENDPOINT,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
    credentials:
      env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY
        ? {
            accessKeyId: env.AWS_ACCESS_KEY_ID,
            secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
          }
        : undefined,
  });

  return globalThis.__cobuiltS3;
}

/** Content types accepted for tour models, and the extension each maps to. */
const TOUR_CONTENT_TYPES: Record<string, string> = {
  'model/gltf-binary': 'glb',
  'model/gltf+json': 'gltf',
  'application/octet-stream': 'glb',
  'application/zip': 'zip',
};

export interface PresignedUpload {
  uploadUrl: string;
  key: string;
  publicUrl: string;
  expiresInSeconds: number;
  maxBytes: number;
}

export async function presignTourUpload(input: {
  projectId: string;
  contentType: string;
  contentLength: number;
}): Promise<PresignedUpload> {
  const extension = TOUR_CONTENT_TYPES[input.contentType];
  if (!extension) {
    throw badRequest(
      `Unsupported content type. Allowed: ${Object.keys(TOUR_CONTENT_TYPES).join(', ')}`,
    );
  }

  if (input.contentLength > env.MAX_TOUR_UPLOAD_BYTES) {
    throw badRequest(
      `File exceeds the ${Math.round(env.MAX_TOUR_UPLOAD_BYTES / 1024 / 1024)} MB limit`,
    );
  }

  const key = `tours/${input.projectId}/${randomUUID()}.${extension}`;
  const expiresInSeconds = 900; // 15 minutes: long enough for a slow upload

  // ContentLength is signed into the URL, so the client cannot present a small
  // declared size and then upload an arbitrarily large object.
  const command = new PutObjectCommand({
    Bucket: env.S3_BUCKET,
    Key: key,
    ContentType: input.contentType,
    ContentLength: input.contentLength,
    ServerSideEncryption: 'AES256',
  });

  const uploadUrl = await getSignedUrl(s3(), command, { expiresIn: expiresInSeconds });

  return {
    uploadUrl,
    key,
    publicUrl: publicUrlFor(key),
    expiresInSeconds,
    maxBytes: env.MAX_TOUR_UPLOAD_BYTES,
  };
}

/**
 * Confirms an object exists and reports its size. Called before a tour row is
 * created, so a presigned URL that was never used cannot leave a tour record
 * pointing at nothing.
 */
export async function headObject(
  key: string,
): Promise<{ exists: boolean; sizeBytes: number; contentType: string | null }> {
  try {
    const result = await s3().send(
      new HeadObjectCommand({ Bucket: env.S3_BUCKET, Key: key }),
    );
    return {
      exists: true,
      sizeBytes: result.ContentLength ?? 0,
      contentType: result.ContentType ?? null,
    };
  } catch (error) {
    logger.debug('Head object failed', {
      key,
      error: error instanceof Error ? error.message : String(error),
    });
    return { exists: false, sizeBytes: 0, contentType: null };
  }
}

export async function deleteObject(key: string): Promise<void> {
  await s3().send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
}

/** Serves assets through the CDN when one is configured, else direct. */
export function publicUrlFor(key: string): string {
  if (env.S3_PUBLIC_BASE_URL) {
    return `${env.S3_PUBLIC_BASE_URL.replace(/\/$/, '')}/${key}`;
  }
  if (env.S3_ENDPOINT) {
    return `${env.S3_ENDPOINT.replace(/\/$/, '')}/${env.S3_BUCKET}/${key}`;
  }
  return `https://${env.S3_BUCKET}.s3.${env.S3_REGION}.amazonaws.com/${key}`;
}

export function isStorageConfigured(): boolean {
  return Boolean(env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY);
}
