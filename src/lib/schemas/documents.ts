import { z } from 'zod';
import { slug, uuid } from './common';
import { DOCUMENT_CATEGORIES, DOCUMENT_CATEGORY_LABELS, type DocumentCategory } from '../documentCategories';

/**
 * Download centre requests (`/api/documents`, `/api/admin/documents`).
 *
 * A document's file is either an upload (`fileKey`, from the UploadThing
 * `document` route) or a link (`fileUrl`). Exactly one is given on create; an
 * update may swap one for the other, and the stored upload is then deleted.
 */

export { DOCUMENT_CATEGORIES, DOCUMENT_CATEGORY_LABELS, type DocumentCategory };

/**
 * A link to a file hosted elsewhere. https only: it is linked from an https
 * page, and the database refuses anything else (documents_file_url_https).
 */
export const documentUrl = z
  .string()
  .trim()
  .url('Must be a full link, starting https://')
  .max(512)
  .refine((value) => value.startsWith('https://'), 'Must be an https link');

/** An UploadThing file key, as the upload returns it. */
const fileKey = z.string().trim().min(1).max(512);

/*
 * No `.default()` here: under `.partial()` a default would fill in a field the
 * caller left out, and an update would then overwrite it. Create applies its
 * defaults below.
 */
const documentBase = {
  title: z.string().trim().min(2).max(255),
  slug: slug.optional(),
  description: z.string().trim().max(600).nullable(),
  category: z.enum(DOCUMENT_CATEGORIES),
  fileKey,
  fileUrl: documentUrl,
  projectId: uuid.nullable(),
  published: z.boolean(),
};

const oneFile = (body: { fileKey?: string; fileUrl?: string }) =>
  !(body.fileKey !== undefined && body.fileUrl !== undefined);

export const createDocumentBody = z
  .object({
    ...documentBase,
    fileKey: documentBase.fileKey.optional(),
    fileUrl: documentBase.fileUrl.optional(),
    description: documentBase.description.default(null),
    projectId: documentBase.projectId.default(null),
    // A new document is a draft until someone publishes it.
    published: documentBase.published.default(false),
  })
  .strict()
  .refine(oneFile, { path: ['fileUrl'], message: 'Upload a file or give a link, not both' })
  .refine((body) => body.fileKey !== undefined || body.fileUrl !== undefined, {
    path: ['fileUrl'],
    message: 'Upload a file or give a link to one',
  });
export type CreateDocumentBody = z.infer<typeof createDocumentBody>;

export const updateDocumentBody = z
  .object(documentBase)
  .partial()
  .strict()
  .refine((body) => Object.keys(body).length > 0, 'At least one field must be provided')
  .refine(oneFile, { path: ['fileUrl'], message: 'Upload a file or give a link, not both' });
export type UpdateDocumentBody = z.infer<typeof updateDocumentBody>;

/** The whole list, in its new order. A partial list is refused rather than guessed at. */
export const reorderDocumentsBody = z
  .object({ ids: z.array(uuid).min(1).max(500) })
  .strict()
  .refine((body) => new Set(body.ids).size === body.ids.length, {
    path: ['ids'],
    message: 'Each document may appear only once',
  });
export type ReorderDocumentsBody = z.infer<typeof reorderDocumentsBody>;

/** `GET /api/documents`. `project` is a project's id or its slug. */
export const listDocumentsQuery = z.object({
  category: z.enum(DOCUMENT_CATEGORIES).optional(),
  project: z.string().trim().min(1).max(255).optional(),
});
export type ListDocumentsQuery = z.infer<typeof listDocumentsQuery>;

/**
 * The file type a link names, read from the extension of its path: `pdf` for
 * `…/profile.pdf?v=2`. Null when the path has no recognisable extension.
 */
export function fileTypeFromUrl(url: string): string | null {
  try {
    const last = new URL(url).pathname.split('/').pop() ?? '';
    const match = /\.([a-z0-9]{2,5})$/i.exec(last);
    return match ? match[1]!.toLowerCase() : null;
  } catch {
    return null;
  }
}
