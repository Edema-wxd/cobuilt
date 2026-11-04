import type { Metadata } from 'next';
import CtaBand from '../../components/CtaBand';
import PageHero from '../../components/PageHero';
import SiteLayout from '../../components/SiteLayout';
import { bodyCopy, sectionLight, titleMd } from '../../components/sections';
import { btnOutline, btnOutlineOnDark, container, eyebrow } from '../../components/ui';
import { loadLibrary } from './load-videos';
import VideoLibrary from './video-library';

/**
 * Video library — `/videos`.
 *
 * Films from the official CoBuilt YouTube channel, managed at /admin/videos:
 * project documentaries, construction updates, drone footage, leadership
 * interviews, educational, corporate and event films. The featured film leads
 * the page with a click-to-load player; the rest are a grid with category and
 * project filters and a search box.
 *
 * Unlike /news and /projects, the list is rendered on the server and filtered
 * in the browser (`./video-library.tsx`). A library is a few dozen films, not
 * a paginated archive, so the whole of it fits in the page; that keeps the
 * page prerendered and regenerated once a minute like /services, works with
 * JavaScript off (every film is listed), and makes a filter instant. The
 * filters still live in the query string, so a filtered view can be shared.
 *
 * Nothing on the page is requested from YouTube until a visitor presses play
 * (docs/decisions.md §2.23). Without a database the page says the library
 * could not be loaded, rather than that it is empty.
 */

// Regenerated at most once a minute, so a film published in the console
// reaches the page within the minute.
export const revalidate = 60;

export const metadata: Metadata = {
  title: 'Video library',
  description:
    'Project documentaries, construction updates, drone footage and leadership interviews from CoBuilt Investment Partners, each linked to the development it documents.',
};

export default async function Page() {
  const videos = await loadLibrary();

  return (
    <SiteLayout current="/media">
      <main>
        <PageHero
          eyebrow="Video library"
          title={
            <>
              Watch the work, <em>as it happens</em>.
            </>
          }
          standfirst="Documentaries, construction updates, drone footage and interviews from the official CoBuilt YouTube channel. Each film is tied to the development it documents, and the dated record behind it is in that project’s Passport™."
          trail={[
            { label: 'Home', href: '/' },
            { label: 'Media', href: '/media' },
            { label: 'Video library' },
          ]}
          actions={
            <a className={btnOutlineOnDark} href="/projects">
              Browse the projects
            </a>
          }
        />

        {videos && videos.length > 0 ? (
          <VideoLibrary videos={videos} />
        ) : (
          <section className={sectionLight}>
            <div className={`${container} flex max-w-160 flex-col items-start gap-4`}>
              <p className={eyebrow}>{videos ? 'Coming soon' : 'Not loaded'}</p>
              <h2 className={titleMd}>
                {videos
                  ? 'The first films are being prepared'
                  : 'The library couldn’t be loaded just now'}
              </h2>
              <p className={bodyCopy}>
                {videos
                  ? 'Films from site will appear here as they are published to the CoBuilt channel. Each development’s Project Passport™ carries its dated record in the meantime.'
                  : 'This is on our side, not yours. Please try again in a moment, or browse the projects and their Passport™ records.'}
              </p>
              <a className={btnOutline} href="/projects">
                Browse the projects
              </a>
            </div>
          </section>
        )}

        <CtaBand
          eyebrow="Press and partners"
          title="Need footage, or a film of your own scheme?"
          body="Journalists can request broadcast-quality footage for press use. Owners and partners can ask how a development of theirs would be documented, on film and in its Passport™."
        />
      </main>
    </SiteLayout>
  );
}
