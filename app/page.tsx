import type { Metadata } from 'next';
import HomePage from './home-page';
import { loadHomeProjects } from './home-projects';

/**
 * Public landing page — `/`.
 *
 * The page body is a client component: it holds the portfolio filter and the
 * "Register your interest" form. This file carries the metadata, which only a
 * server component can export, and loads the published projects it shows.
 */

// Regenerated at most once a minute, so a newly published project reaches the
// landing page in the same minute it reaches /projects.
export const revalidate = 60;

export const metadata: Metadata = {
  // `absolute` because the house name is already in this title; the root
  // layout's template would otherwise append it a second time.
  title: { absolute: 'CoBuilt Investment Partners — Building Trust Through Every Brick' },
  description:
    'CoBuilt Investment Partners delivers high-quality residential, commercial, mixed-use and strategic developments in Nigeria. Every project carries a Project Passport — a permanent, public record from commencement to handover.',
};

export default async function Page() {
  return <HomePage projects={await loadHomeProjects()} />;
}
