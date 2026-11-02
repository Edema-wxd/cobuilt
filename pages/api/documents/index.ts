import { createRoute, CONTENT_CACHE } from '@/lib/http/route';
import { RATE_LIMITS } from '@/lib/rateLimit';
import { TTL, key, remember } from '@/lib/cache';
import { listDocumentsQuery } from '@/lib/schemas/documents';
import * as documents from '@/lib/repositories/documents';

/**
 * GET /api/documents — the download centre: every published document, in
 * editorial order.
 *
 * `?category=brochure` narrows it to one category and `?project=` (an id or a
 * slug) to the documents attached to one live project; an unknown or
 * unpublished project is an empty list, not a 404. Unpaginated: the set is a
 * few dozen files at most. Each document's `downloadUrl` is the counted
 * endpoint, never the file itself. Drafts are never returned here.
 */
export default createRoute({
  GET: {
    query: listDocumentsQuery,
    rateLimit: RATE_LIMITS.api,
    cache: CONTENT_CACHE,
    handler: async ({ query }) => {
      const results = await remember(
        key('documents:list', { category: query.category, project: query.project }),
        TTL.documents,
        async () => {
          if (!query.project) return documents.listPublished({ category: query.category });
          const projectId = await documents.resolveLiveProject(query.project);
          return projectId ? documents.listPublished({ category: query.category, projectId }) : [];
        },
      );
      return { results };
    },
  },
});
