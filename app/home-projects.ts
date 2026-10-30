import type { HomeProject } from './home-page';
import { MILESTONE_LABEL } from './projects/[slug]/project-shared';

/** How many of the most recently published projects the landing page shows. */
const LIMIT = 3;

/**
 * The landing page's project cards: the most recently published projects,
 * with Passport progress where the project has one. Reads the repositories
 * directly, so it sees exactly what /api/projects would return.
 *
 * Returns an empty list rather than throwing when the database cannot be
 * reached, so the page still renders (with its empty state) and the next
 * revalidation picks the projects up.
 */
export async function loadHomeProjects(): Promise<HomeProject[]> {
  try {
    const projectsRepo = await import('@/lib/repositories/projects');
    const passportRepo = await import('@/lib/repositories/passport');
    const { serializeProject } = await import('@/lib/serializers');

    const page = await projectsRepo.listProjects({ page: 1, pageSize: LIMIT, sort: 'recent' });

    return await Promise.all(
      page.results.map(async (row) => {
        const project = serializeProject(row);
        const progress = project.passport.enabled
          ? await passportRepo.progressForProject(project.id)
          : null;

        return {
          id: project.id,
          slug: project.slug,
          title: project.title,
          // The column is the project_status enum: ongoing, completed or future.
          status: project.status as HomeProject['status'],
          projectType: project.projectType,
          location: project.location,
          image: project.featuredImageUrl,
          passport: project.passport.enabled,
          completionTarget: project.passport.completionTarget,
          progress:
            progress && progress.total > 0
              ? {
                  percent: progress.percentComplete,
                  stage: progress.nextMilestone
                    ? (progress.nextMilestone.title ??
                      MILESTONE_LABEL[progress.nextMilestone.type] ??
                      null)
                    : 'Complete',
                }
              : null,
        };
      }),
    );
  } catch (error) {
    const { logger } = await import('@/lib/logger');
    logger.warn('Landing page projects unavailable', {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}
