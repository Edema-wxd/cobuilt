import { z } from 'zod';
import type { NextApiResponse } from 'next';
import { createRoute } from '@/lib/http/route';
import { RATE_LIMITS } from '@/lib/rateLimit';
import { notFound } from '@/lib/http/errors';
import { attachmentDisposition } from '@/lib/storage/cvFiles';
import * as jobApplications from '@/lib/repositories/jobApplications';
import * as audit from '@/lib/repositories/audit';
import { AUDIT_ACTIONS } from '@/lib/repositories/audit';

/**
 * GET /api/admin/careers/applications/[applicationId]/cv — the CV, as an
 * attachment.
 *
 * This is the only way to a CV: the file is stored in PostgreSQL and is at no
 * URL of its own, so there is no link to leak (docs/decisions.md §2.28). It
 * takes a bearer token like every console call — the console fetches it and
 * hands the browser the bytes — and `applications:read`. Each download is
 * audited against the reader. The response is never cached, is always a
 * download rather than a page, and is sandboxed in case a browser renders it
 * anyway.
 */

// A CV is up to 4 MB (MAX_CV_BYTES), just over Next.js's default 4 MB warning line.
export const config = { api: { responseLimit: '5mb' } };

const params = z.object({ applicationId: z.string().uuid() });

function sendFile(res: NextApiResponse, file: { fileName: string; contentType: string; content: Buffer }): void {
  res.setHeader('Content-Type', file.contentType);
  res.setHeader('Content-Length', String(file.content.length));
  res.setHeader('Content-Disposition', attachmentDisposition(file.fileName));
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.status(200).end(file.content);
}

export default createRoute({
  GET: {
    query: params,
    permission: 'applications:read',
    rateLimit: RATE_LIMITS.api,
    handler: async ({ query, auth, ip, res }) => {
      const file = await jobApplications.readCv(query.applicationId);
      if (!file) throw notFound('Application not found');

      await audit.record({
        actorId: auth!.userId,
        actorEmail: auth!.email,
        action: AUDIT_ACTIONS.JOB_APPLICATION_CV_DOWNLOADED,
        entityType: 'job_application',
        entityId: query.applicationId,
        ipAddress: ip,
      });

      sendFile(res, file);
    },
  },
});
