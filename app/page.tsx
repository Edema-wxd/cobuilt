import type { Metadata } from 'next';
import HomePage from './home-page';
import { loadHomeLeaders } from './home-leadership';
import { loadHomeNews } from './home-news';
import { loadHomeProjects } from './home-projects';
import { loadHomeSettings } from './home-settings';
import { loadServiceCards } from './services/load-services';

/**
 * Public landing page — `/`.
 *
 * The page body is a client component: it holds the portfolio filter and the
 * "Register your interest" form. This file carries the metadata, which only a
 * server component can export, and loads what the page shows: published
 * projects and services, the latest news, the leadership spotlight, and the
 * settings set at /admin/homepage with the statistics.
 *
 * Each loader catches its own failure and returns its empty or as-built
 * value, so the build — which has no database — and an outage both render.
 */

// Regenerated at most once a minute, so a newly published project, article or
// settings change reaches the landing page within the minute. A settings save
// also asks for regeneration at once (pages/api/admin/settings/homepage.ts).
export const revalidate = 60;

export const metadata: Metadata = {
  // `absolute` because the house name is already in this title; the root
  // layout's template would otherwise append it a second time.
  title: { absolute: 'CoBuilt Investment Partners — Building Trust Through Every Brick' },
  description:
    'CoBuilt Investment Partners delivers high-quality residential, commercial, mixed-use and strategic developments in Nigeria. Every project carries a Project Passport — a permanent, public record from commencement to handover.',
};

export default async function Page() {
  const [settings, projects, services, news, leaders] = await Promise.all([
    loadHomeSettings(),
    loadHomeProjects(),
    loadServiceCards(),
    loadHomeNews(),
    loadHomeLeaders(),
  ]);

  return (
    <HomePage
      settings={settings}
      projects={projects}
      services={services}
      news={settings.showNews ? news : []}
      leaders={settings.showLeadership ? leaders : []}
    />
  );
}
