import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import PassportRecord from './passport-record';
import { EMPTY, loadRecord } from './load-record';

/**
 * Project Passport™ — `/projects/[slug]/passport`.
 *
 * The record renders on the server, for the reasons the project page does
 * (docs/decisions.md §2.10) and one more of its own: a permanent public record
 * has to be readable, printable and crawlable without JavaScript. See
 * `passport-record.tsx` for what that shapes.
 *
 * A checkout with no database still renders: the load is wrapped, and a failure
 * shows the "couldn't be loaded" state rather than a 500. As on the project
 * page, this means the status is 200 rather than 503 — an App Router page
 * cannot set its own status code (§2.12).
 */

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const result = await loadRecord(slug);

  if (result.kind !== 'found' || !result.props.project) {
    // `absolute` because this is already the full title, so the root layout's
    // template must not append the house name a second time.
    return { title: { absolute: 'Project Passport™ — CoBuilt Investment Partners' } };
  }

  const { project, summary } = result.props;
  const title = `${project.title}: Project Passport™ — CoBuilt Investment Partners`;

  // A project whose Passport is not open has a page but no record. It stays out
  // of the index rather than competing with the development's own page for a
  // search result that would disappoint whoever followed it.
  if (!summary) {
    return {
      title: { absolute: title },
      description: `A Project Passport™ has not yet been opened for ${project.title}.`,
      robots: { index: false, follow: true },
    };
  }

  const description =
    `The Project Passport™ for ${project.title}` +
    (project.location ? ` in ${project.location}` : '') +
    `: a permanent, public record of ${summary.total === 0 ? 'the development' : `${summary.total} milestone${summary.total === 1 ? '' : 's'}`} from commencement to handover, with the date each was scheduled for beside the date it was met.`;

  return {
    title: { absolute: title },
    description,
    openGraph: {
      type: 'article',
      title: `${project.title} — Project Passport™`,
      description,
      ...(project.featuredImageUrl ? { images: [project.featuredImageUrl] } : {}),
    },
    // Always large: a page without its own image has a generated card
    // (opengraph-image.tsx beside it).
    twitter: { card: 'summary_large_image' },
  };
}

export default async function Page({ params }: PageProps) {
  const { slug } = await params;
  const result = await loadRecord(slug);

  if (result.kind === 'not-found') notFound();

  // `unavailable` falls through with empty props: the component's own
  // "couldn't be loaded" state is the designed response to a missing database.
  return <PassportRecord {...(result.kind === 'found' ? result.props : EMPTY)} />;
}
