import type { HomeSettings, HomeStat } from './home-page';
import type { HomepageSettings, StatKey } from '@/lib/schemas/settings';
import type { PortfolioCounts } from '@/lib/repositories/projects';
import { youtubeVideoId } from '@/lib/youtube';

/** The stat band's labels, in the order the band shows them. */
const STAT_LABELS: Record<StatKey, string> = {
  completed: 'Projects delivered',
  ongoing: 'Projects under development',
  units: 'Units developed',
  locations: 'Locations',
};

/**
 * The figures the band carried before it was read from the database. Shown
 * only when there is no database to count from — the build, or an outage —
 * so the band never reads as zeros because PostgreSQL was unreachable.
 */
export const FALLBACK_STATS: HomeStat[] = [
  { key: 'completed', value: 5, plus: true, label: STAT_LABELS.completed },
  { key: 'ongoing', value: 3, plus: false, label: STAT_LABELS.ongoing },
  { key: 'units', value: 30, plus: true, label: STAT_LABELS.units },
  { key: 'locations', value: 5, plus: true, label: STAT_LABELS.locations },
];

/** Every section on, the copy as built, no video: the page as it renders with no database. */
const FALLBACK: HomeSettings = {
  heroHeadline: null,
  heroSubheading: null,
  video: null,
  stats: FALLBACK_STATS,
  showNews: true,
  showLeadership: true,
};

/**
 * Each figure is the administrator's override where one is set, otherwise the
 * count from live projects. Units have no column to count, so they show only
 * when set. A figure of 0, counted or set, is left out — that is also how an
 * administrator hides one — so a fresh database shows no band at all rather
 * than a row of zeros.
 */
export function resolveStats(
  overrides: HomepageSettings['stats'],
  counts: PortfolioCounts,
): HomeStat[] {
  const computed: Record<StatKey, number> = { ...counts, units: 0 };

  return (Object.keys(STAT_LABELS) as StatKey[])
    .map((key) => {
      const override = overrides[key];
      return {
        key,
        value: override ? override.value : computed[key],
        plus: override ? override.plus : false,
        label: STAT_LABELS[key],
      };
    })
    .filter((stat) => stat.value > 0);
}

/**
 * The landing page's administrator-set content (`/admin/homepage`) and its
 * statistics, read on the server alongside the projects.
 *
 * Falls back to the page as built — and to the figures above — rather than
 * throwing when the database cannot be reached, so the build needs none.
 */
export async function loadHomeSettings(): Promise<HomeSettings> {
  try {
    const siteSettings = await import('@/lib/repositories/siteSettings');
    const projects = await import('@/lib/repositories/projects');

    const [{ settings }, counts] = await Promise.all([
      siteSettings.getHomepageSettings(),
      projects.portfolioCounts(),
    ]);

    const videoId = settings.sections.video ? youtubeVideoId(settings.video?.url) : null;

    return {
      heroHeadline: settings.heroHeadline,
      heroSubheading: settings.heroSubheading,
      video: videoId && settings.video ? { id: videoId, title: settings.video.title } : null,
      stats: resolveStats(settings.stats, counts),
      showNews: settings.sections.news,
      showLeadership: settings.sections.leadership,
    };
  } catch (error) {
    const { logger } = await import('@/lib/logger');
    logger.warn('Landing page settings unavailable; showing the page as built', {
      error: error instanceof Error ? error.message : String(error),
    });
    return FALLBACK;
  }
}
