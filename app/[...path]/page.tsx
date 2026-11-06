import { redirectOrNotFound } from '../redirect-or-not-found';

/**
 * Every address no other route matches — `/about-us.html`, an old project
 * path — before it becomes the 404 page (docs/decisions.md §2.27). A rule at
 * `/admin/redirects` sends the visitor on; anything else is `notFound()`, the
 * same `app/not-found.tsx` as before.
 *
 * Rendered per request, so each hit is counted and a cache never fills with
 * one entry per mistyped URL. Static files, the API and every page route are
 * matched before this one and never reach it.
 */
export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ path: string[] }>;
}

export default async function Page({ params }: PageProps): Promise<never> {
  const { path } = await params;
  return redirectOrNotFound(`/${path.join('/')}`);
}
