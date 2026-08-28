import type { Job } from 'bullmq';
import { logger } from '../logger';
import { env } from '../env';
import { sendEmail } from '../mail';
import * as templates from '../mail/templates';
import type { EmailJobData, MaintenanceJobData, SearchJobData } from './index';
import * as projectsRepo from '../repositories/projects';
import * as newsRepo from '../repositories/news';
import * as formsRepo from '../repositories/forms';
import * as analyticsRepo from '../repositories/analytics';
import { purgeExpiredRefreshTokens } from '../auth/refreshTokens';
import { indexProject, indexNews, removeDocument, reindexAll } from '../search';

/** Job handlers, shared by the worker process and the integration tests. */

export async function processEmailJob(job: Job<EmailJobData>): Promise<void> {
  const { type, to, payload } = job.data;
  const message = buildEmail(type, payload);

  await sendEmail({ ...message, to });
  logger.info('Email sent', { type, jobId: job.id });
}

function buildEmail(type: EmailJobData['type'], payload: Record<string, unknown>) {
  // The payload is validated at enqueue time by the calling route; casting
  // here keeps the job data JSON-serialisable, which BullMQ requires.
  switch (type) {
    case 'inquiry-confirmation':
      return templates.inquiryConfirmation(payload as { name: string });
    case 'inquiry-notification':
      return templates.inquiryNotification(
        payload as Parameters<typeof templates.inquiryNotification>[0],
      );
    case 'investment-notification':
      return templates.investmentNotification(
        payload as Parameters<typeof templates.investmentNotification>[0],
      );
    case 'newsletter-confirmation':
      return templates.newsletterConfirmation(payload as { token: string });
    case 'newsletter-welcome':
      return templates.newsletterWelcome(payload as { unsubscribeToken: string });
    case 'password-reset':
      return templates.passwordReset(
        payload as { token: string; fullName: string | null },
      );
    case 'milestone-published':
      return templates.milestonePublished(
        payload as { projectTitle: string; projectSlug: string; milestoneTitle: string },
      );
    default: {
      // Exhaustiveness check: adding a job type without a template is a
      // compile error rather than a runtime surprise.
      const exhaustive: never = type;
      throw new Error(`Unknown email job type: ${String(exhaustive)}`);
    }
  }
}

export async function processSearchJob(job: Job<SearchJobData>): Promise<void> {
  const { action, index, id } = job.data;

  if (action === 'reindex') {
    const count = await reindexAll(index);
    logger.info('Search index rebuilt', { index, count });
    return;
  }

  if (!id) throw new Error(`Search job ${action} requires an id`);

  if (action === 'delete') {
    await removeDocument(index, id);
    return;
  }

  if (index === 'projects') {
    const project = await projectsRepo.findById(id, { includeUnpublished: true });
    if (!project) return;
    await indexProject(project);
  } else if (index === 'news') {
    const article = await newsRepo.findById(id, { includeUnpublished: true });
    if (!article) return;
    await indexNews(article);
  }
}

/**
 * Nightly maintenance: enforces the NDPA retention windows (§11) and rebuilds
 * the search index (§6).
 */
export async function processMaintenanceJob(job: Job<MaintenanceJobData>): Promise<void> {
  if (job.data.action === 'rebuild-search-index') {
    for (const index of ['projects', 'news', 'faqs'] as const) {
      const count = await reindexAll(index);
      logger.info('Search index rebuilt', { index, count });
    }
    return;
  }

  const [submissions, pageViews, refreshTokens] = await Promise.all([
    formsRepo.purgeExpired(),
    analyticsRepo.purgeExpiredPageViews(),
    purgeExpiredRefreshTokens(),
  ]);

  logger.info('Retention purge complete', {
    submissionsAnonymised: submissions,
    pageViewsDeleted: pageViews,
    refreshTokensDeleted: refreshTokens,
    formRetentionDays: env.RETENTION_FORM_SUBMISSION_DAYS,
  });
}
