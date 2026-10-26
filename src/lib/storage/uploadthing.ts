import { UTApi, UploadThingError } from 'uploadthing/server';
import { createUploadthing, type FileRouter } from 'uploadthing/next-legacy';
import { env } from '../env';
import { logger } from '../logger';
import { bearerToken } from '../auth/jwt';
import { authenticateBearer } from '../auth/session';

/* UploadThingError is how middleware reports a rejection to the client. */
/* eslint-disable @typescript-eslint/only-throw-error */

/**
 * Object storage for 3D tour assets (§7), provided by UploadThing.
 *
 * Uploads still go straight from the browser to storage rather than through an
 * API route: a 50 MB .glb would hold a worker for the whole transfer and hit
 * the default body limit (docs/decisions.md §2.2). The file router below is
 * the authorisation point: UploadThing only issues upload URLs for a request
 * its middleware lets through, then the browser registers the returned key
 * with POST /api/admin/tours.
 */

declare global {
  var __cobuiltUtApi: UTApi | undefined;
}

export function utapi(): UTApi {
  // UTApi reads UPLOADTHING_TOKEN from the environment itself.
  globalThis.__cobuiltUtApi ??= new UTApi();
  return globalThis.__cobuiltUtApi;
}

export function isStorageConfigured(): boolean {
  return Boolean(env.UPLOADTHING_TOKEN);
}

/** File extensions accepted for tour models. */
const MODEL_EXTENSIONS = ['glb', 'gltf', 'zip'];

const f = createUploadthing();

export const uploadRouter = {
  tourModel: f(
    // Individual files are capped by the middleware against MAX_TOUR_UPLOAD_BYTES;
    // this is the ceiling UploadThing itself enforces.
    { blob: { maxFileSize: '64MB', maxFileCount: 1 } },
  )
    .middleware(async ({ req, files }) => {
      const token = bearerToken(req.headers.authorization);
      if (!token) throw new UploadThingError('Sign in to upload.');

      let auth;
      try {
        auth = await authenticateBearer(token);
      } catch {
        throw new UploadThingError('Your session has expired. Sign in again.');
      }

      const allowed =
        (auth.role === 'admin' || auth.role === 'editor') && auth.permissions.has('tours:write');
      if (!allowed) throw new UploadThingError('Your role does not allow this.');

      for (const file of files) {
        const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
        if (!MODEL_EXTENSIONS.includes(extension)) {
          throw new UploadThingError('The model must be a .glb, .gltf or .zip file.');
        }
        if (file.size > env.MAX_TOUR_UPLOAD_BYTES) {
          throw new UploadThingError(
            `File exceeds the ${Math.round(env.MAX_TOUR_UPLOAD_BYTES / 1024 / 1024)} MB limit.`,
          );
        }
      }

      return { userId: auth.userId };
    })
    .onUploadComplete(({ metadata, file }) => {
      logger.info('Tour model uploaded', { userId: metadata.userId, key: file.key });
    }),
} satisfies FileRouter;

export type UploadRouter = typeof uploadRouter;

/**
 * Confirms an uploaded file exists and reports its size and public URL. Called
 * before a tour row is created, so an upload that never completed cannot leave
 * a tour record pointing at nothing.
 */
export async function lookupFile(
  key: string,
): Promise<{ exists: boolean; sizeBytes: number; url: string | null }> {
  try {
    const { data } = await utapi().getFileUrls(key);
    const url = data[0]?.url ?? null;
    if (!url) return { exists: false, sizeBytes: 0, url: null };

    const head = await fetch(url, { method: 'HEAD' });
    if (!head.ok) return { exists: false, sizeBytes: 0, url: null };

    return {
      exists: true,
      sizeBytes: Number(head.headers.get('content-length') ?? 0),
      url,
    };
  } catch (error) {
    logger.debug('File lookup failed', {
      key,
      error: error instanceof Error ? error.message : String(error),
    });
    return { exists: false, sizeBytes: 0, url: null };
  }
}

export async function deleteFile(key: string): Promise<void> {
  await utapi().deleteFiles(key);
}
