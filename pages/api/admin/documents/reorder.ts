import { createRoute } from '@/lib/http/route';
import { RATE_LIMITS } from '@/lib/rateLimit';
import { invalidatePrefix } from '@/lib/cache';
import { validationFailed } from '@/lib/http/errors';
import { revalidatePages } from '@/lib/http/revalidate';
import { reorderDocumentsBody } from '@/lib/schemas/documents';
import * as documents from '@/lib/repositories/documents';
import * as audit from '@/lib/repositories/audit';
import { AUDIT_ACTIONS } from '@/lib/repositories/audit';

/**
 * POST /api/admin/documents/reorder — sets the display order of every
 * document.
 *
 * The body is the whole list in its new order, so a move is one request and
 * the result does not depend on what else was moved. The public page groups
 * by category and keeps this order within each group. A list that leaves out
 * a document, or names one that does not exist, is a 422: the screen it came
 * from is out of date.
 */
export default createRoute({
  POST: {
    body: reorderDocumentsBody,
    roles: ['admin', 'editor'],
    permission: 'downloads:write',
    rateLimit: RATE_LIMITS.api,
    handler: async ({ body, auth, ip, res }) => {
      if (!(await documents.reorder(body.ids))) {
        throw validationFailed(
          [{ field: 'ids', message: 'Must list every document exactly once; reload and try again' }],
          'Invalid request body',
        );
      }

      await audit.record({
        actorId: auth!.userId,
        actorEmail: auth!.email,
        action: AUDIT_ACTIONS.DOCUMENTS_REORDERED,
        entityType: 'document',
        changes: { order: body.ids },
        ipAddress: ip,
      });

      await invalidatePrefix('documents');
      await revalidatePages(res, ['/resources']);

      return { results: await documents.listAll() };
    },
  },
});
