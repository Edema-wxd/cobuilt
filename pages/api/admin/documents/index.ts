import { createRoute, created } from '@/lib/http/route';
import { RATE_LIMITS } from '@/lib/rateLimit';
import { invalidatePrefix } from '@/lib/cache';
import { revalidatePages } from '@/lib/http/revalidate';
import { createDocumentBody } from '@/lib/schemas/documents';
import { assertProject, resolveDocumentFile } from '@/lib/storage/documentFiles';
import * as documents from '@/lib/repositories/documents';
import * as audit from '@/lib/repositories/audit';
import { AUDIT_ACTIONS } from '@/lib/repositories/audit';

/**
 * /api/admin/documents
 *   GET  — every document, drafts included, in display order, with its
 *          download total and the last 30 days
 *   POST — add a document, at the end of the list and unpublished by default
 *
 * A PDF is uploaded first, from the browser straight to UploadThing (the
 * `document` route, authorised by the same bearer token), and registered here
 * by its key; or the document is a link to a file hosted elsewhere.
 */
export default createRoute({
  GET: {
    roles: ['admin', 'editor'],
    permission: 'downloads:write',
    rateLimit: RATE_LIMITS.api,
    handler: async () => ({ results: await documents.listAll() }),
  },

  POST: {
    body: createDocumentBody,
    roles: ['admin', 'editor'],
    permission: 'downloads:write',
    rateLimit: RATE_LIMITS.api,
    handler: async ({ body, auth, ip, res }) => {
      await assertProject(body.projectId);
      const file = await resolveDocumentFile(
        body.fileKey !== undefined ? { fileKey: body.fileKey } : { fileUrl: body.fileUrl! },
      );

      const document = await documents.create({
        title: body.title,
        slug: body.slug,
        description: body.description,
        category: body.category,
        projectId: body.projectId,
        published: body.published,
        createdBy: auth!.userId,
        ...file,
      });

      await audit.record({
        actorId: auth!.userId,
        actorEmail: auth!.email,
        action: AUDIT_ACTIONS.DOCUMENT_CREATED,
        entityType: 'document',
        entityId: document.id,
        changes: {
          title: document.title,
          category: document.category,
          projectId: body.projectId,
          source: file.fileKey ? 'upload' : 'link',
          published: document.published,
        },
        ipAddress: ip,
      });

      await invalidatePrefix('documents');
      if (document.published) await revalidatePages(res, ['/resources']);

      return created(document);
    },
  },
});
