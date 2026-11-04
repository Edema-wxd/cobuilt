import { badRequest, serviceUnavailable, validationFailed } from '../http/errors';
import { fileTypeFromUrl } from '../schemas/documents';
import type { DocumentFile } from '../repositories/documents';
import * as projects from '../repositories/projects';
import { isStorageConfigured, lookupFile } from './uploadthing';

/**
 * What the document routes store for a file, from what the console sent: the
 * key of a finished upload, or a link.
 *
 * An upload is accepted only once the file is confirmed present in storage —
 * the same rule as a tour model (docs/decisions.md §2.2) — so a document can
 * never point at an upload that did not finish. Its size comes from storage,
 * not from the browser. A link is stored as given; its type is read from the
 * extension, and its size is left unknown rather than guessed.
 */
export async function resolveDocumentFile(input: { fileKey: string } | { fileUrl: string }): Promise<DocumentFile> {
  if ('fileUrl' in input) {
    return { fileUrl: input.fileUrl, fileKey: null, fileType: fileTypeFromUrl(input.fileUrl), fileSizeBytes: null };
  }

  if (!isStorageConfigured()) throw serviceUnavailable('Object storage is not configured');

  const file = await lookupFile(input.fileKey);
  if (!file.exists || !file.url) {
    throw badRequest('No uploaded file found for that key; complete the upload first');
  }
  if (!file.url.startsWith('https://')) {
    throw badRequest('The storage service returned a link that is not https');
  }

  // The `document` upload route accepts PDFs only.
  return { fileUrl: file.url, fileKey: input.fileKey, fileType: 'pdf', fileSizeBytes: file.sizeBytes };
}

/** A 422 on `projectId` unless it names a project that exists and is not deleted. */
export async function assertProject(projectId: string | null | undefined): Promise<void> {
  if (!projectId) return;
  if (!(await projects.exists(projectId))) {
    throw validationFailed([{ field: 'projectId', message: 'No such project' }], 'Invalid request body');
  }
}
