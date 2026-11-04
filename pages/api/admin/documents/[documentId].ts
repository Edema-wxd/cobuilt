import { z } from 'zod';
import { createRoute, noContent } from '@/lib/http/route';
import { RATE_LIMITS } from '@/lib/rateLimit';
import { invalidatePrefix } from '@/lib/cache';
import { conflict, notFound } from '@/lib/http/errors';
import { isPgError, PG_ERROR } from '@/lib/db';
import { logger } from '@/lib/logger';
import { revalidatePages } from '@/lib/http/revalidate';
import { updateDocumentBody } from '@/lib/schemas/documents';
import { deleteFile } from '@/lib/storage/uploadthing';
import { assertProject, resolveDocumentFile } from '@/lib/storage/documentFiles';
import * as documents from '@/lib/repositories/documents';
import * as audit from '@/lib/repositories/audit';
import { AUDIT_ACTIONS } from '@/lib/repositories/audit';

/**
 * /api/admin/documents/[documentId]
 *   GET    — one document, drafts included
 *   PATCH  — update; a new `fileKey` or `fileUrl` replaces the file, and an
 *            uploaded file it replaces is deleted from storage
 *   DELETE — admin only; also deletes its uploaded file
 *
 * Unpublishing is the everyday way to withdraw a document: it keeps the file
 * and its download count. Deleting is final.
 */

const params = z.object({ documentId: z.string().uuid() });

/**
 * Deletes a stored upload the document no longer points at. The row has
 * already changed, so a failure leaves an orphaned file to clean up — logged,
 * not a request failure. Tours take the same position.
 */
async function deleteStored(key: string, reason: string): Promise<void> {
  await deleteFile(key).catch((error: Error) => {
    logger.error(`Failed to delete ${reason} document file from storage`, { key, error: error.message });
  });
}

export default createRoute({
  GET: {
    query: params,
    roles: ['admin', 'editor'],
    permission: 'downloads:write',
    rateLimit: RATE_LIMITS.api,
    handler: async ({ query }) => {
      const document = await documents.findById(query.documentId);
      if (!document) throw notFound('Document not found');
      return document;
    },
  },

  PATCH: {
    query: params,
    body: updateDocumentBody,
    roles: ['admin', 'editor'],
    permission: 'downloads:write',
    rateLimit: RATE_LIMITS.api,
    handler: async ({ query, body, auth, ip, res }) => {
      const existing = await documents.findById(query.documentId);
      if (!existing) throw notFound('Document not found');

      await assertProject(body.projectId);

      const { fileKey, fileUrl, ...fields } = body;
      const replacing =
        (fileKey !== undefined && fileKey !== existing.fileKey) ||
        (fileUrl !== undefined && fileUrl !== existing.fileUrl);
      const file = replacing
        ? await resolveDocumentFile(fileKey !== undefined ? { fileKey } : { fileUrl: fileUrl! })
        : {};

      let updated;
      try {
        updated = await documents.update(existing.id, { ...fields, ...file });
      } catch (error) {
        if (isPgError(error, PG_ERROR.UNIQUE_VIOLATION)) {
          throw conflict('Another document already has that web address');
        }
        throw error;
      }
      // Null here means the row was deleted between the read and the write.
      if (!updated) throw notFound('Document not found');

      const replacedKey = replacing && existing.fileKey ? existing.fileKey : null;
      if (replacedKey) await deleteStored(replacedKey, 'replaced');

      await audit.record({
        actorId: auth!.userId,
        actorEmail: auth!.email,
        action: AUDIT_ACTIONS.DOCUMENT_UPDATED,
        entityType: 'document',
        entityId: existing.id,
        changes: {
          fields: Object.keys(body),
          // Publication and the file are what change the public site, so the
          // trail says which way they went.
          ...(body.published !== undefined && body.published !== existing.published
            ? { published: body.published }
            : {}),
          ...(replacing ? { fileReplaced: true, source: updated.fileKey ? 'upload' : 'link' } : {}),
        },
        ipAddress: ip,
      });

      await invalidatePrefix('documents');
      if (existing.published || updated.published) await revalidatePages(res, ['/resources']);

      return updated;
    },
  },

  DELETE: {
    query: params,
    roles: ['admin'],
    permission: 'downloads:write',
    rateLimit: RATE_LIMITS.api,
    handler: async ({ query, auth, ip, res }) => {
      const removed = await documents.remove(query.documentId);
      if (!removed) throw notFound('Document not found');

      if (removed.fileKey) await deleteStored(removed.fileKey, 'deleted');

      await audit.record({
        actorId: auth!.userId,
        actorEmail: auth!.email,
        action: AUDIT_ACTIONS.DOCUMENT_DELETED,
        entityType: 'document',
        entityId: removed.id,
        changes: { title: removed.title, projectId: removed.projectId, fileKey: removed.fileKey },
        ipAddress: ip,
      });

      await invalidatePrefix('documents');
      await revalidatePages(res, ['/resources']);

      return noContent();
    },
  },
});
