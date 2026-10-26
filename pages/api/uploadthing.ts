import { createRouteHandler } from 'uploadthing/next-legacy';
import { uploadRouter } from '@/lib/storage/uploadthing';

/**
 * UploadThing's endpoint — issues upload URLs and receives the completion
 * callback. Authorisation lives in each route's middleware in
 * lib/storage/uploadthing.ts, not here.
 */
export default createRouteHandler({ router: uploadRouter });
