import { UploadThingError } from 'uploadthing/server';
import { uploadRouter } from '@/lib/storage/uploadthing';
import { GALLERY_UPLOAD } from '@/lib/gallery';
import { bearerFor } from '../setup/helpers';
import type { Role } from '@/lib/auth/rbac';

/**
 * The `galleryImage` UploadThing route's middleware is the authorisation
 * point for gallery uploads: UploadThing issues no upload URL for a request it
 * rejects. These drive the middleware directly, as UploadThing's handler
 * would, with a request carrying (or not) the console's bearer token.
 */

type Middleware = (opts: {
  req: { headers: Record<string, string | undefined> };
  res: unknown;
  files: Array<{ name: string; size: number; type: string }>;
  input: undefined;
}) => Promise<{ userId: string }>;

const galleryMiddleware = uploadRouter.galleryImage.middleware as unknown as Middleware;
const tourMiddleware = uploadRouter.tourModel.middleware as unknown as Middleware;

const photo = { name: 'site-visit.jpg', size: 4 * 1024 * 1024, type: 'image/jpeg' };

function call(middleware: Middleware, as: Role | null, files = [photo]) {
  return middleware({
    req: { headers: as ? { authorization: `Bearer ${bearerFor({ role: as })}` } : {} },
    res: {},
    files,
    input: undefined,
  });
}

describe('galleryImage upload route', () => {
  it('accepts JPEG, PNG and WebP only, at 16 MB and 20 files', () => {
    expect(Object.keys(uploadRouter.galleryImage.routerConfig).sort()).toEqual([
      'image/jpeg',
      'image/png',
      'image/webp',
    ]);
    for (const config of Object.values(uploadRouter.galleryImage.routerConfig)) {
      expect(config).toEqual({ maxFileSize: '16MB', maxFileCount: GALLERY_UPLOAD.maxFileCount });
    }
  });

  it('refuses an anonymous request', async () => {
    await expect(call(galleryMiddleware, null)).rejects.toThrow('Sign in to upload.');
  });

  it('refuses an invalid token', async () => {
    await expect(
      galleryMiddleware({ req: { headers: { authorization: 'Bearer forged' } }, res: {}, files: [photo], input: undefined }),
    ).rejects.toThrow('Your session has expired');
  });

  it.each(['viewer', 'investor'] as const)('refuses a %s, who lacks gallery:write', async (role) => {
    await expect(call(galleryMiddleware, role)).rejects.toThrow('Your role does not allow this.');
  });

  it.each(['admin', 'editor'] as const)('lets an %s upload', async (role) => {
    await expect(call(galleryMiddleware, role)).resolves.toEqual({
      userId: '00000000-0000-4000-8000-000000000001',
    });
  });

  it('rejects a file that is not a JPEG, PNG or WebP, whatever its name says', async () => {
    const error = await call(galleryMiddleware, 'editor', [{ name: 'plan.gif', size: 1000, type: 'image/gif' }]).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(UploadThingError);
    await expect(
      call(galleryMiddleware, 'editor', [{ name: 'photo.jpg', size: 1000, type: 'image/svg+xml' }]),
    ).rejects.toThrow('is not a JPEG, PNG or WebP image');
    await expect(
      call(galleryMiddleware, 'editor', [{ name: 'photo.heic', size: 1000, type: 'image/jpeg' }]),
    ).rejects.toThrow('is not a JPEG, PNG or WebP image');
  });

  it('rejects a file over the size limit, and a batch over the count', async () => {
    await expect(
      call(galleryMiddleware, 'editor', [{ ...photo, size: GALLERY_UPLOAD.maxFileBytes + 1 }]),
    ).rejects.toThrow('exceeds the 16 MB limit');
    await expect(
      call(galleryMiddleware, 'editor', Array.from({ length: GALLERY_UPLOAD.maxFileCount + 1 }, () => photo)),
    ).rejects.toThrow('Upload at most 20 images at a time.');
  });

  it('leaves the tour model route gated by tours:write, as before', async () => {
    const model = [{ name: 'tower.glb', size: 1024, type: 'model/gltf-binary' }];
    await expect(call(tourMiddleware, 'viewer', model)).rejects.toThrow('Your role does not allow this.');
    await expect(call(tourMiddleware, 'editor', model)).resolves.toEqual({
      userId: '00000000-0000-4000-8000-000000000001',
    });
    // A photograph is not a model, so the gallery route is the only way in for one.
    await expect(call(tourMiddleware, 'editor', [photo])).rejects.toThrow('.glb, .gltf or .zip');
  });
});
